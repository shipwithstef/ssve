# Whole-solution planning and bounded delivery overhead

**WI:** WI-FW-DELIVERY-TRADEOFFS-01
**Spec:** docs/specs/work-items/WI-FW-DELIVERY-TRADEOFFS-01.md
**Lane:** framework
**Mode:** inline
**Status:** IMPLEMENTED; execution review and release verification recorded in the per-SHA chain
**Branch:** framework-delivery-tradeoffs-01
**Base:** execution integrated on main at 22a78dd1a792f625ef3dc609e4b9932d19a2e46a; original reviewed planning base 93812914c33451cff84019176120e1cbe6bcaf3e
**Risk Flags:** config_schema_migration, cross_runtime_integration
**Scope boundary:** Owner authorized implementation and normal delivery after plan review. Open-source preparation is excluded.

## Implementation Summary

Close the whole product/UX/technical solution before coding; retain local engineering discretion within exact authorized write bounds. Replace redundant inline code/command dictation with the original constraints, real proof types and producer-bound runtime identities. Reuse the established release path and exact-input evidence. Measure the owner target 30/120/10 without disguising waiting, discovery, amendments or quality loss.

The three causal interventions are solution/context preservation, removal of representation-induced rework, and reuse of existing delivery/evidence machinery. Full paid-review interval attribution is unavailable; no 5x or universal 160-minute claim is made. Work needing a new platform, new release infrastructure or mandatory long observation declares the concrete larger envelope during planning. Time is a target, not a gate or timeout that drops authorized work.

Invariants: canonical spec authority; unchanged required delivery chain and owner reviewer selection; exact candidate/diff evidence; source/native/live distinctions; existing write/controller/delegation boundaries; valid legacy receipts; one authoritative mapping; no new runtime engine, service, storage ledger or paid benchmark program.

## Files Planned

| Task | Action | File | Purpose |
|---|---|---|---|
| T1 | MODIFY | skills/plan-changeset/SKILL.md | Replace inline planning contract and preserve original meaning in handoff |
| T1 | MODIFY | skills/plan-changeset/references/manifest-templates.md | Replace inline planning contract and preserve original meaning in handoff |
| T1 | MODIFY | skills/review-plan/SKILL.md | Replace inline planning contract and preserve original meaning in handoff |
| T1 | MODIFY | references/plan-review-protocol.md | Replace inline planning contract and preserve original meaning in handoff |
| T1 | MODIFY | scripts/review-plan-codex.sh | Replace inline planning contract and preserve original meaning in handoff |
| T1 | MODIFY | scripts/review-plan-kimi.sh | Replace inline planning contract and preserve original meaning in handoff |
| T1 | MODIFY | scripts/verify-plan-mechanical.sh | Replace inline planning contract and preserve original meaning in handoff |
| T1 | MODIFY | schemas/receipts/plan-manifest.schema.json | Replace inline planning contract and preserve original meaning in handoff |
| T1 | MODIFY | scripts/emit-receipt.mjs | Replace inline planning contract and preserve original meaning in handoff |
| T1 | MODIFY | scripts/check-chain-receipts.mjs | Replace inline planning contract and preserve original meaning in handoff |
| T1 | MODIFY | skills/execute-changeset/SKILL.md | Replace inline planning contract and preserve original meaning in handoff |
| T1 | MODIFY | skills/execute-changeset/references/subagent-dispatch.md | Replace inline planning contract and preserve original meaning in handoff |
| T1 | MODIFY | references/chain-receipt-contract.md | Replace inline planning contract and preserve original meaning in handoff |
| T1 | CREATE | scripts/lib/plan-manifest-contract.mjs | Replace inline planning contract and preserve original meaning in handoff |
| T1 | CREATE | scripts/prepare-plan-handoff.mjs | Replace inline planning contract and preserve original meaning in handoff |
| T1 | CREATE | test-framework/tests/delivery-plan-contract.test.mjs | Replace inline planning contract and preserve original meaning in handoff |
| T2 | MODIFY | skills/land-changeset/SKILL.md | Reuse exact-input validation evidence through the existing finalization path |
| T2 | MODIFY | skills/verify-promotion/SKILL.md | Reuse exact-input validation evidence through the existing finalization path |
| T3 | MODIFY | skills/route-workflow/SKILL.md | Account for the whole cycle and avoid unnecessary index writes |
| T3 | MODIFY | scripts/task-graph.mjs | Account for the whole cycle and avoid unnecessary index writes |
| T3 | MODIFY | scripts/mine-receipts.mjs | Account for the whole cycle and avoid unnecessary index writes |
| T3 | MODIFY | skills/write-spec/SKILL.md | Account for the whole cycle and avoid unnecessary index writes |
| T3 | CREATE | test-framework/tests/delivery-cycle-accounting.test.mjs | Account for the whole cycle and avoid unnecessary index writes |
| T4 | MODIFY | DOCTRINE.md | Prove the chain and package the compatible change |
| T4 | MODIFY | FRAMEWORK-STATE.md | Prove the chain and package the compatible change |
| T4 | CREATE | test-framework/evals/tier-1/validate-delivery-planning.sh | Prove the chain and package the compatible change |

