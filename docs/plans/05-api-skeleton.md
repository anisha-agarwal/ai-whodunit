# Final Plan — `apps/api`: tRPC + SSE skeleton, server-authoritative session service, DB migrations

**Issue #5 · PLAN ONLY (no code) · Pipeline: `api` · Unblocks #22 (execution)**

`apps/api` is the **server-authoritative boundary**. It is the first package that holds a *full*
`CaseFile` (solution graph + secrets + `isGuilty` + alibi truth + clue reliability) and the first
that has a *wire surface*. Its entire value is the seam: it serves **only** `PublicCaseFile`/
`PublicClue`/`PublicDossier` to the client (via the already-built `toPublicCaseFile` —
`packages/shared/src/redaction.ts:79`), persists ground truth to Postgres, owns accusation
**scoring** (a genuine gap — it exists nowhere in `packages/shared` or `packages/engine` today,
verified by `rg`), and leaves clean injected seams (`GenerateFn`/`StoreFn` —
`packages/engine/src/generate/ports.ts`) for the M3 Opus generation adapter and the M3 Haiku
interrogation loop. This PR builds the **skeleton + the boundary guarantees**, not the LLM loops.

---

## 0. Synthesis note (how this plan was assembled, and why)

This plan is grounded entirely in the real repo at `origin/main` da482f0 (every claim `rg`/`Read`
verified, cited `file:line`). It matches the house format of `docs/plans/01-shared-schemas.md`:
Synthesis note → Design-decision table → Mermaid diagrams → interface/type sketch → file list →
test strategy → phases/risks. The coder≠test-author split (`references/code-quality.md` §Testing
bar, mechanism 1) is honored: the **coder** writes all `src/*.ts` + scaffold + migration SQL +
`code-checklist.json` and **zero** tests; the **test_author** owns every `*.test.ts`, the
threshold-bearing `vitest.config.ts`, and `mutation-ledger.md`.

**Grounded facts that shape the whole plan (verified, not assumed):**

| Fact | Evidence |
|---|---|
| `toPublicCaseFile`/`redactDossier`/`redactClue` + `PublicCaseFile` already exist, built by explicit whitelisting. The API's wire boundary is **already written** — the API only has to *call* it, never reinvent redaction. | `packages/shared/src/redaction.ts:57,70,79` |
| Server-only fields to keep off the wire: Dossier `secrets`, `alibi` (incl `.truth`/`.claim`/`breaksWhen`), `knowledge`, `isGuilty`, `role`; Clue `reliability`; CaseFile `solution`. | `packages/shared/src/dossier.ts:48-53`, `redaction.ts:14-19` |
| **Accusation scoring does NOT exist** anywhere. `validateAccusation` is well-formedness only ("NOT scoring", `accusation.ts:21`). Comparing `accusedSuspectId` vs `solution.killerId` is a net-new API responsibility. | `rg "killerId ===|score|isCorrect"` → no scoring hit; `accusation.ts:34-72` |
| **No play-session / game-state type exists** in `shared`. The issue names a `play_sessions` table → the plan must decide where session state types live and justify it. | `ls packages/shared/src` — no session module |
| Engine injects `GenerateFn = (req)=>Promise<unknown>` and `StoreFn = (cf,verdict)=>void\|Promise`; the real adapters "live in `apps/api`". `generateCase(deps,opts)` is the entry. | `engine/src/generate/ports.ts`, `generate/generate.ts:36` |
| CI already provisions Postgres 16 (`whodunit_test`, `DATABASE_URL=postgres://postgres:postgres@localhost:5432/whodunit_test`) and already runs `pnpm test:integration` then `pnpm test:contract`. e2e/smoke/visual are commented out (M3+). | `.github/workflows/ci.yml:12-46` |
| Strict base tsconfig: ESM-only, `moduleResolution: Bundler`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `isolatedModules`. | `tsconfig.base.json:1-23` |
| Root `package.json`/`turbo.json` already declare `test:integration`/`test:contract` tasks but **no package implements them** — `apps/api` is the first to define those scripts. | `package.json:17-18`, `turbo.json:20-25` |

**Ownership note.** README lists `apps/api` as "tRPC + SSE. Server-authoritative". This issue is the
authoritative scope for the *skeleton*. It does NOT build: the real Opus generation adapter, the
Haiku interrogation/verifier LLM loop, Clerk auth, or any `apps/web` UI — those are later
milestones (§Scope fences). The skeleton must leave clean seams for each.

---

## 0a. Design decisions (resolving the open items the issue hands the architect)

| # | Open question | **Decision** | Why |
|---|---|---|---|
| D1 | **tRPC server transport** (Next route vs standalone vs fastify/hono) | **Standalone `@trpc/server` + `@trpc/server/adapters/standalone` HTTP handler** (Node `http.createServer`), with the SSE interrogation endpoint mounted on the **same Node server** as a raw `text/event-stream` route (not a tRPC procedure). | `apps/web` does NOT exist yet (`ls apps` → ENOENT), so there is no Next route host. A standalone adapter is the smallest server that CI's existing job can boot for integration/contract tests, and it does not couple the API's lifecycle to Next. tRPC v11 has a `httpSubscriptionLink`/SSE story, but a **raw SSE route** keeps the streaming contract explicit and testable with a plain `fetch` reader — and matches the eventual `messages.stream()→SSE` shape (`code-quality.md:15`) without pulling the Haiku loop into this PR. |
| D2 | **ORM / migration tool** | **`drizzle-orm` + `drizzle-kit`** (Postgres dialect, `node-postgres`/`pg` driver). | Drizzle is type-first pure-TS query building with SQL-file migrations checked into the repo — it fits "DB only in `apps/api`" (the engine stays pure; only this package imports `pg`). Prisma adds a binary engine + codegen step that complicates the strict-ESM/`verbatimModuleSyntax` toolchain; raw `pg` + hand-rolled migrations loses compile-time column typing the contract tests benefit from. Drizzle's generated SQL is human-reviewable, so the migration files are auditable (issue requires "Postgres migrations"). |
| D3 | **SSE approach** | **Native Node `http` response as `text/event-stream`** — write `data: {json}\n\n` frames, flush per token. No SSE library. For the skeleton the stream emits a **bounded, deterministic echo/heartbeat sequence** from a recorded fixture (NOT an LLM) so the contract+integration tests are deterministic. | The real token source (Haiku `messages.stream()`) is M3. A library (e.g. `sse`) is unjustified weight for `data:` framing. The skeleton proves the **transport + the payload-scan over streamed frames**, leaving the `GenerateFn`-style seam for the Haiku adapter. |
| D4 | **Integration-test Postgres + isolation** | **Use the CI Postgres service directly via `DATABASE_URL`** (already provisioned, `ci.yml:13-26`); locally, the same env var points at a dev Postgres. **No Testcontainers.** **Isolation against the single `whodunit_test` DB is PINNED** (MAJOR-2): vitest runs test *files* in parallel, so the `test:integration` project MUST use **either (i) schema-per-worker** (each worker `SET search_path` to a unique schema, migrate into it, drop after) **or (ii) serialized files** (`fileParallelism: false` / `pool:'forks'` + `singleFork:true`). **Recommended: (ii)** for the 2-file skeleton. The "truncate between tests" option is **rejected** — it does not isolate parallel processes sharing the `public` schema. | `code-quality.md:29` permits "Testcontainers OR the CI service"; the service exists and is wired in, so Testcontainers adds a Docker dependency CI does not need. The pinned isolation (not a co-equal "or truncate") is what keeps the two parallel integration files from colliding on one DB. |
| D5 | **Where session + scoring types live** | **API-local** (`apps/api/src/session/types.ts`, `apps/api/src/scoring/score.ts`) — NOT added to `packages/shared`. Session state references shared **public** types (`PublicCaseFile`); scoring reads the **server-only** `solution.killerId`. | A `play_session` is a *server-runtime* concept (it holds the full `CaseFile` + transcript), not a cross-package evidentiary contract. Putting scoring in `shared` would tempt `apps/web` to import a function that touches `solution` (a leak vector). Scoring lives where ground truth lives: the server. If a future client needs a *result shape*, expose a scrubbed `AccusationResult` (`{ correct: boolean, revealed: PublicCaseFile['suspects'][n]['id'] }`) — derived, never the solution graph. **Surfaced as a G0 confirmation bullet** (D5 is the one architectural choice a reviewer should explicitly bless). |
| D6 | **Persistence shape: dossiers own table vs JSONB in cases** | **`cases` table stores the full `CaseFile` as a single `jsonb` column** (`case_file jsonb not null`), re-validated with `CaseFile.safeParse` on read; **`dossiers` is NOT a separate relational table.** A thin `play_sessions` table holds session rows referencing `cases.id`. | The `CaseFile` is a *validated aggregate* — its integrity is enforced by `CaseFile.superRefine` (`case-file.ts`), not by FKs. Shredding dossiers into columns would (a) duplicate the Zod refinements as DB constraints, (b) risk a partial/un-refined read, and (c) create more server-only columns to accidentally select into a client payload. One jsonb aggregate re-parsed on read is the smallest correct surface. (The issue *names* a "dossiers" table as a candidate; this plan deliberately rejects it and justifies — that rejection is itself the design.) |

