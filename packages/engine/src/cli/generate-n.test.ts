import { describe, it, expect } from 'vitest';
import { generateN, aggregateSolvability } from './generate-n.js';
import { GenerationFailureReason } from '../generate/types.js';
import type { CaseOutcome } from './types.js';
import {
  batchGenerate,
  acceptBatch,
  alwaysRejectBatch,
  recordingGenerate,
  resolves,
  rejects,
  solvableCase,
  culpritUnreachableCase,
  caseFileInvalidCase,
} from '../../tests/fixtures/generate-n.js';

/**
 * `generateN` + `aggregateSolvability` — the pure generate-N CLI library.
 *
 * Every test exercises the REAL implementation: the real `generateCase` loop, the real
 * `CaseFile.safeParse`, the real `solveCase`, and the real `makeSolvableCase()` + one-mutation
 * fixtures. The ONLY fake is the injected `GenerateFn` (a flat-recorded script — no network).
 *
 * Ground-truth codes (pinned from a live `solveCase`/`safeParse` run, NOT re-stated literals):
 *   - solvableCase()         → accepted, culpritId 's1'
 *   - culpritUnreachableCase → reject  NEVER_SOLVABLE,    lastIssues ['CULPRIT_NOT_REACHABLE']
 *   - caseFileInvalidCase    → reject  PARSE_NEVER_VALID, lastIssues ['CULPRIT_ALIBI_BREAKABLE']
 *   - rejects()              → reject  GENERATE_FN_REJECTED, lastIssues ['GENERATE_FN_REJECTED']
 *   - maxAttempts 0          → reject  NO_ATTEMPTS, attempts 0 (GenerateFn never called)
 */

const ALL_REASONS = Object.values(GenerationFailureReason);

describe('generateN — drives generateCase N times', () => {
  it('returns exactly N CaseOutcomes for an all-accept batch (loop bound)', async () => {
    const report = await generateN(
      { generate: acceptBatch(3) },
      { n: 3, maxAttempts: 1 },
    );

    // A loop-bound mutant (off-by-one / wrong count) dies on the exact length.
    expect(report.outcomes).toHaveLength(3);
    expect(report.requested).toBe(3);
    expect(report.accepted).toBe(3);
    expect(report.solvable).toBe(3);
    expect(report.solvabilityPct).toBe(100);
    // Every accepted outcome carries the solver's ground-truth culprit, projected down.
    for (const outcome of report.outcomes) {
      expect(outcome.accepted).toBe(true);
      expect(outcome.culpritId).toBe('s1');
      expect(outcome.failureReason).toBeNull();
      expect(outcome.lastIssues).toEqual([]);
    }
  });

  it('runs zero cases for n=0 — empty outcomes, 0% solvability, no throw', async () => {
    const report = await generateN({ generate: acceptBatch(0) }, { n: 0, maxAttempts: 1 });
    expect(report.outcomes).toHaveLength(0);
    expect(report.requested).toBe(0);
    expect(report.accepted).toBe(0);
    expect(report.solvabilityPct).toBe(0);
  });

  it('forwards --seed all the way to the GenerateFn request seam when present', async () => {
    // The load-bearing assertion: the supplied seed must actually REACH the GenerateFn's
    // GenerationRequest. A recording fake captures every request; we assert request.seed === the seed.
    // This is what kills the seed ternary mutants (true?/false?/===) in generateN AND generateCase —
    // without observing request.seed, `{maxAttempts,seed}` and `{maxAttempts}` are indistinguishable.
    const { generate, requests } = recordingGenerate();
    const report = await generateN({ generate }, { n: 2, maxAttempts: 1, seed: 'manor-night' });

    expect(report.accepted).toBe(2);
    // One request per case (maxAttempts:1, each accepted on first attempt).
    expect(requests).toHaveLength(2);
    for (const request of requests) {
      // The EXACT seed reached the seam — a dropped/garbled forward (or a flipped seed ternary that
      // strips the field) fails this. Pins the seed value, not just presence.
      expect(request.seed).toBe('manor-night');
    }
  });

  it('omits seed from the GenerateFn request when --seed is absent (property truly absent)', async () => {
    // The no-seed arm: request.seed must be ABSENT (undefined), never a stray empty string or a
    // leaked prior seed. exactOptionalPropertyTypes means the field is left off the request object.
    const { generate, requests } = recordingGenerate();
    const report = await generateN({ generate }, { n: 1, maxAttempts: 1 });

    expect(report.accepted).toBe(1);
    expect(requests).toHaveLength(1);
    const request = requests[0];
    expect(request).toBeDefined();
    if (!request) throw new Error('unreachable');
    // Absent, not present-with-undefined — distinguishes the `false ?`/`true ?` seed mutants.
    expect(request.seed).toBeUndefined();
    expect('seed' in request).toBe(false);
  });
});

