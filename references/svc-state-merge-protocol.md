# `.svc` Mutable-State Merge Protocol (WI-398)

Parallel orchestrator sessions are the **normal** operating mode, not an edge
case — the Insights report measured multi-clauding at 25% of messages / 9
overlap events. Two sessions that commit divergent mutable `.svc` state will
collide on merge. This protocol makes that collision **safe and deterministic**.

## Two merge layers, one per file kind

| File kind | `.gitattributes` | Why |
|---|---|---|
| `.svc/*.jsonl` (append-only event logs) | `merge=union` (git built-in) | Concatenating both sides' lines is exactly right for an append-only log. |
| `.svc/*.json` and `.svc/**/*.json` (mutable state: lane-tasks, registries, receipts, orchestrator-state) | `merge=svc-json` (custom 3-way driver) | `union` would produce `{...}{...}` — **invalid JSON**. The driver does a structured 3-way merge instead. |

`git check-attr merge -- <file>` is the ground truth for which driver applies;
the tier-1 gate `validate-svc-state-merge-safety.sh` asserts every mutable
tracked `.svc/*.json` resolves to `svc-json` (or is gitignored regenerable
cache), so a new unprotected state file **fails closed**.

## The driver — `scripts/svc-json-merge-driver.mjs`

A deterministic 3-way merge (git passes `%O` base, `%A` ours, `%B` theirs):

- **Lossless by construction.** Every key/element present on either side
  survives a clean merge. Two sessions that add *different* keys / array
  elements (the realistic case — session A appends a task, session B appends a
  capability) auto-merge with zero loss.
- **Conflicts only on a true overlap.** A genuinely ambiguous edit (both sides
  set the same scalar key to *different* values, or modify-vs-delete the same
  key) exits non-zero so git records a normal conflict for a human to resolve.
  It is never silently resolved — **no silent data loss.**
- **Array identity.** Object elements merge by `id`/`task_id`/`ac_id`/`sha`/`key`
  when present, else by full value — so keyed collections (task graphs, receipt
  lists) merge element-wise.

If the JSON is unparseable on either side, the driver declines (exit 1) and lets
git mark a conflict rather than guess.

## Registration is per-clone (and non-breaking)

The driver **name** lives in version-controlled `.gitattributes`, but the driver
**command** must live in machine-local `.git/config` (not version-controlled).
So each clone registers it once:

- **svc repo:** `./setup` runs `scripts/install-svc-merge-driver.sh` automatically.
- **onboarded projects:** `node scripts/init-project-state.mjs <project>` provisions
  the `.gitattributes` lines and registers the driver, pointing the command at
  the framework's absolute driver path (the project has no driver script of its own).
- **by hand:** `bash scripts/install-svc-merge-driver.sh` (optionally
  `--repo <root> --driver <abs-path>`).

**Non-breaking:** if the driver is *never* registered, git falls back to its
default text merge — which produces safe conflict markers on overlap, never
corruption. The driver is a strict upgrade (auto-resolve the disjoint case), not
a dependency.

## Foreign-worktree discipline (AC3 — the `completion-guard` learning)

When more than one worktree exists, writes to `.svc` state must target the
*right* worktree, never wherever a stray persisted `cd` left the shell. This
protocol is built foreign-worktree safe:

- The driver operates **only** on the absolute paths git supplies as argv — it
  never reads cwd, never `chdir`s, never writes a relative `.svc/` path.
- The installer registers the driver with an **absolute, quoted** script path
  resolved from `git rev-parse --show-toplevel`, so a merge triggered from any
  worktree or subdirectory finds it. Git worktrees share the common
  `.git/config`, so one registration covers the main checkout and every linked
  worktree.

**Operational rule for orchestrators:** commit your own `.svc` changes
explicitly (`git -C "$WORKTREE" add .svc/<your-file>`). Do **not** `git commit
--amend` with a broad pathspec that could scoop a sibling session's uncommitted
`.svc` writes into your rewritten commit — that was the live failure on
2026-06-08 (a pathspec `--amend` scooped a sibling's `.svc` ledger writes;
unwound via mixed reset). Always use absolute paths or `git -C` when a foreign
worktree exists.

## Relationship to the in-process layer

This is the **git-merge** layer (committed divergence between sessions).
`scripts/state-io.mjs` + `scripts/state-lock.mjs` (enforced by
`validate-state-io-discipline.sh`) are the complementary **in-process** layer
(atomic single-process writes). Both are needed: atomic IO stops one process
from tearing a write; this driver stops two committed branches from corrupting
the file on merge.
