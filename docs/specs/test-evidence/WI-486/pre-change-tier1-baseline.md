# WI-486 — Pre-change Tier-1 baseline at `$BASE`

- **Pinned base (`$BASE`):** `99da8bcf873d4d2a7b2a2becfb19759c71e3d2de` (manifest §A; WI-489 verify-promotion, PR #146)
- **Branch HEAD at capture:** `framework-WI-486-isolated-bootstrap` @ `99da8bcf…` (HEAD **==** `$BASE`; `git merge-base $BASE HEAD == $BASE`)
- **Captured:** 2026-07-16T19:59:26+03:00, task-1, BEFORE the two new focused validators were added to `tier-1/`.
- **Command:** `export -f rg 2>/dev/null || true; bash test-framework/evals/run-all-evals.sh --tier1`
- **Manifest-pinned `BASELINE`:** **245 passed / 0 failed / 0 timed out**.

## ⚠️ Discrepancy: the pinned `BASELINE` (245/0/0) does NOT reproduce on this machine

The manifest pins `BASELINE = 245/0/0` at `$BASE`. That identity could **not** be
reproduced here. Two independent captures were taken and every deviation was
attributed to root cause.

### Capture A — real environment (worktree, HEAD == `$BASE`, full `~/.claude` host state)

```
>>> Tier 1 Result: 242 scripts passed, 3 failed (0 timed out)
RESULT: FAIL (3 tier-1 scripts failed)
```

Total validators discovered: **245** (242 `*.sh` + 3 `*.mjs`) — matches the pinned
total. The 3 failures, individually attributed:

| # | Validator | Cause | Class |
|---|---|---|---|
| 1 | `validate-industry-grounding-section.sh` | Untracked WI-486 planning spec `docs/specs/features/wi-486-session-isolated-bootstrap.md` is missing the `### What the industry does / ### What we're doing / ### Why we differ / ### Reversibility` subsections. | **WI-486 planning residue** — not in the `$BASE` tracked tree; the upstream spec is finalized by later WI-486 tasks. |
| 2 | `validate-skip-conditions-registry.sh` | Locally-modified `.svc/lane-tasks-WI-486.json` (this session's task graph) has task 9 (`review-plan`) completed without `skip_reason`/`skill_receipt` evidence. | **WI-486 working-tree residue** — this session's own in-flight graph. |
| 3 | `validate-skill-receipt-shape.sh` | **Tracked** `.svc/lane-tasks-WI-489.json` task-15 (`verify-promotion`, `.created` `2026-07-16T02:27:46Z` > enforce-after `2026-05-10T16:00:00Z`) is `completed` but its `skill_receipt` has no `phases_executed`, so P1-PromotionEvidence…P4-StateCloseout are reported missing. | **PRE-EXISTING, `$BASE`-inherent, UNRELATED to WI-486.** |

### Capture B — clean detached `$BASE` worktree (proves failure #3 is `$BASE`-inherent)

A throwaway `git worktree add --detach <tmp> $BASE` (only the tracked `$BASE`
tree, zero residue) was used to isolate which failures belong to `$BASE` itself:

```
>>> Tier 1 Result: 240 scripts passed, 5 failed (0 timed out)
RESULT: FAIL (5 tier-1 scripts failed)
```

Failures there: `validate-skill-receipt-shape.sh` (**same** WI-489 failure — proves
it is a deterministic property of the `$BASE` tracked tree, not residue), plus four
**host-state false-fails** that appear ONLY because a `/tmp` checkout lacks the
machine's real `~/.claude` runtime: `validate-mobile-occlusion-gate.sh`,
`validate-scroll-position-gate.sh`, `validate-session-contract-freshness.sh`,
`validate-setup-worktree-canonical-resolution.sh`. Those four are environment
artifacts, not `$BASE` properties, and pass in Capture A.

### Reconciled true baseline

- The `$BASE` **tracked tree with real host state** carries exactly **one** genuine
  tier-1 failure: `validate-skill-receipt-shape.sh` on `.svc/lane-tasks-WI-489.json`.
  → true baseline = **244 passed / 1 failed / 0 timed out**.
- The other two Capture-A failures are WI-486 planning/working-tree residue that
  later WI-486 tasks resolve (spec Industry-Grounding subsections; lane-tasks
  receipts).

## Consequences for the WI-486 chain (flagged, not fixed in task-1)

1. **Task-1 discipline:** this file records the EXACT measured numbers. It does not
   fabricate 245/0/0, and task-1 changes NO authority/migration/validator source, so
   the WI-489 failure is left untouched (out of task-1 scope; touching WI-489 state
   is not this task's mandate).
2. **Downstream risk:** the task-6a "zero failures vs `BASELINE`" gate and the
   task-6b promoted `--tier1` verify will BLOCK on the pre-existing WI-489
   `validate-skill-receipt-shape` failure unless that WI-489 lane-tasks receipt is
   repaired (add `phases_executed` P1–P4 to task-15) or the failure is otherwise
   remediated OUTSIDE WI-486. **Owner/planner decision required** — either correct
   the pinned `BASELINE` to 244/1 (documenting the WI-489 debt) or fix the WI-489
   receipt before task-6.
3. **Attribution after task-1:** once the two new red focused validators are added,
   the discovered total becomes **247**; at task-1 (red) they add 2 failures on top
   of the 3 above; at green (post task-2/task-4) they pass, and the only residual is
   the WI-489 pre-existing failure noted above.

## Raw command output (Capture A header + summary)

```
============================================
  svc Eval Framework
  2026-07-16T19:59:26+03:00
============================================

>>> Tier 1: Static Validation (no LLM, <10s)
  ...
  FAIL: validate-industry-grounding-section.sh (rc=1)
  FAIL: validate-skill-receipt-shape.sh (rc=1)
  FAIL: validate-skip-conditions-registry.sh (rc=1)

>>> Tier 1 Result: 242 scripts passed, 3 failed (0 timed out)

>>> Tiers 1.5, 2, 3 skipped (set EVALS=1 to run)

RESULT: FAIL (3 tier-1 scripts failed)
```
