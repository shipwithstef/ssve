# execute-changeset — Dispatch preflight (profiles, MiMo delegation, fallbacks)

## Step 0 — MANDATORY dispatch preflight (hard rule, 2026-04-20)

Before writing any code in response to this skill, check the active profile:

```bash
bash scripts/resolve-model.sh EXEC --json | grep -o '"profile": "[^"]*"'
```

### If profile is `kimi-native` or `claude-native`

No external harness dispatch needed. The orchestrator handles execution inline using the native model:
- **kimi-native** → `kimi-for-coding` with thinking OFF executes directly
- **claude-native** → `claude-sonnet-4-6` executes directly

Skip the preflight below and proceed to Step 1.

### If profile is `svc-default` or `kimi-orchestrator-mixed`

Run the preflight:

```bash
bash scripts/execute-dispatch-preflight.sh \
  "$PWD" "<wi-id>" [--allow-override-file /tmp/override.yaml]
```

Interpret the single-line stdout:

| Decision | What the orchestrator MUST do |
|---|---|
| `DISPATCH=mimo-pro` | Dispatch via `scripts/dispatch-log.sh opencode execute-changeset @<payload>` or `claude-mimo-pro` alias. **Orchestrator (Opus) writing files inline is FORBIDDEN.** |
| `DISPATCH=sonnet` | MiMo Pro unavailable (quota/network/credentials). Dispatch via `claude -p --model claude-sonnet-4-6` subprocess with the same payload. Still NOT Opus inline. |
| `DISPATCH=opus-override` | User provided an accepted override file with written justification. Dispatch-log entry written automatically. Opus inline is allowed for this invocation. |
| `DISPATCH=not-required` | Plan is not yet chewed (no review-log.yaml with terminal_state ∈ {PROMOTED, PROMOTED_WITH_DISPUTES, REVISED_AND_REVIEWED}). Either run `review-plan` first, or this is a quick-fix scope that doesn't need the gate. Orchestrator uses judgment. |

**Locked decision (FRAMEWORK-STATE 2026-04-20; SUPERSEDED for svc-default by WI-357, 2026-06-06):**
- WI-357: `svc-default` EXEC is `claude/sonnet` — dispatch via Sonnet subprocess is the default executor; MiMo dispatch applies under keyed MiMo profiles (`opencode-mimo`, `kimi-orchestrator-mixed`). NOTE: `scripts/execute-dispatch-preflight.sh` still implements the 2026-04-20 mimo-first contract when `MIMO_API_KEY` is present — script alignment is owned by WI-367 (executable transport surface; see WI-367 tracking note). With no key set, the script's own fallback already emits `DISPATCH=sonnet`, matching WI-357.
- (Historical, pre-WI-357:) MiMo Pro was the mandatory executor for every chewed plan.
- Sonnet fallback activates automatically when `scripts/check-mimo-quota.sh` reports quota exhausted / credentials missing / network failure.
- Opus inline execution requires a written override file (`accept: true` + `reason: <why>`) that gets logged to `.svc/dispatch-log.jsonl` for longitudinal audit.
- The pre-commit hook `hooks/svc-execute-dispatch-guard.sh` enforces this mechanically on commit — any src/ write without a matching recent dispatch entry is BLOCKED.

**Why this rule exists:** during WI-088 iter1 (2026-04-20), Opus silently bypassed MiMo despite a fully-chewed plan because the framework only *suggested* MiMo dispatch rather than enforcing it. Token-economy claims in `references/model-routing.md` become unverifiable if orchestrators can route around MiMo at will. The hook + preflight make the bypass impossible-silently; overrides are allowed but logged.

**First-time setup on any project (one-time per repo):**
```bash
ln -sf "$(git -C /workspace/seriousvibecoding rev-parse --show-toplevel)/hooks/svc-execute-dispatch-guard.sh" .git/hooks/pre-commit
```



This skill takes the implementation manifest from `plan-changeset` and carries
it out directly in the worktree. It stages one task at a time, reviews the staged
diff, creates a checkpoint commit when the task is accepted, and moves to the next task.

**Announce at start:** "I'm using the execute-changeset skill to apply the implementation plan directly in the worktree."

