# Change Set Manifest: WI-506 Secure Runtime-Root Portability

**Spec:** `docs/specs/work-items/WI-506.md`
**Technical design:** `docs/specs/tech/runtime-root-portability.md`
**Decision:** `docs/specs/decisions/2026-07-22-runtime-root-portability/SOLUTION-CONFIDENCE.md`
**Branch:** `framework-WI-506-runtime-root-portability`
**Base:** `origin/main` at `7a700259aa0a4c6debb900728cee8a35aefc61ca`
**Created:** 2026-07-22
**Status:** SIMULATED
**Execution mode:** `inline`
**Archetype:** Cross-cutting concern with an architectural transaction boundary

## Implementation summary

Create one dependency-free secure runtime-root resolver and a thin shell CLI;
replace all direct ephemeral runtime-state selectors across consumers; move
claim, binding, bootstrap, and migration locks to one Git compare-and-swap
authority namespace shared by linked worktrees; preserve
valid-XDG and legacy Codex paths; make missing/unset XDG use a private home
fallback; keep existing unsafe roots fail-closed for authority consumers; and
make completion-pressure state explicitly advisory-only on resolver rejection.
Reorder `codex-load-skill` so runtime storage and current authority are proven
before graph activation, with exact forward retry as the only recovery for a
post-activation crash. Correct the plan-review phase classifier so the exact
mandatory outputs of upstream `blend-external` are recognized as pre-execution
artifacts without weakening executable-diff or durable exec-record denial.

### Invariants

- Claims, bindings, lease generations, task graph schemas, and receipt schemas do not change.
- SVC never creates the advertised XDG parent or `/run/user/<uid>`.
- Pre-existing private `SVC_CODEX_RUNTIME_DIR` leaves and the unset-XDG Codex fallback remain compatible; explicit configured roots are never implicitly created.
- Existing unsafe/symlinked/foreign roots never silently fall back for authority state.
- Predictable loader failures preserve graph and prior receipt bytes.
- A post-activation crash cannot authorize mutation; exact retry only forward-completes.
- Example Marketplace product files and native splash investigation remain untouched.
- Plan review exempts only the exact mandatory blend artifacts; matching
  exec-records and all executable/framework implementation paths still deny.
- No dependency, daemon, provider, schema, UI, or feature flag is introduced.

### Measured cross-cutting universe

Seven state-selection sites in six files must be migrated: Codex context,
ensure-worktree, binding locks, isolation override receipts, migration locks,
and two shell completion/compatibility locations. The `approvedTempRoots()` XDG
observation and scratch-only `os.tmpdir()` callers are explicitly outside this
universe because they classify external temp targets rather than store SVC
authority/pressure state.

## Files planned

### Production and test surface

| File | Action | Task | Purpose |
|---|---|---|---|
| hooks/lib/svc-runtime-root.mjs | CREATE | task-2-resolver | Canonical classification, secure leaf creation, and operation snapshot |
| scripts/svc-runtime-root.mjs | CREATE | task-2-resolver | Path-only CLI for shell consumers |
| `hooks/codex/lib/codex-hook-context.mjs` | MODIFY | task-2-resolver | Delegate Codex runtime root while preserving legacy override/fallback |
| `scripts/svc-ensure-worktree.mjs` | MODIFY | task-3-consumers | Repository-shared Git CAS bootstrap lock, independent of runtime roots |
| `hooks/lib/wi-claim.mjs` | MODIFY | task-3-consumers | Shared Git ref correctness lock with exact-old-object dead-holder takeover and release |
| `hooks/svc-worktree-isolation-guard.mjs` | MODIFY | task-3-consumers | Shared resolver for override receipt only; preserve temp-target classifier |
| `scripts/svc-migrate-task-state.mjs` | MODIFY | task-3-consumers | Shared Git CAS task-state migration lock |
| `hooks/svc-task-completion-guard.sh` | MODIFY | task-3-consumers | Use CLI at both sites; advisory-only on resolver rejection |
| `scripts/codex-load-skill.mjs` | MODIFY | task-4-loader | Preflight-before-activation and exact retry/idempotent receipt publication |
| `scripts/run-external-review.mjs` | MODIFY | task-5-review-phase | Exact pre-execution blend-artifact classification without weakening exec-record denial |
| test-framework/evals/tier-1/validate-runtime-root-portability.sh | CREATE | task-1-tests | Classification, mode, consumer, shell, pattern, and timing matrix |
| `test-framework/evals/tier-1/validate-codex-first-task-activation.sh` | MODIFY | task-1-tests/task-4-loader | Preflight byte identity, after-activation failpoint, exact retry, no-write complete retry |
| `test-framework/evals/tier-1/validate-default-checkout-isolation.sh` | MODIFY | task-1-tests | Add shared resolver to hermetic copied-module fixtures |
| `test-framework/evals/tier-1/validate-codex-execution-integrity.sh` | MODIFY | task-1-tests | Add shared resolver to copied Codex fixtures and assert legacy fallback |
| `test-framework/evals/tier-1/validate-session-worktree-binding.sh` | MODIFY | task-1-tests | Add shared resolver fixture and preserve valid-XDG completion path |
| `test-framework/evals/tier-1/validate-task-state-compatibility.sh` | MODIFY | task-1-tests | Add resolver dependency to migration fixture |
| `test-framework/evals/tier-1/validate-actionable-hook-denial.sh` | MODIFY | task-1-tests | Supply CLI/library in copied completion-guard fixtures |
| `test-framework/evals/tier-1/validate-all-host-install-migration.sh` | MODIFY | task-1-tests | Supply CLI/library and prove all-host installed source completeness |
| `test-framework/evals/tier-1/validate-self-heal-survives-double-dead-pointer.sh` | MODIFY | task-1-tests | Supply resolver bridge to isolated completion-guard source fixture |
| `test-framework/evals/tier-1/validate-external-review-launcher.sh` | MODIFY | task-1-tests/task-5-review-phase | Blend-only allow, executable-path deny, and durable exec-record deny fixtures |
| `test-framework/evals/tier-1/validate-operation-scope-authority.sh` | MODIFY | task-1-tests | Supply the pre-existing private legacy Codex runtime leaf required by the reviewed explicit-root contract |
| `references/codex-hook-execution-integrity.md` | MODIFY | task-6-docs | Replace manual runtime workaround guidance with permanent classification/remediation contract |

