# Framework Improvement: Universal Verification Principle

**Status:** IMPLEMENTED (2026-04-12)

## Evidence
- **Source:** WI-029 session — user-reported
- **Finding:** WI-029 shipped 3 batches (41 files, 107 deletions) with zero runtime verification. Lane 5 had no verification step. Lane 6 made verify-promotion conditional. Manifest waived E2E with "pure deletion" justification. Per-batch smoke checks written in manifest but never executed ("deferred to deploy").
- **Severity:** high — code changes can have unexpected effects regardless of perceived simplicity

## Diagnosis
- **Root cause:** Only Lane 4 mandated runtime verification. Lanes 5 and 6 assumed some changes are "safe enough" to skip testing. The framework had no universal verification principle.
- **Category:** missing capability
- **Already in FRAMEWORK-STATE.md?** no (new)

## Implementation
- **Route:** direct SKILL.md edit (route-workflow)
- **Files changed:**
  - `~/.claude/skills/route-workflow/SKILL.md` — added Universal Verification Principle section above Lane 1 (applies to all lanes). Added mandatory `test-journeys`/`write-e2e` step to Lane 5 (step 4) and Lane 6 (step 6). Made Lane 6 `verify-promotion` unconditional for code changes.
  - `~/.claude/skills/FRAMEWORK-STATE.md` — added analysis history entry

## Replay Verification
- **Replay target:** If a future Lane 5 or Lane 6 task graph is created for code changes, it must include a verification task. The Universal Verification Principle table makes the minimum verification tier explicit per change scope.
- **Result:** PASS (contract-level — the principle and lane steps are now in route-workflow)
- **Evidence:** grep confirms "Universal Verification Principle" and "verification is mandatory" in route-workflow SKILL.md

## FRAMEWORK-STATE.md Mutations
- **Analysis History:** added 2026-04-12 entry for universal verification gap
- **Known Gaps:** none added (gap is fixed)
- **Decisions:** none added (this is a principle, enforced by lane definitions)
- **Capabilities:** no new capabilities (enforcement, not new capability)
