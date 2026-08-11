# write-spec — G0 Scope Review (full protocol)

## G0: Scope Review (after spec is drafted)

Before moving to UX design, challenge the spec scope. P0 runs a CEO-mode review:

**Choose a scope mode:**

| Mode | When | What P0 does |
|------|------|-------------|
| **Expand** | Vision is ambitious, market signals are strong | Push scope up — what's the 10-star version? |
| **Selective Expand** | Good baseline, a few additions would make it great | Hold scope + cherry-pick 1-2 expansions |
| **Hold** | Spec is right-sized for the constraints | Bulletproof the spec as-is, find gaps |
| **Reduce** | Too much for the timeline/team/budget | Surgeon mode — strip to narrowest viable wedge |

In auto mode, P0 picks the mode based on research (market validation, competitor
landscape, team constraints). In interactive mode, presents the modes with
P0's recommendation and asks.

**G0 checks:**
- Is there real demand for this? (P0 searches for validation)
- Is this the narrowest wedge that tests the hypothesis?
- Are there free/existing tools that solve part of this?
- Does the scope match the constraints (timeline, team, budget)?

If G0 changes the scope, update the spec before proceeding.

### The 9 Prime Directives

Every scope review must pressure-test the spec against these directives. They are not aspirational — they are pass/fail gates. A spec that violates any directive is incomplete.

| # | Directive | What P0 checks |
|---|-----------|----------------|
| 1 | **Zero silent failures** | Every failure mode in the spec must be visible — to the user, to the operator, or to monitoring. If a story has a happy path, it must also have a failure path. If an AC says "data is saved," there must be a companion AC for "save fails → user sees error + data is not silently lost." No invisible breakage. |
| 2 | **Every error has a name** | The spec must never say "handle errors" generically. Name the specific failure: `TimeoutError`, `DuplicateEntryConflict`, `UpstreamServiceUnavailable`. If you cannot name the error, you do not understand the failure mode, and the implementing agent will guess wrong. |
| 3 | **Data flows have shadow paths** | Every data flow in the spec implies four paths: happy path, nil/null input, empty input (valid but vacuous), and upstream error (dependency returned garbage). If the spec only describes the happy path, it is 25% complete. P0 must ask: "What happens when this field is nil? Empty string? When the service it depends on is down?" |
| 4 | **Interactions have edge cases** | For user-facing features: double-click, navigate-away mid-action, slow connection (3G), stale state (user left tab open for 2 hours), concurrent edits. For system features: duplicate events, out-of-order delivery, partial failures. The spec must acknowledge these — even if the AC is "system degrades gracefully." |
| 5 | **Observability is scope, not afterthought** | Dashboards, alerts, and structured logging are first-class deliverables, not "nice to haves." If the feature ships without observability, the first production incident will be diagnosed by reading raw logs. P0 asks: "How will we know this is broken at 3am without a user telling us?" If the answer is "we won't," add an AC. |
| 6 | **Diagrams are mandatory** | Every non-trivial flow gets an ASCII diagram in the spec. Data flows, state machines, sequence interactions. If you cannot draw it, you do not understand it. The diagram is the spec's structural proof — it exposes missing transitions, impossible states, and unhandled branches that prose hides. |
| 7 | **Everything deferred must be written down** | If scope review decides "not now," it goes in TODOS.md with the reason and the trigger condition for revisiting. Verbal deferrals do not exist. If it is not written down, it was not deferred — it was forgotten. |
| 8 | **Optimize for the 6-month future** | If this spec solves today's problem but creates next quarter's nightmare (data model that cannot extend, coupling that prevents team parallelism, abstraction that leaks), say so now. The spec must include a "Known Constraints" note for any architectural choice that trades future flexibility for present speed. |
| 9 | **Permission to say "scrap it and do this instead"** | If during scope review P0 discovers a fundamentally better approach — different framing, different decomposition, different scope entirely — table it. Do not polish a suboptimal spec. Present the alternative with reasoning. The sunk cost of the current draft is zero. |

