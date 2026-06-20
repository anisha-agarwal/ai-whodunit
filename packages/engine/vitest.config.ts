import { defineConfig } from 'vitest/config';

/**
 * Coverage gate for `@ai-whodunit/engine` (a deterministic package — the solver).
 *
 * Mirrors `@ai-whodunit/shared`: 100% line+branch+function+statement over `src/**`, excluding
 * test files, the type-level `*.test-d.ts` probes, the `tests/` fixtures+helpers, and the pure
 * re-export barrel `index.ts` (no executable branch under v8 — covered transitively). The
 * thresholds ARE the gate — `vitest run --coverage` exits non-zero below them (CMD:test).
 */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      include: ['src/**'],
      exclude: ['src/**/*.test.ts', 'src/**/*.test-d.ts', 'src/index.ts', 'tests/**'],
      thresholds: {
        lines: 100,
        branches: 100,
        functions: 100,
        statements: 100,
      },
    },
  },
});