| T1 | MODIFY | agents/plan-reviewer.md | Close the actual producer/consumer contract |
| T3 | MODIFY | skills/audit-feature/SKILL.md | Close the actual producer/consumer contract |
| T3 | MODIFY | skills/align-feature/SKILL.md | Close the actual producer/consumer contract |
| T4 | MODIFY | scripts/select-tier1-validators-v2.mjs | Close the actual producer/consumer contract |
| T4 | MODIFY | test-framework/evals/tier-1/validate-tier1-selector-v2.mjs | Update the existing exact selector closure expectation |

| T4 | CREATE | docs/plans/2026-09-07-delivery-planning/simulation.log | Preserve reviewed planning evidence |
| T4 | CREATE | docs/plans/2026-09-07-delivery-planning/plan-contract.json | Preserve reviewed planning evidence |
| T4 | CREATE | docs/plans/2026-09-07-delivery-planning/proposal-findings.json | Preserve reviewed planning evidence |
| T4 | CREATE | docs/plans/2026-09-07-delivery-planning/pilot.md | Preserve reviewed planning evidence |
| T4 | CREATE | docs/plans/2026-09-07-delivery-planning/planned-files.json | Preserve reviewed planning evidence |
| T4 | CREATE | docs/plans/2026-09-07-delivery-planning/manifest.md | Preserve reviewed planning evidence |
| T4 | CREATE | docs/specs/work-items/WI-FW-DELIVERY-TRADEOFFS-01.md | Preserve reviewed planning evidence |
| T4 | CREATE | docs/specs/reviews/delivery-planning-proposal-cross-model.md | Preserve reviewed planning evidence |
| T4 | CREATE | docs/specs/reviews/delivery-planning-plan-cross-model.md | Preserve reviewed planning evidence |
| T4 | CREATE | docs/analysis/2026-09-07-delivery-historical-evidence.json | Preserve reviewed planning evidence |
| T4 | CREATE | docs/analysis/2026-09-07-delivery-speed-tradeoffs.md | Preserve reviewed planning evidence |
| T4 | CREATE | docs/analysis/2026-09-07-planning-purpose-redesign.md | Preserve reviewed planning evidence |

| T4 | MODIFY | .claude/agents/plan-reviewer.md | Regenerate the existing consumer from changed canonical inputs |
| T4 | MODIFY | references/skill-routing-index.json | Regenerate the existing consumer from changed canonical inputs |
| T4 | MODIFY | docs/specs/relations/wi-541-full-transition.branches.md | Revalidate the one stale historical navigation index |

| T4 | MODIFY | scripts/run-external-review.mjs | Automatic bounded report recovery and compatibility |
| T4 | CREATE | scripts/lib/review-report-recovery.mjs | Automatic bounded report recovery and compatibility |
| T4 | MODIFY | scripts/lib/external-review-provenance.mjs | Automatic bounded report recovery and compatibility |
| T4 | MODIFY | scripts/lib/bounded-exit.mjs | Automatic bounded report recovery and compatibility |
| T4 | MODIFY | scripts/lib/reviewer-evidence.mjs | Automatic bounded report recovery and compatibility |
| T4 | MODIFY | test-framework/evals/tier-1/validate-external-review-launcher.sh | Automatic bounded report recovery and compatibility |
| T4 | MODIFY | test-framework/evals/tier-1/validate-retroactive-attestation.sh | Automatic bounded report recovery and compatibility |
| T4 | CREATE | test-framework/tests/review-report-recovery.test.mjs | Automatic bounded report recovery and compatibility |
| T4 | MODIFY | skills/review-exec/SKILL.md | Automatic bounded report recovery and compatibility |
| T4 | MODIFY | skills/review-cross-model/SKILL.md | Automatic bounded report recovery and compatibility |
| T4 | MODIFY | test-framework/evals/tier-1/validate-clean-main-followup.mjs | Verify cache replay preserves the concurrent paid slot |
| T4 | MODIFY | docs/specs/relations/wi-548-host-parity.branches.md | Refresh inspected launcher import metadata |
| T4 | MODIFY | docs/specs/relations/wi-548-host-parity.branches.md.imports.json | Refresh inspected launcher import metadata |

Planning provenance is explicitly owned by T4 in this same changeset: this plan directory, the WI, review reports and analysis files below are included in the implementation diff census. Use the single stated base_sha throughout. There is no pre-implementation documentation checkpoint or predicted future SHA; ordinary task checkpoints retain the same base. Runtime .svc state remains volatile under existing authority.

## Contract transition matrix

