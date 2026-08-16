# WI-541 Full Framework Transition — Implementation Manifest

**Status:** SIMULATED
**Spec:** `docs/specs/features/wi-541-full-transition.md`
**Technical design:** `docs/specs/tech/wi-541-full-transition.md`
**Branch:** `framework-WI-541-full-transition-program`
**Base:** `main` at `ec625b9a57dc2ccc8d01f0bcc7c86548bb0cf9c9`
**Created:** 2026-08-15
**Lane:** framework
**Archetype:** primary architectural change; secondary cross-cutting contract change
**Execution mode:** inline — the bound orchestrator that authored and reviewed this plan applies it with the full spec/design context loaded; dispatch blueprints are intentionally omitted.

## Implementation Summary

Close the content-deduplicated HoursHub-derived transition program as one cumulative, locally landed framework change. The implementation single-sources the mandatory route chain; covers Bash mutation in every concrete-path guard; resolves child transport before launch; adds purpose-bound promotion and secure same-owner legacy convergence; turns plan safety, review independence, learning consumption, authorization envelopes, proposal SLAs, and the red WI-516–WI-523 residuals into consumed executable contracts.

The following invariants are immutable:

- no GitHub call, remote publication, product-repository mutation, or product deployment;
- no bypass of controller leases, canonical loaders, worktree containment, review gates, or receipt checks;
- existing dirty main and sibling-worktree residue is read-only and byte-preserved;
- external review remains owner-policy-selected and independent; self-authored PASS prose is never proof;
- quick-fix risk and eligibility detectors remain byte-identical while their routing prominence is retired;
- historical proposals, learnings, authority events, and receipts are retained or archived, never erased;
- all new executable machinery has a named caller and behavioral fixture;
- the final claim distinguishes source implementation, focused/local verification, local commit, installed-host convergence, and the deliberately absent remote/live-product proof.

## Decision Trace

| Question | Alternatives | Chosen | Rationale | Reversal condition |
|---|---|---|---|---|
| Delivery shape | independent residual WIs; one unstructured bulk patch; one governed cumulative program | one governed cumulative program | The gaps interact at route, authority, plan, review, landing, and installation seams. One file-owner graph prevents the cross-WI drift already observed. | Split only if review proves an independent task cannot be tested or rolled back without another task. |
| Mandatory chain source | duplicate arrays; generated registry; shared pure module | shared pure module | Compiler and validator already drifted. A frozen shared array is the smallest consumed authority and keeps semantically different manifest arrays distinct. | Use generated topology only if multiple independent consumers need data-driven owner customization. |
| Mutating child transport | generic native agents; delegated wrapper only; controller only; typed resolver | typed resolver | Native availability does not prove child identity, worktree, path grant, token, or containment. The resolver preserves read-only native work and chooses a safe mutation path before launch. | Admit native mutation only after the host exposes the complete delegation tuple and containment probe. |
| Recovery | owner shell ritual; clean-and-recreate; exact capability plus same-owner convergence | exact capability plus same-owner convergence | Sanctioned detach and legacy missing-state recovery must be reachable without widening foreign/ambiguous authority or deleting residue. | Narrow further if a disposable state-machine fixture exposes an ambiguous success transition. |
| Plan safety | prose checklist; multiple independent scripts; one typed consumed contract | one typed consumed contract | Ownership, reversible writers, absence claims, consumers, and reviewer evidence need one schema and one fail-closed entrypoint used by planning and review. | Split only if a sub-contract becomes a stable independently versioned public surface. |
| Learning | trust historical shapes; rewrite history; normalize on read plus append lifecycle events | normalize on read plus append lifecycle events | This preserves immutable history, reports malformed rows, and makes use/outcome/promotion mechanically visible. | Migrate storage only after measured read cost breaches the declared startup budget. |
| Authorization | infer every shell command; documentation only; explicit observable outward-action wrapper | explicit wrapper plus Stop telemetry | It creates a real boundary for known outward effects without pretending hooks are a complete shell sandbox; absent envelopes preserve current behavior. | Expand boundary adapters only when a named external-action consumer appears. |

## Files Planned

New paths are written without code formatting until execution creates them; every MODIFY path exists in the disk layer.

