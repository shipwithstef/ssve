# Feature Ship Brief: TrendLearner

**Version:** 1.0.0
**Date:** 2026-04-03
**Status:** DRAFT
**Origin:** validate-feature (greenfield bootstrap)
**Routes to:** write-spec

---

## 1. Product Thesis

TrendLearner bridges the gap between "what is trending in AI/ML on social platforms" and "what should I learn next." No existing tool synthesizes real-time social trend signals into personalized, skill-level-aware learning paths across multiple deployment models.

## 2. Primary Feature

**Trend-to-Learning Recommendation**

A system that scrapes AI/ML trend signals from five social platforms (Twitter/X, Reddit, Hacker News, LinkedIn, YouTube), ranks and synthesizes those signals, and maps each meaningful trend to curated learning resources personalized to the user's current skill level.

### Persona-Feature Map

| Persona | Relationship to Primary Feature | Key Need |
|---------|-------------------------------|----------|
| P1 (Priya) — Independent Learner | Power user. Consumes trends daily, follows 2-3 learning paths per month. Values freshness, transparency, and skill-level-appropriate resources. | Reduce 5-platform manual scanning to a single dashboard. Intermediate/advanced resources ranked by quality. |
| P2 (Daniel) — Team Lead | Aggregator. Uses trend data for team planning, shares trends in 1:1s, monitors team learning adoption. | Team-relevant trend filtering. Aggregate skill gap visibility. Tech radar meeting prep in 20 minutes instead of 3 hours. |
| P3 (Rahul) — Operator | Business evaluator. Assesses whether trend quality and learning path value are sufficient for users to pay $29/month. | Consistent quality across all platforms. Retention-driving personalization. Cost-predictable per-user API usage. |
| P4 (Sofia) — Career Transitioner | Guided consumer. Needs trends filtered and annotated by difficulty level, with prerequisite-aware learning paths that build coherently over months. | Skill-level filtering. Structured progression, not flat lists. Visible progress toward career goal. |

## 3. Enablers (Cascade Discovery)

Enablers are internal capabilities the primary feature depends on. Each was discovered by asking: "What must exist for the primary feature to function?"

| Enabler | Purpose | Depends On | Priority |
|---------|---------|-----------|----------|
| **Social Trend Scraper** | Collects raw signal data from 5 platforms on a cadence (daily minimum). Normalizes heterogeneous API responses into a common trend-signal schema. | Social media platform API integrations | P0 — Without signals, nothing works |
| **Trend Synthesis Engine** | Ranks, deduplicates, and synthesizes raw signals into a scored trend list. Applies AI/ML domain filtering. Produces "why trending" explanations. | Social Trend Scraper, LLM provider API | P0 — Raw signals are noise without synthesis |
| **Recommendation Engine** | Maps trends to learning resources. Personalizes by user skill profile. Ranks resources by quality, format, skill-level fit, and freshness. | Trend Synthesis Engine, User Profile Service, learning resource index | P0 — Trend-to-learning bridge is the core differentiator |
| **Content Aggregator** | Discovers, indexes, and maintains a catalog of learning resources (courses, tutorials, papers, repos, videos). Monitors for dead links and staleness. | External content sources | P1 — Can be bootstrapped with manual curation, automated later |
| **User Profile Service** | Manages skill profiles (self-assessed and system-inferred), tracks completed resources, and provides the personalization context that the Recommendation Engine consumes. | None (foundational) | P0 — Personalization requires profile state |

### Cascade Logic

```
Social Trend Scraper (raw signals)
        |
        v
Trend Synthesis Engine (scored, filtered, explained trends)
        |
        v
Recommendation Engine <--- User Profile Service (skill context)
        |                         ^
        v                         |
   Learning Paths       Completion Tracking
        ^
        |
Content Aggregator (resource catalog)
```

## 4. Integrations

Integrations are external systems TrendLearner must connect to. They are not owned by the project.

| Integration | Type | Purpose | Risk Level |
|------------|------|---------|------------|
| **Twitter/X API** | Social Platform | Primary real-time signal source for AI/ML practitioner discussions, paper shares, technique announcements | HIGH — API access increasingly restricted, rate limits, cost changes |
| **Reddit API** | Social Platform | Deep technical discussions in r/MachineLearning, r/LocalLLaMA, etc. Rich comment threads provide signal quality context | MEDIUM — API access tightened post-2023, but structured and documented |
| **Hacker News API** | Social Platform | Early signal for emerging tools and techniques. High signal-to-noise ratio for technical content | LOW — Free, stable, well-documented API |
| **LinkedIn API** | Social Platform | Industry leader perspectives, company announcements, job market signals | HIGH — Restrictive API access, heavy anti-scraping measures |
| **YouTube Data API** | Social Platform | Tutorial and explainer content discovery. Video metadata and engagement signals | MEDIUM — Quota-limited but well-documented |
| **LLM Provider API** | AI Service | Powers trend synthesis (classification, deduplication, explanation generation), learning path generation, and skill-to-resource matching | MEDIUM — Cost variability per user. BYOK model mitigates vendor lock-in |

