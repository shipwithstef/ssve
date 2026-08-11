# Scenario: land-changeset-merge

## Setup
A worktree branch `feature-notifications` exists under `.worktrees/feature-notifications/` with validated changes. The branch contains a plan manifest at `docs/plans/WI-007-manifest.md`, passing tests, and a clean commit history. The worktree has been reviewed and approved; no uncommitted changes remain.

## Invocation
"Land the changeset" or "promote to main"

## Expected Behavior
1. MUST validate manifest coverage by confirming `docs/plans/WI-007-manifest.md` exists and references all changed files.
2. MUST push the branch to the remote (or document the exact `git push` command that would be run).
3. MUST create a PR description summarizing the change, linking the spec, and listing verification steps.
4. MUST merge via squash (or document why squash is not appropriate) and MUST clean up the worktree directory after merge.
5. MUST clean up the worktree by removing `.worktrees/feature-notifications/` and deleting the remote branch if configured to do so.

## Success Criteria
- [ ] Manifest file is checked for existence and coverage of changed files.
- [ ] Branch push step is executed or explicitly documented.
- [ ] PR description is generated with scope, spec link, and verification checklist.
- [ ] Squash-merge is performed or a written justification for an alternative merge strategy is provided.
- [ ] Worktree directory is removed and branch cleanup is confirmed.
- [ ] Phase receipt structure:
  `jq -e '.tasks[] | select(.metadata.skill == "land-changeset" or .skill_receipt.skill == "land-changeset") | .skill_receipt.phases_executed[]? | select(.id == "P5-MergeDecisionCleanup")' .svc/lane-tasks-<WI>.json`
