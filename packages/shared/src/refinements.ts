/**
 * checkCaseInvariants — all cross-entity CaseFile refinements (R1a–R16).
 *
 * Zod superRefine API note (pinned against zod ^4):
 *   ctx.addIssue({ code: z.ZodIssueCode.custom, path: [...], message: '...' })
 *   z.ZodIssueCode.custom === 'custom'
 *
 * Loop structuring: all iteration over input arrays uses .forEach() so Stryker cannot
 * generate loop-bound mutants (i < length → i <= length). forEach callback parameters
 * are the actual element type (not T | undefined under noUncheckedIndexedAccess), so no
 * defensive guards are needed for normal (zod-parsed, dense) input.
 *
 * Branch-structuring rule: every helper uses collect-violations → if (any) addIssue,
 * so both the "all-present/silent" arm and the "one-missing/fires" arm are independently
 * reachable by the test fixtures.
 */
import { z } from 'zod';

import type { Dossier } from './dossier.js';
import type { Clue } from './clue.js';
import type { SolutionGraph } from './solution-graph.js';
import type { VictimId, WeaponId, LocationId, TimeSlotId, ClueId } from './ids.js';
import { CaseIssueCode } from './errors.js';

// ---------------------------------------------------------------------------
// Local shape of the raw CaseFile value — mirrors case-file.ts without importing it
// (avoids a circular runtime dependency; kept in sync with the z.object there).
// ---------------------------------------------------------------------------
type RawCatalogItem<Id> = { id: Id; label?: string; name?: string; order?: number };

type RawCaseFile = {
  id: string;
  victim: { id: VictimId; name: string };
  weapons: Array<RawCatalogItem<WeaponId>>;
  locations: Array<RawCatalogItem<LocationId>>;
  timeline: Array<{ id: TimeSlotId; label: string; order: number }>;
  suspects: Array<Dossier>;
  clues: Array<Clue>;
  solution: SolutionGraph;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addIssue(ctx: z.RefinementCtx, code: CaseIssueCode, path: (string | number)[]): void {
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    path,
    message: code,
  });
}

/** Collect duplicate ids from an array; return paths of duplicates. */
function findDuplicateIds<T extends { id: string }>(
  items: T[],
  prefix: string,
): Array<[string, number]> {
  const seen = new Set<string>();
  const dupes: Array<[string, number]> = [];
  items.forEach((item, i) => {
    if (seen.has(item.id)) {
      dupes.push([prefix, i]);
    } else {
      seen.add(item.id);
    }
  });
  return dupes;
}

function buildIdSet<T extends { id: string }>(items: T[]): Set<string> {
  return new Set(items.map((x) => x.id));
}

// ---------------------------------------------------------------------------
// checkCaseInvariants — attached via CaseFile.superRefine
// ---------------------------------------------------------------------------