| Task | Action | File(s) | Purpose |
|---|---|---|---|
| T01 | CREATE | docs/specs/evidence/wi-541-source-ledger.json; test-framework/evals/tier-1/validate-wi541-source-ledger.mjs | Canonical deduplicated denominator, dispositions, evidence, and deterministic census. |
| T01 | CREATE | proposals/done/2026-08-15-evolution-hoursHub-transition.md; proposals/done/2026-08-15-framework-improvement-mandatory-chain-graph-parity.md; docs/specs/work-items/WI-541-residual-map.json | Archived accepted sources and their explicit residual ownership map. |
| T01 | MODIFY | `proposals/triage.json`; `test-framework/evals/tier-1/validate-proposal-triage-sla.sh`; `docs/specs/work-items/PROPOSAL-PROMOTION-LEDGER.md` | Current disposition for every direct proposal, accepted-source archival, and counted SLA output. |
| T02 | CREATE | scripts/lib/mandatory-delivery-chain.mjs; test-framework/evals/tier-1/validate-mandatory-delivery-chain.sh | One exact mutable-lane chain and negative fixtures. |
| T02 | MODIFY | `scripts/compile-delivery-graph.mjs`; `scripts/validate-delivery-graph.mjs`; `scripts/validate-task-graph-lane.mjs`; `scripts/classify-delivery-graph-closeout.mjs`; `skills/route-workflow/references/lane-model.md`; `test-framework/evals/tier-1/validate-delivery-graph-compiler.sh`; `test-framework/evals/tier-1/validate-delivery-graph-replay-autorun.sh`; `test-framework/evals/tier-1/validate-delivery-graph-closeout-classification.sh` | Consume the same chain for compilation, runtime and closeout validation, and documentation. |
| T03 | CREATE | hooks/lib/bash-mutation-targets.mjs; references/concrete-path-guard-inventory.md; test-framework/evals/tier-1/validate-concrete-path-bash-guards.sh | Shared decoded Bash mutation classification, coverage inventory, and replay. |
| T03 | MODIFY | `hooks/svc-workflow-guard.mjs`; `hooks/svc-skill-artifact-authenticity.mjs`; `hooks/svc-session-contract-freshness.mjs`; `hooks/hooks.json`; `hooks/svc-worktree-isolation-guard.mjs`; `hooks/svc-impact-triad-guard.mjs`; `test-framework/evals/tier-1/validate-g4-skill-artifact-authenticity.sh` | Cover Bash writes while keeping read-only commands allowed, keep hermetic hook fixtures complete, and name tested exemptions. |
| T04 | CREATE | scripts/resolve-child-transport.mjs; test-framework/evals/tier-1/validate-child-transport-resolver.mjs | Pure three-outcome resolver, complete delegation tuple, and prelaunch receipt. |
| T04 | MODIFY | `hooks/lib/delegation-authority.mjs`; `skills/execute-changeset/SKILL.md`; `skills/execute-changeset/references/subagent-dispatch.md`; `skills/dispatch-waves/SKILL.md`; `provision/hosts/codex.json`; `scripts/dispatch-worker.sh`; `scripts/dispatch-execution-task.mjs`; `scripts/svc-contained-exec.mjs`; `scripts/validate-execution-merge-back.mjs`; `test-framework/evals/tier-1/validate-parallel-wi-dispatch.sh`; `test-framework/evals/tier-1/validate-delegated-execution-authority.sh` | Route unsupported mutation to controller before launch, enforce delegated paths in OS containment, preserve lifecycle receipts, make merge-back locked and failure-atomic, and keep native reads available. |
| T05 | CREATE | hooks/codex/lib/promotion-capability.mjs; test-framework/evals/tier-1/validate-promotion-authority.sh | Exact, expiring, single-use promotion tuple and state-machine proof. |
| T05 | MODIFY | `scripts/svc-owner-recovery.mjs`; `scripts/svc-ensure-worktree.mjs`; `scripts/merge-pr-with-review-receipt.mjs`; `skills/verify-promotion/SKILL.md`; `test-framework/evals/tier-1/validate-existing-worktree-self-heal.sh` | Secure generation-zero legacy adoption, exact-argv detached promotion consumed by verification, and no residue deletion; T07's sole owner applies the landing-skill consumer update. |
| T06 | CREATE | scripts/validate-plan-contract.mjs; scripts/find-callers.mjs; scripts/lib/reviewer-evidence.mjs; scripts/lib/external-review-provenance.mjs; schemas/plan-contract.schema.json; docs/plans/2026-08-15-wi541-full-framework-transition/plan-contract.json; test-framework/evals/tier-1/fixtures/external-review-fixture.mjs; test-framework/evals/tier-1/validate-plan-product-safety.sh; test-framework/evals/tier-1/validate-reviewer-run-evidence.sh | One consumed plan/product/claim/caller/consumer contract and canonical external reviewer evidence fixtures. |
| T06 | MODIFY | `docs/plans/2026-08-15-wi541-full-framework-transition/manifest.md`; `docs/plans/2026-08-15-wi541-full-framework-transition/review-log.yaml`; `scripts/verify-plan-mechanical.sh`; `scripts/emit-receipt.mjs`; `skills/plan-changeset/SKILL.md`; `skills/review-plan/SKILL.md`; `skills/review-exec/SKILL.md`; `scripts/run-external-review.mjs`; `schemas/external-review-receipt.schema.json`; `schemas/receipts/review-plan.schema.json`; `schemas/receipts/review-exec.schema.json`; `scripts/check-chain-receipts.mjs`; `test-framework/evals/tier-1/validate-receipt-tier.sh`; `test-framework/evals/tier-1/validate-receipt-sha-pinning.sh`; `test-framework/evals/tier-1/validate-retroactive-attestation.sh`; `test-framework/evals/tier-1/validate-review-topology-v2.mjs`; `test-framework/evals/tier-1/validate-external-review-launcher.sh` | Fail before execution on overlapping ownership, unsafe reversible writers, unproven absence, undeclared consumers, reviewer-proof laundering, shell-interpolated SHA input, or stale review-topology fixtures. |
| T07 | CREATE | scripts/learning-lifecycle.mjs; test-framework/evals/tier-1/validate-learning-lifecycle.sh | Normalize, report, triage, elevate, federate, and outcome-link learnings. |
| T07 | MODIFY | `hooks/lib/learning-index.mjs`; `hooks/svc-learning-inject.mjs`; `skills/manage-learnings/SKILL.md`; `skills/recall-stack-knowledge/SKILL.md`; `skills/evaluate-rule/SKILL.md`; `skills/land-changeset/SKILL.md`; `scripts/promote-auto-learnings.mjs`; `test-framework/evals/tier-1/validate-auto-learning-promote-replay.sh` | Make learning records consumed and framework credit outcome-bound through canonical independently reviewed evaluate-rule artifacts. |
| T08 | CREATE | scripts/svc-authorized-action.mjs; references/authorization-envelope.md; test-framework/evals/tier-1/validate-authorization-envelope.sh | Enforce explicit action/environment/purpose rows at a real outward boundary and record Stop waste. |
| T08 | MODIFY | `_shared/session-contract.md`; `hooks/codex/svc-codex-pretool-dispatcher.mjs`; `hooks/svc-auto-capture-learnings.mjs` | Wire explicit envelope decisions and Stop telemetry without changing absent-envelope behavior; T04's sole owner applies the requested Codex manifest entry. |
| T09 | CREATE | scripts/lib/stage-registry.mjs; test-framework/evals/tier-1/validate-task-graph-concurrency.sh; test-framework/evals/tier-1/validate-stage-registry-single-source.sh | Shared stage validation and real lock/concurrency proof. |
| T09 | MODIFY | `scripts/task-graph.mjs`; `scripts/audit-story-receipts.mjs`; `scripts/stage-activation.mjs`; `skills/write-spec/SKILL.md`; `skills/route-workflow/SKILL.md`; `scripts/svc-auto-drive.mjs`; `scripts/kimi-e2e-test.mjs`; `scripts/scenario-runner.mjs`; `docs/specs/plans/FRAMEWORK_OPTIMIZATION_PLAN.md`; `schemas/receipts/verify-promotion.schema.json`; `test-framework/evals/tier-1/validate-route-workflow-hot-path-size.sh`; `test-framework/evals/tier-1/validate-g1-lane-tasks-edit-guard.sh`; `test-framework/evals/tier-1/validate-state-io-discipline.sh` | Atomic updates, refuted optimization removal, optional story hash, one registry parser, complete reduced-bundle consumers, real genesis SHA, literal route commands, and arg-array Git reads; T06's sole owner applies the requested receipt-tier cases. |
| T10 | MODIFY | `skills-manifest.json`; `README.md`; `KIMI.md`; `GEMINI.md`; `ANTIGRAVITY.md`; `skills/route-workflow/references/routing-rules.md`; test-framework/evals/tier-1/validate-quick-fix-retirement.sh | Remove quick-fix from core/curated routing while preserving compatibility and detector bytes; synchronize all changed manifest mirrors. |
| T11 | MODIFY | `FRAMEWORK-STATE.md`; `docs/specs/work-items/WI-541.md`; `docs/specs/work-items/INDEX.md`; `docs/specs/features/wi-541-full-transition.md`; `docs/specs/tech/wi-541-full-transition.md`; `docs/specs/decisions/wi-541-full-transition.md`; `docs/specs/decisions/wi-541-solution-confidence/SOLUTION-CONFIDENCE.md`; `docs/specs/explorations/wi-541-full-transition/PROBLEM_BRIEF.md`; `docs/specs/explorations/wi-541-full-transition/SOLUTION_MAP.md`; `docs/specs/explorations/wi-541-full-transition/ANALYSIS.md`; `docs/specs/explorations/wi-541-full-transition/DECISION.md`; `docs/specs/relations/wi-541-full-transition.branches.md`; `docs/specs/relations/wi-541-full-transition.branches.md.imports.json`; `.svc/spec-index.json`; `docs/specs/research-log.md`; `references/knowledge/domains/codex-hooks/CAPABILITIES.md`; `references/knowledge/domains/codex-hooks/details/events.md`; `references/knowledge/domains/codex-hooks/.sources.jsonl` | Final AC evidence, source/consumer matrix, research basis, branch-index freshness, and honest implementation/install/local-only state. |
| T11 | CREATE | docs/specs/audit/wi-541-consumption-audit.md; docs/specs/audit/wi-541-security-review.md; docs/specs/audit/wi-541-session-audit.md | Final consumed/unused proof and independent audit records. |
| T11 | CREATE | .svc/feature-graph-WI-541.json; .svc/lane-tasks-WI-541.json; .svc/pipeline-decisions.jsonl; .svc/session-contract.jsonl | Durable WI graph, task, decision, and session evidence included in the exact candidate. |

