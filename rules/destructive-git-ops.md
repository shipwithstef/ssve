# Rule: Destructive Git Ops Must Prove No-Loss Before Running

Before running any destructive git command, the agent MUST gather and surface evidence that no uncommitted or unpushed work would be lost. "Continue autonomously" is NOT authorization for destructive ops.

## Destructive ops (non-exhaustive)

- `git reset --hard <ref>`
- `git push --force` / `git push --force-with-lease`
- `git clean -f` / `git clean -fd` / `git clean -x`
- `git checkout -- <path>` / `git restore --source=<ref> <path>` (discards local changes)
- `git branch -D <branch>` (local branch deletion)
- `git rebase --abort` mid-rebase when staged hunks exist
- `rm -rf .git` or any removal of git internals
- `git worktree remove --force`

## Required evidence BEFORE running

For each destructive op, the agent must first collect and INCLUDE the following in the same turn where the destructive command is issued:

1. **`git status --short`** — confirms the set of uncommitted / untracked files that would be affected.
2. **`git branch --show-current`** + **`pwd`** — confirms the branch and working directory (no misdirected ops).
3. **`git log --oneline @{u}..HEAD`** (if tracking branch exists) — confirms no unpushed commits would be lost.
4. **Explicit disposition** — for every file in step 1, state whether it is safe to discard and why (e.g., "restored via `git checkout` after an earlier restore"; "generated artifact; regenerable"; "unused stash").

If any file in step 1 has unknown provenance, the agent must read it before discarding.

## Safe alternatives — prefer these

- Instead of `git reset --hard origin/main` → `git fetch && git merge --ff-only origin/main` (fails cleanly if local diverges).
- Instead of `git clean -fd` → explicit `rm <specific-path>` after inspection.
- Instead of `git checkout -- .` → `git stash push -- <path>` then recover selectively.
- Instead of `git branch -D` on an unmerged branch → `git branch -d` (refuses if unmerged) and investigate.

## Why this exists

Observed 2026-04-24: an agent running under "continue autonomously" executed `git reset --hard origin/main` without first checking local state. Because the session was genuinely clean that time, no work was lost — but the practice is the hazard, not the specific outcome. "Continue autonomously" is scope authorization for the planned work; it is NOT authorization to discard local state.

## How to apply

- Before every destructive git call, emit a one-line preamble: "DESTRUCTIVE: running <cmd>. Pre-check: status=<summary>, unpushed=<count>, disposition=<safe|review>."
- If disposition is `review`, STOP. Ask the user before proceeding.
- If the context lacks the pre-check outputs, run them first.

## Reviewer hook

`review-gate`, `audit-implementation`, and `review-cross-model` should flag any commit trail or session log that contains a destructive git command without a visible pre-check. This is a blocking finding (severity: HIGH) per `rules/common/code-review.md`.
