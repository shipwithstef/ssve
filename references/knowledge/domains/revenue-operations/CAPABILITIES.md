> **L2 Current-Awareness Bank — `revops` Agent**
> Read via `expertise.mjs` preload at agent run-start. Currency = domain (30-day window).
> Authoritative benchmark numbers live HERE — do not duplicate into prompts.
> Volatile rows are flagged; re-research when stale (>30 days from as-of date).

---

## Core frameworks

- **Pipeline-Coverage Math** — target coverage = 1 ÷ win_rate (not the flat "3x" heuristic); segment by ACV tier
- **Pipeline Velocity** — `(# opps × avg deal value × win rate) / sales cycle days`; single best forecast predictor
- **Outbound Sequence Ladder** — 4-7 touch cadence, multi-channel, under-80-word emails, 3-7 day gaps
- **Domain Warmup Protocol** — 4-6 week ramp from 5-10 → full volume; SPF+DKIM+DMARC+RFC-8058 hard gate
- **Intent-Signal Activation** — six signal classes (behavioral, intent, firmographic, technographic, first-party, deal-level) routed to CRM, sequence triggers, or ABM ad audiences
- **Deal-Desk Parallel-Track** — run legal/security review concurrently while champion sells internally; target Negotiation→Close ≤ 35% of cycle

---

## Benchmark bands / thresholds

| Metric | Floor | Median | Top-quartile | Notes | Volatile? |
|---|---|---|---|---|---|
| Cold email reply rate (all senders) | 1% | 3.43% | 10.7%+ | Instantly 2026 Benchmark Report; dropped from 5% avg in 2025 | YES |
| Cold email reply rate — targeted (<50 recipients) | — | 5.8% | 18%+ (signal-specific personalization) | Instantly 2026 / Autobound 2026 | YES |
| Cold email reply rate — large-blast (>500) | — | 2.1% | — | Instantly 2026 | YES |
| Bounce rate hard stop | — | — | <2% | Google/Yahoo enforcement; >3% = data problem; >5% = stop send | STABLE |
| Spam complaint rate ceiling | — | — | <0.10% | Google enforces at 0.3%; stay under 0.1% for headroom | STABLE |
| US B2B email list decay | — | 25-30%/yr | — | [unverified exact %, framework widely cited] | YES |
| Domain warmup ramp | — | 4-6 weeks | — | Start 5-10/day, increase ~20%/week | STABLE |
| Daily SDR dials (median) | — | 44 | — | Bridge Group 2025 | YES |
| Daily SDR emails (median) | — | 41 | — | Bridge Group 2025 | YES |
| Daily quality conversations (median) | — | 4.1 | — | Bridge Group 2025 | YES |
| SDR meetings booked quota (gross/month) | 10 | 15 | 20+ | Net ~12 after 20% no-show | YES |
| SDR pipeline generated (median/year) | $750K | $3M | $10M+ | Bridge Group 2025 | YES |
| SDR quota attainment | — | 57-70% | — | Prospeo 2026; BDRs avg 88% of quota | YES |
| B2B median win rate (2024) | — | 19% | — | Ebsta × Pavilion 2025; down from 23% in 2022 | YES |
| Win rate by ACV — <$10K | — | 28-35% | — | Optifai 2025 | YES |
| Win rate by ACV — $10K-$50K | — | 20-28% | — | Optifai 2025 | YES |
| Win rate by ACV — $50K-$100K | — | 15-22% | — | Optifai 2025 | YES |
| Win rate by ACV — >$100K | — | 12-18% | — | Optifai 2025 | YES |
| Pipeline coverage — SMB (40-50% win rate) | — | 2-2.5x | — | Outreach.ai / Fullcast 2025 | YES |
| Pipeline coverage — Enterprise (18-25% win rate) | — | 4-5x | — | Outreach.ai / ORM Tech 2025 | YES |
| Median B2B SaaS sales cycle | — | 84 days | — | GrowthSpree 2026; lengthened 22% since 2022 | YES |
| Sales cycle — SMB (<$15K ACV) | — | 14-30 days | — | HumanR 2025 | YES |
| Sales cycle — Mid-Market ($15K-$100K) | — | 30-90 days | — | HumanR 2025 | YES |
| Sales cycle — Enterprise (>$100K) | — | 90-180+ days | — | HumanR 2025 | YES |
| Forecast accuracy — orgs missing >10% | — | 79% | — | Forrester (cited by Tellius 2026) | YES |
| Forecast accuracy — with weekly velocity tracking | — | 87% | — | vs 52% irregular; Landbase 2026 | YES |
| Show rate target (booked → attended) | — | ≥80% | — | Prospeo / Gradient.works | STABLE |
| Meeting-to-opportunity conversion target | — | ≥50% | — | Gradient.works 2025 | YES |
| Intent signal early-shortlist window | — | — | Day 1 | 6sense 2025: 95% of winners on Day-1 shortlist | STABLE |
| Negotiation→Close share of cycle (Enterprise) | — | 35-40% | — | B2B SaaS Funnel Benchmarks 2025 | YES |

