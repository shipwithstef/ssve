# WI-SPINE-005: Recall Becomes Required — flip the gate, prove autonomy

**Type:** framework
**Status:** blocked
**Severity:** medium
**Filed:** 2026-04-30
**Source:** proposal `proposals/done/2026-04-30-infra-project-support.md` § 11 Phase E
**Lane:** framework
**Depends on:** WI-SPINE-001, WI-SPINE-002, WI-SPINE-003, WI-SPINE-004
**Blocks:** none

## Goal

Flip the `recall-stack-knowledge` gate from advisory (warns) to blocking (refuses to proceed) for `infra-*` lanes. Prove the Spine has reached operational maturity by demonstrating autonomous gap closure on at least one real session.

## Actual State Audit — 2026-05-11

This WI is not ready to execute yet. The advisory Spine exists, but the mechanical infra lane is not runnable:

- `compile-delivery-graph.mjs --lane infra-feature` currently fails with `Unsupported lane: infra-feature`.
- SPINE-003 still needs manifest/compiler support for the five infra lanes.
- SPINE-004 still needs deterministic validators and fixture proof for `plan-blast-radius` and `track-topology-diff`.
- The real-session autonomous closure proof does not exist yet.

The right order is:

1. Finish SPINE-003 mechanical infra lane registration and graph compilation.
2. Finish SPINE-004 deterministic gate-skill validators and fixtures.
3. Run one real or recorded miss/spawn/write/hit proof.
4. Then flip the infra recall gate from advisory to blocking.

## Broad Scope

1. **Gate enforcement** — change `recall-stack-knowledge` self-verify behavior so 0-hit recall on a declared-surface topic FAILS instead of warning, blocking the lane until the gap → research auto-loop closes the gap.
2. **`validate-no-rediscovery.sh` becomes blocking** — promote from warning to error in tier-1.
3. **Knowledge domain count gate** — require ≥3 populated, sourced domains in `references/knowledge/domains/` before flipping gate. They should be relevant to the active infra lane; Terraform is optional unless the lane requires Terraform-specific knowledge.
4. **Demonstrated autonomous closure** — produce one real session log showing `recall MISS → research SPAWNED → knowledge WRITTEN → next session HIT` (proposal §13 success criterion).
5. **Success-criteria measurement** — measure all four §13 Spine criteria on real sessions over a 30-day window; document results in `docs/specs/spine-readiness-report.md`.

## Acceptance Criteria

- AC1: Recall gate is blocking for all infra lanes; 0-hit on declared topic refuses to proceed.
- AC2: Recall remains advisory-only for app lanes (per §15.1 commitment — no app regression).
- AC3: ≥3 knowledge domains populated, each with valid INDEX/CAPABILITIES/details structure.
- AC4: Spine readiness report shows: recall hit-rate ≥80%, spec-reading reduction ≥60%, zero recurring rediscoveries, ≥1 demonstrated autonomous closure.
- AC5: Existing 7 app lanes still unchanged; existing tier-1/tier-2 evals green.
