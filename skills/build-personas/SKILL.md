---
name: build-personas
version: "1.0"
description: >
  Build user personas from vision, specs, domain, and competitor data. Seven modes:
  build/refresh, audit, add, expand, interview, discover gaps, tiered auto-discovery.
  Use when: "build personas", "who are our users", "persona check", "add persona",
  "persona gaps", "suggest personas", or before any user-facing skill when
  docs/specs/personas/ is empty.
phases:
  - id: P1-ModeContextGate
    trigger: always
    reads: ["REPO_MODES.md", "docs/specs/vision.md", "docs/specs/personas/PERSONA_INDEX.md"]
    writes: []
    evidence_kind: command_output
    required_for_completion: true
  - id: P2-SourceDeepRead
    trigger: always
    reads: ["docs/specs/vision.md", "docs/personas/*.md", "docs/specs/features/*.md", "docs/specs/domain-profile.md", "docs/specs/analyze-competitors.md"]
    writes: []
    evidence_kind: command_output
    required_for_completion: true
  - id: P3-PersonaCandidateModeling
    trigger: always
    reads: ["product roles", "feature surface", "existing personas", "journey analysis"]
    writes: ["docs/specs/personas/PERSONA_INDEX.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P4-PersonaArtifactBuild
    trigger: always
    reads: ["approved persona candidates", "persona template"]
    writes: ["docs/specs/personas/P*.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P5-IndexVisionFeedback
    trigger: always
    reads: ["docs/specs/personas/P*.md", "vision feedback findings"]
    writes: ["docs/specs/personas/PERSONA_INDEX.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P6-SelfVerifyContinuation
    trigger: always
    reads: ["docs/specs/personas/P*.md", "docs/specs/personas/PERSONA_INDEX.md", ".svc/lane-tasks-<WI>.json"]
    writes: [".svc/lane-tasks-<WI>.json"]
    evidence_kind: command_output
    required_for_completion: true
inputs:
  required:
    - { path: "docs/specs/vision.md", artifact: vision }
  optional:
    - { path: "docs/specs/personas/P*.md", artifact: existing-personas }
    - { path: "docs/specs/domain-profile.md", artifact: domain-profile }
    - { path: "docs/specs/analyze-competitors.md", artifact: competitor-analysis }
outputs:
  produces:
    - { path: "docs/specs/personas/P*.md", artifact: personas }
    - { path: "docs/specs/personas/PERSONA_INDEX.md", artifact: persona-index }
chain:
  lanes:
    greenfield: { position: 5, prev: catalog-domain-capabilities, next: validate-feature }
  progressive: true
  self_verify: true
  human_checkpoint: false
---

# Persona Builder

**Runtime v2 continuation:** Register every produced artifact with its declared consumers via
`references/skill-runtime-contracts-v2.json`; follow `references/runtime-continuation-v2.md`.
Preserve this skill's human evidence and persona-index obligations.

Build user personas that are grounded in the product's reality AND the user's 2026 world.
These personas become the shared source of truth that other skills consume when they need
to think from the user's perspective.

**Announce at start:** "I'm using the build-personas skill to build user personas."

**The gap this fills:** Feature specs describe what the system does. Journey docs describe
how users move through it. But neither asks: "Does this person actually get what they came
for? Are we earning their trust or burning their patience at each step?" Personas answer that.

**Two inputs, one output:**
- INPUT 1: `docs/specs/vision.md` + `docs/specs/features/*.md` (what the product IS)
- INPUT 2: `docs/personas/*.md` (qualitative challenge library — who these people ARE)
- OUTPUT: `docs/specs/personas/*.md` (structured, consumable persona files with 2026 context)

---

## Repository Mode Gate

Detect mode from `REPO_MODES.md` before choosing a mode below.

- `bootstrap`: create persona scaffold and derive first personas from available vision/code context.
- `convert`: read existing user docs/segments first, then map them into persona format without
  discarding current taxonomy on first pass.

---

## Modes

### Mode 1: Build / Refresh Personas

Reads vision, feature specs, and qualitative challenge library. Produces structured
persona files that any skill can consume.

### Mode 2: Skill Audit

Reads persona files + skill files. Produces a report of where skills fail to serve
specific personas. Feeds findings back to vision.md when personas reveal vision gaps.

### Mode 3: Add New Persona

Interactively build a single new persona through guided questions. The skill asks
the product owner targeted questions one at a time to flesh out a complete persona
from scratch — useful when you discover a user type not covered by existing personas.

### Mode 4: Expand Existing Persona

Deepen an existing persona by asking the product owner targeted questions about gaps,
thin sections, or areas where the persona feels generic. Also used when real user
feedback or new market data should be incorporated into a persona.

### Mode 5: Interview Mode

The skill flips the dynamic — instead of building artifacts, it interviews the
product owner to surface insights, corrections, and suggestions. It reads existing
personas, vision, and specs, then asks probing questions to find what's wrong,
missing, or outdated. Produces a findings document with recommended changes.

### Mode 6: Discover Persona Gaps

Proactively scans the product's features, entity types, lifecycle stages, and
user flows to suggest new persona candidates that the existing set doesn't cover.
Unlike Mode 1 (builds from challenge narratives) or Mode 5 (interviews the owner),
Mode 6 reasons FROM THE PRODUCT OUTWARD — it looks at what the product can do
and asks "who is this for, and do we have a persona for them?"

### Mode 7: Tiered Auto-Discovery

Fully automatic, zero-input required. No challenge library (`docs/personas/`)
needed. Reads vision + feature specs + entity list, reasons from the product
outward, and PROPOSES a tiered set of personas for owner approval before writing
anything. Each proposed persona is classified by how much product effort is needed
to fully serve them today:

- **Tier 1 — Platform-Native:** Fully served by the current platform. 0 feature gaps.
- **Tier 2 — Near-Future:** Mostly served; 1-3 small, focused additions close the gap. No architectural changes.
- **Tier 3 — Vision:** Would require significant new capabilities, new entities, or major features.

The owner approves which tiers/personas to build. Only approved personas become
full documents. Tier 3 personas are summarized as lightweight "Future Persona" stubs
(not full documents) unless the owner explicitly asks for the full build.

---

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

## Mode 2: Skill Audit

Triggered when the user says "audit skills against personas", "do our skills serve
the user", "persona audit", or similar.

### What it does

Reads all persona files in `docs/specs/personas/`, then reads the skill files for
each consuming skill, and evaluates: **does this skill account for the different
personas, or does it treat all users as identical?**

### Skills to audit

Check for these skills and audit them if they exist:

| Skill | What to check | Common failure |
|-------|--------------|----------------|
| write-journeys | Does it use persona files? Does each journey specify which persona it serves? | Generates generic journeys that don't differentiate user types |
| copywriting | Does it consider different personas' language, skepticism, motivations? | One-size-fits-all copy that resonates with nobody specifically |
| cro | Does it evaluate the page for each persona separately? | Optimizes for one persona type and loses others |
| onboarding | Does it account for different patience budgets and value expectations? | Assumes all users have the same tolerance for friction |
| signup | Does it consider what each persona needs to see before committing? | Generic signup that doesn't address persona-specific fears |
| popups | Does it match messaging to persona context? | Same popup for everyone |
| content-strategy | Does it target content to specific personas? | Generic content that doesn't speak to anyone specifically |

### Audit output

For each skill, produce:

```markdown
## [Skill Name] Audit

**Current persona awareness:** [None / Partial / Good]

### Findings

| # | Finding | Affected personas | Severity | Recommendation |
|---|---------|------------------|----------|----------------|
| 1 | [what's missing or wrong] | P1, P3 | [High/Med/Low] | [specific change] |

### Recommended Skill Changes

[Specific, actionable changes to the skill file. Not vague "consider personas" —
exact sections to add, exact checks to perform.]
```

Save the full audit to `docs/specs/personas/SKILL_AUDIT.md` with a datestamp.

### Audit principles

- **Specificity over generality.** "This skill should consider personas" is useless.
  "The write-journeys skill's Phase 2 builds personas from scratch instead of reading
  docs/specs/personas/ — it should consume the pre-built persona files and skip its
  own persona generation" is actionable.

- **Every finding needs a persona.** Don't say "users might bounce here." Say
  "P2 (The Cautious First-Timer) bounces here because their patience budget is
  2 minutes and this flow takes 4."

- **Suggest, don't demand.** The skill audit produces recommendations. The user
  decides what to implement. Present findings ranked by impact.

---

## Mode 3: Add New Persona

Triggered when the user says "add a persona", "new persona", "I think we're missing a user type",
or describes a user type not covered by existing personas.

### How it works

This is an interactive, question-driven mode. You're helping the product owner crystallize
a new persona they have in their head but haven't written down yet.

### Step 1: Context load

Read existing personas in `docs/specs/personas/` to understand what's already covered.
Also read `docs/personas/` challenge library and `docs/specs/vision.md` for grounding.

### Step 2: Guided interview (one question at a time)

Walk through these areas, asking ONE question per message. Prefer multiple choice when
possible, but open-ended is fine when the answer is genuinely open.

**Opening question:** "Who is this person? Give me the elevator pitch — who are they,
what's their situation, and why do they need ExampleProduct?"

Then probe deeper through these dimensions (skip any the user already answered):

1. **Background:** "What's their technical skill level? Are they a developer, designer,
   product person, domain expert, or something else?"

2. **Tool context:** "What AI tools are they using? What tier are they on? What's their
   budget for tools?" (Offer examples: free tier, $20/mo, $200/mo Max)

3. **What they've tried:** "Where have they looked for collaborators before? What failed?"
   (Offer examples: Discord, Reddit r/collaborator, Twitter DMs, YC matching, friends)

4. **Time reality:** "How many hours per week can they actually commit? When do they work?"

5. **Primary goal:** "When they open ExampleProduct for the first time, what specific
   outcome are they hoping for?" (Not features — outcomes)

6. **Fear / skepticism:** "What's the thing that would make them close the tab? What
   claims would make them roll their eyes?"

7. **Trust triggers:** "What would they need to see or experience to believe this
   platform is different from what they've tried before?"

8. **Differentiation check:** "Looking at our existing personas [list them], how is
   this person different? What would we miss if we folded them into [closest match]?"

### Step 3: Build the persona

Once you have enough signal (usually 5-8 questions), draft the full persona file
using the standard template from Mode 1, Phase 3. Present it to the user for review.

### Step 4: Integration

- Assign the next available P[N] ID
- Write the persona file to `docs/specs/personas/P[N]-name.md`
- Update `PERSONA_INDEX.md` with the new entry
- Check if this persona maps to any existing challenge narratives in `docs/personas/`
- If the persona reveals a vision gap, add it to the Vision Feedback section

---

## Mode 4: Expand Existing Persona

Triggered when the user says "expand P2", "deepen the cautious first-timer",
"this persona feels thin", or points to a specific persona that needs more depth.

### How it works

Read the existing persona file and identify which sections are thin, generic, or
missing nuance. Then ask targeted questions to fill the gaps.

### Step 1: Diagnose thin spots

Read the persona file and evaluate each section:

| Section | Signs it's thin |
|---------|----------------|
| Who They Are | Generic description that could apply to multiple personas |
| Their 2026 World | Missing specifics about what they've tried, what failed |
| What They Came For | Vague success/failure definitions, not timeframe-specific |
| Skepticism Profile | All reactions are "neutral" or single-word |
| Patience Budget | Missing deal-breakers or re-engagement triggers |
| Trust Triggers | Generic trust signals not specific to this persona's fears |
| Feature Touchpoints | Lists features without saying what specifically matters |
| Skill Implications | Vague guidance like "consider this persona" |

### Step 2: Targeted questions

For each thin section, ask the product owner 1-2 targeted questions. Focus on the
sections that matter most for this persona's uniqueness.

**Example questions for expanding thin spots:**

- Skepticism: "You said P2 is skeptical of AI matching. Can you be more specific —
  is it that they don't trust algorithms in general, or they've seen 'AI' used as
  a marketing buzzword and assume it's just keyword matching underneath?"

- Patience: "You said P2 bounces fast. What's the actual moment — is it during
  signup when they see too many form fields? During onboarding when the tour feels
  patronizing? Or after signing up when they don't get a match quickly enough?"

- Trust triggers: "What would P2 need to see in the FIRST 30 seconds on the landing
  page to not bounce? Social proof? A demo? A specific claim about how matching works?"

### Step 3: Update the persona

Apply the new insights to the persona file. Don't rewrite sections that are already
good — only update what's thin. Show the diff to the user.

### Step 4: Cascade check

After expanding, check if the new depth changes anything in:
- Other persona files (does this expansion create overlap with P3?)
- Skill Implications (does the deeper understanding change guidance for write-journeys?)
- Vision Feedback (does the deeper understanding reveal new vision gaps?)

Update as needed.

---

## Mode 5: Interview Mode

Triggered when the user says "interview me about personas", "ask me about our users",
"improve personas", "what am I missing", "persona suggestions", or "help me think
about our users."

### What it does

Flips the dynamic. Instead of building artifacts, the skill interviews the product
owner to surface insights, corrections, and suggestions. The product owner knows
their users better than any spec. This mode extracts that knowledge.

### Step 1: Load context

Read all persona files, vision.md, and the challenge library. Build a mental model
of what's documented vs. what might be assumed or missing.

### Step 2: Interview structure

Work through these question categories, one question at a time. You're not filling
a template — you're having a conversation. Follow the thread where it goes.

**Category 1: Reality check on existing personas**

For each persona, ask one probing question:
- "Looking at P1 (The Cautious First-Timer) — does this feel like a real person you've
  talked to or seen in the wild? Or does it feel like we invented them?"
- "What would P2 actually say if you showed them our landing page right now?"
- "Is there a persona here that you think is actually the same person as another one?"

**Category 2: Who's missing?**

- "Think about the last 5 people who showed interest in ExampleProduct (or a product
  like it). Do any of them NOT fit into our existing personas?"
- "Is there a user type we're avoiding because they're hard to serve? Someone who
  WANTS what we offer but we haven't designed for them?"
- "Who would be our WORST user? The person who signs up, hates it, and leaves a
  bad review. What are they like?"

**Category 3: What's wrong?**

- "Which persona feels most like wishful thinking — where we're describing who we
  WANT our users to be rather than who they actually are?"
- "If you had to kill one persona — remove it entirely because it's not real enough
  to build for — which one would it go?"
- "What do you know about your users that none of these personas capture?"

**Category 4: Competitive landscape**

- "When someone chooses NOT to use ExampleProduct, what do they do instead? Not
  another product — what's the actual alternative behavior?"
- "What's the last thing you saw a potential user say online (Reddit, Twitter,
  Discord) that made you think 'that's exactly who we're building for'?"

**Category 5: Product implications**

- "Looking at all our personas, which ONE would you build for if you could only
  serve one? Why?"
- "Is there a feature we're building that no persona actually needs?"
- "What's the one thing our product does that our personas don't know they want yet?"

### Step 3: Synthesize findings

After the interview (usually 8-12 questions), produce a findings document:

```markdown
# Persona Interview Findings

**Date:** [date]
**Interview with:** [product owner]

## Key Insights

| # | Finding | Impact | Action |
|---|---------|--------|--------|
| 1 | [what was learned] | [which personas/skills affected] | [specific next step] |

## Persona Updates Needed

| Persona | What to change | Source (which answer) |
|---------|---------------|----------------------|
| P1 | [specific update] | Q3 response |

## New Persona Candidates

| Description | Why | Recommended next step |
|-------------|-----|----------------------|
| [who they are] | [why they matter] | Mode 3 (add) or merge into P[N] |

## Vision Feedback

| Finding | Recommendation |
|---------|----------------|
| [gap discovered] | [what vision should address] |

## Skills Affected

| Skill | What should change based on these findings |
|-------|-------------------------------------------|
| write-journeys | [specific change] |
| copywriting | [specific change] |
```

Save to `docs/specs/personas/INTERVIEW_[date].md`.

Ask the user: "Want me to apply these findings now? I can update personas (Mode 4),
add new ones (Mode 3), or run a skill audit (Mode 2) based on what we learned."

---

## Mode 6: Discover Persona Gaps

Triggered when the user says "what personas are we missing", "suggest personas",
"persona gaps", "who else should we build for", "explore new personas", or
"what user types are implied by our features?"

### What it does

Reasons FROM THE PRODUCT OUTWARD to find user types implied by the features but
not yet personified. Unlike Mode 1 (builds from challenge narratives) or Mode 5
(interviews the owner), Mode 6 is proactive — it looks at what the product CAN DO
and asks "who is this for, and do we have a persona for them?"

This is the mode that would have caught: "You built a Social Lounge but you don't
have a persona for community users. You have an Expert entity type but no Expert
persona. Your project lifecycle goes 9 phases deep but no persona traces past Phase 6."

### Step 1: Load current state

Read all existing persona files AND the Lifecycle Coverage Matrix from PERSONA_INDEX.md.
Also read all feature specs (at minimum the full index from `docs/specs/INDEX.md`).

**Also read journey analysis sections.** If journey docs exist (`docs/specs/journeys/J*.feature.md`),
read each journey's `## Journey Analysis` section — specifically the Ungrounded Preconditions
table and any findings that mention "missing persona" or "no persona covers this role." These
are direct inputs from write-journeys that tell you exactly where persona gaps exist. Journey-sync
often discovers persona gaps before build-personas does, because it traces data flow across
roles and finds roles with no persona representation.

```bash
ls docs/specs/journeys/J*.feature.md 2>/dev/null
# For each, read the Journey Analysis section
```

### Step 2: Run six gap analyses

**Analysis 1: Entity Type Coverage**
List every entity type the product supports (look at auth flows, separate onboarding
paths, distinct user tables). For each entity type, check if a persona exists.
- Example finding: "The product has Expert entity (Google/Email auth, Expert Pool,
  service engagements) but no persona covers the Expert flow."

