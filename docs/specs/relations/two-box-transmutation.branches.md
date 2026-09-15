Derived-at: 0dcd69d255642dcc78db521e95afa2b18ea1276f
Scope-paths:
  - scripts/**
  - skills/**
  - schemas/**
  - references/**
  - provision/**
  - test-framework/**
  - docs/specs/**
  - docs/plans/two-box-transmutation/**

## Entry points
- IN: scripts/two-box-plan.mjs (planned) — Two-Box orchestration
- IN: scripts/lib/isolated-plan-analysis.mjs (planned) — Open Box isolation
- IN: scripts/lib/research-decision.mjs (planned) — shared research predicate
- IN: scripts/lib/receipt-issuance-epoch.mjs (planned) — issuance vs historical vs bootstrap
- IN: skills/plan-changeset/SKILL.md:1 — pre-P3 Two-Box then prepare/seal

## Callers
- IN: scripts/compile-delivery-graph.mjs and scripts/validate-delivery-graph.mjs
- IN: scripts/emit-receipt.mjs, scripts/check-chain-receipts.mjs, scripts/lib/review-inputs.mjs
- IN: scripts/stage-segment.mjs, agents/svc-stage-plan.md
- IN: setup and scripts/check-install-drift.sh after promotion

## Auth
- IN: existing v2 controller lease, dispatch-policy, quick-fix-eligibility
- OUT: no mutation of HOME, CODEX_HOME, or ~/.svc/dispatch-policy.json from recipes

## State
- IN: git-common-dir svc-review-evidence objects; v4-bootstrap-snapshot after freeze

## Promises
- IN: original ACs; fail-closed isolation; no new legacy issuance except the frozen bootstrap body
