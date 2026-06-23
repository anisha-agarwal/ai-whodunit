import { z } from 'zod';
import { CaseFile } from '@ai-whodunit/shared';
import type { IssueCode } from './types.js';

/**
 * The JSON-schema handed to Opus 4.8 as `output_config.format`, DERIVED from the single shared
 * `CaseFile` Zod schema — never re-declared here (re-deriving the schema would create a second,
 * divergent source of truth). `z.toJSONSchema` inlines every nested schema (no `$ref`/`$defs`
 * cycles) and emits standard Draft 2020-12 with `additionalProperties: false` on every object and
 * `oneOf` for the discriminated `Trigger` union — exactly the structured-output shape the API
 * accepts (no recursive/constraint features it rejects).
 *
 * The model is asked to emit the FULL server-only `CaseFile` (solution graph + dossier secrets +
 * `isGuilty`); `generateCase` re-`safeParse`s the result, so this schema is the model's contract,
 * not the engine's trust boundary.
 */
export const caseGenerationFormat: Record<string, unknown> = z.toJSONSchema(CaseFile, {
  target: 'draft-2020-12',
});

/**
 * The system prompt handed to Opus 4.8 alongside `caseGenerationFormat`. Names the closed-world /
 * solvability contract the deterministic solver will enforce so the model aims at a case that
 * passes the accept-gate on the first attempt. Static, non-empty, prose-free of any ground truth
 * (it describes the contract, never a specific case).
 */
export const caseGenerationSystemPrompt: string = [
  'You are the case author for AI Whodunit, a solo, replayable murder-mystery.',
  'Produce ONE complete CaseFile as a single JSON object conforming exactly to the provided schema.',
  '',
  'Hard requirements (a deterministic solver will reject any case that violates them):',
  '- Exactly one suspect has isGuilty=true and role=culprit; that suspect is solution.killerId.',
  '- The case must be SOLVABLE: after eliminating every suspect whose alibi is broken by a reliable,',
  '  clue-keyed trigger, exactly the guilty suspect remains as the sole surviving candidate.',
  '- The case must be CONSISTENT: the culprit’s alibi-breaking clue agrees with the solution, and',
  '  no two suspects’ alibis are broken by the same clue.',
  '- Every id referenced (clues, triggers, relationships, solution) must resolve into its catalog.',
  '- knowledge.knows is the closed world; knownFacts ⊆ knows; each secret.fact ∈ knows \\ knownFacts.',
  '',
  'Server-only fields (truth, secrets, isGuilty, role, solution) are required — the engine holds the',
  'full case server-side and redacts before anything reaches a player. Do not omit them.',
].join('\n');

/**
 * Map a previous attempt's stable issue codes into a deterministic regenerate hint for the next
 * prompt. Emits ONLY the stable codes (one per line, prefixed) — NEVER free prose, never a case
 * field — so the regenerate feedback is a structured signal the adapter folds into the prompt and a
 * test can pin on exact codes (a dropped code is a killable mutant). De-duplicates while preserving
 * first-seen order; empty input → empty string.
 */
export function regenerateHint(issues: readonly IssueCode[]): string {
  const seen = new Set<IssueCode>();
  const lines: string[] = [];
  for (const code of issues) {
    if (seen.has(code)) {
      continue;
    }
    seen.add(code);
    lines.push(`- ${code}`);
  }
  return lines.join('\n');
}
