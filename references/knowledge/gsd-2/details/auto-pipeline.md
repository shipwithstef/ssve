# GSD-2 Auto Pipeline — Knowledge Extraction

## Mechanism

### Direct Phase Dispatch (`auto-direct-dispatch.ts`)
- **`dispatchDirectPhase(ctx, pi, phase, base)`** — Resolves a manual `/gsd dispatch <phase>` command into a concrete unit type + prompt, creates a new pi session, and sends the prompt.
- Phase → unit type mapping:
  - `research` / `research-milestone` / `research-slice` → `research-milestone` or `research-slice`
  - `plan` / `plan-milestone` / `plan-slice` → `plan-milestone` or `plan-slice`
  - `execute` / `execute-task` → `execute-task`
  - `complete` / `complete-slice` / `complete-milestone` → `complete-slice` or `complete-milestone`
  - `reassess` / `reassess-roadmap` → `reassess-roadmap`
  - `uat` / `run-uat` → `run-uat`
  - `replan` / `replan-slice` → `replan-slice`
- Switches dispatch base to the canonical milestone worktree via `resolveCanonicalMilestoneRoot(base, mid)` so prompts anchor to the worktree, not the project root.
- Supports `require_slice_discussion` preference: pauses auto-mode before planning if the slice has no CONTEXT file.
- Calls `getWorkflowTransportSupportError()` + `getRequiredWorkflowToolsForAutoUnit()` to validate MCP transport compatibility before dispatch.
- Synchronous `process.chdir(dispatchBase)` before `newSession()` to ensure cwd is captured correctly; restores cwd in `finally`.

### Auto Supervisor (`auto-supervisor.ts`)
- **`registerSigtermHandler(currentBasePath, previousHandler)`** — Installs signal handlers on `SIGTERM`, `SIGHUP`, `SIGINT` that call `clearLock()` + `releaseSessionLock()` + `process.exit(0)`.
  - Tracks the current handler in `_currentSigtermHandler` to prevent accumulation if callers forget to pass `previousHandler`.
- **`deregisterSigtermHandler(handler)`** — Removes handlers from all cleanup signals.
- **`detectWorkingTreeActivity(cwd)`** — Checks `nativeHasChanges(cwd)` to detect whether the agent produced uncommitted work on disk (staged, unstaged, or untracked).

