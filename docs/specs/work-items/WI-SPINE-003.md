# WI-SPINE-003: Infra Lanes + Templates + Mode Flags (no new skills beyond Phase A)

**Type:** framework
**Status:** partial
**Severity:** high
**Filed:** 2026-04-30
**Source:** proposal `proposals/done/2026-04-30-infra-project-support.md` § 11 Phase C
**Lane:** framework
**Depends on:** WI-SPINE-001, WI-SPINE-002
**Blocks:** WI-SPINE-004

## Goal

Add the 5 infra lanes (`infra-greenfield`, `infra-feature`, `infra-migration`, `infra-incident`, `infra-cost-optimization`) and all the templates / annexes / mode flags from proposal §7 — without introducing any new SKILL.md files beyond `recall-stack-knowledge` from Phase A.

## Actual State Audit — 2026-05-11

This WI is partially implemented in documentation/templates, but not mechanically complete:

- `route-workflow/references/lane-model.md` documents the five infra lanes.
- `route-workflow/references/intent-routing.md` has infra routing examples.
- Templates exist for infra spec, topology, runbook, cutover runbook, chaos journey, and infra tech design.
- `execute-changeset --infra` and `verify-promotion --infra` are documented.

Remaining hard gap:

- `skills-manifest.json` still has only the original seven `laneDefinitions`.
- `scripts/compile-delivery-graph.mjs` still rejects `infra-feature` with `Unsupported lane: infra-feature`.
- There is no synthetic infra-feature route/graph fixture proving end-to-end routing.

Definition correction: lane-model prose is not enough. This WI should close only when infra lanes are registered in the manifest and delivery-graph compiler, with validators proving the original seven lanes still behave unchanged.

## Broad Scope

1. **Lane definitions** — add 5 lanes to `route-workflow/references/lane-model.md`, `skills-manifest.json`, and the delivery-graph compiler with full phase chains per proposal §5. Migration lane includes 5a/5b/5c sub-phases + decommission.
2. **Intent routing** — add proposal §9 phrase signals to `route-workflow/references/intent-routing.md`.
3. **Change-type detection** — add infra signals (`*.tf`, `Chart.yaml`, `pulumi.yaml`, `terragrunt.hcl`, `infra/` subtree) to `route-workflow/references/routing-rules.md`.
4. **Templates** (proposal §7 reuse map) — add to existing skills:
   - `write-spec/templates/infra-feature.md`
   - `design-ux/templates/infra-topology.md`
   - `design-ui/templates/infra-runbook.md`
   - `design-ui/templates/infra-cutover-runbook.md` (migration-only)
   - `test-journeys/templates/chaos.feature.md`
   - `design-tech/references/infra-tech-design.md`
5. **Mode flags on existing skills:**
   - `plan-capabilities --mode={regular,infra,mixed}` (default: regular, unchanged behavior)
   - `execute-changeset --infra` (dry-run mandatory; receipt schema gains `dry_run_artifact_path`)
   - `verify-promotion --infra` (accepts `terraform state list` / `kubectl get` as verification artifact)
   - `review-security --mode={security,cost-impact}` (cost-impact uses Infracost + envelope from stack-profile)
6. **Skip-conditions registry** — update `references/skip-conditions.json` so migration sub-phases (5a/5b/5c, decommission) are skipped for non-migration infra lanes.
7. **`dimensions: [...]` opt-in tag** for app-lane WIs (proposal §15.1, §17, §14 Q4) — read by route-workflow from WI frontmatter; signals downstream skills to apply §17.4 mandatory sections.
8. **Skills-manifest sync** — add `recall-stack-knowledge` to `includedSkills` and (per proposal) `corePackForRouting`. Update README, EXTERNAL_ADDONS, REPO_MODES, route-workflow Core Pack section per the 5-source-of-truth lint rule.

## Acceptance Criteria

- AC1: All 5 lane definitions are present in route docs, `skills-manifest.json`, and the delivery-graph compiler, and pass tier-1 validation.
- AC2: All templates exist and are referenced from their parent SKILL.md per the standard convention.
- AC3: All four mode flags work end-to-end on at least one fixture (non-`infra` invocation behaves identically to today — zero regression).
- AC4: skills-manifest.json passes `scripts/lint-skills-manifest.mjs` after the 5-source sync.
- AC5: Existing 7 lanes remain unchanged in behavior; existing tier-1 + tier-2 evals stay green.
- AC6: A synthetic infra-feature WI routes and compiles correctly through `route-workflow` / `compile-delivery-graph.mjs` end-to-end without manual intervention.