**Analysis 2: Feature Touchpoint Coverage**
For every feature spec, check if at least one persona lists it in their Feature
Touchpoints table. Features with zero persona coverage are orphaned — nobody in
the persona set naturally uses that feature.
- Example finding: "The Referrals spec (vibe-spread, milestones, fraud detection)
  isn't in any persona's touchpoints. Who is the user who drives referrals?"

**Analysis 3: Lifecycle Stage Coverage**
Using the Lifecycle Coverage Matrix, identify product stages where no persona has
a natural entry. Look for empty columns — stages that exist in the product but no
persona reaches.
- Example finding: "No persona reaches Elite trust tier. The product has Elite-tier
  features (priority matching, full unlock) but nobody in our persona set gets there."

**Analysis 4: Progression Dead Ends**
For each persona's Instance 3 (veteran stage), check the "Where this persona CAN'T
reach" section. Aggregate all unreachable areas across all personas. Any product area
that NO persona can reach is a coverage hole — either the feature doesn't need a
persona (infrastructure) or you're missing a user type.
- Example finding: "No persona naturally transitions from Lounge to Matching. P6
  lists it as 'optional Instance 3' but it's a maybe, not a certainty. The
  Lounge → Matching pipeline has no dedicated persona."

**Analysis 5: New Feature Scan**
Check git log for feature specs added or significantly changed since the last
persona build (use the date from PERSONA_INDEX.md):

