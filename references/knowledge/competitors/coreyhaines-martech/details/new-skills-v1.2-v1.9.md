# New Skills v1.2–v1.9 — Detail

## Mechanism (factual)

18 skills added across 8 releases (v1.2.0 through v1.9.0). Each skill is a standalone SKILL.md with YAML frontmatter (name, description, metadata.version) plus workflow sections and optional references/ directory.

**Release cadence:**
- v1.2.0 (Feb 19): 4 skills — ai-seo, churn-prevention, ad-creative, cold-email
- v1.3.0 (Mar 2): 3 skills — site-architecture, revops, sales-enablement
- v1.4.0 (Mar 14): 1 skill — lead-magnets
- v1.5.0 (Mar 28): 1 skill — customer-research
- v1.6.0 (Apr 6): 1 skill — community-marketing
- v1.7.0 (Apr 13): 1 skill — aso-audit
- v1.8.0 (Apr 21): 2 skills — directory-submissions, competitor-profiling
- v1.9.0 (Apr 24): 2 skills — image, video

**Pattern:** All skills follow same structure — "Before Starting" (check product-marketing-context), workflow phases, references. Newer skills (v1.7+) are community-contributed (PRs from @basseko, @pangerlkr, @GonsalvesMedia, @njcameron).

**Reference density:** Skills with most references: aso-audit (5), cold-email (5), social-content (5), paid-ads (4), revops (4), sales-enablement (4).

## Analysis (expert commentary)

- **Useful for:** Understanding what marketing capabilities were added and when. The v1.2 batch is the "core marketing stack" (SEO, retention, ads, outreach). v1.3+ adds operational skills (revops, sales-enablement). v1.5+ adds research/intelligence (customer-research, competitor-profiling). v1.9 adds visual content (image, video).
- **Trade-offs:** Community-contributed skills (v1.7+) lack evals — 7 of 18 new skills have no automated quality testing. This is a coverage gap.
- **Similar to:** svc's own skill creation pattern but simpler — no review gates, no lane positioning, no progressive narrowing. Pure standalone skills with cross-references.
- **Could improve svc by:** The "Before Starting" pattern (check context file first) is cleaner than svc's scattered context loading. Could consolidate svc's multiple context sources.
- **Assumptions:** Skills assume user has API keys for tools. No graceful degradation if keys missing — just suggests setup.
- **Watch out for:** `customer-research` Mode 2 (digital watering holes) does live web scraping — same untrusted content risk as svc's research skill. No `<untrusted_content>` fencing in coreyhaines skills.

## Key Source Files (L4 pointers)

- `skills/customer-research/SKILL.md` — Full JTBD extraction + digital watering holes pattern
- `skills/image/SKILL.md` — AI generation tool matrix (Gemini, Flux, Ideogram, GPT Image)
- `skills/video/SKILL.md` — Programmatic vs AI generation vs AI avatar decision matrix
- `skills/directory-submissions/SKILL.md` — Three hard rules + AI citation optimization (6-27× conversion claim)
- `skills/aso-audit/SKILL.md` — App Store vs Google Play field extraction pattern
- `skills/community-marketing/SKILL.md` — Community strategy principles + platform selection
- `skills/competitor-profiling/SKILL.md` — Raw data persistence + structured comparison pattern
