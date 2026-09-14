# Framework Evolution — 2026-04-19

## Method
Performed static validation of the framework using `test-framework --tier1`. Audited recent session logs and `pipeline-decisions.jsonl` for execution discipline. Reviewed skill contracts and markdown structure for consistency.

## Findings (by priority)

### P0 — Fix now (blocks quality)

#### F1: Conflicting Output Paths for Core Skills
- **Evidence:** `validate-contracts.sh` failure.
- **Problem:**
  - `mine-builder` and `teach-project` both claim `~/.svc/builder-profile.md` as their output.
  - `onboard-repo` and `platform-operating-architect` both claim `docs/specs/router-context.md` as their output.
- **Fix:** De-duplicate or clarify the owner of these artifacts. `mine-builder` should own the profile creation; `teach-project` should update/read it. `onboard-repo` should own the initial `router-context.md`; `platform-operating-architect` should refine/extend it. Update `outputs` in respective `SKILL.md` files.

#### F2: Missing Pipeline Decisions Logging
- **Evidence:** `proposals/2026-04-18-session-audit-WI-064.md` and `pipeline-decisions.jsonl` audit.
- **Problem:** `route-workflow` and skills are skipping `pipeline-decisions.jsonl` logging during lane entry and phase skipping.
- **Fix:** Update `route-workflow/SKILL.md` and execution-tier skills (e.g., `execute-changeset`, `land-changeset`) to strictly enforce logging of every boundary decision.

#### F3: Broken Links and Missing Fields in Core Skills
- **Evidence:** `validate-skill-structure.sh` and `validate-markdown-ast.mjs`.
- **Problem:**
  - `svc-advisor` is missing the `outputs` frontmatter field and `lanes:` sub-key in its `chain` section.
  - `verify-promotion` has a broken cross-reference to `references/ai-verification-mechanisms.md`.
- **Fix:** Add missing fields to `svc-advisor/SKILL.md`. Restore or fix the missing reference file for `verify-promotion`.

### P1 — Fix soon (degrades quality)

#### F4: Mismatched Input Patterns for Audit/Rule Skills
- **Evidence:** `validate-contracts.sh` failure.
- **Problem:**
  - `audit-session-execution`: input path patterns for `.svc/lane-tasks-*.json` and `.svc/pipeline-decisions.jsonl` do not match expected contract patterns.
  - `evaluate-rule`: input path `<rule-file>` doesn't match expected patterns.
- **Fix:** Synchronize `SKILL.md` input patterns with the actual validation scripts in `test-framework`.

#### F5: Missing Framework Hooks
- **Evidence:** `validate-framework-self-management.sh` failure.
- **Problem:** `hooks/svc-task-completion-guard.sh` and corresponding `hooks.json` entries are missing.
- **Fix:** Re-install or create the missing hook scripts to restore task completion guard functionality.

### P2 — Improve when possible (nice to have)

#### F6: Worktree Safety and .gitignore
- **Evidence:** `validate-worktree-safety.sh` failure.
- **Problem:** `.gitignore` is either missing from the workspace root or doesn't correctly ignore the `.worktrees/` directory.
- **Fix:** Ensure `.gitignore` contains `.worktrees/` and that the directory is correctly ignored by git to prevent accidental commits of worktree metadata.

#### F7: Missing Announce Patterns
- **Evidence:** `validate-markdown-ast.mjs`.
- **Problem:** `evaluate-rule` skill is missing the required "I'm using" or "Announce at start" pattern.
- **Fix:** Add the mandatory announcement line to `evaluate-rule/SKILL.md`.

## Comparison delta
Competitor frameworks (like gstack) have simpler single-file state tracking but lose the granular "decision trail" provided by `pipeline-decisions.jsonl`. Restoring this trail is critical for SVC to maintain its auditability advantage.

## Stale proposal audit
- `2026-04-18-session-audit-WI-064.md`: Audited. Confirmed agent discipline issue.
- `2026-04-15-evolution-ai-first-verification.md`: Pending. Implementation needed for AI-first verification patterns.
- `2026-04-14-blocking-discovery-halt.md`: Implemented/Done? Needs verification.

## Self-Verify
1. Proposal file exists: `test -f proposals/done/2026-04-19-evolution.md`
2. Every finding cites specific behavior/evidence: Yes.
3. Ranking by impact: Yes.