export function checkCaseInvariants(val: RawCaseFile, ctx: z.RefinementCtx): void {
  const suspectIds = buildIdSet(val.suspects);
  const weaponIds = buildIdSet(val.weapons);
  const locationIds = buildIdSet(val.locations);
  const timeSlotIds = buildIdSet(val.timeline);
  const clueIds = buildIdSet(val.clues);

  // -------------------------------------------------------------------------
  // R1a–R1e: uniqueness of catalog ids
  // -------------------------------------------------------------------------

  for (const [prefix, idx] of findDuplicateIds(val.suspects, 'suspects')) {
    addIssue(ctx, CaseIssueCode.DUP_SUSPECT_ID, [prefix, idx, 'id']);
  }
  for (const [prefix, idx] of findDuplicateIds(val.weapons, 'weapons')) {
    addIssue(ctx, CaseIssueCode.DUP_WEAPON_ID, [prefix, idx, 'id']);
  }
  for (const [prefix, idx] of findDuplicateIds(val.locations, 'locations')) {
    addIssue(ctx, CaseIssueCode.DUP_LOCATION_ID, [prefix, idx, 'id']);
  }
  for (const [prefix, idx] of findDuplicateIds(val.timeline, 'timeline')) {
    addIssue(ctx, CaseIssueCode.DUP_TIMESLOT_ID, [prefix, idx, 'id']);
  }
  for (const [prefix, idx] of findDuplicateIds(val.clues, 'clues')) {
    addIssue(ctx, CaseIssueCode.DUP_CLUE_ID, [prefix, idx, 'id']);
  }

  // -------------------------------------------------------------------------
  // R2: exactly one suspect with role === 'culprit'
  // -------------------------------------------------------------------------

  const culprits = val.suspects.filter((s) => s.role === 'culprit');
  if (culprits.length !== 1) {
    addIssue(ctx, CaseIssueCode.EXACTLY_ONE_CULPRIT, ['suspects']);
  }

  // -------------------------------------------------------------------------
  // R3: isGuilty ⟺ role === 'culprit' for every suspect
  // -------------------------------------------------------------------------

  val.suspects.forEach((s, i) => {
    const coherent = s.isGuilty === (s.role === 'culprit');
    if (!coherent) {
      addIssue(ctx, CaseIssueCode.GUILT_ROLE_COHERENT, ['suspects', i, 'isGuilty']);
    }
  });

  // -------------------------------------------------------------------------
  // R4: victim.id must not also be a suspect id
  // -------------------------------------------------------------------------

  if (suspectIds.has(val.victim.id)) {
    addIssue(ctx, CaseIssueCode.VICTIM_NOT_SUSPECT, ['victim', 'id']);
  }

  // -------------------------------------------------------------------------
  // R5a: solution.killerId resolves to a known suspect
  // R5b: that suspect has role === 'culprit'
  // -------------------------------------------------------------------------

  if (!suspectIds.has(val.solution.killerId)) {
    addIssue(ctx, CaseIssueCode.KILLER_RESOLVES, ['solution', 'killerId']);
  } else {
    // killer is guaranteed non-null: suspectIds.has(killerId) proved it exists
    const killer = val.suspects.find((s) => s.id === val.solution.killerId)!;
    if (killer.role !== 'culprit') {
      addIssue(ctx, CaseIssueCode.KILLER_IS_CULPRIT, ['solution', 'killerId']);
    }
  }

  // -------------------------------------------------------------------------
  // R6a: solution.victimId === victim.id  (equality, not .some)
  // R6b–R6d: weapon/location/timeSlot resolve against catalogs
  // -------------------------------------------------------------------------

  if (val.solution.victimId !== val.victim.id) {
    addIssue(ctx, CaseIssueCode.SOLUTION_VICTIM_MATCHES, ['solution', 'victimId']);
  }
  if (!weaponIds.has(val.solution.weaponId)) {
    addIssue(ctx, CaseIssueCode.SOLUTION_WEAPON_RESOLVES, ['solution', 'weaponId']);
  }
  if (!locationIds.has(val.solution.locationId)) {
    addIssue(ctx, CaseIssueCode.SOLUTION_LOCATION_RESOLVES, ['solution', 'locationId']);
  }
  if (!timeSlotIds.has(val.solution.timeSlotId)) {
    addIssue(ctx, CaseIssueCode.SOLUTION_TIMESLOT_RESOLVES, ['solution', 'timeSlotId']);
  }

  // -------------------------------------------------------------------------
  // Per-suspect invariants (R7–R10, R11, R12, R16)
  // -------------------------------------------------------------------------

  val.suspects.forEach((s, si) => {
    const knowsSet = new Set(s.knowledge.knows);
    const knownFactsSet = new Set(s.knownFacts);

    // R7: knows ∩ doesNotKnow === ∅
    const knowledgeViolations: number[] = [];
    s.knowledge.doesNotKnow.forEach((fact, ki) => {
      if (knowsSet.has(fact)) {
        knowledgeViolations.push(ki);
      }
    });
    for (const ki of knowledgeViolations) {
      addIssue(ctx, CaseIssueCode.KNOWLEDGE_DISJOINT, [
        'suspects',
        si,
        'knowledge',
        'doesNotKnow',
        ki,
      ]);
    }

    // R8: knownFacts ⊆ knows
    const knownFactsViolations: number[] = [];
    s.knownFacts.forEach((fact, kfi) => {
      if (!knowsSet.has(fact)) {
        knownFactsViolations.push(kfi);
      }
    });
    for (const kfi of knownFactsViolations) {
      addIssue(ctx, CaseIssueCode.KNOWN_FACTS_SUBSET, ['suspects', si, 'knownFacts', kfi]);
    }

    // R9: each secret.fact ∈ knows ∧ ∉ knownFacts
    s.secrets.forEach((sec, seci) => {
      if (!knowsSet.has(sec.fact)) {
        addIssue(ctx, CaseIssueCode.SECRET_FACT_COHERENT, [
          'suspects',
          si,
          'secrets',
          seci,
          'fact',
        ]);
      } else if (knownFactsSet.has(sec.fact)) {
        addIssue(ctx, CaseIssueCode.SECRET_FACT_COHERENT, [
          'suspects',
          si,
          'secrets',
          seci,
          'fact',
        ]);
      }
    });

    // R10a: relationship.to resolves to suspects[]∪{victim.id}
    // R10b: no self-edge (to !== owning suspect's id)
    const validPersonIds = new Set([...suspectIds, val.victim.id]);
    s.relationships.forEach((rel, ri) => {
      if (!validPersonIds.has(rel.to)) {
        addIssue(ctx, CaseIssueCode.RELATIONSHIP_TARGET_RESOLVES, [
          'suspects',
          si,
          'relationships',
          ri,
          'to',
        ]);
      }
      if (rel.to === s.id) {
        addIssue(ctx, CaseIssueCode.RELATIONSHIP_NO_SELF_EDGE, [
          'suspects',
          si,
          'relationships',
          ri,
          'to',
        ]);
      }
    });

    // R11: clue-presented leakTriggers resolve against clues[]
    s.secrets.forEach((sec, seci) => {
      if (sec.leakTrigger.kind === 'clue-presented' && !clueIds.has(sec.leakTrigger.clueId)) {
        addIssue(ctx, CaseIssueCode.SECRET_TRIGGER_RESOLVES, [
          'suspects',
          si,
          'secrets',
          seci,
          'leakTrigger',
          'clueId',
        ]);
      }
    });

    // R12: alibi.breaksWhen (when present, clue-presented) clueId resolves
    const bw = s.alibi.breaksWhen;
    if (bw !== undefined && bw.kind === 'clue-presented' && !clueIds.has(bw.clueId)) {
      addIssue(ctx, CaseIssueCode.ALIBI_TRIGGER_RESOLVES, [
        'suspects',
        si,
        'alibi',
        'breaksWhen',
        'clueId',
      ]);
    }

    // R16: culprit's alibi must have breaksWhen (the lie must be breakable)
    if (s.role === 'culprit' && s.alibi.breaksWhen === undefined) {
      addIssue(ctx, CaseIssueCode.CULPRIT_ALIBI_BREAKABLE, ['suspects', si, 'alibi']);
    }
  });

  // -------------------------------------------------------------------------
  // R13a–R13d: clue refersTo cross-checks
  // -------------------------------------------------------------------------

  val.clues.forEach((clue, ci) => {
    if (clue.refersTo === undefined) return;

    const rt = clue.refersTo;
    if (rt.suspectId !== undefined && !suspectIds.has(rt.suspectId)) {
      addIssue(ctx, CaseIssueCode.CLUE_REFS_SUSPECT_RESOLVES, [
        'clues',
        ci,
        'refersTo',
        'suspectId',
      ]);
    }
    if (rt.weaponId !== undefined && !weaponIds.has(rt.weaponId)) {
      addIssue(ctx, CaseIssueCode.CLUE_REFS_WEAPON_RESOLVES, ['clues', ci, 'refersTo', 'weaponId']);
    }
    if (rt.locationId !== undefined && !locationIds.has(rt.locationId)) {
      addIssue(ctx, CaseIssueCode.CLUE_REFS_LOCATION_RESOLVES, [
        'clues',
        ci,
        'refersTo',
        'locationId',
      ]);
    }
    if (rt.timeSlotId !== undefined && !timeSlotIds.has(rt.timeSlotId)) {
      addIssue(ctx, CaseIssueCode.CLUE_REFS_TIMESLOT_RESOLVES, [
        'clues',
        ci,
        'refersTo',
        'timeSlotId',
      ]);
    }
  });

  // -------------------------------------------------------------------------
  // R14: at least one non-culprit suspect (one-suspect case is unsolvable)
  // -------------------------------------------------------------------------

  const nonCulprits = val.suspects.filter((s) => s.role !== 'culprit');
  if (nonCulprits.length === 0) {
    addIssue(ctx, CaseIssueCode.WITNESS_OR_HERRING_PRESENT, ['suspects']);
  }

  // -------------------------------------------------------------------------
  // R15: timeline[].order values all distinct
  // -------------------------------------------------------------------------

  const seenOrders = new Set<number>();
  val.timeline.forEach((slot, ti) => {
    if (seenOrders.has(slot.order)) {
      addIssue(ctx, CaseIssueCode.TIMESLOT_ORDER_UNIQUE, ['timeline', ti, 'order']);
    } else {
      seenOrders.add(slot.order);
    }
  });
}

// Re-export for convenience (accusation.ts uses CaseIssueCode via this module)
export type { ClueId };
