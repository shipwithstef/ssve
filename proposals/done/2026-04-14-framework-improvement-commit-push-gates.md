# Framework Improvement: commit/push gates in test-journeys and improve-framework

**Status:** IMPLEMENTED (2026-04-14)

## Evidence
- **Source:** same-session user report after running `test-journeys` (J04+J08 Example Marketplace) followed by `improve-framework`
- **Finding (two parts):**
  1. `test-journeys/SKILL.md` had no commit step. After every run, spec AC updates + SUMMARY.md + WI files sit as uncommitted changes in the working tree. Today's Example Marketplace run left `owner-employees.md`, `owner-scheduling.md`, `SUMMARY.md`, and `pipeline-decisions.jsonl` dirty — user had to clean up manually.
  2. `improve-framework/SKILL.md:262-272` (Step 6b) committed proposal+skill changes but never pushed. 6 prior framework commits (teach-project, svc-advisor, create-skill, plan-changeset, browse pre-flight, etc.) had accumulated unpushed across sessions. My `3000def` commit today landed on top of a stale local main.
- **Severity:** medium (both). Nobody's code is wrong — but the contract "skill run is complete" is a lie when the working tree is dirty or `origin/main` is stale.

## Diagnosis
- **Root cause (both):** skills treat persistence as out-of-scope. `test-journeys` ends at Step 5 "Save Evidence and Summary" (write to disk, no git). `improve-framework` Step 6b has `git commit` but stops there.
- **Category:** missing capability (commit gate in test-journeys) + fragility (unpushed backlog in improve-framework)
- **Already in FRAMEWORK-STATE.md?** No.

## Implementation
- **Route:** direct SKILL.md edit (isolated skill surgery on two skills)
- **Files changed:** `test-journeys/SKILL.md`, `improve-framework/SKILL.md`
- **Changes:**
  1. `test-journeys/SKILL.md` — added **Step 6 Commit Results** (MANDATORY before done): stage spec updates + SUMMARY + scenarios.json + WI files only (no `-A`), commit with templated message, do NOT auto-push, surface unpushed commit in final report. Added Self-Verify check #8: working tree must be clean. Note on screenshot-gitignore: projects with `*.png` ignores make evidence ephemeral — SUMMARY.md is the durable record.
  2. `improve-framework/SKILL.md` — added **Step 6c Sync to Remote** (MANDATORY before done): check unpushed count, report if > 1 (backlog detected), `git push origin main`. Guarded: no force-push, no silent branch-switch, PR flow for protected main. Added Self-Verify check #10: `git log @{u}..HEAD` empty OR PR URL reported.

## Replay Verification
- **Replay target:** a future run of either skill that ends without committing (test-journeys) or without pushing (improve-framework) should now fail Self-Verify.
- **Result:** PASS (qualitative). test-journeys Self-Verify #8 greps `git status --short` — non-empty fails. improve-framework Self-Verify #10 greps `git log @{u}..HEAD` — non-empty fails unless PR URL reported.
- **Evidence:** the two SKILL.md diffs.

## FRAMEWORK-STATE.md Mutations
- Analysis History entry added for 2026-04-14 commit/push gates.
- Decision locked: every framework/QA skill that produces artifacts MUST have an explicit commit step, and every skill that commits MUST have an explicit push step (or a PR-flow substitute). "Saved to disk" is not "done".

## Scope note
The third gap surfaced in the same report — Example Marketplace `.gitignore` `*.png` is too broad for QA evidence screenshots — is project-local, not a framework concern. Not addressed here. If the framework's screenshot policy needs to account for ignored evidence paths, raise a separate proposal.
