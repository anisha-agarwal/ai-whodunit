import { describe, it, expect } from 'vitest';
import { CaseFile } from './case-file.js';
import { CaseIssueCode } from './errors.js';
import { makeValidCase } from '../tests/fixtures/validCase.js';
import { mutate, type MutationKey } from '../tests/fixtures/mutate.js';

interface RaisedIssue {
  code: string;
  message: string;
  path: (string | number)[];
}

/** Every `custom` issue of a failed parse, as `{code, message, path}` triples. */
function issuesOf(input: unknown): RaisedIssue[] {
  const r = CaseFile.safeParse(input);
  if (r.success) return [];
  return r.error.issues.map((i) => ({
    code: i.code,
    message: i.message,
    path: i.path as (string | number)[],
  }));
}

/** Just the `message` values (= the stable CaseIssueCode). */
function codesOf(input: unknown): string[] {
  return issuesOf(input).map((i) => i.message);
}

/**
 * Assert a `custom` issue with `code:'custom'`, `message === expectedCode`, and `path` deep-equal to
 * `expectedPath` is present. Pinning all three kills the path-argument mutants (`[]`, `['']`), the
 * `code:'custom'`→`''` mutant, and the message-swap mutants in one assertion.
 */
function expectIssue(
  input: unknown,
  expectedCode: CaseIssueCode,
  expectedPath: (string | number)[],
): void {
  const match = issuesOf(input).find(
    (i) => i.message === expectedCode && JSON.stringify(i.path) === JSON.stringify(expectedPath),
  );
  expect(
    match,
    `expected a custom issue ${expectedCode} at path ${JSON.stringify(expectedPath)}`,
  ).toBeDefined();
  expect(match!.code).toBe('custom');
}

describe('checkCaseInvariants — valid fixture is silent', () => {
  it('the canonical valid case parses with zero issues (pass-arm of every R1a–R16)', () => {
    const r = CaseFile.safeParse(makeValidCase());
    expect(r.success).toBe(true);
  });

  it('the valid case carries ≥1 secret Trigger of every kind (positive trigger branches reachable)', () => {
    const cf = makeValidCase();
    const triggerKinds = cf.suspects.flatMap((s) => s.secrets.map((sec) => sec.leakTrigger.kind));
    expect(new Set(triggerKinds)).toEqual(
      new Set(['clue-presented', 'fact-confronted', 'contradiction-exposed']),
    );
  });
});

/**
 * Truth table: one row per refinement fail-arm. Each row mutates exactly one field and asserts the
 * SPECIFIC code is present in the parse issues. The `also valid-silent` assertion below proves the
 * un-mutated case does NOT carry that code, so a guard that always-fires is caught.
 */
