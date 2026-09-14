# CRO Lever Lifecycle Compatibility Matrix

> Origin: Proposal 2026-05-06 — Lifecycle-stage gate for product recommendations.
> Purpose: Prevent post-launch CRO playbooks from being recommended to pre-launch projects.

## Lifecycle stages

| Stage | Definition | Key signal |
|-------|------------|------------|
| `pre-launch` | No paying customers; product may or may not be code-complete; distribution not yet fired | `paying_customers: 0` + `production_data_available: false` |
| `launch-imminent` | ≤7 days to first-revenue target; distribution playbook ready; possibly soft-launched to warm list | `first_revenue_date` within 7d + `distribution_status: ready` |
| `post-launch-validation` | 1–50 paying customers; gathering feedback; proving core loop; may still be iterating on pricing | `paying_customers > 0` + `primary_traffic_source` identified |
| `post-launch-scaling` | >50 paying customers OR repeatable acquisition channel at positive unit economics; optimizing for LTV/CAC | `paying_customers > 50` OR `ltv_cac_ratio > 1` |

## Lever compatibility

| Lever | Pre-launch | Launch-imminent | Post-launch-validation | Post-launch-scaling |
|---|---|---|---|---|
| Founder story / "built by an owner" block | ✅ HIGH | ✅ HIGH | ✅ MEDIUM | ⚠️ LOW |
| Free tier / no-card signal | ✅ HIGH | ✅ HIGH | ✅ MEDIUM | ✅ MEDIUM |
| Hero copy polish + photography | ✅ MEDIUM | ✅ HIGH | ✅ MEDIUM | ✅ LOW |
| ROI calculator (qualifies visitor) | ✅ MEDIUM | ✅ HIGH | ✅ HIGH | ✅ HIGH |
| Mobile reflow + perf | ✅ HIGH | ✅ HIGH | ✅ HIGH | ✅ HIGH |
| Logo wall / press mentions | ❌ unless real | ❌ unless real | ✅ HIGH (real only) | ✅ HIGH |
| Live counter (production data) | ❌ would lie | ⚠️ if seeded | ✅ MEDIUM | ✅ HIGH |
| Real customer testimonials | ❌ unless real | ⚠️ if real | ✅ HIGH | ✅ HIGH |
| Annual / monthly pricing toggle | ❌ premature | ⚠️ optional | ✅ HIGH | ✅ HIGH |
| Sector-specific landing variants | ⚠️ premature | ⚠️ niche-only | ✅ HIGH | ✅ HIGH |
| Comparison pages (`/vs/competitor`) | ⚠️ premature | ⚠️ niche-only | ✅ HIGH | ✅ HIGH |
| Programmatic SEO landings | ❌ premature | ❌ premature | ⚠️ if traction | ✅ HIGH |
| Newsletter / lead-magnet capture | ⚠️ niche-only | ⚠️ optional | ✅ MEDIUM | ✅ HIGH |
| Referral program surface | ❌ no users | ❌ no users | ⚠️ niche-only | ✅ HIGH |
| Social-proof count ("X teams using") | ❌ would lie | ⚠️ if seeded | ✅ MEDIUM | ✅ HIGH |
| Urgency timer / scarcity banner | ❌ inauthentic | ⚠️ if real deadline | ✅ MEDIUM | ✅ HIGH |
| Live chat / concierge CTA | ⚠️ niche-only | ⚠️ optional | ✅ MEDIUM | ✅ HIGH |
| Multi-tier pricing table | ⚠️ premature | ✅ MEDIUM | ✅ HIGH | ✅ HIGH |
| Trust badges (security / compliance) | ✅ MEDIUM | ✅ HIGH | ✅ HIGH | ✅ MEDIUM |
| Video demo / product walkthrough | ✅ HIGH | ✅ HIGH | ✅ HIGH | ✅ MEDIUM |
| Interactive product preview | ✅ HIGH | ✅ HIGH | ✅ MEDIUM | ✅ LOW |

## Legend

- ✅ HIGH — Strong fit; expected to move the needle at this stage.
- ✅ MEDIUM — Reasonable fit; safe to include but not the highest priority.
- ⚠️ LOW — Weak fit; include only if there is a specific strategic reason.
- ⚠️ optional — Include only if the specific condition is met (e.g., "if seeded").
- ❌ — Blocked at this stage; recommending this lever without an override justification is a lifecycle-stage violation.

## Override rules

A `blocked_at_pre_launch: true` lever MAY be recommended at `pre-launch` **only if** the brief includes an explicit override justification of ≥1 sentence, e.g.:

> "Override: Annual toggle is included because the project is 5 days from launch and the pricing model is already validated via 12 beta-user interviews."

Without such a sentence, the recommendation MUST be excluded.
