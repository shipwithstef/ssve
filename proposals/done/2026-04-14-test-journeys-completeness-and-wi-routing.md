# Framework Evolution — 2026-04-14 — test-journeys completeness, WI routing, viewport staging

## Method

Read `FRAMEWORK-STATE.md` (recent entries around track-visuals Step 0, S0/S1/S2 tier classifier, viewport-sequential workflow, visual-rendering AC enforcement). Reviewed `test-journeys/SKILL.md` verbatim. Grounded in observed failure modes from the 2026-04-14 J04+J08 Example Marketplace regression run (target: prod `https://example-marketplace.app`, owner Stream B). Checked `proposals/` and `proposals/done/` — no existing proposal covers the three gaps below.

## Observed failure modes from today's run

- **Scenario completeness — legitimate reasons vs efficiency shortcuts were conflated.** 5 scenarios got `⏭️`. Of those, only the 4 J04 invite-flow scenarios were genuinely infeasible (required a fresh unregistered account — primary-source evidence: `contact-cd9f2c5eed@example.invalid` already has `user_type` set). The remaining skips — J08 non-overlap same-day shift, J08 swap-with-2-employees, J08 edit+update — were skipped **for session efficiency**, not infeasibility. None were routed to `write-e2e` or filed as WIs. The skill at `test-journeys/SKILL.md:338-345` does not distinguish infeasible-skip from efficiency-skip and does not require the former to auto-route to `write-e2e`.
- **Work-item creation:** 4 findings surfaced (F1 text drift, F2 HIGH live-UI-update bug, F3 SCH-37 drift, F4 a11y). Zero WI files were created. Findings live only as bug-blockquotes in two spec files and a SUMMARY.md — they will not show up in any WI list, roadmap, or task graph. `test-journeys/SKILL.md:338-345` (Routing Rules) routes findings to *other skills* abstractly but does not require a WI artifact.
- **Viewport staging:** The skill at `test-journeys/SKILL.md:83-85` mandates "minimum one critical journey path at desktop and mobile" in one pass. Today's run deferred mobile entirely and called it complete. The correct policy — as expressed by the user, and already encoded for `track-visuals` in FRAMEWORK-STATE's 2026-04-13 viewport-sequential workflow — is **desktop first → fix → validate → only then mobile/tablet**. This pattern exists for global visual changes (track-visuals) but is absent from test-journeys.
- **Evidence storage incoherent with track-visuals.** Today's run saved screenshots to `docs/specs/features/test-evidence/2026-04-14-prod-employee-regression/`. FRAMEWORK-STATE's 2026-04-13 visual screenshot lifecycle mandates `.svc/visuals/<WI>/` with naming `<JourneyID>-step<N>-<state>-<viewport>.png`. `test-journeys/SKILL.md:303-308` already acknowledges this handoff but scopes it to "when track-visuals is active for the same WI" — i.e. optional. Result: two parallel evidence trees, no cross-reference, screenshots captured by test-journeys cannot feed the track-visuals baseline/diff workflow.

## Findings (by priority)

### P0 — Fix now (blocks quality)

#### F-01 — test-journeys does not create Work Items for discovered defects

**Evidence:** `test-journeys/SKILL.md:338-345` (Routing Rules) names four downstream skills (`audit-ac`, `write-journeys`, `sync-spec-code`, `write-e2e`) but never requires a WI file. Step 5 evidence layout (`:324-335`) specifies `SUMMARY.md` and updates to spec AC tables, but no `docs/work-items/<WI>-*.md` entry. Today's F2 (HIGH — live UI updates require page reload, breaks the "live ops dashboard" value prop) has no WI. F3 (SCH-37 spec drift) has no WI.

**Why it matters:** findings that don't become work items don't get prioritised, assigned, or scheduled. `sync-spec-code` handoff alone is insufficient — `sync-spec-code` resolves spec drift but does not open a bug WI for the behavioural defects. The builder cannot see F2 on their roadmap without opening three files.

**Fix:** Add mandatory Step 4.5 "Open Work Items for Defects" between current Steps 4 and 5:

