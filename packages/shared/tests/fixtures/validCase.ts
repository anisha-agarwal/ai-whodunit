/**
 * `makeValidCase(overrides?)` — the canonical fully-valid `CaseFile` every refinement/redaction test
 * starts from. Parsing it through `CaseFile` MUST succeed (drives the silent pass-arm of every
 * R1a–R16), and it carries **≥1 Trigger of every kind** (`clue-presented`, `fact-confronted`,
 * `contradiction-exposed`) so every positive Trigger branch in `checkTriggerRefs` is reachable.
 *
 * Shape invariants the fixture deliberately satisfies (so the valid case is genuinely silent):
 *  - R1: all catalog ids distinct.
 *  - R2: exactly one `role:'culprit'`.
 *  - R3: `isGuilty === (role === 'culprit')` for every suspect.
 *  - R4: victim id (`v1`) collides with no suspect id.
 *  - R5: `solution.killerId` resolves to the culprit suspect (`s1`).
 *  - R6: solution victim/weapon/location/timeSlot ids all resolve.
 *  - R7/R8/R9: per dossier `doesNotKnow ∩ knows = ∅`, `knownFacts ⊆ knows`, every `secret.fact ∈ knows \ knownFacts`.
 *  - R10: every `relationship.to` resolves to a suspect or the victim; no self-edge.
 *  - R11: every `clue-presented` secret leakTrigger.clueId resolves.
 *  - R12: the culprit's `alibi.breaksWhen` is a `clue-presented` whose clueId resolves.
 *  - R13: every present `clue.refersTo.*` ref resolves.
 *  - R14: ≥1 non-culprit suspect present (a witness AND a red-herring).
 *  - R15: every timeslot `order` distinct.
 *  - R16: the culprit's alibi carries `breaksWhen`.
 *
 * The returned object is a plain unbranded structure typed loosely so a test can mutate one field to
 * an invalid value without fighting the brand types. `CaseFile.safeParse` (or `parse`) re-derives the
 * brands. `overrides` is shallow-merged onto the top level (enough for the per-refinement mutate cases
 * in `tests/fixtures/mutate.ts`, which deep-clone then poke a nested field).
 */

// A structural mirror of `CaseFileShape` using plain strings — deliberately not branded so tests can
// assign arbitrary values when constructing a one-field-invalid case.
export interface RawCaseFile {
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

/** A structured-clone helper that preserves the shape (no branded objects, so JSON clone is safe). */
function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function baseCase(): RawCaseFile {
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
      {
        id: 'c1',
        statement: 'A candlestick was missing from the library.',
        reliability: 'truthful',
        refersTo: { weaponId: 'w1', locationId: 'l1' },
      },
      {
        id: 'c2',
        statement: 'A revolver was found in the conservatory.',
        reliability: 'misleading',
        refersTo: { suspectId: 's2', timeSlotId: 't2' },
      },
      {
        id: 'c3',
        statement: 'A torn letter, unattributed.',
        reliability: 'truthful',
        // no refersTo — exercises the early-continue arm of checkClueRefs in the valid case.
      },
    ],
    suspects: [
      // s1 — the culprit. Alibi is breakable (R16) via a resolving clue-presented trigger (R12).
      {
        id: 's1',
        publicPersona: 'the brooding heir',
        knownFacts: ['was at the manor that night'],
        secrets: [
          {
            fact: 'owed the victim a fortune',
            leakTrigger: { kind: 'clue-presented', clueId: 'c1' }, // R11 resolves
            ifLeaked: 'admits the debt, voice shaking',
          },
        ],
        alibi: {
          claim: 'I was in the conservatory all evening',
          truth: 'was in the library at the time of death',
          breaksWhen: { kind: 'clue-presented', clueId: 'c1' }, // R12 resolves; R16 present
        },
        relationships: [{ to: 'v1', kind: 'creditor', descriptor: 'owed the victim money' }],
        knowledge: {
          knows: ['was at the manor that night', 'owed the victim a fortune'],
          doesNotKnow: ['who found the body'],
        },
        isGuilty: true,
        role: 'culprit',
      },
      // s2 — a red herring. Carries a `fact-confronted` secret trigger (Trigger-kind coverage).
      {
        id: 's2',
        publicPersona: 'the nervous secretary',
        knownFacts: ['heard a gunshot'],
        secrets: [
          {
            fact: 'forged a signature last spring',
            leakTrigger: { kind: 'fact-confronted', fact: 'the forged ledger' }, // not cross-checked
            ifLeaked: 'denies, then crumbles',
          },
        ],
        alibi: {
          claim: 'I was filing papers',
          truth: 'was filing papers',
          // no breaksWhen — unbreakable alibi; exercises the absent-arm of checkTriggerRefs(R12).
        },
        relationships: [{ to: 's1', kind: 'employer', descriptor: 'works for the heir' }],
        knowledge: {
          knows: ['heard a gunshot', 'forged a signature last spring'],
          doesNotKnow: ['where the weapon went'],
        },
        isGuilty: false,
        role: 'red-herring',
      },
      // s3 — a witness. Carries a `contradiction-exposed` secret trigger (Trigger-kind coverage).
      {
        id: 's3',
        publicPersona: 'the loyal gardener',
        knownFacts: ['saw a light in the library'],
        secrets: [
          {
            fact: 'was outside the window at 8pm',
            leakTrigger: { kind: 'contradiction-exposed' }, // no payload
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

/** Returns a fresh, deeply-cloned valid case, with `overrides` shallow-merged onto the top level. */
export function makeValidCase(overrides: Partial<RawCaseFile> = {}): RawCaseFile {
  return { ...clone(baseCase()), ...overrides };
}
