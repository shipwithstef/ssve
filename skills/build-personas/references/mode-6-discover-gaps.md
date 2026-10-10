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
