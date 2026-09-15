# Technical Design: WI-FW-TWO-BOX-01 Two-Box Planning and Deterministic Transmutation

**Status:** Cursor conversion with root corrections RC01–RC06 and formal findings F-001–F-005 addressed; awaiting targeted recheck. No implementation claimed.
**Date:** 2026-09-15
**Spec:** docs/specs/features/two-box-transmutation.md
**Base / public root:** 0dcd69d255642dcc78db521e95afa2b18ea1276f
**This WI issuance:** one explicit inline plan-manifest schema_version 4 body, frozen as the bootstrap snapshot after formal review and before source changes. Implementation then issues plan-manifest v5 (inline and dispatch) and control-plan v2 for all other new work. Do not emit v5/v2 for this WI's own receipts.

## 1. Invariants

1. Package identity is packageCapabilities().source_root. Consumer identity is repositoryIdentity(start).checkout. Durable evidence is gitCommonDir/svc-review-evidence. Never treat SCRIPT_DIR parent as consumer cache.
2. emit-receipt is always current issuance. check-chain current execution uses the same provenance gate. Historical inspection is a non-execution API; only the exact trusted bootstrap snapshot can exempt active v4 execution. No caller boolean, WI-label switch, null cutover SHA, or editable local flag.
3. After the package lands, new plan-manifest issuance is schema_version 5 for both inline and dispatch (mode-appropriate completeness). v3/v4 remain readers except the single bootstrap v4 body. New dispatch work cannot issue v3.
4. Open Box isolation is isolated_plan_analysis: frozen facts directory plus invocation-scoped Codex controls. It is not continuation.fresh_session_launch, not --read-only, not --ignore-rules-as-AGENTS, and not Landlock write confinement.
5. Roles extend resolve-dispatch.mjs. Recipes never write ~/.svc/dispatch-policy.json. Never change HOME, CODEX_HOME, or global Codex config.
6. researchDecision: sufficient current evidence resolves; missing ordinary confidence is analysis; explicit external research and necessary freshness still research; research completion resumes the requesting decision.
7. Selection winner is only open_win, contract_win, or combination. reject_innovation is a disposition. Unresolved conflict blocks. Initial Contract original and scout-revised Contract are distinct objects.
8. Object refs (getObject) are typed separately from raw digests. Seal verifies the actual review-plan receipt and candidate/context binding.

## 2. Architecture

```text
owner intent + original requirements
        |
        v
recompute quick-fix-eligibility on REAL consumer diff vs base (never caller eligible:true)
        | eligible true + bound tree hash --> v5 lightweight alternative
        | else
        v
ROLE_RESOLVE via dispatch-policy (open_box, contract_box, scout_forward, scout_reverse, assessor)
        |
        v
assertOpenBoxLaunch (help/features/canary) -- fail before spend if unavailable
        |
        +-- Open Box: fresh process, FACTS_DIR only, Codex exec argv below, tool-free or fail-closed
        +-- Contract Box: fresh process, real worktree, PLAN inherit, SSVE context allowed
        |
        v
putObject originals (open original; contract original)
        |
        v
two separately assigned scout processes on Contract original only
        |
        v
putObject contract.revised (distinct object; same digest allowed only if bytes unchanged)
        |
        v
assessor process: originals + revised + scout reports -> winner {open_win,contract_win,combination}
        | conflict true -> BLOCK
        v
reconcile specs/designs -> prepare complete v5 contract BEFORE review-plan
        |
        v
existing holistic review-plan once
        |
        v
sealAfterReview(actual review-plan receipt) -> execute-changeset
```

## 3. State machine

IDLE -> EXEMPTION_RECOMPUTE -> (LIGHTWEIGHT | ROLE_RESOLVE).
ROLE_RESOLVE -> OPENBOX_PREFLIGHT (fail-closed) -> BOX_RUN -> SCOUT_FORWARD and SCOUT_REVERSE (separate processes) -> CONTRACT_REVISE -> ASSESS.
ASSESS conflict -> BLOCK_CONVERSION.
Else RECONCILE -> PREPARE_CONTRACT -> REVIEW_PLAN -> SEAL -> EXECUTABLE.
Resume only if WI, object refs, digest refs, role tuples, dispatch-policy digest, and source tree digest match.

