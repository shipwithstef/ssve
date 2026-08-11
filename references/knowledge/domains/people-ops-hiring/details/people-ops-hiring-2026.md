# People-Ops Hiring 2026 — L3 Detail

> L3 reference for the `people-ops` agent. Read on-demand when a decision requires the "why" behind a band or framework.
> Companion to: `CAPABILITIES.md` (L2 bands + triggers).

---

## 1. Structured Interviewing

**Status: STABLE (framework); some metrics VOLATILE (adoption rates)**

### Why it works
Structured interviews reduce bias effect size from d=0.59 (unstructured) to d=0.23 (structured), according to a PMC/Schmidt meta-analysis replicated in SHRM Labs research (2025). The mechanism is straightforward: discriminatory or irrelevant questions can only arise when interviewers improvise. 53% of job seekers report having received discriminatory or irrelevant questions in unstructured settings (SHRM Labs 2025).

Structured format is 2× more predictive of job performance than unstructured. Combined with diverse panels and blind scoring, bias reduction reaches up to 85%.

### Loop design rules (STABLE)
- **Scorecard first:** define 6–12 success attributes before sourcing opens; split them across interviewers so each interviewer owns ≤2 dimensions.
- **Panel composition:** assign focus areas explicitly — one person owns technical signal, one owns collaboration/culture signal, one owns role-fit (scope, growth). No interviewer should evaluate the same dimension twice without independent scoring.
- **Scoring rubric:** 1–5 scale with behavioural anchors per number. A "3" must mean the same thing to every panelist.
- **Blind debrief:** each interviewer submits a scorecard before the debrief call. The debrief surfaces disagreements (>2-point gap = mandatory rescore review) rather than anchoring to the first speaker.
- **STAR/SBI method:** all behavioural questions elicit a Situation/Task, Action, Result (STAR) or Situation-Behaviour-Impact (SBI) response. Past behaviour predicts future performance; hypothetical questions do not.

### Adoption context (VOLATILE — 30-day window)
Skills-based hiring has reached 70% of organisations as of 2026 (myculture.ai). 87% of employers use skills-based practices at the interview stage. However, only ~2/3 use structured evaluation (scorecards + calibrated rubrics). The gap between "claims to be structured" and "actually blind-scores independently" remains large.

---

## 2. Competency-Based Role Scoping

**Status: STABLE**

Role scoping before sourcing opens is the most consistently skipped step in early-stage hiring — and the leading cause of mis-hires. The framework:

### IC Leveling (minimal viable ladder for startups)

| Level | Label | Scope | Autonomy | Typical years |
|---|---|---|---|---|
| IC1 | Junior | Small, well-defined tasks | Active support required | 0-2 |
| IC2 | Mid | Mid-scope features independently | Works within team | 2-5 |
| IC3 | Senior | Large impactful projects; owns excellence | Leads technical direction in domain | 5-8 |
| IC4 | Staff | Cross-team influence; architectural decisions | Sets standards; multiplies others | 8-12 |
| IC5 | Principal | Company-wide technical strategy | Defines engineering philosophy | 12+ |

Startups below 50 engineers need IC1-IC3 explicitly defined. IC4/IC5 are rare pre-Series B; conflating them with IC3 causes leveling inflation and pay equity issues as the team scales.

### Job architecture discipline
- Write the role *scorecard* (what "great in 12 months" looks like) before the JD.
- Tie each scorecard attribute to an IC level criterion — if you can't do this, the role is under-scoped.
- Re-use level criteria across engineering, product, and design so cross-functional teams can calibrate.

Source: Ravio job levelling guide (2025), Workleap job leveling framework, OpenComp benchmarks.

---

## 3. Compensation Bands — 2026 Benchmarks

**Status: VOLATILE — re-research every 30 days**

### US Startup SWE Base Salary (2026)

| Stage | IC2 (Mid) | IC3 (Senior) | IC4 (Staff) | Source |
|---|---|---|---|---|
| Seed / pre-seed | $115–145K | $145–175K | $175–210K | Wellfound 2026 / Carta H2 2025 [derived] |
| Series A | $130–160K | $160–200K | $200–240K | Wellfound 2026 / levels.fyi Series A filter |
| Series B | $150–180K | $180–220K | $220–265K | Wellfound 2026 [derived] |

> **Flag:** Wellfound median for all SWE across stages = $139K base (2026). Levels.fyi total comp median = $192K (includes equity annualised, skewed toward big-tech reporters). Use Wellfound/Carta for startup-specific banding; use Levels.fyi only for big-tech competitive benchmarking.

