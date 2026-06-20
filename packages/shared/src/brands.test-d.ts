import { describe, it, expectTypeOf } from 'vitest';
import type { SuspectId, VictimId, WeaponId, LocationId, PersonId } from './ids.js';

/**
 * Type-level brand-confusion guards. These prove the brand split is load-bearing at COMPILE time:
 * a `WeaponId` is not assignable where a `LocationId` is expected, a `VictimId` is not a `SuspectId`
 * (so "the victim can't be accused" is a compile error), and a `WeaponId` is not a `PersonId`.
 *
 * Run via `vitest --typecheck` (or `tsc --noEmit`). Excluded from runtime coverage — it guards the
 * type design, not executable branches. Remove a `.brand<>()` in `ids.ts` and these flip.
 */
describe('brand confusion is a compile error', () => {
  it('distinct id brands are not mutually assignable', () => {
    const weapon = 'w1' as unknown as WeaponId;
    const location = 'l1' as unknown as LocationId;
    const victim = 'v1' as unknown as VictimId;
    const suspect = 's1' as unknown as SuspectId;

    // A WeaponId is NOT a LocationId.
    // @ts-expect-error WeaponId is not assignable to LocationId
    const _l: LocationId = weapon;
    // A VictimId is NOT a SuspectId (the accuse-the-victim guard).
    // @ts-expect-error VictimId is not assignable to SuspectId
    const _s: SuspectId = victim;
    // A WeaponId is NOT a PersonId (PersonId = SuspectId ∪ VictimId).
    // @ts-expect-error WeaponId is not assignable to PersonId
    const _p: PersonId = weapon;

    // Sanity: same-brand assignment IS allowed (proves the @ts-expect-error above are real, not
    // a blanket "everything errors").
    const okLocation: LocationId = location;
    const okSuspect: SuspectId = suspect;
    expectTypeOf(okLocation).toEqualTypeOf<LocationId>();
    expectTypeOf(okSuspect).toEqualTypeOf<SuspectId>();
    void _l;
    void _s;
    void _p;
  });

  it('a SuspectId and a VictimId both satisfy PersonId', () => {
    const suspect = 's1' as unknown as SuspectId;
    const victim = 'v1' as unknown as VictimId;
    const a: PersonId = suspect;
    const b: PersonId = victim;
    expectTypeOf(a).toMatchTypeOf<PersonId>();
    expectTypeOf(b).toMatchTypeOf<PersonId>();
  });
});
