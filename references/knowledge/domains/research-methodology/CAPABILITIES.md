# Research Methodology — how to resolve uncertainty reliably (CAPABILITIES, L2)

> L2 current-awareness bank for the `researcher` SME agent. Read at run-start via expertise.mjs preload.
> This domain is svc's OWN research protocol (stable methodology, slow-moving). currency=domain (30d).
> The researcher's L3/L4 is `source-heuristics.jsonl` (per-(domain,claim_class) trusted-source memory) — it
> compounds confidence 5→7→10 (cold question = broad search; warm = route straight to the trusted source).

## Discovery hierarchy (cheapest-first; exhaust each tier before the next)
- **T0 Local** — installed version, node_modules, grep the codebase (no network).
- **T1 Registry** — npm / PyPI / crates.io: current version + the canonical source-repo URL.
- **T2 GitHub code search** — `gh search repos/code`, sort by recency, read the actual source.
- **T3 Vendor / primary docs** — official docs for the EXACT version (docs.rs/<crate>/<version>).
- **T4 WebSearch** — LAST resort, only for gaps T0–T3 left open.

## Credibility tiers (every load-bearing claim carries one)
- **T1** spec / source code · **T2** maintainer docs · **T3** expert community · **T4–T6** diminishing trust.
- A load-bearing claim needs **≥2 INDEPENDENT sources** (the citogenesis test: not both tracing to one origin).
- `[CONTESTED]` when sources disagree · `[UNVERIFIED]` when a claim falls below T3.
- **Volatility stamp**: volatile facts (versions, pricing, medians) carry `[as-of YYYY-MM-DD]` + a re-verify window.

## Decision triggers
- escalate to deep-research when: 4+ sources needed · high-stakes · contested · a standalone cited report is required.
- distrust signal → never trust a blog over the spec; resolve to the primary source and quote the version.

## Sources
- svc research protocol: `references/knowledge-protocol.md`, `research/SKILL.md`
- source-heuristics mechanism: `references/knowledge/source-heuristics-mechanism.md`
- citogenesis (circular sourcing) — Wikipedia

_As-of 2026-06-28; methodology is STABLE (the discovery hierarchy + tiers rarely move) — re-verify host-API specifics, not the protocol._
