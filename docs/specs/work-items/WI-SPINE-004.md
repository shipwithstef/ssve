# WI-SPINE-004: Infra-Specific Gate Skills — plan-blast-radius + track-topology-diff

**Type:** framework
**Status:** partial
**Severity:** high
**Filed:** 2026-04-30
**Source:** proposal `proposals/done/2026-04-30-infra-project-support.md` § 11 Phase D
**Lane:** framework
**Depends on:** WI-SPINE-003 (lanes must exist before phase-position skills slot in)
**Blocks:** WI-SPINE-005

## Goal

Add the 2 remaining net-new skills from proposal §6: `plan-blast-radius` (SEV-tier human-checkpoint gate) and `track-topology-diff` (post-apply structural state-graph diff). After this WI, the proposal commits no further new SKILL.md files.

## Actual State Audit — 2026-05-11

This WI is partially implemented:

- `plan-blast-radius/SKILL.md` exists and validates as a skill.
- `track-topology-diff/SKILL.md` exists and validates as a skill.
- `.svc/cost-baseline.jsonl`, `.svc/security-baseline.jsonl`, and `.svc/scalability-baseline.jsonl` exist with schema comments.
- `validate-infra-spec-dimensions.sh` and `validate-infra-version-pins.sh` exist and run in tier-1.

Remaining hard gaps:

- Dedicated validators `validate-plan-blast-radius-classifies.sh` and `validate-track-topology-diff-shape.sh` do not exist.
- There is no tier-2 fixture infra repo exercising both skills end-to-end.
- Baseline writes from `review-security --mode=cost-impact`, infra `review-gate`, and chaos journeys are not proven.

Definition correction: skill contracts existing is not enough. This WI should close only after the two skills have deterministic validators and at least one recorded fixture path proving SEV classification and topology snapshot/diff behavior.

## Broad Scope

1. **`plan-blast-radius` skill** — directory `plan-blast-radius/` with SKILL.md. Inputs: `terraform plan` JSON / `helm diff` output. Classifies SEV-1 / SEV-2 / SEV-3 / SEV-4. SEV-1/2 force `human_checkpoint: true` regardless of autorun. Output: `docs/specs/features/<name>/blast-radius.md`. Chain position: between `plan-changeset` and `review-plan` for infra lanes.
2. **`track-topology-diff` skill** — directory `track-topology-diff/`. Snapshots `terraform state list` / `kubectl get all -A -o json`. Structural diff against prior baseline. Output: `docs/specs/topology-snapshots/<timestamp>/state.json` + `diff-<from>-<to>.md`.
3. **Tier-1 evaluators** — `validate-plan-blast-radius-classifies.sh`, `validate-track-topology-diff-shape.sh`.
4. **Tier-2 behavioral fixtures** — stub fixture infra repo (minimal Terraform) that exercises both skills end-to-end.
5. **Three §17 dimension baselines** — initialize `.svc/cost-baseline.jsonl`, `.svc/security-baseline.jsonl`, `.svc/scalability-baseline.jsonl` with the documented append-only schema. Wire baseline writes from `review-security --mode=cost-impact` (phase 9), `review-gate` infra mode (phase 14), and `test-journeys` chaos template (phase 16).
6. **`validate-infra-spec-dimensions.sh` + `validate-infra-version-pins.sh`** — both tier-1 validators per proposal §8 anti-rediscovery artifacts table.

## Acceptance Criteria

- AC1: Both new skills exist, validate against `validate-skill-structure.sh`, have self-verify tables, run end-to-end against fixture infra repo in tier-2 behavioral.
- AC2: SEV-1/2 classification on a fixture plan produces a human-checkpoint prompt; SEV-3/4 does not.
- AC3: track-topology-diff produces a valid baseline snapshot and a clean diff output for a no-op apply.
- AC4: All three baseline files exist and accept the documented entry shape; first write from each gate produces a baseline entry.
- AC5: Both new validators run in <5s and integrate with `test-framework/evals/run-all-evals.sh --tier1`.
- AC6: Existing 7 lanes still unchanged; existing evals green.