### Governance, research, and closeout surface

| File | Action | Task | Purpose |
|---|---|---|---|
| `.svc/lane-tasks-WI-506.json` | CREATE | pipeline | Durable task/phase graph |
| `.svc/audit-implementation-concerns.json` | CREATE | audit-implementation | Durable concern-routing scan for the implementation audit |
| `.svc/competitive-monitor-triggers.jsonl` | MODIFY | pipeline | Append-only task-subject trigger telemetry emitted by the canonical skill load |
| `.svc/pipeline-decisions.jsonl` | MODIFY | pipeline | Route, design, plan, review, and gate decisions |
| `.svc/wi506-review-exec-self.json` | CREATE | review-exec | Final self-review and certified content binding |
| `.svc/review-security-concerns-final.json` | CREATE | review-security | Final security-specialist concern result |
| `.svc/session-contract.jsonl` | MODIFY | pipeline | WI/session authority contract |
| `.svc/wi506-cross-system-probe.json` | CREATE | execute-changeset | Same-input old/new runtime-path proof |
| `.svc/wi506-pre-post-evidence.json` | CREATE | execute-changeset | Classified pre/post validation loop evidence |
| `docs/specs/work-items/WI-506.md` | CREATE/MODIFY | task-6-docs | AC state and final evidence |
| `docs/specs/work-items/INDEX.md` | MODIFY | task-6-docs | WI lifecycle index |
| `docs/specs/research-log.md` | MODIFY | research | Official XDG/session-manager/cache evidence |
| `docs/specs/contract-maps/svc-runtime-root-resolution.md` | CREATE/MODIFY | design/task-6-docs | Cross-runtime contract and old/new proof |
| `docs/specs/audit/wi506-runtime-root-portability-analysis.md` | CREATE | audit-implementation | Full AC, subsystem, hypothesis, specialist, and pre/post audit |
| `docs/specs/reviews/wi506-runtime-root-portability-exec-cross-model.md` | CREATE | review-exec | Final different-family execution review and finding dispositions |
| `docs/specs/reviews/wi506-runtime-root-portability-exec-review-log.yaml` | CREATE | review-exec | Bounded-round convergence record |
| `docs/specs/security/wi506-runtime-root-portability-review.md` | CREATE | review-security | OWASP/STRIDE review and remediation proof |
| `docs/specs/tech/runtime-root-portability.md` | CREATE/MODIFY | design/task-6-docs | Baselined architecture and G4 outcome |
| `docs/specs/decisions/2026-07-22-runtime-root-portability/SOLUTION-CONFIDENCE.md` | CREATE/MODIFY | design/task-6-docs | Selected direction and action proof gates |
| `docs/specs/explorations/runtime-root-portability/PROBLEM_BRIEF.md` | CREATE | exploration | AC-derived problem framing |
| `docs/specs/explorations/runtime-root-portability/SOLUTION_MAP.md` | CREATE | exploration | Five paradigms/seven approaches |
| `docs/specs/explorations/runtime-root-portability/ANALYSIS.md` | CREATE | exploration | RP tradeoff matrix |
| `docs/specs/explorations/runtime-root-portability/COMPARISON.md` | CREATE | exploration | Finalist classifier comparison |
| `docs/specs/explorations/runtime-root-portability/DECISION.md` | CREATE | exploration | Baseline confirmation |
| `docs/specs/explorations/runtime-root-portability/prototypes/classification-matrix.mjs` | CREATE | exploration | Design-only classification probe |
| `docs/plans/2026-07-22-wi506-runtime-root-portability/manifest.md` | CREATE/MODIFY | plan/review | Reviewed execution contract |
| `docs/plans/2026-07-22-wi506-runtime-root-portability/retro-plan-review-authorization.json` | CREATE | review | Fresh SHA-bound repository-owner authorization for the one WI-506 classifier deadlock |
| docs/plans/2026-07-22-wi506-runtime-root-portability/review-log.yaml | CREATE | review | Canonical findings, receipts, responses, convergence, and exception audit |
| docs/plans/2026-07-22-wi506-runtime-root-portability/review-round1-findings.json | CREATE | review | Durable canonical Tier-2 findings |
| docs/plans/2026-07-22-wi506-runtime-root-portability/review-round1-receipt.json | CREATE | review | Durable canonical launcher and owner-exception receipt |
| docs/plans/2026-07-22-wi506-runtime-root-portability/review-convergence-findings.json | CREATE | review | Mandatory infra-path convergence findings |
| docs/plans/2026-07-22-wi506-runtime-root-portability/review-convergence-receipt.json | CREATE | review | Mandatory infra-path convergence launcher receipt |
| docs/plans/2026-07-22-wi506-runtime-root-portability/review-round3-findings.json | CREATE | review | Final bounded convergence findings |
| docs/plans/2026-07-22-wi506-runtime-root-portability/review-round3-receipt.json | CREATE | review | Final bounded convergence launcher receipt |
| docs/plans/2026-07-22-wi506-runtime-root-portability/implementation-paths.txt | CREATE | plan/review | Exact staged-path allowlist for execute handoff |
| `proposals/2026-07-22-framework-improvement-runtime-root-portability.md` | CREATE then MOVE | improve-framework then verify-promotion | Accepted improvement; initial file lands with implementation, move occurs only after promoted proof |
| `proposals/2026-07-22-blend-runtime-state-portability.md` | CREATE then MOVE | blend-external then verify-promotion | Peer decision; initial file lands with implementation, move occurs only after promoted proof |
| `references/blend-registry.json` | MODIFY | blend | Exact peer pins and dispositions |
| `NOTICES` | MODIFY | blend | gstack conceptual-pattern attribution |
| `references/knowledge/INDEX.md` | MODIFY | blend | Targeted knowledge snapshot index |
| `references/knowledge/runtime-state-portability/.version` | CREATE | blend | Exact four-source pins |
| `references/knowledge/runtime-state-portability/CAPABILITIES.md` | CREATE | blend | Targeted capabilities |
| `references/knowledge/runtime-state-portability/details/runtime-state.md` | CREATE | blend | Mechanisms and SVC analysis |
| `references/knowledge/source-heuristics.global.jsonl` | MODIFY | research | Primary-source runtime heuristic |
| `references/knowledge/svc/CAPABILITIES.md` | MODIFY | verify-promotion | Add capability only after installed replay proof; not part of the implementation staging allowlist |
| `FRAMEWORK-STATE.md` | MODIFY | verify-promotion | Record analysis, decision, promoted evidence, and closed gap after live replay; not part of the implementation staging allowlist |

