# HO1 — Parent and child orchestrators

Design: 2026-10-03. Scope: GOAL item 2, compatible with CP1/CP2 and SR1. Implementation: Sol 6.1 high; no runtime changes in this card.

## Evidence and decisions
- Local inputs: [goal, item 2](../GOAL-orchestrator-os.md), [Phase R corrections](../claude-corrections-phaseR.md), [runtime contract](README.md), and all current `scripts/orch/*.mjs`.
- The requested domain files are absent here. Read sibling `/home/dianast/worktrees/ssve-orchestrator-os/references/knowledge/domains/claude-code/CAPABILITIES.md` and `agent-orchestration/{CAPABILITIES,benchmarks,social-impressions}.md`; preserve this provenance, not an implied local copy.
- Claude evidence V2/V13/V15 documents background sessions, messaging and Monitor; help/schema evidence is not live execution. Hierarchy research supports explicit artifact contracts, disjoint writers and shallow delegation; its Managed Agents API limits are not Claude Code session limits.
- Current CP1: `dispatch.mjs` admits codex/cursor/agy, locks entire canonical worktrees and session IDs, records attempts and 15-second file heartbeats. `collect.mjs` alone writes atomic `status.json`; goals currently derive from tasks. Costs are unknown; usage keeps the latest event rather than a cumulative ledger.
- SR1 `recover.mjs` is absent here; read the sibling implementation. It reserves eligible previous-boot worker resumes, invokes dispatch, caps automatic resumes at two, holds paid/adopted/ambiguous tasks, and writes a parent resume command with `auto_start:false`. HO1 must extend that interface, not implement a second recovery loop.

## Architecture and ownership
`owner → parent Claude LOW → one child Claude LOW per active goal → dispatch.mjs → bounded workers`
Parent and children are independent same-machine sessions, not Claude subagents. Only the parent starts orchestrators; children cannot create grandchildren. Workers cannot delegate orchestration or bypass dispatch.
Use subscription authentication; keep extra usage/API billing disabled. Record 64% weekly used as the owner's dated observation, not a live entitlement. No Claude workers; use Codex Sol 6.1 high for implementation, Cursor Grok 4.7 high for bounded cross-family review, agy for research.

| Owner / sole writer | Responsibility / artifacts |
|---|---|
| Parent, through proposed `goals.mjs` | `goals.json`: objective, priority, budget, grants, desired lifecycle, child binding; arbitrate cross-goal conflicts and serialize shared integration. |
| Child session | Only its goal's canonical `PLAN.md` and `BOARD.md`; dependencies, bounded worker briefs, review and acceptance evidence. No edits to another goal or registry. |
| Proposed `sessions.mjs` supervisor | `sessions/<role-id>.json`: process/session observations, usage checkpoints, file heartbeats and wake acknowledgments; no policy changes. |
| Dispatcher supervisor | Existing `tasks/<id>.json`, attempt logs/events and worker leases; goal authorization added before start/resume. |
| Collector | Only `status.json` plus collector caches: authoritative observed projection for orchestration and both views. |
| SR1 recovery | Recovery receipts and exclusive stopped-task reconciliation; never concurrently writes a live supervisor's records or edits goal policy. |

`goals.json` is desired authority; `status.json` is observed truth. PLAN/BOARD supply goal intent and acceptance, not competing runtime status. Messages are hints; reconcile files before acting.
Keep one parent lease and one lease per child session, bound to principal, generation, boot ID and process start ticks. Writer helpers use stable kernel locks, compare expected revision/generation, then atomic fsync/rename; never unlink an occupied lock to recover.
Reserve a dedicated linked planning worktree per child and separate linked worker worktrees per lane/task. Parent allocates them; the child selects only pregranted slots. Existing whole-worktree dispatcher exclusion remains. Canonicalize roots and paths, reject overlapping/nested/aliased grants and linked files escaping ownership; serialize any later merge into shared paths.
Each worker gets a task-specific allowed-path subset excluding PLAN/BOARD and orchestration state. Dispatcher admission plus host containment must enforce grants; CP1's sandbox bypass and locks alone do not enforce path containment. Unverified containment holds mutation, not reads.

