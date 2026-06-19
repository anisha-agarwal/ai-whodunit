# @ai-whodunit/shared

Pure-TypeScript Zod schemas, cross-entity refinements, and client-safe projection for the AI Whodunit evidentiary core.

## What this package owns

- **Branded ID schemas** (`SuspectId`, `VictimId`, `WeaponId`, `LocationId`, `TimeSlotId`, `ClueId`, `PersonId`)
- **Leaf schemas**: `Trigger`, `SolutionGraph`, `Dossier` (+ `Secret`, `Alibi`, `Relationship`, `Knowledge`), `Clue`, `Accusation`
- **Catalog + envelope**: `Victim`, `Weapon`, `Location`, `TimeSlot`, `CaseFile` with `.superRefine(checkCaseInvariants)`
- **Cross-entity refinements** R1a–R16 (uniqueness, exactly-one-culprit, referential integrity, three-tier knowledge, solvability gates) — each with a stable `CaseIssueCode`
- **Client-safe projection**: `PublicDossier`, `PublicClue`, `PublicCaseFile` + pure redaction functions `redactDossier`, `redactClue`, `toPublicCaseFile`
- **Accusation well-formedness**: `validateAccusation(caseFile, acc)` — checks A1a–A1e; does NOT score correctness

## What this package does NOT own

- Case generation (→ `packages/engine`)
- Accusation scoring / deterministic solver (→ `packages/engine`)
- LLM call sites, prompt templates, grounding enforcement (→ `apps/api`)
- Wire payload scan / contract tests (→ `apps/api`)
- DB, network, React (this package is pure TS, no side effects)

## Projection contract

`toPublicCaseFile(cf)` is the server-authoritative redaction boundary. Fields it **omits**:

| Field                                    | Reason                                     |
| ---------------------------------------- | ------------------------------------------ |
| `solution` (+ `killerId`, `victimId`, …) | Reveals the answer                         |
| `secrets`                                | Reveals unrevealed facts                   |
| `alibi.truth`, `alibi.breaksWhen`        | Server-only interrogation mechanics        |
| `knowledge` (`knows`, `doesNotKnow`)     | Grounding boundary — engine/api only       |
| `isGuilty`                               | Reveals guilt                              |
| `role`                                   | Reveals culprit/red-herring classification |
| `reliability` (clue)                     | Reveals which clues are misleading         |

The test suite enforces this via **denylist key-scan** (none of these keys anywhere in the JSON) and **allowlist key-set** (exact allowed keys per schema level). See `src/redaction.test.ts`.

## Mutation coverage

Stryker runs over `src/**` with `thresholds.break: 100`. This gate runs in the **forge/PR-review pipeline only**, not on every CI push (Stryker is slow). CI runs `format:check`, `lint`, `typecheck`, `test` (vitest 100% line+branch).

Contributors: do not lower thresholds, add `/* c8 ignore */`, `.skip`, or Stryker exclusions to pass a gate. An unreachable branch means the design is wrong — fix the design.

## Zod version note

Uses Zod `^3.24`. Refinements use `.superRefine((val, ctx) => ctx.addIssue({ code: z.ZodIssueCode.custom, path, message }))`. If upgrading to Zod v4, verify `.superRefine` vs `.check()` API against the installed minor and update `refinements.ts` accordingly.
