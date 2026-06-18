# Implement (production code only)

Implement the feature in the plan at `{{PLAN_FILE}}`. You are **production-only** — code, types, prompts, docs, migrations. You write **NO tests and NO evals**; a separate `test_author` step owns all coverage. (This is the coder ≠ test-author split: the author of the code has no incentive to write a test that merely passes the code as written.)

Forbidden for you: anything under `**/*.test.ts`, `**/*.spec.ts`, `**/__tests__/`, `tests/`, `e2e/`, `evals/`, or any vitest/playwright/stryker config that sets thresholds. If the plan asks you to write a test, **don't** — record it as a coverage obligation in the handoff instead.

## Project invariants (non-negotiable)

1. **Grounding invariant.** No suspect utterance asserts a fact absent from its dossier. Gaps → in-character ignorance; secrets release only on their trigger; inert flavor may be improvised but never introduces a new fact about the crime/timeline/weapon/location/whereabouts.
2. **Server-authoritative.** Dossiers, secrets, `isGuilty` live only in `apps/api`; never in any client-bound payload. Anthropic keys are server-side only.
3. **`packages/engine` is pure** — no React/DB/Next/fetch.
4. **The solver is deterministic code, not an LLM.**
5. **Models:** `claude-opus-4-8` for generation; `claude-haiku-4-5` for interrogation + verifier; prompt-cache the dossier; `output_config.format` for structured output; `messages.stream()` → SSE for interrogation.

## Required output — the coverage handoff

Write `{{SESSION_DIR}}/coverage-handoff.md` listing every coverage obligation you are leaving for the test-author. One row per new/changed function, branch, exit path, and (for prompt/LLM-behavior changes) each behavior that needs a FAIL→PASS eval:

```
| kind | target | obligation |
|------|--------|------------|
| code | packages/engine/src/solver.ts:isSolvable | narrows-to-one + zero-contradiction + unsolvable + contradictory paths |
| behavior | interrogation closed-world prompt | off-dossier question → in-character ignorance (FAIL→PASS eval) |
```

Run `pnpm format && pnpm lint && pnpm typecheck` before finishing. Leave `pnpm test`/coverage to the test-author — your job is correct production code plus a complete, honest handoff.
