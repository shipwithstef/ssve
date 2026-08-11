# SaaS startup finance benchmarks — detail (L3, as-of 2026-03-01)

The "why" behind each band in `../CAPABILITIES.md`. **Volatile rows are flagged** — those are the ones
the `re-verify annually` note in the agent prompt could never enforce; the `.version`/currency window does.

## Burn multiple (the 2024–2026 dominant lens)
`net burn ÷ net-new ARR` — dollars burned per dollar of new recurring revenue. Sacks' bands: <1 amazing,
1–1.5 great, 1.5–2 good, 2–3 suspect, >3 bad. Replaced "growth at all costs" as the efficiency frame after
the 2022–2023 correction. **Stable** (a framework, not a market median).

## Default-alive (the survival gate)
Graham's test: with current cash + expenses flat, does current growth rate reach profitability before cash
runs out? If no → default-dead → must cut burn or raise NOW. Pairs with the runway-to-zero DATE. **Stable.**

## The VOLATILE medians (re-verify each cycle — this is why the bank has a currency window)
- **NRR median ~101%** (best 120%+) — moves with the macro/retention environment; was higher in 2021.
- **ARR growth median ~25% YoY** (private SaaS, 2025) — has compressed materially since 2021's ~50%+. **Volatile.**
- **CAC payback** SMB 8–12 / mid 14–18 / ent 18–24 mo — drifts with CAC inflation + funnel efficiency. **Volatile.**
- **Gross margin median ~77%** — slower-moving but shifts with COGS/AI-infra costs. **Semi-volatile.**

## Stable frameworks (rarely move)
- LTV:CAC ≥3:1 (with payback) · Magic number >0.75 · Rule of 40 · "raise at 12–14 mo, never <6".

## Re-research protocol
When `.version` is >30 days old (currency: domain), re-pull the volatile medians from the current Bessemer /
ICONIQ / OpenView / KeyBanc cycle, update the bands + bump `.version`. The stable frameworks need no refresh.
This file is the L3 the agent reads only when it needs the "why"; the bands themselves live in CAPABILITIES.md (L2).
