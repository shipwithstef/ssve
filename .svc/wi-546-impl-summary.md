# WI-546 Implementation Summary — Cursor live-acceptance

- **WI:** WI-546 (Cursor host side)
- **Session:** `svc-impl-wi546-01a01070`
- **Worktree:** `/home/dianast/app-workspaces/seriousvibecoding/.worktrees/framework-WI-546-live-acceptance`
- **Exact model id used:** `cursor-grok-4.6-high`
- **Where usage should appear:** Cursor Grok 4.6 High pool (Cursor's own Grok 4.6 High), **not** Anthropic Sonnet, Fable, Opus, Codex, or Composer Auto

This session did not switch to Auto, Sonnet, Fable, Opus, Codex, or Composer.

## Scope

Cursor live-acceptance only. Composed landed child validators (WI-545, WI-547, WI-549, WI-550, WI-551, WI-552). Did not implement new receipt identity, chain-policy, or dispatch resolver. Did not finish leftover WI-553 staged files.

## Acceptance criteria (Cursor)

| AC | Result | Evidence |
|---|---|---|
| AC-546-1 | PASS (isolated) | Isolated `./setup --host cursor` exit 0 + `check-install-drift.sh --host cursor` zero from a non-worktree hardlink copy of this tree. Direct `./setup --host cursor` from this worktree **refuses** (AP-30). |
| AC-546-2 | PASS | Isolated `~/.cursor/hooks.json` wires `sessionStart` → `svc-session-start-healthcheck` and `stop` → `svc-cursor-task-completion-guard`. Live Cursor session already has the same adapters loaded. |
| AC-546-3 | PASS | Composed: shared policy (WI-549), task-state persistence (`validate-task-graph-cross-host.sh` now includes `cursor`), receipt produce/consume + Stop/finalization/closeout (WI-550), review/audit continuity (WI-547), restart continuation fake transport + Cursor `capability_limited` (WI-552). |
| AC-546-4 | PASS | `node scripts/check-chain-receipts.mjs --sha f27a143a --wi WI-542` → `ok:true`, `receipt_source:note` from this tree's shared git-common-dir. Consume path does not spawn AGY. AGY was **not** rerun. |
| AC-546-6 | PASS | Fixture policy resolves EXEC to `{host:cursor, model:cursor-grok-4.6-high}`. Sonnet remap is deny-list fail-closed. Live `resolve-model.sh EXEC` fail-closes on missing `~/.svc/dispatch-policy.json` (no svc-default Sonnet). `detect-host.sh` reports `cursor`. |
| AC-546-7 | PASS | Cursor differences documented in `docs/specs/architecture/wi-548-capability-matrix.md` and covered by this fixture (hooks.json + exit 2, no matcher / no Task UI, AGY not orchestrator, `fresh_session_launch.enabled=false` → capability-limited, AP-30 worktree setup refusal). |

AC-546-5 (historical worktree removal) is covered by the composed WI-547 portability validator (digest store survives delete). Live Grok restart remains the other host.

## Commands run

```bash
export SVC_SESSION_ID=svc-impl-wi546-01a01070
export SVC_HOST=cursor
bash test-framework/evals/tier-1/validate-wi546-cursor-live-acceptance.sh
# 25 passed, 0 failed
node test-framework/evals/tier-1/validate-tier1-selector-v2.mjs
node scripts/check-chain-receipts.mjs --sha f27a143a --wi WI-542 --json
bash scripts/detect-host.sh
```

Log: `docs/specs/test-evidence/WI-546/validate-wi546-cursor-live-acceptance.log`

## Leftover Grok-host items (not this Cursor executor)

- Live `./setup --host grok` and `check-install-drift.sh --host grok` from a Grok session.
- Fresh Grok session loading declared Stop/SessionStart adapters.
- Live Grok `fresh_session_launch` (WI-552 `launch_command` seam; fake transport is what Cursor proved here).
- Operator canonical-checkout refresh of live `~/.cursor` after this branch lands (`./setup` from a worktree is correctly refused).
- Owner `~/.svc/dispatch-policy.json` is still absent on this machine; fail-closed is correct and is not a Claude remap.

## Files

- `docs/specs/architecture/wi-548-capability-matrix.md` (Cursor fixture coverage table)
- `test-framework/evals/tier-1/validate-wi546-cursor-live-acceptance.sh`
- `test-framework/evals/tier-1/validate-task-graph-cross-host.sh` (`cursor` + `grok` hosts)
- `scripts/select-tier1-validators-v2.mjs` + selector fixture
- `docs/specs/test-evidence/WI-546/`
