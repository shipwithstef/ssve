# Framework Improvement — 2026-04-26 — `.source-repo` Must Be Canonical Repo, Not Worktree

**Status:** DRAFT — escalated by user after 2nd recurrence (today, mid-session in `example-marketplace` repo).

## Problem

WI-079, WI-080, WI-116, WI-124 each addressed worktree-deletion symlink rot. The expectation after WI-124 ship was: "next session in any host repo, the SessionStart hook silently self-heals."

Today (2026-04-26), in a fresh `example-marketplace` session, **76 dead symlinks** under `~/.claude/skills/` plus the `hooks/` and `scripts/` symlinks themselves were broken. Self-heal did NOT fire. User had to interrupt twice while the agent manually repointed symlinks one batch at a time.

## Root Cause (verified live this session)

`hooks/svc-session-start-healthcheck.mjs` `detectRepoRoot()` has two strategies:

1. Read `~/.claude/skills/.source-repo` and check `existsSync(${p}/setup)`.
2. Walk `~/.claude/skills/scripts` symlink, take parent.

**Both strategies failed simultaneously** because `setup` (run earlier from a worktree) wrote BOTH the `.source-repo` pointer AND every symlink under `~/.claude/skills/` to point into `/workspace/seriousvibecoding/.worktrees/wi-125-kimi-detached-runner/`. When that worktree got cleaned up, the pointer file pointed at a dead path, the `scripts` symlink pointed at a dead path, so `detectRepoRoot()` returned null and the hook only printed a warning.

Live evidence captured in the session:

```
$ cat ~/.claude/skills/.source-repo
/workspace/seriousvibecoding/.worktrees/wi-125-kimi-detached-runner

$ ls -la ~/.claude/skills/scripts
... -> /workspace/seriousvibecoding/.worktrees/wi-125-kimi-detached-runner/scripts  (dead)
```

WI-124's self-heal works *only* when at least one of the two pointers still resolves. The class of failure where **`setup` was last run from a worktree that has since been removed** defeats both pointers in lockstep.

## Goal

Make symlink rot from worktree-deletion unrecoverable-by-warning *impossible*. After this lands, the user should never again have to fix dead skill symlinks manually, regardless of which checkout `setup` was last run from.

## Non-Goals

1. Forbidding `setup` from running inside a worktree (legitimate for testing setup changes; flag already exists).
2. Replacing the symlink-based install model (orthogonal — would be a much larger refactor).

## Proposed Fix (two-part, both required)

### Part A — `setup` writes the canonical (main worktree) repo path, not `$PWD`

When `setup --host claude` runs, resolve the **canonical, non-worktree** repo root before writing `~/.claude/skills/.source-repo` and before creating each `ln -s`:

```bash
# In setup, replace any "REPO_ROOT=$(pwd)" / "REPO_ROOT=$(git rev-parse --show-toplevel)"
# with a worktree-aware resolution:
GIT_COMMON_DIR=$(git rev-parse --git-common-dir)         # e.g. /path/main/.git or /path/main/.git/worktrees/foo/../..
CANONICAL_REPO=$(cd "$GIT_COMMON_DIR/.." && pwd -P)      # walks past .git/worktrees/*/ to the main checkout
REPO_ROOT="$CANONICAL_REPO"
```

This means symlinks always target the long-lived main checkout, not the ephemeral worktree where setup happened to run. Worktree deletion stops breaking anything.

Edge case: someone running setup outside a git checkout (or from a tarball) — fall back to `$PWD` as today, but add a one-line warning so the user knows the install is tied to the current path's lifetime.

### Part B — Self-heal hook gets a third-strategy fallback

Add `detectRepoRoot` strategy 3: scan `~/app-workspaces/*` (and `$SVC_REPO_SEARCH_PATHS` if set) for any directory containing both `setup` and `hooks/svc-session-start-healthcheck.mjs`. Pick the most recently modified match. This is the "everything else broken" backstop — guarantees self-heal runs even if both pointer + scripts symlink are simultaneously dead.

