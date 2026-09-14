# Change Set: TrendLearner Core

**Feature Spec:** feature-trend-learning.md
**Tech Design:** technical-design-trend-learning.md
**Status:** BASELINED -> CHANGE-SET-APPROVED (pending review)
**Created:** 2026-04-03

## Apply Order

| Part | File | Description |
|------|------|-------------|
| part-01 | part-01-types.md | TypeScript type definitions, interfaces, enums, and shared constants |
| part-02 | part-02-data-model.md | PostgreSQL migrations via Drizzle Kit (8 tables, indexes, RLS policies) |
| part-03 | part-03-tests-unit.md | Unit tests written before implementation (TDD): services, adapters, skill inference |
| part-04 | part-04-services.md | Backend services: TrendScraper, TrendAnalyzer, RecommendationEngine, ContentAggregator, AuthService |
| part-05 | part-05-api-routes.md | Fastify route handlers: trends, learning-paths, profile, team, setup, admin |
| part-06 | part-06-components.md | React UI components: TrendDashboard, LearningPath, SkillProfile, TeamOverview, SetupWizard, AppShell |
| part-07 | part-07-tests-e2e.md | E2E test specs using Playwright for all user-facing journeys |
| part-08 | part-08-spec-updates.md | Feature spec status updates: PLANNED -> RESOLVED annotations with file:line references |

## Files Changed