### Changeset blueprint

Skipped because execution mode is `inline`: this orchestrator retains the full
design, source, and test context and will apply the reviewed manifest directly.
The plan-manifest receipt must record `mode: inline`; absent mode fails closed to
dispatch semantics.

## Task graph

| Task | Title | Files | Dependencies | AC coverage | Validation | Checkpoint |
|---|---|---|---|---|---|---|
| task-0-owner-auth | Bind the explicit repository-owner review exception | Authorization JSON, decision ledger, canonical review receipt | none | RP-18 | Validate exact JSON fields/freshness/SHA; require canonical receipt `allow-override` with matching expected/actual SHA | `wi506-owner-review-authorization` |
| task-1-tests | Author RED contract and fixture-completeness tests | New focused validator; 9 existing fixture/activation validators | task-0-owner-auth | RP-01..RP-12, RP-16, RP-17 | Syntax checks; run focused validators and record expected failures before implementation | `wi506-tests-red` |
| task-2-resolver | Implement shared resolver, CLI, and Codex adapter | Shared module, CLI, Codex context | task-1-tests | RP-01..RP-07, RP-10, RP-11 | Focused resolver matrix + Codex integrity | `wi506-shared-resolver` |
| task-3-consumers | Migrate ephemeral selector sites and preserve one exact-CAS correctness lock namespace | Ensure, claim, isolation, migration, completion shell | task-2-resolver | RP-05..RP-07, RP-10..RP-12 | Focused consumer/pattern matrix + two-contender dead-lock/binding/isolation/migration/Stop fixtures | `wi506-consumer-parity` |
| task-4-loader | Reorder loader and prove exact crash recovery | Codex loader + activation fixture | task-2-resolver, task-3-consumers | RP-08..RP-11, RP-14, RP-15 | Activation failpoint suite + Codex integrity | `wi506-loader-transaction` |
| task-5-review-phase | Correct pre-execution artifact classification | External-review launcher + phase fixtures | task-1-tests | RP-16, RP-17 | Blend-only allow, executable-path deny, exec-record deny, zero-spawn refusal proof | `wi506-review-phase-classifier` |
| task-6-docs | Align implementation docs and run focused branch verification | Integrity reference, WI/design/map/decision, plan/review, current proposal files | task-3-consumers, task-4-loader, task-5-review-phase | RP-01..RP-18 | All focused validators, map/lane validators, exact staged-path equality, diff/residue audit | `wi506-implementation-complete` |

Execution is sequential where shared files overlap. No subagent or parallel edit
group is authorized. `test-framework`, reviews, land, install refresh, and live
replay remain separate lane tasks after implementation.

## AC-to-task mapping

| AC | Tasks |
|---|---|
| RP-01 | task-1-tests, task-2-resolver, task-6-docs |
| RP-02 | task-1-tests, task-2-resolver |
| RP-03 | task-1-tests, task-2-resolver, task-3-consumers |
| RP-04 | task-1-tests, task-2-resolver |
| RP-05 | task-1-tests, task-2-resolver, task-3-consumers |
| RP-06 | task-1-tests, task-2-resolver, task-3-consumers |
| RP-07 | task-1-tests, task-2-resolver, task-3-consumers |
| RP-08 | task-1-tests, task-4-loader |
| RP-09 | task-1-tests, task-4-loader |
| RP-10 | task-1-tests, task-2-resolver, task-3-consumers |
| RP-11 | task-1-tests, task-2-resolver, task-3-consumers, task-4-loader |
| RP-12 | task-6-docs plus downstream test-framework |
| RP-13 | task-6-docs plus downstream land/verify-promotion |
| RP-14 | task-4-loader plus downstream verify-promotion |
| RP-15 | task-4-loader, task-6-docs, downstream verify-promotion |
| RP-16 | task-1-tests, task-5-review-phase |
| RP-17 | task-1-tests, task-5-review-phase |
| RP-18 | task-0-owner-auth, task-6-docs |

## AC-to-test mapping