### Unit Closeout (`auto-unit-closeout.ts`)
- **`closeoutUnit(ctx, basePath, unitType, unitId, startedAt, opts?)`** — Consolidates the post-unit pattern used 6+ times in `auto.ts`.
- Steps:
  1. `snapshotUnitMetrics()` — records model, timing, tier, downgrade flags.
  2. `saveActivityLog()` — persists the activity log to disk.
  3. Awaits `extractMemoriesFromUnit()` (was fire-and-forget; now awaited to prevent race with `git merge --squash` where memory-extractor writes land after closeout returns, dirtying the working tree — root cause of #4704).
  4. `writeTurnGitTransaction()` — records git action (commit/snapshot/status-only) to the UOK journal if traceId/turnId are present.

### Auto Recovery (`auto-recovery.ts`)
- **`verifyExpectedArtifact(unitType, unitId, base)`** — Authoritative artifact verification with per-unit-type logic:
  - Hook units (`hook/*`) always pass.
  - `rewrite-docs` checks OVERRIDES scope.
  - `workflow-preferences` checks YAML frontmatter for `workflow_prefs_captured: true`.
  - `research-decision` validates JSON decision field.
  - `reactive-execute` verifies every dispatched task has a SUMMARY file.
  - `gate-evaluate` verifies dispatched gates are no longer pending in DB.
  - `research-slice` with `parallel-research` sentinel checks every research-ready slice has a RESEARCH file, or accepts a PARALLEL-BLOCKER placeholder.
  - `plan-milestone` parses roadmap and rejects zero-slice roadmaps.
  - `plan-slice` requires task checkbox/heading patterns AND individual T{tid}-PLAN.md files for every task.
  - `execute-task` uses DB status as primary; falls back to checked-checkbox in plan file.
  - `complete-slice` checks UAT file + DB slice status.
  - `complete-milestone` calls `classifyMilestoneSummaryContent()` + `hasImplementationArtifacts()` to reject milestones with only `.gsd/` files.
- **`hasImplementationArtifacts(basePath, milestoneId?)`** — Detects whether a milestone produced non-`.gsd/` files. Uses `git diff --name-only` against merge-base with integration branch; falls back to GSD-tagged commit scan when on main after merge.
- **`writeBlockerPlaceholder(unitType, unitId, base, reason)`** — Writes a `# BLOCKER` markdown file so the pipeline can advance past a stuck unit. Also updates DB status (task/slice/milestone) and appends recovery events to the journal.
- **`reconcileMergeState(basePath, ctx)`** — Detects and resolves leftover merge/squash/rebase/cherry-pick/revert state:
  - Calls `reconcileOtherInProgressGitOps()` first (rebase/cherry-pick/revert abort) — #4980 HIGH-7.
  - If no conflicts: finalizes merge/squash with `nativeCommit()`.
  - If only `.gsd/` conflicts: auto-resolves via `nativeCheckoutTheirs()` + commit.
  - If code conflicts remain: returns `"blocked"` and pauses auto-mode.
- **`buildLoopRemediationSteps(unitType, unitId, base)`** — Returns concrete manual steps per unit type (e.g., `gsd undo-task`, `gsd recover`, `gsd reset-slice`).

### Dispatch Guard (`dispatch-guard.ts`)
- **`getPriorSliceCompletionBlocker(base, _mainBranch, unitType, unitId)`** — Prevents out-of-order slice dispatch.
- Respects `GSD_MILESTONE_LOCK` env var for parallel worker isolation (#2797).
- Milestone completion check uses DB `isClosedStatus()` as primary; file-based SUMMARY as secondary, but rejects failure/blocker SUMMARYs (#4663).
- Dependency-aware ordering: if target slice declares `depends`, only those slices must be complete. Otherwise positional fallback, with deadlock avoidance for reverse dependents (#3720).

### Engine Resolver (`engine-resolver.ts`)
- **`resolveEngine(session)`** — Routes `null` / `"dev"` engine IDs to `DevWorkflowEngine` + `DevExecutionPolicy`. Any other non-null ID maps to `CustomWorkflowEngine(activeRunDir)` + `CustomExecutionPolicy()`.
- `GSD_ENGINE_BYPASS=1` kill switch is checked in `autoLoop` before calling this function.

### Session Lock (`session-lock.ts`)
- **`acquireSessionLock(basePath)`** — Uses `proper-lockfile` for OS-level exclusive file locking (flock/lockfile), eliminating TOCTOU race conditions.
  - Lock file: `.gsd/auto.lock` (JSON metadata: PID, start time, unit info).
  - Parallel worker mode: uses `.gsd/parallel/<MID>/auto-<MID>.lock` (#2184).
  - Stale lock cleanup: pre-flight checks `.gsd.lock/` directory; if orphan (no metadata or dead PID), removes before acquisition (#3218).
  - `onCompromised` handler with false-positive suppression: within 30 min of acquisition, mtime drift is treated as long LLM call, not takeover (#1362). Past 30 min, verifies PID ownership before declaring compromise (#1578).
- **`getSessionLockStatus(basePath)`** — Validates lock ownership; attempts re-acquisition on benign `onCompromised` if PID still matches.
- **`releaseSessionLock(basePath)`** — Releases OS lock, removes lock file + `.lock/` dir, cleans ALL registered lock paths (#1578).
- **`readExistingLockDataWithRetry()`** — Retry-tolerant lock file reads for transient filesystem hiccups (#2324).

### Crash Recovery (`crash-recovery.ts`)
- **`writeLock(basePath, unitType, unitId, sessionFile?)`** — Updates the lock file with current unit metadata. `sessionFile` records the active pi JSONL path.
- **`clearLock(basePath)`** — Removes lock file on clean stop.
- **`readCrashLock(basePath)`** — Reads lock file to detect interrupted sessions.
- **`isLockProcessAlive(lock)`** — `process.kill(pid, 0)` liveness check. Own PID returns true (#2470).
- **`formatCrashInfo(lock)`** — Generates recovery guidance based on unit type.
- **`emitCrashRecoveredUnitEnd(basePath, lock)`** — Emits synthetic `unit-end` journal event for units that crashed without emitting their own end event (#3348).

### Workflow Engine (`workflow-engine.ts`)
- **`WorkflowEngine` interface** — Pluggable contract:
  - `engineId: string`
  - `deriveState(basePath)` → `EngineState`
  - `resolveDispatch(state, context)` → `EngineDispatchAction`
  - `reconcile(state, completedStep)` → `ReconcileResult`
  - `getDisplayMetadata(state)` → `DisplayMetadata`

### Guided Flow Queue (`guided-flow-queue.ts`)
- **`showQueue(ctx, pi, basePath)`** — Queue management hub. Safe to run while auto-mode executes (only writes future milestone directories).
- If multiple pending milestones: offers "Reorder queue" or "Add new work".
- **`handleQueueReorder()`** — Loads `queue-reorder-ui.js`, saves order to `.gsd/QUEUE-ORDER.json`, syncs `PROJECT.md` milestone sequence table, removes stale `depends_on` entries from CONTEXT.md frontmatter, commits changes.
- **`showQueueAdd()`** — Builds existing milestones context (PROJECT.md, DECISIONS.md, per-milestone CONTEXT/ROADMAP, QUEUE.md), dispatches `gsd-queue` prompt with inlined templates.
- **`buildExistingMilestonesContext()`** — Emits compact one-liners for completed milestones (expensive full-content loading triggers 429s — #2379).

### Milestone Summary Classifier (`milestone-summary-classifier.ts`)
- **`classifyMilestoneSummaryContent(content)`** → `"success" | "failure" | "unknown"`.
  - Reads YAML frontmatter status via `splitFrontmatter()` + `parseFrontmatterMap()`.
  - Closed statuses → success.
  - Active/pending/blocked/failed/failure/incomplete → failure.
  - Content heuristics: `# BLOCKER`, `auto-mode recovery failed`, `verification failed`, `not complete` → failure.
- **`isTerminalMilestoneSummaryContent(content)`** — Legacy compatibility: unknown summaries remain terminal (preserves old handwritten SUMMARY files).

---

## Analysis

1. **The auto-pipeline is a state-machine-driven loop with three layers of safety:**
   - **Dispatch layer** (`auto-direct-dispatch.ts`, `dispatch-guard.ts`) ensures only valid, in-order units run.
   - **Runtime layer** (`session-lock.ts`, `crash-recovery.ts`, `auto-supervisor.ts`) ensures single-process ownership and crash detection.
   - **Recovery layer** (`auto-recovery.ts`) verifies artifacts, reconciles git state, and provides remediation steps.

2. **Artifact verification is deeply unit-type-aware.** There is no generic "file exists" check. Each unit type has bespoke validation logic (DB status, checkbox patterns, plan file existence, implementation artifact detection). This is the core mechanism that prevents false "complete" states.

3. **The session lock uses proper-lockfile + PID metadata + onCompromised recovery.** This is a production-grade concurrency control that handles laptop sleep, long LLM calls, NFS latency, and parallel worker isolation.

4. **Recovery is git-centric.** `reconcileMergeState` handles real merges, squash merges, rebase, cherry-pick, and revert states. It auto-resolves `.gsd/` conflicts (state files) but blocks on code conflicts to preserve manual resolution work.

5. **Parallel research and reactive execute are batch-aware.** Verification checks that EVERY item in a dispatched batch completed, not just any artifact.

6. **Milestone summary classification distinguishes real completion from failure/blocker reports.** This prevents the dispatch guard from treating a recovery-placeholder SUMMARY as proof of milestone completion.

---

## L4 pointers

| Capability | File | Function / Type |
|-----------|------|-----------------|
| Phase dispatch | `auto-direct-dispatch.ts` | `dispatchDirectPhase()` |
| Signal cleanup | `auto-supervisor.ts` | `registerSigtermHandler()`, `deregisterSigtermHandler()` |
| Working-tree activity detection | `auto-supervisor.ts` | `detectWorkingTreeActivity()` |
| Unit closeout | `auto-unit-closeout.ts` | `closeoutUnit()`, `CloseoutOptions` |
| Artifact verification | `auto-recovery.ts` | `verifyExpectedArtifact()` |
| Implementation artifact detection | `auto-recovery.ts` | `hasImplementationArtifacts()` |
| Blocker placeholder | `auto-recovery.ts` | `writeBlockerPlaceholder()` |
| Merge reconciliation | `auto-recovery.ts` | `reconcileMergeState()`, `MergeReconcileResult` |
| Loop remediation | `auto-recovery.ts` | `buildLoopRemediationSteps()` |
| Out-of-order guard | `dispatch-guard.ts` | `getPriorSliceCompletionBlocker()` |
| Engine routing | `engine-resolver.ts` | `resolveEngine()`, `ResolvedEngine` |
| Dev engine | `dev-workflow-engine.ts` | `DevWorkflowEngine` |
| Custom engine | `custom-workflow-engine.ts` | `CustomWorkflowEngine` |
| Session lock acquisition | `session-lock.ts` | `acquireSessionLock()`, `SessionLockResult` |
| Lock status validation | `session-lock.ts` | `getSessionLockStatus()`, `validateSessionLock()` |
| Lock release | `session-lock.ts` | `releaseSessionLock()` |
| Crash lock write | `crash-recovery.ts` | `writeLock()`, `clearLock()` |
| Crash lock read | `crash-recovery.ts` | `readCrashLock()`, `isLockProcessAlive()` |
| Synthetic unit-end | `crash-recovery.ts` | `emitCrashRecoveredUnitEnd()` |
| Workflow engine contract | `workflow-engine.ts` | `WorkflowEngine` interface |
| Queue management | `guided-flow-queue.ts` | `showQueue()`, `handleQueueReorder()`, `showQueueAdd()` |
| Milestone context builder | `guided-flow-queue.ts` | `buildExistingMilestonesContext()` |
| Summary classifier | `milestone-summary-classifier.ts` | `classifyMilestoneSummaryContent()`, `isTerminalMilestoneSummaryContent()` |
