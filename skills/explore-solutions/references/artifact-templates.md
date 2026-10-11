# Explore-Solutions Artifact Templates

The SKILL.md phases name what each artifact must establish; these are the
document shapes. All artifacts live in `docs/specs/explorations/<feature-name>/`.
Fill every section — an empty section means that phase's work was not done.

## Output: PROBLEM_BRIEF.md (Phase 1)

```markdown
# Problem Brief: <feature name>

## Problem statement
<restate from spec — what capability is needed, for whom, under what constraints>

## Upstream context
- Vision principles: <relevant ones>
- Persona constraints: <devices, expertise, connectivity>
- Key ACs: <the ones that most constrain the technical approach>
- Journey complexity: <number of flows, error states, concurrent paths>

## Success criteria (derived from ACs)
### Must
<each AC that constrains the approach>
### Should
<quality attributes from design/persona/vision>
### Nice
<differentiators, nice-to-haves>

## Baseline approach (from tech design)
<summary of what design-tech chose and why>

## Assumptions to challenge
1. <assumption from tech design> — why was this chosen?
2. ...

## Constraints
<hard limits: existing stack, team, timeline, budget>
```

### AC-to-criterion mapping (1b)

| Source | Becomes |
|--------|---------|
| AC with response time requirement | MUST: performance criterion |
| AC referencing offline/zero-state | MUST: offline/resilience criterion |
| Journey with concurrent users | MUST: scale criterion |
| UI design with animation | SHOULD: interaction smoothness |
| Persona pain point | SHOULD: addresses specific pain |
| Vision principle | NICE: aligns with product direction |

### Upstream context to load (1a)

- Vision — what product principles constrain this decision?
- Personas — whose needs does this serve? What are their technical constraints (device, connectivity, expertise)?
- Feature spec — what ACs define "done"? What's the consumer type (human/service/external)?
- Journeys — what user flows exercise this feature? What error states matter?
- UX/UI design — what interaction patterns were chosen? What performance expectations?
- Domain profile — what domain conventions exist? What do competitors use?
- The existing tech design (BASELINED) — this is Approach A, the baseline

### Assumptions to surface (1c)

Why this database, this API pattern, this component structure? What scale and
deployment target are assumed? Each assumption is a dimension the exploration
can challenge.

## Output: SOLUTION_MAP.md (Phase 2)

```markdown
# Solution Map: <feature name>

## Paradigm A: <name> (BASELINE — from tech design)
**Core bet:** <what this paradigm assumes matters most>
### Approach A1: <current tech design>
- **How it works:** <from the BASELINED tech design>
- **Gains:** <why design-tech chose this>
- **Gives up:** <what was traded away>
- **Complexity:** <relative to codebase>

## Paradigm B: <name>
**Core bet:** <different bet>
### Approach B1: <name>
...

## Paradigm C: <name>
**Core bet:** <different bet>
### Approach C1: <name>
...

## Non-obvious options
<creative, unconventional, or hybrid approaches>

## Eliminated early
<approaches considered but dismissed, with reasoning>
```

### Frame-shifts when stuck finding paradigms

- What if the constraint was opposite? (high scale → low scale, real-time → batch)
- How do competitors in the domain-profile solve this?
- What existed before the currently popular approach?
- What would make the hardest AC trivially easy?
- What's the laziest solution that still meets every MUST?

### Hunting for the non-obvious

- Can the problem be reframed to make it trivial?
- Is there a hybrid combining strengths of multiple paradigms?
- Is there a managed service that eliminates the problem?
- What would someone from a different domain do?

### EUREKA learning entry

When a paradigm is strictly better than an LLM-default baseline, log:

```json
{"skill": "solution-explorer", "type": "pattern", "key": "eureka-<topic>", "insight": "LLM default was <X> but <Y> is better because <evidence>. The default pattern-match failed because <why>.", "confidence": 8, "source": "observed", "saves_minutes": 60}
```

These are the highest-value entries in the learning system — cases where
training-data defaults were wrong for this specific context.

## Output: ANALYSIS.md (Phase 3)

```markdown
# Analysis: <feature name>

## Tradeoff Matrix

| Criterion (source) | Approach A1 | Approach B1 | Approach C1 |
|---------------------|------------|------------|------------|
| MUST: AC-01 ... | ✅ detail | ✅ detail | ❌ why |
| MUST: AC-02 ... | ✅ | ⚠️ risk | ✅ |
| SHOULD: ... | detail | detail | detail |

## Eliminated
- <Approach X>: fails MUST AC-<N> because <evidence>

## Finalists
1. **A1** (baseline) — from Paradigm A. Because...
2. **B1** — from Paradigm B. Because...

## Key differentiator
<what prototyping needs to answer>

## Runner-up value
If only 2 strong finalists exist, the runner-up is still documented
with full reasoning. A confirmed baseline with a documented "why not
the alternative" is a valid and valuable outcome.
```

## Output: COMPARISON.md (Phase 4)

Comparison criteria defined before any prototype code, the prototypes under
`prototypes/`, and the measured numbers per finalist against the key
differentiator.

## Output: DECISION.md (Phase 5)

```markdown
# Decision: <feature name>

## Selected approach
**<name>** — <one-line description>

## Confidence
<integer 1..10 or null; high means prototyped + analyzed from current cited evidence. External research is not required for a high score and is included only if `researchDecision` required it and it ran. Confidence is not evidence by itself.>

## Evidence chain
- Problem framing: PROBLEM_BRIEF.md
- Alternatives explored: SOLUTION_MAP.md (N paradigms, M approaches)
- Analysis: ANALYSIS.md (tradeoff matrix against ACs)
- Prototyping: COMPARISON.md (if done)

## Why this approach
<reference specific ACs it satisfies better than alternatives>

## Why not the alternatives
- **<Alt B>**: <specific AC or criterion it fails/underperforms, with evidence>
- **<Alt C>**: <specific reason>

## Runner-up
**<name>** — would be the choice if <condition changes>.
Preserved as a documented fallback.

## Impact on tech design
- [ ] No changes needed (baseline confirmed)
- [ ] Tech design revised — see updated Implementation Notes in feature spec
```
