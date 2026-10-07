# HO1-C — SR1 recovery and owner surfaces

- Branch: feature/ho1-orchestrator-hierarchy; local commit only, no push.
- Only scripts/orch/, mods/orchestrator-pane/ and docs/orch/ changed.
- SR1 validates active goal, exact generation/child contract, worktree/lane grant and known count caps before reserving worker recovery.
- Dispatcher rechecks grants under the admission lock; only validated changed-boot reservations bypass dead-child liveness.
- Ordinary child dispatch retains live acknowledgement fencing; paid/adopted/ambiguous/stale/unknown outcomes stay held.
- Recovery publishes parent-first orchestrators[] with exact cwd, contract, session, generation, plugin and owner commands; auto_start:false.
- Legacy parent-session remains compatible; mismatch/invalid ID blocks parent commands, never rebinds goals.
- Live attach stays bare interactive resume; owner-only stopped resume restores exact transcript, LOW, known model, background mode and pane plugin.
- Stopped resume requires dead identities plus explicit native-stopped/live-verified assertions; fresh nonce/LOW acknowledgement fences admission.
- Same-transcript Monitor recovery preserves pending/handled event IDs across owner nonce rotation; no automatic Claude launch or idle renewal.
- Collector projects child/native health, stale/suspected loss, pending attention, needs_owner and budget blockers without heartbeat-only goal changes.
- Web and /orch show priority goal groups, empty goals, state/session/LOW, used/reserved/remaining counts and explicit unknowns; expandable lanes/tasks retained.
- Web remains GET/HEAD only; pane only previews/copies commands, refusing stale/revised session bindings.
- Active worker reservations are included in attempts used; Claude turn reservations and quota/currency conversion remain unknown.
- Added generic RUNBOOK.md: persistent Azure Spot/Deallocate VM, prerequisites, user units/linger, Tailscale view, recovery, parent-first attach and hold diagnosis.

Validation:
- node --test scripts/orch/*.test.mjs: 75 passed, 0 failed, 0 skipped (14.76 s final pre-commit run).
- Repeated fake boot: one worker resume, zero automatic Claude launches, no paid replay; goal/session policy files unchanged.
- Fake Claude proves exact parent/child attach/resume bindings, LOW/model/plugin/cwd, duplicate-writer exclusion and pending-event replay.
- Shared fixture proves priority/empty groups, partial counts/unknowns, blockers, stale retention, read-only web and owner clipboard behavior.
- claude plugin validate mods/orchestrator-pane: PASS; claude plugin test mods/orchestrator-pane: 7 passed, 0 failed.
- Manifest linter, changed runtime node --check, git diff --check and file-persistence verification: PASS.
- Initial parallel run hit existing timing deadlines under load; final default parallel suite passed without relaxing runtime limits.

Limits:
- No real Claude sessions, paid evaluations, live goal changes, installation or service changes performed.
- Native Claude restart ownership/LOW, actual eviction, terminal paint and Remote Control live gates remain UNVERIFIED; owner recovery stays needs_owner.
- Local trusted-account fencing is not cross-VM fencing or worker filesystem containment; no off-VM backup/capacity restarter provided.
- HO1 v1 has no event plugin/unattended wake after Monitor expiry; restore explicitly for actionable work.
- Preserved all four pre-existing untracked docs outside docs/orch/.