| Current requirement | New explicit inline behavior | Dispatch/legacy behavior | Producer and enforcing consumers |
|---|---|---|---|
| Blueprint payload | Already optional; do not reintroduce | Complete payload remains required | schema; shared validator; emit-receipt; check-chain-receipts |
| Whole branch-to-merge command dictation | Concrete commands for actions ready now; typed producer/verifier for future values and established release actions | Existing concrete command contract remains | prepare-plan-handoff; mechanical C7; reviewer prompts; execution/land pre-use check |
| Numeric determinism | Keep integer rubric_score, score full-solution readiness instead of code transcription; verdict/findings control the review | Existing numeric rubric retained for legacy/dispatch | Codex/Kimi prompts; in-session plan-reviewer; protocol; canonical launcher retains integer schema |
| Multiple AC/task/test tables | One authored JSON task/validation record in the manifest; other tables and receipt body are generated | Existing documents stay readable | prepare-plan-handoff; authoritative normalized AC hash; shared plan-body validator |
| Removed upstream context | Applicable original clauses, their source references and required local code context accompany the task | Dispatch gains clauses in addition to its payload | execute-changeset and subagent-dispatch prompt; context subcommand |
| Later local elaboration | Happens during execution inside predeclared exact write envelope; no automatic plan re-review | Complete task packet before child dispatch | execute-changeset; unchanged task authority and final review |
| Full review repeated after every fix | Existing one holistic review plus invalidated-lens rechecks is retained; no new review cycle policy | Owner policy and existing round cap unchanged | review-plan; review-exec; launcher cache/receipt identity; finalizer |
| Unconditional branch-index stamp | Call existing freshness check; if current, no write; if stale, re-inspect facts and then stamp | Historical index/review binding semantics unchanged | affected producer skills; existing freshness/audit/land checks |
| Reconstruct final proof | Capture from actual runs; reuse only matching verified evidence | Missing or incompatible evidence runs the required check | existing suite producer, finalizer and land/verify consumers |

## Whole-solution readiness and allowed local decisions

Before execution settle user-visible states (including error/empty/loading), state owner and lifetime, manual versus automatic intent, shared APIs/routes/HTTP methods, data and transaction semantics, concurrency, migrations, included/excluded file envelope, evidence kind per important promise, existing release path, external-effect authority/rollback and critical unknowns.

Also settle any choice whose reversal changes user behavior/data/authority, another complete behavior part, delivery strategy or the validity of a major test. Apply this propagation rule to retry/idempotency, cache invalidation, error semantics, accessibility, component state placement and query/render performance. A short probe is required only for an uncertainty capable of invalidating the approach. No mandatory probe or design rewrite for a known supported path.

Exact local helpers and commands may be refined within one behavior part during execution. A new file outside the declared envelope uses the current owner/delegation extension path before editing; no directory wildcard write grant is introduced. Required observation kinds cannot be lowered to fit time. A legitimate new discovery updates the affected decision and dependencies; it does not silently reopen every phase.

## Exact interfaces and compatibility

### Plan body and projection — T1

Use `plan-manifest` schema_version 4 only for new explicit inline plans after --capabilities verifies the helper, schema, emitter and checker in the same canonical source package. The same existing top-level fields remain; do not create a new receipt family or mapping ledger. Keep versions 1–3, their historical cutoff rules and dispatch semantics unchanged. New dispatch plans continue on the current complete-packet version 3 contract. Unknown future versions or version 4 without inline mode are rejected by the new validator. Compatibility is capability-gated issuance, not a security version cutoff: old complete v3 plans remain valid even if newly written. They retain their stricter complete-command contract and therefore do not evade a safety requirement. The new preparation command emits only v4. Existing old binaries cannot be retroactively made to reject v4; authorized v4 production requires matching source consumers. Reduced legacy fixtures without the new helper continue on v1–3; v4 fails explicitly if the helper is unavailable.

The canonical authored mapping is exactly one `<!-- SVC_PLAN_BODY -->` followed by a fenced json block and `<!-- /SVC_PLAN_BODY -->`. Duplicate, missing and unterminated markers fail. The block contains the COMPLETE receipt body, including receipt_type=plan-manifest, schema_version=4, mode=inline, wi and timestamp fixed at plan authoring, plus scope, dependencies, decision_trace, task_graph, validation_plan, risk_rollback, execution_command_sequence and ac_digests. AC hashes are computed from the authoritative spec before review. No projection-time timestamp is generated. parsePlanManifest returns this complete body; the same body is passed to emit-receipt. One optional generated section delimited SVC_PLAN_VIEWS is overwritten only by explicit --write; --check requires exact generated bytes. Human prose outside markers is preserved. The external review package includes that exact block and the resulting views.

For version 4, task_graph entries have id, files (exact repo-relative write paths), blocked_by, ac_ids, validation_ids and context_refs (repo-relative path plus start_line/end_line and excerpt_sha256). References represent ONLY immutable reviewed requirement/context slices. Future code is deliberately not represented in context_refs or emitted by taskContext: the executor reads it with its normal bounded read tools after its existing prerequisite task completes, and labels it runtime code context. No hash exemption or additional binding mode exists. validation_plan entries have id, ac_ids, observation_kind (source/unit/browser/device/hosted/performance), command, expected_outcome and sufficiency. Device/live/performance sufficiency remains a reviewer judgment supported by actual observations; structural validation never claims semantic correctness.