---

## 1. Deliverable — Mermaid diagrams

### 1.1 Architecture (where the boundary is)

```mermaid
flowchart LR
  subgraph client["client (future apps/web — OUT OF SCOPE)"]
    c["typed tRPC client\n+ EventSource reader"]
  end
  subgraph api["apps/api (server-authoritative — THIS PR)"]
    rtr["tRPC appRouter\n(case.get / session.create / session.get / accusation.submit)"]
    sse["raw SSE route\n/interrogation/:sessionId/stream\n(deterministic fixture stream)"]
    redact["shared.toPublicCaseFile()\n← THE WIRE BOUNDARY"]
    score["scoring/score.ts\naccusedSuspectId vs solution.killerId\n(NET-NEW — owns ground truth)"]
    store["db/store.ts\nStoreFn impl + repos"]
    seamG["GenerateFn seam (stub)\n→ M3 Opus adapter"]
    seamI["interrogation seam (fixture)\n→ M3 Haiku messages.stream()"]
  end
  subgraph db["Postgres (real — CI service)"]
    t1["cases (case_file jsonb)"]
    t2["dossiers? NO — folded into cases jsonb (D6)"]
    t3["play_sessions"]
  end
  shared["packages/shared\n(PublicCaseFile, redaction, Accusation)"]
  engine["packages/engine\n(solveCase, generateCase, GenerateFn/StoreFn)"]

  c -->|"tRPC (PublicCaseFile only)"| rtr
  c -->|"GET text/event-stream"| sse
  rtr --> redact
  redact -->|"PUBLIC payload"| c
  rtr --> score
  score -->|"reads solution.killerId (NEVER serialized)"| store
  store --> t1
  store --> t3
  rtr -. imports types .-> shared
  score -. imports .-> shared
  store -. StoreFn .-> engine
  seamG -. injected into .-> engine
  redact -. from .-> shared
```

### 1.2 ER diagram (the migrations the issue requires)

```mermaid
erDiagram
  CASES ||--o{ PLAY_SESSIONS : "fk case_id"
  CASES {
    text id PK "== CaseFile.id"
    jsonb case_file "FULL server-only CaseFile (solution+secrets+isGuilty) — re-parsed on read"
    timestamptz created_at
  }
  PLAY_SESSIONS {
    uuid id PK
    text case_id FK "→ cases.id"
    text status "active | accused | abandoned"
    jsonb accusation "nullable — last submitted Accusation"
    boolean accusation_correct "nullable — scoring result (server-only truth)"
    timestamptz created_at
    timestamptz updated_at
  }
  DOSSIERS_NOTE {
    text rejected "D6: NOT a table — dossiers live inside cases.case_file jsonb"
  }
```

> **Why no `dossiers` table** (the issue lists one as a candidate): a dossier is a refined member of
> the `CaseFile` aggregate (`case-file.ts` `suspects: Dossier[]` under `superRefine`). Relational
> shredding would duplicate Zod refinements as DB constraints and multiply server-only columns. The
> aggregate is stored once as jsonb and re-`safeParse`d on read (D6).

### 1.3 Sequence — the SSE interrogation stream + the payload-scan boundary

```mermaid
sequenceDiagram
  participant C as client
  participant S as apps/api SSE route
  participant F as fixture token source (M3 → Haiku)
  participant R as redaction boundary
  C->>S: GET /interrogation/:sessionId/stream (Accept: text/event-stream)
  S->>S: load play_session + full CaseFile (server-only)
  S->>F: open stream (deterministic fixture for skeleton)
  loop each token frame
    F-->>S: token
    S->>R: assert frame carries NO server-only field
    R-->>S: scrubbed frame ({ token } only)
    S-->>C: data: {"token":"..."}\n\n
  end
  S-->>C: data: {"done":true}\n\n  (then close)
  Note over C,S: contract test reads the full frame sequence and key-scans every frame
```

---

## 2. Build / ADD table (one-way — every row is an ADD; there is no reference surface)

