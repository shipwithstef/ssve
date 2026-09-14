# WI-479 Change-Set Manifest — Autonomous-loop contract (blend item 1)

**Date:** 2026-07-14 | **Lane:** framework | **Risk class:** M (new governance reference + fleet agent pointers; no code logic)
**Execution mode:** inline single-orchestrator (one worktree, one implementation commit)
**Spec:** `docs/specs/work-items/WI-479.md` ACs + `proposals/2026-07-13-blend-coreyhaines-v2.6.0.md` § Blend item 1
**Source (quote, no fabrication):** `references/knowledge/competitors/coreyhaines-martech/details/new-skills-v2.0-v2.6.md` § marketing-loops (upstream loop-state / loop-guardrails / loop-orchestration)

## File set & two-commit strategy

**Commit P (planning, exempt, lands on main BEFORE the worktree):** this manifest, review-log.yaml (+ raw captures), mechanical-gate.log, `.svc/lane-tasks-WI-479.json`, `.svc/pipeline-decisions.jsonl` appends. (WI-479.md + INDEX row already landed in filing commit 22df12ef.)

**Commit M (implementation, worktree branch `WI-479-autonomous-loop-contract`):** blueprints #1–8.

## Scope decisions

1. **Core deliverable = one new reference doc** references/autonomous-loop-contract.md (created by this WI) (scratchpad-drafted, source-faithful): loop-state schema (§1), run-log + vanity rule (§2), Tier-1/Tier-2 model (§3), compliance map (§4), promotion prerequisites (§5), hybrid receipts (§6), orchestration/rollout (§7). Every claim traces to the upstream source; svc adaptations (`.svc/loops/` path, receipts hybrid) are labeled svc-native.
2. **State path is svc-native:** the .svc/loops/ per-loop JSON for framework loops (`.agents/loops/` for onboarded product repos, matching upstream). NOT `.agents/` for framework loops.
3. **What NOT to take (honored):** no 43-loop catalog copy; no new scheduling mechanics (defer to `/loop`/ScheduleWakeup/CronCreate); no upstream JS.
4. **Fleet wiring = one-line pointers only.** The 6 fleet agents that could loop each get a single pointer line to the contract; chief-of-staff additionally gets a "loop health" cadence check. Edit the agents/ sources ONLY; regenerate the .claude/agents mirrors via `sync-native-agents.mjs` (generated mirrors).
5. **No mobile/deploy surface** — deploy + mobile-build N/A (framework reference doc + agent pointers). Stated in closeout.

## External State Lifecycle

Taxonomy walk (`references/external-state-lifecycle-protocol.md`, 15 entries):

| # | Environment | This plan | Coupling |
|---|-------------|-----------|----------|
| 3 | Out-of-tree version-controlled | **TOUCHED** — branch `WI-479-autonomous-loop-contract` + sibling worktree | coupled → create (from main after P) / land (PR+merge) / remove worktree post-merge; abort cleanup: remove worktree (worktree.sh remove) + delete branch |
| 12 | Downstream framework artifacts | **TOUCHED** — the .claude/agents fleet mirrors are GENERATED from the agents/ sources by `scripts/sync-native-agents.mjs`; regenerate + `--check`, never hand-edit | coupled → Exec regenerates + checks |
| 1,2,4,5,6,7,8,9,10,11,13,14,15 | (host fs, config, registries, schedulers, services, SaaS, DB, caches, DNS, search, CI, secrets, runtime fs) | untouched | — |

Untouched: all except 3, 12. No machine-local mutation, no post-merge flip, no runtime loop-state files created by this WI (the doc DEFINES the schema; no loop is stood up here).

## File blueprints

| # | File | Action |
|---|------|--------|
| 1 | references/autonomous-loop-contract.md (created by this WI) | **CREATE** — the contract (scratchpad draft, source-faithful) |
| 2 | `agents/chief-of-staff.md` | Add pointer + a cadence "loop health" line reading the fleet run logs under `$COMPANY_STATE_DIR/loops/` (NOT `.svc/loops`, which is framework-self only) per contract §1/§2 |
| 3 | `agents/growth-lead.md` | One-line pointer to the contract before any bounded-execute promotion |
| 4 | `agents/comms.md` | One-line pointer |
| 5 | `agents/revops.md` | One-line pointer |
| 6 | `agents/customer-success.md` | One-line pointer |
| 7 | `agents/data-collection.md` | One-line pointer |
| 8 | `references/company-operating-fleet.md` | Link the contract in the cadence/loop section |
| (gen) | the six .claude/agents fleet mirrors (generated) | Regenerated via `sync-native-agents.mjs`; `--check` passes |

## Execution Command Sequence

