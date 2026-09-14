# Manifest — WI-134 SessionStart self-heal Strategy 3

**Spec source:** `docs/specs/work-items/WI-134.md` (Diagnose-bug brief section)
**Branch:** `bugfix/WI-134-self-heal-strategy-3`
**Base branch:** `main`
**Base SHA:** `8e582aebc92f621268e1d7f2790935883fc953ea`
**Status:** DRAFTED
**Lane:** bugfix (framework)
**Archetype:** Bounded feature — three concrete files, edges defined by ACs, no codebase sweep, no architectural restructuring.
**Created:** 2026-04-29

## Implementation summary

**Changes:**
- `hooks/svc-session-start-healthcheck.mjs` — gain Strategy 3 in `detectRepoRoot()` (filesystem scan filtering `.worktrees/`); reject `.worktrees/` substrings on Strategy 1 and 2 inputs before accepting.
- New tier-1 validator `validate-source-repo-not-worktree.sh` — guards inflow (the install pointer + symlink targets must not contain `.worktrees/`).
- New tier-1 validator `validate-self-heal-survives-double-dead-pointer.sh` — guards outflow (the hook must self-heal even when both Strategy 1 and 2 inputs are simultaneously dead).
- `references/framework-learnings.jsonl` — append the structural learning (`setup-from-worktree-creates-time-bomb-symlinks`).
- `references/knowledge/svc/CAPABILITIES.md` — update self-heal description.

**Invariants preserved:**
- Strategy 1 and 2 fast paths for healthy installs (no behavior change for the common case).
- Hook never blocks the session (any failure mode still ends in `process.exit(0)`).
- Existing escape hatch `SVC_SELF_HEAL_DISABLE=1` still bypasses everything.
- Setup's worktree-refusal guard (`setup` lines 19-35, commit `52ef4eb`) stays as is.

**Constraints from brief:**
- Strategy 3 must filter `.worktrees/` paths so the scan never re-prefers a worktree match.
- Scan is bounded — `find ~/app-workspaces -maxdepth 3 -name svc-session-start-healthcheck.mjs` with a 3 s timeout.
- The scan honours `$SVC_REPO_SEARCH_PATHS` (colon-separated additional roots).
- **Strategy 3 candidate validation (F5):** a candidate path is accepted only if it contains all four: `setup`, `hooks/svc-session-start-healthcheck.mjs`, `skills-manifest.json`, and is NOT a symlink itself (`-L` test). Tie-break order: (a) prefer paths whose basename is `seriousvibecoding`; (b) prefer non-symlink canonical paths via `realpath`; (c) prefer most-recently-modified `setup` mtime. **If after all filters >1 candidate remains, log all candidates to stderr and return null** (existing warn-and-exit-0 path) unless `$SVC_REPO_SEARCH_PATHS` is set to a single root.
- **Validator host-awareness (F3):** T2 mirrors `validate-claude-skills-symlinks.sh` — if no host skills directory exists (`~/.claude/skills`, `~/.kimi/skills`, `~/.codex/skills`, `~/.gemini/skills`, `~/.config/opencode/skills`), the validator emits a PASS line "no host install dirs — nothing to check (fresh contributor environment OK)" and exits 0. When at least one exists, the validator iterates every existing host root and asserts no `/.worktrees/` substring in pointer or symlink targets.
- New validators integrate with `test-framework/evals/run-all-evals.sh` via the existing tier-1/\*.sh glob (no manifest registration).
- **External-state rollback (F2):** every task that mutates host state under `~/.<host>/skills/` MUST script the mutation with `trap restore_state EXIT INT TERM`, not document a manual restore. Applies to T1 manual smoke (now scripted), T2 negative test (now scripted), and T3 (already scripted).
- The double-dead-pointer test must restore prior state on every exit path (PASS, FAIL, error trap).

## Files planned

