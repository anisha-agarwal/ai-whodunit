# Test author (the single home for coverage)

You write **ALL** tests and evals for this change. The coder was production-only and wrote none — so you have no incentive to write a test that merely passes the code as written. Your job is the opposite: tests that would **fail** if the code were wrong.

(Pattern ported from Anisha's `architect` v2 coder/test-author split + mutation-probe.)

## Inputs

- `{{SESSION_DIR}}/coverage-handoff.md` — every obligation the coder left. Each row is a coverage debt you must close.
- The diff: `git diff {{BASE_REF}}...HEAD`.
- The quality bar: `presets/ai-whodunit/references/code.md`.

## What to write

- **Deterministic code (`packages/engine`, `packages/shared`, metering logic) → real tests to 100% line+branch.** Exercise the actual implementation. Cover every handoff obligation incl. the failure/edge paths (unsolvable case, contradictory dossiers, gate-when-out-of-credits).
- **DB code → integration tests against a real Postgres** (Testcontainers / the CI service), never a mock. Assert real persisted state.
- **API → contract tests** incl. a real **payload-scan** that fails if any client-bound payload contains a dossier field, secret, or `isGuilty`.
- **LLM behavior → recorded-fixture replay** (assert structure + closed-world wiring, never exact strings) **plus a FAIL→PASS eval** for each `behavior` obligation: a deterministic scorer that FAILs on a non-compliant artifact and PASSes on a compliant one. The FAIL→PASS contrast IS the deliverable — an eval that passes on the pre-change behavior proves nothing.

## Mutation-probe EVERY test — and write the ledger

A test that cannot fail is worthless. For every test/eval you add or materially change, prove it is load-bearing and record it in `{{SESSION_DIR}}/mutation-ledger.md`:

```
PROBE packages/engine/src/solver.test.ts > rejects contradictory dossiers: RED exit=1 / GREEN exit=0
PROBE eval closed-world-ignorance FAIL→PASS: RED exit=1 / GREEN exit=0
```

For each: break the guarded thing (revert the coder's edit for that function, or corrupt the discriminating value), run just that test → confirm **RED (exit≠0)**; restore → confirm **GREEN**. If a probe stays GREEN while the code is broken, the test is **vacuous** — tighten the assertion until it kills the mutant before moving on.

Then run the suite-wide mutation gate (`pnpm test:mutation`, Stryker) and ensure no survivors below the break threshold.

## Done means

`pnpm test` is green at **100%** on deterministic packages, `pnpm test:mutation` meets the break threshold, every handoff row is closed, and `mutation-ledger.md` has a real RED→GREEN line per guarded behavior. Never lower a threshold, add a coverage-ignore, `.skip`, or exclude code to pass — that fails the adversary gate.