execution_command_sequence accepts either the existing {step, command, expected_outcome}, or an established-release entry {step, producer, verifier, consumer_skill, expected_outcome}. A producer is {artifact, field, command}; field is a literal top-level JSON key, not executable text or query language. verifier is {command, expected_outcome}. consumer_skill is exactly land-changeset or verify-promotion. All step IDs are unique increasing integers. Reject mixed command/producer entries, missing fields and unsupported consumers. A producer/verifier entry describes an existing release action, never an implementation-task dependency. There are NO producer_task, verifier_task, blocked_actions or process-graph mappings in v4. Implementation task_graph remains its own string-ID DAG with ordinary blocked_by, interpreted by the existing inline orchestrator.

Before a release entry runs, its named skill executes the existing producer command, reads the declared JSON field as data, verifies it using the existing release adapter's pre-use check, and only then performs the authorized action. The existing land/verify phase receipt records the actual result. On failure that phase remains incomplete under its current guard. Never interpolate artifact fields into a shell string or infer successful verification from file presence. This is a description for the established adapter path, not a new execution engine or machine-enforced intra-task result store. Other unknown implementation values use ordinary planned tasks and executable commands; adding generalized producer scheduling is outside this change.


`scripts/lib/plan-manifest-contract.mjs` exports parsePlanManifest(text), validatePlanBody(body, {readSpec}), projectPlanViews(body, {readSpec}), and taskContext(body, taskId, {readFile}). Validation returns {ok, errors}; it preserves old-version rules and checks version-4 structure, AC references/hash and dependency integrity. Callers supply source readers for the correct worktree or Git candidate tree: check-chain must read the target commit, never current working bytes. Shared schema/emitter/checker conformance fixtures prove parity.

`scripts/prepare-plan-handoff.mjs --manifest PATH --check` verifies the block, generated view and original AC binding without writes. `--write` updates only bounded generated sections in that manifest and emits the derived receipt body to a specified ignored `--out PATH`; it preserves all human prose. `--task ID` prints the applicable original clauses and referenced local context to stdout. It uses the canonical worktree and source references; no blanket repository scan or enlarged write authority. Unreadable/stale/out-of-root references fail before handoff. Exact-byte source excerpts avoid semantic paraphrase losses. The existing emitter remains the only writer of canonical plan receipts.

The same T1 change updates schema, emitter, checker, C7 mechanical validation, both review prompts, in-session agent and execute consumers. Keep integer rubric_score in all transports; inline scores readiness and original requirement preservation, dispatch scores packet completeness. C7 keeps its existing bash fence requirement for v1–3/dispatch/absent mode; explicit v4 inline validates the typed sequence through prepare-plan-handoff, without a shell fence. C9 remains. Schema uses conditional v4 sequence alternatives; legacy command shape stays unchanged. v4 preparation requires the new helper to answer its supported version; do not produce v4 for old installed consumers. During execution on this old baseline, this manifest follows the existing v3 inline contract; it does not depend on its proposed replacement to pass its own gates.

### Existing release evidence — T2

Do not build the proposed new tier-1 cache. Sol F-005/F-006 and Grok F6 expose no established same-identity first-delivery reuse edge: commit/merge changes the identity, and the existing snapshot excludes relevant external Git state. New cache code would add maintenance without a demonstrated benefit. Keep run-all-evals, selection, pre-push and full release gate unchanged. Update land/verify instructions to consume actual existing producer outputs, avoid reconstructing successful receipts by hand, and use existing finalizer/recovery commands. Existing input-bound reuse rules remain; absent matching proof means run the required check. No cross-commit reuse or claimed suite-speed improvement.

### Timing and index behavior — T3

Add optional delivery-cycle metadata to the existing lane graph and mechanical pipeline-decision payload (no new kind): root_wi, cycle_started_at, planning_minutes=30, implementation_minutes=120, finalization_minutes=10. The first feature-specific route/discovery event starts it; accepted amendments and resumes reference root_wi rather than resetting time. Missing prior start is unknown, never fabricated from the current time. Existing logs remain readable.

At actual task transitions, append mechanical events with payload.delivery_phase={schema_version:1,event_id,root_wi,task_id,phase,transition,at}. event_id is root-WI/task/transition/attempt; attempt increments only on a real new in_progress transition. Repeated activate-skill or set-status with unchanged status emits nothing. at is UTC ISO from the real transition, never reconstructed. Use existing state-io locking for graph and append, and report a lost event as unknown; duplicate IDs are deduplicated. Keep schema_version/kind/ts and legacy type/run_id/skill/phase/decision/reasoning/decided_by fields so existing readers accept the mechanical envelope. External wait records use the same payload with explicit interval, reason and unique ID; absent events are unknown. Session freshness logic is unchanged. Planning includes discovery/design/plan review; implementation includes coding/tests/review-exec/audit and repairs; finalization includes land/verify. A returned implementation repair remains in the original cycle. No per-tool hooks or scheduler are added. Record external wait only with an explicit start/end and provider/observation reason; quota-to-resume gaps without such evidence remain unclassified.

