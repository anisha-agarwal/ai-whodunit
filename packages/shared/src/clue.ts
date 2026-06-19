import { z } from 'zod';

import { ClueId, LocationId, SuspectId, TimeSlotId, WeaponId } from './ids.js';
import { ClueReliability } from './enums.js';

/**
 * A piece of evidence in the case.
 * reliability is SERVER-ONLY — misleading clues are red herrings.
 * refersTo cross-references are validated at CaseFile.superRefine (R13a–d).
 *
 * Each ref field is individually optional; the refersTo object itself is optional.
 * No .partial() used — each field is explicitly .optional() per plan note.
 */
export const Clue = z.object({
  id: ClueId,
  statement: z.string().min(1),
  /** SERVER-ONLY */
  reliability: ClueReliability,
  refersTo: z
    .object({
      suspectId: SuspectId.optional(),
      weaponId: WeaponId.optional(),
      locationId: LocationId.optional(),
      timeSlotId: TimeSlotId.optional(),
    })
    .optional(),
});
export type Clue = z.infer<typeof Clue>;