| # | Behavior to build | whodunit destination (file:symbol) | How it stays grounded / server-authoritative | Pattern anchor | user_visible |
|---|---|---|---|---|---|
| B1 | tRPC `case.get(caseId)` returns a **`PublicCaseFile`** | `apps/api/src/router/case.ts:caseRouter.get` (new) | Loads full `CaseFile` from DB, returns `toPublicCaseFile(cf)` (`shared/redaction.ts:79`) — solution/secrets/isGuilty/role/reliability never enter the output type | `shared/src/redaction.ts` (the boundary fn) | true |
| B2 | tRPC `session.create(caseId)` persists a play session, returns `{ sessionId }` + the `PublicCaseFile` | `apps/api/src/router/session.ts:sessionRouter.create` (new) | Session row stores `case_id` only; response is public projection; full case stays server-side | `engine generate/ports.ts:StoreFn` (persistence seam) | true |
| B3 | tRPC `session.get(sessionId)` returns public session state (`status`, public case, accusation-if-any) | `apps/api/src/router/session.ts:sessionRouter.get` (new) | Reads server row, returns a **scrubbed** `SessionView` (no `accusation_correct` until accused; never the solution) | `shared/redaction.ts` projection pattern | true |
| B4 | tRPC `accusation.submit(sessionId, Accusation)` **scores** the guess and returns `{ correct, killerRevealed?: PublicDossier }` | `apps/api/src/router/accusation.ts:accusationRouter.submit` (new) + `apps/api/src/scoring/score.ts:scoreAccusation` (new) | `scoreAccusation` reads `solution.killerId` server-side, compares to `accusedSuspectId`; **only a boolean + a redacted (public) reveal** crosses the wire — the solution graph never serializes. First validates with `validateAccusation` (`shared/accusation.ts:34`) | `shared/accusation.ts:validateAccusation` (well-formedness, then score) | true |
| B5 | SSE route streams a bounded token sequence for an interrogation turn | `apps/api/src/sse/interrogation.ts:streamInterrogation` (new) | Each `data:` frame carries only `{ token }` / `{ done }`; a `scrubFrame` guard asserts no server-only key in any frame before write. Skeleton source is a **deterministic fixture**, not an LLM (Haiku adapter is M3) | `code-quality.md:15` (messages.stream→SSE shape) | true |
| B6 | `StoreFn` adapter persists an accepted `CaseFile` to `cases` (jsonb) | `apps/api/src/db/store.ts:makeStoreFn` (new) | Implements engine's `StoreFn = (cf,verdict)=>Promise<void>` (`engine/generate/ports.ts`); writes the FULL case to the server-only `cases.case_file` column | `engine/src/generate/ports.ts:StoreFn` | false |
| B7 | `GenerateFn` seam stub (typed, throws `NOT_IMPLEMENTED`) leaving the Opus adapter seam | `apps/api/src/generation/generateFn.ts:makeGenerateFn` (new) | Typed to `GenerateFn = (req)=>Promise<unknown>` (`engine/generate/ports.ts`); body is an explicit `NOT_IMPLEMENTED` seam marker — the real Opus `output_config.format` call is M3. Holds the seam, no Anthropic key in this PR | `engine/generate/ports.ts:GenerateFn` | false |
| B8 | Postgres schema + migrations for `cases`, `play_sessions` | `apps/api/drizzle/schema.ts` + `apps/api/drizzle/migrations/0000_init.sql` (new) | `cases.case_file` and `play_sessions.accusation_correct` are server-only columns; no migration creates a client-readable view of them | drizzle-kit generated SQL | false |
| B9 | DB connection + repositories (`casesRepo`, `sessionsRepo`) | `apps/api/src/db/client.ts`, `apps/api/src/db/repos.ts` (new) | `pg` pool reads `DATABASE_URL` (server env only); repos return full server-only rows — callers redact at the boundary, never the repo | drizzle `node-postgres` pattern | false |
| B10 | `appRouter` composition + standalone HTTP server entry (tRPC + SSE mounted) | `apps/api/src/router/index.ts:appRouter`, `apps/api/src/server.ts:createServer` (new) | The single place the public router type is exported (for the future `api-client`); server-only modules are NOT re-exported | tRPC standalone adapter | false |
| B11 | tRPC context (`createContext`) carrying the repos + a server-only `db` handle | `apps/api/src/trpc/context.ts:createContext` (new) | Context holds server-only handles; procedures return only redacted projections | tRPC context pattern | false |
| B12 | Toolchain scaffold: `package.json`, `tsconfig*`, `eslint.config.js`, `vitest.config.ts`, `drizzle.config.ts`, `.env` keys | `apps/api/*` (new) | Defines `test:integration` + `test:contract` scripts (first package to implement the root tasks) | `packages/engine/package.json`, `eslint.config.js`, `tsconfig*.json` | false |

**Grounding/boundary recap (the two headline invariants, per `code-quality.md:7-10`):**
- **Server-authoritative**: the only fn that produces a client payload is `toPublicCaseFile` (B1) +
  the scrubbed `SessionView`/`AccusationResult`/`scrubFrame` shapes (B3/B4/B5). `solution`,
  `secrets`, `isGuilty`, `role`, `reliability`, `alibi.truth`, `knowledge.knows` exist only in
  `cases.case_file` jsonb and in-memory; **no procedure returns them** (proven by the contract
  payload-scan, §6).
- **Two field classes need two different checks (the load-bearing distinction):** (1) the
  `SolutionGraph` = `{victimId, killerId, weaponId, locationId, timeSlotId}` (`solution-graph.ts:8-14`)
  is a graph of **ids/labels that are also publicly enumerated** — `PublicCaseFile` legitimately ships
  the full `weapons`/`locations`/`timeline` `{id,label}` lists + `victim {id,name}` + every
  `PublicDossier.id` (`redaction.ts:42-49`) because the player needs them to interrogate and accuse.
  A leaked bare `solution.*` id therefore CANNOT be caught by content-absence (its value is a
  legitimately-public id) — it is caught by the **key denylist** (`solution`/`killerId` keys denied at
  any depth) and definitively by the **positive `deepEqual(case.get, toPublicCaseFile(fixture))`
  shape** assertion (§6 T4c), under which any extra field fails by structural inequality. (2) The
  server-only **free-text** strings — `secrets[].fact`, `secrets[].ifLeaked`, `alibi.truth`,
  `alibi.claim`, `knowledge.knows[]`/`doesNotKnow[]` — have **no public counterpart**, so a
  `collectStrings` **absence** scan over them is sound (§6 T4b, the correct transfer of
  `redaction.test.ts:172-184`). Asserting absence of the solution ids/labels would be a backwards
  false-failure against correct code — this plan does NOT do that.
- **Engine purity preserved**: `pg`/drizzle/`http` are imported **only** in `apps/api`. The engine
  keeps its pure-TS seam — `apps/api` *supplies* `StoreFn`/`GenerateFn`, never imports a DB client
  into `packages/engine` (CBA-clean, §Self-audit R3).

---

## 3. Phase decomposition

Three independently-landable phases. Each is a small PR; the user invokes `/archwd --phase=N`.

| Phase | Scope | Landable alone? | Rationale |
|---|---|---|---|
| 1 | **DB + persistence**: toolchain scaffold (B12), migrations + schema (B8), client/repos (B9), `StoreFn` (B6), `GenerateFn` seam stub (B7). Ships `test:integration` against real Postgres. | yes | No tRPC/SSE surface yet; pure data layer + engine seams. Compiles and tests on the CI Postgres service standalone. First package to implement `test:integration`. |
| 2 | **tRPC surface**: context (B11), `case.get` (B1), `session.create`/`session.get` (B2/B3), `accusation.submit` + scoring (B4), `appRouter`+server (B10). Ships `test:contract` (payload-scan over tRPC). | yes | Depends on phase 1 *merged* (repos exist). Adds the wire boundary + the payload-scan. |
| 3 | **SSE skeleton**: raw `text/event-stream` route (B5) mounted on the phase-2 server, deterministic fixture stream, frame scrub guard. Extends `test:contract` (payload-scan over streamed frames). | yes | Depends on phase 2 *merged* (server exists). Isolated streaming transport; the only phase touching SSE. |

> Each phase leaves the suite green and the seams for the next. No phase-N depends on an *unmerged*
> phase-(N-1) — each builds on what is already on `main`. (If the operator prefers one PR, phases 1–3
> collapse cleanly; the table is the recommended split for small landable PRs.)

---

## 4. Interface & type sketch (plan-only — not the implementation)

### 4.1 tRPC router shape (`apps/api/src/router/`)

```ts
// router/index.ts — the ONLY exported wire type (consumed by the future packages/api-client)
export const appRouter = router({
  case:       caseRouter,        // get(caseId) -> PublicCaseFile
  session:    sessionRouter,     // create(caseId), get(sessionId)
  accusation: accusationRouter,  // submit(sessionId, Accusation)
});
export type AppRouter = typeof appRouter;   // client imports the TYPE only

// case.ts
caseRouter.get: publicProcedure
  .input(z.object({ caseId: z.string().min(1) }))
  .query(({ input, ctx }): Promise<PublicCaseFile> => {
    // load full CaseFile (server-only) → return toPublicCaseFile(cf)  ← the boundary
  });

// session.ts
sessionRouter.create: publicProcedure
  .input(z.object({ caseId: z.string().min(1) }))
  .mutation(...): Promise<{ sessionId: string; case: PublicCaseFile }>;
sessionRouter.get: publicProcedure
  .input(z.object({ sessionId: z.string().uuid() }))
  .query(...): Promise<SessionView>;     // scrubbed; no solution, no accusation_correct pre-accusal

// accusation.ts
accusationRouter.submit: publicProcedure
  .input(z.object({ sessionId: z.string().uuid(), accusation: Accusation /* shared schema */ }))
  .mutation(...): Promise<AccusationResult>;
```

