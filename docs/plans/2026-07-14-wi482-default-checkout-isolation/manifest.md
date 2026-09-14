# WI-482 Changeset: Mandatory default-checkout isolation

- **Spec:** docs/specs/work-items/WI-482.md
- **Branch:** framework-WI-482-default-checkout-isolation
- **Lane:** framework
- **Archetype:** cross-cutting mutation/worktree isolation
- **Planning mode:** enumerate every mutation entry point, then centralize policy
- **Execution mode:** dispatch
- **Planning base:** 22df12efdfc4d48dacf2acea8588d585ce0094a8
- **Dependency/execution base:** WI-484 VERIFIED; create lazily from current verified origin/main
- **Status:** REVIEWED_AND_FROZEN; planning only
- **Created:** 2026-07-14T10:48:02Z

## Implementation Summary

Deny repository mutation from the default checkout for every framework lane, including docs, generated files, tests, and repo-local runtime state. A single pure classifier and idempotent ensure helper supply equivalent policy to host hooks and workflow routing. Read-only operations and runtime/job temp outside the repository remain allowed.

## Files Planned

| File | Action | Responsibility |
|---|---|---|
| hooks/svc-worktree-isolation-guard.mjs | CREATE | host-neutral mutation decision |
| scripts/svc-ensure-worktree.mjs | CREATE | verify base and create/locate `.worktrees/<branch>` |
| references/worktree-isolation.md | CREATE | canonical policy, override, cleanup |
| test-framework/evals/tier-1/validate-default-checkout-isolation.sh | CREATE | host/payload/path fixture matrix |
| scripts/worktree.sh | MODIFY | delegate create/preflight/status to ensure helper |
| WORKTREES.md | MODIFY | remove framework-doc direct-main exception |
| route-workflow/SKILL.md | MODIFY | ensure linked worktree before first planned mutation |
| list-work-items/SKILL.md | MODIFY | show WI/branch/worktree/session owner |
| scripts/wire-codex-hooks.mjs | MODIFY | register isolation gate before other mutation gates |
| scripts/wire-hooks.mjs | MODIFY | equivalent Claude PreToolUse entry |
| scripts/wire-kimi-hooks.mjs | MODIFY | equivalent supported write/Bash entry |
| scripts/wire-gemini-hooks.mjs | MODIFY | equivalent supported before-tool entry |
| scripts/wire-opencode-hooks.mjs | MODIFY | equivalent supported tool entry |

## Changeset Blueprint

### hooks/svc-worktree-isolation-guard.mjs — complete decision contract

Normalize host payload through existing hook-payload helpers. Resolve real git common directory, default checkout root, current worktree root, branch, tool, target paths, command/patch, and session binding. `classifyMutation` returns read-only, bootstrap-isolation, repo-mutation, external-temp-mutation, or ambiguous-write. Allow outside git, recognized reads, the exact `node scripts/svc-ensure-worktree.mjs ...` bootstrap command, linked worktree with WI-484 binding agreement, and paths wholly under approved job/runtime temp outside every repo root. The bootstrap class may change only git metadata and `.worktrees/<branch>` through the ensure helper; it cannot edit tracked default-checkout files. Deny every other repo-mutation or ambiguous write in the default checkout. Never allow because a file is documentation, generated, test, or under `.svc`. Emit host-native denial with the exact ensure command. Emergency override requires SVC_ISOLATION_OVERRIDE=1, ISO expiry <=30 minutes, non-empty reason, current session, and append-only runtime receipt; automated lanes never set it.

### scripts/svc-ensure-worktree.mjs — complete CLI/API contract

```text
Usage: node scripts/svc-ensure-worktree.mjs --wi WI-N --branch NAME [--from origin/main] [--print-cd] [--json]
Preconditions: run from repository; branch matches safe kebab pattern; .worktrees is ignored;
               origin/main exists; fetch has completed; default checkout has no tracked/untracked changes;
               local base equals verified origin/main unless an explicit immutable SHA is supplied.
Behavior: acquire runtime lock by repo hash; return existing linked worktree only when branch/path/binding agree;
          otherwise git worktree add .worktrees/NAME -b NAME BASE; initialize WI-484 binding atomically;
          never invoke setup and never repoint installed symlinks.
Exit 0: JSON includes wi, branch, base_sha, absolute_worktree, owner_session, created boolean.
Exit 2: dirty/stale base, conflicting worktree/branch/binding, unsafe path.
```

### scripts/worktree.sh — exact modifications

Replace create and preflight mutation logic with calls to svc-ensure-worktree.mjs while retaining user-facing commands. Remove auto-commit/auto-edit behavior for `.gitignore`; preflight now denies and prints the explicit repair. Derive default branch through `refs/remotes/origin/HEAD` with main fallback. Status consumes helper JSON and prints exact owner. Cleanup calls the WI-484 binding release before `git worktree remove`. Planning commands may run read-only on default checkout, but the first file mutation must follow the ensured worktree path.

