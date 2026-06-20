import { describe, it, expect } from 'vitest';
import { CaseFile, type Dossier } from '@ai-whodunit/shared';
import { classifyAlibis, survivingCandidates, breakingClueId } from './eliminate.js';
import {
  solvableCase,
  culpritUnreachableCase,
  opaqueTriggerCase,
  ambiguousCase,
  type RawCase,
} from '../tests/fixtures/cases.js';

/** Parse a RawCase to the branded CaseFile the helpers consume (every fixture here is parse-valid). */
function parse(raw: RawCase): CaseFile {
  const result = CaseFile.safeParse(raw);
  if (!result.success) {
    throw new Error('fixture expected to be parse-valid: ' + result.error.message);
  }
  return result.data;
}

describe('classifyAlibis', () => {
  it('a truthful clue-presented break → candidate; an absent breaksWhen → alibi-unbreakable', () => {
    const { candidates, eliminations } = classifyAlibis(parse(solvableCase()));
    // s1 breaks on truthful c1 → candidate; s2 & s3 have no breaksWhen → unbreakable.
    expect(candidates).toEqual(['s1']);
    expect(eliminations).toEqual([
      { suspectId: 's2', byClueId: null, reason: 'alibi-unbreakable' },
      { suspectId: 's3', byClueId: null, reason: 'alibi-unbreakable' },
    ]);
  });

  it('a misleading break-clue → eliminated break-clue-misleading carrying the cited clueId', () => {
    // culpritUnreachableCase flips c1 (s1’s break clue) to misleading.
    const { candidates, eliminations } = classifyAlibis(parse(culpritUnreachableCase()));
    expect(candidates).toEqual([]);
    // The audit row for s1 carries byClueId=c1 (NOT null) and the misleading reason.
    expect(eliminations).toContainEqual({
      suspectId: 's1',
      byClueId: 'c1',
      reason: 'break-clue-misleading',
    });
  });

  it('an opaque trigger (fact-confronted) → eliminated break-trigger-opaque, byClueId null', () => {
    // opaqueTriggerCase gives s2 a fact-confronted breaksWhen.
    const { eliminations } = classifyAlibis(parse(opaqueTriggerCase()));
    expect(eliminations).toContainEqual({
      suspectId: 's2',
      byClueId: null,
      reason: 'break-trigger-opaque',
    });
    // s2 must NOT be classified by clueId — proves the opaque branch is distinct from the
    // clue-presented branch (kills a kind-check drop mutant).
    expect(eliminations).not.toContainEqual(
      expect.objectContaining({ suspectId: 's2', reason: 'break-clue-misleading' }),
    );
  });

  it('two distinct truthful clue-presented breaks → two candidates', () => {
    const { candidates } = classifyAlibis(parse(ambiguousCase()));
    expect(candidates).toEqual(['s1', 's2']);
  });
});

describe('survivingCandidates', () => {
  it('returns exactly classifyAlibis(cf).candidates (the projection)', () => {
    const cf = parse(solvableCase());
    expect(survivingCandidates(cf)).toEqual(classifyAlibis(cf).candidates);
    expect(survivingCandidates(cf)).toEqual(['s1']);
  });

  it('reflects the ambiguous case (both survivors)', () => {
    const cf = parse(ambiguousCase());
    expect(survivingCandidates(cf)).toEqual(['s1', 's2']);
  });

  it('is empty when the only candidate is eliminated', () => {
    expect(survivingCandidates(parse(culpritUnreachableCase()))).toEqual([]);
  });
});

describe('breakingClueId', () => {
  /** Pull a suspect by id out of a parsed case (typed Dossier for the helper). */
  function suspect(raw: RawCase, id: string): Dossier {
    const found = parse(raw).suspects.find((s) => s.id === id);
    if (found === undefined) throw new Error('no suspect ' + id);
    return found;
  }

  it('returns the clueId for a clue-presented break', () => {
    expect(breakingClueId(suspect(solvableCase(), 's1'))).toBe('c1');
  });

  it('returns null for an opaque (fact-confronted) trigger', () => {
    expect(breakingClueId(suspect(opaqueTriggerCase(), 's2'))).toBeNull();
  });

  it('returns null when breaksWhen is absent (unbreakable alibi)', () => {
    expect(breakingClueId(suspect(solvableCase(), 's3'))).toBeNull();
  });
});
