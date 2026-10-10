## Mode 1: Build / Refresh Personas

### Phase 1: Deep Read

Read everything. Not summaries — the actual content.

```
1. docs/specs/vision.md (full)
2. docs/personas/*.md (all qualitative challenge files)
3. docs/specs/features/*.md (glob all feature specs — read the ones most relevant to the persona types you're targeting; read more if the persona touches them)
4. docs/specs/personas/PERSONA_INDEX.md (if exists — to understand what's already built)
```

Read `docs/specs/domain-profile.md` if it exists — extract industry context, user domain expertise expectations, and known pitfalls. Read `docs/specs/analyze-competitors.md` if it exists — extract who competitors serve, what pains they address, and what user segments they miss. Use these to ground personas in market reality, not just vision aspirations.

### Phase 2: Identify Persona Clusters

The qualitative challenge library (`docs/personas/`) contains rich narratives organized
by challenge type. These are the raw material, not the final personas.

Map challenge narratives to distinct persona archetypes. A persona is NOT a challenge —
it's a PERSON who experiences one or more challenges. One persona might carry 2-3 challenges
from different narrative docs.

**Example mapping:**
- "The Paranoid Idea Holder" (challenge) + "The Equity-Minded Builder" (challenge) =
  **"The Cautious First-Timer"** (persona) — someone whose primary anxiety is trust and
  fairness, who needs safety signals before they'll engage.

Present your proposed persona list to the user for confirmation. 3-7 personas is the
sweet spot — fewer than 3 means you're not capturing diversity, more than 7 means
you're splitting hairs.

### Phase 3: Build Each Persona

For each persona, reason through their COMPLETE context. Not just "what they want from
the product" but "what their life looks like in 2026 when they open this app."

Every persona file follows this structure:

```markdown
# P[N]: [Persona Name]

**Archetype:** [1 sentence — who they are]
**Derived from:** [which challenge narratives from docs/personas/ informed this]

---

## Who They Are

[2-3 paragraphs. Not a user story — a portrait. What's their day like? What have
they already tried? What's their relationship with AI tools? How much time do they
have? What's their skill level? What matters to them beyond just "finding a partner"?]

## Their 2026 World

What's true about the world this person lives in. These are starters — replace
with bullets grounded in what the vision doc and domain profile say about the
space this product operates in:
- **[Primary environmental shift]** — what's changed in their world that makes this product relevant now?
- **[Current workaround landscape]** — what do they use today? What specifically fails?
- **[Trust or safety context]** — have they been burned, or are they skeptical for other reasons?
- **[Time and resource reality]** — what's their actual availability and budget?
- **[Tool access]** — what do they already have? What tier/plan matters to them?

[Customize every bullet per persona. These are placeholders, not template values.]

## What They Came For

The specific outcome this person wants when they open ExampleProduct. Not features —
outcomes. What does "success" look like for them after 1 week? 1 month? 3 months?

| Timeframe | Success looks like | Failure looks like |
|-----------|-------------------|-------------------|
| First session (5 min) | [specific] | [specific] |
| First week | [specific] | [specific] |
| First month | [specific] | [specific] |
| 3 months | [specific] | [specific] |

## Lifecycle Progression

Trace this persona through MULTIPLE instances of using the product. Each instance
shows progression: trust tier advancement, expanding feature usage, evolving
relationship with the platform. This is the most important section for write-journeys
and E2E test planning — it shows WHERE this persona goes and WHERE they stop.

### Instance 1: [First interaction] (Newcomer, trust 0-29)
[Step-by-step flow: which features, which mode, which decisions.
What's different about THIS persona at this stage vs others?]

### Instance 2: [Second project / return visit] (Established, trust 30-59)
[How they behave differently now that they know the platform.
What new features do they exercise? What changes in their approach?]

### Instance 3: [Platform veteran] (Trusted/Elite, trust 60+)
[Full ecosystem engagement. Leading, mentoring, creating.
What does this persona's mature relationship with the platform look like?]

### Where this persona CAN'T reach alone:
[List specific product stages, features, or flows that this persona
will never naturally use. This is how you know you need other personas
to cover those areas. Be specific — not "advanced features" but
"Expert Pool provider flow" or "Investor Queue browsing".]

## Skepticism Profile

What makes this persona roll their eyes vs. what intrigues them:

| Claim | Reaction | Why |
|-------|----------|-----|
| [Product claim 1 — from vision doc] | [skeptical/neutral/intrigued] | [reason] |
| [Product claim 2 — from vision doc] | ... | ... |
| [Product claim 3 — from vision doc] | ... | ... |

## Patience Budget

How much friction this persona will tolerate before bouncing:

- **Onboarding tolerance:** [e.g., "2 minutes max before they need to see value"]
- **Time to first value:** [e.g., "needs a match suggestion within 24h or assumes it's dead"]
- **Communication style:** [e.g., "wants structured checkpoints, not open-ended chat"]
- **Deal-breakers:** [specific things that make them leave immediately]
- **Re-engagement window:** [if they bounce, what brings them back?]

## Trust Triggers

What earns trust at each stage of their journey:

| Stage | Earns trust | Loses trust |
|-------|------------|-------------|
| Landing / signup | [specific] | [specific] |
| Onboarding | [specific] | [specific] |
| First match | [specific] | [specific] |
| First conversation | [specific] | [specific] |
| Decision point | [specific] | [specific] |
| Post-commit | [specific] | [specific] |

## Feature Touchpoints

Which feature specs matter most to this persona, and what they care about in each:

| Feature | What matters to this persona | What they ignore |
|---------|------------------------------|-----------------|
| feature-onboarding | [specific aspect] | [specific aspect] |
| feature-matching | ... | ... |
| feature-conversation | ... | ... |

## Skill Implications

Guidance for skills that consume this persona:

- **write-journeys:** [what this persona's journey should emphasize, what alternative paths matter]
- **copywriting:** [what language resonates, what turns them off]
- **cro:** [what they look for on the landing page, what converts them]
- **onboarding:** [where they'll drop off, what keeps them going]

---
```