No file is owned by more than one task. `provision/hosts/codex.json` is owned by T04; T08 depends on T04 and may request its envelope hook entry through T04’s owner before T04 closes. `validate-receipt-tier.sh` is owned by T06; T09 supplies the verify-promotion cases to that owner. The final diff-declaration validator must reject any path outside this table.

## Task Graph

```json
{
  "tasks": [
    {"id":"T01","title":"source ledger and proposal SLA","blocked_by":[],"ac":["W541-01","W541-21","W541-22"]},
    {"id":"T02","title":"mandatory delivery chain parity","blocked_by":[],"ac":["W541-02","W541-03"]},
    {"id":"T03","title":"concrete-path Bash guards","blocked_by":[],"ac":["W541-04"]},
    {"id":"T04","title":"child transport preflight","blocked_by":[],"ac":["W541-05","W541-06"]},
    {"id":"T05","title":"promotion and legacy recovery authority","blocked_by":[],"ac":["W541-07","W541-08"]},
    {"id":"T06","title":"plan product safety and reviewer evidence","blocked_by":["T02"],"ac":["W541-09","W541-10","W541-11","W541-12","W541-22"]},
    {"id":"T07","title":"learning consumption lifecycle","blocked_by":[],"ac":["W541-13","W541-14","W541-22"]},
    {"id":"T08","title":"authorization envelope boundary","blocked_by":["T04"],"ac":["W541-15"]},
    {"id":"T09","title":"atomic graph and mechanical residuals","blocked_by":["T02"],"ac":["W541-17","W541-18","W541-19","W541-20"]},
    {"id":"T10","title":"quick-fix routing retirement","blocked_by":["T02"],"ac":["W541-16","W541-22"]},
    {"id":"T11","title":"cumulative audit and state closeout","blocked_by":["T01","T03","T05","T06","T07","T08","T09","T10"],"ac":["W541-01","W541-22","W541-23","W541-24","W541-25"]},
    {"id":"T12","title":"all-host convergence and local-only land","blocked_by":["T11"],"ac":["W541-23","W541-24","W541-25"]}
  ]
}
```

### Task contracts

