# Framework Improvement: Problem Archetype Reasoning in plan-changeset

**Status:** IMPLEMENTED (2026-04-14)

## Evidence

- **Source:** Post-mortem on Example Marketplace dark mode — 50% of weekly Claude balance consumed across WI-022 through WI-048
- **Finding:** `plan-changeset/SKILL.md` — no problem type classification step exists. Skill proceeds directly to spec-reading regardless of what kind of problem it's planning.
- **Severity:** High
- **Upstream diagnosis:** `proposals/done/2026-04-14-evolution.md` (Example Marketplace project proposals/)

## Diagnosis

- **Root cause:** plan-changeset operates in one mode for all problem types. The skill's standard workflow (read spec → trust spec counts → write task graph) is correct for bounded features but structurally wrong for migration problems. Dark mode is a migration ("find all instances of broken patterns and fix them"), not a bounded feature ("build new functionality"). The skill never recognized the mismatch.
- **Category:** Inefficiency + fragility — wrong approach applied to wrong problem type
- **Pattern-family checks (checks #6/#7)** were already added to adversarial review in 54451e3, but those are validation-level catches at the END of planning. They don't prevent a plan from being written with the wrong scope universe in the first place.
- **User insight:** "skills should be able to make intelligent decisions based on type of problem they face" — rule-matching keywords is not the fix; reasoning about problem shape is.

## Implementation

- **Route:** Direct SKILL.md edit (single-skill change, no pipeline overhead)
- **Files changed:** `plan-changeset/SKILL.md`

**Changes:**
1. Added `## Step 0 — Problem Archetype Reasoning (BEFORE reading inputs)` section between the announce line and `## Inputs`
   - Defines 5 archetypes: bounded feature, migration/sweep, architectural change, cross-cutting concern, incremental extension
   - Each archetype has a description, source-of-truth signal, and planning mode
   - Reasoning guidance: "you do NOT check for keywords — you reason about the shape"
   - Mandatory classification log before proceeding
   - Per-archetype "what changes" instructions — migration type requires grep-first to enumerate all pattern families (including adjacent families the spec doesn't enumerate), record universe count before writing any task

2. Added self-verify checks #0, #10, #11:
   - Check #0: archetype logged before any spec was opened
   - Check #10: migration archetype → manifest header contains grep baseline (N files, M instances per pattern family)
   - Check #11: migration archetype + <100% coverage → deferred files/instances named and counted

3. Extended Scope Reduction Prohibition with two new banned patterns:
   - "priority pages / priority files" without a total count
   - "Under N-file threshold" on a migration archetype

## Replay Verification

- **Replay target:** Dark mode Phase 1 scenario — would plan-changeset now recognize migration type and grep before planning?
- **Result:** PASS (qualitative — no test-framework scenario exists for this; manual trace)
  - Step 0 classification: "Migration — 'fix all hardcoded light-mode colors across the codebase'. Source of truth: codebase. Mode: grep-first."
  - Under migration mode, skill would enumerate adjacent pattern families: bg-white/text-slate/border-slate + bg-gradient with light stops (from-*-50/100) + text-gray-* — all three pattern families from WI-022 through WI-048
  - Universe count would appear in manifest header before any task is written
  - Phase 1 covering 7/71 files would require explicit: "Phase 1: 7/71 files (10%). Deferred to Phase 2: 64 files."
- **Tier-1 evals:** PASS — plan-changeset has no new failures. Pre-existing svc-advisor and evaluate-rule failures are unchanged.

## FRAMEWORK-STATE.md Mutations

- **Analysis History:** Add entry for problem archetype reasoning
- **Known Gaps:** None moved (this was a new finding from live session)
- **Decisions:** Locked — problem archetype classification is the first step of plan-changeset; migration archetype triggers grep-first mode; phase splitting on migration requires universe accounting
- **Capabilities:** plan-changeset now has explicit problem-type reasoning before planning
