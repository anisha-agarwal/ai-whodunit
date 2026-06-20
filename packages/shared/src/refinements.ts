import { CaseIssueCode } from './errors.js';
import type { Dossier, Relationship } from './dossier.js';
import type { Clue } from './clue.js';
import type { SolutionGraph } from './solution-graph.js';
import type { Victim, Weapon, Location, TimeSlot } from './case-file.js';

/*
 * RESOLVED ZOD API (probed against the installed minor — see §9 Step 0):
 *   zod resolved to ^4.4.3 (`packages/shared/package.json` → `pnpm-lock.yaml`).
 *   Refinement form pinned for this minor:
 *     - `CaseFile.superRefine((value, ctx) => { ... })`  (present + functional on 4.4.3)
 *     - violations are raised via `ctx.addIssue({ code: 'custom', path, message })`
 *       — the resulting issue carries exactly `{ code:'custom', path, message }`.
 *   We carry the STABLE `CaseIssueCode` on the `message` field, and the offending element's
 *   location on `path`, so tests assert the specific code (never bare `success === false`).
 *
 * BRANCH-STRUCTURING RULE (plan §4): every helper is `collect violations → if (any) addIssue`,
 * so the pass-arm (silent) and fail-arm (fires) are both reachable. Compound checks (R5/R6/R10/R13)
 * are data-driven loops so each one-missing fail-arm is independently reachable. No defensive
 * guards over values Zod already narrowed.
 */

/**
 * The parsed `CaseFile` shape `checkCaseInvariants` operates on. Declared structurally (not by
 * importing `CaseFile` from `case-file.ts`) to avoid a value-level import cycle — `case-file.ts`
 * imports this function for its `.superRefine`, so this module imports only the leaf TYPES.
 */
export interface CaseFileShape {
  id: string;
  victim: Victim;
  weapons: [Weapon, ...Weapon[]];
  locations: [Location, ...Location[]];
  timeline: [TimeSlot, ...TimeSlot[]];
  suspects: [Dossier, ...Dossier[]];
  clues: Clue[];
  solution: SolutionGraph;
}

/**
 * The minimal slice of zod's `$RefinementCtx` this module needs. Declared structurally so
 * `refinements.ts` does not depend on the exact reachability of `z.core.$RefinementCtx` through the
 * public `z` namespace — it only ever calls `addIssue`. `CaseFile.superRefine` supplies a value
 * that satisfies this shape (its real ctx's `addIssue` accepts `{ code:'custom', path, message }`).
 */
export interface CaseRefinementCtx {
  addIssue(issue: { code: 'custom'; path: (string | number)[]; message: string }): void;
}

type Ctx = CaseRefinementCtx;

/** Raise one stable-coded issue at `path`. The code travels on `message`. */
function raise(ctx: Ctx, code: CaseIssueCode, path: (string | number)[]): void {
  ctx.addIssue({ code: 'custom', path, message: code });
}

/** ids of the values that appear more than once, in first-seen order. */
function findDuplicates(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const dups: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) {
      dups.push(id);
    } else {
      seen.add(id);
    }
  }
  return dups;
}

// ── R1: id uniqueness across each catalog ────────────────────────────────────
function checkIdUniqueness(cf: CaseFileShape, ctx: Ctx): void {
  const catalogs: { field: string; ids: string[]; code: CaseIssueCode }[] = [
    { field: 'suspects', ids: cf.suspects.map((s) => s.id), code: CaseIssueCode.DUP_SUSPECT_ID },
    { field: 'weapons', ids: cf.weapons.map((w) => w.id), code: CaseIssueCode.DUP_WEAPON_ID },
    { field: 'locations', ids: cf.locations.map((l) => l.id), code: CaseIssueCode.DUP_LOCATION_ID },
    { field: 'timeline', ids: cf.timeline.map((t) => t.id), code: CaseIssueCode.DUP_TIMESLOT_ID },
    { field: 'clues', ids: cf.clues.map((c) => c.id), code: CaseIssueCode.DUP_CLUE_ID },
  ];
  for (const cat of catalogs) {
    if (findDuplicates(cat.ids).length > 0) {
      raise(ctx, cat.code, [cat.field]);
    }
  }
}

// ── R2: exactly one culprit ───────────────────────────────────────────────────
function checkExactlyOneCulprit(cf: CaseFileShape, ctx: Ctx): void {
  const culprits = cf.suspects.filter((s) => s.role === 'culprit');
  if (culprits.length !== 1) {
    raise(ctx, CaseIssueCode.EXACTLY_ONE_CULPRIT, ['suspects']);
  }
}

