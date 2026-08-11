# Framework Improvement: validate-feature DEFER decision state

## Evidence

- **Source:** `proposals/2026-04-21-evolution-validate-feature-defer.md` (pending evolve-framework proposal).
- **Finding:** `validate-feature/SKILL.md:684-691` Decision matrix only permits SHIP / PIVOT / SHIP WITH WARNINGS / NO-SHIP. No DEFER state. Conceptually-valid features blocked ONLY by Builder-Profile timing constraints (e.g., `[zero-to-revenue-gap]`, "no audience yet") were forced into NO-SHIP. Result: idea killed permanently OR framework overridden — both bad outcomes.
- **Severity:** high. Directly affects zero-to-revenue builders (Stefan's profile: 50+ projects, $0 revenue). Every legitimate "Stage 2" idea currently hits this wall.

## Diagnosis

- **Root cause:** svc's decision matrix was optimized for pre-launch discipline (kill bloat aggressively) but ignored the backlog-preservation case that mature PM frameworks (RICE "Won't have this time", MoSCoW "Won't") handle natively. Missing capability, not drift.
- **Category:** missing capability.
- **Already in FRAMEWORK-STATE.md?** No.

## Implementation

- **Route:** direct SKILL.md edit (isolated skill surgery, no new skill, no pipeline change).
- **Files changed:**
  - `validate-feature/SKILL.md` — Decision matrix extended (new DEFER row); NO-SHIP vs DEFER disambiguation table added; DEFER Protocol section authored (parallel to NO-SHIP Evidence Package); artifact routing specified (brief Status: DEFERRED, INDEX.md blocked-by-<milestone> severity tag, pipeline-log --decision allowed value); downstream routing table new row; Self-verify check 4 updated + new check 4a for DEFER-specific artifact requirements.
  - `FRAMEWORK-STATE.md` — 2026-04-21 Analysis History entry with locked decisions.
  - `proposals/2026-04-21-evolution-validate-feature-defer.md` — Status marked IMPLEMENTED; moved to `proposals/done/`.
- **Commits:** see git log on same date.

**Additive edit:** +83 lines to validate-feature/SKILL.md (964 → 1047). No content removed; Step 5.5 refactor-safety verifier not applicable (applies to removal/migration cases).

## Replay Verification

- **Replay target:** scenario "builder with `[zero-to-revenue-gap]` constraint runs validate-feature on an iter2 landing feature that has no current user demand only because no users exist yet" — would this skill kill the idea (pre-edit) or shelve it correctly (post-edit)?
- **Result:** PASS (qualitative).
- **Evidence:**
  1. Pre-edit trace: K1 fires (no demand — no users exist). No alternative exists (this IS the product). 2+ signals with no stronger pivot → current matrix routes to SHIP WITH WARNINGS at best, NO-SHIP if K6 also fires (which it does for a landing redesign requiring real backend hookups). Idea dies.
  2. Post-edit trace: K1 fires (no demand — due to zero-to-revenue-gap). K6 may fire (platform scope). Only K1/K6 firing + Builder-Profile constraint named → DEFER triggers. Brief writes with `Status: DEFERRED`, INDEX.md entry tagged `blocked-by-first-paying-customer`, pipeline-log records DEFER with milestone. Feature persists; re-surfaces on milestone.
  3. Guardrail check: scenario "K3 competitor shipped + K1 no demand" — DEFER would be wrong here because K3 is structural. Rubric requires "only K1/K6 firing AND a Builder-Profile timing constraint" → DEFER refuses to fire; correctly routes to NO-SHIP. Guardrail holds.
  4. Milestone-required guardrail: scenario "builder says 'defer this'" without a concrete milestone — rubric requires a verifiable milestone; "when I have time" is explicitly rejected. Falls back to NO-SHIP. Guardrail holds.
- **Conclusion:** the specific failure mode that motivated this proposal cannot recur. Escape-hatch abuse (DEFER-everything) is prevented by the 4-requirement rubric.

Qualitative verification per SKILL Step 6 — this is a rubric/protocol change, not a testable behavior. A live run on a real feature + milestone would further validate, but the four-requirement rubric and replay traces are sufficient evidence the gap is closed.

## FRAMEWORK-STATE.md Mutations

- **Analysis History:** new entry `### 2026-04-21: validate-feature — DEFER decision state…` (landed).
- **Known Gaps:** F-001 closed via this loop.
- **Decisions:** DEFER requires (a) only K1/K6 firing, (b) named Builder-Profile constraint, (c) concrete verifiable milestone, (d) revisit trigger. DEFER halts pipeline like NO-SHIP. Re-surface is via roadmap-evaluation on milestone, not time-based auto-retry.
- **Capabilities:** `validate-feature` now emits 5 terminal decisions (was 4). No skill count change.

## Pending follow-ups

- Downstream: `roadmap-evaluation` should grow a "list deferred features with milestone status" view that queries INDEX.md for `blocked-by-<milestone>` tags + checks whether those milestones have fired. Not in scope for this improvement loop; file as separate proposal when roadmap-evaluation is next touched.
- Downstream: `capture-idea` could grow a "this is a DEFER candidate" quick path for ideas that the builder already knows are timing-blocked, skipping the full business-question flow. Deferred until actual pattern of use emerges.