| Task | Method | Validation | Checkpoint / rollback anchor | Parallel group |
|---|---|---|---|---|
| T01 | Write the ledger schema first; census direct proposals, registered HoursHub proposal families, and staged learnings by normalized content digest; then update current dispositions and counted SLA. | `node test-framework/evals/tier-1/validate-wi541-source-ledger.mjs` and `bash test-framework/evals/tier-1/validate-proposal-triage-sla.sh` | `T01-source-ledger-pass`; revert only T01 paths. | A |
| T02 | Red-test every mutable lane; create one frozen chain; import it from compiler and validator; require exact single contiguous occurrence. | `bash test-framework/evals/tier-1/validate-mandatory-delivery-chain.sh` | `T02-chain-parity-pass`; revert T02 module and consumers together. | A |
| T03 | Inventory every concrete-path guard; red-test Python, sed in-place, heredoc, jq redirect, direct redirect, quoted paths, and read-only commands; then consume one decoded target classifier. | `bash test-framework/evals/tier-1/validate-concrete-path-bash-guards.sh` | `T03-bash-guards-pass`; restore prior hook manifest and guards together. | A |
| T04 | Red-test generic capability, missing tuple fields, overlap, and HoursHub billing topology; implement pure prelaunch resolution and receipt; update consumers and Codex capability declaration. | `bash test-framework/evals/tier-1/validate-child-transport-resolution.sh` | `T04-transport-pass`; remove resolver and restore consumers as one unit. | A |
| T05 | Red-test expiry/replay/widening/foreign tuples and a residue-bearing generation-zero worktree; implement locked exact capability and only-missing authority convergence; replay WI-538 topology in a disposable linked worktree. | `bash test-framework/evals/tier-1/validate-promotion-authority.sh` and `bash test-framework/evals/tier-1/validate-existing-worktree-self-heal.sh` | `T05-authority-pass`; append revocation, restore old code, never delete residue/events. | A |
| T06 | Define schema and failing fixtures first; validate declared file ownership against diff, reversible writer orders/property sweep, direct evidence/denominators, callers/consumers, reviewer-run outputs, and deletion parse/collect evidence; wire plan and review consumers. | `bash test-framework/evals/tier-1/validate-plan-product-safety.sh`, `bash test-framework/evals/tier-1/validate-reviewer-run-evidence.sh`, launcher and receipt validators | `T06-plan-review-safety-pass`; schema-version conditional preserves historical receipts. | B |
| T07 | Red-test both ledger shapes and malformed confidence; normalize without rewriting source; append used/ignored/outcome events; require bounded triage, evaluate-rule receipt, safe federated roots, and outcome linkage before credit. | `bash test-framework/evals/tier-1/validate-learning-lifecycle.sh` and existing learning injection validation | `T07-learning-pass`; disable new consumers while append-only events remain. | A |
| T08 | Red-test explicit outside deny, inside stop record, replay, absent-envelope parity, and p95; add one outward-action wrapper and dispatcher telemetry using T04’s owned manifest entry. | `bash test-framework/evals/tier-1/validate-authorization-envelope.sh` | `T08-envelope-pass`; restore dispatcher/config while retaining denial telemetry. | B |
| T09 | Red-test lost updates and lock release with real processes; single-source stage parsing; delete only the stale OPT-01 active row; add optional hash property; replace interpolated Git read; fix literal commands/genesis SHA within route line budget. | concurrency, stage, receipt, route-budget, and existing auto-drive validators | `T09-residuals-pass`; revert T09 paths atomically. | B |
| T10 | Hash both eligibility detectors before/after; remove quick-fix only from core routing and curated guidance; retain first-party compatibility registry entry and retirement notice; regenerate synchronized mirrors and lint. | `bash test-framework/evals/tier-1/validate-quick-fix-retirement.sh` and manifest linter | `T10-retirement-pass`; restore routing arrays/docs together. | B |
| T11 | Run the cumulative diff/consumer/security/implementation/session audits, update AC evidence and state, restamp branch index, and make every claim name its environment. | focused aggregate plus pipeline/lint/full Tier 1 | `T11-cumulative-pass`; repair findings before proceeding. | C |
| T12 | Run all-host setup/drift, installed Codex replays, final exact-candidate review, emit chain receipts, create one local commit, and rerun final-SHA validators without any remote call. | setup/drift, installed replay, receipt audit, `git status`, local log | local commit; rollback is a local revert followed by all-host setup. | D |

## AC-to-Task Mapping

| AC | Task(s) | Coverage |
|---|---|---|
| W541-01 | T01, T11 | COMPLETE — deduplicated ledger plus final audit. |
| W541-02 | T02 | COMPLETE — compile every mutable lane from one contract. |
| W541-03 | T02 | COMPLETE — exact-sequence negative fixtures. |
| W541-04 | T03 | COMPLETE — inventory, classifier, hook replay. |
| W541-05 | T04 | COMPLETE — pure three-outcome resolver. |
| W541-06 | T04 | COMPLETE — tuple and HoursHub topology replay. |
| W541-07 | T05 | COMPLETE — purpose-bound capability state machine. |
| W541-08 | T05 | COMPLETE — residue-preserving WI-538 replay. |
| W541-09 | T06 | COMPLETE — plan ownership and actual-diff reconciliation. |
| W541-10 | T06 | COMPLETE — both operation orders, compensation, property sweep. |
| W541-11 | T06 | COMPLETE — direct evidence and namespace-aware caller denominator. |
| W541-12 | T06 | COMPLETE — reviewer-run output and deletion evidence contract. |
| W541-13 | T07 | COMPLETE — strict normalized read view and findings. |
| W541-14 | T07 | COMPLETE — triage/evaluate/federate/outcome lifecycle. |
| W541-15 | T08 | COMPLETE — real boundary, absent parity, Stop record, timing. |
| W541-16 | T10 | COMPLETE — routing retirement with detector digest proof. |
| W541-17 | T09 | COMPLETE — real concurrent mutation and error-release fixture. |
| W541-18 | T09 | COMPLETE — active row removal, refutation retained, no parser. |
| W541-19 | T09 | COMPLETE — optional property positive/negative fixtures. |
| W541-20 | T09 | COMPLETE — shared stage, real SHA, executable route command, arg arrays. |
| W541-21 | T01 | COMPLETE — current disposition counts and expiry denial. |
| W541-22 | T01, T04, T06, T07, T10, T11 | COMPLETE — every executable names consumer/test; removal needs zero-consumer proof. |
| W541-23 | T11, T12 | COMPLETE — focused, cumulative, security, implementation, session, Tier 1. |
| W541-24 | T12 | COMPLETE — all eight installed hosts plus installed Codex replay. |
| W541-25 | T12 | COMPLETE — local commit/receipts and explicit no-remote evidence. |