| File | Action | Task | Purpose |
|---|---|---|---|
| `hooks/svc-session-start-healthcheck.mjs` | MODIFY | T1 | Add Strategy 3 helper `scanForCanonicalRepo()`; filter `.worktrees/` on Strategies 1+2; call Strategy 3 when both fail. |
| **test-framework/evals/tier-1/validate-source-repo-not-worktree.sh** (CREATE) | CREATE | T2 | Tier-1 validator — fail if `~/.claude/skills/.source-repo` or any symlink under `~/.claude/skills/` contains `/.worktrees/`. |
| **test-framework/evals/tier-1/validate-self-heal-survives-double-dead-pointer.sh** (CREATE) | CREATE | T3 | Tier-1 validator — back up state, point both pointers at a dead path, run hook, assert repaired, restore on every exit path. |
| `references/framework-learnings.jsonl` | MODIFY (append) | T4 | Append `setup-from-worktree-creates-time-bomb-symlinks` learning at confidence 9. |
| `references/knowledge/svc/CAPABILITIES.md` | MODIFY | T5 | Update self-heal capability description from "self-heals when at least one pointer survives" to "self-heals unconditionally via 3-strategy fallback". |
| `docs/specs/work-items/WI-134.md` | MODIFY | T7 | Close-out: status → VERIFIED, link to PR + verification evidence. |

## Task graph

