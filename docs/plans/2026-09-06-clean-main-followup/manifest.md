# Clean main follow-up: Stage A validation and evidence recovery
WI: WI-FW-CLEAN-MAIN-FOLLOWUP-01
**Status:** DRAFTED
**Mode:** inline — this Codex executor applies the reviewed design; no duplicate code blueprints.
**Branch:** refactor-WI-FW-CLEAN-MAIN-FOLLOWUP-01
**Base SHA:** 848693c4c7e1abc5636479b26b1dd9b37844c2b2 (freshly fetched origin/main, 2026-09-06)
**Risk Flags:** cross_runtime_integration, external_state_writer, runtime_concurrency
**Archetype:** architectural maintenance plus bounded contract migration. Extend existing evaluator, plan validator, evidence store and skill conventions; no new runtime/host abstraction.

## Technical Design
Design-tech applies to the declared external-state/cross-runtime risks; it is a real prerequisite in the lane graph, not skipped because there is no product UI. The adopted design extends existing components:

`runner → per-validator isolated state → existing validator → exit/log/timing result → immutable-input release summary`

`plan validator (explicit plan phase) → declared ownership/dependency/schema proof → approved plan → execution validator (default strict) → actual diff/writer census`

`provenance inventory → shared markerReceiptBytes → existing file or SHA-verified immutable object → unchanged identity/HMAC checks`

For each helper the alternative of broad bypass/removing checks is rejected because it loses proof. A new orchestration/store layer is rejected because existing APIs already own state, timeout, hash and receipt semantics. The selected changes are reversible extensions with unchanged strict defaults; no new architectural one-way door requires a new solution search. Per-test fixture isolation replaces fragile live backup/restore; existing setup fixtures seed managed host files while credentials remain absent. Tests that currently mutate real home must explicitly source that helper even when run standalone. The full runner supplies separate HOME/XDG/account/authority roots to other validators as a second isolation boundary, and keeps required full/focused selection semantics. Unseeded required checks must fail rather than report SKIP.

The runner's optional JSON summary output records actual validator exit status/duration, fixture scope, tested source identity and input digest. Review status comes from existing review-topology aggregation and raw receipts. Audit prose cites those generated facts and the current/superseded source hashes. No new required ledger or HTML dashboard is introduced. Reuse checks compare full tested input identity, not merely unchanged HEAD with dirty files.

## Implementation Summary
Stage A closes reproduced baseline defects and prevents avoidable iteration overhead while preserving meaningful authorization, skill quality, receipt integrity and full release validation. It is the first source landing in the approved program; it does not claim UX graduation, final installation or clean-main cleanup complete. The entire approved roadmap is roadmap.md (12a80170ffab5a84833429c91e3b3a1711ddea9f2f0cbee3c19d337b3242892d). Stage B graduates the preserved UX draft after A is green; Stage C converges hosts through the reviewed durable handoff source, makes original main clean, and removes only the four named eligible worktrees. Subsequent stage manifests and gate receipts remain required; this goal stays active across all stages.

The baseline is .svc/clean-main-review/baseline-current/results.json: 18 current failures, one unsafe test withheld before change. Preserve historical 19-name attribution at 6d4d8b0 independently. Source package has 104 skills. Existing successful recovery/reviewer and skill-judgment implementations are retained. Restore-tested original dirty bundle is in repository-shared .git/svc-review-evidence/preservation/WI-FW-CLEAN-MAIN-FOLLOWUP-01; never delete it with a task worktree.

## Acceptance Criteria
- **AC-1:** Offline Tier-1 runs without mutating or borrowing live HOME/XDG/account/authority/install state. Self-heal tests prove durable canonical-source recovery and reject lookalike/foreign/deleted sources; no filesystem-scan authority fallback.
- **AC-2:** Every historical finding has a current cause-specific disposition and positive/negative proof. Current complete offline release corpus passes zero failures/timeouts; no disabled validators, concealed required skips, synthetic phase receipts or timestamp freshness laundering.
- **AC-3:** Single-candidate/cycle provenance listing and receipt validation resolve archived original bytes after worktree paths disappear. Missing/tampered objects and wrong identity fail; raw signed receipt bytes never change. Real task evidence is retained for later cleanup.
- **AC-4:** Pre-execution plan checks validate declared paths, ownership, create/modify feasibility, risk sections and named planned executable consumers. Execution/release checks additionally require exact actual diff parity and writer census. Default validation remains execution-strict; an explicit plan phase never certifies implementation. Persistence checks cover both index/worktree columns, spaces, Unicode, rename destination, untracked files and intentional deletion.
- **AC-5:** Canonical skill counts are derived independently from registry and discovered installation. Agent mirrors/context contracts, named proposal/WI metadata and knowledge provenance accurately represent current evidence. Existing useful hosted-media learning is retained once with source verification.
- **AC-6:** Focused iteration uses the existing selector, retaining unknown/global full fallback and explicit unmapped-surface failure. Full Tier-1 and review are retained at source release boundaries; exact input identity binds any reuse. Current full-before-commit gates apply to Stage A itself. Source hashes, index identity, test totals, current/superseded evidence and elapsed timings are generated from existing artifacts, not invented by the model.
- **AC-7:** Exact task policy requires self, Sol High advisory and Cursor cursor-grok-4.6-high High independent for plan/exec. No unavailable provider or fallback/login/quota probes. Source remains isolated; no HoursHub/swarm implementation or unrelated cleanup.

