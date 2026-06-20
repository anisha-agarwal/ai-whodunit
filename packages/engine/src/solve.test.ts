import { describe, it, expect } from 'vitest';
import type { CaseFile } from '@ai-whodunit/shared';
import { solveCase } from './solve.js';
import { SolverIssueCode } from './verdict.js';
import {
  solvableCase,
  culpritUnreachableCase,
  ambiguousCase,
  breakClueOffSolutionCase,
  clueCollisionCase,
  caseFileInvalidCase,
  multiErrorInvalidCase,
  type RawCase,
} from '../tests/fixtures/cases.js';

/** The fixtures are plain RawCase; solveCase re-parses, so the cast is purely structural. */
const solve = (c: RawCase) => solveCase(c as unknown as CaseFile);

describe('solveCase — public entry (total, deterministic)', () => {
  describe('ARM 1 — valid solvable + consistent', () => {
    const verdict = solve(solvableCase());

    it('returns solvable + consistent with the culprit as the sole candidate', () => {
      expect(verdict.solvable).toBe(true);
      expect(verdict.consistent).toBe(true);
      expect(verdict.culpritId).toBe('s1');
      expect(verdict.candidates).toEqual(['s1']);
    });

    it('raises NO issues (issues empty)', () => {
      expect(verdict.issues).toEqual([]);
    });

    it('eliminates every non-culprit as alibi-unbreakable (audit trail)', () => {
      expect(verdict.eliminations).toEqual([
        { suspectId: 's2', byClueId: null, reason: 'alibi-unbreakable' },
        { suspectId: 's3', byClueId: null, reason: 'alibi-unbreakable' },
      ]);
    });

    it('records no contradictions', () => {
      expect(verdict.contradictions).toEqual([]);
    });
  });

  describe('ARM 6 — invalid input is total (never throws)', () => {
    it('does not throw on an empty object', () => {
      expect(() => solveCase({} as unknown as CaseFile)).not.toThrow();
    });

    it('yields exactly CASE_FILE_INVALID with a non-solvable, non-consistent verdict', () => {
      const verdict = solve(caseFileInvalidCase());
      expect(verdict.issues.map((i) => i.code)).toEqual([SolverIssueCode.CASE_FILE_INVALID]);
      expect(verdict.solvable).toBe(false);
      expect(verdict.consistent).toBe(false);
      expect(verdict.culpritId).toBeNull();
      expect(verdict.candidates).toEqual([]);
      expect(verdict.eliminations).toEqual([]);
      expect(verdict.contradictions).toEqual([]);
    });

    it('carries the shared parse error detail (structural, not empty)', () => {
      const verdict = solve(caseFileInvalidCase());
      const issue = verdict.issues[0];
      expect(issue).toBeDefined();
      expect(issue?.detail.length).toBeGreaterThan(0);
    });

    it('joins MULTIPLE shared error messages with "; " in the detail', () => {
      // Two independent breaks → ≥2 shared messages, joined with '; '. Kills a join('') mutant.
      const verdict = solve(multiErrorInvalidCase());
      expect(verdict.issues.map((i) => i.code)).toEqual([SolverIssueCode.CASE_FILE_INVALID]);
      expect(verdict.issues[0]?.detail).toContain('; ');
    });
  });

  describe('assembly — culpritId / consistent / issues derivation', () => {
    it('culpritId is null when unsolvable even though the killer id exists in the file', () => {
      const verdict = solve(culpritUnreachableCase());
      expect(verdict.solvable).toBe(false);
      expect(verdict.culpritId).toBeNull();
      expect(verdict.issues.map((i) => i.code)).toEqual([SolverIssueCode.CULPRIT_NOT_REACHABLE]);
    });

    it('consistent is false (and culpritId still set) on an off-solution break clue while solvable stays true', () => {
      const verdict = solve(breakClueOffSolutionCase());
      // Solvable but NOT consistent — proves the two are independent derivations.
      expect(verdict.solvable).toBe(true);
      expect(verdict.consistent).toBe(false);
      expect(verdict.culpritId).toBe('s1');
      expect(verdict.issues.map((i) => i.code)).toEqual([
        SolverIssueCode.CULPRIT_BREAK_CLUE_OFF_SOLUTION,
      ]);
    });

    it('collects MULTIPLE issues when both solvability and consistency fail', () => {
      const verdict = solve(clueCollisionCase());
      const codes = verdict.issues.map((i) => i.code);
      expect(codes).toContain(SolverIssueCode.ALIBI_CLUE_COLLISION);
      expect(codes).toContain(SolverIssueCode.MULTIPLE_CANDIDATES_SURVIVE);
      expect(verdict.solvable).toBe(false);
      expect(verdict.consistent).toBe(false);
    });

    it('an ambiguous case is unsolvable but stays consistent', () => {
      const verdict = solve(ambiguousCase());
      expect(verdict.solvable).toBe(false);
      expect(verdict.consistent).toBe(true);
      expect(verdict.candidates).toEqual(['s1', 's2']);
    });
  });
});
