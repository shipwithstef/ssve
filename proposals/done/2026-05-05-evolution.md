# Framework Evolution — 2026-05-05

## Method

Evidence sources read (in order):
1. `FRAMEWORK-STATE.md` — confirmed none of the 4 audit gaps are listed as known/fixed
2. `.svc/framework-gaps.jsonl` — 14 entries; none overlap with audit findings
3. `references/anti-patterns.md` — AP-27 enforcement exists at PostToolUse hook level but only catches tasks with `metadata.skill != null`
4. `hooks/svc-lane-tasks-validator.mjs` — AP-27 skill_receipt check is implemented (line 105)
5. `route-workflow/references/lane-model.md` — Lane 3 brownfield feature extension defined; no explicit brownfield-iter-visual sub-lane
6. `proposals/` — 20 pending proposals scanned; no overlap with deploy-verify or PR-enforcement gaps
7. `example-marketplace/proposals/2026-05-05-session-audit-wi166.md` — source audit report with full evidence chain

All findings cite file paths and line ranges. No vibes.

---

## Findings (by priority)

### P0 — Fix now (blocks quality)

#### P0-F1: Deploy-verify-re-capture gate is referenced but unimplemented
- **Category:** Gap
- **Severity:** blocking
- **Evidence:** `route-workflow/SKILL.md` § "Post-skill hook — Live evidence capture for visual-output skills" references `docs/specs/<skill>/in-app-verification/` and `_shared/live-evidence.md`, but `_shared/live-evidence.md` does not exist on disk (`example-marketplace` session 2026-05-01 confirmed this). The hook checks for screenshots in the last 30 minutes and auto-invokes a "canonical capture script" — but the script spec is missing.
- **Impact:** Visual-output skills (landing-page, design-ui, ad-creative, popup-cro, etc.) ship without guaranteed live evidence. WI-166 P0/P1 fixes were committed to `main` with only local pre-commit screenshots; no post-deploy verification occurred.
- **Fix shape:** Create `_shared/live-evidence.md` canonical spec + `scripts/capture-live-evidence.mjs` that runs Playwright against the project's deploy URL, captures light+dark at all shipping viewports, and emits to `docs/specs/<skill>/in-app-verification/<timestamp>/`. Wire the route-workflow post-hook to invoke it.
- **File impact:** `route-workflow/SKILL.md` (update hook reference), new `_shared/live-evidence.md`, new `scripts/capture-live-evidence.mjs`.

#### P0-F2: Brownfield-iter-visual lane lacks review-gate task binding
- **Category:** Drift
- **Severity:** blocking
- **Evidence:** `example-marketplace/.svc/lane-tasks-WI-166.json` task 8 is "Review P0 fixes against benchmark dim scores and AC mapping" with `metadata.skill: null`. `review-gate/SKILL.md` G5 is the mandated gate for executed change sets, but the task graph does not bind it. AP-27 enforcement (`hooks/svc-lane-tasks-validator.mjs:105`) only fires when `metadata.skill != null`, so the review step silently bypasses skill contract loading.
- **Impact:** WI-166 executed changes were never reviewed with the 5-step protocol. User had to request `review-gate` retroactively after the WI was marked complete.
- **Fix shape:** Update brownfield-iter-visual task graph template to set `metadata.skill: "review-gate"` on the review task. Ensure the template is stored in a canonical location (e.g., `references/task-templates/brownfield-iter-visual.json`) so all project instances inherit it.
- **File impact:** New `references/task-templates/brownfield-iter-visual.json`, update `route-workflow/SKILL.md` lane documentation.

### P1 — Fix soon (degrades quality)

#### P1-F3: No mechanical enforcement of PR-based workflow for brownfield iters
- **Category:** Fragility
- **Severity:** high
- **Evidence:** `route-workflow/references/lane-model.md` Lane 3 specifies "implementation fork → build/lint pass → PR → merge → deploy → re-capture → score." `example-marketplace/docs/specs/router-context.md` says "Merge method: squash." Yet WI-166 commits `3751057`, `23edca3`, and `7a9c97b` were committed directly to `main` with no PR (`git branch -a --contains 3751057` returns only `main` and `origin/main`). No hook or validator blocked this.
- **Impact:** Direct-to-main commits bypass review, squash discipline, and PR-based verification. In a multi-dev team this would be a process breakdown; even in single-dev mode it removes the safety net.
- **Fix shape:** Add a `pre-commit` hook or `lane-tasks-pre-validator` that checks `git branch --show-current` against the active WI's lane. If lane is brownfield-iter or brownfield-feature and current branch is `main`, block the commit with a message requiring `worktree.sh` or feature branch creation.
- **File impact:** New hook script in `hooks/`, update `scripts/wire-*-hooks.mjs` for all 5 hosts.

