import { z } from 'zod';

import { LocationId, TimeSlotId, VictimId, WeaponId } from './ids.js';
import { Dossier } from './dossier.js';
import { Clue } from './clue.js';
import { SolutionGraph } from './solution-graph.js';
import { checkCaseInvariants } from './refinements.js';

/** A named victim (single per case). */
export const Victim = z.object({
  id: VictimId,
  name: z.string().min(1),
});
export type Victim = z.infer<typeof Victim>;

/** A weapon in the finite weapon catalog. */
export const Weapon = z.object({
  id: WeaponId,
  label: z.string().min(1),
});
export type Weapon = z.infer<typeof Weapon>;

/** A location in the finite location catalog. */
export const Location = z.object({
  id: LocationId,
  label: z.string().min(1),
});
export type Location = z.infer<typeof Location>;

/**
 * A time slot in the ordered, finite timeline.
 * `order` values must be unique across the timeline (R15) so the engine can sort.
 */
export const TimeSlot = z.object({
  id: TimeSlotId,
  label: z.string().min(1),
  order: z.number().int().nonnegative(),
});
export type TimeSlot = z.infer<typeof TimeSlot>;

/**
 * The full case envelope — the "finite evidentiary core".
 * Cross-entity referential integrity is enforced in checkCaseInvariants (R1a–R16).
 * suspects[] ARE the dossiers — bijection between dossier and suspect is structural.
 */
export const CaseFile = z
  .object({
    id: z.string().min(1),
    victim: Victim,
    weapons: z.array(Weapon).nonempty(),
    locations: z.array(Location).nonempty(),
    timeline: z.array(TimeSlot).nonempty(),
    /** suspects[] ARE dossiers — no separate cast registry needed. */
    suspects: z.array(Dossier).nonempty(),
    clues: z.array(Clue),
    solution: SolutionGraph,
  })
  .superRefine(checkCaseInvariants);
export type CaseFile = z.infer<typeof CaseFile>;
