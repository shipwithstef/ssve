# J03: Start Discussion From A Zero-State Prompt

**Journey ID:** J-003
**Persona:** S3 — Direct Invoker (spec-extracted system persona)
**Covers:** feature-discussion-phase
**Priority:** High

## Why This Journey Matters

The capability must still work when a maintainer starts from a prompt, a work
item, or a framework gap without an existing target spec. This is the bootstrap
path that turns vague-but-bounded uncertainty into a usable discussion record.

Without this path, the phase only works when the rest of the pipeline is already
well-formed, which defeats much of its value.

## User Motivation

The direct invoker knows there is a gray area worth discussing but does not yet
have a full target spec. They want the framework to derive a bounded topic,
capture the open questions, and recommend the right next move.

## Behavior Specification

# Feature: Discussion phase bootstraps itself from a zero-state topic

  A maintainer can invoke the capability directly from a prompt or a known
  framework gap, and the framework should still produce a valid discussion
  record instead of failing because the later artifacts do not exist yet.

  # Background:
  - Given there is no existing target spec for the current topic
  - And the topic is still specific enough to describe in one sentence

  `@DISC-01` `@DISC-ZERO` `@DISC-14` `@DISC-15` `@DISC-25` `@DISC-26`
  # Scenario: [SPEC] Derive a bounded topic and produce a valid discussion record
  - Given a maintainer names a framework gap or unresolved topic directly
  - When the discussion phase starts without a prior target spec
  - Then it derives a bounded topic from the prompt or work item
  - And it still creates a valid discussion record for that topic
  - And the record includes the before-and-after ambiguity summary, the counts of open and blocking items, and the recommended next skill

  `@DISC-07` `@DISC-11`
  # Scenario: [SPEC] Use available evidence even when the artifact set is thin
  - Given only a prompt, a work item, or framework memory exists
  - When the phase researches the open questions
  - Then it still grounds recommendations in the strongest available evidence
  - And it makes clear which parts are supported by evidence and which parts remain assumptions

## Alternative Paths

- **Topic too vague:** if the prompt cannot be turned into a bounded topic, the phase should refuse to continue and ask for a narrower framing.
- **Immediate reroute:** if the prompt is obviously a bug report or a raw feature idea, the phase should recommend the correct entry skill instead of manufacturing a discussion record around the wrong problem.

## E2E Coverage

- None yet. There is no automated proof that zero-state invocation creates a valid discussion artifact from a prompt alone.

## Coverage Gaps

- [ ] `@DISC-ZERO` (`feature-discussion-phase`) — no proof yet that the capability can bootstrap itself cleanly without an existing spec.
- [ ] `@DISC-25` (`feature-discussion-phase`) — no proof yet that the bootstrap record always emits the expected frontmatter fields.

## Journey Analysis

### Logical Issues

| ID | Type | Where | Finding | Impact |
|----|------|-------|---------|--------|
| F1 | Boundary ambiguity | Prompt → bounded topic | The draft requires the topic to be specific enough, but does not yet define the minimum shape of an acceptable prompt | Risk of inconsistent bootstrap behavior |

### Ungrounded Preconditions

| Precondition | Producer role | Producer journey | UI exists? | Validation intact? | Impact |
|-------------|--------------|------------------|:---:|:---:|--------|
| "framework memory or work item provides enough context to bound the topic" | Upstream routing / work-item authoring | Partial | Yes | Partial | Zero-state runs may vary in quality based on how much context upstream artifacts already provide |

### Missing Transitions

| From | To | What's undefined |
|------|----|-----------------|
| Zero-state discussion record | First downstream phase | The spec does not yet define whether bootstrap discussions should default to write-spec, validate-feature, or another phase when multiple options look plausible |

### Product Gaps

| Gap | Where | What the framework expects | Why it matters |
|-----|-------|----------------------------|----------------|
| G1 | Prompt acceptance | A clear bootstrap prompt contract | Without it, direct invocation quality will be too host- and operator-dependent |

### Recommended Routes For Findings

- F1, G1 → `design-tech`

