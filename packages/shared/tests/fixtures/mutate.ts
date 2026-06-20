import { makeValidCase, type RawCaseFile } from './validCase.js';

/**
 * `mutate(key)` — returns a deep clone of the valid case with EXACTLY ONE field changed so it
 * violates exactly one refinement, firing that refinement's specific `CaseIssueCode`. Each key maps
 * to a one-field mutation enumerated in `coverage-handoff.md` (R1a–R16). A test parses the result and
 * asserts the specific code fires; the valid case (un-mutated) is silent on that same code.
 *
 * The mutations are deliberately minimal — one field — so a refinement that mistakenly fires on the
 * mutation reveals an over-broad guard, and one that fails to fire reveals a missing/mutated check.
 */
export type MutationKey =
  // R1
  | 'dup-suspect-id'
  | 'dup-weapon-id'
  | 'dup-location-id'
  | 'dup-timeslot-id'
  | 'dup-clue-id'
  // R2
  | 'zero-culprits'
  | 'two-culprits'
  // R3
  | 'guilty-witness'
  | 'non-guilty-culprit'
  // R4
  | 'victim-is-suspect'
  // R5
  | 'killer-unresolved'
  | 'killer-not-culprit'
  // R6
  | 'solution-victim-mismatch'
  | 'solution-weapon-unresolved'
  | 'solution-location-unresolved'
  | 'solution-timeslot-unresolved'
  // R7/R8/R9
  | 'knowledge-not-disjoint'
  | 'known-fact-not-in-knows'
  | 'secret-fact-not-in-knows'
  | 'secret-fact-in-knownfacts'
  // R10
  | 'relationship-target-unresolved'
  | 'relationship-self-edge'
  // R11/R12
  | 'secret-trigger-unresolved'
  | 'alibi-trigger-unresolved'
  // R13
  | 'clue-ref-suspect-unresolved'
  | 'clue-ref-weapon-unresolved'
  | 'clue-ref-location-unresolved'
  | 'clue-ref-timeslot-unresolved'
  // R14/R15/R16
  | 'single-suspect'
  | 'timeslot-order-dup'
  | 'culprit-alibi-unbreakable';

