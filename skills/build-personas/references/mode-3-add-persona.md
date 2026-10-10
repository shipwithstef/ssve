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
