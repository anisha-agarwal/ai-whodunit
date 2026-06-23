/**
 * Local, hand-authored case fixtures for the `@ai-whodunit/engine` solver tests.
 *
 * We deliberately do NOT import shared's `makeValidCase` — it lives in
 * `packages/shared/tests/fixtures/validCase.ts`, is not barrel-exported, and is therefore not
 * cross-package resolvable. The engine owns a LOCAL `RawCase` + `makeSolvableCase(overrides?)`
 * builder mirroring shared's `RawCaseFile` + shallow-`overrides` + deep-poke pattern.
 *
 * `makeSolvableCase()` is a canonical case that is BOTH parse-valid (satisfies shared's R1a–R16)
 * AND solvable+consistent under the solver's added preconditions:
 *   - exactly one suspect (`s1`, the culprit) breaks on a truthful, resolvable `clue-presented` clue;
 *   - every other suspect is unbreakable (`breaksWhen` absent);
 *   - the culprit's break-clue (`c1`) `refersTo` agrees with the solution on every present field;
 *   - no two suspects break on the same clueId.
 *
 * Each fail-fixture below is ONE mutation off `makeSolvableCase()`, mapped 1:1 to the plan's
 * §0c arms. The returned objects are plain (unbranded) — `CaseFile.safeParse` re-derives the
 * brands inside `solveCase`. The helper fixtures cast through the parsed type ONLY where a test
 * calls a sub-helper directly with structurally-shaped input.
 */

// A plain (unbranded) structural mirror of the parsed CaseFile — lets a test poke one field to an
// arbitrary value without fighting the brand types. `CaseFile.safeParse` re-derives the brands.
export interface RawTrigger {
  kind: 'clue-presented' | 'fact-confronted' | 'contradiction-exposed';
  clueId?: string;
  fact?: string;
}

export interface RawDossier {
  id: string;
  publicPersona: string;
  knownFacts: string[];
  secrets: { fact: string; leakTrigger: RawTrigger; ifLeaked: string }[];
  alibi: { claim: string; truth: string; breaksWhen?: RawTrigger };
  relationships: { to: string; kind: string; descriptor: string }[];
  knowledge: { knows: string[]; doesNotKnow: string[] };
  isGuilty: boolean;
  role: 'culprit' | 'red-herring' | 'witness';
}

export interface RawClue {
  id: string;
  statement: string;
  reliability: 'truthful' | 'misleading';
  refersTo?: {
    suspectId?: string;
    weaponId?: string;
    locationId?: string;
    timeSlotId?: string;
  };
}

export interface RawCase {
  id: string;
  victim: { id: string; name: string };
  weapons: { id: string; label: string }[];
  locations: { id: string; label: string }[];
  timeline: { id: string; label: string; order: number }[];
  suspects: RawDossier[];
  clues: RawClue[];
  solution: {
    victimId: string;
    killerId: string;
    weaponId: string;
    locationId: string;
    timeSlotId: string;
  };
}