| AC | Type | Test/proof |
|---|---|---|
| RP-01 | E2E | Focused no-XDG and missing-XDG CLI/consumer matrix |
| RP-02 | Unit | Resolver valid-XDG classification and preserved leaf paths |
| RP-03 | Unit | Non-dir, symlink, unsafe mode, foreign owner/unsupported-owner simulation deny matrix |
| RP-04 | Unit | Explicit override relative/missing/unsafe/valid cases |
| RP-05 | E2E | All consumer probes plus direct-selector pattern gate |
| RP-06 | E2E | Shell bridge matches Node classification; unsafe rejection writes nothing and becomes advisory |
| RP-07 | Unit | Directory/file mode checks and no advertised-parent creation assertion |
| RP-08 | E2E | Loader invalid storage/authority/task cases preserve graph and receipt hashes |
| RP-09 | E2E | After-activation failpoint, exact retry, complete retry byte identity |
| RP-10 | E2E | Existing Codex integrity/default checkout/binding/migration fixtures |
| RP-11 | E2E | `validate-runtime-root-portability.sh` matrix and fixture-copy completeness |
| RP-12 | E2E | Focused set plus `test-framework/evals/run-all-evals.sh`; classify unrelated baseline separately |
| RP-13 | Manual | Run setup for every declared host then `check-install-drift.sh` for every host at final SHA |
| RP-14 | Manual | Original Example Marketplace WI-496 installed loader command twice under original host env |
| RP-15 | Manual | Replay environment audit plus Example Marketplace tracked-tree and graph/receipt comparison |
| RP-16 | E2E | Phase fixture changes only exact blend outputs and proves plan review reaches one provider call |
| RP-17 | E2E | Phase fixtures prove executable diff and matching exec-record each deny with zero provider calls |
| RP-18 | Audit | Canonical review receipt records owner, kind, WI, source, freshness, and matching override SHA |

## Review exception prerequisite

This prerequisite was executed before any implementation. The repository owner
authorized exactly one WI-506 retro-plan review in the active session after the
canonical guard refused with zero provider calls. The authorization document is
not regenerated during execution. One review sequence includes the mandatory
infra-path convergence invocation. Its provenance is the owner message plus the
append-only `.svc/pipeline-decisions.jsonl` record. The current override parser
has no signature mechanism; the trust proof available to this repository is the
same-session owner instruction, fresh timestamp, WI/kind/source binding, and
SHA equality recorded by the canonical launcher.

```bash
AUTH=docs/plans/2026-07-22-wi506-runtime-root-portability/retro-plan-review-authorization.json
node -e 'const fs=require("fs");const a=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(a.authority!=="repository-owner"||a.kind!=="retro-plan-review"||a.wi!=="WI-506"||a.source!=="user-message-2026-07-22-WI-506"||!a.reason||!Number.isFinite(Date.parse(a.timestamp))||Date.now()-Date.parse(a.timestamp)>86400000||Date.parse(a.timestamp)-Date.now()>300000)process.exit(1)' "$AUTH"
EXPECTED_AUTH_SHA=cf284b66a1f7d38e3391d8d256c093260e53035d3eb9f682a9af563b45f5ddad
printf '%s  %s\n' "$EXPECTED_AUTH_SHA" "$AUTH" | sha256sum -c -
SVC_EXTERNAL_REVIEW_PHASE_OVERRIDE_FILE="$PWD/$AUTH" \
SVC_EXTERNAL_REVIEW_PHASE_OVERRIDE_SHA256="$EXPECTED_AUTH_SHA" \
SVC_HOST="${SVC_HOST:-claude}" \
bash scripts/review-plan-codex.sh docs/plans/2026-07-22-wi506-runtime-root-portability/manifest.md \
  > docs/plans/2026-07-22-wi506-runtime-root-portability/review-round1-findings.json \
  2> /tmp/wi506-review-round1.err
RECEIPT_SOURCE="$(sed -n 's/^review-plan-codex: receipt=//p' /tmp/wi506-review-round1.err | tail -1)"
test -n "$RECEIPT_SOURCE" && test -f "$RECEIPT_SOURCE"
cp "$RECEIPT_SOURCE" docs/plans/2026-07-22-wi506-runtime-root-portability/review-round1-receipt.json
node -e 'const fs=require("fs"),path=require("path");const receipt=path.resolve(process.argv[1]),auth=path.resolve(process.argv[2]),expected=process.argv[3];const r=JSON.parse(fs.readFileSync(receipt,"utf8"));const o=r.phase_guard.override;const same=JSON.stringify(r.requested_tuple)===JSON.stringify(r.effective_tuple);if(!same||r.requested_tuple.model!=="gpt-5.6-sol"||r.requested_tuple.effort!=="high"||r.phase_guard.wi!=="WI-506"||r.phase_guard.decision!=="allow-override"||o.authority!=="repository-owner"||o.source!=="user-message-2026-07-22-WI-506"||o.path!==auth||o.kind!=="retro-plan-review"||o.expected_sha256!==expected||o.actual_sha256!==expected)process.exit(1)' docs/plans/2026-07-22-wi506-runtime-root-portability/review-round1-receipt.json "$AUTH" "$EXPECTED_AUTH_SHA"
node -e 'const fs=require("fs"),path=require("path");const f=JSON.parse(fs.readFileSync(path.resolve(process.argv[1]),"utf8"));if(f.schema_version!==1||f.review_kind!=="plan"||!Array.isArray(f.findings)||!Number.isInteger(f.rubric_score))process.exit(1)' docs/plans/2026-07-22-wi506-runtime-root-portability/review-round1-findings.json
```

Any field, freshness, SHA, WI, or canonical-receipt mismatch halts before
implementation. Future plan reviews do not use this exception; RP-16 removes
the false-positive classifier state that required it.

## Lane Compliance

The durable graph `.svc/lane-tasks-WI-506.json` is the source of truth. Required
upstream leaf skills are complete with phase receipts; the one spanning
orchestrator and all downstream skills remain pending and cannot be treated as
satisfied early.

