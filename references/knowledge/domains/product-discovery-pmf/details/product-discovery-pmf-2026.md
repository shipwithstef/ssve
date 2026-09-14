# Product Discovery & PMF — L3 Detail File (2026)

> **Volatility legend:**
> - `STABLE` — framework or methodology; rarely changes; re-research only on major edition updates
> - `VOLATILE` — market median or benchmark; drifts with data provider annual reports; re-research within 30-day window

---

## 1. Continuous Discovery — Teresa Torres `STABLE`

**Why the framework matters:**
Torres argues that traditional episodic research (a quarterly user study, a design sprint once a year) is too slow for iterative product teams. The insight: small, frequent interviews compound better than large, infrequent studies. The default cadence is at least one customer conversation per week per product trio (PM + designer + engineer lead).

**Key mechanism — the weekly habit:**
- Each interview is brief (20-30 min), unscripted, story-based ("tell me about the last time you...").
- Outputs flow directly into the Opportunity Solution Tree, not a research archive.
- The habit forces the team to hold the customer's problem space alive in working memory continuously.

**Failure modes (2026 practitioners report):**
- Running interviews but not updating the OST — breaks the feedback loop.
- Interviewing only existing happy users — survivorship bias in the opportunity map.
- Treating the first interview theme as a confirmed opportunity without triangulation across 5+ respondents.

**Stable reference:** Teresa Torres, *Continuous Discovery Habits* (2021), producttalk.org.

---

## 2. Opportunity Solution Tree (OST) `STABLE`

**Four layers:**
1. **Outcome** — the business/product metric the team is moving (should be a leading indicator, e.g., weekly active retention, not "revenue").
2. **Opportunity space** — clusters of unmet needs, pain points, desires surfaced from customer interviews. NOT solutions. Each node is phrased as a customer need ("I need to...").
3. **Solutions** — product ideas or features that address an opportunity node. Multiple solutions per opportunity is healthy; it prevents the team from falling in love with one idea.
4. **Assumption tests** — the cheapest possible experiment to validate or falsify the riskiest assumption underlying a solution before full build.

**Operating rules (2026 practitioner consensus):**
- Refresh opportunity space with new interview evidence at least weekly.
- Never ship a solution whose underlying assumption hasn't been tested.
- Revisit the root outcome quarterly against strategy; it may drift.
- An OST that hasn't been touched in 4 weeks is stale and should be treated as untested.

**The 2026 failure mode (Getperspective.ai synthesis):** Teams draw the tree correctly once, then stop updating. The opportunity space becomes a frozen assumption rather than a live map. Most teams refresh evidence quarterly at best — this is too slow for weekly sprint cadence.

---

## 3. Sean Ellis 40% Test `STABLE (framework) / VOLATILE (population benchmarks)`

**The question:** "How would you feel if you could no longer use [product]?"
Response options: Very disappointed / Somewhat disappointed / Not disappointed (it's OK, I'd find a substitute) / N/A

**The signal:** % answering "Very disappointed."

**Why 40%?**
Ellis benchmarked ~100 startups pre-2010. Companies above 40% consistently found sustainable growth; those below 40% almost always struggled. The number has held empirically across subsequent replications (Reforge, GoPractice/pmfsurvey.com).

**Thresholds in detail:**

| Band | Interpretation | Practitioner action |
|---|---|---|
| < 25% | No meaningful retained-core signal | Do NOT scale. Reposition product, audience, or value prop. Run qualitative diagnosis: who are your most disappointed users and why? |
| 25-39% | Latent signal — some users love it, but not enough | Identify the "very disappointed" cohort. What do they have in common (ICP)? Can you narrow to serve them exclusively? Tighten before growing. |
| 40-59% | PMF confirmed | Growth investment gate opens. Acquisition spend, team hiring, and GTM expansion justified. |
| 60%+ | Best-in-class | Strong moat signal. Benchmark set by very few products (Slack early cohorts, Superhuman). |

