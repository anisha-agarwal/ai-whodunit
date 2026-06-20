import { z } from 'zod';
import { ClueId, SuspectId, WeaponId, LocationId, TimeSlotId } from './ids.js';
import { ClueReliability } from './enums.js';

/**
 * A piece of evidence. Each `refersTo` ref is `.optional()` and the `refersTo` object itself is
 * `.optional()` (NOT `.partial()` — keeps the absent-vs-present arms explicit). `reliability` is
 * SERVER-ONLY and omitted from `PublicClue`.
 */
export const Clue = z.object({
  id: ClueId,
  statement: z.string().min(1),
  reliability: ClueReliability, // SERVER-ONLY
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
