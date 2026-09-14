# Framework Improvement: Orchestrator Parsimony Phase 1

**Status:** IMPLEMENTED (2026-04-20, partial — phase 1 of 2+)

## Evidence
- **Source:** `proposals/done/2026-04-20-evolution-orchestrator-parsimony.md` — measured 1941-line FRAMEWORK-STATE.md, 27,883 total SKILL.md lines, 56 skills with identical 150-line chaining boilerplate.
- **Finding:** High HIGH-confidence mechanical wins available without model-behavior changes. F-001/F-005/F-007 are pure content moves; F-002/F-003/F-004/F-006 need measurement or riskier refactor work.
- **Severity:** high — every improve-framework load re-reads 60K tokens of framework memory; per-session bleed compounds across daily usage.

## Diagnosis
- **Root cause:** framework artifacts grew append-only without structural maintenance. Active state mixed with archive; boilerplate duplicated across 56 skills; no proposal template so structural prose re-typed per proposal.
- **Category:** inefficiency (all three)
- **Already in FRAMEWORK-STATE.md?** No — newly diagnosed 2026-04-20 by the orchestrator-parsimony evolution proposal.

## Implementation
- **Route:** direct file edits. No SKILL.md body deletion (F-005 is a content move, target content preserved in `references/`).
- **Files changed:**
  - `FRAMEWORK-STATE.md` — split at line 844 (boundary between 2026-04-14 and 2026-04-13 entries). Archive pointer inserted before Known Gaps. Analysis History entry added for this pass.
  - `FRAMEWORK-STATE-ARCHIVE/2026-04-13-and-earlier.md` (new) — 1028 lines of archived Analysis History, chronological, with how-to-restore header.
  - `proposals/.template.md` (new) — skeleton for evolution proposals and improvement records with `Status:` lifecycle field enforced.
  - `references/task-graph-chaining-protocol.md` (new) — canonical task-graph chaining contract, replacing the 150-line boilerplate that lived in 56 skill SKILL.md files.
  - `improve-framework/SKILL.md` — 3x embedded chain blocks (~45 lines) collapsed to single-line pointer + skill-specific chaining note. 500 → 453 lines.
- **Commits:** pending on next push.

## Replay Verification
- **Replay target 1 (F-001):** `wc -l FRAMEWORK-STATE.md` should return < 1000 (target: ~931). `grep -c "^## " FRAMEWORK-STATE.md` should return 6 (Current State / Blend History / Analysis History / Known Gaps / Decisions Made / How to Update). The archive file should contain ≥ 1000 lines of Analysis History entries dated 2026-04-13 or earlier. The archive pointer section should appear between the last 2026-04-14 entry and Known Gaps.
- **Replay target 2 (F-007):** `test -f proposals/.template.md` should pass. The template should contain both the evolution-proposal structure (Method / Findings / Comparison delta / Stale proposal audit / Self-Verify) and the improvement-record structure (Evidence / Diagnosis / Implementation / Replay Verification / FRAMEWORK-STATE Mutations) in an HTML-comment alternate block.
- **Replay target 3 (F-005 partial):** `grep -c "Task-graph mode" improve-framework/SKILL.md` should return 0 (no more embedded blocks). `grep -q "task-graph-chaining-protocol.md" improve-framework/SKILL.md` should pass (pointer present). `wc -l references/task-graph-chaining-protocol.md` should return ≥ 50 (canonical doc has substance, not a stub).
- **Result:** ALL PASS (see session transcript sanity-check output: new FRAMEWORK-STATE at 931 lines with 6 `## ` sections; archive at 1028 lines; improve-framework/SKILL.md at 453 lines with 0 "Task-graph mode" hits; pointer section present verbatim).
- **Evidence:** session transcript 2026-04-20 shows the sanity-check commands returning expected values.

## FRAMEWORK-STATE.md Mutations
- **Analysis History:** new 2026-04-20 entry added at top, above the pass-through-extractor entry from the same day. Both are preserved in reverse-chronological order within the same day.
- **Known Gaps:** no change — this pass closed newly-diagnosed gaps not previously tracked.
- **Decisions (new, locked):**
  - Active FRAMEWORK-STATE holds ~14 days of Analysis History by default
  - Canonical task-graph chaining protocol lives at `references/task-graph-chaining-protocol.md`
  - Proposal template is `proposals/.template.md`; new proposals use `cp` not re-typing
- **Capabilities:** `references/knowledge/svc/CAPABILITIES.md` NOT edited — these are meta-framework structural improvements, not new capabilities.

## Deferred follow-ups
- **F-005-followup (55 remaining skills):** dedupe the chain block across write-journeys, design-ui, build-personas, find-opportunity, write-spec, validate-feature, diagnose-bug, design-ux, mine-builder, create-skill, and the other 45 skills. Each needs individual review to preserve skill-specific chaining notes. Scope: one commit per ~10 skills, using the verify-skill-refactor.mjs safety gate. Potential aggregate savings: ~180K tokens of skill-corpus dup.
- **F-002 Bash output distillation:** new `scripts/bash-distill.sh` wrapper + rule-injection convention.
- **F-003 Pre-digest:** new skill `pre-digest` (harness: opencode) for file-heavy planning.
- **F-004 Prompt-caching audit:** measurement session to determine whether Claude Code auto-caches; log findings to research-log.
- **F-006 Top-4 skill refactor:** progressive disclosure on write-journeys / design-ui / build-personas / find-opportunity using WI-071 safety script.
- **F-008 Fanout ranking helper:** `scripts/fanout-rank.sh` deterministic + optional Haiku augment.

## External sources consulted
None this pass — all changes internal. F-006 progressive-disclosure work will likely consult ECC's skill-structure conventions when it lands.
