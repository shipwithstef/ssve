# Feature: Candidate Reservoir and Triage Engine

**Status:** VERIFIED
**Confidence:** L3 — headless CLI; promoted rank/top/promote/reject replay
**Type:** Enabler
**Consumers:** framework operators, `route-workflow`, `improve-framework`, `/cos` role workflows, `plan-changeset`
**Priority:** HIGH
**Mode:** extend-feature
**Created:** 2026-07-23
**Work item:** WI-508

## Problem Statement

SVC can capture ideas and create Work Items, but it cannot hold a large, noisy pool of pre-scoping candidates without promoting those candidates into active planning surfaces. Operators therefore lack a project-isolated place to compare ideas, verify whether each idea is grounded in the checked-out codebase, apply consistent product/growth/risk judgment, and record a promotion or rejection decision.

Without this enabler, high-volume ideation pollutes Work Item and project data, ranking is not reproducible, and cross-project candidate state can be mixed accidentally. The pre-change replay fails because the requested harness and mirror do not exist.

## Scope

### Goals

- Hold high-volume candidates outside active Work Items and customer databases.
- Rank candidates deterministically from explicit role scores plus live code grounding.
- Keep machine state in local SQLite while producing a deterministic Git-readable JSON mirror.
- Promote or reject one candidate through explicit commands and append an auditable framework decision.
- Resolve project identity portably with no company or proprietary path literals in executable source.

### Non-goals

- No access to Supabase or any target project's customer database.
- No automatic Work Item creation, project-database writes, remote sync, UI, daemon, or background scheduler.
- No LLM calls or inferred scores inside the harness.
- No cross-project ranking unless the caller explicitly imports each project into its own scope.
- No modification of files named in `target_files`; grounding is read-only.

## Invariants

1. Candidate rows are keyed by `project_id`, `item_scope`, and `candidate_id`.
2. Importing the same mirror twice is idempotent for candidate identity and latest content.
3. Runtime composite scores are derived, never trusted from a persisted `composite_score` field.
4. Code grounding is computed from the current repository filesystem on each rank/top run.
5. Promotion and rejection are mutually exclusive terminal triage states for a candidate version.
6. The JSON mirror is deterministic and human-readable; SQLite is the operational source for mutations.
7. All failures leave the input mirror, decision ledger, and previously committed candidate state recoverable.
8. A candidate row remains bound to its originating mirror; same-scope cross-mirror reassignment fails instead of silently removing it from Git evidence.

## Acceptance Criteria

The consumer stories below define the complete executable acceptance contract.

### US-1 — Import and rank a candidate pool

**As** a framework operator,
**I need** to import a candidate mirror and receive a deterministic ranking,
**So that** I can compare many ideas without creating Work Items.

| AC | Description | QA | E2E | Test |
|---|---|---|---|---|
| CAND-01 | `--file <path> --rank` accepts a valid mirror and prints every candidate in descending composite order. | — | 🔲 | focused CLI fixture |
| CAND-02 | `--file <path> --top <N>` prints exactly `min(N, candidate_count)` ranked rows and rejects non-positive or non-integer `N`. | — | 🔲 | focused CLI fixture |
| CAND-03 | Re-importing an unchanged candidate identity updates no duplicate row and produces byte-equivalent exported candidate ordering. | — | 🔲 | idempotency fixture |
| CAND-04 | Invalid JSON, missing required fields, duplicate candidate IDs, non-finite scores, and out-of-range scores fail non-zero before any decision event is appended. | — | 🔲 | invalid-input matrix |
| CAND-05 | Ranking ties resolve by `candidate_id` ascending so output is stable across runs. | — | 🔲 | tie fixture |
| CAND-06 | The seed mirror contains exactly 50 unique sequential IDs from `CAND-001` through `CAND-050`. | — | 🔲 | seed validator |

### US-2 — Verify codebase grounding

**As** the code-grounding evaluator,
**I need** to verify declared target files against the current repository,
**So that** a candidate's technical relevance is evidence-based.

| AC | Description | QA | E2E | Test |
|---|---|---|---|---|
| GROUND-01 | Every rank/top row reports the exact `validCount / totalCount` for its declared `target_files`. | — | 🔲 | mixed-existence fixture |
| GROUND-02 | A target counts as valid only when its normalized path remains inside the repository root and exists as a regular file or directory on disk. | — | 🔲 | path-containment fixture |
| GROUND-03 | Absolute paths, `..` escapes, broken symlinks, and targets resolving outside the repository count invalid and are identified in diagnostics. | — | 🔲 | hostile-path fixture |
| GROUND-04 | An empty `target_files` array reports `0 / 0` and contributes a code-grounding score of `0`, never `NaN` or `100`. | — | 🔲 | empty-target fixture |
| GROUND-05 | The effective `Code_Grounding` dimension equals `(validCount / totalCount) * 100` when `totalCount > 0`. | — | 🔲 | score derivation fixture |
| GROUND-06 | Grounding reads the filesystem only and never creates, edits, or deletes a declared target. | — | 🔲 | before/after hash fixture |

