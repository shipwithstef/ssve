# Process — detail

Moved verbatim from SKILL.md (progressive disclosure).

### Step 2: Score across 8 dimensions

Each dimension is scored 0–100. The weights differ by mode.

| # | Dimension | What it measures | Launch weight | Hackathon weight | VC weight | PMF weight |
|---|---|---|---|---|---|---|
| 1 | **Product completeness** | Core journeys implemented, critical WIs resolved | 25% | 15% | 10% | 20% |
| 2 | **User value clarity** | Can a new user understand what this does in 30 seconds? (vision + landing + onboarding) | 15% | 20% | 15% | 10% |
| 3 | **Competitive position** | Table stakes met, whitespace exploited, moat scored | 10% | 5% | 20% | 15% |
| 4 | **Visual quality** | Dark/light mode complete, responsive, no broken screens | 10% | 25% | 5% | 5% |
| 5 | **Technical reliability** | E2E pass rate, no critical bugs, security audit clean | 15% | 10% | 10% | 15% |
| 6 | **Monetization readiness** | Payment flow works, pricing clear, billing tested | 15% | 0% | 15% | 10% |
| 7 | **Distribution readiness** | Can the builder reach users? Channels exist? ICP identified? | 5% | 5% | 15% | 10% |
| 8 | **Market timing** | Is the market hot/cold? Recent competitor moves? Trends? | 5% | 20% | 10% | 15% |

> **Score ceiling interpretation:** A pre-launch product scoring 100/100 would
> be a contradiction — distribution and competitive position dimensions require
> traction data that only comes from having customers. A realistic ceiling for a
> first-time launch assessment is **78–82**. If a product scores above 85 at
> launch stage, the assessment is likely inflated or the product has existing
> traction. The win condition for launch mode is **70+**, not 100.
>
> Some dimensions are **traction-locked** — they can only improve after you ship:
> distribution, competitive position, market timing. Others are **action-locked** —
> fixable today regardless of customer count: monetization config, hero copy,
> visual polish. Don't optimize for high pre-launch scores on traction-locked
> dimensions. Ship, then let customers improve them.

#### How to score each dimension

**1. Product completeness (0–100):**
- Read `docs/specs/work-items/INDEX.md`
- Count: total WIs, resolved WIs, critical/high open WIs
- Read journeys: how many have full E2E coverage?
- Score: `(resolved / total) * 80 + (critical_open == 0 ? 20 : 0)`
- Deductions: -10 per open critical, -5 per open high

**2. User value clarity (0–100):**
- Read `docs/specs/vision.md` — is the value prop in one sentence? (-20 if vague)
- Check if Landing/Home page exists and has a clear hero message
- Check onboarding flow exists (journey J01 or equivalent)
- Score: presence + clarity of each element

**3. Competitive position (0–100):**
- Read `docs/specs/analyze-competitors.md`
- If missing: score 0, flag as blocking gap
- Count table stakes met vs identified
- Read moat assessment: overall moat rating × 20
- Score: `(table_stakes_met / total) * 50 + moat_rating * 10`

**4. Visual quality (0–100):**
- Check visual baseline: how many pages have screenshots?
- Check for recent visual review reports (any HIGH/CRITICAL issues?)
- Dark mode: is it complete? (check for WI-022/027/032 or equivalent)
- Score based on coverage and issue count

**5. Technical reliability (0–100):**
- E2E pass rate from most recent run (if available)
- Open bugfix WIs count
- Security WIs resolved?
- Score: `pass_rate * 0.7 + (no_critical_bugs ? 30 : 0)`

**6. Monetization readiness (0–100):**
- Payment provider configured? (Stripe/Dodo/LemonSqueezy)
- Pricing page exists with clear tiers?
- Checkout flow tested (E2E or manual)?
- Subscription management exists?
- Score: 25 per element present

**7. Distribution readiness (0–100):**
- Read builder profile: existing channels, follower counts, engagement
- Outreach playbook exists? (`docs/marketing/`)
- ICP defined? (personas with real user descriptions)
- Cold outreach targets identified?
- Score: 25 per element present

**8. Market timing (0–100):**
- Competitor analysis age (stale = -20)
- Any recent competitor shutdowns/pivots? (opportunity)
- Is the category trending up or down?
- AI disruption risk level
- Defaults to 50 if no data available

### Step 7: Write assessment

Produce `docs/specs/readiness-assessment.md`:

```markdown
# Readiness Assessment — [Stage]

**Generated:** YYYY-MM-DD
**Stage:** [launch / hackathon / vc / pmf]
**Overall score:** [0-100]
**Verdict:** [GTM first / Fix gaps then GTM / Build more]

## Dimension Scores

| # | Dimension | Score | Weight | Weighted | Key finding |
|---|---|---|---|---|---|
| 1 | Product completeness | [score] | [weight]% | [weighted] | [one-line finding] |
| ... | ... | ... | ... | ... | ... |
| | **Overall** | | | **[total]** | |

## Judge Verdicts

### [Judge role 1]
[Verdict with reasoning]

### [Judge role 2]
[Verdict with reasoning]

## Blocking Gaps

1. [Gap] — dimension [N], score [X]. Fix: [specific action]
2. ...

## Non-Blocking Gaps

1. [Gap] — dimension [N], score [X]. Improve: [specific action]

## ICP Simulation (if applicable)

### ICP Definition
[Extracted ICP profile]

### Top Exemplars
[5 exemplar briefs from Step 5d]

### Adoption likelihood
[Average adoption score across exemplars]

## Score Evolution Roadmap

Scores change over time. This table shows the realistic trajectory:

| Dimension | Today | After 10 customers | After 100 customers | What drives improvement |
|---|---|---|---|---|
| Product completeness | [score] | [+2–5] | [+5–10] | Bug reports, feature requests |
| User value clarity | [score] | [+10 if hero updated] | [+15 with testimonials] | Observed sessions, copy refinement |
| Competitive position | [score] | [+5] | [+15 with quotes] | Customer evidence, churn analysis |
| Visual quality | [score] | [+0 unless feedback] | [+5 with a11y reports] | Post-launch user feedback |
| Technical reliability | [score] | [+2] | [+5] | Real-usage bug reports |
| Monetization | [score] | [+30 with live mode] | [+10 with churn data] | Configuration + real billing |
| Distribution | [score] | [+13] | [+33] | Reviews, referrals, SEO |
| Market timing | [score] | [±0] | [±0] | External — can't control |

Fill in today's scores. Traction-locked dimensions (distribution, competitive
position, market timing) improve through shipping — not through pre-launch work.

## Routing Decision

**[Score]-based routing: [GTM first / Fix gaps / Build more]**

Specific next action: [exact skill or WI to route to]

> **Score in context:** [score]/100 at [stage] stage — win condition is 70+.
> Action-locked gaps: fix this week. Traction-locked gaps: ship first, they
> improve as customers arrive.
```
