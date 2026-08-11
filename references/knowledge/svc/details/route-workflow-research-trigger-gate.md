# svc Route-Workflow Research Trigger Gate - Detail

Source: Gemini CLI research review plus local framework artifacts.
Extracted: 2026-05-16

## Mechanism (factual)

`route-workflow` already has capability-blocker auto-diagnosis and an on-demand skill model that can insert `research` before dependent lane steps. The framework also already has a downstream execution contract: once a `research` task exists in `.svc/lane-tasks-<WI>.json`, the executor must load the `research` skill before doing the task, record the task-graph skill-load receipt, and the research skill must emit `.svc/pipeline-decisions.jsonl` `skill_invocation` before writing research artifacts.

The concrete failure is narrower than "research is not wired." The current `unknown-provider-api` signal matching is too literal, so natural provider/API uncertainty such as "needs more research vendor API" can miss the blocker. Separately, `route-workflow` is not listed as a first-class detector for `research` in the on-demand skill matrices, even though route-time provider/API uncertainty can determine the correct first lane step.

The correct fix shape is:

1. Add uncertainty-bound signals to `references/capability-blockers.json`.
2. Document `route-workflow` as a detector/invoker for provider/API research-gated work.
3. Validate that the compiled task graph contains a blocking `research` task before the dependent lane step.
4. Let the `research` skill own domain classification and provenance through its existing domain gate.

The incorrect fix shape is requiring `route-workflow` to prove a downstream `research` invocation receipt before route closeout. At route closeout time, the downstream research task has not necessarily executed yet. The route layer can validate graph shape; the execution layer validates skill-load and research artifact receipts.

## Analysis (expert commentary)

- **Useful for:** Framework bugs where routing depends on current vendor/API/docs knowledge, especially payment, POS, OAuth, SDK, webhook, mobile store, and hosted-platform integration work.
- **Trade-offs:** Earlier research insertion prevents stale implementation plans, but overly broad keyword triggers can block normal execution with unnecessary research.
- **Similar to:** Existing on-demand `manage-finops` and `strategic-decision` insertion, where the route/skill layer inserts a blocking task and a downstream skill owns the substantive decision.
- **Could improve svc by:** Adding fixture-level proof for both false negatives and false positives. Positive fixtures should include WI-168-style "needs more research vendor API"; negative fixtures should include ordinary known work such as "Implement the Stripe webhook callback."
- **Assumptions:** The executor honors `.svc/lane-tasks-<WI>.json` as source of truth and cannot mark a task complete without the matching skill-load receipt.
- **Watch out for:** Do not add bare nouns such as `webhook`, `oauth`, `callback`, or `availability` as blocker signals. Bind them to uncertainty, freshness, or documentation lookup phrasing.

## Key Source Files (L4 pointers)

- `proposals/2026-05-16-route-workflow-research-trigger-gate.md:31` - amended proposal and replay fixture for the route-time research gate.
- `route-workflow/references/routing-rules.md:174` - on-demand skill trigger matrix where `route-workflow` should be listed for research-gated provider/API uncertainty.
- `route-workflow/references/lane-model.md:75` - conditional on-demand skill table for auto-invoked skills.
- `route-workflow/references/task-graph-protocol.md:187` - skill-load receipt requirement before a task can be completed.
- `research/SKILL.md:83` - `research` invocation receipt before artifact writes.
- `research/SKILL.md:162` - research domain gate for knowledge target classification.
- `research/SKILL.md:287` - mandatory `.sources.jsonl` provenance requirement.
- `references/capability-blockers.json` - `unknown-provider-api` signal inventory to extend.
- `scripts/diagnose-capability-blocker.mjs` - current blocker detector used by the replay fixture.
