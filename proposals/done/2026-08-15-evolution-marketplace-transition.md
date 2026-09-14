# Framework Evolution — 2026-08-15 Example Marketplace transition

**Archived into:** WI-541

## Method

This survey treats content identity, not worktree count, as the denominator. It inspected the current SSVE tree, the work-item index, direct proposals, and unique proposal families present across registered Example Marketplace worktrees. A historical claim is `landed` only when the current tree contains the behavior and a consumer or focused test; a proposal copied into 146 worktrees still counts once. This is a survey, not a collection of per-gap fix briefs.

## Findings by priority

| Priority | Finding | Category | Current evidence | Disposition |
|---|---|---|---|---|
| P0 | Compiled framework graphs omit mandatory `review-plan` and `review-exec`, while lane validation returns PASS | drift / evidence integrity | `scripts/compile-delivery-graph.mjs:25-43`; `scripts/validate-task-graph-lane.mjs:128-145`; WI-541 initial graph replay | implement in WI-541 |
| P0 | A path-protecting guard can still be bypassed by selecting Bash because `svc-skill-artifact-authenticity` remains `Edit or Write` only | security fragility | `docs/specs/work-items/WI-514.md`; `hooks/hooks.json:31-35` | implement WI-514 in WI-541 |
| P0 | Mutating child transport is selected from generic agent availability and fails only after a child turn | inefficiency with correct late denial | `.worktrees/framework-WI-540-mutating-child-transport-preflight/proposals/2026-08-15-framework-improvement-mutating-child-transport-preflight.md`; `skills/execute-changeset/references/process-details.md:85-99` | implement safe preflight in WI-541 |
| P0 | Same-owner detached promotion and pre-existing registered worktree recovery have no reachable purpose-bound transition; WI-538 itself cannot bootstrap | authority lifecycle | `.worktrees/framework-WI-538-detached-promotion-recovery/proposals/2026-08-13-framework-improvement-detached-promotion-recovery-deadlock.md`; live `svc-ensure-worktree` denial recorded 2026-08-15 | implement recovery without weakening foreign-owner denial |
| P1 | Plans can create label-cut parallel streams without a pairwise-disjoint ownership proof | planning inefficiency / merge fragility | Example Marketplace `proposals/2026-08-05-plan-changeset-file-ownership-streams.md`; no `scripts/validate-stream-ownership.mjs` in current tree | implement manifest matrix and validator |
| P1 | Action-time learning injection exists, but schema normalization, promotion triage, elevation execution, and cross-project federation remain severed | compounding-knowledge gap | `docs/specs/work-items/WI-471.md` WI-474 row; `hooks/lib/learning-index.mjs:14-18,108-115`; `elevationCandidates()` has no executor | implement WI-474 contract in WI-541 |
| P1 | Session authorization envelopes are declarative only | enforcement gap | `docs/specs/work-items/WI-513.md`; sole runtime mention is `skills/route-workflow/SKILL.md:108` | implement only at observable outward-action/stop boundaries with measured hot-path cost |
| P1 | Current work-item residuals remain mechanically reproducible: quick-fix still in core routing, task-graph phase writes are racy, stale OPT-01 remains, story hash schema is undeclared, route commands/genesis headers/arg arrays drift | hygiene / correctness | `docs/specs/work-items/WI-516.md` through `WI-518.md`, `WI-522.md`, `WI-523.md`; current probes in WI-541 evidence | implement the still-red ACs; do not redo WI-519/520 already present |
| P1 | Money-path plans do not force reversal semantics/property sweeps before implementation | product-plan security | Example Marketplace `proposals/2026-08-05-g6-round-cap-and-slop-prevention.md` P3; no current `compensating entry` contract | add plan/design/review gates without embedding product-specific ledger code |
| P1 | Inherited absence/blocker claims can enter steering artifacts without a breadth denominator or direct verification | product-plan truthfulness | same proposal P6 and WI-AUDIT audit F11/F13/F14; current tree lacks `verified-by:` and a canonical caller-search helper | add verification provenance plus identifier-aware absence helper |
| P2 | Proposal triage declares a one-day SLA but the current direct proposal surface still contains stale landed work | hygiene | `docs/specs/work-items/WI-515.md`; `proposals/triage.json`; `OPEN-PROPOSALS.md` | reconcile by evidence and add denominator-based validator, without deleting audit history |

## Implemented or superseded source families

| Source family | Current proof | Disposition |
|---|---|---|
| Candidate harness SQLite/audit | `scripts/candidate-harness.mjs`; `test-framework/evals/tier-1/validate-candidate-harness.sh`; WI-508 capability record | landed |
| Story chain / one-lane skill port | `skills/audit-feature`, `skills/align-feature`, `skills/decide`, `references/story-receipts.md` | landed by WI-512/WI-521; only named residual WIs remain |
| Design-conformance gate | `skills/align-feature/SKILL.md:175-206`; `scripts/audit-story-receipts.mjs:279-424` | landed |
| Intent recovery | `skills/audit-feature/SKILL.md:340-420`; route solution-confidence protocol | landed as audit/decide path; do not add a duplicate skill |
| G6 round cap | `scripts/check-review-round-cap.mjs`; `test-framework/evals/tier-1/validate-review-round-cap.sh`; WI-491 | landed; do not create founder-cap bypass because the locked rule forbids round 4 |
| Auto-learning capture | `hooks/svc-auto-capture-learnings.mjs`; promotion CLI and Tier-1 fixtures | landed capture; WI-474 consumption is separate |
| Completion-guard archive suffixes | `hooks/svc-task-completion-guard.sh:542`; lane-integrity fixtures | landed |
| Centralize lane tasks outside worktree | current durable-authority doctrine makes the canonical operation worktree the mutation source of truth | rejected: would weaken isolation and confuse ownership |
| Mandatory global `@svc-scope` backfill | source proposal explicitly chose opt-in pilot/no backfill; no later owner activation or measured SSVE consumer exists | not adopted; add no unused map machinery |
| GitHub claim-announcement merge protocol | owner requires local-only delivery and repository-shared leases already own local coordination | not in WI-541; no GitHub-dependent machinery |
| Token-per-gate budget stop | no reliable cross-host token source is present; round cap already provides a deterministic proxy | track only until measurable input exists |

## Comparison delta

The material delta is not another skill pack. SSVE already has more routing and evidence machinery than its comparisons; the loss occurs where declarations are not consumed. WI-541 therefore prioritizes executable preflight, validators, schema-backed learning consumption, and exact chain topology over adding another advisory skill.

## Stale proposal audit

The repeated July files in Example Marketplace worktrees are historical copies, not independent backlog. Their landed portions remain evidence and their open portions map to WI-513 through WI-523 or the P0/P1 rows above. No worktree proposal is deleted. Direct proposals are reconciled through WI-515 so audit history is archived, never silently discarded.

## Program boundary

WI-541 covers the complete evidence-backed Example Marketplace-derived denominator above plus reproducibly red residual WIs 513-518 and 522-523. It does not absorb unrelated pre-July product/design backlog from `FRAMEWORK-STATE.md`, unverified host ideas, GitHub-only publication mechanics, or opt-in experiments with no consumer.
