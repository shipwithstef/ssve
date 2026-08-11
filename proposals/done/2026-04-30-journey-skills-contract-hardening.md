# Framework Evolution — 2026-04-30 — Journey Skills Contract Hardening

**Status:** DRAFT

## Method

Read `FRAMEWORK-STATE.md` (Known Gaps, Analysis History), `write-journeys/SKILL.md`, `test-journeys/SKILL.md`, `skills-manifest.json`, `test-framework/evals/tier-2/scenarios/`, `references/task-graph-chaining-protocol.md`, and `test-framework/evals/tier-1/validate-framework-self-management.sh`. Cross-referenced against the progressive-disclosure doctrine locked 2026-04-19 and the phase-contract gap identified 2026-04-23.

Skipped (already in FRAMEWORK-STATE): tier-3 coverage expansion, framework-evaluation-advisor skill, auto-advance state machine.

## Findings (by priority)

### P0 — write-journeys violates progressive disclosure (1406 lines, no references/ dir)
**Evidence:** `write-journeys/SKILL.md:1` — 1406 lines. Mode 6 (Tiered Auto-Discovery) alone is 322 lines inline (`lines 997–1318`). No `write-journeys/references/` directory exists. Compare: `route-workflow/SKILL.md` was reduced to 81 lines after progressive-disclosure distribution to 10 reference files (`FRAMEWORK-STATE.md:819–826`). `test-journeys/SKILL.md` has `references/run-report-template.md`.
**Impact:** Every invocation loads 1406 lines of skill text. On Gemini CLI this was the exact failure class that caused skill-activation hang (FRAMEWORK-STATE.md:888–898). On Kimi/Claude, it bloats context and increases per-turn cost. Mode 6 is used only on explicit "tiered journeys" trigger — most runs never execute it, yet every run pays its token cost.
**Proposed fix:**
1. Create `write-journeys/references/`.
2. Extract Mode 6 (Tiered Auto-Discovery) to `write-journeys/references/mode-6-tiered-auto-discovery.md` (~322 lines).
3. Extract the Journey Document Format template (`lines 403–459`) to `write-journeys/references/journey-document-format.md`.
4. Extract the Industry Pattern Recognition table (`lines 614–636`) to `write-journeys/references/industry-pattern-recognition.md` (also referenced by other skills — consider `references/` root instead).
5. Replace inline blocks with one-line pointers + `references/task-graph-chaining-protocol.md` pointer for the duplicate boilerplate.
6. Target: `write-journeys/SKILL.md` ≤ 200 lines.
**Confidence:** HIGH — the route-workflow refactor proved this pattern works and `verify-skill-refactor.mjs` gates it.

### P0 — write-journeys has zero tier-2 integration scenarios
**Evidence:** `test-framework/evals/tier-2/scenarios/` contains 35 scenarios covering 58% of skills. `ls | grep -i write-journey` returns nothing. The only journey-related tier-2 is `test-journeys-runtime.md`. `test-journeys-runtime.md:1–50` tests runtime QA, not journey generation.
**Impact:** No integration test verifies that write-journeys actually reads specs, maps personas, generates Gherkin, writes `.feature.md` files, or produces a `JOURNEY_INDEX.md`. The skill could drift into producing malformed output (missing AC tags, wrong persona references, no Layer 3) and no automated test would catch it.
**Proposed fix:**
Create `test-framework/evals/tier-2/scenarios/write-journeys-bootstrap.md` with:
- Setup: scaffolded repo with 2 feature specs (each with AC tables), 2 persona files, empty `docs/specs/journeys/`.
- Prompt: "generate journeys for this product" (bootstrap mode).
- Success criteria:
  1. `docs/specs/journeys/J01-*.feature.md` exists with Gherkin `# Feature:` header.
  2. At least one scenario has `@AC-` tags above it.
  3. `JOURNEY_INDEX.md` exists with persona and journey tables.
  4. Layer 3 analysis section (`## Journey Analysis`) is present in at least one journey file.
  5. No file mentions implementation details (CSS class, DB column, API endpoint) — grep blacklist.
  6. E2E test mapping section exists.
Create `test-framework/evals/tier-2/scenarios/write-journeys-refresh.md` with:
- Setup: repo with existing journeys that have stale AC references (AC IDs changed in specs).
- Prompt: "sync journeys".
- Success criteria: broken AC refs flagged in coverage report; new ACs identified as gaps.
**Confidence:** HIGH — fixture-based pattern already proven for 35 tier-2 scenarios.