## 5. Eight Business Questions

### Q1: What problem does this solve?

**Discovery overload + learning path paralysis.**

AI/ML practitioners must monitor 5+ fragmented social platforms to understand what the industry is actually using and learning. Even after identifying a relevant trend, finding the right learning resources at the right level requires hours of manual curation. The result: practitioners either fall behind (P1, P2), make poor learning investments (P4), or cannot assess product viability for their audience (P3).

The compound effect is measurable: P1 (Priya) spends 5-7 hours/week on manual trend scanning that yields incomplete coverage. P2 (Daniel) spends 3 hours preparing each biweekly tech radar meeting. P4 (Sofia) wastes learning time on misaligned resources because no tool connects "what is trending" to "what she should learn at her level."

### Q2: Who specifically has this problem?

| Persona | Intensity | Frequency | Willingness to Pay |
|---------|-----------|-----------|-------------------|
| P1 (Priya) — Independent ML engineer | High. Feels anxiety about falling behind. | Daily. Checks multiple platforms every day. | Low direct payment. Will self-host with BYOK. API key costs $5-20/month acceptable. |
| P2 (Daniel) — Team lead | High. Responsible for team competence, not just his own. | Weekly. Concentrated around planning cycles. | Medium. Will pay for team tooling. Self-hosts on company infra. |
| P3 (Rahul) — Operator | Indirect. His users have the problem; he monetizes the solution. | Evaluates once, then monitors business metrics. | Invests in infrastructure to earn revenue. |
| P4 (Sofia) — Career transitioner | Critical. Wrong learning choices cost months of career progress. | Multiple times per week during active transition. | Medium-high. Will pay $20-30/month for a hosted version as career investment. |

### Q3: How do they solve it today?

