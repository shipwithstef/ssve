# Design Alternatives Protocol

Every key design decision in the pipeline gets 5 ranked alternatives with
justification and trade-offs. This applies to all design skills:
`write-spec`, `design-ux`, `design-ui`, `design-tech`.

## Session Mode

At the start of a pipeline run, the user selects one mode:

| Mode | Flag | Behavior |
|------|------|----------|
| **Interactive** | `--interactive` | Present 5 alternatives per decision, user picks |
| **Auto** | `--auto` (default) | AI evaluates 5 alternatives, picks #1, documents all |

Both modes generate the same 5 alternatives with the same depth. The only
difference is who makes the final pick.

The mode is set once (by `route-workflow` or the first skill invoked) and
propagates through the chain via the `--interactive` or `--auto` flag.

## What Counts as a "Key Decision"

Not every line in a design needs 5 alternatives. Key decisions are:

| Skill | Key decisions |
|-------|---------------|
| `write-spec` | Feature scope (what's in/out), story granularity, AC approach |
| `design-ux` | Navigation model, interaction pattern, information hierarchy |
| `design-ui` | Component strategy, layout system, responsive approach |
| `design-tech` | Architecture, data model, API pattern, state management |

Rule of thumb: if the decision is hard to reverse once implemented, it gets alternatives.

## The 5 Alternatives Format

For each key decision:

```markdown
### Decision: <what needs deciding>

**Context:** <why this matters, what constraints exist>

| Rank | Option | Why recommended | Trade-offs |
|------|--------|-----------------|------------|
| 1 ⭐ | <option> | <justification — why this is best for THIS project> | <what you give up> |
| 2 | <option> | <why this is still good — when you'd pick it instead> | <what you give up> |
| 3 | <option> | <different bet — what it optimizes for> | <what you give up> |
| 4 | <option> | <viable but niche — when this shines> | <what you give up> |
| 5 | <option> | <unconventional — why it's still worth considering> | <what you give up> |

**Chosen:** <#N> — <brief reason>
```

Requirements:
- Options must be genuinely different approaches (not variations of the same thing)
- Each "Why recommended" explains when THIS option is the best choice
- Trade-offs are honest — every option gives up something
- Rank #1 is the recommendation, not the default — justify it against the project's specific context (vision, personas, ACs, constraints)

## Interactive Mode Flow

```
1. Present the decision context
2. Show the 5 alternatives table
3. Ask: "Which option? (1-5, or describe a different approach)"
4. User picks → record the choice and reasoning
5. Proceed to next decision
```

If user picks something not in the list, evaluate it against the 5 and either
add it as the choice or explain why an existing option is better.

## Auto Mode Flow

```
1. Generate 5 alternatives
2. Pick #1 (or override if project context strongly favors another)
3. Document: the full table + "Chosen: #N because <reason>"
4. Proceed immediately
```

Auto mode is not "skip the thinking." It still evaluates all 5 and documents
the reasoning. The decision log is the same in both modes.

## Decision Log

All decisions are logged to `docs/specs/decisions/<feature-name>.md`:

```markdown
# Design Decisions: <feature name>

## Session Mode: interactive | auto

## D-1: <decision title>
**Phase:** write-spec | design-ux | design-ui | design-tech
**Decided:** <option chosen>
**By:** user (interactive) | AI (auto)

| Rank | Option | Why | Trade-offs |
|------|--------|-----|------------|
| ... | ... | ... | ... |

## D-2: <decision title>
...
```

This log is consumed by:
- `explore-solutions` — to understand what was already decided and why
- `plan-changeset` — to trace decisions to implementation tasks
- `review-gate` — to verify implementation matches decisions
- `audit-implementation` — to check decisions against actual code behavior

## How to Embed in a Skill

Add this section to the skill's process (after reading inputs, before producing output):

```markdown
### Design Alternatives

For each key decision in this phase, follow the Design Alternatives Protocol
(see `references/design-alternatives.md`):

1. Identify key decisions (hard-to-reverse choices in this phase)
2. Generate 5 ranked alternatives with justification and trade-offs
3. If `--interactive`: present to user, wait for selection
4. If `--auto`: pick #1 (or best fit), document reasoning
5. Log to `docs/specs/decisions/<feature-name>.md`
```
