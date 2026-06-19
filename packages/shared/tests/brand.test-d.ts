/**
 * Compile-time (type-level) assertions for the branded IDs.
 *
 * This file emits no runtime tests; it is verified by `tsc --noEmit` (the `typecheck`
 * script, which now includes `tests`). Each `@ts-expect-error` is a POSITIVE assertion:
 * the build FAILS if the marked line ever stops being a type error — i.e. if the brands
 * were to collapse into mutually-assignable plain strings. It is not silencing a real bug.
 */
import type { ClueId, LocationId, SuspectId, TimeSlotId, VictimId, WeaponId } from '../src/ids.js';
import { LocationId as LocationIdSchema, WeaponId as WeaponIdSchema } from '../src/ids.js';
import type { Accusation } from '../src/accusation.js';

// Helper: assigns its argument to a target-typed slot to probe assignability.
function expectType<T>(value: T): void {
  void value; // type-level only — the runtime body is irrelevant
}

const weapon = WeaponIdSchema.parse('weapon-1');
const location = LocationIdSchema.parse('loc-1');

// A brand is assignable to itself.
expectType<WeaponId>(weapon);
expectType<LocationId>(location);

// WeaponId ≠ LocationId — distinct brands are NOT cross-assignable.
// @ts-expect-error WeaponId is not assignable to LocationId (distinct brands)
expectType<LocationId>(weapon);
// @ts-expect-error LocationId is not assignable to WeaponId (distinct brands)
expectType<WeaponId>(location);

// The remaining brands are likewise mutually distinct from WeaponId.
declare const suspect: SuspectId;
declare const victim: VictimId;
declare const timeslot: TimeSlotId;
declare const clue: ClueId;
// @ts-expect-error SuspectId is not a WeaponId
expectType<WeaponId>(suspect);
// @ts-expect-error VictimId is not a WeaponId
expectType<WeaponId>(victim);
// @ts-expect-error TimeSlotId is not a WeaponId
expectType<WeaponId>(timeslot);
// @ts-expect-error ClueId is not a WeaponId
expectType<WeaponId>(clue);

// Accusation.accusedSuspectId is a SuspectId — the victim (VictimId) cannot be accused.
declare const acc: Accusation;
expectType<SuspectId>(acc.accusedSuspectId);
// @ts-expect-error a VictimId cannot be assigned where a SuspectId (accused) is expected
expectType<typeof acc.accusedSuspectId>(victim);
