import { describe, it, expect } from 'vitest';
import { parseGenerateArgs } from './args.js';

/**
 * `parseGenerateArgs` — the pure argv parser for `wd-generate-n`.
 *
 * Every test exercises the REAL parser (no fake). The function is TOTAL — it must NEVER throw; every
 * invalid/missing input maps to a SPECIFIC stable error code (`MISSING_N`/`INVALID_N`/
 * `INVALID_MAX_ATTEMPTS`), never a bare boolean. Assertions pin the exact code and the exact captured
 * value (`--out`/`--seed` round-trip), so a dropped-capture or flipped-guard mutant dies.
 */
describe('parseGenerateArgs — happy path', () => {
  it('parses --n / --max-attempts / --seed / --out into a fully-populated ParsedArgs', () => {
    const result = parseGenerateArgs([
      '--n',
      '5',
      '--max-attempts',
      '3',
      '--seed',
      'manor-night',
      '--out',
      '/tmp/report.json',
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    // Pin the exact captured values — a corrupted/dropped capture (e.g. --out → undefined) dies here.
    expect(result.args).toEqual({
      n: 5,
      maxAttempts: 3,
      seed: 'manor-night',
      out: '/tmp/report.json',
    });
  });

  it('defaults maxAttempts to 1 when --max-attempts is omitted, and omits absent optionals', () => {
    const result = parseGenerateArgs(['--n', '2']);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.args.n).toBe(2);
    // The default is a SPECIFIC value (1), not just "present" — a default-swap mutant dies.
    expect(result.args.maxAttempts).toBe(1);
    // Absent optionals are LEFT OFF the object (exactOptionalPropertyTypes), not set to undefined.
    expect('seed' in result.args).toBe(false);
    expect('out' in result.args).toBe(false);
  });

  it('captures --seed without --out, and --out without --seed (independent optional captures)', () => {
    const seedOnly = parseGenerateArgs(['--n', '1', '--seed', 's']);
    expect(seedOnly.ok && seedOnly.args.seed).toBe('s');
    expect(seedOnly.ok && 'out' in seedOnly.args).toBe(false);

    const outOnly = parseGenerateArgs(['--n', '1', '--out', 'o.json']);
    expect(outOnly.ok && outOnly.args.out).toBe('o.json');
    expect(outOnly.ok && 'seed' in outOnly.args).toBe(false);
  });

  it('reads flags regardless of order (indexOf-based, not positional)', () => {
    const result = parseGenerateArgs(['--out', 'o.json', '--max-attempts', '4', '--n', '7']);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.args).toEqual({ n: 7, maxAttempts: 4, out: 'o.json' });
  });

  it('parses MULTI-DIGIT --n / --max-attempts (the /\\d+/ quantifier, not a single digit)', () => {
    // A single-digit-only regex (/^\d$/) would reject these — pins the `+` quantifier as load-bearing.
    const result = parseGenerateArgs(['--n', '12', '--max-attempts', '30']);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.args.n).toBe(12);
    expect(result.args.maxAttempts).toBe(30);
  });
});

describe('parseGenerateArgs — typed errors (never throws)', () => {
  it('MISSING_N when --n is absent entirely', () => {
    const result = parseGenerateArgs(['--max-attempts', '3']);
    expect(result).toEqual({ ok: false, code: 'MISSING_N' });
  });

  it('MISSING_N when --n is the trailing token with no following value', () => {
    // A trailing `--n` reads as absent (no following token), NOT as an empty-string value.
    const result = parseGenerateArgs(['--max-attempts', '3', '--n']);
    expect(result).toEqual({ ok: false, code: 'MISSING_N' });
  });

  it('INVALID_N for a non-numeric --n', () => {
    expect(parseGenerateArgs(['--n', 'five'])).toEqual({ ok: false, code: 'INVALID_N' });
  });

  it('INVALID_N for a fractional --n (positive-integer only)', () => {
    expect(parseGenerateArgs(['--n', '2.5'])).toEqual({ ok: false, code: 'INVALID_N' });
  });

  it('INVALID_N for zero and negative --n (must be >= 1)', () => {
    expect(parseGenerateArgs(['--n', '0'])).toEqual({ ok: false, code: 'INVALID_N' });
    // A leading '-' fails the /^\d+$/ digit-only gate → INVALID_N.
    expect(parseGenerateArgs(['--n', '-3'])).toEqual({ ok: false, code: 'INVALID_N' });
  });

  it('INVALID_MAX_ATTEMPTS for a non-positive-integer --max-attempts (and NOT MISSING_N/INVALID_N)', () => {
    // --n is valid here, so only the max-attempts guard can fire — pins the SPECIFIC knob.
    expect(parseGenerateArgs(['--n', '3', '--max-attempts', 'lots'])).toEqual({
      ok: false,
      code: 'INVALID_MAX_ATTEMPTS',
    });
    expect(parseGenerateArgs(['--n', '3', '--max-attempts', '0'])).toEqual({
      ok: false,
      code: 'INVALID_MAX_ATTEMPTS',
    });
  });

  it('checks --n BEFORE --max-attempts: both invalid → INVALID_N (n-guard fires first)', () => {
    // Ordering matters: a guard-reorder mutant would surface INVALID_MAX_ATTEMPTS here.
    expect(parseGenerateArgs(['--n', 'x', '--max-attempts', 'y'])).toEqual({
      ok: false,
      code: 'INVALID_N',
    });
  });

  it('is total over a hostile/empty argv — returns a code, never throws', () => {
    expect(() => parseGenerateArgs([])).not.toThrow();
    expect(parseGenerateArgs([])).toEqual({ ok: false, code: 'MISSING_N' });
  });
});
