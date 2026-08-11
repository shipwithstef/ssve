# Framework Improvement: Pillars Coverage Matrix + Lane 4 Pillar Revisit + Lane 1/3 Parity + design-tech Cost/Ops

## Evidence

- **Source:** User-reported gap during Example Marketplace WI-012 session continuation, 2026-04-09
- **Finding:** Lane 4 (bugfix) — even after the same-session update adding pattern scan, mandatory e2e, retroactive mode, and output protocol — still did not force a product-level revisit. When a bug is fixed, nothing in the framework forced the question "does this affect the journey? acceptance criteria? UX? UI? tech architecture? cost? operations?" The affected-artifacts list was passive (a list), not an active audit. Related gap: Lane 1 (greenfield) and Lane 3 (brownfield extension) lacked explicit pillar parity — Lane 3's "pure background" exception silently dropped pillars (UX, UI, track-visuals) without requiring explicit `[N/A — justified]` marking. Third gap: `design-tech` did not cover cost model or operations/ownership as pillars — "cost" appeared twice in the SKILL.md, both as metaphor or passing mention. No SLA, no runbook, no on-call, no backup/restore, no dependency failure impact in the contract.
- **Severity:** HIGH
  - Pillar revisit missing: HIGH — bugfixes ship that leave specs, journeys, ACs, UX stale
  - Lane 1/3 parity: MEDIUM — pillars silently drop between lanes
  - design-tech cost/ops gap: HIGH — features ship without knowing cost, SLA, or who operates them

## Diagnosis

- **Root cause:**
  1. `route-workflow` Lane 4 and `diagnose-bug` treated "affected artifacts" as a passive list, not an active audit. No forcing function to walk the product pillars.
  2. `route-workflow` Lane 3 explicitly allowed "pure background Enabler/Integration work may skip design-ux/ui/track-visuals" without requiring the skipped pillars to be marked `[N/A — justified]`. This let pillars silently disappear.
  3. `design-tech/SKILL.md` Technical Design template had Architecture, Components, Data Model, Data Flow, External Dependencies, and Technology Decisions — but no Cost Model and no Operations & Ownership sub-sections. The concepts existed nowhere in the framework.
  4. No canonical svc concept of "pillars" existed at all. Each skill had its own list of what to fill out; there was no shared contract.
- **Category:** missing capability (pillars concept), drift (Lane 3 pillar skip without justification), missing capability (design-tech cost/ops)
- **Already in FRAMEWORK-STATE.md?** No. None of these were in Known Gaps.

## Implementation

- **Route:** Direct SKILL.md edits + 1 new reference doc (quick-fix scope — no new skill, no new lane). Dogfooding: the framework uses existing skills to close the gap.
- **Files changed:**
  - **NEW:** `references/pillars-coverage-matrix.md` — canonical reference defining the 8 pillars (product fit, journey, AC, UX, UI, tech architecture, cost model, operations & ownership), the 4 allowed states (`[NEW]`, `[UPDATED]`, `[UNCHANGED — VERIFIED]`, `[N/A — justified]`), the matrix format, lane mappings for Lane 1 / Lane 3 / Lane 4, the Pillar Revisit Audit protocol, self-verify contract, enforcement points, and rationale tying back to the WI-012 case
  - `route-workflow/SKILL.md` — Lane 1 + Lane 3 end with mandatory Pillars Coverage Matrix; all 8 pillars explicit; "pure background" exception scoped to UX/UI/Cost only with specific justification; journey, AC, tech, ops are NEVER skippable in Lane 3. Lane 4: `diagnose-bug` output contract expanded to include Pillar Revisit Audit walking all 8 pillars with affected/unaffected evidence; affected pillars MUST be bundled or filed as follow-up WIs; close-out matrix required at retroactive Lane 4 close. New pillar matrix paragraph added to both Lane 3 footer and Lane 4 retroactive footer.
  - `diagnose-bug/SKILL.md` — Outputs expanded: Pillar Revisit Audit + final Pillars Coverage Matrix are now required outputs. New Process Step 4.4 **Pillar Revisit Audit — MANDATORY** with per-pillar audit questions and routing targets. Self-verify checks grew 8 → 11 (added: pillar revisit audit run, no unresolved affected pillars, pillars coverage matrix complete).
  - `write-spec/SKILL.md` — Spec template (Step 6 assembly) now includes a Pillars Coverage Matrix section between Technical Design and Implementation Notes. New self-verify check #9 grep-validates the matrix is present and complete.
  - `design-tech/SKILL.md` — Technical Design template now has two new mandatory sub-sections: **Cost Model** (compute / storage / bandwidth / external APIs / background jobs with unit cost, volume, monthly estimate, scaling curve, paid-by column + scaling trigger points + first-month/year-1 projection + zero-cost justification if claimed) and **Operations & Ownership** (owner, on-call, SLA/SLO, error budget, monitoring, alerting, dashboard, runbook, failure modes, recovery procedure, backup/restore, dependency failure impact). "Best effort" is an acceptable answer for indie/pre-PMF projects but must be explicit, not implied. Self-verify checks grew 4 → 6 (added: cost model filled, operations & ownership filled).
  - `validate-feature/SKILL.md` — Self-verify check #7 added: in Lane 3, target feature spec must already have a Pillars Coverage Matrix or flag as drift and author as baseline.
