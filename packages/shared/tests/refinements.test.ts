import { describe, expect, it } from 'vitest';

import { CaseIssueCode } from '../src/errors.js';
import { CaseFile } from '../src/case-file.js';
import {
  caseCodes,
  caseIssues,
  cloneValidCase,
  makeValidCase,
  type CaseInput,
  type CaseIssue,
} from './fixtures/validCase.js';

/** Clone the valid case, apply `mutate`, parse, return the emitted issues (code + path). */
function issuesFor(mutate: (c: CaseInput) => void): CaseIssue[] {
  const c = cloneValidCase();
  mutate(c);
  return caseIssues(c);
}

/** Asserts that exactly the expected code fired AND that it points at the expected path. */
function expectFire(issues: CaseIssue[], code: CaseIssueCode, path: (string | number)[]): void {
  const hits = issues.filter((i) => i.code === code);
  expect(hits, `expected issue ${code} to fire`).not.toHaveLength(0);
  expect(hits.map((h) => h.path)).toContainEqual(path);
}

describe('valid fixture', () => {
  it('parses clean (no issues)', () => {
    const result = CaseFile.safeParse(makeValidCase());
    expect(result.success).toBe(true);
  });

  it('caseCodes() returns [] for the valid case', () => {
    expect(caseCodes(makeValidCase())).toEqual([]);
  });

  it('exercises all three Trigger variants so every branch is reachable', () => {
    const c = makeValidCase();
    const culprit = c.suspects[0]!;
    const triggerKinds = [
      ...culprit.secrets.map((s) => s.leakTrigger.kind),
      culprit.alibi.breaksWhen!.kind,
    ];
    expect(new Set(triggerKinds)).toEqual(
      new Set(['fact-confronted', 'contradiction-exposed', 'clue-presented']),
    );
  });

  it('stays valid with a third (red-herring) suspect — count check, not parity', () => {
    // Distinguishes "exactly one culprit" from a symmetric culprit/non-culprit predicate:
    // here non-culprits (2) ≠ culprits (1), so a flipped filter predicate would misfire.
    const c = cloneValidCase();
    const doyle = structuredClone(c.suspects[1]!);
    doyle.id = 'suspect-doyle';
    doyle.role = 'red-herring';
    doyle.isGuilty = false;
    doyle.relationships = [
      { to: 'victim-1', kind: 'stranger', descriptor: 'Barely knew the victim.' },
    ];
    doyle.knownFacts = ['doyle-saw-nothing'];
    doyle.knowledge = { knows: ['doyle-saw-nothing'], doesNotKnow: [] };
    doyle.secrets = [];
    c.suspects.push(doyle);
    expect(caseCodes(c)).not.toContain(CaseIssueCode.EXACTLY_ONE_CULPRIT);
    expect(CaseFile.safeParse(c).success).toBe(true);
  });
});

describe('R1 — catalog id uniqueness', () => {
  it('R1a: fires DUP_SUSPECT_ID at the duplicate index', () => {
    const issues = issuesFor((c) => {
      c.suspects[1]!.id = c.suspects[0]!.id;
      c.suspects[1]!.relationships = [{ to: 'victim-1', kind: 'stranger', descriptor: 'n/a' }];
    });
    expectFire(issues, CaseIssueCode.DUP_SUSPECT_ID, ['suspects', 1, 'id']);
  });
  it('R1b: fires DUP_WEAPON_ID', () => {
    expectFire(
      issuesFor((c) => (c.weapons[1]!.id = c.weapons[0]!.id)),
      CaseIssueCode.DUP_WEAPON_ID,
      ['weapons', 1, 'id'],
    );
  });
  it('R1c: fires DUP_LOCATION_ID', () => {
    expectFire(
      issuesFor((c) => (c.locations[1]!.id = c.locations[0]!.id)),
      CaseIssueCode.DUP_LOCATION_ID,
      ['locations', 1, 'id'],
    );
  });
  it('R1d: fires DUP_TIMESLOT_ID', () => {
    expectFire(
      issuesFor((c) => (c.timeline[1]!.id = c.timeline[0]!.id)),
      CaseIssueCode.DUP_TIMESLOT_ID,
      ['timeline', 1, 'id'],
    );
  });
  it('R1e: fires DUP_CLUE_ID', () => {
    expectFire(
      issuesFor((c) => (c.clues[1]!.id = c.clues[0]!.id)),
      CaseIssueCode.DUP_CLUE_ID,
      ['clues', 1, 'id'],
    );
  });
});

