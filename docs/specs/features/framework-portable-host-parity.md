# Feature spec: Portable outcome contract + capability-aware host adapters

**Status:** DRAFT (planning-only; implementation is child WIs)
**Type:** Enabler
**Mode:** contract-change
**WI:** WI-548 (umbrella) → WI-545, WI-547, WI-549, WI-550, WI-551, WI-552, WI-553, WI-546
**Date:** 2026-08-17
**Landscape:** inapplicable — framework self-contract, not a market product
**landscape_inapplicable_reason:** SSVE-on-SSVE delivery contract; no competitor landscape applies

## Problem Statement

The framework can prove work on one host and then fail, lie, or charge again
when the same work is checked from another checkout or another host. WI-542/WI-543
fixed Grok SessionStart runtime, but closeout still depended on a disposable
worktree, a missing worktree-local chain-policy, last-wins receipt keys, and
owner-pasted continuation. Hosts were treated as Claude-shaped even when they
are not.

## Invariant behavior

- Mandatory chain receipts remain SHA-bound git notes.
- Review launch still happens at most once per required gate.
- Worktree isolation and WI-502 authority remain.
- AGY remains an independent Gemini reviewer transport.

## Changed behavior

- Bulky review bytes are digest-addressed and relocatable (WI-547).
- Receipt identity is `{type, wi, sha, phase?}`.
- Chain-policy is repository-shared and fail-closed.
- Stop/VERIFIED/final success re-validate canonical receipts.
- Dispatch is owner-external and must not silent-remap.
- Restart-bound proof is a controller, not a prompt.
- Each host declares native/adapter/unsupported for every capability.

## Consumer Stories

### S1 — Operator finishes a WI on Grok and checks it from main

As an operator, I can land a Grok-executed WI and later run
`check-chain-receipts` on canonical main without keeping the implementation
worktree or rerunning AGY.

**ACs**

| ID | Criterion |
|---|---|
| PARITY-S1-1 | Historical AGY bytes for `f27a143a` verify from main after WI-547. |
| PARITY-S1-2 | Removing the original worktree does not invalidate those bytes. |
| PARITY-S1-3 | Checker does not invoke AGY, Claude, or Codex. |

### S2 — Two WIs close on one SHA

As an operator, when WI-542 and WI-543 both emit verify-promotion on one SHA,
both receipts survive and both can be checked independently.

**ACs**

| ID | Criterion |
|---|---|
| PARITY-S2-1 | Composite keys preserve both receipts (WI-550). |
| PARITY-S2-2 | Destructive overwrite without supersession is rejected. |

### S3 — Fresh worktree observes refuse

As an operator, a new linked worktree uses the same refuse mode as the
canonical clone even if it has no local `.svc/chain-policy.json`.

**ACs**

| ID | Criterion |
|---|---|
| PARITY-S3-1 | Shared resolver is git-common-dir first (WI-549). |
| PARITY-S3-2 | Missing policy is refuse, never silent warn. |

### S4 — Stop cannot report success on invalid receipts

As an operator, Stop, VERIFIED, and the final report fail closed when
canonical receipts are missing or invalid.

**ACs**

| ID | Criterion |
|---|---|
| PARITY-S4-1 | Finalization barrier re-runs `check-chain-receipts` (WI-550). |
| PARITY-S4-2 | Grok/Cursor Stop adapters are executable after setup (WI-545). |
| PARITY-S4-3 | Task-graph `completed` cannot override a failed check. |

### S5 — Dispatch stays on the configured host

As an owner, my dispatch file at `now` decides who plans, executes, and
reviews. Grok, Cursor, and AGY are never rewritten to Claude or Codex.

**ACs**

| ID | Criterion |
|---|---|
| PARITY-S5-1 | Missing owner file refuses (WI-551). |
| PARITY-S5-2 | Session override is explicit and receipted. |
| PARITY-S5-3 | AGY is last-resort or explicit ask, not a default orchestrator. |

### S6 — Restart-bound proof does not need a pasted prompt

As an owner, one invocation can finish a WI that requires a fresh host
session.

**ACs**

| ID | Criterion |
|---|---|
| PARITY-S6-1 | Controller launches `verify.restart` exactly once (WI-552). |
| PARITY-S6-2 | Missing launch API is an explicit blocker, not a Claude remap. |
| PARITY-S6-3 | “Prompt to send” is a failure. |

## System Dependencies

Depends on: WI-502 authority APIs, existing notes receipts, WI-547 store
(in progress), `provision/hosts/*.json`, owner `~/.svc/*` files.

Depended on by: PR #10 closeout, WI-546 live acceptance, future host adds.

## Industry Grounding

Inapplicable. Framework self-contract. See frontmatter
`landscape_inapplicable_reason`.

## Pillars Coverage Matrix

| Pillar | State |
|---|---|
| Personas | [N/A — justified] framework operators, not product personas |
| Vision | [UNCHANGED — VERIFIED] no product vision change |
| Specs | [NEW] this spec + child WIs |
| Journeys | [N/A — justified] no user-facing product journey |
| UX | [N/A — justified] no UI |
| UI | [N/A — justified] no UI |
| Tech | [NEW] POCCA architecture |
| Code | [UNCHANGED — VERIFIED] this PR ships no runtime code |

## Technical Design stub

See `docs/specs/architecture/wi-548-portable-outcome-capability-adapters.md`.

`explore-solutions` alternatives and the selected option live in
`docs/specs/decisions/2026-08-17-wi-548-host-parity/SOLUTION-CONFIDENCE.md`.

## Journey References

None. Live host acceptance is specified as fixtures in WI-546, not Gherkin.

## Implementation Notes

This spec is implemented by independently landable children, not by WI-548.
WI-548 stops after the planning PR.
