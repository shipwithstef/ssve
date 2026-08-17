# Framework improvement: autonomous restart-boundary continuation

**Status:** ACCEPTED → WI-552 (planning umbrella WI-548)
**Date:** 2026-08-17
**Source:** WI-542 post-land verification required a fresh Grok SessionStart; the framework turned the owner into a prompt/copy-paste transport
**Severity:** high
**Category:** missing capability
**Plan-changeset class:** hot-path (land → auto-drive → verify-promotion + authority handoff)
**Sibling, not duplicate:** `2026-08-17-framework-improvement-native-host-dispatch-policy.md` decides *which host/model/transport runs*. This proposal ensures the chosen transport continues one logical workflow across a mandatory process/session restart without owner mediation.

## Gap

The framework promises one governed workflow from intent through verified promotion, but it stops at a process boundary. When an acceptance criterion requires a genuinely new process/session (SessionStart hook, startup migration, post-install bootstrap, restart-only configuration), the active orchestrator tells the owner to:

1. start another host session,
2. paste a continuation prompt,
3. reattach or take over the WI,
4. ask it to consume the old session's state,
5. manually keep it from re-planning or reimplementing.

That is not autonomous orchestration. The owner is acting as message bus, scheduler, and claim-transfer mechanism.

One **logical orchestrator** must be able to run start-to-finish even when proof requires more than one **physical host session**. The framework must persist the continuation baton, launch the fresh verification session through the configured native transport, atomically transfer or delegate authority, consume the result, and continue closeout. No owner copy/paste.

Do not expand WI-542 to implement this. WI-542 is the replay fixture.

## Evidence

### WI-542 incident

- Land/setup completed at `a4d0efa3`.
- AC-542-7 correctly required a new Grok SessionStart after install.
- The implementation session could not prove its own post-install startup.
- The owner had to manually start session `01a00f37...` and paste instructions.
- That fresh session successfully produced the required runtime evidence, but it generated another prompt instead of performing closeout.
- Its first Stop was denied by an unrelated executable-bit defect, so it spent another turn diagnosing host state and mutated the default checkout.

The fresh-process requirement is valid. The manual lifecycle is the defect.

### Existing substrate that does not close the gap

| Existing capability | What it solves | Missing behavior |
|---|---|---|
| Durable authority v2 / WI-502 | Resume, handover, takeover and recovery between known principals | No orchestrator automatically creates the next principal/session and carries a continuation baton into it |
| `scripts/svc-auto-drive.mjs` | Post-merge verification trigger and minimal install/http/e2e receipt | Does not launch a fresh native host session; hardcodes install validation to Claude; may synthesize minimal proof instead of executing the real `verify-promotion` skill |
| `verify-promotion` | Defines post-merge runtime evidence and G7 closeout | Has no restart-boundary transport or automatic continuation protocol |
| `scripts/worktree.sh` | Knows `verify-promotion` is post-merge | Does not create/drive a closeout controller after land |
| Task graph | Persists pending `verify-promotion` | Does not advance itself when the current process must terminate/restart |
| Native-host dispatch proposal | Resolves host/model/station from owner config | Does not manage lifecycle, exactly-once launch, authority transfer, or result return |

## Diagnosis

- **Root cause:** The pipeline models a session as both orchestrator and transport. It has durable state and authority primitives, but no lifecycle controller for “launch a new physical session, then continue the same logical run.”
- **Category:** missing capability (autonomous continuation controller).
- **Already in FRAMEWORK-STATE.md?** no. Durable authority exists; automatic restart-boundary continuation does not.

## Required behavior

### One logical run

The owner invokes the workflow once. The framework may use multiple physical sessions, but the run retains one durable identity:

`run_id → WI → task graph → current stage → merge SHA → continuation generation`

The user sees one workflow and one final report, not a prompt to paste elsewhere.

### Restart-boundary declaration

Plans and verify-promotion targets may declare:

```json
{
  "requires_fresh_session": true,
  "host": "grok",
  "event": "SessionStart",
  "proof_query": "session_start healthcheck success",
  "not_before": "<deploy receipt timestamp>",
  "max_launches": 1
}
```

This is generic: `fresh_process`, `service_restart`, `host_session_start`, and `post_install_bootstrap` are supported boundary kinds. Skills do not improvise shell commands.

### Automatic continuation protocol

