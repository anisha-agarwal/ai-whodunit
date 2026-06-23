import type { CaseFile, CaseIssueCode } from '@ai-whodunit/shared';
import type { SolverIssueCode, SolverVerdict } from '../verdict.js';
import type { GenerateFn, StoreFn } from './ports.js';

/**
 * The transport-reject sentinel. NOT a `CaseIssueCode` or `SolverIssueCode` — it records that the
 * injected `GenerateFn` itself rejected (the LLM call failed) on an attempt, distinct from a case
 * that parsed-but-failed or never parsed. Mirrors the `as const` string-literal pattern of
 * shared's `CaseIssueCode` and the engine's `SolverIssueCode` (a value + a same-named type), so a
 * code-swap mutant is killable. It is the LOWEST-priority signal in the exhaustion ladder.
 */
export const GENERATE_FN_REJECTED = 'GENERATE_FN_REJECTED' as const;
export type GENERATE_FN_REJECTED = typeof GENERATE_FN_REJECTED;

/**
 * Every stable code that can appear in `priorIssues` / `lastIssues`. The loop reads ONLY structural
 * signals — never prose: a parse failure carries the shared `CaseIssueCode`(s) from
 * `CaseFile.safeParse`, a solve/consistency failure carries the engine `SolverIssueCode`(s) from
 * `solveCase`, and a transport reject carries the `GENERATE_FN_REJECTED` sentinel.
 */
export type IssueCode = CaseIssueCode | SolverIssueCode | typeof GENERATE_FN_REJECTED;

/**
 * One stable code per REACHABLE exhaustion terminal — picked by the history-aggregate priority
 * ladder, NOT by classifying the last attempt. Mirrors the engine `SolverIssueCode` `as const`
 * pattern (string-literal const-object + same-named type; no TS `enum`) so tests assert the
 * SPECIFIC reason and a reason-swap mutant dies.
 */
export const GenerationFailureReason = {
  // Some attempt was solvable, but no attempt was ALSO consistent. (Highest real-signal priority.)
  NEVER_CONSISTENT: 'NEVER_CONSISTENT',
  // Some attempt parsed, but no attempt was solvable.
  NEVER_SOLVABLE: 'NEVER_SOLVABLE',
  // Some attempt's `GenerateFn` resolved but ran `safeParse` and none ever passed.
  PARSE_NEVER_VALID: 'PARSE_NEVER_VALID',
  // No attempt ever produced a real parse/solve result — reject was the SOLE signal. (Lowest.)
  GENERATE_FN_REJECTED: 'GENERATE_FN_REJECTED',
  // `maxAttempts < 1` — zero attempts ran; `GenerateFn` was never called.
  NO_ATTEMPTS: 'NO_ATTEMPTS',
} as const;

export type GenerationFailureReason =
  (typeof GenerationFailureReason)[keyof typeof GenerationFailureReason];

/**
 * What the loop hands `GenerateFn` each attempt: the static schema/prompt contract plus any
 * structured reject hint from the prior attempt. The loop CONSTRUCTS this — it is not the caller's
 * input. `priorIssues` is the stable `CaseIssueCode`/`SolverIssueCode`/sentinel set from the last
 * attempt (empty on attempt 1), type-enforced to "codes, never prose".
 */
export interface GenerationRequest {
  /** `caseGenerationSystemPrompt` — the static closed-world/solvability contract. */
  readonly systemPrompt: string;
  /** `caseGenerationFormat` — the json-schema the adapter passes to `output_config.format`. */
  readonly format: unknown;
  /** 1-based attempt index. */
  readonly attempt: number;
  /** Stable codes from the previous attempt; `[]` on attempt 1. */
  readonly priorIssues: readonly IssueCode[];
}

/** Loop bounds. `maxAttempts < 1` runs ZERO attempts and returns `NO_ATTEMPTS`. */
export interface GenerateOptions {
  /** Upper bound on generate→solve→regenerate iterations (caller-supplied). */
  readonly maxAttempts: number;
  /** Optional opaque scenario seed threaded into the prompt context. */
  readonly seed?: string;
}

/**
 * The injected ports `generateCase` depends on — the engine's ONLY seam to the impure world. The
 * Opus 4.8 transport adapter (the real `GenerateFn`) lives in `apps/api`, never in this pure
 * package. `store` is optional (default identity — return-only).
 */
export interface GenerationDeps {
  readonly generate: GenerateFn;
  readonly store?: StoreFn;
}

/**
 * The discriminated-union result. Mirrors `SolverVerdict`'s structured-result shape (booleans +
 * branded ids + enum codes; no prose to pin a test on). On success it carries the FULL server-only
 * `CaseFile` (solution graph + secrets + `isGuilty`) — correct, because the engine has no wire
 * surface; redaction is `apps/api`'s job via `toPublicCaseFile`.
 */
export type GenerationResult =
  | {
      readonly ok: true;
      readonly caseFile: CaseFile;
      readonly verdict: SolverVerdict;
      readonly attempts: number;
    }
  | {
      readonly ok: false;
      readonly reason: GenerationFailureReason;
      readonly attempts: number;
      readonly lastIssues: readonly IssueCode[];
    };
