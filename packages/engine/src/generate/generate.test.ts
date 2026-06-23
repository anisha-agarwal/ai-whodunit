import { describe, it, expect, vi } from 'vitest';
import { generateCase } from './generate.js';
import { GenerationFailureReason, GENERATE_FN_REJECTED } from './types.js';
import {
  scriptedGenerate,
  spyGenerate,
  resolves,
  rejects,
  parseInvalidPayload,
  unsolvablePayload,
  inconsistentPayload,
  acceptedPayload,
} from '../../tests/fixtures/generate-scripts.js';

/**
 * `generateCase` — the bounded generate → parse-gate → solve-gate → regenerate loop.
 *
 * Every test exercises the REAL implementation: the real `CaseFile.safeParse`, the real `solveCase`,
 * and the real `makeSolvableCase()`/one-mutation fixtures. The ONLY fake is the injected
 * `GenerateFn` (the engine's LLM seam). Assertions pin structure + closed-world wiring +
 * schema-validity + the correct loop branch + STABLE codes — never an LLM prose string, never
 * `alibi.truth`/`claim`/`secret.ifLeaked`.
 *
 * The exact stable codes each fixture drives are pinned from a live `solveCase`/`safeParse` run:
 *   - parse-invalid  → ['CULPRIT_ALIBI_BREAKABLE']            (CaseIssueCode, on safeParse failure)
 *   - unsolvable     → solvable:false, ['CULPRIT_NOT_REACHABLE']        (SolverIssueCode)
 *   - inconsistent   → solvable:true consistent:false, ['CULPRIT_BREAK_CLUE_OFF_SOLUTION']
 */
describe('generateCase — happy path', () => {
  it('accepts a solvable+consistent case on attempt 1 → {ok:true, attempts:1}, empty verdict.issues', async () => {
    const result = await generateCase(
      { generate: scriptedGenerate([resolves(acceptedPayload())]) },
      { maxAttempts: 3 },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.attempts).toBe(1);
    // Real solver ground truth, not a re-stated literal: the accepted case is provably solvable.
    expect(result.verdict.solvable).toBe(true);
    expect(result.verdict.consistent).toBe(true);
    expect(result.verdict.issues).toEqual([]);
    expect(result.verdict.culpritId).toBe('s1');
    // The accepted CaseFile is schema-valid (it round-tripped the real safeParse gate) and carries
    // the full server-only truth (solution graph) — engine has no wire surface.
    expect(result.caseFile.solution.killerId).toBe('s1');
    expect(result.caseFile.suspects).toHaveLength(3);
  });
});

describe('generateCase — StoreFn sink', () => {
  it('calls store exactly once on accept, with the accepted CaseFile + verdict', async () => {
    const store = vi.fn();
    const result = await generateCase(
      { generate: scriptedGenerate([resolves(acceptedPayload())]), store },
      { maxAttempts: 3 },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(store).toHaveBeenCalledTimes(1);
    // Wired with the SAME objects the result carries (closed-world wiring, not a re-stated literal).
    expect(store).toHaveBeenCalledWith(result.caseFile, result.verdict);
  });

  it('never calls store on exhaustion (no accept)', async () => {
    const store = vi.fn();
    const result = await generateCase(
      { generate: scriptedGenerate([resolves(unsolvablePayload())]), store },
      { maxAttempts: 1 },
    );

    expect(result.ok).toBe(false);
    expect(store).not.toHaveBeenCalled();
  });

  it('succeeds with no store provided (default identity) — no throw', async () => {
    const result = await generateCase(
      { generate: scriptedGenerate([resolves(acceptedPayload())]) },
      { maxAttempts: 3 },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.attempts).toBe(1);
  });
});

describe('generateCase — regenerate (recover on a later attempt)', () => {
  it('PARSE: attempt 1 parse-invalid → attempt 2 valid → {ok:true, attempts:2}; attempt 2 sees the CaseIssueCode hint', async () => {
    const seenPriorIssues: (readonly string[])[] = [];
    const base = scriptedGenerate([resolves(parseInvalidPayload()), resolves(acceptedPayload())]);
    const generate = (req: Parameters<typeof base>[0]) => {
      seenPriorIssues.push(req.priorIssues);
      return base(req);
    };

    const result = await generateCase({ generate }, { maxAttempts: 3 });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.attempts).toBe(2);
    // Hint threading: attempt 1 gets []; attempt 2 carries the shared CaseIssueCode from the parse fail.
    expect(seenPriorIssues[0]).toEqual([]);
    expect(seenPriorIssues[1]).toEqual(['CULPRIT_ALIBI_BREAKABLE']);
  });

  it('SOLVE: attempt 1 unsolvable → attempt 2 valid → {ok:true, attempts:2}; attempt 2 sees the SolverIssueCode hint', async () => {
    const seenPriorIssues: (readonly string[])[] = [];
    const base = scriptedGenerate([resolves(unsolvablePayload()), resolves(acceptedPayload())]);
    const generate = (req: Parameters<typeof base>[0]) => {
      seenPriorIssues.push(req.priorIssues);
      return base(req);
    };

    const result = await generateCase({ generate }, { maxAttempts: 3 });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.attempts).toBe(2);
    expect(seenPriorIssues[0]).toEqual([]);
    expect(seenPriorIssues[1]).toEqual(['CULPRIT_NOT_REACHABLE']);
  });
});

