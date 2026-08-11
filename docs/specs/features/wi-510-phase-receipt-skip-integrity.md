---
status: VERIFIED
type: Enabler
mode: bugfix-behavior
wi: WI-510
landscape_state: inapplicable
landscape_inapplicable_reason: internal framework validation contract with no customer-facing market flow
created: 2026-07-23
---

# Feature: Phase-Receipt-Aware Skip Integrity

**Status:** VERIFIED
**Verification confidence:** VERIFIED-L3 — headless framework behavior is covered by promoted-commit graph replay, mutation-red fixtures, and the complete Tier-1 suite; no browser, native, customer database, or deploy surface applies.
**Type:** Enabler
**Consumers:** Tier-1 task-graph validators, framework maintainers, promotion/reconcile gates
**Priority:** High
**Source of truth:** `docs/specs/work-items/WI-510.md`

## Delta Contract

**Preserved:** completed tasks cannot pass silently; skip conditions remain registry-backed; current malformed receipts fail closed; historical task graphs are not rewritten; the target project's customer database and application runtime are unrelated.

**Changed:** skip-integrity validation distinguishes a task that actually executed from a task intentionally skipped. A current executed task is proved by its matching loaded skill receipt and valid phase-evidence references. A current skipped task is proved by explicit delivery-graph authorization plus a registry-backed skip condition and justification. Neither state is inferred from prose alone.

**Non-goals:** changing task execution, changing phase emission, retaining every ignored command-output file forever, rewriting WI-498, adding a waiver, accepting arbitrary `phases_executed` arrays, or redesigning delivery-graph compilation.

## Industry Grounding

**Landscape state:** inapplicable
**Gate verdict:** SKIP
**Branch taken:** internal framework evidence contract with no customer/market choice
**Source:** repository-local Phase-D receipt, delivery-graph, task-state, and append-only audit contracts

### What the industry does

No provider or market mechanism is selected. The relevant precedents are the framework's existing fail-closed schema validators, migration cutoffs, explicit skip registry, task-state compatibility classifier, and append-only receipt chain.

### What we're doing

Correct one local semantic mismatch so the validator recognizes executed phase receipts without turning them into an implicit skip bypass.

### Why we differ or align

The change aligns with the existing split between current enforcement and historical compatibility. External comparison is reserved for the solution-confidence phase and does not replace repository contracts.

### Reversibility

The implementation is a two-way door through a reviewed revert. Historical graph bytes remain immutable.

## Problem Statement

The Tier-1 skip-integrity path currently interprets a completed registry skill through a legacy two-branch predicate: `skip_reason`, or a loaded receipt carrying `output_artifact` / `validation_output`. Promoted WI-498 tasks 5 and 6 executed and recorded complete Phase-D receipts, but lack those legacy summary fields. The validator therefore reports them as unjustified skips even though they were executed.

Without a state distinction, broadening the predicate can fix the false red by creating a fail-open path: any malformed or fabricated phase array could be mistaken for proof. Keeping the old predicate leaves promoted, valid execution permanently red.

## System Journey

```text
completed registry-skill task
          |
          v
  classify graph generation
          |
          +--> matching valid execution receipt --> EXECUTED --> PASS
          |
          +--> explicit valid delivery-graph skip
          |          + registry condition
          |          + justification/evidence --> SKIPPED --> PASS
          |
          +--> supported historical compatibility --> LEGACY PASS
          |
          +--> malformed / missing / unauthorized --> GHOST OR INVALID --> FAIL
```

## Consumer Stories

### US-1: Recognize executed work

**As** a Tier-1 task-graph validator,
**I need** to recognize a completed task with a matching loaded skill receipt and valid phase-evidence references as executed,
**So that** promoted execution is not mislabeled as an unjustified skip.

#### Acceptance Criteria — US-1

| AC | Description | QA | E2E | Test |
|---|---|---|---|---|
| PSR-01 | A completed task with a matching loaded skill receipt and valid Phase-D evidence references is classified as executed, not skipped. | — | N/A | ✅ |
| PSR-02 | Executed classification does not require a delivery-graph skip entry. | — | N/A | ✅ |
| PSR-03 | A mismatched receipt skill fails closed. | — | N/A | ✅ |
| PSR-04 | A current receipt with malformed `phases_executed` fails closed. | — | N/A | ✅ |
| PSR-05 | A current phase entry with no evidence artifacts fails closed. | — | N/A | ✅ |
| PSR-06 | An evidence reference with an empty, repository-escaping, non-temporary absolute, or type-incompatible temporary path fails closed. Canonical `/tmp`-style references produced by current review skills remain valid only for `file` and `command_output`. | — | N/A | ✅ |
| PSR-07 | Artifact resolvability means a canonical allowed type plus a safe non-empty repository-relative reference or a normalized OS-temporary reference for `file`/`command_output`; it does not claim permanent retention of ignored command-output bytes. | — | N/A | ✅ |