## Exact phase and consumer interface
T2 adds `validatePlanContract(contract, {root, phase: "plan" | "execution" = "execution"})`; CLI is `node scripts/validate-plan-contract.mjs <contract> [root] --phase plan|execution`. Mechanical CLI is `bash scripts/verify-plan-mechanical.sh <manifest> [repo-root] --phase plan|execution`. Both parsers accept options anywhere after the required first positional, preserve the optional root positional, reject unknown/repeated options and surplus positionals, and reject a missing phase value. An omitted root still means current working directory. Invalid values fail; absent phase stays execution. Phase is an explicit caller argument, deliberately not a sticky policy field that could silently weaken release. Every release caller uses execution/default. Plan checks validate both MODIFY-on-disk and CREATE-in-declared-plan feasibility, ownership, risk and executable consumers; planned future consumer references may be deferred only when that consumer is itself a declared CREATE/MODIFY, with the required query recorded. Existing unchanged consumers must already match. Execution checks require every actual consumer query and exact actual diff/writer census, including the new regression itself.

The adjacent contract enumerates all planned executable paths and their runner/import/test consumers. The runner glob is the real executable consumer for discovered tier-1 tests. Its planned fixture-home reference and new regression references must become real source before execution validation passes. The zero-parity/unused-executable claims are prospective release assertions; plan phase validates their denominator shape and declared closure without claiming completed implementation. Execution checks compute both values from actual source. No future file is created merely to green preplan validation.

Exact post-T2 commands: `bash scripts/verify-plan-mechanical.sh docs/plans/2026-09-06-clean-main-followup/manifest.md --phase plan` before plan gate; `bash scripts/verify-plan-mechanical.sh docs/plans/2026-09-06-clean-main-followup/manifest.md --phase execution` at release. Until T2 is approved and implemented, retain raw legacy mechanical failures and distinguish future-file/parity failures from actual malformed declarations.

| Check | Explicit plan phase | Execution phase (also default) |
|---|---|---|
| Schema, risk, exact ownership, path containment | Required | Required |
| MODIFY target | Must exist | Must exist and have declared actual change |
| CREATE target | Declared, in-repository feasible parent; bytes may be absent | Actual bytes and declared change required |
| Consumer path/query | Unchanged consumers must exist and match; defer missing bytes/query only for declared CREATE/MODIFY consumers, retaining recorded query | All paths exist and queries match |
| Diff parity | Validate declared inventory; defer comparison to live changed files | Exact undeclared/unchanged parity check |
| Executable writer census | Validate review shape and planned executable coverage; defer actual changed denominator equality | Compute actual changed executables and require exact denominator |
| Absence/unused claims | Validate schema, evidence method and numeric denominator shape; no live equality claim | Recompute live mismatch/invalid-consumer counts and require equality |
| C1 future rollback output | Exempt only exact contract external_writer.rolling_rollback runtime output from pre-existence; require contained path and declared writer/lifecycle | Require captured snapshot before affected write and inspect it at release |
| Unknown paths or invalid phase | Fail | Fail |

The C1 exception is for the exact named runtime output, not all .svc paths or arbitrary nonexistent backtick references. Regressions exercise omitted root, explicit root, flag before/after optional root, missing/invalid/repeated phase, future CREATE consumer, future query in MODIFY consumer, unchanged missing consumer, and plan-pass/execution-fail for unrealized parity/census/claims.

