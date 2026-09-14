# Framework Evolution — 2026-04-30 — Journey Execution Trace Validation

**Status:** DRAFT

## Method

Read `FRAMEWORK-STATE.md` (Known Gaps § Skill phase contracts, Tier-3 coverage), `test-journeys/SKILL.md`, `test-framework/evals/tier-2/scenarios/test-journeys-runtime.md`, `test-framework/evals/tier-1/validate-framework-self-management.sh`, and `.svc/framework-gaps.jsonl`. Compared against the execution-trace-validation gap identified 2026-04-23 and the benchmark-landing rubric-v2 precedent (mechanical close-out validation).

Skipped (already in FRAMEWORK-STATE): framework-evaluation-advisor skill, tier-3 batch runner architecture.

## Findings (by priority)

### P0 — test-journeys tier-2 scenario is surface-level (4 checks, no process verification)
**Evidence:** `test-framework/evals/tier-2/scenarios/test-journeys-runtime.md:30–50` — success criteria are:
1. HTTP request/browser interaction executed against target URL.
2. Evidence produced for every scenario.
3. AC status fields updated.
4. Every AC classified PASS/FAIL/BLOCKED.

These check **outputs only**, not **process execution**. The skill contract (`test-journeys/SKILL.md:150–538`) defines 6 mandatory steps: Step 0.5 (scenario inventory), Step 1 (scope selection), Step 2 (preflight), Step 2.5 (S0/S1/S2 static pre-check), Step 3 (browser execution), Step 4 (spec update), Step 4.5 (WI creation), Step 5 (summary), Step 6 (commit). The tier-2 scenario verifies **none** of these steps.
**Impact:** A test-journeys run could skip Step 0.5 (no `scenarios.json`), skip Step 2.5 (no S0 grep), skip Step 4.5 (no WIs for defects), skip viewport staging, skip the close-out validator — and still pass the tier-2 scenario because the output artifacts happen to exist. This is the exact failure class identified in the 2026-04-23 phase-contract analysis: "Tier-2 assertions check presence, not substance."
**Proposed fix:**
Replace the 4 shallow criteria with 10 process-verified criteria:
1. `scenarios.json` exists with every `# Scenario:` block from in-scope journeys enumerated.
2. Every scenario in `scenarios.json` has terminal status (`executed | skipped-infeasible | skipped-user-approved`). No `pending` allowed.
3. At least one S0 (static/code) check is recorded before browser work — grep for `✅ MM-DD (code)` or equivalent marker in SUMMARY.md.
4. For visual-rendering ACs marked ✅, a screenshot path is cited in the spec QA column.
5. HIGH/CRITICAL findings each have a matching `docs/work-items/WI-*` file.
6. `SUMMARY.md` contains `viewport_stage=desktop` (mandatory first pass).
7. If mobile viewport claimed, desktop is clean (defects fixed or filed as HIGH WI) — check SUMMARY.md for staging-blocked notation.
8. `SUMMARY.md` cites allowed next skills derived from routing table; `review-gate` is NOT among them for behavioural regressions.
9. Working tree is clean: spec updates, SUMMARY.md, scenarios.json, and WI files are staged or committed.
10. Close-out validator was run: `node scripts/verify-skill-contract.mjs test-journeys-closeout ...` recorded in SUMMARY.md or run log.
**Confidence:** HIGH — all criteria are mechanical assertions against files the skill already promises to produce.

### P0 — write-journeys `--refresh` milestone trigger still pending since 2026-04-15
**Evidence:** `FRAMEWORK-STATE.md:1105–1122` — entry dated 2026-04-15 titled "write-journeys Refresh — no automatic milestone-boundary trigger (PENDING)". Root cause: `route-workflow` has no trigger for `write-journeys --refresh`. The GPS-toggle drift (WI-058) was discovered only when the owner saw a new UI toggle — the ungrounded precondition check (Layer 3) in write-journeys Mode 3 would have caught it, but the skill was never invoked between WIs. Status: "PENDING — no route-workflow/SKILL.md edit yet. Implement via improve-framework."
**Impact:** Consumer journeys accumulate ungrounded preconditions between milestones. Producer-side flows (who creates the data?) drift out of sync with consumer journeys. The gap is invisible until a user hits a dead-end in production.
**Proposed fix:**
Add to `route-workflow/SKILL.md` cross-skill routing table:

