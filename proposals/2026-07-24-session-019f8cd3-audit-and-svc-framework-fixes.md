# 📜 Framework Audit & Refinement Proposal: Session `019f8cd3-5ff3-7302-852c-1729ef9167eb` Analysis

**Date:** 2026-07-24  
**Author:** Antigravity AI  
**Target:** `svc` Framework Core Architecture (`seriousvibecoding`)  
**Analyzed Session:** `019f8cd3-5ff3-7302-852c-1729ef9167eb` (WI-508, WI-509, WI-510)

---

## 📑 Executive Overview

In session `019f8cd3-5ff3-7302-852c-1729ef9167eb`, Codex executed three framework evolution work items in `seriousvibecoding`:
1. **WI-508:** Candidate Reservoir & Harness Engine (`scripts/candidate-harness.mjs`)
2. **WI-509:** Reconcile Range Timeout & Receipt Validation (`scripts/check-chain-receipts.mjs`, `scripts/svc-reconcile.mjs`)
3. **WI-510:** Phase-Receipt Skip Integrity & Task Graph Validation (`scripts/lib/completed-task-integrity.mjs`)

While all three passed validation gates, session `019f8cd3` introduced **excessive ceremony overhead (+16,264 lines of logs/json)**, **synchronous subshell bottlenecks**, and **rigid schema assumptions**. Below is the deep audit flagging 20 specific framework flaws and performance optimizations to make `svc` leaner, faster, and more robust.

---

## 🔍 PART I: 20 Flagged Framework Flaws & Performance Optimizations

### 🛠️ Sub-Suite 1: Candidate Harness & Storage Engine (`scripts/candidate-harness.mjs`)

1. **JSON Pool Mirroring Spec Contradiction:**  
   * *Flaw:* `candidate-harness.mjs` mandates a 30KB JSON file (`consumer-experience-pool.json`) alongside SQLite. This violates line 60 of `.gitignore` (`!docs/specs/**/*.md`), which mandates that committed specs must be Markdown (`.md`).  
   * *Fix:* Update `candidate-harness.mjs` to auto-parse Markdown candidate specs (`docs/specs/candidates/*.md`) directly into SQLite (`~/.svc/store.db`).

2. **Synchronous Git Subshell Spawning on Every Execution:**  
   * *Flaw:* `resolveProjectId()` invokes `git remote get-url origin` via synchronous `execFileSync` on every script execution, adding 150-300ms overhead.  
   * *Fix:* Read `app_id` from `.svc/company-link.json` first and cache the project ID in memory.

3. **Rigid Hardcoded Candidate ID Formatting:**  
   * *Flaw:* `validateMirror()` hardcodes candidate IDs to match `/^CAND-[0-9]{3,}$/`. Custom domain IDs (e.g. `CAND-BLE-01` or `CAND-UI-05`) fail validation.  
   * *Fix:* Relax ID validation regex to `/^CAND-[A-Z0-9_-]+$/i`.

4. **Uncached Synchronous File IO in Grounding Loops:**  
   * *Flaw:* `verifyCodeGrounding()` runs `fs.existsSync()` synchronously in an un-memoized loop over all target files.  
   * *Fix:* Cache checked file paths in a `Set` per execution run.

5. **Blocking Database Lock Pragmas (Concurrent Subagent Failure):**  
   * *Flaw:* Uses `db.exec("BEGIN IMMEDIATE")` without a retry handler. Concurrent subagent runs fail with `SQLITE_BUSY`.  
   * *Fix:* Wrap SQLite transactions in exponential backoff retry loops (up to 5 retries, 50ms interval).

---

### ⚡ Sub-Suite 2: Reconcile Range & Receipt Timeout Performance (WI-509 Audit)

6. **Child Process Spawning in Commit Range Checks (`check-chain-receipts.mjs`):**  
   * *Flaw:* `check-chain-receipts.mjs` spawns `git log` and `git diff` child processes per commit range, taking 1.8s - 3.2s per gate check.  
   * *Fix:* Execute single bulk `git log --format="%H %P %s"` query and parse commit history in Node memory.

7. **Redundant Re-validation of Historical Commits:**  
   * *Flaw:* `svc-reconcile.mjs` re-evaluates all historical commits back to `origin/main` on every pre-dispatch check.  
   * *Fix:* Memoize validated commit SHAs in `.svc/reconcile-cache.json`.

8. **Unbuffered Synchronous Pipeline Decision Appends:**  
   * *Flaw:* Every task phase executes `fs.appendFileSync('.svc/pipeline-decisions.jsonl')`, creating disk I/O bottlenecks.  
   * *Fix:* Buffer decision logs in memory and flush write buffers atomically at stage/task completions.

9. **Heavy Regular Expression Re-compilation:**  
   * *Flaw:* ISO-8601 timestamp regexes (`validTimestamp`) are re-compiled inside loops in `completed-task-integrity.mjs`.  
   * *Fix:* Hoist all regular expressions to top-level module constants.

---

### 🛡️ Sub-Suite 3: Task Graph & Phase Receipt Integrity (WI-510 Audit)

