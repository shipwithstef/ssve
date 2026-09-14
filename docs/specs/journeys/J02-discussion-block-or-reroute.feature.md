# J02: Block Or Reroute When Discussion Cannot Safely Proceed

**Journey ID:** J-002
**Persona:** S2 — Framework Maintainer / Builder (spec-extracted system persona)
**Covers:** feature-discussion-phase
**Priority:** Critical

## Why This Journey Matters

The capability is only useful if it knows when NOT to continue normally. This
journey captures the cases where discussion should block on a one-way-door
decision or reroute the work because the real problem is validation or broken
behavior, not gray-area refinement.

If this path is wrong, the framework either pushes uncertain work downstream
too early or sends it to the wrong lane entirely.

## User Motivation

The maintainer wants the framework to be strict about risky ambiguity. If the
choice is too expensive to guess, they want a visible stop. If the topic really
belongs in another lane, they want a clean reroute instead of polite confusion.

## Behavior Specification

# Feature: Discussion phase knows when to stop, defer, or reroute

  The framework should not force every ambiguous topic through a normal proceed
  path. When the discussion reveals there is nothing to discuss, not enough
  evidence to decide, or the wrong entry point entirely, it must say so clearly.

  # Background:
  - Given the discussion phase is already evaluating a bounded set of gray areas
  - And the framework expects a clear proceed, block, or reroute outcome at the end

  `@DISC-06`
  # Scenario: [SPEC] Return "discussion not needed" when the choices are already settled
  - Given every high-impact choice is already resolved in earlier artifacts
  - When the phase reviews the topic
  - Then it says discussion is not needed
  - And it sends the work directly to the next normal phase

  `@DISC-17` `@DISC-18`
  # Scenario: [SPEC] Block on unresolved one-way-door choices
  - Given one open choice would be expensive to reverse and the evidence is still too weak
  - When the phase finishes evaluating that choice
  - Then it marks the item as blocked with an explicit owner and next decision
  - And any lower-risk leftovers are written to a tracked defer list with revisit triggers
  - And the summary says downstream work must not continue past this point

  `@DISC-22`
  # Scenario: [SPEC] Reroute back to validation when the issue is still product uncertainty
  - Given the open question is really about whether the feature is worth building or which wedge matters most
  - When the phase recognizes that the core uncertainty is demand or scope validation
  - Then it reroutes the topic back to feature validation
  - And it tells downstream design work not to continue yet

  `@DISC-23` `@DISC-24`
  # Scenario: [SPEC] Reroute broken-behavior topics and preserve settled decisions
  - Given the open disagreement is actually about known behavior being wrong or contradicting a settled decision
  - When the phase closes the topic
  - Then it reroutes broken-behavior issues to bug diagnosis instead of feature design
  - And later review can fail work that ignores a settled discussion decision unless the revision history explicitly replaces it

## Alternative Paths

- **Mixed outcome:** one item may block while others defer; the phase should still leave a complete record instead of pretending the whole topic is either open or closed.
- **Wrong entry point discovered late:** if the phase only realizes halfway through that the topic belongs in validation or bug diagnosis, it should still finish with a reroute summary rather than partial proceed advice.

## E2E Coverage

- None yet. No automation currently proves that block and reroute outcomes are emitted correctly.

## Coverage Gaps

- [ ] `@DISC-17` (`feature-discussion-phase`) — no proof yet that blocked one-way-door items stop downstream execution rather than becoming advisory notes.
- [ ] `@DISC-24` (`feature-discussion-phase`) — no proof yet that review consumes settled discussion decisions as enforceable constraints.

## Journey Analysis

### Logical Issues

| ID | Type | Where | Finding | Impact |
|----|------|-------|---------|--------|
| F1 | Routing ambiguity | Reroute branch | A topic can plausibly be both under-validated and partially broken; the spec does not yet define priority between validation reroute and bug reroute | Risk of inconsistent lane selection across runs |

### Ungrounded Preconditions

| Precondition | Producer role | Producer journey | UI exists? | Validation intact? | Impact |
|-------------|--------------|------------------|:---:|:---:|--------|
| "review later enforces settled discussion decisions" | Review pipeline | None yet — enforced only in the new spec | Partial | Partial | The block/reroute path can be documented before it is actually enforceable |

### Missing Transitions

| From | To | What's undefined |
|------|----|-----------------|
| Blocked discussion | Resume later | The spec says blocked items need an owner and next decision, but not yet how the framework resumes the same topic cleanly |

### Product Gaps

| Gap | Where | What the framework expects | Why it matters |
|-----|-------|----------------------------|----------------|
| G1 | Reroute precedence | A deterministic rule when multiple reroute reasons apply | Without it, maintainers may see different routing answers for the same topic |

### Recommended Routes For Findings

- F1, G1 → `design-tech`
- Resume semantics for blocked topics → `design-tech`

