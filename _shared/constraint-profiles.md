# Constraint Profiles — canonical decision contexts

Shared primitive. Used by `strategic-decision`, optionally by `validate-feature` (Q7 ROI/cost),
optionally by `manage-finops` (profile-dependent recommendations).

## Purpose

Decisions don't have single right answers. The right answer depends on WHO is deciding, WHAT budget
they have, WHAT runway, WHAT risk tolerance. This file defines canonical profiles so skills can
parameterize their outputs by profile — and so users can declare their profile once and have
downstream decisions respect it consistently.

## The 4 canonical profiles

### Bootstrapper ($0 budget, conservative, solo)

| Field | Value |
|---|---|
| Financial budget to first profit | **$0** — free tiers only |
| Acceptable-loss threshold | Any monthly bill > $100 is existential |
| Runway | Indefinite but cash-zero — cannot absorb unexpected bills |
| Role | Solo builder |
| Risk tolerance | **Conservative** — prefer boring/proven, avoid lock-in |
| Growth scenario default | **Base** — organic, no paid acquisition |
| Reversibility tolerance | Weeks — willing to absorb 1 migration, not ongoing churn |
| Time horizon | 3-year decision expected to outlast runway constraint |
| Failure mode to avoid | Scale-trap: decision that works free at 100 users but costs $5k at 10k users |

**Canonical adversarial review lens:** "Does this kill us if the monthly bill exceeds $100? Walk through the cash-runway failure cascade. Name the month cash runs out."

### Self-financed ($X willing-to-invest, moderate, solo or small team)

| Field | Value |
|---|---|
| Financial budget to first profit | **$X pre-profit** (user specifies: typical ranges $500 / $2k / $5k / $10k) |
| Acceptable-loss threshold | $X total over 12 months; monthly rate = $X / 12 soft-cap |
| Runway | User-declared months of cash burn |
| Role | Solo or 2-3 person team |
| Risk tolerance | **Moderate** — accept modest paid tier for material improvement |
| Growth scenario default | **Base to Aggressive** — willing to invest in growth |
| Reversibility tolerance | Weeks to quarters |
| Time horizon | 1-3 years |
| Failure mode to avoid | Burn overrun — decision that was "fine at $50/mo" balloons to $500/mo at scale |

**Canonical adversarial review lens:** "At base growth with moderate execution, does this burn through $X in 12 months? Show the month-by-month trajectory. Which inputs, if wrong by 2×, would blow the budget?"

### Funded startup (runway-backed, aggressive, small team)

| Field | Value |
|---|---|
| Financial budget to first profit | Runway covers agreed $Y/mo burn (user specifies Y + months) |
| Acceptable-loss threshold | Monthly burn up to $Y; quarterly budget reviews |
| Runway | User-declared months; track against monthly burn |
| Role | Small team (2-10) |
| Risk tolerance | **Aggressive** — optimize for growth over cost; quality matters |
| Growth scenario default | **Aggressive** — paid acquisition + organic |
| Reversibility tolerance | Quarters — can absorb bigger migrations |
| Time horizon | 1-2 years (before next fundraise or milestone) |
| Failure mode to avoid | Under-indexing on quality to save pennies — funded-stage companies rarely lose to COGS, they lose to growth stagnation |

**Canonical adversarial review lens:** "Is this the CHEAP option picked when the QUALITY option is marginally more expensive? Growth-stage companies under-index on quality to save pennies. Find that pattern if present."

### Enterprise (full team, compliance-heavy)

| Field | Value |
|---|---|
| Financial budget to first profit | Budget allocation with quarterly review |
| Acceptable-loss threshold | Line-item approved; unexpected overruns trigger escalation |
| Runway | Not budget-constrained but cycle-constrained (fiscal quarters) |
| Role | Full team with dedicated ops / security / compliance |
| Risk tolerance | **Conservative on audit + compliance; aggressive on infra** |
| Growth scenario default | Stable / planned (not hypergrowth) |
| Reversibility tolerance | Quarters to years — enterprise migrations cost real money |
| Time horizon | 3-5 years (procurement cycles, vendor lock contracts) |
| Failure mode to avoid | Audit / compliance gap — a decision that saves $5k/mo but fails SOC2 review costs far more in remediation |

**Canonical adversarial review lens:** "What audit / compliance / vendor-risk surface does this create? Name the specific audit firm finding this would trigger. Name the 2 AM page this would cause."

## Profile-override syntax

A decision can use a canonical profile with overrides:

```
profile: Bootstrapper
overrides:
  growth_scenario: Aggressive     # runs organic but ambitious
  reversibility_tolerance: days   # stricter than canonical Bootstrapper
```

Skills should accept overrides and qualify their output with them. Adversarial reviewer stress-tests
against the overridden values, not the canonical defaults.

## When profile is ambiguous

If the caller can't declare a profile cleanly, two options:

1. **Ask interactively** — present the 4 profiles + let caller pick with overrides
2. **Comparison mode** — run the decision across multiple profiles, produce `MULTI-PROFILE-DELTA.md` showing where the winner flips. Let caller choose based on which profile matches their actual context.

Do NOT silently default to Bootstrapper or any other profile. Wrong profile → wrong decision.

## Not-canonical profiles (documented for future)

These exist but are NOT canonical v1 profiles. Add to the canonical set only if reused across multiple skills:

- Open-source maintainer (indefinite budget, no revenue model, quality-first)
- Agency / consultant (client-funded, per-project budget, short horizon)
- Academic / research (grant-funded, non-commercial usage, publishable output)
- Hobbyist (discretionary spending, quality-optional, learning-focused)

## Consumers

| Skill | How it uses profiles |
|---|---|
| `strategic-decision` | Phase 0 elicits profile; all downstream phases qualify answers by profile |
| `validate-feature` | Q7 (ROI/cost) answer varies by profile — should reference this file when computing |
| `manage-finops` | Platform recommendations can vary by profile (AWS Enterprise-appropriate, Hetzner Bootstrapper-appropriate) |
| `stage-revenue` | Stage plan depends on profile — Bootstrapper needs Stage 1 revenue in weeks, Funded can plan longer |
| `find-opportunity` | Profile constrains which opportunities are viable (Bootstrapper can't capitalize on $50k tool-selling without ramp) |
| `roadmap-evaluation` | Cost-per-milestone varies by profile |
