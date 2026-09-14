# E2E Test Plan: TrendLearner

**Framework:** Playwright with TypeScript
**Status:** OUTLINE ONLY (no codebase to generate runnable tests against)
**Date:** 2026-04-03

## Architecture

- **Base URL:** `http://localhost:3000` (configurable via `PLAYWRIGHT_BASE_URL`)
- **Test data:** Seeded via API calls in `beforeAll` hooks (not database fixtures)
- **Auth:** Tests for authenticated routes create a test user via `/api/setup` before each suite
- **Cleanup:** `afterAll` hooks delete test users and their data
- **Parallelism:** Test files run in parallel; tests within a file run sequentially

## Page Objects

| Page Object | File | Pages Covered |
|------------|------|--------------|
| `TrendDashboardPage` | `e2e/pages/TrendDashboard.ts` | `/` (dashboard) |
| `TrendDetailPanel` | `e2e/pages/TrendDetail.ts` | Slide-over panel on dashboard |
| `LearningPathPage` | `e2e/pages/LearningPath.ts` | `/trends/:id/learn` |
| `SkillProfilePage` | `e2e/pages/SkillProfile.ts` | `/profile` |
| `TeamOverviewPage` | `e2e/pages/TeamOverview.ts` | `/team` |
| `SetupWizardPage` | `e2e/pages/SetupWizard.ts` | `/setup` |

---

## Test Files That Would Be Generated

### e2e/specs/trend-discovery.spec.ts

**Suite: Trend Dashboard**

| # | Test Name | ACs | Steps | Assertions |
|---|-----------|-----|-------|------------|
| 1 | displays top 10 trending topics on dashboard | TRN-01 | Navigate to `/`; wait for trend list to load | Exactly 10 trend cards visible; each has non-empty topic title |
| 2 | shows required fields on each trend card | TRN-02 | Navigate to `/`; inspect first trend card | Card contains: title (text), summary (text), at least 1 platform icon, signal strength number (1-100) |
| 3 | shows "why trending" explanation on detail panel | TRN-03 | Click first trend card to open detail panel | Panel contains explanation text with at least one citation (e.g., "14 Reddit threads") |
| 4 | filters trends by AI/ML subfield | TRN-04 | Click subfield filter dropdown; select "NLP" | Only trends with subfield "NLP" displayed; at least 8 filter options available in dropdown |
| 5 | displays last refresh timestamp | TRN-05 | Navigate to `/`; locate refresh indicator | Timestamp visible in human-readable format; not older than 48 hours from now |
| 6 | allows rating a trend as relevant or not relevant | TRN-06 | Click "Not relevant" button on a trend card | Button state changes to "rated"; refreshing page preserves the rating |
| 7 | adjusts trend ranking based on user feedback | TRN-08 | Rate 3 trends as "not relevant"; reload page | Rated trends appear lower in ranking or are deprioritized |

### e2e/specs/learning-path.spec.ts

**Suite: Learning Path Generation and Navigation**

| # | Test Name | ACs | Steps | Assertions |
|---|-----------|-----|-------|------------|
| 1 | generates learning path with 3-8 resources | LRN-01 | Select a trend; navigate to learning path page | Between 3 and 8 resource cards displayed |
| 2 | orders resources by prerequisite logic | LRN-02 | Load learning path; read difficulty badges top to bottom | Difficulty progresses from beginner toward advanced; no advanced resource precedes its prerequisite |
| 3 | displays complete resource metadata | LRN-03 | Inspect first resource card | Card shows: title, format icon/label, estimated time (e.g., "30 min"), difficulty badge, external link (href starts with https) |
| 4 | adapts path to beginner skill profile | LRN-04 | Set profile to beginner NLP; generate NLP trend path; capture resource titles | Resources include beginner-level content; advanced-only resources absent or deprioritized |
| 5 | adapts path to advanced skill profile | LRN-04 | Set profile to advanced NLP; generate same NLP trend path; capture resource titles | Resource list differs from beginner path; includes advanced resources |
| 6 | flags resources with unmet prerequisites | LRN-05 | Set profile to beginner (no deep-learning); load path requiring deep-learning | At least one resource shows "Prerequisite needed" indicator with link to prerequisite |

### e2e/specs/skill-tracking.spec.ts

**Suite: Skill Profile and Progression**

| # | Test Name | ACs | Steps | Assertions |
|---|-----------|-----|-------|------------|
| 1 | allows self-assessment across 8+ skill categories | SKL-01 | Navigate to `/profile`; count skill category controls | At least 8 categories visible with level selector (none/beginner/intermediate/advanced) |
| 2 | persists skill self-assessment on save | SKL-01 | Set Python to "advanced", NLP to "beginner"; save; reload page | Saved levels persist after reload |
| 3 | marks resource as completed | SKL-02 | Navigate to learning path; click "Mark complete" on first resource | Resource card shows completed state; completion timestamp visible |
| 4 | shows visual skill summary with dual levels | SKL-03 | Navigate to `/profile` after completing resources | Visual chart (radar or bar) visible; shows both self-assessed and inferred levels per category |
| 5 | updates inferred skill level within same session | SKL-04 | Complete a beginner NLP resource; navigate to `/profile` without page reload | Inferred NLP skill level has increased from previous value; no page refresh required |

