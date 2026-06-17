# Create Pull Request

Create a pull request for the completed pipeline changes.

## Instructions

1. Read the plan at `{{PLAN_FILE}}` to understand what was implemented.
2. Read `{{SESSION_DIR}}/pipeline-output.md` for step results.
3. Stage and commit all changes (if not already committed) on a feature branch.
4. Push the branch to the remote.
5. Create a PR with `gh pr create`:
   - Title under 70 chars summarizing the change.
   - Body with: a 2-3 bullet summary, the test plan (which suites ran + coverage), and `Closes #<issue>` for the corresponding backlog issue.

## Output

Write the PR URL to `{{SESSION_DIR}}/pr-url.txt`.

After creating the PR, call `forge execute pass create_pr`. If it cannot be created, call `forge execute fail create_pr "reason"`.
