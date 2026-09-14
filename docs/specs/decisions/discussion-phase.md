# Design Decisions: discussion-phase

**Date:** 2026-04-10
**Skill:** write-spec
**Mode:** auto (P0 picks)

---

## D1: Capability Shape

| # | Alternative | Justification | Trade-offs |
|---|------------|---------------|------------|
| 1 | **Standalone discussion phase / skill** (chosen) | Makes gray-area resolution explicit, routable, and auditable instead of being hidden inside other skills | Adds one more pipeline step and one more artifact |
| 2 | Expand `validate-feature` | Reuses an existing entry point and keeps early-phase work consolidated | `validate-feature` is about ship-worthiness and wedge selection, not preserving design decisions through downstream phases |
| 3 | Expand `write-spec` only | Keeps ambiguity handling close to spec authoring | Too late for routing; downstream phases still lack a reusable discussion artifact |
| 4 | Expand `design-tech` only | Captures hard technical decisions where they matter most | Misses scope, UX, and product gray areas that should be settled before technical design |
| 5 | Use `review-gate` as the discussion surface | Catches ambiguity before landing | Too late; review should enforce prior decisions, not become the place where they are first made |

**Decision:** #1. The gap is not just "ask better questions"; it is "give gray areas a first-class phase with an explicit output artifact and routing contract."

---

## D2: Trigger Policy

| # | Alternative | Justification | Trade-offs |
|---|------------|---------------|------------|
| 1 | **Conditional trigger based on unresolved, high-impact ambiguity** (chosen) | Keeps the phase focused on genuinely expensive ambiguity rather than forcing it into every feature | Requires a trigger contract and ambiguity signals |
| 2 | Always run after `validate-feature` | Simple to explain; no trigger logic | Adds cost and friction even when the feature is already clear |
| 3 | Only run on explicit user request | Minimal automation risk | The framework misses ambiguous cases unless the user already knows the phase exists |
| 4 | Only run for brownfield repos | Brownfield has more hidden constraints | Greenfield features also have gray areas around scope, UX, and external contracts |
| 5 | Only run when `review-gate` fails | Uses hard evidence | Much too late; ambiguity should be resolved before planning and execution |

**Decision:** #1. Route into discussion only when ambiguity is real: unresolved one-way-door decisions, explicit user uncertainty, contradictory upstream artifacts, or recurring downstream re-litigation.

---

## D3: Output Artifact

| # | Alternative | Justification | Trade-offs |
|---|------------|---------------|------------|
| 1 | **Dedicated discussion artifact + decision-log append** (chosen) | Gives downstream skills one stable file to read while still preserving major decisions in `pipeline-decisions.jsonl` | Another artifact to maintain |
| 2 | Chat summary only | Fastest to produce | Loses continuity across sessions and hosts |
| 3 | Only update the feature spec inline | Keeps everything in one file | Gray areas often exist before a spec is ready, and mixing unresolved discussion with settled requirements muddies the spec |
| 4 | JSON-only artifact | Easy for machines to parse | Poor fit for human review and nuanced rationale |
| 5 | Work-item note only | Useful for bugfixes and brownfield deltas | Too narrow; discussion phase is broader than a single work item |

**Decision:** #1. The capability should write `docs/specs/discussions/<topic>.md` and append material decisions to `.svc/pipeline-decisions.jsonl`.

---

## D4: Decision Resolution Model

| # | Alternative | Justification | Trade-offs |
|---|------------|---------------|------------|
| 1 | **Mixed model: auto defaults for reversible items, explicit block for irreversible items** (chosen) | Preserves velocity on cheap decisions while protecting one-way doors | Requires reversibility classification |
| 2 | User decides every gray area | Maximum explicitness | High friction; collapses autorun value |
| 3 | Auto decides everything | Maximum speed | Dangerous for hard-to-reverse architecture or product choices |
| 4 | Defer everything to later phases | Minimal early effort | Recreates the current problem: downstream phases keep reopening the same ambiguity |
| 5 | Batch all unresolved items into a single mega-review | Reduces interruptions | Decision quality drops when unrelated concerns are bundled together |

**Decision:** #1. The phase should move fast on two-way doors and stop hard on unresolved one-way doors.

---

## D5: Gray-Area Taxonomy

| # | Alternative | Justification | Trade-offs |
|---|------------|---------------|------------|
| 1 | **Controlled category set: scope, UX, contract/data, operations, sequencing/ownership** (chosen) | Broad enough to catch real ambiguity while small enough to stay routable and testable | Some edge cases will need best-fit categorization |
| 2 | Free-form categories per run | Maximum flexibility | Hard to route, compare, or test |
| 3 | GSD's exact categories (`visual`, `API`, `content`, `org`) | Strong precedent from the source inspiration | Too narrow for svc's pipeline, which also needs product-fit and ownership/delegation framing |
| 4 | Product-only categories | Keeps focus on user value | Misses technical and operational ambiguity that causes downstream churn |
| 5 | Technical-only categories | Easy to anchor in implementation | Misses UX and scope ambiguity that should be resolved before design and execution |

