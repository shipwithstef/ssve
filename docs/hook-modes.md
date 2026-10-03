# Hook modes

SSVE hooks advise by default. They still inspect operations and report findings, but their warnings do not stop the agent, a tool call, or a Git operation. This keeps unstable workflow checks from preventing the work needed to fix them.

Native host permissions, sandbox rules, third-party hooks, standalone validation commands, and GitHub required checks retain their own behavior. This includes direct chain-receipt validation through `scripts/check-chain-receipts.mjs` and `scripts/svc-reconcile.mjs`; a managed pre-push warning does not make either validator pass. A warning is not passing evidence or approval to merge.

## Choose a mode

The hook boundary resolves the mode for each invocation, in this order:

1. `SVC_HOOK_MODE=advisory` or `SVC_HOOK_MODE=enforce` in the host process environment.
2. The `mode` field in `~/.svc/hook-policy.json`.
3. `advisory` when neither is configured.

For persistent enforcement, merge this field into the owner policy file:

```json
{"mode":"enforce"}
```

Use `{"mode":"advisory"}` to return to advice. Invalid configuration is reported and falls back to advisory. An environment variable set inside one shell command affects that process and its children; it does not change the environment of an already-running agent host.

## What happens to findings

| Hook outcome | Advisory | Enforce |
|---|---|---|
| Successful informational context | Preserve useful output | Preserve original output |
| Permission decision or input rewrite | Leave permissions to the host; warn about proposed rewrites without applying them | Preserve original decision and input update |
| Denial or Stop blocking decision | Report warning; remove the blocking decision | Preserve blocking decision |
| Nonzero exit or crash | Report warning; allow host continuation | Preserve failure |
| Hook exceeds its bounded deadline | Terminate child execution and report warning | Fail the hook invocation |
| Foreign/user hook blocks | Preserve its behavior | Preserve its behavior |

Default advisory mode defers automatic SessionStart installation repair, Stop formatting/quality tasks, all-host pre-commit refresh, and the full pre-push suite. It prints the manual command instead of starting work that can take minutes. Run those commands explicitly when needed; enforce mode retains their bounded automatic execution. Other managed checks still run with bounded deadlines.

Warnings describe an observed problem, not a completed repair. Hooks may still perform their existing bookkeeping. Advisory mode changes the hook's blocking decision; it does not turn the underlying workflow into a read-only operation.

## Supported installations

Claude, Codex, Kimi, Gemini, Cursor, and Grok use the command boundary for managed SVC hooks. OpenCode and MiMo use the SVC plugin boundary. Antigravity currently has no hook runtime. Git dispatchers apply advisory behavior only to first-party SVC slots; existing foreign hooks remain independent.

After updating SSVE source, refresh installed wiring:

```bash
./setup --all-hosts
bash scripts/check-install-drift.sh --all-hosts
```

Setup migrates managed SVC entries idempotently. It does not rewrite foreign commands or grant native host permissions. Directly invoking an internal guard or validator does not use the installed advisory boundary and can still fail; use those commands when you want their actual diagnostic status.

## Validation and recovery

Run free checks with `EVALS=0 bash scripts/ci/run-free-checks.sh`. Enforcement fixtures explicitly select enforce mode; default-mode fixtures leave mode unconfigured. Hosted check results apply to the tested commit, not later modifications.

To recover from a regression, select advisory mode, repair the source and rerun setup. To restore the previous implementation, revert the source change and refresh installations from that revision. Keep evidence of failures visible throughout recovery.

Routine skill-loader rewrites discarded by advisory mode are quiet: the original tool input runs, with no claim that the loader ran or that the operation must be retried. Missing post-tool receipts are quiet for advisory calls and proven read-only calls. Independent warnings and actual enforcement findings remain visible.

## Quiet session output (SIDE-01)

Proven observations bypass mutation hooks before contract IO, self-heal, receipts or denial counters. This includes compound literal reads, native Codex `exec_command`, and the bounded literal `functions.exec` wrapper grammar. Unknown JavaScript, shell substitutions, executable flags and mixed read/write commands remain governed. Read-command output may redirect to `/tmp`, `SVC_SESSION_SCRATCHPAD`, or `~/.local/state/orch`; canonical targets inside repositories or symlink escapes remain governed.

Tool advisories apply to mutations in repositories with `.svc`. Emit a finding class once per stable session, repository and check; private runtime markers atomically suppress concurrent duplicates in stderr and host context. Explicit enforcement decisions remain visible on every denial. Advisory proposals never increment the deny-storm counter or trigger its circuit-breaker message. Sessions without stable identity cannot share a suppression record.

Freshness checks select the current session's contract row rather than another session's last row. No matching contract is silent; an active matching stale contract still fails validation and mutation authority remains independently enforced. Rules are delivered once per stable session across worktrees, including overflow pointers; read-only shell commands do not trigger command-keyword rules. These changes take effect after the owner refreshes installed hooks from the reviewed source.
