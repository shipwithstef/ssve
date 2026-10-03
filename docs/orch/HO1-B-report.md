# HO1-B — sessions and events

- Branch: feature/ho1-orchestrator-hierarchy; local commits only, no push.
- Merged SR1 a2272de as merge commit 6cfc367, retaining SR1 recovery and HO1-A authority.
- Merge validation and post-merge-commit Node suite: 42 passed, zero failures.
- Added sessions.mjs: parent/child LOW background supervisor in exact planning cwd.
- Absolute immutable contracts; pre-spawn nonce; full recorded ID; native file acknowledgement.
- Role/session leases bind principal, generation, boot, PID and start ticks; heartbeat is file-only.
- Wrong ID/cwd/nonce/effort/native executable or missing ack holds needs_owner; no blind relaunch.
- Reconcile reattaches observation to a late original acknowledgement without spawning Claude.
- Bare claude --resume <id> live attach uses inherited stdio and an exclusive attach lease.
- Added sole-writer parent binding, immutable parent contract and explicit release/handoff fencing.
- Bound-child dispatch requires an acknowledged live session and known count usage.
- Cumulative count observation requests remain supervisor-owned; duplicate counts are not added.
- Added terse parent/child LOW briefs: event-driven, dispatch-only, reports <=10 lines.
- Added events.mjs Monitor source: watches status.json atomic replacements, per-goal projection.
- Exclusive Monitor lease, burst debounce, persistent queued/handled cursor and replay dedup.
- Busy changes reconcile after ack; new generations archive previous event receipts.
- Message helper checks exact sender/direction/revision/generation and durable counterparts.
- Refused inbox and persisted 12-hour one-shot expiry hold attention without renewal/retry.
- Monitor defaults to 5 minutes, maximum 30; expiry/overflow preserve attention without polling.
- No event plugin in v1; README and design correction document explicit Monitor restoration.
- verify-live --dry-run prints exact shell-quoted owner launch/attach commands; writes/spawns nothing.

Validation:
- node --test scripts/orch/*.test.mjs: 62 passed, 0 failed, 0 skipped.
- Includes fake Claude bg/attach, lost ack, nonce/ID/cwd/LOW/PID mismatch and refused trust.
- Includes duplicate wakes/attach, replay/overflow, message expiry, handoff and dispatcher fencing.
- Simulated 5,760 idle heartbeat samples (24 h): zero extra Claude calls; actionable burst: one wake.
- node --check for new/changed runtime modules, JSON parse, git diff --check: PASS.
- bash scripts/verify-file-persistence.sh --from-git-status: PASS.

Limits:
- No real Claude sessions, paid evaluations, services, live goals or host configuration changed.
- Live Pro/bg/session-id/attach/LOW/native restart/inbox/Remote Control gates remain UNVERIFIED.
- Live launch defaults disabled; explicit owner transport evidence/assertion is required.
- No unattended wake after Monitor expiry; HO1-C owns recovery extensions and owner surfaces.
- Same-account assertions are protocol fencing, not hostile-process or dual-VM containment.
- Preserved four pre-existing untracked docs outside docs/orch; parent owns independent review.
