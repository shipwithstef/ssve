# Rule: Read the Latest Failure Evidence BEFORE Drafting the Next Fix

When a fix lands and the symptom persists, the next action is NOT a second fix. It is reading the latest failure artifact (screenshot, trace, DOM snapshot, error log, server response body) and citing a specific observation from it. Drafting a follow-up fix without inspecting the latest evidence drives debug-by-PR loops where each PR addresses an imagined root cause and the actual signal stays unread.

## The failure pattern

1. Test fails. Engineer reads the assertion error, hypothesizes a cause, writes a fix.
2. Fix lands. Test re-runs. Same assertion fails (often with a similar-looking error).
3. Engineer hypothesizes a SECOND cause based on the same code reading. Writes another fix.
4. Loop repeats. Each iteration costs 1-2 PRs. After 4+ iterations the actual cause is still unidentified — no one has looked at the screenshot or DOM snapshot the test runner saved.
5. When evidence is finally inspected, root cause is obvious in seconds and unrelated to all prior hypotheses.

This is a discipline failure, not a tooling failure. The evidence exists; the protocol to consume it is missing.

## Required practice — between PR-N merge and PR-N+1 draft

After any fix attempt that fails to resolve the symptom, BEFORE writing the next fix, the agent MUST:

1. **Locate the latest failure artifact.** Common paths:
   - Playwright: `e2e/test-results/*/test-failed-1.png` + `error-context.md` + `trace.zip`
   - Jest snapshot tests: `__snapshots__` diff
   - API tests: response body in test runner output
   - Browser-driven: console logs, network tab dump

2. **Read it.** Use the `Read` tool on the screenshot or DOM snapshot. For traces, run `npx playwright show-trace` instructions or inspect the `error-context.md` aria snapshot.

3. **Cite a specific observation.** In the next PR's commit message or comment, quote what the evidence shows: "Screenshot at `path` shows current location is X, not Y" / "Network tab shows POST returned 403 with body Z" / "Console error: `<exact text>`".

4. **Only THEN draft the next fix** based on what the evidence shows, NOT based on a fresh code reading.

A fix attempted without citing the latest evidence is rejected at `review-gate` G3.

## Forbidden patterns

- ❌ Reading source code to hypothesize a root cause when test artifacts from the latest run exist and have not been opened.
- ❌ Drafting a follow-up fix in the same session as a failed fix without inspecting at least the test runner's stdout for the failed test.
- ❌ Closing a "this failed" message with "let me try X" where X is hypothesized rather than observed.
- ❌ Multiple sequential PRs against the same test/symptom without an evidence-citation in each commit message after the first.

## Severity escalation by PR count

- **PR 1 (first attempt):** evidence-citation recommended, not blocking.
- **PR 2:** evidence-citation REQUIRED. Block at `review-gate` G3 if missing.
- **PR 3+:** evidence-citation REQUIRED + diagnose-bug Phase 0 (persistence bisect — see `diagnose-bug` skill) MUST run. The pattern of N>2 fix attempts on the same symptom without bisecting indicates the search space hasn't been narrowed.

## How to enforce

- `diagnose-bug` re-entry gate — when invoked on a WI that already has a merged fix attempt, the FIRST action is to read the latest test artifact for that WI's failing test(s).
- `execute-changeset` Self-Verify — for any changeset filed as a "follow-up to PR #N", check that the commit message cites a specific observation from the latest artifact (regex: file path + quoted text).
- `review-gate` G3 — block PRs N+1, N+2, ... on the same symptom unless evidence-citation is present.

## Why this exists

Real failure mode in WI-132 (Example Marketplace J04): six PRs (#74, #75, #76, #77, #78, #79) shipped against the same test cluster before a screenshot was inspected. Screenshot revealed that the "first combobox" the test clicked was the SIDEBAR LANGUAGE SWITCHER, not the location switcher — visible in 1 second of looking. PR #4 was the first to inspect a screenshot. PRs #1-#3 hypothesized root causes based on code reading.

The cost of that loop: 5 PRs of churn, ~90 minutes wall time, ~4 sessions of context budget. The cost of reading the screenshot up front: ~10 seconds. This rule formalizes the asymmetry.

## Companion rules

- `rules/learning-preload.md` — check prior learnings before starting work
- `rules/long-output-to-file.md` — ensure artifacts are written, not lost in transcript truncation

## Severity when violated

HIGH in N>2 PR loops on the same symptom. Always blocking at `review-gate` G3 when N≥2.
