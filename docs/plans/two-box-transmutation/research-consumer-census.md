# Research consumer census — WI-FW-TWO-BOX-01 Decision 7 / RD06

Base 0dcd69d255642dcc78db521e95afa2b18ea1276f. Implementation routes each producer through scripts/lib/research-decision.mjs. Research completion must set requesting_decision_id and unblock the requesting task. Sufficient current local evidence is resolved. Missing ordinary confidence is analysis_required. Freshness and explicit external requests research even if score is missing.

## Shared predicate

T5 owns scripts/lib/research-decision.mjs. Evaluation order is docs/specs/tech/two-box-transmutation.md section 8.

## Mechanical producers

| # | Path | Required change |
|---|---|---|
| 1 | scripts/compile-delivery-graph.mjs | Insert research only when researchDecision returns external_research_required; attach requesting_task_id; do not insert because solution_confidence.required alone |
| 2 | scripts/validate-delivery-graph.mjs | Require research task only when compiled external_research_required; require resume edge; reject fabricated research receipts for resolved/analysis_required |
| 3 | references/solution-confidence-protocol.md | Remove five-example floor as forced research |

## Skill producers

| # | Path | Required change |
|---|---|---|
| 4 | skills/design-tech/SKILL.md | Remove five-example quota; use predicate |
| 5 | skills/explore-solutions/SKILL.md:260 | Remove five sourced example quota |
| 6 | skills/write-spec/SKILL.md:154 | Predicate; missing score is analysis |
| 7 | skills/validate-feature/SKILL.md | Per-question predicate |
| 8 | skills/analyze-domain/SKILL.md | Predicate |
| 9 | skills/execute-changeset/SKILL.md:340 | Approved dep is local repair; new dep is amendment plus predicate |
| 10 | skills/recall-stack-knowledge/SKILL.md | Do not auto-spawn research on missing assessment; freshness/explicit still research |
| 11 | skills/research/SKILL.md | Performer only when predicate or explicit skill request; write requesting_decision_id |

## Router / rules

| # | Path | Required change |
|---|---|---|
| 12 | skills/route-workflow/references/lane-model.md:90-91 | Conditional research |
| 13 | skills/route-workflow/references/intent-routing.md | Analysis first |
| 14 | skills/route-workflow/references/routing-rules.md:207 | Predicate |
| 15 | rules/common/research-before-build.md | Not a forced unsolicited network quota |
| 16 | rules/host-capability-research.md | Local host JSON analysis first; freshness of external host docs may research |

## Intentional

User-explicit /research remains. strategic-decision inline WebSearch is question-bound, not a research receipt unless that skill records an external fetch against the predicate. No test in this conversion has been run.
