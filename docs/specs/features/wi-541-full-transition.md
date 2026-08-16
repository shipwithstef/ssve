# WI-541 Full Framework Transition

**Status:** BASELINED
**Type:** Enabler
**Mode:** contract-change
**Lane:** framework
**Owner:** SSVE framework owner
**Source survey:** `proposals/done/2026-08-15-evolution-hoursHub-transition.md`

## Problem Statement

HoursHub delivery produced a dense set of framework proposals and follow-up work items. Some are already implemented, some are repeated unchanged across many worktrees, and some remain real gaps in mandatory routing, authority recovery, planning, security, learning consumption, and cleanup. The framework currently has no bounded program that proves every unique source was consumed, implements every evidence-backed gap, rejects unsafe or unused ideas explicitly, and verifies the resulting system from source through installed hosts.

The change must preserve the full evidence chain. Speed comes from removing dead context and preventing doomed work before dispatch, not from skipping review, security, tests, receipts, or final-SHA verification.

## Goals

1. Close every evidence-backed open row in the HoursHub-derived denominator.
2. Make the mandatory plan/execute/review chain executable and validator-enforced.
3. Fail early on unsupported mutation transport and recover sanctioned same-owner authority transitions without widening authority.
4. Make plans safer, ownership-disjoint, product-complete, and absence-claim aware.
5. Turn captured learnings into normalized, triaged, outcome-linked consumption.
6. Remove or retire redundant machinery only when consumers and fallback behavior prove it unused.
7. Produce a locally committed, all-host-converged result without GitHub.

## Non-Goals

- No GitHub push, pull request, merge API, or remote publication dependency.
- No weakening of controller leases, path containment, receipt gates, security review, or independent review.
- No global source-tag backfill without an activated consumer and measured benefit.
- No central task-state store outside the canonical operation worktree.
- No implementation of unrelated pre-July framework backlog.
- No product-specific HoursHub code changes.

## Consumer Stories

### S1 — Framework owner

As the framework owner, I want one audited denominator and final disposition for every unique HoursHub-derived suggestion so that repeated worktree residue cannot hide either lost work or duplicate work.

### S2 — Route controller

As the route controller, I want compiled graphs to contain every mandatory review and verification stage in the correct order so that a validator cannot certify a structurally incomplete chain.

### S3 — Secure executor

As the executor, I want transport capability and operation authority resolved before a worker is launched, and sanctioned recovery to be reachable, so that safe work progresses without bypassing fail-closed ownership.

### S4 — Planner and reviewer

As the planner/reviewer pair, I want file ownership, product safety, and claim provenance mechanically testable so that parallelism, money paths, and absence claims cannot create false-green plans.

### S5 — Learning system

As the learning system, I want captured evidence normalized, triaged, elevated through policy, federated safely, and recorded as used or ignored so that learning compounds instead of becoming unread residue.

## Acceptance Criteria

