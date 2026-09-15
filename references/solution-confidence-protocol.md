# Solution Confidence Protocol

Use this when the user wants confidence that the framework found the right
solution before planning or implementation.

This is an automatic confidence protocol, not a new implementation lane and not
a default human gate. It forces the framework to build the same picture a senior
product engineer would build before changing behavior: what exists now, why it
may have been built that way, what users need, what current cited evidence says,
what the cost and cache consequences are, and which solution survives
comparison. Repository inspection and reasoning are ANALYSIS, never internal
research. Solution-confidence does not require unconditional external research,
a five-example floor, or external examples merely because confidence was requested.

## Operating Modes

`solution_confidence_required: true` means the framework must not accept a
solution suggestion without grounding and evaluation. It does not create a
human checkpoint by default.

Use one of these modes:

| Mode | Trigger | Behavior |
|---|---|---|
| `design_auto` | Default when user wants confidence/right design/all cards on table and does not explicitly request a gate | Automatically run the needed grounding, local analysis, UX/tech design, solution exploration, planning, and implementation through the normal lane once the confidence artifact selects a direction and its approval packet/proof gates are complete. Invoke `research` only when `researchDecision(question)` from `scripts/lib/research-decision.mjs` returns `external_research_required`. |
| `post_design_human_gate` | User explicitly asks to wait before plan, review the design first, approve before implementation, or otherwise requests a gate | Automatically run grounding, local analysis, UX/tech design, and solution exploration until the design direction is ready. Then stop before `plan-changeset` with an approval-ready user checkpoint backed by the action-by-action approval packet. External research only by the same predicate, and only for the requested scope. |
| `intake_only` | User explicitly says "no design yet", "intake only", "only create WI", "do not decide yet", or asks only for a parking lot | Create/update WI and decision workspace. Append evidence/questions. Keep design/exploration/planning/implementation inactive under the explicit intake stop. |

Human gates happen after design only when the user requests one. Otherwise the
framework continues automatically after design using the normal lane. Do not add
approvals for reversible analysis or execution.

## Research Decision Contract

Evaluate any proposed external lookup with `researchDecision(question)` from
`scripts/lib/research-decision.mjs`. Apply these ordered rules:

1. missing question record => `analysis_required`
2. explicit user research request => `external_research_required` for the requested scope
3. necessary freshness (with a stated reason) AND `external_resolvable` AND insufficient current cited evidence => `external_research_required` even if confidence is missing
4. missing ordinary confidence => `analysis_required`
5. sufficient current cited evidence AND confidence >= 7 => `resolved`
6. consequential unresolved external question AND confidence < 7 => `external_research_required`
7. otherwise `analysis_required`

Evidence has source, basis, freshness, and a verification result. Sufficient
evidence includes a cited item with `verified: true` and `freshness: "current"`
(or `freshness.status: "current"`). Record why it supports the specific claim;
a citation or timestamp alone does not establish that support. Missing evidence
alone is not necessary freshness. Confidence is an integer 1..10 or null; it is not evidence
by itself. Local unknowns stay analysis. A new dependency, configuration, or
API choice is a consequential amendment, not an automatic research trigger.

Use a question record such as:

```json
{
  "id": "cancellation-contract",
  "claim": "The selected API supports cancellation before dispatch.",
  "evidence": [],
  "consequential": true,
  "external_resolvable": true,
  "confidence": 6,
  "explicit_request": false,
  "freshness_required": {"necessary": false, "reason": ""}
}
```

Research tasks bind `requesting_decision_id` and `requesting_task_id`, return
updated question/evidence/confidence to that decision, reevaluate the predicate
before unblocking, and reuse a matching existing task on resume. Completed
status alone is not resolution. Fulfill an explicit research request once and
keep its provenance; do not repeat it forever. Do not fabricate a completed
`research` skill receipt when only local analysis ran. Preserve user-explicit
research and intentional market-research scope; when external research does run,
keep useful extraction and quality methods.

