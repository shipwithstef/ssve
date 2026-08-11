# Framework Improvement - active intent guard for stale Stop hooks

**Status:** IMPLEMENTED
**accepted_wi:** WI-354
**Implemented:** 2026-06-05

## Gap

Stop-hook completion guards could emit imperative execution instructions for a
stale WI after the human conversation had moved elsewhere. The replay in
`proposals/2026-06-04-session-audit-active-intent-guard.md` showed an old
`WI-335` completion guard overriding accounting / launch vehicle discussion and
then reappearing after an explicit "what are you doing" correction.

## Fix

Add a repo-local active-intent bridge between UserPromptSubmit and Stop hooks:

- `hooks/lib/active-intent.mjs` records prompt classifications and evaluates
  session/cwd/WI-scoped suppression.
- `hooks/svc-prompt-stale-state.mjs` writes the latest prompt state plus
  suppression for `stop`, `ignore this`, `unrelated`, `what are you doing`,
  cross-session, and wrong-current-conversation corrections. It records explicit
  same-WI `continue WI-XXX` / `resume WI-XXX` as a resume override.
- `hooks/svc-task-completion-guard.sh` checks active-intent state before the
  hard `block` path and downgrades stale suppressed WI pressure to advisory
  output. It also downgrades a concrete WI-bound session contract when the
  latest prompt is newer than that contract and does not explicitly target the
  same WI.
- `route-workflow/SKILL.md`,
  `route-workflow/references/prompt-composer.md`, and
  `route-workflow/references/task-graph-protocol.md` now state that latest
  human intent outranks stale internal continuation.
- `.svc/active-intent-state.json` is ignored as ephemeral local hook state.

## Acceptance Criteria

- Latest user correction, unrelated prompt, or newer non-WI prompt after a
  stale concrete WI contract suppresses stale WI completion pressure for the
  current session/cwd.
- Suppression is advisory-only and never emits `DO NOT NARRATE ... EXECUTE it`.
- Explicit same-WI continuation restores normal completion-guard behavior.
- Suppression is scoped by session, cwd/repo, and WI.
- Route-workflow treats the replay as framework regression work, not product WI
  continuation.
- Tier-1 regression coverage proves the failure mode and normal resume path.

## Verification

```bash
node -e "import('./hooks/lib/active-intent.mjs').then(() => console.log('active-intent module loads'))"
bash test-framework/evals/tier-1/validate-active-intent-guard.sh
bash test-framework/evals/tier-1/validate-stop-hook-session-isolation.sh
bash test-framework/evals/run-all-evals.sh
```

Results:

- `validate-active-intent-guard.sh`: PASS
- `validate-stop-hook-session-isolation.sh`: PASS
- `run-all-evals.sh`: `192 scripts passed, 0 failed (0 timed out)`, `RESULT:
  PASS (tier-1 only)`

## Rollback

Revert the helper, prompt-hook writer, Stop-hook advisory branch, protocol text,
and eval file together. Removing only the helper leaves the prompt hook unable
to import; removing only the Stop-hook branch leaves state written but unused.
