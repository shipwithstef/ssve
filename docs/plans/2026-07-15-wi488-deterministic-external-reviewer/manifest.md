# WI-488 Changeset: Deterministic external reviewer invocation

- **Spec:** `docs/specs/features/wi-488-deterministic-external-reviewer.md`
- **Diagnosis:** `docs/specs/bugfix/wi-488-external-reviewer-brief.md`
- **Technical contract map:** `docs/specs/contract-maps/wi-488-external-review-invocation.md`
- **Branch:** `framework-WI-488-external-reviewer`
- **Worktree:** `.worktrees/framework-WI-488-external-reviewer`
- **Owner session:** `019f65ab-11b7-7db0-a6fe-a85fea90d525`
- **Lane:** framework
- **Delivery tier:** FULL
- **Archetype:** architectural change with a bounded cross-cutting consumer migration
- **Planning mode:** invariants first, then complete active independent-review entry-point enumeration
- **Execution mode:** inline
- **Planning reasoning:** high
- **Execution reasoning:** medium
- **Base:** `origin/main` at `67e325fd3ee0bddb4504a783fe0b8d227a46deff`
- **Status:** REVIEWED_AND_FROZEN
- **Created:** 2026-07-15
- **Preserved preflight residue:** immutable stash commit `372699e5c001383e55f75a911d87149b5f0518f8` (currently `stash@{0}`), message `preserve-preflight-residue-before-WI-488-WI-486-WI-487-2026-07-15`; contains only modified `.svc/competitive-monitor-triggers.jsonl` and untracked docs/status/wi-476-summary.html through wi-480-summary.html; never drop, restore, or include it in a WI checkpoint

## Implementation Summary

Replace host-only reviewer selection and consumer-local Claude/Codex commands with one zero-dependency Node launcher that owns tuple policy, CLI isolation, failure classification, fallback, schema validation, stream separation, cache publication, and invocation receipts. Migrate every active independent-review consumer in the accepted scope. Preserve unrelated worker, eval, image-generation, Kimi, Gemini, historical, and immutable-receipt surfaces.

### Invariants

| Invariant | Required outcome |
|---|---|
| Cross-family independence | Claude orchestration requests Codex 5.6 sol/high; Codex orchestration requests Fable 5/high |
| No silent degradation | Missing/unsupported capability, Codex primary failure, tuple mismatch, or unclassified provider failure hard-fails with one actionable diagnostic |
| Bounded fallback | Only classified Fable model-unavailable, model-entitlement, or provider-overload can start one separate Opus/xhigh attempt |
| Authentication preservation | Codex keeps `CODEX_HOME` authentication; Claude safe mode keeps OAuth/keychain access and never uses `--bare` |
| Isolation | Review packages use stdin; provider processes are read-only/non-persistent/tool-free as applicable; argv is never shell-interpreted |
| Evidence integrity | Findings and every terminal receipt are schema-valid; requested, invoked, and effective tuples cannot be conflated |
| Cache integrity | Key binds exact package bytes, tuple, schema, launcher version, and fixture bit; only no-fallback exact-primary success is reusable |
| Spend control | Primary invocation is the probe; there is no paid smoke call; Codex is bounded by the launcher timeout and exactly-one-attempt rule; Claude additionally has `--max-budget-usd`; call count and kill switch are enforced on both |
| Test isolation | Tier 1 uses fake executables and cannot reach paid CLIs |
| Scope integrity | WI-486 and WI-487 behavior remains untouched; the three known Tier-1 failures remain honestly classified |

### Entry-point universe

| Family | Count | Entries | Disposition |
|---|---:|---|---|
| Direct Claude/Codex independent-review consumers | 3 | `review-plan-codex.sh`, `blind-floor-judge.sh`, `prompt-floor-judge.sh` | Route through launcher |
| Obsolete direct Codex review examples | 2 | two blocks in `review-cross-model/SKILL.md` | Replace with stdin launcher examples |
| Resolver-dependent review contracts | 8 | `review-plan`, `review-exec`, `review-cross-model`, `blind-control-plan`, `craft-prompt`, authoring rubric, plan-review protocol, security concern | Consume policy/receipt contract |
| Host-facing resolver summaries | 7 | AGENTS, CLAUDE, GEMINI, KIMI, REPO_MODES, EXTERNAL_ADDONS, WORKTREES | Synchronize launcher semantics |
| Unrelated Claude/Codex invocations | enumerated by negative inventory | eval workers, extraction, image generation, generic dispatch, knowledge/history | Explicitly excluded |