---

## Decision triggers

| Condition | Action |
|---|---|
| Cold email reply rate < 2% | Audit ICP fit, subject line, and list data quality first; check deliverability second |
| Bounce rate > 3% | Halt sends; run list through verification (ZeroBounce / NeverBounce) before resuming |
| Spam complaint rate approaching 0.2% | Immediately throttle volume; investigate sending domain reputation |
| Pipeline coverage below 1 ÷ win_rate | Flag to RevOps; trigger demand-gen or outbound blitz by segment |
| Win rate drop >2 pts quarter-over-quarter | Run deal-loss analysis; check cycle length drift and competitive intel |
| SDR quota attainment < 50% | Diagnose: data quality, ICP drift, or ramp time before changing quota |
| Sales cycle lengthened >15% | Audit deal-desk process; check multi-stakeholder thread depth |
| Intent spike detected on target account | Trigger priority sequence within 24h; alert AE for multi-thread play |
| Deal in Negotiation→Close > 40% of elapsed cycle | Engage deal desk; parallel-track legal; escalate to exec sponsor |
| Forecast off >10% two quarters running | Rebuild pipeline methodology; add deal-inspection layer (Gong/Clari) |

---

## Sources

- **Instantly.ai Cold Email Benchmark Report 2026** — reply rates, sequence length, deliverability thresholds
- **Bridge Group SDR/BDR Report 2025** — daily activity medians, pipeline per rep, attainment data
- **Ebsta × Pavilion B2B Sales Performance Report 2025** — win rate 19% median, cycle length drift
- **Gradient.works 2025 B2B Sales Performance Benchmarks** — conversion rates, show rates
- **Outreach.ai Pipeline Coverage Guide 2025** — coverage ratio formula and segment bands
- **Forrester Wave: Intent Data Providers B2B Q1 2025** — ZoomInfo Leader; intent platform ranking
- **6sense 2025 B2B Buyer Experience Report** — 95% Day-1 shortlist stat
- **Optifai B2B SaaS Win Rate by Deal Size (939 companies, 2025)** — ACV-tiered win rates
- **GrowthSpree B2B SaaS Sales Cycle Benchmarks 2026** — median 84 days, cycle lengthening
- **Google Email Sender Guidelines (enforced May 2025)** — spam complaint 0.3% ceiling, RFC 8058
- **Tellius / ORM Tech RevOps KPI Dashboard 2026** — velocity formula, forecast accuracy bands
- **Apollo.io GTM Platform Launch Oct 2025** — agentic signal-to-sequence activation
- **Demandbase Agentbase Launch Mar 2025** — AI-driven intent orchestration

_As-of 2026-06-28; volatile rows re-research when stale._
