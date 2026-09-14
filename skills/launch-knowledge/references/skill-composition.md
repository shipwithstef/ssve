# Skill Composition Protocol

`launch-knowledge` is the **launch-vehicle decision skill**. It does NOT execute the launch. It hands off to existing skills that own the execution. This file documents the handoff contracts.

## Composition Table

| Skill | Relationship | Direction | Trigger from `launch-knowledge` outputs | Hand-off artifact |
|---|---|---|---|---|
| `mor-vs-stripe` | composes | downstream | `launch-vehicle-decision.md` recommends "MoR" or "direct processor" | Calling skill reads vehicle decision; produces full MoR-vs-Stripe trade study |
| `manage-finops` | downstream | downstream | After `runway-projection.md` exists, ongoing cost tracking moves to `manage-finops` | `manage-finops` reads `runway-projection.md` as starting point |
| `roadmap-evaluation` | downstream | downstream | After `runway-projection.md` produces a runway figure, milestones get budgeted | `roadmap-evaluation` consumes runway months as constraint |
| `pricing` | composes | downstream | After `launch-vehicle-decision.md` says "charge from day one" or "free tier first" | `pricing` produces tier table; reads vehicle decision for jurisdiction |
| `launch` | composes | downstream | After `distribution-plan.md` identifies channels, the launch *campaign* runs | `launch` reads distribution plan as input |
| `cold-email`, `prospect`, `ai-cold-outreach` | composes | downstream | When `distribution-plan.md` includes outbound | These skills execute outreach against the channel list |
| `mine-builder` | composes | upstream | Before first invocation if `~/.svc/founder-profile.md` is empty | `mine-builder` produces builder profile; `launch-knowledge` reads it |
| `platform-operating-architect` | adjacent | downstream | After `runway-projection.md` names a platform (Base44 / Supabase / etc.) | `platform-operating-architect` defines the operating model on chosen platform |
| `validate-feature` | adjacent | downstream | After launch decisions exist, first feature spec begins | `validate-feature` reads vehicle decision for cost gating |

## Direction semantics

- **upstream** — runs BEFORE `launch-knowledge` (e.g., `mine-builder` populates the profile)
- **downstream** — runs AFTER `launch-knowledge` (most cases)
- **adjacent** — runs in parallel or whichever order convenient
- **composes** — explicit handoff with named artifact
- **adjacent** — no artifact handoff; both can read the same upstream artifact

## Handoff contracts

### → `mor-vs-stripe`
- Trigger: `launch-vehicle-decision.md` contains the line `Payment processor type: MoR` or `Payment processor type: direct`
- Hand-off: `launch-vehicle-decision.md` itself; `mor-vs-stripe` runs its own deep trade study and produces the per-vendor decision

### → `manage-finops`
- Trigger: `runway-projection.md` exists AND project has at least one feature spec
- Hand-off: `runway-projection.md`; `manage-finops` consumes its line items as the cost-baseline for ongoing tracking

### → `roadmap-evaluation`
- Trigger: `runway-projection.md` exists AND no `docs/specs/roadmap.md`
- Hand-off: `runway-projection.md` runway figure (months) becomes the time-box for milestone planning

### → `pricing`
- Trigger: `launch-vehicle-decision.md` contains a charge-from-day-one decision OR free-tier-first decision
- Hand-off: `launch-vehicle-decision.md` (jurisdiction + processor type drive the pricing-tier shape)

### → `launch`
- Trigger: `distribution-plan.md` identifies a launch vehicle (Product Hunt, HN, Reddit, SDR, communities)
- Hand-off: `distribution-plan.md` channel list; `launch` runs the timing + asset campaign

### ← `mine-builder`
- Trigger: `~/.svc/founder-profile.md` missing OR last_updated > 6 months
- Hand-off: `mine-builder` writes profile; `launch-knowledge` reads on next invocation

### → `platform-operating-architect`
- Trigger: `runway-projection.md` names a platform (Base44 / Supabase / Cloudflare / Vercel) AND no `docs/specs/platform-operating-model.md` exists
- Hand-off: platform name + chosen scale targets

## Anti-composition (do NOT call from launch-knowledge)

- `execute-changeset` — `launch-knowledge` does not produce code
- `write-spec` — `launch-knowledge` produces decisions, not feature specs
- `design-tech` — happens later, in feature pipeline
- `audit-implementation` / `review-gate` — not implementation review

## Why these boundaries

`launch-knowledge` is a **strategic** skill. It runs once per project (plus annual refresh) and answers cross-cutting questions: legal vehicle, credit stack, runway, distribution. Each downstream skill owns its own depth; `launch-knowledge` would inflate uncontrollably if it tried to absorb pricing, marketing, finops, or platform-architecture detail. The composition table is the bright line.

When in doubt: **launch-knowledge picks the type; the downstream skill picks the vendor or the campaign.**
