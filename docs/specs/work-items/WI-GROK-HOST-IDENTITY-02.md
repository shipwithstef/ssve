# WI-GROK-HOST-IDENTITY-02: Preserve Grok controller identity across bootstrap and follow-on hooks

**Type:** regression
**Status:** in_progress
**Severity:** high
**Filed:** 2026-08-30
**Source:** live HoursHub Grok session after WI-GROK-SHELL-ALIAS-01

## Problem

A Grok `run_terminal_command` bootstrap succeeds, but the first command in the
created WI worktree is denied with `controller principal changed` or
`v2 controller principal mismatch`.

## Evidence

- Grok session: `01a05200-f1e6-74d0-9b90-7192c6174a2a`.
- The WI binding uses that exact session ID.
- The controller lease equals the `codex` principal for that Grok session.
- Grok loads `global/settings:pre_tool_use[15]`, sourced from the Claude global
  settings command that explicitly sets `SVC_HOST=claude`.
- Grok's process environment supplies no stable host marker.

## Expected Behavior

One Grok session has one stable `grok` controller principal across bootstrap,
worktree isolation, the consolidated dispatcher, and follow-on terminal calls.

## Actual Behavior

Bootstrap defaults to `codex`, while an imported global hook evaluates the same
session as `claude`; both differ from the intended `grok` principal.

## Reproduction

Trigger: From the HoursHub default checkout, Grok session
`01a05200-f1e6-74d0-9b90-7192c6174a2a` ran the canonical
`svc-ensure-worktree.mjs` bootstrap and then attempted a terminal command in
the printed WI worktree.

Expected: Bootstrap and the follow-on command resolve the same `grok` controller
principal and the follow-on reaches the ordinary WI/isolation gates.

Actual: Bootstrap succeeded, but imported Claude hook slot 15 denied the
follow-on with `controller principal changed`; the direct isolation hook also
reported `v2 controller principal mismatch`.

Classification: cross-runtime propagation regression. The worktree and binding
were created correctly; host identity did not propagate across the hook → shell
bootstrap boundary.

## Root Cause

Immediate cause: the controller lease was stamped with the `codex` principal,
while later imported hooks evaluated the same Grok session as `claude`.

Enabling conditions:

- Grok 1.0.13 imports Claude hooks by default (`compat.claude.hooks = true`).
- The imported Claude dispatcher command hardcodes `SVC_HOST=claude`.
- Grok's native SSVE hooks did not set `SVC_HOST=grok` and did not include the
  consolidated dispatcher.
- The dispatcher's rewritten bootstrap command did not carry its resolved host
  into `svc-ensure-worktree.mjs`, whose no-signal fallback is `codex`.
- `resolveAuthorityHost` did not recognize Grok's reserved `GROK_SESSION_ID`.

Why the system allowed it: the previous live proof replayed the installed skill
gate directly, but did not inspect Grok's effective merged hook inventory or run
bootstrap followed by a second governed terminal call.

## Smallest Safe Fix

1. Make Grok setup disable imported Claude and Cursor **hooks only**; retain
   compatibility discovery for skills, rules, agents, MCPs, and sessions.
2. Prefix every Grok-owned hook command with `SVC_HOST=grok`.
3. Add the consolidated dispatcher to Grok's native PreToolUse wiring.
4. Carry the whitelist-validated dispatcher host into its rewritten bootstrap
   command so `svc-ensure-worktree.mjs` stamps the correct controller.
5. Recognize `GROK_SESSION_ID` in shared authority host/session resolution.

Controller ownership, worktree isolation, WI binding, and the skill receipt
policy remain fail-closed.

## Pattern Scan

**Scope:** Grok hook wirer commands; shared host/session resolution; consolidated
dispatcher bootstrap rewrite; effective `grok inspect --json` hook inventory.

**Findings:** The defect spans the four boundaries listed in Smallest Safe Fix.
No HoursHub application or media path participates in the cause.

**Followups:** Single cross-boundary correction; no decomposition needed.

## Pillar Revisit Audit

| # | Pillar | Affected? | Evidence / follow-up |
|---|---|---|---|
| 1 | Product fit | unaffected | SSVE still requires fail-closed mutation ownership. |
| 2 | Journey | affected | Grok bootstrap → enter WI → mutate must become one regression fixture. |
| 3 | Acceptance criteria | affected | Add effective-hook exclusivity and two-call principal-continuity assertions. |
| 4 | UX | unaffected | Denial wording and TUI behavior need no product redesign. |
| 5 | UI | unaffected | No rendered surface changes. |
| 6 | Tech architecture | affected | Host identity must be explicit at ingress and propagated across bootstrap. |
| 7 | Cost model | unaffected | Local hook checks only; no paid service or scaling change. |
| 8 | Operations & ownership | affected | Grok setup must converge foreign-hook compatibility and repair legacy synthetic leases deliberately. |

## Affected Artifacts

- Grok hook wirer and TOML round-trip validator.
- Shared authority host/session resolver.
- Consolidated dispatcher bootstrap rewrite and execution-integrity fixtures.
- Grok host manifest/install drift proof if required by setup behavior.

## Learnings

A host integration is not proven by direct hook replay alone. Verification must
inspect the host's effective merged hook inventory and execute a two-call
sequence: bootstrap, then a governed mutation from the bound worktree.

## Register Discoveries

Single correction — no decomposition needed.

## Proof of Fix

- **AC-1:** Hermetic identity fixtures prove `GROK_SESSION_ID` resolves to host
  `grok` and the same non-empty session ID in the shared resolver, dispatcher,
  worktree bootstrap, and authority CLI; explicit payload/`SVC_HOST` precedence
  and unknown-host fail-closed behavior remain intact.
- **AC-2:** Execution-integrity fixtures prove the dispatcher rewrites canonical
  bootstrap with allowlisted `SVC_HOST=grok` and `SVC_SESSION_ID=<same-session>`.
- **AC-3:** Hermetic TOML round-trip proves `compat.claude.hooks=false`,
  `compat.cursor.hooks=false`, native dispatcher wiring, and `SVC_HOST=grok`.
- **AC-4:** `grok inspect --json` after setup reports foreign hook compatibility disabled
  and no enabled Claude/Cursor hook entries.
- **AC-5:** The HoursHub lease is recovered with generation-bound compare-and-swap from the synthetic
  Codex principal to the exact Grok principal.
- **AC-6:** The exact bootstrap and a harmless bound-worktree terminal observation pass;
  no `ffmpeg` or video/media mutation is executed.

## Pillars Coverage Matrix

| Pillar | State |
|---|---|
| Product fit | UNCHANGED — fail-closed ownership retained |
| Journey | UPDATED — two-call Grok proof required |
| Acceptance criteria | UPDATED — effective inventory + principal continuity |
| UX | UNCHANGED — no UI behavior redesign |
| UI | N/A — no rendered surface |
| Tech architecture | UPDATED — explicit propagated host identity |
| Cost model | UNCHANGED — local-only checks |
| Operations & ownership | UPDATED — setup convergence + controlled lease repair |

## Scope

- Framework host detection and Grok hook wiring.
- Regression fixtures covering bootstrap followed by a worktree command.
- Grok-only setup and evidence-backed repair of the synthetic HoursHub lease.

## Out of Scope

- Running the HoursHub remux.
- Editing video, audio, or HoursHub application files.
- Weakening worktree isolation or controller ownership.

**Risk Flags:** external_state_writer, lossless_rmw, idempotent_rewriter, cross_runtime_integration

**Next:** `diagnose-bug` — confirm the smallest host-identity correction and pattern scan.