describe('R2 — exactly one culprit', () => {
  it('fires when 0 culprits', () => {
    const issues = issuesFor((c) => {
      c.suspects[0]!.role = 'witness';
      c.suspects[0]!.isGuilty = false;
    });
    expectFire(issues, CaseIssueCode.EXACTLY_ONE_CULPRIT, ['suspects']);
  });
  it('fires when 2 culprits', () => {
    const issues = issuesFor((c) => {
      c.suspects[1]!.role = 'culprit';
      c.suspects[1]!.isGuilty = true;
    });
    expectFire(issues, CaseIssueCode.EXACTLY_ONE_CULPRIT, ['suspects']);
  });
});

describe('R3 — isGuilty ⟺ role==="culprit"', () => {
  it('fires on guilty witness at that suspect', () => {
    expectFire(
      issuesFor((c) => (c.suspects[1]!.isGuilty = true)),
      CaseIssueCode.GUILT_ROLE_COHERENT,
      ['suspects', 1, 'isGuilty'],
    );
  });
  it('fires on not-guilty culprit at that suspect', () => {
    expectFire(
      issuesFor((c) => (c.suspects[0]!.isGuilty = false)),
      CaseIssueCode.GUILT_ROLE_COHERENT,
      ['suspects', 0, 'isGuilty'],
    );
  });
});

describe('R4 — victim id not reused as suspect id', () => {
  it('fires when a suspect reuses the victim id', () => {
    expectFire(
      issuesFor((c) => (c.suspects[1]!.id = c.victim.id)),
      CaseIssueCode.VICTIM_NOT_SUSPECT,
      ['victim', 'id'],
    );
  });
});

describe('R5 — solution killer resolves and is the culprit', () => {
  it('R5a: fires when killerId is unknown', () => {
    expectFire(
      issuesFor((c) => (c.solution.killerId = 'suspect-ghost')),
      CaseIssueCode.KILLER_RESOLVES,
      ['solution', 'killerId'],
    );
  });
  it('R5b: fires when killer resolves but is not the culprit', () => {
    expectFire(
      issuesFor((c) => (c.solution.killerId = 'suspect-vane')),
      CaseIssueCode.KILLER_IS_CULPRIT,
      ['solution', 'killerId'],
    );
  });
});

describe('R6 — solution references resolve', () => {
  it('R6a: fires on victim mismatch', () => {
    expectFire(
      issuesFor((c) => (c.solution.victimId = 'victim-ghost')),
      CaseIssueCode.SOLUTION_VICTIM_MATCHES,
      ['solution', 'victimId'],
    );
  });
  it('R6b: fires on unknown weapon', () => {
    expectFire(
      issuesFor((c) => (c.solution.weaponId = 'weapon-ghost')),
      CaseIssueCode.SOLUTION_WEAPON_RESOLVES,
      ['solution', 'weaponId'],
    );
  });
  it('R6c: fires on unknown location', () => {
    expectFire(
      issuesFor((c) => (c.solution.locationId = 'loc-ghost')),
      CaseIssueCode.SOLUTION_LOCATION_RESOLVES,
      ['solution', 'locationId'],
    );
  });
  it('R6d: fires on unknown timeslot', () => {
    expectFire(
      issuesFor((c) => (c.solution.timeSlotId = 'ts-ghost')),
      CaseIssueCode.SOLUTION_TIMESLOT_RESOLVES,
      ['solution', 'timeSlotId'],
    );
  });
});