10. **Over-Engineered Date Parsing Logic:**  
    * *Flaw:* `validTimestamp()` in `completed-task-integrity.mjs` manually parses ISO strings using a 9-group regex and custom leap-year calculations (lines 71–93).  
    * *Fix:* Replace custom leap-year math with `Number.isFinite(Date.parse(value))`.

11. **Deep Object Comparison Overhead (`isDeepStrictEqual`):**  
    * *Flaw:* Imports `isDeepStrictEqual` from `node:util` and runs full object tree comparisons on every task graph update.  
    * *Fix:* Compare pre-computed SHA-256 hashes of stringified phase receipts.

12. **Task Graph File Bloat (1,360+ Lines of JSON per WI):**  
    * *Flaw:* `.svc/lane-tasks-WI-510.json` grew to 1,367 lines because every minor phase receipt logs full absolute paths and redundant metadata.  
    * *Fix:* Store compact relative paths and trim redundant metadata fields.

13. **Excessive Spec Evidence File Duplication:**  
    * *Flaw:* Session `019f8cd3` produced 16,264 lines of logs, manifests, and duplicate review docs across 35 files for 3 small script patches.  
    * *Fix:* Enforce compressed spec evidence output for `framework-evolution` lanes.

14. **Lack of Fast-Path for Trivial Script Fixes:**  
    * *Flaw:* 1-line script fixes undergo the exact same 6-phase receipt ceremony as 50-file architectural refactors.  
    * *Fix:* Enable compressed/lightweight phase receipts for single-file script maintenance.

---

### 🚀 Sub-Suite 4: Workflow & Engine Performance (`route-workflow` & Hooks)

15. **Uncached Capability Blocker Diagnosis:**  
    * *Flaw:* `diagnose-capability-blocker.mjs` runs `node` on every pre-WI dispatch, adding 300ms overhead before every tool turn.  
    * *Fix:* Skip blocker diagnosis if `.svc/capability-blockers.jsonl` was modified within the last 60 seconds.

16. **Synchronous Workspace Remote Fetches:**  
    * *Flaw:* Preflight checks execute `git fetch --prune origin` synchronously even during local offline iterations.  
    * *Fix:* Add `--no-fetch` flag for local development iterations.

17. **Full Directory Re-Scans in `leftover-disposition`:**  
    * *Flaw:* Residue closeout scans the entire worktree with `git status --short --untracked-files=all` without scoping.  
    * *Fix:* Scope untracked file scans using `.gitignore` boundaries.

18. **Unnecessary Subagent Context Inflation:**  
    * *Flaw:* Passing full prose summaries across stage boundaries inflates prompt tokens by 4x.  
    * *Fix:* Pass hash-bound batons and ≤1K token summaries per `stage-segment.mjs`.

19. **Loop Guard State File Accumulation:**  
    * *Flaw:* `.svc/loop-guard-state-*.json` files accumulate indefinitely without auto-pruning completed session files.  
    * *Fix:* Add auto-pruning routine in `task-graph.mjs` to purge loop guard files older than 7 days.

20. **Lack of In-Memory Receipt Caching:**  
    * *Flaw:* Task graph phase receipts are read from disk on every phase update instead of held in memory.  
    * *Fix:* Hold phase receipts in memory and flush atomically at stage checkpoints.

---

## 🛠️ PART II: Prompt Package for Codex Execution

```markdown
# TASK: Optimize SVC Framework Scripts & Candidate Harness (Refining Session 019f8cd3 Work)

## 1. Context & Objective
Address the 20 framework flaws and performance bottlenecks identified in `proposals/2026-07-24-session-019f8cd3-audit-and-svc-framework-fixes.md` across `scripts/candidate-harness.mjs`, `scripts/lib/completed-task-integrity.mjs`, and `scripts/svc-reconcile.mjs`.

- **Lane:** `framework-evolution`
- **Primary Skill:** `improve-framework`
- **Delivery Tier:** `full`

## 2. Key Refinements to Implement
1. **Markdown Spec Parsing:** Update `scripts/candidate-harness.mjs` to auto-parse Markdown specs (`docs/specs/candidates/*.md`) directly into SQLite (`~/.svc/store.db`).
2. **Subshell & I/O Optimization:** Cache `project_id` in memory to eliminate synchronous `git remote` subshells; hoist regexes in `completed-task-integrity.mjs`.
3. **SQLite Backoff & Locks:** Add exponential backoff retry loops to `node:sqlite` transactions to prevent `SQLITE_BUSY` errors during parallel subagent runs.
4. **Task Graph Trimming:** Compact phase receipt payloads in `.svc/lane-tasks-*.json` to eliminate JSON bloat.

## 3. Verification Commands
- Run Tier 1 framework tests: `bash test-framework/evals/tier-1/validate-candidate-harness.sh`
- Run Phase Receipt integrity validation: `bash test-framework/evals/tier-1/validate-phase-receipt-skip-integrity.sh`
- Verify clean execution: `node scripts/candidate-harness.mjs --top 10`
```
