# Framework Evolution — 2026-04-13: Visual Screenshot Lifecycle

## Method

Read and compared: `track-visuals/SKILL.md` (full), `verify-promotion/SKILL.md` (lines 1-254),
`land-changeset/SKILL.md` (lines 1-80), `write-e2e/SKILL.md` (lines 1-60),
`skills-manifest.json` pipeline + lane definitions,
`FRAMEWORK-STATE.md` (known gaps, decisions, analysis history for visual-related entries),
`proposals/done/2026-04-12-visual-verification-enforcement.md` (prior art — implemented).

User input (round 1): "we need visual validation — not item specific but generic place
where we store images — should it be before or after E2E?"

User feedback (round 2): "can't have logs/visuals and specs/visuals stay decoupled —
visuals need to be promoted. Fine to store affected visuals temporarily but then needs
to be promoted or aligned post-change. Also consider competing branches that might
merge and require re-capture."

## Findings (by priority)

### P0 — Fix now (blocks quality)

None.

### P1 — Fix soon (degrades quality)

#### 1. Visual screenshots have no lifecycle — they accumulate without promotion or cleanup

**Category:** Gap + Fragility

**Evidence:**
- `track-visuals/SKILL.md:132` — golden baseline saved to `docs/specs/visuals/baseline/`
  after design-ui. Never systematically updated after that.
- `track-visuals/SKILL.md:236` — review mode reads from `.svc/visuals/<WI>/`,
  a separate working directory. No cleanup trigger exists.
- `track-visuals/SKILL.md:196-208` — update mode says "replace baseline" or "selectively
  update" but doesn't describe manifest merging, WI attribution, or cleanup of working dir.
- `verify-promotion/SKILL.md:107-123` — G7 checks visual evidence but does NOT trigger
  baseline promotion or working-dir cleanup after passing.
- **Result:** WI working screenshots accumulate in `.svc/visuals/<WI>/` indefinitely.
  Golden baseline drifts. Each subsequent diff compares against stale baseline, producing
  noise. Storage grows unbounded.

**Fix: Define a 4-state visual screenshot lifecycle**

| State | Where | Trigger | Who |
|-------|-------|---------|-----|
| **CAPTURED** | `.svc/visuals/<WI>/` | execute-changeset invokes track-visuals diff | track-visuals |
| **DIFFED** | diff report in `docs/specs/visuals/diffs/<date>/` | track-visuals diff mode compares to golden baseline | track-visuals |
| **PROMOTED** | affected screenshots replace their counterparts in `docs/specs/visuals/baseline/` | verify-promotion G7 passes with intentional visual changes | verify-promotion → track-visuals update |
| **CLEANED** | screenshot files in `.svc/visuals/<WI>/` deleted; logs/reports preserved | after successful promotion | verify-promotion |

**Skill changes required:**

**A. `track-visuals/SKILL.md` — rewrite Update Mode (lines 194-208)**

Replace the current loose "mv baseline" instructions with:

```markdown
### Update Mode (Promote + Cleanup)

After verify-promotion G7 passes with intentional visual changes:

**Step 1: Identify screens to promote**

From the diff report, list all CHANGED entries marked intentional.

**Step 2: Promote to golden baseline**

For each intentional change:
1. Copy the new screenshot from the WI working dir (or diff capture) to
   `docs/specs/visuals/baseline/`, replacing the old version.
2. Update `baseline/manifest.md`: set `last_verified_by: <WI-ID>` and
   `last_verified_date: <date>` on the affected row. Preserve unchanged rows.

For NEW screens (not in baseline):
1. Add the screenshot to baseline.
2. Add a new row to the manifest.

For MISSING screens (route removed):
1. Delete the screenshot from baseline.
2. Remove or mark the manifest row as `[REMOVED — <WI-ID>]`.

**Step 3: Cleanup screenshot files (preserve logs)**

Delete only `.png`/`.jpg`/`.webp` screenshot files from `.svc/visuals/<WI>/`
after promotion. Preserve all other files (review reports, manifests, analysis
logs) — these are needed for platform improvement and analysis.

**Step 4: Verify manifest consistency**

Count screenshots in `baseline/` vs rows in `manifest.md`. They must match.
```

**B. `verify-promotion/SKILL.md` — add Step 5: Visual Baseline Promotion (after G7, before doc sync)**

Insert after G7 pass block (line ~123) and before "Post-Verification: Canary Monitoring" (line ~132):

