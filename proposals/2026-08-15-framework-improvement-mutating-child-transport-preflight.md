# Framework improvement: fail before unsupported mutating-child dispatch

**Status:** DRAFT
**Date:** 2026-08-15
**Source:** HoursHub `WI-BILLING-01` execution incident
**Candidate severity:** high
**Plan-changeset class:** hot-path / host-integration

## Evidence

- **Source:** `skills/execute-changeset/references/process-details.md:85-99`
  - **Finding:** The framework correctly requires a v2 controller lease, stable child identity, real filesystem containment, a persisted task-specific delegation, and an isolated inner worktree. It explicitly forbids same-branch concurrent mutation.
  - **Severity:** safety contract is correct.
- **Source:** `skills/execute-changeset/references/subagent-dispatch.md:16-20,56-61`
  - **Finding:** The sanctioned mutating transport is the durable delegation/containment path, with controller execution as the fallback when child mutation cannot be proven.
  - **Severity:** safety contract is correct.
- **Source:** `provision/hosts/codex.json:15-23`
  - **Finding:** Codex child mutation is declared supported only through a persisted dispatch child principal and the Landlock wrapper; this declaration does not authorize an arbitrary host-native agent launch.
  - **Severity:** high when a runtime transport is selected without checking these prerequisites.
- **Source:** `hooks/codex/svc-codex-pretool-dispatcher.mjs:33-38`
  - **Finding:** The dispatcher correctly rejects a mutation when the child has no exact binding/lease and returns `mutation requires a bound WI worktree`.
  - **Severity:** correct fail-closed behavior, but too late in the workflow.
- **Source:** HoursHub `WI-BILLING-01` live execution on 2026-08-15.
  - **Finding:** Two mutating workers were launched through the Codex native collaboration transport in the parent worktree. Both consumed a full turn, then every mutation was denied with the exact unbound-WI diagnostic; the controller had to perform the work serially. Measurement: 2/2 unsupported launches, 0 product files changed by those workers.
  - **Severity:** high execution latency and misleading orchestration state; no authority bypass occurred.

## Diagnosis

- **Root cause:** `execute-changeset` has the correct prose contract but lacks one executable, transport-aware pre-dispatch decision. An orchestrator can see generic `agents: true`, call a host-native agent tool that cannot carry the framework delegation identity/acceptance token/isolated worktree, and discover incompatibility only when the child tries its first write.
- **Category:** host-capability routing and execution orchestration; not a mutation-authority defect.
- **Already in FRAMEWORK-STATE.md?** partially. WI-502/WI-524 define the authority and containment model, and the live state says Codex child mutation is supported through the probed wrapper. The missing piece is pre-spawn transport selection and refusal for an unadapted native transport.
- **Do not change:** never relax `svc-codex-pretool-dispatcher.mjs`, share the controller lease with an arbitrary child, or permit same-worktree child writes.

## Proposed implementation

**Route:** normal pipeline. The eventual repair changes execution routing and host integration behavior, so it must run `diagnose-bug -> write-spec -> plan-changeset -> execute-changeset -> review-exec -> audit-implementation -> land-changeset -> verify-promotion`.

1. Add one executable child-transport resolver invoked before any mutating dispatch. Its only outcomes are:
   - `delegated-wrapper`: stable child principal, persisted capability, one-time acceptance token, contained inner worktree, and merge-back receipt are all available;
   - `controller`: any prerequisite is missing, so the controller executes the task directly;
   - `read-only-native`: native fan-out is allowed only for an explicitly read-only task.
2. Make `execute-changeset` and `dispatch-waves` consume that resolver before launching a worker. Generic host `agents: true` must never be treated as mutation capability.
3. Record the selected transport and reason in the execution receipt before launch so a child cannot be shown as an active implementor when it is guaranteed to be denied.
4. Treat Codex collaboration/native agent launch as read-only until current host documentation and a live capability probe prove that it can carry the trusted child principal, token, working directory, and containment launcher.
5. Preserve the current dispatcher denial as the second-line fail-closed guard.

Likely surfaces after host-capability research:

- `skills/execute-changeset/SKILL.md`
- `skills/execute-changeset/references/process-details.md`
- `skills/execute-changeset/references/subagent-dispatch.md`
- `skills/dispatch-waves/SKILL.md`
- a new pure resolver under `scripts/`
- `provision/hosts/codex.json` only if current documentation/runtime probes show the capability declaration needs transport-level refinement
- focused Tier-1 fixtures plus one disposable live Codex replay

## Acceptance criteria

- **AC-01:** A mutating task presented to a Codex native child transport without delegation identity, token, inner worktree, and containment is not launched; the resolver selects controller execution before any child turn is consumed.
- **AC-02:** A read-only native Codex reviewer/analyst remains launchable without mutation authority and cannot gain write authority from its parent session id.
- **AC-03:** A fully prepared delegated-wrapper task launches in its exact inner worktree, accepts one token once, writes only allowed paths, commits, validates, and merges sequentially through the existing WI-502 receipts.
- **AC-04:** Missing, forged, replayed, expired, wrong-generation, wrong-task, wrong-worktree, or wrong-path delegation evidence fails closed before launch and again at PreToolUse.
- **AC-05:** Generic `agents: true` or a model selection result cannot independently select a mutating transport.
- **AC-06:** Overlapping/unknown scopes, migrations, lockfiles, `.svc/**`, and root configuration select controller/serialized execution.
- **AC-07:** The exact HoursHub `WI-BILLING-01` topology replays with zero unsupported child launches: the two tasks either use valid inner worktrees or are executed by the controller.
- **AC-08:** Existing WI-502/WI-524 authority, takeover, operation-scope, outside-read, and containment negative fixtures remain byte-for-byte behaviorally green.

## Required host research before implementation

Per `rules/host-capability-research.md`, refresh the current Codex hook and agent-tool contracts before touching wiring. Prove whether the active native collaboration transport exposes a stable child identity and supports a trusted workdir/environment/capability handoff. If any one is absent, keep that transport read-only and use the existing contained worker path for mutation.

## Replay Verification

- **Replay target:** exact HoursHub `WI-BILLING-01` parent/controller plus two disjoint candidate tasks, first through unsupported native transport and then through the selected safe path.
- **Result:** PENDING — proposal only.
- **Required evidence:** pre-dispatch decision receipt, zero unsupported launches, child worktree/identity/token/path proof when delegated, controller fallback proof otherwise, and unchanged dispatcher denial for a deliberately forged child.

## FRAMEWORK-STATE.md Mutations

- **Analysis History:** add the HoursHub incident and distinguish correct late denial from missing early transport selection.
- **Known Gaps:** add until the normal pipeline lands.
- **Decisions:** lock `agents support != mutating transport support`; selection is per concrete transport, not per host label.
- **Capabilities:** refine Codex mutation support to name the contained wrapper transport explicitly; native collaboration stays read-only unless live-proven.

## Self-Verify

| # | Check | Result |
|---|---|---|
| 1 | Proposal file exists in an isolated clean framework worktree | PASS |
| 2 | Existing WI-502/WI-524 authority is reused rather than duplicated or weakened | PASS |
| 3 | Root cause is classified as pre-dispatch transport selection, not a false guard denial | PASS |
| 4 | Exact HoursHub failure topology and measurable outcome are captured | PASS |
| 5 | Implementation route includes mandatory host research and full hot-path pipeline | PASS |