## 4. Issuance, execution, historical read

### T0: parent-only preparation and carry-forward

T0 is a preparation/carry-forward owner stream in this v4 manifest, not a delegated implementation task. Its already-authored planning/spec files must retain their reviewed bytes. CREATE in the Files Planned table describes the Git delta relative to the public base; it does not authorize regeneration. The only remaining T0 write after formal review is the parent-exclusive bootstrap snapshot, through the preserved one-shot freezer. T3 reads that snapshot and pins its digest; T3 and T7 cannot write it or rewrite any T0 artifact. All T1–T7 execution waits for T0 freeze verification. The parent's batch allowlist excludes every T0 path. Record T0 completed only after signed review and actual freeze/check; file presence alone is insufficient.

The root freezer is .svc/external-review-artifacts/two-box/freeze-bootstrap.mjs, retained with its hash in durable evidence. It validates the actual review-plan receipt, current v4 body/AC/context and companion contract under the pre-change package, checks that no source implementation occurred, and creates the snapshot exclusively. A --check run verifies existing bytes without rewriting. This one-shot planning producer is not a generic runtime exemption creator.

### Runtime entry points

Use separate APIs in receipt-issuance-epoch.mjs: assertCurrentIssuance, assertCurrentExecution, and readHistoricalReceipt. Issuer always uses the first; direct preparation, stage-segment and execute-changeset always use the second. Historical reading verifies immutable commit-tree/notes content under its original schema and returns executable:false. It never grants active execution authority. Keep genuine v1 control-plan and v3/v4 plan readers without rewriting notes. Current issuance/execution require v5 in both modes and v2 control evidence, or the mechanically recomputed lightweight alternative. Never derive authority from a submitted version, status, timestamp, WI label, or historical:true flag.

This WI bootstraps the implementation of those validators. After formal review and BEFORE source implementation, the parent freezes the exact reviewed v4 body using the existing package and verifyReviewerEvidence. The one-shot parent script is a planning operation, since the future receipt-issuance-epoch.mjs does not yet exist. Preserve the script/output as evidence. It creates docs/specs/privacy/v4-bootstrap-snapshot.json exclusively; its exact SHA256 is subsequently embedded as a literal BOOTSTRAP_SNAPSHOT_SHA256 in the new trusted package module. Runtime reads that fixed path from its own source-package root, never from the consumer checkout or a caller path. A consumer-edited history-epoch field is not authority. Do not add a consumer-controlled history-epoch pointer; existing historical inspection helpers retain their original role.

The snapshot binds schema_version, actual consumer repository identity and public root/base 0dcd69d255642dcc78db521e95afa2b18ea1276f, WI, canonical reviewed plan-body SHA256, full manifest SHA256, companion contract SHA256, actual review-plan receipt ObjectRef and verified launcher evidence refs, original AC table SHA256, immutable context hashes, and pre-change packageCapabilities digest. No future commit SHA or self-hash occurs in the snapshot. The embedding occurs after the freeze and is not part of the reviewed v4 plan bytes, so there is no digest cycle. Runtime verifies the snapshot digest against its package literal, its review evidence, exact body/manifest/spec/scope/context and consumer identity. Only that body can continue as bootstrap_v4. Missing or modified snapshot, different consumer/WI/body, missing signed review evidence, or altered requirements fails. Freeze refuses overwrite and never automatically regenerates an exemption during execution. Ordinary consumers get no bootstrap exemption.

packageCapabilities changes atomically with all readers: schema max5, issuance_versions [5], supported_versions [1,2,3,4,5], modes inline+dispatch; include review-inputs.mjs. Retain v4 validation as a historical/explicit bootstrap function; current preparation emits v5 only. v5 inline retains original-context/generated-view discipline; v5 dispatch retains complete changeset_blueprints. All active paths call the same current-execution evidence checker, including a submitted legacy manifest. Historical checker reports cannot replace this gate. During implementation this WI uses its frozen bootstrap snapshot; the parent uses the pre-change validator copy for checking its immutable v4 handoff if the package is temporarily between versions. No mixed package may issue a receipt.