No AC is partial, deferred, or missing.

## AC-to-Test Mapping

| AC | Type | Evidence |
|---|---|---|
| W541-01 | Unit | Deterministic ledger fixture recomputes denominator, unique digests, and dispositions. |
| W541-02 | Unit | Per-lane compiler fixture. |
| W541-03 | Unit | Omission, duplicate, substitute, and reorder mutations. |
| W541-04 | E2E | Consolidated hook replay over Bash read/write forms. |
| W541-05 | Unit | Pure resolver matrix. |
| W541-06 | E2E | HoursHub billing topology plus delegation receipt replay. |
| W541-07 | Unit | Capability transition/replay/expiry/tuple mutation matrix. |
| W541-08 | E2E | Disposable linked worktree with tracked and untracked residue. |
| W541-09 | Unit | Ownership overlap/shared-owner/diff-declaration fixtures. |
| W541-10 | Unit | Writer class and both operation-order mutations. |
| W541-11 | E2E | Caller namespace fixture with positive/zero/denominator cases. |
| W541-12 | E2E | Launcher/receipt fixtures including submitter-only and deletion-bearing diffs. |
| W541-13 | Unit | id/key and numeric/string/malformed normalization table. |
| W541-14 | E2E | Capture-to-use/outcome/promotion/elevation/federation lifecycle replay. |
| W541-15 | E2E | Mock outward executor plus Stop record and 100-run p95 sample. |
| W541-16 | Unit | Routing/guidance absence plus before/after detector SHA-256. |
| W541-17 | E2E | Real competing Node processes and thrown closure lock release. |
| W541-18 | Unit | Plan diff assertion and explicit no-new-parser check. |
| W541-19 | Unit | Schema missing/valid/malformed property cases. |
| W541-20 | Unit | Shared registry mutants, genesis SHA, literal command, and execFile argv spy. |
| W541-21 | E2E | Repository proposal registry SLA with printed numerator/denominator. |
| W541-22 | E2E | Final changed-executable consumer/caller/test audit. |
| W541-23 | E2E | Full local framework validation and audits. |
| W541-24 | E2E | All-host install drift and installed Codex scenarios. |
| W541-25 | Manual | Verify local commit/notes and absence of push/PR commands in session evidence. |

## Prerequisite Alignment Matrix

| Task | UX/UI | Technical design | Style/pattern | Persona/competitive trace |
|---|---|---|---|---|
| T01–T02 | N/A — no visual surface | Chain and denominator components in the WI-541 technical design | Deterministic JSON/JSONL and portable shell fixtures | S1 framework owner; S2 route controller; market landscape explicitly inapplicable in the spec. |
| T03–T05 | Operator denials must name exact recovery; no UI assets | Authority and child-dispatch state machines in the technical design and design decisions | Existing decoded argv, stable-principal lease, lock, temp/fsync/rename, and contained execution patterns | S3 secure executor; official host capability evidence recorded in codex-hooks knowledge. |
| T06 | Plan/review operator output must identify failed claim and evidence gap | Plan-contract and reviewer-evidence components | Dependency-free Node ESM, strict schemas, direct argv arrays, content-addressed receipts | S4 planner/reviewer; no market-facing differentiation. |
| T07 | Recall output reports used/ignored and malformed entries plainly | Learning-flow component | Normalize on read; append-only lifecycle; bounded triage | S5 learning system. |
| T08 | Denial/Stop text is actionable; no visual surface | Explicit observable boundary decision | Absent-envelope compatibility; ordinary host security remains authoritative | S3 secure executor. |
| T09–T10 | Curated host guidance becomes shorter; no interaction redesign | Residual correctness and cleanup components | One shared parser, atomic closures, compatibility retirement | S1 owner and S2 controller. |
| T11–T12 | N/A — evidence/state only | Cumulative architecture, risk, and operations sections | Existing framework audit, receipt, setup, and drift conventions | S1 owner receives implemented/local/installed/local-commit proof separately. |

There are no UX, UI, style-contract, persona dossier, or competitor artifacts because the authoritative spec classifies the feature as an internal non-visual framework contract. The explicit lane decisions for `design-ux`, `design-ui`, `define-code-style`, `build-personas`, and `analyze-competitors` are recorded at `.svc/pipeline-decisions.jsonl:9` through `.svc/pipeline-decisions.jsonl:13`; completed upstream artifacts are cited in the header and task graph. Operator behavior is covered by tested command output rather than a fabricated UI prerequisite.

### Framework lane compliance evidence

