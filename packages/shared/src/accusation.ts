import { z } from 'zod';
import { SuspectId, WeaponId, LocationId, TimeSlotId } from './ids.js';
import { CaseIssueCode } from './errors.js';
import type { CaseFile } from './case-file.js';

/**
 * The player's guess — shape only. `accusedSuspectId` is a `SuspectId`, so the brand makes
 * accusing the victim (`VictimId`) a COMPILE error. Whether the guess is CORRECT is the engine's
 * scoring job, never `shared`'s.
 */
export const Accusation = z.object({
  caseId: z.string().min(1),
  accusedSuspectId: SuspectId,
  weaponId: WeaponId.optional(),
  locationId: LocationId.optional(),
  timeSlotId: TimeSlotId.optional(),
});

export type Accusation = z.infer<typeof Accusation>;

/** Result of `validateAccusation` — well-formedness, not correctness. */
export interface AccusationValidity {
  ok: boolean;
  issues: CaseIssueCode[];
}

/**
 * Pure WELL-FORMEDNESS check of an accusation against a case (A1a–A1e). This is NOT scoring —
 * it never compares the guess to `cf.solution`. It only confirms the accusation binds to this
 * case and that every id it carries resolves into the case's catalogs.
 *
 * Data-driven over the optional refs so each one-unresolved fail-arm is independently reachable.
 */
export function validateAccusation(cf: CaseFile, acc: Accusation): AccusationValidity {
  const issues: CaseIssueCode[] = [];

  // A1a — the accusation is bound to this case.
  if (acc.caseId !== cf.id) {
    issues.push(CaseIssueCode.ACCUSATION_CASE_MISMATCH);
  }

  // A1b — the accused is a real suspect.
  if (!cf.suspects.some((s) => s.id === acc.accusedSuspectId)) {
    issues.push(CaseIssueCode.ACCUSED_NOT_SUSPECT);
  }

  // A1c–A1e — every present optional ref resolves into its catalog.
  const refChecks: { value: string | undefined; pool: string[]; code: CaseIssueCode }[] = [
    {
      value: acc.weaponId,
      pool: cf.weapons.map((w) => w.id),
      code: CaseIssueCode.ACCUSED_WEAPON_RESOLVES,
    },
    {
      value: acc.locationId,
      pool: cf.locations.map((l) => l.id),
      code: CaseIssueCode.ACCUSED_LOCATION_RESOLVES,
    },
    {
      value: acc.timeSlotId,
      pool: cf.timeline.map((t) => t.id),
      code: CaseIssueCode.ACCUSED_TIMESLOT_RESOLVES,
    },
  ];
  for (const chk of refChecks) {
    if (chk.value !== undefined && !chk.pool.includes(chk.value)) {
      issues.push(chk.code);
    }
  }

  return { ok: issues.length === 0, issues };
}