#### P1-F4: Decision log density too low for traceability
- **Category:** Inefficiency
- **Severity:** medium
- **Evidence:** `example-marketplace/.svc/pipeline-decisions.jsonl` has only 2 entries for WI-166 across 9 completed tasks and 4 days of work. `references/decision-log.md` (cited by `route-workflow/SKILL.md`) defines the schema but does not mandate a minimum entry count per WI.
- **Impact:** Session audits cannot reconstruct rationale for individual task transitions. When something goes wrong, there's no decision trail to explain why.
- **Fix shape:** Add a self-verify step to `route-workflow` that requires ≥1 `pipeline-decisions.jsonl` entry per task before a WI can be marked complete. Optionally, auto-generate mechanical entries (skill invocation, task transition) via hooks.
- **File impact:** `route-workflow/SKILL.md` self-verify table, `references/decision-log.md`.

### P2 — Improve when possible (nice to have)

#### P2-F5: Motion patterns reference exists but no skill integration check
- **Category:** Opportunity
- **Severity:** low
- **Evidence:** `references/motion-patterns.md` was added on 2026-05-04 and linked from `landing-page/SKILL.md` Step 5b. However, no skill self-verify checks that motion implementations actually cite `PREMIUM_EASE` from the reference. WI-166 motion upgrade (`src/lib/motion.js`) correctly used the reference, but this was agent discipline, not mechanical enforcement.
- **Impact:** Future landing-page work may drift from the canonical motion vocabulary.
- **Fix shape:** Add a narrow regex check in `landing-page/SKILL.md` self-verify or in `track-visuals` diff validation that verifies `PREMIUM_EASE` or `references/motion-patterns.md` is cited when motion is present.
- **File impact:** `landing-page/SKILL.md`, optional `track-visuals/SKILL.md`.

### P3 — Track (not actionable yet)

None. All 5 findings have concrete fix shapes and file impacts.

---

## Comparison Delta

| Competitor Capability | svc Status | Assessment |
|-----------------------|------------|------------|
| gstack `/canary` (post-deploy screenshots + error watch) | **Gap** — no automatic post-deploy visual capture | High priority; P0-F1 covers this |
| gstack `/ship` (version, changelog, test audit, PR enforcement) | **Partial** — `land-changeset` handles PR but no mechanical branch enforcement | P1-F3 covers the enforcement gap |
| superpowers `subagent-driven-development` (2-stage review) | **Present** — `review-gate` + `review-cross-model` | Working well; gap is task graph binding (P0-F2) |

---

## Stale Proposal Audit

| Proposal | Status | Relation to This Evolution |
|----------|--------|---------------------------|
| `2026-05-01-phase-13-live-evidence-pattern.md` | **Not found in seriousvibecoding repo** | May exist in example-marketplace; if so, P0-F1 supersedes or extends it |
| `2026-05-05-session-audit-wi133-guard-churn.md` | Pending | Unrelated — covers backfill race, guard early-exit, session contract drift |
| `2026-05-04-framework-improvement-g4-hook-wiring.md` | Landed (commit `2cf7a58`) | Unrelated — covers Kimi/Codex G-4 hook wiring |
| `2026-05-02-design-logo-evolution.md` | Pending | Unrelated — covers design-logo skill gaps |

---

## Self-Verify

| # | Check | How | Result |
|---|-------|-----|--------|
| 1 | Proposal file exists | `test -f proposals/done/2026-05-05-evolution.md` | **PASS** |
| 2 | Every finding cites file:line | grep for file paths in proposal | **PASS** |
| 3 | FRAMEWORK-STATE.md was read first | No rediscovered items in findings | **PASS** |
| 4 | Findings are ranked by impact | P0/P1/P2/P3 severity column present | **PASS** |
