# J-FW-06: Rank and Triage a Project Candidate Reservoir

**Journey ID:** J-FW-06
**Persona:** S4 Framework Candidate Operator (system-backed human operator; no persona file exists)
**Covers:** `docs/specs/features/candidate-reservoir.md`
**Priority:** Critical
**Status:** LOCAL-PROOF — implementation and hermetic journey validator pass; promotion pending

## Why This Journey Matters

An operator must be able to compare a noisy pool without turning every idea into active work. The journey is broken if ranking cannot be explained from current code, if one project's data leaks into another, or if a retry creates duplicate transitions or decision rows.

## User Motivation

The operator has a reviewed JSON candidate pool and wants a fast, reproducible shortlist. They will promote only a candidate already accepted into a named WI or reject one with an auditable reason.

## Journey Map

1. The operator places a valid candidate mirror in the current project and asks for a complete or top-N ranking.
2. The harness identifies the project, imports the pool, checks each declared target, computes role-weighted scores, and shows deterministic evidence rows.
3. The operator either promotes one active candidate to a supplied WI or rejects it with a reason.
4. A retry is idempotent; a conflicting terminal choice is refused.
5. A second project can reuse the same candidate ID without seeing or changing the first project's row.

## Behavior Specification

# Feature: Project-scoped candidate ranking and triage

  The operator can rank, inspect, promote, and reject candidates while the framework preserves project isolation and a deliberate pre-WI boundary.

  # Background:
  - Given the operator is in the repository whose candidates they want to evaluate
  - And a human-readable candidate mirror names its topic, item scope, and active candidates
  - And each candidate carries role labels, authored product/growth/overhead/risk scores, and repository-relative target declarations

  `@AC-CAND-01` `@CAND-01` `@CAND-03` `@CAND-05` `@CAND-06` `@GROUND-01` `@GROUND-02` `@GROUND-03` `@GROUND-04` `@GROUND-05` `@GROUND-06` `@SCORE-01` `@SCORE-02` `@SCORE-03` `@SCORE-04` `@SCORE-05` `@SCORE-06`
# Scenario: Import and inspect the complete ranked pool
  - Given the mirror contains exactly 50 unique candidates from CAND-001 through CAND-050
  - When the operator runs the rank command because they need a complete comparison
  - Then the operator sees every candidate ordered by its unrounded composite score with candidate ID as the stable tie-break
  - And every row shows work type, role labels, effective dimensions, two-decimal composite score, current status, and an exact existing-target count
  - And missing, escaping, broken, or external-resolving targets are visible as invalid evidence without stopping unrelated candidates
  - But neither the declared target files nor any customer database is changed

  `@CAND-02` `@SCORE-06` `@GROUND-01`
# Scenario: Ask for only the strongest candidates
  - Given the imported pool has more candidates than the operator wants to review
  - When the operator runs the top command with the visible value 10
  - Then exactly the strongest 10 evidence rows are shown in the same order as the complete ranking
  - But a zero, negative, fractional, or non-numeric limit is refused with an actionable message

  `@CAND-04` `@TRIAGE-05` `@ISOLATE-05`
# Scenario: Refuse an invalid mirror without side effects
  - Given one candidate is missing required metadata, duplicates an ID, or carries an invalid score
  - When the operator asks the harness to rank that mirror
  - Then the command fails before importing any candidate from that mirror
  - And the operator's existing local candidate state and decision history remain unchanged
  - But the error identifies the invalid candidate and field so the mirror can be corrected

  `@TRIAGE-01` `@TRIAGE-03` `@TRIAGE-05` `@TRIAGE-06` `@ISOLATE-01` `@ISOLATE-02` `@ISOLATE-03` `@ISOLATE-04`
# Scenario: Promote one grounded candidate into a supplied WI
  - Given the current project and item scope contain one active candidate with the requested ID
  - When the operator runs the promote command with that ID and a valid WI token
  - Then the candidate becomes promoted and visibly records the supplied WI
  - And one structured promotion decision is appended after the durable transition
  - But no WI document, product record, customer database, or target file is created or modified

  `@TRIAGE-02` `@TRIAGE-03` `@TRIAGE-05` `@TRIAGE-06`