| Trigger | Condition | Action |
|---------|-----------|--------|
| `verify-promotion` completes | Backlog `INDEX.md` has zero non-VERIFIED items AND no WIs in-progress | Run `write-journeys --refresh --all` → then `assess-market-readiness` |

Also add a self-verify check to `verify-promotion/SKILL.md`: "If backlog is empty and no WIs in-progress, verify `write-journeys --refresh` was run within current milestone or log skip reason."
Also add a tier-2 scenario `write-journeys-refresh-trigger.md` that simulates an empty backlog post-verify-promotion and asserts the next suggested skill is `write-journeys`.
**Confidence:** HIGH — the condition is machine-checkable (`grep` on INDEX.md + `ls` on work-items). The action is a skill invocation the framework already supports.

### P1 — test-journeys has triple duplicate task-graph boilerplate
**Evidence:** `test-journeys/SKILL.md:452–460`, `:462–477`, `:511–519` — three copies of the task-graph mode block. The first and second differ only by the subagent-mirror addition (`:467–470`). The third is in the Chaining section. Total duplicated text: ~50 lines.
**Impact:** Same as write-journeys — every protocol change requires N manual edits; drift probability increases with N. The 2026-04-21 Kimi task-graph hardening fix (`FRAMEWORK-STATE.md:277–296`) had to touch many skills; duplicates made the rollout error-prone.
**Proposed fix:** Collapse to one pointer line referencing `references/task-graph-chaining-protocol.md`. Preserve only the test-journeys-specific rules inline: (a) subagents must not attempt TaskUpdate, (b) allowed next skills must pass `verify-skill-contract.mjs test-journeys-closeout`.
**Confidence:** HIGH — mechanical change with `verify-skill-refactor.mjs` gate.

### P1 — No tier-3 judge scoring for any journey skill
**Evidence:** `FRAMEWORK-STATE.md:1517–1519` — "Tier-3 coverage expansion (1/35 → 35/35)" is a known gap. The only judged scenario is `diagnose-bug-typo`. `test-journeys-runtime.md` has never been judged. `FRAMEWORK-STATE.md:22` says "tier-3 judge operational but coverage is 1/35 scenarios (2.8%)".
**Impact:** We do not know if test-journeys output is scored as complete, actionable, and consistent. The 2026-04-14 J04+J08 regression run (`FRAMEWORK-STATE.md:1475–1493`) exposed real quality failures (efficiency skips, missing WIs, mobile skipped) that tier-1 and tier-2 did NOT catch. A tier-3 judge on that run's SUMMARY.md would have caught completeness gaps.
**Proposed fix:**
1. Create `test-framework/evals/tier-3/judge-prompts/test-journeys-completeness.md` — asks: does the QA run cover all scenarios in the journey? Are AC statuses specific (not just "PASS")? Are ungrounded preconditions traced? Is viewport staging explicit?
2. Create `test-framework/evals/tier-3/judge-prompts/test-journeys-actionability.md` — asks: are findings routed to the correct next skill? Are WI files created with reproduction steps? Are screenshots cited with paths?
3. Create `test-framework/evals/tier-3/judge-prompts/test-journeys-consistency.md` — asks: do AC statuses match scenario outcomes? Does SUMMARY.md match scenarios.json? Are pass/fail counts internally consistent?
4. Run judge against the existing `test-journeys-runtime.md` tier-2 fixture output. Baseline the score. Iterate the skill text until score ≥ 8/10/10.
**Confidence:** HIGH — the tier-3 judge harness exists (diagnose-bug-typo achieved 10/10/10). Only the prompts and fixture need creation.

