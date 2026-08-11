# Framework Improvement: Verification Gate Hardening + Comparison Doc Staleness

**Status:** IMPLEMENTED (2026-04-12)

## Evidence
- **Source:** `proposals/2026-04-12-evolution.md` (evolve-framework analysis)
- **Finding:** 6 gaps across verify-promotion, land-changeset, DOCTRINE.md, skill-pack-comparison.md, blend-external
- **Severity:** P0 (x2), P1 (x4)

## Diagnosis
- **Root cause:** Gates written as soft/aspirational; comparison doc not updated after blends; DOCTRINE claiming planned capability as current
- **Category:** Fragility (P0-A, P1-C, P1-D), Drift (P0-B, P1-A), Fragility (P1-B)
- **Already in FRAMEWORK-STATE.md?** No — all new findings

## Implementation
- **Route:** Direct SKILL.md edits (6 files)
- **Files changed:**
  - `verify-promotion/SKILL.md` — server pre-flight, test-count pre-flight, journey zero-match pre-flight, 3 new self-verify checks
  - `land-changeset/SKILL.md` — hard-stop at <30% coverage, Step 3a/3b renaming
  - `DOCTRINE.md` — parallel subagent claim downgraded to planned
  - `references/skill-pack-comparison.md` — STALE warning + update protocol added
  - `blend-external/SKILL.md` — self-verify check #12: update comparison table after blend

## Changes detail

**P0-A — verify-promotion paper gate:**
- Server pre-flight: `curl localhost:{PORT}` hard-stop before E2E step
- Test-count pre-flight: `find` for test files, FAIL if count = 0 (routes to write-e2e)
- Journey pre-flight: `ls J*-<name>.feature.md`, FAIL if count = 0
- Self-verify: 3 new checks (server running, test files exist, journey files matched)

**P0-B — skill-pack-comparison.md stale:**
- Header updated with STALE warning and "Last blend-registry checked: 2026-04-12"
- Update protocol documented inline
- blend-external self-verify check #12 added: update comparison table after each blend

**P1-A — DOCTRINE parallel subagent present tense:**
- DOCTRINE:716 — changed "Overlapping tasks get inner worktrees" to "will use inner worktrees"
- Added inline note: single-wave dispatch without file overlap works today; inner-worktree conflict detection is planned

**P1-B — land-changeset duplicate Step 3:**
- land-changeset:174 → `### Step 3a: Push the branch`
- land-changeset:182 → `### Step 3b: Switch to main and open PR`

**P1-C — land-changeset coverage gate soft:**
- Added hard-stop tier: < 30% → STOP, route to write-e2e, no ask
- 30–59% → WARN + ask (existing behaviour)
- ≥ 60% → pass (unchanged)

**P1-D — verify-promotion journey zero-match:**
- Pre-flight check added inline before test-journeys invocation

## Replay Verification
- **Replay target:** `bash test-framework/evals/run-all-evals.sh --tier1`
- **Result:** PASS — 9/9 scripts, 3,893 assertions, 0 failures
- **Evidence:** Run at 14:41:28+03:00

## FRAMEWORK-STATE.md Mutations
- Add to Analysis History: verification gate hardening
- Known Gaps: no changes (these were new findings, not deferred items)
- CAPABILITIES.md: no new capabilities; no update needed