| AC | Description | QA | E2E | Test |
|---|---|---|---|---|
| W541-01 | [S1] A content-deduped source ledger lists every unique current SSVE/registered-HoursHub proposal family and staged learning, with exactly one evidenced disposition: `implemented`, `implement`, `rejected`, or `track`. | — | 🔲 | deterministic census fixture |
| W541-02 | [S2] Every mutable product/framework lane compiles exactly one ordered `plan-changeset -> review-plan -> execute-changeset -> review-gate -> review-exec -> audit-implementation -> land-changeset -> verify-promotion` chain. | — | 🔲 | compiler fixtures per lane |
| W541-03 | [S2] Lane validation rejects omission, duplication, substitution, or reordering of either review task; `review-gate` cannot satisfy `review-exec`. | — | 🔲 | negative graph fixtures |
| W541-04 | [S3] Every concrete-path PreTool guard covers Bash mutation through the shared decoded-argv classifier or carries a tested exemption naming its separate coverage; Bash reads remain allowed. | — | 🔲 | negative/positive hook replay |
| W541-05 | [S3] A pure child-transport resolver selects only `delegated-wrapper`, `controller`, or `read-only-native`; generic `agents:true` never authorizes mutation. | — | 🔲 | resolver matrix |
| W541-06 | [S3] Unsupported native mutating work selects controller before launch while read-only native work remains available; a delegated child must present the complete identity/token/worktree/path/containment/receipt tuple. | — | 🔲 | HoursHub billing topology replay |
| W541-07 | [S3] Detached promotion uses an expiring, single-purpose capability bound to the complete promotion tuple; any foreign or widened tuple fails before mutation. | — | 🔲 | authority state-machine tests |
| W541-08 | [S3] Same-owner legacy worktree bootstrap converges missing claim/binding state only after secure path, branch, repository, clean-authority, and generation checks; the WI-538 loader deadlock replays without bypass. | — | 🔲 | disposable worktree replay |
| W541-09 | [S4] Every parallel plan declares pairwise-disjoint file ownership; a shared file has one owner plus dependency edges, and diff-vs-declaration violations fail. | — | 🔲 | stream validator fixtures |
| W541-10 | [S4] A balance, ledger, quota, entitlement, or counter writer cannot enter execution until compensating behavior in both operation orders and a property sweep are planned. | — | 🔲 | plan/review fixtures |
| W541-11 | [S4] An inherited blocker, credential-absence claim, or zero-caller claim names direct verification evidence; canonical absence search covers slug/invoke namespaces and treats zero without a denominator as unproven. | — | 🔲 | claim/caller-search fixtures |
| W541-12 | [S4] A review based only on submitter PASS prose is invalid; the reviewer receipt binds reviewer-run commands/outputs and includes parse/collect proof for deletion-bearing executable diffs. | — | 🔲 | review receipt fixtures |
| W541-13 | [S5] Framework/project learning loaders normalize id/key and numeric/string confidence into one schema; malformed entries are reported rather than trusted. | — | 🔲 | ledger schema fixtures |
| W541-14 | [S5] Landing performs bounded promotion triage, elevation passes `evaluate-rule`, federated roots are validated, and recall records used/ignored plus outcome linkage before framework credit. | — | 🔲 | learning lifecycle replay |
| W541-15 | [S3] `authorization_envelope` enforcement observes a real outward-action boundary: outside work is denied, inside-envelope stops are recorded, absence preserves current behavior, and p95 stays within budget. | — | 🔲 | boundary and timing fixtures |
| W541-16 | [S1] `quick-fix` is absent from core routing and curated host guidance while its risk/eligibility detectors remain byte-unchanged. | — | 🔲 | manifest lint and route replay |
| W541-17 | [S2] Concurrent task-graph phase/status/skill updates lose no update; atomic closures do not call `process.exit()` and release locks on error. | — | 🔲 | real concurrency fixture |
| W541-18 | [S1] The refuted markdown-candidate optimization is removed with its failed premise recorded; no parser for an unspecified format is added. | — | 🔲 | plan diff assertion |
| W541-19 | [S2] `story_receipt_sha256` is an optional 64-hex schema property: absence validates and malformed input fails. | — | 🔲 | receipt schema fixtures |
| W541-20 | [S2] Stage-registry validation is single-sourced, branch-index genesis uses a real SHA, route literal commands execute within budget, and story-receipt Git reads use arg arrays. | — | 🔲 | WI-523 focused checks |
| W541-21 | [S1] Every direct open proposal has a current disposition; expired deferrals fail and the validator prints numerator/denominator counts without deleting history. | — | 🔲 | triage validator |
| W541-22 | [S1] New executable machinery has a declared consumer and behavioral test or is not introduced; affected existing machinery is removed only after a zero-consumer proof. | — | 🔲 | consumption audit |
| W541-23 | [S1] Focused tests, full Tier 1, manifest lint, pipeline integrity, security review, implementation audit, and session audit finish with zero unresolved Critical/High findings. | — | 🔲 | final-SHA local evidence |
| W541-24 | [S1] `./setup --all-hosts` plus install-drift validation converge all eight hosts, and installed Codex replays applicable authority/transport scenarios. | — | 🔲 | installed-host evidence |
| W541-25 | [S1] A local commit contains the program and final-SHA chain evidence; no push/PR is attempted and local-only publication is recorded. | — | 🔲 | git and receipt evidence |

## System Dependencies

### Depends on

- WI-368/WI-502/WI-505 authority and containment contracts.
- WI-343/WI-384 learning capture and action-time injection.
- WI-491 hard three-round cap.
- WI-512/WI-521 story-chain, stage registry, and branch-index work already present in the current tree.
- Current host manifests and installed Codex dispatcher.

### Depended on by

- Every future mutable product/framework route.
- `execute-changeset`, `dispatch-waves`, and contained child execution.
- Framework learning preload, action-time injection, promotion, and elevation.
- Local landing and installed-host verification.

## Event and State Contracts

- Graph compilation and validation are pure over lane + risk inputs.
- Authority transitions are append-only, generation-bound, purpose-bound, and crash-forward.
- Child transport resolution is pure and records its choice before any launch.
- Learning lifecycle events are append-only; tracked promotion is explicit and outcome credit is consumer-bound.
- Proposal disposition preserves source history and uses archive moves rather than deletion.