## Files Planned
| Task | Action | Path |
|---|---|---|
| T1 | MODIFY | test-framework/evals/run-all-evals.sh |
| T1 | MODIFY | test-framework/evals/tier-1/validate-knowledge-refresh-scan.sh |
| T1 | MODIFY | test-framework/evals/tier-1/validate-manifest-integrity-stamp.sh |
| T1 | MODIFY | test-framework/evals/tier-1/validate-chain-receipts-schema.sh |
| T1 | CREATE | test-framework/evals/tier-1/lib/fixture-home.sh |
| T1 | MODIFY | test-framework/evals/tier-1/validate-capability-blocker-inertia.sh |
| T1 | MODIFY | test-framework/evals/tier-1/validate-claude-wirer-cutover.sh |
| T1 | MODIFY | test-framework/evals/tier-1/validate-consumer-evidence-root.sh |
| T1 | MODIFY | test-framework/evals/tier-1/validate-knowledge-legacy-backfill.sh |
| T1 | MODIFY | test-framework/evals/tier-1/validate-pipeline-decisions-recent.sh |
| T1 | MODIFY | test-framework/evals/tier-1/validate-pipeline-decisions-schema.sh |
| T1 | MODIFY | test-framework/evals/tier-1/validate-pretool-decision-engine.sh |
| T1 | MODIFY | test-framework/evals/tier-1/validate-proposal-triage-sla.sh |
| T1 | MODIFY | test-framework/evals/tier-1/validate-self-heal-survives-double-dead-pointer.sh |
| T1 | MODIFY | test-framework/evals/tier-1/validate-session-contract-freshness.sh |
| T1 | MODIFY | test-framework/evals/tier-1/validate-skills-source-layout.sh |
| T1 | MODIFY | test-framework/evals/tier-1/validate-workflow-guard.sh |
| T1 | MODIFY | test-framework/evals/tier-1/validate-all-host-setup.sh |
| T1 | MODIFY | test-framework/evals/tier-1/validate-codex-zero-block-reads.sh |
| T1 | MODIFY | test-framework/evals/tier-1/validate-claude-skills-symlinks.sh |
| T1 | MODIFY | test-framework/evals/tier-1/validate-codex-execution-integrity.sh |
| T1 | MODIFY | test-framework/evals/tier-1/validate-settings-no-duplicate-hooks.sh |
| T1 | MODIFY | test-framework/evals/tier-1/validate-settings-write-guard.sh |
| T1 | MODIFY | test-framework/evals/tier-1/validate-setup-worktree-canonical-resolution.sh |
| T1 | MODIFY | test-framework/evals/tier-1/validate-source-repo-not-worktree.sh |
| T1 | MODIFY | test-framework/evals/tier-1/validate-no-svc-residue.sh |
| T1 | MODIFY | test-framework/evals/tier-1/validate-phase-receipt-autoemit.sh |
| T1 | MODIFY | test-framework/evals/tier-1/validate-rule-injection.sh |
| T2 | MODIFY | scripts/lib/external-review-provenance.mjs |
| T2 | MODIFY | scripts/run-external-review.mjs |
| T2 | MODIFY | test-framework/evals/tier-1/validate-external-review-launcher.sh |
| T2 | MODIFY | scripts/validate-plan-contract.mjs |
| T2 | MODIFY | scripts/verify-plan-mechanical.sh |
| T2 | MODIFY | scripts/verify-file-persistence.sh |
| T2 | CREATE | test-framework/evals/tier-1/validate-clean-main-followup.mjs |
| T2 | MODIFY | scripts/select-tier1-validators-v2.mjs |
| T2 | MODIFY | test-framework/evals/tier-1/validate-tier1-selector-v2.mjs |
| T3 | MODIFY | skills/produce-ad-video/SKILL.md |
| T3 | MODIFY | references/context-loading-registry.json |
| T3 | MODIFY | references/knowledge/domains/mimo/CAPABILITIES.md |
| T3 | CREATE | references/knowledge/domains/mimo/.sources.jsonl |
| T3 | MODIFY | references/knowledge/domains/claude-hooks/CAPABILITIES.md |
| T3 | CREATE | references/knowledge/domains/claude-hooks/.sources.jsonl |
| T3 | MODIFY | references/knowledge/domains/legacy-backfill-queue.json |
| T3 | MODIFY | references/knowledge/source-heuristics.global.jsonl |
| T3 | MODIFY | .svc/lane-tasks-WI-567.json |
| T3 | MODIFY | .svc/lane-tasks-WI-SSVE-ARCHITECTURE-EVOLUTION-02.json |
| T3 | MODIFY | .svc/lane-tasks-WI-FW-SWARM-COORDINATION-01.json |
| T3 | MODIFY | .svc/pipeline-decisions.jsonl |
| T3 | MODIFY | docs/specs/work-items/WI-GROK-HOST-IDENTITY-02.md |
| T3 | MODIFY | references/skill-routing-index.json |
| T3 | MODIFY | proposals/2026-08-22-framework-improvement-capability-scoped-plugin-mcp-startup.md |
| T3 | MODIFY | proposals/2026-08-26-framework-docs-audit-findings.md |
| T3 | MODIFY | proposals/2026-08-26-framework-improvement-advisor-knowledge.md |
| T3 | MODIFY | proposals/2026-08-26-framework-improvement-codex-svc-host-adhoc-dispatch.md |
| T3 | MODIFY | proposals/2026-08-26-framework-improvement-owner-lease-24h-slide-renew.md |
| T3 | MODIFY | proposals/2026-08-30-framework-improvement-configured-reviewer-transports.md |
| T3 | MODIFY | .claude/agents/ad-video-producer.md |
| T3 | MODIFY | .claude/agents/strategic-reviewer.md |
| T4 | MODIFY | AGENTS.md |
| T4 | MODIFY | DOCTRINE.md |
| T4 | MODIFY | FRAMEWORK-STATE.md |
| T4 | MODIFY | skills/execute-changeset/SKILL.md |
| T4 | MODIFY | skills/land-changeset/SKILL.md |
| T4 | CREATE | docs/plans/2026-09-06-clean-main-followup/manifest.md |
| T4 | CREATE | docs/plans/2026-09-06-clean-main-followup/plan-contract.json |
| T4 | MODIFY | docs/plans/2026-09-06-clean-main-followup/roadmap.md |
| T4 | CREATE | docs/plans/2026-09-06-clean-main-followup/dispositions.json |
| T4 | CREATE | docs/specs/audit/clean-main-followup.md |
| T4 | MODIFY | docs/specs/work-items/INDEX.md |
| T4 | CREATE | docs/specs/work-items/WI-FW-CAPABILITY-MCP-STARTUP-RESIDUALS-01.md |
| T4 | CREATE | docs/specs/work-items/WI-FW-CONTROLLER-CUTOVER-RESIDUALS-01.md |
| T4 | CREATE | docs/specs/work-items/WI-FW-DESIGN-INTEGRATIONS-RESIDUALS-01.md |
| T4 | CREATE | docs/specs/work-items/WI-FW-DELIVERY-EVIDENCE-RESIDUALS-01.md |

| T4 | MODIFY | .gitignore |

| T4 | CREATE | docs/plans/2026-09-06-clean-main-followup/review-log.yaml |

| T1 | MODIFY | test-framework/evals/tier-1/validate-plan-product-safety.sh |
| T3 | MODIFY | proposals/triage.json |
| T4 | CREATE | docs/specs/work-items/WI-FW-CLEAN-MAIN-FOLLOWUP-01.md |

| T1 | MODIFY | scripts/wire-hooks.mjs |

| T1 | MODIFY | test-framework/evals/tier-1/validate-wire-hooks-variant-dedup.sh |

| T1 | MODIFY | test-framework/evals/tier-1/validate-self-verify-sections.sh |

| T3 | MODIFY | .svc/lane-tasks-WI-FW-ADVISOR-KNOWLEDGE-01.json |
| T3 | MODIFY | .svc/lane-tasks-WI-FW-HOOKS-SAFETY-01.json |
| T3 | MODIFY | .svc/lane-tasks-WI-FW-SKILLS-ROUTING-01.json |

| T1 | MODIFY | test-framework/evals/tier-1/validate-capture-idea-from-proposal.sh |
| T1 | MODIFY | test-framework/evals/tier-1/validate-cross-host-hook-conformance.sh |
| T1 | MODIFY | test-framework/evals/tier-1/validate-skill-router.sh |
| T1 | MODIFY | test-framework/evals/tier-1/validate-grok-hook-toml-roundtrip.sh |