The graph retains the exact input as `metadata.research_trigger_question`.
Research records `observed_evidence`, `observed_confidence`, and, for an explicit
request, `fulfilled_scope` matching its requested scope. Resume consumes these
results only while the input still matches. A changed claim reopens the same
task and archives its previous proof in `research_history`. An unresolved result
keeps the requesting decision blocked; resolution removes only that research
dependency and preserves unrelated receipts and explicit human gates.

## Trigger Phrases

Enable `solution_confidence_required: true` when the user says or implies:

- "best solution", "right solution", "right design", "be sure", "I want to be confident"
- "all cards on the table", "golden standard", "successful projects", "real-life examples"
- "understand current picture", "why was it done this way", "maybe only part is wrong"
- "consider cost", "caching", "performance", "mobile and web", "safe change"
- "by design auto", "figure out actual solution first"
- "before the plan", "wait before plan", "show me the design first" when the
  user explicitly requests a post-design checkpoint
- an equivalent phrase in typo-heavy text or another language

Also enable it automatically for high-stakes design work when at least two of
these are true:

- user-facing UI or native mobile behavior changes,
- data loading, caching, pagination, search, or offline behavior changes,
- paid provider/API usage or metered platform usage may change,
- a data model, cache model, or backend function contract may change,
- there are three or more credible solution paths,
- the existing implementation appears intentional but insufficient.

## Required Artifact

Before `plan-changeset` or implementation, produce or update:

```text
docs/specs/decisions/<YYYY-MM-DD-slug>/SOLUTION-CONFIDENCE.md
```

If a decision workspace already exists for the WI, place the artifact there.
If the work is only intake, append evidence to `EVIDENCE-LEDGER.md` and leave
`SOLUTION-CONFIDENCE.md` uncreated until the user authorizes the decision pass.

The artifact must be approval-grade, not merely explanatory. Before the
framework asks a user to approve, or before `design_auto` self-advances into
planning, `SOLUTION-CONFIDENCE.md` must contain an action-by-action approval
packet and proof gates. A missing approval packet blocks approval requests,
`plan-changeset`, and implementation.

## Required Sections

`SOLUTION-CONFIDENCE.md` must contain these sections:

1. **User Ask And Confidence Bar** — what the user is asking to trust, what
   "good enough to plan" means, and what is explicitly out of scope.
2. **Current Picture** — product goal, personas, affected surfaces, current
   UX on web/mobile/native, relevant specs, current code/data flow, and any
   runtime measurements already available. Capture both cold-load and warm-load
   perception when caching may hide the underlying cost.
3. **Why The Current Design May Exist** — Chesterton's Fence analysis from git
   history, prior WIs, decisions, specs, comments, and framework/user context.
4. **Constraint Profile** — budget, team, platform, native/web environment,
   Base44 or host limitations, compliance, time-to-revenue, and reversibility.
5. **Freshness And Cache Classes** — which data is static, stale-tolerant,
   session-cached, user-device cached, server cached, provider-cached, or must
   be real-time; include invalidation ownership for each class. Treat images,
   thumbnails, and other media as their own cache class when they materially
   affect perceived performance.
6. **Cost Model** — current cold/warm call path, payload/read amplification,
   provider/API charges if relevant, and target state aiming for same or lower
   recurring cost unless quality requires an explicit exception.
7. **World Grounding** — cite current evidence that already has source, basis,
   and freshness. External examples are not a floor and are not required merely
   because solution confidence was requested. Add external examples only when
   `researchDecision(question)` returns `external_research_required` for that
   scope. When such rows exist, each must cite a source and map to one design
   lesson. Do not use unsourced "everyone does X" claims.
8. **Options Considered** — at least three materially different options,
   including "keep current and tune only" when the current behavior might be
   deliberate.
9. **Tradeoff Matrix** — compare quality, cost, latency, mobile memory,
   implementation size, reversibility, operational risk, and user perception.
