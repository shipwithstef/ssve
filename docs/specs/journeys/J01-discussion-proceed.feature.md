# J01: Resolve Gray Areas And Proceed

**Journey ID:** J-001
**Persona:** S1 — Framework Orchestrator (spec-extracted system persona)
**Covers:** feature-discussion-phase
**Priority:** Critical

## Why This Journey Matters

This is the happy-path system journey for the new capability. It shows how the
framework recognizes real ambiguity, keeps the discussion bounded, researches
the open choices, records the outcome, and hands the work to the correct next
phase without losing the decisions it just made.

If this journey is weak, the framework still reopens the same gray areas later
in the pipeline and the capability becomes ceremony instead of leverage.

## User Motivation

The orchestrator is trying to keep the pipeline moving without guessing through
expensive uncertainty. It wants just enough discussion to settle the real
unknowns, then a clean handoff to the next skill.

## Behavior Specification

# Feature: Discussion phase turns ambiguity into a durable proceed path

  The framework detects when ambiguity is real, researches the unresolved
  choices, records the results, and recommends the next skill without forcing
  downstream phases to rediscover the same decisions.

  # Background:
  - Given a valid feature or framework topic already exists
  - And earlier artifacts already record the choices that are settled
  - And several expensive choices remain unresolved

  `@DISC-01` `@DISC-02` `@DISC-03` `@DISC-04` `@DISC-05`
  # Scenario: [SPEC] Detect a real gray-area cluster and keep it bounded
  - Given the framework is reviewing work with unresolved scope, UX, and sequencing questions
  - When it decides whether a dedicated discussion phase is needed
  - Then it opens a discussion only for the unresolved, high-impact items
  - And it ignores choices that are already settled elsewhere
  - And it labels each open item with a single discussion category
  - And it keeps the active discussion small enough to stay focused

  `@DISC-07` `@DISC-08` `@DISC-10` `@DISC-11` `@DISC-13`
  # Scenario: [SPEC] Research hard choices before recommending defaults
  - Given the work touches existing repo behavior and earlier framework contracts
  - When the discussion phase investigates the open choices
  - Then it studies the relevant current behavior before proposing changes
  - And it classifies each choice by reversibility and magnitude
  - And it compares the strongest alternatives with explicit trade-offs
  - And it records the recommended default, confidence, and the evidence that would change that recommendation

  `@DISC-09` `@DISC-12`
  # Scenario: [SPEC] Ask focused questions for reversible choices
  - Given one open choice is cheap to reverse later
  - When the builder runs the phase interactively
  - Then the framework asks one focused question about that choice instead of a broad questionnaire
  - And it offers a default path that the builder can override immediately

  `@DISC-14` `@DISC-15` `@DISC-16` `@DISC-19` `@DISC-20` `@DISC-21` `@DISC-25` `@DISC-26`
  # Scenario: [SPEC] Save the discussion record and hand work forward
  - Given the required choices have been explored and settled enough to continue
  - When the phase finishes
  - Then it saves a structured discussion record for the topic
  - And each item is marked as open, decided, deferred, or blocked
  - And each decided item points to the downstream phase it constrains
  - And material decisions are added to the shared decision trail
  - And the summary tells the framework whether to proceed and which skill comes next

## Alternative Paths

- **Already settled:** if every expensive choice was already decided upstream, the phase should not linger here and should return a "discussion not needed" result instead.
- **Interactive override:** if the builder rejects the proposed default for a reversible choice, the chosen override replaces it in the discussion record immediately.
- **Research shortfall:** if evidence is too weak for a hard-to-reverse decision, this journey should stop and transition into the blocking path rather than pretend the choice is settled.

## E2E Coverage

- None yet. This framework capability currently has no end-to-end automation covering CLI invocation, artifact generation, and downstream handoff.

## Coverage Gaps

- [ ] `@DISC-10` (`feature-discussion-phase`) — no proof yet that brownfield runs actually scout relevant files before recommending changes.
- [ ] `@DISC-19` (`feature-discussion-phase`) — no proof yet that material decisions are written to the shared decision trail in a parseable way.

## Journey Analysis

### Logical Issues

| ID | Type | Where | Finding | Impact |
|----|------|-------|---------|--------|
| F1 | Missing rule | Detection → research | The draft says the phase should open only for "real ambiguity" but does not yet define a scoring rule for what qualifies | Risk of over-triggering or under-triggering the phase |

### Ungrounded Preconditions

| Precondition | Producer role | Producer journey | UI exists? | Validation intact? | Impact |
|-------------|--------------|------------------|:---:|:---:|--------|
| "earlier artifacts already record the settled choices" | Upstream pipeline skills | Partial — existing specs and decision logs do this inconsistently today | Yes | Partial | The discussion phase may still have to restate choices that should already be inherited |

### Missing Transitions

| From | To | What's undefined |
|------|----|-----------------|
| Discussion complete | Next phase starts | The spec says the next skill is recommended, but not yet how the active lane consumes that recommendation automatically |

### Product Gaps

| Gap | Where | What the framework expects | Why it matters |
|-----|-------|----------------------------|----------------|
| G1 | Early detection | A durable ambiguity score or trigger contract | Without it, the phase may become subjective and noisy |

### Recommended Routes For Findings

- F1, G1 → `design-tech`
- Missing automatic handoff consumption → `design-tech`