```bash
git log --after="[last-built-date]" --oneline -- docs/specs/features/
```
Any new feature spec implies a new user type or an expansion of an existing one.

**Analysis 6: Journey-Driven Gaps**
Read the Journey Analysis sections from existing journey docs. Look for:
- **Ungrounded preconditions that name a producing role with no persona** —
  e.g., "seller creates flash deals" but no seller persona exists
- **Cross-journey dependency gaps that imply a missing user type** —
  e.g., the dependency graph shows "Manager assigns tasks" but no manager persona
- **Concept fragmentation findings** — if write-journeys found two names for
  the same entity, the producing role may need a persona that understands both
  the creation and consumption sides

This analysis is the highest-signal input because write-journeys already did the
cross-role tracing work. It directly tells you which roles are missing persona
coverage. Don't re-derive what write-journeys already found — read it and act on it.

- Example finding: "J07 Journey Analysis flags 'no owner journey covers creating
  flash deals' — P1 (Solo Owner) exists but their Feature Touchpoints and
  Lifecycle Progression don't mention flash deal creation. Either expand P1 or
  create a new persona for deal-heavy owners."

### Step 3: Rank and present candidates

For each gap found, assess:
- **Impact:** How many users does this gap represent? Is it a core path or an edge case?
- **Product readiness:** Is the feature live or Phase 2/planned?
- **Existing persona stretch:** Could an existing persona be expanded (Mode 4) to cover
  this, or does it need a genuinely new persona (Mode 3)?

