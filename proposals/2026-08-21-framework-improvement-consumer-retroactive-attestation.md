# Framework Improvement — consumer-local retroactive attestation (WI-555)

**Date:** 2026-08-21
**accepted_wi:** WI-555
**Category:** bugfix / receipt enforcement
**Severity:** high

## Gap

`validateRetroactiveAttestation` in `scripts/check-chain-receipts.mjs` hard-codes
WI-472 framework-package ledger/bundle/review paths and the frozen 78-row
historical range. Post-WI-472 consumer receipt gaps (HoursHub PRs #823/#824 =
`21da99be` / `01e60b5b`) cannot use the sanctioned reviewed recovery path.
WI-554 explicitly deferred attestation root selection.

## Diagnosis

- Evidence: central `svc-reconcile --repo <hourshub>` reports both SHAs missing
  the plan→audit chain; notes hold only failed auto-drive `verify-promotion`.
- Quick-fix is ineligible (file/line/structure limits).
- Existing recovery tooling (`reconcile-receipt-backlog.mjs`) is WI-472-only.
- Root cause: authority resolution anchors on `SCRIPT_DIR/../docs/specs/audit/wi-472-*`
  for every attestation, not on `repoRootForCache()` for consumer WIs.

## Fix brief

1. Allow `wi` pattern `^WI-[A-Z0-9][A-Z0-9_-]*$` in the attestation schema.
2. Resolve WI-472 from the framework package (unchanged paths/keys/range).
3. Resolve other WIs from `repoRootForCache()` package layout.
4. Bind consumer `historical_range` to the bundle range.
5. Tier-1 proves accept + reject tree/family/basis forgeries.

## Acceptance Criteria

See `docs/specs/work-items/WI-555.md` AC-555-1..5.

## Rollback

Revert the WI-555 commit; WI-472 path remains the only attestation authority.

## Non-goals

Waivers, quick-fix exempt expansion, HoursHub product behavior, WI-BILLING-01.
