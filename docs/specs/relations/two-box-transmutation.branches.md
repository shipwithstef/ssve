Derived-at: 1a0822e6b9deb5a6caaed7cabe4645b9f1ca1cea
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
- IN: `scripts/two-box-plan.mjs:1` — implemented Two-Box prepare/live/OFFLINE orchestration.
- IN: `scripts/lib/isolated-plan-analysis.mjs:1` — Open Box isolation.
- IN: `scripts/lib/research-decision.mjs:1` — shared research decision predicate.
- IN: `skills/plan-changeset/SKILL.md:1` — complete v5 planning and review handoff.
- IN: `scripts/prepare-plan-handoff.mjs:1` — prepared plan body and review views.

## Consumers
- IN: `scripts/stage-segment.mjs:1` — planning entry and current-execution gate.
- IN: `scripts/lib/review-inputs.mjs:1` — review input and plan-authority validation.
- IN: `scripts/emit-receipt.mjs:1` and `scripts/check-chain-receipts.mjs:1` — issuance and verification.
- IN: `scripts/lib/receipt-issuance-epoch.mjs:1` — current v5, historical readers, and the pinned v4 bootstrap exception.
- IN: `agents/svc-stage-plan.md:1` — stage planner invocation.

## Authority and state
- IN: existing controller lease, owner dispatch policy, and recomputed eligibility.
- IN: repository-shared review evidence objects and `docs/specs/privacy/v4-bootstrap-snapshot.json:1`.
- OUT: recipes do not mutate HOME, CODEX_HOME, or the owner dispatch policy.

## Historical outcome and current limit
`docs/specs/work-items/WI-FW-TWO-BOX-01.md:1` records this program as VERIFIED through PR #62. That historical outcome does not establish plan authority or receipts for a later WI. Current issuance and execution require reviewed, sealed v5 evidence, except the one pinned genuine v4 bootstrap.