**Suite: Resource Feedback**

| # | Test Name | ACs | Steps | Assertions |
|---|-----------|-----|-------|------------|
| 6 | allows rating resources as helpful or not helpful | TRN-07 | Complete a resource; click "Helpful" button | Feedback button state changes; rating persisted on page reload |
| 7 | feedback influences resource quality ordering | TRN-07, TRN-08 | Rate multiple resources; regenerate learning path for same trend | Resources with "helpful" ratings appear earlier; "not helpful" resources deprioritized |

### e2e/specs/team-overview.spec.ts

**Suite: Team Overview (Admin Only)**

| # | Test Name | ACs | Steps | Assertions |
|---|-----------|-----|-------|------------|
| 1 | shows aggregate skill map for admin user | SKL-05 | Log in as admin; navigate to `/team` | Skill distribution chart visible; shows per-category distribution without individual names |
| 2 | displays team learning activity metrics | SKL-06 | Log in as admin; navigate to `/team` | Shows: completions this week (number), active learning paths (number), popular trends (list) |
| 3 | blocks member-role users from team overview | SKL-07 | Log in as member; navigate to `/team` | 403 Forbidden or redirect to `/profile`; team data not visible |
| 4 | hides team nav item for member-role users | SKL-07 | Log in as member; inspect navigation | "Team" nav item not present in sidebar/header |

### e2e/specs/deployment-setup.spec.ts (bonus -- not in J1 but covers DEP ACs)

**Suite: Deployment Configuration**

| # | Test Name | ACs | Steps | Assertions |
|---|-----------|-----|-------|------------|
| 1 | self-hosted free mode starts with docker compose | DEP-01 | (Integration test, not browser E2E) Run `docker compose up`; wait; hit `/health/ready` | Health endpoint returns 200 within 5 minutes |
| 2 | private mode supports admin and member roles | DEP-02 | Configure private mode; create admin + member users | Admin can access `/admin`; member gets 403 on `/admin` |
| 3 | operator mode isolates tenant data | DEP-03 | Create two tenants; add data to each; query as each tenant | Tenant A sees only tenant A data; tenant B sees only tenant B data |
| 4 | core features available in all deployment modes | DEP-04 | For each mode: verify `/api/trends`, `/api/learning-paths`, `/api/profile` return 200 | All three modes have identical core endpoint availability |

---

## AC-to-Test Traceability

| AC | Test File | Test # | Covered |
|----|-----------|--------|---------|
| TRN-01 | trend-discovery | 1 | Yes |
| TRN-02 | trend-discovery | 2 | Yes |
| TRN-03 | trend-discovery | 3 | Yes |
| TRN-04 | trend-discovery | 4 | Yes |
| TRN-05 | trend-discovery | 5 | Yes |
| TRN-06 | trend-discovery | 6 | Yes |
| TRN-07 | skill-tracking | 6 | Yes |
| TRN-08 | trend-discovery | 7, skill-tracking 7 | Yes |
| LRN-01 | learning-path | 1 | Yes |
| LRN-02 | learning-path | 2 | Yes |
| LRN-03 | learning-path | 3 | Yes |
| LRN-04 | learning-path | 4, 5 | Yes (two tests: beginner + advanced) |
| LRN-05 | learning-path | 6 | Yes |
| SKL-01 | skill-tracking | 1, 2 | Yes |
| SKL-02 | skill-tracking | 3 | Yes |
| SKL-03 | skill-tracking | 4 | Yes |
| SKL-04 | skill-tracking | 5 | Yes |
| SKL-05 | team-overview | 1 | Yes |
| SKL-06 | team-overview | 2 | Yes |
| SKL-07 | team-overview | 3, 4 | Yes (two tests: API block + UI hide) |
| DEP-01 | deployment-setup | 1 | Yes (integration test) |
| DEP-02 | deployment-setup | 2 | Yes |
| DEP-03 | deployment-setup | 3 | Yes |
| DEP-04 | deployment-setup | 4 | Yes |

**Coverage: 24/24 ACs mapped to at least one test case (100%)**

## Framework Test Notes

- These are test OUTLINES, not runnable Playwright code
- In a real execution, Skill 17 would generate `.spec.ts` files with actual Playwright selectors, assertions, and page object interactions
- The outlines verify that the E2E test PLAN covers all ACs and that test design is sound
- Generating runnable code requires a live application with known DOM structure and API responses
- **Marking: REAL ARTIFACT (outline is the deliverable for a framework test; runnable code requires codebase)**
