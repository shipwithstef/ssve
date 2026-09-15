---
description: Research before implementation — search priority that prevents reinventing the wheel
scope: project
stack: universal
source: blended:ecc
source_sha: 125d5e619905d97b519a887d5bc7332dcc448a52
---

# Analyze Before Building

Repository inspection and reasoning are ANALYSIS, never internal research. Do
not run unconditional external research before coding or design. There is no
five-example floor, no per-paradigm mandatory search, and no mandatory external
examples merely because solution confidence was requested.

Before writing any new implementation, inspect the current repository, installed
packages, local docs, and current cited evidence.

Evaluate any proposed external lookup with `researchDecision(question)` from
`scripts/lib/research-decision.mjs`. Ordered rules:

1. missing question record => `analysis_required`
2. explicit user research request => `external_research_required` for the requested scope
3. necessary freshness (with a stated reason) AND `external_resolvable` AND insufficient current cited evidence => `external_research_required` even if confidence is missing
4. missing ordinary confidence => `analysis_required`
5. sufficient current cited evidence AND confidence >= 7 => `resolved`
6. consequential unresolved external question AND confidence < 7 => `external_research_required`
7. otherwise `analysis_required`

Evidence has source, basis, and freshness. Missing evidence alone is not
necessary freshness. Confidence is an integer 1..10 or null; it is not evidence
by itself. Local unknowns stay analysis. A new dependency, configuration, or
API choice is a consequential amendment, not an automatic research trigger.

When the predicate returns `external_research_required`, bind
`requesting_decision_id` and `requesting_task_id`, invoke `research` for that
scope, return updated question/evidence/confidence to the decision, reevaluate
before unblocking, and reuse a matching existing task on resume. Completed
status alone is not resolution. Fulfill an explicit research request once and
keep its provenance; do not repeat it forever. Do not fabricate a completed
`research` skill receipt when only local analysis ran. Preserve user-explicit
research and useful extraction/quality methods when research does run.

When external research does run, honor this discovery order: local analysis,
then package registries, then GitHub code/repo search, then vendor docs, then
WebSearch last.

**Goal:** reuse a proven in-repo or already-cited approach when it covers the
requirement. Writing net-new code is the last resort, not the first instinct.