| T1 | MODIFY | scripts/validate-proposal-promotion-closeout.mjs |
| T1 | MODIFY | test-framework/evals/tier-1/validate-proposal-promotion-closeout.sh |
| T1 | MODIFY | skills/improve-framework/SKILL.md |

| T1 | MODIFY | test-framework/evals/tier-1/validate-rename-schema-drill.sh |
| T1 | MODIFY | test-framework/evals/tier-1/validate-wire-kimi-hooks-paths.sh |

## Task Graph
Serial inline execution; one writer, no mutating child dispatch.
| ID | Work and implementation decisions | Dependencies | AC | Checkpoint / proof |
|---|---|---|---|---|
| T1 | Isolate evaluator state and correct the exact validator fixtures/data assumptions described below. Extend the existing eval lib with a fixture-home helper; runner establishes per-test HOME/XDG/SVC/account/authority roots and blocks provider invocation. Seed required installed host surfaces through existing fixture staging/transactional setup, never by copying credentials. Keep full/focused selection and exit semantics. Retain serialization where shared fixture resources/timing require it. | none | AC-1,2,5 | isolated fixture results and unchanged live-state sentinels; live decision-schema and proposal-triage oracles are T3 exit checks |
| T2 | Add regressions before changes to evidence/plan/persistence helpers. Share markerReceiptBytes in provenance listing; archive required immutable objects via existing store. Add explicit plan/execution phase to validatePlanContract and mechanical CLI; preplan checks retain ownership/risk/create-import feasibility, defer only actual-diff/census requirements and references to declared future files. Default stays execution, release always explicit execution. Parse porcelain -z for persistence, both status columns; skip intentional deletions and consume rename source record. Connect the new validator to existing selector/runner. | T1 fixtures available | AC-3,4,6 | archive/delete/tamper, plan-vs-exec and filename fixture regression |
| T3 | Execute the exact T3 generation command block in Execution Command Sequence after canonical skill/context edits. Repair canonical context/agent/metadata/provenance drift and exactly named historical claims. Generate native mirrors in a disposable scratch directory with copied canonical agents/ and the unchanged sync-native-agents script; copy back only the two declared generated outputs after confirming the other outputs are byte-identical; include produce-ad-video in actual context family and continuation contract. Restore verified knowledge source evidence or remove unsupported live claims while preserving history. Fix malformed decision skill from actual event, not arbitrary fabrication. Recover phase receipts only from existing authentic evidence; otherwise accurately downgrade unsupported completion with reason, retaining original graph bytes and no claimed rerun. Swarm metadata/history only. Reconcile the six named proposals against implemented work/actual WIs; expired deferral is re-triaged with rationale, not silently extended. | T1,T2 | AC-2,5 | exact 19 disposition matrix, schema/negative fixtures |
| T4 | Align actual cadence consumers, consume T3’s regenerated source routing index, add audit with generated totals/input hashes/timings and final scope census, then freeze. Existing land complete suite can reuse unchanged input-bound full evidence instead of redundant rerun; relevant post-commit checks retained. Review/audit the full frozen diff, land normally, verify promoted source. Installation and original checkout cutover remain Stage C obligations. | T1,T2,T3 | AC-6,7 | full no-LLM Tier-1, self/Sol/Cursor execution review, audit, source merge verification |

## Cause-specific fixture and data decisions
- capability-blocker-inertia: preserve block/explicit-foundation-ack behavior; stage the actual runtime dependency closure instead of a stale reduced hook copy. No new hook policy without reproduced runtime failure.
- claude-wirer-cutover: assert governed launcher command identity/effective behavior, not stale raw script paths; retain foreign Kimi hook preservation and disabled/minimal profiles.
- consumer-evidence-root: use isolated issuance/account roots and current schema/launcher version/plan WI/phase binding in truthful synthetic test fixtures. Fixture provenance is never promoted as real review evidence.
- self-management/skill-before-starting: repair produce-ad-video operational continuation/context family, not broad legacy prose rewriting.
- knowledge provenance/backfill: current failures are mimo and claude-hooks missing sources. Inspect relevant primary sources and correct only supported claim sets; avoid claiming prior source retrieval. Backfill validator must collect subprocess failure diagnostics rather than exit silently under pipefail; queue coverage matches actual remaining legacy warnings.
- historical graph/phase shape: WI-567, WI-SSVE-ARCHITECTURE-EVOLUTION-02 and WI-FW-SWARM-COORDINATION-01 are the named failing graphs. Archived/incomplete status alone cannot bypass validation of still-asserted completed rows. Recover real phase evidence or change those unsupported rows to truthful incomplete/terminal dispositions using existing schema; no synthetic completion timestamps. Preserve originals in immutable store.
- freshness: remove live repository age from the software test result; test fresh/stale/resume/terminal paths with fixed clock and fixture data. Live operational checks may still report actual stale active authority; runtime enforcement remains unchanged.
- pretool/workflow guard: current same-owner mutation authorization continues; fixtures must initialize the complete task/session/owner baton. Proven read-only commands stay allowed, real ownership conflict stays denied. Config edit expectations must reflect current authorized session behavior, not request redundant permission.
- proposal metadata: validate actual existing alphanumeric WI identifiers through the existing canonical WI helper rather than an old WI-NNN-only assumption. Do not invent missing referenced WIs; resolve the proposal to real source evidence or truthful deferred state.
- locked agents/source layout: canonical agents/ad-video-producer.md and agents/strategic-reviewer.md already contain the intended definitions and remain read-only inputs. The existing generator rewrites every output even if unchanged, so execute it only in scratch, compare every generated file, abort on any difference outside the two declared mirrors, copy only those two back, then run node scripts/sync-native-agents.mjs --check (expected 0). No hand-edit of generated content or canonical source modification. T3 alone regenerates references/skill-routing-index.json. For source layout, count manifest registry and independent package discovery, with duplicate source negative case.

