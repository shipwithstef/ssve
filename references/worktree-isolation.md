# Worktree isolation policy

Repository mutation belongs in a linked worktree under `.worktrees/`. The default checkout is a coordination and merge surface, not an editing surface.

## Decision contract

| Class | Default checkout | Bound linked worktree | Outside repository |
|---|---:|---:|---:|
| Recognized read-only operation | allow | allow | allow |
| `svc-ensure-worktree.mjs` bootstrap | allow | not applicable | not applicable |
| Repository mutation, including docs, tests, generated files, and `.svc` | deny | allow with exact session/worktree/WI binding | not applicable |
| Approved external job/runtime temp | allow | allow | allow |
| Ambiguous write-capable operation | deny | allow only with exact binding | allow |

Read-only shell commands use the WI-485 classifier: `git status|log|diff|show`, `ls`, `pwd`, `cat`, `head`, `tail`, `rg` without replacement/execution options, `find` without mutation/execution actions, `test`, `wc`, `sha256sum`, and exact `node --check <file>`. `sed`, redirects, pipelines, chaining, subshells, command substitution, quoting/escaping ambiguity, or unlisted options are write-capable.

Symlinks do not cross the boundary. A path lexically under external temp but resolving into any repository worktree is a repository path.

## Ensure a worktree

Fetch first, then run the one bootstrap mutation permitted from a clean, current default checkout:

```bash
git fetch origin main
node scripts/svc-ensure-worktree.mjs --wi WI-482 --branch framework-WI-482-default-checkout-isolation --from origin/main --print-cd
```

The helper accepts only `origin/main` or an explicit immutable 40-character commit. It verifies `.worktrees/` is ignored, the default checkout is completely clean, and the local default checkout equals `origin/main` unless an immutable SHA is supplied. It creates only `.worktrees/<branch>`, never runs setup, and never changes installed skill symlinks.

Create and resume are idempotent only when branch, path, WI, and owning session all agree. A pre-existing branch, foreign owner, mismatched binding, stale default checkout, dirty checkout, or unsafe path exits with status 2.

## Binding and ownership

Every mutating linked worktree has a WI-484 binding and fresh claim. The binding fixes four identities together: repository, worktree, branch, and host session. Read-only sessions do not gain mutation authority from a branch name or a task graph.

Status surfaces must report WI, absolute worktree, branch, and owning session. Cleanup releases the session binding and preserves the released claim generation for explicit compare-and-swap transfer before removing the linked worktree.

## Emergency override

An interactive operator may set all four values for at most 30 minutes:

```text
SVC_ISOLATION_OVERRIDE=1
SVC_ISOLATION_OVERRIDE_SESSION=<current host session>
SVC_ISOLATION_OVERRIDE_EXPIRES_AT=<ISO-8601 timestamp no more than 30 minutes ahead>
SVC_ISOLATION_OVERRIDE_REASON=<non-empty incident reason>
```

The guard appends a mode-0600 receipt under the user runtime directory. Missing, expired, overlong, foreign-session, or reasonless overrides are denied. Automated lanes must never set the override.

## Recovery and cleanup

Do not weaken the guard to recover a collision. Inspect `git worktree list --porcelain` and the worktree's `.svc/bindings/` and `.svc/claims/` records. Release only the current session's binding; transfer a stale or released claim with its exact expected generation. Remove the worktree through `scripts/worktree.sh remove` so binding release precedes `git worktree remove`.

If the ensure lock remains after a crash, verify the recorded PID is dead before deleting that specific runtime lock. Never delete the runtime lock directory wholesale.
