# Feature: Trend-to-Learning Recommendation

**Type:** Feature
**Status:** DRAFT
**Consumer:** P1 (Priya), P2 (Daniel), P3 (Rahul), P4 (Sofia) — all personas
**Owner:** TrendLearner core product team

## Overview

The Trend-to-Learning Recommendation feature is the core product capability of TrendLearner. It presents users with a dashboard of current AI/ML trends synthesized from social platform signals and bridges each trend to curated, personalized learning resources. This feature is the primary reason every persona engages with TrendLearner: P1 uses it to stay current, P2 uses it to guide team learning, P3 evaluates it as the value users pay for, and P4 depends on it to navigate a career transition.

The feature spans the full user flow from trend discovery through learning path engagement to skill progression tracking. It depends on the Social Trend Scraper (enabler) for signal input, the LLM provider API (integration) for trend synthesis and resource matching, and the User Profile Service (enabler) for personalization context.

## User Stories

### US-1: Browse Current AI/ML Trends

**As** an AI/ML practitioner (P1, P4) or team lead (P2),
**I want** to see a ranked list of currently trending AI/ML topics sourced from social platforms,
**So that** I can quickly understand what the industry is discussing and learning right now without manually monitoring multiple platforms.

### Acceptance Criteria — Trend Browsing

| AC | Description | QA | E2E | Test |
|----|-------------|-----|-----|------|
| TRN-01 | The trend dashboard displays the top 10 trending AI/ML topics from the last 48 hours, ranked by composite signal strength across configured source platforms | — | :black_square_button: | — |
| TRN-02 | Each trend entry shows: topic title, one-sentence summary, source platforms that contributed signals (with icons), and a numeric signal strength indicator (1-100) | — | :black_square_button: | — |
| TRN-03 | Each trend includes a "Why trending" explanation (2-3 sentences) citing specific signal sources (e.g., "Discussed in 14 Reddit threads and 23 Twitter/X posts in the last 36 hours") | — | :black_square_button: | — |
| TRN-04 | Trends can be filtered by AI/ML subfield (NLP, computer vision, MLOps, reinforcement learning, etc.) with at least 8 predefined subfield categories | — | :black_square_button: | — |
| TRN-05 | The trend dashboard refreshes automatically on a configurable cadence (default: every 24 hours) and displays the timestamp of the last refresh | — | :black_square_button: | — |

### US-2: Generate Personalized Learning Path from Trend

**As** a user who has identified a relevant trend (P1, P4),
**I want** to view a learning path for that trend that is personalized to my current skill level,
**So that** I can immediately start learning about the trend with resources appropriate for my expertise.

### Acceptance Criteria — Learning Path Generation

| AC | Description | QA | E2E | Test |
|----|-------------|-----|-----|------|
| LRN-01 | Selecting a trend generates a learning path containing 3-8 curated resources (tutorials, papers, videos, repos, courses) relevant to that trend | — | :black_square_button: | — |
| LRN-02 | Resources in the learning path are ordered by prerequisite logic: foundational resources appear before advanced ones, and resources the user has already completed are marked as such | — | :black_square_button: | — |
| LRN-03 | Each resource in the learning path displays: title, format (video/article/paper/repo/course), estimated time to complete, difficulty level (beginner/intermediate/advanced), and a direct link to the external resource | — | :black_square_button: | — |
| LRN-04 | The learning path adapts to the user's skill profile: a user with "advanced" NLP skills sees different resources for the same trend than a user with "beginner" NLP skills | — | :black_square_button: | — |
| LRN-05 | Resources that require prerequisites the user has not completed are flagged with a "prerequisite needed" indicator linking to the prerequisite resource or path | — | :black_square_button: | — |

### US-3: Track Skill Progression

**As** a user actively learning through TrendLearner (P1, P4),
**I want** to track which resources I have completed and see my skill profile evolve over time,
**So that** I can measure my progress and receive increasingly relevant recommendations.

### Acceptance Criteria — Skill Tracking

| AC | Description | QA | E2E | Test |
|----|-------------|-----|-----|------|
| SKL-01 | Users can configure a skill profile by self-assessing their level (none/beginner/intermediate/advanced) across at least 8 AI/ML skill categories (e.g., Python, deep learning, NLP, computer vision, MLOps, reinforcement learning, data engineering, statistics) | — | :black_square_button: | — |
| SKL-02 | Users can mark individual learning resources as "completed," and this completion is reflected in their skill profile and future recommendations | — | :black_square_button: | — |
| SKL-03 | The skill profile page displays a visual summary of current skill levels across all categories, showing both self-assessed levels and system-inferred levels based on completed resources | — | :black_square_button: | — |
| SKL-04 | Completing resources in a learning path updates the user's inferred skill level for the relevant category, which is visible on the skill profile page within the same session | — | :black_square_button: | — |

### US-4: Configure Deployment Mode

**As** a user setting up TrendLearner for the first time (P1, P2, P3),
**I want** to deploy and configure the application in my chosen deployment mode (self-hosted free, self-hosted private, hosted-for-profit),
**So that** the application runs in my preferred environment with the correct feature set enabled.

