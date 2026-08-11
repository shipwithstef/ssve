# Manifest: WI-370 (SHRUNK) — remove kimi-host hooks from the Claude blocking chain

- **Feature spec:** `docs/specs/work-items/WI-370.md` (re-measure verdict logged in pipeline-decisions 2026-06-07)
- **Branch:** `feature-wi-370-de-kimi-claude-chain`
- **Status:** SIMULATED
- **Base branch / SHA:** `main` @ `ce260765`
- **Lane:** framework (hot path wire-hooks → full chain; SHRUNK scope per the WI's own conditional)
- **Archetype:** Incremental extension (emission removal + migration in the WI-359-hardened wirer)

## Implementation Summary

**Re-measure (2026-06-07, live synthetic-payload timing):** PreToolUse(Edit) = 361ms/8 hooks (premise of ~1s collapsed post-359/361 — dispatcher would save ~280ms: DROPPED, revisit trigger = >12 blocking hooks on one matcher). PreToolUse(Bash) = 781ms, of which **618ms (79%) = `svc-kimi-branch-guard.sh` (328ms) + `svc-kimi-skill-load-enforcer.sh` (290ms)** — kimi-HOST shell scripts (~13 subshells each) unconditionally emitted into Claude settings. All 3 kimi scripts are owned by `wire-kimi-hooks.mjs` (lines 71/85/104) for the kimi host; on Claude they duplicate native guards (workflow-guard bash path, dynamic-phase-gate) at ~40× the cost.

**Change:** claude wirer stops emitting the 3 kimi-script entries (paths under hooks/kimi/); a migration strips already-wired ones (same migration block as WI-359 canonicalization); JSONL-caching slice also DROPPED (authenticity scan measured 37ms — noise).

## Files Planned

| # | File | Action | Task |
|---|---|---|---|
| 1 | `scripts/wire-hooks.mjs` | MODIFY | task-2: delete 3 emission blocks + 3 isAlreadyWired cases; add KIMI_SCRIPT_MIGRATION strip (commands containing `hooks/kimi/` removed from claude-written settings with `migrated.push` report) |
| 2 | test-framework/evals/tier-1/validate-wire-hooks-variant-dedup.sh | MODIFY | task-1 (TDD RED): +2 assertions — fixture seeded with a kimi entry must be stripped; `--list-all` emission contains no `hooks/kimi/` commands |
| 3 | test-framework/evals/tier-1/fixtures/wire-hooks-variant-dup.json | MODIFY | task-1: +1 PreToolUse kimi-script row (the stale-install repro) |

## Blueprints (compact — executor pins anchors live)

**1a (wire-hooks):** delete the three `entries.PreToolUse.push({ id: "svc-lane-tasks-pre-validator"|"svc-branch-guard"|"svc-skill-load-enforcer" ... kimiHooksDir ... })` blocks and their three `isAlreadyWired` lines (403-region). **1b:** in the WI-359 migration loop, after canonicalization: `if (h.command.includes("hooks/kimi/")) { mark entry for removal; migrated.push(\`${hookType}:kimi-host-hook-removed\`); }` — implemented as a post-loop filter pass (entries whose every hook command includes hooks/kimi/ are dropped; mixed entries keep non-kimi hooks).

**2:** validator additions:
```bash
check "kimi-host entry stripped from claude settings" test "$(q PreToolUse "sum('hooks/kimi/' in h.get('command','') for _,h in cmds)")" = "0"
check "emission contains no kimi scripts" bash -c "! env -u GIT_DIR node '$WIRER' --skills-path '$REPO_ROOT' --list-all | grep -q 'hooks/kimi/'"
```
**3:** fixture row: `{"matcher":"Bash","hooks":[{"type":"command","command":"bash /home/user/.claude/skills/hooks/kimi/svc-kimi-branch-guard.sh"}]}`.

## External State

| # | Environment | What | Coupling | Wiring |
|---|---|---|---|---|
| 1 | global Claude settings | 3 kimi entries removed at live rewire (-618ms/Bash) | coupled | WI-359 wirer backup + restore line; kimi HOST config untouched (TOML, separate wirer) |

Untouched: all other taxonomy entries (kimi host keeps its hooks via its own wirer — parity preserved where it belongs).

## AC map

AC-01 emission clean (validator) · AC-02 migration strips stale installs (fixture) · AC-03 live Bash chain ≤ ~200ms post-rewire (measured) · AC-04 kimi-host wiring untouched (wire-kimi-hooks diff-free).

## Lane Compliance
route-workflow (1, completed — re-measure + shrink decision ts in pipeline-decisions); plan-changeset (2, this manifest); 3-8 graph order; design-tech skipped (top-level reason).

## Validation
RED: new assertions fail (emission present, fixture row survives). GREEN: 21/21 validator (19+2). Final: suite via gated landing push (SHA-reuse lever); live re-measure of Bash chain.

## Rollback
Single-commit revert; settings restore line from wirer backup.

## Prerequisite Alignment Matrix

| Task | UX | UI | Tech design | Style contract | Persona |
|---|---|---|---|---|---|
| all | N/A | N/A | re-measure data (§Summary) + WI conditional honored | wirer idiom (WI-359 migration-loop reuse) | P0: -618ms on every Bash call |

## Execution Command Sequence

```bash
bash scripts/worktree.sh create feature-wi-370-de-kimi-claude-chain
set +e; bash test-framework/evals/tier-1/validate-wire-hooks-variant-dedup.sh; RED=$?; set -e
test "$RED" -ne 0 && echo "RED=$RED ok"
git add test-framework/evals/tier-1/validate-wire-hooks-variant-dedup.sh test-framework/evals/tier-1/fixtures/wire-hooks-variant-dup.json
git commit -m "test(WI-370): checkpoint-1-red" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <contact-cd29c5ac34@example.invalid>"
mkdir -p .svc && git rev-parse HEAD >> .svc/wi-370-checkpoints.log
git add scripts/wire-hooks.mjs
git commit -m "feat(WI-370): checkpoint-2-green" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <contact-cd29c5ac34@example.invalid>"
git rev-parse HEAD >> .svc/wi-370-checkpoints.log
# validation: validator 21/21; lint; diff == 3 files; suite via gated landing push
# RECOVERY_IF_FAIL: WT="$(git rev-parse --show-toplevel)"; rescue-branch if dirty; reset --keep to ledger/log-grep anchor
```
