# Step 4: Write, Commit, and Route — detail

Moved verbatim from SKILL.md (progressive disclosure).

## Step 4: Write, Commit, and Route

### Write or reuse the brief

When P4 applies, save to the project's spec directory: `docs/specs/features/YYYY-MM-DD-<feature-name>-brief.md`
using the template. Include a `## Cross-Validation` section at the end with findings from Step 3.

Include new or changed brief content in the governed changeset. When P4 does not apply, cite existing canonical scope and cross-validation evidence; do not create or commit a duplicate brief.

### Route to the right downstream skill

Based on what the discovery learned, recommend the best next step:

| Signal | Recommendation |
|--------|---------------|
| **Ship decision: NO-SHIP** | **Stop pipeline** — present the evidence package. Offer pivot directions. Do not proceed to any design or implementation skill. |
| **Ship decision: DEFER** | **Shelve, don't stop-forever** — write brief with `Status: DEFERRED`, append to work-items INDEX with `blocked-by-<milestone>` severity tag, log decision with milestone, halt pipeline. Do not proceed to any design or implementation skill. Feature re-surfaces on milestone fire (via roadmap-evaluation or explicit re-invocation). |
| **Ship decision: PIVOT** | **Re-run with pivoted direction** — user picks an alternative, re-run business questions for the new direction, produce a new brief, re-score. |
| Standard product feature, clear scope, personas exist | **/brainstorming** (or **write-spec** in svc) — "The business case is solid. Let me invoke brainstorming with this brief as context for technical design." |
| Big strategic bet, uncertain market, startup-level risk | **/explore-solutions** — "This is a significant bet with uncertain direction. Let me invoke /explore-solutions to map the viable strategic options before committing to design." |
| Multiple viable architectures, unclear technical approach | **/explore-solutions** — "The what is clear but the how has multiple paradigms. Let me invoke /explore-solutions to map the technical options." |
| Small scope, obvious implementation, no design needed | **plan-changeset** then **execute-changeset** — Reuse the accepted scope and continue the authorized plan/review/execute chain; ask only if implementation itself has not been authorized. |
| Brief has gaps, persona doesn't exist yet | **Pause** — "Before design, I'd suggest: (1) /build-personas to create a persona for [user type], (2) then come back to route to brainstorming." |
| Feature has UI components, needs visual exploration | **/brainstorming** then **design-ux** — "This has significant UI work. Let me invoke brainstorming to explore visual directions, then route to design-ux for the full spec." |
| Concept fragmentation or pipeline break — not a new feature | **diagnose-bug** or **plan-changeset** — "This isn't a new feature. It's a broken pipeline / naming mess. Skip the brief, identify the fix scope, then plan the implementation directly." |
| Consumer journey exists but producer journey is missing | **/write-journeys** (Mode 2: Expand) — "The consumer flow is covered but no journey describes how the producer creates this data. Route to write-journeys to add the producer journey, then come back for any remaining gaps." |
| Feature touches multiple personas across roles | **/write-journeys** then back here — "This crosses role boundaries. Run write-journeys to map the full lifecycle across personas first — it'll surface which side is missing. Then come back to brief the gap." |

### Auto-Invoke On-Demand Skills

Based on signals detected during validation, conditionally insert these skills into the task graph before routing downstream:

| Signal | Skill | Insertion Point | Why |
|--------|-------|-----------------|-----|
| Q7 (ROI/Cost) involves external APIs, hosting, or infrastructure and builder profile shows budget sensitivity | `manage-finops` | After Q7 if answer is uncertain | Cost model must be grounded before tech design |
| Feature mentions pricing tiers, subscriptions, freemium, or paywall boundaries | `monetization-architecture` | After SHIP decision, before write-spec | Tier gating matrix must exist before implementation planning |
| Ship Brief = NO-SHIP and builder needs revenue-generating alternatives | `find-opportunity` | Immediately after NO-SHIP | Produces ranked alternatives table before re-routing |
| Timeline > 2 weeks + no proven revenue model + builder profile shows limited capital/runway | `stage-revenue` | After DEFER or SHIP with high capital risk | Produces Stage 1/2/3 revenue plan before big-vision execution |
| SHIP decision made and competitive differentiators or product-market fit angles discovered | `analyze-marketing` | After SHIP decision, before write-spec | Marketing context must exist before design-phase product positioning |
| `researchDecision(question)` returns `external_research_required` | `research` | Inline before the requesting question; reuse matching decision ID; keep requester blocked while unresolved | Predicate-required external evidence; missing score stays analysis |

If any on-demand skill is inserted, update `.svc/lane-tasks-<WI>.json` with the new task and set `blocked_by` so downstream work waits for the on-demand skill's output. Log the insertion as a `mechanical` decision in `.svc/pipeline-decisions.jsonl`.

#### Builder-Aware Routing

When a builder profile exists, adjust recommendations based on the user's situation:

| Builder situation | Routing adjustment |
|---|---|
| No capital, first project | If NO-SHIP → pivot toward validated businesses the user can undercut cheaply. Recommend scrappy MVPs with free tiers. |
| Limited time (< 10 hrs/week) | Scope MVP more aggressively. Recommend plan-changeset with smaller task graph. |
| Has marketer/co-founder | Route to validate-feature with emphasis on distribution channel, not just product. |
| No business entity | Ensure MVP doesn't require payment processing that needs a company. Recommend Gumroad/LemonSqueezy/Dodo until revenue justifies entity setup. |
| Has existing audience | Weight Q1 (demand) evidence higher — they can pre-validate by asking their audience. |
| Has existing codebase/tools | Check if the feature can be built as an extension of what they already have. |

Present the recommendation with reasoning. Let the user override.

### Handoff context

When invoking the downstream skill, pass:
- The brief path: `docs/specs/features/YYYY-MM-DD-<name>-brief.md`
- The cross-validation findings (persona links, journey overlaps, spec conflicts)
- Any technical details the user mentioned that were parked during business questions

---
