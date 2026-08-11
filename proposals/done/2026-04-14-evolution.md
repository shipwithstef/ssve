# Framework Evolution — 2026-04-14

## Method

Triggered by user question: "why were these visual issues not caught?" during WI-048 close-out. The user pasted a post-deploy screenshot of Example Marketplace prod (2026-04-14T02:58) showing visual issues that should have been caught before VERIFIED status.

Evidence read:
1. `FRAMEWORK-STATE.md` — all 2026-04 entries, especially line 348-354 (WI-032 visual evidence enforcement) and line 237-245 (S0/S1/S2 tier model, committed earlier today)
2. `route-workflow/SKILL.md` lines 1776-1790 (Lane 6) and 2027-2039 (mandatory-step validation)
3. `review-gate/SKILL.md` line 535 (visual evidence gate #4)
4. `test-journeys/SKILL.md` lines 161-200 (Step 2.5 S0/S1/S2 + Step 3 browser)
5. Example Marketplace `.svc/lane-tasks-WI-048.json` (6-task graph, no track-visuals)
6. Example Marketplace `.svc/pipeline-decisions.jsonl:16` — route-workflow reclassified WI-048 to `chore` lane 6
7. Live grep on Example Marketplace main @ HEAD — found 2 unguarded light gradients still on prod after VERIFIED

## Findings (by priority)

### P0 — Fix now (blocks quality)

---

#### P0-1: Lane 6 (chore/refactor) bypasses mandatory track-visuals even when the chore touches browser-visible CSS

**Evidence:**
- `route-workflow/SKILL.md:1776-1790` defines Lane 6 as 8 steps with no `track-visuals` step
- `route-workflow/SKILL.md:2027-2032` says: "If the change touches browser-visible surfaces (pages, components with UI rendering), validate that the task graph includes ALL of these steps" — but this validation lives in a section after all lane definitions and is not wired into Lane 6 task-graph creation
- `.svc/pipeline-decisions.jsonl:16` (Example Marketplace): "WI-048 type reclassified chore (mechanical Tailwind class additions, no behavior change)" → routed through Lane 6 with 6-task graph, zero `track-visuals` steps
- Lane 6 text at line 1779-1780 describes chores as "behavior should stay materially the same, or the work is primarily structural/state-management" — conflating "mechanical change" with "not browser-visible." CSS class changes are mechanical AND browser-visible.
- Result: WI-048 shipped 82 modified .jsx files with dark mode CSS changes, marked VERIFIED, zero screenshots taken.

**Category:** Drift (rule exists in route-workflow but not enforced by Lane 6 task creation)

**Specific fix:**
1. `route-workflow/SKILL.md:1776-1790` — add explicit gate at the top of Lane 6: "**Browser-visible check:** Before picking this route, if the change modifies any `.jsx/.tsx/.vue/.svelte/.html/.css` file or any className string, treat as browser-visible. Insert `track-visuals` baseline (before execute-changeset) and `track-visuals` diff (after execute-changeset) into the task graph. Only skip with explicit `SKIP: not browser-visible because [reason]` justification logged in the task description."
2. `route-workflow/SKILL.md:2027-2039` — extend mandatory-step validation to fire for ANY lane (not just feature/bugfix). Move the validation to Step 5 of every lane's task-graph creation, not just feature lanes.
3. Add self-verify check in `route-workflow/SKILL.md`: if task graph has no `track-visuals` task AND the WI's file-set includes any `.jsx`/`.tsx`/CSS file, FAIL with error pointing to the skip-justification requirement.

---

#### P0-2: AC validation commands in manifests are agent-authored with no coverage check — narrow greps pass while edge cases leak to prod

**Evidence:**
- WI-048 DM-21 AC: "Global grep for unguarded `bg-gradient + from-{color}-50/100` (no `dark:` on same element) returns 0 results"
- Agent's grep command (`lane-tasks-WI-048.json`, manifest validation): `grep -E '\bfrom-(slate|purple|...|violet|white)-(50|100)\b' | grep -v 'dark:'`
- Grep only matched `from-*` stops. Missed `via-*-50/100` and `to-*-50/100` stops.
- Also missed `from-white` (no numeric suffix).
- **Post-VERIFIED grep on main:** 2 unguarded light gradient stops still present:
  - `src/components/UserNotRegisteredError.jsx:5` — `from-white to-slate-50` (full-screen error page, user-facing)
  - `src/pages/Landing.jsx:394` — `from-white/10 to-white/5` (semi-transparent glass effect, likely intentional)
- AC grep returned 0 because it was syntactically correct for a narrow interpretation. The AC wording also said "from-{color}-50/100" — agents will match that literally.

**Category:** Fragility (ACs pass as written but don't cover the semantic intent)

**Specific fix:**
1. `plan-changeset/SKILL.md` — add new Adversarial Review check #6: "For any AC that uses a regex/grep/pattern as its PASS criterion, the agent MUST run a broader 'anti-pattern sweep' variant of the pattern before declaring the AC met. Document both the narrow AC-match command AND the broader sweep command in the manifest validation plan."
2. `review-gate/SKILL.md` G5 — add Pass 1 check: "If the AC uses a code-pattern match, re-run the pattern with adjacent variants (e.g., all gradient directions for a gradient AC, all color endpoints for a color AC). Document the broader result in the review record."
3. Add pattern-family reference at `references/validation-patterns.md` (new file) with common gotchas:
   - Gradient stops: `from-`, `via-`, `to-`, all three must be checked
   - Color suffixes: `-white`, `-black`, `-current`, `-transparent` have no numeric suffix
   - Tailwind opacity modifiers: `/50`, `/10`, etc. must be considered
   - Template literals with dynamic class strings: grep misses these without capture

---

#### P0-3: S0 code-inspection tier overclaims sufficiency for visual CSS changes

**Evidence:**
- `FRAMEWORK-STATE.md:237-245` (committed earlier today) established S0/S1/S2 model
- `test-journeys/SKILL.md:161-185` (Step 2.5) says "S0 — Static: CSS classes present, Tailwind tokens" → verify by grep, mark PASS
- Today's replay verification for DM-22/DM-23 was grep-only. Passed. But:
  - Post-deploy, user's screenshot shows visual issues (we can't see it, but the question exists)
  - CSS class presence cannot verify: (a) Tailwind JIT actually compiled the class into the CSS bundle, (b) no specificity conflict overrides the dark: rule, (c) the CSS variable (like `--background`) is actually defined in dark mode, (d) the rendered color at `/50` opacity looks as intended
  - **Class presence ≠ Correct rendering.**
- We just committed a framework rule (2026-04-14, S0/S1/S2) that would have blessed WI-048's grep-only validation. This is a self-inflicted quality risk.

**Category:** Drift (new rule committed today partially contradicts the P0-1 visual-evidence requirement)

**Specific fix:**
1. `test-journeys/SKILL.md` Step 2.5 — add qualifier to S0: "S0 is sufficient for **structural** ACs (class presence, config wired, enum match). For **visual-rendering** ACs (the element *looks* correct in dark mode, at breakpoint X, with state Y), S0 is necessary but not sufficient — a track-visuals diff or at minimum an S1 screenshot MUST follow S0."
2. `test-journeys/SKILL.md` — add a new tier classifier lookup table:
   | AC phrasing pattern | Required tiers |
   |---|---|
   | "X class is present / wired / set" | S0 only |
   | "X does not show / displays correctly / appears as" | S0 + S1 |
   | "X renders correctly in dark mode / at mobile / with Y state" | S0 + S1 (screenshot) |
   | "X matches design token / matches baseline" | S0 + track-visuals diff |
3. `FRAMEWORK-STATE.md:237-245` — append correction noting the S0 sufficiency qualifier

---

### P1 — Fix soon (degrades quality)

---

#### P1-1: `track-visuals` invocation is not wired into the WI registration / lane-task-creation flow for visual WIs

**Evidence:**
- `docs/specs/work-items/WI-048.md` filed 2026-04-13 with category "feature" and scope "43 pages + 29 components" — clearly browser-visible
- When `route-workflow` constructed the task graph, it reclassified to chore, skipping track-visuals
- No step in `register-work-item` or equivalent asks: "does this WI touch UI? if yes, force track-visuals baseline before first execute-changeset call"
- The existing track-visuals baseline/diff lanes at `route-workflow/SKILL.md:1662,1668` are conditional — not unconditional

**Category:** Gap (WI→task-graph handoff has no UI-impact classifier)

**Specific fix:**
1. Add a "UI-Impact Audit" step to any WI-registration skill (likely `route-workflow` pre-task-graph): read the WI spec for keywords (page, component, visual, dark, theme, responsive, gradient, color, layout, render, style, CSS, Tailwind) and auto-tag `ui_impact: true`. If tagged true, track-visuals baseline task is auto-inserted at position 0 of the task graph.
2. A WI marked `ui_impact: true` cannot transition to VERIFIED without at least one track-visuals diff or screenshot attached to the close commit.

---

#### P1-2: The "chore" classification is overloaded and misleads lane selection

**Evidence:**
- `route-workflow/SKILL.md:1804` signal: "Tracker, docs, or housekeeping item" → chore
- `route-workflow/SKILL.md:1779-1780` lane: "behavior should stay materially the same, or the work is primarily structural/state-management"
- WI-048 (bulk mechanical CSS class additions) matched "structural" and "no behavior change" → chore → Lane 6
- But "no behavior change" at the JS level is independent of "no visual change" at the render level. Tailwind class additions literally CHANGE RENDERING.

**Category:** Drift (chore classifier uses "behavior" in a JS sense but CSS changes are out-of-scope)

**Specific fix:**
1. `route-workflow/SKILL.md:1796-1804` change-type table — add row: "CSS/style-only change with no JS behavior change" → separate type `style-refactor` → Lane 6 BUT with forced `track-visuals` baseline + diff
2. Or simpler: amend the chore row to read: "Tracker, docs, or housekeeping item with NO CSS/Tailwind/className impact. If CSS classes change, treat as `refactor` with visual verification required."

---

### P2 — Improve when possible (nice to have)

---

#### P2-1: Post-fix validation commands in manifests don't check "adjacent patterns" for completeness

Evidence: Same as P0-2 but framed as a plan-changeset improvement rather than a review-gate one. A pending manifest's validation section should always include at least 2 grep variants: narrow (exact AC match) and broad (adjacent patterns). This is addressable during plan-changeset.

---

#### P2-2: Agent-authored grep commands don't leverage pre-built validation libraries

Evidence: Every WI reinvents grep patterns. A pre-built `references/tailwind-coverage-checks.sh` or similar with battle-tested patterns would reduce errors. e.g., `check-unguarded-dark-gradients.sh` already encapsulated as a single-command assertion.

---

### P3 — Track (not actionable yet)

---

#### P3-1: Framework self-test would catch this earlier

test-framework doesn't currently simulate WI → lane-task → track-visuals routing. A regression test where test-framework runs a fake CSS-only WI and asserts "track-visuals task exists in generated graph" would catch P0-1 systematically.

---

## Comparison delta

**gstack:** `gstack ship/` has a mandatory visual baseline step for any UI change (per `skill-pack-comparison.md`). svc has the step but doesn't enforce it for Lane 6. This is a regression within svc, not a gap vs gstack.

**superpowers:** two-stage review (Pass 1 spec, Pass 2 quality) would not have caught this because both passes were grep-based in WI-048. The gap is upstream — in the task graph, not the review gate.

## Stale proposal audit

- `proposals/done/2026-04-13-track-visuals-review-mode.md` — implemented, but review-mode wasn't invoked for WI-048 (never triggered because no screenshots captured)
- `proposals/done/2026-04-14-visual-ac-code-inspection-tier.md` — implemented earlier today, now partially contradicted by this proposal (P0-3). Need follow-up correction, not rollback.
- No other pending proposals.

## Recommended Implementation Sequence

1. **First:** P0-3 (correct S0 sufficiency qualifier) — must be done BEFORE any WI uses the new S0/S1/S2 tier today. Single-file edit.
2. **Second:** P0-1 (Lane 6 browser-visible check) — highest leverage, prevents recurrence. Route-workflow edit.
3. **Third:** P0-2 (AC pattern-family validation) — addresses the grep narrowness bug. plan-changeset + review-gate edits.
4. **Fourth:** P1-1, P1-2 (WI-registration UI-impact audit + chore reclassification). Route-workflow edits.
5. **Defer:** P2-* and P3-* until first three land and WI-049+ proves the fix.

## Replay target

To verify fixes: re-run a fake CSS-only WI through route-workflow after P0-1 is implemented. The generated task graph MUST contain track-visuals baseline + diff. If the graph has neither, the fix is incomplete.
