import { describe, it, expect } from 'vitest';
import { CaseFile, type SuspectId } from '@ai-whodunit/shared';
import { proveCulpritReachable, proveSolvable } from './solvability.js';
import { survivingCandidates } from './eliminate.js';
import { SolverIssueCode } from './verdict.js';
import {
  solvableCase,
  culpritUnreachableCase,
  ambiguousCase,
  type RawCase,
} from '../tests/fixtures/cases.js';

function parse(raw: RawCase): CaseFile {
  const result = CaseFile.safeParse(raw);
  if (!result.success) throw new Error('expected parse-valid: ' + result.error.message);
  return result.data;
}

const ids = (...xs: string[]) => xs as unknown as SuspectId[];

describe('proveCulpritReachable', () => {
  it('returns null when killerId ∈ candidates (the pass-arm)', () => {
    const cf = parse(solvableCase());
    expect(proveCulpritReachable(cf, ids('s1'))).toBeNull();
  });

  it('returns CULPRIT_NOT_REACHABLE when killerId ∉ candidates', () => {
    const cf = parse(solvableCase());
    const issue = proveCulpritReachable(cf, ids('s2'));
    expect(issue?.code).toBe(SolverIssueCode.CULPRIT_NOT_REACHABLE);
    // detail names the missing killer id — kills a detail-stub mutant.
    expect(issue?.detail).toContain('s1');
  });

  it('reports unreachable on the real misleading-break fixture (empty candidate set)', () => {
    const cf = parse(culpritUnreachableCase());
    const issue = proveCulpritReachable(cf, survivingCandidates(cf));
    expect(issue?.code).toBe(SolverIssueCode.CULPRIT_NOT_REACHABLE);
  });
});

describe('proveSolvable', () => {
  it('returns null when the culprit is the SOLE survivor (solvable)', () => {
    const cf = parse(solvableCase());
    expect(proveSolvable(cf, ids('s1'))).toBeNull();
  });

  it('returns CULPRIT_NOT_REACHABLE when the culprit is not reachable (delegates)', () => {
    const cf = parse(solvableCase());
    expect(proveSolvable(cf, ids('s2'))?.code).toBe(SolverIssueCode.CULPRIT_NOT_REACHABLE);
  });

  it('returns MULTIPLE_CANDIDATES_SURVIVE when the culprit is reachable but |S| > 1', () => {
    const cf = parse(ambiguousCase());
    const issue = proveSolvable(cf, survivingCandidates(cf));
    expect(issue?.code).toBe(SolverIssueCode.MULTIPLE_CANDIDATES_SURVIVE);
    // detail reports the survivor count — kills a count-stub mutant.
    expect(issue?.detail).toContain('2');
  });

  it('does NOT fire MULTIPLE_CANDIDATES_SURVIVE for the sole-survivor boundary (|S| === 1)', () => {
    // Boundary probe: exactly one candidate must NOT trip the > 1 guard (kills a >=1 mutant).
    const cf = parse(solvableCase());
    expect(proveSolvable(cf, ids('s1'))).toBeNull();
  });
});
