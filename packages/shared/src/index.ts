/**
 * @ai-whodunit/shared — pure-TS Zod schemas, refinements, and redaction.
 *
 * This package is the evidentiary contract imported by apps/api, apps/web, and packages/engine.
 * It has NO runtime side effects and is tree-shakeable (ESM-only).
 *
 * When a name is exported as both a Zod schema (value) and a z.infer type from the same
 * source module, a single `export { X }` covers both the runtime value and the type.
 * Pure interfaces/type-aliases that have no runtime value use `export type { X }`.
 */

// Error codes (stable, consumers switch on these)
export { CaseIssueCode } from './errors.js';

// Branded IDs — each name is both a Zod schema (value) and its inferred type
export { SuspectId, VictimId, WeaponId, LocationId, TimeSlotId, ClueId, PersonId } from './ids.js';

// Enums — same pattern
export { Role, RelationshipKind, ClueReliability } from './enums.js';

// Trigger discriminated union
export { Trigger } from './trigger.js';

// Solution graph
export { SolutionGraph } from './solution-graph.js';

// Dossier and its parts
export { Secret, Alibi, Relationship, Knowledge, Dossier } from './dossier.js';

// Clue
export { Clue } from './clue.js';

// Accusation schema + well-formedness validator
export { Accusation, validateAccusation } from './accusation.js';
// AccusationValidity is a pure interface (no runtime value)
export type { AccusationValidity } from './accusation.js';

// Case file catalogs + envelope
export { Victim, Weapon, Location, TimeSlot, CaseFile } from './case-file.js';

// Public projections + redaction functions
export {
  PublicDossier,
  PublicClue,
  PublicCaseFile,
  redactDossier,
  redactClue,
  toPublicCaseFile,
} from './redaction.js';
