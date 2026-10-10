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