// `path` is the exact issue path the helper emits, so a path-argument mutation (`[]`, `['']`, an
// index swap) is caught. Indices match where `mutate()` injects the fault (suspects[0], clues[0/1]).
const ROWS: { key: MutationKey; code: CaseIssueCode; label: string; path: (string | number)[] }[] =
  [
    // R1
    {
      key: 'dup-suspect-id',
      code: CaseIssueCode.DUP_SUSPECT_ID,
      label: 'R1a duplicate suspect id',
      path: ['suspects'],
    },
    {
      key: 'dup-weapon-id',
      code: CaseIssueCode.DUP_WEAPON_ID,
      label: 'R1b duplicate weapon id',
      path: ['weapons'],
    },
    {
      key: 'dup-location-id',
      code: CaseIssueCode.DUP_LOCATION_ID,
      label: 'R1c duplicate location id',
      path: ['locations'],
    },
    {
      key: 'dup-timeslot-id',
      code: CaseIssueCode.DUP_TIMESLOT_ID,
      label: 'R1d duplicate timeslot id',
      path: ['timeline'],
    },
    {
      key: 'dup-clue-id',
      code: CaseIssueCode.DUP_CLUE_ID,
      label: 'R1e duplicate clue id',
      path: ['clues'],
    },
    // R2 (two fixtures — both !==1 arms)
    {
      key: 'zero-culprits',
      code: CaseIssueCode.EXACTLY_ONE_CULPRIT,
      label: 'R2 zero culprits',
      path: ['suspects'],
    },
    {
      key: 'two-culprits',
      code: CaseIssueCode.EXACTLY_ONE_CULPRIT,
      label: 'R2 two culprits',
      path: ['suspects'],
    },
    // R3 (two fixtures)
    {
      key: 'guilty-witness',
      code: CaseIssueCode.GUILT_ROLE_COHERENT,
      label: 'R3 guilty witness',
      path: ['suspects'],
    },
    {
      key: 'non-guilty-culprit',
      code: CaseIssueCode.GUILT_ROLE_COHERENT,
      label: 'R3 non-guilty culprit',
      path: ['suspects'],
    },
    // R4
    {
      key: 'victim-is-suspect',
      code: CaseIssueCode.VICTIM_NOT_SUSPECT,
      label: 'R4 victim collides with a suspect',
      path: ['victim', 'id'],
    },
    // R5
    {
      key: 'killer-unresolved',
      code: CaseIssueCode.KILLER_RESOLVES,
      label: 'R5a killer id not in suspects',
      path: ['solution', 'killerId'],
    },
    {
      key: 'killer-not-culprit',
      code: CaseIssueCode.KILLER_IS_CULPRIT,
      label: 'R5b killer resolves to a non-culprit',
      path: ['solution', 'killerId'],
    },
    // R6
    {
      key: 'solution-victim-mismatch',
      code: CaseIssueCode.SOLUTION_VICTIM_MATCHES,
      label: 'R6a solution victim mismatch',
      path: ['solution', 'victimId'],
    },
    {
      key: 'solution-weapon-unresolved',
      code: CaseIssueCode.SOLUTION_WEAPON_RESOLVES,
      label: 'R6b solution weapon unresolved',
      path: ['solution', 'weaponId'],
    },
    {
      key: 'solution-location-unresolved',
      code: CaseIssueCode.SOLUTION_LOCATION_RESOLVES,
      label: 'R6c solution location unresolved',
      path: ['solution', 'locationId'],
    },
    {
      key: 'solution-timeslot-unresolved',
      code: CaseIssueCode.SOLUTION_TIMESLOT_RESOLVES,
      label: 'R6d solution timeslot unresolved',
      path: ['solution', 'timeSlotId'],
    },
    // R7/R8/R9 (mutation on suspects[0])
    {
      key: 'knowledge-not-disjoint',
      code: CaseIssueCode.KNOWLEDGE_DISJOINT,
      label: 'R7 knows ∩ doesNotKnow ≠ ∅',
      path: ['suspects', 0, 'knowledge'],
    },
    {
      key: 'known-fact-not-in-knows',
      code: CaseIssueCode.KNOWN_FACTS_SUBSET,
      label: 'R8 knownFacts ⊄ knows',
      path: ['suspects', 0, 'knownFacts'],
    },
    {
      key: 'secret-fact-not-in-knows',
      code: CaseIssueCode.SECRET_FACT_COHERENT,
      label: 'R9a secret fact ∉ knows',
      path: ['suspects', 0, 'secrets'],
    },
    {
      key: 'secret-fact-in-knownfacts',
      code: CaseIssueCode.SECRET_FACT_COHERENT,
      label: 'R9b secret fact ∈ knownFacts (|| 2nd arm)',
      path: ['suspects', 0, 'secrets'],
    },
    // R10 (mutation on suspects[0].relationships[0])
    {
      key: 'relationship-target-unresolved',
      code: CaseIssueCode.RELATIONSHIP_TARGET_RESOLVES,
      label: 'R10a relationship target unresolved',
      path: ['suspects', 0, 'relationships', 0],
    },
    {
      key: 'relationship-self-edge',
      code: CaseIssueCode.RELATIONSHIP_NO_SELF_EDGE,
      label: 'R10b relationship self-edge',
      path: ['suspects', 0, 'relationships', 0],
    },
    // R11/R12 (mutation on suspects[0])
    {
      key: 'secret-trigger-unresolved',
      code: CaseIssueCode.SECRET_TRIGGER_RESOLVES,
      label: 'R11 secret clue-presented trigger unresolved',
      path: ['suspects', 0, 'secrets', 0],
    },
    {
      key: 'alibi-trigger-unresolved',
      code: CaseIssueCode.ALIBI_TRIGGER_RESOLVES,
      label: 'R12 alibi breaksWhen clue-presented unresolved',
      path: ['suspects', 0, 'alibi', 'breaksWhen'],
    },
    // R13 (suspect→clues[1], weapon/location→clues[0], timeslot→clues[1])
    {
      key: 'clue-ref-suspect-unresolved',
      code: CaseIssueCode.CLUE_REFS_SUSPECT_RESOLVES,
      label: 'R13a clue refersTo.suspectId unresolved',
      path: ['clues', 1, 'refersTo'],
    },
    {
      key: 'clue-ref-weapon-unresolved',
      code: CaseIssueCode.CLUE_REFS_WEAPON_RESOLVES,
      label: 'R13b clue refersTo.weaponId unresolved',
      path: ['clues', 0, 'refersTo'],
    },
    {
      key: 'clue-ref-location-unresolved',
      code: CaseIssueCode.CLUE_REFS_LOCATION_RESOLVES,
      label: 'R13c clue refersTo.locationId unresolved',
      path: ['clues', 0, 'refersTo'],
    },
    {
      key: 'clue-ref-timeslot-unresolved',
      code: CaseIssueCode.CLUE_REFS_TIMESLOT_RESOLVES,
      label: 'R13d clue refersTo.timeSlotId unresolved',
      path: ['clues', 1, 'refersTo'],
    },
    // R14/R15/R16
    {
      key: 'single-suspect',
      code: CaseIssueCode.WITNESS_OR_HERRING_PRESENT,
      label: 'R14 only-the-culprit case',
      path: ['suspects'],
    },
    {
      key: 'timeslot-order-dup',
      code: CaseIssueCode.TIMESLOT_ORDER_UNIQUE,
      label: 'R15 two timeslots share an order',
      path: ['timeline'],
    },
    {
      key: 'culprit-alibi-unbreakable',
      code: CaseIssueCode.CULPRIT_ALIBI_BREAKABLE,
      label: 'R16 culprit alibi has no breaksWhen',
      path: ['suspects'],
    },
  ];

