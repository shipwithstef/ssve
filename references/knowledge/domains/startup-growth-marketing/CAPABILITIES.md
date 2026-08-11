> **L2 current-awareness bank — `growth-lead` agent**
> Loaded at run-start via `expertise.mjs` preload. Currency = domain (30-day staleness window).
> Authoritative benchmark numbers live HERE, not in the agent prompt.
> Sources: Benchmarkitt 2025, Recurly 2025 Churn Report, ProductLed, Optifai (939-company dataset), Lighter Capital 2025 B2B SaaS Benchmarks.

---

## Core frameworks

| # | Framework | One-liner |
|---|-----------|-----------|
| 1 | **AARRR (Pirate Metrics)** | Five-stage funnel (Acquisition → Activation → Retention → Revenue → Referral); each stage diagnosed independently before fixing acquisition |
| 2 | **Bullseye Channel Selection** | Weinberg/Mares 19-channel brainstorm → rank outer/middle/inner rings → run cheap tests on top 3 → double down on winner |
| 3 | **PLG vs Sales-Led GTM** | PLG = product is the primary acquisition + expansion motion (self-serve, PQL); Sales-led = AE-driven demos; hybrid = PLG floor + sales ceiling |
| 4 | **ICE Experiment Prioritization** | Score each experiment: Impact × Confidence × Ease (each 1–10); rank descending; run weekly cadence |
| 5 | **Sean Ellis PMF Adjacency** | "Very disappointed" survey + retention curve flattening + NPS cohort decay — three independent signals required before scaling spend |
| 6 | **Activation / Retention Loops** | First-value moment (Aha!) within session 1 → habit loop (D1/D7/D30 retention) → expansion trigger; fix retention before acquisition |

---

## Benchmark bands / thresholds

### Acquisition & CAC Payback

| Segment | CAC Payback Median | Investor threshold (2026) |
|---|---|---|
| SMB (ACV < $15K) | 8–12 months | < 12 months |
| Mid-market ($15K–$100K ACV) | 14–18 months | < 18 months |
| Enterprise (> $100K ACV) | 18–24 months | < 24 months |
| **All B2B SaaS (blended)** | **16 months** | **< 18 months** |

Source: Benchmarkitt 2025 (939 companies via Optifai), Lighter Capital 2025, Aleph 2026 analysis.

### Activation

| Type | Median | Best-in-class |
|---|---|---|
| SaaS signup → first meaningful feature use | 30–40% | 60–70% |
| Fintech (KYC → first transaction) | 25–45% | 55%+ |
| Consumer app (install → first core action) | 20–35% | 55% |
| Time-to-value target (PLG) | < 5 minutes | < 2 minutes |

### PLG Conversion

| Metric | Median | Top quartile |
|---|---|---|
| Free-to-paid (all PLG) | **9%** | 15–25% |
| Freemium visitor-to-signup | 12% | 20%+ |
| Free-trial-to-paid | 12–28% | 35%+ |
| PQL adoption (teams using PQLs) | ~25% | — |
| PQL lift vs. no-PQL | ~3× conversion | — |

Source: ProductLed Benchmarks, Optifai PLG Guide, Medium/@theaileenallen.

### Retention & Churn

| Segment | Monthly logo churn | Annual logo churn |
|---|---|---|
| SMB | 2–4% | 22–40% |
| Mid-market | 0.5–1.5% | 6–17% |
| Enterprise | < 0.5% | < 6% |
| **B2B SaaS median (all)** | — | **3.5%** (Recurly 2025) |

| Metric | Median | Target |
|---|---|---|
| Net Revenue Retention (NRR) | 106% | > 110% (premium valuation) |
| D1 retention (consumer PLG) | 25–35% | 40%+ |
| D30 retention (consumer PLG) | 10–15% | 20%+ |
| Involuntary churn share | ~40% of all churn | Recoverable via dunning |

Source: Recurly 2025 Churn Report, Optifai B2B SaaS Churn Benchmark (939 companies), Vitally 2025.

### Landing Page / Funnel Conversion

| Page / Stage | Average | Best-in-class |
|---|---|---|
| Visitor → lead (broad marketing site) | 2–5% | 8–15% |
| Visitor → self-serve trial signup | 4–10% | 12–18% |
| Trial → paid | 12–28% | 35%+ |
| Custom LP vs. template | 11.6% vs 3.8% | — |
| Form field reduction (11→4 fields) | +160% CVR lift | — |

Source: SaasHero 2026, Daydream, Growthspreeofficial 2026.

### Referral / Virality

| Metric | B2B typical | Consumer good |
|---|---|---|
| Viral coefficient (K-factor) | 0.15–0.25 | 0.25–0.4 |
| Referral retention premium | +37% vs paid | — |
| Referral LTV premium | +18% vs paid | — |
| B2B viral cycle time | 8–12 weeks | 7–14 days |

Source: Visible.vc, shno.co viral loop statistics 2026.

### PMF Signals

| Signal | Threshold | Meaning |
|---|---|---|
| Sean Ellis "very disappointed" | **≥ 40%** | Scale spend |
| Sean Ellis "very disappointed" | 25–39% | Iterate before scaling |
| Sean Ellis "very disappointed" | < 25% | Fundamental pivot needed |
| NPS (B2B SaaS median) | 38 | > 50 = strong |
| Retention curve | Flattens at week 4–8 | PMF confirmed |

Source: FitSignal, PMToolkit, Amplitude research.

---

## Decision triggers

| If you observe… | Action |
|---|---|
| CAC payback > 18 months (SMB/MM) | Diagnose channel mix; cut bottom-quartile channels; improve activation to lower effective CAC |
| Free-to-paid < 6% | Activation gap — instrument Aha! moment, shorten TTV, add PQL scoring |
| Annual churn > 8% | Retention emergency — check D30 curve, first-90-days onboarding, involuntary churn recovery |
| NRR < 100% | Contraction > expansion — prioritize upsell motion before new logo spend |
| Ellis score < 40% | Do NOT scale paid acquisition; run discovery interviews; iterate core loop |
| Ellis score ≥ 40% + NRR > 110% | Green-light paid spend scale; Bullseye to find next dominant channel |
| K-factor > 0.4 | Viral loop is working; invest in referral mechanics to push toward 0.7+ |
| Landing page CVR < 3% | CRO sprint: reduce form fields, add social proof, run dedicated campaign LP |

---

## Sources

| Source | Type | Date |
|---|---|---|
| Benchmarkitt / Optifai (939 companies) | Dataset | 2025 |
| Recurly 2025 Churn Report | Dataset | 2025 |
| Lighter Capital 2025 B2B SaaS Startup Benchmarks | Report | 2025 |
| ProductLed PLG Benchmarks | Report | 2025 |
| Aleph CAC Payback Analysis | Analysis | 2026 |
| SaasHero 2026 Conversion Benchmarks | Analysis | 2026 |
| shno.co Viral Loop Statistics | Dataset | 2026 |
| FitSignal / PMToolkit Sean Ellis guides | Reference | 2025–2026 |
| Weinberg & Mares, *Traction* (Bullseye) | Framework | Stable |
| Sean Ellis / Morgan Brown, *Hacking Growth* (ICE) | Framework | Stable |

---

_As-of 2026-06-28; volatile rows re-research when stale._