### Phase 4: Write the Index

Create `docs/specs/personas/PERSONA_INDEX.md`:

```markdown
# Persona Index

**Last built:** [date]
**Source:** docs/personas/ (qualitative challenges) + docs/specs/vision.md + feature specs
**Persona count:** [N]

## Personas

| ID | Name | Archetype | Key challenge | Primary features |
|----|------|-----------|--------------|-----------------|
| P1 | [name] | [1-line] | [core challenge] | [top 3 features] |

## Lifecycle Coverage Matrix

Shows which persona reaches which product stage, and at which instance:

| Product stage | P1 | P2 | P3 | ... |
|---------------|----|----|----| ... |
| GitHub OAuth signup | Inst 1 | Inst 1 | Inst 1 | ... |
| 7D Matching queue | Inst 1 | Inst 1 | Inst 1 | ... |
| Project Lifecycle | Inst 1-2 | Inst 1 (junior) | Inst 1 (fast) | ... |
| Team formation | Inst 2 | Inst 3 | Inst 1 | ... |
| Trust tier: Elite | -- | -- | Inst 3 | ... |

Empty cells (--) reveal product stages no persona reaches — these are Mode 6
gap analysis inputs.

## Challenge Narrative Coverage

| Challenge narrative (docs/personas/) | Mapped to personas |
|--------------------------------------|--------------------|
| The Paranoid Idea Holder | P1, P3 |
| The Skill Holder | P2, P4 |
| ... | ... |

## Vision Feedback

Findings from persona building that vision.md should address:

| Finding | Which persona | Impact | Recommendation |
|---------|--------------|--------|----------------|
| [gap found] | P[N] | [why it matters] | [what vision should say] |
```

### Phase 5: Vision Feedback

This is the upstream feedback loop. During persona building, you'll inevitably discover
things the vision doesn't address — because you're thinking from the user's perspective
in a way the vision document may not have.

**Types of vision feedback:**

1. **Missing user segments** — the personas reveal a user type the vision doesn't mention
2. **Unaddressed fears** — the vision's value props don't counter a specific persona's skepticism
3. **Success metric gaps** — the vision's metrics don't capture what matters to a persona
4. **Boundary questions** — a persona wants something that falls in the vision's grey zone
5. **Principle tensions** — a persona's needs create tension between two product principles

Write findings to the Vision Feedback section of PERSONA_INDEX.md. Do NOT modify
vision.md directly — these are recommendations for the product owner to evaluate.

Present findings to the user: "Building personas revealed N findings that vision.md
doesn't currently address. Want me to walk through them?"

---
