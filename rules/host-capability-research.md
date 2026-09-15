---
id: svc-host-capability-research
type: correction
scope: universal
severity: high
---

# Rule: Verify Host Capabilities Before Host-Specific Implementation

Before implementing ANY feature that touches host integration surfaces — hooks, MCP servers, task graphs, model routing, UI paradigms, Background Tasks, or any host-specific API — inspect current in-repo host manifests, installed host docs, and cited evidence (ANALYSIS, never internal research). Do NOT rely on training data for host API capabilities. Live/external host-doc fetch is not unconditional.

## Host Integration Surfaces

| Surface | Examples | Host Docs |
|---|---|---|
| Hooks / lifecycle events | PreToolUse, PostToolUse, Stop, SessionStart, etc. | `code.claude.com/docs/en/hooks` (Claude); Kimi CLI docs |
| MCP servers / tools | Available tools, tool schemas, tool behavior | Host documentation or `mcp.json` |
| Task graphs / Background Tasks | TaskList, TaskUpdate, /task, update_plan | Host CLI docs |
| Model routing | Model IDs, context windows, pricing | Host provider docs |
| UI paradigms | How the host displays task state, how subagents work | Host behavior docs |

## Host Capability Analysis Protocol

Evaluate external lookup with `researchDecision(question)` from
`scripts/lib/research-decision.mjs`. Ordered rules: missing question record =>
`analysis_required`; explicit user research request => `external_research_required`
for requested scope; necessary freshness (with reason) AND `external_resolvable`
AND insufficient current cited evidence => `external_research_required` even if
confidence is missing; missing ordinary confidence => `analysis_required`;
sufficient current cited evidence AND confidence >= 7 => `resolved`;
consequential unresolved external question AND confidence < 7 =>
`external_research_required`; otherwise `analysis_required`. Evidence has
source/basis/freshness. Missing evidence alone is not necessary freshness.
Confidence is an integer 1..10 or null, not evidence by itself. Local unknowns
stay analysis. A new dependency/configuration/API choice is a consequential
amendment, not an automatic research trigger.

1. **If you are uncertain about a host capability**, analyze current local host
   docs, manifests, and cited evidence first. Invoke `research` only when the
   predicate returns `external_research_required`. Bind `requesting_decision_id`
   and `requesting_task_id`, return updated question/evidence/confidence,
   reevaluate before unblocking, and reuse a matching existing task on resume.
   Completed status alone is not resolution. Do not fabricate a completed
   `research` skill receipt when only local analysis ran.
2. **If the change modifies host wiring** (e.g., `scripts/wire-hooks.mjs`, `scripts/wire-kimi-hooks.mjs`, host `settings.json`), read the host's CURRENT local/installed documentation, not your training data.
3. **If you discover a capability mismatch** between training data and current
   cited docs, update `references/knowledge/svc/CAPABILITIES.md` and `FRAMEWORK-STATE.md`.

## Failure Mode This Prevents

Training data on host APIs is often stale by months. Assuming "Claude Code only supports 3 hook events" when the actual docs show 27 events leads to:
- Under-implementation (missing 18 hooks)
- Wrong documentation in FRAMEWORK-STATE.md and proposals
- Framework degradation that propagates to all downstream skills

## Rationale

"Analyze before build" is already a framework principle (`rules/common/research-before-build.md`). This rule elevates current-host verification to a hard local-analysis gate for host-specific surfaces because host API drift is silent, high-impact, and affects every project using the framework. External research stays predicate-gated.