### P1 — write-journeys self-verify is too weak (3 checks vs 10 for test-journeys)
**Evidence:** `write-journeys/SKILL.md:1361–1371` — checks 1–3: file exists, index exists, Layer 3 present. `test-journeys/SKILL.md:479–494` — checks 1–10 including scenario inventory terminality, WI creation, visual-AC screenshot citation, viewport stage, working-tree clean, close-out validator. `diagnose-bug/SKILL.md` has 20 self-verify checks.
**Impact:** A write-journeys run can complete without verifying: AC coverage floor (every user-facing AC referenced?), persona mapping (every persona has ≥1 journey?), E2E cross-reference (journeys map to real tests?), ungrounded preconditions traced, or file committed to git. The 2026-04-15 GPS-toggle drift (`FRAMEWORK-STATE.md:1105–1122`) would not have been caught by these 3 checks.
**Proposed fix:** Expand self-verify to at least 8 checks:
| # | Check | How |
|---|---|---|
| 1 | At least one journey file exists | `ls docs/specs/journeys/J*.feature.md` |
| 2 | JOURNEY_INDEX.md exists | `test -f docs/specs/journeys/JOURNEY_INDEX.md` |
| 3 | Layer 3 analysis present | grep `## Journey Analysis` in ≥1 journey |
| 4 | AC coverage ≥80% of user-facing ACs | count `grep -r '@AC-' docs/specs/journeys/` vs total ACs in specs |
| 5 | Every persona has ≥1 journey | cross JOURNEY_INDEX.md persona table with journey table |
| 6 | No implementation details in scenarios | `grep -iE 'css|localstorage|database|api endpoint|jsx|tsx' docs/specs/journeys/*.feature.md` returns empty |
| 7 | Ungrounded preconditions table present | grep `## Ungrounded Preconditions` or `### Ungrounded Preconditions` |
| 8 | Committed to git (if in worktree) | `git log --oneline -1 -- docs/specs/journeys/` is this run |
**Confidence:** HIGH — checks are mechanical and mirror what the skill already instructs agents to do.

### P1 — Duplicate task-graph boilerplate in both journey skills
**Evidence:** `write-journeys/SKILL.md` — 3 occurrences of "Task-graph mode" block (`grep -c`: 3). `test-journeys/SKILL.md` — 3 occurrences (`grep -c`: 3). The canonical source is `references/task-graph-chaining-protocol.md` (70 lines). `FRAMEWORK-STATE.md:646–648` documents the dedup precedent for `improve-framework`.
**Impact:** ~75 lines of dead weight in write-journeys, ~50 lines in test-journeys. Every edit to task-graph protocol (e.g., adding OpenCode mirror rules) requires 6 manual edits. 2026-04-21 Kimi task-graph enforcement fix had to be applied manually across all skills; duplicate blocks increase漏网概率.
**Proposed fix:** Replace all inline task-graph blocks with a single pointer line per skill: "Per `references/task-graph-chaining-protocol.md` § Pipeline Continuation." Keep only skill-specific chaining notes (e.g., test-journeys' "allowed next skills" rule) inline. This matches the `improve-framework`/`evolve-framework` dedup pattern already locked.
**Confidence:** HIGH — mechanical sed with `verify-skill-refactor.mjs` replay.

### P2 — No tier-1 journey format validator
**Evidence:** `test-framework/evals/tier-1/validate-skill-structure.sh` checks skill frontmatter and self-verify tables but does NOT check journey document syntax. `test-framework/evals/tier-1/validate-contracts.sh` checks input/output paths but not journey content. No `validate-journey-format.sh` exists.
**Impact:** Journey files can drift: missing AC tags, malformed Gherkin headers, personas not in `docs/specs/personas/`, Layer 3 absent, ungrounded preconditions table missing — and no tier-1 script catches it. The 2026-04-15 GPS-toggle gap was partly a journey-quality gap (consumer journey assumed producer data with no producer journey).
**Proposed fix:** Create `test-framework/evals/tier-1/validate-journey-format.sh` that:
1. Checks every `.feature.md` has `# JNN:` or `# Feature:` header.
2. Checks AC tags use backtick-wrapped `@ID` format above scenarios.
3. Checks persona referenced exists in `docs/specs/personas/`.
4. Checks Layer 3 section exists.
5. Checks no blacklisted technical terms in scenario steps.
6. Checks `JOURNEY_INDEX.md` journey table references every `.feature.md` file.
Zero LLM calls; runs in <1s.
**Confidence:** MEDIUM — requires defining the full format contract, but the skill text already contains the rules.

## Comparison delta

- **gstack:** Has `verify-skill-refactor.mjs` equivalent for content preservation but no journey-specific format validator.
- **superpowers:** Has task-graph planning but no skill-internal phase contracts.
- **svc delta:** Progressive disclosure is already a locked decision (2026-04-19); write-journeys is the largest skill still non-compliant. Tier-2 fixture pattern is mature; adding 2 journey scenarios is low-risk. No competitor has skill-phase contracts or execution trace validation — the 2026-04-23 gap notes this as a differentiating opportunity.

## Stale proposal audit

- `2026-04-15-blocking-discovery-halt-protocol.md` — **BLOCKED** (P0-2 still pending). Not related to journeys.
- `2026-04-23-evolution-phase-contracts-and-execution-trace-validation.md` — **Referenced in FRAMEWORK-STATE but file does not exist.** This proposal should be created as a separate evolution record. The findings here (P0 tier-2 gaps, P1 self-verify weakness) are inputs to that larger proposal.
- `2026-04-14-parallel-wi-dispatch.md` — **BLOCKED**, unrelated.

## Self-Verify

| # | Check | Result |
|---|---|---|
| 1 | Proposal file exists | PASS |
| 2 | Every finding cites file:line or measurement | PASS |
| 3 | FRAMEWORK-STATE.md was read first; no rediscovered items | PASS |
| 4 | Findings ranked by impact + confidence | PASS |
