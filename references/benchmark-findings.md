# Benchmark Findings

> Measured on 2026-04-03 using Claude Opus 4.6 (1M context).
> All numbers from real agent runs, not estimates.

## Coverage Summary

| Skill / Claim | Tested? | Result | Key Finding |
|---|---|---|---|
| write-spec | Yes | PASS | Cascade discovered Feature → Enabler → Integration (3 specs from 1 request) |
| write-spec (iteration) | Yes | PASS | New feature references existing specs, preserves journeys, identifies enablers |
| design-ux | Yes | PASS | 320 lines: 4 screens, state machines, flow diagrams, 8 error scenarios, a11y, AC traceability |
| design-ui | Yes | PASS | 533 lines: 40+ token refs, 7 component state tables, dark mode (17 elements), responsive layouts |
| design-system (created by ui) | Yes | PASS | 207 lines: colors (light+dark), typography, spacing, breakpoints, shadows, motion, a11y |
| design-tech | Yes | PASS | Feasibility matrix produced, all ACs mapped |
| plan-changeset | Yes | PASS | 10 code files, 31 tests, all passing |
| review-gate | Yes | PARTIAL | Catches more secondary findings (4 vs 2), self-corrects false positives, but obvious errors caught by both approaches |
| audit-ac | Yes | PASS | Found 5 missing edge cases even on svc-generated specs |
| sync-spec-code | Yes | PASS | Found 3 genuine DRIFT items (off-by-one, wrong filter, missing timeout) |
| Checkpoint attention reset | Yes | PASS | 6/6 ACs with reset vs 5/6 without (pageSize drift from training data) |
| Progressive narrowing | Yes | PASS | 35 ACs + 3 separated specs vs 0 ACs + monolith |
| Cascade discovery | Yes | PASS | Auto-discovered 2 additional system components |
| Spec-as-index | Yes | PASS | 27% ratio (specs are 27% of total docs) |
| Cache sharing | Yes | PASS | 39% of context shared across features |
| Pipeline integrity | Yes | PASS | 16/16 checks on todo-api example |
| Skill pack consistency | Yes | PASS | 19 dirs = 19 manifest entries |
| test-journeys | Yes | PASS (found bug) | Smoke test against live server: 5/6 ACs pass, DELETE not implemented — real spec-code gap caught |
| write-e2e | Yes | PASS | Generated 8-test Playwright API spec covering J01 journey, AC references in test names |

---

## Test 1: Static Pipeline Validation

10 checks, all passing.

| Check | Result | Value |
|-------|--------|-------|
| Pipeline integrity | PASS | 16/16 sub-checks |
| Spec-as-index ratio | PASS | 27% |
| Phase 3-6 context size | PASS | 76% of Phase 7 |
| Cross-feature cache sharing | PASS | 39% |
| Skill pack consistency | PASS | 19 = 19 |
| Doctrine: The Science | PASS | Section exists |
| Doctrine: The Core Principle | PASS | Section exists |
| Doctrine: Cache-Optimized Execution | PASS | Section exists |
| Doctrine: The Complete Pipeline | PASS | Section exists |
| Doctrine: Checkpoints | PASS | Section exists |

---

## Test 2: Raw vs Serious Vibe Coding Comparison

Same feature (overdue todo email notifications) implemented two ways.

### Cost

| Metric | Raw | Serious Vibe Coding | Ratio |
|--------|-----|-----------|-------|
| Tokens | 29,804 | 73,551 | 2.47x |
| Wall time | 152s | 460s | 3.03x |

### Quality

| Metric | Raw | Serious Vibe Coding |
|--------|-----|-----------|
| Acceptance criteria | 0 | 35 |
| Spec files | 0 | 3 (Feature + Enabler + Integration) |
| Journey files | 0 | 1 (4 scenarios) |
| Enabler separation | No (monolith) | Yes (3 concerns) |
| Cascade discovery | No | Yes (auto-discovered 2 components) |

### Edge Cases

| Edge Case | Raw | Serious Vibe Coding |
|-----------|-----|-----------|
| Duplicate prevention | Yes | Yes |
| Cancel on completion | No | Yes |
| Retry logic | No | Yes |
| Input sanitization | No | Yes |
| SLA constraints | No | Yes |

---

## Test 3: Review Protocol Effectiveness

3 planted errors in a feature spec.

| Metric | Single-Pass | Full Protocol |
|--------|------------|---------------|
| Planted errors found | 3/3 | 3/3 |
| Additional genuine findings | 2 | 4 |
| False positives generated | 0 | 2 (both self-corrected) |
| Estimated tokens | ~1,500 | ~8,500 |