## AC-to-Task and AC-to-Test
| AC | Tasks | Evidence type / command |
|---|---|---|
| AC-1 | T1 | Unit/integration: full evaluator fixture environment and existing self-heal/all-host setup tests with original live-state sentinels |
| AC-2 | T1,T3 | Integration: all 19 named scripts in dispositions.json; current results plus negative history/schema fixtures |
| AC-3 | T2 | Unit: node test-framework/evals/tier-1/validate-clean-main-followup.mjs; existing consumer-evidence-root validation |
| AC-4 | T2 | Unit: same regression with plan/execution mismatch, missing paths, overlap, tampered evidence, whitespace/rename/delete cases |
| AC-5 | T1,T3 | Unit: layout/context/agent/provenance validators; source routing and manifest lint |
| AC-6 | T2,T4 | Unit/integration: selector unknown/global/unmapped existing fixtures, full corpus, exact candidate/index hashes and generated audit |
| AC-7 | T4 | Manual/tool-backed: genuine native Sol review, canonical exact Cursor launcher receipts and standard chain evidence |

## Prerequisite Alignment Matrix
| Requirement | Source and applicability |
|---|---|
| Founder operator persona | Stefan, dedicated Codex session on this VM: preserve useful work and optimize real task latency with quality. Approved roadmap and explicit current reviewer availability are controlling. |
| UX/UI product surfaces | Stage A changes framework/test tooling, no product UI. Stage B owns the existing UX draft and representative positive/retain-current/missing-evidence fixture; no HoursHub edit. |
| Technical/source truth | Current baseline logs, actual helpers and DOCTRINE progressive narrowing/zero-block owner recovery; existing authority/review contract maintained. |
| Style | Bash set -euo pipefail and Node .mjs, existing state-io atomic helpers, source-derived registry/generation. |
| Risk | Existing transactional installer, immutable evidence store and exact owner binding remain the architecture. No new persistence/host abstraction or external dependency. |

## External State
| Environment | State | Coupling | Lifecycle wiring |
|---|---|---|---|
| 1,2 | fixture HOME/XDG and final managed host surfaces | coupled | per-test fixture roots; setup transactions; all-host drift at Stage C; no live task-worktree install |
| 3 | original checkout, isolated task worktree, durable handoff clone | coupled | exact canonical cleanup allowlist/branch refs and restore-tested preserved bytes from roadmap; no force reset |
| 6 | active product sessions | decoupled-justified | no process/service restart; preserve source dependencies through install handoff; stop exact cutover if newly arrived owner work conflicts |
| 7 | bounded reviewer CLI calls, GitHub source PR | coupled | explicit task policy, frozen digest launcher receipts; standard land and actual remote verification |
| 9,12 | generated routing index, native mirrors | coupled | regenerate from source and bind content hashes before review |
| 15 | task graphs, logs, immutable review artifacts | coupled | existing state-io/evidence-store, schema and hash proof before cleanup |
Untouched environments: 4,5,8,10,11,13,14. The frozen graph contains no deploy-class task, and the Files Planned inventory contains no credential or provider-purchase path; these are the scope probes supporting the untouched classification.

## Validation Plan
Plan-level free checks run before paid review. The existing mechanical helper has a reproduced phase bug: it requires all future implementation paths to be already changed. Preserve the raw failure; self/Sol/Cursor assess this explicit T2 repair rather than creating implementation before plan approval. No unrelated schema/ownership failure is accepted. Execution/default mechanical validation must pass completely before source release.
## Execution Command Sequence
```bash
node scripts/validate-task-graph-lane.mjs .svc/lane-tasks-WI-FW-CLEAN-MAIN-FOLLOWUP-01.json
node scripts/validate-plan-contract.mjs docs/plans/2026-09-06-clean-main-followup/plan-contract.json . --phase plan # expected exit 0 after T2
bash scripts/verify-plan-mechanical.sh docs/plans/2026-09-06-clean-main-followup/manifest.md . --phase plan # expected exit 0 after T2
node scripts/lint-skills-manifest.mjs
node scripts/skill-router.mjs validate
```
The phase commands above describe the post-T2 interface. Before T2 exists, retain the recorded legacy C1/C10 failure; it is an explicit pre-implementation exception under review, not exit 0 evidence. Every other command in these sequences expects exit 0.

After approved plan, run affected listed validators as each cause is repaired. Then:
```bash
node test-framework/evals/tier-1/validate-clean-main-followup.mjs
node test-framework/evals/tier-1/validate-tier1-selector-v2.mjs
node scripts/lint-skills-manifest.mjs
node scripts/skill-router.mjs validate
bash scripts/verify-file-persistence.sh --from-git-status
node scripts/sync-native-agents.mjs --check
node scripts/validate-plan-contract.mjs docs/plans/2026-09-06-clean-main-followup/plan-contract.json . --phase execution
bash scripts/verify-plan-mechanical.sh docs/plans/2026-09-06-clean-main-followup/manifest.md . --phase execution
EVALS=0 SVC_TIER1_MODE=full SVC_TIER1_SUMMARY=.svc/clean-main-review/full-corpus-input-bound.json bash test-framework/evals/run-all-evals.sh
```
RECOVERY_IF_FAIL: inspect retained exact validator/receipt output; reproduce in its fixture, correct only the named cause, and rerun invalidated checks. Do not retry unchanged failures or invoke another provider. If the defect changes reviewed behavior/scope, amend the manifest and re-review that change. Full precommit checks remain required for this first cadence migration. Checkpoint only after applicable gates; do not bypass hooks or fabricate receipt output. Emit phase receipts from actual tasks through task-graph.mjs and chain receipts through emit-receipt.mjs, not hand-authored approval.