describe('generateN — solvability numerator (the key mutation-probe)', () => {
  it('counts the SOLVABLE verdict, not raw acceptance, on a MIXED batch', async () => {
    // 2 accept + 1 unsolvable + 1 parse-invalid = 4 requested, 2 accepted/solvable.
    const report = await generateN(
      {
        generate: batchGenerate([
          resolves(solvableCase()),
          resolves(culpritUnreachableCase()),
          resolves(solvableCase()),
          resolves(caseFileInvalidCase()),
        ]),
      },
      { n: 4, maxAttempts: 1 },
    );

    expect(report.requested).toBe(4);
    expect(report.accepted).toBe(2);
    expect(report.solvable).toBe(2);
    // 2 / 4 × 100 = 50 — a numerator-swap (e.g. requested instead of solvable) dies here.
    expect(report.solvabilityPct).toBe(50);
  });

  it('aggregateSolvability counts only accepted outcomes — an accepted-but-not-solvable cell must NOT count', () => {
    // Synthetic outcomes: 1 accepted, plus a non-accepted outcome that (hypothetically) leaked a
    // culpritId. Only `accepted` may drive the numerator, never the presence of a culpritId.
    const outcomes: CaseOutcome[] = [
      { accepted: true, attempts: 1, culpritId: null, failureReason: null, lastIssues: [] },
      {
        accepted: false,
        attempts: 1,
        culpritId: null,
        failureReason: GenerationFailureReason.NEVER_SOLVABLE,
        lastIssues: ['CULPRIT_NOT_REACHABLE'],
      },
    ];
    // 1 accepted / 4 requested × 100 = 25 — pins the .accepted filter AND the requested denominator.
    expect(aggregateSolvability(outcomes, 4)).toBe(25);
  });

  it('aggregateSolvability returns 0 for requested <= 0 (no division by zero)', () => {
    expect(aggregateSolvability([], 0)).toBe(0);
    // Defensive: a negative requested also short-circuits to 0, never NaN/Infinity.
    expect(
      aggregateSolvability(
        [{ accepted: true, attempts: 1, culpritId: null, failureReason: null, lastIssues: [] }],
        -1,
      ),
    ).toBe(0);
  });
});