describe('generateCase — homogeneous exhaustion', () => {
  it('every attempt parse-invalid → {ok:false, PARSE_NEVER_VALID, attempts:maxAttempts, lastIssues:[CaseIssueCode]}', async () => {
    const result = await generateCase(
      {
        generate: scriptedGenerate([
          resolves(parseInvalidPayload()),
          resolves(parseInvalidPayload()),
        ]),
      },
      { maxAttempts: 2 },
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.reason).toBe(GenerationFailureReason.PARSE_NEVER_VALID);
    expect(result.attempts).toBe(2);
    expect(result.lastIssues).toEqual(['CULPRIT_ALIBI_BREAKABLE']);
  });

  it('every attempt parse-valid never solvable → {ok:false, NEVER_SOLVABLE, lastIssues:[CULPRIT_NOT_REACHABLE]}', async () => {
    const result = await generateCase(
      {
        generate: scriptedGenerate([resolves(unsolvablePayload()), resolves(unsolvablePayload())]),
      },
      { maxAttempts: 2 },
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.reason).toBe(GenerationFailureReason.NEVER_SOLVABLE);
    expect(result.lastIssues).toEqual(['CULPRIT_NOT_REACHABLE']);
  });

  it('solvable but never consistent → {ok:false, NEVER_CONSISTENT, lastIssues:[CULPRIT_BREAK_CLUE_OFF_SOLUTION]}', async () => {
    const result = await generateCase(
      {
        generate: scriptedGenerate([
          resolves(inconsistentPayload()),
          resolves(inconsistentPayload()),
        ]),
      },
      { maxAttempts: 2 },
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.reason).toBe(GenerationFailureReason.NEVER_CONSISTENT);
    expect(result.lastIssues).toEqual(['CULPRIT_BREAK_CLUE_OFF_SOLUTION']);
  });
});

