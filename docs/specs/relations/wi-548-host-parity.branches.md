# Branch index — portable host-parity program

Scope-paths: docs/specs/architecture/wi-548-*.md docs/specs/features/framework-portable-host-parity.md docs/specs/decisions/2026-08-17-wi-548-host-parity/ docs/specs/work-items/WI-54*.md docs/plans/2026-08-17-wi548-host-parity-plan/ proposals/2026-08-17-framework-improvement-*.md
Derived-at: 223436abe5124e6d9852551d249efd855759833b

## Callers

- `scripts/run-external-review.mjs` — review launcher; WI-547 consumer
- `scripts/emit-receipt.mjs` — receipt writer; WI-550
- `scripts/check-chain-receipts.mjs` — receipt checker; WI-547/WI-550
- `scripts/svc-reconcile.mjs` — policy reader; WI-549
- `hooks/svc-task-completion-guard.sh` — Stop barrier; WI-545/WI-550
- `scripts/svc-auto-drive.mjs` — continuation; WI-552
- `scripts/resolve-adversarial-reviewer.sh` — remap to remove; WI-551

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
- Children land one-per-run
- PR #10 after WI-547