| File | Action | Part | Purpose |
|------|--------|------|---------|
| `packages/shared/src/types/trend.ts` | CREATE | part-01 | Trend, TrendStatus, TrendCategory, ScrapedSignal types |
| `packages/shared/src/types/learning.ts` | CREATE | part-01 | LearningResource, LearningPath, ResourceFormat, Difficulty types |
| `packages/shared/src/types/user.ts` | CREATE | part-01 | UserProfile, SkillProfile, SkillLevel, UserRole types |
| `packages/shared/src/types/platform.ts` | CREATE | part-01 | Platform, PlatformAdapter interface, NormalizedSignal, ScrapeConfig |
| `packages/shared/src/types/api.ts` | CREATE | part-01 | API envelope types, pagination, error response |
| `packages/shared/src/constants/taxonomy.ts` | CREATE | part-01 | Skill category taxonomy, subfield definitions |
| `migrations/001_initial_schema.sql` | CREATE | part-02 | All 8 tables: users, trends, learning_resources, user_progress, scraped_signals, trend_feedback, cached_learning_paths, deployment_config |
| `migrations/002_indexes_and_rls.sql` | CREATE | part-02 | Performance indexes and row-level security policies for multi-tenant mode |
| `packages/backend/src/services/__tests__/trendAnalyzer.test.ts` | CREATE | part-03 | Unit tests for trend synthesis and ranking |
| `packages/backend/src/services/__tests__/recommendationEngine.test.ts` | CREATE | part-03 | Unit tests for learning path generation and skill-based personalization |
| `packages/backend/src/services/__tests__/skillInference.test.ts` | CREATE | part-03 | Unit tests for skill level inference from resource completion |
| `packages/scraper/src/adapters/__tests__/platformAdapter.test.ts` | CREATE | part-03 | Unit tests for signal normalization and deduplication |
| `packages/backend/src/services/trendScraper.ts` | CREATE | part-04 | Scrape orchestrator: schedules BullMQ jobs, calls platform adapters |
| `packages/backend/src/services/trendAnalyzer.ts` | CREATE | part-04 | Signal-to-trend synthesis, LLM-powered explanation generation |
| `packages/backend/src/services/recommendationEngine.ts` | CREATE | part-04 | Learning path generation with skill-profile personalization |
| `packages/backend/src/services/contentAggregator.ts` | CREATE | part-04 | Resource discovery, indexing, quality scoring |
| `packages/backend/src/services/authService.ts` | CREATE | part-04 | JWT auth, role middleware, deployment-mode-aware auth bypass |
| `packages/scraper/src/adapters/reddit.ts` | CREATE | part-04 | Reddit API adapter implementing PlatformAdapter interface |
| `packages/scraper/src/adapters/hackerNews.ts` | CREATE | part-04 | Hacker News Algolia API adapter |
| `packages/scraper/src/adapters/twitter.ts` | CREATE | part-04 | Twitter/X API v2 adapter |
| `packages/scraper/src/adapters/linkedin.ts` | CREATE | part-04 | LinkedIn Marketing API adapter |
| `packages/scraper/src/adapters/youtube.ts` | CREATE | part-04 | YouTube Data API v3 adapter |
| `packages/backend/src/routes/trends.ts` | CREATE | part-05 | GET /api/trends, GET /api/trends/:id, POST /api/trends/:id/rate, GET /api/trends/refresh-status |
| `packages/backend/src/routes/learningPaths.ts` | CREATE | part-05 | GET /api/learning-paths/:trendId, GET /api/learning-paths/:trendId/resources, POST /api/progress, POST /api/progress/:resourceId/feedback |
| `packages/backend/src/routes/profile.ts` | CREATE | part-05 | GET /api/profile, PUT /api/profile, GET /api/profile/completions |
| `packages/backend/src/routes/team.ts` | CREATE | part-05 | GET /api/team/skills, GET /api/team/activity |
| `packages/backend/src/routes/setup.ts` | CREATE | part-05 | GET /api/setup, POST /api/setup, POST /api/setup/validate-key |
| `packages/backend/src/routes/admin.ts` | CREATE | part-05 | GET /api/admin/scraper-status, POST /api/admin/trigger-scrape, GET /api/admin/users |
| `packages/frontend/src/pages/TrendDashboard.tsx` | CREATE | part-06 | Main dashboard: ranked trend list, filters, signal strength, platform icons |
| `packages/frontend/src/components/TrendCard.tsx` | CREATE | part-06 | Individual trend entry with summary, platforms, rating action |
| `packages/frontend/src/components/TrendDetail.tsx` | CREATE | part-06 | Slide-over panel: "Why trending" explanation, source breakdown |
| `packages/frontend/src/pages/LearningPath.tsx` | CREATE | part-06 | Ordered resource list with progress tracking, prerequisite flags |
| `packages/frontend/src/components/LearningPathCard.tsx` | CREATE | part-06 | Resource card: title, format, time, difficulty, completion toggle |
| `packages/frontend/src/pages/SkillProfile.tsx` | CREATE | part-06 | Skill self-assessment, radar chart, inferred vs self-assessed levels |
| `packages/frontend/src/pages/TeamOverview.tsx` | CREATE | part-06 | Aggregate skill map, activity metrics (admin-only) |
| `packages/frontend/src/pages/SetupWizard.tsx` | CREATE | part-06 | 4-step deployment config: mode, API keys, platforms, confirm |
| `packages/frontend/src/components/AppShell.tsx` | CREATE | part-06 | Navigation, theme toggle, responsive layout |
| `e2e/specs/trend-discovery.spec.ts` | CREATE | part-07 | E2E: dashboard loads, trends display, filtering, feedback |
| `e2e/specs/learning-path.spec.ts` | CREATE | part-07 | E2E: path generation, resource display, personalization |
| `e2e/specs/skill-tracking.spec.ts` | CREATE | part-07 | E2E: profile setup, resource completion, skill inference update |
| `e2e/specs/team-overview.spec.ts` | CREATE | part-07 | E2E: admin-only access, aggregate view, activity metrics |

## AC Traceability

