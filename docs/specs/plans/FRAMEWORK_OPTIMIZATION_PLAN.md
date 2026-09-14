# 🏗️ Plan Changeset: SVC Framework Quality-Preserving Performance & Architecture Refinement

**Version:** 1.0.0  
**Date:** 2026-07-24  
**Lane:** `framework-evolution`  
**Target Repository:** `seriousvibecoding`  
**Quality Contract:** Zero quality/determinism regression. All optimizations must maintain 100% auditability, validation rigor, and ACID durability.

---

## 🎯 1. Final Quality-Verified Change List (16 Approved Items)

| ID | Component | Optimization / Refinement | Quality & Determinism Safeguard |
| :--- | :--- | :--- | :--- |
| **OPT-02** | `candidate-harness.mjs` | Cache `project_id` in memory after initial resolution | `project_id` is invariant during execution. Eliminates 200ms `execFileSync` subshell. |
| **OPT-03** | `candidate-harness.mjs` | Relax candidate ID regex to `/^CAND-[A-Z0-9_-]+$/i` | Supports domain-specific IDs without weakening string validation. |
| **OPT-04** | `candidate-harness.mjs` | Cache checked target file paths in a `Set` during grounding check | Prevents redundant synchronous disk stats within a single script run. |
| **OPT-05** | `candidate-harness.mjs` | Add exponential backoff retry loop to SQLite transactions (5 retries, 50ms) | Prevents `SQLITE_BUSY` crashes during concurrent subagent execution. |
| **OPT-06** | `check-chain-receipts.mjs` | Execute single bulk `git log --format="%H %P %s"` query | Parses commit graph in Node memory; 100% identical commit validation in 10ms instead of 3000ms. |
| **OPT-07** | `svc-reconcile.mjs` | Memoize validated historical commit SHAs in `.svc/reconcile-cache.json` | Historical commits are immutable (content-addressed by SHA-256). Zero loss of correctness. |
| **OPT-08** | `pipeline-decisions.jsonl` | Buffer decision log appends and flush atomically at task boundaries | Eliminates unbuffered disk I/O bottlenecks while guaranteeing complete log entries. |
| **OPT-09** | `completed-task-integrity.mjs` | Hoist all regular expressions to top-level module constants | Eliminates regex re-compilation in validation loops with zero behavior change. |
| **OPT-10** | `completed-task-integrity.mjs` | Replace custom date math with V8 native `Date.parse()` + strict ISO regex | Standard V8 ISO parser is more thoroughly tested than manual leap-year math. |
| **OPT-11** | `completed-task-integrity.mjs` | Compare pre-computed SHA-256 hashes of phase receipts instead of `isDeepStrictEqual` | SHA-256 hash matching is mathematically collision-free ($10^{-77}$) and 10x faster. |
| **OPT-12** | `lane-tasks-*.json` | Store workspace-relative paths instead of machine-specific absolute paths | Makes task graphs portable across different developer machines and CI worktrees. |
| **OPT-13** | `diagnose-capability-blocker.mjs` | Memoize capability blocker diagnosis if ledger modified <60s ago | Prevents redundant diagnostic subshells during rapid tool loops. |
| **OPT-14** | `leftover-disposition.mjs` | Scope untracked file status scans using `.gitignore` boundaries | Avoids scanning `node_modules` or build caches during closeout checks. |
| **OPT-15** | `task-graph.mjs` | Auto-prune `.svc/loop-guard-state-*.json` files older than 7 days | Keeps `.svc/` directory clean while preserving recent session loop guard state. |
| **OPT-16** | `task-graph.mjs` | Cache active phase receipts in memory and flush atomically on task completion | Prevents file corruption from partial intermediate disk writes. |

---

## 🛠️ 2. Task Graph & File Manifest

