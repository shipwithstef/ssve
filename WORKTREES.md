# Worktree Model

All repository mutation runs in a linked git worktree under `.worktrees/`.
This includes planning documents, framework docs, generated files, tests, and
repo-local `.svc` state. Worktrees isolate in-progress changes from the default
checkout, enable parallel work, and make squash-merge promotion clean.

## When to Create a Worktree

| Condition | Worktree? | Why |
|-----------|-----------|-----|
| Any create, edit, append, or generation in the repository | **Always** | Every mutation needs an attributable WI/worktree/session owner |
| Session-contract, task-graph, claim, plan, or other repo-local `.svc` write | **Always** | Runtime state is repository mutation too |
| `execute-changeset`, tests that write fixtures, and framework edits | **Always** | Code, docs, tests, and generated files use the same isolation rule |
| Read-only discovery, inspection, review, or audit | Not required | Reads may inspect the default checkout without creating a worktree |
| External job/runtime temp outside every repository root | Not required | External temp is outside repository state |
| `land-changeset` merge or read-only `verify-promotion` checks | Policy-controlled | The default checkout is allowed only for the explicit merge/read operations |

## Per-Lane Worktree Map

| Lane | Read-only default checkout | Linked worktree (all mutation) | Default checkout after review |
|------|----------------------------|--------------------------------|-------------------------------|
| **Greenfield** | discovery and inspection | vision through verified branch state | explicit merge + read-only post-merge proof |
| **Brownfield Feature** | discovery and inspection | spec through verified branch state | explicit merge + read-only post-merge proof |
| **Bugfix** | diagnosis and inspection | plan through verified fix | explicit merge + read-only post-merge proof |
| **Refactor** | discovery and inspection | plan through verified refactor | explicit merge + read-only post-merge proof |
| **Brownfield Conversion** | discovery and inspection | every created or changed artifact | explicit merge + read-only post-merge proof |
| **Drift** | drift inspection | every created or changed artifact | explicit merge + read-only post-merge proof |
| **Framework** | discovery and inspection | every created or changed framework artifact | explicit merge + read-only post-merge proof |

**The worktree IS the change branch.** Planning artifacts, code, docs, tests,
generated state, and any review artifact writes all happen inside it. Read-only
review may inspect either checkout. Only policy-approved merge operations and
read-only post-merge verification may use the default checkout.

## Branch Naming Convention

| Lane | Pattern | Example |
|------|---------|---------|
| Greenfield / Brownfield Feature | `feature-<name>` | `feature-notifications` |
| Bugfix | `bugfix-<name>` | `bugfix-auth-500` |
| Refactor | `refactor-<name>` | `refactor-api-layer` |
| Framework Test | `test-<name>` | `test-autopilot-s1` |

The branch name is defined in the `plan-changeset` manifest header.

## Rules

1. **All worktrees live under `.worktrees/`** — never `/tmp/`, never a sibling directory.
   Exception: `test-framework` eval tier-2 uses temp dirs (not git worktrees).

2. **`.worktrees/` must be in `.gitignore`** — enforced by `scripts/worktree.sh preflight`
   and validated by `test-framework/evals/tier-1/validate-worktree-safety.sh`.

3. **One worktree per branch** — the branch name is the worktree directory name.

4. **Create is idempotent** — `worktree.sh create` on an existing worktree reports it
   and exits 0, enabling chain resume after interruption.

5. **Clean up after promotion** — `land-changeset` Step 7 calls `worktree.sh remove`.

6. **No orphans** — `worktree.sh cleanup` finds and removes stale worktrees.

7. **No path-based exceptions** — documentation, tests, generated files, and
   `.svc` state are not safe to mutate in the default checkout.

8. **Bootstrap is narrow** — the exact `svc-ensure-worktree` command may create
   git metadata and `.worktrees/<branch>` only; it may not edit tracked files.

## Authority and Nested Execution

The session checkout and the operation worktree are separate facts. Mutation
resolution canonicalizes the explicit host `tool_input.workdir` and every file
target, identifies each exact Git worktree/common directory, and rejects missing,
dangling, mixed-worktree, mixed-repository, nested-repository, submodule, symlink,
or workdir/target contradictions. A command launched from a non-Git directory is
still governed when its targets resolve into a governed repository.

A controller holds one repository-shared v2 lease for a WI/worktree/generation.
Same-session resume reattaches without changing generation. Handover and recovery
atomically increment generation, invalidating old receipts and freezing child
delegations.

Parallel leaf tasks live in a nested execution graph under the single
`execute-changeset` lane task. Each mutating child receives its own inner
worktree and disjoint path capability. The child cannot mutate parent `.svc`
state, lease, graph, sibling output, or shared files. The parent recomputes the
completion receipt and merges results sequentially.

PreTool checks reject obvious shell escapes, but they are an authority guardrail,
not a complete shell security boundary. Real containment is supplied by a host
sandbox or the probed Landlock command wrapper. Without either, the host remains
controller-only.

