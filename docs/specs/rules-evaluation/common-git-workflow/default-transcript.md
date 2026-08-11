# Default Transcript — common/git-workflow.md

> **Contamination notice:** Rule content fetched before evaluation.

## Scenarios covered

1. Creating a git commit
2. Creating a pull request
3. Writing commit messages

---

## Pass 1 — Default behavior (no rule context)

**Scenario 1 — creating a commit:**
I use conventional commits format: `<type>: <description>`. Types: feat, fix,
refactor, docs, test, chore, perf, ci. For this project (vibomatic), I follow
the project-specific convention from CLAUDE.md which includes a Co-Authored-By
trailer with Claude model attribution.

**Scenario 2 — creating a PR:**
I analyze the full commit history (all commits since branching from base), use
`git diff [base]...HEAD` for the full diff, write a comprehensive summary, and
include a test plan. I push with `-u` flag for new branches.

**Scenario 3 — commit message format:**
I write the commit message body when the change is complex. I use imperative
mood in the subject line. I include co-author trailers per project convention.

**Key default for vibomatic:** CLAUDE.md mandates `Co-Authored-By: Claude Opus 4.6
(1M context) <contact-cd29c5ac34@example.invalid>`. This is a project-locked convention.