describe('checkCaseInvariants — each refinement fires its specific CaseIssueCode + path', () => {
  it('baseline: valid case is silent on every refinement code', () => {
    const codes = codesOf(makeValidCase());
    for (const row of ROWS) {
      expect(codes).not.toContain(row.code);
    }
  });

  for (const row of ROWS) {
    it(`${row.label} → fires ${row.code} at ${JSON.stringify(row.path)}`, () => {
      expectIssue(mutate(row.key), row.code, row.path);
    });
  }
});

describe('checkCaseInvariants — loop quantifiers are load-bearing (.some / .find)', () => {
  it('R9 uses .some not .every: ONE incoherent secret among several coherent ones still fires', () => {
    // Two secrets on suspects[0]: the first stays coherent (∈ knows \ knownFacts), the second is
    // incoherent (∉ knows). `.some` fires; a `.every` mutant would NOT (the first secret is fine).
    const cf = makeValidCase();
    cf.suspects[0]!.knowledge.knows.push('a second real secret');
    cf.suspects[0]!.secrets = [
      cf.suspects[0]!.secrets[0]!, // coherent
      {
        fact: 'a fact never in knows', // incoherent — ∉ knows
        leakTrigger: { kind: 'contradiction-exposed' },
        ifLeaked: 'crumbles',
      },
    ];
    expectIssue(cf, CaseIssueCode.SECRET_FACT_COHERENT, ['suspects', 0, 'secrets']);
  });

  it('R16 finds the CULPRIT specifically (not just any suspect): culprit-not-first, unbreakable', () => {
    // Reorder so the culprit is suspects[1] with an unbreakable alibi, and suspects[0] (a non-culprit)
    // has a breakable alibi. The real `find(role==='culprit')` picks suspects[1] → fires. A
    // `find(()=>true)` mutant picks suspects[0] (breakable) → does NOT fire, so this test goes RED on
    // that mutant.
    const cf = makeValidCase();
    const culprit = cf.suspects[0]!; // the culprit (breaksWhen present)
    const witness = cf.suspects[2]!; // a non-culprit
    // give the non-culprit a breakable alibi so find(()=>true)→suspects[0] would be silent
    witness.alibi.breaksWhen = { kind: 'clue-presented', clueId: 'c1' };
    // remove the real culprit's breaksWhen → R16 must fire for the culprit
    delete culprit.alibi.breaksWhen;
    // reorder: non-culprit first, culprit second
    cf.suspects = [witness, cf.suspects[1]!, culprit];
    expectIssue(cf, CaseIssueCode.CULPRIT_ALIBI_BREAKABLE, ['suspects']);
  });
});