# Scenario: Reject one candidate with an explicit reason
  - Given the current project and item scope contain one active candidate with the requested ID
  - When the operator runs the reject command with a non-blank reason
  - Then the candidate becomes rejected and visibly preserves that reason
  - And one structured rejection decision is appended after the durable transition
  - But no WI document, product record, customer database, or target file is created or modified

  `@TRIAGE-04`
# Scenario: Retry safely and refuse a conflicting terminal choice
  - Given a candidate was already promoted or rejected by a successful command
  - When the operator repeats the identical command after uncertainty about the first response
  - Then the command succeeds without adding a duplicate transition or decision row
  - But when the operator requests the opposite terminal state, the command fails and preserves the first decision

  `@ISOLATE-01` `@ISOLATE-02` `@ISOLATE-03` `@ISOLATE-04` `@ISOLATE-05` `@ISOLATE-06` `@ISOLATE-07`
# Scenario: Keep identical candidate IDs isolated across projects and concurrent use
  - Given two repositories each contain an active CAND-001 under their own resolved project identity
  - When each repository imports and ranks its own mirror, even if the local commands overlap
  - Then each ranking shows only that project's CAND-001 data and status
  - And promoting CAND-001 in one project leaves the other project's candidate active
  - And bounded contention never exposes a partial import or transition
  - But an ambiguous lookup across item scopes is refused instead of selecting the first match

## Alternative Paths

- **No company link:** the operator still gets a stable project identity from the normalized Git origin.
- **No usable Git origin:** the repository directory name is used, and the operator can add a company link later to remove ambiguity.
- **No target files:** the candidate remains rankable with a visible `0 / 0` grounding ratio and zero grounding contribution.
- **Mirror export fails after a durable transition:** the command reports the export failure; an idempotent replay repairs the mirror without duplicating the transition.
- **Database is busy:** the command waits only for the documented bound, then fails without a partial state change.

## Journey Analysis

### Layer 1 — What IS

The spec defines all seven scenarios and 31 ACs. The pre-change exact rank command failed because the harness did not exist; the implementation now passes the focused journey validator locally.

### Layer 2 — What SHOULD BE

Every scenario has local proof from the focused Candidate Harness validator. No scenario is labeled promoted or live until final-SHA replay after landing.

### Layer 3 — What's Missing or Wrong

| ID | Type | Where | Finding | Impact | Route |
|---|---|---|---|---|---|
| F1 | Resolved locally | All scenarios | Harness, seed mirror, and focused validator are implemented. | All public commands are executable in hermetic repositories. | final-SHA review and promotion replay remain |
| F2 | Resolved locally | Terminal transitions | Fixtures force failed ledger append, append-before-mark replay, and failed mirror export. | Replay heals without duplicate events or partial mirrors. | review-exec must independently confirm |
| F3 | Resolved locally | Project isolation | Cross-project identical-ID and cross-scope ambiguity fixtures pass. | Scoped predicates prevent project leakage and ambiguous selection. | audit-implementation must trace every statement |

### Ungrounded Preconditions

| Precondition | Producer role | Producer journey | Creation surface | Validation intact? | Impact |
|---|---|---|---|---|---|
| A valid candidate mirror exists | Framework candidate curator | This journey begins after curation; the committed 50-seed mirror is the v1 producer artifact | Human-edited JSON | Schema validator implemented and PASS | Grounding/ranking cannot begin if the mirror is malformed. |
| A supplied WI exists before promotion | Framework operator using the normal pipeline | Existing route/write-spec process | Existing WI workflow | Harness validates token shape only and does not create it | Preserves the explicit pre-WI boundary. |

No missing product-facing transition or concept fragmentation was found. The remaining findings are implementation/proof obligations already owned by WI-508 tasks.

## E2E Coverage

- `test-framework/evals/tier-1/validate-candidate-harness.sh` — local PASS for import/rank/top/promote/reject/retry/isolation and projection failure seams.
- Exact top-10 command — local PASS with an isolated SQLite/decision path; promoted WI-508 final-SHA replay remains pending.

## Coverage Gaps

- [x] All 31 AC tags are exercised by the focused validator and mapped proof surfaces; independent review/audit still owns sufficiency confirmation.