```js
// strategy 3 — last-resort filesystem scan
function scanForRepo(home) {
  const candidates = execSync(
    `find ${home}/app-workspaces -maxdepth 3 -name svc-session-start-healthcheck.mjs 2>/dev/null`,
    { encoding: "utf8", timeout: 3000 }
  ).split("\n").filter(Boolean);
  for (const c of candidates) {
    const repo = dirname(dirname(c)); // .../<repo>/hooks/<file> → .../<repo>
    if (existsSync(`${repo}/setup`) && !c.includes("/.worktrees/")) return repo;
  }
  return null;
}
```

Filter out `.worktrees/` paths so we never re-prefer a worktree.

## Acceptance Criteria

- AC-01 `setup` writes `.source-repo` and all `~/.claude/skills/*` symlinks pointing at the canonical main-worktree path even when invoked from inside a `.worktrees/<name>/` checkout. Verified by running setup from a temporary worktree and grepping resulting symlink targets — none contain `.worktrees`.
- AC-02 New tier-1 validator `validate-source-repo-not-worktree.sh`: greps `~/.claude/skills/.source-repo` and every symlink target under `~/.claude/skills/`, fails if any contain `.worktrees/`.
- AC-03 `detectRepoRoot` in `hooks/svc-session-start-healthcheck.mjs` adds strategy 3 (filesystem scan, ignoring `.worktrees/`).
- AC-04 New tier-1 validator `validate-self-heal-survives-double-dead-pointer.sh`: simulates dead `.source-repo` + dead `scripts` symlink, runs the hook, asserts symlinks are repaired and exit 0.
- AC-05 Full tier-1 sweep PASS.
- AC-06 Run `./setup --host claude` once from main checkout after the fix; manually `rm -rf` a recently-used worktree; start a fresh Claude session in `example-marketplace`; symlinks remain healthy with zero user-visible warnings or interventions.

## File Impact

| File | Change |
|---|---|
| `setup` | **modify** — resolve canonical repo root via `git rev-parse --git-common-dir` before writing pointer/symlinks |
| `hooks/svc-session-start-healthcheck.mjs` | **modify** — add strategy 3 to `detectRepoRoot`; filter `.worktrees/` |
| `test-framework/evals/tier-1/validate-source-repo-not-worktree.sh` | **create** |
| `test-framework/evals/tier-1/validate-self-heal-survives-double-dead-pointer.sh` | **create** |
| `references/framework-learnings.jsonl` | **append** — `setup-from-worktree-creates-time-bomb-symlinks` |

## Scope boundary

- touches: 5 files above.
- must-not-touch: skill SKILL.md files; route-workflow logic; manifest; worktree.sh.

## Rollback

Single PR revert. The strategy-3 fallback is purely additive; the setup canonicalization is a one-line change at the top of the script.

## Size

- Files: 5. Lines: ~60. Mostly additive, one substantive setup line.
- Risk: low. Setup change is well-contained behind `git rev-parse`.

## Why prior WIs didn't catch this

- WI-079 added detection of dead symlinks (validator only — no fix path).
- WI-080 cleaned up orphan symlinks at setup time (only fires when setup runs — but stale `.source-repo` *prevents* setup from being found, so this never fires post-rot).
- WI-116 introduced the soft warn.
- WI-124 added self-heal — but assumed at least one of `.source-repo` or `scripts` symlink would survive. The "setup was last run from a worktree that's now deleted" failure mode was not in the test matrix; both pointers die together because they were both born pointing into the same ephemeral path.

The pattern: **all four prior WIs treated "stale symlink" as the bug. The actual bug is "install is bound to an ephemeral path."** Fix the install, the staleness can't happen.

## User signal

User interrupted twice this session ("YOU KEEP FIXING AND FIXING FIXING THESE SHIT OVER AND OVER"). This is the third documented recurrence after WI-124 was supposed to make it self-healing. Treating as P0 quality-of-life regression for the framework user.

---

## Resolution

**Closed:** 2026-04-27 (promoted to WI for execution)
**Promoted as:** WI-134 (status:backlog, severity:high)
