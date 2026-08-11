# Brownfield Competitive Flags — output template

Produced by `onboard-repo` on day 1 when core-mechanic features are detected in a brownfield codebase. Path: `docs/specs/brownfield-competitive-flags.md`. Triggers `analyze-competitors` (Phase 2 deep-research path) scoped per detected mechanic.

```markdown
# Brownfield Competitive Flags

**Detected:** YYYY-MM-DD
**Source:** onboard-repo day-1 sweep
**Triggered analyze-competitors runs:** <list of mechanic categories>

## Detected Core Mechanics

| Mechanic | Code evidence | Files | Match in competitors? |
|----------|--------------|-------|----------------------|
| receipt OCR | processReceipt(), OCR.recognize() | src/loyalty/receipt.ts | NO — 0 of 7 direct competitors do this |
| GPS verification | secureCheckIn() | src/loyalty/checkin.ts | NO — 0 of 7 |
| Manual point grant | grantPoints() | src/admin/points.ts | YES — admin-grant is universal |

## Severity Findings

| Severity | Mechanic | Issue | Recommended action |
|----------|----------|-------|-------------------|
| HIGH | receipt OCR | Unique to this codebase across 7 competitors | Auto-create WI: "competitive-strategy-review-receipt-ocr" + Compensating Control framing in spec |
| HIGH | GPS verification | Unique to this codebase | Auto-create WI: "competitive-strategy-review-gps" |
| LOW | Manual point grant | Universal pattern, no concern | None |

## Auto-Created WIs (per ONB-04)

- WI-XXX competitive-strategy-review-receipt-ocr (tagged: competitive-strategy-review)
- WI-XXX competitive-strategy-review-gps (tagged: competitive-strategy-review)

## Next Step

Read each auto-created WI; for each HIGH-severity divergence, the spec MUST either (a) add Compensating Control section per WI-140 CC-01, OR (b) plan a pivot WI to align with competitor patterns.

This is the day-1 detection that would have caught the Example Marketplace receipt-OCR strategic misalignment 60 days earlier.
```
