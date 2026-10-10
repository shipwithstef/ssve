---
id: svc-learning-preload
type: steering
scope: universal
severity: medium
---

# Rule: Use Prior Learnings

Learnings live in `docs/learnings/learnings.jsonl` (project) and `references/framework-learnings.jsonl` (framework). The `svc-learning-preload` and `svc-learning-inject` hooks surface matching entries automatically; when one is injected, apply it. Before framework changes (`evolve-framework`, `improve-framework`, `create-skill`), grep the framework learnings for the topic. A learning that fires 3+ times at confidence >= 8 is a candidate `rules/` correction.
