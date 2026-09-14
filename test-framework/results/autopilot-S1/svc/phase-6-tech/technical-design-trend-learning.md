# Technical Design: Trend-to-Learning Recommendation

**Feature:** feature-trend-learning
**Enabler:** enabler-trend-scraper
**Status:** DRAFT
**Gate:** G4 (Technical Design Review)

---

## 1. Architecture Overview

TrendLearner is a greenfield monorepo application with a modular service architecture. The system is designed to run identically across three deployment modes from a single codebase.

**Stack:**
- **Frontend:** React 18 + TypeScript, built with Vite, SPA with client-side routing (React Router)
- **Backend:** Node.js 20 + TypeScript, Fastify framework (chosen over Express for schema-based validation and superior performance)
- **Database:** PostgreSQL 16 for persistence, Redis 7 for caching and job queues
- **Job Processing:** BullMQ (Redis-backed) for scrape scheduling and async learning path generation
- **LLM Integration:** OpenAI-compatible API client (supports OpenAI, Anthropic via adapter, local models via Ollama)
- **Deployment:** Docker Compose (primary), Helm chart (enterprise), single-binary option (SQLite fallback)

**Monorepo Structure:**
```
trendlearner/
  packages/
    frontend/          # React SPA
    backend/           # Fastify API server
    scraper/           # Platform adapters and scrape orchestrator
    analyzer/          # Trend synthesis and topic extraction
    recommender/       # Learning path generation and personalization
    shared/            # TypeScript types, constants, skill taxonomy
  docker/
    docker-compose.yml         # Self-hosted free
    docker-compose.private.yml # Self-hosted private (adds LDAP, multi-user)
    docker-compose.operator.yml # Hosted-for-profit (adds multi-tenancy)
  helm/
    trendlearner/      # Kubernetes Helm chart for enterprise
  migrations/          # PostgreSQL migration files (node-pg-migrate)
  seed/                # Seed data: skill taxonomy, keyword lists, sample trends
```

All packages share TypeScript configuration and are managed with npm workspaces. The backend, scraper, analyzer, and recommender run in a single Node.js process by default (self-hosted free) but can be split into separate containers for horizontal scaling (operator mode).

---

## 2. Component Table

| # | Component | Type | Responsibility | New/Modify |
|---|-----------|------|---------------|------------|
| 1 | TrendDashboard | Frontend page | Render ranked trend list with filters, signal strength, platform icons, relevance rating [S1] | New |
| 2 | TrendDetail | Frontend panel | Slide-over panel showing "Why trending" explanation, source breakdown, "Start learning" action [S2] | New |
| 3 | LearningPath | Frontend page | Ordered resource list with difficulty, format, time, prerequisite warnings, completion toggles [S3] | New |
| 4 | SkillProfile | Frontend page | Skill self-assessment, visual summary (radar chart + bars), recent completions [S4] | New |
| 5 | SetupWizard | Frontend page | 4-step deployment configuration: mode, API keys, platforms, confirm [S5] | New |
| 6 | TeamOverview | Frontend page | Aggregate skill map, team activity metrics, popular trends (admin-only) [S6] | New |
| 7 | AppShell | Frontend layout | Navigation, theme toggle, responsive layout, keyboard shortcuts (j/k navigation) | New |
| 8 | TrendRoutes | Backend API | `/api/trends` endpoints: list, detail, filter, rate. Reads from DB, returns cached or fresh data | New |
| 9 | LearningRoutes | Backend API | `/api/learning-paths` endpoints: generate, retrieve, track progress. Calls RecommendationEngine | New |
| 10 | UserRoutes | Backend API | `/api/profile` endpoints: get/update skill profile, track completions, feedback | New |
| 11 | AdminRoutes | Backend API | `/api/admin` endpoints: scraper status, trigger scrape, user management, tenant management | New |
| 12 | TeamRoutes | Backend API | `/api/team` endpoints: aggregate skill map, activity summary. Requires admin role | New |
| 13 | SetupRoutes | Backend API | `/api/setup` endpoints: deployment config, API key validation, platform toggle | New |
| 14 | TrendScraper | Service | Orchestrates platform adapters on configurable cadence. Collects, deduplicates, persists raw signals | New |
| 15 | PlatformAdapter (x5) | Service module | Per-platform API client: Twitter/X, Reddit, HN, LinkedIn, YouTube. Common interface: scrape, normalize | New |
| 16 | TrendAnalyzer | Service | Synthesizes raw signals into ranked trends. Keyword + LLM filtering for domain relevance. Generates "Why trending" explanations | New |
| 17 | RecommendationEngine | Service | Generates personalized learning paths from trend + user skill profile. Calls LLM for resource matching and ordering | New |
| 18 | ContentAggregator | Service | Discovers and indexes learning resources from external sources. Maintains resource catalog with metadata | New |
| 19 | AuthService | Service | JWT authentication (hosted/private modes), API key auth (admin), optional bypass (self-hosted free single-user) | New |
| 20 | MigrationRunner | Data | PostgreSQL schema migrations via node-pg-migrate. Runs on startup | New |
| 21 | SeedData | Data | Skill taxonomy (8+ categories with prerequisites), AI/ML keyword lists, platform config defaults | New |

