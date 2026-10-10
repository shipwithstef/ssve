# Phase 3: Generate Journeys (Iterative) — detail

Moved verbatim from SKILL.md (progressive disclosure).

### Journey document format

Journeys must be ABSOLUTE. Every step describes:
- What the user **sees** (specific screen, specific UI elements, specific labels)
- What the user **decides** and **why** (their motivation, their goal)
- What **happens** as a result (system response, screen transition, feedback)
- What could go **wrong** (error states, edge cases, alternative paths)

A good journey reads like a screenplay. A bad journey reads like a checklist.

**BAD scenario (too abstract):**
```
- When I click "Find Match"
- Then I see a loading state
- And I get a match
```

**GOOD scenario (absolute):**
```
- When I click the "Find Match" button (primary CTA, visible without scrolling)
- Then the button enters a spinner state for up to 5 seconds while instant matching runs
- And if a compatible partner is found, I see a "Match found!" celebration with their
  display name, avatar, and compatibility score (e.g., "87% match")
- But if no instant match is found, the button changes to "Searching..." (disabled)
  and a message reads "Looking for your match — we'll notify you when one is found"
- And I receive a push notification when matched (showing partner name + score)
```

Each journey doc follows this structure:

```markdown
# JXX: [Journey Title]

**Journey ID:** J-XXX
**Persona:** [Which persona this journey serves]
**Covers:** [comma-separated feature spec names]
**Priority:** Critical | High | Medium | Low

## Why This Journey Matters

[2-3 sentences from PM perspective. Why does this flow exist? What user
goal does it serve? What's the cost if this journey is broken?]

## User Motivation

[What brought this user here? What's their emotional state? What do they
want to accomplish? This grounds every "When" step in WHY the user acts.]

## Behavior Specification

# Feature: [Journey title as Gherkin Feature]

  [Journey description — the full narrative arc in 2-3 sentences]

  # Background:
  - Given [specific precondition with detail]

  `@AC-ID-1` `@AC-ID-2` `@AC-ID-3`
  # Scenario: [Descriptive name of this phase]
  - Given [specific context — what screen, what state, what the user sees]
  - When [specific user action — what they click/type, and WHY they do it]
  - Then [specific system response — what changes on screen, what feedback]
  - And [specific detail — labels, counts, visual indicators, timing]
  - But [alternative path — what happens if something differs]

  `@AC-ID-4` `@AC-ID-5`
  # Scenario: [Next phase — continues from where the previous ended]
  - Given [state carried from previous scenario]
  - When [next user action with motivation]
  - Then [specific outcome with UI detail]

## Alternative Paths

Describe what happens when the user takes a different path:
- **[Branch name]:** [What triggers it, what the user sees, where it leads]
- **[Error case]:** [What goes wrong, what feedback the user gets, recovery path]

## E2E Coverage

- `test-file.spec.ts` — [specific test name and what it verifies]

## Coverage Gaps

- [ ] AC `@ID` ([feature]) — [what's missing and why it matters]
```

### Writing good scenarios

**The PM test:** Every scenario must be readable by a PM who has never opened the
codebase. If the scenario mentions a file name, database column, CSS class, component
name, or API endpoint, it is WRONG. Rewrite it in user language.

**NO technical references in scenarios:**
- NO file names (`AuthModal.tsx`, `CollabPage`)
- NO database columns (`profiles.onboarding_completed`, `profile_completed_at`)
- NO CSS selectors (`[data-tour="profile"]`)
- NO implementation details (`Supabase Realtime`, `localStorage`)
- NO code paths (`/auth/callback`, `/collab/:matchId`)

**AC IDs are the ONLY technical element.** They appear as tags above scenarios for
traceability. Everything else is written from the user's perspective.

**BAD (technical):**
```
- Then `profiles.onboarding_completed` is set to true in the database
- And `localStorage.cvf_onboarding_skipped` is set to 'true'
- And the CollabPage at /collab/:matchId loads with the right sidebar
```

**GOOD (user language):**
```
- Then the platform remembers I completed the tour so I won't see it again
- And the tour is marked as skipped so it can be shown again later if I want
- And I see the collaboration workspace with my partner's profile on the right
```

Scenarios describe BEHAVIOR, not implementation:
- GOOD: "When I click Find Match" (what the user does)
- BAD: "When the matchmaking queue RPC is invoked" (implementation)

Keep scenarios at 3-7 steps. If longer, split into multiple scenarios
within the same journey.
