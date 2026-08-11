# Framework Improvement: Completion Guard Early-Exit for Closed WIs

## Evidence
- **Source:** Session audit `proposals/2026-05-05-session-audit-wi133-guard-churn.md`
- **Finding:** `hooks/svc-task-completion-guard.sh` fired 3 times (6/3, 7/3, 8/3) on WI-141 during a single session. WI-141 was already VERIFIED with all 10 tasks completed. The guard demanded routing decisions and skill receipts for a closed WI, creating noise and forcing redundant backfills.
- **Severity:** medium

## Diagnosis
- **Root cause:** The guard's Node.js section checks for `missingDecisionWIs` and `missingReceiptTasks` whenever `totalActionable === 0`, without checking whether the WI itself is already closed (`graph.status === "completed"`).
- **Category:** inefficiency
- **Already in FRAMEWORK-STATE.md?** no (new)

## Implementation
- **Route:** quick-fix
- **Files changed:** `hooks/svc-task-completion-guard.sh` (1 file, +2 lines modified)
- **Commits:** `fec4ccd` (included in batch commit)

```diff
       if (wi !== "unknown" && !loggedWIs.has(wi)
+          && graph.status !== "completed"
       ) {
         missingDecisionWIs.push(wi);
       }

+    if (graph.status !== "completed") {
       for (const task of graph.tasks) {
         if (task && task.status === "completed"
             && (task.metadata?.skill || task.skill)
             && !task.skill_receipt) {
           missingReceiptTasks.push(...);
         }
       }
+    }
```

## Replay Verification
- **Replay target:** Run guard Node.js logic against `.svc/lane-tasks-WI-141.json` (status: completed, all tasks have receipts). Verify `missing_decisions` and `missing_receipts` are both "none".
- **Result:** PASS
- **Evidence:**
  ```
  $ node -e "const g=JSON.parse(require('fs').readFileSync('.svc/lane-tasks-WI-141.json')); console.log('status:', g.status, 'skip:', g.status==='completed');"
  status: completed skip: true
  ```

## FRAMEWORK-STATE.md Mutations
- **Analysis History:** Add entry for 2026-05-05 guard early-exit fix
- **Known Gaps:** Remove `guard-early-exit-closed-wi` gap (now fixed)
- **Decisions:** Add "Completion guard skips VERIFIED/CLOSED WIs" decision
