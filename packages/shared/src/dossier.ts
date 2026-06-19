import { z } from 'zod';

import { PersonId, SuspectId } from './ids.js';
import { RelationshipKind, Role } from './enums.js';
import { Trigger } from './trigger.js';

/**
 * A fact the character will not volunteer freely but CAN reveal under a trigger.
 * secret.fact ∈ knowledge.knows ∧ secret.fact ∉ knownFacts  (enforced at CaseFile.superRefine R9)
 * SERVER-ONLY
 */
export const Secret = z.object({
  fact: z.string().min(1),
  leakTrigger: Trigger,
  /** In-character consequence prose if the secret leaks. Kept as prose (not structured) per plan. */
  ifLeaked: z.string().min(1),
});
export type Secret = z.infer<typeof Secret>;

/**
 * The suspect's alibi claim plus the server-authoritative truth.
 * breaksWhen absent ⟹ alibi is unbreakable / genuine.  (never null — exactOptionalPropertyTypes)
 * SERVER-ONLY: truth + breaksWhen
 */
export const Alibi = z
  .object({
    claim: z.string().min(1),
    truth: z.string().min(1),
    breaksWhen: Trigger,
  })
  .partial({ breaksWhen: true });
export type Alibi = z.infer<typeof Alibi>;

/**
 * A directed relationship edge from this suspect to another cast member.
 * `to` is a PersonId (suspect OR victim) — no self-edges; resolved at CaseFile.superRefine R10.
 */
export const Relationship = z.object({
  to: PersonId,
  kind: RelationshipKind,
  descriptor: z.string().min(1),
});
export type Relationship = z.infer<typeof Relationship>;

/**
 * Three-tier knowledge model (resolves F3):
 *   - knows        = the character's full closed world (grounding boundary for engine/api)
 *   - doesNotKnow  = facts explicitly unknown to the character
 *   - knows ∩ doesNotKnow = ∅  (enforced at CaseFile.superRefine R7)
 * SERVER-ONLY
 */
export const Knowledge = z.object({
  knows: z.array(z.string().min(1)),
  doesNotKnow: z.array(z.string().min(1)),
});
export type Knowledge = z.infer<typeof Knowledge>;

/**
 * A suspect's full server-side dossier.
 *
 * Three-tier knowledge semantics:
 *   knownFacts ⊆ knows  (R8)        — freely volunteered subset
 *   secrets[].fact ∈ knows \ knownFacts  (R9) — guarded facts
 *
 * SERVER-ONLY fields: secrets, alibi, knowledge, isGuilty, role
 */
export const Dossier = z.object({
  id: SuspectId,
  publicPersona: z.string().min(1),
  /** Freely-offered facts — the subset of knowledge.knows the character volunteers. */
  knownFacts: z.array(z.string().min(1)),
  secrets: z.array(Secret),
  alibi: Alibi,
  relationships: z.array(Relationship),
  knowledge: Knowledge,
  isGuilty: z.boolean(),
  role: Role,
});
export type Dossier = z.infer<typeof Dossier>;
