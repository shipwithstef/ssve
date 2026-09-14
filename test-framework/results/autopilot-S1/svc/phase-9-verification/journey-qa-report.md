# Journey QA Report

**Journey:** J1 -- Trend Discovery to Learning Path Completion
**Personas:** P1 (Priya), P4 (Sofia)
**Status:** SIMULATED (no live server)
**Date:** 2026-04-03

## Justification for Simulation

Framework test S1 is a greenfield scenario. No TrendLearner server exists to test against. Journey QA requires:

1. A running Fastify backend at localhost:3000
2. A PostgreSQL database with migrated schema
3. A Redis instance for BullMQ job processing
4. At least one platform adapter configured with valid API keys
5. A completed initial scrape cycle producing trend data

None of these prerequisites are available in the framework test environment.

## What Would Be Tested

### J1 Scenario 1: First-time user discovers trending AI topics

| Step | Action | Expected Result | ACs Exercised |
|------|--------|----------------|---------------|
| 1 | Navigate to `/` (dashboard) | Top 10 trending AI/ML topics displayed | TRN-01 |
| 2 | Inspect any trend entry | Shows title, summary, platform icons, signal strength (1-100) | TRN-02 |
| 3 | Click a trend to view detail | "Why trending" explanation with signal source citations visible | TRN-03 |
| 4 | Select a subfield filter (e.g., "NLP") | Dashboard filters to show only NLP trends; at least 8 filter categories available | TRN-04 |
| 5 | Check dashboard footer/header | Last refresh timestamp visible; format: "Last updated: [datetime]" | TRN-05 |

### J1 Scenario 2: User explores a learning path for a trending topic

| Step | Action | Expected Result | ACs Exercised |
|------|--------|----------------|---------------|
| 1 | Click "Start learning" on a trend | Learning path page loads with 3-8 curated resources | LRN-01 |
| 2 | Inspect resource ordering | Foundational/beginner resources appear before advanced ones | LRN-02 |
| 3 | Inspect any resource card | Shows title, format icon, estimated time, difficulty badge, external link | LRN-03 |
| 4 | Compare path as beginner vs advanced user | Beginner sees different resources than advanced user for same trend | LRN-04 |
| 5 | Check resource with unmet prerequisite | "Prerequisite needed" indicator visible, links to prerequisite resource | LRN-05 |

### J1 Scenario 3: User completes resources and tracks skill progression

| Step | Action | Expected Result | ACs Exercised |
|------|--------|----------------|---------------|
| 1 | Navigate to `/profile` | Skill categories displayed with self-assessment controls | SKL-01 |
| 2 | Set skill levels for 8+ categories | Profile saves; levels persisted on page reload | SKL-01 |
| 3 | Return to learning path; click "Mark complete" | Resource status changes to completed | SKL-02 |
| 4 | Navigate to `/profile` | Visual summary shows both self-assessed and inferred levels | SKL-03 |
| 5 | Verify inferred level updated | Inferred skill level for completed resource's category increased within same session | SKL-04 |

### J1 Scenario 4: User provides feedback on trends and resources

| Step | Action | Expected Result | ACs Exercised |
|------|--------|----------------|---------------|
| 1 | On dashboard, click "Not relevant" on a trend | Single-click action; feedback recorded | TRN-06 |
| 2 | On learning path, click "Not helpful" on a resource | Feedback recorded after viewing/completing resource | TRN-07 |
| 3 | Reload dashboard on subsequent visit | Trend rankings adjusted based on accumulated feedback | TRN-08 |

### J1 Scenario 5: Background scrape processing (admin verification)

| Step | Action | Expected Result | ACs Exercised |
|------|--------|----------------|---------------|
| 1 | Navigate to `/admin/scraper-status` | Per-platform scrape status displayed | SCR-03, SCR-04 |
| 2 | Click "Trigger scrape" | Immediate scrape cycle starts; status updates | SCR-03 |
| 3 | Verify signals collected | New signals appear in database with platform, content hash, relevance | SIG-01, SIG-02, SIG-04 |

## AC Coverage Matrix

| AC | Scenario | Step | QA Status |
|----|----------|------|-----------|
| TRN-01 | S1 | 1 | SIMULATED |
| TRN-02 | S1 | 2 | SIMULATED |
| TRN-03 | S1 | 3 | SIMULATED |
| TRN-04 | S1 | 4 | SIMULATED |
| TRN-05 | S1 | 5 | SIMULATED |
| TRN-06 | S4 | 1 | SIMULATED |
| TRN-07 | S4 | 2 | SIMULATED |
| TRN-08 | S4 | 3 | SIMULATED |
| LRN-01 | S2 | 1 | SIMULATED |
| LRN-02 | S2 | 2 | SIMULATED |
| LRN-03 | S2 | 3 | SIMULATED |
| LRN-04 | S2 | 4 | SIMULATED |
| LRN-05 | S2 | 5 | SIMULATED |
| SKL-01 | S3 | 1-2 | SIMULATED |
| SKL-02 | S3 | 3 | SIMULATED |
| SKL-03 | S3 | 4 | SIMULATED |
| SKL-04 | S3 | 5 | SIMULATED |
| SKL-05 | -- | -- | NOT COVERED (requires team/admin scenario not in J1) |
| SKL-06 | -- | -- | NOT COVERED (requires team/admin scenario not in J1) |
| SKL-07 | -- | -- | NOT COVERED (requires team/admin scenario not in J1) |
| DEP-01 | -- | -- | NOT COVERED (requires deployment scenario) |
| DEP-02 | -- | -- | NOT COVERED (requires private mode scenario) |
| DEP-03 | -- | -- | NOT COVERED (requires operator mode scenario) |
| DEP-04 | -- | -- | NOT COVERED (requires multi-mode comparison) |

**Covered by J1:** 17/24 ACs (71%)
**Not covered:** SKL-05, SKL-06, SKL-07 (team journey), DEP-01 through DEP-04 (deployment journey)
**Separate journeys needed:** J0-deployment (DEP ACs), J2-team-learning (SKL-05/06/07)

## Marking: JUSTIFIED SKIP (no runtime target)

This journey QA pass is marked as a justified skip because:

1. The framework test S1 scenario is greenfield with no deployed application
2. All QA procedures are documented and ready for execution when a runtime exists
3. The AC coverage matrix identifies which ACs are covered and which need additional journeys
4. No QA column updates are made to the feature spec (columns remain `:black_square_button:`)
