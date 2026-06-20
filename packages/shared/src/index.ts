/**
 * `@ai-whodunit/shared` — the pure-TS evidentiary contract every package imports.
 *
 * Exports the full Zod schemas + inferred types (held server-side by `engine`/`api`), the
 * client-safe `Public*` projection + redaction functions (the server-authoritative chokepoint),
 * `validateAccusation` (well-formedness, not scoring), and the stable `CaseIssueCode` enum.
 *
 * No runtime side effects; ESM-only; tree-shakeable.
 */

// Error codes
export { CaseIssueCode } from './errors.js';

// Branded ids (schema values + inferred types share each name via `export *`)
export * from './ids.js';

// Enums
export * from './enums.js';

// Trigger union
export * from './trigger.js';

// Solution graph (SERVER-ONLY truth)
export * from './solution-graph.js';

// Dossier + parts
export * from './dossier.js';

// Clue
export * from './clue.js';

// Catalogs + CaseFile envelope
export * from './case-file.js';

// Accusation + validateAccusation
export { Accusation, validateAccusation } from './accusation.js';
export type { AccusationValidity } from './accusation.js';

// Public projection + redaction functions
export {
  PublicDossier,
  PublicClue,
  PublicCaseFile,
  redactDossier,
  redactClue,
  toPublicCaseFile,
} from './redaction.js';