10. **Action-by-Action Approval Packet** — for each proposed action, state:
   what changes, why the action exists, how it would be achieved, expected
   positive outcome, negative/risk outcome, impact if skipped, and the proof
   required before implementation closeout. This section is mandatory even in
   `design_auto`; in that mode it is the self-gate before planning.
11. **Outcome Coverage** — cover material best/worst credible outcomes and
   mitigations across product UX, web behavior, mobile/native behavior,
   data correctness, cost/credits, provider/API usage, cache/freshness,
   scalability, implementation complexity, reversibility, and support/ops
   impact. State when a category is not applicable rather than omitting it.
12. **Decision Or Remaining Unknowns** — either select the design direction
   with confidence level (integer 1..10 or null; confidence is not evidence),
   or state exactly what measurement or predicate-required external research is
   still required before design can close. Local unknowns stay analysis.
13. **Base44/AI Suggestions Triage** — classify external suggestions as
   `adopt`, `modify`, `defer`, `reject`, or `unrelated`, with reasons.
14. **User-Facing Summary** — 5-7 bullets maximum, written for a non-expert
   decision maker. Link to the full artifact for details.

### Approval Packet Minimum Schema

The approval packet must have one row per material action, not one row per
general theme. Each row must include:

| Column | Required content |
|---|---|
| Proposed action | The smallest reviewable action, such as "move category filtering server-side" or "return one primary image per card." |
| Why this action exists | The evidence-backed reason, not a generic performance claim. |
| How it would be achieved | The intended mechanism, API, data contract, or implementation boundary. |
| Positive outcome | What improves if the action works. |
| Negative / risk | What can get worse or fail. |
| Impact if skipped | What cost, behavior, or risk remains if this action is not done. |
| Required proof before closeout | The test, measurement, screenshot, trace, or production probe that must pass before the implementation can close. |

When the user asked for approval before planning, the final checkpoint must
point to this packet and must not reduce approval to "approve the recommended
direction." The user must be able to approve or challenge specific actions.

## Suggestion Triage Rules

External/AI suggestions are input evidence, not accepted decisions. The
framework must evaluate each suggestion against the current product, code,
cost/cache model, user perception, and alternatives before accepting it.

Use this triage vocabulary:

| Classification | Meaning |
|---|---|
| `adopt` | Fits the measured problem, constraints, and chosen solution. |
| `modify` | Direction is useful but implementation shape, scope, or timing changes. |
| `defer` | Plausibly valuable but not needed for the current decision or blocked by missing evidence. |
| `reject` | Conflicts with constraints, duplicates existing behavior, solves the wrong problem, or worsens cost/UX. |
| `unrelated` | Separate product idea, not part of the scoped problem. |

For every accepted or modified suggestion, name what evidence made it survive.
For every rejected/deferred suggestion, name the specific reason so it does not
reappear as an unexamined recommendation later.

## World Grounding Rules

There is no five-example floor and no per-paradigm mandatory search. Do not
require external examples just because solution confidence was requested.
When `researchDecision(question)` returns `external_research_required` for an
intentional world/market/provider scope, useful grounding sources include:

- official product/API behavior from Google Places, Yelp, Foursquare, Algolia,
  Mapbox, Apple/Google Maps, Airbnb, DoorDash, Uber, or similar leaders,
- public engineering posts from successful products,
- production-grade open-source implementations,
- provider docs showing limits, pagination, cost, geo filtering, caching, or
  lifecycle behavior.

When those examples are used, distinguish product UX examples from provider/API
examples. For example, Google Places pagination behavior is provider grounding;
Yelp's search result limit/offset contract is provider grounding; an Airbnb
map/list interaction article would be product UX grounding.

## Current-State Grounding Rules

Do not design from the user's symptom alone. Inspect all relevant current
surfaces. This inspection and reasoning is ANALYSIS, never internal research:

