import type { SuspectId, ClueId } from '@ai-whodunit/shared';

/**
 * Stable issue codes for every *reachable* solver failure class. Mirrors shared's
 * `CaseIssueCode` 1:1 — a `const` object of string literals (`as const`) plus the
 * `(typeof X)[keyof typeof X]` type, NOT a TS `enum`. Tests assert the SPECIFIC code, never
 * bare `solvable === false`, so a code-swap mutant is killed.
 *
 * `NO_CANDIDATE_SURVIVES` / `SURVIVOR_NOT_CULPRIT` are intentionally ABSENT: merged R16
 * (`shared/src/refinements.ts` — `CULPRIT_ALIBI_BREAKABLE`) makes them structurally unreachable
 * on any parse-valid `CaseFile`. Both collapse into `CULPRIT_NOT_REACHABLE`.
 */
export const SolverIssueCode = {
  // shared.safeParse failed — the case is not even well-formed (carries shared codes in detail).
  CASE_FILE_INVALID: 'CASE_FILE_INVALID',
  // killer ∉ S: its (present) breaksWhen is a misleading clue / an opaque, non-clue-keyed trigger.
  CULPRIT_NOT_REACHABLE: 'CULPRIT_NOT_REACHABLE',
  // killer ∈ S but |S| > 1 — more than one suspect survives, the case is ambiguous.
  MULTIPLE_CANDIDATES_SURVIVE: 'MULTIPLE_CANDIDATES_SURVIVE',
  // the culprit's break-clue `refersTo` (a present field) disagrees with the solution.
  CULPRIT_BREAK_CLUE_OFF_SOLUTION: 'CULPRIT_BREAK_CLUE_OFF_SOLUTION',
  // two distinct suspects' alibis are broken by the SAME clueId.
  ALIBI_CLUE_COLLISION: 'ALIBI_CLUE_COLLISION',
} as const;

export type SolverIssueCode = (typeof SolverIssueCode)[keyof typeof SolverIssueCode];

/** Why a suspect was eliminated from the candidate set (audit trail — branded ids + enum, no prose). */
export type EliminationReason =
  | 'alibi-unbreakable' // breaksWhen === undefined (a genuine alibi)
  | 'break-clue-misleading' // a breaking clue exists but its reliability === 'misleading'
  | 'break-trigger-opaque'; // breaksWhen is fact-confronted / contradiction-exposed (not clue-keyed)

/** One eliminated suspect + the (resolvable) clue that broke them, if any. */
export interface Elimination {
  suspectId: SuspectId;
  byClueId: ClueId | null;
  reason: EliminationReason;
}

/** Two distinct suspects whose alibis are broken by the same clue. */
export interface Contradiction {
  clueId: ClueId;
  suspects: readonly [SuspectId, SuspectId];
}

/** One stable-coded solver issue. `detail` is structural context — NOT prose to pin a test on. */
export interface SolverIssue {
  code: SolverIssueCode;
  detail: string;
}

/**
 * The machine-checked proof artifact. Carries ONLY booleans + branded ids + enum codes —
 * never a dossier field, secret, `isGuilty`, or solution field (server-authoritative invariant).
 * `issues` is empty ⟺ `solvable && consistent`.
 */
export interface SolverVerdict {
  solvable: boolean; // S === { solution.killerId }
  consistent: boolean; // culprit break-clue agrees with the solution + no clue-collision
  culpritId: SuspectId | null; // the sole reachable candidate when solvable; null otherwise
  candidates: readonly SuspectId[];
  eliminations: readonly Elimination[];
  contradictions: readonly Contradiction[];
  issues: readonly SolverIssue[];
}
