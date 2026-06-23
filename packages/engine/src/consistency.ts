import type { CaseFile } from '@ai-whodunit/shared';
import { SolverIssueCode, type SolverIssue, type Contradiction } from './verdict.js';
import { breakingClueId } from './eliminate.js';

/**
 * Prove the culprit's break-clue placement matches the solution. Resolve the culprit
 * (`solution.killerId`) → its `clue-presented` `breaksWhen.clueId` → clue `c`; for each PRESENT
 * `c.refersTo.*` field, it must equal the corresponding solution field. R13 only checks present
 * refs RESOLVE to a catalog id, not that they match the solution — so a clue pointing at a real
 * but wrong location is a clean parse the solver must catch. Mirrors shared's R13 present-field
 * `refersTo` loop (`refinements.ts:213-236`).
 *
 * Returns the issue on any present-and-disagreeing ref, else `null`. When the culprit has no
 * resolvable `clue-presented` break or the clue is absent/has no `refersTo`, there is nothing to
 * contradict — the pass-arm (the culprit being unreachable is `solvability`'s concern, not this).
 */
export function checkCulpritBreakClue(caseFile: CaseFile): SolverIssue | null {
  const { solution } = caseFile;
  const culprit = caseFile.suspects.find((s) => s.id === solution.killerId);
  if (culprit === undefined) {
    return null;
  }

  const clueId = breakingClueId(culprit);
  if (clueId === null) {
    return null;
  }

  const clue = caseFile.clues.find((c) => c.id === clueId);
  const ref = clue?.refersTo;
  if (ref === undefined) {
    return null;
  }

  const mismatches: { value: string | undefined; expected: string; key: string }[] = [
    { value: ref.suspectId, expected: solution.killerId, key: 'suspectId' },
    { value: ref.weaponId, expected: solution.weaponId, key: 'weaponId' },
    { value: ref.locationId, expected: solution.locationId, key: 'locationId' },
    { value: ref.timeSlotId, expected: solution.timeSlotId, key: 'timeSlotId' },
  ];
  for (const m of mismatches) {
    if (m.value !== undefined && m.value !== m.expected) {
      return {
        code: SolverIssueCode.CULPRIT_BREAK_CLUE_OFF_SOLUTION,
        detail: `culprit break-clue refersTo.${m.key} ${m.value} disagrees with the solution`,
      };
    }
  }
  return null;
}

/**
 * The structured result of the clue-collision check — the issue (if any) plus the audit trail of
 * the colliding suspect pairs.
 */
export interface ClueCollisionResult {
  issue: SolverIssue | null;
  contradictions: readonly Contradiction[];
}

/**
 * Prove no two distinct suspects' alibis are broken by the same `clueId`. R12 only checks each
 * `clueId` resolves; no cross-suspect uniqueness refinement exists in shared. Decidable purely
 * over `ClueId`s. Mirrors shared's `findDuplicates`/first-seen `Set`-dup pattern
 * (`refinements.ts:56-68, 245-251`).
 *
 * Records one `Contradiction` per collision (the first-seen owner of the clue paired with the
 * later one) and raises `ALIBI_CLUE_COLLISION` when any collision exists.
 */
export function checkClueCollision(caseFile: CaseFile): ClueCollisionResult {
  const ownerByClueId = new Map<string, (typeof caseFile.suspects)[number]['id']>();
  const contradictions: Contradiction[] = [];

  for (const suspect of caseFile.suspects) {
    const clueId = breakingClueId(suspect);
    if (clueId === null) {
      continue;
    }
    const owner = ownerByClueId.get(clueId);
    if (owner === undefined) {
      ownerByClueId.set(clueId, suspect.id);
    } else {
      contradictions.push({ clueId, suspects: [owner, suspect.id] });
    }
  }

  const issue: SolverIssue | null =
    contradictions.length > 0
      ? {
          code: SolverIssueCode.ALIBI_CLUE_COLLISION,
          detail: `${contradictions.length} alibi(s) broken by an already-used clue`,
        }
      : null;

  return { issue, contradictions };
}
