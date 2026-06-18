# Coding conventions & quality bar (judge criteria)

These are enforced. The pipeline gates on the commands; the reviewer + adversary gate on intent.

## Architecture invariants

- **Server-authoritative.** Dossiers, secrets, and `isGuilty` exist only in `apps/api`. Never serialize them into any client-bound payload. Anthropic keys are server-side only.
- **`packages/engine` is pure TS** — no React, DB, Next, or `fetch`. Runs in a plain script and in CI.
- **The solver is deterministic code**, not an LLM. Solvability and cross-dossier consistency are proven, not prompted.
- **Grounding invariant** (headline reliability claim): no character utterance asserts a fact absent from its dossier; gaps → in-character ignorance; secrets release only on their trigger.

## Models

- Generation: `claude-opus-4-8` (`output_config.format`, adaptive thinking).
- Interrogation + verifier: `claude-haiku-4-5`, dossier prompt-cached (`cache_control`), streamed via `messages.stream()` → SSE.

## Testing bar (NON-NEGOTIABLE — "no hallucinating tests")

The pipeline structurally prevents fake-green via three mechanisms ported from the `architect` v2:

1. **Coder ≠ test-author split.** The `code` step writes production code only and hands off a coverage checklist; a separate `test_author` step writes ALL tests/evals. The test author has no stake in the code passing as-written, so the incentive to write a merely-passing test is removed.
2. **Mutation-probing.** Every test must be proven load-bearing: break the guarded code → the test must go RED; restore → GREEN (recorded in `mutation-ledger.md`). The suite-wide `mutation` step (Stryker, `pnpm test:mutation`) gates on a break threshold — surviving mutants mean vacuous tests. Never lower the threshold or exclude code to pass.
3. **Standing adversary gate.** After review, an adversarial pass argues _against_ the change, hunting vacuous/prose-pinning tests, leaked ground truth, backwards evals, and silent losses. BLOCK on any CRITICAL.

Plus:

- Every test exercises the **real implementation** and asserts observable behavior or an invariant — no tautologies, no snapshot-of-itself, no asserting against mocks written to pass.
- **Deterministic code → 100% line+branch coverage**, enforced by per-package vitest thresholds. Do **not** lower a threshold, add `/* c8 ignore */`, `.skip`, or edit coverage config to dodge the gate. An unreachable line means the design is wrong — fix the design.
- **DB integration tests use a real Postgres** (Testcontainers or the CI service), never a mock. Entitlement decrements are atomic.
- **API/contract tests** include a real payload-scan (no dossier/secret/`isGuilty` reaches the client) and the metering gate.
- **LLM call sites**: deterministic CI uses **recorded-fixture replay** (assert structure + closed-world wiring, never exact strings); each LLM _behavior_ change ships a **FAIL→PASS eval** with a pure deterministic scorer (FAILs on a non-compliant artifact, PASSes on a compliant one). The eval suite also gates on hallucination rate, solvability %, consistency, secret-leak-before-trigger. Coverage exclusions for LLM-call lines must be explicit and justified, never silent.

## Style

- TypeScript strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`). No `any`, no `@ts-ignore`/`@ts-expect-error` to silence real errors.
- ESLint at `--max-warnings 0`. Don't disable rules to pass — fix the code.
- Prettier-formatted. No dead code, no commented-out blocks, no premature abstraction.
