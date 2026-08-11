# Feature: Social Trend Scraper

**Type:** Enabler
**Status:** DRAFT
**Consumer:** Trend Synthesis Engine, feature-trend-learning (TRN-01 through TRN-05)
**Owner:** TrendLearner data pipeline

## Overview

The Social Trend Scraper is the foundational data pipeline that collects raw AI/ML discussion signals from five social platforms (Twitter/X, Reddit, Hacker News, LinkedIn, YouTube). It normalizes heterogeneous API responses into a common signal schema, applies initial AI/ML domain filtering to discard irrelevant content, and stores normalized signals for consumption by the Trend Synthesis Engine.

Without this enabler, the entire product has no input data. The scraper must operate reliably on a daily cadence, handle API rate limits and failures gracefully, and produce signal data fresh enough to meet the vision's 48-hour trend freshness target. It must work identically across all three deployment modes, using API keys provided by the deployer (BYOK model).

## User Stories

### US-1: Scrape AI/ML Signals from Social Platforms

**As** the Trend Synthesis Engine (downstream consumer),
**I want** to receive a normalized stream of AI/ML-related social signals from all configured source platforms on a daily cadence,
**So that** I can synthesize these signals into ranked trends for the user-facing dashboard.

### Acceptance Criteria — Platform Scraping

| AC | Description | QA | E2E | Test |
|----|-------------|-----|-----|------|
| SCR-01 | The scraper supports five platform adapters: Twitter/X, Reddit, Hacker News, LinkedIn, and YouTube. Each adapter connects to its platform's API using deployer-provided API keys (BYOK). | — | :black_square_button: | — |
| SCR-02 | Each platform adapter collects posts, threads, or content items from the last 48 hours that match predefined AI/ML topic keywords and subreddit/channel/hashtag lists | — | :black_square_button: | — |
| SCR-03 | The scraper runs on a configurable cadence (default: every 24 hours) and completes a full scrape cycle across all configured platforms within 30 minutes | — | :black_square_button: | — |
| SCR-04 | If a platform API is unavailable or returns errors, the scraper logs the failure, skips that platform for the current cycle, and continues scraping remaining platforms without interruption | — | :black_square_button: | — |
| SCR-05 | The scraper respects API rate limits for each platform by implementing per-adapter rate limiting with configurable thresholds, and logs when rate limits are approached or hit | — | :black_square_button: | — |
| SCR-06 | Each platform adapter can be independently enabled or disabled via configuration, allowing deployments to run with fewer than five platforms (minimum: one platform required) | — | :black_square_button: | — |

### US-2: Normalize Signals into Common Schema

**As** the Trend Synthesis Engine,
**I want** all signals from all platforms normalized into a single schema,
**So that** I can process signals uniformly regardless of their source platform.

### Acceptance Criteria — Signal Normalization

| AC | Description | QA | E2E | Test |
|----|-------------|-----|-----|------|
| SIG-01 | Every collected signal is normalized into a common schema containing: signal_id, source_platform, original_url, title, body_text (truncated to 2000 chars), author_identifier, engagement_count (likes + upvotes + reactions normalized), comment_count, published_at (UTC timestamp), and scraped_at (UTC timestamp) | — | :black_square_button: | — |
| SIG-02 | Duplicate signals (same content appearing across multiple platform queries) are deduplicated within a single scrape cycle using content hashing, retaining the earliest instance | — | :black_square_button: | — |
| SIG-03 | Normalized signals are persisted to local storage (database or file-based) with a configurable retention period (default: 30 days), after which signals are automatically purged | — | :black_square_button: | — |

### US-3: Filter for AI/ML Domain Relevance

**As** the Trend Synthesis Engine,
**I want** incoming signals pre-filtered to exclude content that is not related to AI/ML,
**So that** downstream processing operates on a high-signal dataset rather than raw social media noise.

### Acceptance Criteria — Signal Filtering

| AC | Description | QA | E2E | Test |
|----|-------------|-----|-----|------|
| SIG-04 | Each signal passes through a domain relevance filter that classifies it as AI/ML-relevant or not, using keyword matching as a first pass and LLM classification as a second pass for ambiguous signals | — | :black_square_button: | — |
| SIG-05 | The domain relevance filter achieves at least 90% precision (fewer than 10% of signals marked as relevant are actually irrelevant) measured against a manually labeled validation set of 200 signals | — | :black_square_button: | — |
| SIG-06 | Filtered-out signals are logged with their classification reason and can be reviewed via an admin endpoint or log file for filter tuning | — | :black_square_button: | — |

## System Dependencies

| Dependency | Type | Required for | Status |
|-----------|------|-------------|--------|
| Twitter/X API | Integration | SCR-01, SCR-02 (Twitter/X adapter) | PLANNED |
| Reddit API | Integration | SCR-01, SCR-02 (Reddit adapter) | PLANNED |
| Hacker News API | Integration | SCR-01, SCR-02 (HN adapter) | PLANNED |
| LinkedIn API | Integration | SCR-01, SCR-02 (LinkedIn adapter) | PLANNED |
| YouTube Data API | Integration | SCR-01, SCR-02 (YouTube adapter) | PLANNED |
| LLM Provider API | Integration | SIG-04, SIG-05 (LLM-based domain classification for ambiguous signals) | PLANNED |
| Local storage (database) | Infrastructure | SIG-03 (signal persistence and retention) | PLANNED |

## Implementation Notes

- PLANNED — Each platform adapter is implemented as a separate module with a common interface (scrape, normalize, filter). New adapters can be added without modifying the scrape orchestrator.
- PLANNED — The HN adapter is the recommended starting point for MVP because the Hacker News API is free, stable, and requires no API key. Other adapters require BYOK configuration.
- PLANNED — Rate limiting is implemented per-adapter with configurable delays between requests. Default values match each platform's documented rate limits with a 20% safety margin.
- PLANNED — The common signal schema is defined as a versioned data model. Schema changes require migration scripts for stored signals.
- PLANNED — LLM classification for domain filtering (SIG-04) uses a lightweight prompt with cached results to minimize API cost. Only signals that pass keyword matching but are ambiguous are sent to the LLM.
- PLANNED — The scraper exposes a health endpoint or status log reporting: last successful scrape time, signals collected per platform, signals filtered out, and any errors encountered.
- PLANNED — In hosted-for-profit mode, the scraper runs once per deployment (not per tenant). All tenants share the same signal data. Personalization happens downstream in the Recommendation Engine.