## File contracts
State root is `~/.local/state/orch` (`ORCH_STATE_DIR` override); directories 0700, files 0600, persistent disk. The following is an illustrative registry, not an allocation approved for live use:
```json
{
  "schema_version": 1, "revision": 1,
  "parent": {"session_id": null, "generation": 1, "effort": "low"},
  "quota": {"weekly_used_pct": 64, "source": "owner", "as_of": "2026-10-03", "reset_at": null,
    "reserve_pct_points": 10, "extra_usage": false},
  "goals": [{"id": "novisenti-m1", "title": "Novisenti M1", "objective": "M1 acceptance",
    "priority": 1, "desired_state": "registered", "generation": 1,
    "child": {"session_id": null, "launch_nonce": null, "effort": "low", "contract_ref": "contracts/novisenti-m1-v1.json"},
    "plan": "/absolute/planning-worktree/PLAN.md", "board": "/absolute/planning-worktree/BOARD.md",
    "grants": [{"lane": "M1", "worktree": "/absolute/worker-worktree", "paths": ["src/", "tests/"]}],
    "budget": {"claude_turn_cap": 12, "claude_token_proxy_cap": 100000,
      "worker_caps": {"codex": {"runs": 4}, "cursor": {"runs": 2}}, "paid_usd_cap": 0},
    "acceptance_refs": [], "last_decision_id": null}]
}
```
Only parent transactions change caps, priority, grants or bindings. Null means unknown/unconfigured; it never grants unlimited spending. IDs use dispatch's safe alphabet; task IDs are globally unique, prefixed by goal. Keep closed entries compact with artifact references; no logs embedded in the small registry.
Parent writes an immutable versioned child contract before launch; changes require a new generation and a quiescent ownership handoff:
```json
{"schema_version":1,"goal_id":"novisenti-m1","generation":1,"parent_session_id":"exact-id",
 "depth":1,"max_orchestrator_depth":1,"effort":"low","objective":"M1 acceptance",
 "planning_worktree":"/absolute/planning-worktree","plan":"PLAN.md","board":"BOARD.md",
 "allowed_writes":["PLAN.md","BOARD.md"],"grants_ref":"goals.json#novisenti-m1",
 "budget_ref":"goals.json#novisenti-m1/budget","dispatcher":"/absolute/repo/scripts/orch/dispatch.mjs",
 "acceptance_commands":["exact bounded command"],"report_max_lines":10,
 "on_budget_or_conflict":"checkpoint, stop admission, escalate","spawn_orchestrators":false}
```
Child directions/corrections and reports are each ≤10 lines: goal/card, result, evidence refs, blocker, next action, budget remaining. Read bounded completion reports/status deltas; raw logs go only to a dispatched diagnostic worker.
Supervisor observation schema: `{schema_version,role,goal_id,session_id,generation,launch_nonce,boot_id,pid,start_ticks,state,last_heartbeat_at,last_progress_at,usage,wake_cursor,blocker}`. Heartbeat ≠ model progress; an idle child is healthy.
Collector adds `registry_revision`, `changed_goal_ids`, and goal fields `{id,title,priority,desired_state,observed_state,child,budget,usage,blockers,lanes}` without breaking existing `tasks[]`/`goals[].lanes[].tasks[]`. Include registered goals with zero tasks; orphan task goals remain visible with an ownership blocker. Never infer acceptance from worker exit.
Never expose raw contracts, resume prompts, process argv or private authorization tokens on the web; project a sanitized allowlist.

