# Native Transport Re-Base — Research Spike (WI-367)

**Date:** 2026-06-07 · **Evidence class:** LIVE in-session observation (this orchestrator session used every cited primitive during WI-357..361) + docs-agent verification — never training data (rules/host-capability-research.md).

## Primitive ↔ svc-transport map

| Native primitive (live evidence) | svc current transport | Verdict |
|---|---|---|
| **Workflow tool** — pipeline()/parallel(), schema-forced StructuredOutput, resume (resumeFromRunId), budget, worktree isolation per agent (schema present in live tool list 2026-06-07) | `scripts/fanout.sh` + `dispatch-worker.sh` + `wait-for-output.sh` + extraction tier (`extract-summary.sh`/`haiku-extract.sh`) | **REPLACE for analysis fan-outs** — schema validation at the tool layer retires the extraction tier; resume/budget built-in. Follow-up WI-373. Bounded to read-only analysis per the sequential-delivery policy. |
| **Agent tool + native agent frontmatter** — `maxTurns`, `permissionMode`, `disallowedTools`, scoped `hooks:`, `skills:` preload, `memory:`, `background: true`, `isolation: worktree` (claude-code-guide agents dispatched 3× this session, incl. background) | `agents/*.md` invoked via `claude -p --bare` shell dispatch; closed-input-closed-tool policy enforced by README prose; **claude -p is AUTH-DEAD on this machine** (observed WI-357) | **MIGRATE (first slice)** — `agents/{plan-reviewer,strategic-reviewer,summary-extractor}.md` → `.claude/agents/`; `disallowedTools`+`permissionMode` mechanically enforce the locked-agent policy. Also unblocks the dead `claude -p` reviewer fallback path. Follow-up WI-372. |
| **Monitor** (event-stream watcher; schema loaded live this session) | `until ! pgrep…` bounded loops per rules/bash-hygiene.md prose; observed harness now BLOCKS chained sleeps outright | **ADOPT in skill guidance** — bash-hygiene already lazy (twin-covered); fold Monitor/run_in_background guidance into the twin docs at next touch. No standalone WI. |
| **Background tasks** — `run_in_background`, TaskOutput, task-notifications (used ~20× this session: suites, pushes, reviews) | foreground waits + manual log tails | **ALREADY ADOPTED operationally**; host-matrix row was WRONG (❌) — corrected this WI. |
| **CronCreate / ScheduleWakeup / PushNotification / RemoteTrigger** (present in live deferred-tool list) | refresh-competitors cadence prose; `svc-notification-surface` hook | DEFER — cadence work is not on the critical path; revisit at WI-369 telemetry. |
| **TaskCreate/TaskList/TaskUpdate/TaskGet** (live; TaskOutput exercised this session) | `task-graph.mjs` + host-mirror instructions in every chain skill | KEEP FILE-AUTHORITATIVE — native tasks are UI mirror only (cross-host + cross-session durability requirement stands). No change. |
| **Auto-memory dir** (`~/.claude/projects/<proj>/memory/` — used this session for project memory) | `manage-learnings` + learnings.jsonl + builder-profile (3 systems) | CONSOLIDATION STUDY only — defer; overlap is real but learnings.jsonl feeds validators/telemetry (WI-369 dependency). |
| **Plugin bundles** (skills+agents+hooks.json auto-wire, per-project enabledPlugins — docs-verified 2026-06-06) | `setup` symlinks + per-host wirers | Evaluate at WI-365 L2 as planned (svc-as-private-plugins). |

## Host-matrix corrections applied (live probes, this session)

1. Claude **Background tasks ❌ → ✅** (`run_in_background`, `/tasks`, TaskOutput, `background: true` agent frontmatter — all exercised live).
2. Claude task-graph row: TaskCreate/TaskGet also live (beyond TaskList/TaskUpdate).
3. **New row — plugin hook auto-wiring:** Claude ✅ (hooks.json auto-wired on plugin enable, docs-verified); others ❌/unknown.
4. Gemini: rejects `UserPromptSubmit`/`Stop` hook event names from project config (stderr observed in scratch/gemini-plan-review.txt) — parity-drift note added.
5. Async hooks row already corrected by WI-359 (`async`/`asyncRewake` shipped + adopted).

## Follow-up WIs filed

- **WI-372** — agents/*.md → native `.claude/agents/` migration (first slice; mechanical policy enforcement; revives the dead claude-reviewer fallback).
- **WI-373** — Workflow-tool transport for read-only analysis fan-outs (retire fanout.sh extraction tier for that class; sequential-delivery policy unchanged for mutating work).

## Anti-goals (re-affirmed from skill-catalog research)

No custom retrieval/deferral machinery; never remove skills from the manifest; native tasks never replace the file-authoritative task graph; no transport change for MUTATING work (worktree chain stays).
