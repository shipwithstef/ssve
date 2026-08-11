# Skill Improvements — Detail

## Mechanism (factual)

Enhancements to existing skills across v1.2–v1.9. Two types: (1) new sections added to SKILL.md workflow, (2) new reference files added to references/ directory.

**Major enhancements by skill:**

| Skill | Version | Enhancement | Type |
|-------|---------|-------------|------|
| social-content | v1.3.0 | Short-form video section (TikTok, Reels, Shorts) | New workflow section |
| social-content | v1.6.0 | Content repurposing (podcast/video/webinar → atoms) | New workflow section |
| social-content | v1.6.0 | Platform limits reference (8 platforms) | New reference file |
| seo-audit | v1.8.0 | International SEO (hreflang, canonicalization) | New reference section |
| paid-ads | v1.8.0 | Conversion tracking (Google, Meta, LinkedIn, TikTok pixels) | New reference file |
| copy-editing | v1.6.0 | Expert panel scoring (multi-persona review) | New workflow section |
| copy-editing | v1.6.0 | Content refresh editing framework | New workflow section |
| ab-test-setup | v1.6.0 | Growth Experimentation Program (ICE scoring, velocity) | New workflow section |
| ai-seo | v1.6.0 | Pricing.md recommendation for AI agents | New guidance |

**Cross-cutting improvements (all skills):**
- v1.1.0: Progressive disclosure optimization (core first, references on demand)
- v1.4.0: Description optimization for trigger phrase matching
- v1.4.0: Reasoning-based guidance replaces rigid imperatives
- v1.4.0: 197 evals added across 33 skills
- v1.3.0: `.agents/` directory migration (from `.claude/`)

## Analysis (expert commentary)

- **Useful for:** The social-content short-form video section is high-value — TikTok/Reels/Shorts are primary distribution channels now. The conversion tracking reference in paid-ads is practical (pixel setup is always confusing).
- **Trade-offs:** The "reasoning-based guidance" shift (v1.4.0) is interesting — moves from "do X" to "here's why X matters, decide what to do." More flexible but potentially less deterministic. svc's imperative style is more predictable.
- **Similar to:** The expert panel scoring in copy-editing is like svc's review-gate pattern but applied to marketing copy instead of code. Multi-perspective review before finalization.
- **Could improve svc by:** The "Before Starting → check product-marketing-context" pattern could be adopted by svc skills that need project context. Currently svc skills check multiple locations inconsistently.
- **Assumptions:** Enhancements assume users are on latest skill version. No version migration path — if user has v1.1.0 installed, they don't get v1.6.0 enhancements automatically.
- **Watch out for:** The eval coverage gap (7 newer skills lack evals) means quality isn't verified for the newest additions.

## Key Source Files (L4 pointers)

- `skills/social-content/SKILL.md` — Short-form video section + platform limits integration
- `skills/copy-editing/SKILL.md` — Expert panel scoring + content refresh frameworks
- `skills/ab-test-setup/SKILL.md` — Growth Experimentation Program with ICE scoring
- `skills/seo-audit/references/` — International SEO section (hreflang patterns)
- `skills/paid-ads/references/` — Conversion tracking reference (pixel setup)