describe('R7–R9 — three-tier knowledge', () => {
  it('R7: fires when knows ∩ doesNotKnow ≠ ∅', () => {
    expectFire(
      issuesFor((c) => c.suspects[0]!.knowledge.doesNotKnow.push('rourke-was-at-the-manor')),
      CaseIssueCode.KNOWLEDGE_DISJOINT,
      ['suspects', 0, 'knowledge', 'doesNotKnow', 1],
    );
  });
  it('R8: fires when a knownFact is not in knows', () => {
    expectFire(
      issuesFor((c) => (c.suspects[0]!.knownFacts = ['fact-not-in-knows'])),
      CaseIssueCode.KNOWN_FACTS_SUBSET,
      ['suspects', 0, 'knownFacts', 0],
    );
  });
  it('R9a: fires when a secret fact is not in knows', () => {
    const issues = issuesFor((c) =>
      c.suspects[0]!.secrets.push({
        fact: 'ghost-fact',
        leakTrigger: { kind: 'contradiction-exposed' },
        ifLeaked: 'n/a',
      }),
    );
    expectFire(issues, CaseIssueCode.SECRET_FACT_COHERENT, ['suspects', 0, 'secrets', 2, 'fact']);
  });
  it('R9b: fires when a secret fact is also a knownFact', () => {
    expectFire(
      issuesFor((c) => (c.suspects[0]!.secrets[0]!.fact = 'rourke-was-at-the-manor')),
      CaseIssueCode.SECRET_FACT_COHERENT,
      ['suspects', 0, 'secrets', 0, 'fact'],
    );
  });
});

describe('R10 — relationship edges', () => {
  it('R10a: fires when target does not resolve', () => {
    expectFire(
      issuesFor((c) => (c.suspects[1]!.relationships[0]!.to = 'nobody')),
      CaseIssueCode.RELATIONSHIP_TARGET_RESOLVES,
      ['suspects', 1, 'relationships', 0, 'to'],
    );
  });
  it('R10b: fires on a self-edge (resolves, so only the self-edge code fires)', () => {
    const issues = issuesFor((c) => (c.suspects[1]!.relationships[0]!.to = c.suspects[1]!.id));
    expectFire(issues, CaseIssueCode.RELATIONSHIP_NO_SELF_EDGE, [
      'suspects',
      1,
      'relationships',
      0,
      'to',
    ]);
    expect(issues.map((i) => i.code)).not.toContain(CaseIssueCode.RELATIONSHIP_TARGET_RESOLVES);
  });
});

describe('R11/R12 — clue-presented trigger cross-checks', () => {
  it('R11: fires when a secret clue-presented trigger is unknown', () => {
    const issues = issuesFor(
      (c) =>
        (c.suspects[0]!.secrets[0]!.leakTrigger = { kind: 'clue-presented', clueId: 'clue-ghost' }),
    );
    expectFire(issues, CaseIssueCode.SECRET_TRIGGER_RESOLVES, [
      'suspects',
      0,
      'secrets',
      0,
      'leakTrigger',
      'clueId',
    ]);
  });
  it('R12: fires when an alibi clue-presented trigger is unknown', () => {
    const issues = issuesFor(
      (c) => (c.suspects[0]!.alibi.breaksWhen = { kind: 'clue-presented', clueId: 'clue-ghost' }),
    );
    expectFire(issues, CaseIssueCode.ALIBI_TRIGGER_RESOLVES, [
      'suspects',
      0,
      'alibi',
      'breaksWhen',
      'clueId',
    ]);
  });
  it('R11/R12: a non-clue-presented trigger (fact-confronted) is NOT cross-checked', () => {
    // Guards the `kind === 'clue-presented'` discriminant: a fact-confronted trigger
    // with an arbitrary fact must not be treated as an unresolved clue reference.
    const codes = caseCodes(makeValidCase());
    expect(codes).not.toContain(CaseIssueCode.SECRET_TRIGGER_RESOLVES);
    expect(codes).not.toContain(CaseIssueCode.ALIBI_TRIGGER_RESOLVES);
  });
  it('R12: a contradiction-exposed breaksWhen is not cross-checked (kind discriminant matters)', () => {
    // If the `bw.kind === 'clue-presented'` check were bypassed, a clueId-less trigger
    // would be read as the unresolved clue "undefined" and misfire ALIBI_TRIGGER_RESOLVES.
    const codes = issuesFor((c) => {
      c.suspects[0]!.alibi.breaksWhen = { kind: 'contradiction-exposed' };
    }).map((i) => i.code);
    expect(codes).not.toContain(CaseIssueCode.ALIBI_TRIGGER_RESOLVES);
  });
});

