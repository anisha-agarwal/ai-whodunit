import { z } from 'zod';
import { SuspectId, ClueId } from './ids.js';
import { Relationship } from './dossier.js';
import { Victim, Weapon, Location, TimeSlot } from './case-file.js';
import type { Dossier } from './dossier.js';
import type { Clue } from './clue.js';
import type { CaseFile } from './case-file.js';

/**
 * Client-safe projection. This package is the single source of truth for "what is safe to send";
 * `apps/api` sends ONLY these shapes. Each `Public*` type is built by EXPLICIT field construction
 * (whitelisting safe fields) — never Zod `.strip()`/`.parse()`, never `delete` — so "forgot to
 * drop a server-only field" is a killable Stryker mutant, not a silent leak.
 *
 * SERVER-ONLY fields omitted from the projection:
 *   Dossier  → secrets, alibi (incl. .claim/.truth/.breaksWhen), knowledge, isGuilty, role
 *   Clue     → reliability
 *   CaseFile → solution
 * (`role` and `reliability` were the prior C1/C2 leaks — they MUST stay omitted.)
 */

export const PublicDossier = z.object({
  id: SuspectId,
  publicPersona: z.string().min(1),
  knownFacts: z.array(z.string().min(1)),
  relationships: z.array(Relationship),
});

export const PublicClue = z.object({
  id: ClueId,
  statement: z.string().min(1),
  refersTo: z
    .object({
      suspectId: SuspectId.optional(),
      weaponId: z.string().min(1).optional(),
      locationId: z.string().min(1).optional(),
      timeSlotId: z.string().min(1).optional(),
    })
    .optional(),
});

export const PublicCaseFile = z.object({
  id: z.string().min(1),
  victim: Victim,
  weapons: z.array(Weapon),
  locations: z.array(Location),
  timeline: z.array(TimeSlot),
  suspects: z.array(PublicDossier),
  clues: z.array(PublicClue),
});

export type PublicDossier = z.infer<typeof PublicDossier>;
export type PublicClue = z.infer<typeof PublicClue>;
export type PublicCaseFile = z.infer<typeof PublicCaseFile>;

/** Whitelist the public dossier fields. OMITS secrets, alibi, knowledge, isGuilty, role. */
export function redactDossier(d: Dossier): PublicDossier {
  return {
    id: d.id,
    publicPersona: d.publicPersona,
    knownFacts: d.knownFacts,
    relationships: d.relationships,
  };
}

/**
 * Whitelist the public clue fields. OMITS reliability. `refersTo` is optional under
 * `exactOptionalPropertyTypes`, so it is included by conditional spread (never `{ refersTo: undefined }`).
 */
export function redactClue(c: Clue): PublicClue {
  return {
    id: c.id,
    statement: c.statement,
    ...(c.refersTo !== undefined ? { refersTo: c.refersTo } : {}),
  };
}

/** Whitelist the public case fields + map each suspect/clue through its redactor. OMITS solution. */
export function toPublicCaseFile(cf: CaseFile): PublicCaseFile {
  return {
    id: cf.id,
    victim: cf.victim,
    weapons: cf.weapons,
    locations: cf.locations,
    timeline: cf.timeline,
    suspects: cf.suspects.map(redactDossier),
    clues: cf.clues.map(redactClue),
  };
}