**Decision:** #1. Use a small controlled taxonomy tuned for svc's pipeline rather than copying GSD's labels wholesale.

---

## D6: Pipeline Placement

| # | Alternative | Justification | Trade-offs |
|---|------------|---------------|------------|
| 1 | **Optional interstitial phase between `validate-feature` and `write-spec`, with targeted re-entry from later skills** (chosen) | Solves the main gap early while still allowing later phases to reopen only truly unresolved one-way-door ambiguity | Requires explicit trigger and re-entry rules |
| 2 | Always before `validate-feature` | Captures uncertainty as early as possible | Too early; many topics are still raw ideas and belong in validation first |
| 3 | Always after `write-spec` | Keeps the spec as the only design artifact | Too late for routing and likely to re-litigate requirements already written |
| 4 | Only from `design-tech` | Fits hard technical choices | Misses product and UX gray areas that should be settled earlier |
| 5 | Free-floating utility with no canonical place | Maximum flexibility | Becomes guessy and easy to skip |

**Decision:** #1. Primary placement is after `validate-feature` and before `write-spec`; later re-entry is allowed only when a current phase encounters unresolved one-way-door ambiguity not already captured in a discussion artifact.

---

## D7: Trigger Scoring

| # | Alternative | Justification | Trade-offs |
|---|------------|---------------|------------|
| 1 | **Deterministic weighted score with a hard threshold** (chosen) | Easy to reason about, test, and keep consistent across hosts | Inevitably compresses nuanced judgment into a small rubric |
| 2 | Free-form operator judgment | Flexible | Too inconsistent to enforce or replay |
| 3 | Boolean trigger list only | Simple | Too coarse; cannot express cumulative medium-risk ambiguity |
| 4 | LLM-only qualitative judgment | Adapts to context | Hard to audit and replay |
| 5 | Full scoring engine with many dimensions | Expressive | Overbuilt for a single framework phase |

**Decision:** #1. Use a small weighted score with explicit signal categories and thresholds.

---

## D8: Artifact Schema

| # | Alternative | Justification | Trade-offs |
|---|------------|---------------|------------|
| 1 | **Markdown artifact with YAML frontmatter + fixed tables, validated by a small Node helper** (chosen) | Matches existing repo conventions while still giving route-workflow and review-gate machine-readable fields | Requires one helper script to prevent schema drift |
| 2 | Pure markdown with no machine-readable fields | Lowest implementation cost | Too weak for deterministic routing and enforcement |
| 3 | JSON artifact only | Strong machine contract | Poor human readability and bad fit with current spec/journey conventions |
| 4 | Dual markdown + JSON output | Best of both | Doubles maintenance and drift risk |
| 5 | Store everything only in `pipeline-decisions.jsonl` | Reuses an existing artifact | Decision log is append-only audit trail, not a topic-scoped discussion workspace |

**Decision:** #1. The discussion artifact is markdown-first, but frontmatter and register tables are validated by a helper so later phases can trust it.

---

## D9: Reroute Precedence

| # | Alternative | Justification | Trade-offs |
|---|------------|---------------|------------|
| 1 | **Broken behavior → validation gap → discussion → continue** (chosen) | Keeps correctness and business validation ahead of discussion refinement | Requires precise classification at phase entry |
| 2 | Validation gap always first | Business value is foundational | Can hide genuine regressions inside product discussion |
| 3 | Discussion always first | One place for all ambiguity | Turns discussion into a catch-all and delays the correct lane |
| 4 | User chooses precedence every time | Explicit | Too much friction for routine routing |
| 5 | No formal precedence | Flexible | Inconsistent routing across sessions and hosts |

**Decision:** #1. If a topic is a bug/regression, route to `diagnose-bug`. If it is primarily value/wedge uncertainty, route to `validate-feature`. Use discussion only for unresolved design ambiguity after those checks.

---

## D10: Downstream Enforcement

| # | Alternative | Justification | Trade-offs |
|---|------------|---------------|------------|
| 1 | **Pre-flight read requirement for downstream skills + `review-gate` contradiction check** (chosen) | Lightest enforcement that still makes settled decisions real constraints | Requires multiple existing skills to honor the artifact |
| 2 | Advisory only | Easiest to ship | Recreates the current problem: decisions get ignored |
| 3 | Hard runtime lockfile | Strong enforcement | Overbuilt and brittle for a docs-first framework |
| 4 | Only decision-log based enforcement | Reuses existing infra | Too diffuse; hard to tie one topic to one active discussion |
| 5 | New centralized workflow engine | Maximum control | Massive overbuild for this capability |

**Decision:** #1. Downstream skills must read the discussion artifact in pre-flight, and `review-gate` must fail contradictions unless the revision log explicitly supersedes the decision.
