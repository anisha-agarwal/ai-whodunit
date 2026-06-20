import { describe, it, expect } from 'vitest';
import type { CaseFile } from '@ai-whodunit/shared';
import * as engine from './index.js';
import { solvableCase } from '../tests/fixtures/cases.js';

/**
 * Barrel smoke — proves the public entry + the stable issue codes are re-exported and wired to the
 * real implementation (not a stub). `index.ts` is coverage-excluded (pure re-export); this asserts
 * the surface another package would import resolves and runs.
 */
describe('@ai-whodunit/engine barrel', () => {
  it('re-exports solveCase wired to the real solver', () => {
    expect(typeof engine.solveCase).toBe('function');
    const verdict = engine.solveCase(solvableCase() as unknown as CaseFile);
    expect(verdict.solvable).toBe(true);
    expect(verdict.culpritId).toBe('s1');
  });

  it('re-exports the SolverIssueCode const-object', () => {
    expect(engine.SolverIssueCode.CASE_FILE_INVALID).toBe('CASE_FILE_INVALID');
  });
});
