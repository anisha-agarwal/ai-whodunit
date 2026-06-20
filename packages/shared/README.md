# `@ai-whodunit/shared`

The pure-TS **evidentiary contract** every other package imports (`apps/api`, `apps/web`,
`packages/engine`). No React, DB, Next, `fetch`, LLM, prompt, or network — just Zod schemas,
cross-entity refinements, the client-safe projection, and the accusation well-formedness validator.

Its value is not the field lists — it is the **refinements** (cross-dossier consistency,
exactly-one-culprit, referential integrity, three-tier knowledge coherence, structural solvability
preconditions) and the **server-authoritative redaction projection**.

## What this package owns

- **Branded id schemas** (`SuspectId`/`VictimId`/`WeaponId`/`LocationId`/`TimeSlotId`/`ClueId`,
  plus `PersonId = SuspectId ∪ VictimId` for relationship targets). `VictimId` and `SuspectId` are
  distinct brands, so `Accusation.accusedSuspectId: SuspectId` makes **accusing the victim a compile
  error**.
- **Full schemas** held server-side: `CaseFile` (with `solution`), `Dossier` (with `secrets`,
  `alibi`, `knowledge`, `isGuilty`, `role`), `Clue` (with `reliability`), `SolutionGraph`,
  `Trigger`, the finite catalogs (`Victim`/`Weapon`/`Location`/`TimeSlot`), and `Accusation`.
- **Cross-entity refinements** (`checkCaseInvariants`, attached via `CaseFile.superRefine`):
  R1a–R16. Each fires a **stable `CaseIssueCode`** on the Zod issue's `message` field so consumers
  switch on the specific failure kind, never bare `success === false`.
- **`validateAccusation(caseFile, acc)`** — pure **well-formedness** (A1a–A1e). This is **NOT**
  scoring/correctness; whether the guess is right is `engine`/`api`'s job.
- **Server-authoritative client-safe projection**: `PublicDossier`/`PublicClue`/`PublicCaseFile`
  types + `redactDossier`/`redactClue`/`toPublicCaseFile`. Built by **explicit field construction**
  (whitelisting safe fields) — never Zod `.strip()`/`.parse()`, never `delete` — so "forgot to drop
  a server-only field" is a killable mutant, not a silent leak.

## The redaction contract (server-authoritative)

`shared` is the single source of truth for **what is safe to send**. `apps/api` serializes only the
`Public*` shapes. The projection **omits** every server-only field:

| Schema     | Omitted from the `Public*` projection                                                    |
| ---------- | ---------------------------------------------------------------------------------------- |
| `Dossier`  | `secrets`, `alibi` (incl. `claim`/`truth`/`breaksWhen`), `knowledge`, `isGuilty`, `role` |
| `Clue`     | `reliability`                                                                            |
| `CaseFile` | `solution`                                                                               |

`role` and `reliability` were prior leaks and **must stay omitted**. The redaction test contract is
belt-and-suspenders: a recursive denylist key-scan (belt), an exact allowlist key-set per `Public*`
type (suspenders — a new sensitive field fails the test unless deliberately allowlisted), and a
scoped secret-string content scan.

## What is out of scope (deferred to `engine`/`api`)

The full deterministic **solvability proof**, **accusation scoring/correctness**, runtime
**grounding enforcement** over LLM utterances, clue→culprit **reachability**, a global `FactId`
registry, and the wire (SSE/tRPC) **payload-scan**. R14/R16 here are _necessary-but-not-sufficient_
structural gates only.

## Scripts

| Script          | Command                      |
| --------------- | ---------------------------- |
| `build`         | `tsc -p tsconfig.build.json` |
| `typecheck`     | `tsc --noEmit`               |
| `lint`          | `eslint . --max-warnings 0`  |
| `test`          | `vitest run --coverage`      |
| `test:mutation` | `stryker run`                |

## Mutation coverage note

Deterministic packages are held to **100% line+branch coverage** and a **Stryker `thresholds.break:
100`** mutation gate. CI (`.github/workflows/ci.yml`) runs `format:check`/`lint`/`typecheck`/`test`
but does **not** run `test:mutation` (Stryker is slow/expensive per-push) — the mutation break gate
is enforced in the architect/PR-review pipeline.