### T3 exact generation commands (after canonical skill/context edits)
T3 executes this block from the task worktree; every command expects exit 0. The scratch-only generator and comparison are the same operations already exercised in .svc/clean-main-review/mirror-scratch-proof.json (27 outputs, exactly two differences). This implementation block additionally copies back those two outputs. An already-converged rerun allows no differences; any difference outside the allowlist aborts before copy-back. Never hand-edit generated mirrors or routing JSON.

```bash
python3 - <<'PY_GENERATE'
from pathlib import Path
import tempfile, shutil, subprocess
root = Path.cwd()
allowed = {Path('.claude/agents/ad-video-producer.md'), Path('.claude/agents/strategic-reviewer.md')}
with tempfile.TemporaryDirectory(prefix='svc-native-mirrors-') as temporary:
    scratch = Path(temporary)
    shutil.copytree(root / 'agents', scratch / 'agents')
    (scratch / 'scripts').mkdir()
    shutil.copy2(root / 'scripts/sync-native-agents.mjs', scratch / 'scripts/sync-native-agents.mjs')
    subprocess.run(['node', 'scripts/sync-native-agents.mjs'], cwd=scratch, check=True)
    changes = []
    for generated in (scratch / '.claude/agents').glob('*.md'):
        relative = generated.relative_to(scratch)
        target = root / relative
        if not target.exists() or target.read_bytes() != generated.read_bytes():
            changes.append(relative)
    if set(changes) - allowed:
        raise RuntimeError('Unexpected generated mirror differences: ' + str(changes))
    for relative in changes:
        target = root / relative
        before = target.read_bytes()
        # Existing source is isolated to this owner; retain the target mode.
        with target.open('wb') as output:
            output.write((scratch / relative).read_bytes())
subprocess.run(['node', 'scripts/sync-native-agents.mjs', '--check'], cwd=root, check=True)
PY_GENERATE
node scripts/compile-skill-router-index.mjs
node scripts/compile-skill-router-index.mjs --check
node scripts/skill-router.mjs validate
```

## Checkpoint Plan
A-fixtures → A-runtime-evidence → A-data-contracts → A-frozen-full-validation → A-reviewed-source-land. Checkpoints before the full gate are retained file/test evidence, not premature commits. Preserve original baseline and failure artifacts; a later correction supersedes interpretation, never raw history. Task-local .svc/clean-main-review evidence is archived to the existing shared immutable store and excluded from the tracked install surface with an exact .gitignore entry; canonical plan/review-log/dispositions remain tracked. Stage B/C remain explicit outstanding work under the full goal and roadmap; no completion claim after Stage A alone.

## Stage A evidence rollback
The pre-edit historical graphs and decision log were preserved in the existing immutable evidence store. The exact verified SHA objects are bound per path in dispositions.json. These are existing captures, not new snapshots represented as pre-edit evidence. Restore only an exact task-owned path after checking that its current bytes still equal this operation's expected postimage; retain concurrent changes and immutable objects. For an existing regular task-owned file, restore bytes in place and preserve its current mode; this operation does not change permissions. Content hashes and the immutable object mode do not prove original filesystem permission bits. A missing file, symlink, or requested mode restoration requires preserved metadata before recreation; halt only that exceptional restoration rather than guess.

The implemented decision-log correction uses the existing canonical waiver schema. Normalize only the preserved row 40 that already declares config_protection_override and approved_by, retaining its original fields and timestamp and adding the required waiver fields. The original unmodified log remains in its bound SHA object. The appended audit event points to that original log hash and line. This is an explicit historical normalization, not an append-only overlay resolver or new authorization. On resume, if the canonical row and its uniquely matching audit event already exist, do nothing. If either differs from the expected original or canonical postimage, stop that exact repair for adjudication; never append another event to make a validator pass. Existing schema validation remains strict for malformed records.

Before an existing relocation/index can be altered, capture its exact bytes and absent/present state at `.svc/clean-main-review/rollback/relocations-before-operation.json`, then use the existing atomic writer for the update. On failure restore only those captured mutable index bytes after verifying the same operation still owns them. Newly appended immutable SHA objects remain inert and retained; do not delete them or overwrite an earlier original-preservation snapshot. Reverting the reviewed source patch restores code behavior. Stage A does not run live host cutover; per-host installer rollback belongs to Stage C's later contract.

## Rollback and Promotion Readiness
Revert only reviewed task changes in the isolated branch, retaining initial bundle and all failed evidence. Never reset original checkout or another active worktree. Full rollback/cutover commands and safety checks are in roadmap.md. Require zero applicable failures, exact diff ownership and writer census, actual plan/exec reviews, audit, remote main verification and source identity. All-host installation and clean-original acceptance are reserved for final Stage C and must be proven before the goal can complete.

## Simulation Report
Base/current paths and validator entrypoints inspected. Planned CREATE paths are absent; MODIFY paths exist. No new dependency/import installation; inline implementations use existing helpers. The Files Planned inventory contains only framework/tooling/documentation surfaces and no product journey, migration or ORM path; the frozen graph has no product-deployment task. These explicit inventories support the applicability decision. Known mechanical-plan future-diff bug is the explicit T2 target, not a PASS. Baseline18failed/1not-run is the starting evidence, not an allowed release result.

## Nineteen current dispositions
All rows retain historical failure attribution at 6d4d8b0; current isolated baseline is fail except the withheld self-heal test. Exact input hashes, explicit missing CREATE values, rollback and proof commands are in dispositions.json. Rows are planned corrections, not completed outcomes. T3 data-only negative cases run from the T2 regression in scratch; unchanged validators remain the oracle.

