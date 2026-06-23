import type { CaseFile, SuspectId } from '@ai-whodunit/shared';
import { SolverIssueCode, type SolverIssue } from './verdict.js';

/**
 * Prove the keyed culprit is itself reachable — i.e. `solution.killerId ∈ S`, the surviving
 * candidate set. A parse-valid case ALWAYS has the culprit's `breaksWhen` present (merged R16),
 * so a culprit absent from `S` was eliminated because its (present) break is a misleading clue or
 * an opaque, non-clue-keyed trigger — that is `CULPRIT_NOT_REACHABLE`. Mirrors shared's R5/R16
 * culprit logic (`refinements.ts:112-122, 253-259`).
 *
 * Returns the issue when the culprit is not reachable, else `null` (the pass-arm).
 */
export function proveCulpritReachable(
  caseFile: CaseFile,
  candidates: readonly SuspectId[],
): SolverIssue | null {
  const killerId = caseFile.solution.killerId;
  if (!candidates.includes(killerId)) {
    return {
      code: SolverIssueCode.CULPRIT_NOT_REACHABLE,
      detail: `solution.killerId ${killerId} is not in the surviving candidate set`,
    };
  }
  return null;
}

/**
 * Prove `S === { solution.killerId }` — the culprit is reachable AND it is the SOLE survivor.
 * Builds on `proveCulpritReachable`: if the culprit is reachable but `|S| > 1`, the case is
 * ambiguous (`MULTIPLE_CANDIDATES_SURVIVE`). Mirrors shared's R2 culprit cardinality
 * (`refinements.ts:86-92`).
 *
 * Returns the issue blocking solvability, else `null` (the solvable pass-arm).
 */
export function proveSolvable(
  caseFile: CaseFile,
  candidates: readonly SuspectId[],
): SolverIssue | null {
  const reachable = proveCulpritReachable(caseFile, candidates);
  if (reachable !== null) {
    return reachable;
  }
  if (candidates.length > 1) {
    return {
      code: SolverIssueCode.MULTIPLE_CANDIDATES_SURVIVE,
      detail: `${candidates.length} candidates survive; the case is ambiguous`,
    };
  }
  return null;
}
