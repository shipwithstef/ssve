> **L2 current-awareness bank — `customer-success` agent**
> Read via `expertise.mjs` preload at run-start. Currency = domain (30-day window).
> Authoritative benchmark numbers live HERE, not in the agent prompt.
> Volatile rows must be re-researched when stale (see `.version`).

---

## Core frameworks

1. **Health Score (composite)** — weighted signal combining product adoption, NPS/CSAT, support load, license utilization, and value-realization milestones into a single at-risk score per account.
2. **JTBD-mapped TTV** — Time-to-Value anchored to the customer's job-to-be-done, not generic logins; activation = customer witnesses the outcome they hired the product to deliver.
3. **Voluntary / Involuntary Churn Split** — separate predictive models for behavioral-signal churn vs. billing-event churn; blending the two populations degrades both models.
4. **Predictive Action Layer** — churn prediction is solved at the model layer and unsolved at the action layer; wiring scores into CSM tasks + playbooks is the operational differentiator, not the algorithm.
5. **NRR as the north-star metric** — NRR > 100% means the cohort grows itself; it is the primary valuation lever and the compound proof of retention + expansion working together.
6. **Dunning-first involuntary churn capture** — smart payment-retry sequences recapture 50–80% of failed-payment revenue with zero product changes.

---

## Benchmark bands / thresholds

| Metric | Concerning | Acceptable | Good | Best-in-class | Source / Year |
|---|---|---|---|---|---|
| **Annual logo churn (B2B SaaS, blended)** | >10% | 5–10% | 3–5% | <3% | Recurly Churn Report 2025 |
| **Annual logo churn — SMB segment** | >39% | 22–39% | 10–22% | <10% | ChartMogul / Optifai 2025 |
| **Annual logo churn — Mid-Market** | >18% | 9–18% | 4–9% | <4% | ChartMogul / Optifai 2025 |
| **Annual logo churn — Enterprise** | >9% | 4–9% | 1–4% | <1% | ChartMogul / Optifai 2025 |
| **Monthly logo churn — SMB** | >7% | 3–7% | 1–3% | <1% | ChartMogul 2025 |
| **Monthly logo churn — Enterprise** | >1% | 0.5–1% | 0.2–0.5% | <0.2% | ChartMogul 2025 |
| **Involuntary churn share (% of total churn)** | >50% | 30–50% | 15–30% | <15% | Recurly 2025; avg 0.8% annual |
| **NRR — SMB (<$25K ACV)** | <85% | 85–97% | 97–110% | >115% | ChartMogul 2024, N=2,100 |
| **NRR — Mid-Market ($25K–$100K ACV)** | <95% | 95–108% | 108–120% | >120% | ChartMogul 2024 |
| **NRR — Enterprise (>$100K ACV)** | <100% | 100–118% | 118–130% | >130% | ChartMogul 2024 |
| **NRR — AI-native SaaS (median)** | <40% | 40–65% | 65–85% | >100% | ChartMogul late 2025 [VOLATILE] |
| **NPS — B2B SaaS** | <20 | 20–36 | 36–55 | >60 | CustomerGauge 2025; Merren CX 2026 |
| **CSAT — B2B SaaS support** | <70% | 70–78% | 78–88% | >88% | SurveySparrow / Retently 2026 |
| **B2B SaaS activation rate (Day-30)** | <15% | 15–38% | 38–50% | >50% | Perspective AI 2026 |
| **Time-to-first-value — SMB/PLG** | >60 min | 15–60 min | 5–15 min | <5 min | digitalapplied.com 2026 |
| **Day-7 return rate (cohort floor)** | <3% | 3–7% | 7–12% | >12% | productgrowth.in 2026 |
| **Support deflection rate — AI/self-service** | <25% | 25–41% | 41–59% | >60% | Zendesk/Salesforce agg. 2026; Forrester 89-enterprise study |
| **Churn-risk detection lead time (automated)** | <14 days | 14–30 days | 30–63 days | >63 days | RethinKCX 2026 (manual avg 11 days; automated avg 63 days) |
| **Save rate (engineered action layer)** | <15% | 15–30% | 30–45% | >45% | onboard-success.com 2026 |

---

## Decision triggers

| Condition | Trigger |
|---|---|
| Account NRR < 100% for 2 consecutive quarters | Flag for expansion playbook + executive sponsor engagement |
| Health score drops >20 pts in 30 days | CSM outreach within 24h (enterprise) / 72h (SMB) |
| Day-7 activation cohort < 3% | Onboarding audit — identify aha-moment gap |
| Involuntary churn share > 40% | Dunning sequence audit; payment-retry before cancellation path |
| NPS delta < −10 vs prior quarter | Trigger closed-loop survey follow-up + root-cause sprint |
| TTV > 60 min for PLG/SMB | Redesign onboarding critical path to compress to <15 min |
| Save rate < 15% on at-risk pool | Action-layer audit — confirm playbooks are wired to churn scores |
| Deflection rate < 25% on tier-1 tickets | Self-service / knowledge-base coverage gap; audit top ticket categories |
| CSM "evaluating options" signal on call | Escalation playbook: 4–6× baseline churn probability within 90 days |

---

## Sources

- **Recurly Churn Report 2025** — B2B median annual churn 3.5% (2.6% voluntary, 0.8% involuntary); https://recurly.com/research/churn-report/
- **ChartMogul SaaS Benchmarks 2024** (N=2,100 venture-backed) — NRR by ACV tier; AI-native NRR ~48% late 2025; https://chartmogul.com/reports/saas-benchmarks/
- **Optifai B2B SaaS Churn by Segment** (939 companies) — churn bands by ACV; https://optif.ai/learn/questions/b2b-saas-churn-rate-benchmark/
- **CustomerGauge NPS Benchmarks 2025** — SaaS median NPS 30–36; https://customergauge.com/benchmarks/blog/nps-saas-net-promoter-score-benchmarks
- **Merren CX / SurveySparrow / Retently 2026** — SaaS NPS 40–55 good band; CSAT 78–80% target; https://merren.io/what-is-a-good-net-promoter-score/
- **Perspective AI Onboarding Benchmark 2026** — B2B SaaS activation 38% median; https://getperspective.ai/blog/2026-customer-onboarding-benchmark-activation-rates-by-industry
- **digitalapplied.com TTV Framework 2026** — TTV by ARR band; <5-min top quartile; https://www.digitalapplied.com/blog/customer-onboarding-time-to-value-2026-saas-metrics-framework
- **Zendesk CX Trends + Salesforce State of Service (aggregated 2026)** — enterprise median deflection 41.2%; top quartile 58.7%
- **Forrester Wave AI Support 2026** (89 enterprises) — best-in-class deflection 62%; https://servicedeskagents.com/deflection-rates/
- **RethinKCX Churn Prediction 2026** — automated detection 63 days; manual 11 days; save rates 30–45%; https://www.rethinkcx.com/blog/customer-churn-prediction
- **onboard-success.com Churn Signals 2026** — CSM "evaluating options" = 4–6× churn probability; https://www.onboard-success.com/playbooks/churn-signals-2026

---

_As-of 2026-06-28; volatile rows re-research when stale (30-day window)._
_Volatile: annual/monthly churn rates, NRR by ACV tier, AI-native NRR, NPS median, CSAT median, activation rate, deflection rate._