### T1 — Strategy 3 in `detectRepoRoot()`
- **Touched files:** `hooks/svc-session-start-healthcheck.mjs`
- **Dependencies:** none
- **AC coverage:** AC-03, AC-05
- **Validation:**
  - `node -e "import('./hooks/svc-session-start-healthcheck.mjs')"` — module loads.
  - Smoke (covered by T3's automated test, no manual mutation needed).
  - `bash test-framework/evals/run-all-evals.sh` — full tier-1 sweep PASS.
- **Checkpoint:** `T1-strategy-3-implemented`

### T2 — Validator: validate-source-repo-not-worktree.sh
- **Touched files:** **test-framework/evals/tier-1/validate-source-repo-not-worktree.sh** (CREATE)
- **Dependencies:** T1
- **AC coverage:** AC-04
- **Behavior contract (F3 host-aware):** iterate over `[~/.claude/skills, ~/.kimi/skills, ~/.codex/skills, ~/.gemini/skills, ~/.config/opencode/skills]`. For each existing root, check `.source-repo` and every symlink target — fail if any contains `/.worktrees/`. If none of the roots exist, emit "no host install dirs — nothing to check" and PASS.
- **Validation:**
  - Run: bash test-framework/evals/tier-1/validate-source-repo-not-worktree.sh — PASS on healthy install (or fresh contributor env with no host roots).
  - Scripted negative test inside the validator's own self-test block (or a separate scratch script with `trap restore_state EXIT INT TERM`): write `/tmp/fake/.worktrees/foo` into `.source-repo`, re-run, assert exit 1, restore on every exit path.
- **Checkpoint:** `T2-inflow-validator-shipped`
- **Parallel group:** can run alongside T3.

### T3 — Validator: `validate-self-heal-survives-double-dead-pointer.sh`
- **Touched files:** **test-framework/evals/tier-1/validate-self-heal-survives-double-dead-pointer.sh** (CREATE)
- **Dependencies:** T1
- **AC coverage:** AC-01, AC-05
- **Validation:**
  - Run: bash test-framework/evals/tier-1/validate-self-heal-survives-double-dead-pointer.sh — PASS.
  - Script must contain `trap restore_state EXIT INT TERM`; verified by reading the file post-implementation.
- **Checkpoint:** `T3-outflow-validator-shipped`
- **Parallel group:** can run alongside T2.

### T4 — Append framework learning
- **Touched files:** `references/framework-learnings.jsonl`
- **Dependencies:** T1, T2, T3
- **AC coverage:** none directly — operational durability
- **Validation:** `tail -1 references/framework-learnings.jsonl | jq -e '.confidence >= 9 and .id == "setup-from-worktree-creates-time-bomb-symlinks"'`
- **Checkpoint:** `T4-learning-recorded`

### T5 — Update svc CAPABILITIES.md self-heal description
- **Touched files:** `references/knowledge/svc/CAPABILITIES.md`
- **Dependencies:** T1
- **AC coverage:** Pillar 8 (Operations)
- **Validation:**
  - `grep -nE "3-strategy|filesystem scan|Strategy 3" references/knowledge/svc/CAPABILITIES.md` — new wording present.
  - Old "at least one pointer" wording absent or revised.
- **Checkpoint:** `T5-capabilities-updated`

### T6 — Full tier-1 sweep
- **Touched files:** none
- **Dependencies:** T1–T5
- **AC coverage:** roll-up — proof the repo is green.
- **Validation:** `bash test-framework/evals/run-all-evals.sh` — exit 0; both new validators visible and PASS.
- **Checkpoint:** `T6-tier1-green`

### T7 — WI-134 close-out
- **Touched files:** `docs/specs/work-items/WI-134.md`
- **Dependencies:** T6 + PR merged
- **AC coverage:** AC-06 (proposal — end-to-end fresh-host smoke; happens AT promotion, not pre-promotion)
- **Validation:**
  - `grep -nE '^\*\*Status:\*\* VERIFIED' docs/specs/work-items/WI-134.md`
  - AC-06 fresh-host smoke executed during `verify-promotion` (run setup from main on the merged commit, simulate worktree cleanup, start a fresh Claude session in `example-marketplace`, assert no WARN lines).
- **Checkpoint:** `T7-wi-closed`

## AC-to-task mapping

| AC | Description | Task(s) |
|---|---|---|
| AC-01 | Reproduce: create worktree, run setup, delete worktree, observe healthcheck failure → PASS post-fix | T1, T3 |
| AC-02 | `setup` rewrites or refuses to write a worktree-pathed `.source-repo` | **already shipped** (commit `52ef4eb`) — covered by T2 as ongoing inflow guard |
| AC-03 | Healthcheck `detectRepoRoot()` recovers when `.source-repo` points at a deleted worktree path | T1 |
| AC-04 | Tier-1 validator catches the bad pointer before it bites | T2 |
| AC-05 | Stale `.source-repo` self-heals on next SessionStart with no manual intervention | T1, T3 |
| AC-06 (proposal) | End-to-end: setup from main, rm a worktree, fresh session in host repo, no warnings | T7 (verified at promotion) |

## AC-to-test mapping

| AC | Test type | Where |
|---|---|---|
| AC-01 | E2E (tier-1 simulation) | `validate-self-heal-survives-double-dead-pointer.sh` |
| AC-02 | N/A — already shipped; tier-1 protection ongoing | `validate-source-repo-not-worktree.sh` (T2) |
| AC-03 | Unit-equivalent + tier-1 simulation | T1 + T3 |
| AC-04 | Tier-1 (the validator IS the test) | T2 |
| AC-05 | Tier-1 simulation | T3 |
| AC-06 | Manual smoke at promotion | T7 / `verify-promotion` |

## Validation plan

### Per-task
See each task above.

### Branch-level (post-execute, pre-promotion)
1. `bash test-framework/evals/run-all-evals.sh` — exit 0; both new validators visible. **This is the pre-promotion gate.**
2. `node scripts/lint-skills-manifest.mjs` — manifest sources still consistent.
3. `git diff main...HEAD --stat` — only the **6 manifest-listed files** modified, in this exact set:
   - `hooks/svc-session-start-healthcheck.mjs`
   - test-framework/evals/tier-1/validate-source-repo-not-worktree.sh (CREATE)
   - test-framework/evals/tier-1/validate-self-heal-survives-double-dead-pointer.sh (CREATE)
   - `references/framework-learnings.jsonl`
   - `references/knowledge/svc/CAPABILITIES.md`
   - `docs/specs/work-items/WI-134.md` (close-out happens at T7 post-merge — pre-merge diff has 5; post-merge diff has 6)
   No generated files under `test-framework/results/`, no incidental edits.

### Promotion-time (T7, runs during `verify-promotion`)
4. AC-06 end-to-end smoke (moved here from pre-promotion): on the merged main, run `./setup --host claude`; create + delete a worktree; start a fresh Claude Code session in `example-marketplace` (or any host repo); confirm no `[svc-session-start] WARN` lines in stderr.

## Checkpoint plan

Order:
1. `T1-strategy-3-implemented`
2. `T2-inflow-validator-shipped` ‖ `T3-outflow-validator-shipped` (parallel after T1)
3. `T4-learning-recorded`
4. `T5-capabilities-updated`
5. `T6-tier1-green`
6. `T7-wi-closed` (post-merge)

Rollback anchors:
- After T1 — `git revert <T1 SHA>` restores prior 2-strategy behavior; install no worse than today.
- Pre-merge — single-PR revert is the rollback (low risk per source proposal).
- **External-state rollback (per F2):** every task that mutates host state under `~/.<host>/skills/` is scripted with `trap restore_state EXIT INT TERM`. Backup paths: each script captures `cp ~/.host/skills/.source-repo /tmp/svc-test-backup-$$/source-repo` before mutation; on every exit path (PASS, FAIL, INT, TERM) restores via `cp -f /tmp/svc-test-backup-$$/source-repo ~/.host/skills/.source-repo` and re-validates that the restored pointer matches the pre-test value. T3 already implements this; T2's negative test now includes the same trap protection. T1 has no manual mutation step (smoke is covered by T3's automated test).

