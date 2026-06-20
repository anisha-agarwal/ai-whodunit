import { describe, it, expect } from 'vitest';
import { Victim, Weapon, Location, TimeSlot, CaseFile } from './case-file.js';
import { CaseIssueCode } from './errors.js';
import { makeValidCase } from '../tests/fixtures/validCase.js';

describe('catalogs', () => {
  it('Victim parses valid; rejects empty name', () => {
    expect(Victim.safeParse({ id: 'v1', name: 'X' }).success).toBe(true);
    expect(Victim.safeParse({ id: 'v1', name: '' }).success).toBe(false);
  });
  it('Weapon parses valid; rejects empty label', () => {
    expect(Weapon.safeParse({ id: 'w1', label: 'X' }).success).toBe(true);
    expect(Weapon.safeParse({ id: 'w1', label: '' }).success).toBe(false);
  });
  it('Location parses valid; rejects empty label', () => {
    expect(Location.safeParse({ id: 'l1', label: 'X' }).success).toBe(true);
    expect(Location.safeParse({ id: 'l1', label: '' }).success).toBe(false);
  });

  describe('TimeSlot.order', () => {
    it('parses order 0 (nonnegative lower boundary)', () => {
      expect(TimeSlot.safeParse({ id: 't1', label: '8pm', order: 0 }).success).toBe(true);
    });
    it('rejects a negative order', () => {
      expect(TimeSlot.safeParse({ id: 't1', label: '8pm', order: -1 }).success).toBe(false);
    });
    it('rejects a non-integer order', () => {
      expect(TimeSlot.safeParse({ id: 't1', label: '8pm', order: 1.5 }).success).toBe(false);
    });
  });
});

describe('CaseFile envelope', () => {
  it('a fully-valid case parses (drives the pass-arm of every refinement)', () => {
    expect(CaseFile.safeParse(makeValidCase()).success).toBe(true);
  });

  it('rejects empty weapons[] (nonempty arm)', () => {
    expect(CaseFile.safeParse({ ...makeValidCase(), weapons: [] }).success).toBe(false);
  });

  it('rejects empty suspects[] (nonempty arm)', () => {
    expect(CaseFile.safeParse({ ...makeValidCase(), suspects: [] }).success).toBe(false);
  });

  it("rejects '' id (min(1))", () => {
    expect(CaseFile.safeParse({ ...makeValidCase(), id: '' }).success).toBe(false);
  });

  it('superRefine is attached: a one-field-mutated case fails with a refinement code', () => {
    const cf = makeValidCase();
    cf.solution.killerId = 'nobody';
    const r = CaseFile.safeParse(cf);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.map((i) => i.message)).toContain(CaseIssueCode.KILLER_RESOLVES);
    }
  });
});
