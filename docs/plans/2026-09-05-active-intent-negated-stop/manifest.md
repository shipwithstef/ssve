# WI-567 Active-Intent Negated-Stop Changeset

**Spec:** `docs/specs/work-items/WI-567.md`
**Branch:** `bugfix/WI-567-active-intent-negated-stop`
**Status:** VERIFIED
**Base:** `origin/main` at `bead68b871c104a6328fe05ac695c3399440b8a7`
**Created:** 2026-09-05
**Execution mode:** inline
**Risk Flags:** none
**Lane:** bugfix

## Implementation Summary

Narrow the shared active-intent classifier so a `stop` token governed by
`do not`, `don't`, `dont`, or `never` in the same bounded clause is not an
affirmative stop request. Preserve literal stop suppression and every WI-354
correction, continuation, and isolation invariant. Add behavioral fixtures
before changing the classifier and retain the existing end-to-end hook replay.

## Files Planned

| File | Action | Task | Purpose |
|---|---|---|---|
| `test-framework/evals/tier-1/validate-active-intent-guard.sh` | MODIFY | task-1-regression | Add classifier-level red/green fixtures for negated, composite, mixed, and affirmative stop language. |
| `hooks/lib/active-intent.mjs` | MODIFY | task-2-classifier | Exclude negated stop spans from affirmative stop detection. |
| `docs/specs/work-items/WI-567.md` | MODIFY | task-3-governance | Record implementation and proof outcomes. |
| `docs/specs/work-items/WI-568.md` | CREATE | task-3-governance | Register independently reproduced Kimi sibling. |
| `docs/specs/work-items/INDEX.md` | MODIFY | task-3-governance | Index WI-567 and WI-568. |
| `FRAMEWORK-STATE.md` | MODIFY | task-3-governance | Record the verified residual correction and evidence. |

## Changeset Blueprint

Skipped because execution mode is `inline`; the same executor retains the
diagnosis, ACs, implementation context, and exact file set.

## Task Graph

| Task | Title | Files | Depends on | AC coverage | Validation | Checkpoint |
|---|---|---|---|---|---|---|
| task-1-regression | Add behavioral boundary fixtures | active-intent Tier-1 validator | — | AC-1..AC-4 | focused validator must fail before implementation and pass after | tests-red-green |
| task-2-classifier | Make stop detection negation-aware | active-intent library | task-1-regression | AC-1..AC-4 | direct classifier replay + focused validator | classifier-fixed |
| task-3-governance | Close evidence and framework state | WI/INDEX/FRAMEWORK-STATE | task-2-classifier | AC-5, AC-6 | manifest/lane validation, full Tier-1, all-host install drift | governance-closed |

Parallel groups: none; tests constrain code and governance records verified results.

## AC-to-Task Mapping

| AC | Task |
|---|---|
| AC-1 | task-1-regression, task-2-classifier |
| AC-2 | task-1-regression, task-2-classifier |
| AC-3 | task-1-regression, task-2-classifier |
| AC-4 | task-1-regression, task-2-classifier |
| AC-5 | task-3-governance |
| AC-6 | task-3-governance |

## AC-to-Test Mapping

| AC | Type | Proof |
|---|---|---|
| AC-1 | Unit/behavioral | direct `classifyActiveIntent` fixtures for `do not stop` and `never stop` |
| AC-2 | Unit/behavioral | exact composite mandate golden fixture |
| AC-3 | Unit/behavioral | literal `stop` remains `{classification:"stop", suppress:true}` |
| AC-4 | Integration | existing prompt-writer/Stop-guard continuation and isolation scenarios |
| AC-5 | Integration | focused validators plus complete Tier-1 corpus |
| AC-6 | Manual/runtime | `./setup --all-hosts` and `check-install-drift.sh --all-hosts` after promotion |

AC-6 is owned by the lane's `verify-promotion` task, not by pre-merge execution;
task-3 records the pending obligation but cannot close it.

## Lane Compliance

| Mandatory skill | Status / artifact |
|---|---|
| `diagnose-bug` | completed — `docs/specs/work-items/WI-567.md` |
| `plan-changeset` | completed by this simulated manifest |
| `review-plan` | active — `docs/plans/2026-09-05-active-intent-negated-stop/review-log.yaml` |
| `execute-changeset` | pending in `.svc/lane-tasks-WI-567.json` |
| `review-gate` | pending in `.svc/lane-tasks-WI-567.json` |
| `review-exec` | pending in `.svc/lane-tasks-WI-567.json` |
| `audit-implementation` | pending in `.svc/lane-tasks-WI-567.json` |
| `land-changeset` | pending in `.svc/lane-tasks-WI-567.json` |
| `verify-promotion` | pending in `.svc/lane-tasks-WI-567.json`; owns AC-6 |

## Prerequisite Alignment Matrix

