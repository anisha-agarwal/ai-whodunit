# AI Whodunit

Interrogate AI-driven suspects grounded in a **provably-solvable** case engine, then accuse the culprit.

A solo, replayable AI murder-mystery. The hard part isn't the chat — it's that every case is generated as a machine-checked, internally-consistent solution graph **before** any prose, and every suspect answers only from a finite **dossier**: guarding secrets until evidence forces a reveal, never hallucinating an alibi, weapon, or whereabouts.

## Why this exists

A portfolio piece demonstrating real AI/LLM product engineering: grounded generation, info-flow-controlled characters, structured outputs, prompt caching, and **evals as a feature** (measured hallucination rate, solvability %, consistency).

## Monorepo layout (Turborepo + pnpm)

| Path                  | What                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------- |
| `packages/engine`     | Case generator + deterministic solver + Zod dossier schema. **Pure TS** — no React/DB/Next/fetch. |
| `packages/shared`     | Zod schemas, prompt templates, scoring/accusation logic.                                          |
| `packages/api-client` | Typed tRPC client.                                                                                |
| `apps/api`            | tRPC + SSE. Server-authoritative; only place ground truth, secrets, and Anthropic keys live.      |
| `apps/web`            | Next.js / Vercel.                                                                                 |
| `apps/mobile`         | Expo / React Native (later).                                                                      |

## Models (tiered Claude)

| Role                     | Model              | Notes                                                |
| ------------------------ | ------------------ | ---------------------------------------------------- |
| Case generator           | `claude-opus-4-8`  | Offline job, amortized ~$0.60/case                   |
| Interrogation + verifier | `claude-haiku-4-5` | Streamed, dossier prompt-cached → ~$0.10/playthrough |

The **solver is deterministic code**, not an LLM.

## Quality bar (non-negotiable)

100% line+branch coverage on deterministic code; real-DB integration tests (never mocked); full Playwright e2e + visual baselines; LLM call sites covered by recorded-fixture replay + threshold eval suite. **No hallucinating tests** — every test exercises the real implementation. See the [architect-whodunit](https://github.com/anisha-agarwal/architect-whodunit) build pipeline.

## Develop

```bash
pnpm install
pnpm lint && pnpm typecheck && pnpm test
```

Built feature-by-feature with [architect-whodunit](https://github.com/anisha-agarwal/architect-whodunit): `/archwd "<feature>"`.
