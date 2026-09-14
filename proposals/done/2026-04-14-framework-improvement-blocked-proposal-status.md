# Framework Improvement: BLOCKED proposal status lifecycle

**Status:** IMPLEMENTED (2026-04-14)

## Evidence
- **Source:** user request after evolve-framework run produced a proposal (`2026-04-14-parallel-wi-dispatch.md`) that assistant had low confidence in. User wanted a mechanism to keep the proposal on disk (not `done/`, not deleted) while preventing `/improve-framework` from auto-picking it up at Step 1.5.
- **Finding:** `improve-framework/SKILL.md` Step 1.5 lists any `proposals/*.md` as actionable. No mechanism for "proposal needs human decision before implementation."
- **Severity:** medium (small gap, easy fix, unblocks intentional deferral)

## Diagnosis
- **Root cause:** proposal lifecycle had only two states — `pending` (in `proposals/`) and `implemented` (in `proposals/done/`). No intermediate "open but held" state.
- **Category:** missing capability
- **Already in FRAMEWORK-STATE.md?** No.

## Implementation
- **Route:** direct SKILL.md edit
- **Files changed:** `improve-framework/SKILL.md` (Step 1.5)
- **Changes:**
  - Step 1.5 now greps the first 20 lines of each proposal for `**Status:** BLOCKED` and skips those.
  - Documented three statuses: `DRAFT` (or absent) → actionable; `BLOCKED` → held; `IMPLEMENTED` → move to `done/`.
  - BLOCKED proposals stay in `proposals/` (visible) but require a `## Why BLOCKED` section stating the open decision / dependency.
  - Unblock = remove the `**Status:** BLOCKED` line.

## Replay Verification
- **Replay target:** `proposals/done/2026-04-14-parallel-wi-dispatch.md` was marked BLOCKED with 3 unresolved scope questions. A subsequent `/improve-framework` run must skip it.
- **Result:** PASS (qualitative — the Step 1.5 bash snippet filters by the exact marker; tested by reading the updated skill).

## FRAMEWORK-STATE.md Mutations
- Analysis History entry added (2026-04-14 proposal-status lifecycle).
- Decision locked: proposals have three lifecycle states (DRAFT, BLOCKED, IMPLEMENTED). `proposals/` is visibility, not queue-to-implement.
