# WI-485 Changeset: Codex execution integrity

- **Spec:** docs/specs/work-items/WI-485.md
- **Program:** docs/plans/2026-07-14-wi481-change-impact-triad/PLAN.md
- **Branch:** framework-WI-485-codex-execution-integrity
- **Lane:** framework
- **Archetype:** architectural + cross-cutting host-control
- **Planning mode:** invariants first, then complete Codex entry-point enumeration
- **Execution mode:** dispatch
- **Planning base:** 22df12efdfc4d48dacf2acea8588d585ce0094a8
- **Execution base:** create from then-current verified origin/main after this plan is approved
- **Status:** REVIEWED_AND_FROZEN; implementation is not authorized by this planning run
- **Created:** 2026-07-14T10:48:02Z

## Implementation Summary

Replace Codex's shared-state continuation and inert Kimi skill gate with one Codex-only authority boundary. Preserve shared hook behavior and all non-Codex wirers byte-for-byte. The executor must treat missing identity as allow for Stop and deny for an in-scope mutation, never store raw prompts, and never infer authority from branch, one active graph, or the last session contract.

### Entry-point inventory and invariants

| Entry point | Current behavior | Required behavior |
|---|---|---|
| scripts/wire-codex-hooks.mjs | shared Stop, Kimi-only load script, shared 90-minute artifact receipt | stable Codex keys; composite Stop; exact-scope load gate; obsolete-key pruning |
| UserPromptSubmit | stale-state helper only | atomic authority record keyed by repo and session |
| Stop | shared completion guard can manufacture foreign continuation | authority firewall delegates only for exact current prompt binding |
| Bash/apply_patch/Edit/Write | no Codex-native task/skill proof | exact task, worktree, session, skill SHA receipt before governed mutation |
| scripts/task-graph.mjs load-skill | repository task receipt only | remains unchanged; codex-load-skill invokes it and adds runtime proof |
| setup --host codex | writes config but cannot prove trust/runtime | report configured, effective-single-Stop, trusted, runtime-observed separately |

## Files Planned

| File | Action | Responsibility |
|---|---|---|
| hooks/codex/lib/codex-hook-context.mjs | CREATE | normalize payload and resolve repo/runtime paths |
| hooks/codex/svc-codex-prompt-authority.mjs | CREATE | write prompt authority atomically |
| hooks/codex/svc-codex-stop-firewall.mjs | CREATE | authorize Stop, then spawn shared guard |
| hooks/codex/svc-codex-skill-load-enforcer.mjs | CREATE | exact-scope PreToolUse mutation gate |
| scripts/codex-load-skill.mjs | CREATE | print skill, load graph receipt, write runtime receipt |
| references/codex-hook-execution-integrity.md | CREATE | state machine, trust, limits, recovery |
| test-framework/evals/tier-1/validate-codex-execution-integrity.sh | CREATE | deterministic payload/config/invariance suite |
| `test-framework/evals/tier-1/validate-codex-hook-feature-flag.sh` | MODIFY | preserve hooks=true/idempotency checks; align corrected documentation assertions |
| test-framework/evals/tier-2/codex-execution-integrity/scenario.md | CREATE | controlled Codex runtime trace contract |
| scripts/wire-codex-hooks.mjs | MODIFY | managed-key replacement and effective Stop assertion |
| references/knowledge/domains/codex-hooks/CAPABILITIES.md | MODIFY | accurate support matrix |
| references/knowledge/domains/codex-hooks/details/configuration.md | MODIFY | concurrency, trust, flag semantics |

## Changeset Blueprint

The CREATE blueprints below are normative at statement granularity: names, fields, branches, exit decisions, and atomic-write order are fixed. The executor may vary only formatting and the path of an equivalent existing pure helper verified on the execution base; all such substitutions are recorded as manifest deviations before editing.

### hooks/codex/lib/codex-hook-context.mjs — complete contract

