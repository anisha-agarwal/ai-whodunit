import { describe, expect, it } from 'vitest';

import { Trigger } from '../src/trigger.js';
import { ClueReliability, RelationshipKind, Role } from '../src/enums.js';
import { Dossier } from '../src/dossier.js';
import { Clue } from '../src/clue.js';
import { ClueId, LocationId, SuspectId, TimeSlotId, VictimId, WeaponId } from '../src/ids.js';
import * as shared from '../src/index.js';
import { makeValidCase } from './fixtures/validCase.js';

describe('Trigger discriminated union', () => {
  it('parses each variant and preserves exactly its payload', () => {
    // Deep-equality (not just .success) ensures the variant shape is intact: an emptied
    // variant schema would strip the discriminant/payload and fail these.
    expect(Trigger.parse({ kind: 'clue-presented', clueId: 'clue-1' })).toEqual({
      kind: 'clue-presented',
      clueId: 'clue-1',
    });
    expect(Trigger.parse({ kind: 'fact-confronted', fact: 'you lied' })).toEqual({
      kind: 'fact-confronted',
      fact: 'you lied',
    });
    expect(Trigger.parse({ kind: 'contradiction-exposed' })).toEqual({
      kind: 'contradiction-exposed',
    });
  });

  it('routes on the "kind" discriminant — a payload under the wrong kind is rejected', () => {
    // clueId belongs to clue-presented, not fact-confronted: discriminant routing must
    // still demand fact-confronted's own required field.
    expect(Trigger.safeParse({ kind: 'fact-confronted', clueId: 'clue-1' }).success).toBe(false);
    expect(Trigger.safeParse({ kind: 'clue-presented', fact: 'you lied' }).success).toBe(false);
  });

  it('rejects an unknown discriminant', () => {
    expect(Trigger.safeParse({ kind: 'mind-read' }).success).toBe(false);
  });

  it('clue-presented requires clueId', () => {
    expect(Trigger.safeParse({ kind: 'clue-presented' }).success).toBe(false);
  });

  it('fact-confronted requires a non-empty fact', () => {
    expect(Trigger.safeParse({ kind: 'fact-confronted' }).success).toBe(false);
    expect(Trigger.safeParse({ kind: 'fact-confronted', fact: '' }).success).toBe(false);
  });
});

describe('enums — every member round-trips and unknowns are rejected', () => {
  const cases = [
    ['Role', Role, ['culprit', 'red-herring', 'witness']],
    [
      'RelationshipKind',
      RelationshipKind,
      ['spouse', 'sibling', 'colleague', 'rival', 'friend', 'employer', 'creditor', 'stranger'],
    ],
    ['ClueReliability', ClueReliability, ['truthful', 'misleading']],
  ] as const;

  for (const [name, schema, members] of cases) {
    for (const member of members) {
      it(`${name} accepts "${member}"`, () => {
        expect(schema.parse(member)).toBe(member);
      });
    }
    it(`${name} rejects an unknown member`, () => {
      expect(schema.safeParse('not-a-real-member').success).toBe(false);
    });
  }
});

describe('Dossier schema', () => {
  const valid = makeValidCase().suspects[0]!;

  it('parses the valid dossier', () => {
    expect(Dossier.safeParse(valid).success).toBe(true);
  });

  it('rejects omission of a required field (role)', () => {
    const withoutRole: { role?: unknown } = { ...valid };
    delete withoutRole.role;
    expect(Dossier.safeParse(withoutRole).success).toBe(false);
  });

  it('rejects an empty publicPersona (min(1) boundary)', () => {
    expect(Dossier.safeParse({ ...valid, publicPersona: '' }).success).toBe(false);
  });

  it('rejects an empty knownFact string (min(1) boundary)', () => {
    expect(Dossier.safeParse({ ...valid, knownFacts: [''] }).success).toBe(false);
  });
});

describe('Clue schema', () => {
  const valid = makeValidCase().clues[0]!;

  it('parses the valid clue', () => {
    expect(Clue.safeParse(valid).success).toBe(true);
  });

  it('rejects omission of a required field (reliability)', () => {
    const withoutReliability: { reliability?: unknown } = { ...valid };
    delete withoutReliability.reliability;
    expect(Clue.safeParse(withoutReliability).success).toBe(false);
  });

  it('rejects an empty statement (min(1) boundary)', () => {
    expect(Clue.safeParse({ ...valid, statement: '' }).success).toBe(false);
  });
});

describe('Branded IDs', () => {
  const brands = [
    ['SuspectId', SuspectId],
    ['VictimId', VictimId],
    ['WeaponId', WeaponId],
    ['LocationId', LocationId],
    ['TimeSlotId', TimeSlotId],
    ['ClueId', ClueId],
  ] as const;

  for (const [name, schema] of brands) {
    it(`${name} rejects the empty string`, () => {
      expect(schema.safeParse('').success).toBe(false);
    });
    it(`${name} accepts a non-empty string`, () => {
      expect(schema.safeParse('x').success).toBe(true);
    });
  }
});

describe('package barrel (index.ts)', () => {
  it('re-exports the public surface', () => {
    const names = [
      'CaseIssueCode',
      'SuspectId',
      'VictimId',
      'WeaponId',
      'LocationId',
      'TimeSlotId',
      'ClueId',
      'PersonId',
      'Role',
      'RelationshipKind',
      'ClueReliability',
      'Trigger',
      'SolutionGraph',
      'Secret',
      'Alibi',
      'Relationship',
      'Knowledge',
      'Dossier',
      'Clue',
      'Accusation',
      'validateAccusation',
      'Victim',
      'Weapon',
      'Location',
      'TimeSlot',
      'CaseFile',
      'PublicDossier',
      'PublicClue',
      'PublicCaseFile',
      'redactDossier',
      'redactClue',
      'toPublicCaseFile',
    ];
    for (const n of names) {
      expect(shared[n as keyof typeof shared], `missing export: ${n}`).toBeDefined();
    }
  });
});