| Validator | Current / classification | Owner / exact repair files | Positive and negative proof |
|---|---|---|---|
| validate-capability-blocker-inertia.sh | fail; stale hook dependency closure | T1: test-framework/evals/tier-1/validate-capability-blocker-inertia.sh | bash test-framework/evals/tier-1/validate-capability-blocker-inertia.sh; cause-specific rejected/missing/stale/conflicting fixture alongside corrected positive case |
| validate-claude-wirer-cutover.sh | fail; obsolete launcher path assertions | T1: test-framework/evals/tier-1/validate-claude-wirer-cutover.sh | bash test-framework/evals/tier-1/validate-claude-wirer-cutover.sh; cause-specific rejected/missing/stale/conflicting fixture alongside corrected positive case |
| validate-consumer-evidence-root.sh | fail; outdated synthetic receipt schema | T1: test-framework/evals/tier-1/validate-consumer-evidence-root.sh | bash test-framework/evals/tier-1/validate-consumer-evidence-root.sh; cause-specific rejected/missing/stale/conflicting fixture alongside corrected positive case |
| validate-framework-self-management.sh | fail; missing continuation contract | T3: skills/produce-ad-video/SKILL.md | bash test-framework/evals/tier-1/validate-framework-self-management.sh; remove continuation in scratch; checker rejects |
| validate-knowledge-domain-provenance.sh | fail; missing provenance | T3: references/knowledge/domains/mimo/CAPABILITIES.md, references/knowledge/domains/mimo/.sources.jsonl, references/knowledge/domains/claude-hooks/CAPABILITIES.md, references/knowledge/domains/claude-hooks/.sources.jsonl | bash test-framework/evals/tier-1/validate-knowledge-domain-provenance.sh; remove source record in scratch; checker rejects |
| validate-knowledge-legacy-backfill.sh | fail; pipefail hides provenance diagnostic | T1: test-framework/evals/tier-1/validate-knowledge-legacy-backfill.sh | bash test-framework/evals/tier-1/validate-knowledge-legacy-backfill.sh; cause-specific rejected/missing/stale/conflicting fixture alongside corrected positive case |
| validate-lane-tasks-integrity.sh | fail; unsupported historical graph claims | T3: .svc/lane-tasks-WI-567.json, .svc/lane-tasks-WI-SSVE-ARCHITECTURE-EVOLUTION-02.json, .svc/lane-tasks-WI-FW-SWARM-COORDINATION-01.json | bash test-framework/evals/tier-1/validate-lane-tasks-integrity.sh; malformed graph/unsupported completed phase rejects |
| validate-locked-agents.sh | fail; generated mirror drift | T3: .claude/agents/ad-video-producer.md, .claude/agents/strategic-reviewer.md | bash test-framework/evals/tier-1/validate-locked-agents.sh; tamper generated mirror in scratch; --check rejects |
| validate-pipeline-decisions-recent.sh | fail; live-age dependency | T1: test-framework/evals/tier-1/validate-pipeline-decisions-recent.sh | bash test-framework/evals/tier-1/validate-pipeline-decisions-recent.sh; cause-specific rejected/missing/stale/conflicting fixture alongside corrected positive case |
| validate-pipeline-decisions-schema.sh | fail; malformed decision row | T1: test-framework/evals/tier-1/validate-pipeline-decisions-schema.sh | bash test-framework/evals/tier-1/validate-pipeline-decisions-schema.sh; cause-specific rejected/missing/stale/conflicting fixture alongside corrected positive case |
| validate-pretool-decision-engine.sh | fail; incomplete authority fixture | T1: test-framework/evals/tier-1/validate-pretool-decision-engine.sh | bash test-framework/evals/tier-1/validate-pretool-decision-engine.sh; cause-specific rejected/missing/stale/conflicting fixture alongside corrected positive case |
| validate-proposal-triage-sla.sh | fail; proposal metadata/identifier drift | T1: test-framework/evals/tier-1/validate-proposal-triage-sla.sh | bash test-framework/evals/tier-1/validate-proposal-triage-sla.sh; cause-specific rejected/missing/stale/conflicting fixture alongside corrected positive case |
| validate-self-heal-survives-double-dead-pointer.sh | not_run_pre_change_live_state_mutation; live HOME mutation hazard | T1: test-framework/evals/tier-1/validate-self-heal-survives-double-dead-pointer.sh | bash test-framework/evals/tier-1/validate-self-heal-survives-double-dead-pointer.sh; cause-specific rejected/missing/stale/conflicting fixture alongside corrected positive case |
| validate-session-contract-freshness.sh | fail; live-age dependency | T1: test-framework/evals/tier-1/validate-session-contract-freshness.sh | bash test-framework/evals/tier-1/validate-session-contract-freshness.sh; cause-specific rejected/missing/stale/conflicting fixture alongside corrected positive case |
| validate-skill-before-starting.sh | fail; missing context family | T3: references/context-loading-registry.json, skills/produce-ad-video/SKILL.md | bash test-framework/evals/tier-1/validate-skill-before-starting.sh; remove included skill from registry in scratch; checker rejects |
| validate-skill-receipt-shape.sh | fail; missing historic phase evidence | T3: .svc/lane-tasks-WI-567.json, .svc/lane-tasks-WI-SSVE-ARCHITECTURE-EVOLUTION-02.json, .svc/lane-tasks-WI-FW-SWARM-COORDINATION-01.json | bash test-framework/evals/tier-1/validate-skill-receipt-shape.sh; assert completed without authentic required phase evidence; checker rejects |
| validate-skills-source-layout.sh | fail; hardcoded skill count | T1: test-framework/evals/tier-1/validate-skills-source-layout.sh | bash test-framework/evals/tier-1/validate-skills-source-layout.sh; cause-specific rejected/missing/stale/conflicting fixture alongside corrected positive case |
| validate-work-item-metadata.sh | fail; missing affected surface metadata | T3: docs/specs/work-items/WI-GROK-HOST-IDENTITY-02.md | bash test-framework/evals/tier-1/validate-work-item-metadata.sh; remove required metadata in scratch; checker rejects |
| validate-workflow-guard.sh | fail; stale permission expectation | T1: test-framework/evals/tier-1/validate-workflow-guard.sh | bash test-framework/evals/tier-1/validate-workflow-guard.sh; cause-specific rejected/missing/stale/conflicting fixture alongside corrected positive case |

