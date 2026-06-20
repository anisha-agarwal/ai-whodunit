import { describe, it, expect } from 'vitest';
import {
  redactDossier,
  redactClue,
  toPublicCaseFile,
  PublicDossier,
  PublicClue,
  PublicCaseFile,
} from './redaction.js';
import { CaseFile } from './case-file.js';
import { makeValidCase } from '../tests/fixtures/validCase.js';
import { collectKeys, collectStrings, topLevelKeys } from '../tests/helpers.js';

function caseFile() {
  const r = CaseFile.safeParse(makeValidCase());
  if (!r.success) throw new Error('fixture invalid: ' + JSON.stringify(r.error.issues));
  return r.data;
}

/** Every server-only key name that must NEVER appear in any serialized Public* projection. */
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
] as const;

describe('Public* schemas validate the projection shape (load-bearing field declarations)', () => {
  it('PublicDossier parses a redacted dossier and RETAINS every public field (kills z.object({}))', () => {
    const r = PublicDossier.safeParse(redactDossier(caseFile().suspects[0]!));
    expect(r.success).toBe(true);
    if (r.success) {
      // an empty `z.object({})` mutant would strip these to {}; assert they survive parsing.
      expect(r.data.id).toBeDefined();
      expect(r.data.publicPersona).toBeDefined();
      expect(r.data.knownFacts).toBeDefined();
      expect(r.data.relationships).toBeDefined();
    }
  });

  it('PublicDossier multi-char strings parse (kills min(1)→max(1)); empty strings reject (kills drop-min)', () => {
    const ok = redactDossier(caseFile().suspects[0]!);
    expect(PublicDossier.safeParse(ok).success).toBe(true); // persona/knownFacts are multi-char
    expect(PublicDossier.safeParse({ ...ok, publicPersona: '' }).success).toBe(false);
    expect(PublicDossier.safeParse({ ...ok, knownFacts: [''] }).success).toBe(false);
  });

  it('PublicClue parses a redacted clue and RETAINS id+statement (kills z.object({}))', () => {
    const withRef = caseFile().clues.find((c) => c.refersTo !== undefined)!;
    const r = PublicClue.safeParse(redactClue(withRef));
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.id).toBeDefined();
      expect(r.data.statement).toBeDefined();
      expect(r.data.refersTo).toBeDefined();
    }
  });

  it('PublicClue empty statement rejects (kills drop-min); refersTo inner empty-string rejects', () => {
    const pub = redactClue(caseFile().clues.find((c) => c.refersTo !== undefined)!);
    expect(PublicClue.safeParse({ ...pub, statement: '' }).success).toBe(false);
    expect(PublicClue.safeParse({ ...pub, refersTo: { weaponId: '' } }).success).toBe(false);
  });

  it('PublicCaseFile parses the projection and RETAINS every public field (kills z.object({}))', () => {
    const r = PublicCaseFile.safeParse(toPublicCaseFile(caseFile()));
    expect(r.success).toBe(true);
    if (r.success) {
      for (const k of [
        'id',
        'victim',
        'weapons',
        'locations',
        'timeline',
        'suspects',
        'clues',
      ] as const) {
        expect(r.data[k]).toBeDefined();
      }
    }
  });

  it('PublicCaseFile empty id rejects (kills drop-min on the envelope id)', () => {
    const pub = toPublicCaseFile(caseFile());
    expect(PublicCaseFile.safeParse({ ...pub, id: '' }).success).toBe(false);
  });
});

describe('redactDossier — exact allowlist, server-only fields omitted', () => {
  it('returns EXACTLY {id, publicPersona, knownFacts, relationships}', () => {
    const pub = redactDossier(caseFile().suspects[0]!);
    expect(topLevelKeys(pub)).toEqual(['id', 'knownFacts', 'publicPersona', 'relationships']);
  });

  it('carries relationships VERBATIM (no nested re-redaction)', () => {
    const d = caseFile().suspects[0]!;
    expect(redactDossier(d).relationships).toEqual(d.relationships);
  });

  it('OMITS every server-only dossier field', () => {
    const pub = redactDossier(caseFile().suspects[0]!) as Record<string, unknown>;
    for (const k of ['secrets', 'alibi', 'knowledge', 'isGuilty', 'role']) {
      expect(pub).not.toHaveProperty(k);
    }
  });
});

describe('redactClue — conditional-spread BOTH arms, reliability omitted', () => {
  it('returns {id, statement} when refersTo ABSENT', () => {
    const noRef = caseFile().clues.find((c) => c.refersTo === undefined)!;
    const pub = redactClue(noRef);
    expect(topLevelKeys(pub)).toEqual(['id', 'statement']);
  });

  it('returns {id, statement, refersTo} when refersTo PRESENT', () => {
    const withRef = caseFile().clues.find((c) => c.refersTo !== undefined)!;
    const pub = redactClue(withRef);
    expect(topLevelKeys(pub)).toEqual(['id', 'refersTo', 'statement']);
    expect(pub.refersTo).toEqual(withRef.refersTo);
  });

  it('OMITS reliability (the C2 leak)', () => {
    const pub = redactClue(caseFile().clues[0]!) as Record<string, unknown>;
    expect(pub).not.toHaveProperty('reliability');
  });
});

describe('toPublicCaseFile — allowlist key-set + totality', () => {
  it('returns EXACTLY {id, victim, weapons, locations, timeline, suspects, clues}; OMITS solution', () => {
    const pub = toPublicCaseFile(caseFile());
    expect(topLevelKeys(pub)).toEqual([
      'clues',
      'id',
      'locations',
      'suspects',
      'timeline',
      'victim',
      'weapons',
    ]);
    expect(pub).not.toHaveProperty('solution');
  });

  it('totality: N suspects → N public, M clues → M public (no throw, no undefined)', () => {
    const cf = caseFile();
    const pub = toPublicCaseFile(cf);
    expect(pub.suspects).toHaveLength(cf.suspects.length);
    expect(pub.clues).toHaveLength(cf.clues.length);
    expect(pub.suspects.every((s) => s !== undefined)).toBe(true);
    expect(pub.clues.every((c) => c !== undefined)).toBe(true);
  });
});

describe('REDACTION denylist key-scan (the server-authoritative payload-scan analogue)', () => {
  it('serialized toPublicCaseFile contains NONE of the server-only keys at any depth', () => {
    const pub = toPublicCaseFile(caseFile());
    const keys = collectKeys(JSON.parse(JSON.stringify(pub)));
    for (const denied of DENYLIST) {
      expect(keys.has(denied)).toBe(false);
    }
  });
});

describe('REDACTION scoped string-content scan', () => {
  it('a known Secret.fact / alibi.truth string does NOT appear anywhere in the projection', () => {
    const cf = caseFile();
    const secretFact = cf.suspects[0]!.secrets[0]!.fact;
    const alibiTruth = cf.suspects[0]!.alibi.truth;
    const ifLeaked = cf.suspects[0]!.secrets[0]!.ifLeaked;

    const strings = collectStrings(JSON.parse(JSON.stringify(toPublicCaseFile(cf))));
    expect(strings).not.toContain(secretFact);
    expect(strings).not.toContain(alibiTruth);
    expect(strings).not.toContain(ifLeaked);
  });
});
