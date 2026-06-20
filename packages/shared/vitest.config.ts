import { defineConfig } from 'vitest/config';

/**
 * Coverage gate for `@ai-whodunit/shared` (a deterministic package).
 *
 * Per `docs/plans/01-shared-schemas.md` §3 / §6 + §8: 100% line+branch+function+statement over
 * `src/**`, excluding test files, the type-level `*.test-d.ts` probes, the `tests/` fixtures+helpers,
 * and the pure re-export barrel `index.ts` (no executable branch under v8 — covered transitively).
 * `enums.ts` is intentionally NOT excluded: `z.enum([...])` is value construction every schema
 * parse exercises, so the 100% gate is honestly met. The thresholds ARE the gate — `vitest run
 * --coverage` exits non-zero below them (CMD:test).
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