### WORKTREES.md and skills — exact contract changes

Replace every contradictory WORKTREES.md anchor: under `## When to Create a Worktree`, rows `Spec writing (write-spec) | Never`, `Vision/persona/journey work | Never`, `Reviews and audits (review-gate) | Never`, and `Framework doc edits ... | Never`; under `## Per-Lane Worktree Map`, every `On main (planning)` cell plus the brownfield-conversion/drift `entire lane on main` rows; and the sentence `main (plan) → worktree (build + test + review) → main`. Replacement contract: read-only discovery/review may inspect default checkout; every create/edit/append/generation runs in a linked `.worktrees/` branch; land/verify may use default checkout only for merge/read-only post-merge operations explicitly allowed by policy. route-workflow ensures before session-contract/task-graph/plan writes. list-work-items adds Worktree, Branch, Owner Session; DONE regeneration requires a worktree.

### Host wirers — exact registration contract

Each hook-capable host gets one stable `svc-worktree-isolation-guard` key at its earliest write-capable pre-tool event. Current verified map: Claude `PreToolUse` with `Bash|Edit|Write`; Kimi `PreToolUse` with `Shell|WriteFile|StrReplaceFile`; Codex `PreToolUse` with `Bash|apply_patch|Edit|Write`; Gemini `BeforeTool` with `run_shell_command|shell|write_file|replace|edit`; OpenCode has no command-hook registry in its current wirer and uses the universal pre-commit validator until live docs prove an equivalent event. Task-4 verifies this table against live primary host docs and records changes as manifest deviations before editing. Codex retains exactly one Stop.

The classifier imports WI-485's shared read-only list: read tools plus Bash forms `git status|log|diff|show`, `ls`, `pwd`, `cat`, `sed -n`, `head`, `tail`, `rg` without replace flags, `find` without delete/exec, `test`, `wc`, `sha256sum`, and `node --check`. Any redirect, pipeline, subshell, command substitution, chaining, or unlisted option is mutating.

### Tier-1 test — complete matrix

Create a bare origin, protected default checkout, two linked worktrees and external temp. Replay Bash, apply_patch/Edit/Write, and representative host payloads. Assert deny for code/docs/tests/generated/.svc writes and ambiguous shell in default checkout; allow for reads, linked bound worktree, and external temp; deny temp path that resolves through symlink into repo; override validity/expiry/reason; dirty/stale base denial; idempotent create/resume; conflicting branch denial; no setup invocation or installed symlink hash change; all worktree paths under `<repo>/.worktrees/`.

## MODIFY Anchor Ledger

| File | Exact existing anchor | Disposition |
|---|---|---|
| scripts/worktree.sh | `cmd_guard()`, `cmd_create()`, `cmd_status()`, `cmd_remove()` | REPLACE create/preflight with ensure helper; INSERT owner output/release; preserve flags |
| WORKTREES.md | `## When to Create a Worktree`, `## Per-Lane Worktree Map`, `## Worktree Guard`, sentence `main (plan) → worktree` | REPLACE all contradictory rows/sentence |
| route-workflow/SKILL.md | `## Hot Path` before `## Session Contract And Direct Requests` | INSERT ensure-before-first-write and absolute cwd baton |
| list-work-items/SKILL.md | `## Output contract` and `## User-Facing Output Contract` | INSERT Worktree/Branch/Owner Session and no-refresh semantics |
| scripts/wire-hooks.mjs | `function buildHookEntries(skillsPath)` under `PreToolUse guards` | INSERT Claude entry before workflow guard |
| scripts/wire-kimi-hooks.mjs | `function buildHookEntries(skillsPath)` under `PreToolUse guards` | INSERT Shell and WriteFile/StrReplaceFile entries |
| scripts/wire-codex-hooks.mjs | `function buildHookEntries(skillsPath)` before Bash guard | INSERT isolation entry; preserve WI-485 Stop/auth keys |
| scripts/wire-gemini-hooks.mjs | `function buildHookEntries(skillsPath)` under `BeforeTool` | INSERT shell/write matcher entries |
| scripts/wire-opencode-hooks.mjs | `const svcConfig = {` | PRESERVE permissions; document post-action-only unless live research finds a hook API |

## Task Graph

```json
{"tasks":[
 {"id":"task-1","title":"Write isolation doctrine and failing classifier fixtures","blocked_by":[]},
 {"id":"task-2","title":"Implement pure isolation guard and ensure-worktree helper","blocked_by":["task-1"]},
 {"id":"task-3","title":"Delegate worktree lifecycle and route mutations","blocked_by":["task-2"]},
 {"id":"task-4","title":"Wire supported hosts and status ownership","blocked_by":["task-3"]},
 {"id":"task-5","title":"Run cross-host isolation and framework validation","blocked_by":["task-4"]}
]}
```

