# WI-FW-CROSS-REPO-ORCH-01 plan

**Status:** IMPLEMENTED — plan reviewed retroactively (Fable `cursor-fable-plan`, receipt `.svc/external-review-artifacts/WI-FW-CROSS-REPO-ORCH-01/fable-plan-live/run2/receipt.json`); findings F-001..F-006 are exec-review obligations
**Spec:** `docs/specs/features/wi-fw-cross-repo-orch.md`
**Branch:** `feature-wi-fw-cross-repo-orch-01`
**Mode:** inline
**Risk Flags:** `cross_runtime_integration`

## Implementation Summary

Cursor origin orchestrates a named WI/worktree without paste or an agy-only
escape. Same-owner migrate rebinds the session. Grok PLAN/EXEC uses a real
`launch_command`. Fable REVIEW uses the existing external-review launcher.
Isolation allows only that CLI from a foreign worktree.

## Files Planned

| Path | Action |
|---|---|
| `scripts/lib/cross-repo-orch.mjs` | CREATE |
| `scripts/svc-orchestrate.mjs` | CREATE |
| `hooks/lib/orchestrate-command.mjs` | CREATE |
| `hooks/svc-worktree-isolation-guard.mjs` | MODIFY |
| `provision/hosts/grok.json` | MODIFY |
| `provision/hosts/cursor.json` | MODIFY |
| `scripts/resolve-continuation.mjs` | MODIFY |
| `skills/route-workflow/SKILL.md` | MODIFY |
| `skills/route-workflow/references/prompt-composer.md` | MODIFY |
| `test-framework/evals/tier-1/validate-cross-repo-orch-01.mjs` | CREATE |
| `test-framework/evals/tier-1/fixtures/cross-repo-orch-2026-09-18.json` | CREATE |
| `.gitignore` | MODIFY — add `.svc/orchestration/` and `.svc/handoffs/` |
| `scripts/select-tier1-validators-v2.mjs` | MODIFY — register `validate-cross-repo-orch-01.mjs` |
| `test-framework/evals/tier-1/validate-tier1-selector-v2.mjs` | MODIFY — expected-registry update |

## Implementation approach

Same-owner identity: migrate requires a session-shaped id from the origin session. Origin binding is retired only when `binding.session_id === requested session_id`. A binding file whose session_id does not match is `orch_foreign` and no contract/binding bytes are rewritten. Missing session id is `orch_session_missing`. `--worktree` that canonicalizes to a repository default checkout (`.git` is a directory) is `orch_default_checkout`.

Isolation exactness: `parseOrchestrateCommand` uses `lexSimpleCommand` (rejects `; && || | newlines backticks $()`). argv[0] must be `node`, argv[1] must be `scripts/svc-orchestrate.mjs` or end with that path, subcommands only `migrate|dispatch|resume`, closed flag set. The isolation short-circuit bypasses only mixed-repo scope denial; identity/default-checkout checks still run inside the CLI.

REVIEW dispatch: `run-external-review.mjs --orchestrator <origin> --review-kind plan|exec --reviewer-config $SVC_REVIEWER_POLICY --reviewer-phase <kind> --reviewer-station cursor-fable-plan|cursor-fable-exec`. No `--model` / `--profile`. Tuple comes from owner policy.

Prompt spawn: dispatch writes `.svc/handoffs/<WI>-<role>.md`, sets `SVC_PROMPT_FILE` and `SVC_LAUNCH_CWD`, refuses if the prompt file is missing.

## Rollback / idempotency / executor discretion

- Rollback: `git revert` of the landing commit restores the prior guard and manifests. `.svc/orchestration/` residue is gitignored.
- Idempotency: migrate writes JSON via temp+rename; origin binding is retired last. Re-running the same principal against the same worktree returns a baton (no-op retire if already target).
- executor_discretion: file layout inside `scripts/lib` and naming are free. Identity predicate, parse exactness, JSON baton fields (`paste_required`, `agy_required`), and default-checkout refusal are not.

## External State

| # | Environment | What state | Coupling | Lifecycle wiring |
|---|-------------|------------|----------|------------------|
| 1 | host manifests | grok launch_command, cursor origin_orchestrator | coupled | provision/hosts/*.json in git; setup copies on install |
| 2 | session binding | same-owner migrate receipt | coupled | `.svc/orchestration/` gitignored; contract row in worktree |

Untouched environments: 3–15 of the taxonomy (no cloud, no secrets, no CI).

## Validation Plan

```bash
node test-framework/evals/tier-1/validate-cross-repo-orch-01.mjs
node test-framework/evals/tier-1/validate-continuation-lifecycle-wi552.mjs
node test-framework/evals/tier-1/validate-tier1-selector-v2.mjs
```

## Validation Plan

```bash
node test-framework/evals/tier-1/validate-cross-repo-orch-01.mjs
node test-framework/evals/tier-1/validate-continuation-lifecycle-wi552.mjs
node test-framework/evals/tier-1/validate-tier1-selector-v2.mjs
```

## AC-to-Task

| AC | Assertion in `validate-cross-repo-orch-01.mjs` |
|---|---|
| AC-1 | `AC-1 same-owner migrate rebinds and forbids paste/agy` |
| AC-1E | `AC-1E foreign session cannot steal` + `AC-1E default checkout is refused` |
| AC-2 | `AC-2 grok launch_command is a live grok CLI` |
| AC-3 | `AC-3 PLAN/EXEC argv is grok; REVIEW is Fable launcher` (no `--model`/`--profile`) |
| AC-3E | `AC-3E dispatch refuses when origin requires agy` |
| AC-4 | isolation allow orchestrate + deny mixed-repo Write; parser rejects pipes/wrappers/chains |
| AC-5 | baton JSON has no `Prompt To Send` |
| AC-6 | incident fixture replay |
| AC-ZERO | migrate-then-dispatch from a bound foreign worktree (AC-1 then AC-3) |
