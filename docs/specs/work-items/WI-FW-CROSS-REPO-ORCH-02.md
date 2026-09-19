# WI-FW-CROSS-REPO-ORCH-02: Origin orchestrator auto-bind (no user CLI)

**Type:** enabler
**Status:** planned
**Severity:** high
**Filed:** 2026-09-18
**Source:** owner: open any folder, name a WI or any onboarded svc project, agents run in that worktree — user never runs svc-orchestrate
**Lane:** framework
**Related:** WI-FW-CROSS-REPO-ORCH-01
**Depends on:** WI-FW-CROSS-REPO-ORCH-01 (merged #66, `483e26b`)
**Spec:** docs/specs/features/wi-fw-cross-repo-orch-02.md
**Gap brief:** docs/specs/bugfix/wi-fw-cross-repo-orch-02-gap-brief.md
**Risk Flags:** `runtime_concurrency`, `external_state_writer`, `lossless_rmw`, `idempotent_rewriter`, `cross_runtime_integration`

## Problem

#66 shipped a CLI. The owner UX is: sit anywhere, name any onboarded svc
project or WI (`hourshub` is one example, not the exclusive set), session
binds and dispatches PLAN xhigh / Fable / EXEC high into that linked
worktree. Local `./setup --all-hosts` from an unreviewed working tree is not
support.

## Goal

Prompt-time / session-start origin bind: extract WI or discovered onboarded
project id, resolve `~/worktrees/<id>/` and `~/app-workspaces/<id>-worktrees/`
linked checkouts, inject orchestrator context, migrate same-owner when identity
exists, dispatch children with `--cwd` that worktree. User never runs a
command. Isolation still denies mixed-repo Writes. Default checkout still
refused. Not HoursHub-only.

## Scout (unbound, not landed)

Files already exist in this worktree and were copied into the local ssve
checkout. Treat as candidates. EXEC rewrites to the spec; do not rubber-stamp.

- `scripts/lib/resolve-named-worktree.mjs`
- `hooks/svc-origin-orchestrator-prompt.mjs`
- `hooks/hooks.json`, `scripts/wire-grok-hooks.mjs`, `scripts/wire-hooks.mjs`, `scripts/wire-kimi-hooks.mjs`
- `hooks/cursor/svc-cursor-ssve-adapter.mjs` beforeSubmitPrompt inject
- PLAN `--effort xhigh` / EXEC `--effort high` on grok dispatch argv

Fable review-plan round 1 (rubric 6, 3 HIGH) is closed in this packet: AC-BIND-5 is a lock+receipt skip code contract, AC-ISO-1 exercises the skills-path allowlist under `SVC_SKILLS_HOME`, AC-to-Test matches validator checks. Project-only bind does not mtime-pick a WI.

**Next:** re-run Fable review-plan. Do not land. Do not treat local setup as promotion.
