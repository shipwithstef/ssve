# G4 Gate Review: Technical Design -- Trend-to-Learning Recommendation

**Artifact:** technical-design-trend-learning.md
**Gate:** G4 (Technical Design Review)
**Reviewer:** Self-review + simulated cross-review
**Date:** 2026-04-03

---

## Step 1: Self-Review Findings

### Finding: G4-001
- **Severity:** medium
- **Location:** Section 3 (Data Model) -- `cached_learning_paths` table
- **Description:** Learning path cache key uses `user_skill_hash` but does not account for resource catalog changes or trend data updates.
- **Justification:** If the ContentAggregator indexes new resources for a trend, cached paths will serve stale resource lists until the 24h TTL expires. Users could miss newly discovered high-quality resources for up to a day.
- **Suggested fix:** Add `resource_catalog_version` column to the cache key, or invalidate cached paths when `learning_resources` rows are inserted for the associated trend_id.

### Finding: G4-002
- **Severity:** medium
- **Location:** Section 5 (Deployment Mode Architecture) -- SQLite fallback
- **Description:** SQLite fallback for self-hosted free mode is mentioned but the data model uses PostgreSQL-specific features (RLS, gen_random_uuid(), JSONB, partial indexes).
- **Justification:** Drizzle ORM can abstract some differences, but RLS is PostgreSQL-only (not needed for single-user SQLite) and gen_random_uuid() requires a polyfill. The feasibility matrix does not flag SQLite compatibility as a risk for any AC.
- **Suggested fix:** Document explicitly which features degrade in SQLite mode (no RLS, UUID generated in application layer, JSON stored as TEXT with application-level parsing). Add a compatibility test suite that runs the core AC tests against both database backends.

### Finding: G4-003
- **Severity:** low
- **Location:** Section 7 (Feasibility Matrix) -- SIG-05
- **Description:** The 90% precision target for domain relevance filtering requires a manually labeled validation set of 200 signals, but no plan exists for creating or maintaining this dataset.
- **Justification:** Without the labeled dataset, the precision target is untestable. This is a data dependency that blocks validation of the filtering pipeline, though it does not block initial development.
- **Suggested fix:** Add a seed task in the implementation plan to create the initial 200-signal labeled dataset from HN and Reddit data during the first scrape cycles. Store labels in a `validation_signals` table or JSON fixture file.

### Finding: G4-004
- **Severity:** medium
- **Location:** Section 4 (API Design) -- Learning path generation
- **Description:** `GET /api/learning-paths/:trendId` performs a potentially expensive LLM call on a GET request, which violates HTTP semantics (GET should be idempotent and side-effect-free from the caller's perspective).
- **Justification:** While caching makes subsequent calls fast, the first call for a given trend+skill combination triggers LLM generation that takes 2-5 seconds and costs money. This could cause timeout issues for clients expecting fast GET responses and complicates retry logic.
- **Suggested fix:** Split into two endpoints: `POST /api/learning-paths/generate` to trigger generation (returns job ID), and `GET /api/learning-paths/:trendId` to retrieve a completed path. Frontend polls or uses SSE for completion. Alternatively, keep single GET but document the behavior and set appropriate timeout headers.

### Finding: G4-005
- **Severity:** low
- **Location:** Section 8 (External Service Integration) -- LinkedIn API
- **Description:** LinkedIn Marketing API has 100 requests/day rate limit and requires OAuth2 app approval with restricted access for scraping use cases.
- **Justification:** LinkedIn's API terms of service restrict automated data collection. The 100 req/day limit severely constrains signal volume compared to other platforms. The adapter may provide minimal value relative to integration effort.
- **Suggested fix:** Deprioritize LinkedIn adapter to post-MVP. Document in implementation plan that LinkedIn requires partnership approval. Consider RSS-based LinkedIn content monitoring as a lower-effort alternative.

---

## Step 2: Self-Judgment

| Finding | Verdict | Analysis |
|---------|---------|----------|
| G4-001 | ACCEPT | Cache invalidation is a real concern. The suggested fix (invalidate on resource insert) is straightforward and prevents stale learning paths. Should be implemented during the caching layer build. |
| G4-002 | ACCEPT | SQLite compatibility is a stated feature of the architecture but the data model does not address it. Documenting the degradation path and adding a compatibility test suite is the right approach. This does not block design approval since SQLite is a secondary path. |
| G4-003 | ACCEPT | Low severity because it is a data dependency, not an architecture problem. The labeled dataset can be created incrementally during development. Adding it as a seed task is sufficient. |
| G4-004 | ACCEPT | Valid HTTP semantics concern. However, the single GET with caching is a common pragmatic pattern (similar to how CDNs handle cache-miss-triggers-origin). Documenting the behavior is the minimum fix. The POST+poll pattern is better for operator mode where cost matters. Recommend the POST+poll approach for V1. |
| G4-005 | ACCEPT | LinkedIn is the weakest platform adapter by value-to-effort ratio. Deprioritizing to post-MVP is sensible. The remaining 4 platforms (especially HN + Reddit) provide sufficient signal diversity for launch. |

---

## Step 3: Cross-Review Summary

Simulating a cross-reviewer perspective, the following additional observations emerge:

**Observation CR-1 (not a finding):** The technology decisions table is well-reasoned. Fastify over Express, Drizzle over Prisma, and BullMQ over node-cron are defensible choices with clear rationale. No issues found.

**Observation CR-2 (not a finding):** The component table lists 21 components covering all screens, services, and data concerns. Coverage is thorough. The separation of TrendScraper, TrendAnalyzer, RecommendationEngine, and ContentAggregator aligns with the vision's "composable over monolithic" principle.

**Observation CR-3 (informational):** The data model includes 8 tables with appropriate indexes. The `trend_feedback` and `user_progress` tables correctly support the feedback loop (TRN-06, TRN-07, TRN-08). The UNIQUE constraints prevent duplicate feedback, which is correct behavior.

**Observation CR-4 (informational):** The feasibility matrix maps all 30 ACs (24 feature + 6 enabler) to technical approaches with complexity and risk ratings. High-risk items (LRN-01 learning path generation, DEP-03 multi-tenancy, SIG-04 domain filtering) are correctly identified. No missing ACs.

**No additional findings beyond the 5 identified in self-review.** The cross-reviewer concurs with the self-review findings and verdicts.

---

## Step 4: Convergence Check

| Finding | Severity | Status |
|---------|----------|--------|
| G4-001 | medium | Accepted -- fix during implementation |
| G4-002 | medium | Accepted -- document + test suite |
| G4-003 | low | Accepted -- seed task for labeled data |
| G4-004 | medium | Accepted -- adopt POST+poll for V1 |
| G4-005 | low | Accepted -- deprioritize LinkedIn to post-MVP |

**No critical or high severity findings remain.** All 5 findings are medium or low severity with clear, actionable fixes that can be addressed during implementation without requiring architectural changes.

---

## Step 5: Gate Decision

**PASS**

**Justification:** The technical design comprehensively covers the full architecture for a greenfield project. All 30 acceptance criteria from the feature spec and enabler spec are mapped to feasible technical approaches. The three deployment modes are addressed as first-class architectural concerns with a clear feature flag matrix. The data model supports all user stories and the API design covers all journey flows identified in the UX design.

The 5 accepted findings are implementation-level refinements (cache invalidation, SQLite compatibility documentation, labeled dataset creation, HTTP method semantics, and LinkedIn deprioritization). None of them require rethinking the architecture or blocking progression to implementation.

The design is ready for Phase 7 (implementation planning and code generation).
