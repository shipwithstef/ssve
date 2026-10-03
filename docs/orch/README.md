# CP1: local worker runtime

Requires Node ≥20, Linux `/proc`, Git, util-linux `flock`, GNU `timeout`, and a
working user systemd manager. Node code uses only the standard library. Runtime
files are private under `~/.local/state/orch`; `ORCH_STATE_DIR` overrides that root.
Collection and serving make no LLM calls. Dispatch/resume explicitly run workers.

```bash
node scripts/orch/dispatch.mjs start --id cp1 --title 'Implement collector' \
  --goal orchestrator-os --lane control --cli codex --model gpt-6.1-sol \
  --effort high --worktree "$PWD" --prompt-file /absolute/card-prompt.md \
  --expected-minutes 180 --hard-timeout 10800 \
  --resume-text 'Continue the same card; reconcile files first.' --memory-cap 4G
node scripts/orch/dispatch.mjs resume cp1 'Exact owner continuation text'
node scripts/orch/dispatch.mjs stop cp1
node scripts/orch/collect.mjs
node scripts/orch/collect.mjs --watch 60 --stalled-minutes 5
node scripts/orch/serve.mjs --bind 127.0.0.1 --port 8787
node --test scripts/orch/*.test.mjs
```

`--task-id` aliases `--id`. Hard timeout is **seconds**, estimate is **minutes**;
resource caps accept positive bytes or K/M/G/T. A launch acknowledges registration
and supervisor startup; inspect collected status for subsequent CLI startup errors.
Codex uses the required VM sandbox/approval bypass. Cursor uses force/trust and
encodes Grok effort in its model ID (`grok-4.7` + high → `grok-4.7-high`). Supply an
exact effort-bearing model ID for other Cursor models; no generic effort flag is
invented. agy uses `--effort` and exact-ID `--conversation` on resume.

Every attempt runs in its own systemd scope with `MemoryMax`, `MemorySwapMax=0`,
and an external timeout. A detached Node supervisor persists queued state before
spawning, captures stream session IDs, records sequence-numbered lifecycle events,
and checkpoints liveness every 15 seconds. Stable kernel flock inodes serialize
task IDs, worktrees, and resumed session IDs; PID/boot/start-ticks/cmdline metadata
verifies process identity. Stop only signals a verified owned supervisor, which
terminates its scope/group and verifies scope shutdown before releasing its lease.
A live task must be stopped before resume; stop does not delete files or worktrees.
Unconfirmed teardown holds the lock for manual reconciliation. Launch refusals
preserve existing task records. Logs and prior attempt references survive resume.

```bash
node scripts/orch/collect.mjs --adopt p1b --pid 3179096 \
  --log /home/dianast/worktrees/orchestrator-os-runs/p1b.json \
  --worktree /home/dianast/worktrees/novisenti/p1b-20261003
```

Adoption observes the supplied existing (or already exited) PID and log without signalling, resuming,
changing the worktree, or imposing resource limits. It auto-detects CLI from the
stream prefix; optional `--cli`, `--goal`, `--lane`, `--title`, `--model`, `--effort`,
and `--expected-minutes` enrich its metadata. Start time comes from log birthtime
and is approximate; estimate/timeout remain unknown unless supplied. An adopted
live task prevents a competing dispatcher launch but owns no control lease.

The collector is the sole `status.json` writer, protected by a kernel lock. Atomic,
fsynced snapshots expose `goals[].lanes[].tasks[]` plus a flat `tasks[]` index,
revision/deltas, Git status/staged and unstaged diffstats/upstream counts, executor,
estimates/deadlines, last three deterministic summaries, blockers and completion
reports. Stream ingestion checkpoints byte offsets, reads ≤1 MiB incrementally per task/tick plus a ≤64 KiB recent tail during backlog,
retains partial lines, and resets on rotation/truncation. `stream.backlog_bytes`
shows remaining work; repeated invocations catch up. Reports under `.worker/`
are bounded to 16 KiB, labelled reported, and linked as artifacts. Upstream counts
and costs are null when unknown. Raw command lines/resume text are excluded from
web snapshots; event/report text strips common credentials/control characters.

CP1 states are running/done/failed/timeout/stalled. `done` means a recorded clean
exit awaiting verification, **not acceptance**. A disappeared PID without an exit
record displays failed + `unknown_exit` and `design_state: unknown`, even with a
successful stream result. Stalled means no log-size progress for the configured
minutes. A terminal stream while the PID is live still counts as running. Adopted
workers have no trustworthy exit code/deadline; an already exited PID is registered
with unknown process identity/exit, retaining its reported result and report file. Historical timed-out attempts are
retained when resumed. Elapsed reconstruction uses approximate wall-clock time.

The static web tree refreshes every 60 seconds, retains expansion, exposes hover
and keyboard-accessible detail, and flags collector staleness after 90 seconds.
It accepts only GET/HEAD for `/`, `/index.html`, `/status.json`; no controls, file
browser, remote requests or LLM calls. Set `--bind` to the owner's Tailscale address
for exposure; this script does not configure Tailscale or authentication.

Not implemented in CP1: PLAN parser/dependency admission, acceptance receipts,
Claude mod pane/controls/Q&A, billing attribution, Spot recovery/fencing, or automatic
restart/reconciliation of a dead supervisor. These are separate cards; unknown
fields are explicit. agy/Cursor live paid launch/resume remain unverified; their
stream parsing is proven against the recorded sanitized fixtures. The real systemd
integration test substitutes a local fake Codex executable, with no inference.