| Skill | Graph task | Status at plan review | Artifact/receipt authority |
|---|---:|---|---|
| route-workflow | 1 | completed | `.svc/route-workflow-self-verify.log`; graph P1-P6 receipt |
| improve-framework | 2 | pending orchestrator | graph P1-P4 receipt; completion blocked by task 15 |
| research | 3 | completed | `docs/specs/research-log.md`; graph P1-P6 receipt |
| blend-external | 16 | completed | `proposals/2026-07-22-blend-runtime-state-portability.md`; graph P1-P6 receipt |
| design-tech | 4 | completed | `docs/specs/tech/runtime-root-portability.md`; graph P1-P6 receipt |
| explore-solutions | 5 | completed | `docs/specs/explorations/runtime-root-portability/DECISION.md`; graph P1-P6 receipt |
| plan-changeset | 6 | completed | this manifest; graph P1-P6 receipt |
| review-plan | 7 | in progress | `review-log.yaml` plus canonical receipt required before completion |
| execute-changeset | 8 | pending | blocked by task 7 |
| review-gate | 9 | pending | blocked by task 8 |
| review-exec | 10 | pending | blocked by task 9 |
| review-security | 11 | pending | blocked by task 10 |
| audit-implementation | 12 | pending | blocked by task 11 |
| test-framework | 13 | pending | blocked by task 12 |
| land-changeset | 14 | pending | blocked by task 13 |
| verify-promotion | 15 | pending | blocked by task 14 |

Skipped conditional skills and their exact skip-condition IDs/evidence remain in
`delivery_graph.delivery_tier.skipped_skills` in the same graph. Before
promotion, run `node scripts/validate-task-graph-lane.mjs
.svc/lane-tasks-WI-506.json`; any table/graph disagreement blocks execution.
`improve-framework` is the one spanning orchestrator, not an unfinished upstream
leaf: its skill contract says it does not implement directly, and its P5-P8
require implementation replay, state mutation, proposal move, and remote sync.
The graph therefore holds task 2 pending behind task 15 while its routing phases
P1-P4 are receipted. Validate that exception rather than silently treating any
arbitrary pending task as compliant:

```bash
node -e 'const fs=require("fs");const g=JSON.parse(fs.readFileSync(".svc/lane-tasks-WI-506.json","utf8"));const t=g.tasks.find(x=>x.id===2);const phases=new Set(t?.skill_receipt?.phases_executed?.map(x=>x.id));const expected=[3,16,4,5,6,7,8,9,10,11,12,13,14,15];if(t?.skill!=="improve-framework"||t.status!=="pending"||JSON.stringify(t.blocked_by)!=="[15]"||JSON.stringify(t.metadata?.orchestrates_tasks)!==JSON.stringify(expected)||!t.metadata?.completion_gate||!["P1-FrameworkRepoAndMemoryLoad","P2-PendingProposalAndEvidenceSelection","P3-DiagnosisAndDuplicateFilter","P4-ImplementationRouteDecision"].every(x=>phases.has(x)))process.exit(1)'
```

## Prerequisite Alignment Matrix

| Task | UX/UI | Technical design | Style/pattern | Persona/competitor |
|---|---|---|---|---|
| task-0-owner-auth | N/A | Canonical phase-override parser and reviewer receipt | Existing repository-owner exception contract | N/A - explicit owner authority |
| task-1-tests | N/A - no UI | Classification and loader state machines | Existing Tier-1 shell fixtures | N/A - framework-only; peer evidence in blend proposal |
| task-2-resolver | N/A | Resolver precedence/security invariants | Existing dependency-free Node ESM and secure fs helpers | N/A - system-only |
| task-3-consumers | N/A | Complete ephemeral selector migration, Git-ref correctness-lock correction, and shell advisory boundary | Existing Git update-ref transactions plus atomic claim/binding and receipt code | N/A - system-only |
| task-4-loader | N/A | Preflight/activate/publish/exact-retry state machine | Existing install-anchored task-graph and atomic JSON helpers | N/A - system-only |
| task-5-review-phase | N/A | Exact planning-artifact allowlist; exec-record remains authoritative | Existing external-review phase guard and provider-call fixtures | N/A - system-only |
| task-6-docs | N/A | Contract map, confidence decision, AC proof gates | Framework WI/state/proposal conventions | N/A - system-only |

No Base44/backend, ORM schema, data migration, browser-visible surface, product
journey, or production-derived mock ledger applies.

## External State

| # | Environment | What state | Coupling | Lifecycle wiring |
|---|---|---|---|---|
| 1 | Host filesystem outside repo | `~/.cache/svc-runtime/` and legacy `~/.cache/svc-codex-runtime`; installed host skill pointers | coupled | Shared resolver creates/validates leaves; `setup` and `scripts/check-install-drift.sh` converge/verify installed pointers |
| 2 | Host config files | Claude/Codex/Gemini/Kimi/OpenCode/MiMo hook/plugin config refreshed after merge | coupled | `setup --host <host>` plus host wirer rollback/snapshot and drift checks |
| 3 | Out-of-tree version-controlled | Example Marketplace WI-496 graph is activated by the final installed replay; product tracked files must remain unchanged | decoupled-justified | `verify-promotion` records before/after graph and tracked-tree hashes and exact task/receipt tuple |
| 7 | External SaaS | GitHub branch, PR, review/receipt notes, and merge state | coupled | `land-changeset`, merge guard, final-SHA receipt chain, and origin/main verification |
| 9 | Caches | Private home fallback persists across login sessions | coupled | Existing PID/TTL/generation ownership rules govern contents; focused stale-state tests detect drift |
| 12 | Downstream framework artifacts | Host symlinked `hooks/` and `scripts/`, install receipts, contract/state/capability docs | coupled | All host manifests install full infra dirs; setup/install migration and drift validators prove the same final source |
| 13 | CI/CD wires | Existing PR required checks consume the new Tier-1 validator automatically | coupled | Tier-1 glob discovery plus branch protection/merge receipt gate; no check rename |
| 15 | Filesystem and Git state created at runtime | Git correctness-lock refs/blobs plus override, completion, and Codex session receipt leaves | coupled | Exact-old-object update-ref CAS; shared resolver modes; PID/start-token/generation checks; no rollback deletion |

Untouched environments (walked and found no mutation or dependency): 4 package
registries, 5 schedulers/jobs, 6 running services, 8 databases/migrations, 10
DNS/SSL/domains, 11 search/index services, and 14 authentication/secrets.

