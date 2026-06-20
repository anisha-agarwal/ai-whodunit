import type { CaseFile, Dossier, SuspectId, ClueId } from '@ai-whodunit/shared';
import type { Elimination } from './verdict.js';

/**
 * The per-suspect classification of one alibi against the case's clue catalog. A suspect is a
 * `candidate` iff their alibi breaks on a TRUTHFUL, resolvable, `clue-presented` trigger;
 * otherwise they are `eliminated` with an audit reason. Mirrors shared's R12 per-suspect
 * `forEach` + `Set.has(clueIds)` structure (`refinements.ts:195-211`).
 */
export interface AlibiClassification {
  candidates: readonly SuspectId[];
  eliminations: readonly Elimination[];
}

/**
 * Classify every suspect's alibi from `breaksWhen` structure + truthful clue availability.
 *
 * Per suspect `s`:
 *   - `breaksWhen === undefined`            → eliminated (`alibi-unbreakable`)
 *   - `clue-presented` + truthful clue      → candidate, broken by that clueId
 *   - `clue-presented` + misleading clue    → eliminated (`break-clue-misleading`)
 *   - `clue-presented` + unresolvable clue  → eliminated (`break-clue-misleading`, no clue)
 *   - `fact-confronted`/`contradiction-exposed` (opaque, non-clue-keyed) → eliminated (`break-trigger-opaque`)
 *
 * Pure single-pass over a finite suspect×clue relation — no search, no NLP, no LLM.
 */
export function classifyAlibis(caseFile: CaseFile): AlibiClassification {
  const truthfulClueIds = new Set<string>(
    caseFile.clues.filter((c) => c.reliability === 'truthful').map((c) => c.id),
  );
  const candidates: SuspectId[] = [];
  const eliminations: Elimination[] = [];

  for (const suspect of caseFile.suspects) {
    const bw = suspect.alibi.breaksWhen;

    if (bw === undefined) {
      eliminations.push({ suspectId: suspect.id, byClueId: null, reason: 'alibi-unbreakable' });
      continue;
    }

    if (bw.kind !== 'clue-presented') {
      eliminations.push({ suspectId: suspect.id, byClueId: null, reason: 'break-trigger-opaque' });
      continue;
    }

    if (truthfulClueIds.has(bw.clueId)) {
      candidates.push(suspect.id);
    } else {
      eliminations.push({
        suspectId: suspect.id,
        byClueId: bw.clueId,
        reason: 'break-clue-misleading',
      });
    }
  }

  return { candidates, eliminations };
}

/**
 * The surviving candidate set `S` — exactly the suspects broken by a truthful, available,
 * `clue-presented` clue. A thin projection of `classifyAlibis` so callers can narrow without
 * re-deriving the classification.
 */
export function survivingCandidates(caseFile: CaseFile): readonly SuspectId[] {
  return classifyAlibis(caseFile).candidates;
}

/**
 * The clueId that breaks a suspect's alibi when it is a resolvable `clue-presented` trigger,
 * else `null`. Used by the consistency checks to key alibis on their breaking clue.
 */
export function breakingClueId(suspect: Dossier): ClueId | null {
  const bw = suspect.alibi.breaksWhen;
  return bw !== undefined && bw.kind === 'clue-presented' ? bw.clueId : null;
}
