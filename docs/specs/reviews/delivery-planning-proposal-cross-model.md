# Delivery planning proposal — Grok High and Sol High review

Date: 2026-09-07. Scope: methodology proposal only. Both reviewers returned `pass-with-findings`; neither approved implementation or measured a speedup.

Frozen proposal SHA-256: `a9d9aff7337490c7bf2cf4e2dc0169e4b0cfcc88d9139570784e8275a2acc73d`. Identical augmented package SHA-256: `ba0795454fe204ca693f9b8b2dba922cf6bfb1f770a710c986bac67f61d225b1`.

| Reviewer | Actual route evidence | Elapsed launcher interval | Findings |
|---|---|---|---|
| gpt-5.6-sol / high | requested_accepted; exact_model_argv_plus_successful_auth_schema_exit_no_server_model_echo | 4.56 min | 7 |

## sol-high

Raw findings: `.svc/external-review-artifacts/delivery-planning-proposal-20260907/sol-high/findings.json`. Receipt: `.svc/external-review-artifacts/delivery-planning-proposal-20260907/sol-high/receipt.json`.

The proposal has a credible causal core: spend planning effort on product behavior, UX states, authority, shared interfaces, concurrency, delivery prerequisites, and decisive probes; stop pre-authoring local implementation details and duplicated release mechanics; retain implementation review and real UX/performance evidence. This is materially better than the current determinism-oriented contract for a competent, context-bearing Astra executor. It preserves valuable SSVE mechanisms: AC coverage, rollback and authority constraints, one holistic independent solution review, targeted re-review after consequential discoveries, final-candidate review, and evidence classified by what was actually observed. The proposal is appropriately honest about its evidence: it labels receipt intervals as bounded samples, separates provider waiting, acknowledges that the retrospective iOS mapping is not a blind benchmark, and treats 5× and 30/120/10 as targets rather than measured results. However, it does not establish that planning redesign alone can compress 20–30 hours to roughly 160 minutes. The evidence supports local waste mechanisms—duplicate representations, plan-induced dependencies, release-infrastructure rebuilding, schema retries, stamp-only work, and over-specified handoffs—but does not attribute enough total elapsed time to them. More importantly, “close the whole solution in 30 minutes” and “defer local details” lack a sufficiently operational boundary for medium-blast-radius decisions, where many expensive surprises occur. Recommendation: proceed to a small inline-path pilot, but first tighten the decision boundary, identify the exact current requirements being removed or retained, and make the outcome test compare equal scope and evidence against competent default Astra and current SSVE. Do not build a new planning engine or measurement bureaucracy.

### F-001 — high: The proposal’s mechanisms are plausibly beneficial, but the claimed cycle compression is not causally supported at the scale of the 20–30-hour problem.

ACCEPT. Treat planning, established release reuse and removal of redundant rework as three causal interventions. No speed claim from launcher minutes; cumulative timing is AC-DP-07.

### F-002 — high: The boundary between decisions planning must close and details execution may decide is directionally right but too subjective to prevent either late architectural rework or renewed full-plan ceremony.

ACCEPT. Use reversal propagation across user behavior/data/authority, another behavior part, release or decisive proof; classify retry/cache/error/accessibility/state/performance explicitly.

### F-003 — high: The 30-minute planning target conflicts with the breadth of mandatory decisions unless the proposal defines what prior artifacts may be trusted and how stale or missing prerequisites affect the clock.

ACCEPT. First feature-specific reasoning/probe starts the clock; prior knowledge is reusable only while applicable; unknown historical time remains unknown.

### F-004 — medium: The proposal does not identify precisely enough which current plan fields and review dimensions are removed, derived, retained, or conditional, so implementation could preserve most of the cost under new wording.

ACCEPT. Manifest transition matrix enumerates current fields and graders; schema/emitter/checker/prompt changes are one deployable slice.

### F-005 — medium: The “next verifiable part” model remains inconsistent with the owner’s whole-solution requirement and could reintroduce rolling micro-plans and review churn.

ACCEPT. Whole-solution closure before execution; elaborating local details belongs to execution and does not restart review.

### F-006 — medium: Product, UX, and performance quality is named as retained, but the proposal needs a concrete safeguard against replacing real observations with fast surrogate checks under the time budget.

ACCEPT. Observation kind and sufficiency are fixed from the promise; unavailable required observations remain unverified and cannot pass on substitutes.

### F-007 — medium: The proposed pilot direction is sound but remains too broad to falsify whether planning redesign improves delivery rather than merely selecting an easier feature.

ACCEPT WITH BOUNDARY. Paper replay before schema work; one paired same-input pilot before claiming acceleration. Legitimate new discoveries are classified, not forbidden; preventable known-contract reopening or repeated micro-review is failure.

| grok-4.6 / high | server_observed; grok_modelUsage | 5.52 min | 9 |

