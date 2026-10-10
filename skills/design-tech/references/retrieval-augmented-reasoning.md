## Retrieval-Augmented Reasoning (cutting-edge technique #9)

When you hit uncertainty mid-design, do NOT guess. Repository inspection and
reasoning are ANALYSIS, never internal research:
1. **Pause** the reasoning chain.
2. **Analyze locally** — grep the codebase, read the file slice, check installed
   docs or a current cited `references/knowledge/` node.
3. **Incorporate** it, then **continue** from where you paused.
4. Invoke `research` only if `researchDecision(question)` from
   `scripts/lib/research-decision.mjs` returns `external_research_required`.

Rules:
- Missing ordinary confidence and local unknowns stay analysis.
- Missing evidence alone is not necessary freshness. Evidence has source, basis,
  and freshness. Confidence is an integer 1..10 or null, not evidence by itself.
- A new dependency, configuration, or API choice is a consequential amendment,
  not an automatic research trigger.
- Retrieve the minimum locally: grep before read; read the slice, not the whole file.
- Log non-trivial retrievals (what + why) in `.svc/pipeline-decisions.jsonl`.
- Bind `requesting_decision_id` and `requesting_task_id` when research runs;
  completed status is not resolution; do not fabricate a completed `research`
  receipt when only local analysis ran.

Formalizes `rules/common/research-before-build.md` as a mid-reasoning analysis
loop, with external research only by the predicate.
