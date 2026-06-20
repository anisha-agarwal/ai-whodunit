import { describe, it, expect } from 'vitest';
import { Trigger } from './trigger.js';

describe('Trigger discriminated union', () => {
  it('parses clue-presented{clueId}', () => {
    const r = Trigger.safeParse({ kind: 'clue-presented', clueId: 'c1' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.kind).toBe('clue-presented');
  });

  it('parses fact-confronted{fact}', () => {
    const r = Trigger.safeParse({ kind: 'fact-confronted', fact: 'the muddy boots' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.kind).toBe('fact-confronted');
  });

  it('parses contradiction-exposed (no payload)', () => {
    const r = Trigger.safeParse({ kind: 'contradiction-exposed' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.kind).toBe('contradiction-exposed');
  });

  it('rejects a bad discriminant', () => {
    const r = Trigger.safeParse({ kind: 'mind-read' });
    expect(r.success).toBe(false);
  });

  it("rejects fact-confronted with '' fact (min(1))", () => {
    expect(Trigger.safeParse({ kind: 'fact-confronted', fact: '' }).success).toBe(false);
  });

  it("rejects clue-presented with '' clueId (branded min(1))", () => {
    expect(Trigger.safeParse({ kind: 'clue-presented', clueId: '' }).success).toBe(false);
  });
});
