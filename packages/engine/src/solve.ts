import { CaseFile } from '@ai-whodunit/shared';
import { SolverIssueCode, type SolverIssue, type SolverVerdict } from './verdict.js';
import { classifyAlibis } from './eliminate.js';
import { proveSolvable } from './solvability.js';
import { checkCulpritBreakClue, checkClueCollision } from './consistency.js';

/**
 * THE public entry point. Pure, deterministic, and TOTAL — it never throws. Invalid input yields a
 * verdict carrying `CASE_FILE_INVALID`, NOT an exception.
 *
 * The solver re-`safeParse`s defensively (the ARM-6 structural gate) and TRUSTS shared's R1a–R16 —
 * it does NOT re-implement the structural refinements. On a parse-valid case it deduces solvability
 * (the surviving candidate set narrows to exactly `solution.killerId`) and consistency (the culprit
 * break-clue placement agrees with the solution + no two alibis share a breaking clue), then
 * assembles a structured proof artifact carrying only booleans, branded ids, and enum codes.
 *
 * Mirrors shared's `validateAccusation` collect-issues `{ ok, issues }` shape.
 */
export function solveCase(caseFile: CaseFile): SolverVerdict {
  const parsed = CaseFile.safeParse(caseFile);
  if (!parsed.success) {
    return {
      solvable: false,
      consistent: false,
      culpritId: null,
      candidates: [],
      eliminations: [],
      contradictions: [],
      issues: [
        {
          code: SolverIssueCode.CASE_FILE_INVALID,
          detail: parsed.error.issues.map((i) => i.message).join('; '),
        },
      ],
    };
  }

  const cf = parsed.data;
  const issues: SolverIssue[] = [];

  // Solvability — narrow the suspect set and prove S === { solution.killerId }.
  const { candidates, eliminations } = classifyAlibis(cf);
  const solvabilityIssue = proveSolvable(cf, candidates);
  if (solvabilityIssue !== null) {
    issues.push(solvabilityIssue);
  }
  const solvable = solvabilityIssue === null;

  // Consistency — two structural id-only predicates over the parsed case.
  const breakClueIssue = checkCulpritBreakClue(cf);
  if (breakClueIssue !== null) {
    issues.push(breakClueIssue);
  }
  const { issue: collisionIssue, contradictions } = checkClueCollision(cf);
  if (collisionIssue !== null) {
    issues.push(collisionIssue);
  }
  const consistent = breakClueIssue === null && collisionIssue === null;

  return {
    solvable,
    consistent,
    culpritId: solvable ? cf.solution.killerId : null,
    candidates,
    eliminations,
    contradictions,
    issues,
  };
}
