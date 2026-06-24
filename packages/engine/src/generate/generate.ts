import { CaseFile } from '@ai-whodunit/shared';
import { solveCase } from '../solve.js';
import { caseGenerationFormat, caseGenerationSystemPrompt } from './contract.js';
import {
  GenerationFailureReason,
  GENERATE_FN_REJECTED,
  type GenerationDeps,
  type GenerationResult,
  type GenerateOptions,
  type IssueCode,
} from './types.js';

/**
 * THE generation entry point. Pure orchestration (no LLM in the loop itself), and TOTAL — it never
 * throws, mirroring `solveCase`: an injected `GenerateFn` that rejects is CAUGHT and recorded, not
 * propagated. The loop is a bounded generate → parse-gate → solve-gate → regenerate cycle:
 *
 *   1. Ask the injected `GenerateFn` (the engine's only LLM seam) for a raw case, handing it the
 *      static schema/prompt contract + the previous attempt's stable codes (regenerate feedback).
 *   2. Re-validate the raw object with the real Zod `CaseFile.safeParse` (the parse-gate — the fake
 *      is NEVER trusted to return a branded `CaseFile`).
 *   3. Gate the parsed case on the deterministic `solveCase`; ACCEPT ⟺ `solvable && consistent`
 *      (the solver's own shippable predicate).
 *   4. On accept: invoke the optional `store` sink exactly once, return `{ ok: true, ... }`.
 *   5. Otherwise record this attempt's stable codes and loop.
 *
 * `maxAttempts < 1` runs ZERO attempts (the `GenerateFn` is never called) and returns `NO_ATTEMPTS`.
 *
 * On exhaustion the terminal reason is chosen from the ACCUMULATED structural facts across all
 * attempts (a priority ladder), NOT from the last attempt's classification — so a heterogeneous
 * history (e.g. unsolvable → inconsistent → unsolvable) reports the strongest real signal it ever
 * saw (`NEVER_CONSISTENT`), with the transport-reject branch checked LAST (lowest priority): a real
 * solve/parse signal always outranks "the LLM call failed". `lastIssues` always carries the FINAL
 * attempt's stable codes (which can diverge from the aggregate-selected `reason` on a mixed run).
 */
export async function generateCase(
  deps: GenerationDeps,
  opts: GenerateOptions,
): Promise<GenerationResult> {
  const { maxAttempts, seed } = opts;

  // Zero-attempt guard FIRST — distinct terminal; the `GenerateFn` is never called.
  if (maxAttempts < 1) {
    return { ok: false, reason: GenerationFailureReason.NO_ATTEMPTS, attempts: 0, lastIssues: [] };
  }

  // History-aggregate flags — the exhaustion terminal is decided from these, not the last attempt.
  let sawParse = false; // some attempt passed `CaseFile.safeParse`
  let sawParseFail = false; // some attempt RAN `safeParse` and it FAILED
  let sawSolvable = false; // some attempt's verdict was `solvable`

  let lastIssues: readonly IssueCode[] = [];
  let attempts = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    attempts = attempt;
    const priorIssues = lastIssues;

    let raw: unknown;
    try {
      raw = await deps.generate({
        systemPrompt: caseGenerationSystemPrompt,
        format: caseGenerationFormat,
        attempt,
        priorIssues,
        // Forward the opaque scenario seed only when supplied — `exactOptionalPropertyTypes` rejects an
        // explicit `seed: undefined` for the optional field, so absent stays truly absent.
        ...(seed !== undefined ? { seed } : {}),
      });
    } catch {
      // Reject is RECOVERABLE — record the sentinel, keep looping. No throw escapes. Reject is the
      // LOWEST-priority signal: it leaves `lastIssues` carrying the sentinel but sets NONE of the
      // parse/solve history flags, so any later real parse/solve signal outranks it in the selector.
      lastIssues = [GENERATE_FN_REJECTED];
      continue;
    }

    const parsed = CaseFile.safeParse(raw);
    if (!parsed.success) {
      sawParseFail = true;
      lastIssues = parsed.error.issues.map((i) => i.message as IssueCode);
      continue;
    }

    sawParse = true;
    const caseFile = parsed.data;
    const verdict = solveCase(caseFile);
    if (verdict.solvable) {
      sawSolvable = true;
    }

    // Accept predicate is EXACTLY the solver's shippable predicate.
    if (verdict.solvable && verdict.consistent) {
      await deps.store?.(caseFile, verdict);
      return { ok: true, caseFile, verdict, attempts };
    }

    lastIssues = verdict.issues.map((i) => i.code as IssueCode);
  }

  return {
    ok: false,
    reason: selectExhaustionReason({ sawParse, sawParseFail, sawSolvable }),
    attempts,
    lastIssues,
  };
}

/**
 * Pick the exhaustion terminal by priority ladder over the accumulated parse/solve history. A real
 * solve/parse signal always outranks the transport reject — so the three parse/solve flags are
 * checked first (highest to lowest real-signal priority) and the transport-reject terminal is the
 * LOWEST-priority bottom (returned only when NO parse/solve signal was ever recorded across the
 * run). Reachable only after ≥1 attempt ran (the `maxAttempts < 1` guard owns the no-attempt
 * terminal); when none of the three parse/solve flags is set, every attempt rejected, so the sole
 * remaining signal is the transport reject.
 *
 * `sawReject` is intentionally NOT tracked as a flag: it would be dead state. The transport reject
 * sets NONE of the three parse/solve flags, so "no parse/solve flag set after ≥1 attempt" IS the
 * reject terminal — deriving it from the absence of the other flags (rather than a parallel boolean
 * the selector reads only on an unreachable false-branch) keeps every branch here load-bearing.
 */
function selectExhaustionReason(flags: {
  sawParse: boolean;
  sawParseFail: boolean;
  sawSolvable: boolean;
}): GenerationFailureReason {
  if (flags.sawSolvable) {
    // Some attempt was solvable but none also consistent.
    return GenerationFailureReason.NEVER_CONSISTENT;
  }
  if (flags.sawParse) {
    // Some attempt parsed but none was solvable.
    return GenerationFailureReason.NEVER_SOLVABLE;
  }
  if (flags.sawParseFail) {
    // ≥1 attempt RAN `safeParse` and none passed — a real malformed case.
    return GenerationFailureReason.PARSE_NEVER_VALID;
  }
  // No parse/solve signal ever recorded ⇒ every attempt rejected — reject was the SOLE signal.
  // Checked LAST (lowest priority): any real parse/solve signal above outranks "the LLM call failed".
  return GenerationFailureReason.GENERATE_FN_REJECTED;
}