### US-3 — Apply multi-role triage scoring

**As** the `/cos` triage workflow,
**I need** a shared composite formula over explicit product, growth, database, and security judgments,
**So that** different projects are evaluated consistently.

| AC | Description | QA | E2E | Test |
|---|---|---|---|---|
| SCORE-01 | Every candidate declares at least one `cos_roles` label and all four authored score dimensions: `product_impact`, `growth_flywheel`, `db_overhead`, and `security_risk`. | — | 🔲 | schema fixture |
| SCORE-02 | Every authored score is a finite number from 0 through 100 inclusive. | — | 🔲 | boundary fixture |
| SCORE-03 | Composite score is exactly `(0.35 * Product_Impact) + (0.25 * Code_Grounding) + (0.20 * Growth_Flywheel) - (0.10 * DB_Overhead) - (0.10 * Security_Risk)`. | — | 🔲 | formula fixture |
| SCORE-04 | Displayed composite values use two decimal places while sort comparisons use the unrounded computed value. | — | 🔲 | precision fixture |
| SCORE-05 | Persisted or imported `composite_score`, grounding counts, and grounding ratios are ignored and recomputed. | — | 🔲 | stale-derived-field fixture |
| SCORE-06 | Ranking output names the candidate ID, work type, role labels, five effective dimensions, composite value, grounding ratio, and status. | — | 🔲 | output contract fixture |

### US-4 — Promote or reject a candidate explicitly

**As** a framework operator,
**I need** explicit promotion and rejection commands,
**So that** only deliberate decisions cross the pre-WI boundary.

| AC | Description | QA | E2E | Test |
|---|---|---|---|---|
| TRIAGE-01 | `--promote <CAND_ID> --wi <WI_ID>` changes one matching active candidate to `promoted` and records its `promoted_wi`. | — | 🔲 | promotion fixture |
| TRIAGE-02 | `--reject <CAND_ID> --reason <reason>` changes one matching active candidate to `rejected` and persists a non-blank reason. | — | 🔲 | rejection fixture |
| TRIAGE-03 | Promote/reject requires an unambiguous project and item scope; missing or duplicate cross-scope IDs fail closed. | — | 🔲 | ambiguity fixture |
| TRIAGE-04 | Repeating the identical terminal command is idempotent; a conflicting terminal transition fails non-zero without overwriting the first decision. | — | 🔲 | transition matrix |
| TRIAGE-05 | Each successful first terminal transition appends one JSON object to `.svc/pipeline-decisions.jsonl` with timestamp, project, scope, candidate, action, reason or WI, and resulting status. | — | 🔲 | ledger fixture |
| TRIAGE-06 | Promotion records a boundary decision only; the harness does not create or modify a WI document or project database record. | — | 🔲 | filesystem diff fixture |

### US-5 — Preserve project and storage isolation

**As** the framework state owner,
**I need** portable project identity and isolated local storage,
**So that** open-source consumers can use the harness without proprietary assumptions or data leakage.

| AC | Description | QA | E2E | Test |
|---|---|---|---|---|
| ISOLATE-01 | Project identity first uses non-blank `.svc/company-link.json` `app_id` when the file is present and valid. | — | 🔲 | config precedence fixture |
| ISOLATE-02 | Without `app_id`, identity uses normalized `git remote get-url origin`; without a usable remote, it uses the repository directory basename. | — | 🔲 | fallback fixtures |
| ISOLATE-03 | Script source contains no company names, user home paths, workspace-specific absolute paths, Supabase clients, or proprietary repository names. | — | 🔲 | static validator |
| ISOLATE-04 | Default operational state is a native Node SQLite database under the local SVC state directory and is separable from Git mirrors and customer data. | — | 🔲 | temp-home fixture |
| ISOLATE-05 | Tests can redirect the database and decision ledger into an isolated temporary home/repository without touching the operator's real `~/.svc/store.db`. | — | 🔲 | hermetic fixture |
| ISOLATE-06 | Two project IDs may use the same candidate ID without reading, ranking, promoting, rejecting, or exporting each other's rows. | — | 🔲 | cross-project fixture |
| ISOLATE-07 | SQLite schema creation and import/transition operations are transactional and tolerate a second process by using bounded busy handling rather than partial writes. | — | 🔲 | contention fixture |

