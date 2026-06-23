import { describe, it, expect } from 'vitest';
import type { CaseFile } from '@ai-whodunit/shared';
import { solveCase } from './solve.js';
import { SolverIssueCode } from './verdict.js';
import {
  solvableCase,
  culpritUnreachableCase,
  opaqueTriggerCase,
  ambiguousCase,
  breakClueOffSolutionCase,
  clueCollisionCase,
  caseFileInvalidCase,
  type RawCase,
} from '../tests/fixtures/cases.js';

const ALL_FIXTURES: { name: string; make: () => RawCase }[] = [
  { name: 'solvableCase', make: solvableCase },
  { name: 'culpritUnreachableCase', make: culpritUnreachableCase },
  { name: 'opaqueTriggerCase', make: opaqueTriggerCase },
  { name: 'ambiguousCase', make: ambiguousCase },
  { name: 'breakClueOffSolutionCase', make: breakClueOffSolutionCase },
  { name: 'clueCollisionCase', make: clueCollisionCase },
  { name: 'caseFileInvalidCase', make: caseFileInvalidCase },
];

describe('SolverVerdict invariant: issues empty ⟺ solvable && consistent', () => {
  for (const { name, make } of ALL_FIXTURES) {
    it(`holds for ${name}`, () => {
      const v = solveCase(make() as unknown as CaseFile);
      const empty = v.issues.length === 0;
      // The biconditional, asserted in BOTH directions across every reachable verdict shape.
      expect(empty).toBe(v.solvable && v.consistent);
    });
  }

  it('the empty-issues / both-true fixtures are exactly the solvable+consistent ones', () => {
    // Both solvableCase and opaqueTriggerCase are solvable+consistent (in the latter, only a
    // NON-culprit gets an opaque trigger, so the culprit stays the sole survivor) — every other
    // fixture carries at least one issue. Pinning the set kills a mutant that drops an issue push.
    const greens = ALL_FIXTURES.filter(({ make }) => {
      const v = solveCase(make() as unknown as CaseFile);
      return v.issues.length === 0;
    });
    expect(greens.map((g) => g.name)).toEqual(['solvableCase', 'opaqueTriggerCase']);
  });

  it('culpritId is non-null exactly when solvable', () => {
    for (const { make } of ALL_FIXTURES) {
      const v = solveCase(make() as unknown as CaseFile);
      expect(v.culpritId !== null).toBe(v.solvable);
    }
  });
});

describe('SolverIssueCode — stable const-object of the 5 reachable codes', () => {
  it('carries exactly the five reachable codes, each self-keyed', () => {
    expect(SolverIssueCode).toEqual({
      CASE_FILE_INVALID: 'CASE_FILE_INVALID',
      CULPRIT_NOT_REACHABLE: 'CULPRIT_NOT_REACHABLE',
      MULTIPLE_CANDIDATES_SURVIVE: 'MULTIPLE_CANDIDATES_SURVIVE',
      CULPRIT_BREAK_CLUE_OFF_SOLUTION: 'CULPRIT_BREAK_CLUE_OFF_SOLUTION',
      ALIBI_CLUE_COLLISION: 'ALIBI_CLUE_COLLISION',
    });
  });

  it('omits the structurally-unreachable Option-A codes', () => {
    expect(SolverIssueCode).not.toHaveProperty('NO_CANDIDATE_SURVIVES');
    expect(SolverIssueCode).not.toHaveProperty('SURVIVOR_NOT_CULPRIT');
  });
});
