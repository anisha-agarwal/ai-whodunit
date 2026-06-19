import { z } from 'zod';

/** SERVER-ONLY truth — which narrative role the suspect plays. */
export const Role = z.enum(['culprit', 'red-herring', 'witness']);
export type Role = z.infer<typeof Role>;

/** Directed relationship kinds between cast members. */
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
export type RelationshipKind = z.infer<typeof RelationshipKind>;

/** SERVER-ONLY — misleading ⟹ the clue is a red-herring plant. */
export const ClueReliability = z.enum(['truthful', 'misleading']);
export type ClueReliability = z.infer<typeof ClueReliability>;
