# New & Rewritten Skills — v2.0.0 → v2.6.0 (Layer 3 detail)

Extracted 2026-07-13 from clone at v2.6.0 (`2815104d`); quotes derived from upstream VERSIONS.md and SKILL.md files read in-session.

## v2.0.0 breaking rename map (needed for any svc cross-reference migration)

| Old name (svc still references these) | New name |
|----------|----------|
| ab-test-setup | ab-testing |
| analytics-tracking | analytics |
| aso-audit | aso |
| competitor-alternatives | competitors |
| email-sequence | emails |
| free-tool-strategy | free-tools |
| launch-strategy | launch |
| onboarding-cro | onboarding |
| paid-ads | ads |
| paywall-upgrade-cro | paywalls |
| popup-cro | popups |
| pricing-strategy | pricing |
| product-marketing-context | product-marketing |
| referral-program | referrals |
| schema-markup | schema |
| signup-flow-cro | signup |
| social-content | social |
| **Consolidation:** page-cro + form-cro | **cro** (form content → `cro/references/form.md`) |

Context file also renamed: `.agents/product-marketing-context.md` → `.agents/product-marketing.md` (skills still check the legacy filename).

## marketing-loops (v2.6.0) — the highest-signal addition

Positions the pack as a marketing *operating system*: 43 recurring loops that orchestrate the one-shot skills on a cadence. Loop anatomy is 9 parts: check cadence, acts-when condition, purpose, skills used, loop body, self-check, **state/idempotency**, stop/bail-out, output.

**State contract** (`references/loop-state.md`): one JSON per loop at `.agents/loops/<loop>.json` with `cursor` (watermark — only process items newer), `handled` (dedupe keys), `cooldowns` (per-entity suppression windows), `in_flight` (open actions guard), `counters` (attempt counts driving stop conditions). Append-only run log (`timestamp checked=N acted=M note`) doubles as a **vanity-loop detector**: weeks of `acted=0` nobody misses → kill it; acting every run → chasing noise.

**Guardrails** (`references/loop-guardrails.md`): two-tier action model — Tier 1 autonomous-safe (read, analyze, diff, score, draft, stage); Tier 2 gated (spend, shift budget, send, publish, delete/suppress, change live settings) requiring human checkpoint unless explicitly authorized AND bounded by caps + allowlist. Spend guardrails: hard ceilings, per-run change limit (≤20%), directional rule (judge on revenue/ROAS, never proxy metrics). Publish/send: staging queue default, volume caps, suppression-first. Compliance mapped per loop class (CAN-SPAM/CASL, GDPR/CCPA, FTC disclosure, platform ToS). PII: no raw PII in state/logs (IDs/hashes), minimize retention. Always-escalate list + required kill switch + pre-launch checklist.

**Orchestration** (`references/loop-orchestration.md`): loops compose into sensing → diagnostic → action → learning layers; staged rollout (tracking + weekly review before acquisition loops; never all 43 at once).

Cadence rule: match frequency to how fast the signal actually changes. When NOT to loop: strategy/creative work, unreviewed spend/publish, sparse signals, vanity loops. Scheduling defers to host primitives (Claude Code `/loop`, `ScheduleWakeup`, `CronCreate`, plain cron). Banned vocabulary: "set it and forget it", "fully autonomous marketing", "10x on autopilot".

## ads rewrite (v2.0.0 rename + v2.0.1 + v2.1.0)

- **Core reframe (2.1.0):** audience research stays the highest-leverage work, but apply it to *creative* (headlines, hooks, examples), not targeting filters — platform algorithms match better than manual filters now. Platform split: Meta post-Andromeda **80%+ creative**; Google Search **60% targeting** (keywords still dominant); PMax/Demand Gen 70% creative; LinkedIn **60% targeting** (identity data quality); TikTok 70% creative; X 50/50.
- **Andromeda-era Meta playbook (2026+):** creative volume is the binding constraint ("a hungry panda"); **statics often outperform polished video** (algorithm delivery bias + 10x cheaper enables volume); dedicate ~1hr/week to fresh creative for the winning offer; broad audience + specific creative (duplicate-and-strip-targeting A/B test); 4-component retargeting by funnel stage with *different* offers; interest-stacking flagged **actively harmful** on Meta.
- Named failure mode: "trying to fix weak creative with hyper-precise targeting" — 12 stacked interests showing everyone the same bad ad; better = 5 creative variants per segment, target broad, let the algorithm match.
- **Google RSA output spec (2.0.1):** 15 headlines × 30 chars, 4 descriptions × 90 chars, ad-group labels, ≥8 negative keywords, ≥4 sitelinks/callouts, output ordering to avoid truncation, self-check before responding.

## offers (v2.5.0)

"The offer is the thing, not the page" — most 'we need better copy' requests are 'we need a better offer' in disguise. Value Equation (Dream Outcome × Perceived Likelihood ÷ Time Delay × Effort, Hormozi) + 6-component anatomy (core deliverable, bonus stack, guarantee, scarcity, name, price/payment structure). 8 guarantee types with a decision tree; honest case for anti-guarantees on premium offers. Explicit rejection of fake countdown timers/manufactured FOMO. Self-scoped: strong for services/agencies/courses/coaching/high-ticket B2B/direct-response; defers to `pricing` for self-serve SaaS. Six anonymized before/after worked examples.

