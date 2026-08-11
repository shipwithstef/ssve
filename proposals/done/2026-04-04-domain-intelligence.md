# Proposal: Domain Intelligence Pipeline

> What svc uniquely needs and nobody else has.

## The Gap

When a user says "build me X", svc currently jumps from vision to spec with no domain grounding. The agent uses training data (stale), the user's prompt (sparse), and codebase analysis (brownfield only). For greenfield work, there's no:

- Understanding of what top competitors do
- Domain expertise for the specific tech stack/industry
- External skill discovery for capabilities we lack
- Market intelligence to inform the bet

This is the gap between "what should we build?" (validate-feature) and "how should we build it?" (write-spec). We need a "what does the world know?" step.

## What Exists Today

### coreyhaines (external, optional)
- `customer-research` — Reddit/G2/forums/reviews for user pain points
- `market-competitors` — competitive landscape mapping
- `competitor-alternatives` — "vs" pages for SEO/positioning

These are marketing-focused (output goes to copywriting/CRO). Not product-intelligence focused.

### gstack
- `/office-hours` Phase 2.75 "Landscape Awareness" — WebSearch for conventional wisdom, 3-layer synthesis (what everyone knows → what discourse says → what we think is wrong)
- No competitor analysis skill
- No domain expert skill

### obra/superpowers
- `brainstorming` explores approaches but doesn't research the market
- No external research capability
- No domain expertise concept

### svc (current)
- `research` skill (just built) — on-demand research for APIs/libraries/patterns
- `references/domains/` — persistent domain knowledge packs
- `validate-feature` — 8 business questions, but no market research step
- `analyze-marketing` — mines specs for marketing, doesn't do market research

## What We Need (3 new capabilities)

### 1. `analyze-domain` — Top-Level Skill

Identifies and builds domain expertise for the project. Runs early (after write-vision, can be invoked anytime).

**Two modes:**

**Identify mode** (runs during write-vision or first invocation):
- Reads vision.md → extracts the industry, tech stack, and domain
- Checks `references/domains/` for existing packs
- If pack exists: load it, report "domain expertise available for [X]"
- If pack doesn't exist: create one from internal knowledge + research
- Output: `docs/specs/domain-profile.md` with industry, competitors, conventions, risks

**Research mode** (invoked by other skills when uncertain):
- Accepts a question from calling skill
- Searches: internal knowledge first → WebSearch → `npx skills find` for external skills
- If a useful external skill is found: recommend installation via `npx skills add`
- Logs finding to `docs/specs/research-log.md` AND updates domain profile if broadly applicable
- Returns finding to caller

### 2. `analyze-competitors` — Top-Level Skill

Systematic analysis of top competitors in the domain. Not marketing copy — product intelligence.

**Process:**
1. Read `docs/specs/domain-profile.md` for industry context
2. WebSearch for top 5 companies in the space
3. For each competitor:
   - What do they do? (core product, key features)
   - What's their approach? (tech, UX, business model)
   - What do users love? (reviews, social sentiment)
   - What do users hate? (complaints, gaps)
   - What's their differentiator?
4. Synthesize: where is the whitespace? What can we do that they can't/won't?
5. Output: `docs/specs/analyze-competitors.md`

**Feeds into:**
- `validate-feature` Q4 (What's the bet?) — the competitive whitespace IS the bet
- `write-spec` — ACs informed by what competitors miss
- `design-ux` — UX decisions informed by competitor patterns
- `analyze-marketing` — competitive positioning context

### 3. `discover-skills` — Utility Skill (wraps `npx skills find`)

When svc encounters a capability it lacks:
1. Search the skill marketplace: `npx skills find [query]`
2. Present options with descriptions
3. If user approves: `npx skills add [package]`
4. If skill is domain-specific: save to `references/domains/` as a reference pack
5. Log the discovery to `docs/specs/research-log.md`

This is triggered by `analyze-domain` or `research` when they find a gap that an external skill could fill.

## Pipeline Integration

```
write-vision
    │
    ├── analyze-domain (identify mode) ← NEW: runs during or after vision
    │     └── Creates docs/specs/domain-profile.md
    │     └── Creates/loads references/domains/<stack>/
    │     └── May invoke discover-skills for external capabilities
    │
    ├── analyze-competitors ← NEW: runs after analyze-domain
    │     └── Creates docs/specs/analyze-competitors.md
    │     └── Feeds into validate-feature Q4 (the bet)
    │
    ▼
build-personas (reads domain-profile for industry context)
    │
    ▼
validate-feature (reads analyze-competitors for Q4, domain-profile for expertise)
    │
    ... rest of pipeline ...
```

### Greenfield vs Brownfield

**Greenfield:** analyze-domain + analyze-competitors are critical. Without them, the agent has no external context — only the user's prompt and training data. The competitor analysis tells you what the market does; the domain expert tells you how the stack works.

**Brownfield:** analyze-domain reads the existing codebase to derive the domain profile (framework, conventions, patterns). analyze-competitors is optional — the product already exists, the market is partially known. But it can reveal gaps: "your competitors all have X and you don't."

## What Makes This Unique to Serious Vibe Coding

No other framework has this:
- **gstack** has landscape awareness in office-hours, but it's one-shot during brainstorming — not a persistent domain profile that grows
- **obra** has no external research
- **coreyhaines** has competitor analysis but marketing-focused, not product-intelligence

svc's version:
1. **Persistent** — domain-profile.md and analyze-competitors.md live in the repo, evolve over time
2. **Feeds the pipeline** — domain knowledge informs every phase (spec ACs, UX decisions, tech choices)
3. **Self-extending** — discover-skills discovers and installs new capabilities as needed
4. **Auto-mode aware** — in auto mode, analyze-domain answers its own questions; in guided mode, presents recommendations

## Implementation Order

1. `analyze-domain/SKILL.md` — create skill, add to manifest
2. `analyze-competitors/SKILL.md` — create skill, add to manifest
3. Update `write-vision` to invoke analyze-domain at the end
4. Update `validate-feature` to read domain-profile.md and analyze-competitors.md
5. Update lane definitions to include new skills
6. `discover-skills` as utility (wraps `npx skills find`)
7. Eval: run S1 scenario with domain intelligence → measure improvement vs comparison-v1

## Research Needed Before Building

- [ ] Check if `npx skills find` actually works and what it returns
- [ ] Find 5 top-performing AI learning recommendation apps (for S1 scenario validation)
- [ ] Check if coreyhaines `customer-research` and `market-competitors` can be adapted vs building from scratch
- [ ] Determine if analyze-domain should be mandatory or optional in progressive chains