```markdown
## Post-Verification: Visual Baseline Promotion

If track-visuals diff report exists for this feature/WI and G7 passed:

1. Read the diff report — identify CHANGED entries marked intentional.
2. **Staleness check for competing branches:** For each affected screen, check
   if the golden baseline was updated after this WI's branch point:
   ```bash
   git log -1 --format=%ci -- docs/specs/visuals/baseline/<screen>.png
   ```
   If the baseline was updated more recently (another WI promoted while this one
   was in flight), flag those screens for **re-capture before promoting** —
   the current WI's screenshots may be based on a stale state.
3. If no staleness conflicts: invoke track-visuals in `update` mode for
   affected screens.
4. If staleness conflicts: re-capture ONLY the conflicting screens against
   current main, then promote.
5. After promotion: delete screenshot files (`.png/.jpg/.webp`) from
   `.svc/visuals/<WI>/`. Preserve review reports, manifests, and
   analysis logs — these are retained for platform improvement.

Skip this step if: no visual changes, or feature has no browser-visible surface.
```

**C. `track-visuals/SKILL.md` — add Storage Convention section (after Modes, before Process)**

```markdown
## Storage Convention

| Purpose | Path | Lifecycle |
|---------|------|-----------|
| Golden baseline (canonical) | `docs/specs/visuals/baseline/` | Persistent. Updated only via promote step after G7. |
| Baseline manifest | `docs/specs/visuals/baseline/manifest.md` | Living doc. Per-screen `last_verified_by` + date. |
| Diff reports (audit trail) | `docs/specs/visuals/diffs/<date>/` | Persistent. Kept for regression archaeology. |
| WI working screenshots (ephemeral) | `.svc/visuals/<WI>/*.png` | Screenshot files deleted after promotion. |
| WI review reports & analysis (persistent) | `.svc/visuals/<WI>/*.md` | Kept permanently for platform improvement. |

`.svc/visuals/<WI>/` contains both screenshot files and analysis artifacts.
After promotion (or WI close without visual changes), **only screenshot files**
(`.png/.jpg/.webp`) are deleted — review reports, manifests, and analysis logs
are retained for platform improvement and cross-WI analysis.
```

**D. `track-visuals/SKILL.md` — update Integration Points table (line ~326)**

Add row:
```
| After verify-promotion G7 (intentional visual changes) | update (promote + cleanup) | Triggered by verify-promotion |
```

**E. `track-visuals/SKILL.md` — update manifest.md template (lines 104-130)**

Add per-screen tracking fields to the inventory table:

```markdown
| Screen | State | Desktop | Tablet | Mobile | Last verified by | Last verified date |
|--------|-------|---------|--------|--------|-----------------|-------------------|
| Dashboard | empty | ✅ | ✅ | ✅ | WI-032 | 2026-04-13 |
```

---

#### 2. Competing branches can invalidate each other's visual baselines

**Category:** Fragility

**Evidence:** No skill addresses the scenario where WI-A and WI-B both touch visual
surfaces, WI-A promotes its baseline first, then WI-B promotes based on screenshots
captured before WI-A's changes. WI-B's promotion could regress the baseline.

This is addressed in Finding #1's staleness check (verify-promotion step 2):
```bash
git log -1 --format=%ci -- docs/specs/visuals/baseline/<screen>.png
```

If the baseline for a screen was updated after the current WI branched, the promoting
WI must re-capture those specific screens against current main before promoting.
This is a staleness check at promote time, not a locking mechanism — lightweight
and sufficient for the typical 1-3 concurrent WI case.

**Not a separate fix** — folded into Finding #1's verify-promotion step.

---

### P2 — Improve when possible (nice to have)

None — all three original findings collapsed into the P1 lifecycle design.

### P3 — Track (not actionable yet)

#### 3. No automated pixel-diff in CI

**Evidence:** `track-visuals/SKILL.md:147-153` — comparison approach lists pixel diff
first but notes "if pixelmatch or similar tool is available." No project has CI-integrated
visual regression. Not actionable until at least one project has CI.

---

## Pipeline Position: Visual Validation vs E2E (confirmed, no change)

**Answer: visual validation (track-visuals) comes BEFORE E2E. Already correct.**

Pipeline from `skills-manifest.json:89-106`:

```
... → design-ui → track-visuals (BASELINE) → design-tech → ... →
execute-changeset → track-visuals (DIFF) → review-gate → ... →
land-changeset → verify-promotion (E2E + PROMOTE baseline + CLEANUP)
```

Rationale: catch visual regressions early at review-gate (cheap screenshots) before
investing in E2E verification at verify-promotion (expensive browser automation).
The new promote+cleanup step at the end of verify-promotion completes the lifecycle.

## Comparison delta

Not applicable — lifecycle management for agentic visual baselines is novel; no
competing framework addresses this (gstack, superpowers, and GSD have no equivalent).

## Stale proposal audit

- `proposals/2026-04-12-visual-verification-enforcement.md` — **moved to done/**
  (implemented per FRAMEWORK-STATE.md analysis history 2026-04-12).
