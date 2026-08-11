# WI-SPINE-002: Spine Activation — stack-profile + first knowledge domain + gap-research auto-loop

**Type:** framework
**Status:** partial
**Severity:** high
**Filed:** 2026-04-30
**Source:** proposal `proposals/done/2026-04-30-infra-project-support.md` § 11 Phase B
**Lane:** framework
**Depends on:** WI-SPINE-001 (the recall gate must exist before activation)
**Blocks:** WI-SPINE-003

## Goal

Activate the Knowledge Spine by populating its identity layer (stack-profile) and at least one fully-built knowledge domain, and wiring the gap → research auto-loop that closes recall misses autonomously.

## Actual State Audit — 2026-05-11

This WI is partially implemented:

- `mine-builder --mode=stack-profile` exists and documents `docs/specs/stack-profile.md`.
- `mine-builder/templates/stack-profile.md` exists.
- `.svc/knowledge-recall.jsonl` exists.
- `scripts/spine-gap-spawn.mjs` exists and can insert a `research` task before the blocked requester.
- sourced knowledge domains exist, including `references/knowledge/domains/github-actions/` and `references/knowledge/domains/helm/` with `.sources.jsonl`, `CAPABILITIES.md`, and detail files.

What is not proven:

- `references/knowledge/domains/terraform/` does not exist in the current checkout.
- There is no complete synthetic or real log trail for `recall MISS -> research SPAWNED -> knowledge WRITTEN -> next session HIT`.
- `docs/specs/stack-profile.md` is not populated for this repo; `validate-stack-profile-freshness` currently passes because absence is allowed.

Definition correction: Terraform is a useful seed, but the real framework requirement is "at least one sourced, stack-relevant domain with layered content." If Terraform is still desired as canonical infra coverage, keep it as remaining work rather than treating the whole Spine as absent.

## Broad Scope

1. **`docs/specs/stack-profile.md` template** — extend `mine-builder` skill (or add a sibling `mine-stack` mode) that produces stack-profile.md per project. Sections per proposal §3.1 + §17.2: cloud, IaC tool, k8s flavor, observability, secret manager, CI/CD platform, finops/security/scalability envelopes.

2. **First populated knowledge domain** — pick one stack-relevant domain to seed. Terraform was proposed because it is broad infra coverage, but any sourced stack-relevant domain can satisfy the activation requirement if it has `.sources.jsonl`, `CAPABILITIES.md`, and detail files. If Terraform remains the canonical target, add it as the remaining domain-specific task.

3. **Gap → research auto-loop wiring** — when `recall-stack-knowledge` returns 0 hits for a topic in caller's `requires_topics[]`:
   - Append `knowledge-gap` entry to `.svc/knowledge-recall.jsonl`
   - Spawn a `research` task at the head of the lane-tasks graph BEFORE the requesting skill runs
   - Output deposited at the appropriate Spine layer (Layer 1 for world facts, Layer 3 for learnings)
   - Logged as a `mechanical` decision in `.svc/pipeline-decisions.jsonl`

4. **Demonstrate autonomous closure** — produce one log trail showing `recall MISS → research SPAWNED → knowledge WRITTEN → next session HIT`. Required for proposal §13 success criterion.

## Acceptance Criteria

- AC1: `stack-profile.md` template exists with §17.2 sections; `mine-builder` produces a populated stack-profile.md when run against this repo.
- AC2: at least one sourced stack-relevant domain exists with `.sources.jsonl`, CAPABILITIES, and ≥3 details/*.md files following knowledge-protocol.md. Optional hardening: add `terraform/` specifically as a canonical infra domain.
- AC3: Gap → research auto-loop wired and demonstrated end-to-end on at least one synthetic miss.
- AC4: `.svc/knowledge-recall.jsonl` and `.svc/pipeline-decisions.jsonl` show the expected entries from the synthetic test.
- AC5: Recall remains advisory-only (warns, does not block) for app lanes; spec-index reduction metric from WI-SPINE-001 holds or improves.