Tests exercise real emitter, preparation, review-inputs and stage execution entry points for new v3/v4 attempts; an isolated consumer cannot edit a local snapshot to bypass. Authentic historical fixture inspection remains readable and non-executable. Bootstrap tests validate the pre-implementation freeze, signed review provenance, exact input bindings, and tamper failures.

## 5. Open Box isolation (RD01)

Installed truth: `codex exec --help` supports --ephemeral, --sandbox read-only, --ignore-user-config, --ignore-rules, --json, --output-schema, stdin. --read-only is not a supported exec flag. --ignore-rules suppresses execpolicy, not AGENTS. Landlock/svc-contained-exec is write confinement, not read isolation. skip_host_skill_discovery is under development.

### 5.1 Preflight before spend

Use one invocation builder for both prompt inspection and live launch. Codex is the first enabled planning transport; unsupported hosts fail before provider spend, without silently changing the configured tuple. Preserve native safety instructions. "Open" means no supplied SSVE methodology or competing plan, not absence of model training or native host instructions.

The parent tested `codex debug prompt-input` locally on 2026-09-15. A neutral directory plus project_doc_max_bytes=0 and skip_host_skill_discovery=true STILL exposed all installed SSVE skill descriptions. Adding invocation-scoped skills.config entries with enabled=false for each discovered SKILL.md removed the entire catalog and SSVE guidance from the rendered prompt. Evidence is the protected codex-prompt-probe/r2 output and invocation files in this WI's external-review artifacts. This is local prompt inspection, not a live model success claim.

Create a neutral temporary directory outside the consumer's ancestor instruction chain containing only original requirements, a frozen facts JSON and output schema. Never set HOME/CODEX_HOME or edit installed configuration. Snapshot necessary product source including SSVE implementation as data, recording source_exposure; do not strip essential repository facts. Freeze original user constraints separately from SSVE process constraints.

Codex exec argv: --ephemeral --sandbox read-only --ignore-user-config --skip-git-repo-check --json --output-schema <neutral output schema> -m <resolved model> -c model_reasoning_effort=<resolved effort>, with stdin prompt and neutral cwd. No resume/fork. Invocation overrides: project_doc_max_bytes=0, web_search="disabled", developer_instructions="", features.skip_host_skill_discovery=true; false for shell_tool, unified_exec, multi_agent, multi_agent_v2, plugins, apps, view_image, browser_use, computer_use, memories, remote_plugin, workspace_dependencies, skill_search, image_generation, hooks, code_mode, code_mode_host, tool_suggest. Populate skills.config disabled entries for all discovered global/system/plugin skills without changing their files. Do not use --ignore-rules as instruction isolation or Landlock as read isolation.

Preflight verifies the installed binary/version/help/features support, builds controls, and runs debug prompt-input in the neutral directory with the same config overrides and actual payload. Inspect the serialized prompt BEFORE a paid run. Require no SSVE skill catalog, no project/global methodology injection and no competing candidate in Open/initial Contract. A native host safety message is allowed and its digest recorded. Record exact supplied prompt/config/binary hashes and disabled skill list. Failed/unknown feature support or unexplained injected context is IsolationUnsupported. No model answer that merely omits a canary can override failed preflight. Cache capability proof only for matching binary, controls, discovered skills/config and prompt-scope inputs.

### 5.2 Canary and limits

Add a neutral facts marker and a different marker in a controlled sibling instruction fixture. Inspect rendered prompt to prove which marker was supplied; then run one bounded LIVE full-cycle canary using explicitly resolved supported tuples. The live result must reference the facts and emit no tool events. Unexpected tool use aborts the run, invalidates capability proof and produces no usable planning receipt. This supplements the controls/serialized-prompt evidence; it does not prove cognition, complete code understanding, or absence of learned framework knowledge. Offline recorded output is labeled OFFLINE and never unlocks live capability. No paid broad benchmark.

### 5.3 Host capability

All nine manifests declare isolated_plan_analysis. Codex declares the codex-exec frozen-payload transport, required prompt-inspection/config controls and runtime canary; enabled means adapter available, while each invocation still needs passing effective preflight. Other hosts declare enabled:false with a concrete unsupported-isolation reason until an equivalent tested adapter is implemented. A chosen unsupported tuple fails explicitly or follows an already configured fallback with recorded identity. fresh_session_launch remains unchanged. Validate actual controls and capability evidence, not just four flag strings.

