# Worktree/Branch Hygiene Closeout

Use this when a route-workflow run created or used temporary worktrees/branches
and then completed by merge, deployment, or explicit closeout. The closeout
must not leave scoped workspace state open implicitly.

## Required Checks

Run these from the repository root:

```bash
git worktree list --porcelain
git branch --list '<scope-pattern>*' -vv
git fetch --prune origin
git ls-remote --heads origin '<scope-pattern>*'
```

Replace `<scope-pattern>` with every canonical alias for the completed scope,
not only the exact branch prefix. For a WI, this means at minimum:

- compact lowercase: `wi304`
- hyphenated lowercase: `wi-304`
- hyphenated uppercase: `WI-304`
- exact completed branch slug: for example `wi304-account-provisioning-research-20260524`

Run the local branch, remote branch, and worktree checks for each alias. A
closeout that checks only the active branch name is incomplete, because staged
or earlier sub-branches such as `wi-304-stage1-*` and `wi304-wi066-*` can remain
after the final PR is merged.

For squash-merged PRs, the branch head is usually not an ancestor of `origin/main`.
In that case, use the GitHub PR state as merge proof for branch deletion:

```bash
gh pr list --head '<branch>' --state all --json number,state,mergedAt,url
```

## Cleanup Rules

- Remove completed clean worktrees with `scripts/worktree.sh remove <branch>`
  when the target repo has the helper.
- If the target repo has no helper, use `git worktree remove <path>` after
  verifying the worktree is clean.
- Delete stale local branches only after verifying the PR is merged or the
  branch is an ancestor of `origin/main`.
- Delete stale remote branches only after verifying the PR for that head is
  `MERGED`, or, when there is no PR, the branch is an ancestor of `origin/main`.
- Preserve remote branches with open PRs, closed-unmerged PRs, no PR and no
  ancestry proof, or user-requested retention.
- Preserve dirty, unmerged, open-PR, or user-requested worktrees/branches and
  record the exact preservation reason.

## Final Response

Name the alias set used for the scan, all scoped worktrees removed or preserved,
local branches deleted or preserved, remote branches deleted or preserved, and
blockers that prevented cleanup.