### US-2: Accept only authorized skips

**As** the framework's no-silent-skip gate,
**I need** current skipped completions to be explicitly authorized and registry-backed,
**So that** phase receipts cannot become a bypass for omitted work.

#### Acceptance Criteria — US-2

| AC | Description | QA | E2E | Test |
|---|---|---|---|---|
| PSR-08 | A current skipped task passes only when `delivery_graph.skipped_skills` names the skill with a registered skip condition. | — | N/A | ✅ |
| PSR-09 | The delivery-graph skip entry includes non-empty reason and evidence. | — | N/A | ✅ |
| PSR-10 | The completed task carries a non-empty string `skip_reason` whose normalized text equals the authorized delivery reason, plus a structurally valid matching phase receipt with non-empty resolvable evidence references. | — | N/A | ✅ |
| PSR-11 | Missing delivery authorization fails closed even when `skip_reason` prose exists. | — | N/A | ✅ |
| PSR-12 | An unregistered, wrong-skill, or inapplicable skip condition fails closed. Applicability requires substantive condition metadata plus the delivery entry's non-empty evidence. | — | N/A | ✅ |
| PSR-13 | A phase receipt on a genuinely skipped task does not independently authorize the skip. | — | N/A | ✅ |

### US-3: Preserve historical compatibility without rewriting history

**As** a framework maintainer,
**I need** supported historical graphs to retain their documented compatibility behavior,
**So that** enforcement improves without manufacturing or deleting audit history.

#### Acceptance Criteria — US-3

| AC | Description | QA | E2E | Test |
|---|---|---|---|---|
| PSR-14 | Historical compatibility is derived from the existing receipt cutoff's fixed pre-enforcement Git anchor and an exact completed task/skill/receipt match in the tracked graph snapshot at that anchor, not editable graph timestamps, backdated Git commit dates, path age alone, caller markers, or a new WI-specific allowlist. | — | N/A | ✅ |
| PSR-15 | Unsupported, backdated, untracked, or malformed legacy-shaped graphs fail closed. | — | N/A | ✅ |
| PSR-16 | `.svc/lane-tasks-WI-498.json` passes unchanged because tasks 5 and 6 are executed completions with matching structured receipts. | — | N/A | ✅ |
| PSR-17 | The implementation does not edit WI-498, its graph, receipts, notes, checkpoints, or Git-note attestations. | — | N/A | ✅ |
| PSR-18 | The WI-498 main-green allowlist row remains through implementation promotion, is removed only after promoted-main focused replay and full Tier-1 pass, and is followed by another full Tier-1 pass without the row. | — | N/A | ✅ |

### US-4: Keep overlapping validators coherent

**As** a framework operator,
**I need** skip-integrity consumers to use one state interpretation,
**So that** one Tier-1 validator cannot accept a graph another rejects for the same semantic reason.

#### Acceptance Criteria — US-4

| AC | Description | QA | E2E | Test |
|---|---|---|---|---|
| PSR-19 | Focused mutation-red fixtures cover executed, authorized-skip, unauthorized, malformed phase IDs/timestamps, prose-only, legacy-authority, cutoff-parity, and registered-filter paths. | — | N/A | ✅ |
| PSR-20 | `validate-skip-conditions-registry.sh` and `validate-lane-tasks-integrity.sh` consume or agree with the canonical classification. | — | N/A | ✅ |
| PSR-21 | The new focused validator runs from the aggregate Tier-1 harness. | — | N/A | ✅ |
| PSR-22 | Full Tier-1 passes without baseline allowlisting the WI-498 failure. | — | N/A | ✅ |

## System Dependencies

### This feature depends on

| Dependency | Type | Spec exists? | What it provides | Mock strategy |
|---|---|---|---|---|
| Phase receipt schema | Enabler | ✅ `references/phase-receipts.md` | Current and historical receipt behavior | Hermetic JSON fixtures |
| Delivery graph validator | Enabler | ✅ `scripts/validate-delivery-graph.mjs` | Skip authorization and legacy graph rules | Temporary fixture graphs |
| Skip conditions registry | Enabler | ✅ `references/skip-conditions.json` | Registered skip applicability | Temporary registry fixtures |
| Task graph shape contract | Enabler | ✅ `scripts/task-graph.mjs` and hook validators | Status, receipt, and dependency shape | Hermetic task graphs |
| Promoted WI-498 graph | Audit authority | ✅ `.svc/lane-tasks-WI-498.json` | Original false-red replay | Read-only copied fixture or direct unchanged replay |

