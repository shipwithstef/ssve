# Framework Improvement: benchmark-landing rubric v2 (liveness + design-delta + captured-anchor)

## Evidence

- **Source:** `proposals/2026-04-21-evolution-benchmark-landing-liveness-gap.md` (pending proposal from evolve-framework, triggered by user diagnostic on WI-088 iter1 — example-marketplace landing hero that scored 7.50/10 PASS but was visually indistinguishable from the pre-WI-088 baseline).
- **Finding:**
  - `benchmark-landing/SKILL.md:47` — dimension 8 (weight 1.5, heaviest) scored on claims, not captures. iter1 scored 7/10 "OpenTable-archetype" with no OpenTable in bank.
  - `benchmark-landing/SKILL.md:42` — dimension 3 "motion tempo" conflates count, cycle-time, and pixel-area. iter1 scored 9/10 on a motion element at 8-second cycle and 0.01% viewport area.
  - `benchmark-landing/SKILL.md` (whole rubric) — no dimension scores visual delta from predecessor, so iterations can regress to baseline while passing the gate.
  - `references/landing-bank/local-business-saas/README.md:11-32` — 5 samples listed, zero captures, medians asserted.
- **Severity:** high. The skill's primary claim (external benchmark against best-in-class) failed on its highest-weighted dimension.

## Diagnosis

- **Root cause:** rubric v1 optimized for internal consistency against asserted sector medians, not against captured evidence. It could emit PASS on designs that are cold-glance indistinguishable from a failing baseline.
- **Category:** fragility (rubric holds under normal cases but collapses under the common case of "iteration that narrowed the motion count but removed information density") + missing capability (no predecessor delta dimension).
- **Already in FRAMEWORK-STATE.md?** No (new). The 2026-04-20 benchmark-landing gate entry landed the skill; the v2 rubric gaps were only exposed by the first real iteration cycle WI-088 iter0→iter1.

## Implementation

- **Route:** direct SKILL.md edit (isolated skill surgery, no new skill needed, no pipeline change).
- **Files changed:**
  - `benchmark-landing/SKILL.md` — rubric header rewritten (10 dimensions, v2); Step 0 precondition (capture-bundle ≥3 requirement, HALT on miss); Step 1 extended (motion WebM + optional predecessor PNG); Step 4 Omni prompt extended for 3b/8/9; example YAML updated with new fields; Self-Verify table extended from 6 to 10 checks.
  - `references/landing-bank/local-business-saas/README.md` — samples table gains `positioning` + `capture bundle` columns; top banner marks bank as asserted-pending-capture; F-014 (indie-alive positioning gap) surfaced with candidate sources.
  - `FRAMEWORK-STATE.md` — new Analysis History entry for 2026-04-21 detailing gaps, fixes, locked decisions, deferred P1/P2 items.
  - `proposals/2026-04-21-evolution-benchmark-landing-liveness-gap.md` — status marked IMPLEMENTED; will move to `proposals/done/`.
- **Commits:** see git log on same date.

## Replay Verification

- **Replay target:** apply v2 rubric mentally to WI-088 iter1's artifacts and confirm the PASS would NOT have been emitted.
- **Result:** PASS (gap closed).
- **Evidence:**
  1. Step 0 precondition: `references/landing-bank/local-business-saas/` has 0 capture bundles (all 5 samples ⛔ PENDING per updated README). v2 would HALT at Step 0 before emitting any score. → iter1's 7.50 score would never have been written.
  2. Dimension 3b (liveness perceptibility): iter1 has one motion element with 8-second cycle (fails ≤4s threshold) and one `animate-ping` at 1.5×1.5px ≈ 0.01% hero area (fails ≥0.5% threshold). Zero motion elements qualify under v2. Score would be 1-3 (static reads). Old motion_tempo 9/10 → new 3b ~2/10.
  3. Dimension 9 (design delta vs baseline): side-by-side capture of iter1 vs `04e35411` baseline — identical silhouette, identical split-hero, identical fake-browser-chrome. Cold-glance-indistinguishable. Score 2-4/10.
  4. Even ignoring Step 0 halt, dimension 3b and dimension 9 would each drop ≥5 points below their iter1-yaml-recorded values. Weighted aggregate on a per-viewport basis would fall below 7 → BLOCK at the gate. → iteration would have been forced to continue rather than declared done.
- **Conclusion:** the specific failure mode that motivated the diagnostic cannot recur under v2.

Note: this is qualitative verification per SKILL.md Step 6 ("If the gap was qualitative (not testable by test-framework): require a cross-model review or manual verification instead"). Full end-to-end v2 validation requires the first capture-bundle landing + a fresh benchmark run against a real candidate; tracked as P1.

## FRAMEWORK-STATE.md Mutations

- **Analysis History:** new entry `### 2026-04-21: benchmark-landing rubric v2…` (landed).
- **Known Gaps:** F-012, F-013, F-015 move from proposal-pending to closed via this loop. F-014 (indie-alive bank samples), F-016/F-017/F-018/F-019/F-020 remain deferred with explicit tracking.
- **Decisions:** rubric v2 is the minimum for new scoring runs. Dimension 3b thresholds locked (cycle ≤4s, area ≥0.5%). Step 0 halt is ungated (no override). Greenfield dimension-9 skip redistributes weight proportionally.
- **Capabilities:** no new skill; no change to skill count. Capability matrix unchanged at the index level — benchmark-landing remains, with v2 rubric internally.

## Pending follow-ups (tracked in Known Gaps)

- F-001-expansion: capture bundles for the 5 current samples (OpenTable, Resy, Square, Mindbody, Top of Mind Networks) + add 3 indie-alive samples (Linear, Raycast, Attio candidate). Without these, `benchmark-landing` halts at Step 0 for every local-business-saas candidate. High priority — the skill is now *more* strict but also *more* blocked until the bank lands real captures.
- F-017: `scripts/compute-sector-medians.mjs` to regenerate the bank README median table from per-sample pattern.md files.
- F-005: quality timeseries — prerequisite for F-018 override audit trail.
