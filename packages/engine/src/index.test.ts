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

  it('re-exports the case generator surface wired to the real loop', async () => {
    expect(typeof engine.generateCase).toBe('function');
    expect(typeof engine.regenerateHint).toBe('function');
    expect(typeof engine.caseGenerationSystemPrompt).toBe('string');
    expect(typeof engine.caseGenerationFormat).toBe('object');
    expect(engine.GenerationFailureReason.NO_ATTEMPTS).toBe('NO_ATTEMPTS');
    expect(engine.GENERATE_FN_REJECTED).toBe('GENERATE_FN_REJECTED');

    // Wired to the real loop + real safeParse + real solveCase, not a stub.
    const result = await engine.generateCase(
      { generate: () => Promise.resolve(solvableCase()) },
      { maxAttempts: 1 },
    );
    expect(result.ok).toBe(true);
  });
});