| AC | Part(s) | File(s) |
|----|---------|---------|
| TRN-01 | part-01, part-02, part-04, part-05, part-06 | `trend.ts` (types), `001_initial_schema.sql` (trends table), `trendAnalyzer.ts` (synthesis), `trends.ts` (GET /api/trends), `TrendDashboard.tsx` (render top 10) |
| TRN-02 | part-01, part-05, part-06 | `trend.ts` (Trend interface fields), `trends.ts` (response shape), `TrendCard.tsx` (title, summary, platforms, signal strength) |
| TRN-03 | part-01, part-04, part-05, part-06 | `trend.ts` (whyTrending field), `trendAnalyzer.ts` (LLM explanation), `trends.ts` (GET /api/trends/:id), `TrendDetail.tsx` (explanation panel) |
| TRN-04 | part-01, part-05, part-06 | `trend.ts` (TrendCategory enum), `trends.ts` (subfield query param), `TrendDashboard.tsx` (FilterBar) |
| TRN-05 | part-04, part-05, part-06 | `trendScraper.ts` (BullMQ cron), `trends.ts` (GET /api/trends/refresh-status), `TrendDashboard.tsx` (refresh timestamp) |
| TRN-06 | part-02, part-05, part-06 | `001_initial_schema.sql` (trend_feedback table), `trends.ts` (POST /api/trends/:id/rate), `TrendCard.tsx` (relevant/not_relevant button) |
| TRN-07 | part-02, part-05, part-06 | `001_initial_schema.sql` (user_progress.feedback), `learningPaths.ts` (POST /api/progress/:resourceId/feedback), `LearningPathCard.tsx` (feedback buttons) |
| TRN-08 | part-04, part-05 | `trendAnalyzer.ts` (feedback-weighted ranking), `trends.ts` (ranking query includes feedback), `recommendationEngine.ts` (resource ordering with feedback) |
| LRN-01 | part-01, part-04, part-05, part-06 | `learning.ts` (LearningPath interface), `recommendationEngine.ts` (path generation), `learningPaths.ts` (GET /api/learning-paths/:trendId), `LearningPath.tsx` (resource list) |
| LRN-02 | part-01, part-04, part-06 | `learning.ts` (prerequisite ordering), `recommendationEngine.ts` (topological sort by difficulty), `LearningPath.tsx` (ordered rendering) |
| LRN-03 | part-01, part-06 | `learning.ts` (ResourceFormat, Difficulty), `LearningPathCard.tsx` (title, format, time, difficulty, link) |
| LRN-04 | part-01, part-04, part-05 | `user.ts` (SkillProfile), `recommendationEngine.ts` (skill-aware filtering), `learningPaths.ts` (passes user profile to engine) |
| LRN-05 | part-01, part-04, part-06 | `learning.ts` (prerequisite flag), `recommendationEngine.ts` (unmet prerequisite detection), `LearningPathCard.tsx` (prerequisite indicator) |
| SKL-01 | part-01, part-02, part-05, part-06 | `user.ts` (SkillCategory enum, 8+ categories), `001_initial_schema.sql` (users.skills_json), `profile.ts` (PUT /api/profile), `SkillProfile.tsx` (self-assessment form) |
| SKL-02 | part-02, part-05, part-06 | `001_initial_schema.sql` (user_progress), `learningPaths.ts` (POST /api/progress), `LearningPathCard.tsx` (completion toggle) |
| SKL-03 | part-05, part-06 | `profile.ts` (GET /api/profile), `SkillProfile.tsx` (radar chart, dual bars: self-assessed vs inferred) |
| SKL-04 | part-03, part-04, part-05 | `skillInference.test.ts`, `recommendationEngine.ts` (skill recalculation), `learningPaths.ts` (returns updated profile) |
| SKL-05 | part-05, part-06 | `team.ts` (GET /api/team/skills), `TeamOverview.tsx` (aggregate skill map) |
| SKL-06 | part-05, part-06 | `team.ts` (GET /api/team/activity), `TeamOverview.tsx` (activity metrics) |
| SKL-07 | part-04, part-05, part-06 | `authService.ts` (role middleware), `team.ts` (admin guard), `AppShell.tsx` (conditional nav) |
| DEP-01 | part-02 | `docker-compose.yml` (referenced but not created — infra), `001_initial_schema.sql` (auto-migrate on startup) |
| DEP-02 | part-04, part-05 | `authService.ts` (JWT + LDAP), `admin.ts` (GET /api/admin/users) |
| DEP-03 | part-02, part-04 | `002_indexes_and_rls.sql` (RLS policies), `authService.ts` (tenant isolation) |
| DEP-04 | part-04 | `authService.ts` (feature flag system reads deployment_mode; core features always enabled) |

## Dependency Graph (Apply Order Rationale)

```
part-01 (types)
  |
  v
part-02 (data model) -- depends on types for column/enum alignment
  |
  v
part-03 (unit tests) -- depends on types + data model interfaces
  |
  v
part-04 (services) -- depends on types, data model; tested by part-03
  |
  v
part-05 (API routes) -- depends on services + types
  |
  v
part-06 (components) -- depends on API routes + types
  |
  v
part-07 (E2E tests) -- depends on components + API running
  |
  v
part-08 (spec updates) -- depends on all parts having file:line references
```
