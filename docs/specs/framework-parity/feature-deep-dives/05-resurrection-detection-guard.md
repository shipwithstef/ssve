# Deep-dive #5: Resurrection-Detection Guard (scorecard row #66)

**Source:** GSD `tests/bug-2501-resurrection-detection.test.cjs` + `unique-mechanics.md` #39: "Uses `git log --diff-filter=D` to prevent worktree merges from resurrecting files that were intentionally deleted on main."
**Decision required:** adopt OR skip.

## What the feature is

Pre-merge guard that scans the merge target for files INTENTIONALLY DELETED on main and refuses to merge a branch that resurrects them. The failure mode this prevents: long-lived feature branches were forked before a deletion landed on main; when those branches eventually merge, the deleted file comes BACK as if it was never deleted. Common cause: git's three-way merge sees the file as "added on the branch" because the branch's merge-base is older than the deletion. No human intent, just git mechanics, and the deletion silently undone.

The guard runs `git log --diff-filter=D --name-only origin/main` to enumerate intentional deletions, then checks if any of those paths exist in the current branch. If yes, refuse the merge until the user explicitly acknowledges the resurrection.

## svc current state

- `scripts/worktree.sh` — manages worktrees but does NOT check for resurrected files at merge time
- `merge-pr-with-review-receipt.mjs` — gates merge on review receipt but does NOT check for resurrections
- `hooks/svc-pre-commit-multi-host-check.sh` — pre-commit, runs before push not at merge
- `rules/destructive-git-ops.md` — exists; covers user-initiated destructive ops, not git's silent merge resurrection
- No svc artifact prevents resurrection of intentionally-deleted files

## 10 improvement scenarios

### Scenario 1: Long-lived feature branch resurrects a deleted skill

**Today (svc):** A skill was deprecated and deleted from main 3 weeks ago. A feature branch was forked 4 weeks ago. Branch merges. The deprecated skill comes BACK to main because the branch's tree still has it. No PR-level review notices because the file was just "present in the branch" — diff against the branch's merge-base shows no addition. Reviewer assumes the file was always there. Skill is now "alive" again with stale code.
**With guard:** Pre-merge check: `git log --diff-filter=D --name-only main` includes the skill's path. Branch tree contains the skill. BLOCK with "branch resurrects intentionally-deleted file `X/SKILL.md`. If this is intentional, add `resurrect-acknowledged: <path>` to the PR body."
**Improvement:** Catches the silent-resurrection class of merge bugs.
**Verdict: POSITIVE.**

### Scenario 2: Feature branch deletes a file that was already deleted on main (no resurrection)

**Today (svc):** Branch's tree doesn't have the file. Merge is clean. No issue.
**With guard:** Branch's tree doesn't have the file. Guard skips (resurrection only fires when branch HAS the file). No friction.
**Verdict: POSITIVE (no-op).**

### Scenario 3: Feature branch intentionally re-adds a file after deletion

**Today (svc):** Reviewer notices the addition in the PR diff. Approves. Merges. Works.
**With guard:** Branch HAS the previously-deleted file. Guard fires. PR body needs `resurrect-acknowledged: <path>` to merge. Reviewer (or author) adds the line, explicitly acknowledging the intent.
**Improvement:** Forces the resurrection to be explicit, which is exactly the user's intent. Mild friction (one line in PR body) for high-value documentation.
**Verdict: POSITIVE.**

### Scenario 4: Cherry-pick of a commit that pre-dates the deletion

**Today (svc):** Cherry-pick brings the file back without the resurrection being explicit.
**With guard:** Pre-merge guard catches the cherry-pick branch the same way it catches the long-lived branch. Acknowledgment required.
**Verdict: POSITIVE.**

### Scenario 5: Worktree-based development with `scripts/worktree.sh`

**Today (svc):** `worktree.sh promote` merges the worktree branch back. No resurrection check.
**With guard:** `worktree.sh promote` runs the resurrection check before invoking the merge. Same protection.
**Verdict: POSITIVE.**

### Scenario 6: Squash-merge vs merge-commit

**Today (svc):** svc uses squash-merge by default (`gh pr merge --squash`). The squash collapses the branch's commits, so the resulting commit is a "tree replacement" — git records the squashed commit as containing the file (because the branch had it). Same resurrection problem.
**With guard:** Pre-squash-merge check: compare the post-squash tree against main; flag any path that was deleted on main but present post-squash.
**Improvement:** Works with svc's existing squash-merge convention.
**Verdict: POSITIVE.**

### Scenario 7: Performance — running `git log --diff-filter=D` on large repos

**Today (svc):** N/A.
**With guard:** `git log --diff-filter=D --name-only origin/main` is O(commits since branch fork × tree size). For svc-sized repos: well under 1 second. For large monorepos: cap with `--since=<date>` based on branch fork date. Implementation should bound by `git merge-base` to limit scope.
**Mitigation:** Use `git log --diff-filter=D --name-only $(git merge-base HEAD origin/main)..origin/main` to scope to the relevant range.
**Verdict: POSITIVE with the merge-base bound.**

### Scenario 8: False positive — file was deleted then re-added, then deleted again