### Decoupled Example Marketplace state justification

The Example Marketplace task graph is a consumer-owned durable artifact and must not be
rolled back when framework code is reverted; doing so would delete legitimate WI
progress. Decoupling is safe because the replay is limited to the pre-existing
WI-496 task/skill tuple, product tracked files are hash-checked unchanged, the
session receipt remains in private runtime storage, and `resolveWI` plus the
Codex enforcer continue to deny any tuple mismatch. Recovery is the exact same
loader retry or an explicit framework rollback—not graph deletion.

## Validation plan

### Task-level

```bash
node --check hooks/lib/svc-runtime-root.mjs
node --check scripts/svc-runtime-root.mjs
node --check hooks/codex/lib/codex-hook-context.mjs
node --check scripts/codex-load-skill.mjs
bash -n hooks/svc-task-completion-guard.sh
bash test-framework/evals/tier-1/validate-runtime-root-portability.sh
bash test-framework/evals/tier-1/validate-codex-first-task-activation.sh
bash test-framework/evals/tier-1/validate-codex-execution-integrity.sh
bash test-framework/evals/tier-1/validate-default-checkout-isolation.sh
bash test-framework/evals/tier-1/validate-session-worktree-binding.sh
bash test-framework/evals/tier-1/validate-task-state-compatibility.sh
bash test-framework/evals/tier-1/validate-actionable-hook-denial.sh
bash test-framework/evals/tier-1/validate-all-host-install-migration.sh
bash test-framework/evals/tier-1/validate-self-heal-survives-double-dead-pointer.sh
bash test-framework/evals/tier-1/validate-external-review-launcher.sh
node scripts/validate-system-contract-map.mjs --map docs/specs/contract-maps/svc-runtime-root-resolution.md
node scripts/validate-task-graph-lane.mjs .svc/lane-tasks-WI-506.json
```

### Branch-level and promoted

- Run the focused commands above from the final implementation tree.
- Run full Tier-1 through `test-framework`; report pass/fail/timeout counts and
  classify unrelated baseline failures rather than calling them green.
- After review and merge, refresh all declared hosts from canonical main and run
  drift checks for each host.
- With the original `XDG_RUNTIME_DIR=/run/user/1000/` and no override, run the
  canonical installed WI-496 loader twice; assert graph/session receipt agreement,
  idempotent second bytes, and no Example Marketplace product diff.

### Exact implementation staging allowlist

The following reviewed bytes must exactly equal `implementation-paths.txt` at
execution. Entries are repository-relative literal paths: blanks, duplicates,
absolute paths, traversal, pathspec magic, and glob metacharacters are forbidden.

```text
BEGIN WI506 IMPLEMENTATION PATHS
.svc/lane-tasks-WI-506.json
.svc/pipeline-decisions.jsonl
.svc/session-contract.jsonl
NOTICES
docs/plans/2026-07-22-wi506-runtime-root-portability/implementation-paths.txt
docs/plans/2026-07-22-wi506-runtime-root-portability/manifest.md
docs/plans/2026-07-22-wi506-runtime-root-portability/retro-plan-review-authorization.json
docs/plans/2026-07-22-wi506-runtime-root-portability/review-convergence-findings.json
docs/plans/2026-07-22-wi506-runtime-root-portability/review-convergence-receipt.json
docs/plans/2026-07-22-wi506-runtime-root-portability/review-log.yaml
docs/plans/2026-07-22-wi506-runtime-root-portability/review-round1-findings.json
docs/plans/2026-07-22-wi506-runtime-root-portability/review-round1-receipt.json
docs/plans/2026-07-22-wi506-runtime-root-portability/review-round3-findings.json
docs/plans/2026-07-22-wi506-runtime-root-portability/review-round3-receipt.json
docs/specs/audit/wi506-runtime-root-portability-analysis.md
docs/specs/contract-maps/svc-runtime-root-resolution.md
docs/specs/decisions/2026-07-22-runtime-root-portability/SOLUTION-CONFIDENCE.md
docs/specs/explorations/runtime-root-portability/ANALYSIS.md
docs/specs/explorations/runtime-root-portability/COMPARISON.md
docs/specs/explorations/runtime-root-portability/DECISION.md
docs/specs/explorations/runtime-root-portability/PROBLEM_BRIEF.md
docs/specs/explorations/runtime-root-portability/SOLUTION_MAP.md
docs/specs/explorations/runtime-root-portability/prototypes/classification-matrix.mjs
docs/specs/research-log.md
docs/specs/reviews/wi506-runtime-root-portability-exec-cross-model.md
docs/specs/reviews/wi506-runtime-root-portability-exec-review-log.yaml
docs/specs/security/wi506-runtime-root-portability-review.md
docs/specs/tech/runtime-root-portability.md
docs/specs/work-items/INDEX.md
docs/specs/work-items/WI-506.md
hooks/codex/lib/codex-hook-context.mjs
hooks/lib/svc-runtime-root.mjs
hooks/lib/wi-claim.mjs
hooks/svc-task-completion-guard.sh
hooks/svc-worktree-isolation-guard.mjs
proposals/2026-07-22-blend-runtime-state-portability.md
proposals/2026-07-22-framework-improvement-runtime-root-portability.md
references/blend-registry.json
references/codex-hook-execution-integrity.md
references/knowledge/INDEX.md
references/knowledge/runtime-state-portability/.version
references/knowledge/runtime-state-portability/CAPABILITIES.md
references/knowledge/runtime-state-portability/details/runtime-state.md
references/knowledge/source-heuristics.global.jsonl
scripts/codex-load-skill.mjs
scripts/run-external-review.mjs
scripts/svc-ensure-worktree.mjs
scripts/svc-migrate-task-state.mjs
scripts/svc-runtime-root.mjs
test-framework/evals/tier-1/validate-actionable-hook-denial.sh
test-framework/evals/tier-1/validate-all-host-install-migration.sh
test-framework/evals/tier-1/validate-codex-execution-integrity.sh
test-framework/evals/tier-1/validate-codex-first-task-activation.sh
test-framework/evals/tier-1/validate-default-checkout-isolation.sh
test-framework/evals/tier-1/validate-external-review-launcher.sh
test-framework/evals/tier-1/validate-runtime-root-portability.sh
test-framework/evals/tier-1/validate-self-heal-survives-double-dead-pointer.sh
test-framework/evals/tier-1/validate-session-worktree-binding.sh
test-framework/evals/tier-1/validate-task-state-compatibility.sh
END WI506 IMPLEMENTATION PATHS
```

