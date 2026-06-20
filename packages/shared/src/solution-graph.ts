import { z } from 'zod';
import { VictimId, SuspectId, WeaponId, LocationId, TimeSlotId } from './ids.js';

/**
 * SERVER-ONLY ground truth: who-did-it-with-what-where-when. Never serialized into any
 * client-bound payload — `toPublicCaseFile` omits it entirely.
 */
export const SolutionGraph = z.object({
  victimId: VictimId,
  killerId: SuspectId,
  weaponId: WeaponId,
  locationId: LocationId,
  timeSlotId: TimeSlotId,
});

export type SolutionGraph = z.infer<typeof SolutionGraph>;
