# Code Review

You are reviewing code changes you did not write. Be thorough and adversarial — your job is to catch what the author missed.

## Instructions

1. Read the plan at `{{PLAN_FILE}}` to understand the intended changes.
2. Run `git diff {{BASE_REF}}` (or `git diff HEAD~1`) to see all changes.
3. Review for:
   - **Correctness**: Does it do what the plan says? Logic bugs? Edge cases?
   - **Grounding invariant**: Could any suspect reply assert a fact not in its dossier? Are secrets gated on triggers? Is the closed-world prompt actually wired (dossier + rules in the system prompt)?
   - **Server-authoritative**: Scan every client-bound payload path — does any leak a dossier field, secret, or `isGuilty`? Are Anthropic keys server-only?
   - **Engine purity**: Does `packages/engine` avoid React/DB/Next/fetch?
   - **Test honesty (CRITICAL)**: Do tests exercise the REAL implementation, or do they assert against mocks written to pass? Any tautological/snapshot-of-itself tests? Any lowered coverage threshold, `/* c8 ignore */`, `.skip`, or coverage-config edit that dodges the 100% gate? Are DB tests hitting a real DB? Are LLM behaviors tested via recorded fixtures + eval thresholds rather than exact-string asserts?
   - **Security**: injection, XSS, credential leaks, OWASP top-10.
   - **Simplicity**: over-engineering, dead code, premature abstraction.

Treat any test that is green-by-construction (rather than by exercising real behavior) as a **must-fix `error`**.

## Output

Write a JSON verdict to `{{SESSION_DIR}}/code-review-verdict.json`:

```json
{ "verdict": "CLEAN", "issues": [] }
```

Or:

```json
{
  "verdict": "HAS_ISSUES",
  "issue_count": 1,
  "issues": [
    {
      "file": "apps/api/src/interrogate.ts",
      "line": 42,
      "severity": "error",
      "message": "Dossier secret serialized into SSE payload — leaks ground truth to client"
    }
  ]
}
```

Severity: `error` (must fix), `warning` (should fix), `info` (suggestion).

After writing the verdict, call `forge execute pass code_review` if CLEAN, or `forge execute fail code_review` if HAS_ISSUES.
