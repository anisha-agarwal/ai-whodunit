/**
 * Test-author-owned fixtures for the `generateCase` loop tests (the test_author step of #20).
 *
 * The ONLY fake in these tests is the injected `GenerateFn` (that IS the engine's LLM seam). Every
 * other collaborator is the REAL implementation: the real `CaseFile.safeParse`, the real
 * `solveCase`, and the real `makeSolvableCase()` + its one-mutation fail variants from `cases.ts`.
 * No network, no mocks of the engine, no prose assertions.
 *
 * A scripted `GenerateFn` is a tiny array-of-thunks driver: `let i = 0; return scripts[i++]()`.
 * Each script is a thunk that either RESOLVES a raw `CaseFile`-shaped object (a plain `RawCase` —
 * the loop re-`safeParse`s, so an unbranded object is the correct payload) or REJECTS (the
 * transport-reject path). Deterministic and replayable: the Nth call runs the Nth script.
 */

import { vi } from 'vitest';
import type { GenerateFn } from '../../src/generate/ports.js';
import {
  solvableCase,
  caseFileInvalidCase,
  culpritUnreachableCase,
  breakClueOffSolutionCase,
  type RawCase,
} from './cases.js';

/** A single scripted attempt: resolve a raw payload, or reject (transport failure). */
export type Script = () => Promise<unknown>;

/** Resolve the given raw case object on this attempt. */
export function resolves(raw: RawCase): Script {
  return () => Promise.resolve(raw);
}

/** Reject on this attempt (the injected `GenerateFn` itself fails — the recoverable reject path). */
export function rejects(reason = new Error('transport failed')): Script {
  return () => Promise.reject(reason);
}

/**
 * Build a scripted `GenerateFn` from an ordered list of thunks. Call N runs `scripts[N-1]`. Running
 * past the end is a test-authoring bug, not a production path — surfaced as an explicit throw rather
 * than a silent `undefined`.
 */
export function scriptedGenerate(scripts: readonly Script[]): GenerateFn {
  let i = 0;
  return () => {
    const script = scripts[i];
    if (script === undefined) {
      throw new Error(
        `scriptedGenerate: no script for call #${i + 1} (only ${scripts.length} defined)`,
      );
    }
    i += 1;
    return script();
  };
}

/**
 * A `vi.fn()` spy whose body would resolve a solvable case IF called — used by the zero-attempt
 * rows to assert the `GenerateFn` is NEVER invoked when `maxAttempts < 1`. The spy lets a test
 * assert the call count; the resolved payload is incidental (it must never be reached).
 */
export function spyGenerate(): GenerateFn {
  return vi.fn(() => Promise.resolve(solvableCase()));
}

// ── Ready-made fail-variant payloads (one mutation off `makeSolvableCase`, via `cases.ts`) ────────

/** A raw payload that FAILS `CaseFile.safeParse` (culprit `breaksWhen` deleted → CULPRIT_ALIBI_BREAKABLE). */
export const parseInvalidPayload = caseFileInvalidCase;

/** A raw payload that parses but is UNSOLVABLE (culprit break-clue misleading → CULPRIT_NOT_REACHABLE). */
export const unsolvablePayload = culpritUnreachableCase;

/** A raw payload that parses + is solvable but INCONSISTENT (break-clue off-solution → CULPRIT_BREAK_CLUE_OFF_SOLUTION). */
export const inconsistentPayload = breakClueOffSolutionCase;

/** A raw payload that parses + is solvable + consistent (the accepted case). */
export const acceptedPayload = solvableCase;
