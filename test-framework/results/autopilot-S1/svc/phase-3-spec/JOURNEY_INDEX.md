# Journey Index

**Last built:** 2026-04-03
**Source:** phase-3-spec feature specs
**Journey count:** 1 (additional journeys identified but not yet specified)

---

## Journeys

| ID | Journey Name | File | Personas | Features Crossed | Tier |
|----|-------------|------|----------|-----------------|------|
| J1 | Trend Discovery to Learning Path Completion | J1-trend-discovery-learning.feature.md | P1 (Priya), P4 (Sofia) | feature-trend-learning, enabler-trend-scraper | 1 — Platform-Native |

## Identified But Not Yet Specified

| ID | Journey Name | Personas | Why Deferred |
|----|-------------|----------|-------------|
| J0 | Deployment and Initial Setup | P1 (Docker), P2 (Kubernetes), P3 (Operator staging) | Requires deployment enabler specs not yet written. Covers DEP-01 through DEP-04. |
| J2 | Team Learning and Skill Gap Analysis | P2 (Daniel) | Requires team features (SKL-05, SKL-06, SKL-07) and User Profile Service enabler spec. Downstream of J1 (team members must be individual users first). |
| J3 | Operator Business Launch | P3 (Rahul) | Requires operator-mode enabler specs (multi-tenancy, billing, user management) not yet written. Parallel to J1 (evaluates end-user experience quality). |
| J4 | Career Transition Progression | P4 (Sofia) | Extended version of J1 focused on multi-month skill progression arc. Requires enabler-user-profile spec for long-term tracking. |

---

## AC Coverage Matrix

This matrix shows which ACs are exercised by J1 and flags any ACs not covered by any journey.

### feature-trend-learning.md ACs

| AC | Description | J1 Coverage | Notes |
|----|-------------|------------|-------|
| TRN-01 | Top 10 trends, 48-hour window, ranked by signal strength | Scenario 1 | Covered |
| TRN-02 | Trend entry fields: title, summary, source icons, signal strength | Scenario 1 | Covered |
| TRN-03 | "Why trending" explanation with source citations | Scenario 1 | Covered |
| TRN-04 | Filter by AI/ML subfield, 8+ categories | Scenario 1 | Covered |
| TRN-05 | Configurable refresh cadence, last-refresh timestamp | Scenario 1 | Covered |
| TRN-06 | Rate trend as relevant/not relevant | Scenario 4 | Covered |
| TRN-07 | Rate resource as helpful/not helpful | Scenario 4 | Covered |
| TRN-08 | Feedback affects future rankings | Scenario 4 | Covered |
| LRN-01 | Learning path with 3-8 curated resources | Scenario 2 | Covered |
| LRN-02 | Prerequisite-ordered resources, completed items marked | Scenario 2, 3 | Covered |
| LRN-03 | Resource fields: title, format, time, difficulty, link | Scenario 2 | Covered |
| LRN-04 | Learning path adapts to user skill profile | Scenario 2 | Covered |
| LRN-05 | Prerequisite-needed flag on advanced resources | Scenario 2 | Covered |
| SKL-01 | Skill profile with 8+ categories, 4 levels | Background | Covered (precondition) |
| SKL-02 | Mark resources as completed | Scenario 3 | Covered |
| SKL-03 | Skill profile visual summary with self-assessed and inferred | Scenario 3 | Covered |
| SKL-04 | Inferred skill level updates within same session | Scenario 3 | Covered |
| SKL-05 | Admin-only aggregate team skill map | NOT COVERED | Needs J2 (Team Learning journey) |
| SKL-06 | Team aggregate learning activity | NOT COVERED | Needs J2 (Team Learning journey) |
| SKL-07 | Admin role required for team overview access | NOT COVERED | Needs J2 (Team Learning journey) |
| DEP-01 | Docker Compose single-command deploy, 5-min target | NOT COVERED | Needs J0 (Deployment journey) |
| DEP-02 | Multi-user, role-based permissions, shared API keys | NOT COVERED | Needs J0 or J2 |
| DEP-03 | Multi-tenant isolation in hosted-for-profit mode | NOT COVERED | Needs J3 (Operator journey) |
| DEP-04 | Feature parity across deployment modes | NOT COVERED | Needs J0 (Deployment journey) |

### enabler-trend-scraper.md ACs

| AC | Description | J1 Coverage | Notes |
|----|-------------|------------|-------|
| SCR-01 | Five platform adapters with BYOK | Scenario 5 | Covered |
| SCR-02 | Collect posts from last 48 hours matching AI/ML keywords | Scenario 5 | Covered |
| SCR-03 | Configurable cadence, 30-min completion target | Scenario 5 (Background) | Covered |
| SCR-04 | Graceful failure on platform unavailability | Scenario 5 | Covered |
| SCR-05 | Per-adapter rate limiting | Scenario 5 | Covered |
| SCR-06 | Independent enable/disable per adapter, min one | Scenario 5 (Background) | Covered |
| SIG-01 | Common signal schema with 10 named fields | Scenario 5 | Covered |
| SIG-02 | Content-hash deduplication | Scenario 5 | Covered |
| SIG-03 | Configurable retention with auto-purge | Scenario 5 | Covered |
| SIG-04 | Two-pass domain relevance filter | Scenario 5 | Covered |
| SIG-05 | 90% precision against validation set | NOT COVERED | Quality metric; testable via validation set, not via user journey. |
| SIG-06 | Filtered signals logged with reasons | NOT COVERED | Operational concern; covered by ops/admin testing, not user journey. |

---

## Coverage Summary

| Category | Total ACs | Covered by J1 | Not Covered | Coverage |
|----------|----------|---------------|-------------|----------|
| feature-trend-learning.md | 24 | 17 | 7 | 71% |
| enabler-trend-scraper.md | 12 | 10 | 2 | 83% |
| **Total** | **36** | **27** | **9** | **75%** |

### Uncovered ACs Breakdown

| AC | Reason Not Covered | Resolution |
|----|-------------------|------------|
| SKL-05 | Team-only feature, requires P2 persona journey | Specify J2 (Team Learning) |
| SKL-06 | Team-only feature, requires P2 persona journey | Specify J2 (Team Learning) |
| SKL-07 | Team-only access control, requires P2 persona journey | Specify J2 (Team Learning) |
| DEP-01 | Deployment setup, requires dedicated deployment journey | Specify J0 (Deployment) |
| DEP-02 | Multi-user setup, requires deployment or team journey | Specify J0 or J2 |
| DEP-03 | Operator multi-tenancy, requires P3 persona journey | Specify J3 (Operator Launch) |
| DEP-04 | Cross-mode parity, requires deployment journey | Specify J0 (Deployment) |
| SIG-05 | Quality metric tested via validation set, not user journey | Covered by QA testing, not journey |
| SIG-06 | Operational logging, not user-facing | Covered by ops testing, not journey |

**Assessment:** 75% AC coverage from a single primary journey is expected. The 9 uncovered ACs fall into three categories: team features (need J2), deployment setup (need J0), and operational quality (covered by QA testing outside of user journeys). No user-facing learning ACs are uncovered.
