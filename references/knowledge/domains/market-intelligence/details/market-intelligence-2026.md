# Market Intelligence 2026 — L3 Detail File

**Layer:** 3 (DETAIL)
**Parent:** CAPABILITIES.md
**Last updated:** 2026-06-28
**Re-research trigger:** 30-day window on VOLATILE rows; STABLE rows hold until framework revision

---

## 1. Bottom-Up TAM/SAM/SOM Sizing

**STATUS: STABLE (methodology) / VOLATILE (penetration norms, deal-count benchmarks)**

### Why bottom-up wins in 2026

Investors in 2026 treat top-down-only sizing as a red flag. The dual-method standard — top-down for macro context (Statista/Gartner/IDC), bottom-up for operational credibility — is now table stakes in pitch reviews. The bottom-up path must show:

1. **ICP count** — census, SBA, LinkedIn Sales Navigator, ZoomInfo, or Crunchbase; segment by vertical + geo + company size + use case
2. **ARPU** — own pricing if available; competitor anchoring otherwise
3. **Penetration to SOM** — 1-3% for Y1-Y3; 2-3% is the consensus starting point for most 2026 decks
4. **SAM from SOM** — apply realistic win rate (see §5) to qualify the accessible slice
5. **Cross-check** — if top-down TAM and bottom-up SAM diverge by >3×, investigate assumptions before presenting

**VOLATILE:** SOM penetration norms drift as market density changes. Re-verify if >30 days stale.

### Key numbers (source: Waveup 2026, Qubit Capital 2025)

- Y1 SOM penetration consensus: **1–3%** (most founders land at 2-3%)
- Defensible penetration with existing pipeline: up to **5%** if backed by LOIs or early customer data
- Top-down TAM sources trusted by VCs: Statista, Gartner, IDC — cited, not just asserted

---

## 2. Competitive Teardown Grid

**STATUS: STABLE (framework) / VOLATILE (pricing-change frequency, CI tool norms)**

### Four-axis teardown (canonical)

| Axis | What to capture | Staleness risk |
|---|---|---|
| **Target** | ICP definition: vertical, size, persona, geography | Medium — shifts quarterly |
| **Promise** | Core value prop, headline positioning, tagline evolution | Medium — track landing page |
| **Proof** | Named customers, case study metrics, G2/Capterra position, logo tier | Low — slower to change |
| **Pricing** | Published tiers, free tier caps, trial length, usage-based thresholds, bundling | HIGH — 70% change in 6mo |

### Pricing volatility (source: Competitive Intelligence Alliance 2025, Industry Lens 2026)

- **~70% of B2B SaaS competitors changed their pricing page at least once in any 6-month window**
- **~1 in 3 had a pricing change in any given week** (across a surveyed panel)
- Implication: pricing intelligence must be continuous, not quarterly. Monitor: free-tier caps, trial length, bundling changes, usage-based thresholds — these reveal strategic intent faster than any press release

**VOLATILE:** Pricing-change frequency norms. Re-research if >30 days stale; this metric reflects market tempo which compresses in AI-led SaaS categories.

### Competitor health signals from pricing behavior

- Frequent deep discounting in a vertical → demand softer than public positioning suggests
- Free-tier tightening → monetization pressure
- Usage-cap introduction → shift toward usage-based pricing
- Feature bundling into lower tiers → competitive response to a challenger

---

## 3. JTBD Four Forces + Mom Test Protocol

**STATUS: STABLE (framework) / STABLE (interview volume — 10-15 is well-established)**

### JTBD Four Forces (source: Strategyn / Ulwick; Parallelhq 2026)

Every switching decision involves four forces operating simultaneously:

| Force | Direction | Question to surface it |
|---|---|---|
| **Push** | Away from old solution | "What was frustrating you about how you handled X before?" |
| **Pull** | Toward new solution | "What made you think [product] might solve it?" |
| **Anxiety** | Slowing switch | "What almost stopped you from making the change?" |
| **Habit** | Anchoring to status quo | "What would you have to give up that you were used to?" |

A JTBD interview that skips Anxiety and Habit misses the most predictive signals for churn and expansion — those two forces are why users who intended to switch never fully did.

### Switch interview volume

- **10-15 switch interviews** per defined customer segment reveals the vast majority of actionable patterns (source: Koji/Valchanova JTBD guides 2026)
- Interviews must be anchored to a **specific switching moment** (the day the buyer decided), not general usage

### Mom Test discipline

- Never ask "would you use/pay for this?" — ask what they *did* in the past
- Every question anchored to a real event: "Tell me about the last time you…"
- Probe for specifics: frequency, effort, cost, alternatives tried
- Signal of a bad interview: buyer is validating your idea rather than telling you a story

---

## 4. Win/Loss Analysis

**STATUS: STABLE (protocol) / VOLATILE (win rate medians — moved 10 points in 2024-2025)**

