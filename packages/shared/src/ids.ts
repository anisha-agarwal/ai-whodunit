import { z } from 'zod';

// Branded string IDs — shape-only; referential integrity is enforced on the CaseFile envelope.
// Brands stop cross-type id confusion at compile time (e.g. VictimId ≠ SuspectId, so
// Accusation.accusedSuspectId: SuspectId structurally cannot hold a VictimId).

export const SuspectId = z.string().min(1).brand<'SuspectId'>();
export type SuspectId = z.infer<typeof SuspectId>;

export const VictimId = z.string().min(1).brand<'VictimId'>();
export type VictimId = z.infer<typeof VictimId>;

export const WeaponId = z.string().min(1).brand<'WeaponId'>();
export type WeaponId = z.infer<typeof WeaponId>;

export const LocationId = z.string().min(1).brand<'LocationId'>();
export type LocationId = z.infer<typeof LocationId>;

export const TimeSlotId = z.string().min(1).brand<'TimeSlotId'>();
export type TimeSlotId = z.infer<typeof TimeSlotId>;

export const ClueId = z.string().min(1).brand<'ClueId'>();
export type ClueId = z.infer<typeof ClueId>;

/**
 * PersonId = anyone in the cast (a suspect OR the victim) — used for relationship targets.
 * Keeps SuspectId/VictimId distinct (Accusation cannot accuse the victim) while letting
 * a suspect relate to the victim (motive). R10a resolves .to against suspects[]∪{victim.id}.
 */
export const PersonId = z.union([SuspectId, VictimId]);
export type PersonId = z.infer<typeof PersonId>;
