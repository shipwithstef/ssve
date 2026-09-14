# Plan manifest — WI-548 portable host-parity program (planning only)

**Status:** DRAFTED
**WI:** WI-548
**Branch:** `framework-WI-548-host-parity-plan`
**Base SHA:** `223436abe5124e6d9852551d249efd855759833b` (`origin/main` after PR #10/#11/#12; contains `ac04fbb6`)
**Spec:** `docs/specs/features/framework-portable-host-parity.md`
**Architecture:** `docs/specs/architecture/wi-548-portable-outcome-capability-adapters.md`
**Timestamp:** 2026-08-17
**Archetype:** Architectural change (program DAG) + bounded planning feature
**Execution mode:** `inline` for this planning WI only. Child WIs get their own manifests later. This branch must not run `execute-changeset` against runtime files.
**Delivery tier:** full
**solution_confidence_mode:** post_design_human_gate

## Implementation Summary

This changeset writes the reviewed program plan. It does **not** change
hooks, wirers, receipt emitters, or host installers.

Invariants:

- Default checkout remains untouched.
- PR #10 is already merged (`223436ab`). Do not re-open or re-merge it.
- This changeset adds no runtime code. The required `/review-plan` pass may invoke the owner-configured independent station.
- No duplicate WI numbers.
- AGY is not modeled as an orchestrator.
- Grok/Cursor/AGY are not remapped to Claude/Codex.

Constraints:

- Planning artifacts only: `docs/specs/**`, `docs/plans/**`, `proposals/**`.
- Children WI-549–WI-553 and WI-546 implement later, one-per-run. WI-547 is already landed. WI-545 remains identified on main.

## Files Planned (this PR)

| Path | Action | Notes |
|---|---|---|
| `docs/specs/decisions/2026-08-17-wi-548-host-parity/SOLUTION-CONFIDENCE.md` | CREATE | required confidence artifact |
| `docs/specs/architecture/wi-548-portable-outcome-capability-adapters.md` | CREATE | selected architecture + DAG |
| `docs/specs/architecture/wi-548-contract-map.md` | CREATE | producer/consumer map |
| `docs/specs/architecture/wi-548-capability-matrix.md` | CREATE | Grok/Cursor/AGY/Claude/Codex |
| `docs/specs/architecture/wi-548-reconciliation.md` | CREATE | dispositions + sequence |
| `docs/specs/features/framework-portable-host-parity.md` | CREATE | umbrella spec |
| `docs/specs/relations/wi-548-host-parity.branches.md` | CREATE | genesis branch index |
| `docs/specs/work-items/WI-548.md` | CREATE | planning umbrella |
| `docs/specs/work-items/WI-549.md` | CREATE | shared policy |
| `docs/specs/work-items/WI-550.md` | CREATE | receipt identity + barrier |
| `docs/specs/work-items/WI-551.md` | CREATE | dispatch resolver |
| `docs/specs/work-items/WI-552.md` | CREATE | continuation |
| `docs/specs/work-items/WI-553.md` | CREATE | risk-triggered contracts |
| `docs/specs/work-items/WI-545.md` | MODIFY | add planning ACs/tests/rollback/cost; implementation stays a later child |
| `docs/specs/work-items/WI-546.md` | CREATE | imported local planning artifact |
| `docs/specs/work-items/WI-547.md` | KEEP | already on `origin/main` via PR #11/#12; do not fork |
| `docs/specs/work-items/INDEX.md` | MODIFY | add 546, 548–553; keep landed 542/543/545/547 rows |
| `proposals/2026-08-17-framework-improvement-risk-triggered-plan-exec-contracts.md` | CREATE | accepted → WI-553 |
| `proposals/2026-08-17-framework-improvement-native-host-dispatch-policy.md` | CREATE | accepted → WI-551 |
| `proposals/2026-08-17-framework-improvement-autonomous-restart-boundary-continuation.md` | CREATE | accepted → WI-552 |
| `docs/plans/2026-08-17-wi548-host-parity-plan/manifest.md` | CREATE | this file |
| `docs/plans/2026-08-17-wi548-host-parity-plan/review-log.yaml` | CREATE | plan review log |
| `docs/plans/2026-08-17-wi548-host-parity-plan/sol-review.json` | CREATE | Cursor Agent Sol 5.6 High findings |
| `docs/plans/2026-08-17-wi548-host-parity-plan/sol-review-launch.txt` | CREATE | launch command receipt |
| `docs/plans/2026-08-17-wi548-host-parity-plan/fable-review.json` | CREATE | Cursor Agent Fable 5 thinking-high findings |
| `docs/specs/planning-imports/wi-547/HEAD-meta.txt` | CREATE | WI-547 landed-reference snapshot |

§3a Changeset Blueprint: SKIPPED (`mode=inline`, planning docs already authored in this session).

## Task Graph (this planning WI)

| id | title | files | deps | AC | validation | checkpoint | parallel |
|---|---|---|---|---|---|---|---|
| T1 | Solution confidence + architecture | decisions + architecture/* | — | AC-548-1..3 | files exist; options ≥3 | commit-ready docs | A |
| T2 | Child WIs + dispositions | WI-545..553, reconciliation | T1 | AC-548-4..6 | each child has ACs, files, tests, rollback, cost; one DAG | commit-ready docs | A |
| T3 | Spec + branch index + this manifest | feature spec, relations, manifest | T1 | PARITY-* mapped | mechanical plan check | commit-ready docs | — |
| T4 | Adversarial plan review | review-log.yaml | T3 | AC-548-7 | `verify-plan-mechanical.sh` then `/review-plan` | review-log + launcher receipt | — |
| T5 | Planning-only PR | branch push | T4 | AC-548-7, AC-548-8 | `git push` + `gh pr create` | STOP | — |

No `execute-changeset` task. Human gate is AC-548-9.

## AC-to-Task

| AC | Task |
|---|---|
| AC-548-1 | T1 |
| AC-548-2 | T1 |
| AC-548-3 | T1 |
| AC-548-4 | T2 |
| AC-548-5 | T2 |
| AC-548-6 | T2 |
| AC-548-7 | T4, T5 |
| AC-548-8 | T2, T5 |
| AC-548-9 | owner after PR (not this run) |
| PARITY-S1-* | child WI-547 |
| PARITY-S2-* | child WI-550 |
| PARITY-S3-* | child WI-549 |
| PARITY-S4-* | children WI-545 + WI-550 |
| PARITY-S5-* | child WI-551 |
| PARITY-S6-* | child WI-552 |
| Live Grok/Cursor/AGY wave | child WI-546 |

## AC-to-Test

| AC | Test type |
|---|---|
| AC-548-1..8 | Manual / file existence in this PR |
| AC-548-9 | Manual owner gate |
| Child ACs | Focused tier-1 per child WI; one full suite at each landing boundary |

## Prerequisite Alignment Matrix

| Prerequisite | Trace |
|---|---|
| Persona | Framework operator (not a product persona) |
| UX/UI | N/A — no UI |
| Tech | POCCA architecture |
| Style | docs/specs work-item + plan conventions |
| WI-547 | referenced, not copied |

## Validation Plan

This PR:

```bash
test -f docs/specs/decisions/2026-08-17-wi-548-host-parity/SOLUTION-CONFIDENCE.md
test -f docs/specs/architecture/wi-548-reconciliation.md
bash scripts/verify-plan-mechanical.sh docs/plans/2026-08-17-wi548-host-parity-plan/manifest.md
git diff --stat origin/main...HEAD
# must not include hooks/, scripts/, provision/hosts/, bin/
```

Per later child (not this PR): see each WI’s focused tests. Full
`bash test-framework/evals/run-all-evals.sh --tier1` once per landing
boundary that touches hooks/scripts/validators.

## Execution Command Sequence

```bash
set -euo pipefail
WT="/home/user/app-workspaces/seriousvibecoding/.worktrees/framework-WI-548-host-parity-plan"
cd "$WT"
git merge-base --is-ancestor origin/main HEAD
test -f docs/specs/work-items/WI-547.md
git diff --quiet origin/main -- hooks scripts provision bin
git reset HEAD
bash scripts/verify-plan-mechanical.sh docs/plans/2026-08-17-wi548-host-parity-plan/manifest.md
git add -- docs/specs docs/plans proposals
printf '%s\n' "$(git diff --cached --name-only)" | awk '
  NF && $0 !~ /^(docs\/specs\/|docs\/plans\/|proposals\/)/ { bad=1; print "illegal: " $0 }
  END { if (bad) { print "FAIL: staged path outside planning allowlist"; exit 1 } }
'
git diff --cached --check
git status --short --branch
SVC_SESSION_ID="${SVC_SESSION_ID:-$GROK_SESSION_ID}" git commit -m "docs(WI-548): reconcile plan onto origin/main"
SVC_SESSION_ID="${SVC_SESSION_ID:-$GROK_SESSION_ID}" git push -u origin HEAD
gh pr create --base main --head framework-WI-548-host-parity-plan --title "docs(WI-548): reviewed portable host-parity program plan" --body-file docs/plans/2026-08-17-wi548-host-parity-plan/manifest.md
```

RECOVERY_IF_FAIL: if push/auth fails, report; do not force-push; do not
touch default checkout. Probe: `git status --short --branch` and `gh auth status`.

## Checkpoint Plan

1. Docs complete in worktree
2. Mechanical plan check PASS
3. Review-log written
4. PR opened
5. Stop

## Promotion Readiness Checklist

- [x] Isolated worktree from `origin/main`
- [x] No runtime files
- [x] WI-547 not mutated
- [ ] Review-log present
- [ ] Planning PR URL
- [ ] Owner human-gate (after PR)

## External State

| # | Environment | What state | Coupling | Lifecycle wiring |
|---|---|---|---|---|
| 1 | GitHub PR | planning-only PR for this branch | coupled | `gh pr create` in T5; merge is owner-gated |
| 2 | Host file `/home/user/.grok/config.toml.wi543.bak` | historical residue | decoupled-justified | accepted historical state; not committed |

Untouched environments (walked the taxonomy, found nothing): package registry, npm, Docker, cloud CI, hosted SaaS, production DB, mobile stores, DNS, secrets managers, schedulers, email/SMS, payment providers, analytics. This planning PR does not mutate `~/.kimi/config.toml` (WI-544 remains operational).

Decoupled-justified: `.wi543.bak` is a live host leftover. It is named so it cannot silently become a rollback source. Monitoring is “file exists on disk”; recovery is “do nothing unless a later WI proves a need.”

## Simulation Report

| Check | Layer | Result |
|---|---|---|
| CREATE targets did not exist on `origin/main` | disk | PASS (548–553, 546, architecture, spec, proposals). WI-545 and WI-547 already exist and are KEEP. |
| INDEX.md exists | disk | PASS — MODIFY |
| WI-547 worktree not in file set | planned | PASS |
| hooks/scripts not in file set | planned | PASS |
| No deploy-class task | planned | PASS |
| Child runtime files deferred | planned | PASS / acknowledged — they belong to later WIs |

Assumptions (denominator = this worktree / this planning PR):

- WI-547 foundation is landed on `origin/main` as PR #11 `7bca62f3` plus closeout PR #12. Scope: this clone’s `origin/main`.
- Owner reviewer-policy-v2 has no Grok orchestrator key. Scope: the owner-home reviewer policy file as read 2026-08-17 (not a repo CREATE target).

Journey walkthrough: N/A — no product journey. Fixture walkthrough is WI-546.

## Child implementation handoff (not executed here)

See `docs/specs/architecture/wi-548-reconciliation.md` §3.

Canonical DAG (hard edges):

WI-547 (landed) and PR #10 (landed) are inputs, not work.
Independent now: WI-545, WI-549, WI-550, WI-551, WI-553, WI-544(ops).
WI-552 depends on WI-551 and WI-547.
WI-546 depends on WI-545, WI-547, WI-549, WI-550, WI-551, and WI-552.
WI-553 never blocks WI-546.

## Paid-review and test-cost plan

| Phase | Review | Tests |
|---|---|---|
| This planning PR | Mechanical first, then one `/review-plan` adversarial pass using the effective owner policy. | `verify-plan-mechanical.sh` |
| Each child land | One plan-review pass using effective owner policy for **that** host. Production mode required independents only at child land, not here. | Focused tier-1 named in the child WI |
| Landing boundary that touches hooks/scripts/validators | Existing G6/audit envelope | One full Tier-1 |
| WI-546 live wave | Do not rerun historical WI-542 AGY reviews | Setup + drift + listed fixtures |
| Relocate / check historical `f27a143a` | Zero provider calls | WI-547 checker |

## Simulation / no conflicting implementation exists

Scope: this worktree vs `origin/main` `223436ab`. There is no conflicting planning WI-548 on origin. WI-547 is already on `origin/main` and is KEEP in this PR.
