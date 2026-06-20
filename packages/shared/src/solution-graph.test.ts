import { describe, it, expect } from 'vitest';
import { SolutionGraph } from './solution-graph.js';

const valid = {
  victimId: 'v1',
  killerId: 's1',
  weaponId: 'w1',
  locationId: 'l1',
  timeSlotId: 't1',
};

describe('SolutionGraph', () => {
  it('parses a full valid object', () => {
    expect(SolutionGraph.safeParse(valid).success).toBe(true);
  });

  for (const field of ['victimId', 'killerId', 'weaponId', 'locationId', 'timeSlotId'] as const) {
    it(`rejects when required field ${field} is omitted`, () => {
      const partial = { ...valid };
      delete (partial as Record<string, unknown>)[field];
      expect(SolutionGraph.safeParse(partial).success).toBe(false);
    });

    it(`rejects when ${field} is '' (branded min(1))`, () => {
      expect(SolutionGraph.safeParse({ ...valid, [field]: '' }).success).toBe(false);
    });
  }
});