describe('generateN — failuresByReason histogram over the FULL member set', () => {
  it('initialises every GenerationFailureReason bucket to 0 (no dropped bucket)', async () => {
    const report = await generateN({ generate: acceptBatch(1) }, { n: 1, maxAttempts: 1 });

    // Every member of the union is a key, all 0 on an all-accept batch — a dropped bucket dies here.
    expect(Object.keys(report.failuresByReason).sort()).toEqual([...ALL_REASONS].sort());
    for (const reason of ALL_REASONS) {
      expect(report.failuresByReason[reason]).toBe(0);
    }
  });

  it('increments the SPECIFIC reason bucket for each reject (mixed batch incl. NO_ATTEMPTS)', async () => {
    // 1 unsolvable + 1 parse-invalid + 1 reject across three n=1 batches, plus a NO_ATTEMPTS batch.
    const mixed = await generateN(
      {
        generate: batchGenerate([
          resolves(culpritUnreachableCase()), // → NEVER_SOLVABLE
          resolves(caseFileInvalidCase()), // → PARSE_NEVER_VALID
          rejects(), // → GENERATE_FN_REJECTED
        ]),
      },
      { n: 3, maxAttempts: 1 },
    );

    expect(mixed.failuresByReason).toEqual({
      [GenerationFailureReason.NEVER_CONSISTENT]: 0,
      [GenerationFailureReason.NEVER_SOLVABLE]: 1,
      [GenerationFailureReason.PARSE_NEVER_VALID]: 1,
      [GenerationFailureReason.GENERATE_FN_REJECTED]: 1,
      [GenerationFailureReason.NO_ATTEMPTS]: 0,
    });

    // maxAttempts:0 ⇒ NO_ATTEMPTS, the GenerateFn is never called — proves that bucket is reachable.
    const noAttempts = await generateN({ generate: acceptBatch(0) }, { n: 2, maxAttempts: 0 });
    expect(noAttempts.failuresByReason[GenerationFailureReason.NO_ATTEMPTS]).toBe(2);
    expect(noAttempts.accepted).toBe(0);
    expect(noAttempts.solvabilityPct).toBe(0);
  });

  it('records the projected reject codes on each failed outcome (culpritId null, stable lastIssues)', async () => {
    const report = await generateN(
      { generate: batchGenerate([resolves(culpritUnreachableCase())]) },
      { n: 1, maxAttempts: 1 },
    );

    const outcome = report.outcomes[0];
    expect(outcome).toBeDefined();
    if (!outcome) throw new Error('unreachable');
    expect(outcome.accepted).toBe(false);
    expect(outcome.culpritId).toBeNull();
    expect(outcome.failureReason).toBe(GenerationFailureReason.NEVER_SOLVABLE);
    // Stable solver code, not prose.
    expect(outcome.lastIssues).toEqual(['CULPRIT_NOT_REACHABLE']);
  });
});

describe('generateN — server-authoritative projection', () => {
  it('CaseOutcome carries ONLY codes/ids/numbers — never the caseFile/dossier/secret/isGuilty', async () => {
    const report = await generateN({ generate: acceptBatch(1) }, { n: 1, maxAttempts: 1 });
    const outcome = report.outcomes[0];
    expect(outcome).toBeDefined();
    if (!outcome) throw new Error('unreachable');

    // Exact key set — a mutant that threads result.caseFile into the outcome adds a key here and dies.
    expect(Object.keys(outcome).sort()).toEqual(
      ['accepted', 'attempts', 'culpritId', 'failureReason', 'lastIssues'].sort(),
    );
    // No server-only field leaked, at the outcome OR report level.
    for (const banned of ['caseFile', 'dossier', 'secret', 'secrets', 'isGuilty', 'solution']) {
      expect(outcome).not.toHaveProperty(banned);
      expect(report).not.toHaveProperty(banned);
    }
    // The full report is JSON-serialisable with no ground-truth substring (defensive scan).
    const json = JSON.stringify(report);
    expect(json).not.toContain('isGuilty');
    expect(json).not.toContain('solution');
    expect(json).not.toContain('candlestick'); // a weapon label from the caseFile
  });
});

describe('generateN — total (never throws)', () => {
  it('an always-rejecting batch never throws → accepted 0, solvabilityPct 0, all rejects bucketed', async () => {
    let report!: Awaited<ReturnType<typeof generateN>>;
    await expect(
      (async () => {
        report = await generateN({ generate: alwaysRejectBatch(3) }, { n: 3, maxAttempts: 1 });
      })(),
    ).resolves.toBeUndefined();

    expect(report.requested).toBe(3);
    expect(report.accepted).toBe(0);
    expect(report.solvable).toBe(0);
    expect(report.solvabilityPct).toBe(0);
    expect(report.failuresByReason[GenerationFailureReason.GENERATE_FN_REJECTED]).toBe(3);
    for (const outcome of report.outcomes) {
      expect(outcome.accepted).toBe(false);
      expect(outcome.lastIssues).toEqual(['GENERATE_FN_REJECTED']);
    }
  });
});