No consumer in the declared universe is deferred.

## Files Planned

| File | Action | Task | Purpose |
|---|---|---|---|
| schemas/external-review-findings.schema.json | CREATE | task-1 | Shared findings envelope with consumer payload |
| schemas/external-review-receipt.schema.json | CREATE | task-1 | Attempt, tuple, failure, fallback, override, cache, artifact, and usage evidence |
| test-framework/evals/tier-1/validate-external-review-launcher.sh | CREATE | task-1 | Fixture-controlled argv/stdin/env/stream/failure/cache/inventory suite |
| scripts/run-external-review.mjs | CREATE | task-2 | Canonical launcher and semantic validator |
| `scripts/resolve-adversarial-reviewer.sh` | MODIFY | task-3 | Compatibility policy view; no paid availability probe |
| `scripts/review-plan-codex.sh` | MODIFY | task-3 | Thin plan-package adapter to launcher |
| `test-framework/evals/tier-1/validate-review-plan-readonly.sh` | MODIFY | task-3 | Assert launcher delegation and retained Kimi contract |
| `scripts/blind-floor-judge.sh` | MODIFY | task-4 | Thin blind-floor package adapter plus content binding |
| `scripts/prompt-floor-judge.sh` | MODIFY | task-4 | Thin prompt-floor package adapter plus content binding |
| `review-plan/SKILL.md` | MODIFY | task-5 | Canonical launcher dispatch and receipt contract |
| `review-exec/SKILL.md` | MODIFY | task-5 | Consume launcher findings plus invocation receipt |
| `review-cross-model/SKILL.md` | MODIFY | task-5 | Remove obsolete `codex -p` examples and use stdin launcher |
| `references/plan-review-protocol.md` | MODIFY | task-5 | Shared review package/findings/receipt protocol |
| `blind-control-plan/SKILL.md` | MODIFY | task-5 | Hard-fail missing primary capability; no graceful degraded review |
| `craft-prompt/SKILL.md` | MODIFY | task-5 | Canonical floor-review invocation |
| `craft-prompt/references/authoring-rubric.md` | MODIFY | task-5 | Launcher-based cross-family judge guidance |
| `concerns/security-cross-family-review.md` | MODIFY | task-5 | Actionable hard-failure policy for required review |
| `concerns/REGISTRY.json` | MODIFY | task-5 | Regenerated concern registry after source change |
| `references/model-registry.json` | MODIFY | task-5 | Record exact Fable, Opus, and Codex policy model identifiers |
| `AGENTS.md` | MODIFY | task-5 | Host-neutral launcher summary |
| `CLAUDE.md` | MODIFY | task-5 | Claude orchestrator primary tuple and launcher summary |
| `GEMINI.md` | MODIFY | task-5 | Remove stale selected/fallback resolver description |
| `KIMI.md` | MODIFY | task-5 | Remove stale selected/fallback resolver description |
| `REPO_MODES.md` | MODIFY | task-5 | Framework component summary |
| `EXTERNAL_ADDONS.md` | MODIFY | task-5 | Framework component summary |
| `WORKTREES.md` | MODIFY | task-5 | Framework component summary |
| `docs/specs/features/wi-488-deterministic-external-reviewer.md` | MODIFY | task-6 | Mark 69 ACs with implementation evidence after tests |
| `docs/specs/bugfix/wi-488-external-reviewer-brief.md` | CREATE-UPSTREAM | task-1 | Commit the diagnosis artifact that establishes scope and root cause |
| `docs/specs/contract-maps/wi-488-external-review-invocation.md` | CREATE-UPSTREAM | task-1 | Commit the baselined cross-system contract evidence |
| `docs/specs/decisions/wi-488-deterministic-external-reviewer.md` | CREATE-UPSTREAM | task-1 | Commit accepted architecture alternatives and decisions |
| `docs/specs/reviews/wi-488-design-tech-g4.md` | CREATE-UPSTREAM | task-1 | Commit G4 Fable-5/high findings and convergence evidence |
| `docs/specs/reviews/wi-488-exec-cross-model.md` | CREATE-EVIDENCE | task-6 | Commit review-exec attempts, tuple receipts, finding dispositions, and convergence verdict |
| `docs/specs/reviews/wi-488-g5-review-gate.md` | CREATE-EVIDENCE | task-6 | Commit G5 self-review, independent cross-review, convergence, and gate decision |
| `docs/specs/audit/wi-488-deterministic-external-reviewer-analysis.md` | CREATE-EVIDENCE | task-6 | Commit the full AC-traced implementation audit and specialist convergence |
| `docs/specs/features/test-evidence/WI-488/PROVIDER_FIDELITY_EVIDENCE.md` | CREATE-EVIDENCE | task-6 | Commit the provider-fidelity proof required by the cross-system gate |
| `docs/specs/test-evidence/WI-488/design-capability-probes.json` | CREATE-UPSTREAM | task-1 | Commit installed-CLI confirmation and falsification probes |
| `docs/plans/2026-07-15-wi488-deterministic-external-reviewer/progress.md` | CREATE | task-1..6 | Preserve TDD red/green checkpoints and task-level replay status |
| `docs/specs/test-evidence/WI-488/pre-post-evidence.json` | CREATE | task-6 | Machine-check the acceptance-critical launcher red/green comparison |
| `docs/specs/test-evidence/WI-488/old-new-path-probe.json` | CREATE | task-6 | Prove direct consumer invocation is replaced by canonical delegation |
| `docs/specs/test-evidence/WI-488/pre-change-tier1-baseline.md` | CREATE-UPSTREAM | task-1 | Commit immutable failing-test identity baseline |
| `docs/specs/test-evidence/WI-488/post-change-tier1-frozen.md` | CREATE | task-6 | Preserve frozen-tree 242-pass/2-pre-existing-fail identity set |
| `docs/plans/2026-07-15-wi488-deterministic-external-reviewer/manifest.md` | CREATE-UPSTREAM | task-1 | Commit the reviewed implementation authority |
| `docs/plans/2026-07-15-wi488-deterministic-external-reviewer/review-log.yaml` | CREATE-UPSTREAM | task-1 | Commit both review attempts, findings, responses, and convergence |
| `docs/specs/work-items/WI-488.md` | MODIFY | task-6 | Advance lifecycle only with receipts |
| `docs/specs/work-items/INDEX.md` | MODIFY | task-6 | Keep WI state index synchronized |
| `.svc/lane-tasks-WI-488.json` | MODIFY | all | Cross-host execution and phase receipts |
| `.gitignore` | MODIFY | task-6 | Keep launcher cache, provider artifacts, and assembled review packages machine-local |
| `.svc/pipeline-decisions.jsonl` | MODIFY | all | Mechanical, review, gate, audit, land, and verify decisions |
| `.svc/session-contract.jsonl` | PRESERVE | all | Existing exact WI/session/worktree binding; append only if a new turn requires it |

