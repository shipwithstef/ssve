# Git Pre-Commit Hygiene

Before every `git add && git commit` in a brownfield repo, run these three
checks. Skipping them produces commits on the wrong branch with unrelated
files attached — silently, because both `git add <specific-file>` and
`git commit` succeed without complaint.

## The three checks (mandatory, in this order)

```bash
git status            # what's modified, what's staged, what's untracked
git branch --show-current   # is this the branch you intended?
git diff --cached     # if anything is already staged, what is it?
```

## Why each check matters

| Check | Catches | Failure mode if skipped |
|-------|---------|-------------------------|
| `git status` | Pre-existing staged changes from a prior session, untracked files you'll accidentally include | Your "single-file commit" silently picks up someone else's WIP |
| `git branch --show-current` | Wrong branch (especially after a session resume or worktree switch) | Commit lands on a feature branch that won't get merged, or on `main` when it should be on a feature branch |
| `git diff --cached` | If staging is non-empty before you `git add`, this shows what's already there | Your commit message describes one file but the diff is four files |

## The trap pattern

```bash
# You THINK this commits one file:
git add path/to/my-file.yaml
git commit -m "fix: my single-file change"

# But if the index already had three other files staged from
# a prior session (visible in `git status`), the commit contains FOUR files.
# git add does not "stage only this file" — it ADDS to the existing index.
```

## Worktree extension

The same trap applies inside a worktree, with an extra dimension: the
worktree's branch may not be what you expect after a `git worktree add`
that ran with `--track` against a different upstream. Always check
`git branch --show-current` from inside the worktree before committing.

## When this rule applies

- Every commit in a brownfield repo with multiple in-flight changes
- Every commit after resuming a session (the index state is not in your context)
- Every commit immediately after switching branches or worktrees
- Every commit on a repo where multiple humans or agents share the working copy

## When you can skip (rare)

- Greenfield repo, single-author, no prior session state — the index is
  always empty, branch is always known.
- Automated CI scripts where the working copy is freshly checked out per run.

## Origin

WI-037 close-out 2026-05-06: produced commit `272b3149` on branch
`wi-014-backstage-port` (intended target was `main`) containing four files
(intended one). The `git add <single-file> && git commit` pattern picked up
three pre-existing staged preview-pr-380 overlay edits from a prior session.
Push failed (non-fast-forward), forcing a hard reset and re-application —
~15 minutes of recovery work that two `git status` lines would have prevented.