| Upstream skill | State | Citation |
|---|---|---|
| `improve-framework` | umbrella remains in progress until the accepted proposal is implemented and replayed | `proposals/done/2026-08-15-framework-improvement-mandatory-chain-graph-parity.md` and task 1 phase receipts in `.svc/lane-tasks-WI-541.json` |
| `evolve-framework` | completed | `proposals/done/2026-08-15-evolution-hoursHub-transition.md` and task 2 receipt |
| `write-spec` | completed | `docs/specs/features/wi-541-full-transition.md` and task 3 receipt |
| `audit-ac` | completed | audited 25-AC feature graph at `.svc/feature-graph-WI-541.json` and task 4 receipt |
| `research` | completed | `docs/specs/research-log.md`, codex-hooks knowledge evidence, and task 5 receipt |
| `design-tech` | completed / G4 PASS | `docs/specs/tech/wi-541-full-transition.md`, solution-confidence packet, and task 6 receipt |
| `explore-solutions` | completed | `docs/specs/explorations/wi-541-full-transition/DECISION.md` and task 7 receipt |
| skipped non-framework prerequisites | mechanically dispositioned | `.svc/pipeline-decisions.jsonl:9` through `.svc/pipeline-decisions.jsonl:13` |

## External State

Wrapper answer: the change relies on and mutates installed host files, repository-shared authority/receipt state, Git worktree registration, and local Git history. Each is coupled to source lifecycle or explicitly monitored; no product or network service state is touched.

| # | Environment | What state | Coupling | Lifecycle wiring |
|---|---|---|---|---|
| 1 | Host filesystem | Eight managed skill/script/reference installations | coupled | `./setup --all-hosts` writes content-addressed transactional installs; `scripts/check-install-drift.sh --all-hosts` detects stale/missing bytes. |
| 2 | Host configuration | Managed hook/config entries, especially Codex child/envelope declarations | coupled | host wirers plus setup receipts and per-host drift checks; transactional restore on late failure. |
| 3 | Git worktrees | WI-541 operation worktree and disposable authority fixtures | coupled | canonical Git registration/realpath checks; fixture traps remove only disposable trees; WI-541 remains until local landing evidence closes. |
| 12 | Downstream generated framework artifacts | Manifest mirrors, routing rules, branch-index import stamp | coupled | manifest linter, branch-index freshness validator, setup generation, and pipeline integrity. |
| 13 | Local Git hook/receipt surface | Installed hook dispatchers and refs/notes receipt envelope for final SHA | coupled | setup/hook installer plus `scripts/check-chain-receipts.mjs`; mirror is regenerable from notes. |
| 15 | Runtime files, locks, caches, and receipts | `.svc` task graph, authority generation, review artifacts, lifecycle logs, lockfiles | coupled | locked atomic writers, expiry/replay checks, bounded cache/lifecycle commands, and append-only audit validation. |
| ad-hoc | Owner reviewer policy | Read-only topology input at ~/.svc/reviewer-policy-v2.json | decoupled-justified | `scripts/review-topology-v2.mjs` and the launcher fail closed on invalid/missing required independent station; the owner controls policy outside framework commits. |

The owner policy is deliberately decoupled because repository code must not overwrite reviewer choice. Every use hash-binds the selected policy into the review receipt; policy drift is detected before review and recovered by owner correction or explicit valid policy selection.

Untouched taxonomy environments: 4 database; 5 deployment platform; 6 scheduler/queue; 7 DNS/domain; 8 external API/provider resources; 9 package/container registry; 10 authentication/identity provider; 11 secrets/key store; 14 search/index/cache service. Product repositories and product runtimes are also untouched.

## Review Surface

- Per task: unstaged diff restricted to the task’s declared file set, focused failing-to-passing test, consumer/caller evidence, and rollback note.
- Shared-owner handoff: T08’s requested Codex host entry is accepted and applied only by T04’s owner before T04 closes; T09’s receipt fixture is accepted and applied only by T06’s owner.
- Cumulative: `git diff ec625b9a57dc2ccc8d01f0bcc7c86548bb0cf9c9 --` plus an actual-path/declaration reconciliation, changed-executable consumer audit, and security diff review.
- Independent review: reviewer runs its own declared commands against the exact candidate digest; submitter logs are context, never substitute evidence.
- Deletion surface: the only planned semantic deletion is the stale OPT-01 active row and routing/guidance references. Reviewer must parse/collect executable callers for any additional deletion before approval.

## Validation Plan

### Test-first order

Each task creates or extends its negative fixture before implementation. A task is not green until its own fixture proves the original defect, the correction, malformed/adversarial cases, and stated compatibility. Cumulative checks run only after all task-owned changes are assembled.

### Focused commands

1. Source/proposals: WI-541 ledger and proposal SLA validators.
2. Route: mandatory-chain, lane-graph, route-line-budget, quick-fix retirement, manifest lint.
3. Security/authority: Bash guards, child transport, promotion authority, existing-worktree self-heal, authorization envelope, Codex execution integrity.
4. Product plans/review: plan-contract, reviewer-run evidence, mechanical plan, external launcher, receipt tier.
5. Learning/state: learning lifecycle/injection, task-graph concurrency, stage registry, story receipt.
6. Cumulative: syntax checks for every changed executable, pipeline integrity, manifest lint, selected Tier 1, then complete Tier 1.
7. Audits: review-security, review-exec, audit-implementation, audit-session-execution with zero unresolved Critical/High.
8. Installed state: all-host setup/drift and installed Codex authority/transport/envelope replay.

### Performance and security budgets

- Existing native hook p95 budgets remain hard ceilings; the Bash and envelope fixtures report p50/p95/max from at least 100 deterministic invocations.
- No network or paid-model call occurs in focused/full Tier 1 fixtures.
- Promotion/recovery and child mutation tests use disposable repositories and explicit bounded paths.
- Every failed authority/envelope/receipt decision must exit nonzero before the mocked mutation counter increments.

## Execution Command Sequence

The commands are non-interactive and local-only. Implementation edits are applied with the active host’s repository edit primitive after each red fixture; they are not encoded as shell writes in this inline manifest.