### Acceptance Criteria — Deployment Setup

| AC | Description | QA | E2E | Test |
|----|-------------|-----|-----|------|
| DEP-01 | Self-hosted free mode can be deployed using a single `docker compose up` command with API keys provided via environment variables, and the application is accessible within 5 minutes of starting the containers | — | :black_square_button: | — |
| DEP-02 | Self-hosted private mode supports multi-user access with role-based permissions (admin, member) and can be configured with a shared set of API keys managed by the admin | — | :black_square_button: | — |
| DEP-03 | Hosted-for-profit mode supports multi-tenant user isolation where each tenant's data (skill profiles, completed resources, preferences) is fully separated from other tenants | — | :black_square_button: | — |
| DEP-04 | All three deployment modes provide identical core feature parity for trend browsing, learning paths, and skill tracking — no core feature is gated by deployment mode | — | :black_square_button: | — |

### US-5: Evaluate Trend Quality and Provide Feedback

**As** a user reviewing trend recommendations (P1, P2),
**I want** to provide feedback on trend relevance and resource quality,
**So that** the system improves its recommendations over time and I can trust the curation.

### Acceptance Criteria — Feedback Loop

| AC | Description | QA | E2E | Test |
|----|-------------|-----|-----|------|
| TRN-06 | Users can rate each trend as "relevant" or "not relevant" via a single-click action on the trend dashboard | — | :black_square_button: | — |
| TRN-07 | Users can rate each learning resource as "helpful" or "not helpful" after viewing or completing it | — | :black_square_button: | — |
| TRN-08 | User feedback is stored locally (in the user's deployment) and used to adjust future trend ranking and resource ordering for that user | — | :black_square_button: | — |

### US-6: View Team Learning Overview

**As** a team lead (P2),
**I want** to see an aggregate view of my team's skill distribution and learning activity,
**So that** I can identify skill gaps and plan team learning investments.

### Acceptance Criteria — Team Overview

| AC | Description | QA | E2E | Test |
|----|-------------|-----|-----|------|
| SKL-05 | In self-hosted private mode, admin users can view an aggregate skill map showing the team's distribution of skill levels across all categories without revealing individual user profiles | — | :black_square_button: | — |
| SKL-06 | The team overview displays aggregate learning activity: total resources completed this week, active learning paths, and most popular trends viewed by team members | — | :black_square_button: | — |
| SKL-07 | Only users with the admin role in self-hosted private mode can access the team overview; member-role users see only their own skill profile and learning activity | — | :black_square_button: | — |

## System Dependencies

| Dependency | Type | Required for | Status |
|-----------|------|-------------|--------|
| Social Trend Scraper | Enabler | TRN-01, TRN-02, TRN-03, TRN-04, TRN-05 (all trend data) | PLANNED |
| Trend Synthesis Engine | Enabler | TRN-01, TRN-03 (ranking, explanation generation) | PLANNED |
| Recommendation Engine | Enabler | LRN-01, LRN-02, LRN-04, LRN-05 (resource matching and personalization) | PLANNED |
| User Profile Service | Enabler | SKL-01, SKL-02, SKL-03, SKL-04, LRN-04 (profile storage and skill inference) | PLANNED |
| Content Aggregator | Enabler | LRN-01, LRN-03 (resource catalog) | PLANNED |
| LLM Provider API | Integration | TRN-03 (explanation generation), LRN-01, LRN-04 (learning path generation) | PLANNED |
| Twitter/X API | Integration | TRN-01, TRN-02 (social signals) | PLANNED |
| Reddit API | Integration | TRN-01, TRN-02 (social signals) | PLANNED |
| Hacker News API | Integration | TRN-01, TRN-02 (social signals) | PLANNED |
| LinkedIn API | Integration | TRN-01, TRN-02 (social signals) | PLANNED |
| YouTube Data API | Integration | TRN-01, TRN-02 (social signals) | PLANNED |

## Implementation Notes

- PLANNED — Trend dashboard is the landing page for all personas. Must load with pre-computed trend data (no empty state on first visit after initial scrape completes).
- PLANNED — Learning path generation uses LLM to match trend topics to resources from the Content Aggregator index, filtered by user skill profile from the User Profile Service.
- PLANNED — Skill categories and their prerequisite relationships will be defined in a static taxonomy file that can be extended. Initial taxonomy covers 8-10 core AI/ML categories.
- PLANNED — Deployment mode is selected at install time via configuration (environment variable or config file), not at runtime. Feature flags for mode-specific capabilities (team features in private mode, multi-tenancy in operator mode).
- PLANNED — Feedback data (TRN-06, TRN-07, TRN-08) stays local to the deployment instance. No cross-instance data sharing. Opt-in telemetry is separate from feedback.
- PLANNED — Team overview (SKL-05, SKL-06) is available only in self-hosted private and hosted-for-profit modes where multi-user access is configured.