Extend `scripts/mine-receipts.mjs --delivery-cycle WI --json` as a read-only report over those existing events. Report total elapsed, union of observed phase intervals, observed external wait, unknown intervals, retry/reopened-decision counts and target_missed flags. Parallel reviewer intervals are unioned, not summed into critical-path elapsed. Keep --tier/--stats behavior and reviewer policy unchanged. Missing/overlapping/malformed evidence is identified rather than silently treated as zero. The target never authorizes a gate bypass or automatic task abandonment.

Update index-producing skills to use the existing freshness result before restamp. A valid index may remain at its earlier Derived-at; do not manufacture a new semantic review or change hashes only to point at the latest HEAD. A stale cited file/import requires actual reinspection and the normal reviewed stamp; this change does not automatically bless modified facts.

## Task Graph

All source tasks execute serially in the parent worktree. No mutating child dispatch or parallel ownership is proposed. Each task owns its tests. T1 owns a bounded deterministic paired replay: node --test test-framework/tests/delivery-plan-contract.test.mjs runs two fixture arms from the same original iOS/manual-choice and transaction AC bytes, comparing full-packet v3 and inline v4 handoffs for requirement retention and proof classification. No paid LLM run or model superiority claim; identical source and assertions are frozen in the test. Record actual results in pilot.md. This tests contract preservation, not delivery speed. T4 is source integration and packaging, not deployment; promotion remains downstream of review/audit in the existing chain.

### task-1 / T1: Replace inline planning contract and preserve original meaning in handoff

Dependencies: none. Covers: AC-DP-01, AC-DP-02, AC-DP-03, AC-DP-04, AC-DP-08, AC-DP-09. Validation: `node --test test-framework/tests/delivery-plan-contract.test.mjs`. Checkpoint: t1-validated (working-tree evidence; reversible diff checkpoint; final commit after full validation).

### task-2 / T2: Reuse exact-input validation evidence through the existing finalization path

Dependencies: T1. Covers: AC-DP-05, AC-DP-08. Validation: inspect exact existing finalizer references and run applicable land/verify contract checks; no new cache tests. Checkpoint: t2-validated (working-tree evidence; reversible diff checkpoint; final commit after full validation).

### task-3 / T3: Account for the whole cycle and avoid unnecessary index writes

Dependencies: T2. Covers: AC-DP-07. T1 owns plan/execute index changes; T3 owns the actual audit/align writers and write-spec subsequent-stage guidance for AC-DP-06. Validation: `node --test test-framework/tests/delivery-cycle-accounting.test.mjs`. Checkpoint: t3-validated (working-tree evidence; reversible diff checkpoint; final commit after full validation).

### task-4 / T4: Prove the chain and package the compatible change

Dependencies: T3. Covers: AC-DP-01, AC-DP-02, AC-DP-03, AC-DP-04, AC-DP-05, AC-DP-06, AC-DP-07, AC-DP-08, AC-DP-09. Packaging supports AC-DP-10; actual completion belongs to downstream lane tasks 9/10. Validation: `bash test-framework/evals/tier-1/validate-delivery-planning.sh`. Checkpoint: t4-validated (working-tree evidence; reversible diff checkpoint; final commit after full validation).

## AC-to-Task Mapping

| AC | Tasks |
|---|---|
| AC-DP-01 | T1, T4 |
| AC-DP-02 | T1, T4 |
| AC-DP-03 | T1, T4 |
| AC-DP-04 | T1, T4 |
| AC-DP-05 | T2, T4 |
| AC-DP-06 | T1, T3, T4 |
| AC-DP-07 | T3, T4 |
| AC-DP-08 | T1, T2, T4 |
| AC-DP-09 | T1, T4 |
| AC-DP-10 | lane task 9 land-changeset; lane task 10 verify-promotion (canonical setup/drift required before completion) |

## AC-to-Test Mapping

| AC | Type | Required observation |
|---|---|---|
| AC-DP-01 | Unit + Manual | Known owner/HTTP/race/default-choice omissions remain detectable; whole-solution readiness review |
| AC-DP-02 | Unit + integration | inline v4 deferred identity passes; absent/dispatch/legacy requirements intact; unresolved external action denied |
| AC-DP-03 | Unit | Original AC revision invalidates handoff; generated mapping mutation/cycle/missing proof fails |
| AC-DP-04 | Unit + Manual | Original temporal/manual-choice clauses reach child prompt; exact write scope unchanged |
| AC-DP-05 | Unit + integration | Existing exact-input evidence policy retained; actual finalizer producer references; no new cache claim |
| AC-DP-06 | Unit + existing regressions | Fresh index produces zero file writes; stale facts still fail; review cap and exact candidate binding unchanged |
| AC-DP-07 | Unit | Resume/amendment same root; parallel intervals union; discovery counts; unknown gap remains unknown; late repair counts |
| AC-DP-08 | integration | Real emitter→note/checker→push/finalizer/reconcile consumers in isolated repo; legacy positive and malformed negative cases |
| AC-DP-09 | Manual + fixture replay | Same original requirements, evidence bar and source; retrospective label; no speed claim without timed paired delivery |
| AC-DP-10 | integration + live install | All-host install from canonical source, drift verification and rollback/recovery under established setup contract |