### Changeset Blueprint

Skipped because execution mode is `inline`: the same orchestrator that loaded the full accepted spec and technical design will implement the reviewed manifest. This does not relax file inventory, AC coverage, dependency order, or validation.

## Task Graph

```json
{"tasks":[
  {"id":"task-1","title":"Write shared schemas and the fixture-first launcher contract","blocked_by":[]},
  {"id":"task-2","title":"Implement deterministic policy, invocation, validation, fallback, receipt, and cache","blocked_by":["task-1"]},
  {"id":"task-3","title":"Migrate resolver and plan review adapter","blocked_by":["task-2"]},
  {"id":"task-4","title":"Migrate blind and prompt floor judges","blocked_by":["task-3"]},
  {"id":"task-5","title":"Migrate active contracts, concern registry, model registry, and host documentation","blocked_by":["task-4"]},
  {"id":"task-6","title":"Run replay, inventory, receipt, full-suite, and lifecycle closeout validation","blocked_by":["task-5"]}
]}
```

| Task | Files | AC coverage | Validation | Checkpoint |
|---|---|---|---|---|
| task-1 | schemas + fixture validator | EXTREV-05–06, 13, 43–47, 63 | JSON parse, `bash -n`, expected-red fixture bootstrap proving fake PATH only | `wi488-contract-fixtures` |
| task-2 | launcher | EXTREV-01–56, 63–64, 66–69 | validator `--runtime-only`, `node --check`, receipt-schema replay | `wi488-launcher-core` |
| task-3 | resolver, plan adapter, legacy validator | EXTREV-01–22, 43–57, 62–64, 66, 68–69 | plan adapter fixture, readonly validator, source inventory | `wi488-plan-consumer` |
| task-4 | floor adapters | EXTREV-12–56, 60, 62–64, 66–69 | floor replay with fake providers and content-binding assertions | `wi488-floor-consumers` |
| task-5 | skill/protocol/registry/host docs | EXTREV-57–62, 65 | manifest lint, concern registry rebuild/scan, Markdown AST, obsolete-command inventory | `wi488-contract-migration` |
| task-6 | spec/state/evidence only | EXTREV-01–69 | targeted suite, receipt/task graph validators, `git diff --check`, full Tier 1 | `wi488-verified-branch` |

