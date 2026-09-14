# Startup Growth Marketing 2026 — L3 Detail File

> This file explains the *why* behind every band in CAPABILITIES.md.
> Each row is flagged: **VOLATILE** = market median that drifts (re-research on 30-day window) or **STABLE** = framework/principle that rarely moves.

---

## 1. AARRR Funnel Diagnosis

**STABLE — framework does not drift.**

Dave McClure's Pirate Metrics defines five gates:

| Gate | What to measure | Common mistake |
|---|---|---|
| **Acquisition** | Channel-attributed signups/leads | Measuring raw traffic, not qualified arrivals |
| **Activation** | % reaching "Aha!" moment in session 1 | Skipping instrumentation entirely |
| **Retention** | D1/D7/D30/D90 curves | Fixing acquisition before retention |
| **Revenue** | Trial-to-paid, ARPU, NRR | Conflating MRR growth with healthy revenue |
| **Referral** | K-factor, referral signup %, referral retention | Measuring shares, not actual installs/signups |

**Diagnosis protocol:** Walk the funnel from bottom to top. Retention leaks cannot be fixed with more acquisition spend. The 2025 posthog AARRR deep-dive (posthog.com/product-engineers/aarrr-pirate-funnel) confirms this ordering — fix the lowest-converting stage first.

**Activation benchmark context (VOLATILE):** 30–40% median SaaS signup-to-Aha! rate; top quartile 60–70%. These numbers shift with category maturity. Re-research if the domain is AI-native tooling (rates may be lower due to UX complexity) or commoditized (rates higher due to category familiarity).

---

## 2. Bullseye Channel Selection

**STABLE — 19 channels listed in *Traction* (Weinberg & Mares, 2015) hold; relative channel costs are VOLATILE.**

The 19 traction channels: viral marketing, PR, unconventional PR, search engine marketing (SEM), social and display ads, offline ads, SEO, content marketing, email marketing, engineering as marketing, targeting blogs, business development, sales, affiliate programs, existing platforms, trade shows, offline events, speaking engagements, community building.

**The process:**
1. **Brainstorm** — generate ideas across all 19 channels without filtering
2. **Rank** — sort into outer ring (unlikely), middle ring (possible), inner ring (best bets)
3. **Prioritize** — pick top 3 from inner ring
4. **Test cheaply** — run 2–4 week sprints with fixed budget per channel; measure CAC, volume ceiling, conversion rate
5. **Focus** — double down on the single winner; revisit Bullseye when winner saturates

**Key insight:** At any stage, one channel dominates. Multi-channel spray is a seed-stage mistake. The 2026 PLG environment (saasmag.com PLG evolves article) shows content + product-led SEO increasingly dominating inbound for B2B tools, while paid social remains the highest-cost channel with lowest trial-to-paid rates for cold audiences.

**Current channel cost direction (VOLATILE — re-research):** Google SEM CPCs for B2B SaaS keywords rose 15–22% YoY in 2024–2025 (industry reports); LinkedIn CPM up 10–18%. Organic + PLG moats are therefore increasingly economically advantageous vs. pure paid. Mark this row for re-research at 30-day window.

---

## 3. PLG vs. Sales-Led GTM

**STABLE (framework); VOLATILE (conversion benchmarks).**

| Dimension | PLG | Sales-Led | Hybrid |
|---|---|---|---|
| Primary motion | Product signup → self-serve upgrade | AE demo → contract | Free tier + sales-assist above $X ACV |
| Signal for fit | ACV < $15K, self-serve viable, broad ICP | ACV > $25K, complex procurement, compliance | ACV $5K–$50K, two-sided buyer |
| Key metric | Free-to-paid CVR, PQL conversion, TTV | Opp-to-close rate, sales cycle days, quota attainment | PQL-to-SAL handoff rate |
| CAC structure | Low variable CAC, high product investment | High AE/SDR cost, lower volume ceiling | Blended |

**Why free-to-paid = 9% median (VOLATILE):** ProductLed 2025 benchmark dataset (productled.com/blog/product-led-growth-benchmarks) across 300+ PLG companies. ACV band drives it: < $1K ACV products achieve 24% top-quartile because low price removes friction; $1K–$5K products median 10%. This drifts as category maturity changes willingness-to-pay norms. Re-research if entering a new vertical.

**PQL insight:** Only ~24–25% of PLG teams formally track PQLs (Optifai PLG Guide), yet PQL adoption correlates with ~3× conversion uplift. This is a durable structural gap, not a benchmark that drifts — the insight is STABLE, the adoption percentage is VOLATILE.

**TTV < 5 minutes target:** Top PLG companies (Figma, Notion, Linear, Loom) all report sub-5-minute first-value moments. This is an aspiration benchmark, not a median — median first-value is likely 15–30 minutes for complex B2B tools. Mark as [unverified] for median; the < 5 min target is widely cited but the median is not published in a primary dataset.

