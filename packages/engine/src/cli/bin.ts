#!/usr/bin/env node
/**
 * `wd-generate-n` — the Node entry shim for the generate-N CLI.
 *
 * This is the ONLY file in `packages/engine` that touches `process.*` / `fs` / a file write. It
 * keeps the package pure: the impure `GenerateFn` transport (the Opus 4.8 `@anthropic-ai/sdk` call
 * holding the Anthropic key) lives in `apps/api`, NEVER statically imported here — that would break
 * engine purity AND put a secret in a pure package. Instead the operator points the CLI at an
 * adapter module via `WD_GENERATE_FN_MODULE` (a path/specifier whose default export is a
 * `GenerationDeps`), loaded by dynamic `import()` only at the bin boundary.
 *
 * Flow: `parseGenerateArgs(process.argv.slice(2))` → on parse error print the code + exit non-zero →
 * load the deps adapter → `generateN` → write the `GenerateReport` JSON to `--out` (or stdout) →
 * exit 0 on a fully-solvable run, else exit 1 (operator-actionable signal).
 *
 * Excluded from the coverage + mutation surface (C3): no executable branch beyond the argv/exit/
 * file-write shim; the pure library it drives (`parseGenerateArgs`, `generateN`) is 100% covered.
 */
import { writeFileSync } from 'node:fs';
import type { GenerationDeps } from '../generate/types.js';
import { parseGenerateArgs } from './args.js';
import { generateN } from './generate-n.js';

const DEPS_MODULE_ENV = 'WD_GENERATE_FN_MODULE';

async function main(): Promise<number> {
  const parsed = parseGenerateArgs(process.argv.slice(2));
  if (!parsed.ok) {
    process.stderr.write(`${parsed.code}\n`);
    return 2;
  }

  const depsModulePath = process.env[DEPS_MODULE_ENV];
  if (depsModulePath === undefined || depsModulePath === '') {
    process.stderr.write(
      `MISSING_DEPS_MODULE: set ${DEPS_MODULE_ENV} to a GenerationDeps module\n`,
    );
    return 2;
  }

  const depsModule = (await import(depsModulePath)) as { default: GenerationDeps };
  const deps = depsModule.default;

  const { n, maxAttempts, seed, out } = parsed.args;
  const report = await generateN(deps, { n, maxAttempts, ...(seed !== undefined ? { seed } : {}) });

  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (out !== undefined) {
    writeFileSync(out, json);
  } else {
    process.stdout.write(json);
  }

  // Exit non-zero unless every requested case was solvable — an operator-actionable signal.
  return report.solvable === report.requested ? 0 : 1;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (err: unknown) => {
    process.stderr.write(`GENERATE_N_FAILED: ${String(err)}\n`);
    process.exitCode = 1;
  },
);
