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

States are running/done/failed/timeout/stalled plus `done (unverified exit)`
and `exited (unknown)`. A matching live PID (boot ID + start ticks) always projects
running/stalled, even after exec or a process-title change, a terminal stream, an
expired deadline, or conflicting terminal metadata. Control ownership retains its
stricter command-line check. A missing process with no durable exit code projects
`done (unverified exit)` when a completion report exists, otherwise `exited (unknown)`;
adopted unknown exits never imply failure. All done states await verification,
**not acceptance**. Reports and stream results retain their reported provenance.
Historical timed-out attempts survive resume; adopted workers have no trustworthy
exit code/deadline. Elapsed reconstruction uses approximate wall-clock time.

The static web tree refreshes every 60 seconds, retains expansion, exposes hover
and keyboard-accessible detail, and flags collector staleness after 90 seconds.
It accepts only GET/HEAD for `/`, `/index.html`, `/status.json`; no controls, file
browser, remote requests or LLM calls. Set `--bind` to the owner's Tailscale address
for exposure; this script does not configure Tailscale or authentication.

Not implemented in CP1: PLAN parser/dependency admission, acceptance receipts,
semantic Q&A and direct pane controls, billing attribution, or cross-VM fencing.
SR1 below adds same-VM boot recovery. Other fields remain explicit; unknown
fields are explicit. agy/Cursor live paid launch/resume remain unverified; their
stream parsing is proven against the recorded sanitized fixtures. The real systemd
integration test substitutes a local fake Codex executable, with no inference.

## CP2 local terminal mod

```bash
claude --plugin-dir "$PWD/mods/orchestrator-pane"
# In the local Claude terminal: /orch
claude plugin validate mods/orchestrator-pane
claude plugin test mods/orchestrator-pane
```

The mod reads `~/.local/state/orch/status.json` through `$.fs`, initially and every
60 seconds on `$.clock`; `ORCH_STATE_DIR` follows the collector override. Run the
collector independently with `--watch 60`. `/orch` opens goals → lanes → tasks;
keyed buttons expand descriptions, executor, elapsed/estimate, dependencies,
acceptance, last three events and blockers. AbovePrompt is one line (yields to
surveys); the status counter flags snapshots older than 90 seconds. A failed read
retains the last snapshot with a visible stale/error label. Task rows page at 100.
Expansion survives snapshot refreshes through host state. Reopen `/orch` after
clear/reload to refresh immediately and restart the timer if needed.

Details runs the Node stdlib `scripts/orch/tail.mjs` helper on the registered log
path only, with a 5-second limit, ≤64 KiB / 200 lines and credential/control-code
redaction. This avoids the mod filesystem API's 4 MiB whole-file read limit.
Stop copies the exact dispatch stop command. Steer previews exact owner text and
copies resume, prefixed by stop + `&&` when currently live. Shell single quotes
preserve quotes, newlines, dollar signs and backticks. Commands include the state
root; the owner runs them. No command execution, model calls, prompt submission,
context append or filesystem writes occur in the pane. Adopted tasks have no
control buttons; stale snapshots and changed attempts refuse control copying.
The dispatcher rechecks ownership and the recorded exact session when commands run.

Custom drawing is **local terminal only**. Desktop, VS Code and Remote Control
web/mobile receive no pane drawing; use the CP1 read-only web view remotely.
Tests exercise host UI contracts, not actual terminal paint. No Q&A, watcher,
instant terminal-event refresh, direct stop/steer or acceptance receipt support in
this card. The mod must be loaded from this checkout so sibling scripts resolve.

## SR1 Spot boot recovery

```bash
# If Linger=no, the owner must run this once; installer only prints it:
sudo loginctl enable-linger "$USER"
mkdir -p ~/.config/orch
printf 'ORCH_SERVE_BIND=100.126.92.3\nORCH_SERVE_PORT=8790\n' > ~/.config/orch/serve.env
printf '%s\n' '<exact-parent-Claude-session-id>' > ~/.config/orch/parent-session
bash scripts/orch/install-units.sh
node scripts/orch/recover.mjs
systemctl --user status orch-{recover,collect,serve,preempt}.service
```

The installer renders four user units using this checkout, Node executable and
current CLI PATH. It enables recovery for boot and starts collect/serve/preempt;
stop pre-existing manually launched collect/serve processes first. Linger starts
the user manager without login. Keep this checkout on the persistent OS disk.
The user manager's network target does not ensure Tailscale is ready: serve retries
every five seconds until its configured address is available.

Recovery requires a different recorded boot ID, then acquires the dispatcher's
task/worktree/session locks before marking the previous attempt interrupted and
reserving one continuation. Dispatch rechecks the reservation under its lifetime
locks and resumes the exact session with its recorded `resume_text`. A reservation
is durably consumed before launch: repeated invocations in the same boot cannot
launch it twice, including acknowledgement loss. Each task permits at most two
automatic attempts over its lifetime (`max_auto_resume` may lower that cap).
Paid/live cards (`paid: true`, also `card.paid: true`) become `needs_owner`; supply
`--paid true` when registering such a card. Adopted workers, absent boot/session
identity, invalid state and failed/ambiguous launches require owner reconciliation.
Terminal and same-boot records are never automatically relaunched. Busy locks
preserve the task and are reported as held. Manual resume remains an owner action.

`recovery-<boot-id>.json` records decisions and the exact `claude --resume <id>`
command from `parent-session`; Claude is never auto-started. The collector exposes
this summary and recovery holds in `status.json`, and the web view displays them.
The preemption watcher polls IMDS every five seconds, matches the local VM's
Preempt/Terminate events and fsyncs deduplicated checkpoint markers before sending
SIGUSR1 to the verified collector. The collector holds its singleton lock throughout
watch mode and publishes immediately on the signal. `preempt-health.json` records
poll failures; no event approval is sent. [Azure Scheduled Events](https://learn.microsoft.com/en-us/azure/virtual-machines/linux/scheduled-events)
notice delivery is best effort; this is a bounded checkpoint opportunity.

SR1 restores guest processes **after Azure starts the VM**. It cannot restart a
deallocated guest or fence a replacement VM; external capacity recovery, off-VM
backup and cross-VM leases remain separate work. Tests use fake sessions/dispatch
and a local fake worker in real user scopes; actual eviction and paid CLI resume
are not exercised.
