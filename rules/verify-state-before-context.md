---
id: svc-verify-state-before-context
type: correction
scope: universal
severity: high
---

# Rule: Verify System State Before Acting on Stale Context

When the session context mentions branches, worktrees, file states, or commit hashes that may be stale (e.g., after context compaction, long sessions, task resumption, or subagent handoffs):

## Required Verifications

1. **Before any git operation**, run `git branch`, `git status --short`, and `pwd` to confirm the actual branch and working directory.
2. **If a worktree is mentioned in context**, verify `pwd` is inside that worktree. If not, explicitly note the mismatch before acting.
3. **Never assume branch or worktree state from context memory is current.** Compacted context can be minutes or hours old.

## Read the deployed ref, not the local working tree

Local clones of multi-branch repos are routinely **parked on feature branches**, not the canonical deployed ref. The file you `Read`/`grep` is whatever branch happens to be checked out — **not** what is deployed or running.

1. For ANY claim about what is **deployed / running / current**, read `git show origin/<canonical-ref>:<path>` — never the `Read`/`grep` tool against the local working tree.
2. Before quoting file content as "what runs", run `git -C <repo> rev-parse --abbrev-ref HEAD` and compare to the canonical ref. If they differ, your working-tree read is stale and may be flatly wrong.
3. Canonical refs (this program): `ezbob-services` → `main-pilot`; `ezbob-platform` → `main-pilot`; `gitops-ezbob` → `main`; `new-devops-platform` → `main`.

**Origin (2026-06-20):** a feat-env mongo-bootstrap bug was diagnosed **three times wrong** (ephemeral-storage wipe, initdb-not-mounted, "the author forgot rs.initiate") because the diagnosis `Read` `ezbob-platform`'s working tree while it was parked on a stale feature branch (`wi179/lms-init-port-fix`). The deployed `actions/dbank-bundle-bootstrap/action.yml` on `origin/main-pilot` actually contained `--replSet rs0` + `rs.initiate()` — the stale branch lacked them. `git show origin/main-pilot:<file>` gave the correct answer instantly. The real cause was unrelated (non-fatal bootstrap guards + a cold-start CAST node-provisioning timing race), and the wrong reads sent three corrections to the wrong place first.

## Git Rename Detection

- **Do NOT use** `git show --name-only` to check for renames — it omits zero-line renames.
- **Use** `git show --stat` or `git show --name-status` instead.
- **Use** `git ls-files <path>` to verify if a file is currently tracked.

## Rationale

Treating stale context as ground truth causes:
- Commits to the wrong branch
- Redundant or impossible git operations
- False conclusions about file state (e.g., "file not tracked" when it was renamed)
- Violation of the worktree isolation model

## Example (correct)

```bash
# Context says "Active worktree: feature-x" — verify before acting
git branch          # confirm actual branch
git status --short  # confirm actual state
pwd                 # confirm actual directory
```

## Stale lane-tasks files

Before reporting any WI as `pending`, `in_progress`, or `blocked`:

1. Check git history: `git log --all --oneline --grep="$WI" | head -5`
2. If the WI has merged commits (recognizable pattern: `(#NN)`, `feat(...)`, `merge`, `land`), the WI is **not pending** — the lane-tasks file is stale from a deleted worktree or a copy that survived a merge.
3. **Do not report a stale lane-tasks file as actionable backlog.** Either rename it `<file>.completed-<PR>.json` or delete it.

The tier-1 validator `validate-stale-lane-tasks.sh` enforces this (Phase A: warn; Phase E: fail).

This was the failure mode on 2026-04-30: a status hook reported `WI-SPINE-001 tasks blocked pending approval` after PR #55 had already merged, because a copy of the lane-tasks file persisted in main's `.svc/`. Captured as WI-SPINE-006.