```js
export const SCHEMA_VERSION = 1;
export function parseHookInput(raw) { /* JSON object or empty object; never throw */ }
export function sessionId(p, env = process.env) { /* session_id, sessionId, CODEX_THREAD_ID, CODEX_SESSION_ID */ }
export function turnId(p) { /* turn_id or turnId, else empty */ }
export function toolName(p) { /* tool_name, toolName, tool.name */ }
export function mutationPayload(p) { /* command for Bash; patch/input for apply_patch/Edit/Write */ }
export function findRepoRoot(cwd) { /* git rev-parse --show-toplevel; null outside git */ }
export function repoIdentity(repoRoot) { /* sha256(realpath(repoRoot)).slice(0,24) */ }
export function runtimeRoot(env = process.env) { /* fallback chain + svc-codex; existing ancestors must be real dirs, current uid, 0700 */ }
export function sessionDir(repoRoot, sid, env) { /* runtimeRoot/repoIdentity/safe(sid) */ }
export function authorityPath(ctx) { return path.join(ctx.session_dir, "prompt-authority.json"); }
export function skillReceiptPath(ctx) { return path.join(ctx.session_dir, "skill-load.json"); }
export function atomicWriteJson(file, value) { /* mkdir 0700; temp 0600; fsync; rename */ }
export function readJson(file) { /* object or null; reject symlink, foreign owner, or mode other than 0600 */ }
export function explicitWI(text) { /* first exact WI-N token or empty */ }
export function continuationIntent(text) { /* continue|resume|end_to_end|none */ }
export function sha256(value) { return `sha256:${createHash("sha256").update(value).digest("hex")}`; }
export function isReadOnlyTool(ctx) { /* exact shared list in documentation payload; ambiguity is mutating */ }
export function activeTask(repoRoot) { /* exact one in_progress task across worktree-local lane graphs, else diagnostic */ }
export function bindingFor(repoRoot, sid, turn) { /* exact worktree-local binding only; no branch/last-contract authority */ }
```

### Prompt-authority hook — complete decision sequence

1. Read stdin once; normalize session, turn, cwd and repository.
2. Outside a git repository or without session/turn: emit `{}` and exit 0.
3. Extract prompt text only in memory. Compute its SHA-256, explicit WI, and continuation classification.
4. Atomically replace prompt-authority.json with schema_version, session_id, turn_id, prompt_hash, absolute cwd, absolute repo_root, explicit_wi, continuation_intent, recorded_at.
5. Omit prompt text, environment, credentials, command content, and git remotes.
6. Emit `{}`; authority-record failure emits a system advisory and still exits 0.
7. Opportunistically sweep sibling session directories older than TTL; delete only current-uid real directories below the exact repo-hash root.

### Composite Stop firewall — complete decision sequence

1. Normalize the Stop payload and read the exact session authority file.
2. Return `{}` when session or turn is absent; record is absent/malformed; record session/turn/cwd differs; or record age exceeds `SVC_CODEX_AUTHORITY_TTL_MIN` (default 240).
3. Resolve a target only from `authority.explicit_wi` or a worktree-local route binding whose session/turn match and whose timestamp is after `authority.recorded_at`.
4. Normalize the target claim through the pure claim helper. A fresh claim owned by a different host-session id returns `{}` before graph status is read. Plain continuation text never transfers ownership.
5. Require binding repo/worktree/branch agreement. Any ambiguity returns `{}`.
6. Spawn `bash hooks/svc-task-completion-guard.sh` with absolute cwd, payload on stdin, `SVC_WORKER_WI=target`, and current session id. Forward its JSON only when valid and scoped to target; otherwise return `{}`.
7. Never run a second svc Stop command; never depend on hook ordering.

### Skill-load enforcer — complete decision sequence

1. Fail open outside an svc repo or when no worktree-local task is in_progress.
2. Allow recognized read-only actions. Treat unknown Bash, apply_patch, Edit, Write, and write-capable MCP payloads as mutation.
3. On governed mutation require session id, absolute task graph, numeric task id, expected task skill, worktree root, and a skill-load record.
4. Compare receipt session, graph, task id, skill, skill path, current SHA-256, and worktree. Turn id is audit data and need not equal the current later turn.
5. Deny malformed or mismatched in-scope identity with Codex `hookSpecificOutput.permissionDecision="deny"` and the exact `node scripts/codex-load-skill.mjs --graph ... --task ... --skill ...` recovery command.
6. Allow only after all comparisons pass. Post-action tier-1 reuses the same verifier against changed governed artifacts.