**Who to survey:**
- Active users who have used the product at least twice in the last 2 weeks (Ellis's original spec).
- Exclude churned users and one-time users — they dilute the signal.
- Minimum sample: 40 responses for statistical stability; 100+ preferred.

**Volatility note:** The 40% threshold itself is STABLE (framework constant). Population distribution of scores by category or stage is VOLATILE and not well-published by neutral sources.

---

## 4. Retention-Curve PMF `VOLATILE`

**Framework rationale (Brian Balfour / Reforge — STABLE):**
A product with PMF has a retained core — a subset of users who find ongoing value and stay. The retention curve for such a product does not decay to zero; it flattens at a non-zero asymptote. The asymptote height and the day it flattens vary by natural usage frequency.

**Usage frequency determines expected floor:**
- Daily-use products (messaging, habit apps): should flatten > 25% by D30, > 15% by D90.
- Weekly-use products (productivity, B2B tools): flatten > 10% by W8, > 5% by W16.
- Monthly-use products (e-commerce, travel): curve shape less diagnostic; rely on repeat-purchase rate instead.

**Benchmark numbers (Adjust 2024-2025 data, cited 2025/2026 by UXCam, Plotline, MWM):** `VOLATILE`

| Day | All-vertical median | Good | Strong |
|---|---|---|---|
| D1 | 26% | 30%+ | 40%+ |
| D7 | 13% | 16%+ | 25%+ |
| D30 | 7% | 10%+ | 20%+ |

**Category-specific D30 ranges (Plotline, UXCam, growth-onomics 2025):** `VOLATILE`

| Category | Typical D30 range | PMF floor to target |
|---|---|---|
| Fintech / Banking | 10-16% | 12% |
| Messaging / Social habit | 25-50% | 25% |
| E-commerce | 4-8% | 5% |
| Gaming (mid-core) | 8-12% | 9% |
| Health & Fitness | 3-7% | 4% |
| Education | <3% | N/A — use completion or NPS instead |

**"Smiling curve":** D90 retention higher than D30 → dormant users reactivating or existing accounts expanding (NRR > 100%). Strong PMF signal in B2B.

**Practical PMF read:**
1. Plot 3-5 cohorts on the same chart.
2. If cohorts converge to a non-zero line → PMF signal present.
3. Validate with Ellis test on D30+ active users.
4. If both signal — deploy growth.

---

## 5. RICE Prioritization `STABLE`

**Formula:** `RICE = (Reach × Impact × Confidence%) / Effort`

**Component definitions:**
- **Reach**: # of users/events affected within a defined period (typically one quarter). Use data, not gut feel.
- **Impact**: Multiplier on a fixed scale — 3 (massive) / 2 (high) / 1 (medium) / 0.5 (low) / 0.25 (minimal).
- **Confidence**: % certainty in your Reach, Impact, and Effort estimates. 100% = solid data; 80% = reasonable estimate; 50% = gut; <50% = speculation.
- **Effort**: Person-months of work for the whole team (PM + design + eng). Round up.

**Why it beats gut-feel stacks:**
- Forces explicit confidence calibration — low-confidence bets get a natural haircut.
- Effort denominator punishes large, uncertain projects relative to small, high-signal ones.
- Produces a number that forces cross-functional discussion rather than HiPPO decisions.

**2025 best practice (ProductSchool, Intercom):**
- Calibrate the Impact scale across the full team quarterly — otherwise scores drift.
- Cap Reach estimation at the realistic addressable weekly cohort, not total MAU.
- Revisit scores when new data arrives; RICE is a living ranking, not a frozen queue.
- Combine with Now-Next-Later: RICE scores go inside the Now and Next buckets; Later items don't need precise RICE until they approach.

**When RICE breaks down:**
- Strategic bets with uncertain Reach (new market) — use a qualitative strategic screen first, RICE after.
- Compliance/technical debt — override with risk weighting, not RICE.

---

## 6. Riskiest Assumption Test (RAT) `STABLE`

**Core idea:**
Before committing to build a solution (or even an MVP), identify the single assumption whose falsification would kill the idea. Test it with the cheapest possible experiment.

**Why RAT over MVP:**
An MVP requires working software. A RAT requires only enough to test the assumption. For demand assumptions, a landing page + waitlist costs 2 days; an MVP costs 2 months.

**RAT protocol (practitioner consensus 2025):**
1. List all assumptions underlying the solution.
2. Rank by: (a) how critical to the idea, and (b) how uncertain.
3. Pick the top-right quadrant item — the one that is both critical AND uncertain.
4. Design the cheapest experiment that can produce a binary (pass/fail) signal on that assumption.
5. Define success threshold BEFORE running the test.
6. Kill or pivot if falsified. Build if validated.

**RAT experiment types (cheap to expensive):**
- Smoke test / landing page (demand assumption)
- Wizard of Oz (feasibility assumption — fake the feature manually)
- Concierge MVP (value delivery assumption — serve manually before automating)
- Prototype (usability assumption)
- Technical spike (technical feasibility assumption)

**Integration with OST:**
In Torres's framework, assumption tests live at layer 4 of the OST. Each solution node should have at least one RAT before promotion to roadmap.

---

## 7. Now-Next-Later Roadmap `STABLE`

**Origin:** Janna Bastow, ProdPad, 2012. Now dominant format in outcome-oriented teams.

**Three horizons:**
| Horizon | Timeframe | Detail level | What goes here |
|---|---|---|---|
| Now | 0-3 months | High — stories, acceptance criteria, owners | Committed work with evidence |
| Next | 3-6 months | Medium — outcomes and rough solutions | Validated opportunities, not locked features |
| Later | 6+ months | Low — strategic themes and bets | Directional only; no feature detail |

**Key properties:**
- Time-horizon, not date-locked — avoids false precision on Later items.
- Outcome-first — each row states what metric it moves, not what feature it ships.
- Later items are held as hypotheses, not commitments.

**Integration with OKRs:** Now aligns to current-quarter OKRs; Next aligns to next-quarter OKRs; Later aligns to annual strategy themes.

**2025 failure modes:**
- Putting feature names (not outcomes) in Later — creates premature commitment.
- Never moving items from Later to Next — roadmap becomes a wish list.
- Skipping stakeholder alignment on the Now/Next boundary — causes sprint-level surprises.

---

## 8. Outcome-over-Output `STABLE`

**Definition (Jeff Patton / Marty Cagan lineage):**
- **Output**: what you ship (feature, page, API endpoint).
- **Outcome**: measurable change in user behavior or business metric produced by the output.

**Why it matters:**
Teams optimizing for outputs can ship perfectly and still fail if no metric moves. Outcome focus forces the question "how will we know this worked?" before committing to build.

**Practical implementation:**
- Every roadmap item has an owner metric (leading indicator) and a measurement plan.
- Post-ship review asks: did the metric move? Not: did we ship the feature?
- Teams empowered to kill or reshape a feature mid-build if early signal shows the metric isn't moving.

**The hardest part:** Choosing the right leading indicator. Revenue is a lagging metric; engagement is a leading metric. The best leading indicators are: feature adoption rate within 7 days of activation, repeat usage rate within the natural frequency window, and task completion rate for the core job-to-be-done.

---

## Volatile Rows — Re-research Priority List

When the 30-day window expires, re-research these in order:

1. **D1 / D7 / D30 retention medians by vertical** — Adjust publishes annual reports; UXCam and Plotline scrape and republish. Query: `"mobile app retention benchmarks [year] by industry"`
2. **B2B SaaS NRR / GRR / CRR medians** — Benchmarkit, SaaS Capital, and Pavilion publish annually (Q1-Q2). Query: `"SaaS retention benchmarks [year] NRR median"`
3. **Sean Ellis score distribution by category** — Less publicly tracked; GoPractice/pmfsurvey.com and Reforge occasionally publish cohort data. Query: `"Sean Ellis PMF score distribution [year]"`

All framework descriptions (sections 1-8 narratives) are STABLE and do not require re-research unless a major new edition or paradigm shift occurs.

---

_Generated 2026-06-28. Sources: producttalk.org (Torres), pmfsurvey.com (Ellis), Reforge PMF guide, Adjust 2024-2025 benchmark data (via UXCam/Plotline/MWM), Benchmarkit 2025, SaaS Capital 2025, Intercom RICE original, ProdPad / Janna Bastow Now-Next-Later, getperspective.ai OST 2026 guide._
