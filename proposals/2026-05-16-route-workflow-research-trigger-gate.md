# Framework Improvement - 2026-05-16 - Route-workflow research trigger gate

**Status:** DRAFT
Severity: HIGH - provider/API research misses can produce stale specs or implementation plans before review has a chance to correct them.
**Risk class:** hot-path
**Proposed validator path:** `test-framework/evals/tier-1/validate-route-workflow-research-trigger-gate.sh`
validator_path: `test-framework/evals/tier-1/validate-route-workflow-research-trigger-gate.sh`
failure_class: provider-api-research-miss
promotion_signal: A WI/request with explicit provider/API uncertainty routes without inserting a blocking `research` task before the dependent lane step.

## Evidence

- **Source:** Example Marketplace WI-168 POS integration discussion on 2026-05-15/16.
- **Finding:** The user invoked `route-workflow` for a vendor/API-heavy WI, but the router did not reliably make `research` the blocking next step. The agent eventually performed research manually, but the framework did not make that hard to miss.
- **Severity:** HIGH

## Diagnosis

- **Root cause:** `route-workflow` has several paths that mention or can route to `research`, but the trigger surface is indirect and too literal. External-provider/API uncertainty can fall through to normal brownfield-feature routing unless a downstream skill later declares uncertainty.
- **Category:** route-workflow / research orchestration / external-provider uncertainty / task-graph enforcement.
- **Already in FRAMEWORK-STATE.md?** Partially. WI-326 added the capability blocker ledger and route-workflow wiring, but current behavior still misses natural provider/API research phrasing and does not consistently document `route-workflow` as a first-class detector for research-gated provider work.

The failure mode is:

1. User asks route-workflow about a WI with external providers, APIs, SDKs, webhooks, OAuth, market availability, or "needs more research" language.
2. `route-workflow` classifies the work as normal feature/backlog routing.
3. The task graph points to `validate-feature` or another lane skill.
4. Research may or may not happen later depending on whether the downstream skill/agent notices the uncertainty.
5. The output can become a proposal/spec/build plan that cites stale assumptions or lives outside the knowledge system.

## Current Evidence From The Framework

- `route-workflow/SKILL.md:47-51` says the router must select the next skill and dispatch only after loading that skill contract.
- `route-workflow/SKILL.md:134-151` has capability blocker auto-diagnosis and maps `unknown-provider-api` to `research`.
- `route-workflow/references/lane-model.md:79-81` says `research` auto-invokes for unknown API/pattern/framework/domain concepts when the knowledge base has no answer.
- `route-workflow/references/routing-rules.md:178-180` says `research` is detected by `analyze-domain`, `design-tech`, `execute-changeset`, `validate-feature`, and `improve-framework`; `route-workflow` itself is not listed as a detector for the normal provider/API uncertainty case.
- Gemini research review on 2026-05-15 confirmed the existing blocker ledger, research invocation receipt, domain gate, and task-graph protocol already cover part of this flow. The remaining gap is narrower: signal detection and route-time graph insertion need improvement, while downstream `research` execution receipts are already handled after task pickup by the task-graph skill-load protocol.
- Measured false negative:

```bash
node scripts/diagnose-capability-blocker.mjs \
  --root /workspace/seriousvibecoding \
  --text "WI-168 optional POS integration Stripe Terminal Toast SumUp needs more research vendor API webhook unknown exact build plan"
```

Result:

```json
{
  "blocker_detected": false,
  "primary": null,
  "matches": []
}
```

That text is exactly the kind of request the framework should treat as research-gated.

## Required Framework Change

### F-001 - Expand provider/API research blocker signals

Update `references/capability-blockers.json` so `unknown-provider-api` catches natural external integration language, not only exact phrases like `unknown api` or `webhook contract`.

Add signals covering:

- `vendor api`
- `provider api`
- `provider docs`
- `vendor docs`
- `api docs`
- `sdk docs`
- `integration docs`
- `webhook provider behavior is unclear`
- `oauth provider behavior is unclear`
- `callback provider behavior is unclear`
- `provider availability unknown`
- `latest docs`
- `current docs`
- `needs research`
- `more research`
- `not sure if`
- `does X support`

The intent is not to route every feature to research. Bare nouns such as `webhook`, `oauth`, `callback`, and `availability` must not trigger this blocker on their own. The signal should fire only when provider/API uncertainty, freshness risk, or documentation lookup need is explicitly present in the request, WI title, WI body, or active failure summary.

### F-002 - Make route-workflow a first-class detector for research-gated provider work

Update `route-workflow/references/routing-rules.md` and `route-workflow/references/lane-model.md` so `route-workflow` itself can insert `research` before the normal lane when the request or WI has external provider/API uncertainty.

Current behavior waits for downstream skills to notice uncertainty. That is too late for WIs where the route decision itself depends on vendor docs.

Required rule:

```text
If route-workflow detects provider/API uncertainty and local knowledge does not answer it, insert research before validate-feature/design-tech/execute-changeset and mark the dependent task blocked_by the research task.
```

### F-003 - Add route graph evidence for research insertion

When `route-workflow` detects provider/API uncertainty, it must prove the compiled task graph contains a blocking `research` task before the dependent lane step. Route closeout should validate graph shape, not require a downstream `research` invocation receipt before the research task has run.

