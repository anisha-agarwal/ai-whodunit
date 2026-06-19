import { describe, expect, it } from 'vitest';

import { Accusation, validateAccusation, type AccusationValidity } from '../src/accusation.js';
import { CaseFile } from '../src/case-file.js';
import { CaseIssueCode } from '../src/errors.js';
import { makeValidCase } from './fixtures/validCase.js';

const cf = CaseFile.parse(makeValidCase());

function validate(over: Partial<Record<string, string>>): AccusationValidity {
  const acc = Accusation.parse({
    caseId: 'case-vale-manor',
    accusedSuspectId: 'suspect-rourke',
    ...over,
  });
  return validateAccusation(cf, acc);
}

describe('validateAccusation — A1a–A1e', () => {
  it('ok:true with no optional fields (all optional branches skipped)', () => {
    const result = validate({});
    expect(result).toEqual({ ok: true, issues: [] });
  });

  it('ok:true with every optional present and resolving', () => {
    const result = validate({
      weaponId: 'weapon-dagger',
      locationId: 'loc-library',
      timeSlotId: 'ts-evening',
    });
    expect(result).toEqual({ ok: true, issues: [] });
  });

  it('A1a: ACCUSATION_CASE_MISMATCH on wrong caseId', () => {
    const result = validate({ caseId: 'some-other-case' });
    expect(result.ok).toBe(false);
    expect(result.issues).toContain(CaseIssueCode.ACCUSATION_CASE_MISMATCH);
  });

  it('A1b: ACCUSED_NOT_SUSPECT on unknown accused id', () => {
    const result = validate({ accusedSuspectId: 'suspect-ghost' });
    expect(result.ok).toBe(false);
    expect(result.issues).toContain(CaseIssueCode.ACCUSED_NOT_SUSPECT);
  });

  it('A1c: ACCUSED_WEAPON_RESOLVES on unknown weaponId', () => {
    const result = validate({ weaponId: 'weapon-ghost' });
    expect(result.ok).toBe(false);
    expect(result.issues).toContain(CaseIssueCode.ACCUSED_WEAPON_RESOLVES);
  });

  it('A1d: ACCUSED_LOCATION_RESOLVES on unknown locationId', () => {
    const result = validate({ locationId: 'loc-ghost' });
    expect(result.ok).toBe(false);
    expect(result.issues).toContain(CaseIssueCode.ACCUSED_LOCATION_RESOLVES);
  });

  it('A1e: ACCUSED_TIMESLOT_RESOLVES on unknown timeSlotId', () => {
    const result = validate({ timeSlotId: 'ts-ghost' });
    expect(result.ok).toBe(false);
    expect(result.issues).toContain(CaseIssueCode.ACCUSED_TIMESLOT_RESOLVES);
  });

  it('accumulates multiple issues at once', () => {
    const result = validate({ caseId: 'wrong', weaponId: 'weapon-ghost' });
    expect(result.issues).toEqual(
      expect.arrayContaining([
        CaseIssueCode.ACCUSATION_CASE_MISMATCH,
        CaseIssueCode.ACCUSED_WEAPON_RESOLVES,
      ]),
    );
  });
});
