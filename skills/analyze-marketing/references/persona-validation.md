# Persona Validation

Stress-test the marketing context by constructing virtual buyer personas from mined data and having them interrogate the messaging. This is NOT a generic interview — every persona and every question is grounded in actual insights, audience segments, and pain points already extracted.

## Why This Exists

Generic marketing interviews ask "Who is your target audience?" and get generic answers back. Persona Validation flips it: we already know the audience from mining. Now we simulate those people reading our marketing and asking "Does this actually speak to me?"

This surfaces:
- Gaps where no insight addresses a real persona concern
- Weak spots where insights exist but the copy wouldn't convince that persona
- Language mismatches where we use our words instead of theirs
- Missing objection handling for specific persona types
- Touchpoint failures where the messaging breaks down at a specific stage

---

## Step 1: Construct Personas from Mined Data

Read the tracker and context doc. The persona construction is entirely data-driven — every trait maps to a specific section of the marketing context or a mined insight.

### 1A: Identify Persona Candidates

Scan these sources to find distinct buyer types:

| Source | What to look for |
|--------|-----------------|
| **Target Audience** (Section 2) | Primary, secondary, tertiary audiences — each is a persona candidate |
| **Objections** (Section 7) | Each distinct objection pattern implies a different buyer psychology |
| **Anti-Personas** (Section 7) | The boundary cases — "almost not a fit" personas test your messaging edges |
| **Switching Dynamics** (Section 4) | Different Push/Habit/Anxiety combinations = different buyer types |
| **Audience segments in tracker** | Each `audience_segment` with 3+ active insights has enough data for a persona |

Construct **3-5 personas**. Fewer than 3 misses important segments. More than 5 dilutes focus. Typical distribution:
- 1-2 primary audience personas (different sub-motivations within the main audience)
- 1 skeptic/burned persona (maps to the strongest objections)
- 1 newcomer/edge persona (boundary of target — tests whether messaging is inclusive enough)
- 0-1 power user persona (only if the product has distinct advanced features)

### 1B: Build Each Persona Profile

For each persona, fill in ALL sections below. Every trait must cite its data source — a foundational section number, an insight ID, or a documented pain point. If you can't cite a source, mark the trait `[ASSUMED — needs validation]`.

---

#### PERSONA PROFILE TEMPLATE

