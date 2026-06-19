import { z } from 'zod';

import { LocationId, SuspectId, TimeSlotId, WeaponId } from './ids.js';
import { CaseIssueCode } from './errors.js';
import type { CaseFile } from './case-file.js';

/**
 * A player's guess — shape only.
 * Whether it is CORRECT is the engine's scoring job; shared only checks well-formedness.
 *
 * caseId binds the accusation to a specific case (A1a).
 * accusedSuspectId: SuspectId brand means the victim (VictimId) cannot be accused at compile time.
 */
export const Accusation = z.object({
  caseId: z.string().min(1),
  accusedSuspectId: SuspectId,
  weaponId: WeaponId.optional(),
  locationId: LocationId.optional(),
  timeSlotId: TimeSlotId.optional(),
});
export type Accusation = z.infer<typeof Accusation>;

/** Result of validateAccusation — well-formedness only, never correctness/scoring. */
export interface AccusationValidity {
  ok: boolean;
  issues: CaseIssueCode[];
}

/**
 * Validates that an Accusation is well-formed against a given CaseFile.
 * Checks A1a–A1e. Returns { ok: true, issues: [] } when all pass.
 *
 * NOT a scoring function — it does NOT check whether the accusation matches the solution.
 */
export function validateAccusation(cf: CaseFile, acc: Accusation): AccusationValidity {
  const issues: CaseIssueCode[] = [];

  // A1a: accusation must target the correct case
  if (acc.caseId !== cf.id) {
    issues.push(CaseIssueCode.ACCUSATION_CASE_MISMATCH);
  }

  // A1b: accusedSuspectId must be a known suspect
  const suspectIds = new Set(cf.suspects.map((s) => s.id as string));
  if (!suspectIds.has(acc.accusedSuspectId)) {
    issues.push(CaseIssueCode.ACCUSED_NOT_SUSPECT);
  }

  // A1c: optional weaponId must resolve
  if (acc.weaponId !== undefined) {
    const weaponIds = new Set(cf.weapons.map((w) => w.id as string));
    if (!weaponIds.has(acc.weaponId)) {
      issues.push(CaseIssueCode.ACCUSED_WEAPON_RESOLVES);
    }
  }

  // A1d: optional locationId must resolve
  if (acc.locationId !== undefined) {
    const locationIds = new Set(cf.locations.map((l) => l.id as string));
    if (!locationIds.has(acc.locationId)) {
      issues.push(CaseIssueCode.ACCUSED_LOCATION_RESOLVES);
    }
  }

  // A1e: optional timeSlotId must resolve
  if (acc.timeSlotId !== undefined) {
    const timeSlotIds = new Set(cf.timeline.map((t) => t.id as string));
    if (!timeSlotIds.has(acc.timeSlotId)) {
      issues.push(CaseIssueCode.ACCUSED_TIMESLOT_RESOLVES);
    }
  }

  return { ok: issues.length === 0, issues };
}