### 4.2 Server-only → client-safe view types (`apps/api/src/session/types.ts`)

> **Contract-pinned (round-3 MAJOR).** Every one of these view responses is `deepEqual`-pinned in the
> contract test against its explicitly-constructed expected value built from the fixture (§6 T4c) —
> `SessionView`, the embedded `case`, and `AccusationResult` (wrong-guess `{correct:false,
> killerRevealed: redactDossier(fixtureKiller)}`; right-guess `{correct:true}`). A stray field carrying
> a solution-id value under a non-denied key fails the deep-equal even though it evades the key/content
> scans. The deep-equal also pins `killerRevealed` to EXACTLY the `PublicDossier` shape (no extra
> solution-derived field rides along).

```ts
// Derived, scrubbed projections — NONE carry solution / secrets / isGuilty / role / reliability.
export interface SessionView {
  sessionId: string;
  status: 'active' | 'accused' | 'abandoned';
  case: PublicCaseFile;                       // shared projection
  accusation?: Accusation;                    // the player's own guess (public input)
  // accusation_correct is OMITTED until status==='accused'
  result?: AccusationResult;
}
export interface AccusationResult {
  correct: boolean;                           // the ONLY truth bit that crosses the wire
  killerRevealed?: PublicDossier;             // wrong-guess-only redacted reveal — its `.id` IS the
                                              // solution.killerId value, deliberately surfaced.
                                              // Reviewer-bless-required; see §12. NEVER the solution graph,
                                              // never secrets/isGuilty — only the PublicDossier projection.
}
```

### 4.3 Scoring (NET-NEW — the gap) (`apps/api/src/scoring/score.ts`)

```ts
// Pure, deterministic, server-side. Reads solution.killerId — that is WHY it lives in apps/api,
// not in shared (a client must never import a fn that touches the solution graph). 100% covered.
export function scoreAccusation(cf: CaseFile, acc: Accusation): AccusationResult {
  // precondition: validateAccusation(cf, acc).ok  (shared/accusation.ts:34)
  const correct = acc.accusedSuspectId === cf.solution.killerId;
  return correct ? { correct } : { correct, killerRevealed: redactDossier(killer) };
}
```

### 4.4 Engine port adapters (`apps/api/src/db/store.ts`, `generation/generateFn.ts`)

```ts
// Implements engine's StoreFn = (cf: CaseFile, verdict: SolverVerdict) => Promise<void>
export function makeStoreFn(repo: CasesRepo): StoreFn { /* persist FULL case to cases.case_file */ }

// Implements engine's GenerateFn = (req: GenerationRequest) => Promise<unknown>  — SEAM STUB
export function makeGenerateFn(): GenerateFn {
  return async () => { throw new Error('NOT_IMPLEMENTED: Opus generation adapter is M3'); };
}
```

### 4.5 SSE route (`apps/api/src/sse/interrogation.ts`)

```ts
// Raw Node http handler — text/event-stream. Skeleton source is a deterministic fixture sequence.
export function streamInterrogation(req, res, deps): void {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache',
                       Connection: 'keep-alive' });
  for (const token of deps.fixtureTokens) res.write(`data: ${JSON.stringify(scrubFrame({ token }))}\n\n`);
  res.write(`data: ${JSON.stringify({ done: true })}\n\n`); res.end();
}
// scrubFrame: asserts the frame object has NO server-only key (defense-in-depth over the type).
```

### 4.6 Postgres schema (drizzle) (`apps/api/drizzle/schema.ts`)

```ts
export const cases = pgTable('cases', {
  id:        text('id').primaryKey(),                 // == CaseFile.id
  caseFile:  jsonb('case_file').notNull(),            // FULL server-only CaseFile aggregate
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
export const playSessions = pgTable('play_sessions', {
  id:                uuid('id').primaryKey().defaultRandom(),
  caseId:            text('case_id').notNull().references(() => cases.id),
  status:            text('status').notNull().default('active'),  // active|accused|abandoned
  accusation:        jsonb('accusation'),             // nullable — last submitted Accusation
  accusationCorrect: boolean('accusation_correct'),   // nullable — SERVER-ONLY scoring result
  createdAt:         timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt:         timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
```

**Boundary recap:** `cases.case_file` and `play_sessions.accusation_correct` are server-only columns.
No `select` of them reaches a procedure's return value un-scrubbed; the contract test proves it.

---

## 5. File list (create / change)

> **Ownership:** **coder** writes all `src/**.ts`, `drizzle/**`, scaffold configs, and
> `code-checklist.json` (zero tests). **test_author** writes every `*.test.ts`/`*.integration.test.ts`/
> `*.contract.test.ts`, the threshold-bearing `vitest.config.ts`, and `mutation-ledger.md`.

**Create (`apps/api/`):**
```
apps/api/
├── package.json                 # coder — name "@ai-whodunit/api", type:module; deps @trpc/server,zod,
│                                #   drizzle-orm,pg; devDeps drizzle-kit,@types/pg,vitest,coverage-v8,
│                                #   eslint stack (mirror packages/engine/package.json);
│                                #   scripts: build, typecheck, lint, test, test:integration, test:contract,
│                                #            db:generate (drizzle-kit), db:migrate
├── tsconfig.json                # coder — extends ../../tsconfig.base.json (mirror engine)
├── tsconfig.build.json          # coder — rootDir src, outDir dist, exclude *.test.ts/tests
├── eslint.config.js             # coder — flat config (mirror engine/eslint.config.js)
├── drizzle.config.ts            # coder — drizzle-kit: schema path, out=drizzle/migrations, dialect postgres
├── vitest.config.ts             # TEST_AUTHOR — coverage v8; coverage.include = ONLY src/scoring/**,
│                                #   src/session/**, src/sse/interrogation.ts (scrubFrame); EXCLUDE
│                                #   src/router/**,src/db/**,src/trpc/**,src/generation/**,server.ts,env.ts
│                                #   (covered by test:integration/test:contract, NOT the line gate — §6);
│                                #   separate `integration`+`contract` vitest projects (the latter:
│                                #   fileParallelism:false for DB isolation, MAJOR-2)
├── README.md                    # coder — what apps/api owns; the wire-boundary contract; seams left for M3
├── drizzle/
│   ├── schema.ts                # coder — cases, play_sessions (§4.6)
│   └── migrations/0000_init.sql # coder — drizzle-kit generated; reviewed
└── src/
    ├── server.ts                # coder — createServer (standalone tRPC adapter + SSE route mount) [P2/P3]
    ├── env.ts                   # coder — read+validate DATABASE_URL (server-only) via zod
    ├── trpc/
    │   ├── trpc.ts              # coder — initTRPC, router, publicProcedure
    │   └── context.ts           # coder — createContext (repos + db handle) [P2]
    ├── router/
    │   ├── index.ts             # coder — appRouter + export type AppRouter [P2]
    │   ├── case.ts              # coder — case.get -> PublicCaseFile [P2]
    │   ├── session.ts           # coder — session.create / session.get [P2]
    │   └── accusation.ts        # coder — accusation.submit [P2]
    ├── scoring/
    │   └── score.ts             # coder — scoreAccusation (NET-NEW; reads solution.killerId) [P2]
    ├── session/
    │   └── types.ts             # coder — SessionView, AccusationResult (scrubbed views) [P2]
    ├── sse/
    │   └── interrogation.ts     # coder — streamInterrogation + scrubFrame [P3]
    ├── db/
    │   ├── client.ts            # coder — pg Pool + drizzle() from DATABASE_URL [P1]
    │   ├── repos.ts             # coder — casesRepo, sessionsRepo (server-only rows) [P1]
    │   └── store.ts             # coder — makeStoreFn (engine StoreFn impl) [P1]
    └── generation/
        └── generateFn.ts        # coder — makeGenerateFn (engine GenerateFn SEAM STUB) [P1]
```