## Prerequisite Alignment Matrix

| Tasks | Product/UX/technical source | Applicable contract |
|---|---|---|
| T1 | WI AC-DP-01–04; owner 30/120/10 clarification; Grok P-002–007 and Sol F-002–006 | Developer/operator is the direct user; no new application UI, design tokens or visual mock is needed. Original product UX clauses survive handoff. |
| T2 | WI AC-DP-05/08; historical receipt identity and stage-evidence cases | Existing Bash/Node/state-io style; exact observed inputs, no surrogate native proof |
| T3 | WI AC-DP-06/07; historical stamp-only changes and quota/resume gaps | Existing session/task records, actual timestamps, no competing graph or false time attribution |
| T4 | WI AC-DP-09/10; existing AGENTS installation/release rules | Source-backed installer and existing receipt/review consumer authority |

## Validation Plan

T1/T3 run their focused tests while iterating. T2 validates the existing release command references. T4's new focused tier-1 wrapper invokes the two new tests (not a second implementation of them), checks schema/producer/consumer parity and runs isolated hook-chain fixtures. Existing baton, chain receipt, inline mode, plan mechanical, review round cap, authority and installation regressions remain required when their inputs change. Full corpus evidence is required once at the release boundary, reused only under the established matching-input rule. Do not add paid tiers or a broad recurring benchmark.

Counterexample fixtures include: fee check separated from mutation versus one-transaction contract; Scouted auto overriding manual off versus separate disposition; source walk claiming native proof; circular T2/T5 test ownership; future provider ID represented as fabricated literal versus a validated producer; old receipts after new consumer install; new receipt presented to old consumer; failed suite followed by attempted old-pass reuse; modified cited index versus unchanged relevant inputs.

## Hook and receipt consumer census

| Surface | Required treatment | Proof / blocker |
|---|---|---|
| PreTool authority / controller / delegation | Unchanged; targeted reads do not grant writes | Existing read-only and foreign/escaping mutation denial fixtures |
| task-graph load/phase/completion; non-skippable chain | Timing is additive only; no completed task fabricated from time or presence | Existing mandatory-chain tests plus timing transitions |
| mechanical C1/C5/C7/C9/C10/C11 | T1 adds version-aware semantic contract check; old inline manifest still has executable C7 and prerequisite matrix | Existing mechanical parser plus new old/new fixtures |
| plan schema, emit-receipt, check-chain-receipts | T1 uses shared validator with correct candidate source reader | Identical valid/invalid matrix through all three |
| review prompts, Codex integer parser, Kimi rubric | T1 changes inline readiness interpretation together; no change to actual owner-selected topology | inline-readiness versus dispatch-completeness tests; real plan review |
| git pre-commit isolation/lane/eligibility/manifest slots | Unchanged authority and structural checks | Isolated candidate passes actual slots; malformed graph still rejects |
| post-commit receipt promotion | Unchanged staging→SHA note and mirror behavior | Existing promotion fixture with new plan body |
| pre-push receipt slot; finalizer; reconcile | Shared checker accepts new body and legacy note only when evidence is valid | Isolated actual consumer runs, no blanket bypass |
| pre-push tier1 slot | Existing focused run-all-evals gate, unchanged argv/env and no new verifier input | Existing full release requirement and focused selection regressions |
| story receipts; index freshness; stop-quality/completion | Existing applicability and evidence semantics stay; T3 removes gratuitous producer restamp | No false done, no stale-index auto-certification, plan-only user boundary remains respected |
| runtime v2 artifact and evidence consumption | Existing producer/consumer edges remain; generated views do not add a second authority | Existing runtime continuation/receipt compatibility fixtures |
| installer and installed consumers | Existing scripts directory installation includes new helpers; canonical main setup across all provisioned hosts after merge | Source/installed hash and drift checks; running sessions retain pin |

The census covers the named plan/execute/review/finalization paths at the base SHA. It is not an assertion that unrelated hooks were audited exhaustively. A direct reference found outside this census during implementation must be traced and added before changing its contract.

## External State

| # | Environment | What state | Coupling | Lifecycle wiring |
|---|---|---|---|---|
| 1,2,6 | Installed host files/configs and active sessions | Updated skills/helpers; existing host processes | coupled for installation; running session pins intentionally decoupled | setup, check-install-drift and durable install source; no live process is switched by this changeset |
| 3 | Canonical main and feature worktree | Reviewed source and retained planning provenance | coupled | worktree.sh and existing land/review wrapper; canonical main is installer source |
| 7,13 | GitHub PR/merge state | Future publication only | coupled | existing merge-pr-with-review-receipt and verify-promotion; no new CI or provider adapter |
| 9,15 | Local results/cache and git-note receipt mirrors | Input-bound evidence and staging/projection files | coupled | run-all-evals, state-io, emit-receipt, post-commit promotion and existing note/evidence store |
| 12 | Schemas, skills, consumers and registry | Versioned inline contract | coupled | T1 compatibility slice plus T4 installer and chain fixtures |

