# Staging Plan Output Format — detail

Moved verbatim from SKILL.md (progressive disclosure).

## Staging Plan Output Format

The staging plan is written to `docs/specs/staging-plan.md`.

```markdown
# Staging Plan: <big idea name>

Created: <date>
Builder profile: <path>
Big idea: <one sentence summary>

## Decision

**Staging recommended:** Yes / No
**Reason:** <one sentence — which row of the decision matrix triggered>

## Stage 1: Revenue Project

**Project:** <name>
**Tier:** A (related) / B (tangential) / C (unrelated)
**Connection to big idea:** <how this feeds Stage 3, or "none — pure revenue play">
**What to build:** <one paragraph — the MVP>
**Revenue model:** <how money flows>
**Price:** <specific price>
**Payment method:** <LemonSqueezy / Gumroad / Dodo / Stripe>
**Infrastructure:** <free-tier stack>
**Build time:** <days at builder's hours/week>
**Distribution:** <specific channels from builder profile>
**Month 1 revenue target:** <conservative estimate with evidence>
**First-project rules:** PASS (all 9 rules checked)

### First-Project Rules Checklist

| # | Rule | Status | Notes |
|---|------|--------|-------|
| 1 | Ships in 1-2 weeks | PASS / FAIL | <hours calculation> |
| 2 | No failed-skill dependency | PASS / FAIL | <checked against profile> |
| 3 | Built-in distribution | PASS / FAIL | <specific channel> |
| 4 | No entity required | PASS / FAIL | <payment method> |
| 5 | Dead simple revenue model | PASS / FAIL | <model description> |
| 6 | Boring / proven demand | PASS / FAIL | <evidence> |
| 7 | Self-sustaining free tiers | PASS / FAIL | <stack> |
| 8 | Evidence of $1K+/mo | PASS / FAIL | <specific evidence> |
| 9 | Builder would use it | PASS / FAIL | <dogfooding fit> |

## Stage 2: Reinvestment Plan

**Revenue milestone to trigger Stage 2:** $<amount>/mo
**Timeline:** Month <N> (estimated)

### Reinvestment Priorities

| Priority | Gap | Action | Cost | Revenue required |
|----------|-----|--------|------|-----------------|
| 1 | <specific gap> | <specific action> | <cost> | <$/mo to cover> |
| 2 | <specific gap> | <specific action> | <cost> | <$/mo to cover> |
| 3 | <specific gap> | <specific action> | <cost> | <$/mo to cover> |

### Audience Transfer Plan

<how Stage 1 audience feeds Stage 3 — or note if Stage 1 was Tier C>

## Stage 3: The Real Thing

**Project:** <big idea name>
**Re-entry point:** write-vision
**Builder situation at Stage 3:**
- Revenue: $<estimated>/mo from Stage 1
- Entity: <registered / not yet>
- Audience: <size and relevance>
- Tools: <what Stage 2 unlocked>
- Skills: <what Stage 1 taught>

**What's different from building now:**
<bullet list of concrete advantages the builder has after staging>

## Escape Hatch

If you want to skip staging and build the big idea now:
→ Say "build my idea anyway" at any time.
No staging plan will be created. The pipeline runs on your big idea directly
with best-effort recommendations for your current situation.
```

---
