import { describe, it, expect } from 'vitest';
import { SuspectId, VictimId, WeaponId, LocationId, TimeSlotId, ClueId, PersonId } from './ids.js';

const BRANDS = [
  { name: 'SuspectId', schema: SuspectId },
  { name: 'VictimId', schema: VictimId },
  { name: 'WeaponId', schema: WeaponId },
  { name: 'LocationId', schema: LocationId },
  { name: 'TimeSlotId', schema: TimeSlotId },
  { name: 'ClueId', schema: ClueId },
] as const;

describe('branded ids — min(1) lower-arm', () => {
  for (const { name, schema } of BRANDS) {
    it(`${name} parses a non-empty string`, () => {
      expect(schema.safeParse('x').success).toBe(true);
    });
    it(`${name} rejects '' (min(1) lower boundary)`, () => {
      expect(schema.safeParse('').success).toBe(false);
    });
  }
});

describe('PersonId union (SuspectId ∪ VictimId)', () => {
  it('parses a valid (SuspectId-shaped) string', () => {
    const r = PersonId.safeParse('s1');
    expect(r.success).toBe(true);
  });

  it('parses a valid (VictimId-shaped) string', () => {
    // both members are min(1) strings, so any non-empty string satisfies the union; the brand split
    // is structural at the type level. Assert the value round-trips.
    const r = PersonId.safeParse('v1');
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBe('v1');
  });

  it("rejects '' (both union arms enforce min(1))", () => {
    expect(PersonId.safeParse('').success).toBe(false);
  });
});