## 6. Role launches

scripts/lib/two-box-role-launch.mjs exports launchRole({role, tuple, payload, schema, sourceBindings, signal, limits}). The first enabled adapter is the concrete codex-exec command/config builder in section5 for ALL planning roles, so each gets a fresh tool-free process with a frozen role-specific payload. Other configured hosts fail as unsupported or use only an explicit owner-configured fallback. Resolve all roles through resolve-dispatch: open_box/contract_box/assessor inherit PLAN; scout_forward/scout_reverse inherit EXEC; explicit named roles win. Executor/reviewer routing remains its existing separate authority. No hardcoded model or effort. Persist requested/invocation/observed identity separately; absence of observed provider identity stays unknown.

Per launch: one content attempt, timeout600000ms, combined stdout/stderr cap524288 bytes, abort/cancel kills the process group and waits for exit. Only a classified pre-content spawn failure may retry once under owner policy. Parse Codex JSONL final response, reject malformed/partial/oversized/nonzero/tool-event output. Store raw bytes and a normalized output separately. A scout failure blocks a successful complete run; an incomplete but valid report remains explicitly incomplete and the assessor must dispose consequential gaps before conversion.

| Role / call | Frozen payload | Required result |
|---|---|---|
| open_box | Original requirements plus bounded repository facts, no SSVE methodology or other candidate | Natural free-form plan string, immutable before harness normalization |
| initial contract_box | Same original requirements/facts plus applicable SSVE specs/designs/constraints; no Open output | Candidate decisions with original requirement/source links |
| scout_forward | Initial Contract only; harness-selected entrypoint/requirement roots, forward dependency/state/test questions and bounded source excerpts | Findings, supplied path/line denominator, unread gaps, citations |
| scout_reverse | Initial Contract only; distinct affected-internal/consumer roots, reverse callers/lifecycle/regression questions and bounded excerpts | Same schema, distinct assignment identity |
| revised contract_box | Initial Contract and both reports; no Open output | Revised decisions plus per-finding dispositions, preserving original |
| assessor | Both originals, revised Contract, scout reports and source facts | Winner open/contract/combination, per-requirement chosen decision/source IDs, rejection dispositions, unresolved conflicts; no independent third plan |

The harness assigns forward/reverse roots from the actual change archetype, scoped paths and source import/caller/test references; record exact roots/questions/excerpts before launch. Empty/identical assignments fail; truncated/missing paths remain coverage gaps. It records supplied_files/ranges, source hash and observed reads separately from model citations. Tool-free roles have no extra observed reads. Supplying a file is input coverage only, never proof it was understood or fully audited. Scouts cannot receive Open or claim coverage of Open-only decisions.

Each result object binds WI, role, invocation/input digest, source snapshot, requested tuple/policy digest and role-specific parents. Revise/assess wait for all required objects. Independent originals are created before either can see the other. Exactly two scout invocations occur per matching run; resume may reuse only matching verified stage inputs. Keep original/revised semantic objects distinct by stage metadata even if plan text is unchanged. A new fact or changed policy invalidates that stage and its descendants, not unrelated completed work.

## 7. Eligibility (RD05)

runTwoBox ignores any supplied eligible boolean. It runs scripts/quick-fix-eligibility.mjs in the consumer checkout (staged tree, or git diff against bound base_sha). No staged/real diff => not eligible. Bind eligibility_output as ObjectRef plus DigestRef of staged_tree. v5 planning_contract.kind=lightweight is valid without control_plan_ref only when checker recomputes the same classifier on the bound diff and eligible is true. Prospective diffs fail.

## 8. researchDecision

A question record contains id, claim, evidence[] with source/basis/freshness, consequential, external_resolvable, confidence (integer1..10 or null), explicit_request, and freshness_required with reason. Validate these fields; a number is not evidence.

Order:
1. Missing question record => analysis_required.
2. Explicit user research request => external_research_required for the requested external scope; do not silently overrule user intent through a guessed external_resolvable=false.
3. Necessary freshness verification AND externally resolvable AND no sufficient current evidence => external_research_required, even with missing confidence. Missing evidence alone is NOT a freshness requirement.
4. Missing ordinary confidence => analysis_required; no manufactured sufficiency or automatic research.
5. Sufficient current cited evidence AND confidence>=7 => resolved (local analysis included).
6. Consequential unresolved external question AND confidence<7 => external_research_required.
7. Otherwise analysis_required; local questions always stay analysis until resolved.