```
### Step 4.5: Open Work Items for Defects

For each finding at severity HIGH or CRITICAL, create one file under
`docs/work-items/WI-<NNN>-<slug>.md` before Step 5. Template:

- Title, severity, status: OPEN
- Reproduction: scenario ID + evidence screenshot path
- Expected vs actual, linked AC IDs, suggested owner skill
- Route: `diagnose-bug` for behavioural defects, `sync-spec-code` for drift,
  `write-e2e` for gaps that need durable tests

For MEDIUM findings: create a WI unless the user explicitly opts out.
For LOW findings: file as a single "minor-findings" WI or route to `quick-fix`.
```

Update `Routing Rules` list to end with:

```
- Behavioural defects / regressions discovered -> WI file + `diagnose-bug`
- Pre-existing known-limitation ACs (⛔ E2E column) -> WI only if user confirms
```

Update Self-Verify to add: `| 4 | WI created for every HIGH/CRITICAL finding | grep docs/work-items/WI-*-<date>-* | |`.

#### F-02 — test-journeys has no scenario-completeness gate and conflates skip reasons

**Evidence:** `test-journeys/SKILL.md:372+` (Self-Verify) checks "QA column updated", "evidence captured", "no unresolved TBDs" — but never checks that every scenario tagged by the in-scope journeys has a QA status. Today's run skipped 5 scenarios as `⏭️`. Only the 4 J04 invite scenarios were genuinely infeasible (primary-source evidence: pre-provisioned `contact-cd9f2c5eed@example.invalid` already has `user_type` set — cannot replay invite). The 3 J08 skips (non-overlap, swap-2-employees, edit+update) were efficiency skips with no durable follow-up.

**Why it matters:** `full regression` mode promises to execute all scenarios for selected scope. Without a gate, the runner can silently narrow scope — both for "can't test right now" reasons AND for "don't want to spend the tokens" reasons — and both produce the same `⏭️` marker with the same visual weight. The second class of skip is a methodology failure; the skill currently has no way to distinguish or prevent it.

**Fix:** Enforce a three-state skip contract. Add Step 0.5 "Scenario Inventory" (before Step 1) that builds a checklist of every `# Scenario:` block in the in-scope journey docs, persists it to the evidence dir as `scenarios.json`, and requires each to end in exactly one of:

| Terminal status | Allowed when | Required artefact |
|---|---|---|
| `executed` | scenario was actually run | spec AC column updated + screenshot filepath |
| `skipped-infeasible` | runtime environment blocks the scenario (fresh-account requirement, external dependency, etc.) with cited evidence | mandatory WI routed to `write-e2e` with the provisioning gap recorded |
| `skipped-user-approved` | user explicitly said "don't run this one" | quote or timestamp of the user approval |

Efficiency skips are **not** an allowed terminal state. If the runner believes a scenario is low-value to execute, they must either surface the proposal to the user (who chooses `skipped-user-approved`) or execute it. Add Self-Verify check: no scenario ends `⏭️` without one of the two allowed reasons + required artefact.