Present candidates ranked by impact:

```markdown
## Persona Gap Analysis

**Run date:** [date]
**Existing personas:** [count]
**Gaps found:** [count]

### Recommended New Personas

| # | Candidate | Why | Impact | Source analysis | Recommended action |
|---|-----------|-----|--------|-----------------|-------------------|
| 1 | [who] | [what they cover that nobody does] | High/Med/Low | Analysis [N] | Mode 3 (add) / Mode 4 (expand P[N]) |

### Existing Persona Expansions

| Persona | What to add | Which analysis found it |
|---------|-------------|----------------------|
| P[N] | [specific expansion] | Analysis [N] |

### Features Without Persona Coverage

| Feature spec | What's uncovered | Recommendation |
|-------------|-----------------|----------------|
| [spec name] | [what's missing] | [add to P[N] touchpoints / new persona / infrastructure-only, skip] |
```

### Step 4: Act on findings

Ask the user which candidates to pursue. For each approved candidate:
- **New persona:** Switch to Mode 3 (Add New Persona) with the gap analysis as context
- **Expand existing:** Switch to Mode 4 (Expand Existing Persona) with the specific expansion
- **Skip:** Mark as "reviewed, not needed" in PERSONA_INDEX.md so it's not flagged again

---

## Mode 7: Tiered Auto-Discovery