**AI/ML premium:** +15–25% on base; equity grant size grew +31% (median initial grant) from Jan 2024 to Feb 2026 per Carta. This premium is real and widening — non-AI engineers have plateaued in salary growth since 2023.

### UK Startup SWE Base (2026, for UK-based operations)
| Stage | P50 |
|---|---|
| Pre-seed / Seed | £62,900 (up 1.6% from 2024) |
| Series A/B | £68,500 (up 2.2% from 2024) |
| Series C+ | £72,500 (up 2.0% from 2024) |

Source: Ravio startup salaries 2026.

### Equity Grant Benchmarks (% of fully diluted equity, FDE)

**Status: VOLATILE — stage, valuation, and board dilution pressure all shift these**

| Stage | IC2 (Mid) | IC3 (Senior) | IC4 (Staff) | Source |
|---|---|---|---|---|
| Seed (first 5 eng) | 0.25–1.0% | 0.5–2.0% | 1.0–3.0% | Index Ventures / Pave 2025 |
| Seed (eng #6-20) | 0.10–0.40% | 0.25–0.75% | 0.50–1.0% | Index Ventures Rewarding Talent |
| Series A | 0.10–0.30% | 0.20–0.50% | 0.40–0.80% | Index Ventures Rewarding Talent |
| Series B | 0.03–0.10% | 0.05–0.20% | 0.10–0.30% | Index Ventures Rewarding Talent |

> Rule of thumb from Pave: founding engineers (#1-3) should be in the 0.5–2.0% range at seed. By Series A, typical IC3 = 0.30–0.50%; boards watch dilution tightly at this stage.
>
> Vesting standard: 4-year cliff, 1-year cliff, monthly thereafter. Accelerator and VC-backed companies sometimes add double-trigger acceleration on change-of-control.

**Equity-for-all trend (VOLATILE):** 58% of UK tech startups now offer equity to all employees (up 16% YoY, 2025). This is the highest rate across all markets surveyed. Grant sizes under scrutiny from boards.

---

## 4. Hiring Funnel Benchmarks

**Status: VOLATILE — market cycle sensitive**

| Stage | Conversion | Source |
|---|---|---|
| Application → phone screen | ~8% | Pin / HrPanda 2026 |
| Screen → interview | ~37% | Pin 2026 |
| Interview → offer | ~47.5% | Pin 2026 |
| Offer acceptance (tech) | ~77% | Ashby 2025 |
| Offer acceptance (overall) | ~84% | SmartRecruiters 2025 |
| Overall apply → hire | ~0.6% | CareerPlug 2025 |

**Outbound vs inbound:** outbound-sourced candidates convert to hires at **5× the rate** of inbound applicants (CareerPlug 2025). For hard-to-fill roles (IC3+, AI/ML), outbound-first is the default playbook.

**Interview volume inflation:** interviews per hire have risen 42% since 2021 (from ~14 to ~20 per hire on average, Ashby 2025). Applications per hire tripled over the same period. Signal quality is not improving proportionally — this is a sourcing quality problem, not a volume problem.

**Time-to-fill (tech sector, US):**
- Startup / small fast-growth: 35–45 days target
- Mid-market: 40–50 days
- Enterprise: 45–65 days
- Tech sector median (SHRM 2025): 48 days — 26% slower than cross-industry median

---

## 5. 30-60-90 Onboarding Framework

**Status: STABLE (framework); retention statistics VOLATILE**

### Why it matters
~30% of new hires in the US depart within 90 days (Enboarder 2025). 70% of new hires decide if a job is "right" within the first month; 29% know in week one. 44 days is the critical influence window. A structured onboarding program produces **82% higher new-hire retention at one year** (Cornerstone 2025).

Cost of failure: $14.9K–$50K per failed first-year hire (SHRM survey range; C-suite median estimate ~$50K).

### Phase structure (STABLE)

**Days 1–30: Learn**
- Goals: understand company products, team structure, existing codebase/systems, cultural norms.
- Mechanics: structured documentation review, shadowing, 1:1 with every team member, first low-risk ticket.
- Manager check-in: end of week 1, end of month 1.
- SMART deliverable: can articulate how the team's work ties to company goals; completed environment setup + first merged PR.

**Days 31–60: Contribute**
- Goals: own a scoped feature or workstream; make mistakes safely; build peer relationships.
- Mechanics: first independent task delivery; feedback loop with manager 2×/week.
- SMART deliverable: completed and shipped a feature or fix with minimal hand-holding.

**Days 61–90: Master**
- Goals: meet full job expectations; start raising the team's bar; identify improvement opportunities.
- Mechanics: participate in design reviews; contribute to team rituals; begin mentoring IC1 if applicable.
- SMART deliverable: consistently meets IC-level output expectations; has proposed ≥1 process improvement.

### Common failure modes
- Expectation mismatch (30.3% of early departures) — fix: align scorecard to 90-day plan during offer stage.
- Cultural disconnection (19.5%) — fix: structured peer introductions + async culture doc in week 1.
- Poor onboarding experience (17.4%) — fix: assign an onboarding buddy (separate from manager); pre-board before day 1.

---

## 6. Headcount vs Runway Planning

**Status: STABLE (framework); headcount-at-stage numbers VOLATILE**

### The model
- Headcount = ~60–80% of total startup opex (Forecastr/Leapsome 2026). Model every new hire as a cash-burn multiplier, not a line item.
- **Hire only when ≥18 months runway remains** post-hire — allows time for the new hire to ramp (~90 days) and reach productivity impact before next fundraise conversation.
- For fundraise timing: begin investor conversations at ~18 months runway to give 6+ months of iteration before funds run dry.

### Stage-gated headcount context (VOLATILE)
- Seed median team (2025): **4 employees** (Carta). Smaller than 2020-2022 — AI tooling absorbs previous headcount.
- Series A median team (2025): **~47 employees** (down from 57 in 2020, SignalFire). Best teams "lean into tooling."
- When to split a team: standups exceed 20 minutes OR missed deadlines attributable to cross-team dependencies. Team of 7±2 is the collaboration ceiling.

### Hiring priority sequencing (STABLE)
At seed: revenue-generating or product-differentiating roles first. The temptation to hire ops/admin/HR prematurely is a common burn accelerant.

At Series A: EPD pods (Engineering + Product + Design co-owning a problem) are the canonical structure. Resist introducing management layers until coordination bottlenecks are observable, not anticipated.

Platform/infra split: Vercel model — designate 2 engineers as "platform owners" spending 50% on shared infra; defer a dedicated platform team until ~30 engineers (SignalFire 2026).

---

## 7. Early-Stage Org Design

**Status: STABLE**

### Principles
- **Flat until friction is measured, not assumed.** GitLab avoided formal team structures until ~50 engineers; added managers only when coordination became a bottleneck (not when headcount crossed an arbitrary threshold).
- **EPD pod model:** each pod (Engineering + Product + Design) owns a problem end-to-end. Eliminates handoff latency; produces higher velocity and ownership.
- **7±2 rule:** teams beyond 9 members show communication overhead spikes and velocity decline. Split before you feel the pain.
- **Remote/hybrid is the baseline (2026).** Startups that do not offer genuine flexibility lose competitive position in the talent market. This is not a perk — it is a table-stakes expectation.

### Failure modes at each stage
| Stage | Common trap | Mitigation |
|---|---|---|
| 0-10 | Hiring generalists when you need depth | Define IC3+ for the 1-2 most critical technical bets |
| 10-30 | Adding managers before coordination breaks | Observe, don't anticipate; use async + docs first |
| 30-50 | Premature functional silos | Keep EPD co-location; resist siloing eng/product |
| 50+ | No leveling framework → pay inequity | Publish IC1-IC5 ladder before you hit 40 people |

---

## Re-research Checklist (30-day window)

When this document is stale, re-research in this order:

1. **Carta latest State of Startup Compensation** (carta.com/data/) — salary and equity by stage
2. **Wellfound Hiring Data** (wellfound.com/hiring-data) — startup-specific base salary
3. **Levels.fyi annual/end-of-year report** — total comp context
4. **Ashby Talent Trends Report** — offer acceptance, interview-to-offer rates
5. **SHRM Benchmarking** (or Mitratech/SmartRecruiters citing it) — time-to-fill, cost-per-hire
6. **Index Ventures Rewarding Talent** (indexventures.com/rewarding-talent) — equity grant % by stage

Rows to re-verify first (highest drift rate): AI/ML premium, equity grant sizes, offer acceptance rate, time-to-fill.

---

_Last researched: 2026-06-28. Re-research window: 30 days (next due: 2026-07-28)._