| Current Solution | Who Uses It | Why It Fails |
|-----------------|------------|-------------|
| Manual multi-platform scanning (Twitter/X, Reddit, HN, LinkedIn, YouTube) | P1, P2 | Time-consuming (5-7 hrs/week for P1). Incomplete coverage. No skill-level filtering. No learning path generation. |
| Newsletter aggregators (The Batch, TLDR AI, etc.) | P1, P4 | Too shallow (listicle summaries) or too broad (not AI/ML specific). No personalization. No learning path bridging. |
| Course platforms (Coursera, Udemy, fast.ai) | P4 | Catalog-driven, not trend-driven. 6-18 months behind industry. Optimize for completion rates, not relevance. |
| Shared team channels (Slack #ml-papers, Notion boards) | P2 | Becomes noise within weeks. No synthesis or prioritization. Requires active curation that nobody sustains. |
| Algorithm-driven social feeds | P1, P4 | Optimize for engagement, not learning value. Platform-siloed. No cross-platform synthesis. |
| Word of mouth / colleague recommendations | All | Incomplete. Biased by individual networks. No systematic coverage. |

### Q4: What is the minimum viable version?

**Single-platform scraper + basic recommendation.**

The MVP is deliberately narrow:

1. **One platform scraper** (Hacker News — lowest API risk, free, high signal quality) collecting AI/ML signals daily
2. **Basic trend synthesis** using LLM classification to produce a ranked trend list with explanations
3. **Static learning resource index** — manually curated initial set of 50-100 high-quality resources mapped to common AI/ML topics
4. **Simple skill profile** — self-assessed skill levels across 5-8 broad AI/ML categories
5. **Basic recommendation** — filter resources by trend relevance and user skill level
6. **Single deployment mode** — self-hosted free (Docker Compose + BYOK for LLM API)

This MVP validates the core thesis: does connecting trend signals to learning resources create value that manual scanning does not? If P1 checks the dashboard daily and P4 starts a learning path in the first session, the thesis is validated.

**What the MVP intentionally excludes:** Multi-platform scraping, team features, operator mode, advanced personalization, automated resource discovery, real-time processing.

### Q5: How do we know it worked?

**Primary metric: Weekly Active Learners (WAL)** — from the vision document.

A WAL is a user who starts at least one recommended learning resource per week, measured via click-through to the resource.

| Metric | Target (3-month post-launch) | Measurement |
|--------|------------------------------|-------------|
| WAL (self-hosted) | 100+ across all self-hosted instances (opt-in telemetry) | Anonymized count of users clicking learning resources weekly |
| Trend-to-learn conversion rate | >15% of viewed trends result in a learning resource click | Clicks on learning resources / trend detail views |
| Learning path completion rate | >25% of started paths reach 50% completion | Resources marked complete / resources in path |
| Trend freshness score | Median top-10 trend age < 48 hours | Timestamp of first social signal vs. display time |
| P4 skill progression | Measurable profile change within 30 days of signup | Skill level changes in user profile service |
| P2 team adoption | >50% of invited team members active within 30 days | Login count / invite count per team |

### Q6: What is the strategic bet?

**The trend-to-learning bridge is underserved and defensible.**

The bet has three parts:

1. **Underserved gap.** Trend aggregators exist (social media feeds, newsletters). Learning platforms exist (Coursera, Udemy, fast.ai). Nobody systematically bridges the two for AI/ML. This gap persists because it requires domain-specific synthesis that generic tools cannot provide.

2. **Three-mode deployment as adoption flywheel.** Self-hosted free earns trust and adoption from technical users (P1). Those users evangelize the tool. Operators (P3) build businesses on top, reaching users who would never self-host (P4). Enterprise teams (P2) adopt it internally. Each mode feeds the others.

3. **Personalization as moat.** Over time, user skill profiles and completion data create a recommendation quality advantage that new entrants cannot replicate without similar data. This is especially defensible for career transitioners (P4) whose multi-month learning journeys create deep personalization state.

### Q7: What are the risks?

| Risk | Severity | Probability | Mitigation |
|------|----------|------------|------------|
| **API access restrictions** — Social platforms further restrict API access, increasing costs or blocking scraping entirely | HIGH | HIGH | Multi-platform architecture reduces single-platform dependency. Hacker News API is free and stable (start here). RSS/public-feed fallbacks where available. Community-contributed scraper plugins (future). |
| **Content quality** — Learning resources recommended are stale, broken, or misaligned with trends | HIGH | MEDIUM | Human-curated seed corpus. Automated link validation. User feedback loop (thumbs up/down on resources). Freshness decay scoring. |
| **Cold start** — New users see poor recommendations because the system lacks data | MEDIUM | HIGH | Pre-built trend index from historical data. Skill-profile-based recommendations from day one (no usage history needed). Curated "starter paths" for common transition profiles (P4). |
| **LLM cost unpredictability** — Per-user LLM API costs vary widely based on usage patterns | MEDIUM | MEDIUM | BYOK model lets users control their own costs. Caching of trend synthesis results (same trend, many users). Batch processing over real-time where possible. Cost monitoring dashboard for operators (P3). |
| **Trend signal noise** — Social media signals include hype cycles, marketing, and low-quality content | MEDIUM | HIGH | Domain-specific filtering (AI/ML only). Signal strength scoring (cross-platform corroboration). LLM-based relevance classification. "Why trending" transparency lets users calibrate trust. |
| **Operator economics** — Hosted-for-profit mode does not produce viable unit economics for operators (P3) | MEDIUM | MEDIUM | Cost modeling tools for operators. Shared infrastructure components to reduce per-tenant costs. Tiered API usage (free tier uses fewer LLM calls). |
| **Adoption stall** — Tool does not earn a daily-use slot for P1 or weekly-use slot for P2 | HIGH | MEDIUM | Deliver first-session value (current trends on first load). Trend freshness as leading indicator. Newsletter/digest features reduce need for active check-ins. |

### Q8: What does this enable next?

Successful execution of the primary feature opens these expansion paths (aligned with vision Forward-Looking Areas):

1. **Collaborative learning** (Vision area #3) — Once users have skill profiles and learning paths, team-based features become natural: shared paths, group skill maps, peer recommendations. Depends on P2 adoption validating team use case.

2. **Trend prediction** (Vision area #4) — Historical trend data accumulated over months enables "what will trend next" analysis. Moves from reactive (what is trending) to proactive (what will trend). High value for P2 (planning) and P3 (differentiation).

3. **Content quality scoring** (Vision area #5) — User feedback on learning resources (click-through, completion, thumbs up/down) creates a quality index that improves recommendations over time. Makes the system smarter with scale.

4. **Plugin/extension architecture** (Vision area #6) — Community-contributed scrapers for new platforms (Discord, Mastodon, Substack), custom resource connectors, and domain extensions. Reduces maintenance burden and increases platform coverage.

5. **Multi-language support** (Vision area #1) — Once the architecture is proven, extending trend detection and resource indexing to non-English sources expands addressable market significantly.

## 6. Spec Routing

This brief produces the following specs via the `write-spec` skill:

| Spec | Type | Priority |
|------|------|----------|
| `feature-trend-learning.md` | Feature | P0 — Primary feature defining the product |
| `enabler-trend-scraper.md` | Enabler | P0 — Foundation all signal data flows from |

Additional enabler and integration specs to be produced in subsequent cycles:
- `enabler-trend-synthesis.md` — Trend Synthesis Engine
- `enabler-recommendation-engine.md` — Recommendation Engine
- `enabler-user-profile.md` — User Profile Service
- `enabler-content-aggregator.md` — Content Aggregator
- `integration-twitter-api.md` — Twitter/X API
- `integration-reddit-api.md` — Reddit API
- `integration-hn-api.md` — Hacker News API
- `integration-linkedin-api.md` — LinkedIn API
- `integration-youtube-api.md` — YouTube Data API
- `integration-llm-api.md` — LLM Provider API