## Commands

```bash
# Create a worktree (idempotent — resumes if exists)
scripts/worktree.sh create feature-notifications

# Create from a specific base
scripts/worktree.sh create bugfix-auth --from main

# Check if you're in a worktree
scripts/worktree.sh status

# Enter an existing worktree (shows cd command)
scripts/worktree.sh enter feature-notifications

# Promote: squash-merge to main (stages but does not commit)
scripts/worktree.sh promote feature-notifications

# Remove after promotion
scripts/worktree.sh remove feature-notifications

# Force-remove (discards uncommitted changes)
scripts/worktree.sh remove feature-notifications --force

# List all active worktrees with status
scripts/worktree.sh list

# Find and remove orphans
scripts/worktree.sh cleanup

# Run safety checks only
scripts/worktree.sh preflight
```

## Worktree Guard (automatic detection)

Before its first repository write, every skill must ensure and enter the bound
worktree. Read-only skills may inspect the current checkout without ensuring one:

```bash
node scripts/svc-ensure-worktree.mjs --wi <WI> --branch <branch> --from origin/main --json --print-cd
```

The helper returns the absolute worktree path plus WI, branch, owner session,
base SHA, and whether it created or resumed the worktree. Change directory to
that absolute path and pass the same identity baton to every mutating skill.
Refuse a WI, branch, path, or owner mismatch instead of silently switching.

The flow is: **read-only default checkout → ensured worktree (all mutation and
validation) → policy-approved default checkout merge/read-only verification**.
The change must be fully validated inside the worktree before merge.

## Lifecycle

```
main ──────────────────────────────────────────────────► main
      │                                           ▲
      │ worktree.sh create                        │ gh pr merge --squash
      ▼                                           │
   .worktrees/feature-x                           │
      ├── execute (TDD per task)                  │
      ├── review (G5 in branch)                   │
      ├── E2E (all tests green)                   │
      ├── push (git push -u origin)               │
      └── open PR (gh pr create) ─────────────────┘
                                        then: worktree.sh remove
```

1. **Create** — `route-workflow` calls `svc-ensure-worktree` before the first
   repository write. The helper creates or resumes the bound worktree without
   running setup or repointing installed skill symlinks.

2. **Build** — `execute-changeset` runs inside the worktree. Each task is TDD:
   write test → fail → implement → pass → checkpoint commit.

3. **Validate** — still inside the worktree:
   - `review-gate` reviews the code in the branch
   - `write-e2e` runs E2E tests against the branch
   - All tests must pass before the feature leaves the worktree

4. **Land** — `land-changeset` validates manifest coverage, pushes the branch,
   opens a PR via `gh pr create`, merges via `gh pr merge --squash`.

5. **Clean up** — `land-changeset` runs `worktree.sh remove <branch>`.
   Removes worktree directory and deletes the local branch.

6. **Verify** — `verify-promotion` runs on main, confirms the merge is clean.

## Interruption Recovery

If a chain is interrupted (session ends, token limit, crash):

1. **Check what's live:** `scripts/worktree.sh list`
2. **See worktree status:** `scripts/worktree.sh enter <branch-name>`
3. **Resume execution:** re-invoke `execute-changeset` — Step 0 detects the
   existing worktree via `worktree.sh create` (idempotent) and picks up where
   the manifest checkpoints left off.
4. **If the worktree is stale:** `scripts/worktree.sh remove <branch> --force`
5. **Clean all orphans:** `scripts/worktree.sh cleanup`

The manifest's task checkpoints (commit per task) serve as resume markers.
`execute-changeset` reads checkpoint commits to know which tasks are done.


## Mandatory Plan-Exec-Review Chain (added by mandatory-chain rollout)

The `feat/mandatory-plan-exec-chain` branch introduces a three-layer
enforcement system that makes plan-changeset + review-plan +
execute-changeset + review-exec + audit-implementation + land-changeset
+ verify-promotion mandatory for every non-quick-fix change.

Key additions:
- `skills/review-exec/SKILL.md` — new G6 gate (self-review + adversarial via resolver)
- `scripts/quick-fix-eligibility.mjs` — mechanical quick-fix gate
- `scripts/svc-reconcile.mjs` — local L3 gate (responsibilities A + B)
- `scripts/run-external-review.mjs` — canonical schema/receipt/cache review launcher
- `scripts/resolve-adversarial-reviewer.sh` — probe-free exact tuple policy view
- `scripts/install-git-hooks.mjs` — installs hook dispatchers into .git/hooks/
- `hooks/git/{pre-commit,post-commit,pre-push}.d/` — slot directories
- `refs/notes/svc-receipts` — durable receipt store (per commit)
- Working-tree mirror at `.svc/receipts/<sha>/` (gitignored, regenerable)

For full context: see the plan-changeset producing this work and
`references/chain-receipt-contract.md`.
