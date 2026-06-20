/**
 * Stable issue codes for every cross-entity refinement (R1a–R16) and every accusation
 * well-formedness check (A1a–A1e). These are the contract surface tests assert on — a test
 * pins the SPECIFIC code, never bare `success === false`, so a code-swap mutant is killed.
 *
 * One enum member per refinement row in `docs/plans/01-shared-schemas.md` §4. The string
 * literal value IS the code carried on the Zod issue's `message` field (see `refinements.ts`).
 */
export const CaseIssueCode = {
  // R1 — id uniqueness across each catalog
  DUP_SUSPECT_ID: 'DUP_SUSPECT_ID',
  DUP_WEAPON_ID: 'DUP_WEAPON_ID',
  DUP_LOCATION_ID: 'DUP_LOCATION_ID',
  DUP_TIMESLOT_ID: 'DUP_TIMESLOT_ID',
  DUP_CLUE_ID: 'DUP_CLUE_ID',

  // R2/R3 — culprit cardinality + guilt/role coherence
  EXACTLY_ONE_CULPRIT: 'EXACTLY_ONE_CULPRIT',
  GUILT_ROLE_COHERENT: 'GUILT_ROLE_COHERENT',

  // R4 — victim is not also a suspect
  VICTIM_NOT_SUSPECT: 'VICTIM_NOT_SUSPECT',

  // R5 — solution killer resolves + is the culprit
  KILLER_RESOLVES: 'KILLER_RESOLVES',
  KILLER_IS_CULPRIT: 'KILLER_IS_CULPRIT',

  // R6 — remaining solution refs resolve into their catalogs
  SOLUTION_VICTIM_MATCHES: 'SOLUTION_VICTIM_MATCHES',
  SOLUTION_WEAPON_RESOLVES: 'SOLUTION_WEAPON_RESOLVES',
  SOLUTION_LOCATION_RESOLVES: 'SOLUTION_LOCATION_RESOLVES',
  SOLUTION_TIMESLOT_RESOLVES: 'SOLUTION_TIMESLOT_RESOLVES',

  // R7/R8/R9 — three-tier knowledge coherence (per dossier)
  KNOWLEDGE_DISJOINT: 'KNOWLEDGE_DISJOINT',
  KNOWN_FACTS_SUBSET: 'KNOWN_FACTS_SUBSET',
  SECRET_FACT_COHERENT: 'SECRET_FACT_COHERENT',

  // R10 — relationship edge integrity
  RELATIONSHIP_TARGET_RESOLVES: 'RELATIONSHIP_TARGET_RESOLVES',
  RELATIONSHIP_NO_SELF_EDGE: 'RELATIONSHIP_NO_SELF_EDGE',

  // R11/R12 — trigger clue refs resolve
  SECRET_TRIGGER_RESOLVES: 'SECRET_TRIGGER_RESOLVES',
  ALIBI_TRIGGER_RESOLVES: 'ALIBI_TRIGGER_RESOLVES',

  // R13 — clue.refersTo refs resolve into their catalogs
  CLUE_REFS_SUSPECT_RESOLVES: 'CLUE_REFS_SUSPECT_RESOLVES',
  CLUE_REFS_WEAPON_RESOLVES: 'CLUE_REFS_WEAPON_RESOLVES',
  CLUE_REFS_LOCATION_RESOLVES: 'CLUE_REFS_LOCATION_RESOLVES',
  CLUE_REFS_TIMESLOT_RESOLVES: 'CLUE_REFS_TIMESLOT_RESOLVES',

  // R14/R15/R16 — structural solvability preconditions (necessary, not sufficient)
  WITNESS_OR_HERRING_PRESENT: 'WITNESS_OR_HERRING_PRESENT',
  TIMESLOT_ORDER_UNIQUE: 'TIMESLOT_ORDER_UNIQUE',
  CULPRIT_ALIBI_BREAKABLE: 'CULPRIT_ALIBI_BREAKABLE',

  // A1 — accusation well-formedness (validateAccusation, NOT scoring/correctness)
  ACCUSATION_CASE_MISMATCH: 'ACCUSATION_CASE_MISMATCH',
  ACCUSED_NOT_SUSPECT: 'ACCUSED_NOT_SUSPECT',
  ACCUSED_WEAPON_RESOLVES: 'ACCUSED_WEAPON_RESOLVES',
  ACCUSED_LOCATION_RESOLVES: 'ACCUSED_LOCATION_RESOLVES',
  ACCUSED_TIMESLOT_RESOLVES: 'ACCUSED_TIMESLOT_RESOLVES',
} as const;

export type CaseIssueCode = (typeof CaseIssueCode)[keyof typeof CaseIssueCode];
