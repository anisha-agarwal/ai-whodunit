/**
 * Server-authoritative projection: strips all server-only fields before sending to clients.
 *
 * REDACTED fields (must NEVER reach apps/web):
 *   Dossier: secrets, alibi (incl. .claim), knowledge, isGuilty, role
 *   Clue:    reliability
 *   CaseFile: solution (incl. killerId, victimId, etc.)
 *
 * Implementation: EXPLICIT field construction (not Zod-strip, not `delete`).
 * This means "forgot a field" is a killable Stryker mutant, and the denylist key-scan
 * test (§5.2 item 1) provides an independent structural check.
 *
 * Under exactOptionalPropertyTypes, optional keys are included via conditional spread
 * so we never emit { refersTo: undefined }.
 */
import { z } from 'zod';

import { ClueId, LocationId, SuspectId, TimeSlotId, VictimId, WeaponId } from './ids.js';
import { RelationshipKind } from './enums.js';
import type { Dossier } from './dossier.js';
import type { Clue } from './clue.js';
import type { CaseFile } from './case-file.js';
import { Victim, Weapon, Location, TimeSlot } from './case-file.js';

// ---------------------------------------------------------------------------
// Public projection schemas
// ---------------------------------------------------------------------------

/**
 * Client-safe dossier — omits secrets, alibi, knowledge, isGuilty, role.
 * Exactly: { id, publicPersona, knownFacts, relationships }
 */
export const PublicDossier = z.object({
  id: SuspectId,
  publicPersona: z.string().min(1),
  knownFacts: z.array(z.string().min(1)),
  relationships: z.array(
    z.object({
      to: z.union([SuspectId, VictimId]),
      kind: RelationshipKind,
      descriptor: z.string().min(1),
    }),
  ),
});
export type PublicDossier = z.infer<typeof PublicDossier>;

/**
 * Client-safe clue — omits reliability.
 * Exactly: { id, statement } or { id, statement, refersTo }
 */
export const PublicClue = z.object({
  id: ClueId,
  statement: z.string().min(1),
  refersTo: z
    .object({
      suspectId: SuspectId.optional(),
      weaponId: WeaponId.optional(),
      locationId: LocationId.optional(),
      timeSlotId: TimeSlotId.optional(),
    })
    .optional(),
});
export type PublicClue = z.infer<typeof PublicClue>;

/**
 * Client-safe case file — omits solution entirely.
 * Exactly: { id, victim, weapons, locations, timeline, suspects, clues }
 */
export const PublicCaseFile = z.object({
  id: z.string().min(1),
  victim: Victim,
  weapons: z.array(Weapon),
  locations: z.array(Location),
  timeline: z.array(TimeSlot),
  suspects: z.array(PublicDossier),
  clues: z.array(PublicClue),
});
export type PublicCaseFile = z.infer<typeof PublicCaseFile>;

// ---------------------------------------------------------------------------
// Redaction functions — pure, explicit field construction
// ---------------------------------------------------------------------------

/**
 * Redacts a full server-side Dossier to a client-safe PublicDossier.
 * Explicitly picks: id, publicPersona, knownFacts, relationships.
 * OMITS: secrets, alibi (incl. claim), knowledge, isGuilty, role.
 */
export function redactDossier(d: Dossier): PublicDossier {
  return {
    id: d.id,
    publicPersona: d.publicPersona,
    knownFacts: d.knownFacts,
    relationships: d.relationships,
  };
}

/**
 * Redacts a full server-side Clue to a client-safe PublicClue.
 * Explicitly picks: id, statement, refersTo (if present).
 * OMITS: reliability.
 *
 * Uses conditional spread under exactOptionalPropertyTypes:
 * never emits { refersTo: undefined }.
 */
export function redactClue(c: Clue): PublicClue {
  return {
    id: c.id,
    statement: c.statement,
    ...(c.refersTo !== undefined ? { refersTo: c.refersTo } : {}),
  };
}

/**
 * Projects a full CaseFile to a client-safe PublicCaseFile.
 * Explicitly picks: id, victim, weapons, locations, timeline, suspects, clues.
 * OMITS: solution (and all its subfields: killerId, victimId, weaponId, locationId, timeSlotId).
 */
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