All tasks are sequential because later adapters and documentation consume the exact launcher contract. No parallel implementation group is safe before task-2 freezes the public CLI and schema.

## Launcher Contract Fixed by the Plan

### Policy tuples

| Orchestrator | Requested primary | Effort | Fallback |
|---|---|---|---|
| Claude | `gpt-5.6-codex` / OpenAI / Codex 5.6 sol | high | none |
| Codex | `claude-fable-5` / Anthropic / Fable 5 | high | `claude-opus-4-8` at xhigh only after eligible classified primary failure |

The launcher rejects effort above policy unless `--owner-override-file` points to a readable JSON document whose requested tuple, `authority: repository-owner`, source, reason, and timestamp validate and whose exact byte hash equals the out-of-band `SVC_EXTERNAL_REVIEW_OWNER_OVERRIDE_SHA256` trust anchor. The receipt includes the file path, expected/actual hash, authority, source, and requested tuple, never credentials. A missing/mismatched anchor, unlisted authority, stale timestamp, or CLI flags alone cannot raise effort or change the model.

### Runtime controls

`SVC_EXTERNAL_REVIEW_DISABLED=1` is the non-overridable paid-action kill switch. It emits a `disabled` receipt and stops before cache lookup, lock acquisition, or process spawn. `SVC_EXTERNAL_REVIEW_TIMEOUT_SECONDS` defaults to 300 per provider attempt. `SVC_EXTERNAL_REVIEW_LOCK_STALE_SECONDS` defaults to 720 and startup rejects any value less than `2 * timeout + 60`, so the bound exceeds the maximum primary plus fallback wall time and promotion margin. The lock owner heartbeats its timestamp every 30 seconds through owner-token-checked atomic replacement.

### Codex argv and streams

The launcher spawns an argv array, never a shell string:

```text
codex exec --skip-git-repo-check --sandbox read-only --ephemeral
  --ignore-user-config --ignore-rules --strict-config
  --model gpt-5.6-codex -c model_reasoning_effort="high"
  --output-schema <findings-schema> --json
  --output-last-message <final-artifact> --color never -
```

It preserves `CODEX_HOME`, supplies the exact package bytes on stdin, captures JSONL events and stderr separately, and validates the separate final artifact. A launcher timer terminates the process group. `codex exec --help` is a free capability inspection, not a model call; all missing flags are reported in one upgrade diagnostic and no degraded argv runs.

### Claude argv and streams

The launcher spawns `claude --print` with full model, `--effort`, `--safe-mode`, `--tools ""`, strict empty MCP configuration, `--permission-mode plan`, `--no-session-persistence`, `--max-turns 1`, slash commands/browser disabled, `--json-schema`, JSON output, and `--max-budget-usd`. It never passes `--bare` or a same-invocation fallback option. A launcher timer bounds wall time. Runtime `modelUsage` must contain the requested model before findings are accepted.

### Failure and fallback state machine

`INPUT_INVALID` and `DISABLED` terminate before lock/cache/provider. Otherwise the launcher acquires the content-key lock, checks a semantically valid exact-primary receipt, and on miss performs the primary attempt. Codex failure always terminates. Fable failure is classified from structured provider codes first and ordered anchored diagnostic patterns second; final review content is never classification input. Only `model_unavailable`, `model_entitlement`, and `provider_overload` start one new Opus process. Authentication, shared quota, network, timeout, capability, schema, tuple mismatch, input, kill switch, and unknown failures terminate. Failed Opus ends after exactly two total attempts.

### Cache and publication

