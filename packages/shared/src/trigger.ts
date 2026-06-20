import { z } from 'zod';
import { ClueId } from './ids.js';

/**
 * The evidence that unlocks a secret (`leakTrigger`) or breaks an alibi (`breaksWhen`).
 *
 * - `clue-presented` carries a `ClueId` that `shared` cross-checks against `clues[]` (R11/R12).
 * - `fact-confronted` carries opaque prose `shared` does NOT cross-check (no fact catalog by design).
 * - `contradiction-exposed` carries no payload.
 */
export const Trigger = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('clue-presented'), clueId: ClueId }),
  z.object({ kind: z.literal('fact-confronted'), fact: z.string().min(1) }),
  z.object({ kind: z.literal('contradiction-exposed') }),
]);

export type Trigger = z.infer<typeof Trigger>;