### P2 — No deterioration guard for test-journeys S2 tightening
**Evidence:** `test-journeys/SKILL.md:248–260` — S2 tier was tightened 2026-04-14 (three-condition AND gate). `FRAMEWORK-STATE.md:1239–1241` documents the change. No automated test verifies that the skill now applies the three-condition gate instead of the old loose "personalized content / payment flows / push notifications" heuristic.
**Impact:** If the skill text drifts back to loose S2 classification (e.g., via a future edit or model substitution), user-handoff regressions recur. The 2026-04-14 WI-054 session (`FRAMEWORK-STATE.md:1230–1255`) was the direct trigger for the S2 tightening; the failure mode can recur silently.
**Proposed fix:**
Add an S2-drift assertion to the tier-2 scenario or to a new tier-1 script:
- `grep` the SUMMARY.md for S2 justifications.
- Assert each S2 entry lists all three conditions (personalised data, cannot provision, browse cannot render).
- Assert no S2 entry exists for behavioural/flow ACs on public entry points.
This is a pattern that can generalize to any skill with a classification gate: capture the gate rules in a machine-checkable form.
**Confidence:** MEDIUM — requires parsing SUMMARY.md prose, but the three-condition format is structured enough to grep.

### P2 — No mechanical bridge validation between write-journeys output and write-e2e input
**Evidence:** `write-journeys/SKILL.md:978` — "Journey docs are source of truth for E2E test scope." `write-e2e/SKILL.md` reads journey docs to understand cross-feature flows. But no validator checks that a journey file is parseable by write-e2e: e.g., Are scenario steps written in user language (not code)? Is the E2E Coverage section present? Are AC tags grep-able?
**Impact:** write-journeys can produce journeys that look correct to a human but are unusable by write-e2e. A journey with scenario steps like "When I click the primary CTA" is ambiguous to write-e2e (what selector?). A journey missing the `## E2E Coverage` section gives write-e2e no test-file hint.
**Proposed fix:**
Create `scripts/verify-journey-e2e-bridge.mjs` that reads a `.feature.md` and emits a bridge score:
- Scenario steps contain specific UI element names (not generic "CTA" without context).
- `## E2E Coverage` section exists with at least one `*.spec.ts` reference.
- AC tags are parseable (`@AC-ID` format).
- No scenario exceeds 7 steps (write-e2e readability threshold).
Run this as part of write-journeys self-verify (check: bridge score ≥ 7/10) and as a standalone tier-1 check.
**Confidence:** MEDIUM — requires defining the bridge contract, but both skills already imply it.

## Comparison delta

- **gstack / superpowers:** Neither has execution-trace validation or skill-internal phase contracts. gstack has adversarial review; superpowers has TDD execution. Neither validates that a skill's promised process steps were actually executed.
- **svc delta:** The 2026-04-23 evolution identified this as a differentiating capability. Closing it for journey skills (write-journeys + test-journeys) creates a concrete proof-of-concept before rolling out framework-wide.

## Stale proposal audit

- `2026-04-23-evolution-phase-contracts-and-execution-trace-validation.md` — **Does not exist as a file** despite being referenced in FRAMEWORK-STATE.md:173. The findings in this proposal (P0 tier-2 depth, P1 tier-3 coverage, P2 deterioration guard) should be merged into that evolution record when it is authored.
- `2026-04-15-blocking-discovery-halt-protocol.md` — **BLOCKED**, unrelated.
- `2026-04-14-parallel-wi-dispatch.md` — **BLOCKED**, unrelated.

## Self-Verify

| # | Check | Result |
|---|---|---|
| 1 | Proposal file exists | PASS |
| 2 | Every finding cites file:line or measurement | PASS |
| 3 | FRAMEWORK-STATE.md was read first; no rediscovered items | PASS |
| 4 | Findings ranked by impact + confidence | PASS |