The SHA-256 key uses length-delimited exact stdin bytes, canonical requested-primary tuple JSON, exact findings-schema bytes, launcher version, and fixture-mode bit. A per-key lock spans lookup through atomic staging promotion. The lock record binds hostname, PID, launcher-process start token, random owner token, and heartbeat timestamp; same-host PID reuse is detected by start-token mismatch, foreign-host locks younger than the validated stale bound are never reclaimed, and owner tokens prevent one process from refreshing or removing another's lock. Cache reuse requires schema and semantic validity, success, no fallback, and equality of requested/invoked/effective primary tuples. Fallback evidence is durable but never reusable for a later primary request. `--gc-cache` removes unlocked staging directories and entries older than `SVC_EXTERNAL_REVIEW_CACHE_TTL_DAYS` (default 30), never follows symlinks, and skips every held lock; its fixture covers expiry, held locks, heartbeats, PID reuse, foreign-host age bounds, and invalid stale/timeout configuration.

### Output contract

On success stdout contains one machine-readable summary naming findings and receipt paths. Provider events, diagnostics, final findings, and receipt remain separate files. On failure stderr contains one launcher-owned actionable diagnostic; provider details remain in their artifact. Every terminal path, including input invalid, disabled, capability, timeout, schema, and fallback failure, emits a receipt.

## AC-to-Task and AC-to-Test Mapping

| ACs | Task(s) | Test type | Exact proof |
|---|---|---|---|
| EXTREV-01–04 | 2,3,6 | fixture | Claude-to-Codex and Codex-to-Fable tuple captures; missing Codex hard-fail call count |
| EXTREV-05–06 | 1,2,6 | schema + fixture | requested/invoked/effective tuple and availability/fallback/override fields validate |
| EXTREV-07–09 | 2,6 | fixture | over-effort rejection and valid/invalid owner-override provenance |
| EXTREV-10–11 | 2,6 | fixture | alias/runtime mismatch and declared/invoked mismatch hard-fail |
| EXTREV-12 | 2–4,6 | fixture | byte-exact stdin capture for plan and both floor packages |
| EXTREV-13 | 1,2,6 | schema | valid and malformed findings replay |
| EXTREV-14–21 | 2,6 | argv/env/stream fixture | exact Codex argv, preserved auth env, separated events/stderr/final, no color |
| EXTREV-22 | 2,6 | capability fixture | one diagnostic lists all missing required flags; provider call count zero |
| EXTREV-23–30 | 2,6 | argv/env/stream fixture | exact Claude flags, safe/not-bare, no tools/MCP, plan, no persistence, one turn, schema |
| EXTREV-31–33 | 2,6 | timer/argv/runtime fixture | Claude timeout, `--max-budget-usd`, and `modelUsage` confirmation; Codex timeout is EXTREV-66 and its one-attempt bound is proved by call count |
| EXTREV-34–36 | 2,6 | call-count fixture | each eligible failure produces Fable then one separate Opus attempt |
| EXTREV-37–42 | 2,6 | negative call-count fixture | each forbidden class produces one attempt and no hidden fallback option |
| EXTREV-43–47 | 1,2,6 | schema + semantic replay | all success/failure receipt fields, provenance, usage, artifact references, no secrets |
| EXTREV-48–54 | 2,6 | cache replay | each key input changes cache identity; exact primary receipt alone hits |
| EXTREV-55–56 | 2,6 | call-count fixture | primary doubles as probe; no preflight paid process |
| EXTREV-57 | 3,5,6 | inventory + adapter replay | plan review has launcher as sole external path |
| EXTREV-58–59 | 5,6 | inventory + receipt replay | cross-model and exec contracts use findings plus receipt |
| EXTREV-60 | 4–6 | inventory + floor replay | both floor adapters use launcher only |
| EXTREV-61 | 5,6 | negative grep | no active obsolete Codex profile/output-format review example |
| EXTREV-62 | 3–6 | allowlist inventory | no consumer-local direct Claude/Codex independent-review command |
| EXTREV-63 | 1,2,6 | fixture harness guard | scrubbed PATH exposes only fake CLIs; invocation log contains fixture roots only |
| EXTREV-64 | 2,3,6 | capability fixture | missing CLI/capability produces one hard failure, no degradation |
| EXTREV-65 | 5,6 | inventory exclusion test | archive/history/receipt paths are not migration targets |
| EXTREV-66 | 2,6 | timer fixture | one Codex attempt terminated and classified timeout |
| EXTREV-67 | 2,6 | call-count fixture | failed Opus path records exactly two total attempts |
| EXTREV-68 | 2,6 | zero-call fixture | disabled path ignores override and performs no cache lookup/spawn |
| EXTREV-69 | 2,6 | zero-call fixture | empty stdin performs no cache lookup/spawn and emits input-invalid receipt |