/** Structured-clone that preserves shape (no branded objects → JSON clone is safe). */
export function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function baseCase(): RawCase {
  return {
    id: 'case-1',
    victim: { id: 'v1', name: 'Lord Ashcombe' },
    weapons: [
      { id: 'w1', label: 'candlestick' },
      { id: 'w2', label: 'revolver' },
    ],
    locations: [
      { id: 'l1', label: 'library' },
      { id: 'l2', label: 'conservatory' },
    ],
    timeline: [
      { id: 't1', label: '8pm', order: 0 },
      { id: 't2', label: '9pm', order: 1 },
    ],
    clues: [
      // c1 — the culprit's TRUTHFUL break-clue. Every present refersTo field AGREES with the
      // solution (suspectId=s1=killer, weaponId=w1, locationId=l1, timeSlotId=t1).
      {
        id: 'c1',
        statement: 'A candlestick was missing from the library.',
        reliability: 'truthful',
        refersTo: { suspectId: 's1', weaponId: 'w1', locationId: 'l1', timeSlotId: 't1' },
      },
      // c2 — a misleading clue, used by the off-arm fixtures.
      {
        id: 'c2',
        statement: 'A revolver was found in the conservatory.',
        reliability: 'misleading',
        refersTo: { suspectId: 's2', timeSlotId: 't2' },
      },
      // c3 — a second TRUTHFUL clue with no refersTo, used by the ambiguous fixture.
      {
        id: 'c3',
        statement: 'A torn letter, unattributed.',
        reliability: 'truthful',
      },
    ],
    suspects: [
      // s1 — the culprit. Breaks on truthful clue-presented c1 (R12/R16). Sole survivor.
      {
        id: 's1',
        publicPersona: 'the brooding heir',
        knownFacts: ['was at the manor that night'],
        secrets: [
          {
            fact: 'owed the victim a fortune',
            leakTrigger: { kind: 'clue-presented', clueId: 'c1' },
            ifLeaked: 'admits the debt, voice shaking',
          },
        ],
        alibi: {
          claim: 'I was in the conservatory all evening',
          truth: 'was in the library at the time of death',
          breaksWhen: { kind: 'clue-presented', clueId: 'c1' },
        },
        relationships: [{ to: 'v1', kind: 'creditor', descriptor: 'owed the victim money' }],
        knowledge: {
          knows: ['was at the manor that night', 'owed the victim a fortune'],
          doesNotKnow: ['who found the body'],
        },
        isGuilty: true,
        role: 'culprit',
      },
      // s2 — a red herring. Unbreakable alibi (no breaksWhen) → eliminated alibi-unbreakable.
      {
        id: 's2',
        publicPersona: 'the nervous secretary',
        knownFacts: ['heard a gunshot'],
        secrets: [
          {
            fact: 'forged a signature last spring',
            leakTrigger: { kind: 'fact-confronted', fact: 'the forged ledger' },
            ifLeaked: 'denies, then crumbles',
          },
        ],
        alibi: {
          claim: 'I was filing papers',
          truth: 'was filing papers',
        },
        relationships: [{ to: 's1', kind: 'employer', descriptor: 'works for the heir' }],
        knowledge: {
          knows: ['heard a gunshot', 'forged a signature last spring'],
          doesNotKnow: ['where the weapon went'],
        },
        isGuilty: false,
        role: 'red-herring',
      },
      // s3 — a witness. Unbreakable alibi → eliminated alibi-unbreakable.
      {
        id: 's3',
        publicPersona: 'the loyal gardener',
        knownFacts: ['saw a light in the library'],
        secrets: [
          {
            fact: 'was outside the window at 8pm',
            leakTrigger: { kind: 'contradiction-exposed' },
            ifLeaked: 'reluctantly places himself near the scene',
          },
        ],
        alibi: {
          claim: 'I was tending the roses',
          truth: 'was tending the roses',
        },
        relationships: [{ to: 'v1', kind: 'employer', descriptor: 'employed by the victim' }],
        knowledge: {
          knows: ['saw a light in the library', 'was outside the window at 8pm'],
          doesNotKnow: ['who fired the shot'],
        },
        isGuilty: false,
        role: 'witness',
      },
    ],
    solution: {
      victimId: 'v1',
      killerId: 's1',
      weaponId: 'w1',
      locationId: 'l1',
      timeSlotId: 't1',
    },
  };
}

/** Fresh deeply-cloned solvable+consistent case, `overrides` shallow-merged onto the top level. */
export function makeSolvableCase(overrides: Partial<RawCase> = {}): RawCase {
  return { ...clone(baseCase()), ...overrides };
}

// ── ARM 1 ───────────────────────────────────────────────────────────────────
/** Parse-valid, solvable + consistent. Sole survivor = culprit s1. */
export function solvableCase(): RawCase {
  return makeSolvableCase();
}