### scripts/codex-load-skill.mjs — complete CLI contract

```text
Usage: node scripts/codex-load-skill.mjs --graph ABS --task N --skill NAME [--turn ID]
Exit 2: graph/task/declared skill mismatch, missing Codex session, wrong worktree, unreadable skill
Exit 1: atomic receipt or task-graph command failure
Exit 0: print complete SKILL.md, invoke task-graph.mjs load-skill GRAPH N NAME --via codex-load-skill,
        then atomically write schema_version, session_id, turn_id, task_graph, task_id, skill,
        skill_path, skill_sha256, worktree, loaded_at
```

The implementation must resolve NAME/SKILL.md from the installed Codex skills path first and verify it resolves to the current repository source or an installation produced by setup; no arbitrary path flag is accepted.

### scripts/wire-codex-hooks.mjs — exact modifications

- Delete `kimiHooksDir` and the Kimi script registry entry.
- Replace the shared authenticity entry for Codex with `svc-codex-skill-load-enforcer` on `Bash|apply_patch|Edit|Write` and eligible write-capable MCP names.
- Add `svc-codex-prompt-authority` to UserPromptSubmit.
- Replace `svc-task-completion-guard` in Stop with `svc-codex-stop-firewall`.
- Extend `keyOf` with stable keys for the three Codex entries and recognize the three obsolete commands for pruning.
- Compute `declaredKeys`; for every event, remove installed svc-keyed entries not declared by the current profile. Preserve unknown/user entries.
- Load repository .codex/hooks.json plus the user hooks file for the effective view. Exit 1 unless the union contains exactly one svc Stop and its key is `svc-codex-stop-firewall`.
- `--dry-run` performs merge and assertions without writes. `--list-all` stays deterministic.
- Before any host write, create a timestamped adjacent backup; rollback command restores that backup or reruns the prior commit's wirer.

### Documentation and tests — complete payload requirements

The reference defines states `unconfigured`, `configured`, `effective-single-stop`, `trusted`, `runtime-observed`; prompt-time TTL cleanup; `/hooks` trust; PreToolUse limits; recovery; rollback. It defines one shared read-only list: read tools plus Bash forms `git status|log|diff|show`, `ls`, `pwd`, `cat`, `sed -n`, `head`, `tail`, `rg` without replace flags, `find` without delete/exec, `test`, `wc`, `sha256sum`, and `node --check`; redirects, pipelines, subshells, command substitution, chaining, and unlisted options are mutating. The permanent tier-1 script asserts hermetic within-run payload, permissions, redaction, receipts, and single-Stop behavior with five interleavings. A separate one-time task-1/task-5 promotion snapshot compares non-Codex wirers before/after WI-485 and is not a committed permanent hash assertion. The 100-interleaving stress run is targeted/tier-2. Tier-2 records deny, post-load allow, and foreign Stop allow; unavailable runtime is SKIP, never PASS.

Post-merge runtime verification runs `./setup --host codex`, inspects `/hooks` trust, starts a controlled Codex trace, and records configured/effective/trusted/observed as four separate fields. If trust needs a human confirmation, promotion pauses at that checkpoint; it cannot substitute the temporary fixture.

## MODIFY Anchor Ledger

