# Zero-block worktree governance

**Status:** IMPLEMENTED
**Work item:** WI-FW-ZERO-BLOCK-01
**Lane:** framework

## Behavior contract

Centralized worktrees default to `~/worktrees/<repo>/<branch>` at mode `0700`. Policy loading fails closed. Dead-owner auto-reclaim allows a successor session on the same host to immediately recover a worktree when the recorded owner process is a tracked harness PID and verifiably dead (`processIsAlive === false && pid > 1`), without waiting 24 hours for lease expiration. The 24-hour lease expiration applies when process liveness cannot be verified (e.g. untracked or remote host). Sliding prompt authority renews the session prompt-authority document without rewriting `session-contract.jsonl`. Cursor denials preserve `continue: false`. AGY/Gemini plans with indented YAML still trigger the intent gate.

## Acceptance Criteria

| ID | Requirement |
|---|---|
| AC-1 | `scripts/worktree.sh remove` removes only a leaf registered to this repository and never falls back to `rm -rf` on an unproven or cross-repo target. |
| AC-2 | Dead-owner auto-reclaim allows a successor session on the same host to immediately recover a worktree when the recorded owner process is a tracked harness PID and verifiably dead (`processIsAlive === false && pid > 1`), without waiting 24 hours for lease expiration. The 24-hour lease expiration applies when process liveness cannot be verified (e.g. untracked or remote host). |
| AC-3 | Configured worktree roots that are symbolic links, or that contain escaping symlinks, fail closed with `WORKTREE_POLICY_INVALID`. |
| AC-4 | Sliding prompt authority renewal updates the session prompt-authority JSON through atomicWriteJson and refreshes recorded_at. |
| AC-5 | Cursor adapter denials preserve `continue: false` when the child decision set it. |
| AC-6 | `verify-plan-mechanical.sh` and `review-plan-codex.sh` share one intent regex that matches indented YAML and optional quotes. |
| AC-7 | The plan manifest is a valid inline framework manifest passing all tier-1 mechanical verification checks. |
| AC-8 | Canonical bootstrap chmods the new worktree `0700`, and a dangling policy symlink fails closed instead of defaulting. |
| AC-9 | Session alias JSON updates are locked and atomic; governance tests clear host session variables in subprocesses. |
