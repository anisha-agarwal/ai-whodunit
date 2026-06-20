import { describe, it, expect } from 'vitest';
import { CaseFile } from '@ai-whodunit/shared';
import { checkCulpritBreakClue, checkClueCollision } from './consistency.js';
import { SolverIssueCode } from './verdict.js';
import {
  solvableCase,
  clueCollisionCase,
  breakClueOffSolutionCase,
  opaqueTriggerCase,
  breakClueNotFirstCase,
  partialRefMatchingCase,
  nullClueIdGuardCase,
  makeSolvableCase,
  type RawCase,
} from '../tests/fixtures/cases.js';

function parse(raw: RawCase): CaseFile {
  const result = CaseFile.safeParse(raw);
  if (!result.success) throw new Error('expected parse-valid: ' + result.error.message);
  return result.data;
}

describe('checkCulpritBreakClue', () => {
  it('returns null when every present refersTo field agrees with the solution (pass-arm)', () => {
    expect(checkCulpritBreakClue(parse(solvableCase()))).toBeNull();
  });

  it('returns CULPRIT_BREAK_CLUE_OFF_SOLUTION on the off-solution location fixture', () => {
    const issue = checkCulpritBreakClue(parse(breakClueOffSolutionCase()));
    expect(issue?.code).toBe(SolverIssueCode.CULPRIT_BREAK_CLUE_OFF_SOLUTION);
    expect(issue?.detail).toContain('locationId');
  });

  // Truth table — each present refersTo field, when pointed at a REAL but non-solution catalog id,
  // must trip the off-solution check. Covers all four mismatch branches in one block.
  describe('per-field placement mismatch (each present ref must equal the solution)', () => {
    const cases: { field: string; bad: string }[] = [
      { field: 'suspectId', bad: 's2' }, // real suspect, not the killer s1
      { field: 'weaponId', bad: 'w2' }, // real weapon, not solution w1
      { field: 'locationId', bad: 'l2' }, // real location, not solution l1
      { field: 'timeSlotId', bad: 't2' }, // real time slot, not solution t1
    ];

    for (const { field, bad } of cases) {
      it(`flags a disagreeing refersTo.${field}`, () => {
        const raw = makeSolvableCase();
        const c1 = raw.clues.find((c) => c.id === 'c1');
        if (!c1 || !c1.refersTo) throw new Error('fixture invariant: c1.refersTo present');
        (c1.refersTo as Record<string, string>)[field] = bad;
        const issue = checkCulpritBreakClue(parse(raw));
        expect(issue?.code).toBe(SolverIssueCode.CULPRIT_BREAK_CLUE_OFF_SOLUTION);
        expect(issue?.detail).toContain(field);
        expect(issue?.detail).toContain(bad);
      });
    }
  });

  it('resolves the culprit break clue by its OWN clueId, not the first clue in the catalog', () => {
    // The culprit breaks on c3 (second clue, refersTo agrees); c1 (first clue) is off-solution.
    // A `clues.find(() => true)` mutant would pick c1 and spuriously flag a mismatch.
    expect(checkCulpritBreakClue(parse(breakClueNotFirstCase()))).toBeNull();
  });

  it('skips ABSENT refersTo fields — a partial-but-agreeing refersTo is consistent', () => {
    // Only locationId is present (and agrees); the other three fields are undefined. A mutant
    // dropping the `m.value !== undefined` guard would treat an absent field as a mismatch.
    expect(checkCulpritBreakClue(parse(partialRefMatchingCase()))).toBeNull();
  });

  it('returns null when the culprit break-clue has NO refersTo (nothing to contradict)', () => {
    const raw = makeSolvableCase();
    const c1 = raw.clues.find((c) => c.id === 'c1');
    if (!c1) throw new Error('fixture invariant: c1 present');
    delete c1.refersTo;
    expect(checkCulpritBreakClue(parse(raw))).toBeNull();
  });

  it('returns null when the culprit break is opaque (no resolvable clueId)', () => {
    // Make the CULPRIT (s1) break on a contradiction-exposed trigger → breakingClueId === null.
    const raw = makeSolvableCase();
    const s1 = raw.suspects.find((s) => s.id === 's1');
    if (!s1) throw new Error('fixture invariant: s1 present');
    s1.alibi.breaksWhen = { kind: 'contradiction-exposed' };
    expect(checkCulpritBreakClue(parse(raw))).toBeNull();
  });

  it('short-circuits on a null breaking clueId BEFORE the clue lookup (guard probe)', () => {
    // Opaque culprit (breakingClueId === null) + a degenerate null-id clue with an off-solution
    // refersTo. The early `clueId === null` return must fire; without it, the lookup would MATCH
    // the null-id clue and spuriously flag a mismatch. Fed directly (not parse-valid).
    expect(checkCulpritBreakClue(nullClueIdGuardCase() as unknown as CaseFile)).toBeNull();
  });

  it('returns null when the cited break-clue is not in the catalog (clue absent → undefined ref)', () => {
    // Build a structurally-shaped case whose culprit cites a clueId with no matching clue, then
    // call the helper directly (this shape would NOT pass safeParse, so it is fed unparsed).
    const raw = makeSolvableCase();
    const s1 = raw.suspects.find((s) => s.id === 's1');
    if (!s1) throw new Error('fixture invariant: s1 present');
    s1.alibi.breaksWhen = { kind: 'clue-presented', clueId: 'c-missing' };
    expect(checkCulpritBreakClue(raw as unknown as CaseFile)).toBeNull();
  });

  it('returns null (defensive) when the killerId resolves to no suspect', () => {
    // killerId points at a non-existent suspect — unreachable on parse-valid input (R5), so we
    // feed the structurally-shaped object directly to exercise the defensive culprit-not-found arm.
    const raw = makeSolvableCase();
    raw.solution.killerId = 's-ghost';
    expect(checkCulpritBreakClue(raw as unknown as CaseFile)).toBeNull();
  });
});

describe('checkClueCollision', () => {
  it('no two suspects share a breaking clue → no issue, empty contradictions', () => {
    const result = checkClueCollision(parse(solvableCase()));
    expect(result.issue).toBeNull();
    expect(result.contradictions).toEqual([]);
  });

  it('two suspects breaking on the same clueId → ALIBI_CLUE_COLLISION + correct Contradiction audit', () => {
    const result = checkClueCollision(parse(clueCollisionCase()));
    expect(result.issue?.code).toBe(SolverIssueCode.ALIBI_CLUE_COLLISION);
    // detail reports the collision count — kills a detail-stub (empty-string) mutant.
    expect(result.issue?.detail).toContain('1');
    expect(result.issue?.detail.length).toBeGreaterThan(0);
    // Audit carries the shared clueId and the [first-owner, collider] pair, in order.
    expect(result.contradictions).toEqual([{ clueId: 'c1', suspects: ['s1', 's2'] }]);
  });

  it('skips suspects with a null breaking clueId (opaque / unbreakable not counted as collisions)', () => {
    // opaqueTriggerCase has s1 (c1), s2 (opaque → null), s3 (unbreakable → null): no collision.
    const result = checkClueCollision(parse(opaqueTriggerCase()));
    expect(result.issue).toBeNull();
    expect(result.contradictions).toEqual([]);
  });
});
