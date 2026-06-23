import { describe, it, expect } from 'vitest';
import { caseGenerationFormat, caseGenerationSystemPrompt, regenerateHint } from './contract.js';
import { GENERATE_FN_REJECTED } from './types.js';

/**
 * The static contract handed to Opus 4.8: the json-schema `output_config.format` (derived from the
 * single shared `CaseFile` Zod schema), the system prompt, and `regenerateHint`. Tests assert
 * STRUCTURE + schema-validity + stable-code presence — never an LLM prose string.
 */
describe('caseGenerationFormat — derived json-schema', () => {
  it('targets Draft 2020-12 ($schema names the 2020-12 dialect)', () => {
    // Kills the `target: 'draft-2020-12'` → `target: ''` mutant: a different/empty target emits a
    // different $schema dialect URI (or omits it).
    expect(caseGenerationFormat.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
  });

  it('is a Draft 2020-12 object-typed schema with the CaseFile top-level properties', () => {
    expect(typeof caseGenerationFormat).toBe('object');
    expect(caseGenerationFormat.type).toBe('object');
    // Derived from CaseFile — its top-level envelope fields must be present as properties.
    const props = caseGenerationFormat.properties as Record<string, unknown>;
    expect(props).toBeDefined();
    for (const key of [
      'victim',
      'weapons',
      'locations',
      'timeline',
      'suspects',
      'clues',
      'solution',
    ]) {
      expect(props[key]).toBeDefined();
    }
  });

  it('is fully inlined — no $ref/$defs cycles the structured-output API rejects', () => {
    // z.toJSONSchema inlines nested schemas; assert no top-level $defs and no $ref anywhere.
    expect(caseGenerationFormat.$defs).toBeUndefined();
    expect(JSON.stringify(caseGenerationFormat)).not.toContain('$ref');
  });

  it('closes every object with additionalProperties:false (closed-world structured output)', () => {
    expect(caseGenerationFormat.additionalProperties).toBe(false);
  });
});

describe('caseGenerationSystemPrompt', () => {
  // The prompt is an ENGINE-OWNED static contract constant (NOT an LLM output string) — pinning its
  // exact content is a legitimate regression-lock, and it is what makes each prose line load-bearing:
  // dropping/blanking any line, or joining the lines without newlines, breaks this equality. The
  // expected text is reconstructed INDEPENDENTLY here (not read back from the import) so the
  // assertion is not a tautology.
  const expectedPrompt = [
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

  it('matches its exact static contract content (every line load-bearing; newline-joined)', () => {
    expect(caseGenerationSystemPrompt).toBe(expectedPrompt);
  });

  it('is a non-empty string naming the solvability/consistency contract (no specific-case ground truth)', () => {
    expect(typeof caseGenerationSystemPrompt).toBe('string');
    expect(caseGenerationSystemPrompt.length).toBeGreaterThan(0);
    expect(caseGenerationSystemPrompt).toContain('SOLVABLE');
    expect(caseGenerationSystemPrompt).toContain('CONSISTENT');
    // Multiple newline-joined lines — kills the `.join('\n')` → `.join('')` mutant.
    expect(caseGenerationSystemPrompt.split('\n').length).toBe(14);
  });
});

describe('regenerateHint', () => {
  it('empty input → empty string', () => {
    expect(regenerateHint([])).toBe('');
  });

  it('emits one line per code containing the stable code (not prose)', () => {
    const hint = regenerateHint(['CULPRIT_NOT_REACHABLE']);
    expect(hint).toContain('CULPRIT_NOT_REACHABLE');
    expect(hint.split('\n')).toHaveLength(1);
  });

  it('emits every distinct code — one line each, all present', () => {
    const hint = regenerateHint([
      'CULPRIT_NOT_REACHABLE',
      'CULPRIT_BREAK_CLUE_OFF_SOLUTION',
      GENERATE_FN_REJECTED,
    ]);
    const lines = hint.split('\n');
    expect(lines).toHaveLength(3);
    expect(hint).toContain('CULPRIT_NOT_REACHABLE');
    expect(hint).toContain('CULPRIT_BREAK_CLUE_OFF_SOLUTION');
    expect(hint).toContain(GENERATE_FN_REJECTED);
  });

  it('de-duplicates while preserving first-seen order', () => {
    const hint = regenerateHint([
      'CULPRIT_NOT_REACHABLE',
      'CULPRIT_BREAK_CLUE_OFF_SOLUTION',
      'CULPRIT_NOT_REACHABLE',
    ]);
    const lines = hint.split('\n');
    // The duplicate is dropped → 2 lines, in first-seen order.
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('CULPRIT_NOT_REACHABLE');
    expect(lines[1]).toContain('CULPRIT_BREAK_CLUE_OFF_SOLUTION');
  });
});