**Test tree (test_author):**
```
apps/api/
├── src/scoring/score.test.ts                 # unit — 100% line+branch (deterministic) [P2]
├── tests/
│   ├── helpers.ts                            # collectKeys/collectStrings — REUSE the shared shape
│   │                                         #   (packages/shared/tests/helpers.ts); copy, don't import test-only
│   ├── fixtures/case.ts                       # makeFullCase() — one valid full CaseFile (solution+secrets);
│   │                                          #   DISTINCT sentinel strings per server-only free-text field,
│   │                                          #   non-substring of any public string (round-3 MINOR, §6)
│   ├── integration/db.integration.test.ts     # real Postgres: migrate → store → read → safeParse round-trips [P1]
│   ├── integration/session.integration.test.ts# real Postgres: create/get/accuse session lifecycle [P2]
│   │                                          #   (integration project: fileParallelism:false — DB isolation, MAJOR-2)
│   ├── contract/payload-scan.contract.test.ts  # KEY-scan (collectKeys) + FREE-TEXT content-scan (collectStrings:
│   │                                          #   secrets.fact/ifLeaked,alibi.truth/claim,knows/doesNotKnow) +
│   │                                          #   POSITIVE deepEqual on EVERY response (case.get, session.create/get,
│   │                                          #   accusation.submit) vs explicit scrubbed view (round-3 MAJOR) [P2]
│   └── contract/sse-scan.contract.test.ts      # KEY-scan + FREE-TEXT content-scan over every SSE frame [P3]
```

**Change (root — minimal):**
```
.env.example                     # coder — uncomment/confirm DATABASE_URL is the api's server-only var
                                 #   (already present, .env.example:5; add a comment that apps/api owns it)
pnpm-lock.yaml                   # coder — new deps (@trpc/server, drizzle-orm, drizzle-kit, pg, @types/pg)
```

> **No change to** `turbo.json` (tasks `test:integration`/`test:contract` already declared, lines
> 20-25), root `package.json` (root scripts already dispatch them, lines 17-18), or `ci.yml`
> (Postgres service + the two test steps already wired, lines 12-46). `apps/*` is already in
> `pnpm-workspace.yaml`. This is the smallest possible root footprint — the scaffolding was
> pre-provisioned for exactly this package.

---

## 6. Test strategy (meeting the quality bar — `code-quality.md` §Testing bar)

Gates by manifest step ordering. `apps/api` is touched → **CMD:integration** (real Postgres) +
**CMD:contract** (payload-scan) are mandatory, plus the always-on **CMD:typecheck** + **CMD:lint** +
**CMD:test** (100% on deterministic logic) + **CMD:mutation**. e2e/smoke/visual are N/A (no
`apps/web` — those CI steps stay commented, `ci.yml:43-46`).

| # | Behavior | Level | Destination | Mutation-probe target |
|---|---|---|---|---|
| T1 | `scoreAccusation` correct/incorrect + redacted reveal | unit (100% line+branch) | `src/scoring/score.test.ts` | flip `===`→`!==` in killer compare → wrong `correct` bit; remove `redactDossier` wrap → leaked full dossier in reveal |
| T2 | `makeStoreFn` writes the full case; round-trip `safeParse` succeeds | integration (real PG) | `tests/integration/db.integration.test.ts` | revert the jsonb write column → read fails `safeParse` |
| T3 | session lifecycle: create → get(active) → submit → get(accused) | integration (real PG) | `tests/integration/session.integration.test.ts` | revert status transition → `get` returns stale `active` |
| T4 | **Payload-scan (THREE complementary checks — key denylist + free-text content-scan + positive shape):** every tRPC response (`case.get`, `session.*`, `accusation.submit`) is checked by: **(a) key denylist** (`collectKeys`) — NONE of `solution,killerId,isGuilty,role,reliability,secrets,knowledge,knows,doesNotKnow,truth,claim,breaksWhen,leakTrigger,ifLeaked,alibi,accusation_correct,case_file` appears at any depth (this is what catches a container-less bare `solution.*` leak — the offending key is `solution`/`killerId`/`weaponId`-under-`solution`, all denied; **note** `weaponId`/`locationId`/`timeSlotId`/`victimId` are NOT denylistable at the case root — they appear legitimately in `PublicClue.refersTo` `redaction.ts:32-39` and `Accusation` `accusation.ts:14-16` — so the structural catch for a stray bare solution id is (c), not the key-scan); **(b) FREE-TEXT content-scan** (`collectStrings`, the CORRECT transfer of `redaction.test.ts:172-184`) — the fixture's **server-only free-text strings that have NO public counterpart** are absent from every serialized response: each suspect's `secrets[].fact`, `secrets[].ifLeaked`, `alibi.truth`, `alibi.claim` (claim is omitted from `PublicDossier` `redaction.ts:22-27`, so it IS server-only on the wire), and every `knowledge.knows[]` / `knowledge.doesNotKnow[]` entry; **(c) POSITIVE shape — pins EVERY tRPC response, not just `case.get` (round-3 MAJOR fix):** each response `deepEqual`s its expected explicitly-constructed scrubbed view built from the fixture — `case.get` ≡ `toPublicCaseFile(fixtureCase)`; **`session.create` ≡ `{ sessionId, case: toPublicCaseFile(fixtureCase) }`** (the embedded `case` is itself pinned); **`session.get` ≡ the expected `SessionView`** (`{ sessionId, status, case: toPublicCaseFile(fixtureCase), accusation?, result? }`); **`accusation.submit` wrong-guess ≡ `{ correct: false, killerRevealed: redactDossier(fixtureKiller) }`** and **right-guess ≡ `{ correct: true }`**. This closes the bare-disembodied-id gap in the *view* responses: a stray field carrying a solution-id value under a NON-denied key (e.g. `SessionView.hint = <weaponId value>`) evades both (a) (key not denied) and (b) (value equals a legitimately-public id), but fails (c) by structural inequality. For `accusation.submit` it also pins `killerRevealed` to EXACTLY the blessed `PublicDossier` shape — no extra solution-derived field can ride along — making the §12 Q1 reveal concrete and testable. **Do NOT assert absence of the weapon/location/timeSlot LABELS or victim/killer/weapon/location/timeSlot IDS** — `PublicCaseFile` *legitimately enumerates the full candidate lists* (`redaction.ts:42-49`; `weapons`/`locations`/`timeline` each `{id,label}`; `victim {id,name}`; every `PublicDossier.id`) which the player needs to interrogate and accuse; asserting their absence is a **backwards false-failure against correct code** (the positive deep-equals are the structural catch, never id-absence). | contract | `tests/contract/payload-scan.contract.test.ts` | revert `toPublicCaseFile`→return `cf` → key-scan (a) catches `solution`/`secrets`/`isGuilty` AND positive shape (c) fails by inequality; emit a free-text secret string into a response → content-scan (b) catches it; add a stray `hint: <weaponId>` field to `SessionView`/`AccusationResult` → only (c) catches it (key not denied, value legitimately-public); add an extra solution-derived field to `killerRevealed` → (c) wrong-guess deep-equal fails; remove the pre-accusal omit of `accusation_correct` → (a) catches it |
| T5 | **SSE frame-scan (key denylist + free-text content-scan):** read the full `data:` frame sequence; key-scan each frame (only `{token}`/`{done}`; denylist as T4a) AND content-scan the concatenated frame text for the same server-only **free-text** strings as T4b (`secrets[].fact`/`ifLeaked`, `alibi.truth`/`claim`, `knows[]`/`doesNotKnow[]`). (No positive deep-equal — frames are a token stream, not a fixed shape; the key-scan + free-text content-scan are the sound checks.) | contract | `tests/contract/sse-scan.contract.test.ts` | revert `scrubFrame` → a server-only key in a frame detected by (a); inject a free-text secret string into a token → detected by (b) |
| T6 | `GenerateFn` seam stub rejects with `NOT_IMPLEMENTED` (seam is typed + reachable, not silently wired to an LLM) | unit | `src/generation/generateFn.test.ts` | change throw → resolve → test catches the missing seam marker |