## CLI Contract

| Command | Required inputs | Observable result |
|---|---|---|
| `node scripts/candidate-harness.mjs --file <path> --rank` | Existing valid mirror | Imports current scope, recomputes grounding/composite, prints all ranked rows, exports deterministic mirror. |
| `node scripts/candidate-harness.mjs --file <path> --top <N>` | Existing valid mirror; positive integer N | Same as rank, limited to N display rows. |
| `node scripts/candidate-harness.mjs --promote <CAND_ID> --wi <WI_ID>` | Existing unambiguous candidate; WI token matching `^WI-[A-Z0-9]+(?:-[A-Z0-9]+)*$` | Transactional state transition, mirror export, one decision event. |
| `node scripts/candidate-harness.mjs --reject <CAND_ID> --reason <reason>` | Existing unambiguous candidate; non-blank reason | Transactional state transition, mirror export, one decision event. |

## Mirror Contract

The human/Git mirror contains `schema_version`, `topic`, `project_id`, `item_scope`, and `candidates`. Each candidate contains `id`, `title`, `summary`, `work_type`, `item_scope`, `target_files`, `code_grounding`, `cos_roles`, `scores`, and triage state fields. Derived runtime values may be exported for review but are never trusted on import.

## System Dependencies

### This feature depends on

| Dependency | Type | Spec exists? | What it provides | Mock strategy |
|---|---|---|---|---|
| Node.js 22+ `node:sqlite` | Runtime enabler | external runtime contract | Synchronous local SQLite API | Use live installed Node; fail with a clear version/runtime error if unavailable. |
| Git repository metadata | Local integration | existing framework contract | Origin URL and repository root | Temp Git repositories with and without remotes. |
| `.svc/company-link.json` | Optional local config | WI-507 company-link contract | Preferred portable `app_id` | Temp config fixture; absence exercises fallback. |
| `.svc/pipeline-decisions.jsonl` | Framework ledger | existing | Auditable promotion/rejection events | Temp repository ledger. |

### Other features depend on this

| Consumer | Type | What it needs from us |
|---|---|---|
| `route-workflow` | Enabler | A deliberate promotion boundary before active WI routing. |
| `/cos` role workflows | Enabler | Shared candidate schema, labels, and reproducible score computation. |
| `improve-framework` | Enabler | High-volume framework ideas that do not become pending proposals prematurely. |

## Event Contracts

| Event | Producer | Consumer | Payload | AC |
|---|---|---|---|---|
| `candidate-promoted` decision row | candidate harness | framework audit/route consumers | project, scope, candidate, WI, status, timestamp | TRIAGE-01, TRIAGE-05 |
| `candidate-rejected` decision row | candidate harness | framework audit consumers | project, scope, candidate, reason, status, timestamp | TRIAGE-02, TRIAGE-05 |

## Industry Grounding

**Source:** official Node `node:sqlite`, SQLite atomic-commit, and Git remote contracts plus project-local `scripts/company-memory.mjs` and `scripts/state-io.mjs` patterns
**Landscape state:** internal framework storage and triage capability; no customer-facing competitor landscape
**Gate verdict:** SKIP market comparison; ALIGN with local transactional and Git-readable state practice
**Branch taken:** primary-source runtime grounding plus framework-local implementation evidence

### What the industry does

Node exposes synchronous prepared SQLite statements through `DatabaseSync`; SQLite provides atomic local transactions with bounded busy handling; Git exposes configured origin URLs and reviewable text artifacts. Issue/product-discovery systems commonly separate noisy intake from committed delivery work, but their hosted workflows are not a required runtime dependency here.

### What we're doing

Use Node's built-in SQLite as the scoped operational store, recompute filesystem grounding on each ranking, project deterministic JSON for Git review, and put terminal decision events through a transactional outbox before appending the framework ledger.

### Why we differ or align

We align with transactional local state and deterministic projections while differing from hosted product-discovery tools: SVC must work offline across unrelated repositories, cannot access customer databases, and treats promotion as an explicit boundary rather than automatic issue creation.

### Reversibility

Two-way door. The executable, seed, and validator can be reverted together without a customer schema migration. Local candidate rows remain isolated in the SVC database and reviewed mirrors can reconstruct state; no rollback deletes operator data automatically.

## Technical Design

