# Framework Improvement: proposal artifacts belong in the project repo, not the skills dir

**Status:** IMPLEMENTED (2026-04-12)
**Triggered by:** User review of where 2026-04-12-diagnose-bug-taskcreate-gap.md landed

## Evidence

- **Source:** User-reported — "why do proposals exist outside repo state?"
- **Finding:** `improve-framework/SKILL.md` wrote proposal artifacts to `proposals/<date>-*.md` which resolved to `~/.claude/skills/proposals/` — outside any git repo. Proposals triggered by project-context work (e.g., WI-034 in Example Marketplace) had no audit trail in the repo that triggered them.
- **Severity:** medium — proposals are lost if skills dir resets; not visible to collaborators; breaks the "framework work as repo-tracked work" principle

## Diagnosis

- **Root cause:** `improve-framework/SKILL.md` uses a relative path `proposals/` without anchoring to the project repo. When the skill ran, it resolved relative to the skills dir (where FRAMEWORK-STATE.md lives), not relative to the project working directory.
- **Category:** fragility / missing capability
- **Split identified:**
  - `FRAMEWORK-STATE.md` → skills dir (correct — cross-project memory)
  - Proposal artifacts → project repo `docs/proposals/` (fix — project-local, git-tracked)

## Implementation

- **Route:** direct SKILL.md edit
- **Files changed:**
  - `~/.claude/skills/improve-framework/SKILL.md` — updated all `proposals/` references to `docs/proposals/`; updated recursion guard; updated Step 1.5 check; updated Step 6b move command; updated frontmatter `outputs.produces`
- **Migration:** existing proposal `2026-04-12-diagnose-bug-taskcreate-gap.md` moved from `~/.claude/skills/proposals/done/` to `docs/proposals/done/` in the project repo

## Replay Verification

- **Replay target:** Next `improve-framework` execution must write proposal artifact to `docs/proposals/` in the project repo, not `~/.claude/skills/proposals/`
- **Result:** MANUAL — change is in the skill; next execution will be the live test

## FRAMEWORK-STATE.md Mutations

- **Analysis History:** 2026-04-12 — proposal artifacts moved to project repo `docs/proposals/`. FRAMEWORK-STATE.md stays in skills dir (cross-project).
- **Decisions:** Proposal artifacts live in `docs/proposals/` of the active project repo. Skills dir `proposals/` is deprecated for new proposals.
