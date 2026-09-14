# Framework Evolution — 2026-04-14 — "handle these N in parallel" as a first-class primitive

**Status:** BLOCKED — needs scope decision before `improve-framework` picks it up

## Why BLOCKED

Post-audit re-read: proposal as written is **over-engineered for actual usage patterns**. Real waves are 2-3 workers, not 4+. The full `claude -p` transport + H-1/H-2/H-3 hook adaptations exist to make the 4+ edge case work — but that case is rare and the Agent tool handles 2-3 workers for free (subagent edits inherit into parent's hooks, so no rollup needed).

Three scope decisions required before unblocking:

1. **Tier 1 scope — narrow or full?**
   - *Narrow (recommended):* `route-workflow --parallel` mode, Agent tool only, max 3 concurrent, F-03 frontmatter, F-07 shared-config allowlist, F-09 one-PR-per-WI, F-10 inline threshold + concurrency cap, F-0x task-graph subagent-awareness. **Drops:** F-02 `claude -p` transport, F-08 hook adaptations, F-12 progress stream. Implementable in ~1 session. Caps at 3 parallel workers (hits the WI-049..053 replay target).
   - *Full:* everything currently in Tier 1 of this proposal. 2-4 sessions of work. Enables true 4+ parallel. Only worth it if 4+ is a regular case.

2. **`claude -p` as subagent transport — is the framework ready to commit?**
   - DOCTRINE frames `claude -p` as EXTERNAL orchestration (Python/TS program calling claude). This proposal would repurpose it as an INTERNAL subagent channel. No one has done this in svc yet. Subtle issues (auth inheritance, structured output capture, cost model under Max vs API) are unverified.
   - If unsure, narrow Tier 1 defers this question.

3. **Does svc's own priority justify this investment?**
   - `references/knowledge/svc/CAPABILITIES.md:242` rates "Wave-based parallel execution" as **MEDIUM** priority Known Gap. This proposal promotes it to P0 multi-tier. The MEDIUM rating was self-assigned and should be respected unless the WI-049..053 run actually blocks on it.

**To unblock:** user picks narrow-or-full (question 1), ratifies or defers `claude -p` (question 2), and confirms priority (question 3). Then this proposal either loses its BLOCKED status or a new "narrow-tier-1" proposal supersedes it.

## Method

Read `FRAMEWORK-STATE.md` (searched for parallel/wave/subagent history), `references/knowledge/svc/CAPABILITIES.md` Known Gaps table, `references/subagent-context-rules.md`, `DOCTRINE.md` Programmatic section, and the existing `dispatching-parallel-agents` skill reference. Grounded in the WI-049..053 dispatch question raised this session ("can I handle these 4 in parallel?").

## User intent

> "I want to be able to say 'here handle these 4 in parallel'. Should subagents follow full platform capabilities, or call `claude -p` sessions over CLI for true isolation?"

## Current state (what works today, what doesn't)

**Works** (`CAPABILITIES.md:195`, `skills.md:136`): `scripts/worktree.sh`, `execute-changeset` worktree isolation, `using-git-worktrees` skill, `dispatching-parallel-agents` skill, `Agent` tool with `isolation: "worktree"`.

**Doesn't work** (`CAPABILITIES.md:242` Known Gap MEDIUM): "Wave-based parallel execution | Inner worktrees exist, no wave numbering." No dependency DAG. No skill that accepts `[WI-A, WI-B, WI-C, WI-D]` → emits a conflict-free wave plan → dispatches.

**Transport choice is undefined.** `DOCTRINE.md:1069` mentions `claude -p` as the "Programmatic" orchestration mode, but says "identical either way" — it does NOT answer when to pick Agent-tool subagents vs `claude -p` subprocesses for intra-session parallelism. The user is asking exactly this question and the framework has no position.

## Findings (by priority)

### P0 — Fix now (blocks the stated capability)

#### F-01 — No skill takes `[WI list]` and produces a wave plan

**Evidence:** Searched skill manifest for a "parallel dispatcher" — nothing. `dispatching-parallel-agents` (SKILL.md unread this session but visible in skill list) is a *process guide* for when to use multiple agents, not a dispatcher that accepts WI IDs and produces waves. Today the user must manually (a) read each WI's affected files, (b) compute conflicts, (c) assign waves, (d) spawn subagents — exactly what I did by hand for WI-049..053 in the previous turn.

**Fix:** New skill `dispatch-waves` (or extend `route-workflow` with a sub-mode `--parallel <WI,WI,...>`). Contract:

1. **Input:** list of WI paths or IDs.
2. **Read each WI** and extract its declared `affects_files:` (see F-03) plus any files grepped from the WI body.
3. **Build conflict graph** — two WIs conflict if they modify the same file. Spec-only WIs don't conflict with code WIs touching the same module (different files).
4. **Compute waves** via graph colouring — each wave is an independent set.
5. **Emit `.svc/waves.json`** — ordered list of waves, each wave lists member WIs, chosen transport, chosen skill per WI.
6. **Dispatch** — launch workers per wave; wait for wave; update `lane-tasks.json`; continue.

Worked-example for WI-049..053 from this session:
- Wave 1: {WI-050 (spec), WI-051 (spec), WI-053 (new e2e/)} in parallel — zero file overlap
- Wave 2: {WI-049 + WI-052 piggyback} — both touch `Employees.jsx`, serialize in one worktree

#### F-02 — Transport choice (Agent tool vs `claude -p`) is undocumented for parallelism

**Evidence:** `DOCTRINE.md:1069` treats `claude -p` as an external orchestration transport for full pipelines, not as a subagent substitute. `subagent-context-rules.md:10-16` warns: "A 5-task parallel execution with unconstrained subagents can waste 100-250K tokens." But it does not recommend `claude -p` as the fix — only constraint blocks on in-process subagents.

**Fix:** Add `references/parallel-dispatch-transport.md` with a decision table:

| Scenario | Transport | Why | Task-API caveat |
|---|---|---|---|
| 2-3 waves, shared context useful (e.g., iterating within a feature) | **Agent tool with `isolation: "worktree"`** | In-process, inherits most tools, but each spawn copies ~130K parent context. Cheap at 2-3, expensive at 5+. | Subagent does NOT have TaskCreate/TaskUpdate/TaskList. Must update `lane-tasks.json` file; parent re-mirrors on return. |
| 4+ fully independent WIs (what the user asked) | **`claude -p` subprocess per WI** | Fresh context per session, no parent bloat. Worker only loads the WI's relevant files (~5-20K) + skill(s). Coordination via `lane-tasks.json` file state. | Separate session has its own isolated TaskList the orchestrator can't see. File state is the only coordination channel. `SVC_SUBAGENT=1` env var tells the worker to skip host mirroring. |
| Review-specialist parallelism (Review Army) | **Agent tool** | Shared context IS the point — specialists need the diff in context. `dispatching-parallel-agents` already covers this. | Same subagent-task-API caveat — but Review Army doesn't chain task graphs, so low impact. |
| Cross-repo work | **`claude -p`** | Different `cwd`, different project state; Agent tool can't switch cwd cleanly. | Same as row 2. |

**Hard rule:** any wave of ≥4 WIs defaults to `claude -p`. Below that, Agent tool is fine.

The `claude -p` path needs a wrapper script: `scripts/dispatch-worker.sh <WI-path> <skill>` that `cd`s into the worktree, invokes `claude -p` with the skill-specific prompt, captures stdout/err to `.svc/dispatch/<WI>-<timestamp>.log`, and writes terminal status back to `lane-tasks.json`.

### P0 — Fix now (blocks the stated capability) — promoted from observation

#### F-0x — Task-graph mode boilerplate assumes parent-session tool parity

**Evidence:** Every skill with a "Chaining → Task-graph mode" section (route-workflow, diagnose-bug, plan-changeset, execute-changeset, review-gate, write-e2e, land-changeset, verify-promotion, test-journeys — per `FRAMEWORK-STATE.md:863`) includes the line *"In Claude Code: mirror file state with `TaskList` / `TaskUpdate`"*. Agent-tool subagents have no access to those tools. `claude -p` workers run in a separate session with an unrelated TaskList the orchestrator can't see. The boilerplate is correct for parent sessions only — silently incorrect when the same skill is invoked inside a subagent wave, which is exactly what parallel dispatch does.

**Fix:** Update the Task-graph mode boilerplate to be subagent-aware:

```
**Task-graph mode:**
- Read and update `.svc/lane-tasks.json` first — this is the cross-host,
  cross-session, cross-subagent source of truth.
- Host UI mirroring (TaskList/TaskUpdate in Claude Code; update_plan in Codex)
  is ONLY performed when running in the parent/top-level session. Detect via:
  host exposes TaskList tool AND no `SVC_SUBAGENT=1` marker in env. If either
  check fails, skip host mirroring — file state is the durable record; the
  orchestrator parent will re-read and re-mirror after the subagent returns.
- Subagents MUST NOT attempt TaskUpdate calls. Trying and failing is not
  graceful; it's silent drift between the subagent's intent and the host UI.
```

Apply to all 9 Task-graph-mode skills + `route-workflow`'s canonical Protocol section. Add a dispatcher contract: wrapper `scripts/dispatch-worker.sh` (F-02) sets `SVC_SUBAGENT=1` before invoking `claude -p`. Agent-tool subagents are detected via tool-availability probe at skill start.

### P1 — Fix soon (degrades wave planning quality)

#### F-03 — WI files don't declare affected files structurally

**Evidence:** Today's WI-049..053 mention affected files only in prose ("In `src/pages/Employees.jsx`..."). A wave planner cannot reliably extract conflict candidates from free text. I did it by hand; a skill can't.

**Fix:** Extend WI frontmatter contract:

```markdown
---
id: WI-049
type: bug
severity: HIGH
estimated_minutes: 20             # drives inline-vs-dispatch decision (F-10)
affects_files:
  - src/pages/Employees.jsx
  - src/pages/Scheduling.jsx
  - src/hooks/useEmployees.ts    # suspected query invalidation site
affects_specs:
  - docs/specs/features/owner-employees.md
  - docs/specs/features/owner-scheduling.md
route: diagnose-bug
---
```

Update `diagnose-bug`, `sync-spec-code`, `write-e2e`, `quick-fix`, and `test-journeys` (Step 4.5) to fill `affects_files` when creating a WI. Mark the field as "suspected" when the WI is OPEN and "confirmed" after implementation. Self-Verify check: every HIGH/CRITICAL WI has a non-empty `affects_files` OR an explicit `affects_files: [unknown]` with a note.

#### F-04 — No merge-back contract after a parallel wave completes

**Evidence:** `hooks/svc-task-completion-guard.sh` (`FRAMEWORK-STATE.md:830`) has "Subagent bypass only when the hook payload explicitly exposes subagent metadata." That prevents workers from triggering the parent's Stop hook. But: who marks each WI `completed` in `lane-tasks.json` after a parallel wave? Each worker? The orchestrator? Race conditions are likely with 4 workers writing the same JSON.

**Hard constraint (added 2026-04-14 per user advisor):** Agent-tool subagents do NOT have access to TaskCreate/TaskUpdate/TaskList — those are parent-session-only tools. The file IS the subagent's task list. Any subagent-dispatched skill whose Chaining section says "update host with TaskUpdate" will silently no-op on the host mirror. File-state is the ONLY cross-subagent-boundary coordination channel. `claude -p` workers have the same constraint (they are separate sessions with their own TaskList that the orchestrator cannot see).

**Fix:** Define a merge-back protocol in `references/parallel-dispatch-transport.md`:
- Each worker writes its result to `.svc/dispatch/<WI>.result.json` (atomic single-file write).
- Orchestrator tails the dispatch dir, reads each `.result.json` as workers finish, merges into `lane-tasks.json` sequentially.
- Timeout per worker (default 20 min) with kill + mark-failed.
- Failed worker does NOT block the wave — orchestrator proceeds, surfaces failure in final report.

### P2 — Improve when possible

#### F-05 — Worker model routing

**Evidence:** `~/app-workspaces/seriousvibecoding/rules/common/model-selection.md` says "worker agents → Haiku by default". The dispatcher should enforce this — orchestrator is Sonnet, `claude -p` workers default to `--model claude-haiku-4-5-20251001` unless the WI declares `needs_model: sonnet|opus` (e.g., architectural bugs).

**Fix:** `dispatch-waves` skill picks worker model from WI severity + type. Bug-fix / spec-sync / quick-fix → Haiku. diagnose-bug on architectural issues → Sonnet. Override via WI frontmatter.

### P0 — Hardening (added 2026-04-14 after completeness audit)

#### F-07 — Conflict detection must cover transitive deps and shared-config files

**Evidence:** F-03 only captures explicit `affects_files:`. If WI-A declares `src/pages/Employees.jsx` and WI-B declares `src/hooks/useEmployees.ts`, the file sets don't overlap — but `Employees.jsx` imports `useEmployees.ts`, so parallel edits produce merge conflicts or runtime breakage. Equally: two WIs both modifying `package.json`, `tsconfig.json`, `tailwind.config.*`, migration dirs, or `e2e/fixtures/*` will collide invisibly.

**Fix (two layers):**
1. **Shared-config allowlist** in `dispatch-waves`: any WI touching a path in `{package.json, package-lock.json, tsconfig*.json, tailwind.config.*, vite.config.*, migrations/**, e2e/fixtures/**, .env*}` is marked `SERIAL` — ALL such WIs collapse into a single forced-sequential wave at the end, regardless of other conflicts. Allowlist lives in `references/parallel-dispatch-transport.md`.
2. **Import-graph reachability** (optional, recommended): on wave-plan, run `tsc --listFiles` (or `madge`/`dependency-cruiser`) to expand each WI's `affects_files` to its one-hop import closure. Two WIs conflict if their closures intersect. Fallback when tooling unavailable: treat the declared set as authoritative and warn. Closure computation is cached per commit SHA.

#### F-08 — Hooks need adaptation for multi-session wave execution

**Evidence:** `hooks/hooks.json` registers 4 PreToolUse + 2 PostToolUse + 2 Stop hooks, all designed for single-session execution (`FRAMEWORK-STATE.md:830` completion-guard, `:772` edit-accumulator). Audit surfaced two breakages:

- **H-1 (edit-accumulator rollup):** PostToolUse `edit-accumulator` appends edited source paths to `.claude/svc-edited-files.json`. In `claude -p` workers, each writes to its own worktree's file. Orchestrator's `stop-quality` hook (batch format+typecheck) only sees orchestrator-session edits — it cannot cover worker output.
- **H-2 (completion-guard session scoping):** Stop-hook `svc-task-completion-guard` reads all of `lane-tasks.json`. A worker whose WI is done but whose peer-worker's WI is still `in_progress` gets blocked at Stop citing the peer's task.

**Fix:**
- **H-1:** `scripts/dispatch-worker.sh` (F-02) merges each worker's `.claude/svc-edited-files.json` into `<orchestrator-root>/.claude/svc-edited-files.json` when the worker returns. Orchestrator's `stop-quality` then covers the full wave's edits. Implemented as a single `jq -s '.[0] + .[1] | unique'` merge, atomic via rename.
- **H-2:** Extend `svc-task-completion-guard.sh` to respect env var `SVC_WORKER_WI=<WI-id>` — when set, the guard filters `lane-tasks.json` to only tasks matching that WI (and its direct children). `scripts/dispatch-worker.sh` sets this var before `claude -p`. Parent session has no filter → unchanged behaviour.
- **H-3 (quality consolidation):** Workers skip their own `stop-quality` hook (batch format+typecheck) via `SVC_SKIP_WORKER_QUALITY=1` set by `scripts/dispatch-worker.sh`. Rationale: with H-1 providing a rolled-up edit list at the orchestrator, one consolidated typecheck/format pass at wave end covers all worker output — 4× faster than running per-worker (a 30s `tsc --noEmit` × 4 workers = 2min redundant). Orchestrator runs the consolidated pass as the final tier-1 step before declaring the wave done. If the consolidated pass fails, the failing files are surfaced with their owning WI (traceable via the per-worker `svc-edited-files.json` before merge).

#### F-09 — Landing strategy must be explicit

**Evidence:** `review-gate` G1-G7 and `land-changeset` plan-completion-audit assume a single branch under review. A wave produces N worker branches. Current proposal says nothing about how they land.

**Decision (locked, recommended):** **one PR per WI, not per wave.** Rationale:
- Matches existing `land-changeset` contract without rewrite.
- Reviewer cognitive load is scoped to one WI.
- Partial wave success is trivial — merged WIs ship, failed WIs retry.
- Cost: N PRs to review. Acceptable given WIs are typically small.

Worker's final step: invoke `land-changeset` on its own branch. Orchestrator does not run a wave-level land step. Consolidation PR (option-c from audit) rejected — adds a merge-all-branches step that conflicts-detects the same problems a second time.

#### F-10 — Shared-resource arbitration + concurrency cap

**Evidence:** 4 concurrent `claude -p` workers burn 4× API tokens (rate-limit risk), serialize on the single browse daemon, and may corrupt Base44 test data if two workers use the same owner account concurrently.

**Fix (four sub-fixes):**
- **Concurrency cap:** `dispatch-waves` defaults to `max_workers=3` (env var `SVC_MAX_WORKERS` overrides). Waves of 4+ WIs run as 3-concurrent-then-1.
- **Base44 stream assignment:** workers receive `TEST_STREAM=a|b|c` env var; dispatcher assigns in order. Stream pool defined in `e2e/.env` per project. If wave size > available streams, dispatcher serializes excess.
- **Browse daemon / Playwright MCP:** accept serialization (single-instance). Document in transport doc: "browser-using workers may wait up to 60s for daemon; budget accordingly."
- **Inline-vs-dispatch cost threshold:** workers cold-start in ~20-40s (session spawn + skill load). Dispatching a 2-minute WI via `claude -p` is slower than doing it inline (3min vs 2min). Rule: `dispatch-waves` runs WIs with estimated cost `< SVC_DISPATCH_MIN_COST` (default 5min) INLINE in the orchestrator session, only dispatches larger WIs to workers. Estimated cost per WI comes from the WI frontmatter `estimated_minutes:` field (F-03 extension). Missing field → assume large (dispatch). Worked example: WI-051 (1-line spec edit, ~1min) runs inline; WI-049 (live-UI bug fix + test, ~20min) dispatches.

#### F-11 — Failure semantics table

**Evidence:** Proposal currently handwaves with "surfaces failure in final report." Real failure modes:

| Failure | Behaviour |
|---|---|
| Worker timeout (>20min default; `SVC_WORKER_TIMEOUT` overrides) | Kill worker, mark WI `failed:timeout` in `lane-tasks.json`, orchestrator proceeds with remaining waves |
| Worker non-zero exit | Same — mark `failed:error`, log `<WI>.err.json` with tail of stderr |
| Worker produces uncommitted changes on return | Orchestrator runs `git stash` in worker's worktree, marks `failed:dirty-tree`, saves stash ref in result |
| Orchestrator crashes mid-wave | On restart, `dispatch-waves --resume` reads `.svc/dispatch/*.result.json`, completes workers that finished, re-dispatches the missing |
| Upstream WI fails, dependent WI queued | Dependent stays `blocked:upstream-failed`, no auto-retry — surfaces in final report for user triage |

No automatic rollback of completed workers in the same wave. User reviews failed WIs individually.

### P1 — Observability

#### F-12 — Unified wave-progress stream

**Evidence:** 4 workers produce 4 log streams under `.svc/dispatch/`. User watching the orchestrator session sees nothing until workers return. For a 15-minute wave, this is opaque.

**Fix:** `scripts/dispatch-worker.sh` writes a one-line status update to `.svc/dispatch/wave-<N>.status` every 30s (worker WI id, current step from its `lane-tasks.json` slice, elapsed time). Orchestrator tails this file and prints consolidated lines:

```
[wave 1] WI-050 sync-spec-code ✔ (1:24)  WI-051 sync-spec-code ⏵ step 3/5  WI-053 write-e2e ⏵ scaffolding (3:02)
```

One line per 30s tick. On any worker failure, prints a BLOCK banner immediately.

### P3 — Track (not actionable yet)

#### F-06 — True fan-out visibility in a single Claude Code session

**Evidence:** Claude Code's TaskList UI shows one task per entry. With 4 parallel `claude -p` workers writing to `lane-tasks.json` at different rates, the UI in the orchestrator session will flicker or lag. This is a harness limitation, not a skill gap.

**Status:** track. If harness ships a native "wave" view, revisit.

## Comparison delta

- **gstack** has the Review Army (6 parallel specialists, `dispatching-parallel-agents` came from its blend) — parallelism for review only, not for execution. Does NOT solve the "dispatch N independent WIs" case.
- **superpowers** has `dispatching-parallel-agents` as a methodology skill — same scope, review/exploration not execution-across-worktrees.
- **GSD** has no parallel dispatch (`references/knowledge/gsd/CAPABILITIES.md`). No delta.
- **Agent SDK / `claude -p`** provides the transport but no framework currently uses it as a first-class subagent channel. svc's DOCTRINE acknowledges it as the Programmatic orchestration mode only.

**Net:** the P0 gap is original to svc to close. No external framework has "dispatch these N WIs in parallel with conflict-aware waves". Closing it would be a distinguishing capability.

## Stale proposal audit

- `proposals/done/2026-04-14-framework-improvement-test-journeys-completeness.md` — shipped. Does not cover parallel dispatch.
- `proposals/done/2026-04-14-framework-improvement-commit-push-gates.md` — shipped. Does not cover parallel dispatch.
- No stale proposals in this area.

## Suggested next step — staged implementation

The proposal grew past a single atomic change. Split into two tiers so the happy path ships fast and hardening follows:

**Tier 1 (ship first — enables the stated "4 in parallel" capability with correctness):**
- F-01 `dispatch-waves` skill
- F-02 transport decision doc + `scripts/dispatch-worker.sh`
- F-03 WI frontmatter `affects_files:`
- F-04 merge-back protocol
- F-0x Task-graph boilerplate subagent-awareness
- F-07 shared-config allowlist (the layer-1 half — skip import-graph for tier 1)
- F-08 hook adaptations H-1 + H-2 (non-negotiable — tier 1 correctness depends on it)
- F-09 landing = one PR per WI (locked decision, zero new code)
- F-10 concurrency cap + Base44 stream assignment
- F-11 failure table (documentation + dispatcher exit-code handling)

**Tier 2 (hardening — ship after tier 1 runs clean on WI-049..053):**
- F-07 layer-2 import-graph reachability
- F-05 worker model routing (defaults-only is fine for tier 1; WI-level override comes later)
- F-12 unified wave-progress stream
- F-06 host harness wave UI — track only

**Replay target (tier 1):** dispatch WI-049..053 through the new skill. Wave 1 (WI-050+051+053) runs concurrently via 3× `claude -p`. Wave 2 (WI-049 + WI-052 piggyback) runs serially after. Wave time < 1.5× longest single-WI time. All 5 WIs land as 5 PRs. Orchestrator's working tree clean at end. FRAMEWORK-STATE.md Known Gaps entry #242 ("Wave-based parallel execution") moves to Analysis History.
