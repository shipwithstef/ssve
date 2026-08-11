# Framework Evolution — 2026-04-23 — Chain Integrity & Claude Hook Parity

**Status:** IMPLEMENTED

## Method

Triggered by comprehensive audit of skill chaining, hooks state machine, and tier-1 eval coverage. Four categories of gaps were identified and closed in a single framework self-improvement iteration.

## Findings (by priority)

### P0 — Chain declaration drift (blocks progressive mode correctness)

**Evidence:** Cross-referencing `skills-manifest.json` `laneDefinitions` against individual `SKILL.md` `chain.lanes` frontmatter revealed multiple mismatches.

| Skill | Field | Was | Should be |
|-------|-------|-----|-----------|
| `benchmark-landing` | greenfield position | 12 | 18 |
| `benchmark-landing` | greenfield next | design-tech | review-gate |
| `benchmark-landing` | brownfield-feature position | 8 | 14 |
| `benchmark-landing` | brownfield-feature next | design-tech | review-gate |
| `review-gate` | greenfield position | 18 | 19 |
| `review-gate` | brownfield-feature position | 14 | 15 |
| `audit-implementation` | greenfield position | 19 | 20 |
| `audit-implementation` | brownfield-feature position | 15 | 16 |
| `land-changeset` | greenfield position | 20 | 21 |
| `land-changeset` | brownfield-feature position | 16 | 17 |
| `verify-promotion` | greenfield position | 21 | 22 |
| `verify-promotion` | brownfield-feature position | 17 | 18 |

Root cause: `benchmark-landing` was inserted into manifest lanes after initial chain declarations were written. Skills after it were never updated. `benchmark-landing` itself had a copy-paste error (copied `design-tech`'s chain block).

**Impact:** Progressive auto-advance would chain `benchmark-landing` → `design-tech` instead of `benchmark-landing` → `review-gate`, skipping audit-implementation and land-changeset.

### P1 — Claude hook under-wiring (degraded protection for Claude users)

**Evidence:** `scripts/wire-hooks.mjs` only auto-wired `svc-eval-gate-pre` and `svc-eval-gate-post`. `hooks/hooks.json` documents 11 Claude-compatible hooks across PreToolUse, PostToolUse, and Stop events. Manual copy-paste from `hooks.json` was required for all other hooks.

| Event | Hook | Auto-wired? |
|-------|------|-------------|
| PreToolUse | svc-workflow-guard | ❌ |
| PreToolUse | svc-phase-boundary-detector | ❌ |
| PreToolUse | svc-bash-guard | ❌ |
| PreToolUse | svc-eval-gate-pre | ✅ |
| PostToolUse | svc-eval-gate-post | ✅ |
| PostToolUse | svc-edit-accumulator | ❌ |
| PostToolUse | svc-vibe-auditor | ❌ |
| PostToolUse | svc-lane-tasks-validator | ❌ |
| PostToolUse | svc-wi-pillars-check | ❌ |
| Stop | svc-stop-quality | ❌ |
| Stop | svc-task-completion-guard | ❌ (wired in .claude/settings.json repo file, not by setup) |

**Impact:** Claude users running `setup --host claude` received only eval-gate hooks. No config protection, phase boundary enforcement, bash guard, edit accumulation, lane-tasks validation, or batch quality checking.

### P1 — Tier-1 validation gaps (undetected drift)

**Evidence:** `validate-chain-references.sh` checked reference existence and lane membership, but NOT:
- `position` matches manifest lane order
- `next` appears after current skill in manifest lane
- `progressive: true` requires non-empty `lanes`

The benchmark-landing copy-paste error and the position drifts survived tier-1 for an unknown duration.

### P2 — No Claude hook E2E test (asymmetric coverage)

**Evidence:** `validate-kimi-hook-e2e.sh` existed and passed. No equivalent existed for Claude hooks. The 9 new Claude hooks had no deterministic runtime validation.

## Fixes Applied

1. **Chain fixes** — Updated 7 skills' frontmatter positions and next-skills to match manifest:
   - `benchmark-landing`, `review-gate`, `audit-implementation`, `land-changeset`, `verify-promotion`
   - Also fixed `manage-finops` and `monetization-architecture` (`progressive: false` with empty lanes)

2. **wire-hooks.mjs expansion** — Added all 11 Claude-compatible hooks with:
   - Profile control (`SVC_HOOK_PROFILE=minimal|full`)
   - Selective disable (`SVC_DISABLED_HOOKS=<comma-list>`)
   - Proper idempotency by hook ID (not just eval-gate string matching)

3. **Tier-1 validators** — Added 3 new scripts:
   - `validate-chain-position.sh` — validates position and next-skill ordering
   - `validate-progressive-consistency.sh` — validates progressive→lanes consistency
   - `validate-claude-hook-e2e.sh` — synthetic payload tests for Claude hooks

4. **Tier-1 suite** — Now 17 scripts (was 14), all passing.

## Correction: What Claude Actually Supports

**Initial audit incorrectly concluded Claude only supports PreToolUse/PostToolUse/Stop.** After reading `https://code.claude.com/docs/en/hooks`, Claude Code supports **27 hook events** including SessionStart/End, UserPromptSubmit, SubagentStart/Stop, PreCompact/PostCompact, StopFailure, Notification, TaskCreated, TaskCompleted, and others.

**All Kimi lifecycle hooks were ported to Claude** by updating the Kimi wrapper scripts to handle both `agent_name` (Kimi) and `agent_type` (Claude) field names. The framework now wires **21 hooks** on `setup --host claude`.

**Framework lesson:** The `evolve-framework` and `improve-framework` skills need a mandatory "check host documentation for current capabilities" checkpoint before any host-specific implementation. The `research` skill should be invoked when uncertainty exists about host API surface.

## Verification

- `bash test-framework/evals/run-all-evals.sh` → **17/17 pass**
- `node scripts/lint-skills-manifest.mjs` → **pass**
- `node scripts/wire-hooks.mjs --skills-path ~/.claude/skills --dry-run` → **21 new hooks would be added**
