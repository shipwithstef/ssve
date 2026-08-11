# Framework Improvement: Feature-like bugfix product-question escalation

**Status:** DRAFT
deferred_until: 2026-07-29
reason: Backlog: needs a dedicated framework-lane triage pass. Re-triaged 2026-06-29 — revisit by 2026-07-29.
**blocked_reason**: Beyond the 14-day defer window: imported/backlog evolution proposal awaiting a dedicated triage pass (re-deferred 2026-06-29, not abandoned).
source_project: `/home/svc-user/app-workspaces/example-marketplace`
source_wi: `docs/specs/work-items/WI-332.md`

## Evidence

- **Source:** Example Marketplace customer rewards recovery and WI-332 design package.
- **Finding:** The customer rewards work initially presented as a UI bugfix:
  repeated location/business cards, unclear point source history, and bad
  mobile layout. The correct fix was not a small UI repair. It required a
  product model decision: selected reward program workspace, business-owned
  programs, branch scope, followed/subscribed semantics, redemption branch
  selection, and unresolved-source recovery.
- **Failure mode:** The framework already had the product-question format, but
  it was not forced early when a bugfix implied a user-visible product model or
  acceptance-criteria change. That let the work proceed like a narrow repair
  until review exposed that the real decision space was feature-class.
- **Severity:** HIGH. Feature-like bugfixes can ship a locally passing patch
  while preserving the wrong product model.

## Diagnosis

- **Root cause:** `route-workflow` and `diagnose-bug` distinguish bugfix and
  brownfield-feature lanes, but there is no hard escalation test that asks:
  "Does the proposed bugfix change product meaning, journey shape, UI
  architecture, data contract, acceptance criteria, or user-visible source of
  truth?" If yes, the run must require product-question coverage before plan or
  implementation.
- **Category:** routing / product decision enforcement.
- **Already in FRAMEWORK-STATE.md?** Adjacent protections exist:
  solution-confidence, product-question format, and post-design human gate. The
  missing piece is automatic escalation from bugfix to feature-class question
  coverage when the bugfix is really a product model correction.

## Proposed Implementation

- **Route:** normal framework pipeline on the framework repo. This is a
  routing/diagnosis contract change, not a drive-by quick fix.
- **Files likely changed:**
  - `route-workflow/SKILL.md`
  - `route-workflow/references/routing-rules.md`
  - `diagnose-bug/SKILL.md`
  - `_shared/product-question-format.md`
  - `review-gate/SKILL.md`
  - `test-framework/evals/tier-1/validate-feature-like-bugfix-product-questions.sh`
  - `FRAMEWORK-STATE.md`

## Required Contract Changes

### 1. Bugfix Product-Meaning Escalation Test

Before planning or implementing any bugfix, the framework must classify whether
the fix changes one of these:

- primary user journey,
- UI information architecture,
- product object model,
- data contract or persistence meaning,
- acceptance criteria,
- redemption/payment/accounting semantics,
- visible source of truth for user trust.

If any are true, route as feature-class work or insert a blocking
product-question packet before `plan-changeset`.

### 2. Product Questions For Feature-like Bugfixes

When escalation triggers, require the existing product-question format. For a
fully user-visible feature correction, require the full coverage floor:

- at least 20 customer-facing questions,
- at least 20 system-facing questions,
- all decisions explicitly `AGREE`, `OVERRIDE`, or auto-accepted under a logged
  user directive before plan simulation.

For a narrow ambiguous defect that does not change feature shape,
`diagnose-bug` may ask the smaller 3-5 question set it already documents.

### 3. User-Directed Auto-Answer Mode

If the user explicitly says to answer the product questions yourself, use the
existing auto-mode priority:

1. codebase evidence,
2. persona/journey/spec evidence,
3. domain conventions,
4. research when evidence is insufficient.

Every answer must still be recorded in the companion file with source and
decision status. Auto mode answers questions; it does not skip them.

### 4. Review-gate Detection

`review-gate` should fail a bugfix plan if the patch changes feature-class
semantics but the companion question file is missing, incomplete, or still
pending.

## Replay Verification

- **Replay target:** new Tier-1 regression
  `test-framework/evals/tier-1/validate-feature-like-bugfix-product-questions.sh`.
- **Fixture requirements:**
  1. A bugfix request complains about repeated cards and unclear history.
  2. The proposed fix changes page-level IA and source-of-truth semantics.
  3. The validator fails if the lane stays pure bugfix and proceeds to plan
     without a companion product-question file.
  4. The validator passes only when the graph escalates or blocks with a
     product-question packet.
- **Result:** TBD.

## Acceptance Criteria

- A bugfix that changes product object model, journey, UI architecture, data
  contract, or AC semantics cannot proceed to plan as a narrow defect.
- Feature-like bugfixes require product-question coverage before planning.
- Explicit user auto-answer directives are honored and logged, using evidence
  priority instead of asking follow-up questions.
- Review-gate can detect the failure class mechanically.
- A Tier-1 replay covers the Example Marketplace WI-332 failure class.

## Rollback

Revert the routing, diagnose-bug, review-gate, and Tier-1 validator changes.
This leaves the existing product-question and solution-confidence protocols
intact, but removes the feature-like bugfix escalation rule.

## FRAMEWORK-STATE.md Mutations

- **Analysis History:** Add a 2026-06-01 entry describing the Example Marketplace WI-332
  feature-like bugfix escalation gap and proposal creation.
- **Known Gaps:** Track the gap as open until implemented and replay verified.
- **Decisions:** None locked yet.
- **Capabilities:** Update only after implementation.

## Self-Verify

| # | Check | Result |
|---|---|
| 1 | Proposal is scoped to one gap | PASS |
| 2 | Evidence cites a real source WI and failure mode | PASS |
| 3 | Adjacent existing protections are acknowledged | PASS |
| 4 | Proposed route is normal framework pipeline | PASS |
| 5 | Replay target names a concrete Tier-1 validator | PASS |
