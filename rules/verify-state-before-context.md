---
id: svc-verify-state-before-context
type: correction
scope: universal
severity: high
---

# Rule: Verify State Before Acting on Stale Context

- After compaction, resume, a long session or a subagent handoff, run `git branch --show-current`, `git status --short` and `pwd` before any git operation. If context names a worktree, confirm `pwd` is inside it and say so if not.
- For any claim about what is **deployed / running / current**, read `git show origin/<canonical-ref>:<path>`, not the working tree: local clones are often parked on feature branches. Check `git rev-parse --abbrev-ref HEAD` first. (2026-06-20: a bootstrap bug was misdiagnosed three times from a stale branch.)
- Before reporting an svc WI as pending/blocked, check `git log --all --oneline --grep="<WI>"`; a merged WI's lane-tasks file is stale, not backlog (`validate-stale-lane-tasks.sh`).

Incident detail and per-program canonical refs: `references/rule-details/verify-state-before-context.md`.
