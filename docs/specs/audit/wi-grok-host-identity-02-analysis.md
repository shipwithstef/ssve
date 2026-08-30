# Implementation Audit: WI-GROK-HOST-IDENTITY-02

**Date:** 2026-08-30
**Mode:** full
**Verdict:** READY TO LAND

## Acceptance criteria

| AC | Result | Evidence |
|---|---|---|
| AC-1 | PASS | Grok session markers resolve to host `grok`; unknown wired hosts fail closed; exact Grok controller principal is asserted. |
| AC-2 | PASS | Rewritten bootstrap carries only the validated host in shell text, transports session privately, binds host/repo/WI/branch/base, and executes end to end. |
| AC-3 | PASS | Grok native dispatcher owns governed hooks; compatibility hook values converge to boolean false or malformed input aborts. |
| AC-4 | PENDING POST-LAND | Source wiring tests pass; installed inventory must be verified after `./setup --host grok`. |
| AC-5 | PENDING POST-LAND | Live HoursHub bootstrap proof is deliberately deferred until the landed installed copy exists. |
| AC-6 | PASS | No HoursHub application, media, or video files were changed. |

## Audit findings

| Finding | Initial severity | Disposition |
|---|---|---|
| Bootstrap branch was reconstructed without shell quoting | Critical | Fixed with canonical argv encoding; exploit regression passes. |
| One-use handoff did not bind host and base | High | Fixed with schema-v2 tuple binding at creation, inspection, and consumption. |
| Non-boolean compatibility hook values could survive convergence | Medium | Fixed by aborting before write; malformed and duplicate fixtures pass. |
| Bootstrap and follow-on were tested separately | Medium | Fixed with one hermetic two-call sequence through the dispatcher. |
| Handoff host is not independently authenticated if the installed wrapper drops both its fixed prefix and Grok runtime marker | Medium residual from external review | Accepted defense-in-depth residual: governed Grok wiring supplies both signals, while missing identity fails closed. |

## Validation

- `validate-codex-session-rebinding.sh`: PASS.
- `validate-existing-worktree-self-heal.sh`: 30 passed, 0 failed with ambient Codex identity removed for hermeticity.
- `validate-codex-execution-integrity.sh`: 205 passed, 0 failed.
- `validate-grok-hook-toml-roundtrip.sh`: 31 passed, 0 failed.
- Pre/post evidence validator: PASS.
- Cross-system probe validator: PASS.
- Operation-scope and worktree-safety focused suites: PASS.
- Syntax checks for every changed executable: PASS.

## Scope and residue

- Changed executable census: 13/13 reviewed.
- No dependency, lockfile, money, quota, inventory, entitlement, or notification writer change.
- No HoursHub media mutation.
- Generated `.svc/authorization-events.jsonl` remains volatile and excluded from the implementation commit.
- Post-land setup and live installed-host proof remain the only completion conditions.