```json
{
  "metadata": {"skill": "research"},
  "blocked_by": ["<detecting-or-route-task-id>"],
  "blocks": ["<dependent-lane-task-id>"]
}
```

The existing task-graph execution protocol already requires the executor to load the named skill and record the skill-load receipt before marking the `research` task complete. The research skill itself already emits `.svc/pipeline-decisions.jsonl` `skill_invocation` receipts before writing research artifacts. This proposal must not require `route-workflow` to wait for evidence that can only exist after downstream task execution.

This catches the exact failure where the router conceptually needs research but still compiles a normal feature/design/build graph with no blocking `research` node.

### F-004 - Add a regression fixture for WI-168-style wording

Add a tier-1 validator or extend an existing route-workflow/capability-blocker validator with fixture strings:

Positive cases must route/insert `research`:

- `WI-168 optional POS integration Stripe Terminal Toast SumUp needs more research vendor API webhook unknown exact build plan`
- `Research current Stripe Terminal and Toast API docs before implementing this POS integration`
- `This OAuth/webhook provider behavior is unclear; route the WI`
- `Check whether SumUp supports passive transaction webhooks before build`
- `Latest API docs may have changed for this provider`

Negative cases must not route to research:

- `Add a button to an existing page`
- `Fix typo in docs`
- `Refactor CSS class names`
- `Known API already documented in references/knowledge and no freshness risk is stated`

### F-005 - Preserve knowledge-system persistence without duplicating the research domain gate

When `research` is inserted for a product repo, `route-workflow` should pass enough context for the `research` skill to choose the correct knowledge target, but the final domain decision remains inside the research skill's existing domain gate:

- product-local knowledge when the research is specific to the product's implementation/domain,
- framework knowledge when the research changes reusable svc behavior,
- explicit `SVC_KNOWLEDGE_DIR` override when writing to a non-default knowledge root.

This prevents dated research files from becoming orphan evidence snapshots without making `route-workflow` duplicate `research/scripts/domain-gate.mjs` or pre-assign knowledge domains.

## Non-Goals

- Do not make `research` run for every brownfield feature.
- Do not create a new skill.
- Do not replace `validate-feature`; research only blocks the dependent step when provider/API uncertainty is present.
- Do not treat search results as implementation proof; research must still persist provenance and uncertainty.

## Relationship To Existing Review Skills

This proposal does not add a new review gate. It moves an existing research obligation earlier, into route-time task graph construction.

- `review-gate` remains the post-plan/post-implementation review protocol. It can catch missing evidence later, but it is too late to be the primary mechanism for deciding whether a WI must start with research.
- `review-cross-model` remains the escalation path for high-risk or repeated failures. It should not be required just to notice that a provider/API route needs current docs.
- `research` remains the skill that resolves and persists provider/API knowledge. This proposal only makes route-workflow more reliable at invoking it.

## Proposed Implementation Path

1. Extend `references/capability-blockers.json` signals for `unknown-provider-api`.
2. Update `route-workflow/references/routing-rules.md` and `route-workflow/references/lane-model.md` to list `route-workflow` as a detector for provider/API research-gated work.
3. Update route-workflow self-verify or validators to require graph evidence when research is selected/inserted: a `research` task with correct `blocked_by` wiring before the dependent step.
4. Add/extend a tier-1 validator with WI-168-style positive and negative fixtures.
5. Add a short research-context handoff rule so research outputs land under the correct `references/knowledge/...` root or are explicitly marked as snapshots by the research skill's domain gate.

## Replay Verification

Replay target: Example Marketplace WI-168 POS integration routing failure.

The fixture should fail before the fix because:

- provider/API uncertainty wording returns `blocker_detected: false`;
- route-workflow can continue to normal brownfield-feature routing;
- no blocking `research` task is required before route closeout.

The fixture should pass after the fix when:

- the WI-168-style wording detects `unknown-provider-api`;
- route-workflow inserts `research` before the feature/design/build task;
- the downstream task is blocked by the research task until research completes;
- the research output points to the knowledge-system entry or explicitly records why it is only a dated snapshot.

## Acceptance Criteria

- [ ] `unknown-provider-api` catches natural vendor/API uncertainty wording, including the WI-168 POS fixture.
- [ ] `route-workflow` is documented as a valid detector for provider/API research-gated work.
- [ ] Route-workflow inserts `research` before normal lane dispatch when provider/API uncertainty is present and local knowledge is insufficient.
- [ ] Route closeout fails or warns hard when selected/inserted research has no blocking task-graph node before the dependent step.
- [ ] A tier-1 validator covers positive and negative routing fixtures.
- [ ] The research task receives enough context for the research skill to record framework knowledge, product-local knowledge, or a dated snapshot with a canonical knowledge entry point.

## Self-Verify

| # | Check | Result |
|---|---|
| 1 | Proposal is atomic | PASS |
| 2 | Every finding cites file:line or measurement | PASS |
| 3 | FRAMEWORK-STATE.md was read first; no rediscovered item treated as blank slate | PASS |
| 4 | Findings ranked by impact + confidence | PASS |
| 5 | Acceptance criteria are mechanically testable | PASS |
