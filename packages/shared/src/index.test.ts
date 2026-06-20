import { describe, it, expect } from 'vitest';
import * as shared from './index.js';

/**
 * The barrel is a pure re-export (excluded from coverage). This test only confirms each public
 * symbol is importable from the package root — a smoke check that the public surface is wired.
 */
describe('public barrel surface', () => {
  it.each([
    'CaseIssueCode',
    'SuspectId',
    'VictimId',
    'WeaponId',
    'LocationId',
    'TimeSlotId',
    'ClueId',
    'PersonId',
    'Role',
    'RelationshipKind',
    'ClueReliability',
    'Trigger',
    'SolutionGraph',
    'Secret',
    'Alibi',
    'Relationship',
    'Knowledge',
    'Dossier',
    'Clue',
    'Victim',
    'Weapon',
    'Location',
    'TimeSlot',
    'CaseFile',
    'Accusation',
    'validateAccusation',
    'PublicDossier',
    'PublicClue',
    'PublicCaseFile',
    'redactDossier',
    'redactClue',
    'toPublicCaseFile',
  ])('exports %s', (name) => {
    expect((shared as Record<string, unknown>)[name]).toBeDefined();
  });
});
