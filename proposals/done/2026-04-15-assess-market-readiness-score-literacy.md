# Framework Evolution — 2026-04-15

## Trigger

User received a 73/100 launch assessment with individual dimension scores of 42
(distribution) and 52 (monetization). Response: "these scores look low, why
doesn't it give feedback how to get to 100, shouldn't this be the goal?"

This is a legitimate framework gap. The assessment produces numbers but doesn't
explain what those numbers mean in context — leaving the builder to assume (a)
low scores = bad work, and (b) 100 is the target. Both assumptions are wrong.

## Method

Read:
- `assess-market-readiness/SKILL.md` (full — 386 lines)
- `FRAMEWORK-STATE.md` (no prior entry for this skill's scoring UX)
- `proposals/` — no prior proposal on this topic
- The actual Example Marketplace assessment output (`docs/specs/readiness-assessment.md`)

---

## Findings

### P0 — Missing score interpretation layer (blocks builder understanding)

**File:** `assess-market-readiness/SKILL.md:279–287` (Step 6: Route decision table)

**Finding:** The routing table maps scores to actions (70+ = GTM first), but the
assessment output provides no guidance on what individual dimension scores MEAN
in context, no explanation that some scores are structurally pre-launch-limited,
and no "what would move this score" path per dimension.

**The actual problem:** Two distinct types of low scores exist, but the skill
treats them identically:

| Type | Example | Nature | Fix timing |
|---|---|---|---|
| **Action-locked** | Monetization 52 — Dodo test mode | Fixable today in 1 hour | Pre-launch |
| **Traction-locked** | Distribution 42 — no audience | Cannot score high before launch; requires customers to build | Post-launch |

A distribution score of 42/100 for a product that hasn't launched is *expected
and correct*. Distribution strength comes from customers, referrals, reviews,
and earned channels — none of which exist before launch. Telling the builder
"distribution is weak" without explaining that this is normal and what a realistic
post-launch trajectory looks like creates false anxiety.

Similarly, a score of 100 on distribution is not a launch prerequisite — it's a
description of a mature, growing product with an established audience. Conflating
"launch score" and "mature product score" is a category error the skill currently
enables.

**What 100 looks like per dimension (currently absent from the skill):**

| Dimension | 100/100 requires | Reachable pre-launch? |
|---|---|---|
| Product completeness | All WIs resolved, 100% E2E journey coverage, no open bugs | Almost — 90+ is achievable |
| User value clarity | One-sentence value prop, hero confirms in 5 seconds, 3+ user tests observed | Mostly yes — hero rewrite is 1 day |
| Competitive position | Proven differentiation with customer quotes, moat validated by churn data | No — needs customers first |
| Visual quality | Design audit clean, brand system complete, user accessibility tested | Yes — fixable pre-launch |
| Technical reliability | 100% E2E pass, zero open bugs, security pen-tested | Almost — 90+ is achievable |
| Monetization readiness | Live payments, subscription churn tracked, pricing A/B tested | Partially — live mode is 1 hour; churn tracking needs customers |
| Distribution readiness | Proven channels (email list 1K+, social engaged, SEO traffic), ICP validated by sales | No — requires customers, can't be built before launch |
| Market timing | Validated by traction data + customer quotes, not market research alone | No — requires customers |

**Specific missing elements in the skill:**

1. `SKILL.md:279–287` (Step 6): No note that 70+ is the *launch win condition*,
   not a midpoint score. Builder reads 73 and sees "almost there" when actually
   73 = "ship it."

2. `SKILL.md:209–226` (Step 4: Identify gaps): No distinction between
   action-locked gaps (fix today) and traction-locked gaps (fix after first
   customer). Both are listed as "non-blocking" without explaining the key
   asymmetry: traction-locked gaps can ONLY improve after you ship.

3. Assessment output template (`SKILL.md:294–344`): No "Score Evolution Roadmap"
   section. The builder sees a snapshot; they need a trajectory. "Distribution
   is 42 today; realistically 55 after first 10 customers, 75 after 100 customers"
   is more actionable than "Distribution: 42."

4. No explanation that pre-launch scores for distribution/timing dimensions
   are *structurally capped* — a product that hasn't shipped can't score 85 on
   distribution because distribution evidence requires real customers.

**Fix:**

Add three elements to `assess-market-readiness/SKILL.md`:

**A. Score context note at Step 6 (after the routing table at line 287):**
```
> **Score interpretation:** 70+ at launch stage is the win condition, not a
> midpoint. Some dimensions (distribution, market timing, competitive position)
> are structurally traction-locked — they improve with customers, not with
> pre-launch work. A score of 42 on distribution for a product that hasn't
> shipped yet is expected and correct. The skill correctly scores the present
> state; do not optimize for a high pre-launch score on post-launch dimensions.
```

**B. Gap classification in Step 4 (line 218):** Split "Non-blocking gaps" into
two sub-categories:

```
**Action-locked non-blocking gaps** (can fix before first customer):
- List here with specific fix + time estimate

**Traction-locked non-blocking gaps** (can only improve after first customer):
- List here with "what it looks like at N customers" projection
- These are NOT items to fix before launch — they are the result of launching
```

**C. Score evolution roadmap in assessment output template** (add after Non-Blocking
Gaps section):

```markdown
## Score Evolution Roadmap

| Dimension | Today | After 10 customers | After 100 customers | What drives improvement |
|---|---|---|---|---|
| Distribution | 42 | ~55 | ~75 | Reviews, referrals, word-of-mouth |
| User value clarity | 65 | ~75 | ~85 | Observed user sessions, copy refinement |
| Competitive position | 75 | ~80 | ~88 | Customer testimonials, feature evidence |
| Market timing | 72 | ~72 | ~72 | External, can't control |
| Monetization | 52 | ~85 | ~90 | Live mode + churn data |
| Visual quality | 83 | ~83 | ~88 | Post-launch a11y/UX feedback |
| Technical reliability | 80 | ~82 | ~85 | Bug reports from real usage |
| Product completeness | 88 | ~90 | ~92 | Feature requests from customers |
```

This makes the trajectory visible: "ship now, these 4 dimensions get better
automatically as you get customers."

---

### P1 — "100 is the goal" confusion isn't addressed anywhere in the skill

**File:** `assess-market-readiness/SKILL.md` — no mention of what 100 means
or whether it's a valid target

**Finding:** The skill measures readiness for a milestone (launch), not product
perfection. But because it uses a 0–100 scale with no ceiling interpretation,
builders read any score below 100 as "not done." The skill needs one clear
statement about what the ceiling means:

> "A pre-launch product scoring 100/100 would be a contradiction — distribution
> and competitive position dimensions require traction data that only comes from
> having customers. A realistic ceiling for a first-time launch assessment is
> 78–82. If a product scores above 85 at launch stage, the assessment is
> likely inflated or the product has existing traction."

This recalibrates expectations without changing the scoring rubric.

**Fix:** Add a "Score ceiling interpretation" note in Step 2 of the skill, after
the dimension table (line 101).

---

### P2 — Per-dimension "how to improve" is missing from assessment output

**File:** `assess-market-readiness/SKILL.md:209–226` (Gap identification)

**Finding:** When a dimension scores below 70, the assessment says what's low
but not what specific actions would move it. The non-blocking gaps section lists
the gap but gives one-line fixes without explaining the score impact.

**Example from Example Marketplace assessment:**
- Distribution 42 → says "execute outreach playbook" but doesn't say "this gets
  distribution to ~55 after 10 customers"
- User value clarity 65 → says "update Landing.jsx hero" but doesn't say "this
  alone moves score to ~78"

**Fix:** For each non-blocking gap in the assessment output, add:
- Estimated score delta if fixed (e.g., "+13 pts — moves to 78")
- Time estimate for the fix
- Whether it's action-locked or traction-locked

This turns the assessment from a diagnostic into a prioritized sprint plan.

---

### P3 — Score weights don't adjust for builder-type

**File:** `assess-market-readiness/SKILL.md:92–101` (dimension weight table)

**Finding:** Distribution readiness is weighted at 5% for launch mode. But for
a builder with zero channels (like Example Marketplace's current state), distribution is
actually the highest-risk dimension — it can't be bought or built quickly. The
flat 5% weight underrepresents its importance for cold-start builders.

The builder profile (`~/.svc/builder-profile.md`) contains distribution channel
data. The skill reads the builder profile (Step 1) but doesn't use it to adjust
weights.

**This is not actionable yet** — adjusting weights by builder profile adds
complexity and risks over-fitting. But it's worth tracking: a distribution
channel adjustment (5% → 15% for cold-start builders) could surface the right
priorities more accurately.

---

## Comparison delta

The scoring model (0–100, 8 dimensions) is similar to YC's startup evaluation
rubric. Where svc's model differs: YC explicitly tells founders what "fundable"
looks like per dimension (traction = $10K MRR minimum for seed). svc's model
lacks equivalent benchmarks. This is the root of the user confusion — they see
73 and don't know if that's "barely passing" or "strong."

No competitor framework analyzed provides score-evolution roadmaps. This would
be a differentiated capability.

---

## Stale proposal audit

- `2026-04-14-blocking-discovery-halt-protocol.md` — pending
- `2026-04-14-parallel-wi-dispatch.md` — pending
- No proposals in `done/` match this topic

---

## Implementation path

1. Edit `assess-market-readiness/SKILL.md`: add score ceiling note (P1, 30 min)
2. Edit `assess-market-readiness/SKILL.md`: add traction-locked vs action-locked
   gap split in Step 4 (P0, 30 min)
3. Edit `assess-market-readiness/SKILL.md`: add Score Evolution Roadmap to output
   template Step 7 (P0, 45 min)
4. Route to `improve-framework` to apply changes