### Other features depend on this

| Consumer | Type | What it needs |
|---|---|---|
| Aggregate Tier-1 | Framework gate | One coherent skip/execution verdict |
| Main-green canary | Framework gate | No obsolete WI-498 exception |
| Promotion/reconcile workflow | Framework workflow | Accurate baseline classification |

No network, database, provider, credential, or customer-data dependency exists.

## API Contracts

N/A — no HTTP or external API surface.

## Data Model

No new persisted schema. The feature reads existing task graph, delivery graph, receipt, and registry fields.

## Event Contracts

N/A — the validator reports deterministic process exit status and diagnostics.

## Feature Toggles

None. A toggle would permit validator disagreement; rollback is a reviewed commit revert.

## Technical Design

The selected architecture is one dependency-free task-local Node classifier
with a thin CLI and three Tier-1 consumers. It returns `executed`,
`authorized-skip`, `legacy-compatible`, or `invalid` with stable reason codes.
Skip intent is evaluated before execution evidence so a receipt cannot authorize
omitted work. An authorized completed skip still needs a strict matching phase
receipt; authorization alone is not execution evidence.

The full component map, state/data-flow diagrams, strict receipt and
authorization predicates, cost model, operations contract, feasibility matrix,
risks, and test matrix are baselined in
`docs/specs/tech/wi-510-phase-receipt-skip-integrity.md`.

### Verified implementation

- `RESOLVED-L3` — pure classifier:
  `scripts/lib/completed-task-integrity.mjs`
- `RESOLVED-L3` — CLI adapter:
  `scripts/validate-completed-task-integrity.mjs`
- `RESOLVED-L3` — focused mutation-red Tier-1 validator and fixtures
- `RESOLVED-L3` — delegate overlapping registry/lane-integrity predicates to the
  shared CLI
- `RESOLVED-L3` — document the interpretation in `references/phase-receipts.md`
- `RESOLVED-L3` — remove only the WI-498 main-green row after focused and aggregate
  proof

### Feasibility

All PSR-01 through PSR-22 acceptance criteria are feasible without data,
provider, UI, network, dependency, or historical-graph changes.

## Pillars Coverage Matrix

| # | Pillar | State | Artifact / note |
|---|---|---|---|
| 1 | Product fit | [UNCHANGED — VERIFIED] | Deterministic, evidence-backed framework gates remain the product objective. |
| 2 | Journey | [UPDATED] | System journey in this spec distinguishes executed, skipped, legacy, and invalid states. |
| 3 | Acceptance criteria | [UPDATED] | PSR-01 through PSR-22. |
| 4 | UX | [N/A — justified] | Headless framework validator; diagnostics only. |
| 5 | UI | [N/A — justified] | No browser or visual surface. |
| 6 | Tech architecture | [UPDATED — BASELINED] | `docs/specs/tech/wi-510-phase-receipt-skip-integrity.md` |
| 7 | Cost model | [UNCHANGED — VERIFIED] | Local bounded file/JSON checks; zero paid or network cost. |
| 8 | Operations & ownership | [UPDATED] | Framework maintainers own focused replay, Tier-1, allowlist removal, and promoted-main verification. |

## Scope Review

**Mode:** Hold.

The narrow scope is complete: distinguish executed work from authorized skips, preserve canonical legacy compatibility, add mutation-red proof, remove the obsolete allowlist row, and replay WI-498 unchanged. It does not expand into receipt retention, task-graph migration, or a general evidence-authenticity framework.

All nine directives pass: failure states are named; nil/empty/malformed paths are covered; the classification diagram is present; no deferred behavior is hidden; observability is the validator diagnostic; the design remains reversible; and a broad “accept any receipt” shortcut is explicitly rejected.

## Journey References

| Journey | Scenarios | ACs covered | Type |
|---|---|---|---|
| Inline skip-integrity system journey | Executed, authorized skip, legacy compatibility, ghost/malformed | PSR-01–PSR-22 | System |

## Revision Log

| Date | AC | Was | Now | Why | By skill |
|---|---|---|---|---|---|
| 2026-07-23 | PSR-01/08 | WI language could conflate execution evidence with skip authorization | Explicitly separates executed completion from authorized skip | WI-498 has executed tasks and no delivery graph; the unchanged replay requires the distinction | write-spec |
| 2026-07-23 | PSR-01–22 | Baselined design and planned implementation | VERIFIED-L3 on promoted implementation `781d913bea632b172296b3e29bb03004743fa0ec`; focused replay and Tier-1 pass | PR #175 merged and promoted proof completed before removing the WI-498 known-red row | verify-promotion |