// ── R3: isGuilty ⟺ role==='culprit', per suspect ─────────────────────────────
function checkGuiltRoleCoherent(cf: CaseFileShape, ctx: Ctx): void {
  const incoherent = cf.suspects.filter((s) => s.isGuilty !== (s.role === 'culprit'));
  if (incoherent.length > 0) {
    raise(ctx, CaseIssueCode.GUILT_ROLE_COHERENT, ['suspects']);
  }
}

// ── R4: victim is not also a suspect ──────────────────────────────────────────
function checkVictimNotSuspect(cf: CaseFileShape, ctx: Ctx): void {
  // `SuspectId` and `VictimId` are distinct brands (no compile-time overlap), but their underlying
  // strings CAN collide at runtime — that collision is exactly what R4 forbids. Compare as strings.
  const victimId: string = cf.victim.id;
  if (cf.suspects.some((s) => (s.id as string) === victimId)) {
    raise(ctx, CaseIssueCode.VICTIM_NOT_SUSPECT, ['victim', 'id']);
  }
}

// ── R5: solution.killer resolves + is the culprit ────────────────────────────
function checkKiller(cf: CaseFileShape, ctx: Ctx): void {
  const killer = cf.suspects.find((s) => s.id === cf.solution.killerId);
  if (killer === undefined) {
    raise(ctx, CaseIssueCode.KILLER_RESOLVES, ['solution', 'killerId']);
    return;
  }
  if (killer.role !== 'culprit') {
    raise(ctx, CaseIssueCode.KILLER_IS_CULPRIT, ['solution', 'killerId']);
  }
}

// ── R6: remaining solution refs resolve ──────────────────────────────────────
function checkSolutionRefs(cf: CaseFileShape, ctx: Ctx): void {
  // R6a is an equality (victim is a single declared object, not a catalog) — not `.some`.
  if (cf.solution.victimId !== cf.victim.id) {
    raise(ctx, CaseIssueCode.SOLUTION_VICTIM_MATCHES, ['solution', 'victimId']);
  }
  const refs: { value: string; pool: string[]; code: CaseIssueCode; key: string }[] = [
    {
      value: cf.solution.weaponId,
      pool: cf.weapons.map((w) => w.id),
      code: CaseIssueCode.SOLUTION_WEAPON_RESOLVES,
      key: 'weaponId',
    },
    {
      value: cf.solution.locationId,
      pool: cf.locations.map((l) => l.id),
      code: CaseIssueCode.SOLUTION_LOCATION_RESOLVES,
      key: 'locationId',
    },
    {
      value: cf.solution.timeSlotId,
      pool: cf.timeline.map((t) => t.id),
      code: CaseIssueCode.SOLUTION_TIMESLOT_RESOLVES,
      key: 'timeSlotId',
    },
  ];
  for (const ref of refs) {
    if (!ref.pool.includes(ref.value)) {
      raise(ctx, ref.code, ['solution', ref.key]);
    }
  }
}

// ── R7/R8/R9: three-tier knowledge coherence, per dossier ────────────────────
function checkKnowledge(cf: CaseFileShape, ctx: Ctx): void {
  cf.suspects.forEach((s, i) => {
    const knows = new Set(s.knowledge.knows);
    const knownFacts = new Set(s.knownFacts);

    // R7 — knows ∩ doesNotKnow === ∅
    if (s.knowledge.doesNotKnow.some((f) => knows.has(f))) {
      raise(ctx, CaseIssueCode.KNOWLEDGE_DISJOINT, ['suspects', i, 'knowledge']);
    }
    // R8 — knownFacts ⊆ knows
    if (s.knownFacts.some((f) => !knows.has(f))) {
      raise(ctx, CaseIssueCode.KNOWN_FACTS_SUBSET, ['suspects', i, 'knownFacts']);
    }
    // R9 — every secret fact ∈ knows ∧ ∉ knownFacts
    if (s.secrets.some((sec) => !knows.has(sec.fact) || knownFacts.has(sec.fact))) {
      raise(ctx, CaseIssueCode.SECRET_FACT_COHERENT, ['suspects', i, 'secrets']);
    }
  });
}

// ── R10: relationship edge integrity, per edge ───────────────────────────────
function checkRelationships(cf: CaseFileShape, ctx: Ctx): void {
  const people = new Set<string>([...cf.suspects.map((s) => s.id), cf.victim.id]);
  cf.suspects.forEach((s, i) => {
    s.relationships.forEach((rel: Relationship, j) => {
      // R10a — `to` resolves to a suspect or the victim
      if (!people.has(rel.to)) {
        raise(ctx, CaseIssueCode.RELATIONSHIP_TARGET_RESOLVES, ['suspects', i, 'relationships', j]);
      }
      // R10b — no self-edge
      if (rel.to === s.id) {
        raise(ctx, CaseIssueCode.RELATIONSHIP_NO_SELF_EDGE, ['suspects', i, 'relationships', j]);
      }
    });
  });
}

