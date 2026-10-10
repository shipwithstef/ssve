# Step 0: Context Scan — detail

Moved verbatim from SKILL.md (progressive disclosure).

### What to check (in this order — high-level first, detail only when needed)

**Tier 1: Product-level truth (always check these first)**

These tell you whether the feature idea already has a home in the product, which
users it affects, and how it connects to existing flows. Start here — most feature
questions are answered at this level without needing to read code.

```
1. Journeys — glob docs/specs/journeys/*.feature.md
   → Does an existing journey touch this area? Which personas does it serve?
   → Does the journey's Background assume data that relates to this feature?
   → Is there a supply-side gap — a journey that consumes this concept but
     no journey where a producer creates it?
   Read the journey fully, not just the title. The Journey Analysis section
   (Logical Issues, Missing Transitions, Product Gaps) often directly answers
   whether this feature idea has already been identified as a gap.

2. Personas — glob docs/specs/personas/P*.md
   → Which persona(s) would this serve? Read their pains, goals, patience budget.
   → Does any persona's "Skill Implications" section mention this area?
   → Is there a persona gap — a user type that exists in the product but has
     no persona file? (e.g., the product has admin features but no admin persona)

3. Vision / CLAUDE.md — read docs/specs/vision.md or the project CLAUDE.md
   → Does this align with the product's stated direction?

4. Domain profile — read docs/specs/domain-profile.md
   → What industry patterns apply? What pitfalls exist in this space?
   → Does the feature idea align with domain conventions or fight them?

5. Competitor analysis — read docs/specs/analyze-competitors.md
   → Has a competitor already built this? (feeds kill signal K3)
   → What whitespace exists? Does the feature exploit it?
```

**SDKG Industry Grounding gate (per WI-140 + WI-142):** Every feature spec moving to BASELINED MUST include an `## Industry Grounding` section, regardless of feature type or keyword match. Pre-WI-142 this gate only fired for specs whose ACs matched core-mechanic keywords (`earn|redeem|verify|enroll|loyalty|points|reward`); WI-142 removed that keyword trigger because it left 90% of feature work without competitive grounding. The only exemptions are explicit `landscape_inapplicable_reason` frontmatter, OR a Type:Enabler/Integration spec with UX/UI pillar marked `[N/A — justified]` (no customer-facing flow to ground).

The structured-gate-engine reads `docs/specs/analyze-competitors.data.json`, branches on `landscape_state` (populated → BLOCK BASELINED unless aligned or has compensating-control; nascent → WARN + require `thin_evidence_acknowledged: true`; none-found → require First-Mover Risk Checklist; inapplicable → SKIP + log justification).

```bash
node scripts/lib/structured-gate-engine.mjs \
  --schema=references/schemas/competitor-analysis.schema.json \
  --data=docs/specs/analyze-competitors.data.json \
  --config=scripts/gates/competitive.mjs \
  --artifact=docs/specs/features/<feature>.md
# Exit 0 = pass/warn/skip, 1 = block/halt. Section template:
# references/templates/industry-grounding.md (four parts: industry / us / why differ / reversibility)
```

If verdict=HALT (data missing or stale), invoke `/analyze-competitors` first — DO NOT silently pass. If verdict=BLOCK, the spec cannot reach BASELINED until either (a) spec aligns with at least one competitor pattern, OR (b) `## Compensating Control` section is present with all 4 fields (per CC-01..CC-03). See `references/templates/compensating-control.md`. The gate engine reads from a structured data file at gate-time and NEVER triggers web research — the `validate-no-web-fetch-in-gate.sh` validator locks that contract in (per WI-142).

**Tier 2: Feature-level detail (only when Tier 1 points you here)**

Drill into a specific feature spec only when journeys or personas reference it,
or when you need to understand the exact ACs, entity schema, or user stories for
the domain this feature idea touches.

```
4. Feature specs — glob docs/specs/features/ (or project equivalent)
   → Only read specs that Tier 1 pointed you to (e.g., the journey covers
     "flash deals" so read the flash deals spec for AC detail)
   → Check the AC coverage table — are there gaps the feature idea would fill?
   → Check Spec-Code Sync Status — are there known drifts?

5. Recent work — git log --oneline -20
   → Is someone already building something related?
```

