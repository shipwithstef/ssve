# Corey Haines Marketing Skills — CAPABILITIES

**Source:** [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills)
**Version:** v2.6.0 (July 1, 2026) — tag commit `2815104d`
**Stars:** 38.2k | **Forks:** 4k+
**License:** MIT
**Main branch note (2026-07-13):** main (`0ba2a7fa`) is ahead of the v2.6.0 tag — unreleased `marketing-council` skill (simulated advisor board: Godin/Ogilvy/Schwartz/Dunford/Hormozi personas with grounding rules) and `ad-creative` 2.5.0→2.7.0 (iOS-native reveal surfaces, creative strategy loop + hook system, shareable creative review page). Watch for a v2.7.0 release.

## Overview

Marketing-focused skill ecosystem for AI agents (Claude Code, Codex, Cursor, Windsurf). 46 skills, 65 CLI tools, 93 integration guides at v2.6.0. Built by Corey Haines (Conversion Factory agency, Swipe Files newsletter). **v2.0.0 (2026-05-05) was a breaking release: 17 skill renames + page-cro/form-cro consolidated into `cro` — installed copies must be reinstalled and cross-references migrated.**

## Skill Categories (46 at v2.6.0)

### Conversion Optimization (6)
| Skill | Description |
|-------|-------------|
| `cro` | Page conversion optimization (absorbed `page-cro` + `form-cro` → `references/form.md`) |
| `signup` | Registration and trial activation flows (was `signup-flow-cro`) |
| `onboarding` | Post-signup activation and time-to-value (was `onboarding-cro`) |
| `popups` | Modals, overlays, slide-ins, banners (was `popup-cro`) |
| `paywalls` | In-app upgrade moments and feature gates (was `paywall-upgrade-cro`) |
| `offers` | **NEW v2.5.0** — offer design: Value Equation (Hormozi), 6-component anatomy (deliverable, bonus stack, guarantee, scarcity, name, price structure), 8 guarantee types, honest-scarcity formats |

### Content & Copy (7)
| Skill | Description |
|-------|-------------|
| `copywriting` | Marketing page copy using proven frameworks |
| `copy-editing` | Edit/polish existing copy, expert panel scoring |
| `cold-email` | B2B cold outreach sequences |
| `emails` | Automated email flows (was `email-sequence`) |
| `social` | Social content + short-form video + **NEW v2.4.0** social-listening engagement triage (`references/listening.md`: 5-dimension scoring, curl recipes for Reddit/HN/Bluesky, browser workflow for LinkedIn/X) |
| `image` | AI image generation — May 2026 model lineup (Nano Banana family, Flux Pro 1.1/Kontext, Ideogram 3.0, Midjourney v7, Recraft V3) |
| `video` | AI video production — Sora 2, Kling 2.5/3.0, Seedance, Hailuo/MiniMax, Hunyuan/Wan 2, Pika 2.x |

### SEO & Discovery (7)
| Skill | Description |
|-------|-------------|
| `seo-audit` | Technical/on-page SEO + international localization |
| `ai-seo` | AI search optimization (AEO/GEO/LLMO) — v2.0.1 aligned with Google's official AI-features guide (query fan-out, agentic/UCP, what-NOT-to-do); v2.1.0 added Google **Open Knowledge Format (OKF)** coverage (`references/okf.md`) |
| `programmatic-seo` | Scaled page generation |
| `site-architecture` | Page hierarchy, navigation, URL structure |
| `competitors` | Comparison and alternative pages (was `competitor-alternatives`) |
| `schema` | Structured data (was `schema-markup`) |
| `aso` | App Store/Google Play optimization (was `aso-audit`) |

### Paid & Distribution (2)
| Skill | Description |
|-------|-------------|
| `ads` | **REWRITTEN** (was `paid-ads`) — v2.1.0 "audience knowledge → creative first, targeting second": platform-split table (Meta post-Andromeda 80%+ creative; Google Search 60% targeting; PMax 70% creative; LinkedIn 60% targeting; TikTok 70% creative), Modern Meta/Andromeda playbook (creative volume as binding constraint, statics > polished video, ~1hr/week fresh creative, broad audience + specific creative, 4-component retargeting, interest-stacking flagged harmful); v2.0.1 Google RSA output spec (15×30-char headlines, 4×90-char descriptions, ≥8 negatives, self-check) |
| `ad-creative` | Bulk ad creative generation |

### Measurement & Testing (2)
| Skill | Description |
|-------|-------------|
| `analytics` | Event tracking setup (was `analytics-tracking`) |
| `ab-testing` | Experiment design + Growth Experimentation Program (was `ab-test-setup`) |

### Retention (2)
| Skill | Description |
|-------|-------------|
| `churn-prevention` | Cancel flows, save offers, dunning |
| `community-marketing` | Community-led growth, ambassador programs |