No AC is manual-only or N/A. Every AC has deterministic fixture, schema, replay, or inventory proof.

## Prerequisite Alignment Matrix

| Prerequisite | Status | Trace |
|---|---|---|
| UX transitions | N/A | Internal Enabler; contract state machine in the feature spec replaces user-screen flow |
| UI tokens/assets | N/A | No browser-visible or visual file is planned |
| Technical design | satisfied | baselined spec plus `docs/specs/contract-maps/wi-488-external-review-invocation.md` |
| Style contract | satisfied | zero-dependency ESM, portable Bash adapters, JSON Schema, existing Tier-1 conventions |
| Persona differentiation | N/A | System-only framework operator control; spec feasibility matrix records this for 69/69 ACs |
| Capability evidence | satisfied | `docs/specs/test-evidence/WI-488/design-capability-probes.json` confirms both installed CLI surfaces |
| G4 review | satisfied | `docs/specs/reviews/wi-488-design-tech-g4.md`, Fable 5/high PASS after seven accepted fixes |
| Upstream lane | satisfied | route-workflow, improve-framework delegation, diagnose-bug, write-spec, and design-tech have graph receipts |

## Validation Plan

### Targeted tests

```bash
node --check scripts/run-external-review.mjs
bash -n scripts/resolve-adversarial-reviewer.sh scripts/review-plan-codex.sh scripts/blind-floor-judge.sh scripts/prompt-floor-judge.sh test-framework/evals/tier-1/validate-external-review-launcher.sh
bash test-framework/evals/tier-1/validate-external-review-launcher.sh
bash test-framework/evals/tier-1/validate-review-plan-readonly.sh
node scripts/build-concern-registry.mjs
node scripts/scan-concerns.mjs --paths scripts/run-external-review.mjs scripts/review-plan-codex.sh scripts/blind-floor-judge.sh scripts/prompt-floor-judge.sh --json
node scripts/task-graph.mjs validate .svc/lane-tasks-WI-488.json
node scripts/validate-task-graph-lane.mjs .svc/lane-tasks-WI-488.json
node scripts/lint-skills-manifest.mjs
bash test-framework/evals/tier-1/validate-skill-structure.sh
bash test-framework/evals/tier-1/validate-contracts.sh
bash test-framework/evals/tier-1/validate-chain-references.sh
node test-framework/evals/tier-1/validate-markdown-ast.mjs
bash scripts/verify-plan-mechanical.sh docs/plans/2026-07-15-wi488-deterministic-external-reviewer/manifest.md
git diff --check
```

The concern scan is an evidence-producing classifier: exit 3/4 is expected when registered critical/high concerns match, and the gate verifies their required skills are present in the lane graph. Proposal validators run if proposal lifecycle fields change. JSONL validators run for every touched append-only state file. After the first WI commit, receipt validation uses exactly `node scripts/check-chain-receipts.mjs --sha HEAD`.

### Full branch policy

```bash
bash test-framework/evals/run-all-evals.sh
```

Expected comparison point: the pre-edit baseline is 240 passed, 3 failed, 0 timed out, but the landing decision is identity-based rather than count-based. The allowlist is exactly `validate-concern-registry-cross-host.sh`, `validate-shared-content-symlinks.sh`, and `validate-session-contract-freshness.sh`, as captured in `docs/specs/test-evidence/WI-488/pre-change-tier1-baseline.md`. The post-edit failing set must be a subset of that allowlist, with both before/after sets stored in task-6 evidence. The first two failures remain owned by WI-487; the freshness failure may disappear after the required session refresh and cannot mask a new failure. Landing follows the repository's actual full-suite policy; no waiver or false pass is allowed.

## Execution Command Sequence

