import { z } from 'zod';

import { LocationId, SuspectId, TimeSlotId, VictimId, WeaponId } from './ids.js';

/** The authoritative five-tuple solution. Referential integrity enforced at CaseFile.superRefine (R5, R6). */
export const SolutionGraph = z.object({
  victimId: VictimId,
  killerId: SuspectId,
  weaponId: WeaponId,
  locationId: LocationId,
  timeSlotId: TimeSlotId,
});
export type SolutionGraph = z.infer<typeof SolutionGraph>;