Triggered when the user says "auto personas", "propose personas", "tiered personas",
"just run it automatically", or when `docs/personas/` does not exist and the user
wants to start from scratch.

### What it does

Reads the product entirely on its own, proposes a tiered set of personas for
approval, then builds only the approved ones. The product owner does not need to
provide any input beyond approving the proposal.

### Phase 1: Deep Read (automatic)

Read all of the following without asking the user:

```
1. docs/specs/VISION.md or docs/VISION.md or the closest equivalent
2. CLAUDE.md (for entity list, user roles, pricing tiers)
3. docs/specs/features/*.md — all AC checklists / feature specs
4. docs/specs/BUSINESS_SPEC.md if it exists
5. Any flow audit files (OWNER_FLOW_AUDIT.md, EMPLOYEE_FLOW_AUDIT.md, CUSTOMER_FLOW_AUDIT.md)
```

Build an internal model of:
- **User roles** (distinct auth paths, separate onboarding flows, different entity types)
- **Feature surface per role** (which features each role touches)
- **Platform maturity per role** (is the role fully built out, partially, or sketched?)
- **Value delivered vs. value potential** (what does the platform give each role today vs. what it COULD give with small additions?)

### Phase 2: Identify Persona Candidates

For each user role, identify the meaningful archetypes WITHIN that role. Not every
role is one persona — a café owner and a 5-location restaurant operator both have
the "Owner" role but have very different needs, sophistication, and platform usage.

