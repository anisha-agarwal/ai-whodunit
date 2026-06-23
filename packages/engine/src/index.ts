/**
 * `@ai-whodunit/engine` — the pure-TS deterministic solver.
 *
 * Exports `solveCase` (the public entry point) + the `SolverVerdict` proof types + the stable
 * `SolverIssueCode`. Consumes `@ai-whodunit/shared` schemas; no LLM, no DB, no network — runs in a
 * plain script and in CI. The verdict carries only booleans + branded ids + enum codes; no dossier
 * field, secret, `isGuilty`, or solution field crosses into it (server-authoritative invariant).
 *
 * No runtime side effects; ESM-only; tree-shakeable.
 */

// The public entry point.
export { solveCase } from './solve.js';

// Stable issue codes (value) + verdict types.
export { SolverIssueCode } from './verdict.js';
export type {
  SolverVerdict,
  SolverIssue,
  Elimination,
  EliminationReason,
  Contradiction,
} from './verdict.js';

// The case generator — the bounded generate→solve→regenerate loop (consumes shared `CaseFile` +
// the deterministic `solveCase`; the LLM is reached only through the injected `GenerateFn`).
export { generateCase } from './generate/generate.js';

// Generator contract handed to the (apps/api) Opus 4.8 adapter — derived from the shared schema.
export {
  caseGenerationFormat,
  caseGenerationSystemPrompt,
  regenerateHint,
} from './generate/contract.js';

// Generator stable codes (value) + request/result/port types.
export { GenerationFailureReason, GENERATE_FN_REJECTED } from './generate/types.js';
export type {
  GenerationRequest,
  GenerateOptions,
  GenerationDeps,
  GenerationResult,
  IssueCode,
} from './generate/types.js';
export type { GenerateFn, StoreFn } from './generate/ports.js';

// The generate-N CLI library (pure) — drives `generateCase` N times and emits a codes+numbers-only
// `GenerateReport`. The Node entry shim (`cli/bin.ts`) is NOT re-exported (it is a process boundary).
export { generateN, aggregateSolvability } from './cli/generate-n.js';
export { parseGenerateArgs } from './cli/args.js';
export type { GenerateNOptions } from './cli/generate-n.js';
export type { GenerateReport, CaseOutcome } from './cli/types.js';
export type { ParsedArgs } from './cli/args.js';