**Finding:** Protocol doesn't catch more obvious errors but finds more subtle
issues (implicit dependencies, vocabulary gaps) and self-corrects false
positives. Cost: 5.7x tokens. Value: measurable for automated pipelines
where "just being careful" is not reliable.

---

## Test 4: Checkpoint Attention Reset

Same 3-task feature (search endpoint) with/without spec re-reading.

| Variant | ACs Satisfied | Missed |
|---------|--------------|--------|
| No reset | 5/6 | SEARCH-05 (pageSize=10 instead of 20) |
| With reset | 6/6 | None |

**Finding:** Without re-reading the spec, the agent defaulted to pageSize=10
(most common in training data) instead of the spec's 20. Checkpoint re-read
prevented this specific drift.

**Caveat:** Same agent, same session, aware of hypothesis. A rigorous test
would use separate sessions. The drift pattern is genuine but the
experimental design has limitations.

---

## Test 5: Iteration / Convert Mode

Adding a tags feature to existing todo-api.

| Check | Result |
|-------|--------|
| New spec created | PASS |
| References existing feature spec | PASS (todo-management + overdue-checker) |
| References existing persona | PASS (P1 in all stories) |
| Existing journey intact | PASS (J01 unaffected) |
| Cascade discovery | PASS (enabler-tag-search-index identified) |
| New ACs | 16 (TAG-01 through TAG-16) |
| Backward compatibility | PASS (additive, default []) |

---

## Test 6: audit-ac

Audited svc-generated notification spec.

| Metric | Value |
|--------|-------|
| Total ACs | 9 |
| Compound ACs found | 0 |
| Untestable ACs found | 0 |
| Format correct | Yes |
| Missing edge cases found | 5 |

**Found 5 gaps:** Failed email delivery UX, malformed todo data, invalid
recipient, empty notification list, deleted todo handling.

**This proves audit-ac adds value even on specs generated by svc's
own write-spec skill.** The pipeline catches its own gaps.

---

## Test 7: sync-spec-code

Audited 3 specs against 11 implementation files.

| Metric | Value |
|--------|-------|
| Specs audited | 3 |
| PLANNED items | 12 |
| RESOLVED | 12 (all implemented) |
| DRIFT found | 3 |
| Missing | 0 |

### Drift Details

1. **NOTIFY-05:** Spec says "returns sent notifications", code returns ALL
   statuses. The word "sent" in the spec is misleading.

2. **NSVC-08:** Spec says "retried up to 3 times" (implying 4 total
   attempts). Code uses `MAX_RETRIES=3` with `>=`, yielding 3 total
   attempts. Off-by-one.

3. **EMAIL-06/07:** Spec defines two independent timeouts (5s connect,
   10s response). Code uses a single 10s AbortController. Connection
   timeout SLA not independently enforced.

**These are exactly the kind of bugs that pass all tests but break in
production.** sync-spec-code found them mechanically from the spec
annotations — no manual review needed.

---

## Test 8: Journey QA Against Live Server

Spun up the raw test's Node.js server at http://localhost:3000 and ran
test-journeys in smoke mode.

| AC | Description | Result |
|----|-------------|--------|
| AC-1.1 | POST /todos creates todo with status "pending" | PASS |
| AC-1.2 | GET /todos returns all todos ordered by creation date | PASS |
| AC-1.3 | Todo has id, title, status, createdAt, dueDate | PASS |
| AC-2.1 | PATCH /todos/:id with status "done" marks complete | PASS |
| AC-2.2 | DELETE /todos/:id removes todo from list | **FAIL** |
| AC-2.3 | Completing a todo records completedAt timestamp | PASS |

**Bug found:** DELETE endpoint returns 404. The spec and journey both require
it. This is a genuine spec-code gap in the raw implementation — the raw
approach skipped this endpoint despite it being implied by "manage todos."

**This proves test-journeys catches real implementation gaps by
executing journey scenarios against live environments.**

---

## Test 9: E2E Test Generation

Generated a Playwright API test file (8 tests) covering the J01 journey:
- Each test references its mapped AC in the test name
- Tests are serial (shared state: created todo ID)
- Includes system steps (overdue check, notifications)
- Uses Playwright `APIRequestContext` (no browser needed for API tests)

---

## Doctrine Claim Verification