| Task | ACs | Validation | Checkpoint |
|---|---|---|---|
| 1 | 1–3 | fixture red baseline and doctrine assertions | yes |
| 2 | 1–3,5 | classifier/ensure matrix | yes |
| 3 | 2,5 | create/resume/cleanup and route fixture | yes |
| 4 | 1,4,5 | wirer list-all/invariance matrix | yes |
| 5 | 1–5 | focused, worktree safety, full tier-1 | yes |

## AC-to-Task and AC-to-Test Mapping

| AC | Task | Test type | Proof |
|---|---|---|---|
| AC-482-1 | 1,2,4 | cross-host fixture | every repo mutation class denied on default |
| AC-482-2 | 2,3 | git integration | only `.worktrees/`, clean verified origin/main |
| AC-482-3 | 1,2 | table test | reads and external temp allowed; symlink escape denied |
| AC-482-4 | 3,4 | CLI snapshot | WI/worktree/branch/session printed |
| AC-482-5 | 2–5 | lifecycle/invariance | idempotency and installed symlink hashes |

## Prerequisite Alignment Matrix

| Prerequisite | Status | Trace |
|---|---|---|
| UX/UI | N/A | headless repository policy |
| Technical design | satisfied | program P2 table + centralized classifier |
| Style | satisfied | ESM, portable Bash wrapper, host key conventions |
| Persona | N/A | framework operator safety |
| Concurrency identity | gated | WI-484 binding schema and release API |
| Host capability | enumerate at execution base | only confirmed wirers edited; unsupported hosts documented |

## Validation Plan

### Tier-1 promotion note

| Field | Decision |
|---|---|
| validator_path | test-framework/evals/tier-1/validate-default-checkout-isolation.sh |
| failure_class | unattributable default-checkout mutation and concurrent worktree contamination |
| promotion_signal | repeated live shared-checkout collisions and WORKTREES policy contradiction |
| expected_runtime_budget | under 5 seconds; bounded host/path smoke matrix |
| why_tier_2_or_targeted_is_insufficient | the guard protects every framework mutation; extended host stress remains targeted |

Run Node/Bash syntax, a bounded tier-1 smoke matrix, a targeted 100-case path/payload table, git integration with dirty/stale/clean bases, all host registry dry-runs, install-symlink before/after hashes, validate-worktree-safety, manifest linter when registry docs change, pipeline integrity, and full tier-1.

## Execution Command Sequence

```bash
git fetch origin main
test -z "$(git status --short)"
bash scripts/worktree.sh create framework-WI-482-default-checkout-isolation --from origin/main
cd .worktrees/framework-WI-482-default-checkout-isolation
bash test-framework/evals/tier-1/validate-default-checkout-isolation.sh
bash test-framework/evals/tier-1/validate-worktree-safety.sh
node scripts/lint-skills-manifest.mjs
bash test-framework/scripts/validate-pipeline-integrity.sh .
bash test-framework/evals/run-all-evals.sh
```

RECOVERY_IF_FAIL: do not weaken the default-checkout deny. Preserve the failing fixture, repair classifier or lifecycle coupling, rerun focused host/path cases, then the entire cross-host matrix.

## Checkpoint Plan

Separate classifier/helper, worktree/route integration, and host wiring commits. A host-wiring checkpoint requires its own registry replay proof and Codex single-Stop assertion.

## Promotion Readiness Checklist

- [ ] WI-484 is VERIFIED.
- [ ] Every enumerated host has pre-tool enforcement or documented post-action limit.
- [ ] Default checkout denies all repository mutation classes.
- [ ] Idempotent lifecycle and symlink invariance pass.
- [ ] Override is time/reason/session bounded.
- [ ] No ORM/schema migration applies.

## External State

| # | Environment | What state | Coupling | Lifecycle wiring |
|---|---|---|---|---|
| 1 | Host filesystem | installed hook symlinks relied on but not repointed | coupled | invariance hash test and setup prohibition |
| 2 | Host config | host hook registry entries | coupled | each wirer add/prune/dry-run contract |
| 3 | Linked worktrees | branches, worktree dirs, binding state | coupled | ensure create/resume/cleanup |
| 12 | Downstream framework artifacts | route/worktree/list contracts | coupled | manifest lint and tier-1 |
| 15 | Runtime filesystem | lock and emergency override receipt | coupled | TTL cleanup and test isolation |

Untouched environments (walked the taxonomy, found nothing): 4, 5, 6, 7, 8, 9, 10, 11, 13, 14.

## Simulation Report

| Check | Result | Evidence |
|---|---|---|
| CREATE targets absent | PASS | inventory confirms four new paths absent |
| Existing entry points | PASS | worktree, route, list and host wirers enumerated |
| Policy conflicts | PASS | WORKTREES direct-doc exception explicitly superseded |
| Dependency | PASS | WI-484 supplies binding lifecycle |
| Scenario walk | PASS | default/read/worktree/temp/override map to tasks 1–5 |

No unresolved simulation failure remains. Handoff stops before execute-changeset.
