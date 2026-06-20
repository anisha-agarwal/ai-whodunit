import { z } from 'zod';
import { VictimId, WeaponId, LocationId, TimeSlotId } from './ids.js';
import { Dossier } from './dossier.js';
import { Clue } from './clue.js';
import { SolutionGraph } from './solution-graph.js';
import { checkCaseInvariants, type CaseFileShape } from './refinements.js';

/** Finite catalogs the entities reference — the closed "evidentiary core." */
export const Victim = z.object({ id: VictimId, name: z.string().min(1) });
export const Weapon = z.object({ id: WeaponId, label: z.string().min(1) });
export const Location = z.object({ id: LocationId, label: z.string().min(1) });
export const TimeSlot = z.object({
  id: TimeSlotId,
  label: z.string().min(1),
  order: z.number().int().nonnegative(),
});

export type Victim = z.infer<typeof Victim>;
export type Weapon = z.infer<typeof Weapon>;
export type Location = z.infer<typeof Location>;
export type TimeSlot = z.infer<typeof TimeSlot>;

/**
 * The case envelope. `suspects[]` ARE the dossiers (structural suspect↔dossier bijection — no
 * separate registry). All cross-entity integrity (R1a–R16) lives on `.superRefine`.
 */
export const CaseFile = z
  .object({
    id: z.string().min(1),
    victim: Victim,
    weapons: z.array(Weapon).nonempty(),
    locations: z.array(Location).nonempty(),
    timeline: z.array(TimeSlot).nonempty(),
    suspects: z.array(Dossier).nonempty(),
    clues: z.array(Clue),
    solution: SolutionGraph,
  })
  .superRefine((value, ctx) => {
    checkCaseInvariants(value as CaseFileShape, ctx);
  });

export type CaseFile = z.infer<typeof CaseFile>;
