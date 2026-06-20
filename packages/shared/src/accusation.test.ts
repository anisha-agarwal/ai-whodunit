import { describe, it, expect } from 'vitest';
import { Accusation, validateAccusation } from './accusation.js';
import { CaseFile } from './case-file.js';
import { CaseIssueCode } from './errors.js';
import { makeValidCase } from '../tests/fixtures/validCase.js';

/** A parsed (branded) CaseFile to validate accusations against. */
function caseFile(): CaseFile {
  const r = CaseFile.safeParse(makeValidCase());
  if (!r.success) throw new Error('fixture invalid: ' + JSON.stringify(r.error.issues));
  return r.data;
}

/** A well-formed accusation matching the valid fixture: caseId case-1, accused s1, all refs resolve. */
function wellFormed() {
  return Accusation.parse({
    caseId: 'case-1',
    accusedSuspectId: 's1',
    weaponId: 'w1',
    locationId: 'l1',
    timeSlotId: 't1',
  });
}

describe('Accusation schema', () => {
  it('parses with every optional ref ABSENT', () => {
    const r = Accusation.safeParse({ caseId: 'case-1', accusedSuspectId: 's1' });
    expect(r.success).toBe(true);
  });
  it('parses with every optional ref PRESENT', () => {
    const r = Accusation.safeParse({
      caseId: 'case-1',
      accusedSuspectId: 's1',
      weaponId: 'w1',
      locationId: 'l1',
      timeSlotId: 't1',
    });
    expect(r.success).toBe(true);
  });
  it("rejects '' caseId (min(1))", () => {
    expect(Accusation.safeParse({ caseId: '', accusedSuspectId: 's1' }).success).toBe(false);
  });
  it("rejects '' accusedSuspectId (branded min(1))", () => {
    expect(Accusation.safeParse({ caseId: 'case-1', accusedSuspectId: '' }).success).toBe(false);
  });
});

describe('validateAccusation — pass-arm', () => {
  it('well-formed accusation → { ok:true, issues:[] }', () => {
    const v = validateAccusation(caseFile(), wellFormed());
    expect(v).toEqual({ ok: true, issues: [] });
  });

  it('well-formed accusation with all optional refs ABSENT → ok (undefined-skip arms)', () => {
    const acc = Accusation.parse({ caseId: 'case-1', accusedSuspectId: 's1' });
    const v = validateAccusation(caseFile(), acc);
    expect(v).toEqual({ ok: true, issues: [] });
  });
});

describe('validateAccusation — A1a–A1e fail-arms each fire their specific code', () => {
  it('A1a wrong caseId → ACCUSATION_CASE_MISMATCH', () => {
    const acc = Accusation.parse({ ...wellFormed(), caseId: 'other-case' });
    const v = validateAccusation(caseFile(), acc);
    expect(v.ok).toBe(false);
    expect(v.issues).toContain(CaseIssueCode.ACCUSATION_CASE_MISMATCH);
  });

  it('A1b accused not in suspects → ACCUSED_NOT_SUSPECT', () => {
    const acc = Accusation.parse({ ...wellFormed(), accusedSuspectId: 'sX' });
    const v = validateAccusation(caseFile(), acc);
    expect(v.issues).toContain(CaseIssueCode.ACCUSED_NOT_SUSPECT);
  });

  it('A1c present weaponId unresolved → ACCUSED_WEAPON_RESOLVES', () => {
    const acc = Accusation.parse({ ...wellFormed(), weaponId: 'wX' });
    const v = validateAccusation(caseFile(), acc);
    expect(v.issues).toContain(CaseIssueCode.ACCUSED_WEAPON_RESOLVES);
  });

  it('A1c absent weaponId does NOT fire (undefined-skip arm)', () => {
    const acc = Accusation.parse({ caseId: 'case-1', accusedSuspectId: 's1' });
    const v = validateAccusation(caseFile(), acc);
    expect(v.issues).not.toContain(CaseIssueCode.ACCUSED_WEAPON_RESOLVES);
  });

  it('A1d present locationId unresolved → ACCUSED_LOCATION_RESOLVES', () => {
    const acc = Accusation.parse({ ...wellFormed(), locationId: 'lX' });
    const v = validateAccusation(caseFile(), acc);
    expect(v.issues).toContain(CaseIssueCode.ACCUSED_LOCATION_RESOLVES);
  });

  it('A1d absent locationId does NOT fire', () => {
    const acc = Accusation.parse({ caseId: 'case-1', accusedSuspectId: 's1' });
    const v = validateAccusation(caseFile(), acc);
    expect(v.issues).not.toContain(CaseIssueCode.ACCUSED_LOCATION_RESOLVES);
  });

  it('A1e present timeSlotId unresolved → ACCUSED_TIMESLOT_RESOLVES', () => {
    const acc = Accusation.parse({ ...wellFormed(), timeSlotId: 'tX' });
    const v = validateAccusation(caseFile(), acc);
    expect(v.issues).toContain(CaseIssueCode.ACCUSED_TIMESLOT_RESOLVES);
  });

  it('A1e absent timeSlotId does NOT fire', () => {
    const acc = Accusation.parse({ caseId: 'case-1', accusedSuspectId: 's1' });
    const v = validateAccusation(caseFile(), acc);
    expect(v.issues).not.toContain(CaseIssueCode.ACCUSED_TIMESLOT_RESOLVES);
  });
});
