import type { SuspectId } from '@ai-whodunit/shared';
import type { GenerationFailureReason, IssueCode } from '../generate/types.js';

/**
 * Per-case CLI outcome — codes + branded ids only, NEVER prose, NEVER the `caseFile`.
 *
 * The merged `GenerationResult.ok === true` arm carries the FULL server-only `caseFile` (solution
 * graph + secrets + `isGuilty`) — correct, because the engine has no wire surface. `generateN`
 * PROJECTS that arm DOWN to this codes+numbers+branded-id shape (server-authoritative): from the
 * success arm it keeps only `verdict.culpritId`; from the failure arm only `reason` + the stable
 * `lastIssues` codes. The `caseFile` itself is never threaded into an outcome or report.
 */
export interface CaseOutcome {
  /** `result.ok` — the case parsed ∧ was solvable ∧ consistent. */
  readonly accepted: boolean;
  /** How many generate→solve→regenerate attempts this case took. */
  readonly attempts: number;
  /** `result.ok ? result.verdict.culpritId : null` — the sole reachable culprit when accepted. */
  readonly culpritId: SuspectId | null;
  /** `result.ok ? null : result.reason` — the stable exhaustion reason on reject. */
  readonly failureReason: GenerationFailureReason | null;
  /** `result.ok ? [] : result.lastIssues` — the final attempt's stable codes on reject. */
  readonly lastIssues: readonly IssueCode[];
}

/**
 * Aggregate report for `wd-generate-n`. Codes + numbers + branded ids only — server-authoritative-
 * safe. No dossier field, secret, `isGuilty`, or solution graph crosses into it; this mirrors the
 * discipline `SolverVerdict` and `GenerationResult.ok === false` already follow.
 */
export interface GenerateReport {
  /** N — how many cases were requested. */
  readonly requested: number;
  /** How many of the requested cases were accepted (`result.ok`). */
  readonly accepted: number;
  /** Accepted ∧ `verdict.solvable` ∧ `verdict.consistent` — counted by the deterministic solver. */
  readonly solvable: number;
  /** `solvable / requested × 100`, a 0..100 number (deterministic; NOT an LLM judgment). */
  readonly solvabilityPct: number;
  /** Histogram over the FULL `GenerationFailureReason` member set — every bucket initialised to 0. */
  readonly failuresByReason: Readonly<Record<GenerationFailureReason, number>>;
  /** One projected outcome per requested case, in generation order. */
  readonly outcomes: readonly CaseOutcome[];
}