**Factors that split a role into multiple personas:**
- Business scale (solo/micro vs. small chain vs. enterprise)
- Engagement depth (passive/minimal vs. active/power user)
- Specific capability focus (e.g., one owner lives in scheduling, another lives in loyalty)
- Job title / seniority within the role (e.g., full-time employee vs. part-time gig worker)
- Goal type (e.g., customer who hunts deals vs. customer who builds loyalty relationships)

**Merge aggressively.** If two candidates feel like the same person at different
life stages, that's one persona with two lifecycle instances — not two personas.

Aim for 3-7 total personas across all roles.

### Phase 3: Tier Classification

For each persona candidate, classify into one of three tiers based on how well
the CURRENT platform serves them:

#### Tier 1 — Platform-Native

The platform serves this persona completely today. No feature gaps. They can
sign up, get full value, and stay long-term on the current platform.

**Signals:** All their core jobs-to-be-done have corresponding features. Their
primary failure modes are onboarding/UX friction, not missing capabilities.

#### Tier 2 — Near-Future

The platform gives them real value today, but 1-3 focused additions would
fully close the gap. These additions are:
- Narrowly scoped (no new entities, no architectural changes)
- Clearly implied by existing product direction
- Could ship in a sprint or two

**Examples of Tier 2 additions:**
- A missing field on an existing form
- A filter/sort option on an existing list
- A notification type not yet implemented
- A small workflow improvement (e.g., bulk actions)

**Signals:** The persona gets ~70-80% of their value from the current platform.
The remaining gaps are irritants, not blockers. You can describe exactly what
the 1-3 additions would be.

#### Tier 3 — Vision

This persona would require significant platform investment to fully serve:
new entity types, new integrations, major new feature areas, or architectural
changes. They represent where the product COULD go, not where it is.

**Signals:** The persona's core jobs-to-be-done map to features that don't exist
yet. Serving them well would require a multi-sprint effort or a new product surface.

**Note:** Tier 3 personas are NOT bad personas — they're strategic signals.
They tell the product owner where growth opportunities lie.

### Phase 4: Proposal Output

Present the tiered persona proposal to the user. Do NOT write any files yet.

Format:

```markdown
## Persona Proposal — [Product Name]

**Analyzed:** [N] feature specs + [N] entity types + [N] user roles
**Proposed personas:** [N] total ([N] Tier 1, [N] Tier 2, [N] Tier 3)

---

### Tier 1 — Platform-Native (fully served today)

**P1: [Name]** — [1-line archetype]
- **Role:** [which system role]
- **Who they are:** [2-3 sentences — specific enough to picture a real person]
- **What the platform gives them:** [core value they receive today]
- **Platform coverage:** ~[X]% of their needs
- **Feature gaps:** None significant

**P2: [Name]** — [1-line archetype]
[same structure]

---

### Tier 2 — Near-Future (1-3 small additions close the gap)

**P3: [Name]** — [1-line archetype]
- **Role:** [which system role]
- **Who they are:** [2-3 sentences]
- **What the platform gives them today:** [current value]
- **Platform coverage:** ~[X]% of their needs
- **What's missing (small additions):**
  1. [Specific small addition #1 — narrow scope, no new entities]
  2. [Specific small addition #2]
  3. [Optional: #3]
- **Why these are Tier 2 (not Tier 3):** [explain why these are small, not architectural]

---

### Tier 3 — Vision (significant new capabilities needed)

**P4: [Name]** — [1-line archetype]
- **Role:** [which system role]
- **Who they are:** [2-3 sentences]
- **What the platform gives them today:** [any current overlap]
- **Platform coverage:** ~[X]% of their needs
- **What would be needed to fully serve them:**
  - [Major capability/feature area #1]
  - [Major capability/feature area #2]
- **Strategic signal:** [Why this persona matters for the product roadmap]

---

## What I'll Build

**Your options:**

A) **Build Tier 1 + Tier 2 personas now** (recommended) — full persona files for P1-P3.
   Tier 3 personas get lightweight stubs.

B) **Build Tier 1 only** — full persona files for P1-P2. Skip the rest.

C) **Build all tiers** — full persona files for all personas including Tier 3.
   (Note: Tier 3 files will describe who the persona WOULD be if the platform
   existed, which is useful for roadmap planning.)

D) **Custom** — tell me exactly which personas to build.

Which option, or any changes to the proposed personas?
```