## Execution Command Sequence

The existing WI-506 worktree and authority baton are reused; no bootstrap or
environment override is part of implementation acceptance.

```bash
git -C /workspace/seriousvibecoding/.worktrees/framework-WI-506-runtime-root-portability status --short

# Apply task-1 tests with apply_patch. Syntax and fixture entry points must pass
# before the three intended contract failures are accepted as RED.
bash -n test-framework/evals/tier-1/validate-runtime-root-portability.sh
bash -n test-framework/evals/tier-1/validate-codex-first-task-activation.sh
bash -n test-framework/evals/tier-1/validate-external-review-launcher.sh
set +e
bash test-framework/evals/tier-1/validate-runtime-root-portability.sh --red-only > .svc/wi506-runtime-root-red.log 2>&1
RUNTIME_RED_RC=$?
SVC_WI506_RED_ONLY=1 bash test-framework/evals/tier-1/validate-codex-first-task-activation.sh > .svc/wi506-loader-red.log 2>&1
LOADER_RED_RC=$?
SVC_WI506_RED_ONLY=1 bash test-framework/evals/tier-1/validate-external-review-launcher.sh > .svc/wi506-review-phase-red.log 2>&1
PHASE_RED_RC=$?
set -e
test "$RUNTIME_RED_RC" -ne 0 && grep -Fq 'WI506-RED-RUNTIME-ROOT: missing XDG fallback unavailable' .svc/wi506-runtime-root-red.log
test "$LOADER_RED_RC" -ne 0 && grep -Fq 'WI506-RED-LOADER-PREFLIGHT: graph changed before runtime preflight' .svc/wi506-loader-red.log
test "$PHASE_RED_RC" -ne 0 && grep -Fq 'WI506-RED-PHASE-CLASSIFIER: mandatory blend artifacts rejected' .svc/wi506-review-phase-red.log

# Apply tasks 2, 3, 4, and 5 in dependency order, followed by task 6
# documentation. Every RED-only command must then exit zero without a RED marker.
# Run the complete focused combined tree after those changes.
# Do not hand-edit authority state or regenerate the owner authorization.

bash test-framework/evals/tier-1/validate-runtime-root-portability.sh --red-only
SVC_WI506_RED_ONLY=1 bash test-framework/evals/tier-1/validate-codex-first-task-activation.sh
SVC_WI506_RED_ONLY=1 bash test-framework/evals/tier-1/validate-external-review-launcher.sh
bash test-framework/evals/tier-1/validate-runtime-root-portability.sh
bash test-framework/evals/tier-1/validate-codex-first-task-activation.sh
bash test-framework/evals/tier-1/validate-codex-execution-integrity.sh
bash test-framework/evals/tier-1/validate-default-checkout-isolation.sh
bash test-framework/evals/tier-1/validate-session-worktree-binding.sh
bash test-framework/evals/tier-1/validate-task-state-compatibility.sh
bash test-framework/evals/tier-1/validate-actionable-hook-denial.sh
bash test-framework/evals/tier-1/validate-all-host-install-migration.sh
bash test-framework/evals/tier-1/validate-self-heal-survives-double-dead-pointer.sh
bash test-framework/evals/tier-1/validate-external-review-launcher.sh
node scripts/validate-system-contract-map.mjs --map docs/specs/contract-maps/svc-runtime-root-resolution.md
node scripts/validate-task-graph-lane.mjs .svc/lane-tasks-WI-506.json

PATHS=docs/plans/2026-07-22-wi506-runtime-root-portability/implementation-paths.txt
printf '%s  %s\n' 'e4fb22b47cbc5c463e87ad34e8b7e287dde47e99c39d6072c0852f5ff4ff69e9' "$PATHS" | sha256sum -c -
awk '/^BEGIN WI506 IMPLEMENTATION PATHS$/{inside=1;next}/^END WI506 IMPLEMENTATION PATHS$/{inside=0}inside' docs/plans/2026-07-22-wi506-runtime-root-portability/manifest.md > /tmp/wi506-reviewed-paths
diff -u /tmp/wi506-reviewed-paths "$PATHS"
test -s "$PATHS"
test "$(LC_ALL=C sort "$PATHS" | uniq -d | wc -l)" -eq 0
if grep -nE '(^$|^/|(^|/)\.\.(/|$)|^:|[?*\[])' "$PATHS"; then
  printf 'unsafe or non-literal implementation path\n' >&2
  exit 1
fi
while IFS= read -r path; do test -e "$path" || { printf 'required path missing: %s\n' "$path" >&2; exit 1; }; done < "$PATHS"
while IFS= read -r path; do git --literal-pathspecs add -- "$path"; done < "$PATHS"
printf '%s  %s\n' 'e4fb22b47cbc5c463e87ad34e8b7e287dde47e99c39d6072c0852f5ff4ff69e9' "$PATHS" | sha256sum -c -
BASE_SHA=7a700259aa0a4c6debb900728cee8a35aefc61ca
{
  git diff --name-only "$BASE_SHA"...HEAD
  git diff --cached --name-only
} | LC_ALL=C sort -u > /tmp/wi506-staged-paths
LC_ALL=C sort -u "$PATHS" > /tmp/wi506-allowed-paths
diff -u /tmp/wi506-allowed-paths /tmp/wi506-staged-paths
if grep -Eq '^(FRAMEWORK-STATE\.md|references/knowledge/svc/CAPABILITIES\.md|proposals/done/)' /tmp/wi506-staged-paths; then
  printf 'downstream-only closeout path staged during execute\n' >&2
  exit 1
fi
git diff --cached --check

# RECOVERY_IF_FAIL: keep the worktree and evidence; correct the focused failing
# task in place with apply_patch and rerun that task plus the combined matrix.
# Before the final commit, rollback means reversing only the current task's
# reviewed diff while retaining its RED/GREEN logs. After landing, rollback is a
# reviewed `git revert <final-WI-506-SHA>`. Never reset the worktree, delete
# graphs, claims, bindings, leases, or runtime receipts, and never set an
# acceptance-only XDG override.
```