```markdown
## [Memorable Name] — [Segment Label]

### Identity
- **Label:** A memorable 2-3 word name (e.g., "Stuck Solo Sam", "Burned Founder Beth")
- **Segment:** Which audience_segment from the tracker (e.g., "all_users", "new_builders")
- **Self-description:** How they'd describe themselves in one sentence — NOT how we describe them.
  Pull from Customer Language (Section 9). Example: "I'm a marketer who taught
  myself to code with Claude" vs our label "new user."
- **Role/Title:** Their actual title or identity (founder, freelancer, side-project builder, etc.)
  Source: Target Audience (Section 2)

### Current Situation (before finding us)
- **Daily reality:** What does a typical day/week look like for them right now?
  Source: Problems & Pain Points (Section 3/4) — map the abstract pain to a concrete routine.
- **Tools they use today:** What tools, platforms, and workflows are they already using?
  Source: Competitive Landscape (Section 5) — these ARE the competitors from this persona's POV.
- **Team/solo status:** Working alone? Small team? Looking for a team?
  Source: Target Audience (Section 2)
- **Budget/resources:** What are they currently spending? What's their willingness to pay?
  Source: Goals (Section 12) + Proof Points (Section 10/11) for price sensitivity signals
- **Time pressure:** How urgent is this? Are they browsing or desperate?
  Source: Problems (Section 3/4) — "cost of inaction" section reveals urgency level

### Psychology
- **Primary motivation:** The ONE thing that would make them act. Not a list — the single strongest pull.
  Source: Switching Dynamics (Section 4) → Pull forces, ranked by relevance to this persona.
- **Core fear:** What are they most afraid of? Loss of time? Being scammed? Looking foolish?
  Source: Switching Dynamics (Section 4) → Anxiety forces + Objections (Section 7)
- **Past experience:** What have they tried before and what happened? Be specific.
  Source: Problems (Section 3/4) → "why current solutions fall short" + Competitive Landscape (Section 5)
- **Trust threshold:** What evidence would they need before signing up? A testimonial? A free trial?
  A case study? A friend's recommendation?
  Source: Proof Points (Section 10/11) — which proof type would resonate with THIS persona?
- **Decision style:** Do they research deeply (comparison pages, reviews, Reddit)? Act on impulse
  (saw a tweet, signed up)? Need consensus (show partner/team before committing)?
  Source: Infer from Target Audience + Anti-Persona traits. Skeptics research deeply.
  Newcomers act on social proof. Power users evaluate methodically.
- **Risk tolerance:** How much are they willing to bet on an unknown product?
  Source: Switching Dynamics (Section 4) → Anxiety + Habit forces. High Habit + High Anxiety = low risk tolerance.
- **Emotional state when searching:** Frustrated? Curious? Desperate? Skeptical? Hopeful?
  Source: Problems (Section 3/4) → "emotional tension" + Switching Dynamics → Push forces.

### Information Diet
- **Where they hang out:** Specific communities, platforms, subreddits, Discord servers, Twitter circles.
  Source: Competitive Landscape (Section 5) → indirect competitors are often communities.
  Also infer from Target Audience — technical people = HN/Reddit/GitHub, non-technical = Twitter/LinkedIn/TikTok.
- **Who they trust:** Influencers, publications, peers, or institutions they'd listen to.
  Source: Proof Points (Section 10/11) — notable customers/logos reveal the trust graph.
- **How they discover new tools:** Search? Social? Word of mouth? Product Hunt? App stores?
  Source: Infer from persona type. Skeptics search + compare. Newcomers follow recommendations.
- **Search terms they'd use:** 3-5 actual queries they'd type into Google or an AI search.
  Source: Customer Language (Section 9) → "how they describe the problem" + Competitive Landscape
  for comparison queries (e.g., "[competitor] alternative").

### Buying Journey
- **Trigger event:** The SPECIFIC moment that pushes them from "I should probably..." to actually searching.
  Source: Problems (Section 3/4) → timeline of pain. A specific failure, a deadline, a conversation.
  Be concrete: "Their third prototype failed in production" not "They got frustrated."
- **First search:** What do they do first? Google? Ask a friend? Check Twitter?
  Source: Information Diet above → pick the most likely first action.
- **Evaluation criteria:** What do they compare products on? Price? Features? Trust? Speed?
  Source: Differentiation (Section 6) — our differentiators should map to their criteria.
  If they don't, that's a gap.
- **Decision factors:** What tips them from "interesting" to "I'll try this"?
  Source: Switching Dynamics (Section 4) → Pull forces, Proof Points (Section 10/11)
- **Blockers:** What would stop them at the last step — even if everything else looks good?
  Source: Objections (Section 7) + Switching Dynamics → Anxiety forces

### Relationship to Our Product
- **Features that matter:** Which 3-5 features/insights would this persona care about most?
  Source: Scan all active insights. Filter by `audience_segment` match OR by relevance to
  this persona's motivation/fear. List by insight ID.
- **Features they'd ignore:** Which features are irrelevant or even off-putting to them?
  Source: Inverse of above — features targeting a different segment.
- **Their language for our product:** How would they describe what we do to a friend?
  Source: Customer Language (Section 9) — but filtered through this persona's vocabulary level.
  A technical founder says it differently than a non-technical newcomer.
- **What proof convinces them:** The specific proof type that matches their trust threshold.
  Source: Proof Points (Section 10/11), mapped to Psychology → Trust threshold above.
- **Their top objection:** The ONE objection most likely to stop this persona.
  Source: Objections (Section 7) — pick the one that maps to their Core Fear.
- **Switching cost for them:** What do they lose by trying us? Time? Money? Comfort of current approach?
  Source: Switching Dynamics (Section 4) → Habit + Anxiety specific to this persona.

### Success Definition
- **What "this worked" looks like:** Concrete outcome they'd describe to a friend.
  Source: Product Overview (Section 1) → primary outcome + Target Audience → Jobs to be done.
  Frame in their words, not ours.
- **Time horizon:** How long are they willing to wait for results? Days? Weeks? Months?
  Source: Problems (Section 3/4) → urgency level + persona type.
- **How they'd measure ROI:** What metric would they personally use?
  Source: Goals (Section 12) → conversion actions, but translated to this persona's framing.
```

---

### 1C: Validate Persona Completeness

After constructing each persona, run this checklist:

