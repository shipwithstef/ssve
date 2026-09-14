# Background-Task Hygiene

When the orchestrator spawns background processes (`run_in_background=true`, `&` in bash, `nohup`, or persistent dev servers), it OWNS the cleanup. Stale zombies waste CPU, clutter ps output, leave file locks, and — worst — hide real runtime state from later tool results.

This document codifies the svc rules. Surfaced 2026-04-20 after a session left 3 zombie `until [ -f ... ]` polling loops tangled across multiple background Bash tool invocations.

## The rule

**Every background dispatch MUST be reclaimable by ONE of these means:**

1. **Explicit PID tracking + kill.** Capture `$!` immediately, kill at session end.
2. **Bounded wait via `scripts/wait-for-output.sh`.** Safe polling, explicit timeout, never-leaks.
3. **dispatch-log.sh wrapper.** Runs the subprocess synchronously with duration + token logging; no zombies possible.
4. **Periodic cleanup via `scripts/kill-stale-bg.sh`.** Safety net, not primary mechanism.

## Anti-patterns (ban these)

- `until [ -f /tmp/... ]; do sleep X; done &` — a polling loop put in the background with no timeout and no PID tracking. Spawned inside a Bash tool call, it becomes a zombie the moment the outer Bash completes.
- Launching multiple `run_in_background=true` Bash tool calls each containing a `sleep N && cat /tmp/<another-bg-task-file>` — chains of waiters-for-waiters, each a new zombie.
- Starting `npm run dev` with `nohup` but no shutdown hook — leaves the vite server running forever.
- Spawning `opencode run ...` in background without capturing PID and without a max-timeout.

## The decision tree

```
I want to run X asynchronously
│
├─ Will X finish in < 30s?
│  └─ YES → Run synchronously (Bash with timeout). No background. Done.
│
├─ Do I need the output BEFORE my next orchestrator turn?
│  └─ YES → Run synchronously (Bash with long timeout, up to 10m).
│           Don't spawn a background + polling waiter — they're equivalent
│           cost and the sync form self-cleans.
│
├─ Is X a long-running service (dev server, watch)?
│  └─ YES → Start with `run_in_background=true`, CAPTURE PID, record in
│           /tmp/<service>.pid, kill at session end or via kill-stale-bg.sh.
│
└─ Is X a long subprocess whose output I'll poll for?
   └─ Use scripts/dispatch-log.sh OR run synchronously with a 10m Bash
      timeout. DO NOT chain `until` loops. DO NOT spawn waiters.
```

## Wait-for-output contract

`scripts/wait-for-output.sh <file> [pattern] [timeout_s]` replaces every `until [ -f X ]; do sleep Y; done` pattern. Exit codes:

- `0` — file exists (and pattern matched if given)
- `1` — timeout before file/pattern appeared
- `2` — usage error

The timeout is MANDATORY (default 300s); there is no infinite wait.

## Cleanup — scripts/kill-stale-bg.sh

Run this at session end OR when the orchestrator notices stale zombies. Detects and kills:

- `until [ -f /tmp/claude-1000` polling loops (any depth)
- `opencode run` / `codex exec` / `gemini` subprocesses older than 10 minutes
- Orphan vite/next dev servers with no controlling tty, older than 10 minutes

Always safe — it only kills its own patterns. Never touches user shells or IDE processes.

## Orchestrator checklist at session end

Before stopping, run:

```bash
bash scripts/kill-stale-bg.sh --dry-run
```

If anything shows up, either adopt it (capture PID, expected lifetime) or kill it (`scripts/kill-stale-bg.sh` without `--dry-run`). Leaving zombies is a framework violation.

## Why this matters

During WI-088 (2026-04-20), 3 chained `until`-loops accumulated because the orchestrator used `run_in_background=true` to spawn polling waiters. Each waiter was itself a Bash subprocess that then needed waiting-on. They never cleaned up because the outer Bash calls completed before the inner loops resolved. Result: 3 zombies at session end, discovered only because the user saw them in the Claude Code UI.

This isn't a rare edge case — it's the predictable outcome of the "spawn-and-forget" pattern. The rule above makes it impossible.