### Growth Engineering (4)
| Skill | Description |
|-------|-------------|
| `free-tools` | Marketing tools and calculators (was `free-tool-strategy`) |
| `referrals` | Referral and affiliate programs (was `referral-program`) |
| `lead-magnets` | Lead magnet strategy and format selection |
| `directory-submissions` | Product Hunt, G2, AI directories, backlink strategy |

### Outbound & Pipeline (2) — NEW CATEGORY
| Skill | Description |
|-------|-------------|
| `prospecting` | **NEW v2.2.0** — qualified prospect lists across 3 motions (SaaS / B2B / local SMB); 5-phase framework (ICP → discovery → qualify → score → output); data-sources guide (Apollo, Clay, ZoomInfo, Clearbit, Hunter, BuiltWith, Crunchbase, GitHub); compliance (CAN-SPAM, GDPR, CASL); ships `tools/clis/github-prospects.js` (stargazers/forkers/watchers as developer-intent signal) |
| `sms` | **NEW v2.1.0** — SMS/MMS marketing: welcome/abandoned-cart/post-purchase/win-back/promo/transactional flows; TCPA + A2P 10DLC + GDPR + CASL compliance; platform comparison (Klaviyo, Postscript, Attentive, Twilio, Brevo, Customer.io) |

### Strategy & Sales (13)
| Skill | Description |
|-------|-------------|
| `marketing-ideas` | 139-idea SaaS marketing library |
| `marketing-psychology` | 70+ mental models and behavioral science |
| `marketing-plan` | **NEW v2.3.0** — fCMO-level AARRR-structured 13-section plan generator (90-day roadmap, 12-month outlook with funding-stage unlocks, ops stack mapping skills+MCPs to AARRR stages, 139-idea cross-reference, 17-section current-state rubric, RACI); budget frameworks (revenue-based 5–40% ARR / goal-based reverse-engineering, blended CAC, 3-3-2-2-2 VC path) from *Founding Marketing* |
| `marketing-loops` | **NEW v2.6.0** — 43 recurring marketing loops with 9-part anatomy (cadence, acts-when, purpose, skills used, body, self-check, **state/idempotency**, stop/bail-out, output); `loop-state.md` (watermark/dedupe/cooldown/in-flight patterns in `.agents/loops/<loop>.json` + run-log-as-vanity-loop-detector); `loop-guardrails.md` (two-tier autonomous-safe vs gated action model, spend/send caps + allowlists, compliance mapping, kill switch); `loop-orchestration.md` (sensing → diagnostic → action → learning layering, staged rollout) |
| `public-relations` | **NEW v2.4.0** (shipped as `pr`, renamed v2.4.1 to avoid pull-request collision) — earned media: 4 modes (reactive/proactive/inbound/owned), newsjacking loop with scoring rubric + veto list, journalist pitching (6 templates), press platforms (HARO/Qwoted/Featured), tiered media outlets |
| `co-marketing` | **NEW v1.10.0** — partner identification, joint campaigns, partnership structuring |
| `launch` | Product launches (was `launch-strategy`) |
| `pricing` | Pricing, packaging, monetization (was `pricing-strategy`) |
| `customer-research` | Customer research from assets + online sources |
| `competitor-profiling` | Competitive intelligence from URLs |
| `content-strategy` | Content planning and editorial calendars |
| `revops` | Revenue operations, lead lifecycle, CRM |
| `sales-enablement` | Sales decks, one-pagers, objection docs |

### Foundation (1)
| Skill | Description |
|-------|-------------|
| `product-marketing` | Foundation skill read by all others (was `product-marketing-context`); context file renamed `.agents/product-marketing.md` (legacy filename still checked) |

## Tools & Integrations

### CLI Tools (65)
Zero-dependency Node.js scripts in `tools/clis/`. v1.9→v2.6 additions: `github-prospects.js` (GitHub stargazers/forkers/watchers with pagination, enrichment, CSV). Existing categories: SEO, Email, Outreach, Ads, Analytics, Payments, Social, Reviews, Scheduling, Forms, Video, CRM, Data, Optimization, Messaging, Referral, Competitive.

### Integration Guides (93)
v1.9→v2.6 additions: truelist (email deliverability), github (REST prospecting), firecrawl (page scraping), browserbase (real Chromium for JS-heavy pages), sequenzy (email marketing w/ MCP), + 5 SMS platforms.

### Composio MCP Integration
OAuth-heavy tools: HubSpot, Salesforce, Meta Ads, LinkedIn Ads, Google Sheets, Slack, Notion, ActiveCampaign, Klaviyo, Shopify, Gmail, Airtable.

## Architecture

