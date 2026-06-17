# Implement

Implement the feature described in the plan at `{{PLAN_FILE}}`, **with its full test suite in the same change**. Code without tests is not done.

## Rules (project invariants — non-negotiable)

1. **Grounding invariant.** No suspect/character utterance may assert a fact absent from its dossier. Gaps are answered with in-character ignorance; secrets release only on their defined trigger. Inert flavor may be improvised but must never introduce a new fact about the crime, timeline, weapon, location, or anyone's whereabouts.
2. **Server-authoritative.** Ground truth — dossiers, secrets, `isGuilty` — lives only in `apps/api`. It must never appear in any client-bound payload. Anthropic keys are server-side only.
3. **`packages/engine` is pure.** No React, no DB, no Next, no `fetch`. It must run in a plain Node script and in CI.
4. **The solver is deterministic code, not an LLM.**
5. **Models:** `claude-opus-4-8` for case generation; `claude-haiku-4-5` for interrogation + verifier. Prompt-cache the dossier block. Use `output_config.format` for structured output and `messages.stream()` piped to SSE for interrogation.

## Testing (see `references/code.md` for the full bar)

- **Deterministic code → genuine 100% line+branch coverage.** Real tests that exercise the implementation. Never assert against mocks written to pass, never lower a threshold, never add coverage-ignore comments to dodge the gate.
- **DB tests hit a real Postgres**, never a mock.
- **LLM call sites → recorded-fixture replay** (deterministic) plus the **eval suite** (thresholds). Never assert exact model strings.

## Done means

`pnpm format && pnpm lint && pnpm typecheck && pnpm test` (and any integration/contract/e2e/visual scripts the feature touches) all pass locally before you finish.