### Decision Logging

After persona selection is finalized (user approves or P0 decides in auto mode), log the decision. The `run_id` comes from the active task graph (`docs/log/lane-tasks-<WI>.json` → `wi` field).

```bash
# Persona selection (taste — multiple viable configurations exist)
node scripts/pipeline-log.mjs append \
  --path .svc/pipeline-decisions.jsonl \
  --run-id "<WI-ID>" \
  --skill build-personas \
  --phase "<task-id>" \
  --type taste \
  --decision "Personas: <N> Tier 1, <N> Tier 2, <N> Tier 3. Selected option: <A|B|C|D|custom>" \
  --reasoning "<why this configuration — e.g., 'P1 and P2 are fully served by MVP scope; P3 needs 2-3 additions'>" \
  --decided-by "<P0|user>" \
  --overrideable true
```

### Phase 5: Build Approved Personas

After the user approves (in full or with modifications), build the persona files.

**For Tier 1 and Tier 2 personas:** Full persona documents using the standard
template from Mode 1, Phase 3. The Feature Touchpoints section should map to
the ACTUAL feature specs found in the project (not the ExampleProduct examples).

**For Tier 3 personas (unless user requested full build):** Lightweight stub:

```markdown
# P[N]: [Name] — Vision Persona

**Tier:** 3 — Vision (significant new capabilities needed)
**Archetype:** [1 sentence]

## Who They Are

[2-3 sentences — who is this person in 2026]

## What They Need That Doesn't Exist Yet

| Capability needed | Why it matters | Effort estimate |
|-------------------|---------------|----------------|
| [feature/entity] | [what value it delivers] | [Small/Medium/Large] |

## Strategic Signal

[1-2 sentences: why building for this persona would matter, what market it opens]

## Platform Coverage Today

~[X]% — [describe what the current platform CAN do for them, even if incomplete]
```

**For the index:** Create `docs/specs/personas/PERSONA_INDEX.md` with all personas,
including Tier 3 stubs, using the standard index format from Mode 1, Phase 4.
Add a **Tier Summary** section at the top of the index.

### Phase 6: Tier 2 Addition Backlog

After building personas, output a consolidated list of all Tier 2 additions
identified across all Tier 2 personas. This is a ready-to-use input for
GitHub Issues or a product backlog:

```markdown
## Tier 2 Addition Backlog

These small additions would close the gap for Near-Future personas.
Each is narrowly scoped — no architectural changes required.

| # | Addition | Serves persona | Effort | Type |
|---|----------|---------------|--------|------|
| 1 | [what] | P[N] | XS/S/M | [Feature/UX/Config] |
```

Write this to `docs/specs/personas/TIER2_BACKLOG.md`.

### Important notes for Mode 7

- **No challenge library needed.** If `docs/personas/` doesn't exist, skip it.
  Reason from the product specs and entity list alone.
- **2026 context is still mandatory.** Even without challenge narratives, every
  persona must reflect the real world this person lives in in 2026. For a local
  business SaaS: AI tools are mainstream, labor market is tight, mobile is primary,
  customers expect instant gratification, small businesses are under margin pressure.
- **Tier 2 additions must be specific.** "Better analytics" is not Tier 2. "Add a
  date range filter to the visits chart" is Tier 2. Be specific enough that a
  developer could estimate and build it.
- **Tier classification is honest.** Don't downgrade Tier 3 personas to Tier 2
  to make the proposal feel more achievable. If it needs a new entity type or
  a new integration, it's Tier 3.
- **Proposal gate is real.** Do NOT write any files during Phase 4. The user must
  respond before any persona files are created.

---

## Phase Receipt Contract