**Real-implementation discipline (no fake-green):**
- Integration tests run against the **real CI Postgres** via `DATABASE_URL` (D4) — never a mock
  (`code-quality.md:29`). Migrations run into an isolated schema per test run; rows are real.
- The payload-scan **reuses BOTH proven scans** from `packages/shared/tests/helpers.ts` (verified to
  exist): `collectKeys` (the denylist, as `redaction.test.ts:165` uses) AND `collectStrings` (the
  content-scan, as `redaction.test.ts:172-184` uses), now applied to the **wire** payload + SSE frames
  (`code-quality.md:30`). **Field-class discipline (round-2 fix — the load-bearing correction):** the
  `collectStrings` absence-scan is sound ONLY over server-only **free-text strings with no public
  counterpart** — `secrets[].fact`, `secrets[].ifLeaked`, `alibi.truth`, `alibi.claim`,
  `knowledge.knows[]`/`doesNotKnow[]` — exactly the class `redaction.test.ts:172-184` targets. It must
  **NOT** assert absence of solution-graph **ids/labels** (weapon/location/timeSlot labels, victim id,
  killer/suspect ids): `PublicCaseFile` *legitimately enumerates the full candidate lists*
  (`redaction.ts:42-49`) and the player needs them — absence there is a backwards false-failure that
  would pressure the executor into stripping the public candidate lists and breaking the game. A
  container-less bare `solution.*` id is NOT content-scan-catchable (its value equals a legitimately
  public id); it is caught by the **key denylist** (`solution`/`killerId` keys denied at any depth)
  and, definitively, by the **positive deep-equal shape assertions** (T4c).
- **Positive-shape pins cover EVERY response (round-3 MAJOR fix).** T4c is not `case.get`-only: each
  of `case.get`, `session.create` (incl. its embedded `case`), `session.get` (the full `SessionView`),
  and `accusation.submit` (wrong-guess `{ correct:false, killerRevealed: redactDossier(fixtureKiller) }`,
  right-guess `{ correct:true }`) `deepEqual`s its explicitly-constructed expected scrubbed view. This
  is the ONLY check that catches a disembodied solution-id value emitted under a non-denied key in a
  hand-built `SessionView`/`AccusationResult` (it evades both the key-scan and the free-text
  content-scan). The deep-equals are **positive structural pins** — they assert what the response IS,
  never the absence of a publicly-legitimate id, so they cannot reintroduce a backwards false-failure.
- **Fixture hygiene (round-3 MINOR).** The content-scan (T4b) is only a clean signal if each
  server-only free-text field carries a **distinct sentinel string that is NOT a substring of any
  public string** in the fixture. Specifically: `secrets[].fact`, `secrets[].ifLeaked`, `alibi.truth`,
  `alibi.claim`, and each `knowledge.knows[]`/`doesNotKnow[]` entry must use unique sentinels (e.g.
  `"SENTINEL_secret_fact_1"`, `"SENTINEL_alibi_truth"`) that do NOT also appear in `publicPersona`,
  `knownFacts`, `relationships[].descriptor`, weapon/location/timeSlot labels, or any clue `statement`.
  `alibi.claim` is schema-commented "public assertion" (`dossier.ts:25`) but `redactDossier` omits the
  whole `alibi` so claim text IS server-only on the wire — still, if a fixture author reused the claim
  literal inside a public `knownFact`, the claim-absence assertion would false-fail. Distinct sentinels
  make every content-scan assertion unambiguous. (This is a fixture-construction constraint, not a
  product defect — `toPublicCaseFile` never serializes claim.)
- **Integration-test isolation (PINNED — MAJOR-2 fix).** Vitest runs test *files* in parallel
  processes by default, so `db.integration.test.ts` and `session.integration.test.ts` would collide on
  the single CI `whodunit_test` `public` schema. The `test:integration` project MUST isolate by **one
  of** (pick at coding time, not both): **(i) schema-per-worker** — each worker sets `search_path` to a
  uniquely-named schema (e.g. `test_${VITEST_WORKER_ID}`), migrations applied into it, dropped after;
  OR **(ii) serialized files** — the `test:integration` vitest project sets `fileParallelism: false`
  (equivalently `pool: 'forks'` + `poolOptions.forks.singleFork: true`). The "truncate between tests"
  alternative is **dropped** — it does not isolate parallel files. Recommended default: **(ii)** for the
  skeleton (2 integration files, negligible serialization cost; zero schema-juggling); (i) is the path
  if integration files multiply later.
- **No LLM call site is exercised in this PR** (the Opus/Haiku adapters are M3 seams). Therefore **no
  recorded-fixture replay / FAIL→PASS eval belongs here** — the test_author must NOT hallucinate one
  (a vacuous test the adversary flags). When B5's fixture stream is replaced by the Haiku
  `messages.stream()` in M3, *that* PR ships the recorded-fixture replay + secret-leak-before-trigger
  eval (`code-quality.md:31`). Flagged for the M3 PR body's Gaps section, not this one.
