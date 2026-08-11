# Framework Improvement: blend-external argumentation quality + proposal lifecycle

**Status: IMPLEMENTED** — all changes applied and verified in this session.

## Evidence
- **Source:** User feedback during superpowers re-blend (this session, 2026-04-08)
- **Finding 1:** Initial blend plan produced thin summary bullets. User had to ask
  "elaborate more" on item 3 (two-stage review) and then "does blend contain all
  that by default... it should." The improved version with full argumentation was
  significantly more useful but the skill didn't require it.
- **Finding 2:** Implemented proposals sat in `proposals/` alongside pending ones.
  No way to tell what's done vs actionable. User said "proposal should move under
  some path done when is done."
- **Severity:** medium — blend plans are actionable design documents; thin ones
  lead to poor implementation decisions. Mixed pending/done proposals waste time
  re-reading implemented work.

## Diagnosis
- **Root cause (finding 1):** blend-external Phase 3 template only required 3 sections per
  item: "What to take," "How to adapt," "What NOT to take." Missing: failure mode,
  current svc state, before/after, evidence, argument. The summary table required
  only pattern counts ("N to blend, M to skip") with no impact examples.
- **Root cause (finding 2):** No proposal lifecycle convention existed. Skills wrote
  proposals to `proposals/` but never moved them out when done.
- **Category:** inefficiency — skills produce output that requires follow-up or
  creates confusion about what's actionable
- **Already in FRAMEWORK-STATE.md?** No (both new findings)

## Implementation
- **Route:** Direct SKILL.md edits (isolated skill surgery across 3 skills)
- **Files changed:**
  - `blend-external/SKILL.md` — Phase 3 template expanded, self-verify updated, Proposal Lifecycle section added
  - `improve-framework/SKILL.md` — Step 6b added (move to done after verification)
  - `evolve-framework/SKILL.md` — Proposal Lifecycle section added, proposals/ reading updated
  - 11 proposals moved from `proposals/` to `proposals/done/`
- **Changes (finding 1 — argumentation quality):**
  1. Phase 3 now requires 5 sections per blend item: "The problem in svc today,"
     "How the source solves it," "What this changes in svc," "What NOT to take,"
     "Why this matters"
  2. Summary table template now includes "What breaks without it" and "What changes
     after" columns with guidance to use concrete scenarios, not abstract labels
  3. Preamble paragraph added: "Each blend item must be a self-contained argument"
  4. Self-verify expanded: checks 2-4 verify argumentation quality (all sections
     present, summary table has impact columns, no abstract-only arguments)
  5. Fixed stale "37 svc skills" reference to "all svc skills"
- **Changes (finding 2 — proposal lifecycle):**
  1. Convention: `proposals/` = pending, `proposals/done/` = implemented
  2. blend-external: "Proposal Lifecycle" section with move-to-done instruction
  3. improve-framework: Step 6b after replay verification
  4. evolve-framework: "Proposal Lifecycle" section + updated reading instructions
  5. 11 implemented proposals moved to `proposals/done/`

## Replay Verification
- **Replay target (finding 1):** Re-read blend-external/SKILL.md Phase 3 template
- **Result:** PASS — template now explicitly requires failure modes, before/after,
  evidence, and impact columns. Self-verify has 8 checks (was 5).
- **Replay target (finding 2):** `ls proposals/*.md` shows only pending; `ls proposals/done/*.md` shows implemented
- **Result:** PASS — 1 pending (superpowers re-blend), 11 in done/
- **Evidence:** linter passes (46 skills, 30 routing, 12 coreyhaines)

## FRAMEWORK-STATE.md Mutations
- **Analysis History:** Entry added: "2026-04-08: blend-external Argumentation Quality + Proposal Lifecycle"
- **Known Gaps:** None moved (both were new findings)
- **Decisions:** Added: "Proposal lifecycle: proposals/ = pending, proposals/done/ = implemented"
- **Capabilities:** No — improves existing skills, doesn't add new capability