## External State

| # | Environment | What state | Coupling | Lifecycle wiring |
|---|---|---|---|---|
| 1 | Host filesystem — `~/.claude/skills/.source-repo` | Pointer file written by setup; read by hook every session | coupled | `setup` lines 19-35 refuse to write worktree-pathed pointer; new T2 validator fails CI if any installed pointer contains `/.worktrees/` |
| 2 | Host filesystem — `~/.claude/skills/*` symlinks | Skill-dir symlinks pointing into framework repo | coupled | T2 validator greps every symlink target; setup re-creates them on every run; healthcheck self-heal re-invokes setup when stale |
| 3 | Host filesystem — Claude settings.json (~/.claude/settings.json) hook command paths | Absolute paths to hook scripts | coupled | Existing `findMissingHookScripts()` verifies every command path resolves; self-heal re-runs setup which rewrites them |
| 4 | Filesystem search root — `~/app-workspaces` (configurable via `$SVC_REPO_SEARCH_PATHS`) | Strategy 3 scans this tree at most once per dead-install session start | decoupled-justified | Read-only scan with 3 s timeout; if canonical repo lives elsewhere AND `$SVC_REPO_SEARCH_PATHS` isn't set, Strategy 3 falls through to existing warn-and-exit-0. No state mutation; the existing user-visible WARN is the recovery prompt. |

**Untouched environments (taxonomy walked):** project DBs, GitHub state outside the lane branch, CI runners (new validators run inside same tier-1 sweep), package registries (no new deps), env files, GH Actions secrets, MCP server configs, host CLI configs (Codex/Gemini/Kimi/OpenCode), Claude Code plugin/marketplace state, skills-manifest.json, project-state.json, builder-profile.md.

## Promotion readiness checklist

- [ ] All 5–6 planned files modified — no others in the diff.
- [ ] All 5 ACs (AC-01..AC-05) mapped to a task.
- [ ] Both new tier-1 validators picked up by `run-all-evals.sh` glob.
- [ ] Both new validators PASS on a healthy install.
- [ ] T3 validator restores prior state on every exit path (verified).
- [ ] No regression in pre-existing tier-1 validators.
- [ ] No banned phrases in any task description.
- [ ] WI-134 close-out section appended; status flipped to VERIFIED post-merge.
- [ ] Framework learning appended at confidence 9 with id `setup-from-worktree-creates-time-bomb-symlinks`.
- [ ] CAPABILITIES.md self-heal description updated.

## Simulation Report