- **Foundation pattern:** `product-marketing` creates `.agents/product-marketing.md` read by all other skills first
- **Cross-references:** skills route to each other via frontmatter description "For X, see Y" lines; v2.5.1 showed they version-bump for description-only changes so update-checks surface routing changes
- **Update check:** `VERSIONS.md` is a machine-comparable per-skill version table; `sync-skills.js` auto-syncs plugin.json version to marketplace.json (fixed v2.2.0 after 3-release drift)
- **Loop layer (v2.6.0):** `marketing-loops` positions the pack as a marketing *operating system* — recurring loops orchestrating the one-shot skills, with explicit state, guardrails, and scheduling deferred to host primitives (Claude Code `/loop`, `ScheduleWakeup`, `CronCreate`, cron)
- **Agent-agnostic:** `.agents/` directory (`.claude/` fallback); plugin marketplace support
- **Banned-vocabulary lists** in new skills (offers, marketing-loops, public-relations) — anti-hype guardrails baked into the skill text

## svc Integration Points

| svc consumer | When | What coreyhaines provides (v2.6.0 names) |
|-----------|------|---------------------------|
| `analyze-marketing` | After feature mining | Downstream transformation of svc context |
| `validate-feature` | Market validation | `customer-research`, `competitor-profiling` |
| `find-opportunity` | Opportunity discovery | `marketing-ideas`, `directory-submissions` |
| `landing-page` / `benchmark-landing` | Marketing pages | `cro`, `copywriting` |
| `growth-lead` agent | Growth pass | `marketing-plan`, `marketing-loops`, `ads`, funnel skills |
| `revops` agent (fleet) | Outbound design | `prospecting` + `github-prospects.js`, `cold-email`, `sms` |
| `comms` agent (fleet) | PR + listening | `public-relations`, `social` listening workflow |
| `data-collection` agent (fleet) | Social listening | `social/references/listening.md` curl recipes |
| `ad-strategist` agent | Paid creative | `ads` Andromeda playbook, platform creative-vs-targeting split |

## Key Differentiators vs svc

| Dimension | coreyhaines v2.6.0 | svc |
|-----------|-------------|-----|
| **Focus** | Marketing execution + marketing ops loops | Development pipeline + governance |
| **Depth** | 46 specialized marketing skills | 85 general-purpose skills (see manifest) |
| **Autonomy model** | Two-tier loop guardrails (autonomous-safe vs gated), caps/allowlists, kill switch | Mandatory chain, receipts, claims, refuse-mode |
| **Tools** | 65 CLIs, 93 integrations | Framework scripts, hooks |
| **Evals** | Per-skill evals incl. new skills | Tier 1–3 test framework |
| **Community** | 38.2k stars, active PRs (87 commits in 10 weeks) | Private solo framework |

## Version History (v1.1.0 → v2.6.0)

| Version | Date | Skills | Key Changes |
|---------|------|--------|-------------|
| v2.6.0 | 2026-07-01 | 46 | marketing-loops (43-loop catalog); ads 2.1.0 Andromeda playbook |
| v2.5.0/.1 | 2026-06-16 | 45 | offers skill; cross-ref version bumps |
| v2.4.2 | 2026-06-15 | 44 | ai-seo OKF coverage |
| v2.4.0/.1 | 2026-06-10 | 44 | public-relations (pr→renamed); social listening workflow |
| v2.3.0 | 2026-05-27 | 43 | marketing-plan (fCMO AARRR generator) |
| v2.2.0 | 2026-05-26 | 42 | prospecting + github-prospects CLI; ads RSA spec; plugin version-sync fix |
| v2.1.0 | 2026-05-21 | 41 | sms + 5 platform integrations |
| v2.0.1 | 2026-05-18 | 40 | ai-seo Google alignment; image/video model refresh |
| v2.0.0 | 2026-05-05 | 40 | **BREAKING**: 17 renames, page-cro+form-cro→cro, 100+ cross-refs updated |
| v1.10.0 | 2026-05-04 | 41* | co-marketing (*pre-consolidation count) |
| v1.9.0 | 2026-04-24 | 40 | image, video skills; plugin fix ← **previous svc blend baseline** |
| v1.1.0–v1.8.0 | Feb–Apr 2026 | 22→38 | see details/version-changelog.md |

## Self-Verify

| # | Check | Result |
|---|-------|--------|
| 1 | All 46 skills listed | PASS (counted `git ls-tree v2.6.0 skills/` = 46) |
| 2 | Version is v2.6.0 | PASS (tag `2815104d`) |
| 3 | Tools count documented | PASS (65 CLIs, 93 integrations — counted in clone) |
| 4 | svc integration points mapped | PASS (incl. fleet agents) |
| 5 | Version history complete | PASS (v1.9→v2.6 delta itemized) |