| Prerequisite | Alignment |
|---|---|
| UX | N/A — internal hook classifier, no rendered flow. |
| UI | N/A — no visual assets or components. |
| Technical design | WI-354's shared UserPromptSubmit/Stop bridge remains intact; only stop polarity is narrowed. |
| Style contract | Existing ESM helpers and Bash Tier-1 harness patterns in the two modified files are retained. |
| Persona/competitor | N/A — operator-control correctness applies to all framework hosts, not a product persona differentiation. |

## External State

The taxonomy in `references/external-state-lifecycle-protocol.md` was walked.
Implementation and pre-merge tests create no external state.

| # | Environment | What state | Coupling | Lifecycle wiring |
|---|---|---|---|---|
| 1 | Host filesystem outside repo | Installed framework copies/symlinks after promotion | coupled | `./setup --all-hosts` materializes promoted source; `scripts/check-install-drift.sh --all-hosts` verifies convergence. |
| 3 | Out-of-tree version control | `origin/main` promoted commit | coupled | `land-changeset` merge/push and `verify-promotion` compare local promoted source to `origin/main`. |

Untouched environments (walked the taxonomy, found nothing): 2, 4, 5, 6, 7,
8, 9, 10, 11, 12, 13, 14, 15. No ad-hoc environment exists.

## Validation Plan

1. Run the modified active-intent validator before implementation, capture its
   nonzero exit, and verify the log names the new `do not stop` assertion.
2. Apply the classifier correction and rerun the focused validator.
3. Run `validate-stop-hook-session-isolation.sh` and module syntax/load checks.
4. Run lane, plan, manifest, and complete Tier-1 validation.
5. Complete independent plan and execution reviews, implementation audit,
   receipt envelope, commit/push/merge, and promoted replay.
6. From promoted main only, run all-host setup and drift verification to close AC-6.

## Execution Command Sequence

```bash
# Red evidence was captured at /tmp/wi567-active-intent-red.log. On a fresh
# pre-fix tree: require nonzero and grep the exact new assertion. On resume after
# classifier-fixed, require the green validator instead of recreating red state.
node --check hooks/lib/active-intent.mjs
bash test-framework/evals/tier-1/validate-active-intent-guard.sh
bash test-framework/evals/tier-1/validate-stop-hook-session-isolation.sh
node scripts/validate-task-graph-lane.mjs .svc/lane-tasks-WI-567.json
bash scripts/verify-plan-mechanical.sh docs/plans/2026-09-05-active-intent-negated-stop/manifest.md
bash test-framework/evals/run-all-evals.sh --tier1
```

RECOVERY_IF_FAIL: read the first failing behavioral assertion, correct only the
classifier/test boundary responsible, and rerun the narrowest failing command.
If unrelated Tier-1 baseline failures appear, record exact names and verify them
against pristine `origin/main` before changing scope.

## Simulation Report

| Check | Result | Evidence |
|---|---|---|
| MODIFY targets exist | PASS | both classifier and active-intent validator exist at base SHA. |
| CREATE target absent | PASS | WI-568 was collision-checked before registration. |
| Imports/dependencies resolve | PASS | no dependency or import change planned. |
| AC coverage | PASS | AC-1 through AC-6 each map to a task and proof. |
| Scenario walkthrough | PASS | negated prompt records no suppression; affirmative stop suppresses; continue/resume and isolation retain existing paths. |
| Browser/schema/deploy risk | PASS | no browser, ORM, external API, or deploy target. |

Classifier algorithm: match only `do not`, `don't`, `dont`, or `never` followed
by at most six whitespace-separated word tokens and `stop`; punctuation ends the
span. Remove each such negated span, except spans containing contrastive `but`,
`however`, or `instead`, then classify as stop iff any `stop` token remains.
Thus `never stop. Stop now`, `do not yield but stop now`, and `do not continue,
stop now` remain affirmative stop requests while the exact composite mandate is
ordinary intent.

No unresolved FAIL or WARN remains.

## Checkpoint Plan

- `tests-red-green` — behavioral fixture first; evidence `/tmp/wi567-active-intent-red.log` records the expected assertion.
- `classifier-fixed` — classifier and focused tests green; pre-commit rollback uses `git apply -R --check` against the exact reviewed diff.
- `governance-closed` — final docs/evidence. Post-landing rollback reverts the final WI commit through the governed lane, reruns focused/full Tier-1, then reinstalls from restored promoted main and checks all-host drift.

## Promotion Readiness Checklist

- [x] Every planned file is enumerated.
- [x] Every task has a validation command.
- [x] Every AC maps to a task and test/proof type.
- [x] No ORM/schema file or migration is involved.
- [x] No external-state lifecycle is undeclared.
- [x] Mandatory delivery graph validates.
- [x] Focused red/green proof captured.
- [x] Complete Tier-1 executed: affected validators pass; 27 unrelated baseline failures recorded in WI-567.
- [x] Landing and promoted install verification complete at `59d1280`; all nine hosts report zero drift.

**Next:** `review-plan` for WI-567.
