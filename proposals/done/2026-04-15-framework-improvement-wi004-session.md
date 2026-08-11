**Status:** IMPLEMENTED (2026-04-15)

# Framework Improvement: WI-004 session findings (G5 screenshot exception, land-changeset worktree fallback, task mirror re-sync)

## Evidence
- **Source:** Example Marketplace WI-004 brownfield-feature-extension pipeline (validate-feature → land-changeset → verify-promotion), 2026-04-14
- **Proposal:** `example-marketplace/proposals/2026-04-14-evolution-wi004-session.md`
- **Severity:** P1 (G5 screenshot exception) + P2 × 2 (worktree fallback, task mirror)

## Diagnosis

**P1-1 — root cause:** `review-gate/SKILL.md` G5 item 10 says "Missing screenshot → FAIL" with no escape hatch. For Base44 (and any platform where auth tokens are domain-scoped to production only), pre-deploy screenshot capture is structurally impossible. A different agent could block G5 on a constraint that can't be resolved without deploying. The code-evidence diff workaround (hex values from git diff) was accepted in WI-004 but is undocumented.
- Category: Fragility

**P2-1 — root cause:** `land-changeset/SKILL.md` Step 3b uses `scripts/worktree.sh guard` to exit the worktree before PR creation. This script is a gstack convention and doesn't exist in non-gstack projects (e.g., Example Marketplace). When absent, `gh pr merge --delete-branch` fails with `fatal: 'main' is already used by worktree` because the worktree's HEAD branch can't be deleted while checked out.
- Category: Fragility

**P2-2 — root cause:** `route-workflow/SKILL.md:2183` said "Claude Code _may_ also rebuild the visible task list" — permissive language means agents don't re-sync the in-session TaskList after compaction. The JSON file has correct state; the stale TaskList from the prior session persists in system reminders, creating noise and risk of misguidance for 17-task long pipelines like WI-004.
- Category: Inefficiency

## Implementation
- **Route:** Direct SKILL.md edits (isolated skill surgery)
- **Files changed:**
  - `review-gate/SKILL.md:362` — added platform-auth exception clause to G5 item 10
  - `land-changeset/SKILL.md:185–195` — replaced unconditional `worktree.sh guard` with conditional fallback; added repo-root comment to `gh pr merge`
  - `route-workflow/SKILL.md:2183` — "may rebuild" → "MUST rebuild" with explicit instruction to call TaskUpdate; line 2376 updated with mandatory re-sync on resume

## Replay Verification
- **Replay target:** qualitative (fragility/efficiency gaps — no automated test case)
- **Result:** PASS (mental replay)
  - G5 item 10: agent now has a documented exception path; LOW finding instead of FAIL
  - land-changeset: `git rev-parse --show-superproject-working-tree` fallback always exits worktree regardless of worktree.sh presence
  - route-workflow: "MUST rebuild + Do not trust in-session TaskList without verifying against the JSON" mandates re-sync

## FRAMEWORK-STATE.md Mutations
- **Analysis History:** add WI-004 session findings (G5 auth exception, worktree fallback, task mirror)
- **Known Gaps:** none moved (these were new findings)
- **Decisions:** none new locked
- **Capabilities:** no new capabilities added