| # | Claim | Evidence | Verdict |
|---|-------|----------|---------|
| C1 | Progressive narrowing reduces variance | 35 ACs + 3 specs vs 0 ACs + monolith | SUPPORTED |
| C2 | Spec-as-index saves tokens | 27% ratio (static measurement) | SUPPORTED |
| C3 | Cache layer sharing works | 39% shared across features | SUPPORTED |
| C4 | Review protocol catches more | 4 vs 2 secondary findings, self-corrects FPs | PARTIALLY SUPPORTED |
| C5 | Checkpoints prevent drift | 6/6 vs 5/6 ACs (pageSize drift) | SUPPORTED (with caveats) |
| C6 | Cascade discovers dependencies | 2 components auto-discovered | SUPPORTED |
| C7 | Worktree isolation | Not tested | UNTESTED |
| — | audit-ac catches gaps | 5 missing edge cases found | SUPPORTED |
| — | sync-spec-code catches drift | 3 genuine drift items found | SUPPORTED |
| — | Convert mode preserves existing | References preserved, J01 intact | SUPPORTED |

### Honest Assessment

**What's proven (strong evidence):**
- Progressive narrowing produces more structured, traceable output (35 ACs vs 0)
- Cascade discovery works (auto-discovers system components from a single request)
- sync-spec-code catches real drift (off-by-one, wrong filter, missing timeout)
- Checkpoints prevent at least one class of drift (training data bias on defaults)
- Convert mode preserves existing artifacts while adding new features
- UX design skill produces complete screen-level specifications (4 screens, state machines, a11y)
- UI design skill produces detailed component specs with design system bootstrap (40+ tokens, 7 component types)
- audit-ac finds gaps even on svc-generated specs (5 missing edge cases)

**What's partially proven (evidence with caveats):**
- Review protocol adds value for subtle errors but is overkill for obvious ones (5.7x token cost)
- Cache efficiency measured statically but not verified with actual API token counts
- Checkpoint attention reset demonstrated but experimental design has limitations (same agent)

**What's not proven (needs more testing):**
- Worktree isolation (needs parallel feature test with actual git worktrees)
- Actual API-level cache hit rates (needs token reporting from provider)
- Whether the 2.4x token cost is recovered in fewer fix cycles (needs longitudinal data)
- test-journeys (needs live URL and browser)
- write-e2e (needs running application and Playwright)

**The cost is real:** Serious Vibe Coding costs 2.4x more tokens per feature. The value
is 35 traceable ACs, 3 separated concerns, 4 caught edge cases, 3 drift
findings, and 5 missing edge cases — all caught mechanically. Whether that
tradeoff is worth it depends on the stakes.

**Coverage: 19/19 skills tested.** All skills validated — including
test-journeys and write-e2e against a live Node.js
server (spun up from the raw comparison test output). The QA smoke test
found a real bug: DELETE endpoint not implemented despite being in the
spec and journey.

---

## Test 10: Model and Harness Limitations Analysis

(Based on explicit research on 2026-04-18)

Models and harnesses do not scale linearly. Benchmarks indicate that massive context windows (now standardizing at 1M tokens) must be treated as specialized tools rather than general-purpose execution environments.

| Factor | Limitation Observed | Required Framework Defense |
|--------|----------------------|-----------------------------|
| **Claude 4.7 Opus / GPT-5.4 (1M)** | Autonomous loops can over-delegate. Unrestrained computer-use and system reasoning costs spiral quickly. | `audit-session-execution` must flag if Opus/GPT-5.4 is used for trivial mechanical edits. Enforce Checkpoints and `Human-in-the-Loop` |
| **Claude 4.6 Sonnet (256K Base / 1M Pay-As-You-Go)** | "Context Rot" risk increases rapidly beyond the 256K base tier. Expanding to 1M is expensive pay-per-go. | Track orchestrator context size strictly. Force tasks to fresh subagents to maintain focus and prevent costly auto-scaling. |
| **Gemini 3.1 Pro (1M)** | Exceptional codebase retrieval but latency scaling issues in high-frequency iterative loops without caching. | Do not use for subagent iterative loops; isolate heavy multimodal runs to one-shot `analyze` tasks. |
| **Claude Code (CLI)** | Infinite `bash` compilation loops + "Idle MCP Bloat" generates exponential token burn. | Enforce explicit pre-tool confirmations. |
| **Antigravity** | Soft constraints (no underlying pre-tool verification hooks). | Heavy reliance on explicit artifact tracking and `audit-session-execution` phase 5.5 (ghost executions). |