```bash
test "$(git rev-parse --abbrev-ref HEAD)" = "framework-WI-488-external-reviewer"
git merge-base --is-ancestor 67e325fd3ee0bddb4504a783fe0b8d227a46deff HEAD
node scripts/validate-task-graph-lane.mjs .svc/lane-tasks-WI-488.json

# task-1: schemas and fake-provider fixture contract
node -e 'for (const p of ["schemas/external-review-findings.schema.json","schemas/external-review-receipt.schema.json"]) JSON.parse(require("fs").readFileSync(p,"utf8"))'
bash -n test-framework/evals/tier-1/validate-external-review-launcher.sh

# task-2: launcher core
node --check scripts/run-external-review.mjs
bash test-framework/evals/tier-1/validate-external-review-launcher.sh --runtime-only

# tasks 3-5: adapters and full active-source migration
bash test-framework/evals/tier-1/validate-review-plan-readonly.sh
bash test-framework/evals/tier-1/validate-external-review-launcher.sh
node scripts/build-concern-registry.mjs
node scripts/lint-skills-manifest.mjs

# task-6: freeze candidate and verify
git diff --check
node scripts/task-graph.mjs validate .svc/lane-tasks-WI-488.json
node scripts/validate-task-graph-lane.mjs .svc/lane-tasks-WI-488.json
bash test-framework/evals/run-all-evals.sh
```

`RECOVERY_IF_FAIL`: retain the isolated worktree and all provider/cache fixture artifacts; reset no user state. Correct only the current task, rerun its focused validator, then replay every downstream task. If a schema or public launcher option changes, invalidate all later adapter evidence and rerun tasks 2–6. If a provider capability is missing, stop with the actionable launcher failure; do not substitute a model, effort, CLI, or local-only proof.

Each logical checkpoint is recorded in the progress ledger after that task's diff is complete and its focused validation passes. The implementation stays uncommitted so task 6 can freeze one aggregate staged tree for review-exec, review-gate, audit, and the pre-commit chain receipts. The post-review commit carries the required chain receipts, after which `node scripts/check-chain-receipts.mjs --sha HEAD` must pass. That commit uses the repository author and active orchestrator co-author trailer; verification bypasses and force operations are prohibited.

## Checkpoint Plan

| Order | Checkpoint | Rollback anchor | Required proof |
|---:|---|---|---|
| 1 | `wi488-contract-fixtures` | base SHA | schemas parse, fake-only harness syntax |
| 2 | `wi488-launcher-core` | checkpoint 1 | runtime fixture matrix, no paid call |
| 3 | `wi488-plan-consumer` | checkpoint 2 | plan adapter and readonly validator |
| 4 | `wi488-floor-consumers` | checkpoint 3 | both floor replays and content binding |
| 5 | `wi488-contract-migration` | checkpoint 4 | inventory, concern, model, skill, host-doc checks |
| 6 | `wi488-verified-branch` | checkpoint 5 | receipt/task graph/diff/full-suite policy |

The reviewed implementation diff is frozen after task-6. Review-exec, review-gate, and audit-implementation all evaluate that same hash; findings reopen the implementation and require a new frozen hash plus repeated reviews.

## External State

| # | Environment | What state | Coupling | Lifecycle wiring |
|---:|---|---|---|---|
| 3 | Out-of-tree version control | isolated WI branch/worktree, later PR, and immutable preflight-residue stash commit `372699e5c001383e55f75a911d87149b5f0518f8` | coupled | exact session binding, branch checks, land/verify chain, hygiene removal after promotion; stash identity/content is reported but never restored or dropped in this wave |
| 12 | Downstream framework artifacts | skills, protocols, host summaries, concern registry, model registry | coupled | one manifest inventory, build-concern-registry, manifest/skill/Markdown validators, active-source negative inventory |
| 14 | External service credentials/auth | existing `CODEX_HOME` and Claude OAuth/keychain state is relied on but never mutated or copied | decoupled-justified | free capability checks, process env allow/preserve rules, credential-redaction receipt fixture, actionable auth failure |
| 15 | Runtime filesystem | `.svc/external-review-cache/v1` keys, locks, staging, events, diagnostics, findings, receipts | coupled | content identity; hostname/PID/start/owner/heartbeat lock identity; stale bound must exceed two attempt timeouts plus 60 seconds; schema/semantic hit validation; atomic promotion; version invalidation; lock-safe `--gc-cache` with default 30-day TTL |

Untouched environments (walked the taxonomy, found nothing): 1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 13.

Credential state is safely decoupled because the launcher is an authentication consumer, not an installer or secret manager. Drift is detected before paid execution through capability checks and at execution through typed auth failure receipts; recovery is to repair the existing CLI login outside this change, then rerun the same requested tuple. The launcher never writes auth paths into cache artifacts beyond non-secret CLI identity/version metadata.

## Simulation Report

