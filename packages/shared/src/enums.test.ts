import { describe, it, expect } from 'vitest';
import { Role, RelationshipKind, ClueReliability } from './enums.js';

describe('Role', () => {
  it.each(['culprit', 'red-herring', 'witness'])('accepts member %s', (m) => {
    expect(Role.safeParse(m).success).toBe(true);
  });
  it('rejects an unknown literal', () => {
    expect(Role.safeParse('bystander').success).toBe(false);
  });
});

describe('RelationshipKind', () => {
  it.each([
    'spouse',
    'sibling',
    'colleague',
    'rival',
    'friend',
    'employer',
    'creditor',
    'stranger',
  ])('accepts member %s', (m) => {
    expect(RelationshipKind.safeParse(m).success).toBe(true);
  });
  it('rejects an unknown literal', () => {
    expect(RelationshipKind.safeParse('nemesis').success).toBe(false);
  });
});

describe('ClueReliability', () => {
  it.each(['truthful', 'misleading'])('accepts member %s', (m) => {
    expect(ClueReliability.safeParse(m).success).toBe(true);
  });
  it('rejects an unknown literal', () => {
    expect(ClueReliability.safeParse('ambiguous').success).toBe(false);
  });
});