## marketing-plan (v2.3.0)

fCMO-level 13-section AARRR plan generator: exec summary, strategic frame, current state (embedded 17-section scoring rubric), AARRR breakdown, 90-day roadmap, 12-month outlook keyed to funding-stage capability unlocks, ops stack mapping skills+MCPs to AARRR stages, 139-idea cross-reference, measurement framework, RACI, open decisions. Three-phase workflow: INIT (research+intake) → REVIEW (section walkthrough) → FINALIZE. Budget science: revenue-based (5–40% of ARR) and goal-based (reverse-engineered from revenue target), blended CAC, 10–20% experimental buffer, 3-3-2-2-2 VC growth path. Growth-pattern reference: $0–10K / $10K–100K / $100K–1M phase constraints; linear vs step-function vs S-curve. Team model: strategy-in-house/execution-outsourced, π-shaped marketer, Early/Growth/Scale staging. Frameworks credited to *Founding Marketing* (Corey Haines).

## prospecting (v2.2.0)

Three motions with forked workflows: SaaS (ICP + tech stack + growth signals via LinkedIn/BuiltWith/Crunchbase/Apollo/Clay), B2B (industry/size/geo + trigger events via Apollo/ZoomInfo/Sales Nav), Local SMB (active business + website status + proximity via Google Maps/Yelp). Shared 5-phase framework: ICP → discovery → qualify → score → output. Compliance reference (CAN-SPAM, GDPR, CASL, platform ToS). Ships `tools/clis/github-prospects.js`: stargazers/forkers/watchers as developer-intent signal, with pagination, enrichment, filter-based early termination, CSV output.

## public-relations (v2.4.0, renamed from `pr` in v2.4.1)

Earned media for software products. Core philosophy: "PR is a multiplier for distribution, not a substitute" — a TechCrunch hit yields backlinks, legitimacy, AI-citation surface, sales ammo, not 1,000 customers. "The story is not your product — the story is the trend, the data, the conflict, or the human; your product is the evidence." 4 modes: reactive (press requests via HARO/Connectively, Qwoted, Featured), proactive (journalist pitching — 6 templates by angle, fit scoring, embargo etiquette), inbound, owned (press page + media kit). Newsjacking loop: detect → score → angle → pitch, with newsworthiness rubric, 7 angle templates, Google News/HN/Reddit curl recipes, and a veto list (tragedy/politics/crisis) + mandatory human approval. Rename rationale: `/pr` collided with pull-request skills in other Claude Code plugins.

## sms (v2.1.0)

SMS/MMS for DTC/mobile/high-engagement SaaS: welcome, abandoned cart, post-purchase, win-back, promotional, transactional/auth. Compliance-first: TCPA, A2P 10DLC, GDPR, CASL — geographic mix changes everything. Sequence templates with character counts; platform comparison (Klaviyo, Postscript, Attentive, Twilio, Brevo, SimpleTexting, Customer.io).

## co-marketing (v1.10.0)

Partner identification framework, joint campaign brainstorming, launch partnerships, partnership fit evaluation and agreement structuring. Routes to `referrals` for customer referral programs.

## social listening workflow (social 2.1.0, v2.4.0)

`references/listening.md`: daily engagement triage — surface top posts to comment on instead of scrolling. 5-dimension scoring (ICP fit, intent signal, reach potential, comment opportunity, recency), comment quality tiers, no-auth curl recipes (Reddit, HN Algolia, Bluesky), browser-driven LinkedIn/X via dev-browser persistent session. `listening-sources-template.md` → `.agents/listening-sources.md` (ICP, target accounts, intent keywords, subreddits, do-not-engage list).

## ai-seo increments

- v2.0.1: aligned with Google's official AI-features guide — query fan-out, agentic experiences (UCP), explicit "what NOT to do" (scaled content abuse), Search Console expectations; llms.txt/pricing.md/schema reframed as "Google says not required, helpful for non-Google engines".
- v2.1.0 (v2.4.2 release): Google **Open Knowledge Format (OKF)** — v0.1 markdown spec for agent-readable site bundles (cross-linked markdown + YAML frontmatter, `type` required), honest framing as a protocol-layer "register early" bet not a confirmed ranking signal; hosting at `/okf/index.md` + llms.txt pointer; skip for closed platforms/small sites.

## Post-v2.6.0 on main (unreleased, as of 2026-07-13)

- `marketing-council` (1.0.0): simulated advisor board — Godin, Ogilvy, Schwartz, Dunford, Sutherland, Hormozi, Sharp personas; each take grounded in documented frameworks ("persona simulation, not the real people"), value = surfaced disagreement, synthesis at the end. Structurally parallel to svc's judge-panel / SME-agent patterns.
- `ad-creative` 2.5.0→2.7.0: iOS-native reveal surfaces (ChatGPT + Apple Notes), Mode 4 creative strategy loop + hook system, shareable creative review page (client approval artifact).
- `ai-seo` 2.2.0: citations vs. recommendations — AI visibility ladder + listicle risk.