- product docs: vision, personas, journeys, feature specs, domain profile,
- prior decisions and WIs: `.svc/pipeline-decisions.jsonl`,
  `docs/specs/work-items/`, `docs/specs/decisions/`,
- code paths: backend function, frontend hook, cache/client config, UI render
  surface, native wrapper/config when mobile is involved,
- runtime behavior: screenshots, network calls, row counts, payload sizes,
  cold/warm load timing, image/media loading behavior, native app lifecycle
  behavior when applicable,
- product defaults: which items appear first, whether the default is global,
  personalized, favorites/relevant-first, or explicitly "show all", and how
  users can expand beyond the default set.

If a required measurement cannot be gathered, mark it as an unknown. Do not
silently replace missing measurement with intuition.

## Cost And Cache Rules

For any caching/performance/loading decision, the artifact must account for:

- cold load vs warm load,
- browser cache, React/data cache, native WebView/app cache, server cache,
  CDN/image/media cache, and provider cache,
- invalidation trigger and owner for each cache layer,
- paid-provider and metered-platform effects,
- memory growth and refetch behavior on mobile,
- whether the design reduces reads/payloads or merely hides them behind a cache.

The default target is equal-or-lower recurring cost. Higher cost requires an
explicit quality or revenue reason and a revisit trigger.

## Skill Routing

When this protocol is active:

- `route-workflow` records `solution_confidence_required: true` in the lane
  graph or decision workspace and sets `solution_confidence_mode` to
  `design_auto`, `post_design_human_gate`, or `intake_only`.
- When a delivery graph is compiled, `solution_confidence` is core graph state.
  In `post_design_human_gate`, `plan-changeset` must be blocked until explicit
  approval; graph validation rejects an unblocked planning task in that mode.
- `research` is invoked only when `researchDecision(question)` from
  `scripts/lib/research-decision.mjs` returns `external_research_required`.
  Bind `requesting_decision_id` and `requesting_task_id`, return updated
  question/evidence/confidence, reevaluate before unblocking, and reuse a
  matching existing task on resume. Completed status alone is not resolution.
  Do not fabricate a completed `research` skill receipt when only local
  analysis ran.
- `manage-finops` is required when provider/platform cost can change.
- `design-ux` is required when the user-facing interaction or surface density
  changes.
- `design-tech` must produce the confidence artifact or incorporate it before
  marking a design `BASELINED`.
- `explore-solutions` cannot be skipped merely because the baseline looks
  familiar; it must challenge the baseline when the user explicitly asked for
  confidence or when three or more solution paths exist.
- `plan-changeset` and implementation are blocked only until the confidence
  artifact selects a direction or records a deliberate "not enough evidence yet"
  stop. After that, the normal lane continues automatically unless
  `solution_confidence_mode=post_design_human_gate`.

In `design_auto`, downstream design, evaluation, planning, and implementation
tasks are actionable once their dependencies are satisfied.

In `post_design_human_gate`, downstream design/evaluation tasks are actionable,
but `plan-changeset`, implementation, deployment, and land/promotion tasks wait
for explicit user approval after the design checkpoint.

In `intake_only`, design/evaluation tasks are not actionable until the user
authorizes the decision pass.

## Communication Contract

The framework should not dump the whole analysis into chat. The final user
checkpoint should contain:

- the selected direction or "not ready yet",
- the approval standard: what concrete action set is being approved and where
  the action-by-action approval packet lives,
- the 3-5 reasons that matter most,
- the cost/cache impact in plain language,
- the main rejected alternatives,
- the confidence level and remaining unknowns,
- links to the full evidence artifacts.

Keep raw tables and source details in the artifact unless the user asks for
them inline.

In `post_design_human_gate`, do not ask for approval until the packet includes
what/why/how, positive and negative impact, impact if skipped, and proof gates
for every material action. If the packet is missing or vague, the correct next
step is to improve the design artifact, not to ask for approval.