- **Commits:** pending at end of run

## Replay Verification

- **Replay target:** Mental walk against Example Marketplace WI-012 (PhotoUpload compat bugfix) — verify that the updated Lane 4 + diagnose-bug would force asking the pillar questions that were silently skipped in the original close-out attempt:
  1. Journey — "does a journey cover photo upload?" — no, and framework now forces asking
  2. AC — "is there an AC for photo-upload-works-on-every-page?" — no, and framework now forces the AC audit
  3. UX — "does the fix change what the user sees?" — no in this case, but the question is forced
  4. Tech architecture — "does the prop-shape mismatch reveal a deeper component-contract issue across the codebase?" — addressed via pattern scan (Step 4.5) + pillar 6 audit
  5. Cost — "does fixing photo upload increase storage cost (now that uploads actually work)?" — yes, and framework now forces asking
  6. Operations — "who monitors photo upload failures? what's the SLA?" — no one, and framework now forces explicit acknowledgment

- **Result:** **PASS**
  - Tier-1 evals: 7/7 scripts, 3,140 total checks across 48 skills (markdown AST checks grew from 991 → 995 because of added sections — all passed)
  - Scenario replay: every previously-silent pillar question is now explicitly forced by diagnose-bug Step 4.4 + self-verify check #4 (Pillar Revisit Audit run), #5 (no unresolved affected), #11 (Pillars Coverage Matrix complete)
  - Lane 1/3 parity: both lanes now end with the same matrix contract; Lane 3 can no longer silently drop pillars
  - design-tech gap: cost and operations are now required sub-sections with their own self-verify checks

- **Evidence:** tier-1 eval run output, mental replay walk against WI-012 scenarios above

## FRAMEWORK-STATE.md Mutations

- **Analysis History:** Add entry "2026-04-09: Pillars Coverage Matrix + Lane 4 Pillar Revisit + Lane 1/3 Parity + design-tech Cost/Ops (Example Marketplace WI-012 continuation)"
- **Known Gaps:** No prior gaps moved
- **Decisions Made:** Add "Pillars Coverage Matrix — 8-pillar canonical contract (product fit, journey, AC, UX, UI, tech architecture, cost model, operations & ownership). Mandatory on every feature spec and bugfix brief. Locked 2026-04-09."; Add "design-tech must cover cost model and operations/ownership as first-class sub-sections. 'Best effort' SLA is acceptable for indie projects but must be explicit. Locked 2026-04-09."
- **Current State:** No skill count change (still 48). Reference docs: 12 → 13 (added pillars-coverage-matrix.md).
- **Capabilities:** Update `references/knowledge/svc/CAPABILITIES.md` — add "Pillars Coverage Matrix enforcement" and "Cost/Ops contract in design-tech" as capabilities

## Status

**IMPLEMENTED** (2026-04-09, commit `c05d3e3cb3db4c3fac728baa41b9703a68d7e652`)
