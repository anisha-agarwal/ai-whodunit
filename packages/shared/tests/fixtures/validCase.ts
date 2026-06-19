/**
 * Test fixtures for @ai-whodunit/shared.
 *
 * `makeValidCase()` returns a freshly-constructed, fully-valid CaseFile input that
 * satisfies every refinement R1a–R16. Each call returns a brand-new deep object
 * (no shared references), so a test may mutate the result freely to craft a fail arm.
 *
 * Coverage notes (handoff §"Valid fixture requirements"):
 *   - ≥2 suspects, exactly 1 culprit, ≥1 non-culprit (R2/R14)
 *   - all three Trigger variants are reachable: clue-presented (culprit alibi.breaksWhen),
 *     fact-confronted + contradiction-exposed (culprit secrets)
 *   - culprit alibi.breaksWhen present (R16); witness alibi has no breaksWhen
 *   - knowledge sets satisfy three-tier semantics (R7–R9)
 */
import type { z } from 'zod';

import { CaseFile } from '../../src/case-file.js';
import type { CaseIssueCode } from '../../src/errors.js';
import { checkCaseInvariants } from '../../src/refinements.js';

export type CaseInput = z.input<typeof CaseFile>;

export function makeValidCase(): CaseInput {
  return {
    id: 'case-vale-manor',
    victim: { id: 'victim-1', name: 'Lord Edmund Vale' },
    weapons: [
      { id: 'weapon-dagger', label: 'Ornate Dagger' },
      { id: 'weapon-poison', label: 'Arsenic Vial' },
    ],
    locations: [
      { id: 'loc-library', label: 'The Library' },
      { id: 'loc-study', label: 'The Study' },
    ],
    timeline: [
      { id: 'ts-evening', label: 'Early Evening', order: 0 },
      { id: 'ts-midnight', label: 'Midnight', order: 1 },
    ],
    clues: [
      {
        id: 'clue-bloodstain',
        statement: 'A bloodstain was found near the hearth.',
        reliability: 'truthful',
        refersTo: {
          suspectId: 'suspect-rourke',
          weaponId: 'weapon-dagger',
          locationId: 'loc-library',
          timeSlotId: 'ts-evening',
        },
      },
      {
        // No refersTo — exercises the redactClue "no refersTo" arm and the
        // R13 `refersTo === undefined` skip branch.
        id: 'clue-letter',
        statement: 'A torn letter hints at a debt.',
        reliability: 'misleading',
      },
    ],
    suspects: [
      {
        id: 'suspect-rourke',
        publicPersona: 'A gruff estate creditor.',
        knownFacts: ['rourke-was-at-the-manor'],
        secrets: [
          {
            fact: 'rourke-owns-the-dagger',
            leakTrigger: { kind: 'fact-confronted', fact: 'you owned the dagger' },
            ifLeaked: 'Rourke admits the dagger is his.',
          },
          {
            fact: 'rourke-lied-about-time',
            leakTrigger: { kind: 'contradiction-exposed' },
            ifLeaked: 'Rourke concedes the timeline does not add up.',
          },
        ],
        alibi: {
          claim: 'I was in the study all evening.',
          truth: 'Rourke was in the library at the time of death.',
          breaksWhen: { kind: 'clue-presented', clueId: 'clue-bloodstain' },
        },
        relationships: [
          { to: 'victim-1', kind: 'creditor', descriptor: 'Was owed money by the victim.' },
        ],
        knowledge: {
          knows: ['rourke-was-at-the-manor', 'rourke-owns-the-dagger', 'rourke-lied-about-time'],
          doesNotKnow: ['who-sent-the-letter'],
        },
        isGuilty: true,
        role: 'culprit',
      },
      {
        id: 'suspect-vane',
        publicPersona: 'A nervous house guest.',
        knownFacts: ['vane-heard-an-argument'],
        secrets: [],
        alibi: {
          claim: 'I was asleep in the east wing.',
          truth: 'Vane was indeed asleep in the east wing.',
        },
        relationships: [
          { to: 'suspect-rourke', kind: 'rival', descriptor: 'Distrusts Rourke deeply.' },
        ],
        knowledge: {
          knows: ['vane-heard-an-argument'],
          doesNotKnow: [],
        },
        isGuilty: false,
        role: 'witness',
      },
    ],
    solution: {
      victimId: 'victim-1',
      killerId: 'suspect-rourke',
      weaponId: 'weapon-dagger',
      locationId: 'loc-library',
      timeSlotId: 'ts-evening',
    },
  };
}

/** Deep-clones the valid case so a test can mutate one field for a fail arm. */
export function cloneValidCase(): CaseInput {
  return structuredClone(makeValidCase());
}

/**
 * Parses `raw` through the real CaseFile schema (including the superRefine wiring in
 * case-file.ts) and returns the list of emitted `CaseIssueCode`s. An empty array means
 * a clean parse. Issue codes are carried in `issue.message` per refinements.ts:addIssue.
 */
export function caseCodes(raw: unknown): CaseIssueCode[] {
  const result = CaseFile.safeParse(raw);
  if (result.success) return [];
  return result.error.issues.map((i) => i.message as CaseIssueCode);
}

/** A single emitted refinement issue: its stable code plus the path it points at. */
export interface CaseIssue {
  code: CaseIssueCode;
  path: (string | number)[];
}

/**
 * Parses `raw` and returns the full list of emitted issues (code + path). Asserting the
 * path — not just the code — makes a mutated `addIssue([...])` path a killable mutant.
 */
export function caseIssues(raw: unknown): CaseIssue[] {
  const result = CaseFile.safeParse(raw);
  if (result.success) return [];
  return result.error.issues.map((i) => ({ code: i.message as CaseIssueCode, path: [...i.path] as (string | number)[] }));
}

type RawCaseFile = Parameters<typeof checkCaseInvariants>[0];

/**
 * Runs the real `checkCaseInvariants` against an arbitrary (possibly degenerate /
 * sparse) raw value, bypassing the zod object parse, and returns the emitted codes.
 * Used to reach the defensive `=== undefined` branches that a parsed (dense) value
 * cannot produce.
 */
export function invariantCodes(raw: RawCaseFile): CaseIssueCode[] {
  const codes: CaseIssueCode[] = [];
  const ctx = {
    addIssue: (issue: { message?: string }) => {
      if (issue.message !== undefined) codes.push(issue.message as CaseIssueCode);
    },
  } as unknown as z.RefinementCtx;
  checkCaseInvariants(raw, ctx);
  return codes;
}