---

## 3. Data Model

### PostgreSQL Tables

```sql
-- Core user table; deployment_mode stored at instance level in config, not per-user
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE,
    display_name    VARCHAR(100),
    role            VARCHAR(20) DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    skills_json     JSONB DEFAULT '{}',       -- {category: {self_assessed: level, inferred: level}}
    tenant_id       UUID,                      -- NULL for self-hosted; set for multi-tenant
    preferences_json JSONB DEFAULT '{}',       -- feedback weights, UI preferences
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_users_tenant ON users(tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX idx_users_email ON users(email);

-- Synthesized trends (output of TrendAnalyzer)
CREATE TABLE trends (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic           VARCHAR(300) NOT NULL,
    summary         TEXT NOT NULL,              -- one-sentence summary
    why_trending    TEXT,                       -- 2-3 sentence explanation with citations
    subfield        VARCHAR(50),               -- NLP, computer vision, MLOps, etc.
    signal_strength INTEGER CHECK (signal_strength BETWEEN 0 AND 100),
    status          VARCHAR(20) DEFAULT 'stable' CHECK (status IN ('hot','rising','stable','fading')),
    platforms_json  JSONB DEFAULT '[]',         -- [{platform, mention_count, latest_signal_at}]
    first_seen      TIMESTAMPTZ DEFAULT NOW(),
    last_updated    TIMESTAMPTZ DEFAULT NOW(),
    scrape_cycle_id UUID                        -- links to the scrape cycle that produced this trend
);
CREATE INDEX idx_trends_subfield ON trends(subfield);
CREATE INDEX idx_trends_signal ON trends(signal_strength DESC);
CREATE INDEX idx_trends_last_updated ON trends(last_updated DESC);

-- Learning resources discovered by ContentAggregator
CREATE TABLE learning_resources (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trend_id        UUID REFERENCES trends(id) ON DELETE SET NULL,
    title           VARCHAR(500) NOT NULL,
    url             TEXT NOT NULL,
    type            VARCHAR(30) CHECK (type IN ('tutorial','paper','video','repo','course','article')),
    difficulty      VARCHAR(20) CHECK (difficulty IN ('beginner','intermediate','advanced')),
    estimated_minutes INTEGER,
    source          VARCHAR(100),               -- where the resource was found
    quality_score   REAL DEFAULT 0.5,           -- 0-1, adjusted by user feedback
    prerequisites   JSONB DEFAULT '[]',         -- list of skill category requirements
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_resources_trend ON learning_resources(trend_id);
CREATE INDEX idx_resources_difficulty ON learning_resources(difficulty);

-- User progress on learning resources
CREATE TABLE user_progress (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    resource_id     UUID REFERENCES learning_resources(id) ON DELETE CASCADE,
    trend_id        UUID REFERENCES trends(id) ON DELETE SET NULL,
    status          VARCHAR(20) DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','completed')),
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    feedback        VARCHAR(20) CHECK (feedback IN ('helpful','not_helpful')),
    UNIQUE(user_id, resource_id)
);
CREATE INDEX idx_progress_user ON user_progress(user_id);
CREATE INDEX idx_progress_status ON user_progress(user_id, status);

-- Raw signals from social platforms (input to TrendAnalyzer)
CREATE TABLE scraped_signals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform        VARCHAR(30) NOT NULL,
    original_url    TEXT,
    title           VARCHAR(500),
    body_text       TEXT,                       -- truncated to 2000 chars
    author_id       VARCHAR(255),
    engagement_count INTEGER DEFAULT 0,         -- normalized likes+upvotes+reactions
    comment_count   INTEGER DEFAULT 0,
    content_hash    VARCHAR(64) NOT NULL,       -- SHA-256 for dedup
    topic_extracted VARCHAR(300),               -- AI/ML topic assigned by analyzer
    is_relevant     BOOLEAN,                    -- domain relevance classification result
    relevance_method VARCHAR(20),               -- 'keyword' or 'llm'
    published_at    TIMESTAMPTZ,
    scraped_at      TIMESTAMPTZ DEFAULT NOW(),
    scrape_cycle_id UUID
);
CREATE UNIQUE INDEX idx_signals_hash ON scraped_signals(content_hash);
CREATE INDEX idx_signals_platform ON scraped_signals(platform, scraped_at DESC);
CREATE INDEX idx_signals_relevant ON scraped_signals(is_relevant) WHERE is_relevant = true;

-- Trend feedback from users
CREATE TABLE trend_feedback (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    trend_id        UUID REFERENCES trends(id) ON DELETE CASCADE,
    rating          VARCHAR(20) CHECK (rating IN ('relevant','not_relevant')),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, trend_id)
);
CREATE INDEX idx_feedback_trend ON trend_feedback(trend_id);

-- Cached learning paths to avoid repeated LLM calls
CREATE TABLE cached_learning_paths (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trend_id        UUID REFERENCES trends(id) ON DELETE CASCADE,
    user_skill_hash VARCHAR(64),               -- hash of user skill profile for cache keying
    resources_json  JSONB NOT NULL,             -- ordered list of resource IDs
    generated_at    TIMESTAMPTZ DEFAULT NOW(),
    expires_at      TIMESTAMPTZ                 -- cache TTL, default 24h
);
CREATE INDEX idx_cached_paths_lookup ON cached_learning_paths(trend_id, user_skill_hash);

-- Deployment configuration (single row for self-hosted, per-tenant for operator)
CREATE TABLE deployment_config (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID,
    deployment_mode VARCHAR(30) CHECK (deployment_mode IN ('self_hosted_free','self_hosted_private','hosted_for_profit')),
    config_json     JSONB NOT NULL,             -- API keys (encrypted), platform toggles, cadence
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### Key Relationships
- `trends` 1:N `learning_resources` (a trend has many resources)
- `users` 1:N `user_progress` (a user has many progress records)
- `learning_resources` 1:N `user_progress` (a resource has many progress records)
- `users` 1:N `trend_feedback` (a user can rate many trends)
- `trends` 1:N `cached_learning_paths` (a trend can have cached paths for different skill profiles)
- `scraped_signals` N:1 `scrape_cycle_id` (many signals per scrape cycle)

---

## 4. API Design

### Trend Endpoints

| Method | Path | Description | Auth | ACs |
|--------|------|-------------|------|-----|
| GET | `/api/trends` | List top trends, sorted by signal strength. Query params: `subfield`, `status`, `limit` (default 10), `offset` | Optional | TRN-01, TRN-02, TRN-04 |
| GET | `/api/trends/:id` | Trend detail with "why trending" explanation and source breakdown | Optional | TRN-03 |
| POST | `/api/trends/:id/rate` | Rate a trend as relevant/not_relevant. Body: `{rating}` | Required | TRN-06 |
| GET | `/api/trends/refresh-status` | Last refresh timestamp, next scheduled refresh, per-platform status | Optional | TRN-05 |

### Learning Path Endpoints

| Method | Path | Description | Auth | ACs |
|--------|------|-------------|------|-----|
| GET | `/api/learning-paths/:trendId` | Get or generate a personalized learning path for a trend. Uses cached path if available; generates via LLM if not | Required | LRN-01, LRN-02, LRN-04 |
| GET | `/api/learning-paths/:trendId/resources` | List resources in a learning path with user progress | Required | LRN-03, LRN-05 |
| POST | `/api/progress` | Track resource completion or status change. Body: `{resource_id, status}` | Required | SKL-02, SKL-04 |
| POST | `/api/progress/:resourceId/feedback` | Rate a resource as helpful/not_helpful. Body: `{feedback}` | Required | TRN-07 |

### User Profile Endpoints

| Method | Path | Description | Auth | ACs |
|--------|------|-------------|------|-----|
| GET | `/api/profile` | Get current user's skill profile, self-assessed and inferred levels | Required | SKL-03 |
| PUT | `/api/profile` | Update skill self-assessments. Body: `{skills: {category: level}}` | Required | SKL-01 |
| GET | `/api/profile/completions` | Recent completions with timestamps | Required | SKL-04 |

### Team Endpoints

| Method | Path | Description | Auth | ACs |
|--------|------|-------------|------|-----|
| GET | `/api/team/skills` | Aggregate skill distribution across team members (no individual data) | Admin | SKL-05 |
| GET | `/api/team/activity` | Team learning activity: completions, active paths, popular trends | Admin | SKL-06 |

### Setup and Admin Endpoints

| Method | Path | Description | Auth | ACs |
|--------|------|-------------|------|-----|
| GET | `/api/setup` | Get current deployment configuration | Admin | DEP-01, DEP-02, DEP-03 |
| POST | `/api/setup` | Save deployment configuration (mode, API keys, platforms, cadence) | Admin | DEP-01, DEP-02, DEP-03 |
| POST | `/api/setup/validate-key` | Validate an API key for a given platform. Body: `{platform, key}` | Admin | DEP-01 |
| GET | `/api/admin/scraper-status` | Scraper health: last run, signals per platform, errors | Admin | SCR-03, SCR-04 |
| POST | `/api/admin/trigger-scrape` | Trigger an immediate scrape cycle | Admin | SCR-03 |
| GET | `/api/admin/users` | List users (private/operator modes only) | Admin | DEP-02 |

### Response Conventions
- All responses wrapped in `{data, meta, errors}` envelope
- Pagination via `limit`/`offset` with `meta.total` count
- Error responses follow RFC 7807 Problem Details format
- Rate limiting headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

---

## 5. Deployment Mode Architecture

### Self-Hosted Free (P1: Priya)

```
docker compose up
```

- Single `docker-compose.yml` with 3 containers: app (backend+frontend), postgres, redis
- All services run in one Node.js process (no inter-service networking)
- API keys provided via `.env` file (BYOK)
- SQLite fallback available via `DB_TYPE=sqlite` env var for minimal setups (no postgres container needed)
- Single-user by default; no authentication required
- All data local; no external telemetry unless opted in
- Scraper, analyzer, recommender run in-process on BullMQ scheduled jobs

### Hosted-for-Profit (P3: Rahul)

```
docker compose -f docker-compose.yml -f docker-compose.operator.yml up
```

- Multi-tenant: `tenant_id` column on users, progress, feedback tables
- Row-level security (RLS) in PostgreSQL enforces tenant isolation
- Operator admin panel at `/admin` route (separate React bundle)
- Shared scraper: runs once, all tenants share trend data (scraping is not per-tenant)
- Per-tenant: user profiles, skill progress, learning paths, feedback
- Billing hooks: webhook events for user signup, resource completion (for usage-based billing)
- Operator-managed API keys (tenants do not provide their own)
- Horizontal scaling: backend can run multiple replicas behind a load balancer; Redis provides session/cache sharing

### Self-Hosted Private (P2: Daniel)

```
docker compose -f docker-compose.yml -f docker-compose.private.yml up
# OR: helm install trendlearner ./helm/trendlearner
```

- Multi-user with role-based access: admin and member roles
- Authentication: JWT-based with configurable identity provider
- LDAP/SSO support via Passport.js strategies (SAML, OIDC)
- Admin manages shared API keys; members do not see keys
- Team overview (S6) available to admin role
- Air-gapped support: all dependencies bundled in container images; no runtime external calls except configured API endpoints
- Helm chart for Kubernetes deployment with configurable resource limits, PVCs, ingress

### Feature Flag Matrix

| Feature | Self-Hosted Free | Self-Hosted Private | Hosted-for-Profit |
|---------|-----------------|--------------------|--------------------|
| Trend browsing | Yes | Yes | Yes |
| Learning paths | Yes | Yes | Yes |
| Skill tracking | Yes | Yes | Yes |
| Feedback | Yes | Yes | Yes |
| Authentication | None (single-user) | JWT + LDAP/SSO | JWT (multi-tenant) |
| Team overview | No | Yes (admin) | Yes (org admin) |
| User management | No | Yes (admin) | Yes (operator) |
| Tenant isolation | N/A | N/A | RLS per tenant |
| API key management | User-managed (.env) | Admin-managed (UI) | Operator-managed |
| Billing hooks | No | No | Yes |

---

## 6. Technology Decisions

| Decision | Options Considered | Chosen | Rationale |
|----------|-------------------|--------|-----------|
| Backend framework | Express, Fastify, Hono | Fastify | Schema-based request/response validation, superior performance, first-class TypeScript support, plugin architecture for modular route registration |
| Frontend framework | Next.js, Vite+React, Remix | Vite + React SPA | No SSR needed (data is API-driven, not SEO-critical). Simpler deployment (static files served by backend). Lower complexity for self-hosted mode |
| Database | PostgreSQL, SQLite, MongoDB | PostgreSQL (primary) + SQLite (fallback) | PostgreSQL provides JSONB, RLS for multi-tenancy, full-text search. SQLite fallback reduces self-hosted free complexity |
| Job queue | BullMQ, Agenda, node-cron | BullMQ | Redis-backed, persistent jobs survive restarts, built-in retry/backoff, dashboard UI available. Proven at scale for operator mode |
| ORM / Query | Prisma, Drizzle, Knex, raw SQL | Drizzle ORM | Type-safe, lightweight, supports both PostgreSQL and SQLite, no heavy runtime. Generates clean SQL |
| LLM client | OpenAI SDK, LangChain, custom | OpenAI-compatible client + adapter pattern | OpenAI API is the de facto standard. Adapter supports Anthropic, Ollama, and any OpenAI-compatible endpoint. Avoids LangChain complexity |
| Monorepo tooling | Turborepo, Nx, npm workspaces | npm workspaces + Turborepo | npm workspaces for dependency management, Turborepo for build caching and task orchestration. Minimal config overhead |
| CSS approach | Tailwind, CSS Modules, styled-components | Tailwind CSS | Aligns with design system tokens, utility-first matches developer-tool aesthetic, excellent dark mode support, small production bundle |
| Authentication | Passport.js, Auth0, custom JWT | Passport.js + custom JWT | Self-contained (no external service dependency), supports LDAP/SAML/OIDC strategies for enterprise, JWT for stateless API auth |
| Migration tool | Prisma Migrate, node-pg-migrate, Drizzle Kit | Drizzle Kit | Integrated with chosen ORM, generates SQL migrations, supports both PostgreSQL and SQLite |

---

## 7. Feasibility Matrix

| AC ID | Technical Approach | Complexity | Risk | Dependencies |
|-------|-------------------|------------|------|-------------|
| TRN-01 | TrendAnalyzer aggregates signals into ranked trends table; API serves top 10 sorted by signal_strength, filtered by last_updated > 48h | Medium | Low | TrendScraper, TrendAnalyzer |
| TRN-02 | Each trend row stores summary, platforms_json, signal_strength; frontend TrendCard renders all fields | Low | Low | None (pure rendering) |
| TRN-03 | TrendAnalyzer generates why_trending via LLM prompt with signal counts as context; stored in trends table | Medium | Medium -- LLM quality varies | LLM API availability |
| TRN-04 | Subfield assigned during analysis; API filter param on GET /trends; frontend FilterBar | Low | Low | Subfield taxonomy (seed data) |
| TRN-05 | BullMQ cron job triggers scrape cycle; refresh_status endpoint returns last run time; frontend polls or uses SSE | Low | Low | BullMQ, Redis |
| TRN-06 | POST /trends/:id/rate upserts trend_feedback row; future trend ranking weights feedback | Low | Low | None |
| TRN-07 | POST /progress/:id/feedback upserts user_progress.feedback; used in quality_score adjustment | Low | Low | None |
| TRN-08 | Trend ranking query incorporates user's feedback history as a weight modifier; resource ordering adjusted similarly | Medium | Medium -- personalization tuning | Feedback accumulation over time |
| LRN-01 | RecommendationEngine calls LLM with trend topic + resource catalog to select 3-8 resources; cached in cached_learning_paths | High | High -- core feature, LLM-dependent | LLM API, ContentAggregator |
| LRN-02 | Prerequisite ordering defined in skill taxonomy; resources sorted topologically by difficulty and prerequisites | Medium | Low | Skill taxonomy definition |
| LRN-03 | Resource metadata (type, difficulty, estimated_minutes, url) stored in learning_resources; rendered by LearningPathCard | Low | Low | ContentAggregator populates data |
| LRN-04 | User skill profile passed to LLM prompt as context; path generation filters resources by user level | Medium | Medium -- LLM prompt engineering | User profile, LLM quality |
| LRN-05 | Prerequisites defined per resource; compared against user skills_json; flagged in API response | Medium | Low | Skill taxonomy |
| SKL-01 | PUT /api/profile saves skills_json with per-category self-assessed levels; 8+ categories from seed taxonomy | Low | Low | Taxonomy seed data |
| SKL-02 | POST /api/progress marks resource complete; triggers skill inference update | Low | Low | None |
| SKL-03 | GET /api/profile returns both self_assessed and inferred levels; frontend renders dual bars / radar chart | Low | Low | Chart library (Recharts) |
| SKL-04 | On resource completion, backend recalculates inferred skill level for relevant category; returned in same response | Medium | Low | Inference algorithm design |
| SKL-05 | GET /api/team/skills aggregates users.skills_json across team; returns distribution per category, no individual data | Medium | Low | Multiple users with profiles |
| SKL-06 | GET /api/team/activity queries user_progress and trends for current week; returns summary metrics | Low | Low | None |
| SKL-07 | AuthService middleware checks role=admin; returns 403 for non-admin; frontend conditionally shows Team nav item | Low | Low | Auth middleware |
| DEP-01 | docker-compose.yml bundles app+postgres+redis; .env.example documents required keys; health check confirms startup < 5 min | Low | Low | Docker |
| DEP-02 | Private compose adds auth config; admin user seeded on first run; member invites via admin panel | Medium | Low | Auth, user management UI |
| DEP-03 | Operator compose enables RLS, tenant creation API, billing webhooks; shared scraper, per-tenant data | High | Medium -- RLS correctness critical | PostgreSQL RLS, multi-tenant testing |
| DEP-04 | Feature flag system reads deployment_mode; core features always enabled; mode-specific features gated | Low | Low | Config system |
| SCR-01 | 5 PlatformAdapter modules implementing common interface; adapter registry with enable/disable config | Medium | Medium -- 5 APIs to integrate | Platform API access and keys |
| SCR-02 | Each adapter queries last 48h content using platform-specific search (subreddits, hashtags, channels) | Medium | Medium -- API-specific quirks | Platform API documentation |
| SCR-03 | BullMQ repeatable job, default 24h; scrape orchestrator calls enabled adapters sequentially; < 30 min target | Low | Low | BullMQ |
| SCR-04 | Try/catch per adapter; failures logged, remaining adapters continue; status recorded in scrape_cycle metadata | Low | Low | Error handling patterns |
| SCR-05 | Per-adapter rate limiter (bottleneck library); configurable limits with 20% safety margin; rate limit events logged | Medium | Low | bottleneck library |
| SCR-06 | Adapter registry reads config; disabled adapters skipped; minimum 1 required (validated at setup) | Low | Low | Config validation |
| SIG-01 | Common NormalizedSignal TypeScript interface; each adapter maps platform response to common schema | Medium | Low | TypeScript types |
| SIG-02 | SHA-256 content hash; UNIQUE index on content_hash; ON CONFLICT DO NOTHING for dedup | Low | Low | None |
| SIG-03 | BullMQ cron job purges signals older than retention period (default 30 days) | Low | Low | BullMQ |
| SIG-04 | Two-pass filter: keyword match first (fast, local), then LLM classification for ambiguous signals | Medium | Medium -- LLM cost at scale | LLM API, keyword list maintenance |
| SIG-05 | Validation set of 200 labeled signals; precision measured in CI/CD test suite; threshold: 90% | Medium | Medium -- requires labeled data | Manual labeling effort |
| SIG-06 | Filtered-out signals logged with classification reason; admin endpoint exposes filter log | Low | Low | Logging infrastructure |

---

## 8. External Service Integration

### Social Media APIs

| Platform | API | Auth | Rate Limit | Fallback |
|----------|-----|------|-----------|----------|
| Hacker News | Algolia HN Search API | None (public) | 10,000 req/hr | Primary MVP platform; most reliable |
| Reddit | Reddit Data API (OAuth2) | BYOK client ID + secret | 100 req/min | Degrade to HN-only if unavailable |
| Twitter/X | X API v2 (Bearer token) | BYOK bearer token | 300 req/15min (Basic) | Skip platform; log warning |
| LinkedIn | LinkedIn Marketing API | BYOK OAuth2 token | 100 req/day | Skip platform; lowest priority |
| YouTube | YouTube Data API v3 | BYOK API key | 10,000 units/day | Skip platform; search quota is limiting |

**Adapter failure strategy:** Each adapter is independent. If a platform API fails, the scraper logs the error, marks that platform as degraded in scraper status, and continues with remaining platforms. Trends are still generated from available signals. The dashboard shows reduced source icons for trends affected by missing platforms.

### LLM API Integration

- **Primary use cases:** (1) Why-trending explanation generation, (2) Learning path resource selection and ordering, (3) Domain relevance classification for ambiguous signals
- **Provider:** OpenAI-compatible endpoint configured via `LLM_BASE_URL` and `LLM_API_KEY` env vars
- **Model:** Configurable; default `gpt-4o-mini` for cost efficiency; `gpt-4o` recommended for higher quality
- **Cost control:** Cached results in `cached_learning_paths` table (TTL 24h); keyword pre-filter reduces LLM calls for signal classification by 70-80%; batch processing for explanations
- **Fallback:** If LLM is unavailable, learning path generation returns an error with retry; trend browsing continues with pre-generated explanations; signal classification falls back to keyword-only mode

### Content Sources for Learning Resources

- ContentAggregator indexes resources from: scraped signal URLs (papers, tutorials linked in social posts), curated seed list of high-quality AI/ML course platforms (fast.ai, coursera, arxiv, GitHub trending), and LLM-suggested resources during path generation
- Resources are ranked by: recency, engagement signals from source platform, user feedback (quality_score), and difficulty-level match

---

## 9. Security Considerations

### API Key Storage
- API keys for social platforms and LLM providers stored in `deployment_config.config_json`
- Encrypted at rest using AES-256-GCM with a deployment-specific master key derived from `ENCRYPTION_KEY` env var
- Keys never returned in API responses (masked to last 4 chars)
- In operator mode, operator keys are isolated from tenant access; tenants never see or manage API keys

### Authentication
- **Self-hosted free:** No authentication by default (single-user assumed). Optional basic auth via env var `AUTH_ENABLED=true`
- **Self-hosted private:** JWT tokens issued by backend; configurable identity providers via Passport.js (local username/password, LDAP, SAML, OIDC)
- **Hosted-for-profit:** JWT tokens with tenant_id claim; token validation enforces tenant isolation on every request

### Authorization
- Role-based: `admin` and `member` roles stored on user record
- Admin-only endpoints (team, setup, admin) check role in middleware
- Operator mode adds `operator` super-admin role for cross-tenant management

### Input Validation
- Fastify schema-based validation on all request bodies and query params
- SQL injection prevented by parameterized queries (Drizzle ORM)
- XSS prevented by React's default escaping; CSP headers configured
- URL validation on learning resource links (must be HTTPS)

### Rate Limiting
- API rate limiting via `@fastify/rate-limit` plugin
- Default: 100 req/min per IP (self-hosted free), 60 req/min per user (hosted modes)
- Scraper rate limiting per platform adapter via bottleneck library
- LLM API calls rate-limited to prevent cost runaway (configurable per-minute cap)

### Data Privacy
- Self-hosted modes: all data stays on user's infrastructure; zero external calls except configured API endpoints
- Telemetry is opt-in only (`TELEMETRY_ENABLED=false` by default)
- Team overview (SKL-05) aggregates data; individual profiles never exposed to other users
- Signal retention auto-purge (default 30 days) limits stored PII from social platforms
- GDPR consideration: user deletion cascades to all user_progress, trend_feedback, and cached paths

---

## 10. Infrastructure and Observability

### Logging
- Structured JSON logging via Pino (Fastify's default logger)
- Log levels: error, warn, info, debug (configurable via `LOG_LEVEL` env var)
- Scraper logs: per-adapter status, signal counts, rate limit events, classification decisions

### Health Checks
- `GET /health` -- basic liveness (process running)
- `GET /health/ready` -- readiness (DB connected, Redis connected, last scrape < 2x cadence)
- Docker Compose healthcheck configured on readiness endpoint

### Metrics (opt-in)
- Prometheus-compatible metrics endpoint at `/metrics`
- Key metrics: scrape duration, signals per cycle, trend count, learning path generation latency, active users
- For operator mode: per-tenant usage metrics for billing

### Error Handling
- Global error handler returns RFC 7807 Problem Details
- Unhandled rejections caught and logged
- Circuit breaker pattern on external API calls (LLM, social platform APIs) using opossum library