describe('R13 — clue refersTo cross-checks', () => {
  it('R13a: fires on unknown suspect ref', () => {
    expectFire(
      issuesFor((c) => (c.clues[0]!.refersTo!.suspectId = 'suspect-ghost')),
      CaseIssueCode.CLUE_REFS_SUSPECT_RESOLVES,
      ['clues', 0, 'refersTo', 'suspectId'],
    );
  });
  it('R13b: fires on unknown weapon ref', () => {
    expectFire(
      issuesFor((c) => (c.clues[0]!.refersTo!.weaponId = 'weapon-ghost')),
      CaseIssueCode.CLUE_REFS_WEAPON_RESOLVES,
      ['clues', 0, 'refersTo', 'weaponId'],
    );
  });
  it('R13c: fires on unknown location ref', () => {
    expectFire(
      issuesFor((c) => (c.clues[0]!.refersTo!.locationId = 'loc-ghost')),
      CaseIssueCode.CLUE_REFS_LOCATION_RESOLVES,
      ['clues', 0, 'refersTo', 'locationId'],
    );
  });
  it('R13d: fires on unknown timeslot ref', () => {
    expectFire(
      issuesFor((c) => (c.clues[0]!.refersTo!.timeSlotId = 'ts-ghost')),
      CaseIssueCode.CLUE_REFS_TIMESLOT_RESOLVES,
      ['clues', 0, 'refersTo', 'timeSlotId'],
    );
  });
  it('an empty refersTo object cross-checks nothing (each ref is independently optional)', () => {
    // Each `rt.x !== undefined &&` guard must skip an absent ref — otherwise an absent
    // field would be treated as the unresolvable id "undefined".
    const codes = caseCodes(
      (() => {
        const c = cloneValidCase();
        c.clues[0]!.refersTo = {};
        return c;
      })(),
    );
    expect(codes).not.toContain(CaseIssueCode.CLUE_REFS_SUSPECT_RESOLVES);
    expect(codes).not.toContain(CaseIssueCode.CLUE_REFS_WEAPON_RESOLVES);
    expect(codes).not.toContain(CaseIssueCode.CLUE_REFS_LOCATION_RESOLVES);
    expect(codes).not.toContain(CaseIssueCode.CLUE_REFS_TIMESLOT_RESOLVES);
  });
  it('a clue with no refersTo is skipped entirely', () => {
    // clue-letter (index 1) has no refersTo — exercises the `refersTo === undefined` skip.
    expect(caseCodes(makeValidCase())).toEqual([]);
  });
});

describe('R14 — at least one non-culprit', () => {
  it('fires when every suspect is the culprit (unsolvable)', () => {
    const issues = issuesFor((c) => {
      c.suspects = [c.suspects[0]!];
    });
    expectFire(issues, CaseIssueCode.WITNESS_OR_HERRING_PRESENT, ['suspects']);
  });
});

describe('R15 — timeline order uniqueness', () => {
  it('fires on duplicate order at the duplicate index', () => {
    expectFire(
      issuesFor((c) => (c.timeline[1]!.order = c.timeline[0]!.order)),
      CaseIssueCode.TIMESLOT_ORDER_UNIQUE,
      ['timeline', 1, 'order'],
    );
  });
});

describe('R16 — culprit alibi must be breakable', () => {
  it('fires when the culprit has no breaksWhen', () => {
    const issues = issuesFor((c) => {
      delete c.suspects[0]!.alibi.breaksWhen;
    });
    expectFire(issues, CaseIssueCode.CULPRIT_ALIBI_BREAKABLE, ['suspects', 0, 'alibi']);
  });
  it('does NOT fire for a non-culprit without breaksWhen', () => {
    // vane (witness) legitimately has no breaksWhen — the R16 guard is culprit-only.
    expect(caseCodes(makeValidCase())).not.toContain(CaseIssueCode.CULPRIT_ALIBI_BREAKABLE);
  });
});