Compiler/validator share this exact pure predicate. Records below7 with stale/missing external evidence trigger research only under step3 or6; score7 with unsupported/stale evidence remains analysis unless necessary freshness applies. Research is bounded to requesting_decision_id and returns to requesting_task_id. Reuse an existing matching research task on resume; do not insert duplicate tasks on recompilation. Completed research reevaluates the record with its real evidence and unblocks the requester only when resolved. Local analysis produces no fake research skill receipt. Predicate fixtures cover explicit requests, local resolved/unresolved, missing confidence with/without necessary freshness, scores6/7, stale high confidence, and compiler completion/recompile transitions.

## 9. Typed refs and control validation

ObjectRef is {type:"object",sha256}; only it addresses getObject. DigestRef is {type:"digest",sha256,of:"tree"|"file"|"policy"|"bytes"}. Recompute raw digests from the named actual source. Always pass explicit consumer start to the existing durable evidence store; package source root comes from import.meta.url. Different package/consumer roots are normal and must work, not cause rejection. Stable repo/common-dir identity supplies authority; historical worktree paths are metadata and cannot prevent reading evidence after deletion. Reject symlinks/traversal in any live input/reference resolution.

Keep schemas/receipts/control-plan.schema.json as one explicitly versioned schema: common fields receipt_type/schema_version/wi; allOf with an if schema_version=1 branch retaining the original v1 required/properties/floor semantics, and an if schema_version=2 branch with the strict Two-Box fields and no floor_verdict. Unknown versions fail. Do not replace the top-level required set with v2-only fields. readHistoricalReceipt chooses the authentic receipt's original branch and returns executable:false; current issuance/execution require v2. A named OFFLINE fixture at test-framework/evals/tier-1/fixtures/two-box/control-plan-v1.json is exercised through the actual schema loader and historical checker, while actual new issuance rejects it. It is a synthetic fixture, never a fabricated receipt on the real public root.

Strict control-plan v2 binds WI, original user requirements and frozen facts objects, source tree/base/scoped file digests, policy/prompt/tuple identity, original Open, original Contract, revised Contract, exactly2 assigned scout reports/coverage objects, chosen solution/dispositions, contamination diagnosis and nullable measured usage/cost. No floor_verdict. Validate exact object schemas, raw byte hashes AND parent cross-bindings (WI, role, input/source digest, candidate/scout IDs). A set of independently valid but unrelated objects fails. Recompute authoritative spec/requirements bindings at preparation and execution; source snapshots bind the pre-execution base, while expected task implementation edits do not make the base snapshot stale. Unexpected changes to required facts invalidate affected planning decisions. All selected consequential decisions reconcile into specs/designs before conversion. Unresolved conflict or undisposed consequential gaps blocks receipt issuance. Source exposure is declared; disallowed methodology contamination requires rerunning Open.

## 10. Transmutation and seal

Use a strict v5 schema with no unknown semantic keys. Canonicalize recursively by sorted object keys, preserving array order. Semantic projection includes all keys except EXACT paths timestamp, tree_hash, target_sha, planning_contract.sealed, planning_contract.sealed_at, planning_contract.semantic_contract_sha256. In particular include full original requirements/behavior/approach, all tasks/interfaces/state/failure decisions, scope/dependencies, AC/proof mappings, release sequence/recovery, selected source decisions and executor discretion, mode-specific dispatch packets. Unknown fields are rejected, not silently unhashed. Review/display metadata belongs in a separate envelope; views never define behavior.

Preparation completes all consequential choices and binds each to a selected source decision; a missing choice returns to solution analysis. Do not put a future review hash inside the prepared body. Save the exact prepared plan JSON artifact and supporting full Markdown manifest as immutable ObjectRefs, each with its own byte hash. The canonical launcher reviews the prepared JSON via --plan-file and includes the full manifest as declared context. The seal is a separate envelope over that immutable prepared body, so adding it cannot change either reviewed artifact. It binds body semantic digest, prepared artifact digest, full manifest context digest, review receipt ObjectRef, WI and candidate tree; sealed_at is envelope-only. Do not rewrite the reviewed manifest to set sealed:true.