// ── ARM 2 / break-clue-misleading ─────────────────────────────────────────────
/**
 * The culprit's break-clue (c1) is flipped to `misleading`, so s1 is eliminated
 * (`break-clue-misleading`) and `killerId ∉ S` → CULPRIT_NOT_REACHABLE. Still parse-valid
 * (reliability is a free enum; R12 only checks the clueId resolves).
 */
export function culpritUnreachableCase(): RawCase {
  const c = makeSolvableCase();
  const c1 = c.clues.find((x) => x.id === 'c1');
  if (c1) c1.reliability = 'misleading';
  return c;
}

// ── ARM 2b / break-trigger-opaque ─────────────────────────────────────────────
/**
 * A NON-culprit (s2) is given a `fact-confronted` breaksWhen (opaque, non-clue-keyed) →
 * eliminated `break-trigger-opaque`. The culprit is untouched, so the case stays solvable.
 */
export function opaqueTriggerCase(): RawCase {
  const c = makeSolvableCase();
  const s2 = c.suspects.find((x) => x.id === 's2');
  if (s2) s2.alibi.breaksWhen = { kind: 'fact-confronted', fact: 'a forged ledger' };
  return c;
}

// ── ARM 3 ───────────────────────────────────────────────────────────────────
/**
 * A red-herring (s2) is given a DISTINCT truthful clue-presented break (c3) → a SECOND survivor.
 * killerId ∈ S but |S| = 2 → MULTIPLE_CANDIDATES_SURVIVE. Distinct clueId (c3 ≠ c1) so this is
 * ambiguity, NOT a clue collision.
 */
export function ambiguousCase(): RawCase {
  const c = makeSolvableCase();
  const s2 = c.suspects.find((x) => x.id === 's2');
  if (s2) s2.alibi.breaksWhen = { kind: 'clue-presented', clueId: 'c3' };
  return c;
}

// ── ARM 4 ───────────────────────────────────────────────────────────────────
/**
 * The culprit's break-clue (c1) `refersTo.locationId` is pointed at a REAL non-solution location
 * (l2, the conservatory; solution is l1). R13 passes (l2 resolves to the catalog) but the solver's
 * placement check fails → CULPRIT_BREAK_CLUE_OFF_SOLUTION. Still solvable (s1 still the sole
 * survivor) — this is purely a consistency failure.
 */
export function breakClueOffSolutionCase(): RawCase {
  const c = makeSolvableCase();
  const c1 = c.clues.find((x) => x.id === 'c1');
  if (c1 && c1.refersTo) c1.refersTo.locationId = 'l2';
  return c;
}

// ── ARM 5 ───────────────────────────────────────────────────────────────────
/**
 * A red-herring (s2) breaks on the SAME clueId as the culprit (c1) → two alibis share a breaking
 * clue → ALIBI_CLUE_COLLISION. (s2 also becomes a second survivor, but the collision audit is the
 * asserted behaviour here.)
 */
export function clueCollisionCase(): RawCase {
  const c = makeSolvableCase();
  const s2 = c.suspects.find((x) => x.id === 's2');
  if (s2) s2.alibi.breaksWhen = { kind: 'clue-presented', clueId: 'c1' };
  return c;
}

// ── consistency mutation-probe fixtures (kill find/guard mutants in checkCulpritBreakClue) ──

/**
 * The culprit (s1) breaks on c3 (the SECOND truthful clue), and c3.refersTo AGREES with the
 * solution — while c1 (the FIRST clue) carries an OFF-solution refersTo. A `clue.find(() => true)`
 * mutant would pick c1 and spuriously flag a mismatch; correct code picks c3 → null. Kills the
 * `c.id === clueId` → `true` mutant on the clue lookup.
 */