## Industry Grounding

**Source:** `docs/specs/evidence/wi-541-source-ledger.json`
**Landscape state:** inapplicable.

### What the industry does

Not applicable as a market comparison. This is an internal governance and enforcement program; its evidence base is observed HoursHub delivery failures, current SSVE contracts, and executable security invariants.

### What we're doing

Use the content-deduplicated source ledger, exact mandatory chain, authority state machines, reversible plan contract, direct reviewer-run evidence, and consumer-linked learning lifecycle as the locally verifiable baseline.

### Why we differ

SSVE requires every declaration to have an executable consumer and focused proof. It does not treat repeated proposals, advisory prose, or locally present but unconsumed machinery as delivered behavior.

### Reversibility

Revert the single local commit and reconverge all installed hosts from the prior canonical source. Preserve append-only receipts, proposal history, authority generations, and review evidence during rollback.

## Pillars Coverage Matrix

| # | Pillar | State | Artifact / note |
|---|---|---|---|
| 1 | Product fit | [UPDATED] | Owner directive and `proposals/done/2026-08-15-evolution-hoursHub-transition.md` bind the full local delivery outcome. |
| 2 | Journey | [UPDATED] | System journeys are the compiler, transport, recovery, planning, learning, landing, and installed-host replays in W541-02 through W541-25. |
| 3 | Acceptance criteria | [UPDATED] | This table is the authoritative contract. |
| 4 | UX | [N/A — justified] | No user-facing visual surface; operator denial and routing text remain actionable and are behaviorally tested. |
| 5 | UI | [N/A — justified] | Documentation/script framework only; no browser or native visual surface. |
| 6 | Tech architecture | [UPDATED] | `docs/specs/decisions/wi-541-solution-confidence/SOLUTION-CONFIDENCE.md` and the implementation manifest. |
| 7 | Cost model | [UPDATED] | Planning must record hot-path p95, avoided child turns, bounded review rounds, and removal of unused context. |
| 8 | Operations & ownership | [UPDATED] | Framework owner; rollback by local commit revert plus all-host reinstall while preserving append-only receipts and authority history. |

## Journey References

No human UI journey is created. The manifest must encode executable system scenario walkthroughs for graph compilation, Bash guard denial, child transport fallback, detached recovery, learning lifecycle, local landing, and installed-host verification. Each scenario maps directly to the AC table.

## Scope Review

**Mode:** Selective Expand.

The program keeps every evidence-backed HoursHub-derived gap and the mechanically red WI-513 through WI-523 residuals. It adds only the graph false-green and legacy-worktree recovery found while routing this program. It excludes unrelated backlog, GitHub-only mechanics, and unconsumed opt-in experiments. This is the smallest scope that satisfies “all” without equating duplicates or unsafe ideas with required implementation.

## Implementation Notes

Technical design: `docs/specs/tech/wi-541-full-transition.md`
Solution confidence: `docs/specs/decisions/wi-541-solution-confidence/SOLUTION-CONFIDENCE.md`
Design decisions: `docs/specs/decisions/wi-541-full-transition.md`

- `PLANNED` — single-source and mechanically validate the complete mandatory delivery chain.
- `PLANNED` — extend concrete-path policy to Bash mutation through the shared decoded-argv classifier.
- `PLANNED` — resolve child transport before launch and preserve contained mutation/controller fallback.
- `PLANNED` — add purpose-bound detached promotion and secure same-owner legacy convergence.
- `PLANNED` — validate parallel ownership, reversible writers, claim evidence, callers, consumers, and reviewer-run proof.
- `PLANNED` — normalize and operationalize the learning lifecycle with outcome linkage.
- `PLANNED` — enforce explicit authorization envelopes only at observable boundaries with timing evidence.
- `PLANNED` — close quick-fix, atomic graph, stale optimization, receipt schema, mechanical residual, and proposal-SLA gaps.
- `PLANNED` — run focused, cumulative, full Tier 1, security, implementation, session, all-host, and installed-Codex proof before local-only landing.

## Revision Log

| Date | AC | Was | Now | Why | By skill |
|---|---|---|---|---|---|
| 2026-08-15 | all | (new) | W541-01 through W541-25 | Initial contract from the content-deduped transition survey. | write-spec |
| 2026-08-15 | all | DRAFT | BASELINED with technical design and solution-confidence packet | All ACs feasible; authority and product-plan risks have exact proof gates. | design-tech |