| File | Exact existing anchor | Disposition |
|---|---|---|
| scripts/wire-codex-hooks.mjs | `function buildHookEntries(skillsPath)` blocks `G-4 skill-artifact-authenticity`, `Skill load enforcer`, and `svc-task-completion-guard` | DELETE obsolete Codex entries; INSERT authority/exact-skill/composite-Stop at the same event blocks |
| scripts/wire-codex-hooks.mjs | `function keyOf(entry)` and `function mergeHooks()` | REPLACE key cascade; INSERT declared-key pruning, effective-layer assertion, and backup |
| scripts/wire-codex-hooks.mjs | `function ensureFeatureFlag()` | PRESERVE writing `hooks = true` and deleting `codex_hooks` |
| test-framework/evals/tier-1/validate-codex-hook-feature-flag.sh | `ACTIVE_PATHS=(` and `if ! grep -Fq "hooks = true" "$CONFIG"` | PRESERVE flag/idempotency checks; UPDATE only corrected documentation assertions |
| references/knowledge/domains/codex-hooks/CAPABILITIES.md | `## Capabilities` | REPLACE support rows with configured/effective/trusted/observed and coverage limits |
| references/knowledge/domains/codex-hooks/details/configuration.md | `## Feature Flag (Required)` and `## Matcher Semantics by Event` | REPLACE feature wording; INSERT concurrency, trust, and composite-Stop rules |

If the runtime root or an ancestor is a symlink, foreign-owned, or not mode 0700, Stop allows with advisory and mutation denies with `runtime root compromised — set XDG_RUNTIME_DIR`. Receipt files are accepted only at mode 0600.

## Task Graph

```json
{"tasks":[
  {"id":"task-1","title":"Freeze Codex and non-Codex baselines","blocked_by":[]},
  {"id":"task-2","title":"Write context, authority, Stop, and skill modules with tier-1 tests","blocked_by":["task-1"]},
  {"id":"task-3","title":"Replace and reconcile Codex wiring","blocked_by":["task-2"]},
  {"id":"task-4","title":"Document trust/runtime states and add controlled trace","blocked_by":["task-3"]},
  {"id":"task-5","title":"Run invariance, security, and full tier-1 validation","blocked_by":["task-4"]}
]}
```

| Task | Files | ACs | Validation | Checkpoint |
|---|---|---|---|---|
| task-1 | snapshots under test temp only | 7 | sha256sum + wirer --list-all | yes |
| task-2 | new Codex modules, load CLI, tier-1 | 1–6,10 | validate-codex-execution-integrity.sh | yes |
| task-3 | wire-codex-hooks.mjs | 7,8 | dry-run + temp user/repo config merge | yes |
| task-4 | references and tier-2 scenario | 8,9 | doc assertions + controlled trace | yes |
| task-5 | all | 1–10 | manifest lint + full tier-1 | yes |

## AC-to-Task and AC-to-Test Mapping

| AC | Task | Test type | Proof |
|---|---|---|---|
| AC-485-1 | 2,5 | fixture | recorded foreign Stop emits no block |
| AC-485-2 | 2 | unit/fixture | session+turn and post-prompt route table |
| AC-485-3 | 2 | fixture | foreign fresh claim before status |
| AC-485-4 | 2 | unit/runtime | pre-load deny, post-load allow |
| AC-485-5 | 2 | table test | foreign/task/worktree/hash/later-turn matrix |
| AC-485-6 | 2 | fixture | apply_patch aliases and docs/plans path |
| AC-485-7 | 1,3,5 | invariance | pre/post non-Codex hashes |
| AC-485-8 | 3,4 | integration/manual | configured/effective/trusted/observed receipts |
| AC-485-9 | 4 | static review | limits and post-action validation present |
| AC-485-10 | 2,5 | security | recursive runtime scan excludes prompt/secrets |

## Prerequisite Alignment Matrix

| Prerequisite | Status | Trace |
|---|---|---|
| UX/UI | N/A | headless host enforcement; no browser surface |
| Technical design | satisfied | FP-026 state machine and this blueprint |
| Style | satisfied | current ESM, hook JSON, shell conventions |
| Persona | N/A | framework operator/security control, no product persona |
| Security review | required | review-plan plus fresh different-family Fable review |
| Dependency | first pillar | no implementation dependency; WI-484 follows |

## Validation Plan

### Tier-1 promotion note

| Field | Decision |
|---|---|
| validator_path | test-framework/evals/tier-1/validate-codex-execution-integrity.sh |
| failure_class | foreign continuation and cross-session skill authority on a host-control hot path |
| promotion_signal | live WI-479 foreign Stop incident plus inert Kimi-only Codex loader |
| expected_runtime_budget | under 5 seconds; five hermetic interleavings |
| why_tier_2_or_targeted_is_insufficient | install/routing regressions must block every commit; 100-case stress and live trace remain targeted/tier-2 |