### Cognitive Patterns

These are the mental models P0 uses when making scope decisions. They are not rules — they are lenses applied in combination.

**Classification instinct — reversibility x magnitude.** Every scope decision is categorized using the Bezos one-way/two-way door framework. Two-way doors (reversible, low magnitude): decide fast, move on. One-way doors (irreversible, high magnitude): slow down, get it right. Most decisions are two-way doors disguised as one-way doors by organizational fear.

```
                    Low Magnitude    High Magnitude
                   ┌────────────────┬────────────────┐
  Reversible       │  Just do it    │  Do it, watch  │
  (two-way door)   │  (no review)   │  (monitor)     │
                   ├────────────────┼────────────────┤
  Irreversible     │  Do it, note   │  SLOW DOWN     │
  (one-way door)   │  the trade-off │  (full review) │
                   └────────────────┴────────────────┘
```

**Inversion reflex.** For every "how do we make this succeed?" also ask "what would make this fail?" Inversion reveals risks that forward-only thinking misses. In scope review, this means: after listing what the feature must do, list what would make it useless, dangerous, or abandoned. Those failure conditions become defensive ACs.

**Focus as subtraction.** The primary value of scope review is deciding what NOT to do. Steve Jobs returned to Apple and cut 350 products to 10. The scope review's job is the same — the spec is too big until proven otherwise. Every story that survives review must justify its existence against the cut list.

**Speed calibration.** Fast is the default. Only slow down for irreversible + high-magnitude decisions (upper-right quadrant above). If P0 is deliberating for more than 30 seconds on a two-way door, the deliberation itself is the waste. Make the call, document the reasoning, move.

**Proxy skepticism.** Are the metrics in the spec still serving users, or have they become self-referential? A spec that optimizes "time on page" may be optimizing for confusion, not engagement. P0 asks: "If we hit every AC perfectly, does the user's life actually get better?" If the answer requires a chain of three or more assumptions, the metrics are proxies for proxies.

### Completeness Is Cheap

> AI coding compresses implementation time 10-100x. When evaluating "approach A (full, ~150 LOC) vs approach B (90%, ~80 LOC)" — always prefer A. The 70-line delta costs seconds. "Ship the shortcut" is legacy thinking.

This principle governs every scope trade-off in the AI-assisted era. The old calculus — "is the extra coverage worth the engineering time?" — assumed that coverage had a linear cost in human-hours. It does not anymore. The cost of completeness collapsed. The cost of incompleteness (production incidents, edge case bugs, "we'll handle that later" debt) did not.

**In practice during G0 scope review:**
- When debating whether to add error-path ACs: add them. Cost is ~0. Risk of omission is real.
- When debating whether to spec the edge case: spec it. The implementing agent handles 150 LOC as easily as 80.
- When debating "MVP vs complete": redefine MVP as "complete for the narrowest scope." Do not conflate narrow scope (good — focus) with incomplete implementation (bad — debt).
- The only valid reason to defer is "we do not yet understand the requirement well enough to spec it correctly" — not "it would take too long to build."

### Decision Logging (G0 Scope Review)

After G0 scope review completes, log the scope decision and any deferred items. The `run_id` comes from the active task graph.

```bash
# G0 scope mode decision (gate-result)
node scripts/pipeline-log.mjs append \
  --path .svc/pipeline-decisions.jsonl \
  --run-id "<WI-ID>" \
  --skill write-spec \
  --phase "<task-id>" \
  --type gate-result \
  --decision "G0 scope: <Expand|Selective Expand|Hold|Reduce>. Stories: <N>, ACs: <N>. Deferred: <N> items to TODOS.md" \
  --reasoning "<why this mode — e.g., 'all 9 directives satisfied, no gaps found' or 'directive 3 flagged missing error paths, expanding'>" \
  --decided-by "<P0|user>" \
  --overrideable true
```

If any ACs are deferred during scope review, log each as a separate `taste` entry with the deferral reasoning.

