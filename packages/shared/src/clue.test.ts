import { describe, it, expect } from 'vitest';
import { Clue } from './clue.js';

const base = { id: 'c1', statement: 'a torn letter', reliability: 'truthful' as const };

describe('Clue', () => {
  it('parses with refersTo ABSENT (optional arm)', () => {
    expect(Clue.safeParse(base).success).toBe(true);
  });

  it('parses with refersTo PRESENT (all refs)', () => {
    const r = Clue.safeParse({
      ...base,
      refersTo: { suspectId: 's1', weaponId: 'w1', locationId: 'l1', timeSlotId: 't1' },
    });
    expect(r.success).toBe(true);
  });

  it('parses with refersTo present but EMPTY (each ref optional-absent)', () => {
    expect(Clue.safeParse({ ...base, refersTo: {} }).success).toBe(true);
  });

  for (const ref of ['suspectId', 'weaponId', 'locationId', 'timeSlotId'] as const) {
    it(`parses with only refersTo.${ref} present`, () => {
      expect(Clue.safeParse({ ...base, refersTo: { [ref]: 'x1' } }).success).toBe(true);
    });
  }

  it("rejects '' statement (min(1) boundary)", () => {
    expect(Clue.safeParse({ ...base, statement: '' }).success).toBe(false);
  });

  it("rejects '' id (branded min(1))", () => {
    expect(Clue.safeParse({ ...base, id: '' }).success).toBe(false);
  });

  for (const field of ['id', 'statement', 'reliability'] as const) {
    it(`rejects omitted ${field}`, () => {
      const p = { ...base };
      delete (p as Record<string, unknown>)[field];
      expect(Clue.safeParse(p).success).toBe(false);
    });
  }
});
