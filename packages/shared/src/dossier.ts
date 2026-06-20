import { z } from 'zod';
import { SuspectId, PersonId } from './ids.js';
import { Role, RelationshipKind } from './enums.js';
import { Trigger } from './trigger.js';

/**
 * Three-tier knowledge model (per suspect):
 *   knowledge.knows = full closed world (every fact the character could assert, incl. secret facts)
 *   knownFacts ⊆ knows = the freely-offered subset (volunteered without prompting)
 *   secrets[].fact ∈ knows \ knownFacts = withheld unless its trigger fires
 * The runtime grounding boundary (engine/api) is `knowledge.knows`. Coherence enforced at the
 * envelope: R7 (disjoint), R8 (subset), R9 (secret-fact coherence).
 */

/** SERVER-ONLY in aggregate — a withheld fact and the trigger that releases it. */
export const Secret = z.object({
  fact: z.string().min(1), // ∈ knows, ∉ knownFacts (R9)
  leakTrigger: Trigger, // when the suspect reveals it
  ifLeaked: z.string().min(1), // in-character consequence prose (issue-literal; NOT structured)
});

/** `.truth` is SERVER-ONLY. `breaksWhen` absent ⇒ unbreakable/true alibi (never `null` — EOPT). */
export const Alibi = z
  .object({
    claim: z.string().min(1), // public assertion
    truth: z.string().min(1), // SERVER-ONLY — the real whereabouts
    breaksWhen: Trigger, // SERVER-ONLY — the evidence that breaks the lie
  })
  .partial({ breaksWhen: true });

/** A directed edge to a suspect OR the victim. Resolved + no-self-edge at the envelope (R10). */
export const Relationship = z.object({
  to: PersonId,
  kind: RelationshipKind,
  descriptor: z.string().min(1),
});

/** SERVER-ONLY — the character's full closed world + explicit ignorance. */
export const Knowledge = z.object({
  knows: z.array(z.string().min(1)),
  doesNotKnow: z.array(z.string().min(1)),
});

export const Dossier = z.object({
  id: SuspectId,
  publicPersona: z.string().min(1),
  knownFacts: z.array(z.string().min(1)), // freely-offered subset of knows (R8)
  secrets: z.array(Secret), // SERVER-ONLY
  alibi: Alibi, // .truth SERVER-ONLY
  relationships: z.array(Relationship),
  knowledge: Knowledge, // SERVER-ONLY
  isGuilty: z.boolean(), // SERVER-ONLY
  role: Role, // SERVER-ONLY — culprit ⟺ isGuilty (R3)
});

export type Secret = z.infer<typeof Secret>;
export type Alibi = z.infer<typeof Alibi>;
export type Relationship = z.infer<typeof Relationship>;
export type Knowledge = z.infer<typeof Knowledge>;
export type Dossier = z.infer<typeof Dossier>;