```bash
set -euo pipefail
repo="$(git rev-parse --show-toplevel)"
cd "$repo"
test "$(git branch --show-current)" = "framework-WI-541-full-transition-program"
test "$(git rev-parse HEAD)" = "ec625b9a57dc2ccc8d01f0bcc7c86548bb0cf9c9"
node scripts/validate-task-graph-lane.mjs .svc/lane-tasks-WI-541.json
bash scripts/verify-plan-mechanical.sh docs/plans/2026-08-15-wi541-full-framework-transition/manifest.md
bash scripts/review-plan-codex.sh docs/plans/2026-08-15-wi541-full-framework-transition/manifest.md

node test-framework/evals/tier-1/validate-wi541-source-ledger.mjs
bash test-framework/evals/tier-1/validate-proposal-triage-sla.sh
bash test-framework/evals/tier-1/validate-mandatory-delivery-chain.sh
bash test-framework/evals/tier-1/validate-concrete-path-bash-guards.sh
node test-framework/evals/tier-1/validate-child-transport-resolver.mjs
bash test-framework/evals/tier-1/validate-promotion-authority.sh
bash test-framework/evals/tier-1/validate-existing-worktree-self-heal.sh
bash test-framework/evals/tier-1/validate-plan-product-safety.sh
bash test-framework/evals/tier-1/validate-reviewer-run-evidence.sh
bash test-framework/evals/tier-1/validate-learning-lifecycle.sh
bash test-framework/evals/tier-1/validate-authorization-envelope.sh
bash test-framework/evals/tier-1/validate-task-graph-concurrency.sh
bash test-framework/evals/tier-1/validate-stage-registry-single-source.sh
bash test-framework/evals/tier-1/validate-quick-fix-retirement.sh

node scripts/lint-skills-manifest.mjs
bash test-framework/scripts/validate-pipeline-integrity.sh .
bash scripts/verify-file-persistence.sh --from-git-status
bash test-framework/evals/run-all-evals.sh

./setup --all-hosts
bash scripts/check-install-drift.sh --all-hosts
bash test-framework/evals/tier-1/validate-codex-execution-integrity.sh

git diff --check
git status --short
git add --all
git diff --cached --check
git commit -m "Complete WI-541 framework transition" -m "Co-authored-by: OpenAI Codex <noreply@openai.com>"
final_sha="$(git rev-parse HEAD)"
node scripts/check-chain-receipts.mjs "$final_sha"
bash test-framework/evals/tier-1/validate-mandatory-delivery-chain.sh
bash test-framework/evals/tier-1/validate-promotion-authority.sh
bash test-framework/evals/tier-1/validate-plan-product-safety.sh
bash scripts/check-install-drift.sh --all-hosts
git status --short --branch
```

`RECOVERY_IF_FAIL`: stop at the first nonzero command; preserve all working-tree and `.svc` evidence; fix only the owning task; rerun that focused command and every downstream cumulative command. For an authority denial, use the exact printed sanctioned recovery and never alter claims/bindings manually. For setup failure, rely on its transactional restoration, inspect the per-host receipt, repair source, and rerun setup. For a post-commit failure, add a corrective local commit; do not rewrite receipt history. For independent-review unavailability, retain the failure receipt and resolve the existing owner policy/runtime condition; do not substitute self-review.

## Checkpoint Plan

| Checkpoint | Entry condition | Exit evidence | Rollback anchor |
|---|---|---|---|
| P0 plan reviewed | Simulation and mechanical checks pass | plan review log, exact candidate digest, no unresolved Critical | Manifest/spec only; no implementation exists. |
| P1 pure contracts | T01–T05 and T07 focused tests green | task receipts and focused logs; checkpoint remains pending until cumulative assembly | Revert only the failing task’s disjoint paths. |
| P2 dependent contracts | T06, T08, T09, T10 green after prerequisites | shared-owner handoff receipts and focused logs; checkpoint remains pending until cumulative assembly | Restore shared owner file and dependent task together. |
| P3 cumulative candidate | T11 audits and full Tier 1 green | exact diff digest, audit artifacts, zero unresolved Critical/High, and one cumulative implementation checkpoint SHA bound into every completed process-task receipt | Correct by file owner; rerun cumulative suite and add a corrective checkpoint. |
| P4 installed candidate | all-host setup/drift and installed Codex replay green | host receipts and drift output | Reinstall prior canonical source; preserve receipts. |
| P5 local land | exact candidate reviewed and staged diff clean | one local commit plus final-SHA chain audit | Add corrective local commit or local revert; no remote state exists. |

Because the task paths are intentionally interdependent, T01–T11 are assembled and tested cumulatively before committing. After the P3 corpus is green, one real implementation checkpoint commit captures that exact cumulative tree; every completed process-task receipt binds the same checkpoint SHA rather than inventing untested per-file commits. Review runs against that checkpoint, and any repair is a new corrective checkpoint—history is never rewritten.

## Risk and Rollback

| Risk | Severity | Prevention | Recovery |
|---|---|---|---|
| Chain compiles/validates a false green | High | same imported exact-chain module; exhaustive lane mutations | revert T02 as a unit; task graph remains untouched. |
| Bash parsing blocks reads or misses writes | High | decoded argv reuse, quoted/heredoc/redirection fixtures, explicit inventory | restore prior hook manifest/guards; no state migration. |
| Recovery widens authority | Critical | exact tuple, expiry, generation CAS, secure ancestors, foreign/dirty/replay negatives | deny and append evidence; revoke capability; restore old implementation without deleting residue. |
| Child starts before safe route selected | High | resolver and complete tuple execute before launch counter | controller fallback; no child exists to clean up. |
| Plan validator becomes inert machinery | High | wired into mechanical plan/review commands, caller audit, behavioral fixture | remove new module and consumer wiring together. |
| New receipt fields break history | High | schema-version conditional/grandfathering and historical corpus test | revert new producer/consumer schema together; retain old receipts. |
| Learning coerces malformed data | Medium | strict finite range parser and findings channel | ignore malformed entry; source history remains unchanged. |
| Envelope claim exceeds real boundary | High | only explicit wrapper claims enforcement; ordinary containment remains documented | disable wrapper consumer, preserve telemetry, retain existing host guard. |
| Bulk diff hides ownership conflict | High | one owner per file, dependency handoffs, actual diff reconciliation | repair by owner before cumulative review; no parallel merge. |
| Host install diverges | High | transactional setup and all-host drift | setup restores prior bytes; rerun prior canonical setup if needed. |

