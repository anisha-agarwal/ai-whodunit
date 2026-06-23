import { generateCase } from '../generate/generate.js';
import {
  GenerationFailureReason,
  type GenerationDeps,
  type GenerateOptions,
} from '../generate/types.js';
import type { CaseOutcome, GenerateReport } from './types.js';

/** Options for {@link generateN} — `GenerateOptions` (`{ maxAttempts; seed? }`) plus the run size. */
export interface GenerateNOptions extends GenerateOptions {
  /** N — how many cases to generate+validate. */
  readonly n: number;
}

/**
 * Initialise a zero-filled histogram over the FULL `GenerationFailureReason` member set. Every
 * bucket starts at 0 so a never-seen reason still reports `0` (not absent) — a dropped bucket is a
 * mutation-probe target. Keyed off the runtime `GenerationFailureReason` const so the histogram
 * tracks the union automatically.
 */
function emptyFailuresByReason(): Record<GenerationFailureReason, number> {
  const histogram = {} as Record<GenerationFailureReason, number>;
  for (const reason of Object.values(GenerationFailureReason)) {
    histogram[reason] = 0;
  }
  return histogram;
}

/**
 * Compute solvability % from the per-case outcomes: solvable / requested × 100, a 0..100 number.
 * Deterministic — counted from the outcomes the deterministic solver produced, NEVER an LLM. A
 * `requested` of 0 yields 0 (no division by zero). Total — never throws.
 *
 * `solvable` is `accepted` here: `generateN` only records `accepted: true` when
 * `result.ok && result.verdict.solvable && result.verdict.consistent`, so an accepted outcome IS a
 * solvable+consistent one — the solver's own shippable predicate.
 */
export function aggregateSolvability(
  outcomes: readonly CaseOutcome[],
  requested: number,
): number {
  if (requested <= 0) {
    return 0;
  }
  const solvable = outcomes.filter((outcome) => outcome.accepted).length;
  return (solvable / requested) * 100;
}

/**
 * Drive `generateCase` `opts.n` times via the injected `GenerationDeps`, projecting each
 * `GenerationResult` DOWN to a server-authoritative-safe `CaseOutcome` (codes + numbers + branded
 * ids — NEVER the full `caseFile`). Pure orchestration over the engine; TOTAL — it never throws,
 * mirroring `generateCase`/`solveCase` (the loop relies on `generateCase` being total).
 *
 * Each iteration runs the same `{ maxAttempts, seed? }` contract. The aggregate `solvable` count and
 * `solvabilityPct` are the deterministic solver's verdict counted over the run — no LLM judges
 * solvability. `failuresByReason` histograms every reject's stable reason over the full member set.
 */
export async function generateN(
  deps: GenerationDeps,
  opts: GenerateNOptions,
): Promise<GenerateReport> {
  const { n, maxAttempts, seed } = opts;
  const generateOpts: GenerateOptions = seed !== undefined ? { maxAttempts, seed } : { maxAttempts };

  const outcomes: CaseOutcome[] = [];
  const failuresByReason = emptyFailuresByReason();
  let accepted = 0;
  let solvable = 0;

  for (let i = 0; i < n; i += 1) {
    const result = await generateCase(deps, generateOpts);

    if (result.ok) {
      accepted += 1;
      // Accept ⟺ the solver proved solvable ∧ consistent (generateCase's accept predicate), so an
      // accepted result is a solvable+consistent one — count it as solvable.
      if (result.verdict.solvable && result.verdict.consistent) {
        solvable += 1;
      }
      outcomes.push({
        accepted: true,
        attempts: result.attempts,
        culpritId: result.verdict.culpritId,
        failureReason: null,
        lastIssues: [],
      });
    } else {
      failuresByReason[result.reason] += 1;
      outcomes.push({
        accepted: false,
        attempts: result.attempts,
        culpritId: null,
        failureReason: result.reason,
        lastIssues: result.lastIssues,
      });
    }
  }

  return {
    requested: n,
    accepted,
    solvable,
    solvabilityPct: aggregateSolvability(outcomes, n),
    failuresByReason,
    outcomes,
  };
}