```bash
set -euo pipefail
ROOT=/workspace/seriousvibecoding
# commit P lands on main FIRST, then:
bash scripts/worktree.sh create WI-479-autonomous-loop-contract
WT="$ROOT/.worktrees/WI-479-autonomous-loop-contract"; cd "$WT"
# blueprint #1: create the contract from the scratchpad draft
# blueprints #2-8: agent pointer lines + fleet reference link (agents/ only)
node scripts/sync-native-agents.mjs        # regenerate .claude mirrors
node scripts/sync-native-agents.mjs --check
# --- assertions ---
test -f references/autonomous-loop-contract.md
grep -q '.svc/loops/<loop>.' references/autonomous-loop-contract.md
grep -q 'Tier 1 — autonomous-safe' references/autonomous-loop-contract.md
grep -q 'Tier 2 — gated' references/autonomous-loop-contract.md
grep -q 'kill switch' references/autonomous-loop-contract.md
grep -q 'Promotion prerequisites' references/autonomous-loop-contract.md
grep -qi 'CAN-SPAM' references/autonomous-loop-contract.md
grep -q 'vanity-loop' references/autonomous-loop-contract.md
grep -q 'svc-native' references/autonomous-loop-contract.md
# --- contract-integrity assertions (F-5: prove structure, not just keywords) ---
grep -q 'Source-trace table' references/autonomous-loop-contract.md            # source labeling exists
grep -q '"promotion"' references/autonomous-loop-contract.md                    # promotion schema defined (F-1)
grep -q 'fail-closed' references/autonomous-loop-contract.md                    # Tier-1 default / fail-closed (F-1)
grep -q 'authorization_ref' references/autonomous-loop-contract.md && grep -q 'kill_switch' references/autonomous-loop-contract.md && grep -q 'allowlist_version' references/autonomous-loop-contract.md
grep -q 'COMPANY_STATE_DIR/loops' references/autonomous-loop-contract.md        # fleet state root (F-2)
grep -q 'spend/budget only' references/autonomous-loop-contract.md              # ≤20% scoped to spend (F-3)
grep -qi 'no raw PII in the state file, the run log, OR runtime-action receipts' references/autonomous-loop-contract.md  # PII covers state+log+receipts (F-3, R2-03)
grep -q 'NOT a mandatory-chain receipt' references/autonomous-loop-contract.md  # receipt namespace separated (F-4)
grep -qi 'provider idempotency' references/autonomous-loop-contract.md && grep -qi 'prepare' references/autonomous-loop-contract.md  # retry gap closed (F-4)
grep -q 'currently run manually' references/autonomous-loop-contract.md         # corrected cadence claim (F-3)
grep -q 'a 20% rule is meaningless' references/autonomous-loop-contract.md      # 20% explicitly rejected for send (F-3, positive form)
# pointer present in all 6 fleet agents + fleet reference (both agents/ + mirror)
for a in chief-of-staff growth-lead comms revops customer-success data-collection; do
  grep -q 'autonomous-loop-contract' agents/$a.md
  grep -q 'autonomous-loop-contract' .claude/agents/$a.md
done
grep -q 'loop health' agents/chief-of-staff.md
grep -q 'COMPANY_STATE_DIR/loops' agents/chief-of-staff.md   # R2-01: fleet health reads the company-state root, not .svc/loops
! grep -qE 'loop health[^.]*\.svc/loops' agents/chief-of-staff.md   # R2-01: must NOT wire fleet health to .svc/loops
grep -q 'autonomous-loop-contract' references/company-operating-fleet.md
bash test-framework/evals/run-all-evals.sh --tier1
# then: review-exec (G6) -> audit -> land (PR+merge) -> verify-promotion (lint+tier1 on main)
```

## Prerequisite Alignment Matrix

| Upstream skill | Status | Evidence |
|----------------|--------|----------|
| route-workflow | completed | session contract + lane graph |
| blend-external (WI-476) | completed | blend plan item 1 (merged 64e6ecb1) |
| write-spec / design-ux / design-ui / define-code-style | skipped | decisions logged; governance reference doc + pointer lines, no code/UX |
| design-tech | completed-inline | contract §1/§3/§6 schema design (loop-state file, Tier model, receipts hybrid) + § External State — task-4 receipt + decision ledger |
| explore-solutions | completed-inline | `.svc/loops/` (framework) over `.agents/` + receipts-hybrid over plain run-log — task-5 receipt + decision ledger |
| plan-changeset | completed | this manifest |

## Validation plan

| Check | Command | Expected |
|-------|---------|----------|
| Mechanical plan gate | `bash scripts/verify-plan-mechanical.sh docs/plans/2026-07-14-wi479-autonomous-loop-contract/manifest.md` | PASS |
| Contract + pointer assertions | Exec step | all pass |
| Mirror in sync | `node scripts/sync-native-agents.mjs --check` | in sync |
| No-fabrication | every contract claim traces to the source; svc adaptations labeled | verified in review |
| Tier-1 | `bash test-framework/evals/run-all-evals.sh --tier1` | all pass |

## Checkpoints & rollback

- Commit P (planning, main, exempt) → worktree commit M → PR + merge → verify-promotion (lint + tier-1). No machine-local flip.
- Rollback (commit-scoped): `git revert <commit-M-merge-sha>` — additive reference doc + pointer lines; no data/code logic. Commit P retained as audit history.
- Blast radius: a new governance doc + advisory agent pointers. Worst case: an agent ignores the pointer — the doc is advisory until a loop is actually stood up (none here).
