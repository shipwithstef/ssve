# WI-524 authorization-sensitive security review

Scope: Codex-only session handoff, worktree baton, takeover CAS, dispatcher, and
temporary owner recovery. Review date: 2026-08-06.

## Findings

No unresolved confidence-8+ finding after focused replay. The dispatcher now
recomputes operation scope after applying a bound workdir, so owner recovery and
normal authorization inspect the same directory that Codex receives as
`updatedInput`.

## Control matrix

| Area | Result | Evidence |
|---|---|---|
| access control | PASS | exact session, repository, WI, worktree, owner, and generation checks |
| takeover race | PASS | repository lock plus exact owner/generation CAS; generation increments once |
| process safety | PASS | takeover contains no process API; old session remains alive in replay |
| handoff replay | PASS | private 0600 nonce file, expiry, atomic rename consumption |
| path traversal/symlink/mixed repo | PASS | shared operation-scope resolver and isolation child remain mandatory |
| owner recovery | PASS | reason required; 1–30 minute lease; root/default checkout remains fenced except narrow framework maintenance |
| secrets/session privacy | PASS | raw session id is not a shell argument; handoff stores only private runtime state |
| hook protocol | PASS | Codex emits only allow/deny; no `permissionDecision:"ask"` |
| Claude boundary | PASS | no Claude wiring or Claude hook file changed |

Focused evidence: `bash test-framework/evals/tier-1/validate-codex-session-rebinding.sh`,
`validate-session-worktree-binding.sh`, `validate-codex-first-task-activation.sh`,
`validate-codex-sessionstart-json.sh`, and `validate-default-checkout-isolation.sh`.

The operation-scope focused test was not counted as a product failure because it
requires execution from the canonical `main` checkout while this WI is required
to run in its isolated maintenance worktree.
