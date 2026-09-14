# Hook Coverage Spec — Claude Code Lifecycle Events

This document enumerates the Claude Code lifecycle hook events and svc's intended posture for each. Events with `Wired? = Yes` and posture `block` or `warn` MUST appear in `hooks/hooks.json`. The tier-1 validator `validate-hook-coverage.sh` enforces this contract.

**Postures:**
- **block** — exit non-zero on violation; agent must fix
- **warn** — print warning to stderr, never block
- **observe** — log only, no agent-visible output
- **skip** — documented but intentionally not wired

Source: Claude Code host docs (per `rules/host-capability-research.md`). Last reviewed: 2026-04-25.

## Event Coverage Table

| Event | svc posture | Wired? | Rationale |
|---|---|---|---|
| PreToolUse | block | Yes | Enforces workflow guards, bash bypass blocks, eval-gate, skill artifact authenticity |
| PostToolUse | warn | Yes | Lane-tasks validator, edit accumulator, vibe auditor, eval-gate post |
| Stop | block | Yes | svc-stop-quality + task-completion-guard |
| StopFailure | observe | No | Documented but not yet wired in svc; future log of stop hook failures |
| SessionStart | warn | Yes | Healthcheck — dangling symlinks, framework-state coherence |
| SessionEnd | observe | Yes | Append session record to `.svc/sessions/sessions.jsonl` for audit-session-execution |
| UserPromptSubmit | warn | Yes | Detect stale active-WI / lane-tasks state per prompt |
| PreCompact | observe | Yes | Snapshot active task graph + last decisions to `.svc/sessions/<ISO>.snapshot.json` |
| PostCompact | observe | No | Documented but not yet wired in svc; future post-compact recovery hook |
| Notification | observe | Yes | Append notification payloads to `.svc/sessions/notifications.jsonl` |
| SubagentStart | observe | Yes | Append `subagent_start` record to `.svc/dispatch-log.jsonl` (WI-CLN-13 / plan §4.15) |
| SubagentStop | observe | Yes | Append `subagent_stop` record to `.svc/dispatch-log.jsonl` (WI-CLN-13 / plan §4.15) |

## Documented but not yet wired

The following events are part of the Claude Code host surface but svc has not chosen a concrete posture or wiring yet. Adding a row here is the first step toward enabling enforcement; the validator does not require these to be wired (Wired? = No).

- StopFailure
- PostCompact

## How to extend

1. Add a row above (or move from the "documented but not yet wired" list).
2. If `Wired? = Yes` and posture is `block` or `warn`, add a corresponding entry to `hooks/hooks.json` with the hook's id matching `svc-<event-kebab>-<purpose>`.
3. Run `bash test-framework/evals/tier-1/validate-hook-coverage.sh` to confirm the spec → wiring contract.

## WI-FW-HOOKS-SAFETY-01 — consolidated decision engine (2026-08-25)

PreToolUse posture is now **one deny-capable decision engine per host event**
(`svc-pretool-decision-engine` → `hooks/codex/svc-codex-pretool-dispatcher.mjs`).
The engine classifies observation vs mutation ONCE against the immutable
original input, emits the typed reason codes below, and runs every policy guard
as a child on the governed path only. Sibling hooks can never re-classify a
rewritten read as a mutation, and hook order no longer affects decisions.

| Surface | Reason codes / contract |
|---|---|
| Observation | `OBSERVATION_PROVEN`, `OBSERVATION_PROVEN_GIT_NORMALIZED` — reads need no WI/session; Git optional-lock suppression is per-argv `--no-optional-locks`, never an `export` prefix |
| Branch refs | `BRANCH_REF_INVALID` — Git-valid literal refs incl. slash branches; worktree paths hash-derived |
| Self-heal | `AUTH_BINDING_MISSING_SELF_HEAL_INELIGIBLE:<reason>` — one exact adoption attempt behind fresh positive prompt intent; foreign/ambiguous state is immutable on denial |
| Roots | `WORKTREE_ROOT_UNAPPROVED` — external registered worktrees adopt only beneath owner-approved canonical roots |
| Lease renewal | due threshold + min-interval; stale renewals are typed no-ops that write nothing; override/break-glass/handover/delegation/promotion never auto-renew |
| PostToolUse | `svc-posttool-heartbeat` consumes a one-time mode-0600 receipt bound to host/session/tool-use/digest/lease/generation; replays and mismatches are no-ops; failed calls extend nothing |

Consolidated child guards (individually disableable via `SVC_DISABLED_HOOKS`):
svc-worktree-isolation-guard, svc-workflow-guard (+ --bash-guard/--phase-boundary),
svc-loop-guard (Bash/Edit/Write side), svc-skill-artifact-authenticity,
svc-session-contract-freshness, svc-inertia-check, svc-codex-skill-load-enforcer,
svc-impact-triad-guard (Bash side). Tool-specific gates outside the mutation
tool set stay directly wired: svc-eval-gate-pre (TaskUpdate), svc-preflight-skill
(Skill), svc-continuation-phase-guard (Skill), svc-loop-guard-agent (Agent).

## WI-FW-CODEX-SVC-HOST-DISPATCH-01 — host identity survives ad-hoc dispatch (2026-08-26)

Ad-hoc `nohup codex exec` lane dispatches do not inherit `SVC_HOST`; once the
identity gate fired, EVERY governed call was denied and the lane died even with
BREAK-GLASS armed (iOS Azure pipeline incident, 2026-08-26). Contract now:

- `hostIdentity()` resolves in strict order: explicit `SVC_HOST` →
  `CODEX_THREAD_ID` → `CODEX_SESSION_ID` → `CODEX_HOME` → this dispatcher's own
  canonical `hooks/codex` install path. Every inferred signal is produced only
  by a Codex runtime, so inference cannot impersonate a foreign host; an
  explicit but UNKNOWN `SVC_HOST` still fails closed.
- Detached Codex lanes MUST launch through `scripts/lib/dispatch-codex-lane.sh`,
  which exports `SVC_HOST=codex` before `setsid nohup` detach and refuses to
  wrap non-codex commands.
- Provider observation covers read-only `az pipelines runs show|list`: Azure
  pipeline polling never needs mutation authority or host wiring.
  `--output-file`, mutating az subcommands, and `az devops invoke` remain
  governed mutations.

**BREAK-GLASS ≠ SVC_HOST bypass:** owner override / break-glass authority
objects govern MUTATION authorization only (leases, bindings, handover). They
never substitute for host identity wiring — a lane denied for host identity is
not recoverable by arming break-glass; relaunch it through
`scripts/lib/dispatch-codex-lane.sh` instead.