export function breakClueNotFirstCase(): RawCase {
  const c = makeSolvableCase();
  // c1 stays first but is pointed off-solution (it is NOT the culprit's break clue any more).
  const c1 = c.clues.find((x) => x.id === 'c1');
  if (c1 && c1.refersTo) c1.refersTo.locationId = 'l2';
  // c3 becomes the culprit's break clue, with a refersTo that AGREES with the solution.
  const c3 = c.clues.find((x) => x.id === 'c3');
  if (c3) c3.refersTo = { suspectId: 's1', locationId: 'l1' };
  const s1 = c.suspects.find((x) => x.id === 's1');
  if (s1) {
    s1.alibi.breaksWhen = { kind: 'clue-presented', clueId: 'c3' };
    if (s1.secrets[0]) s1.secrets[0].leakTrigger = { kind: 'clue-presented', clueId: 'c3' };
  }
  return c;
}

/**
 * The culprit's break clue (c1) carries a PARTIAL refersTo: only the agreeing fields are present;
 * the others are absent (undefined). Correct code skips the undefined fields → null. A mutant that
 * drops the `m.value !== undefined` guard treats an absent field as a mismatch → spurious issue.
 * Kills the `m.value !== undefined && …` → `true && …` mutant.
 */
export function partialRefMatchingCase(): RawCase {
  const c = makeSolvableCase();
  const c1 = c.clues.find((x) => x.id === 'c1');
  // Only locationId present (and it AGREES with solution l1); the other three fields undefined.
  if (c1) c1.refersTo = { locationId: 'l1' };
  return c;
}

// ── ARM 6 ───────────────────────────────────────────────────────────────────
/**
 * The CULPRIT's `breaksWhen` is deleted → trips shared R16 (CULPRIT_ALIBI_BREAKABLE) → safeParse
 * FAILS. Proves `solveCase` is total over invalid input (CASE_FILE_INVALID, never throws).
 */
export function caseFileInvalidCase(): RawCase {
  const c = makeSolvableCase();
  const s1 = c.suspects.find((x) => x.id === 's1');
  if (s1) delete s1.alibi.breaksWhen;
  return c;
}

/**
 * A direct-helper probe for the `clueId === null` early-return guard in `checkCulpritBreakClue`.
 *
 * The culprit (s1) breaks on an OPAQUE trigger → `breakingClueId(culprit) === null`. The catalog
 * ALSO carries a degenerate clue whose `id` is literally `null` with an OFF-solution `refersTo`.
 * With the guard intact, the function short-circuits to `null` before the clue lookup. A mutant
 * that drops the guard would run the clue lookup with `clueId === null`, MATCH the null-id
 * clue, and spuriously raise CULPRIT_BREAK_CLUE_OFF_SOLUTION. This shape is intentionally NOT
 * parse-valid (a clue id is never null after `safeParse`) — it is fed directly to the helper.
 */
export function nullClueIdGuardCase(): RawCase {
  const c = makeSolvableCase();
  const s1 = c.suspects.find((x) => x.id === 's1');
  if (s1) s1.alibi.breaksWhen = { kind: 'contradiction-exposed' };
  // A degenerate clue whose id is literally null and whose refersTo disagrees with the solution.
  (
    c.clues as { id: string | null; statement: string; reliability: string; refersTo?: unknown }[]
  ).push({
    id: null,
    statement: 'degenerate',
    reliability: 'truthful',
    refersTo: { locationId: 'l2' },
  });
  return c;
}

/**
 * Parse-INVALID with MULTIPLE independent structural breaks (empty weapons catalog + culprit
 * breaksWhen deleted) → shared emits ≥2 issue messages. `solveCase` joins them with `'; '`, so the
 * detail must contain that separator — kills a `join('')` mutant.
 */
export function multiErrorInvalidCase(): RawCase {
  const c = makeSolvableCase();
  c.weapons = [];
  const s1 = c.suspects.find((x) => x.id === 's1');
  if (s1) delete s1.alibi.breaksWhen;
  return c;
}
