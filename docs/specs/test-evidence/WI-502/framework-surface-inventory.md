# WI-502 framework surface inventory

Captured: 2026-07-20 against base `0f3bc54d5404b361259469081cf55822b01aae6c`.

## Authority and operation-scope entry points

| Family | Count | Files |
|---|---:|---|
| Codex `hookContext` consumers | 3 | `svc-codex-prompt-authority.mjs`, `svc-codex-skill-load-enforcer.mjs`, `svc-codex-stop-firewall.mjs` |
| Shared `resolveWI`/worktree consumers | 6 | Codex context, impact-triad guard, stop-quality, worktree isolation guard, session binding validator, Stop isolation validator |
| Mutation target parsers | 2 | `hooks/lib/hook-payload.mjs`, `hooks/svc-worktree-isolation-guard.mjs` |
| Claim/binding runtime modules | 4 core | `wi-claim.mjs`, `resolve-wi.mjs`, `svc-ensure-worktree.mjs`, session binding schema; 10+ downstream validation/receipt consumers |

## Dispatch and merge-back entry points

| Family | Count | Files |
|---|---:|---|
| Skill/reference contracts | 6 | dispatch-waves skill/runtime, execute-changeset skill/process/subagent dispatch, parallel dispatch transport |
| Runtime planners/workers/validators | 4 | `plan-parallel-wi-dispatch.mjs`, `dispatch-worker.sh`, `validate-parallel-merge-back.mjs`, `dispatch-log.sh` |
| Focused existing validator | 1 | `validate-parallel-wi-dispatch.sh` |

## Proven drift/gaps

- Session cwd and explicit tool workdir are not separately modeled.
- Apply-patch parsing omits move/rename and only one parser attempts multiple file directives.
- Exact Git worktree helpers exist but are not the common pre-authority boundary.
- Claim generation/CAS exists, but controller lease, handover secret, adoption, delegation, and merge receipt schemas do not.
- Current worker result can report parent graph mutation rather than forbidding it.
- Existing dispatch is WI-level; no nested within-WI execution graph exists.
- Host capability documentation does not truthfully gate mutating child execution on stable identity plus filesystem containment.

## Scope disposition

All listed behavioral entry points are covered by the WI-502 plan. Read-only prompt/Stop consumers preserve session context and are regression-tested rather than blindly converted to operation scope. Existing WI-level dispatch remains separate; new within-WI execution tasks reuse common partition/receipt primitives without collapsing the two graph levels.
