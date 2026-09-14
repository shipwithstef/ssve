# Startup SaaS Finance — benchmarks + survival logic (CAPABILITIES, L2)

> Domain knowledge bank for the `financial-analyst` SME agent (the **current-awareness layer**, L2).
> The agent reads this at run-start via `scripts/expertise.mjs preload`. `.version` = 2026-03-01;
> currency class = `domain` (30-day window) — so this stamps **STALE** if not re-researched. STALE bands
> are advisory; the framework's refresh-scan re-researches them. Authoritative numbers live here, NOT frozen in the prompt.

## Survival core (the highest-signal pass, every run)
- **Runway-to-zero DATE** = months of cash ÷ current net burn. The number that matters before the founder feels the squeeze.
- **Default-alive vs default-dead** (Graham): on cash in bank with expenses flat, does current growth reach profitability? Must be **YES by ~month 9 of a raise**.
- **2024–2026 frame: efficiency, not raw growth.** Every ratio is paired with payback or it lies.

## Benchmark bands (grade each metric against these)
| Metric | Healthy / target band |
|---|---|
| Runway | ≥18–24 mo post-raise; **start raising at 12–14 mo left**, never <6 |
| Burn multiple (net burn ÷ net-new ARR) | **<1 amazing · 1–1.5 great · 1.5–2 good · 2–3 suspect · >3 bad** (Sacks); YC: <2 pre-DemoDay, <1.5 pre-A |
| Gross margin (SaaS) | **75–80%+** (median ~77%) |
| LTV:CAC | **≥3:1** min; 4–6:1 top quartile; <3 = leaky — ALWAYS quote with payback |
| CAC payback | **<12 mo** best-in-class (SMB 8–12, mid 14–18, ent 18–24); >24 = red flag |
| ARR growth | private-SaaS median ~25% YoY (2025); early-stage should far exceed |
| NRR / GRR | **NRR ≥100–110%** (median 101%, best 120%+); **GRR ≥85% SMB / ≥90% ent** |
| Magic number | **>0.75 invest harder · >1.0 strong · <0.5 fix funnel** |
| Rule of 40 | growth% + profit/FCF margin% **≥40%** |

## Decision triggers (emit a card when crossed)
- spend cuts: burn multiple >2 OR runway <12 mo
- pricing/packaging change: NRR <100% OR CAC payback >18 mo
- when-to-raise: arm at 12–14 mo runway, size to 18–24 mo + a clear next-milestone story; raising <6 mo → ~40% slower close, worse terms
- free-tier/trial cliff: gate when payback or gross margin breaks on free users

## Sources (for grounding + re-research)
- David Sacks — burn multiple framework (craft.co / "The Burn Multiple")
- Paul Graham — "Default Alive or Default Dead?" (paulgraham.com)
- Bessemer / ICONIQ / OpenView annual SaaS benchmark reports (the volatile medians: NRR, ARR growth, CAC payback — re-verify each cycle)
- a16z / KeyBanc SaaS survey (gross margin, Rule of 40, magic number)

_Detail + the "why" behind each band: `details/saas-benchmarks-2026.md`. As-of 2026-03-01; the medians are the volatile rows — re-research when stale._