| Task | Check | Result | Action |
|---|---|---|---|
| T1 | `hooks/svc-session-start-healthcheck.mjs` exists | PASS | — |
| T1 | `detectRepoRoot()` defined at line 65; current strategies span 67-85 | PASS | Insertion point line 85 (before `return null`); modify 67-72 + 75-83 to filter `.worktrees/` |
| T1 | No new dependencies (uses `execSync` already imported line 9) | PASS | — |
| T2 | tier-1/validate-source-repo-not-worktree.sh does NOT exist | PASS | CREATE |
| T2 | `tier-1/` exists with 30+ existing `.sh` validators using `pass()`/`fail()` convention | PASS | Mirror `validate-claude-skills-symlinks.sh` |
| T2 | `run-all-evals.sh` discovers via tier-1/\*.sh glob (line 35) | PASS | No registration |
| T3 | tier-1/validate-self-heal-survives-double-dead-pointer.sh does NOT exist | PASS | CREATE |
| T3 | Test will manipulate real `~/.claude/skills/.source-repo` — needs robust trap | PASS (planned) | `trap restore_state EXIT INT TERM` mandated by manifest |
| T3 | `VALIDATOR_TIMEOUT_SEC=180` global; Strategy 3's 3 s `find` timeout fits | PASS | — |
| T4 | `references/framework-learnings.jsonl` exists | PASS | Append-only |
| T4 | Existing entries shape `{id, confidence, summary, files}` | PASS | Mirror shape |
| T5 | `references/knowledge/svc/CAPABILITIES.md` exists | PASS (verify at exec) | — |
| T6 | `bash test-framework/evals/run-all-evals.sh` available | PASS | Documented lint command |
| T7 | `docs/specs/work-items/WI-134.md` exists with brief appended | PASS | Status field line 4 flips backlog→VERIFIED |

**Imports / cross-file references:** Strategy 3 uses `execSync`, `dirname`, `existsSync` — all already imported (lines 9-11).

**Pattern-family completeness (AC-04):** narrow grep `.source-repo` + adjacent sweep `find ~/.claude/skills -type l -exec readlink {} +`. Both in T2.

**Visual-rendering ACs:** none.

**Schema drift:** N/A — no ORM schemas.

### Scenario coverage

No journey `.feature.md` files for framework infra. Substitute: source proposal lines 22-30 (live evidence).

| Scenario step | Implementing task |
|---|---|
| `cat .source-repo` returns dead worktree path | T1 (Strategy 1 filters `.worktrees/`) + T2 (CI guard) |
| `ls -la ~/.claude/skills/scripts` returns dead worktree symlink | T1 (Strategy 2 filters `.worktrees/`) |
| `detectRepoRoot()` returns null → hook warns + exits | T1 (Strategy 3 prevents null return) |
| User has to manually re-symlink | T1 + T3 (now self-heals + regression-tested) |

4/4 covered.

**Status:** SIMULATED. All checks PASS.

## Adversarial plan review (self-check)

1. **Missing tasks?** AC-01..AC-05 mapped; AC-06 verified at T7. ✅
2. **Dependency correctness?** T2/T3 ⇐ T1; T4/T5 ⇐ T1; T6 ⇐ T1–T5; T7 ⇐ T6. DAG acyclic. ✅
3. **Scope reduction?** No banned phrases. ✅
4. **Validation strength?** T1 has manual repro + tier-1 sweep. T2/T3 ARE the tests. T4 has `jq` shape assertion. T5 has +/- greps. T6 is full runner. ✅
5. **First-task viability?** T1 needs only `hooks/svc-session-start-healthcheck.mjs` + manifest from clean worktree. ✅
6. **Pattern-family completeness?** T2 covers narrow + adjacent grep. ✅
7. **Visual-rendering AC tier?** N/A. ✅

All seven pass.

## Loop-back targets

- T3 unsafe on user's real install → `design-tech` for sandboxed test directory.
- `find ~/app-workspaces` slow on some systems → `design-tech` for explicit cache or mandatory `$SVC_REPO_SEARCH_PATHS`.
- `references/knowledge/svc/CAPABILITIES.md` missing → `analyze-domain` to author it before T5 (low probability).