describe('generateCase — heterogeneous exhaustion (aggregate reason, last-attempt lastIssues)', () => {
  // These two rows are observably distinct from a LAST-ATTEMPT classifier ONLY because their
  // histories mix signals. They are the rows that kill a last-attempt-classifier mutant.
  it('unsolvable → solvable-but-inconsistent → unsolvable → NEVER_CONSISTENT (aggregate), lastIssues from FINAL attempt', async () => {
    const result = await generateCase(
      {
        generate: scriptedGenerate([
          resolves(unsolvablePayload()), // sawParse + (not solvable)
          resolves(inconsistentPayload()), // sawSolvable (solvable, not consistent)
          resolves(unsolvablePayload()), // final attempt: unsolvable
        ]),
      },
      { maxAttempts: 3 },
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    // Aggregate: it WAS solvable once → NEVER_CONSISTENT (a last-attempt classifier would say NEVER_SOLVABLE).
    expect(result.reason).toBe(GenerationFailureReason.NEVER_CONSISTENT);
    // lastIssues from the FINAL attempt (unsolvable), which diverges from the aggregate reason.
    expect(result.lastIssues).toEqual(['CULPRIT_NOT_REACHABLE']);
  });

  it('parse-invalid → parse-valid-unsolvable → parse-invalid → NEVER_SOLVABLE (aggregate), lastIssues from FINAL attempt', async () => {
    const result = await generateCase(
      {
        generate: scriptedGenerate([
          resolves(parseInvalidPayload()), // sawParseFail
          resolves(unsolvablePayload()), // sawParse (parsed, not solvable)
          resolves(parseInvalidPayload()), // final attempt: parse fail
        ]),
      },
      { maxAttempts: 3 },
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    // Aggregate: it DID parse once → NEVER_SOLVABLE (a last-attempt classifier would say PARSE_NEVER_VALID).
    expect(result.reason).toBe(GenerationFailureReason.NEVER_SOLVABLE);
    // lastIssues from the FINAL attempt (parse fail), NOT a mid-history attempt.
    expect(result.lastIssues).toEqual(['CULPRIT_ALIBI_BREAKABLE']);
  });
});

describe('generateCase — reject-mixed exhaustion (real signal outranks transport reject)', () => {
  // The reject branch is LOWEST priority. These rows are observably distinct from a reject-FIRST
  // ladder ONLY because their histories mix a reject with a real solve/consistency signal.
  it('reject → unsolvable → reject → NEVER_SOLVABLE (real solve signal outranks reject), lastIssues:[GENERATE_FN_REJECTED]', async () => {
    const result = await generateCase(
      {
        generate: scriptedGenerate([
          rejects(),
          resolves(unsolvablePayload()), // sawParse, not solvable
          rejects(), // final attempt: reject
        ]),
      },
      { maxAttempts: 3 },
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    // A reject-FIRST ladder would mis-code this GENERATE_FN_REJECTED; the real parse signal wins.
    expect(result.reason).toBe(GenerationFailureReason.NEVER_SOLVABLE);
    // lastIssues from the FINAL attempt (a reject) → the sentinel.
    expect(result.lastIssues).toEqual([GENERATE_FN_REJECTED]);
  });

  it('reject → solvable-but-inconsistent → reject → NEVER_CONSISTENT, lastIssues:[GENERATE_FN_REJECTED]', async () => {
    const result = await generateCase(
      {
        generate: scriptedGenerate([
          rejects(),
          resolves(inconsistentPayload()), // sawSolvable, not consistent
          rejects(), // final attempt: reject
        ]),
      },
      { maxAttempts: 3 },
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.reason).toBe(GenerationFailureReason.NEVER_CONSISTENT);
    expect(result.lastIssues).toEqual([GENERATE_FN_REJECTED]);
  });
});

describe('generateCase — all-reject exhaustion', () => {
  it('every attempt rejects → {ok:false, GENERATE_FN_REJECTED, attempts:maxAttempts, lastIssues:[GENERATE_FN_REJECTED]}; no throw', async () => {
    const result = await generateCase(
      { generate: scriptedGenerate([rejects(), rejects(), rejects()]) },
      { maxAttempts: 3 },
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    // No safeParse ever ran → PARSE_NEVER_VALID would be a lie. Reject IS the sole signal here.
    expect(result.reason).toBe(GenerationFailureReason.GENERATE_FN_REJECTED);
    expect(result.attempts).toBe(3);
    expect(result.lastIssues).toEqual([GENERATE_FN_REJECTED]);
  });
});

describe('generateCase — reject is recoverable', () => {
  it('reject on attempt 1 then solvable on attempt 2 → {ok:true, attempts:2}; attempt 2 sees [GENERATE_FN_REJECTED]; no throw escapes', async () => {
    const seenPriorIssues: (readonly string[])[] = [];
    const base = scriptedGenerate([rejects(), resolves(acceptedPayload())]);
    const generate = (req: Parameters<typeof base>[0]) => {
      seenPriorIssues.push(req.priorIssues);
      return base(req);
    };

    const result = await generateCase({ generate }, { maxAttempts: 3 });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.attempts).toBe(2);
    expect(seenPriorIssues[0]).toEqual([]);
    expect(seenPriorIssues[1]).toEqual([GENERATE_FN_REJECTED]);
  });
});

describe('generateCase — attempt bounds', () => {
  it('maxAttempts:1 → exactly one attempt, correct terminal', async () => {
    const generate = vi.fn(() => Promise.resolve(unsolvablePayload()));
    const result = await generateCase({ generate }, { maxAttempts: 1 });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.attempts).toBe(1);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(result.reason).toBe(GenerationFailureReason.NEVER_SOLVABLE);
  });

  it('maxAttempts:0 → ZERO attempts, NO_ATTEMPTS, GenerateFn NEVER called', async () => {
    const generate = spyGenerate();
    const result = await generateCase({ generate }, { maxAttempts: 0 });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.reason).toBe(GenerationFailureReason.NO_ATTEMPTS);
    expect(result.attempts).toBe(0);
    expect(result.lastIssues).toEqual([]);
    expect(generate).not.toHaveBeenCalled();
  });

  it('maxAttempts:-1 → ZERO attempts, NO_ATTEMPTS, GenerateFn NEVER called (below-min boundary)', async () => {
    const generate = spyGenerate();
    const result = await generateCase({ generate }, { maxAttempts: -1 });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.reason).toBe(GenerationFailureReason.NO_ATTEMPTS);
    expect(result.attempts).toBe(0);
    expect(generate).not.toHaveBeenCalled();
  });
});