describe('checkCaseInvariants — skip arms must stay silent (no false positive)', () => {
  it('R11/R12: fact-confronted + contradiction-exposed secret triggers do NOT fire SECRET_TRIGGER_RESOLVES', () => {
    // The valid case already carries fact-confronted (s2) + contradiction-exposed (s3) secret
    // triggers; their leakTrigger.kind !== 'clue-presented' arm must be silent.
    expect(codesOf(makeValidCase())).not.toContain(CaseIssueCode.SECRET_TRIGGER_RESOLVES);
  });

  it('R12: an absent alibi.breaksWhen does NOT fire ALIBI_TRIGGER_RESOLVES', () => {
    // s2/s3 have no breaksWhen; the `bw !== undefined` skip arm must be silent.
    expect(codesOf(makeValidCase())).not.toContain(CaseIssueCode.ALIBI_TRIGGER_RESOLVES);
  });

  it('R12: a fact-confronted breaksWhen does NOT fire ALIBI_TRIGGER_RESOLVES', () => {
    const cf = makeValidCase();
    cf.suspects[0]!.alibi.breaksWhen = { kind: 'fact-confronted', fact: 'the muddy boots' };
    const codes = codesOf(cf);
    expect(codes).not.toContain(CaseIssueCode.ALIBI_TRIGGER_RESOLVES);
    // but R16 stays silent too (breaksWhen present, just a different kind):
    expect(codes).not.toContain(CaseIssueCode.CULPRIT_ALIBI_BREAKABLE);
  });

  it('R13: a clue with refersTo === undefined does NOT fire any CLUE_REFS code (early-continue)', () => {
    // c3 in the valid case has no refersTo; the early-continue arm must be silent.
    const codes = codesOf(makeValidCase());
    expect(codes).not.toContain(CaseIssueCode.CLUE_REFS_SUSPECT_RESOLVES);
    expect(codes).not.toContain(CaseIssueCode.CLUE_REFS_WEAPON_RESOLVES);
    expect(codes).not.toContain(CaseIssueCode.CLUE_REFS_LOCATION_RESOLVES);
    expect(codes).not.toContain(CaseIssueCode.CLUE_REFS_TIMESLOT_RESOLVES);
  });

  it('R13: a clue with refersTo present but every ref undefined does NOT fire (each === undefined skip)', () => {
    const cf = makeValidCase();
    cf.clues[2]!.refersTo = {}; // present object, all four refs absent
    expect(codesOf(cf)).not.toContain(CaseIssueCode.CLUE_REFS_SUSPECT_RESOLVES);
  });

  it('R16: with no culprit present the culprit===undefined arm does NOT fire CULPRIT_ALIBI_BREAKABLE', () => {
    // zero-culprits mutation removes the only culprit; R16's `culprit !== undefined` guard is false.
    const codes = codesOf(mutate('zero-culprits'));
    expect(codes).not.toContain(CaseIssueCode.CULPRIT_ALIBI_BREAKABLE);
  });
});

describe('findDuplicates — both seen-hit and seen-miss arms via R1 + R15', () => {
  it('R1d duplicate id (seen-hit) fires while R15 distinct orders (seen-miss) stays silent', () => {
    const codes = codesOf(mutate('dup-timeslot-id'));
    expect(codes).toContain(CaseIssueCode.DUP_TIMESLOT_ID);
    expect(codes).not.toContain(CaseIssueCode.TIMESLOT_ORDER_UNIQUE);
  });

  it('R15 duplicate order (seen-hit) fires while R1d distinct ids (seen-miss) stays silent', () => {
    const codes = codesOf(mutate('timeslot-order-dup'));
    expect(codes).toContain(CaseIssueCode.TIMESLOT_ORDER_UNIQUE);
    expect(codes).not.toContain(CaseIssueCode.DUP_TIMESLOT_ID);
  });
});