Untouched environments (walked the taxonomy, found nothing): 4,5,8,10,11,14. No credential change, product database action or provider release is part of framework implementation. Existing provider auth is used only for owner-requested reviews. Running sessions remain on their pinned source intentionally: changing their contract mid-flight would invalidate current plans. Recovery is to finish on that pin or perform an explicitly authorized new-plan migration, verified by the new consumer capability and current source/AC bindings. The real lane graph includes non-skipped design-tech (task 2) and all mandatory downstream tasks; include it in the review package. write-spec task 11 precedes design-tech and has actual phase evidence for the existing contract-change WI; no predecessor completion is inferred from a loaded_at record.

## Execution Command Sequence

These commands use the current contract to implement this future changeset. Code edits are performed by the inline orchestrator following the exact task ownership above, between the relevant checks. No full code blueprint is required for this inline plan. The normal land skill resolves future PR/SHA values and executes its reviewed noninteractive commands; no invented future identifier is supplied here.

```bash
set -euo pipefail
node scripts/svc-ensure-worktree.mjs --wi WI-FW-DELIVERY-TRADEOFFS-01 --branch framework-delivery-tradeoffs-01 --from origin/main --json --print-cd
cd /home/user/app-workspaces/seriousvibecoding/.worktrees/framework-delivery-tradeoffs-01
bash scripts/verify-plan-mechanical.sh docs/plans/2026-09-07-delivery-planning/manifest.md . --phase plan
node scripts/validate-task-graph-lane.mjs .svc/lane-tasks-WI-FW-DELIVERY-TRADEOFFS-01.json
```

After T1 edits, run its node test command; after T2 and T3, run their task commands. After T4 edits:

```bash
set -euo pipefail
bash test-framework/evals/tier-1/validate-delivery-planning.sh
node scripts/lint-skills-manifest.mjs
bash test-framework/scripts/validate-pipeline-integrity.sh .
EVALS=0 bash test-framework/evals/run-all-evals.sh
```

RECOVERY_IF_FAIL: retain the candidate, actual failing output and valid earlier evidence; fix the named task and rerun invalidated checks. Do not switch schemas, fabricate review results or loosen authority to get a pass. A consequential design change updates the affected contract and invalidated review lens before dependent edits. Infrastructure/schema/transport failures are recorded under their real classification, not findings authored by a reviewer.

Then run execute-changeset closeout, review-gate, review-exec, audit-implementation and land-changeset through the existing lane task loader and skills, with actual phase receipts. Activate verify-promotion, keep it in_progress, perform canonical-main setup and all-host drift checks below, then record their actual outcomes and complete verification only after they pass. The final source checkpoint uses the active Astra/Codex identity and the existing commit trailer contract. Use this WI's explicit reversible-diff checkpoint adaptation below; global checkpoint policy is unchanged. land-changeset validates the real branch/repository/head and uses merge-pr-with-review-receipt; verify-promotion observes the resulting main candidate. Inside verify-promotion task 10, from canonical main after merge and BEFORE task completion, run:

```bash
set -euo pipefail
./setup --all-hosts
bash scripts/check-install-drift.sh --all-hosts
```

Post-commit relevant tier-1 validators still run. Install is performed by the established canonical-main release procedure, not from this worktree. On setup failure use its transactional restoration and report the failed host; do not overwrite other host state or claim installation from local tests. Receipt recovery follows the existing finalizer, preserving immutable old evidence.

## Checkpoint Plan and rollback

Planning provenance is included in the single-base ownership census; no special documentation checkpoint is required. T1–T4 produce local passing checkpoints; the final implementation is reviewed and promoted through the existing chain. Revert the implementation commit from canonical main using the normal reviewed revert path and rerun canonical setup to restore installed bytes. Old notes and completed summaries remain immutable; a new consumer reading unsupported v4 evidence fails clearly rather than reinterpreting it as v3. New-plan emission is disabled on the reverted package. No database rollback is needed.

## Promotion Readiness Checklist

- Every AC has an implementing task and an appropriate observation.
- Current-contract mechanical/plan review passes before implementation.
- The existing owner review topology, authority and all required receipt slots remain intact.
- New and old bodies are exercised through actual producers and downstream consumer entry points.
- Required full-corpus and post-commit evidence is real and input-bound; local evidence is not a claim about installed hosts or product devices.
- Exact source, final candidate, canonical install source and rollback target are known at their action boundaries.
- Timing results name target misses and unknown time; no 5x claim is made from a paper replay.

## Simulation Report

