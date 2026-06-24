/**
 * Test-author-owned fixtures for the `generateN` CLI library tests (Phase 1, wd-unit-writer).
 *
 * Same discipline as `generate-scripts.ts`: the ONLY fake is the injected `GenerateFn` (the engine's
 * LLM seam). Every other collaborator is the REAL implementation — the real `CaseFile.safeParse`, the
 * real `solveCase`, the real `generateCase` loop, and the real `makeSolvableCase()` + its
 * one-mutation fail variants from `cases.ts`. No network, no engine mocks, no prose assertions.
 *
 * `generateN` calls `generateCase` once per case, and each `generateCase` call may invoke the
 * injected `GenerateFn` up to `maxAttempts` times. To make an N-case batch deterministic, each
 * fixture here builds a `GenerateFn` whose i-th INVOCATION resolves/rejects the recorded payload for
 * that step — flat-scripted so a whole batch is replayable. With `maxAttempts: 1` (the batches below
 * all use it) the k-th case consumes exactly the k-th script, so a batch of N scripts ⇒ N cases.
 */

import type { GenerateFn } from '../../src/generate/ports.js';
import type { GenerationRequest } from '../../src/generate/types.js';
import { resolves, rejects, type Script } from './generate-scripts.js';
import {
  solvableCase,
  culpritUnreachableCase,
  caseFileInvalidCase,
  type RawCase,
} from './cases.js';

export { resolves, rejects, type Script };
export { solvableCase, culpritUnreachableCase, caseFileInvalidCase, type RawCase };

/**
 * A flat-scripted `GenerateFn` for a batch: the k-th INVOCATION (1-based) runs `scripts[k-1]`.
 * Running past the end is a test-authoring bug (the production loop should never over-call) —
 * surfaced as an explicit throw, never a silent `undefined`. Mirrors `scriptedGenerate` but is named
 * for the batch-level (cross-`generateCase`) use these CLI tests need.
 */
export function batchGenerate(scripts: readonly Script[]): GenerateFn {
  let i = 0;
  return () => {
    const script = scripts[i];
    if (script === undefined) {
      throw new Error(
        `batchGenerate: no script for invocation #${i + 1} (only ${scripts.length} defined)`,
      );
    }
    i += 1;
    return script();
  };
}

/** An all-accept batch of size `n` — every case is solvable+consistent on its single attempt. */
export function acceptBatch(n: number): GenerateFn {
  return batchGenerate(Array.from({ length: n }, () => resolves(solvableCase())));
}

/** An always-rejecting batch of size `n` — every `GenerateFn` invocation rejects (transport fail). */
export function alwaysRejectBatch(n: number): GenerateFn {
  return batchGenerate(Array.from({ length: n }, () => rejects()));
}

/**
 * A recording `GenerateFn` that CAPTURES the `GenerationRequest` the loop hands it on each
 * invocation, then resolves a solvable case. The captured `requests` array lets a test assert what
 * actually reached the generation seam — specifically whether `request.seed` carries the supplied
 * seed (present) or is absent (no seed). This is the observable that proves `--seed` is load-bearing:
 * with nothing reading `request.seed`, the seed ternary in `generateN`/`generateCase` is unobservable
 * and its mutants survive.
 */
export function recordingGenerate(): {
  generate: GenerateFn;
  requests: GenerationRequest[];
} {
  const requests: GenerationRequest[] = [];
  const generate: GenerateFn = (request) => {
    requests.push(request);
    return Promise.resolve(solvableCase());
  };
  return { generate, requests };
}