- Syntax: `node --check` for every new/modified mjs and `bash -n` for shell tests.
- Deterministic: tier-1 fixture covers AC-485-1..10 and 100 interleavings.
- Integration: temporary effective user+repo config has exactly one svc Stop.
- Invariance: all non-Codex source and registry/dry-run hashes identical.
- Runtime: controlled Codex trace and `/hooks` trust inspection; local fixture is not runtime proof.
- Framework: manifest linter, pipeline integrity, and full tier-1.

## Execution Command Sequence

```bash
git fetch origin main
test -z "$(git status --short)"
bash scripts/worktree.sh create framework-WI-485-codex-execution-integrity --from origin/main
cd .worktrees/framework-WI-485-codex-execution-integrity
bash test-framework/evals/tier-1/validate-codex-execution-integrity.sh
WI485_TMP="$(mktemp -d)"
node scripts/wire-codex-hooks.mjs --skills-path "$HOME/.codex/skills" --hooks-file "$WI485_TMP/wi485-hooks.json" --config "$WI485_TMP/wi485-config.toml" --dry-run
node scripts/lint-skills-manifest.mjs
bash test-framework/scripts/validate-pipeline-integrity.sh .
bash test-framework/evals/run-all-evals.sh
```

RECOVERY_IF_FAIL: preserve the worktree and temp fixture, do not update real host config, repair the failing task, rerun its focused test, then rerun the full sequence. Runtime trust failure stops promotion and reports configured-but-not-observed.

## Checkpoint Plan

One commit per task after its focused test. Every checkpoint includes the WI trailer and active orchestrator co-author trailer. No checkpoint writes real host config; setup verification occurs after reviewed merge authorization.

## Promotion Readiness Checklist

- [ ] All ten ACs pass with trace paths.
- [ ] Exactly one effective svc Stop is the composite firewall.
- [ ] Non-Codex hashes are byte-identical.
- [ ] No raw prompt or secret exists in runtime records.
- [ ] Trust and runtime-observed are reported separately.
- [ ] Rollback restores only Codex config and removes regenerable runtime state.
- [ ] No ORM/schema migration applies; the added JSON runtime schema is versioned and fixture-validated.

## External State

| # | Environment | What state | Coupling | Lifecycle wiring |
|---|---|---|---|---|
| 1 | Host filesystem | installed Codex hook commands and runtime session records | coupled | setup installs; prompt-time TTL sweep and rollback command remove |
| 2 | Host config | ~/.codex/hooks.json and config.toml feature flag | coupled | wirer backup, effective-view assertion, rollback restore |
| 3 | Out-of-tree version control | execution worktree and planning base | coupled | worktree.sh create/remove and PR chain |
| 12 | Downstream framework artifacts | Codex knowledge and setup contract | coupled | tier-1 invariance and manifest lint |
| 15 | Runtime filesystem | authority and skill receipts | coupled | 0700/0600 current-uid atomic files; prompt-time TTL sweep; safe deletion recovery |

Untouched environments (walked the taxonomy, found nothing): 4, 5, 6, 7, 8, 9, 10, 11, 13, 14.

## Simulation Report

| Check | Disk layer | Planned layer | Result |
|---|---|---|---|
| CREATE targets absent | verified by file inventory | introduced in task-2/task-4 | PASS |
| MODIFY targets exist | wirer and Codex knowledge files present | anchors enumerated | PASS |
| Import resolution | node core + existing task-graph CLI | context helper precedes consumers | PASS |
| Concurrency | current hooks may run concurrently | atomic records; composite Stop | PASS |
| Rollback | current wirer has no managed replacement rollback | backup/restore is task-3 | PASS |
| Scenario walk | foreign Stop, same-session route, pre/post skill load | maps to tasks 2–5 | PASS |

No unresolved question or simulation failure remains. The manifest stops at reviewed planning; execute-changeset requires separate user authorization.