**Today (svc):** Edge case; not addressed.
**With guard:** `git log --diff-filter=D` shows only the most recent deletion of the path. If the path was deleted on main (latest event), guard fires. If branch also deleted it (latest in branch matches latest on main), guard skips. Correct behavior.
**Verdict: POSITIVE.**

### Scenario 9: Merging main INTO branch (rebase / sync)

**Today (svc):** No issue — main's deletion lands on branch.
**With guard:** Guard runs on the BRANCH→MAIN direction (the merge-into-main path), not main-into-branch. Bidirectional N/A.
**Verdict: POSITIVE.**

### Scenario 10: Acknowledgment friction — PR body line gets ignored or forgotten

**Today (svc):** N/A.
**With guard:** Acknowledgment line is required in PR body. `merge-pr-with-review-receipt.mjs` already parses the PR body for receipts; it can also parse for `resurrect-acknowledged:` lines. If missing → BLOCK with the exact one-liner the user needs to copy.
**Improvement:** Same enforcement mechanism as the existing review-receipt gate. Familiar pattern.
**Verdict: POSITIVE.**

### Scenario count: **10 POSITIVE.**

## Blast radius

| Touched | Type | Regression risk | Mitigation |
|---|---|---|---|
| `scripts/lib/resurrection-check.mjs` (new) | helper | — | new file; pure git command + path-set comparison |
| `scripts/merge-pr-with-review-receipt.mjs` | existing merger | LOW: add resurrection check after the receipt check, before `gh pr merge` | unit test fixture |
| `scripts/worktree.sh` (`promote` command) | existing worktree manager | LOW: invoke the resurrection check before `git merge` | unit test |
| Any other merge invocations (audit needed) | various | LOW: audit `grep -r "git merge\|gh pr merge\|--squash" scripts/ hooks/` to find all merge sites | one-time audit |
| `concerns/silent-resurrection.md` (new) | concern | — | new file |
| `rules/destructive-git-ops.md` | existing rule | LOW: extend with a "merge resurrection" subsection citing the guard | edit |
| `test-framework/evals/tier-1/validate-resurrection-detection.sh` (new) | tier-1 validator | — | new file with 5 fixtures: clean merge / resurrection blocked / acknowledgment allows / deletion-then-readd cycle / cherry-pick |

**Net regression risk:** ZERO on the happy path (clean merges proceed, intentional re-adds with acknowledgment proceed). Catches the silent-resurrection class which today is invisible.

**Edge case to watch:** the guard fires on `worktree.sh promote` AND `merge-pr-with-review-receipt.mjs`. A third merge path exists: raw `gh pr merge` from CLI (Codex round-1 caught: a local `.githooks/pre-merge-commit` does NOT run for `gh pr merge --squash` because GitHub performs the merge REMOTELY — the local hook never fires). Real mitigations:

1. **Enforce inside the receipt-aware merger itself** — `scripts/merge-pr-with-review-receipt.mjs` already gates by review receipt; extend it to ALSO check the resurrection guard against the branch tip before calling `gh pr merge`. This covers the official path.
2. **Block raw `gh pr merge`** — add a Bash-tool guard hook that refuses `gh pr merge` commands AND directs the user to `node scripts/merge-pr-with-review-receipt.mjs --pr <n> --squash --delete-branch`. The same hook already enforces the review-receipt requirement (per WI-340); extend its message to also mention the resurrection check.
3. **Server-side: optional GitHub Action** that runs the resurrection check on every PR push, blocking the merge button if the branch resurrects deleted files. Out of scope for v1 (svc has no CI infrastructure yet).

For v1, options (1) + (2) close the gap on the local path. Option (3) is a v2 enhancement when svc gains CI.

## Decision

**ADOPT.** All 10 scenarios are positive. Blast radius = zero-regression. The pre-squash-merge timing fits svc's existing merge convention. Acknowledgment mechanism (PR body line) reuses the same parser as the review-receipt gate. Real-world impact: catches a class of bugs that's invisible in code review but visible to git mechanics.

## Implementation handoff

Next PR: implement `scripts/lib/resurrection-check.mjs` + wire into:

1. `merge-pr-with-review-receipt.mjs` — primary enforcement; runs before `gh pr merge` is invoked.
2. `scripts/worktree.sh promote` — secondary enforcement for the worktree promote path.
3. **Bash-tool guard on raw squash-merge CLI** — adds the resurrection check to the existing Bash guard (the same hook that already refuses raw merge CLI without a review-receipt per WI-340). Per Codex round-2 on the deep-dive bundle: a local `.githooks/pre-merge-commit` does NOT fire when GitHub performs the squash merge REMOTELY, so a local hook alone is insufficient. The Bash-tool guard intercepts the CLI BEFORE the remote merge — that's the right enforcement point.

The `.githooks/pre-merge-commit` is NOT used for this guard (was wrong in the earlier draft). The cross-model-review-loop proposal's pre-push hook is a separate concern; install machinery may still be shared via `scripts/install-git-hooks.sh`.

Server-side: optional GitHub Action that runs the resurrection check on every PR push, blocking the merge button if the branch resurrects deleted files. Out of scope for v1 (svc has no CI infrastructure yet); v2.

Pipeline: `plan-changeset` → `review-plan` (codex) → `execute-changeset` → `review-cross-model` (codex) → `land-changeset`. Update scorecard row #66 verdict to ✅ on land.
