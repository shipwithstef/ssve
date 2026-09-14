# Execution Controller production closeout

**Status:** VERIFIED
**Type:** Enabler
**Mode:** contract-change
**WI:** WI-529

## Problem statement

Execution Controller v2 is merged, but its evidence and installation boundaries have two inconsistencies: AGY is routable but not representable in legacy chain receipts, and Codex materializes a durable launcher but installs its composite mutation dispatcher directly. Both can produce a false incomplete/complete state at release closeout.

## Consumer stories

- As the chain validator, I can validate the actual AGY reviewer identity without relabeling it as Gemini CLI.
- As Codex setup, I only report convergence when the effective governed command traverses the durable launcher.
- As an existing installation, I retain unrelated host configuration and legacy receipt readability.

## Acceptance criteria

| ID | Criterion | Proof |
|---|---|---|
| PC-1 | AGY is valid in plan/exec primary and fallback reviewer fields. | Schema validation fixtures |
| PC-2 | Unknown hosts remain invalid and AGY maps to Google family. | Mutation and family tests |
| PC-3 | Codex composite dispatcher is invoked through `svc-enforce`. | Hermetic wirer output |
| PC-4 | Dispatcher still owns one serialized child sequence with one skill-load gate. | Structural/runtime validator |
| PC-5 | Setup fails closed when case-wirer routing markers are absent. | End-to-end setup fixture |
| PC-6 | Canonical main install passes live Codex drift detection after merge. | Post-merge setup + drift output |

## System dependencies

- Depends on the existing durable launcher, Codex dispatcher, receipt validator, and v2 reviewer topology.
- Consumed by `review-plan`, `review-exec`, `land-changeset`, setup, and install-drift verification.

## Invariants

- Direct Gemini CLI is not introduced as the active Google review route.
- Existing `gemini` receipt compatibility is retained.
- No gate, reviewer, receipt digest, or runtime proof is removed.
- Unrelated host configuration is preserved by idempotent merge.

## Pillars coverage matrix

| Pillar | State |
|---|---|
| Product | [UNCHANGED — VERIFIED] framework-only closeout |
| UX | [N/A — no user interface] |
| UI | [N/A — no visual surface] |
| Technical | [UPDATED] schemas and installer routing |
| Security | [UPDATED] durable fail-closed enforcement path |
| Privacy | [UNCHANGED — VERIFIED] no data surface |
| Operations | [UPDATED] setup/drift convergence proof |
| Evidence | [UPDATED] truthful AGY identity and post-install proof |

## Industry Grounding

**Source:** repository-local reviewer topology, installed hook configuration, transactional migration fixtures, and durable-launcher contracts
**Landscape state:** stable internal infrastructure contract as of 2026-08-11

### What the industry does

Infrastructure installers bind effective commands to durable entrypoints, preserve unrelated configuration transactionally, and record the real reviewer/provider identity.

### What we're doing

SVC represents AGY truthfully, requires one launcher-routed governed command, and validates the effective host state after wiring rather than trusting source intent.

### Why we differ

N/A for a market-facing feature comparison. The behavior is grounded in the repository's authoritative Codex hook knowledge node, live installed configuration, and the standard infrastructure properties above.

### Reversibility

Legacy receipt identities remain readable, installer snapshots restore prior config bytes, and the launcher bundle is removed only after its final host reference is rolled back.