| Check | Pass | Fail |
|-------|------|------|
| Every trait has a source citation (section # or insight ID) | All cited | Any `[ASSUMED]` tags present |
| Persona feels like a real person, not a marketing segment | You could write their internal monologue | It reads like a demographic bullet list |
| Trigger event is a concrete moment, not an abstract frustration | "Their third cold DM got no response" | "They got frustrated with outreach" |
| Search terms are things a real person would type | "find collaborator who actually codes" | "co-founder matching platform comparison" |
| Their language for our product differs from our marketing language | Uses their vocabulary | Parrots our one-liner |
| At least one trait surprised you during construction | Something non-obvious emerged | Everything was predictable |

If any check fails, go back and deepen that section. The "surprise" check is the most important — if constructing the persona taught you nothing new, the persona is too shallow to be useful for validation.

### 1D: Store Personas in Tracker

After construction, save persona profiles to the tracker under a `"personas"` key:

```json
{
  "personas": [
    {
      "id": "persona-001",
      "name": "Stuck Solo Sam",
      "segment": "all_users",
      "created": "2026-03-05T00:00:00Z",
      "profile_summary": "Solo user, 4 months in, shipped a prototype that's stalling...",
      "trigger_event": "Third cold DM about finding a collaborator got no response",
      "top_features": ["feature-matching-001", "feature-matching-002", "feature-conversation-001"],
      "top_objection": "I'll waste weeks chatting with people who aren't serious",
      "search_terms": ["find collaborator for AI project", "user partner", "cobuilder matching"]
    }
  ]
}
```

This persists across sessions. On subsequent Mode 8 runs, load existing personas and check if new insights require updates rather than rebuilding from scratch.

---

## Step 2: Persona Interrogation

For each persona, simulate them encountering our marketing at three touchpoints. Use the persona's psychology, information diet, and buying journey to make each question authentic to HOW that persona would actually think.

**Touchpoint A: First Encounter (homepage / ad / social post)**

The persona just found us for the first time. They're at whatever emotional state you defined. Ask from their perspective:

| Question | What it tests | Source for answer |
|----------|--------------|-------------------|
| "What does this actually do? In plain words?" | One-liner clarity | Product Overview (Section 1) |
| "Is this for someone like me?" | Audience signal specificity | Target Audience (Section 2) + insights with matching audience_segment |
| "Why should I believe this works?" | First-encounter proof | Proof Points (Section 10/11) — does the FIRST thing they see have proof? |
| "What's the catch? What's it cost me?" | Pricing/commitment transparency | Goals (Section 12) + monetization insights |
| "Have I heard of this before?" | Brand awareness / social proof | Proof Points → notable customers, testimonials |

**Touchpoint B: Evaluation (features page / comparison / deeper reading)**

They're interested but comparing options. Their decision style (from Psychology) determines HOW they evaluate:

| Question | What it tests | Source for answer |
|----------|--------------|-------------------|
| "How is this different from [their current approach]?" | Competitive positioning — use the SPECIFIC alternative from their Current Situation | Competitive Landscape (Section 5) + Differentiation (Section 6) |
| "Does this solve MY specific problem?" | Pain-to-solution mapping for THIS persona's trigger event | Problems (Section 3/4) mapped to relevant insights |
| "What if it doesn't work out?" | Exit / risk mitigation messaging | Switching Dynamics → Anxiety + relevant insights about clean exits |
| "Who else like me uses this?" | Segment-specific social proof | Proof Points filtered to this persona's segment |
| "How long until I see results?" | Time-to-value clarity | Success Definition → time horizon vs. what we promise |

**Touchpoint C: Decision (signup / pricing / commitment)**

They're ready to act but need final reassurance. Their blockers (from Buying Journey) determine what stops them:

| Question | What it tests | Source for answer |
|----------|--------------|-------------------|
| "What do I get without paying?" | Free tier / trial clarity | Monetization insights |
| "What's the REAL cost? Time, learning curve, not just money" | Total cost of adoption | Switching Dynamics → Habit (what they give up) |
| "Can I try before I commit to anything serious?" | Low-risk entry point | Relevant onboarding/trial insights |
| "What happens to my data / work / ideas if I leave?" | Data portability / idea safety | Privacy/safety insights |
| "What's my first step, literally, right now?" | CTA clarity and friction | Onboarding insights + Goals (Section 12) → conversion action |

**Important:** Don't ask all questions for all personas. Filter based on the persona's psychology:
- Skeptic personas get extra Touchpoint B questions (they evaluate deeply)
- Impulse personas may skip Touchpoint B entirely (test if A→C works)
- Newcomer personas get extra "what does this mean?" questions at every touchpoint

---

## Step 3: Score Coverage

For each persona question, check against existing insights and context:

| Score | Meaning | Action |
|-------|---------|--------|
| **Strong** | A weight >= 70 insight directly answers this question in language this persona would accept | None — this angle is covered |
| **Partial** | An insight exists but doesn't address the persona's specific framing, vocabulary, or concern | Copy refinement — rewrite insight in persona's voice |
| **Gap** | No insight covers this — needs new mining or foundation update | Queue for Mode 1/2 mining with persona context |
| **Wrong Voice** | Answer exists but uses OUR language, not the persona's language | Easy win — rewrite using Customer Language section |
| **Wrong Proof** | Answer exists but the proof type doesn't match what this persona trusts | Need different proof — testimonial vs stat vs case study |

---

## Step 4: Generate Actionable Output

For each persona, produce a full scorecard:

```markdown
### [Persona Name] — [Segment]

**Profile summary:** [2-3 sentences from the full profile]
**Trigger:** [Their specific trigger event]
**Decision style:** [How they evaluate — research-heavy / impulse / consensus]
**Top objection:** [The ONE objection most likely to stop them]

#### Coverage Scorecard

| Touchpoint | Question | Score | Source / Gap |
|------------|----------|-------|-------------|
| A: First encounter | "What does this do?" | Strong | Context: one-liner |
| A: First encounter | "Is this for me?" | Gap | No insight targets [segment] at first encounter |
| B: Evaluation | "How is this different from Discord?" | Strong | feature-matching-003 |
| B: Evaluation | "How long until I see results?" | Partial | No time-to-value claim exists |
| C: Decision | "What if they steal my idea?" | Strong | feature-collab-004 |
| C: Decision | "What's my first step?" | Wrong Voice | feature-onboarding-001 uses "GitHub OAuth" — persona says "sign up with my GitHub" |

**Coverage: 4/6 Strong, 1 Partial, 1 Gap, 1 Wrong Voice**

**Recommended actions:**
1. [Specific, actionable — e.g., "Mine a new insight for new_builders addressing first-encounter recognition"]
2. [Specific — e.g., "Rewrite feature-onboarding-001: change 'GitHub OAuth authentication' to 'sign up with your GitHub in 30 seconds'"]
3. [Specific — e.g., "Add time-to-value claim: 'First match in under 3 minutes' (already in feature-matching-005, needs to surface earlier)"]
```

---

## Step 5: Prioritize Gaps

After all personas are evaluated, create a unified gap list:

**Priority order:**
1. **Cross-persona gaps** — same gap appears for 2+ personas = systemic blind spot
2. **Primary persona, Touchpoint A gaps** — your most important audience can't understand what you do on first encounter
3. **Skeptic persona gaps** — if the skeptic isn't convinced, word-of-mouth dies
4. **Wrong Voice issues** — easiest wins, just rewrite
5. **Wrong Proof issues** — need different proof type, not new content
6. **Single-persona gaps at Touchpoint C** — localized decision-stage issues

```markdown
## Persona Validation Summary — [date]

### Critical Gaps (cross-persona or primary Touchpoint A)

| # | Gap | Personas Affected | Touchpoint | Action |
|---|-----|-------------------|------------|--------|
| 1 | No insight targets new_builders at first encounter | Newcomer + Edge | A | Mine feature-onboarding for newcomer-specific angle |
| 2 | Time-to-value not stated anywhere | All 4 personas | B | Surface feature-matching-005 ("3-minute first match") in homepage copy |

### Quick Wins (rewrite only, no new mining)

| # | Issue | Persona | Current | Suggested |
|---|-------|---------|---------|-----------|
| 1 | Wrong voice | Newcomer | "GitHub OAuth authentication" | "Sign up with your GitHub in 30 seconds" |
| 2 | Wrong voice | Skeptic | "Cryptographic disclosure receipts" | "Legal-timestamped proof that you shared your idea first" |

### Mining Needed

| # | Gap | Target Feature | Persona Context |
|---|-----|---------------|-----------------|
| 1 | No newcomer-specific onboarding angle | feature-onboarding | New user who's never used a matching platform |

### Stats
- **Overall coverage:** X% of persona questions have Strong coverage
- **Quick wins:** N wrong-voice/wrong-proof issues (rewrite only)
- **Mining needed:** N gaps require new insight extraction
- **Personas validated:** N/N constructed
```

---

## Integration with Other Modes

| Output | Feeds into | How |
|--------|-----------|-----|
| Gaps needing new insights | Mode 1/2 (mining) | Queue feature + persona context as input — mine FROM the persona's perspective |
| Wrong Voice issues | Copy refinement exception (Incremental rules) | Rewrite insight text using persona's vocabulary |
| Foundation gaps | Mode 4 (Foundation) | Add to "Suggested Foundation Updates" |
| Wrong Proof issues | Mode 4 (Foundation) | Update Proof Points section with persona-appropriate proof types |
| Persona profiles | Tracker `"personas"` key | Persist for reuse across sessions — don't rebuild every time |
| Cross-persona gaps | Mode 6 (Combinations) | Systemic gaps often reveal missing cross-feature narratives |

---

## When NOT to Run

- Before at least 8 features have been mined (not enough data for realistic personas)
- During active mining sessions (run after mining, not during)
- If the context doc is in draft state (Mode 4 hasn't been run yet)
- If the foundational sections are incomplete (Sections 2, 3, 4, 5, 7, 9 are required minimum)
