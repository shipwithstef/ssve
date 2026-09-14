# Baseline Comparison: Raw vs SVC

## Quantitative

| Metric | Raw (no methodology) | Serious Vibe Coding (full pipeline) | Delta |
|--------|---------------------|--------------------------|-------|
| Total tokens consumed | ~5,000 (estimate for single prompt) | ~370,000 (actual across 19 skills) | 74x overhead |
| Acceptance criteria defined | 0 | 36 (24 feature + 12 enabler) | +36 |
| User stories defined | 0 | 9 (6 feature + 3 enabler) | +9 |
| Personas defined | 0 | 4 (Priya, Daniel, Rahul, Sofia) | +4 |
| Journey scenarios | 0 | 5 (J1 specified; J0, J2, J3, J4 identified) | +5 |
| Enablers discovered (cascade) | 0 | 5 (Social Trend Scraper, Trend Synthesis Engine, Recommendation Engine, User Profile Service, Content Aggregator) | +5 |
| Edge cases documented | ~2 (ad hoc) | 24+ (per-AC error states, per-screen state machines) | ~12x |
| Review gates passed | 0 | 7 (G1-G7) | +7 |
| Deployment modes addressed | mentioned | architecturally designed (DEP-01 through DEP-04, mode-specific auth, tenant isolation) | qualitative |
| Screen flows defined | 0 | 7 screens (S1-S7), 5 state machines with explicit transitions | +12 |
| Component specs | 0 | 10+ with state variants, token references, responsive breakpoints | +10 |
| E2E test coverage plan | 0 | 26 test cases across 4 spec files, 100% AC coverage (24/24 mapped) | +26 |
| Marketing artifacts | 0 | 11 weighted insights (INS-001 through INS-011), 3 narratives, coreyhaines-interop ready | +14 |

## Qualitative

| Dimension | Raw | Serious Vibe Coding |
|-----------|-----|-----------|
| Determinism | Different output each run; no constraints on what gets included or omitted | Constrained by progressive narrowing: vision locks personas, personas lock stories, stories lock ACs, ACs lock screens |
| Traceability | None -- "learning path generator" in task 8 has no link to any user need | Full chain: AC (e.g., LRN-04) -> Journey scenario 2 -> Screen S3 -> Component LearningPathCard -> Code file `recommendationEngine.ts` |
| Error handling | Task 17 says "basic error handling" -- no specifics on what errors, what states, what recovery | Systematic: every screen has a state machine (EMPTY/LOADING/POPULATED/ERROR/STALE) with defined transitions and persona-specific patience budgets |
| Persona awareness | None -- the word "user" appears without distinguishing who they are or what they tolerate | 4 personas with patience budgets (P1: 5 min, P4: 3 min), trust triggers, and differentiated journeys |
| Data model rigor | Informal list of 7 tables with no relationships, no constraints, no consideration of tenant isolation | Full schema with migrations, multi-tenant row-level security, content-hash deduplication (SIG-02), configurable retention with auto-purge (SIG-03) |
| API design | 13 endpoints listed with no request/response schemas, no error codes, no auth requirements | Route files with schema-based validation (Fastify), role guards, deployment-mode feature flags, and typed request/response contracts |
| Deployment architecture | "Docker Compose" mentioned once; multi-tenant isolation is task 16 with no design | Three modes architecturally designed: single `docker compose up` with 5-min target (DEP-01), RBAC for private mode (DEP-02), tenant isolation for SaaS (DEP-03), feature parity guarantee (DEP-04) |
| Marketing readiness | Zero | 11 weighted insights, 3 narratives, 12 downstream marketing skill mappings via coreyhaines interop |
| Cascade discovery | Manual or missed -- raw plan never mentions "trend synthesis engine" or "content aggregator" as separate concerns | Automatic: 5 enablers discovered from Layer 3 spec writing; each gets its own spec with ACs |
| Test strategy | Task 18 says "manual testing" with no structure | 26 E2E test outlines with AC traceability matrix, page objects for 6 screens, Playwright architecture defined |
| Skill taxonomy | Not mentioned | 10 AI/ML categories with prerequisite relationships in static taxonomy, 4 proficiency levels, system-inferred vs self-assessed dual tracking |
| Feedback loop design | "Implement feedback system" (task 12) -- no detail on what feedback changes | Explicit: TRN-06/TRN-07 define rating mechanics, TRN-08 specifies that feedback adjusts future ranking, tested via E2E (rate 3 trends, reload, verify rank change) |

## What Raw Gets Right

- **Speed.** The entire plan exists in one prompt, one response, under a minute. No waiting for 19 sequential skill invocations.
- **Cost.** ~5,000 tokens vs ~370,000. For a quick prototype or hackathon, this is the right tradeoff.
- **Readability.** A developer can scan 60 lines and start coding immediately. No need to navigate 30+ files across 9 phases.
- **Sufficient for throwaway work.** If the goal is a weekend prototype to validate a concept, the raw plan covers enough ground.

## What Raw Misses

- **No acceptance criteria.** Without ACs, there is no definition of "done" for any feature. A developer implementing "build platform scraper adapters" has no specification for what a correct adapter looks like, how it handles failures, or what output schema it produces.
- **No persona differentiation.** The plan treats all users identically. It cannot distinguish between a solo learner who needs a 5-minute Docker setup and a SaaS operator who needs multi-tenant isolation and billing hooks.
- **No error state design.** "Basic error handling" in task 17 is the entire error strategy. Serious Vibe Coding defines explicit state machines for every screen with transitions between EMPTY, LOADING, POPULATED, ERROR, and STALE states.
- **No traceability.** If a stakeholder asks "why does the learning path show difficulty levels?" the raw plan has no answer. Serious Vibe Coding traces it: LRN-03 (AC) -> J1 Scenario 2 (journey) -> S3 LearningPathCard (screen) -> SkillBadge component (UI spec).
- **No test plan.** The raw plan ends with "manual testing across all three deployment modes." Serious Vibe Coding produces 26 test case outlines with 100% AC coverage and a traceability matrix.
- **No cascade discovery.** The raw plan treats the scraper as task 4 because the developer thought of it. Serious Vibe Coding discovers enablers systematically during spec writing -- the Trend Synthesis Engine, Recommendation Engine, User Profile Service, and Content Aggregator all emerged from asking "what does this AC depend on?" rather than from upfront brainstorming.

## Verdict

The raw baseline is faster and cheaper by a factor of 74x in token cost and roughly 20x in wall-clock time. For disposable prototypes, exploration, or hackathon code, it is the correct approach -- you do not need 36 acceptance criteria to validate a weekend idea.

But the raw plan is a liability for anything that will be maintained, extended, or used by real people. It produces code that works in the demo but fails in production because error states, edge cases, persona-specific behaviors, and deployment mode differences were never specified. The 74x token overhead of svc pays for itself in the first fix cycle: a single missing error state that reaches production costs more engineering time to diagnose, fix, test, and deploy than the entire svc pipeline consumed. The structured output also eliminates an entire class of "I built the wrong thing" failures by tracing every implementation decision back to a user story, persona, and acceptance criterion -- so the question is never "does this code work?" but "does this code satisfy the specification that was validated against user needs before a single line was written?"
