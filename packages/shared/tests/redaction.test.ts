import { describe, expect, it } from 'vitest';

import { CaseFile } from '../src/case-file.js';
import {
  PublicCaseFile,
  PublicClue,
  PublicDossier,
  redactClue,
  redactDossier,
  toPublicCaseFile,
} from '../src/redaction.js';
import { Clue } from '../src/clue.js';
import { makeValidCase } from './fixtures/validCase.js';

const cf = CaseFile.parse(makeValidCase());

/** Server-only keys that must NEVER appear at any depth of a client-bound payload. */
const DENYLIST = [
  'secrets',
  'knowledge',
  'isGuilty',
  'truth',
  'solution',
  'killerId',
  'doesNotKnow',
  'role',
  'reliability',
  'breaksWhen',
  'leakTrigger',
  'ifLeaked',
  'alibi',
];

/** Collects every object key at any depth. */
function allKeys(v: unknown, acc = new Set<string>()): Set<string> {
  if (Array.isArray(v)) {
    for (const e of v) allKeys(e, acc);
  } else if (v !== null && typeof v === 'object') {
    for (const k of Object.keys(v as Record<string, unknown>)) {
      acc.add(k);
      allKeys((v as Record<string, unknown>)[k], acc);
    }
  }
  return acc;
}

describe('redactDossier', () => {
  const pub = redactDossier(cf.suspects[0]!);

  it('preserves exactly id, publicPersona, knownFacts, relationships', () => {
    expect(Object.keys(pub).sort()).toEqual(['id', 'knownFacts', 'publicPersona', 'relationships']);
  });

  it('omits every server-only field', () => {
    expect(allKeys(pub)).not.toContain('secrets');
    expect(allKeys(pub)).not.toContain('alibi');
    expect(allKeys(pub)).not.toContain('knowledge');
    expect(allKeys(pub)).not.toContain('isGuilty');
    expect(allKeys(pub)).not.toContain('role');
  });

  it('carries through the safe public values', () => {
    expect(pub.id).toBe(cf.suspects[0]!.id);
    expect(pub.publicPersona).toBe(cf.suspects[0]!.publicPersona);
    expect(pub.knownFacts).toEqual(cf.suspects[0]!.knownFacts);
    expect(pub.relationships).toEqual(cf.suspects[0]!.relationships);
  });
});

describe('redactClue', () => {
  it('omits reliability and preserves id + statement', () => {
    const clueWithRef = cf.clues[0]!;
    const pub = redactClue(clueWithRef);
    expect(allKeys(pub)).not.toContain('reliability');
    expect(pub.id).toBe(clueWithRef.id);
    expect(pub.statement).toBe(clueWithRef.statement);
  });

  it('preserves refersTo when present', () => {
    const pub = redactClue(cf.clues[0]!);
    expect(pub.refersTo).toEqual(cf.clues[0]!.refersTo);
  });

  it('never emits { refersTo: undefined } when absent (conditional spread)', () => {
    const clueNoRef = Clue.parse({
      id: 'clue-x',
      statement: 'A standalone clue.',
      reliability: 'truthful',
    });
    const pub = redactClue(clueNoRef);
    expect('refersTo' in pub).toBe(false);
    expect(Object.keys(pub).sort()).toEqual(['id', 'statement']);
  });
});

describe('toPublicCaseFile', () => {
  const pub = toPublicCaseFile(cf);

  it('drops solution and keeps exactly the public top-level keys', () => {
    expect(Object.keys(pub).sort()).toEqual([
      'clues',
      'id',
      'locations',
      'suspects',
      'timeline',
      'victim',
      'weapons',
    ]);
  });

  it('is total: N suspects in → N out, M clues in → M out', () => {
    expect(pub.suspects).toHaveLength(cf.suspects.length);
    expect(pub.clues).toHaveLength(cf.clues.length);
    expect(pub.suspects.every((s) => s !== undefined)).toBe(true);
    expect(pub.clues.every((c) => c !== undefined)).toBe(true);
  });

  it('denylist key-scan: no server-only key appears at any depth', () => {
    const serialized = JSON.parse(JSON.stringify(pub));
    const keys = allKeys(serialized);
    for (const banned of DENYLIST) {
      expect(keys).not.toContain(banned);
    }
  });

  it('string-content scan: no secret fact or alibi truth leaks into the payload', () => {
    const serialized = JSON.stringify(pub);
    const secretFact = cf.suspects[0]!.secrets[0]!.fact; // 'rourke-owns-the-dagger'
    const alibiTruth = cf.suspects[0]!.alibi.truth;
    expect(secretFact.length).toBeGreaterThan(0);
    expect(serialized).not.toContain(secretFact);
    expect(serialized).not.toContain(alibiTruth);
    expect(serialized).not.toContain('who-sent-the-letter'); // a doesNotKnow fact
  });
});

/**
 * The Public* projection schemas are the wire contract. These tests parse THROUGH them
 * (not just the redact functions) so a weakened schema (missing field, dropped min(1),
 * emptied object) is a killable mutant.
 */
describe('public projection schemas', () => {
  it('PublicDossier accepts a redacted dossier and rejects malformed/empty input', () => {
    expect(PublicDossier.safeParse(redactDossier(cf.suspects[0]!)).success).toBe(true);
    expect(PublicDossier.safeParse({}).success).toBe(false);
    expect(
      PublicDossier.safeParse({ ...redactDossier(cf.suspects[0]!), publicPersona: '' }).success,
    ).toBe(false);
    expect(
      PublicDossier.safeParse({ ...redactDossier(cf.suspects[0]!), knownFacts: [''] }).success,
    ).toBe(false);
    expect(
      PublicDossier.safeParse({
        ...redactDossier(cf.suspects[0]!),
        relationships: [{ to: 'x', kind: 'rival', descriptor: '' }],
      }).success,
    ).toBe(false);
  });

  it('PublicClue accepts a redacted clue and rejects malformed/empty input', () => {
    expect(PublicClue.safeParse(redactClue(cf.clues[0]!)).success).toBe(true);
    expect(PublicClue.safeParse({}).success).toBe(false);
    expect(PublicClue.safeParse({ ...redactClue(cf.clues[0]!), statement: '' }).success).toBe(
      false,
    );
    // refersTo, when present, is itself validated (branded-id min(1)).
    expect(
      PublicClue.safeParse({ id: 'c', statement: 's', refersTo: { suspectId: '' } }).success,
    ).toBe(false);
  });

  it('PublicCaseFile accepts a redacted case file and rejects malformed/empty input', () => {
    expect(PublicCaseFile.safeParse(toPublicCaseFile(cf)).success).toBe(true);
    expect(PublicCaseFile.safeParse({}).success).toBe(false);
    expect(PublicCaseFile.safeParse({ ...toPublicCaseFile(cf), id: '' }).success).toBe(false);
  });
});
