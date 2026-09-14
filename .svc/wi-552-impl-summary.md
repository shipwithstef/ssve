# WI-552 Implementation Summary — Autonomous restart-boundary continuation

**Worktree:** `feature-WI-552-restart-continuation` (based on `feature-WI-551-dispatch-resolver`)
**Session:** `svc-impl-wi552-01a01070`
**Status:** Implementation + tests complete. **Not yet committed** — the commit
was staged and validated (all pre-commit gates pass: multi-host drift check,
worktree isolation, impact-triad receipt) but the final `git commit` invocation
was blocked by this environment's auto-review approval gate, and the approval
prompt was declined/skipped. All work remains staged in the working tree; no
commit exists on top of `6b511dfd` (WI-551) yet.

## What was implemented

A hash-bound continuation-baton lifecycle controller so one owner invocation
can finish a task that requires a fresh host session/process, asking the
WI-551 dispatch resolver (`scripts/resolve-dispatch.mjs`) for role
`verify.restart` — never a silent Claude/Codex remap of Grok/Cursor/AGY.

### New files

| File | Purpose |
|---|---|
| `schemas/continuation-baton.schema.json` | Shape of the hash-bound baton (boundary, forbidden_phases, dispatch_role, implementation_session_id, max_launches). |
| `schemas/continuation-result.schema.json` | Shape of the structured evidence a continuation child must return (rejects free text). |
| `scripts/resolve-continuation.mjs` | Lifecycle controller: `create`, `stamp-deploy`, `launch`, `consume`, `reconcile`, `status`, `deny-check`. State is an append-only, hash-chained event ledger at `.svc/continuation/<WI>.ledger.jsonl` (gitignored, regenerable — the baton is the fold of the ledger, never a mutable blob). |
| `hooks/svc-continuation-phase-guard.mjs` | PreToolUse hook: mechanically denies `diagnose-bug`/`plan-changeset`/`execute-changeset` (or whatever the baton declares) for the **exact** session id a continuation baton launched. Every other session is unaffected (fail-open by absence). |
| `test-framework/evals/tier-1/validate-continuation-lifecycle-wi552.mjs` | Full AC replay matrix (see below) against a scratch repo root — never touches this repo's own `.svc/continuation/` state. |
| `docs/specs/test-evidence/WI-552/*.log` | Captured PASS output from the new validator and a consolidated WI-552 validation run (skill-structure, contracts, worktree-safety, manifest lint, hook-latency, tier1-selector). |

### Modified files

| File | Change |
|---|---|
| `scripts/resolve-dispatch.mjs` | Added `resolveDispatchRoleTuple(options)` — generic role resolution (e.g. `verify.restart`) independent of the seven cognitive labels, same fail-closed/no-remap semantics as `resolveDispatchModel`. Added `role` CLI command. |
| `hooks/hooks.json` | Registered `svc-continuation-phase-guard` under `PreToolUse`, matcher `Skill`. |
| `.svc/perf-baseline.json` | Deliberately bumped `hook_spawn.max_per_event.PreToolUse` 11→12 with a documented reason (WI-397 regression-net contract: adding a hook must force a reviewed bump, never silently pass). |
| `provision/hosts/{antigravity,claude,codex,cursor,gemini,grok,kimi,mimo-code,opencode}.json` | Added `authority_capabilities.fresh_session_launch` to all nine hosts. **Enabled only for `grok`** (`transport: cli-launch`, `event: SessionStart`) reflecting the WI-542 scenario this WI is built for; every other host is explicitly `enabled: false` with a stated reason — never silently assumed capable. |
| `skills/land-changeset/SKILL.md` | New "Restart-Boundary Continuation (WI-552)" section: persist the baton before merge, stamp it with the merge SHA after. Explicitly additive — a WI with no restart boundary never creates a baton. |
| `skills/verify-promotion/SKILL.md` | New "Restart-Boundary Continuation (WI-552)" section: check for a baton, reconcile/launch exactly once via the resolver, detect "this session IS the launched child," consume structured evidence to close out. |
| `scripts/select-tier1-validators-v2.mjs` | Registered the new validator's change-impact contract; updated the fixed WI-368-proposal full-closure list to include it (existing test fixture, alphabetically inserted). |
| `test-framework/evals/tier-1/validate-tier1-selector-v2.mjs` | Updated the same fixed-list assertion. |
| `.gitignore` | Added `.svc/continuation/` (machine-local, regenerable ledger state). |

### Explicitly NOT implemented (per instructions)

- WI-550 receipts
- WI-545 chmod
- WI-502 authority / Execution Controller v2 reimplementation (reused as-is via `resolveDispatchRoleTuple` asking the existing resolver, never re-derived)

## Acceptance-criteria coverage (WI-552.md)

Verified end-to-end by `test-framework/evals/tier-1/validate-continuation-lifecycle-wi552.mjs`
plus a manual hook smoke test:

| AC | Mechanism | Evidence |
|---|---|---|
| AC-552-1 | `verify.restart` resolved via `resolveDispatchRoleTuple` → `resolve-dispatch.mjs`, never invented | `launched.entry.tuple.host === 'grok'` assertion |
| AC-552-2 | Freshness: child session id ≠ implementation session id, must equal the exact launched session, `started_at` strictly after `deploy_receipt_at` | 3 `assert.throws` cases (stale/foreign/self session) |
| AC-552-3 | Exactly-once launch; second `launch`/`reconcile` call while outstanding never re-spawns | `already-launched` / `waiting-for-result` assertions |
| AC-552-4 | PreToolUse hook denies forbidden phases for the exact launched session only | `isPhaseForbiddenForSession` matrix + direct hook-script smoke test (piped JSON payloads) |
| AC-552-5 | Read-only proof needs no mutating lease (documented in `verify-promotion/SKILL.md`; the controller itself never acquires WI-502 authority) | doc section |
| AC-552-6 | Fail-closed: missing resolver route → `dispatch resolver refused role` block; missing/disabled host capability → `capability_limited` block. No Claude/Codex substitution in either case | 2 dedicated fail-closed test blocks |
| AC-552-7 | `consume` rejects free text and non-JSON-file strings with `continuation_result_invalid` (fixed during testing — was previously an uncaught `ENOENT`) | `assert.throws(/structured result object/)` |
| AC-552-8 | Ordinary WIs with no baton: `reconcile` on an absent baton is `{action:'absent'}`, zero new sessions | dedicated assertion |
| AC-552-9 | Ledger-derived state (`foldBaton`) means a fresh process reconstructs the exact same baton after "crash" — `reconcile` on `launched`/`closed` never re-launches | assertions + hash-chain tamper-evidence check on raw ledger entries |
| AC-552-10 | Live launch adapter/fixtures explicitly deferred to WI-546 per WI-552 Boundaries — the `launch_command` seam exists (`spawn` call site) but is `null` for grok today | code comment + host manifest `note` field |

## Validation run (all green; zero new regressions)

- `node test-framework/evals/tier-1/validate-continuation-lifecycle-wi552.mjs` → PASS
- `bash test-framework/evals/tier-1/validate-hook-latency.sh` → PASS (12 ≤ 12, deliberately bumped)
- `node test-framework/evals/tier-1/validate-tier1-selector-v2.mjs` → PASS (13/13)
- `bash test-framework/evals/tier-1/validate-skill-structure.sh` → PASS (1251/1251)
- `bash test-framework/evals/tier-1/validate-contracts.sh` → PASS (661/661)
- `bash test-framework/evals/tier-1/validate-chain-references.sh` → PASS (275/275)
- `bash test-framework/evals/tier-1/validate-self-verify-sections.sh` → PASS
- `bash test-framework/evals/tier-1/validate-worktree-safety.sh` → PASS (6/6)
- `node scripts/lint-skills-manifest.mjs` → PASS
- Full `bash test-framework/evals/run-all-evals.sh --tier1` → **10 pre-existing
  failures, identical to a stashed baseline run with WI-552 removed** (confirmed
  by diffing baseline vs. WI-552 runs). None are caused by this change. The
  `validate-no-svc-residue` baseline failure (caused by this WI's own then-
  untracked `.svc/lane-tasks-WI-552.json`) is resolved once that file is
  committed.

Full logs: `docs/specs/test-evidence/WI-552/validate-continuation-lifecycle-wi552.log`,
`docs/specs/test-evidence/WI-552/wi552-validation-run.log`.

## Bugs found and fixed during implementation

1. **ESM `require`** in `resolve-continuation.mjs` — fixed to a static `import { spawn }`.
2. **Schema rejected explicit `null`** for optional string fields — widened to `["string","null"]`.
3. **Deadlock** in `appendEvent` (nested `withStateLock` via `appendJsonlLine`) — fixed to a raw `fs.appendFileSync` inside the single outer lock.
4. **`consume` crashed with raw `ENOENT`** instead of failing closed with `continuation_result_invalid` when given free text that wasn't valid JSON and wasn't an existing file path (AC-552-7 gap) — fixed with an explicit existence check before attempting a file read.
5. **Host-manifest formatting regression** — an earlier batch `JSON.stringify` edit reformatted unrelated single-line fields (`runtime_ingress_v2`, `native_task_read_tools`) in all nine host manifests; reverted via targeted `StrReplace` so only `fresh_session_launch` was added.

## Outstanding / handoff

- **Commit not yet made.** All 22 changed/new files are staged in this
  worktree. The pre-commit chain (multi-host drift, worktree-isolation
  session binding, impact-triad receipt at
  `.svc/impact-triad/WI-552/task-1.json`, schema_version 2 deferred-to-final
  review bound to lane-task 2) all pass locally — confirmed by a dry run of
  `git commit` up to the point where this environment's own approval gate
  intercepted the call and the approval prompt was declined. The commit
  message is ready and unchanged; re-running the same `git commit` (with
  `SVC_SESSION_ID=svc-impl-wi552-01a01070` exported) should succeed once
  approved.
- `.svc/lane-tasks-WI-552.json`: task 1 (`execute-changeset`) is `completed`
  with a `skill_receipt`; task 2 (`review-exec`) is `pending`, `blocked_by: [1]` —
  ready for the next chain stage.
- Live fresh-session launch transport for Grok (the actual `launch_command`)
  remains WI-546 scope per WI-552's own Boundaries — this WI wires the full
  lifecycle up to that seam only.
