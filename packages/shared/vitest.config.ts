import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Compile-time type tests (*.test-d.ts) are run via `tsc --noEmit` (typecheck),
    // not by the runtime suite — vitest typecheck is intentionally out of scope here.
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // Deterministic package → 100% line+branch is the non-negotiable bar.
      // Do NOT add c8-ignore, .skip, or exclusions to dodge this gate.
      thresholds: {
        lines: 100,
        branches: 100,
        functions: 100,
        statements: 100,
      },
    },
  },
});