Scope: this frozen SSVE worktree at the stated base. All MODIFY targets were checked for existence; CREATE targets are absent and declared. T1–T4 are serial, each owns its tests, and no source task depends on deployment. References to new helpers/tests resolve against the planned layer. Existing source paths, wrapper arguments and schema consumers were inspected; mechanical checker output is recorded in simulation.log. No production/store/native/install success is claimed by this simulation. Actual environment prerequisites and installation are checked at the action boundary.

## Review resolution and validator budget

Formal round 1 was fail from both requested reviewers; all raw findings are retained. Decisions here address the actual contract gaps; no external pass is fabricated. Sol F-001's compulsory historical cutoff is declined because v3 remains a valid stricter contract, not a security bypass. T2's speculative cache is removed following F-006. Nullable scores are removed, preserving the canonical integer transport and replacing the inline scoring meaning across all prompts. No unrelated design skills or manifest registry edits remain.

Tier-1 promotion note: validator_path=test-framework/evals/tier-1/validate-delivery-planning.sh; failure_class=legacy deterministic grader and requirement handoff drift; promotion_signal=real iOS review rework plus formal F1/F3/F5; expected_runtime_budget=<5s for two local node test files, no network/LLM; tier-2 is insufficient because these are deterministic producer/consumer regressions. Register exact inputs in select-tier1-validators-v2.mjs. Existing large hook/receipt regressions run when affected, rather than nesting them in every new wrapper execution.

## Final interface clarifications after round 2

`node scripts/prepare-plan-handoff.mjs --capabilities` is read-only, exit 0 when the package supports v4 and 1 on incomplete/mixed support (2 only for invalid CLI arguments). JSON is {schema_version:1, source_root, supported_versions:[1,2,3,4], issuance_versions:[4], modes:["inline"], files:[{path,sha256}], package_sha256}. source_root is the real path containing this helper, its library, schema, emitter and checker. All must resolve beneath that source root; schema declares maximum 4; emitter and checker explicitly declare PLAN_MANIFEST_MAX_VERSION=4 and invoke the shared validator. Files are the five exact canonical source paths, sorted; package_sha256 hashes their serialized path/digest array. The helper and v4 emitter call the shared package-support check, not a cached external marker. Missing/mixed old consumers fail before v4 output. This detects partial adoption under the existing trusted installer; it is not a new code-signing/security authority. Legacy v3 remains supported.

The original AC section is emitted verbatim alongside per-task ac_ids; it is small and avoids lossy clause extraction for multiline/checklist AC formats. taskContext adds only hash-bound immutable slices. Current code discovered during execution uses normal repo-contained reads after static prerequisites; it never changes context_refs or pretends to be reviewed.

## Mechanical execution amendment

The first full corpus identified two existing generated consumers omitted from the file census: .claude/agents/plan-reviewer.md (sync-native-agents) and references/skill-routing-index.json (compile-skill-router-index). T4 owns their deterministic regeneration; no new product or runtime semantics are added. Independent plan review remains attached to its frozen 412b8f90 candidate; final execution review includes these derived outputs and this explicit scope amendment. This does not launch another full plan review for generated hashes.

This WI retains reversible diff checkpoints and makes one compatible final implementation commit after the complete required validation and review chain. The execution report records the owner's no-valueless-duplication rationale; git protections and final full-corpus requirements are unchanged.

### Land-preflight navigation amendment
The existing WI-541 index was stale before this branch against three cited skills. Reinspect their actual current behavior and refresh only that index, anchored to the materialized candidate source tree recorded in that index. This T4 documentation amendment adds no runtime behavior; the two other fresh indexes stay byte-identical. Final candidate review includes this delta.

### Owner-authorized report recovery amendment (2026-09-08)
Resume the same delivery WI; do not restart the product plan. The owner explicitly requested that a transport/report blocker recover automatically. T4 adds AC-DP-11: one repair inside the original timeout and transport-supported budget (unknown Claude spend or an explicit unsupported dollar ceiling prevents retry; no dollar guarantee is claimed for uncapped CLI transports), exact judgment preservation for scope-only edits, ordinary validation for incomplete output, and no new substantive round for a zero-call cache replay. Preserve signed raw history, three real review rounds, auth/model/safety refusals and actual source failures. No global approval bypass or new service/receipt family is introduced. The final execution review covers this localized amendment; earlier immutable reviews remain historical evidence. Tests: the existing launcher fixture exercises actual correction calls and rejected judgment drift; the focused delivery wrapper includes signed cache-history/capacity and semantic-negative tests.

| AC-DP-11 | T4 | validate-delivery-planning.sh; validate-external-review-launcher.sh |

### Post-commit import-index closeout
The recovery helper also changes the import shape recorded by the historical WI-548 index. Reinspect its generic launcher/receipt/authority claims against committed implementation edc2819f0bb9ccfdb5246478917ba01cdc0f0584, retain those claims, and regenerate only its Derived-at/import metadata. This T4 closeout adds no executable change; original full368-validator evidence remains scoped to the implementation commit. Run mechanical plan, index and manifest checks for this documentation-only follow-up.