### Win rate benchmarks 2025 (source: Ebsta×Pavilion 2025, Optifai, Landbase 2026)

| Segment | Floor | Median 2025 | Best-in-class | Notes |
|---|---|---|---|---|
| All opps (B2B avg) | <10% | **19-21%** | >35% | Down from 29% in 2024 |
| Qualified opps only | <15% | **29%** | >40% | Higher discipline = better comp |
| SMB-focus (<100 emp) | <20% | **30-40%** | >45% | Fastest cycles, easiest to win |
| Mid-market | <18% | **25-35%** | >40% | |
| Enterprise (>1K emp) | <12% | **20-25%** | >30% | |
| By ACV <$10K | — | **28-35%** | — | |
| By ACV $10-50K | — | **20-28%** | — | |
| By ACV $50-100K | — | **15-22%** | — | |
| By ACV >$100K | — | **12-18%** | — | |

**KEY VOLATILE FACT:** The 2025 Ebsta×Pavilion report shows win rates fell from **29% → 19%** YoY — the single largest drop on record in B2B SaaS. Drivers: longer buying cycles, larger buying committees, more cautious procurement, increased competitive density. This means any win-rate assumption from 2023 or 2024 must be refreshed.

**Relationship intelligence premium:** selling to known contacts delivers **37% win rate vs 19% for cold** — a 2× lift from relationship capital alone.

**VOLATILE:** Win rate medians. Re-research every 30 days. Market is compressing in 2025-2026 and segment medians are moving.

### Win/loss program design (source: Clozd 2026, Klue 2025)

| Parameter | Minimum | Recommended |
|---|---|---|
| Interview cadence | 5/quarter | **5-8/month** |
| Deals per cohort | 10 | 15-20 |
| Days from close to interview | <90 | **<30** |
| CRM reason code trust | Never sole source | Verify with interview |
| Program visibility | Executive | Cross-functional (CI + Product + Sales + Marketing) |

- **68% of companies that share win-loss insights cross-functionally report win-rate increases** (Clozd)
- **Only 39% run ongoing, cross-functional programs** — the majority still do batch retrospectives
- **91% of CRM data is incomplete; 70% goes stale within a year** — treat CRM close reasons as hypotheses, not answers
- **58% of late-stage deal losses in 2025-2026 trace to implementation risk, not price** — derisking the buying journey is the highest-leverage response

---

## 5. NRR / Churn / Retention Benchmarks

**STATUS: VOLATILE — re-research every 30 days; these shift with macro conditions**

### Net Revenue Retention (source: Optifai 939-company dataset, SaaS Capital 2025, ProductQuant 2026)

| Segment | Concern | Median | Best-in-class |
|---|---|---|---|
| **SMB** | <90% | **97%** | >110% |
| **Mid-market** | <100% | **108%** | >120% |
| **Enterprise** | <105% | **118%** | >130% |
| $25K-$50K ACV | — | **102%** | — |
| $1-10M ARR companies | — | **98%** | — |
| $100M+ ARR companies | — | **115%** | — |

### Monthly Churn Rate (source: Optifai, Genesys Growth 2026, Vena 2025)

| Segment | Median monthly churn | Healthy target |
|---|---|---|
| SMB | **3-5%** | <3% |
| Mid-market | **1.5-3%** | <1.5% |
| Enterprise | **1-2%** | <1% |
| Industry blended avg | **3.5%** | — |
| Voluntary component | **2.6%** | — |
| Involuntary (payment failure) | **0.8%** | — |

**Key insight:** Up to **40% of total churn stems from payment failures** — a recoverable category that most companies under-invest in.

**VOLATILE:** NRR and churn medians. Macro rate environment, AI-category disruption, and procurement tightening all affect these.

---

## 6. CAC Payback & Growth Rate Benchmarks

**STATUS: VOLATILE — efficiency era is shifting these; re-research every 30 days**

### CAC Payback (source: Benchmarkit 2025, Maxio 2025)

| Segment | Concern threshold | Median | Best-in-class |
|---|---|---|---|
| SMB | >18 months | **6-12 months** | <6 months |
| Mid-market | >24 months | **12-18 months** | <10 months |
| Enterprise | >36 months | **18-24 months** | <15 months |
| Industry blended median | — | **~20-23 months** | — |

### ARR Growth (source: Benchmarkit 2025, Lighter Capital 2025, SaaS Capital 2026)

- Median ARR growth (private SaaS, all sizes): **26%** (2024 actuals)
- <$50M ARR cohort target for 2025: **35%**
- Top performers (2025): **50%+** (slowed from 60%+ in 2021-2022 era)
- Rule of 40 achievement (private SaaS): **only 11-30% of companies** — the efficiency-first era has raised the bar for what counts as elite

---

## 7. Opportunity/Threat Radar

