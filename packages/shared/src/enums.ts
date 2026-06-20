import { z } from 'zod';

/** SERVER-ONLY ground truth — a suspect's true role. `culprit ⟺ isGuilty` (R3). */
export const Role = z.enum(['culprit', 'red-herring', 'witness']);

/** Taxonomy for directed relationship edges between cast members. */
export const RelationshipKind = z.enum([
  'spouse',
  'sibling',
  'colleague',
  'rival',
  'friend',
  'employer',
  'creditor',
  'stranger',
]);

/** SERVER-ONLY — `misleading` clues come from red herrings; redacted from `PublicClue`. */
export const ClueReliability = z.enum(['truthful', 'misleading']);

export type Role = z.infer<typeof Role>;
export type RelationshipKind = z.infer<typeof RelationshipKind>;
export type ClueReliability = z.infer<typeof ClueReliability>;