**Tier 3: Codebase reality (only when Tier 1+2 leave questions unanswered)**

Read actual source code when you need to verify whether something that's specced
actually exists, whether a UI component works as described, or whether two things
that sound different are actually the same entity.

```
6. Codebase reality — grep/read the actual source code
   → Does the feature already exist in code? Is it partially built?
   → Who calls it? What entity does it use? What security/validation does it go through?
   → Is there existing backend infrastructure the feature can leverage?
   → Are there two components creating the same entity under different names?
```

**Why this order matters:** Journeys and personas encode product decisions —
who the users are, what flows matter, what gaps have been identified. Feature
specs encode detailed requirements. Code encodes what actually got built.
Starting with code leads to "what exists?" thinking. Starting with journeys
leads to "what should exist for each user?" thinking — which catches gaps
like a consumer journey with no producer counterpart.

**The codebase is the ground truth.** Specs, journeys, and personas describe intent. The
code describes reality. When investigating whether a feature idea is new, partially built,
or a duplicate, ALWAYS read the relevant source files. Grep for entity names, function calls,
component imports. The answer to "who has this problem?" and "what do they do today?" is
often sitting in the code — don't ask the user questions the codebase can answer.

For example: if the user asks about a "last hour offer" feature, don't ask "does an owner
flow for this exist?" — grep for the component, read it, check what entity it creates,
check if it goes through validation, check what other pages create the same entity. Then
present findings: "This component exists at X, it creates Y entity, but it bypasses Z
validation that the existing consumer-side page relies on."

### Concept deduplication and industry pattern matching

When the context scan finds code related to the feature idea, check for concept
fragmentation — the same underlying entity or user goal served by multiple components
under different names. Two components that create the same entity ARE the same feature,
no matter what they're called.

**Identify the industry pattern.** Most product features map to well-known patterns.
Name the pattern and check whether the product covers all sides:

| Pattern | Producer | Consumer | System |
|---------|----------|----------|--------|
| Flash deals / time-limited offers | Seller creates (validation, plan gating) | Buyer browses, claims (limits, confirmation) | Notifications, expiry cleanup |
| Referral programs | Referrer shares (tracking) | Referee signs up (attribution) | Double-sided rewards, fraud |
| Booking / reservations | Provider sets availability | Customer books (confirmation) | No-show, waitlist |
| Reviews / ratings | Customer writes (purchase gate) | Owner responds (moderation) | Aggregate scoring |
| Loyalty / points | System awards on purchase | Customer redeems (balance check) | Tier progression, expiry |
| Content publishing | Creator publishes (draft→live) | Audience discovers (feed, search) | Moderation, analytics |

When you identify the pattern, present the diagnosis — don't ask the user to tell you:
"This is a flash deals pattern. The consumer side (browse + claim) is fully built. The
producer side (create deal) exists as a broken shortcut that bypasses your security
pipeline. The system side (notifications) is built but unreachable because the producer
path doesn't go through it. This isn't a new feature — it's a pipeline fix."

**If two names exist for the same concept**, recommend consolidation: "The codebase calls
this 'Flash Offer' (entity + consumer page) and 'Last Hour Offer' (producer button).
These are the same thing — a flash deal. Pick one name. The entity name usually wins."

This analysis replaces business questions Q1-Q3 when the codebase already contains the
answer. Don't interrogate the user about problems the code reveals.

### What to do with findings

**If a feature spec already exists** for this exact idea:
Surface it. "There's already a spec for this: `docs/specs/features/feature-matching.md`. Want to
update it, or is your idea different from what's described there?"

**If a persona match is found:**
Name it. "This sounds like it serves P1 (Collaborator) — their top pain is finding reliable
partners. Their challenges doc mentions [specific pain]." Use this to inform Q1 (who) and Q2
(how bad) — don't re-ask what the persona already answers.

**If a journey overlaps:**
Flag it. "J02 (daily matching loop) covers the flow you're describing. This feature would
extend/modify that journey at the [specific scenario] step."

**If vision alignment is unclear:**
Be honest. "The vision doc focuses on trust-based matchmaking. This idea is about [X] — how
does it connect to the core mission?"

**If nothing exists:**
Say so. "No existing specs, personas, or journeys relate to this idea. Starting fresh."

---
