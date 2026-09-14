# Landing Reference Bank

Curated corpus of 2026-relevant landing-page patterns for benchmark-grading svc design-ui output against what actually ships in the wild.

**Purpose:** close framework gap F-001 from `proposals/2026-04-20-evolution-design-benchmark-gate.md`. Before this bank existed, `design-ui` was instructed to "run a web search for 5-10 products" per invocation — ad-hoc, uncached, per-project, never curated. Design decisions happened in reference-vacuum.

## Directory shape

```
references/landing-bank/
├── README.md                              (this file)
├── <sector>/
│   ├── README.md                          (sector pattern summary)
│   ├── <product>/
│   │   ├── hero.png                       (optional — PNG capture if fetchable)
│   │   ├── pattern.md                     (required — structured pattern analysis)
│   │   └── metadata.json                  (required — year, persona, sector, source URL)
```

## Current sectors

| Sector | Target persona | Sample count |
|---|---|---|
| `local-business-saas` | Solo owners (cafés, restaurants, salons, retail) | 5 starter (target 10) |

Add more sectors as WIs demand them — only build a bank when a concrete project is going to consume it.

## Sample metadata schema (`metadata.json`)

```json
{
  "product": "Linear",
  "url": "https://linear.app",
  "year": 2026,
  "captured": "2026-04-20",
  "sector": "dev-tools",
  "persona": "indie engineers + small teams",
  "tier": "indie-premium",
  "pattern_tags": ["live-demo-embed", "minimal-hero", "dark-aesthetic", "motion-sparse"]
}
```

## Sample pattern schema (`pattern.md`)

Each sample is analyzed along 8 dimensions (the same dimensions `benchmark-landing` scores outputs against):

1. **Hero layout** — single-column / dual-column / full-bleed / embedded-card
2. **Primary element count in hero** — what's visible in first 5 seconds
3. **Text hierarchy ratio** — headline : subhead : body weights
4. **Motion count** — distinct animated surfaces simultaneously
5. **Illustration craft tier** — photography / bespoke-illustration / flat-svg / screenshot / live-ui
6. **Viewport behavior** — how it reflows (not just scales) at mobile
7. **First-5-sec comprehension** — what a cold visitor understands immediately
8. **Density per viewport area** — elements per 100k px²

## Usage

- `design-ui` skill ingests the sector bank as a REQUIRED input (see `design-ui/SKILL.md:4-10`)
- `benchmark-landing` skill scores the candidate output against the bank median per dimension, emits 1-10 score, blocks promotion below 7 without override

## How to add a sample

1. Identify a shipped page in the target sector that's at the market bar (≥ 8/10 subjective)
2. Capture or reference: `curl -s <url>` for text, browser screenshot for image
3. Create `<sector>/<product>/pattern.md` and `<sector>/<product>/metadata.json` per schemas above
4. Verify: structured analysis not vibes — element counts must be numeric, hierarchy ratios measurable

## Stewardship

- Samples go stale fast (indie SaaS sites re-design every 6-12 months)
- Re-evaluate any sample older than 6 months; mark `deprecated: true` in metadata if it regressed
- Prefer capture over link-only: URLs rot, screenshots at a point-in-time don't

## Scope guardrail

This bank is NOT a "design inspiration gallery." It's a measurement reference. Every sample answers: *"is our output at this bar on each measurable dimension?"* Aspirational / off-sector / unusable samples get rejected. 10 excellent samples > 100 mediocre ones.
