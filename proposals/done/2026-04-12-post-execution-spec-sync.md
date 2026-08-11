# Framework Improvement: Post-Execution Spec Staleness Check

**Status:** IMPLEMENTED (2026-04-12)

## Evidence
- **Source:** WI-029 post-hoc audit (user-requested)
- **Finding:** After removing `initialData: []` from 41 code files (107 sites), two feature specs still described the pattern as current: `customer-premium-features.md:686` and `shared-settings-profile.md:318`. No skill in any lane caught this — discovered only by manual audit.
- **Severity:** high — specs silently become stale after every code change

## Diagnosis
- **Root cause:** `sync-spec-code` runs at lane ENTRY (before code changes). No skill runs a spec check AFTER code changes land. The drift is created BY the change, not before it.
- **Category:** missing capability
- **Already in FRAMEWORK-STATE.md?** no (new)

## Implementation
- **Route:** direct SKILL.md edits (3 files)
- **Files changed:**
  - `~/.claude/skills/execute-changeset/SKILL.md` — added spec staleness check to Pass 1 holistic review (blocking gate), added self-verify check #5, added explicit pre-flight protocol to Step 0
  - `~/.claude/skills/land-changeset/SKILL.md` — added Step 1e spec staleness check, added self-verify check #5
  - `~/.claude/skills/FRAMEWORK-STATE.md` — added analysis history entry + What NOT to Re-analyze entry

## Replay Verification
- **Replay target:** WI-029-style scenario — if a future changeset removes a pattern from code, the holistic review (Pass 1) and land-changeset (Step 1e) will grep docs/specs/ and catch stale references before merge.
- **Result:** PASS (contract-level — the checks are now in the skill text; runtime replay deferred to next execute-changeset invocation)
- **Evidence:** grep confirms the new text is in both SKILL.md files

## FRAMEWORK-STATE.md Mutations
- **Analysis History:** added 2026-04-12 entry for post-execution spec sync gap
- **Known Gaps:** none added (gap is now fixed)
- **Decisions:** none added (no design choice — this is a missing check, not a design decision)
- **Capabilities:** no new capabilities added to svc CAPABILITIES.md (this is enforcement, not a new capability)
