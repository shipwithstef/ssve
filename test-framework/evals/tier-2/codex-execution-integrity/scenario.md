# Scenario: Codex execution integrity runtime trace

## Purpose

Prove the installed Codex host, not only a local Node fixture, observes the WI-485 authority boundary.

## Preconditions

- Run `./setup --host codex` from the promoted commit.
- Inspect `/hooks` and confirm the three managed commands are trusted.
- Use a disposable framework worktree with one in-progress task.

## Trace

1. Submit a prompt bound to the disposable WI and capture the redacted authority record.
2. Attempt an `apply_patch` mutation before loading the task skill; capture a deny with the exact recovery command.
3. Run `node scripts/codex-load-skill.mjs` with the absolute graph, numeric task, and declared skill.
4. Repeat the same controlled mutation; capture allow and post-action validation.
5. Send a Stop payload using a different Codex session against a fresh foreign claim; capture `{}` with no continuation text.
6. Recursively scan the runtime records and prove the original prompt and seeded secret are absent.

## Result contract

Record four independent booleans: `configured`, `effective_single_stop`, `trusted`, and `runtime_observed`, with artifact paths. If Codex runtime or trust confirmation is unavailable, report `SKIP` and leave `runtime_observed=false`; never convert fixture success into a runtime PASS.
