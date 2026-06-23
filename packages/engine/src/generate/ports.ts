import type { CaseFile } from '@ai-whodunit/shared';
import type { SolverVerdict } from '../verdict.js';
import type { GenerationRequest } from './types.js';

/**
 * The injected async generation fn — the engine's ONLY seam to the LLM. The real implementation
 * (the Opus 4.8 `output_config.format` call via `@anthropic-ai/sdk`, holding the Anthropic key)
 * lives in `apps/api`, NOT in this pure package — importing the SDK here would break engine purity
 * AND put a secret in a pure package. It returns the RAW object (`unknown`); `generateCase`
 * re-`safeParse`s it, so the port is never trusted to hand back a branded `CaseFile` — a recorded
 * fixture and a real LLM are interchangeable. A `GenerateFn` that REJECTS is caught by the loop and
 * recorded as a `GENERATE_FN_REJECTED` attempt (no `safeParse` runs for it).
 */
export type GenerateFn = (request: GenerationRequest) => Promise<unknown>;

/**
 * The injected success sink — invoked exactly once when a generated case is ACCEPTED (parse-valid
 * ∧ `solvable` ∧ `consistent`). Default is identity (return-only): the engine performs no
 * persistence itself (a DB client in pure engine would break purity). Real Postgres persistence is
 * an `apps/api` milestone that supplies a concrete `StoreFn`.
 */
export type StoreFn = (accepted: CaseFile, verdict: SolverVerdict) => void | Promise<void>;
