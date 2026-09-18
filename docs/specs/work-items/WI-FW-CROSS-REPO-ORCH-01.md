# WI-FW-CROSS-REPO-ORCH-01: Cursor origin orchestrates any named WI/worktree

**Type:** enabler
**Status:** in-progress
**Severity:** critical
**Filed:** 2026-09-18
**Source:** 2026-09-18 origin-lock incident (this thread)
**Lane:** framework
**Related:** WI-524, WI-546, WI-548, WI-551, WI-552, WI-FW-HOOKS-SAFETY-01
**Depends on:** WI-551, WI-552
**Follow-up:** HoursHub product work after this lands
**estimated_minutes:** 180

## Goal

A Cursor origin session in orchestrator mode can name any WI or worktree —
including another repository — and the framework migrates the session, then
dispatches Grok for plan/exec and Fable for review, with no paste and no
agy-only escape.

## Context

On 2026-09-18, hooks-active harnesses could not orchestrate a named WI from a
foreign worktree (HoursHub `wt-lane-account-customer-billing-live` → SSVE
`WI-FW-CROSS-REPO-ORCH-01`). Isolation only allowed `svc-ensure-worktree` from a
repo default checkout. Grok declared `fresh_session_launch.enabled=true` with
`launch_command: null`. Cursor had no origin-orchestrator primitive. Route
output fell through to prompt-composer paste. Owner dispatch STRAT was agy.
The only working path was manually starting Grok CLI.

## Hypothesized Value

The owner stays in Cursor, names the WI/worktree, and the chain runs: migrate
→ Grok PLAN → Fable review → Grok EXEC → Fable validation. Durable artifacts
live in the public git tree. No secrets. Then work returns to HoursHub.

## Broad Scope

- Same-owner session migrate/rebind onto a named WI/worktree
- Grok CLI launch_command is a real argv, not null
- Cursor origin orchestrator dispatches PLAN/EXEC to Grok and REVIEW to Fable
- Isolation allows the exact orchestrate CLI from a foreign worktree
- Prompt-composer paste is not the success path
- agy is not required for this origin
- 2026-09-18 incident is a hermetic regression

## Acceptance Criteria

- **AC-1 — Named migrate:** `svc-orchestrate migrate --wi <WI> --worktree <path>` from a foreign same-owner session writes a fresh session contract in the target, retires the origin binding for that session, and prints a JSON baton with `paste_required:false` and `agy_required:false`.
- **AC-2 — Grok launch:** `provision/hosts/grok.json` `fresh_session_launch.launch_command` is a non-null grok CLI template using `--cwd` and `--prompt-file`.
- **AC-3 — Dispatch:** `svc-orchestrate dispatch --role PLAN|EXEC` argv is grok in the target worktree; `--role REVIEW` argv is the existing Fable/cursor external-review launcher. Neither role requires agy.
- **AC-4 — Isolation:** `classifyMutation` allows the exact `svc-orchestrate` migrate/dispatch command from a non-default worktree of a different repo. Arbitrary mixed-repo mutation remains denied.
- **AC-5 — No paste:** orchestrate JSON never includes a "Prompt To Send" / copy-paste payload as the success path.
- **AC-6 — Regression:** `validate-cross-repo-orch-01.mjs` replays the 2026-09-18 incident fixture and fails if launch_command is null, paste is required, or agy is the only escape.

## Validator promotion note

- `validator_path`: `test-framework/evals/tier-1/validate-cross-repo-orch-01.mjs`
- `failure_class`: hooks-active origin cannot migrate/dispatch a named WI/worktree (paste or agy-only)
- `promotion_signal`: observed 2026-09-18 (this thread) and documented in WI-546 reviews (Grok launch_command null)
- `expected_runtime_budget`: <5s, hermetic, no network, no LLM
- `why_tier_2_or_targeted_is_insufficient`: isolation + host-manifest lock is the hot path; a targeted script would not run on every commit that touches launch_command or the isolation guard

## Affected Files

- `scripts/lib/cross-repo-orch.mjs`
- `scripts/svc-orchestrate.mjs`
- `provision/hosts/grok.json`
- `provision/hosts/cursor.json`
- `hooks/svc-worktree-isolation-guard.mjs`
- `scripts/resolve-continuation.mjs`
- `skills/route-workflow/SKILL.md`
- `skills/route-workflow/references/prompt-composer.md`
- `scripts/select-tier1-validators-v2.mjs`
- `test-framework/evals/tier-1/validate-cross-repo-orch-01.mjs`
- `test-framework/evals/tier-1/fixtures/cross-repo-orch-2026-09-18.json`

## Notes

Foreign live owners, ambiguous bindings, and default-checkout residue stay
fail-closed. This does not enable Cursor `fresh_session_launch`; Cursor is the
origin, Grok is the launched plan/exec host.