### Affected Code Files:
- `scripts/candidate-harness.mjs` (OPT-02 to OPT-05; OPT-01 refuted below)
- `scripts/check-chain-receipts.mjs` (OPT-06)
- `scripts/svc-reconcile.mjs` (OPT-07)
- `scripts/lib/completed-task-integrity.mjs` (OPT-09 to OPT-11)
- `scripts/task-graph.mjs` (OPT-12, OPT-15, OPT-16)
- `scripts/diagnose-capability-blocker.mjs` (OPT-13)

### Verification & Test Suite:
- `bash test-framework/evals/tier-1/validate-candidate-harness.sh`
- `bash test-framework/evals/tier-1/validate-phase-receipt-skip-integrity.sh`
- `bash test-framework/evals/tier-1/validate-lane-tasks-integrity.sh`
- `node scripts/svc-reconcile.mjs`

---

## 🚀 3. Launch-Ready Prompt Package for Codex Execution

```markdown
# TASK: Implement Quality-Preserving SVC Framework Optimizations (Plan Changeset)

## 1. Context & Quality Requirement
You are implementing the framework refinements detailed in `docs/specs/plans/FRAMEWORK_OPTIMIZATION_PLAN.md` across `scripts/candidate-harness.mjs`, `scripts/lib/completed-task-integrity.mjs`, `scripts/check-chain-receipts.mjs`, `scripts/svc-reconcile.mjs`, and `scripts/task-graph.mjs`.

**CRITICAL RULE:** Do NOT drop quality, determinism, or validation rigor. All optimizations must maintain 100% auditability, test coverage, and ACID durability.

## 2. Implementation Deliverables
1. **`scripts/candidate-harness.mjs`:**
   - Parse Markdown candidate specs (`docs/specs/candidates/*.md`) directly into SQLite (`~/.svc/store.db`).
   - Cache `project_id` in memory to eliminate `execFileSync` subshell overhead.
   - Relax candidate ID regex to `/^CAND-[A-Z0-9_-]+$/i`.
   - Add exponential backoff retry loop (5 retries, 50ms interval) to SQLite transactions on `SQLITE_BUSY`.
2. **`scripts/check-chain-receipts.mjs` & `svc-reconcile.mjs`:**
   - Bulk query `git log` once into Node memory instead of spawning child processes per commit.
   - Memoize validated commit SHAs in `.svc/reconcile-cache.json`.
3. **`scripts/lib/completed-task-integrity.mjs`:**
   - Hoist top-level regexes; replace custom date math with V8 `Date.parse()`.
   - Use SHA-256 hash comparison for phase receipt payloads.
4. **`scripts/task-graph.mjs`:**
   - Store workspace-relative paths in task graphs (`lane-tasks-*.json`).
   - Auto-prune loop guard state files older than 7 days.

## 3. Verification & Validation Commands
Run the full test suite to prove zero quality/determinism regression:
```bash
# 1. Test candidate harness parsing and SQLite indexing
bash test-framework/evals/tier-1/validate-candidate-harness.sh

# 2. Test phase receipt skip integrity
bash test-framework/evals/tier-1/validate-phase-receipt-skip-integrity.sh

# 3. Test lane tasks integrity
bash test-framework/evals/tier-1/validate-lane-tasks-integrity.sh

# 4. Verify preflight reconcile
node scripts/svc-reconcile.mjs
```

## 4. Closeout Protocol
- Ensure `git status --short` is clean.
- Provide a summary in **① What / ② How / ③ Issues** format upon completion.
```

---

## Disposition ledger — WI-512 (2026-08-04)

Executed as WI-512 batch B3 on branch `wi512-one-lane-batch`. Every item was
grep-verified at its cited anchor before any edit; an item whose anchor or
premise did not survive verification is recorded as `stale-premise` with the
evidence, **not** implemented as an approximation.

| ID | Disposition | Evidence |
| :--- | :--- | :--- |
| **OPT-01** | `stale-premise` | No markdown candidate format exists anywhere in the repo — only the tracked `docs/specs/candidates/consumer-experience-pool.json`. The item's own justification ("Follows repo `.gitignore` line 60") does not hold: no such rule exists, and the `.json` is legitimately tracked. Building the parser would have meant inventing a file format from nothing and calling it an optimization. |
| **OPT-02** | `stale-premise` | `resolveProjectId` has exactly one call site (`candidate-harness.mjs:739`), and every invocation is a fresh process. An in-memory memo can never hit, so the claimed "eliminates 200ms `execFileSync` subshell" saving is unreachable. |
| **OPT-03** | **done** | Regex relaxed to `/^CAND-[A-Z0-9_-]+$/i`. |
| **OPT-04** | **done** | `Map` cache added in `grounding()`. Note the honest measurement caveat below. |
| **OPT-05** | **done** | `SQLITE_BUSY` retry loop, 5 attempts at 50ms. |
| **OPT-06** | pre-existing | Landed before this batch. |
| **OPT-07** | **done** | Green-SHA memo in `.svc/reconcile-cache.json` (gitignored), keyed on `notes_tip`, invalidated wholesale on tip change, fail-open on corrupt/missing cache. **The one measured win of this batch** — see below. |
| **OPT-08** | **done** | Implemented as an `append-batch` NDJSON-stdin mode in `scripts/pipeline-log.mjs`. The item as written ("buffer in memory, flush at task boundaries") is impossible for a per-invocation CLI that exits between appends; the batch mode is the faithful alternative and is recorded as a reshape, not as the original. |
| **OPT-09** | pre-existing | Landed before this batch. |
| **OPT-10** | pre-existing | Landed before this batch. |
| **OPT-11** | **done** | `canonicalJson` + sha256 replaces `isDeepStrictEqual`. **Zero speedup expected and none claimed** — implemented for faithfulness to the plan. The item's "10x faster" justification is not evidenced and was not tested for. |
| **OPT-12** | **done (write side)** | Task-graph writes repo-root-relative paths; anything outside the repo root stays absolute. No in-repo read-side consumer resolves this path, so the dual-read fallback is documented rather than fabricated against a consumer that does not exist. |
| **OPT-13** | **done** | Re-diagnosis skipped when an identical text-hash ledger row is under 60s old. **No measurable speedup** — see below. |
| **OPT-14** | `false-premise` | Target script does not exist under the name `leftover-disposition.mjs`. Not attempted. |
| **OPT-15** | pre-existing | Landed as WI-511. |
| **OPT-16** | `stopped` | This was an AUDIT first, and the audit found real read-then-write sequences in `scripts/task-graph.mjs` (`readGraph`/`writeGraph` across five command branches sharing one top-level read). Safe conversion to `updateJsonAtomic` requires first moving `die()`/`process.exit()` out of the closure, because `process.exit()` skips `finally` and would leak the lock — confirmed live. That is a control-flow refactor, beyond this item's diff cap and forbidden by the no-refactor rail. Evidence filed; work not done. |

### Measured outcome, stated honestly

Before/after on this machine, same commands, captured pre-edit and post-edit:

| Probe | Before | After | Verdict |
| :--- | :--- | :--- | :--- |
| `check-chain-receipts.mjs --range` (20 SHAs, warm) | 0.336s | 0.147s | **Real, repeatable ~2.3x win** (confirmed across 5 runs, 0.12–0.18s). Cold run unchanged. |
| `diagnose-capability-blocker.mjs` (back-to-back) | 0.025s / 0.027s | 0.034s / 0.026s | **No improvement.** Node startup dominates at this scale; the skipped registry scan was already sub-millisecond. |
| `candidate-harness.mjs --rank` (50 candidates) | 0.089s | 0.068s | **Noise, not attributable.** The dataset has one target file per candidate, so OPT-04's cache and OPT-05's retry path are never exercised by it. |

The plan's headline framing (1.8–3.2s per gate, 200ms subshells, 10x hash
comparison) is not reproducible on this machine's warm state. OPT-07 is
justified by the measured warm-path win above and by the cold/contended case
that produced the 9-minute reconcile hang; OPT-11 and OPT-13 are justified by
faithfulness and by the cold path respectively, not by a speedup claim.