**STATUS: STABLE (framework) / VOLATILE (specific market signals — agent populates live)**

### PESTLE × SWOT integration

PESTLE feeds the Opportunities and Threats quadrants of SWOT. Run PESTLE first to generate external signal inventory, then classify each signal as O or T against your specific strengths and weaknesses.

| PESTLE dimension | 2026 market-intel priority areas |
|---|---|
| **Political** | AI regulation (EU AI Act enforcement, US executive orders), data sovereignty |
| **Economic** | Rate environment → enterprise budget tightening, SMB churn sensitivity |
| **Social** | Buyer committee expansion (avg 6-10 stakeholders in enterprise deals), AI skepticism |
| **Technological** | AI feature parity compression, LLM commoditization, agent-native competitors |
| **Legal** | GDPR/CCPA enforcement, FTC guidance on AI claims, SOC2/ISO competition requirements |
| **Environmental** | ESG scoring as procurement criterion in enterprise; cloud carbon footprint in EU tenders |

### Monitoring cadence norms

- High-velocity markets (AI/SaaS): monthly PESTLE refresh minimum
- Stable markets: quarterly minimum
- Pricing CI: continuous (weekly automated scrape + human review monthly)

---

## 8. Sources — Full Citation List

1. Waveup — "TAM, SAM, SOM 2026: Calculate & Pitch to VCs" — https://waveup.com/blog/tam-sam-som/
2. Waveup — "Market Sizing for Startups 2026: Top-down vs Bottom-up" — https://waveup.com/blog/top-down-and-bottom-up-market-size-calculation/
3. Qubit Capital — "Bottom-Up Market Sizing for Startups: Precise TAM Calculation Guide" — https://qubit.capital/blog/bottom-up-market-sizing
4. Clozd — "What is Win-Loss Analysis? The Ultimate 2026 Guide" — https://www.clozd.com/guides/win-loss-analysis
5. Klue — "The Ultimate 7-Step Guide to Win-Loss Analysis (2025)" — https://klue.com/blog/win-loss-analysis-guide
6. SaaS Capital — "What is a Good Retention Rate for a Private SaaS Company in 2025?" — https://www.saas-capital.com/blog-posts/what-is-a-good-retention-rate-for-a-private-saas-company/
7. Optifai — "B2B SaaS NRR Benchmarks — 939 Companies by Segment & ACV Tier" — https://optif.ai/learn/questions/b2b-saas-net-revenue-retention-benchmark/
8. Optifai — "B2B SaaS Churn Rate Benchmarks — 939 Companies" — https://optif.ai/learn/questions/b2b-saas-churn-rate-benchmark/
9. Genesys Growth — "B2B SaaS Churn Rates — 33 Statistics for 2026" — https://genesysgrowth.com/blog/saas-churn-rates-stats-for-marketing-leaders
10. Ebsta × Pavilion — 2025 B2B Sales Performance Benchmarks — https://www.gradient.works/blog/2025-b2b-sales-performance-benchmarks
11. Benchmarkit — "2025 SaaS Performance Metrics" — https://www.benchmarkit.ai/2025benchmarks
12. Lighter Capital — "2025 B2B SaaS Startup Benchmarks" — https://www.lightercapital.com/blog/2025-b2b-saas-startup-benchmarks
13. Landbase — "Win Rate Benchmarks by Industry, Deal Size, and Source in 2026" — https://www.landbase.com/blog/win-rate-benchmarks-industry-deal-size-2026
14. Parallelhq — "What Are Jobs to Be Done? JTBD Guide with 2026 Examples" — https://www.parallelhq.com/blog/what-are-jobs-to-be-done
15. Koji — "The Complete Guide to Jobs-to-Be-Done Interviews (JTBD Framework 2026)" — https://www.koji.so/blog/jobs-to-be-done-interview-guide-2026
16. Competitive Intelligence Alliance — "11 Competitive Intelligence Trends in 2025" — https://www.competitiveintelligencealliance.io/11-competitive-intelligence-trends/
17. Industry Lens — "Competitor Pricing Intelligence: How to Track Competitor Pricing in 2026" — https://industry-lens.com/resources/competitor-pricing-intelligence
18. ProductQuant — "NRR Benchmarks for B2B SaaS in 2026: What Good Looks Like by Segment" — https://productquant.dev/blog/nrr-benchmarks-saas/
19. Zenitdata — "B2B SaaS Win Rate Benchmarks by Deal Size, Stage and Segment" — https://zenitdata.com/blog/b2b-saas-win-rate-benchmarks-by-deal-size-stage-and-segment-2026/

---

_As-of 2026-06-28. VOLATILE rows: win-rate medians, NRR/churn medians, CAC payback medians, ARR growth medians, SOM penetration norms, pricing-change frequency. Re-research all VOLATILE rows when >30 days stale._