sealAfterReview({preparedBody, reviewedPlanBytes, reviewedManifestBytes, reviewReceiptRef, consumerRoot}) reads and hashes the actual receipt; require receipt_type review-plan, WI match, passing verdict under existing reviewer policy, exact reviewed_plan_digest = SHA256(reviewedPlanBytes), matching the launcher phase binding. Verify the full manifest digest against its declared source context entry in that same signed review package. The prepared JSON must parse to the exact preparedBody; arbitrary equal-semantic serializations do not substitute for reviewed bytes. candidate_digest is the separate Git-tree digest and MUST NOT be compared to the semantic hash. Call existing verifyReviewerEvidence({root:consumerRoot,reviewKind:"plan",body:reviewReceipt}) for signed launcher provenance, independent findings and context/phase binding. Respect its real candidate tree and pre-execution base. Booleans, unsigned caller JSON, stale/wrong-WI/other-plan receipts, failed review or missing required evidence fail. Recompute AC/context/semantic bindings immediately before issuance. Store the seal as a separate durable object; plan-manifest issuance/current execution require its verified reference without changing prepared semantics. Any consequential amendment creates a revised prepared contract and invalidates affected review evidence; local repairs follow section11.

## 11. Executor discretion (AC09)

Local repair: missing import of already-approved dependency; task-caused syntax/type error in owned files; in-scope test fix that does not change AC/proof/envelope; reversible naming/format in owned files.
Amendment: new/upgraded dependency; new config/env; changed API/behavior; broadened files/authority; changed proof/AC; architecture/state ownership. Reopen affected lens with prior owner authorization.

### Discretion proof (F-005)

AC09 defines an instruction contract for the model executor, not a new code classifier. Do not invent a parallel classifier solely to test a copy of this table. Retain source consistency review, then evaluate actual executor comprehension in the bounded live canary: one additional call using the existing resolved EXEC tuple and the real execute-changeset contract. The harness holds expected decisions separately from the model-visible cases. Cases at test-framework/evals/tier-1/fixtures/two-box/executor-discretion-cases.json cover approved missing import/local repair, new or upgraded dependency/amendment, new config/env/amendment, API change/amendment, broader files or authority/amendment, and a justified reversible alternative preserving consequential decisions/local repair. Require correct classification, source rule, justification and affected-decision/proof handling for every case. Missing/incorrect decisions fail V09. Offline tests prove that the scorer rejects swapped labels, incomplete cases and a justification that silently weakens ACs; they are not model-comprehension evidence.

This adds one bounded read-only comprehension call to the six-call LIVE planning canary, not a production planning role or new policy authority. Report it as model scenario evidence, with stochastic/generalization limits, not mechanical enforcement of every future action. T4 depends on T3 and T5 and explicitly consumes assertCurrentExecution plus the verified seal before executing; section11 governs remaining model discretion.

## 12. Learning (AC15)

origin open_box|contract_box on candidates. elevate still requires outcome and evaluate-rule receipt.

## 13. Tests (not claimed run)

Offine: two-box-plan.test.mjs (happy path, isolation argv/facts-dir/review-package refuse, eligibility recompute, coverage vs citations, winner vs reject_innovation, typed refs, O_EXCL, worktree delete, package vs consumer), research-decision.test.mjs (full order table + resume edge), two-box-receipts.test.mjs (v5 both modes, bootstrap v4, refuse new v3/v4, historical v1 fixture), two-box-learning.test.mjs, delivery-plan-contract.test.mjs compatibility, validate-two-box-transmutation.sh, selector list includes that validator. Live canary explicit. Simulated checks labeled OFFLINE. RD12: full Tier-1 at release; pre-existing baseline failures remain baseline, not this WI's invented receipts.

## 14. Implementor discretion

Local helper names, fixture filenames under fixtures/two-box/, import order. Forbidden: different isolation flags; trusting caller eligible; new dispatch v3 issuance; fifth winner; getObject on digests; mutating global Codex/dispatch config; fabricating historical notes; embedding a future commit SHA.