After loading this skill into the lane task graph, emit receipts for each required phase before marking the task complete:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-ModeContextGate --evidence command_output:.svc/build-personas-mode-context.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-SourceDeepRead --evidence command_output:.svc/build-personas-source-read.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-PersonaCandidateModeling --evidence file:docs/specs/personas/PERSONA_INDEX.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-PersonaArtifactBuild --evidence file:docs/specs/personas/P1.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-IndexVisionFeedback --evidence file:docs/specs/personas/PERSONA_INDEX.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-SelfVerifyContinuation --evidence command_output:.svc/build-personas-self-verify.log
```

---

## Important Rules

1. **Qualitative personas are input, not output.** `docs/personas/` contains the raw
   challenge narratives. `docs/specs/personas/` contains the structured, consumable
   personas. Don't modify `docs/personas/` — that's the source material.

2. **3-7 personas.** Fewer means you're not capturing real diversity. More means
   you're creating distinctions without differences. Merge aggressively.

3. **2026 context is mandatory.** Every persona must be grounded in what's true NOW
   (2026), not hypothetical future state. AI coding is mainstream. Solo shipping is
   possible. The collaboration problem is real and unsolved. Trust is scarce.

4. **Outcomes, not features.** The "What They Came For" section describes outcomes
   the person wants, not features they'll use. "Find a reliable co-founder for my
   SaaS idea within 2 weeks" not "use the 7D matching system."

5. **Vision feedback is upstream.** Findings go to PERSONA_INDEX.md as recommendations,
   not directly into vision.md. The product owner decides what to adopt.

6. **Personas decay.** The 2026 context will shift. Re-run the build when the market
   changes (new tools launch, new competitors appear, user research reveals new patterns).
   The index tracks when personas were last built.

7. **Skill audit is honest.** If a skill is doing fine, say so. Don't manufacture
   findings to justify the audit. Empty findings = "this skill handles personas well."

## Pipeline Continuation

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`)
- Treat `Invoke: /skill-name` in the task description and `metadata.skill` as routing instructions, not explanatory prose
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume
- In Claude Code: mirror file state with `TaskList` / `TaskUpdate`; in Kimi use `/task` or `TaskList` / `TaskOutput` only as observation while the file remains authoritative; in Codex and other hosts without native task-mutation APIs: mirror only the active step in `update_plan`
- Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
- Evaluate the next task's conditions from its description
- If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
- If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
- Per `route-workflow` Task-Graph Execution Protocol

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`)
- Treat `Invoke: /skill-name` in the task description and `metadata.skill` as routing instructions, not explanatory prose
- Read and update `.svc/lane-tasks-<WI>.json` first — this is the cross-host,
  cross-session, cross-subagent source of truth.
- Host UI mirroring (TaskList/TaskUpdate in Claude Code; `/task` + `TaskList`/`TaskOutput` observation in Kimi; `update_plan` in Codex)
  is ONLY performed when running in the parent/top-level session. Detect via:
  host exposes TaskList tool AND no `SVC_SUBAGENT=1` marker in env. If either
  check fails, skip host mirroring — file state is the durable record; the
  orchestrator parent will re-read and re-mirror after the subagent returns.
- Subagents MUST NOT attempt TaskUpdate calls. Trying and failing is not
  graceful; it's silent drift between the subagent's intent and the host UI.
- Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
- Evaluate the next task's conditions from its description
- If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
- If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
- Per `route-workflow` Task-Graph Execution Protocol

### Self-Verify

Before declaring done, verify:

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | Persona files exist | `ls docs/specs/personas/P*.md` | |
| 2 | PERSONA_INDEX.md exists | `test -f docs/specs/personas/PERSONA_INDEX.md` | |
| 3 | At least 1 persona created | count files matching `docs/specs/personas/P*.md` >= 1 | |
| 4 | Domain context consumed | If domain-profile.md exists, personas reference industry patterns | |
| 5 | Competitor context consumed | If analyze-competitors.md exists, personas reflect real market users not hypothetical ones | |

If any check FAILs, fix before continuing. If a fix requires upstream changes, stop and report.

### Chaining

**Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`):**
- Treat `Invoke: /skill-name` in the task description and `metadata.skill` as routing instructions, not explanatory prose
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume
- In Claude Code: mirror file state with `TaskList` / `TaskUpdate`; in Kimi use `/task` or `TaskList` / `TaskOutput` only as observation while the file remains authoritative; in Codex and other hosts without native task-mutation APIs: mirror only the active step in `update_plan`
- Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
- Evaluate the next task's conditions from its description
- If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
- If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
- Per `route-workflow` Task-Graph Execution Protocol

**If `--progressive` flag is present AND self-verify passed:**
- Check `--skip` list. If this skill is in the skip list, pass through to next.
- Invoke next skill: `validate-feature --progressive --lane greenfield`

**If `--progressive` flag is absent:**
- Report results to user
- Suggest: "Next: consider running `validate-feature`"

## Post-Compaction Recovery

If Kimi CLI compacted context and you lost track of framework state:

1. **Read the lane-tasks file** — `.svc/lane-tasks-<WI>.json` is the sole source of truth
2. **Find the next task** — First `in_progress`, else first `pending` with blockers satisfied
3. **Re-load the skill** — `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`
4. **Re-read this SKILL.md** — Refresh context for the current step
5. **Resume execution** — Continue from where the task left off
6. **Never ghost-complete** — Verify `skill_receipt` exists before marking any task complete

If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.