## Framework lane applicability
Separate write-spec and improve-framework artifacts are skipped for this known-gap follow-up, as explicitly recorded in .svc/pipeline-decisions.jsonl with the approved roadmap hash. This plan’s acceptance criteria and actual design-tech carry their substantive scope/design burden. Design/G4 stays in progress until real final reviews and phase evidence exist; no execution or release skill is skipped.

## Reproduced launcher repair before further paid review
The fourth provider call ran before the existing issuance cap rejected it, and emergency receipt generation dropped the completed attempt. Extend the existing T2 provenance helper and launcher: acquire an existing-style heartbeat cycle lock, check authenticated cycle inventory before invoking a paid provider, retain the lock through issuance, and preserve actual attempts/tuple/usage/findings when a later internal write fails. Keep the three-round ceiling unchanged. Use only temporary HOME/authority/store roots and stub executables in regression fixtures. This reversible repair proceeds under the founder’s explicit implementation/recovery authorization; it does not mark the prior plan gate passing, reset the cycle, relabel the fourth call, or authorize release. Actual changeset review/audit remains required. Existing scope receives one exact launcher path; no new policy layer.

### Reproduced fixture and triage scope correction

The product-safety validator selects the latest committed plan and compares it
with an unrelated in-progress diff. Move its software proof to fixtures; keep
explicit strict execution validation of this plan at the release boundary.
The expired proposal entry is also recorded in proposals/triage.json, so update
that authoritative row with its existing WI-551 routing rather than extending
a date. Create a truthful work item for this already-authorized follow-up;
associate historical proposal reconciliation with that real work item, never
invent missing historical WI files or claim their implementation was rerun.
These three exact paths extend the existing T1/T3/T4 ownership streams.

## Reproduced Claude wiring correction

The isolated cutover fixture proves that current wire-hooks retains separately
wired legacy mutation guards beside the consolidated dispatcher and deletes a
foreign `/opt/foreign/hooks/kimi/relay.sh` command. T1 therefore owns
`scripts/wire-hooks.mjs`. Reuse the existing shared ownership classifier to
rebuild only managed commands, retain foreign commands within mixed entries,
and preserve disabled/minimal policies and the durable Stop launcher. Review
existing variant-dedup consumers before altering their compatibility contract.
Run the cutover fixture plus variant-dedup and settings-duplicate validators;
no live host setup is evidence for this isolated software correction.

The earlier triage output reported expired deferrals; retain that historical count rather than using it as the current denominator. T3 may update only proposals/triage.json, the proposal files and residual WI files already enumerated in Files Planned. Preserve user freezes and unfinished backlog; never move dates or certify completion to silence a validator. Any additional path requires an explicit plan amendment before mutation; it is not discretionary executor scope. The existing execution-phase plan-contract check is the nonzero exit gate for extra changed paths. Print the exact proposed extra path and stop that item before editing, while continuing independently scoped work.

The self-verify validator reported PASS with zero checks because it searched the retired top-level skill layout. T1 must enumerate the canonical manifest skill package and fail on empty or missing inputs; retain substantive checks.

Historical receipt-shape census additionally identifies advisor tasks1/2, hooks-safety task6, skills-routing task9, and WI567 task4. Preserve originals before correcting unsupported completion. Existing Git-note census and original checkout log inspection do not supply missing required phase evidence; do not fabricate it or undo historical merges.

Full offline corpus:357PASS/9FAIL/0timeouts. T1 scopes the reproduced TMPDIR shadowing, clean-HEAD test assumptions, and consolidated Claude dispatch conformance consumer. Check before/after bytes, not unrelated preexisting diffs; keep actual gate and foreign-host invariants.

Proposal-state correction: backlog_wi records existing unfinished ownership plus a reason without asserting promotion. Validate real canonical WI existence and disallow conflicting disposition fields. accepted_wi retains archival/residual-map and ledger requirements. Update both validators and improve-framework consumer; no new storage layer, no completed backlog claims.

Existing `scripts/lib/review-evidence-store.mjs` remains a read-only dependency: its object/relocation APIs already implement the required archive mechanism. Runtime callers and archive regression fixtures changed; no artificial library edit is needed. The original hosted-media heuristic is carried byte-for-byte with its historical2026-08-27 evidence, not asserted as current provider validation.

### Mixed fixture and live-data checkpoints
T1 proves isolation and fixture behavior without requiring production decision-log or triage data to pass. The live commands `bash test-framework/evals/tier-1/validate-pipeline-decisions-schema.sh` and `bash test-framework/evals/tier-1/validate-proposal-triage-sla.sh` run as T3 exit checks after their data repairs. Their disposition rows retain T1 as validator-code owner and explicitly name T3 as live-proof owner. T4 requires the full corpus to pass; no expected intermediate failure is release evidence.

Executable consumers are one-or-more direct executable reference witnesses, not an exhaustive reverse-call graph. The unused denominator counts missing or unmatched declared witnesses. Runner globs, direct imports, and literal mapped validator names are valid when the actual executable consumer contains the recorded query. Additional witnesses clarify launcher/selector/standalone fixture coverage without introducing a new all-callers gate.

### Execution-discovered fixture amendment
The current full corpus produced 364 PASS and two failures with stable endpoint hashes. validate-rename-schema-drill temporarily renames a shared source schema, racing validate-receipt-tier. Run the drill against a private copy of its runtime/schema dependencies. validate-wire-kimi-hooks-paths uses echo/grep pipelines under pipefail and leaves its tilde argument shell-expanded; use direct here-string matching and a quoted literal tilde so the actual path contract is exercised. These two T1 paths extend the fixture correction scope; no production runtime or gate is weakened. Recheck concurrent schema readers and Kimi positive/negative paths, then the release corpus.
