# Hook modes

SSVE hooks advise by default. They still inspect operations and report findings, but their warnings do not stop the agent, a tool call, or a Git operation. This keeps unstable workflow checks from preventing the work needed to fix them.

Native host permissions, sandbox rules, third-party hooks, standalone validation commands, and GitHub required checks retain their own behavior. This includes direct chain-receipt validation through `scripts/check-chain-receipts.mjs` and `scripts/svc-reconcile.mjs`; a managed pre-push warning does not make either validator pass. A warning is not passing evidence or approval to merge.

## Direct repair under owner instructions

When the owner authorizes a code repair without historical backfills, proceed with the scoped worktree change, regression tests, code review and required GitHub checks. Keep missing historical receipts visible as historical gaps; do not manufacture them or label warnings as passing evidence. Standalone validators retain their diagnostic behavior, but an old workflow-record failure must not be silently promoted into a prerequisite for every source edit. Report actual merge and installation separately from implementation.

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

An explicit scratch root remains allowed when HOME itself is a Git/dotfiles repository. Stop the repository walk at the most specific allowed root; repositories nested inside it and Git metadata targets remain governed. Post-tool observations also exit before child hooks and receipt IO; only pre-tool observations can propose an input normalization.

Code-mode proof consumes the entire envelope, including whitespace in JSON argument objects, parenthesized result output and bounded batch renderers. It never evaluates JavaScript or trusts calls extracted from an otherwise unknown program. Proven reads exit before branch recovery, so a missing `origin/main` cannot emit a recovery advisory for them. Regression fixtures include the failed installed payload and native log-derived syntax; replay the durable launcher as well as the dispatcher when verifying activation.

Advisory mode additionally checks read effects without requiring byte-exact argv proof: `~/` paths, literal quoted/unquoted escapes, safe filename globs, and `xargs` with a fixed stdout-only reader. Output may target `$TMPDIR`, `/tmp/claude-*`, the configured scratchpad or orch tree. This check neither executes commands/expands globs nor rewrites input. It rejects substitution, mutating children, output operands and glob option injection; uncertain calls remain governed. Enforce mode retains its strict argv proof and existing output.

Tool advisories apply to mutations in repositories with `.svc`. Emit a finding class once per stable session, repository and check; private runtime markers atomically suppress concurrent duplicates in stderr and host context. Explicit enforcement decisions remain visible on every denial. Advisory proposals never increment the deny-storm counter or trigger its circuit-breaker message. Sessions without stable identity cannot share a suppression record.

Unbound sessions still receive mutation/uncertain-call advisories: append a concrete `Next step:` hint to the first occurrence. Do not silence all hook output merely because a WI or contract is absent. An ENOENT preflight diagnostic for an optional session contract is omitted when no matching current-session contract exists; independent mutation-authority steering remains visible. Matching opted-in or corrupt contract state retains its diagnostic, and enforce output is unchanged.

Freshness checks select the current session's contract row rather than another session's last row. No matching contract is silent; an active matching stale contract still fails validation and mutation authority remains independently enforced. Rules are delivered once per stable session across worktrees, including overflow pointers; read-only shell commands do not trigger command-keyword rules. These changes take effect after the owner refreshes installed hooks from the reviewed source.

Before activation, freeze private real inputs and run the offline installer replay:

```bash
node scripts/sample-hook-replays.mjs --prepared <50-real-envelopes.json> --out <private-frozen-samples.json>
node scripts/replay-installed-hooks.mjs --samples <private-frozen-samples.json> --out <private-evidence-dir>
```

The sampler adds 200 recent calls across Claude/Codex/Cursor and preserves unproven programs as a separate governed category. Replay uses the official materialize/wire/finalize entrypoints in a temporary Git-backed HOME, verifies receipts and bundle bytes, exercises all read fixtures and every frozen sample through configured commands, and retains exact command/payload/stdout/stderr evidence. New advisory-only reads receive separate effects expectations plus unchanged strict enforcement controls; the original sample bytes/labels remain frozen. Every real read has a paired mutation control requiring advisory plus next-step hint and enforced denial. It executes no submitted tool command and never activates the live installation. Failures cannot be relabeled or omitted to pass. Require `replay-summary.json` to report PASS, no failures, 50 prepared and 200 additional inputs, and stable source/sample hashes before switching hooks.