## Start and attach: selected transport
Use full interactive background sessions: proposed launcher executes `claude --bg --effort low --name orch-child-<goal> "Read <absolute-contract>; reconcile files; execute authorized work."` in the assigned linked planning worktree. Parent uses the same mode. Include the event plugin at creation; capture effective model/effort and the full session ID from the launch/SessionStart handshake.
Local help confirms `--bg`, `--effort` and `--session-id`; do not assume their combined behavior. Persist launch nonce before spawn; a missing acknowledgement means reconcile that launch, never blindly launch again. No dispatch until session, contract and actual canonical worktree agree.
`--bg` creates an attachable interactive session and rejects `-p`; fresh `claude -p` is a headless worker transport, unsuitable here. Already-linked worktrees avoid background auto-isolation into an unexpected path. Trust must already exist; a scripted trust refusal becomes `needs_owner`. [Agent view, checked 2026-10-03](https://code.claude.com/docs/en/agent-view).
Owner attaches with bare `claude --resume <full-id>` on ≥2.1.285, or `claude attach <short-id>`; the former attaches to a live background session. Avoid pipes, redirected output and configuration flags on live attach. A stopped transcript resumes differently; never run two transcript writers under one ID or accept an unexpected copied ID. [Sessions, checked 2026-10-03](https://code.claude.com/docs/en/sessions).
Enable `/remote-control` on the live parent for owner chat after its required first-use confirmation. Remote Control requires the VM/session alive; it does not recover them or render `/orch`. Use the Tailscale read-only web panel remotely.
**UNVERIFIED release gates:** background launch/handshake under current Pro authentication; native supervisor restart versus HO1 fencing; live attach/detach; LOW retained after resume; same-machine inbox delivery; event-plugin wake; Remote Control. Schema/help evidence and mock tests cannot clear these gates.
Fallback if background service fails: one interactive Claude in a persistent PTY/tmux per role, LOW, with the same leases/contracts; attach that PTY, never simultaneously resume its live transcript. Record this distinct mode. If neither transport is verified, preserve `needs_owner` and exact recovery instructions.

## Event-driven operation and lifecycle
No orchestrator polling, `/loop`, heartbeat prompts, repeated ListAgents calls or “are you done?” messages. Heartbeats are zero-model supervisor file writes every 15 seconds; they never wake Claude. Existing CP display refresh is passive zero-model UI behavior, not orchestration.
Add a zero-model event bridge: watch directories for atomic renames and dispatcher event appends, debounce bursts, reconcile persisted revisions, and publish only actionable per-role changes. Watcher startup/reconnect/overflow performs one bounded rescan; deadlines use one-shot timers. CP1 `collect --watch 60` is not the HO1 wake mechanism.
Use Monitor on bridge stdout for bounded active waits (default 5 min, maximum 30 min); it is not restored on resume. Never spend a model turn solely to renew an idle Monitor. For longer waits the session plugin consumes bridge events and queues one short `$.prompt.submit` when action is due; this declared API path needs the live gate above.
If Monitor and plugin overlap, only one wake lease/cursor may consume an event. Persist event ID, generation, queued/handled state; coalesce while busy, acknowledge after reconciliation. Delivery can repeat after a crash; side effects are idempotent by goal/card/attempt. Plugin reload replays unhandled changes once. Broken delivery leaves `attention_pending` in both views, without a renewal loop.
1. **Create:** parent records objective/acceptance, explicit budget, priority and nonoverlapping planning/worker grants; preflights subscription/trust/containment and writes contract. Independent goals such as Novisenti need not wait for framework completion.
2. **Start:** reserve child generation/nonce, spawn once, bind exact session through the parent writer; observe `starting → idle/running`. Child reads its contract and current files; reject stale generations before any mutation.
3. **Work:** child updates PLAN/BOARD, reserves task budget via dispatcher, sends brief to Sol/Grok/agy, then idles. Completion wakes that child; batch ready cards into one turn. Re-run acceptance commands; cap review/correction at two rounds, then escalate a concrete unresolved finding.
4. **Escalate/steer:** only budget, priority, ownership conflicts, external decisions or goal acceptance wake the parent. Parent commits decision before messaging; child checks revision and records application in its BOARD. Parent never edits the child's PLAN.
5. **Pause/close:** parent disables admission first. Child checkpoints and drains workers, or stops them via dispatch on an explicit stop; supervisor confirms no surviving writers. `closing → closed` requires child acceptance refs, parent acceptance and released leases. Preserve artifacts/session IDs; no deletion. Blocked/paused goals retain grants until explicit handoff.

## Message protocol
Discover peer IDs once at binding/rebinding with ListAgents; SendMessage uses the same-machine inbox. Envelope: `{v:1,id,type,goal_id,generation,registry_revision,ref,summary}`; ≤1 KiB, no logs, plain-text JSON is sufficient.

| Type | Direction | Required durable counterpart |
|---|---|---|
| `DECISION_REQUIRED` | child → parent | BOARD blocker: evidence, bounded options, recommended action; includes budget/ownership/acceptance requests. |
| `DECISION` | parent → child | Committed registry revision plus immutable parent decision reference; covers start/steer/pause/close and grants. |
| `DECISION_FAILED` | child → parent | BOARD evidence that a decision cannot safely apply; no automatic retry loop. |

Routine progress, completion and liveness travel through files and bridge events. SendMessage never grants consent or changes authority itself; stale/duplicate/foreign messages are ignored after reconciliation. A queued message is not an applied decision.
`notify_when_idle:true` may accompany a decision that needs a single follow-up; its one-shot subscription expires after 12 h and is not a heartbeat or durable completion guarantee. On expiry, check persisted state once only if a decision remains unresolved; no repeated subscription on every idle. Hold/refuse delivery remains visible as a blocker. [Messaging, checked 2026-10-03](https://code.claude.com/docs/en/cross-session-messaging).

## Budget accounting
- Parent owns global admission and per-goal allocations. Proposed starting reserve: 10 weekly percentage points; 64% observed leaves at most 26 points available for all goals plus parent work, subject also to the five-hour window. This is a policy proposal, not a token conversion or measured remaining balance.
- Track Claude child turns and input/output/cache tokens by session+turn ID using `session.measure`/`$.session.usage()` where exposed. Attribute parent decision turns to their goal; multi-goal turns remain shared parent overhead unless an explicit split sums to one. Missing fields remain unknown with source/as-of/confidence.
- Persist per-turn records in supervisor-owned usage journals; collector deduplicates on stable provider IDs or transcript offset+identity. Convert cumulative counters into deltas per session/attempt, retaining epochs across reset/rotation. Never sum cumulative snapshots or charge a resumed transcript twice; count newly incurred cache reads.
- Per goal show `claude:{turns,token_proxy,estimated_quota_share,range,basis}` and `workers:{codex,cursor,agy:{attempts,tokens,subscription_units,known_charge}}`, plus shared overhead. Claude quota attribution is an estimate from observed account-window deltas and activity; overlapping/other-device activity remains unattributed. Model/API-equivalent dollars are explicitly estimates, never subscription charges.
- Preserve every worker attempt's usage; extend CP1 ingestion beyond “latest usage event.” Codex/Cursor subscription use stays in provider-native units or tokens, with unknown pool conversion shown as null. Do not claim unlimited capacity, zero consumption or aggregate unlike subscriptions into one currency.
- Reserve worst-case bounded turns/runs before admission, settle measured use afterward and retain headroom for in-flight work. Token/quota caps are estimates with possible in-flight overshoot; run/turn reservations are enforceable. At exhaustion or unknown required allowance, block new dispatch and wake parent once; existing workers follow their admitted hard limits.
- Actual rate-limit events pause affected Claude work until the documented reset; no retry storm or paid fallback. Parent alone reallocates unused reservations; owner authorization is required for new paid spending. Keep native auth secrets out of receipts.

## Recovery and failure handling
On boot, SR1 owns recovery ordering: acquire recovery lock, reconcile identities/leases/goal grants, collect state, resume eligible workers through dispatch exactly once per reserved attempt, and publish Claude resume instructions. Live/adopted/paid/ambiguous outcomes remain held under SR1 rules.
Extend SR1 receipt with `orchestrators:[{role,goal_id,session_id,generation,state:"needs_owner",resume_command,auto_start:false}]`; retain existing `parent` output and `~/.config/orch/parent-session` compatibility, checking it against the registry. A mismatch blocks parent rebinding. Recover never becomes a second goals writer.
Resume parent first, reconcile its registry, then children. Each command is paired with recorded cwd/plugin/config requirements; live attach uses bare resume, dead-session restart restores configuration and verifies LOW before admission. Recreate Monitor/event subscriptions and replay unhandled state; resume does not restore background monitors.
Children must read SR1 receipts and existing attempts before dispatch. Recovery authorization is a persisted parent grant that survives parent downtime, constrained by current goal state, generation, budget and paid flags; absent/stale grants hold worker resume. SR1 and interactive resume share the same dispatcher admission/locks.

| Failure | Required behavior |
|---|---|
| Parent dies; child survives | Child may finish already admitted bounded work; no new grant or reallocation. Parent replacement needs verified old-writer death and generation handoff; local kernel locks alone cannot fence a second VM. |
| Child disappears / idle heartbeat stale | Mark suspected loss; verify process identity and native background-supervisor restart ownership before restart. Staleness alone neither releases leases nor means failed work. |
| Launch succeeds but acknowledgement is lost | Match launch nonce/session/worktree; hold unknown launch. Never spawn a replacement based only on timeout. |
| Disk full, invalid schema, watcher overflow | Preserve last valid snapshot with stale/error banner; stop mutation admission if authority is unreadable. Reconcile once after repair, retaining pending events. |
| Quota exhausted, inbox refused, monitor expired | File-visible blocker; no heartbeat messages or repeated model wakes. Owner can use read-only panel while sessions cannot run. |
| Worktree/path conflict or generation mismatch | Deny start/resume; parent resolves priority and performs drain/regrant. No same-ID forks or silent path reassignment. |
| Eviction / ambiguous external side effect | Persist intent and receipts; do not replay paid/live steps. Single active VM with persistent state is required; dual-host operation needs external fencing. |

## Owner view and three-card build plan
Both web and local `/orch` render registry goals as top-level groups, ordered by parent priority, including empty/paused/closed goals. Header: goal state, child health/session, LOW effort, budget used/reserved/remaining, uncertainty and decision blocker; expand into existing lanes/tasks. Keep stale indicators and stable expansion keys. Web stays read-only over Tailscale; local attach/steer/stop commands are previews with current-generation checks and owner execution. Remote Control carries chat, not the custom pane.

| Card — Sol 6.1 high | Implementation boundary | Acceptance/tests |
|---|---|---|
| HO1-A: authority and accounting | `goals.mjs`, schemas/contracts, dispatcher goal admission, usage journals/collector projection. Preserve existing worker locks and CP schemas. | Two concurrent parent writes yield one revision; alias/nested-path conflicts denied; stale/foreign child and grandchild denied; cap reservations race safely; duplicate/cumulative/resumed usage counted once; unknown quota blocks admission; empty goals survive. Run `node --test scripts/orch/*.test.mjs`. |
| HO1-B: sessions and events (after A) | `sessions.mjs`, parent/child LOW briefs, event bridge/plugin, message deduplication and launch/attach fencing. | Fake Claude: nonce lost-ack, wrong ID/cwd, LOW mismatch, refused inbox, 12 h expiry, Monitor 30 min expiry, reload/overflow and duplicate wake. Simulate 24 h idle: zero LLM wakes from heartbeats or renewal, no polling; one actionable burst gives one turn. Validate/test plugin; bounded live smoke clears the listed UNVERIFIED transport gates before rollout. |
| HO1-C: SR1 and owner surfaces (after A/B) | Extend SR1 resume-command output and grant checks; web + `/orch` goal headers, budgets and blockers; recovery runbook. | Fake reboot twice: one worker resume, no automatic Claude launch, no paid replay; parent/child commands restore exact bindings; live native supervisor excludes duplicate restart. Fixtures cover two goals/empty goal, partial usage, stale data and read-only web. Run Node suite plus `claude plugin validate mods/orchestrator-pane` and `claude plugin test mods/orchestrator-pane`; terminal/Remote Control smoke is separate evidence. |

Done requires recorded acceptance commands and outputs, all mock tests passing, and live capabilities either proven or explicitly disabled with `needs_owner`. Claude checks terse receipts; no paid eval sweep or review swarm is required for HO1.
