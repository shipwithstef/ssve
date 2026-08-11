# Framework Improvement: Background-Task Hygiene + Dispatch Logging (closes F-010, new F-011)

**Status:** IMPLEMENTED (2026-04-20)

## Evidence
- **Source:** WI-088 autopilot session 2026-04-20 left 3 zombie `until [ -f ... ]` polling loops. User called them out: *"what about these, do we need /improve-framework, did execute-changeset work, how about token usage, are things OK?"* Then: *"/improve-framework fix these."*
- **Finding:**
  - F-011 (NEW): no canonical svc primitive for "spawn bg → wait for signal → reclaim" led to chained ad-hoc until-loops that zombie at session end
  - F-010 (DEFERRED from 2026-04-20 orchestrator-parsimony): no per-dispatch token/cost instrumentation. Framework cannot answer "how much did that cost" with evidence.
- **Severity:** high for F-011 (zombies leak across sessions, affect shared host), medium for F-010 (observability gap, undermines cognitive-routing claims).

## Diagnosis
- **Root causes:**
  - F-011: `run_in_background=true` + an inline polling loop becomes a zombie because the outer Bash tool call completes before the inner until-loop resolves. The loop has no timeout, no PID owner, no cleanup contract.
  - F-010: `dispatch-worker.sh` prints a nice dispatch header to stdout but does not structured-log. Token usage is printed by subprocesses (opencode, codex) but never captured or aggregated.
- **Category:** fragility (F-011) + missing capability (F-010)
- **Already in FRAMEWORK-STATE.md?** F-010 yes (deferred, now closed). F-011 no (new, now closed).

## Implementation
- **Route:** quick-fix + new scripts + reference doc
- **Files changed:**
  - `scripts/wait-for-output.sh` (new, 40 lines) — safe polling wrapper with mandatory timeout. Replaces every ad-hoc `until [ -f X ]` pattern.
  - `scripts/kill-stale-bg.sh` (new, 75 lines) — detects and kills the 3 zombie archetypes (until-loops on /tmp/claude-1000/, subagent subprocesses >10min, orphan dev servers with no tty). `--dry-run` flag for safe inspection.
  - `scripts/dispatch-log.sh` (new, 85 lines) — synchronous wrapper around dispatch-worker.sh. Captures start/end time, parses token counts per harness, appends JSON line to `.svc/dispatch-log.jsonl`.
  - `scripts/dispatch-report.sh` (new, 80 lines) — reads `.svc/dispatch-log.jsonl` and emits markdown summary: per-model dispatch count, failures, avg tokens, total tokens, total wall time, informational cost estimate.
  - `references/background-task-hygiene.md` (new) — canonical decision tree, rule set, anti-patterns, session-end checklist.
  - `FRAMEWORK-STATE.md` — Worker transport scripts count 4 → 8; Analysis History entry; locked decisions added.
- **Commits:** pending on next push.

## Replay Verification
- **Replay target 1 — wait-for-output happy path:** `( sleep 2; echo hello > /tmp/wfo-test.log ) &; wait-for-output.sh /tmp/wfo-test.log hello 10` → exit 0.
- **Result:** PASS. File appeared within 2s, pattern matched, exit 0.
- **Replay target 2 — wait-for-output timeout:** `wait-for-output.sh /tmp/wfo-nonexistent.log never 4` → exit 1 after 4s with stderr message.
- **Result:** PASS. Exit 1, stderr: `TIMEOUT: /tmp/wfo-nonexistent.log not ready after 4s`.
- **Replay target 3 — kill-stale-bg.sh on clean system:** `kill-stale-bg.sh --dry-run` → no kills, clean exit.
- **Result:** PASS. Output: `Dry-run complete. Run without --dry-run to kill.`
- **Replay target 4 — dispatch-report.sh on fixture:** 2-entry jsonl with opencode+mimo dispatches → correct markdown table with totals.
- **Result:** PASS. Report showed both entries, correct token counts, cost calculation (informational-only fell to $0.00 on a fixture that used bare model names instead of the "mimo/" prefix; real pipeline writes the prefix).

## FRAMEWORK-STATE.md Mutations
- **Analysis History:** new 2026-04-20 entry covering both F-011 and F-010 closure
- **Current State:** worker-transport script count updated 4 → 8
- **Known Gaps:** F-010 closed (previously listed as deferred)
- **Decisions (new, locked):**
  - `until [ -f X ]; do sleep Y; done` is banned — use `wait-for-output.sh` with explicit timeout
  - Every background dispatch must be reclaimable (PID-track / wait-for-output / dispatch-log / kill-stale-bg)
  - Leaving zombies is a framework violation
  - `scripts/dispatch-log.sh` is the preferred wrapper when token accounting matters
  - `.svc/dispatch-log.jsonl` is canonical per-dispatch accounting, append-only
  - Cost estimates in dispatch-report are informational, not billing-grade
- **Capabilities:** `references/knowledge/svc/CAPABILITIES.md` NOT edited this pass — this is plumbing + observability, not a capability surface change. Will revisit once first skill consumer wires dispatch-log into its flow.

## Deferred follow-ups
- **F-011-followup:** wire `dispatch-log.sh` into `fanout.sh` so parallel dispatches auto-log without orchestrator effort
- **F-010-followup:** add `kill-stale-bg.sh --dry-run` to a Stop hook for automatic session-end cleanup reports. Needs user opt-in.
- **Token parsing resilience:** opencode/codex stdout format is not semver-stable. Monitor for regressions; maybe switch to parsing `--format json` output instead of free-text grep.

## External sources consulted
None this pass — all changes are svc-internal. `kill-stale-bg.sh` cleanup patterns borrow loosely from `pgrep(1)` / `pkill(1)` conventions; no external code copied.

## Notes for orchestrators
- Before stopping a session: `bash scripts/kill-stale-bg.sh --dry-run`. If anything appears, adopt it (capture PID) or kill it (`kill-stale-bg.sh` without dry-run). Leaving zombies now counts as a framework violation.
- For high-value dispatches where cost matters: prefer `scripts/dispatch-log.sh` over raw `dispatch-worker.sh`. Auto-populates the accounting jsonl.
- Run `scripts/dispatch-report.sh --since <date>` periodically to sanity-check that cognitive routing is actually saving what the taxonomy claims.
