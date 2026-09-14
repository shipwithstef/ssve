# Framework Evolution — Completion Guard Historical Skip

## Trigger

During WI-164 (Capacitor native login debugging), the SVC Completion Guard fired **15 times** for the same batch of 31 completed WIs (WI-085 through WI-163). These WIs were completed in March–April 2026, **before** the `pipeline-decisions.jsonl` requirement existed. Each guard injection required appending a routing decision, interrupting the actual debugging session.

## Problem

The Completion Guard checks `.svc/pipeline-decisions.jsonl` for routing decisions on completed WIs. When it finds a WI marked complete but missing a decision, it fires. However:

1. **Historical WIs** completed before the requirement was added will NEVER have decisions
2. **No skip mechanism** exists to tell the guard "this batch is historical, stop checking"
3. **Re-firing is unbounded** — the guard fires every session, every time it re-checks

## Impact

- **Session disruption:** 15 injections in a single session, each requiring a response
- **Token waste:** ~500+ tokens consumed per injection (guard message + response)
- **Builder frustration:** Guard becomes noise, eroding trust in framework signals
- **No productive outcome:** After 15 acknowledgments, the batch still triggers the guard

## Evidence

```bash
# Count guard entries for the same batch
grep -c "WI-085.*WI-163" .svc/pipeline-decisions.jsonl
# Result: 15 entries (all identical reasoning: "completed-in-prior-sessions")
```

All 15 entries have `decision: "completed-in-prior-sessions"` with `historical_skip: true` (added on the 15th attempt as a desperate flag).

## Proposed Fix

### Option A: Guard respects `historical_skip` flag (recommended)

Modify the Completion Guard to check for a `historical_skip: true` field on any entry matching the batch. If found, skip the batch permanently.

**Pros:** Simple, backward-compatible, explicit opt-out  
**Cons:** Requires one final acknowledgment before skip activates

### Option B: Guard deduplicates by run_id

Modify the Guard to check if the same `run_id` batch already has ANY entry in `pipeline-decisions.jsonl`. If yes, skip.

**Pros:** Zero-config, automatic  
**Cons:** Could mask legitimate re-checks if a WI is genuinely reopened

### Option C: Separate historical-decisions file

Create `.svc/historical-decisions.jsonl` for pre-requirement WIs. Guard checks this file before firing.

**Pros:** Clean separation, no pollution of active decisions log  
**Cons:** Requires migration of existing entries

### Option D: Batch acknowledgment with expiry

Allow a single entry to cover an entire batch with `batch_acknowledged: true` and `expiry: never`.

**Pros:** One entry covers all 31 WIs  
**Cons:** New schema field, more complexity

## Recommendation

**Option A** — Add `historical_skip` support to the Completion Guard:

1. When the Guard iterates completed WIs, check if `pipeline-decisions.jsonl` contains an entry for that WI with `historical_skip: true`
2. If found, exclude the WI from the guard's check list
3. If not found, fire the guard once (existing behavior)
4. After the user acknowledges, they can add `historical_skip: true` to prevent future fires

This is minimal change, backward-compatible, and gives builders control.

## Acceptance Criteria

- [ ] Guard does not fire for WIs with `historical_skip: true` in pipeline-decisions
- [ ] Guard still fires normally for WIs without the flag
- [ ] No migration of existing entries required
- [ ] Documented in `references/decision-log.md`
