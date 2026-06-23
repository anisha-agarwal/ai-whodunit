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