The exact final commit, receipt emission, PR/merge, setup refresh, and live
replay are owned by the subsequent review/test/land/verify tasks so the five
receipts bind the reviewed final SHA, not an intermediate evidence checkpoint.

## Checkpoint plan

These are execution milestones, not Git commits or independent rollback
anchors. Task 1 has explicit RED logs. Tasks 2 through 6 complete only when
their named combined-tree validators pass and execute-changeset records its
normal phase receipts. Recovery before the final commit is correction in the
same reviewed worktree followed by the full focused matrix; after landing it is
a reviewed revert of the one final SHA.

| Milestone | Contents | Completion signal |
|---|---|---|
| `wi506-owner-review-authorization` | Owner JSON, decision ledger, canonical allow-override receipt | Immutable authorization SHA and round-1 receipt |
| `wi506-tests-red` | Contract tests and fixture dependency declarations | Base SHA plus RED logs; correct tests in place |
| `wi506-shared-resolver` | Shared resolver, CLI, Codex adapter | Runtime-root and Codex integrity validators pass in the combined tree |
| `wi506-consumer-parity` | Complete selector migration and shell adapter | Consumer/isolation/migration/Stop validators pass in the combined tree |
| `wi506-loader-transaction` | Preflight order, failpoint, exact retry | First-task activation and execution-integrity validators pass |
| `wi506-review-phase-classifier` | Exact blend-only phase allowance with executable/exec-record denial intact | External-review launcher validator passes all allow/deny/zero-spawn cases |
| `wi506-implementation-complete` | Focused green evidence, aligned docs, exact staged-path equality | Every focused command passes and staged paths equal the reviewed allowlist |

Only `land-changeset` creates the final implementation commit after reviews and
tests. That final SHA must receive a fresh five-receipt chain; evidence checkpoint
logs do not satisfy landing.

## Simulation report

| Task | Check | Result | Action |
|---|---|---|---|
| task-1-tests | validate-runtime-root-portability.sh does not exist | PASS (CREATE) | Create focused validator |
| task-1-tests | Nine named existing fixture validators exist | PASS (MODIFY) | Add resolver/CLI copies only where fixtures isolate source; add phase-boundary cases to the external-review fixture |
| task-2-resolver | hooks/lib/svc-runtime-root.mjs absent | PASS (CREATE) | Create shared ESM module |
| task-2-resolver | scripts/svc-runtime-root.mjs absent | PASS (CREATE) | Create stdout-only CLI |
| task-2-resolver | Codex context exports `runtimeRoot`/`sessionDir` | PASS (MODIFY) | Preserve public exports |
| task-3-consumers | Ephemeral selectors measured; correctness locks identified separately | PASS | Centralize ephemeral receipt/advisory selection, move claim/binding/bootstrap/migration locks to Git ref CAS, retain documented `approvedTempRoots` observation |
| task-3-consumers | Shell guard has two selector sites and installed `HOOK_DIR` | PASS | Resolve CLI relative to installed source root |
| task-4-loader | Loader calls `activate-skill` before `sessionDir`/`resolveWI` | PASS (defect confirmed) | Reorder preflight and add failpoint/retry checks |
| task-4-loader | `task-graph.mjs activate-skill` supports exact idempotent retry | PASS | Reuse existing primitive; no graph schema change |
| task-5-review-phase | Mandatory blend outputs are currently reported as implementation divergence | PASS (defect confirmed) | Add exact allowlist and three-boundary fixture |
| task-6-docs | Contract map validator | PASS | Preserve validation after implementation evidence update |
| dependencies | No package manifest/runtime dependency needed | PASS | Node built-ins only |
| schema | No ORM/data schema path planned | PASS (N/A) | No migration task |
| browser/Base44 | No browser-visible or Base44 path planned | PASS (N/A) | No mock parity/backend audit |
| lane | Framework graph already contains plan review, exec, G5/G6/security/audit/test/land/verify | PASS | Re-run mechanical lane validator |

No unresolved simulation FAIL or WARN remains. There is no product journey;
the system scenario is the contract map's old/new proof and final WI-496 replay,
covered by task-4 and verify-promotion.

## Promotion readiness checklist

- [x] Execution mode is explicitly `inline`; blueprint omission is intentional.
- [x] The cross-cutting universe distinguishes ephemeral selectors from the one
  repository-shared Git compare-and-swap correctness-lock namespace.
- [x] Every RP acceptance criterion maps to tasks and proof.
- [x] Every implementation task names files, dependencies, validation, checkpoint.
- [x] External-state taxonomy 1-15 is walked and Example Marketplace decoupling is justified.
- [x] No package, provider, UI, browser, Base44, ORM, or schema migration applies.
- [x] Rollback never deletes or rewrites consumer authority state.
- [x] Full Tier-1, final-SHA receipt chain, all-host install drift, and original
  no-override WI-496 replay remain mandatory downstream gates.
- [x] Final diff inventory is limited to the exact production/test/governance
  surfaces listed above; reviewers must flag any unlisted path.