Update Routing Rules: `skipped-infeasible -> write-e2e` (durable test with provisioning fixture — write-e2e can create the fresh account the manual flow can't).

### P1 — Fix soon (degrades quality)

#### F-03 — Viewport policy is single-pass; should be staged (desktop-first)

**Evidence:** `test-journeys/SKILL.md:81-86` requires desktop + mobile at minimum in the same run. FRAMEWORK-STATE 2026-04-13 already codifies for track-visuals: *"Viewport-sequential workflow for global changes (desktop → fix → mobile → fix)"*. test-journeys has no equivalent.

**Why it matters:** Running both viewports before the desktop defects are fixed produces duplicate failure noise (F2-style bugs repeat on mobile, no new signal). The user explicitly confirmed the desired policy in the 2026-04-14 example-marketplace session: *"first go desktop we fix validate and then go over other viewports — no point"*.

**Fix:** Replace the current viewport-coverage paragraph with:

```
Stage viewport coverage. `smoke` and `regression` modes run desktop (1280×800)
first. On desktop PASS (or after all desktop defects are either fixed or
filed as WIs), run a second pass at mobile (375×812). Tablet (768×1024)
only when UX/UI docs define tablet-specific behaviour. A single-pass run
that claims both viewports are covered without the staging is a contract
violation — mark the missing viewport ⏭️ with reason "desktop baseline
not yet clean" and file a follow-up WI.
```

Mirror in Self-Verify check: `viewport_stage=desktop|mobile|tablet` recorded in SUMMARY.md.

#### F-04 — Per-state screenshot coverage is implicit, AND evidence storage is not cohesive with track-visuals

**Evidence (two-part):**

*Part A — coverage:* `test-journeys/SKILL.md:299` says "Screenshot per AC verification (PASS or FAIL)". Self-Verify only checks `test -d docs/specs/features/test-evidence/`. Today's run took 7 screenshots for 13 executed scenarios — AC-level coverage missing for most clock/break/shift state transitions. The F2 finding was recorded without a PASS-state screenshot of the card reaching "On Shift" — only a post-click failure capture existed.

*Part B — storage cohesion:* `test-journeys/SKILL.md:303-308` says "when track-visuals is active for the same WI, journey QA screenshots **should be saved** to `.svc/visuals/<WI>/`" — soft guidance scoped to "when track-visuals is active". Today's run saved everything to `docs/specs/features/test-evidence/2026-04-14-prod-employee-regression/`, disconnected from any track-visuals WI. The two evidence trees cannot cross-reference. track-visuals' baseline/diff workflow (FRAMEWORK-STATE 2026-04-13) cannot consume test-journeys captures. The builder now has to know which tree to look in for which workflow — duplicated mental model.

**Why it matters:** The skill-intent is "evidence before assertion" but the gate is "folder exists" — and evidence captured outside the track-visuals tree is structurally dead (no baseline, no diff, no promotion to golden). For F2-class findings, a before/after pair is needed AND it should be reusable by the visual-diff workflow once the fix ships.

**Fix:**

1. **Cohesive storage — make track-visuals path the default, not an opt-in.** Change `test-journeys/SKILL.md:303-308` from "when track-visuals is active" to **always**: every journey screenshot goes to `.svc/visuals/<WI>/<JourneyID>-step<N>-<state>-<viewport>.png`. The `test-evidence/` dir becomes a SUMMARY.md + metadata + symlinks to the canonical files under `.svc/visuals/`. When no WI is active (ad-hoc regression), use `.svc/visuals/adhoc-<YYYY-MM-DD>/` — still under the track-visuals namespace so a later `track-visuals` run can promote or diff.

2. **Coverage enforcement:** every AC marked ✅ for a visual outcome must have a filename-referenced screenshot under the canonical path AND be cited in the AC row's QA column (format `✅ MM-DD screenshot=logs/visuals/<WI>/<file>`). Self-Verify check: `grep -E '✅.*screenshot=' <spec>.md | wc -l ≥ count of visual ACs marked ✅`.

3. **Naming adopts track-visuals convention verbatim** so that `track-visuals diff` and `track-visuals review` can consume journey captures without adaptation.

### P2 — Improve when possible

#### F-05 — "⏭️ not-executed" has no durable backlog routing

**Evidence:** skipped scenarios drop into SUMMARY.md prose and nowhere else. No JSON feed or WI so `route-workflow` / `roadmap-evaluation` can see them.

**Fix:** Alongside F-02's `scenarios.json`, emit skipped entries to `docs/work-items/WI-auto-<date>-deferred-scenarios.md` as a single rolling file the user can triage.

### P3 — Track (not actionable yet)

None.

## Comparison delta

gstack's review-gate embeds evidence-graded findings directly into the gate output and produces WI-like records. svc test-journeys currently matches gstack on *finding format* (severity + evidence) but lags on *artifact persistence* — gstack's WIs are first-class, svc's live only in spec blockquotes. F-01 closes this gap.

## Stale proposal audit

- `proposals/done/2026-04-13-visual-coverage-and-comprehension.md` → shipped (viewport-sequential in track-visuals). Precedent for F-03.
- `proposals/done/2026-04-14-visual-ac-code-inspection-tier.md` → shipped (S0/S1/S2). This proposal builds on that work — does not duplicate.
- No stale proposals found for test-journeys.

## Suggested next step

Route to `improve-framework` to implement — in order — F-02 (skip contract + write-e2e routing), F-01 (WI creation Step 4.5), F-04 (cohesive storage under `.svc/visuals/` + coverage enforcement), F-03 (desktop-first viewport staging). Together these four close the methodology gaps surfaced by today's Example Marketplace run. F-05 can land in a follow-up.
