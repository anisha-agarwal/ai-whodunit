/**
 * Pure argv parsing for the `wd-generate-n` CLI. No `process.*` touch — `bin.ts` owns that and hands
 * this an already-sliced `argv` (`process.argv.slice(2)`). Mirrors the engine's total-fn discipline
 * (`solveCase`/`generateCase`): defensively consume the input and return a stable-coded result —
 * NEVER throw. Invalid/missing input yields a typed error code, not an exception.
 */

/** The parsed CLI invocation. `out` absent ⇒ write the report to stdout. */
export interface ParsedArgs {
  /** N — how many cases to generate+validate (a positive integer). */
  readonly n: number;
  /** Upper bound on attempts per case (a positive integer). */
  readonly maxAttempts: number;
  /** Optional opaque scenario seed threaded into the generation prompt context. */
  readonly seed?: string;
  /** Optional output file path; absent ⇒ stdout. */
  readonly out?: string;
}

/** A typed parse error — the SPECIFIC failing knob, never a bare boolean. */
export type ParseGenerateArgsError = 'MISSING_N' | 'INVALID_N' | 'INVALID_MAX_ATTEMPTS';

/** Default attempt bound when `--max-attempts` is omitted. */
const DEFAULT_MAX_ATTEMPTS = 1;

/**
 * Read the string value following `--<flag>` in `argv`. Returns `undefined` when the flag is absent
 * OR present without a following value (a trailing `--flag` at the end of argv). Total — never throws.
 */
function readFlag(argv: readonly string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  if (index === -1) {
    return undefined;
  }
  const value = argv[index + 1];
  // A trailing flag (no following token) reads as absent, not as the empty string.
  return value === undefined ? undefined : value;
}

/**
 * Parse a string as a positive integer (≥ 1). Returns `null` for any non-positive-integer input
 * (empty, non-numeric, zero, negative, fractional). Total — never throws.
 */
function parsePositiveInt(raw: string): number | null {
  if (!/^\d+$/.test(raw)) {
    return null;
  }
  const value = Number(raw);
  return value >= 1 ? value : null;
}

/**
 * Parse an `argv` slice into a `ParsedArgs`, or a typed error code. Total — never throws.
 *
 * - `--n` is REQUIRED: absent ⇒ `MISSING_N`; present but not a positive integer ⇒ `INVALID_N`.
 * - `--max-attempts` is OPTIONAL (defaults to {@link DEFAULT_MAX_ATTEMPTS}); present but not a
 *   positive integer ⇒ `INVALID_MAX_ATTEMPTS`.
 * - `--seed` / `--out` are OPTIONAL opaque strings (absent ⇒ left off `ParsedArgs`).
 */
export function parseGenerateArgs(
  argv: readonly string[],
):
  | { readonly ok: true; readonly args: ParsedArgs }
  | { readonly ok: false; readonly code: ParseGenerateArgsError } {
  const rawN = readFlag(argv, '--n');
  if (rawN === undefined) {
    return { ok: false, code: 'MISSING_N' };
  }
  const n = parsePositiveInt(rawN);
  if (n === null) {
    return { ok: false, code: 'INVALID_N' };
  }

  const rawMaxAttempts = readFlag(argv, '--max-attempts');
  let maxAttempts = DEFAULT_MAX_ATTEMPTS;
  if (rawMaxAttempts !== undefined) {
    const parsed = parsePositiveInt(rawMaxAttempts);
    if (parsed === null) {
      return { ok: false, code: 'INVALID_MAX_ATTEMPTS' };
    }
    maxAttempts = parsed;
  }

  const seed = readFlag(argv, '--seed');
  const out = readFlag(argv, '--out');

  return {
    ok: true,
    args: {
      n,
      maxAttempts,
      ...(seed !== undefined ? { seed } : {}),
      ...(out !== undefined ? { out } : {}),
    },
  };
}
