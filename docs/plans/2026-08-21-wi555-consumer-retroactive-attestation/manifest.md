# Implementation Plan — WI-555 consumer-local retroactive attestation

**WI:** [WI-555](../../specs/work-items/WI-555.md)
**Branch:** `framework-WI-555-consumer-retroactive-recovery`
**Base:** `origin/main` @ `8c0f1ea1`
**Lane:** framework / bugfix
**Execution mode:** `inline`
**Status:** READY

## 1. Summary

`validateRetroactiveAttestation` hard-codes WI-472 framework-package authority.
Post-WI-472 consumer gaps cannot use reviewed retroactive recovery. WI-554
deferred this. Resolve non-WI-472 attestations from `repoRootForCache()` package
layout; keep WI-472 byte-compatible.

## 2. Files Planned

| File | Action | Purpose |
|------|--------|---------|
| `scripts/check-chain-receipts.mjs` | MODIFY | `resolveRetroactiveAuthority` |
| `schemas/receipts/retroactive-attestation.schema.json` | MODIFY | `wi` pattern |
| `references/chain-receipt-contract.md` | MODIFY | authority roots note |
| `test-framework/evals/tier-1/validate-consumer-retroactive-attestation.sh` | CREATE | consumer accept + forgery reject |
| `docs/specs/work-items/WI-555.md` | CREATE | WI record |
| `docs/specs/work-items/INDEX.md` | MODIFY | Index entry |
| `proposals/2026-08-21-framework-improvement-consumer-retroactive-attestation.md` | CREATE | improvement brief |
| `docs/plans/2026-08-21-wi555-consumer-retroactive-attestation/manifest.md` | CREATE | This plan |

Out of scope: WI-472 backlog rewrite, waivers, quick-fix exempt expansion,
HoursHub product behavior, WI-BILLING-01.

## 3. Task Graph

1. **authority-resolve** — WI-472 stays SCRIPT_DIR parent; other WIs use `repoRootForCache()`.
2. **schema** — allow `WI-*` pattern for `wi`.
3. **tier1** — hermetic consumer package; central checker accept + reject forgeries.
4. **contract-docs** — chain-receipt-contract authority roots.
5. **post-land-hourshub** — after setup, recover HoursHub `21da99be` / `01e60b5b`.

## 4. Validation Plan

```bash
bash test-framework/evals/tier-1/validate-consumer-retroactive-attestation.sh
bash test-framework/evals/tier-1/validate-retroactive-attestation.sh
```

## 5. Risk / Rollback

- **Risk:** medium — expands attestation authority surface; still hash-bound + cross-family.
- **Rollback:** revert WI-555 commit; WI-472-only path returns.

## 6. AC Mapping

| AC | Proof |
|----|-------|
| AC-555-1 | `validate-retroactive-attestation.sh` PASS |
| AC-555-2..4 | `validate-consumer-retroactive-attestation.sh` PASS |
| AC-555-5 | same as AC-555-1 |