---

## 4. ICE Experiment Prioritization

**STABLE — framework does not change; threshold scores are team-relative.**

**ICE = Impact × Confidence × Ease** (each scored 1–10; multiply for composite).

| Dimension | What to score | Common calibration error |
|---|---|---|
| **Impact** | Potential uplift to the north star metric if this works | Overweighting revenue impact vs. funnel stage |
| **Confidence** | Evidence quality: prior data, analogues, user research | Scoring 10 for gut instinct |
| **Ease** | Engineering + design + ops effort to ship | Underweighting ops/legal dependencies |

**Practical thresholds:**
- ICE ≥ 64 (e.g., 8×8×1 or 4×4×4): run this week
- ICE 27–63: backlog with scheduled sprint slot
- ICE < 27: park or kill

**Cadence (2025 standard):** Weekly experiment review, 2-week sprint cycles, 80/20 rule (80% high-ICE, 20% exploratory). Growth-Experiments.com Guide (2025) notes RICE (adds Reach multiplier) is preferred for teams with large user bases where reach variance is significant; ICE suffices for sub-10K MAU products.

**RICE vs ICE:** RICE = (Reach × Impact × Confidence) / Effort. Prefer RICE when reach segmentation matters (e.g., experiment only touches 15% of users). ICE is faster to score and sufficient for most seed/Series A teams.

---

## 5. Sean Ellis PMF Adjacency

**STABLE (threshold); VOLATILE (NPS medians, growth multipliers).**

**The 40% rule (STABLE):** Sean Ellis surveyed hundreds of early-stage companies and identified 40% "very disappointed" as the empirical threshold above which companies consistently achieve sustainable growth. This threshold has not been revised since its publication. Source: fitsignal.com, pmtoolkit.ai.

**Three-signal protocol (STABLE):**
1. Ellis survey ≥ 40%
2. Retention curve flattens at week 4–8 (cohort chart stops declining)
3. NPS cohort decay slows (later cohorts not significantly worse than early)

All three required before green-lighting paid acquisition scale.

**Growth multiplier (VOLATILE):** Amplitude research cites "3–5× faster growth" for companies above 40% Ellis. This is a relative figure from their dataset, not universal. Mark as [unverified] for universal applicability — the direction is right, the magnitude varies.

**NPS benchmarks (VOLATILE — re-research):**
- B2B SaaS median NPS: 38 (source: multiple 2025 surveys, Bain & Company)
- B2C median: 49
- Target for strong PMF: > 50
- NPS > 50 → product advocacy as acquisition channel becomes viable

---

## 6. Activation / Retention Loops

**STABLE (loop structure); VOLATILE (D1/D7/D30 rates).**

**The activation loop:**
`Signup → Aha! moment (session 1) → habit-forming action (D7) → expansion trigger → upsell`

The Aha! moment must happen in session 1. Users who do not activate in session 1 have < 20% probability of returning (industry consensus, no single primary dataset — mark [unverified] for the exact number; directionally confirmed by Mixpanel, Amplitude, and PostHog cohort analyses).

**D1 / D7 / D30 benchmarks (VOLATILE — re-research):**

| Product type | D1 | D7 | D30 |
|---|---|---|---|
| Consumer mobile (games) | 35–45% | 15–25% | 5–10% |
| Consumer mobile (utility) | 25–35% | 10–18% | 5–12% |
| B2B SaaS (desktop) | 40–60% (session 2 return) | 30–45% | 20–35% |
| PLG free tier | 20–35% (next-week login) | 15–25% | 8–15% |

Sources: Mixpanel 2024 Product Benchmarks, Amplitude 2024 Product Report. These are 2024 figures — refresh at 30-day window for 2025 publications.

**Retention loop types (STABLE):**
- **Content loops:** User creates → content surfaces to others → invites flow back (Notion, Figma)
- **Network loops:** Value increases with more users (Slack, Linear)
- **Marketplace loops:** Supply attracts demand attracts supply
- **Data loops:** Usage improves recommendations which increase usage (AI tools)

Which loop type applies determines the retention intervention. Misidentifying loop type leads to wrong investment.

---

## 7. CAC / Channel / Conversion Benchmarks — Detailed

### CAC Payback by Segment (VOLATILE — primary data source: Benchmarkitt 2025, 939 companies)

Recurly and Benchmarkitt data are updated annually. The 2025 figures (published via Optifai aggregation):

| ACV Bracket | Median CAC Payback |
|---|---|
| < $5K | 9 months |
| $5K–$10K | 11 months |
| $10K–$25K | 12 months |
| $25K–$50K | 14 months |
| $50K–$100K | 18 months |
| $100K–$250K | 22 months |
| > $250K | 24+ months |

