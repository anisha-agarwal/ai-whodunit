import { z } from 'zod';

/**
 * Branded string IDs. Each is `z.string().min(1)` (rejects `''`) tagged with a distinct brand so
 * the type system stops cross-type id confusion (a `WeaponId` is not assignable where a
 * `LocationId` is expected). Referential integrity is enforced on the `CaseFile` envelope
 * (`refinements.ts`), never on a lone leaf.
 *
 * `VictimId` and `SuspectId` are deliberately DISTINCT brands so `Accusation.accusedSuspectId`
 * (a `SuspectId`) structurally cannot hold a `VictimId` — "the victim can't be accused" is a
 * compile-time guarantee, not a runtime check.
 */
export const SuspectId = z.string().min(1).brand<'SuspectId'>();
export const VictimId = z.string().min(1).brand<'VictimId'>();
export const WeaponId = z.string().min(1).brand<'WeaponId'>();
export const LocationId = z.string().min(1).brand<'LocationId'>();
export const TimeSlotId = z.string().min(1).brand<'TimeSlotId'>();
export const ClueId = z.string().min(1).brand<'ClueId'>();

/**
 * `PersonId = SuspectId ∪ VictimId` — anyone in the cast. Used ONLY for `relationship.to`, so a
 * suspect can relate to the victim (motive) while suspect/victim stay distinct brands elsewhere.
 */
export const PersonId = z.union([SuspectId, VictimId]);

export type SuspectId = z.infer<typeof SuspectId>;
export type VictimId = z.infer<typeof VictimId>;
export type WeaponId = z.infer<typeof WeaponId>;
export type LocationId = z.infer<typeof LocationId>;
export type TimeSlotId = z.infer<typeof TimeSlotId>;
export type ClueId = z.infer<typeof ClueId>;
export type PersonId = z.infer<typeof PersonId>;
