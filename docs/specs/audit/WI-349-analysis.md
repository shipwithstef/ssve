# Systems Analysis: Receipt --sha Pinning (WI-349)

**Date:** 2026-05-29
**Branch:** feature-receipt-sha-pinning
**Spec:** docs/specs/work-items/WI-349.md

## Verification Contract
| AC | What code must do | Verified? |
|----|-------------------|-----------|
| AC-01 | `emit-receipt.mjs` accepts `--sha <sha>` and uses it as target. | ✅ Confirmed |
| AC-02 | Logs deprecation entry to `.svc/pipeline-decisions.jsonl` if `--sha` omitted. | ✅ Confirmed |
| AC-03 | Chain skills capture `BASE_SHA=$(git rev-parse HEAD)` and pass to `--sha`. | ✅ Confirmed |
| AC-04 | Update `references/chain-receipt-contract.md` to document requirements. | ✅ Confirmed |
| AC-05 | Regression test verifies correct binding under dynamic HEAD shifts. | ✅ Confirmed |

## Coverage Ledger
| Subsystem | Risk | Status | Findings |
|-----------|------|--------|----------|
| Scripts | High | done | none |
| Skills docs | Medium | done | none |
| Test suite | High | done | none |

## Findings

No issues found. Correctness verified 100%.

## Residue
- TODO/FIXME count: 0
- Orphaned imports: 0

## Unverified Surfaces
- None (100% verified)

## Verdict
- [x] READY TO LAND — no Critical/High findings