**2026 investor expectation shift:** Many VCs now apply an 80–180 day (3–6 month) payback filter for early-stage deals. This is a tightening vs. the historical 12–18 month norm — reflecting 2022–2024 efficiency pressure. Source: Aleph (getaleph.com/answers/cac-payback-period-saas-2026), Proven SaaS (proven-saas.com).

### Churn by Segment (VOLATILE — Recurly 2025 primary)

Annual churn median 3.5% (B2B SaaS blended: 2.6% voluntary + 0.8% involuntary). SMB churn concentrates in first 90 days — 43% of SMB logo losses happen in Q1 post-purchase. This implies onboarding intervention ROI is highest in first 30–60 days.

**Involuntary churn (VOLATILE but structurally significant):** ~40% of all churn is payment failure. Recoverable via: dunning emails (automated retry sequences), card updater services, in-app payment failure alerts. This is free alpha — fix before optimizing CAC.

### Landing Page CVR (VOLATILE — re-research as paid channel CPCs change)

The gap between custom LPs (11.6%) and template LPs (3.8%) is large and consistently reported. Form field count is the highest-leverage single variable. These numbers come from SaasHero (saashero.net) and Growthspreeofficial analyses, which aggregate CRO data from 2024–2025 experiments.

---

## 8. Volatility Registry

| Metric | Volatility | Re-research trigger |
|---|---|---|
| CAC payback by ACV segment | **VOLATILE** | New Benchmarkitt/Optifai annual data |
| Free-to-paid CVR (PLG) | **VOLATILE** | New ProductLed benchmark report |
| Annual churn rate medians | **VOLATILE** | New Recurly annual churn report |
| D1/D7/D30 retention rates | **VOLATILE** | New Mixpanel/Amplitude Product Benchmark |
| NPS medians (B2B/B2C) | **VOLATILE** | Annual Bain/Satmetrix NPS benchmark |
| Paid channel CPCs (SEM, LinkedIn) | **VOLATILE** | Quarterly re-research |
| Landing page CVR medians | **VOLATILE** | 6-month cadence |
| AARRR framework gates | **STABLE** | Framework change only |
| Bullseye 19 channels | **STABLE** | Channel obsolescence only |
| ICE scoring formula | **STABLE** | No expected change |
| Sean Ellis 40% threshold | **STABLE** | No expected change |
| Loop types (content/network/data) | **STABLE** | Structural change only |
| Referral retention +37% / LTV +18% | **VOLATILE** | shno.co 2026 dataset update |

---

## Sources (full list)

- Optifai / Benchmarkitt — B2B SaaS Churn Rate Benchmarks 939 companies: https://optif.ai/learn/questions/b2b-saas-churn-rate-benchmark/
- Optifai — CAC Payback Benchmark: https://optif.ai/learn/questions/cac-payback-period-benchmark/
- Recurly 2025 Churn Report (via Hubifi / Vitally summaries): https://www.vitally.io/post/saas-churn-benchmarks
- Lighter Capital 2025 B2B SaaS Startup Benchmarks: https://www.lightercapital.com/blog/2025-b2b-saas-startup-benchmarks
- ProductLed PLG Benchmarks: https://productled.com/blog/product-led-growth-benchmarks
- Optifai PLG Guide: https://optif.ai/guides/product-led-growth/
- Aleph CAC Payback 2026: https://www.getaleph.com/answers/cac-payback-period-saas-2026
- Proven SaaS CAC Payback 2026: https://proven-saas.com/benchmarks/cac-payback-benchmarks
- SaasHero Landing Page Benchmarks: https://www.saashero.net/content/landing-page-conversion-rate-benchmarks/
- SaasHero 2026 Conversion Benchmarks: https://www.saashero.net/content/2026-b2b-saas-conversion-benchmarks/
- shno.co Viral Loop Statistics 2026: https://www.shno.co/marketing-statistics/viral-loop-statistics
- FitSignal Sean Ellis Guide: https://www.fitsignal.com/blog/sean-ellis-40-percent-test
- PMToolkit PMF Guide: https://pmtoolkit.ai/learn/strategy/product-market-fit-guide
- PostHog AARRR deep-dive: https://posthog.com/product-engineers/aarrr-pirate-funnel
- SaasMag PLG 2026: https://www.saasmag.com/product-led-growth-next-chapter-saas-2026/
- Growth-Experiments.com ICE/RICE Guide: https://growth-experiments.com/guides/experiment-prioritization
- Weinberg & Mares, *Traction* — Bullseye Framework (book, 2015; framework stable)
- Sean Ellis, *Hacking Growth* — ICE scoring (book, 2017; framework stable)

_As-of 2026-06-28. Volatile rows flagged above — re-research on 30-day window or when named annual reports publish._
