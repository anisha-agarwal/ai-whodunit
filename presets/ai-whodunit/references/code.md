# Coding conventions & quality bar (judge criteria)

These are enforced. The pipeline gates on the commands; the reviewer/judge gates on intent.

## Architecture invariants

- **Server-authoritative.** Dossiers, secrets, and `isGuilty` exist only in `apps/api`. Never serialize them into any client-bound payload. Anthropic keys are server-side only.
- **`packages/engine` is pure TS** — no React, DB, Next, or `fetch`. Runs in a plain script and in CI.
- **The solver is deterministic code**, not an LLM. Solvability and cross-dossier consistency are proven, not prompted.
- **Grounding invariant** (the product's headline reliability claim): no character utterance asserts a fact absent from its dossier; gaps → in-character ignorance; secrets release only on their trigger.

## Models

- Generation: `claude-opus-4-8` (`output_config.format` structured output, adaptive thinking).
- Interrogation + verifier: `claude-haiku-4-5`, dossier prompt-cached (`cache_control`), streamed via `messages.stream()` → SSE.

## Testing bar (NON-NEGOTIABLE — "no hallucinating tests")

- Every test exercises the **real implementation** and asserts observable behavior or an invariant. No tautologies, no snapshot-of-itself, no asserting against mocks written to pass.
- **Deterministic code → 100% line+branch coverage**, enforced by per-package vitest thresholds. Do **not** lower a threshold, add `/* c8 ignore */`, `.skip`, or edit coverage config to dodge the gate. If a line is genuinely unreachable, the design is wrong — fix the design.
- **DB integration tests use a real Postgres** (Testcontainers or the CI service), never a mock. Assert real persisted state; entitlement decrements are atomic.
- **API/contract tests** include a real payload-scan asserting no dossier/secret/`isGuilty` reaches the client, and the metering gate.
- **LLM call sites**: deterministic CI uses **recorded-fixture replay** (assert structure + the closed-world wiring, never exact strings); a separate **eval suite** gates on hallucination rate, solvability %, consistency, and secret-leak-before-trigger rate. Coverage exclusions for LLM-call lines must be explicit and justified, never silent.

## Style

- TypeScript strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`). No `any`, no `@ts-ignore`/`@ts-expect-error` to silence real errors.
- ESLint runs at `--max-warnings 0`. Don't disable rules to pass — fix the code.
- Prettier-formatted. No dead code, no commented-out blocks, no premature abstraction.
