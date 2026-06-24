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

  it('re-exports the generate-N CLI library wired to the real implementation', async () => {
    expect(typeof engine.generateN).toBe('function');
    expect(typeof engine.aggregateSolvability).toBe('function');
    expect(typeof engine.parseGenerateArgs).toBe('function');

    // parseGenerateArgs wired to the real parser, not a stub.
    expect(engine.parseGenerateArgs(['--n', '1'])).toEqual({
      ok: true,
      args: { n: 1, maxAttempts: 1 },
    });

    // generateN wired to the real loop → a real, solver-counted report.
    const report = await engine.generateN(
      { generate: () => Promise.resolve(solvableCase()) },
      { n: 1, maxAttempts: 1 },
    );
    expect(report.requested).toBe(1);
    expect(report.accepted).toBe(1);
    expect(report.solvabilityPct).toBe(100);

    // aggregateSolvability wired to the real counter.
    expect(engine.aggregateSolvability(report.outcomes, 1)).toBe(100);
  });
});
