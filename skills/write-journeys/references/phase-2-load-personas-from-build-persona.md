# Phase 2: Load Personas (from build-personas) — detail

Moved verbatim from SKILL.md (progressive disclosure).

## Phase 2: Load Personas (from build-personas)

Personas are NOT built by write-journeys. They come from the `build-personas` skill
which produces rich, structured persona files in `docs/specs/personas/`.

### Step 1: Check for persona files

```bash
ls docs/specs/personas/P*.md 2>/dev/null
```

**If personas exist:** Read all persona files. Each one contains:
- Who they are (portrait, not user story)
- Their 2026 world (what they've tried, what failed, their skepticism)
- What they came for (success/failure by timeframe)
- Patience budget (friction tolerance, deal-breakers)
- Trust triggers (what earns/loses trust at each journey stage)
- Feature touchpoints (which specs matter to them)
- Skill implications (specific guidance for write-journeys)

Use the **Skill Implications > write-journeys** section directly — it tells you
what this persona's journey should emphasize and what alternative paths matter.

Use the **Trust Triggers** table to inform Layer 3 analysis — at each journey step,
check: "Is this step earning or losing trust for this persona?"

Use the **Patience Budget** to identify where the journey needs to be faster or
where adding steps would cause this persona to bounce.

**If personas DON'T exist:** Warn the user:
"No persona files found at docs/specs/personas/. Run `/build-personas` first
to create structured personas. Without them, journeys will be generic and won't
capture different user types' experiences. Continue with basic persona extraction
from specs?" If the user says yes, fall back to extracting basic persona info
from feature specs (name, entry point, features touched) — but flag that these
are shallow and should be replaced by proper build-personas output.

### Step 2: Map personas to journeys

For each persona, identify which journey archetype they need:
- **Activation journey** — how THIS persona goes from signup to first value
- **Core loop** — what THIS persona does repeatedly
- **Conversion** — what makes THIS persona upgrade/commit

Different personas may share a journey (e.g., all personas go through onboarding)
but experience it differently. The persona's skepticism profile and patience budget
determine which alternative paths and which Layer 3 findings matter most.

### Step 3: Persona-aware scenario writing

When writing scenarios, always know WHICH persona you're writing for. Reference
the persona's context at each step:

- A cautious first-timer at the matching step needs to see safety signals
- An eager apprentice at the same step is excited and needs momentum
- A skill holder at that step is evaluating quality of potential partners

The same feature step feels different to different personas. The journey should
capture this through alternative paths and Layer 3 annotations.

---
