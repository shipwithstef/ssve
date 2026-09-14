# WI-FW-HOOKS-SAFETY-01: Self-healing tool-hook safety

**Type:** framework evolution
**Severity:** high
**Status:** baselined
**Filed:** 2026-08-25
**Lane:** framework
**Source plan:** `/home/user/app-workspaces/example-marketplace-worktrees/wt-lane-fw-hooks-safety/docs/specs/plans/wi-framework-hooks-safety-plan.md`

## Goal

Make hook authorization observation-first and self-healing without weakening the
exact repository, worktree, WI, principal, generation, or no-follow boundaries.

## Acceptance Criteria

- **AC-1 — Literal branches:** Git-valid slash branches are accepted as refs,
  while their worktree paths are independently hash-derived. Invalid refs and
  path traversal remain rejected before shell or filesystem use.
- **AC-2 — Authority-free observation:** every decoded segment of a proven
  observation is evaluated once, Git optional locks are disabled in argv, and
  the call succeeds without WI/session state or a second classifier.
- **AC-3 — Exact self-heal:** fresh positive user intent for one WI can adopt
  exactly one registered non-default worktree beneath an approved canonical
  root. Foreign, ambiguous, symlinked, unapproved, or default-checkout state is
  denied without mutation.
- **AC-4 — Lease continuity:** a due exact-principal v2 controller lease renews
  with the same lease id and generation under compare-and-swap checks. Override,
  break-glass, handoff, delegation, and promotion capabilities do not renew.
- **AC-5 — Post-tool correlation:** successful calls may heartbeat only through
  an unexpired, one-use receipt bound to host, session, tool-use id, original
  digest, lease id, principal, worktree, WI, and generation. Replay or mismatch
  is a no-op.
- **AC-6 — Host and install parity:** Codex and Claude-compatible adapters expose
  the same decision/reason code, source and installed wiring run one deny-capable
  pre-tool engine per event, and focused/full tier-1 validation is green.

## Security invariants

Original input is immutable evidence; unsupported shell grammar is governed;
mutation requires an exact tuple; operation scope outranks session cwd; self-heal
never takes over a foreign owner; default checkout remains protected; renewal is
continuity, not escalation; PostToolUse cannot authorize.

## Affected Files

- `hooks/lib/pretool-decision-engine.mjs`
- `hooks/lib/literal-branch.mjs`
- `hooks/lib/tool-call-receipt.mjs`
- `hooks/lib/authority-store.mjs`
- `hooks/codex/svc-codex-pretool-dispatcher.mjs`
- `hooks/codex/svc-codex-posttool-heartbeat.mjs`
- `hooks/codex/lib/codex-hook-context.mjs`
- `hooks/codex/lib/bootstrap-command.mjs`
- `hooks/codex/lib/argv-encode.mjs`
- `scripts/svc-ensure-worktree.mjs`
- `scripts/wire-hooks.mjs`
- `scripts/wire-codex-hooks.mjs`
- `hooks/hooks.json`

Affected Specs: `docs/plans/2026-08-25-wi-fw-hooks-safety/manifest.md`
(exhaustive planned file set, AC-to-task mapping, validation plan) and
`docs/specs/audit/wi-fw-hooks-safety-analysis.md`.
