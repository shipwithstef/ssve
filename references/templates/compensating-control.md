# Compensating Control — section template

Required when GATE-03 fires (`landscape_state: populated` + spec diverges from all competitors). Frames the divergence honestly: what's missing, why we can't have it now, what the workaround risks, and how/when we'll replace it with the real capability.

Section structure (placed in spec under `## Competitive Risk Assessment`):

```markdown
## Compensating Control

This feature uses a mechanism that NO competitor uses. It is a compensating
control for a missing capability, not a primary feature. All four fields below
MUST be filled (validator `validate-spec-compensating-control.sh` rejects TBD/blank).

- **missing_capability:** <what we don't have that competitors do — cite by name>
  - Evidence: <competitor names from analyze-competitors.data.json that have it>
- **why_not_now:** <cost, timeline, partner-program access, regulatory, etc.>
  - Evidence: <validate-feature Q3/Q4 cost/timeline answer>
- **risk_of_workaround:** <fraud, friction, edge case, scaling cliff>
  - Evidence: <known failure mode or analogous incident>
- **path_to_replacement:** <target WI ID, or "TODO: WI-XXX" placeholder>
  - Trigger condition for revisiting: <e.g., "after 1000 active customers", "when Toast partner tier becomes available", "after Series A">
```

## Worked example (Example Marketplace receipt OCR)

```markdown
## Compensating Control

- missing_capability: POS integration (verified spend at point of sale)
  - Evidence: Toast Loyalty (POS-auto), Square Loyalty (POS-auto), Fivestars (POS + card-link). All 3 direct competitors use POS attestation.
- why_not_now: Toast partner program requires 6-10 weeks engineering + $5K/yr partner fee. Square Loyalty requires Square POS adoption by merchants we don't yet have. Card-link costs $1.50-6/card/year — economically unviable at our scale.
  - Evidence: validate-feature Q3 cost analysis 2026-04-15.
- risk_of_workaround: Receipt fraud (no atomic POS attestation; OCR is forgeable; same receipt can be uploaded by multiple users; blurry photos require human moderation).
  - Evidence: WI-167 fraud gap discovered after 2 months of receipt-only operation.
- path_to_replacement: WI-XXX-toast-pos-integration-spike.
  - Trigger condition: when ≥50 merchants use Toast POS in our customer base.
```

## Why this exists

Per WI-140 root-cause analysis: Example Marketplace built receipt OCR for 2 months as a workaround for "no POS integration yet" without ever framing it as such. The framework treated it as a feature, not a compensating control. This template forces the honest framing.