The complete architecture is drafted in `docs/specs/plans/CANDIDATE_HARNESS_PLAN.md`. It defines one cohesive Node CLI backed by project/scope-keyed native SQLite, a deterministic Git mirror, live lexical-plus-realpath grounding, an exact pure scoring function, transactional terminal states, and a durable decision outbox that makes JSONL projection idempotent across crashes.

### Planned Components

| Component | File | Status |
|---|---|---|
| Candidate CLI, store, grounding, scoring, projection | `scripts/candidate-harness.mjs` | IMPLEMENTED — local proof PASS |
| Fifty-candidate seed mirror | `docs/specs/candidates/consumer-experience-pool.json` | IMPLEMENTED — 50/50 IDs validated |
| Hermetic public-CLI validator | `test-framework/evals/tier-1/validate-candidate-harness.sh` | IMPLEMENTED — core/rank/triage PASS |

### Feasibility

All 31 ACs are feasible without external services, credentials, customer-database access, package installation, or an upstream spec change. The architecture covers candidate validation/ranking (CAND-01..06), contained filesystem evidence (GROUND-01..06), exact scoring (SCORE-01..06), terminal transitions and decision audit (TRIAGE-01..06), and project/concurrency isolation (ISOLATE-01..07).

### Cost and Operations

Compute and storage are local and linear in candidates plus declared targets; bandwidth, external API, and background-job costs are zero. SVC framework maintainers own the best-effort CLI. Recovery uses idempotent replay, the SQLite outbox, atomic mirror replacement, and Git mirrors as reviewed reconstruction input. Exact thresholds, failure modes, schema DDL, diagrams, alternatives, risks, and rollback are specified in the master architecture.

## Pillars Coverage Matrix

| # | Pillar | State | Artifact / note |
|---|---|---|---|
| 1 | Product fit | [UPDATED] | Direct WI-508 user report and `proposals/2026-07-23-framework-improvement-candidate-reservoir.md`. |
| 2 | Journey | [UPDATED] | System command journeys are task 18 and will reference all AC groups. |
| 3 | Acceptance criteria | [UPDATED] | This spec defines atomic CLI, isolation, scoring, grounding, and transition ACs. |
| 4 | UX | [N/A — justified] | Internal non-interactive CLI; output/error contracts are specified here. |
| 5 | UI | [N/A — justified] | No rendered surface, CSS, components, or visual assets. |
| 6 | Tech architecture | [UPDATED] | G4-passed architecture in `docs/specs/plans/CANDIDATE_HARNESS_PLAN.md` is implemented and locally verified. |
| 7 | Cost model | [UPDATED] | Local CPU/storage scale linearly; network, API, and job cost are zero. |
| 8 | Operations & ownership | [UPDATED] | Framework owns local schema/versioning, deterministic mirrors, rollback, and replay fixtures. |

## Implementation Notes

G4 passed on iteration 2 after repairing moved-worktree mirror containment, S4 persona traceability, and the cross-storage projection contract. Plan review converged at the mechanical three-round cap with zero Critical and zero remaining High. The focused validator now proves config/origin/basename identity, native SQLite scoping and contention, exact ranking, hostile-path grounding, terminal monotonicity, outbox and atomic-mirror recovery, moved-repository export, and cross-project isolation. This is local implementation evidence only; review, land, and promoted replay remain separate gates.

## Journey References

| Journey | Scenarios | ACs Covered | Type |
|---|---|---|---|
| `J-FW-06-candidate-reservoir-triage.feature.md` | complete rank, top-N, invalid mirror, promote, reject, retry/conflict, project isolation | CAND-01..06, GROUND-01..06, SCORE-01..06, TRIAGE-01..06, ISOLATE-01..07 | System/operator |

## Revision Log

| Date | AC | Was | Now | Why | By skill |
|---|---|---|---|---|---|
| 2026-07-23 | all | (new) | Initial WI-508 DRAFT contract | New framework capability | write-spec |
| 2026-07-23 | all | DRAFT design | BASELINED after G4 iteration 2 | All 31 ACs feasible; three cross-review blockers repaired | design-tech + review-gate |
| 2026-07-23 | all | BASELINED design | Implemented with focused local proof | Red-green Candidate Harness validator passes all core/rank/triage groups | execute-changeset |
| 2026-07-23 | all | Implemented local proof | CHANGE-SET-APPROVED after G5 iteration 2 | Fresh Agent B verified all implementation repairs and executable cross-storage falsification evidence; zero Critical/High remain | review-gate |
| 2026-07-23 | all | CHANGE-SET-APPROVED | G6 execution review PASS-WITH-ACKS | Two canonical Opus/high rounds fixed cross-mirror reassignment and supported hardening findings; zero unresolved Critical and all Highs dispositioned | review-exec |