ORM schemas, product databases, migration paths, package dependencies, and secrets are outside the declared file set; the final actual-path/declaration reconciliation probes that boundary, so a migration task is inapplicable.

## Pre-Implementation Simulation

| Task | Disk/planned check | Result | Action |
|---|---|---|---|
| T01 | `proposals/triage.json` and SLA validator exist; both new ledger paths are absent | PASS | CREATE ledger/test, MODIFY current sources. |
| T02 | Compiler, validator, and lane model exist; shared module/test absent | PASS | Import shared pure contract from both scripts. |
| T03 | Three guards and hook manifest exist; shared classifier/inventory/test absent; decoded argv library exists | PASS | Reuse existing lexer/context, no second full shell parser. |
| T04 | Execute/dispatch consumers and Codex manifest exist; resolver/test absent | PASS | Create resolver before modifying consumers. |
| T05 | Recovery, isolation, ensure, and self-heal test exist; capability/test absent | PASS | Use existing lease/lock/atomic conventions. |
| T06 | Mechanical/review/launcher/receipt consumers exist; plan schema, validator, caller tool, focused tests absent | PASS | Create schema/tests first; preserve v1/v2 receipts. |
| T07 | Learning index/injector/promoter/skills exist; lifecycle CLI/test absent | PASS | Normalize on read; append events. |
| T08 | Session contract/dispatcher/Codex manifest exist; wrapper/reference/test absent | PASS | T08 waits for T04 owner handoff. |
| T09 | Task graph and three registry loaders exist; shared registry/concurrency tests absent; stale OPT-01 row confirmed active | PASS | T09 waits for T02/T06 handoffs where declared. |
| T10 | quick-fix is in first-party and core arrays plus curated guidance; detectors exist | PASS | Hash detectors, retire routing/guidance, lint mirrors. |
| T11 | Spec/design/research/state artifacts exist in disk or current planned layer; audit artifacts absent | PASS | Update only after cumulative truth exists. |
| T12 | All setup/drift/receipt commands exist and owner policy file is present, regular, and read-only to this change | PASS | Execute after exact-candidate review. |

No new package import is planned. Every new module uses Node built-ins or imports an existing repository module named in its task. Every new test runs in the current Bash/Node Tier-1 harness.

## Scenario Coverage

| Scenario | Given / When / Then mapping | Tasks | Coverage |
|---|---|---|---|
| Mutable lane compiles | Given any mutable lane; when compiled and validated; then exactly one full chain exists and mutations fail | T02 | 3/3 |
| Bash guard | Given read/write shell forms; when dispatched; then reads pass and guarded writes deny before mutation | T03 | 3/3 |
| HoursHub child topology | Given native agent availability without tuple; when mutating work is requested; then controller is selected before launch; complete delegation selects wrapper | T04 | 3/3 |
| Detached/legacy recovery | Given exact promotion or same-owner generation-zero residue; when recovered; then only the exact sanctioned transition succeeds; foreign/widened cases deny | T05 | 3/3 |
| Product-safe plan | Given money/absence/parallel/deletion claims; when plan/review run; then missing direct reversible/denominator/reviewer evidence blocks | T06 | 3/3 |
| Learning compounds | Given historical schema variants; when recalled/landed; then malformed rows report and used/outcome/evaluation precede credit | T07 | 3/3 |
| Authorization boundary | Given explicit outside/inside/no envelope; when outward wrapper/Stop run; then deny/record/current behavior respectively | T08 | 3/3 |
| Concurrent graph/residual cleanup | Given competing updates and red residual fixtures; when corrected; then no lost update and each residual is green without new dead machinery | T09, T10 | 3/3 |
| Local delivery | Given cumulative green candidate; when audited/installed/reviewed/committed; then all hosts converge and no remote operation occurs | T11, T12 | 3/3 |

There are no human UI journeys; these system scenarios are the journey contract named by the spec.

## Promotion Readiness Checklist

- [ ] Mechanical plan verification passes.
- [ ] Independent plan review is bound to the exact manifest digest; no unresolved Critical and all remaining findings dispositioned within three rounds.
- [ ] Every planned file is owned once; shared-owner requests have dependency evidence.
- [ ] Every AC maps to an implementation task and test type.
- [ ] Every new executable has a named consumer and behavioral test.
- [ ] Actual candidate paths equal the declared file set; no undeclared implementation file remains.
- [ ] Focused tests and full Tier 1 pass with no new failure.
- [ ] Security, execution, implementation, and session audits contain zero unresolved Critical/High.
- [ ] Proposal numerator equals denominator and no deferral is expired.
- [ ] Detector byte hashes prove quick-fix eligibility/risk behavior unchanged.
- [ ] All eight hosts converge and installed Codex authority/transport/envelope replays pass.
- [ ] Exact-candidate independent review receipt binds reviewer-run outputs.
- [ ] One local commit and final-SHA receipts exist; no push/PR/remote publication was attempted.
- [ ] Final report distinguishes implemented, locally verified, locally committed, installed-host verified, and not live-product-proven.
