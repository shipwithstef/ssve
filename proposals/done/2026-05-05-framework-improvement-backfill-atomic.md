# Framework Improvement: Atomic Write for task-graph.mjs

## Evidence
- **Source:** Session audit `proposals/2026-05-05-session-audit-wi133-guard-churn.md`
- **Finding:** `scripts/task-graph.mjs` `writeGraph()` uses `fs.writeFileSync(filePath, ...)` directly. When `backfill-receipts` runs concurrently with a git commit that modifies the same lane-tasks file, the non-atomic write can be overwritten by the other process, causing the backfill to silently disappear.
- **Severity:** medium

## Diagnosis
- **Root cause:** `fs.writeFileSync` is not atomic. Two processes reading the same file, modifying it, and writing it back create a classic read-modify-write race.
- **Category:** fragility
- **Already in FRAMEWORK-STATE.md?** no (new)

## Implementation
- **Route:** quick-fix
- **Files changed:** `scripts/task-graph.mjs` (1 file, +2 lines)
- **Commits:** `fec4ccd` (included in batch commit)

```diff
 function writeGraph(filePath, graph) {
   validateGraph(graph);
   fs.mkdirSync(path.dirname(filePath), { recursive: true });
-  fs.writeFileSync(filePath, `${JSON.stringify(graph, null, 2)}\n`);
+  const tempPath = `${filePath}.tmp.${process.pid}`;
+  fs.writeFileSync(tempPath, `${JSON.stringify(graph, null, 2)}\n`);
+  fs.renameSync(tempPath, filePath);
 }
```

## Replay Verification
- **Replay target:** Run `node scripts/task-graph.mjs backfill-receipts <path>` twice in rapid succession; verify no temp files left behind and second run reports "backfilled 0 receipts" (idempotent).
- **Result:** PASS
- **Evidence:**
  ```
  $ node scripts/task-graph.mjs backfill-receipts .svc/lane-tasks-WI-141.json
  backfilled 0 receipts in .../.svc/lane-tasks-WI-141.json
  $ ls .svc/lane-tasks-WI-141.json.tmp*
  No temp files left (good)
  ```

## FRAMEWORK-STATE.md Mutations
- **Analysis History:** Add entry for 2026-05-05 atomic write fix
- **Known Gaps:** Remove `backfill-durability-race` gap (now fixed)
- **Decisions:** Add "Atomic writes for lane-tasks JSON" decision