- **Coverage-gate scoping (PINNED — MAJOR-1 fix).** `pnpm test` / **CMD:test** runs
  `vitest run --coverage` and does **NOT** run `test:integration` / `test:contract` — those are
  distinct turbo tasks (`turbo.json:20-25`) loaded by separate vitest projects. Therefore the
  apps/api `vitest.config.ts` coverage `include` MUST enumerate **only the deterministic-pure dirs**
  exercised by the `test` run — `src/scoring/**`, `src/session/**` (view builders), and the pure
  transport helper `src/sse/interrogation.ts` (`scrubFrame` only) — and MUST **exclude**
  `src/router/**`, `src/db/**`, `src/trpc/**`, `src/generation/**`, `src/server.ts`, `src/env.ts`.
  Those excluded dirs are exercised by `test:integration` / `test:contract`, **not** by the
  line-coverage gate, so including them in the `test`-run coverage would make 100% unsatisfiable and
  pressure the band-aids `code-quality.md:28` forbids. **Do NOT mirror engine's `include:['src/**']`**
  — that anchor (§8) is for the *toolchain shape* (ESM/strict/script layout), not the coverage glob.
  100% line+branch holds over the pure dirs; **CMD:mutation** (Stryker, `mutate: src/scoring`,
  `src/session`, `src/sse`) gates the break threshold there. The SSE *route I/O* and tRPC *wiring* are
  proven load-bearing by the contract payload-scan (T4/T5), not by the line gate.

---

## 7. Scope fences — what this work will NOT touch (skeleton discipline)

Fences mark surfaces out of scope for the *skeleton*, so the coder leaves clean seams instead of
gold-plating. Each is a deliberate design decision, not a wall to break correctness against.

- **Real Opus generation adapter**: out of scope — `makeGenerateFn` is a typed **seam stub** that
  throws `NOT_IMPLEMENTED` (B7). The `output_config.format` call + the Anthropic key land in M3.
  Justified: this PR has no Anthropic dependency and no LLM in any test.
- **Haiku interrogation/verifier LLM loop**: out of scope — SSE streams a **deterministic fixture**
  (B5/D3), not `messages.stream()`. Justified: the skeleton proves the *transport + the frame
  payload-scan*; the grounded-utterance loop + secret-leak eval are M3.
- **Clerk auth**: out of scope — procedures are `publicProcedure`; no `protectedProcedure`/session
  identity. Justified: `.env.example:8` marks CLERK_* "M2+" but the *auth wiring* is a later issue;
  the skeleton leaves the context (B11) as the seam where auth middleware will attach.
- **`apps/web` UI + `packages/api-client`**: out of scope — `AppRouter` type is *exported* (B10) as
  the seam, but no client is built. Justified: `ls apps` shows web does not exist; e2e/smoke/visual
  stay commented in CI.
- **`packages/shared` / `packages/engine` edits**: out of scope — this PR *consumes* their stable
  exports (`toPublicCaseFile`, `Accusation`, `GenerateFn`/`StoreFn`, `solveCase`) and adds **zero**
  fields to either. Justified: scoring is API-local (D5); a new shared field would be scope creep and
  a potential leak vector. **If a row genuinely needed a shared change, that is a signal to expand
  scope with the user — not to half-build it here.** (No row needs one.)

---

## 8. Pattern anchors (copy these shapes)

- `packages/engine/package.json` + `eslint.config.js` + `tsconfig.json`/`tsconfig.build.json` +
  `vitest.config.ts` — the **deterministic-package toolchain SHAPE** (ESM, strict, script layout,
  flat eslint, build-tsconfig excludes). `apps/api` mirrors the *shape* and adds
  `test:integration`/`test:contract` scripts. **Do NOT copy engine's coverage `include:['src/**']`
  glob** — apps/api has DB/router/SSE-I/O dirs the `test` run never exercises; its coverage `include`
  is scoped per §6 (MAJOR-1) to the deterministic-pure dirs only, or the 100% gate is unsatisfiable.
- `packages/shared/src/redaction.ts` — **the wire boundary**. The API calls `toPublicCaseFile`; it
  does not reinvent redaction. Copy the explicit-whitelist discipline for `SessionView`/
  `AccusationResult` (`session/types.ts`).
- `packages/shared/tests/helpers.ts:collectKeys`/`collectStrings` + `redaction.test.ts:162-175` —
  the **recursive key-scan / content-scan** the contract payload-scan reuses (now over the wire).
- `packages/shared/src/accusation.ts:validateAccusation` — the **validate-then-act** shape:
  `accusation.submit` runs `validateAccusation` (well-formedness) *before* `scoreAccusation`
  (correctness), keeping the two responsibilities separate.
- `packages/engine/src/generate/ports.ts` + `generate/types.ts:GenerationDeps` — the **injected-port**
  pattern the `StoreFn`/`GenerateFn` adapters implement; the engine is supplied, never imported-into.

---

## 9. Blast radius

- **Symbols this PR consumes (no edit) — confirmed stable via `rg`:** `toPublicCaseFile`,
  `redactDossier`, `PublicCaseFile`, `PublicDossier`, `PublicClue` (`shared/redaction.ts`);
  `Accusation`, `validateAccusation` (`shared/accusation.ts`); `CaseFile` (`shared/case-file.ts`);
  `GenerateFn`, `StoreFn` (`engine/generate/ports.ts`); `GenerationDeps`, `GenerationResult`
  (`engine/generate/types.ts`); `SolverVerdict` (`engine/verdict.ts`); `solveCase`, `generateCase`
  (`engine/index.ts`).
- **Net-new symbols (no existing callers):** `appRouter`/`AppRouter`, `caseRouter`, `sessionRouter`,
  `accusationRouter`, `scoreAccusation`, `makeStoreFn`, `makeGenerateFn`, `streamInterrogation`,
  `scrubFrame`, `casesRepo`, `sessionsRepo`, `createContext`, `createServer`, `SessionView`,
  `AccusationResult`. All new files; downstream impact captured in the coder's `code-checklist.json`.
- **Known affected tests already in tree:** none — `apps/api` is a new package; no existing spec
  references any of these symbols (`rg` across `packages/**` confirms `apps/api` has zero current
  references). The future `packages/api-client` (M2+, separate issue) will import `AppRouter`.
- **Root-config blast:** `pnpm-lock.yaml` only (new deps). `turbo.json`/root `package.json`/`ci.yml`
  unchanged (tasks pre-declared).

---

## 10. Complexity budget (pre-estimate)

| Axis | Estimate |
|---|---|
| Production LOC added | ~620 (P1 ~240, P2 ~280, P3 ~100) |
| Test LOC added | ~485 (unit + integration + contract key/content scans + per-response deep-equal shape pins) |
| E2E LOC added | 0 (no `apps/web`) |
| Files modified | 2 (`.env.example`, `pnpm-lock.yaml`) |
| Files added (new) | 28 (20 src/config + 8 test) |
| Distinct-Edit-Patterns | 9 (toolchain-scaffold, drizzle-schema+migration, pg-repo, engine-port-adapter, tRPC-procedure, redaction-call-boundary, scoring-pure-fn, SSE-stream-route, key-scan-contract-test) |
| Distinct-Edit-Patterns / files-touched ratio (shim-discriminator) | 9/30 = 0.30 |
| Net LOC delta | +~1040 |

> Ratio 0.30 sits just under the 0.33 floor → R7 **BUDGET-FLAG** (below). It is **not** a load-bearing
> concern: the denominator is inflated by ~12 one-time scaffold/config files (a brand-new package's
> unavoidable fixed cost — `package.json`, 2× tsconfig, eslint, vitest, drizzle.config, env, README,
> 2 migration/schema files, server entry). The 9 distinct patterns are all genuinely load-bearing
> (every one is a unique architectural shape, not a repeated shim). Surfaced at G0 for an explicit
> "new-package scaffold cost" override rather than silently absorbed.

---

## 11. Self-audit (R1–R7)

| Rule | Verdict | Evidence | Suggested alternative |
|---|---|---|---|
| R1 — Signature-Widening with Caller-Cost (SWC) | **OK** | No new **required** argument added to any *existing* function/procedure/hook — every signature is net-new (`scoreAccusation`, `makeStoreFn`, router procedures). `makeStoreFn(repo)` / `makeGenerateFn()` are new factories with zero existing callers. caller_sites for any widened existing signature = 0. | N/A |
| R2 — Test-Shim Predominance (TSP) | **OK** | 8 test files, **0** shim-only (signature-thread/cast) — every test file adds new `it()`/`describe()` behavior blocks (unit scoring, 2 integration lifecycles, 2 contract key+content-scans, seam-stub, helpers, fixtures). **TSP** = 0/8 = 0.00 (< 0.4 floor; shim_only=0 < 4). | N/A |
| R3 — Cross-Boundary Reactive-Amendment guard (CBA) | **OK** | No scope-fence entry moves a dossier/secret/`isGuilty`/solution field into a client-bound type — the **boundary** is enforced by `toPublicCaseFile` (B1) + scrubbed views, and the **server-authoritative alternative** is the *chosen* design throughout (D5/D6: scoring + session types stay server-side, only scrubbed projections cross). No `packages/engine` edit reaches for React/DB/`next`/`fetch` — `pg`/`http` import **only** in `apps/api`; the engine is *supplied* `StoreFn`/`GenerateFn` (B6/B7), never imported-into. No retroactive Zod default. No trigger fired. | N/A |
| R4 — Helper-Call-site Multiplicity (HCM) | **OK** | No scope-fence dictates a ≥4-line comment block repeated at ≥3 call sites. Boundary explanations are hoisted to single canonical locations (the §2 recap + the `redaction.ts` JSDoc that already exists). call-site count = 0. | N/A |
| R5 — Mid-pipeline Plan Amendment pre-score (MPA-pre) | **OK** | §Open questions are fully resolved in §0a (D1–D6), each with alternatives compared. **Zero WAVED** questions. The runtime-boundary-adjacent ones (D5 scoring/session boundary, D6 jsonb-vs-table persistence) are `RESOLVED` with explicit rationale, not file-existence checks. No `WAVED` referencing server boundary / payload / schema / engine purity / solver / secret. | N/A |
| R6 — §Decisions Over-Justification (OJ) | **OK** | §0a Design-decisions is a **single table** (6 rows D1–D6), not h3/h4 sub-sections → sub-section_count = 0 (< 4 floor); no sub-section exceeds 50 lines (longest cell ~6 lines). `Over-Justification` floor not reached. | N/A |
| R7 — Diff-Cost Pre-Estimate / Complexity Budget (DEP) | **BUDGET-FLAG** | **DEP**: **Distinct-Edit-Patterns** / files-touched = 9/30 = 0.30 (**shim-discriminator** below the 0.33 floor; no −200 LOC cleanup bonus — this is a net-additive new package). Production LOC ~620 < 1500 and files 30 > 20 → the >20-files arm also flags. Both driven by the unavoidable fixed scaffold cost of standing up a *brand-new package* (12 config/migration/entry files), not by shim sprawl — all 9 patterns are load-bearing. | Surface the new-package scaffold cost at **G0** for an explicit operator override; alternatively collapse phases 1–3 into one PR (does not change the ratio, only the PR count). No code simplification available — the file count is the minimum correct surface for a new tRPC+SSE+DB package. |

**BLOCK count = 0.** The single BUDGET-FLAG (R7) is the expected fixed cost of a new package, surfaced
for a G0 override, not a defect to rewrite.

---

## 12. Open questions / risks for the executor + reviewer (plan-mode — no G0 to defer to)

This is plan mode (no coder, no G0 gate downstream), so these are surfaced here for the **executor**
(issue #22) and the **plan/code reviewer** to bless explicitly — not deferred to a gate that won't run.

- **Q1 — `killerRevealed`-on-wrong-guess is an intentional answer-reveal (REVIEWER-BLESS REQUIRED).**
  `accusation.submit` returns `{ correct: false, killerRevealed: PublicDossier }` on a wrong guess
  (§4.2). The `PublicDossier.id` it carries **is the value of `solution.killerId`** — i.e. the API
  deliberately tells the client *who the killer was* after a failed accusation. The issue's contract
  is "client never receives dossier/secrets/`isGuilty`" (#5 body) — `killerRevealed` honors that
  *field-level* (it ships only the redacted `PublicDossier`, never secrets/isGuilty/solution graph),
  but the issue is **silent on whether the answer may be revealed post-accusation at all**. This plan
  takes the position that revealing the culprit after a completed accusation is correct game design
  (the player has finished; a whodunit shows the answer), but it is a **product decision the reviewer
  must explicitly approve**. If rejected, the fix is trivial and local: drop `killerRevealed` from
  `AccusationResult` (return only `{ correct }`). **Note (round-2):** the contract content-scan does
  NOT assert the killer id absent (the killer's `PublicDossier.id` is a legitimately-public suspect
  id already enumerated in `case.get`), so there is no content-scan scoping to adjust either way —
  the reveal is governed by the `AccusationResult` shape, blessed here, not by the leak-scan.
- **Contract-scan field-class discipline (round-2 — the load-bearing implementation note, FIXED in
  §6, not open).** The contract payload-scan asserts **absence only of server-only FREE-TEXT**
  (`secrets[].fact`/`ifLeaked`, `alibi.truth`/`claim`, `knows[]`/`doesNotKnow[]`) — NOT absence of
  solution-graph ids/labels, because `PublicCaseFile` legitimately enumerates the full
  weapon/location/timeSlot/victim/suspect candidate lists (`redaction.ts:42-49`) that the player needs
  (§6 T4b, §2). A leaked bare `solution.*` id is caught by the **key denylist** + the **positive
  per-response deep-equals** (§6 T4a/T4c), never by id-absence. The test_author MUST NOT write an
  absence assertion over any solution id/label — that is a backwards false-failure against correct code.
- **Positive-shape pin now covers ALL responses (round-3 MAJOR — FIXED in-plan, not deferred).** §6 T4c
  pins `case.get`, `session.create` (+ embedded `case`), `session.get` (`SessionView`), and
  `accusation.submit` (`AccusationResult`, both guess branches) to their explicitly-constructed scrubbed
  views via `deepEqual`. This closes the disembodied-solution-id-under-a-non-denied-key gap in the view
  responses and pins `killerRevealed` to exactly `redactDossier(fixtureKiller)`. No longer an open risk.
- **Fixture sentinel hygiene (round-3 MINOR — test_author obligation).** The content-scan (T4b) is a
  clean signal only if each server-only free-text field in the fixture (`secrets[].fact`/`ifLeaked`,
  `alibi.truth`/`claim`, `knows[]`/`doesNotKnow[]`) uses a **distinct sentinel string that is not a
  substring of any public string** (`publicPersona`, `knownFacts`, descriptors, weapon/location/timeSlot
  labels, clue statements). A fixture obligation, not a product defect (§6). Flag in the PR Gaps section.
- **Q2 — `accusation_correct` exposure timing (carried for the reviewer).** `play_sessions.accusation_correct`
  is server-only and `SessionView` omits it pre-accusal (§4.2). After `status==='accused'`, the
  `correct` bit is surfaced via `AccusationResult.correct` — confirm this is the intended single
  exposure point and that `session.get` does not also re-leak the raw column. Covered by T3/T4 but
  flagged for explicit reviewer attention.
- **R-residual (MAJOR-2) — integration isolation mechanism is a coder choice within a pinned set.**
  D4/§6 pin isolation to **(i) schema-per-worker OR (ii) `fileParallelism:false`**, recommending (ii).
  The executor must pick one and prove it (two integration files green when run together, not just
  in isolation). Not a blocking ambiguity — the unsound "truncate" option is removed — but the choice
  is the executor's to make and verify.
- **R-residual (MAJOR-1) — coverage `include` is satisfiable by design.** The 100% gate applies only
  to `src/scoring/**`, `src/session/**`, `src/sse/interrogation.ts` (§6). If the executor later moves
  pure logic into a router/db file, it must either keep that logic in a covered-dir module or extend
  the `include` glob to the new pure file — never widen to `src/**` and then exclude under pressure
  (the band-aid `code-quality.md:28` forbids).

---

STATUS=FEATURE_PLAN_READY
