# Branch index — portable host-parity program

Derived-at: a65e9f8b77581f8b508f3e1c852d013a8a0d0f96
Scope-paths:
  - docs/specs/architecture/wi-548-*.md
  - docs/specs/features/framework-portable-host-parity.md
  - docs/specs/decisions/2026-08-17-wi-548-host-parity/
  - docs/specs/work-items/WI-54*.md
  - docs/plans/2026-08-17-wi548-host-parity-plan/
  - proposals/2026-08-17-framework-improvement-*.md

## Entry points
- IN: `docs/specs/work-items/WI-548.md:1` — planning umbrella.
- IN: `docs/specs/work-items/WI-549.md:1` — shared chain-policy child.
- IN: `docs/specs/work-items/WI-550.md:1` — receipt identity child.
- IN: `docs/specs/work-items/WI-551.md:1` — dispatch resolver child.
- IN: `docs/specs/work-items/WI-552.md:1` — continuation child.
- IN: `docs/specs/work-items/WI-553.md:1` — risk-triggered contracts child.
- IN: `docs/specs/architecture/wi-548-reconciliation.md:1` — child DAG and dispositions.
- IN: `docs/specs/architecture/wi-548-contract-map.md:1` — producer/consumer map.
- IN: `docs/plans/2026-08-17-wi548-host-parity-plan/manifest.md:1` — planning-only manifest.

## Callers
- IN: `scripts/run-external-review.mjs:1` — review launcher; WI-547 consumer
- IN: `scripts/emit-receipt.mjs:1` — receipt writer; WI-550
- IN: `scripts/check-chain-receipts.mjs:1` — receipt checker; WI-547/WI-550
- IN: `scripts/svc-reconcile.mjs:1` — policy reader; WI-549
- IN: `hooks/svc-task-completion-guard.sh:1` — Stop barrier; WI-545/WI-550
- IN: `scripts/resolve-adversarial-reviewer.sh:1` — remap to remove; WI-551

## Journeys & tests

- Planned focused: `validate-shared-chain-policy.sh` (WI-549)
- Planned focused: `validate-receipt-identity-collision.sh` (WI-550)
- Planned focused: dispatch resolver matrix (WI-551)
- Planned focused: review-evidence portability (WI-547, already drafted in that worktree)
- Planned live: WI-546 Grok/Cursor/AGY acceptance

## Contracts

- `references/chain-receipt-contract.md`
- `schemas/receipts/*`
- `provision/hosts/grok.json`, `provision/hosts/cursor.json`
- owner-external `~/.svc/dispatch-policy.json` (not in repo)

## Authority

- WI-502 durable authority APIs (reuse, do not duplicate)
- Owner dispatch file + reviewer-policy-v2 (external)

## Failure

- Missing policy → refuse
- Missing dispatch file → refuse
- Invalid receipts → Stop/VERIFIED/final deny
- Missing fresh-session API → capability-limited blocker

## Release

- Planning PR only for WI-548
- Children 545/549-552/546 landed via PR #13 (`50a3440a`); WI-553 still review-then-land
- PR #10 landed (`223436ab`); PR #11/#12 landed WI-547