## grok-high

Raw findings: `.svc/external-review-artifacts/delivery-planning-proposal-20260907/grok-high/findings.json`. Receipt: `.svc/external-review-artifacts/delivery-planning-proposal-20260907/grok-high/receipt.json`.

The proposal’s core distinction is sound and not merely another process story: kinds of unknown differ, and Absolute Plan leftover graders (copy-paste commands through merge, determinism point 10 ‘no decide-later’, full later-slice internals) still tax inline Astra work that WI-386 already admitted is the only mode in practice. Producer-bound runtime identities, behavior-owned tests, honest evidence kinds, and keeping shared contracts in the whole-solution pass are the right replacements and would beat a competent default Astra that skips concurrency, device proof, and release identity. They are not, however, causally capable of turning the observed Multicontext/iOS programs into a universal 30/120/10 cycle while preserving product quality. Companion evidence puts paid plan-review intervals at ~91 minutes and ~21 minutes, not 20–30 hours; those hours include 42 ACs, in-feature release-orchestrator rebuild, quota pauses, and a 24-hour observation that cannot fit in 160 minutes. Encoding 30/120/10 as the operating model without a work class will either theater-close the solution or reopen the amendment mill. Do not score this proposal on the Absolute Plan rubric it is retiring. Implement only after: (1) a work-class envelope for the 160-minute SLO, (2) an explicit must-settle list plus file-set envelope, (3) launcher/schema replacement in the same slice as the skill words, (4) stopping AC-stripping in the execute template, and (5) a no-schema pilot on the existing iOS plan findings. Retain independent whole-solution review, rollback/authority, live-vs-source honesty, and the ban on silent scope reduction. Do not build a new planning engine or ledger.

### P-001 — high: 30/120/10 plus a 5× target is not a causal reduction of the observed 20–30 hour cycles; without a work class it will either cut quality or fail the budget.

ACCEPT WITH BOUNDARY. 30/120/10 remains the owner target, not a universal gate. A new platform or required observation must have a named larger envelope; this cannot excuse avoidable agent overhead or reset feature time.

### P-002 — high: The proposed plan form will still fail current review/schema/linter graders; changing skill prose without replacing dimension h, rubric point 10, and required command sequences is a no-op.

ACCEPT. Keep the execution sequence field; inline may use a typed producer/verifier action, dispatch keeps concrete commands. Change all actual consumers and nullable inline readiness score together.

### P-003 — high: ‘Whole solution closed / local detail later’ has no closed must-settle list and no file-set envelope, so the WI-347 drift hole reopens under a new name.

ACCEPT WITH CORRECTION. Enumerate must-settle categories plus propagation rule, rather than claiming an exhaustive list of every possible decision. Preserve exact file write bounds before mutation.

### P-004 — high: The first implementation list omits the execute-changeset template that strips acceptance criteria, which the proposal itself identifies as the meaning-loss mechanism.

ACCEPT. Executor template and applicable original AC/UX context are part of the first contract slice.

### P-005 — medium: The 14 iOS findings mapping is a useful retrospective, not proof the new format would have caught the product defects; several need probes or tracing, not less dictation.

ACCEPT. Historical findings classified into process graph, future identity, observation mismatch, missed product/API fact. Only the first two are directly removed by representation changes.

### P-006 — medium: Dispatch/lean-executor remains a live fail-closed path; deferring internals there recreates the WI-347 failure the Absolute Plan was built for.

ACCEPT. Deferred execution entries require explicit inline mode and the new receipt version; absent/dispatch mode keeps its existing complete blueprint contract.

### P-007 — medium: ‘Derive task/AC views from the canonical record’ is right, but the generator and fail-closed live-spec bind are unspecified and can become the third ledger the proposal refuses.

PARTIAL ACCEPT. Generate mappings from canonical task/validation records and authoritative spec, with hash binding. Reject restricting plan-contract.json to risk flags ONLY: existing product/resource-writer, ownership and claim triggers remain necessary and unchanged.

### P-008 — medium: Ten-minute finalization and this planning-form change are the wrong 5× lever compared with reuse of an existing release path and automatic restamp.

ACCEPT WITH BOUNDARY. Use existing release adapters, conditional index refresh and actual input-bound evidence. Real required device proof is active work if operated by an agent; only real provider/observation waiting is external wait.

### P-009 — low: Falsification is named but not turned into a small existing-evidence pilot; schema work should wait on that.

ACCEPT. A paper replay is recorded now before schema changes, explicitly not blind or a performance benchmark; implementation requires the named counterexample fixtures and one paired pilot before a speed claim.

## Outcome

All 16 proposal findings have explicit dispositions. These are author resolutions, not a second reviewer verdict. Implementation decisions are in the changeset; formal plan review binds a separate candidate. The owner requested planning only after the proposal review: implementation, install, promotion and product-session mutation are not executed by this task.
