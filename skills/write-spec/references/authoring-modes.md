# write-spec — Authoring modes, feature types, philosophy

## Authoring Modes

Choose one mode before writing:

| Mode | Use when | Output style |
|------|----------|--------------|
| `new-feature` | Net-new greenfield capability | Full DRAFT feature spec |
| `extend-feature` | Brownfield feature extension | Delta-first spec that preserves existing truth |
| `bugfix-behavior` | Intended behavior needs to be clarified for a correction | Minimal behavior contract for the broken path |
| `contract-change` | External/system contract changes without a large new feature | Focused contract and dependency updates |

Default:
- `bootstrap` repos -> `new-feature`
- `convert` repos -> prefer `extend-feature` unless the issue is clearly bug or contract driven

## What Traditional Software Development Gets Wrong

Traditional practice separates "real features" from "infrastructure work." User-facing features get specs, user stories, and acceptance criteria. Backend enablers get Jira tickets with a one-line description. This creates two classes of work — one rigorous, one not — and the unspecified plumbing is where production breaks.

In the vibe code era, AI agents implement both. An agent doesn't care if the consumer is a human clicking a button or a service calling an API — it needs the same structured input: who consumes this, what do they need, how do we verify it works. The spec format is the agent's input contract.

**Serious Vibe Coding principle:** Everything that ships gets a feature spec. The spec format is the same. The consumer type changes — not the rigor.

## Feature Types

Every feature spec carries a `Type` tag that identifies its consumer:

| Type | Consumer | Story format | Journey type | Example |
|------|----------|-------------|--------------|---------|
| `Feature` | Human user (persona) | "As P1, I want..." | User journey with UI steps | Match discovery, chat, payments |
| `Enabler` | Other service/feature | "As [service], I need..." | System journey with service interactions | Score recalculation cron, event pipeline, email service |
| `Integration` | External system boundary | "When [external event], the system must..." | Contract journey with request/response | Stripe webhooks, OAuth provider, third-party API |

### Provider-Backed And Generated ACs

If an AC names or implies a primary provider, generated content, or saved
generated output, write separate acceptance criteria for primary-provider
success, allowed degraded fallback, forbidden fallback, and saved outcome.

| AC class | Required wording |
|---|---|
| Primary-provider success | The named provider/source produced the result and source evidence is recorded. |
| Allowed degraded fallback | The fallback is explicitly approved and labeled degraded/equivalent. |
| Forbidden fallback | Mock, placeholder, uploaded substitute, or draft-only output does not satisfy PASS. |
| Saved outcome | The generated result remains visible after save, return, reload, or the equivalent persisted display path. |

Add `provider_fidelity` to evidence expectations and point closeout to
`docs/specs/features/test-evidence/<run>/PROVIDER_FIDELITY_EVIDENCE.md`.

**The type determines the persona, not the process.** All types go through the same pipeline: write-spec → design-ux → design-ui → design-tech → plan-changeset → execute-changeset → land-changeset → verify-promotion.

### How Types Relate

Features depend on Enablers. Enablers depend on other Enablers. Integrations connect to the outside world. A monetizable user flow typically spans all three:

```
[Integration: Stripe webhook] 
    → [Enabler: payment processing service]
        → [Enabler: subscription state manager]
            → [Feature: user sees premium content]
```

Each node is its own feature spec. The dependency chain is traced through System Dependencies tables and journey preconditions. Layer 3 analysis validates that every link in the chain exists.

## Consumer-First Stories

Traditional user stories assume a human. Serious Vibe Coding generalizes the pattern:

**Feature (human consumer):**
```markdown
**As** P1 (Solo Builder),
**I want** to filter matches by timezone,
**So that** I find co-builders available during my working hours.
```

**Enabler (system consumer):**
```markdown
**As** the match-discovery-service,
**I need** recalculated scores reflecting preference changes from the last 24h,
**So that** users see current recommendations when they open the matches tab.
```

**Integration (external system boundary):**
```markdown
**When** Stripe sends a `checkout.session.completed` webhook,
**The system must** activate the user's subscription within 30 seconds,
**So that** the user can access premium features immediately after payment.
```

The format adapts to the consumer. The AC table format stays identical.

## Journeys Are Wrappers

A user journey includes system behavior as implicit steps. The user clicks a button — behind the scenes, 5 services coordinate. The journey documents all of it:

```gherkin
Scenario: User signs up and gets first matches

  When user submits signup form
  Then account is created                            ← system step
  And welcome email is queued                        ← system step (enabler dependency)
  And "user.created" event fires                     ← system step (enabler dependency)
  And user sees confirmation screen                  ← user step

  When matching preferences are saved
  Then score calculation triggers                    ← system step (enabler dependency)
  And user sees "Finding matches..." state           ← user step

  When score calculation completes
  Then user sees top 5 matches                       ← user step
  And match notification sent to matched users       ← system step (enabler dependency)
```

Every system step (`←`) is a dependency on an Enabler or Integration. Layer 3 traces each one back to its feature spec. If the enabler spec doesn't exist, Layer 3 flags it as an **ungrounded precondition** — and write-spec creates the enabler spec.

**Standalone system journeys** only exist for enablers with no user trigger — cron jobs, scheduled pipelines, autonomous processes. These still get journey docs, but the "persona" is the scheduler or event source, and there are no UI steps.

## When To Use

- After brainstorming or validate-feature produces a direction/Ship Brief
- When a feature idea needs to be formalized before implementation
- When existing specs need new user stories or ACs added
- When Layer 3 flags an ungrounded precondition (create the enabler spec)
- Before invoking design-ux (requires a DRAFT or higher spec)