export function mutate(key: MutationKey): RawCaseFile {
  const cf = makeValidCase();
  switch (key) {
    // ── R1 ──────────────────────────────────────────────────────────────────
    case 'dup-suspect-id':
      cf.suspects[1]!.id = cf.suspects[0]!.id;
      // keep R3/role coherent for the duplicated suspect so only R1a fires
      cf.suspects[1]!.role = cf.suspects[0]!.role;
      cf.suspects[1]!.isGuilty = cf.suspects[0]!.isGuilty;
      return cf;
    case 'dup-weapon-id':
      cf.weapons[1]!.id = cf.weapons[0]!.id;
      return cf;
    case 'dup-location-id':
      cf.locations[1]!.id = cf.locations[0]!.id;
      return cf;
    case 'dup-timeslot-id':
      // duplicate the id but keep distinct orders, so ONLY R1d fires (not R15).
      cf.timeline[1]!.id = cf.timeline[0]!.id;
      return cf;
    case 'dup-clue-id':
      cf.clues[1]!.id = cf.clues[0]!.id;
      return cf;

    // ── R2 ──────────────────────────────────────────────────────────────────
    case 'zero-culprits':
      // demote the culprit to a witness; keep guilt coherent + a resolving killer absent-arm.
      cf.suspects[0]!.role = 'witness';
      cf.suspects[0]!.isGuilty = false;
      return cf;
    case 'two-culprits':
      // promote the red herring to a second culprit; keep its guilt coherent + killer resolves to s1.
      cf.suspects[1]!.role = 'culprit';
      cf.suspects[1]!.isGuilty = true;
      // s2 now needs a breakable alibi to keep R16 silent (R16 only checks role==='culprit' find,
      // which is s1 — but be safe: give s2 a resolving breaksWhen).
      cf.suspects[1]!.alibi.breaksWhen = { kind: 'clue-presented', clueId: 'c1' };
      return cf;

    // ── R3 ──────────────────────────────────────────────────────────────────
    case 'guilty-witness':
      // flip ONLY isGuilty on the witness (role stays witness) → R3 incoherent.
      cf.suspects[2]!.isGuilty = true;
      return cf;
    case 'non-guilty-culprit':
      // flip ONLY isGuilty on the culprit (role stays culprit) → R3 incoherent.
      cf.suspects[0]!.isGuilty = false;
      return cf;

    // ── R4 ──────────────────────────────────────────────────────────────────
    case 'victim-is-suspect':
      cf.victim.id = cf.suspects[0]!.id;
      // solution.victimId must follow the victim id so R6a stays silent; only R4 fires.
      cf.solution.victimId = cf.victim.id;
      return cf;

    // ── R5 ──────────────────────────────────────────────────────────────────
    case 'killer-unresolved':
      cf.solution.killerId = 'nobody';
      return cf;
    case 'killer-not-culprit':
      // point the killer at a resolving but non-culprit suspect (the witness).
      cf.solution.killerId = cf.suspects[2]!.id;
      return cf;

    // ── R6 ──────────────────────────────────────────────────────────────────
    case 'solution-victim-mismatch':
      cf.solution.victimId = 'someone-else';
      return cf;
    case 'solution-weapon-unresolved':
      cf.solution.weaponId = 'wX';
      return cf;
    case 'solution-location-unresolved':
      cf.solution.locationId = 'lX';
      return cf;
    case 'solution-timeslot-unresolved':
      cf.solution.timeSlotId = 'tX';
      return cf;

    // ── R7/R8/R9 ──────────────────────────────────────────────────────────────
    case 'knowledge-not-disjoint':
      // a fact in BOTH knows and doesNotKnow.
      cf.suspects[0]!.knowledge.doesNotKnow.push(cf.suspects[0]!.knowledge.knows[0]!);
      return cf;
    case 'known-fact-not-in-knows':
      // a knownFact that is not in knows (R8). Keep R9 silent (secret facts still in knows\knownFacts).
      cf.suspects[0]!.knownFacts.push('a fact I never actually knew');
      return cf;
    case 'secret-fact-not-in-knows':
      // secret.fact removed from knows → R9 first arm (!knows.has).
      cf.suspects[0]!.knowledge.knows = cf.suspects[0]!.knowledge.knows.filter(
        (f) => f !== cf.suspects[0]!.secrets[0]!.fact,
      );
      return cf;
    case 'secret-fact-in-knownfacts':
      // secret.fact ALSO surfaced into knownFacts → R9 second arm (knownFacts.has). Keep it in knows.
      cf.suspects[0]!.knownFacts.push(cf.suspects[0]!.secrets[0]!.fact);
      return cf;

    // ── R10 ──────────────────────────────────────────────────────────────────
    case 'relationship-target-unresolved':
      cf.suspects[0]!.relationships[0]!.to = 'ghost';
      return cf;
    case 'relationship-self-edge':
      cf.suspects[0]!.relationships[0]!.to = cf.suspects[0]!.id;
      return cf;

    // ── R11/R12 ──────────────────────────────────────────────────────────────
    case 'secret-trigger-unresolved':
      // s1's secret leakTrigger is clue-presented; point its clueId at a non-existent clue.
      cf.suspects[0]!.secrets[0]!.leakTrigger = { kind: 'clue-presented', clueId: 'cX' };
      return cf;
    case 'alibi-trigger-unresolved':
      // s1's alibi.breaksWhen is clue-presented; point its clueId at a non-existent clue.
      cf.suspects[0]!.alibi.breaksWhen = { kind: 'clue-presented', clueId: 'cX' };
      return cf;

    // ── R13 ──────────────────────────────────────────────────────────────────
    case 'clue-ref-suspect-unresolved':
      cf.clues[1]!.refersTo = { suspectId: 'sX' };
      return cf;
    case 'clue-ref-weapon-unresolved':
      cf.clues[0]!.refersTo = { weaponId: 'wX' };
      return cf;
    case 'clue-ref-location-unresolved':
      cf.clues[0]!.refersTo = { locationId: 'lX' };
      return cf;
    case 'clue-ref-timeslot-unresolved':
      cf.clues[1]!.refersTo = { timeSlotId: 'tX' };
      return cf;

    // ── R14/R15/R16 ──────────────────────────────────────────────────────────
    case 'single-suspect':
      // only the culprit remains → no witness/red-herring (R14). Keep the killer resolving.
      cf.suspects = [cf.suspects[0]!];
      // c2 refersTo s2 which no longer exists — drop that ref so ONLY R14 fires.
      cf.clues[1]!.refersTo = { timeSlotId: 't2' };
      return cf;
    case 'timeslot-order-dup':
      // two timeslots share an order, keep ids distinct so ONLY R15 fires (not R1d).
      cf.timeline[1]!.order = cf.timeline[0]!.order;
      return cf;
    case 'culprit-alibi-unbreakable':
      // remove the culprit's breaksWhen → R16.
      delete cf.suspects[0]!.alibi.breaksWhen;
      return cf;
  }
}