// ── R11/R12: trigger clue refs resolve ───────────────────────────────────────
function checkTriggerRefs(cf: CaseFileShape, ctx: Ctx): void {
  const clueIds = new Set(cf.clues.map((c) => c.id));
  cf.suspects.forEach((s, i) => {
    // R11 — every secret's `clue-presented` leakTrigger.clueId ∈ clues[]
    s.secrets.forEach((sec, j) => {
      if (sec.leakTrigger.kind === 'clue-presented' && !clueIds.has(sec.leakTrigger.clueId)) {
        raise(ctx, CaseIssueCode.SECRET_TRIGGER_RESOLVES, ['suspects', i, 'secrets', j]);
      }
    });
    // R12 — alibi.breaksWhen (when present + clue-presented) clueId ∈ clues[]
    const bw = s.alibi.breaksWhen;
    if (bw !== undefined && bw.kind === 'clue-presented' && !clueIds.has(bw.clueId)) {
      raise(ctx, CaseIssueCode.ALIBI_TRIGGER_RESOLVES, ['suspects', i, 'alibi', 'breaksWhen']);
    }
  });
}

// ── R13: clue.refersTo refs resolve, per present ref ─────────────────────────
function checkClueRefs(cf: CaseFileShape, ctx: Ctx): void {
  const suspectIds = new Set(cf.suspects.map((s) => s.id));
  const weaponIds = new Set(cf.weapons.map((w) => w.id));
  const locationIds = new Set(cf.locations.map((l) => l.id));
  const timeSlotIds = new Set(cf.timeline.map((t) => t.id));
  cf.clues.forEach((c, i) => {
    const ref = c.refersTo;
    if (ref === undefined) {
      return;
    }
    const checks: { value: string | undefined; pool: Set<string>; code: CaseIssueCode }[] = [
      { value: ref.suspectId, pool: suspectIds, code: CaseIssueCode.CLUE_REFS_SUSPECT_RESOLVES },
      { value: ref.weaponId, pool: weaponIds, code: CaseIssueCode.CLUE_REFS_WEAPON_RESOLVES },
      { value: ref.locationId, pool: locationIds, code: CaseIssueCode.CLUE_REFS_LOCATION_RESOLVES },
      { value: ref.timeSlotId, pool: timeSlotIds, code: CaseIssueCode.CLUE_REFS_TIMESLOT_RESOLVES },
    ];
    for (const chk of checks) {
      if (chk.value !== undefined && !chk.pool.has(chk.value)) {
        raise(ctx, chk.code, ['clues', i, 'refersTo']);
      }
    }
  });
}

// ── R14: ≥1 non-culprit suspect (a single-suspect case is unsolvable) ────────
function checkWitnessOrHerringPresent(cf: CaseFileShape, ctx: Ctx): void {
  if (!cf.suspects.some((s) => s.role !== 'culprit')) {
    raise(ctx, CaseIssueCode.WITNESS_OR_HERRING_PRESENT, ['suspects']);
  }
}

// ── R15: timeslot `order` values all distinct ────────────────────────────────
function checkTimeSlotOrderUnique(cf: CaseFileShape, ctx: Ctx): void {
  const orders = cf.timeline.map((t) => String(t.order));
  if (findDuplicates(orders).length > 0) {
    raise(ctx, CaseIssueCode.TIMESLOT_ORDER_UNIQUE, ['timeline']);
  }
}

// ── R16: the culprit's alibi must be breakable (`breaksWhen` present) ────────
function checkCulpritAlibiBreakable(cf: CaseFileShape, ctx: Ctx): void {
  const culprit = cf.suspects.find((s) => s.role === 'culprit');
  if (culprit !== undefined && culprit.alibi.breaksWhen === undefined) {
    raise(ctx, CaseIssueCode.CULPRIT_ALIBI_BREAKABLE, ['suspects']);
  }
}

/**
 * The full cross-entity integrity check, attached via `CaseFile.superRefine`. Runs every R1a–R16
 * invariant; each fires its stable `CaseIssueCode` on the `message` field of a `custom` issue.
 */
export function checkCaseInvariants(cf: CaseFileShape, ctx: Ctx): void {
  checkIdUniqueness(cf, ctx);
  checkExactlyOneCulprit(cf, ctx);
  checkGuiltRoleCoherent(cf, ctx);
  checkVictimNotSuspect(cf, ctx);
  checkKiller(cf, ctx);
  checkSolutionRefs(cf, ctx);
  checkKnowledge(cf, ctx);
  checkRelationships(cf, ctx);
  checkTriggerRefs(cf, ctx);
  checkClueRefs(cf, ctx);
  checkWitnessOrHerringPresent(cf, ctx);
  checkTimeSlotOrderUnique(cf, ctx);
  checkCulpritAlibiBreakable(cf, ctx);
}
