import { z } from 'zod';

import { ClueId } from './ids.js';

/**
 * Structured discriminated union for secret leakTriggers and alibi breaksWhen.
 *
 * - 'clue-presented'       — cross-checked: clueId must exist in clues[] (R11/R12)
 * - 'fact-confronted'      — opaque prose; shared does NOT cross-check it (no fact catalog by design)
 * - 'contradiction-exposed' — no payload; fires when the suspect's story is contradicted
 */
export const Trigger = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('clue-presented'),
    clueId: ClueId,
  }),
  z.object({
    kind: z.literal('fact-confronted'),
    fact: z.string().min(1),
  }),
  z.object({
    kind: z.literal('contradiction-exposed'),
  }),
]);
export type Trigger = z.infer<typeof Trigger>;