| Check | Disk layer | Planned layer | Result |
|---|---|---|---|
| CREATE targets absent | launcher, schemas, and validator do not exist | task-1/task-2 create them | PASS |
| MODIFY targets exist | all adapters, contracts, registries, host docs, spec/state files verified | tasks 3–6 name exact owners | PASS |
| Smallest reversible slice | schemas and fake harness precede runtime | task-1 adds no paid path | PASS |
| Import/dependency resolution | Node core plus existing schema/state conventions | no package or lockfile change | PASS |
| Provider capability | installed Codex 0.144.4 and Claude 2.1.210 expose required controls | fake fixtures assert capability failures | PASS |
| Package transport | existing direct consumers build packages in memory/files | all pass exact bytes to launcher stdin | PASS |
| Fable success | current independent G4 call proved `claude-fable-5`/high runtime metadata | launcher accepts schema-valid exact-primary result | PASS |
| Eligible Fable failure | current resolver cannot distinguish it | classifier starts exactly one Opus process | PASS |
| Forbidden failure | current consumers may silently continue/fallback | receipt hard-fails without Opus | PASS |
| Codex unavailable | current resolver may select another CLI | exact Codex primary hard-fails | PASS |
| Concurrent identical request | no current shared cache authority | owner-token lock, one primary call, atomic publication; PID-reuse and foreign-host fixtures | PASS |
| Crash during publication | current consumers have no durable staging model | unpromoted staging never hits; stale lock bounded | PASS |
| Fallback replay | current outputs lack tuple-safe reuse rule | fallback receipt never satisfies primary request | PASS |
| Kill switch / empty stdin | no current boundary | both terminate before lock/cache/spawn with receipt | PASS |
| Rollback | direct consumers are recoverable from base | reverting checkpoint N invalidates every later dependent checkpoint; rebuild them and re-prove receipts; cache is version-keyed and non-authoritative | PASS |
| WI dependency boundary | WI-486/WI-487 not touched | promoted launcher becomes their review dependency only after merge | PASS |

Scenario walk: package → policy → cache miss → primary → schema/tuple validation → receipt maps to tasks 1–2; plan/floor consumers map to tasks 3–4; contract/inventory migration maps to task 5; failure, cache, receipt, and full-suite replay maps to task 6. No unresolved question, acknowledged warning, or simulation failure remains.

## Promotion Readiness Checklist

- [ ] Every planned file is accounted for; any discovered active review consumer reopens the manifest before edit.
- [ ] EXTREV-01 through EXTREV-69 all have passing proof and updated spec evidence.
- [ ] Tier-1 fixture PATH cannot invoke paid provider binaries.
- [ ] No active obsolete Codex profile/output-format review example remains.
- [ ] No consumer-local direct Claude/Codex independent-review invocation remains.
- [ ] Requested, invoked, and runtime-effective tuple semantics pass replay.
- [ ] Fable fallback allowlist and all forbidden classes pass exact call-count assertions.
- [ ] Cache exact-primary reuse and fallback non-reuse pass replay.
- [ ] `SVC_EXTERNAL_REVIEW_DISABLED=1`, provider timeout/budget, empty-input, heartbeat/stale-lock inequality, and failed-fallback bounds pass.
- [ ] Task graph and chain receipt validators pass for the frozen diff.
- [ ] `git diff --check` passes.
- [ ] Full Tier-1 has no new failures and satisfies the honest landing policy.
- [ ] Independent review-plan uses Fable 5 exactly high before execution.
- [ ] Review-exec, review-gate, and audit evaluate the same frozen implementation hash.
- [ ] PR is reviewed and merged; promoted `origin/main` behavior is re-run before WI-486 starts.
- [ ] No ORM schema is touched; the two JSON Schemas are versioned and fixture-validated, so no data migration task applies.

## Rollback

Before merge, reverting checkpoint N invalidates every later checkpoint built on it; revert or rebuild those dependent checkpoints, rerun their focused fixtures, freeze a new aggregate diff hash, and repeat independent review. After merge, use a normal revert PR that removes the launcher/schemas/test and restores all adapters/contracts/registries/host summaries in the same change. Existing cache artifacts are non-authoritative and keyed by launcher version; they cannot be reused by restored direct paths. Use lock-safe `--gc-cache` or delete only after confirming no launcher process holds a lock. Authentication state is untouched. Never use reset or force push. The preflight residue is anchored by immutable stash commit `372699e5c001383e55f75a911d87149b5f0518f8`; never drop, restore, overwrite, or include it without new owner authority.
