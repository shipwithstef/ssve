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
node scripts/orch/dispatch.mjs steer cp1 'Owner follow-up in the same session'
node scripts/orch/dispatch.mjs steer cp1 'Apply this immediately' --now
node scripts/orch/dispatch.mjs stop cp1
node scripts/orch/collect.mjs
node scripts/orch/collect.mjs --watch 60 --stalled-minutes 5
node scripts/orch/serve.mjs --bind 127.0.0.1 --port 8787
node --test scripts/orch/*.test.mjs
```

## HO1-B sessions and Monitor wakes (v1)

`sessions.mjs launch` is a persistent, zero-model supervisor. It reserves the
role/session kernel leases, checks current parent/goal authority and a positive
Claude turn cap, persists a nonce before spawning, then launches exactly:
`claude --bg --effort low --name orch-<role>-<goal> --session-id <full-id> <brief>`.
The cwd is the registry's canonical planning Git root and the prompt references
an absolute immutable contract and the LOW parent/child brief. Only parent
callers may launch roles; children and workers cannot create orchestrators.
The supervisor retains its leases until stopped, writing file heartbeats every
15 seconds. Heartbeats are observations, never Claude prompts or model progress.

Live transport is disabled unless the owner explicitly supplies
`--live-verified true` after transport smoke evidence. That assertion is a trusted
same-account protocol input, not proof supplied by this card. A fake subprocess,
schema or help output does not verify Pro authentication, native restart
ownership, effective LOW after resume, attach/detach or inbox delivery. Paid/API
fallback remains disabled. No real Claude processes were used for HO1-B tests.

Bind the parent first using the sole authority writer:
`node scripts/orch/goals.mjs bind-parent --id <planning-goal> --parent-session <full-UUID> --expected-revision <N>`.
It creates `contracts/parent-v<generation>.json` and records the parent planning
goal. Bind a child through HO1-A's quiescent `set-state --child-session <full-UUID>
--child-principal <stable-principal>` transaction, which creates its next contract.
Use a new UUID for a new transcript; never copy a live/stopped transcript ID into
another role. The `--session-id` combination with native `--bg` is still a live
gate; a refusal is held rather than retried with a different transport.

All session commands use the same exact binding options:

```text
--role parent|child --goal <id> --generation <N> --principal <bound-principal>
--session-id <full-id> --worktree <canonical-planning-root>
--contract <absolute-versioned-contract>
```

`node scripts/orch/sessions.mjs verify-live --dry-run <binding-options>` reads
authority only and prints shell-quoted cwd, exact background launch and bare
`claude --resume <full-id>` commands for the owner to execute once. This standalone
smoke asks Claude to report actual identity/cwd/model/effort and idle; it grants
no dispatch and creates no supervisor receipt. Reconcile/stop that smoke before
allocating a fresh ID for supervised operation. `verify-live` without `--dry-run`
refuses. Native Remote Control/inbox checks remain separate owner evidence.

For a supervised launch, keep `sessions.mjs launch <binding-options>
--live-verified true` running in a persistent user process/terminal. The initial
Claude turn must inspect its actual native session ID, model/effort and process
identity (not the PID of its helper shell) and write a private observation JSON:

```json
{"role":"child","goal_id":"example","generation":2,"session_id":"full-id","launch_nonce":"reserved-nonce","contract":"/absolute/contract.json","worktree":"/absolute/planning-root","effort":"low","model":"actual-effective-model","pid":1234,"boot_id":"actual-boot-id","start_ticks":"actual-proc-start-ticks"}
```

The supervisor passes `ORCH_LAUNCH_NONCE`, `ORCH_ACK_FILE`, `ORCH_CONTRACT` and
binding fields in the native launch environment. The session runs
`node <absolute-repo>/scripts/orch/sessions.mjs acknowledge --file "$ORCH_ACK_FILE"
--observation <absolute-observation.json>` once. The observation must match exact
nonce/ID/generation/contract/cwd and a live native executable/PID/start-ticks/boot.
Acknowledgement is an explicit file handshake, not an assumed Claude stdout
format or installed plugin. Failure/refused trust/lost ack retains `needs_owner`;
timeout never clears intent or allows a replacement launch. Dispatch by a bound
child additionally requires this live observation and known count usage.
If the acknowledgement arrives after supervisor loss, `sessions.mjs reconcile
<binding-options> --nonce <held-nonce> --live-verified true` reattaches observation
under the same lease after proving the prior supervisor dead and validating the
original live acknowledgement. It never executes another Claude launch. Unknown
native ownership or mismatching acknowledgement remains held.

After readiness, add `--nonce <recorded-launch-nonce>` to binding options.
`sessions.mjs attach --dry-run <binding-options>` previews cwd and bare resume;
`attach <binding-options>` executes it with inherited interactive stdio and a
single attach lease. It refuses stale IDs/generations/nonces, dead identities and
stopped transcripts. No pipes, `-p` or configuration flags accompany live attach.
`sessions.mjs observe <binding-options> --turns <cumulative-session-count>` writes
a private count checkpoint request; only the supervisor updates its session
record. Replays count once; regressing/malformed counts hold admission. Usage
stays unknown until actual observation, including at launch.

Children wake by using native **Monitor** to run
`node <absolute-repo>/scripts/orch/events.mjs watch <binding-options> --minutes 5`.
Watch the state directory so collector atomic renames of `status.json` are seen.
The bridge emits short JSON only for that goal's actionable authority/task changes,
debounces a burst, and persists one queued event ID. Parent watches project-wide
authority/conflicts, not routine worker progress. Heartbeat timestamps, elapsed
time, raw stream progress and another child's task changes produce no wake.
Reconcile files/BOARD first, then run `events.mjs ack <binding-options> --event <id>`.
Busy changes remain in status and emit one follow-up after ack. Reconnect/reload
or overflow rescans once; duplicate IDs do not repeat effects. A restart replays
an unhandled ID, so goal/card/attempt side effects must remain idempotent.

Monitor waits are 5 minutes by default and at most 30 minutes. Expiry stops the
bridge with a durable attention blocker, never renews it or invokes Claude.
Monitor is not restored on resume: recreate it once for pending/actionable work.
No plugin consumes events while Monitor is absent; v1 does not claim unattended
long-idle wakes. Heartbeat changes alone must not prompt a session to renew it.
Watcher errors/unreadable status retain the last cursor and attention; unreadable
registry or lost native identity holds dispatch admission. Restore the watcher
after repair, with one rescan rather than timer retries. An exclusive Monitor
lease rejects simultaneous watchers for one role. Event pending
state is in `events/<role-id>.json` and mirrored in supervisor `wake_cursor`;
collector/web/local presentation of that blocker belongs to HO1-C.

`events.mjs receiveMessage` is the bounded reconciliation/dedup helper for native
inbox hints, not a new message transport. Its <=1 KiB/10-line envelope checks exact
direction, sender binding, goal generation and committed registry revision. The
caller must prove the durable BOARD/decision reference before marking queued ->
handled; reconcile idempotently after a crash. Stale/foreign/duplicate hints are
ignored. Refused inboxes and expired <=12-hour one-shot idle notifications persist
attention, with no automatic retry or notification renewal. No hint grants consent.

Stopping the supervisor leaves `needs_owner`, preserves IDs and never kills or
restarts an ambiguous native transcript. Before handoff, reconcile native
background-supervisor ownership and prove the old identities dead; then run
`sessions.mjs release <binding-options> --native-stopped true`. This owner assertion
is required even with stale/dead PIDs. Child rebinding requires a released session
and drained, quiescent goal; parent rebinding also requires released children and
invalidates their bindings for explicit regrant. A new generation archives old
event receipts. No lock file is unlinked, no stopped transcript is auto-resumed,
and SR1 remains the sole worker recovery loop. HO1-C adds recovery owner commands.

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
Manual resume requires a stopped task. Steer uses its recorded transport; `--now` verifies and stops the owned supervisor before exact-session resume. Stop preserves files and worktrees.
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
copies `dispatch.mjs steer`, which selects live delivery or queued continuation. Shell single quotes
preserve quotes, newlines, dollar signs and backticks. Commands include the state
root; the owner runs them. No command execution, model calls, prompt submission,
context append or filesystem writes occur in the pane. Adopted tasks have no
control buttons; stale snapshots and changed attempts refuse control copying.
The dispatcher rechecks ownership and the recorded exact session when commands run.

Custom drawing is **local terminal only**. Desktop, VS Code and Remote Control
web/mobile receive no pane drawing; use the CP1 read-only web view remotely.
Tests exercise host UI contracts, not actual terminal paint. No Q&A, watcher,
instant terminal-event refresh, pane-executed stop/steer or acceptance receipt support in
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
Shutdown attempts become `interrupting` on local Preempt/Terminate notices and
`interrupted` on supervisor SIGTERM, including launcher exit code 1. Metadata
updates preserve the attempt's interruption marker under a short record lock.
Prior-boot failures with termination signals, missing clean exit, or an exit in
the journal/checkpoint shutdown window (30 seconds before through 120 seconds
after the notice) reconcile as interrupted. Ordinary failures, owner-requested
stops, timeouts and `needs_owner` holds remain terminal. Same-boot records are
never automatically relaunched. Busy locks
preserve the task and are reported as held. Manual resume remains an owner action.

`recovery-<boot-id>.json` records decisions and the exact `claude --resume <id>`
command from `parent-session`. Native parent recovery requests
`claude --bg --resume <exact-id> --effort low` once per boot after worker recovery;
the configured ID must match a bound registry parent, whose generation is preserved.
A legacy bound parent needs no sessions.mjs launch nonce for this native request.
Native owner discovery and shared leases exclude duplicate writers; ambiguous
launches consume the boot reservation. `no-claude-autoresume` opts out.
The collector exposes
this summary and recovery holds in `status.json`, and the web view displays them.
The preemption watcher polls IMDS every five seconds, matches the local VM's
Preempt/Terminate events, fsyncs deduplicated checkpoint markers and marks running
attempts interrupting before sending
SIGUSR1 to the verified collector. The collector holds its singleton lock throughout
watch mode and publishes immediately on the signal. `preempt-health.json` records
poll failures; no event approval is sent. [Azure Scheduled Events](https://learn.microsoft.com/en-us/azure/virtual-machines/linux/scheduled-events)
notice delivery is best effort; this is a bounded checkpoint opportunity.

SR1 restores guest processes **after Azure starts the VM**. It cannot restart a
deallocated guest or fence a replacement VM; external capacity recovery, off-VM
backup and cross-VM leases remain separate work. Tests use fake sessions/dispatch
and a local fake worker in real user scopes; actual eviction and paid CLI resume
are not exercised.

## HO1-A registry authority and count budgets

`goals.mjs` is the sole `goals.json` writer. Desired policy is separate from the
collector's observed `status.json`. Every mutation requires `--expected-revision`
(the absent registry starts at 0), uses the stable `locks/goals.lock` kernel lock,
and fsyncs a 0600 temporary file, renames atomically, then fsyncs its directory.
Concurrent/stale transactions fail; reread before deciding whether to retry.
Never edit the registry or remove lock files manually. The parent principal is
`ORCH_PRINCIPAL` (initially `owner`); `ORCH_ROLE=child` or `ORCH_DEPTH>0` refuses
registry writes. These are trusted local protocol assertions, not a sandbox for
hostile processes with the same Unix account. Native session fencing and actual
worker filesystem containment remain separate live release gates.

```bash
node scripts/orch/goals.mjs list
node scripts/orch/goals.mjs create --id example --title Example --objective Ship \
  --plan /existing/linked/planning-worktree/PLAN.md --priority 10 \
  --claude-turn-cap 12 --codex-runs 4 --cursor-runs 2 --agy-runs 1 \
  --expected-revision 0
node scripts/orch/goals.mjs grant-worktree --id example --lane build \
  --worktree /existing/worker-worktree --paths '["src","tests"]' --expected-revision 1
node scripts/orch/goals.mjs set-priority --id example --priority 1 --expected-revision 2
node scripts/orch/goals.mjs set-state --id example --state active --expected-revision 3
```

Create resolves the existing plan's Git root into `planning_worktree`; no new
planning checkout is created. Worker slots require explicit canonical Git roots;
`worktree_roots` is an allocation restriction, not a wildcard grant. Planning and
worker slots cannot overlap across goals, include nested roots, or reuse aliases.
Path grants refuse reserved/escaping paths and observed escaping symlinks. Existing
whole-worktree task/session locks remain the final writer exclusion; path grants
do not replace those locks or provide filesystem containment for bypass-mode CLIs.

Dispatch start/resume requires an active registered goal and an exact worktree/lane
grant. A short registry lock covers policy validation, count cap validation and the
durable queued task reservation before spawn. Each attempted launch consumes a run,
including interrupted/failed launches and resumes. Closing/paused/blocked goals deny
new admission while admitted workers retain their original hard limits.
Stop remains available without goal admission. Dispatcher never writes goals.json.

`set-state` may also configure `--claude-turn-cap`, `--codex-runs`, `--cursor-runs`,
`--agy-runs`; null caps are unknown and zero explicitly denies new runs. Binding a
child uses `--child-session <exact-id> --child-principal <stable-id>` while the goal
is registered/paused/blocked and workers are drained. This increments generation
and emits immutable `contracts/<goal>-v<generation>.json` before the registry commit.
A child dispatch adds `--goal-generation N --child-session ID --child-principal ID
--child-depth 1`; stale/foreign/deeper bindings fail, and missing Claude turn
allowance/observations hold admission. Child contracts allow only the existing
plan/board, LOW, depth 1 and no orchestration delegation. Launch/attach are HO1-B.

V1 accounting is **counts only**. The collector projects Claude turn counts from
`sessions/*.events.jsonl`: `{type:"turn.completed",goal_id,session_id,turn_id,usage}`.
Stable session+turn IDs deduplicate replay/resume. Supervisor `sessions/*.json`
`usage.turns` is a cumulative count checkpoint; repeated checkpoints use the maximum
per session, reconciled with that session's event count rather than added to it.
Event streams must retain the full turn history or a complete count checkpoint;
there is no token journal. No observations means unknown, not zero.
Per CLI, goal usage reports distinct task+attempt counts, approximate elapsed wall
clock time, and each attempt's latest known usage snapshot. Reported provider token
fields remain snapshots; they are never summed as fresh charges. Paid admission
is disabled. Cumulative token journals and quota-share estimates are future work;
the earlier design's token/quota requirements do not apply to counts-v1. A dated
owner subscription percentage is not a live quota or an admission allowance.

The collector includes empty/paused/closed registry goals sorted by priority,
`registry_revision`, `changed_goal_ids`, child/budget/usage/blockers, and the existing
`tasks[]` / `goals[].lanes[].tasks[]` shape. Orphan tasks remain visible with a goal
ownership blocker. Corrupt authority preserves the last valid snapshot and denies
admission. Public projection omits raw contracts, principals, prompts and argv;
acceptance never follows from worker exit. Goal headers/live observations are HO1-C.

The initial Novisenti and Orchestrator OS goals reuse the owner-specified plans.
They start registered with unknown caps and no worker grants; registration alone
does not allocate spending or launch sessions. `seed-goals.mjs` calls only the
canonical writer and refuses to overwrite mismatching existing seeds. It may be
rerun to reconcile a partial seed; it never writes goals.json directly.

```bash
node scripts/orch/seed-goals.mjs
node --test scripts/orch/*.test.mjs
```

## HO1-C recovery and owner goal groups

See [RUNBOOK.md](RUNBOOK.md) for a portable Azure Spot/user-unit/Tailscale setup and
parent-first owner recovery. SR1 checks active goal generation, child contract,
exact worktree/lane grants and remaining known count budgets before reserving a
worker continuation; dispatcher rechecks them under the same admission lock.
Only a validated SR1 reservation may recover a child's worker without its live
Claude supervisor. Ordinary child dispatch retains the live acknowledgement gate.
Missing/stale grants and corrupt accounting hold `needs_owner`; no paid replay.

Recovery receipts add `orchestrators[]` with exact binding commands and
`auto_start:false`. The collector projects current-generation commands into
`status.orchestrators[]`; a mismatched legacy parent-session holds parent commands.
Both web and `/orch` show priority/state, child health/session/LOW, count budgets,
unknowns, needs_owner and pending Monitor blockers, including empty goals.
Active worker reservations are already included in attempt counts; Claude turn
reservation remains unknown in counts-v1. Heartbeat timestamps do not create
routine goal-change wakes. Clipboard actions refuse stale/revised bindings.

Owner-only `sessions.mjs resume <exact-binding-options> --native-stopped true
--live-verified true` restores an existing stopped transcript through a new launch
nonce and fresh LOW acknowledgement, contract/binding environment and local pane
plugin. These flags assert owner verification, never automatic recovery consent.
Live attach still executes bare `claude --resume <id>`. Neither command changes
goals.json. No native restart/LOW/terminal/Remote Control live gate is cleared by
mock tests. After resume explicitly restore Monitor for actionable work; there is
no event plugin or unattended wake after expiry in HO1 v1.

## ST1 worker steering

`dispatch.mjs steer <id> "<message>" [--now]` stores exact text in the task's
private FIFO-ordered `steer_queue` (100 messages, 8192 bytes each). The supervisor
is the sole transport writer; its heartbeat merges externally queued entries
under the task record lock. Status/web/pane expose redacted `queued_steers`,
`steering.mode`, delivery receipt metadata and `steering_hold` blockers. The pane
copies a steer command for the owner to run; it performs no dispatch itself.

| Worker CLI | Recorded mode | Delivery |
| --- | --- | --- |
| agy | `stdin` | `-p --input-format stream-json --output-format stream-json`, private attempt FIFO kept open by supervisor |
| Claude | `stdin` | Same flags, plus `--verbose`; exact `--resume` on later attempts |
| Codex | `queue` | Exact `codex exec resume` after exit; app-server help availability recorded |
| Cursor | `queue` | Exact `cursor-agent --resume` after exit |

Stream messages are one NDJSON user envelope per steer:
`{"type":"user","session_id":"<observed-id>","message":{"role":"user","content":"<literal-text>"},"parent_tool_use_id":null}`.
The initial prompt also enters stdin; the FIFO remains open across turn results.
Live steering retains PID/session/attempt and rechecks current goal grants under
the admission lock. Claude workers require an explicit `--claude-runs` allowance
on goal create/set-state, separate from orchestrator Claude turn accounting.
Legacy registries remain readable; missing Claude worker allowance denies launch.

Queued fallback automatically continues only after verified scope teardown and a
`done`/`failed` exit. All queued messages concatenate with two newlines and resume
the exact session under retained task/worktree and session leases. Every new
attempt rechecks goal generation, live child authority and remaining run grants.
Steer auto-resumes and boot recovery share the lifetime `auto_resume_count` and
maximum two; `--max-auto-resume 0|1|2` can lower it. Owner stop, timeout and
interruption never trigger this exit continuation. A held queue remains visible.
When idle, steer resumes with pending text; `--now` pauses live delivery, verifies
supervisor cmdline/PID, stops the scope, then manually resumes all pending text.

Delivery IDs are consumed and fsynced before stdin write or resume spawn. A crash
in that window leaves a `claimed` receipt: delivery is **at most once**, potentially
unconfirmed, and never automatically replayed. `sent` means FIFO bytes submitted,
not worker acceptance. Reboot recovery combines still-pending messages with the
recorded recovery prompt, and excludes all already claimed IDs. A supervisor
crash after terminal exit can leave pending text for owner resume; no new daemon
or same-boot recovery loop is introduced. FIFO write errors retain a visible
unconfirmed-delivery blocker and receipt; they do not risk duplicate fallback.

On 2026-10-03, local `codex app-server --help` reported experimental daemon/proxy
and stdio/unix/ws transports; daemon/proxy help also succeeded. Help alone does
not prove that a `codex exec` worker's live thread/turn belongs to that daemon or
that an external follow-up can safely acquire its writer. This implementation
records the probe and uses the owner-authorized queue fallback; it neither starts
nor alters the live daemon/remote-control service. No live inference was used to
validate agy/Claude input envelopes; fake CLIs verify transport and ordering.

Validation: `node --test scripts/orch/*.test.mjs`,
`claude plugin validate mods/orchestrator-pane`, and
`claude plugin test mods/orchestrator-pane`.
