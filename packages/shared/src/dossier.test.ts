import { describe, it, expect } from 'vitest';
import { Secret, Alibi, Relationship, Knowledge, Dossier } from './dossier.js';

const validSecret = {
  fact: 'owed money',
  leakTrigger: { kind: 'contradiction-exposed' },
  ifLeaked: 'admits it',
};
const validAlibi = {
  claim: 'I was home',
  truth: 'was elsewhere',
  breaksWhen: { kind: 'contradiction-exposed' },
};
const validRelationship = { to: 's2', kind: 'rival', descriptor: 'a bitter rival' };
const validKnowledge = { knows: ['a'], doesNotKnow: ['b'] };
const validDossier = {
  id: 's1',
  publicPersona: 'the heir',
  knownFacts: ['a'],
  secrets: [validSecret],
  alibi: validAlibi,
  relationships: [validRelationship],
  knowledge: validKnowledge,
  isGuilty: false,
  role: 'red-herring',
};

describe('Secret', () => {
  it('parses valid', () => {
    expect(Secret.safeParse(validSecret).success).toBe(true);
  });
  for (const field of ['fact', 'leakTrigger', 'ifLeaked'] as const) {
    it(`rejects omitted ${field}`, () => {
      const p = { ...validSecret };
      delete (p as Record<string, unknown>)[field];
      expect(Secret.safeParse(p).success).toBe(false);
    });
  }
  it("rejects '' fact (min(1) boundary)", () => {
    expect(Secret.safeParse({ ...validSecret, fact: '' }).success).toBe(false);
  });
  it("rejects '' ifLeaked (min(1) boundary)", () => {
    expect(Secret.safeParse({ ...validSecret, ifLeaked: '' }).success).toBe(false);
  });
});

describe('Alibi (.partial breaksWhen)', () => {
  it('parses WITH breaksWhen present', () => {
    expect(Alibi.safeParse(validAlibi).success).toBe(true);
  });
  it('parses WITHOUT breaksWhen (optional arm)', () => {
    const { claim, truth } = validAlibi;
    expect(Alibi.safeParse({ claim, truth }).success).toBe(true);
  });
  for (const field of ['claim', 'truth'] as const) {
    it(`rejects omitted ${field}`, () => {
      const p = { ...validAlibi };
      delete (p as Record<string, unknown>)[field];
      expect(Alibi.safeParse(p).success).toBe(false);
    });
    it(`rejects '' ${field} (min(1) boundary)`, () => {
      expect(Alibi.safeParse({ ...validAlibi, [field]: '' }).success).toBe(false);
    });
  }
});

describe('Relationship', () => {
  it('parses valid', () => {
    expect(Relationship.safeParse(validRelationship).success).toBe(true);
  });
  for (const field of ['to', 'kind', 'descriptor'] as const) {
    it(`rejects omitted ${field}`, () => {
      const p = { ...validRelationship };
      delete (p as Record<string, unknown>)[field];
      expect(Relationship.safeParse(p).success).toBe(false);
    });
  }
  it("rejects '' descriptor (min(1) boundary)", () => {
    expect(Relationship.safeParse({ ...validRelationship, descriptor: '' }).success).toBe(false);
  });
  it("rejects '' to (branded min(1))", () => {
    expect(Relationship.safeParse({ ...validRelationship, to: '' }).success).toBe(false);
  });
});

describe('Knowledge', () => {
  it('parses valid', () => {
    expect(Knowledge.safeParse(validKnowledge).success).toBe(true);
  });
  it('parses empty arrays', () => {
    expect(Knowledge.safeParse({ knows: [], doesNotKnow: [] }).success).toBe(true);
  });
  it("rejects '' member in knows (min(1) per element)", () => {
    expect(Knowledge.safeParse({ knows: [''], doesNotKnow: [] }).success).toBe(false);
  });
  for (const field of ['knows', 'doesNotKnow'] as const) {
    it(`rejects omitted ${field}`, () => {
      const p = { ...validKnowledge };
      delete (p as Record<string, unknown>)[field];
      expect(Knowledge.safeParse(p).success).toBe(false);
    });
  }
});

describe('Dossier', () => {
  it('parses valid', () => {
    expect(Dossier.safeParse(validDossier).success).toBe(true);
  });
  for (const field of [
    'id',
    'publicPersona',
    'knownFacts',
    'secrets',
    'alibi',
    'relationships',
    'knowledge',
    'isGuilty',
    'role',
  ] as const) {
    it(`rejects omitted ${field}`, () => {
      const p = { ...validDossier };
      delete (p as Record<string, unknown>)[field];
      expect(Dossier.safeParse(p).success).toBe(false);
    });
  }
  it("rejects '' publicPersona (min(1) boundary)", () => {
    expect(Dossier.safeParse({ ...validDossier, publicPersona: '' }).success).toBe(false);
  });
});