1. **Before land/deploy:** persist a hash-bound continuation baton with WI, task graph, next task, canonical merge target, required evidence query, configured dispatch role, and forbidden phases (`diagnose`, `plan`, `execute`).
2. **After merge/deploy:** `land-changeset` or auto-drive resolves `verify.restart` through the owner dispatch policy.
3. **Launch exactly once:** start a fresh native host session/process after `not_before`. A launch receipt records PID/session id/transport/start time/config digest.
4. **Authority:** use a read-only delegated verifier when possible. If closeout mutation is needed, create an isolated closeout worktree and atomically hand over/accept controller authority. Never mutate canonical `main`.
5. **Freshness proof:** reject logs from earlier sessions, reused session ids, or events before deploy. Bind evidence to the launched session id.
6. **Execute, do not compose:** the child loads `verify-promotion`, consumes the baton, runs only allowed phases, writes a structured result, and exits. It must not return “Prompt To Send.”
7. **Return:** parent/controller consumes the result, updates AC/WI/index/task graph, opens the closeout PR when needed, and emits one final report.
8. **Failure:** bounded retry only when policy allows. Otherwise return one actionable blocker. Never ask the user to copy/paste as the normal path.

## Safety and cost constraints

- No nested uncontrolled agents. Launch is owned by the top-level lifecycle controller.
- `max_launches` and timeout are required; default one launch for a startup proof.
- Fresh-session child receives scoped context plus the hash-bound baton, not the full conversation.
- No default-checkout mutation.
- No hand-edited claim files.
- New session cannot re-run completed phases unless the baton explicitly invalidates them.
- Every launch and authority transition is receipted.
- Host unavailable is resolved through the owner dispatch policy; it is not silently remapped to Claude.
- User involvement is a last-resort blocker only when the active host exposes no automatable fresh-session transport. Capability absence must be proven and recorded.

## Acceptance criteria

- **AC-01 — One owner invocation.** A WI with `requires_fresh_session` lands, launches fresh proof, verifies, closes state, and reports without another user message or prompt copy/paste.
- **AC-02 — Real freshness.** The proof session id differs from the implementation session and starts after the deploy receipt. A pre-deploy `updates.jsonl` line is rejected.
- **AC-03 — Exactly once.** Retry/reconcile does not spawn duplicate verification sessions after a valid launch/result receipt exists.
- **AC-04 — Baton scope.** The child is mechanically denied from `diagnose-bug`, `plan-changeset`, and `execute-changeset`; it may run only the declared verification/closeout tasks.
- **AC-05 — Authority continuity.** Read-only proof needs no mutating lease. Closeout mutation uses an isolated worktree and generation-bound handover/delegation; canonical main remains clean.
- **AC-06 — Native transport via policy.** The lifecycle controller asks the universal dispatch resolver for role `verify.restart`. Grok stays Grok when configured; no Claude fallback unless the effective owner policy selects it.
- **AC-07 — Structured result.** Child returns schema-valid evidence including session id, start timestamp, event status, artifacts, AC mapping and verdict. Free-text “looks good” or “prompt to send” fails.
- **AC-08 — Full closeout.** On PASS, AC checkboxes, WI/INDEX status, task graph 7–11, verification artifact and closeout PR are completed automatically.
- **AC-09 — Bounded failure.** Launch failure, no SessionStart event, timeout, stale log, authority conflict and Stop-hook denial each produce deterministic failure receipts and no infinite retry.
- **AC-10 — WI-542 replay.** Starting from merged `a4d0efa3` and its deploy receipt, the controller launches one fresh Grok session, consumes healthcheck success, verifies exactly one Grok-home registration, completes G7, and opens the closeout PR without an owner message between land and completion.
- **AC-11 — Negative replay.** An ordinary verification that does not require restart launches zero new sessions and pays no lifecycle overhead.
- **AC-12 — Persistence recovery.** If the parent process exits after launch, reconcile consumes the launch/result receipts and resumes the same logical run without spawning again or requiring owner claim surgery.

## Likely files

- `scripts/svc-auto-drive.mjs` — real skill execution + continuation lifecycle, no minimal synthetic substitute for restart-bound proofs
- new `scripts/resolve-continuation.mjs` / continuation baton schema
- `skills/land-changeset/SKILL.md`
- `skills/verify-promotion/SKILL.md`
- `skills/route-workflow/SKILL.md`
- durable authority/delegation consumer (reuse WI-502 APIs, do not duplicate)
- universal dispatch-policy role `verify.restart`
- host capability manifests: fresh-session launch support + exact invocation adapter
- tier-1 fixtures for AC-01..12

## Route

**Lane:** framework  
**Sequence:** `write-spec` → `design-tech` → `plan-changeset` → `review-plan` → `execute-changeset` → `review-gate` → `review-exec` → `audit-implementation` → `land-changeset` → `verify-promotion`

Not a quick fix: it changes cross-session authority, host process launch, and post-land automation.

## Rollback

Disable autonomous restart transport and fall back to a single explicit blocker after land. Preserve durable task state and evidence. Do not restore prompt-copy/paste as a successful completion path.

## FRAMEWORK-STATE.md mutations

Pending implementation. After land: record autonomous restart-boundary continuation; move “owner is transport between post-deploy sessions” from Known Gaps to Fixed.
