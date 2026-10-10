## Design Shotgun (variant exploration)

Before finalizing component specs, explore multiple visual directions through a structured variant generation process.

### Step 1: Context Gathering (5 Dimensions)

Before generating any variants, gather context across five dimensions:

| Dimension | Question | Source |
|-----------|----------|--------|
| **Who** | Who is the user? Demographics, technical comfort, aesthetic expectations. | Personas, vision.md |
| **Job to be done** | What is the user trying to accomplish on this screen? What is the primary action? | Feature spec, UX design |
| **What exists** | Is there an existing UI, design system, DESIGN.md, or brand guidelines to align with? | Codebase scan, DESIGN.md |
| **User flow** | Where did the user come from? Where do they go next? What is the emotional arc? | UX flows, state machines |
| **Edge cases** | Empty states, error states, overflowing content, long strings, first-time vs returning user. | UX design states, ACs |

Do not skip this step. Variants generated without context are generic.

### Step 1.5: Production-Derived Mock Parity Gate

This gate is mandatory whenever the UI work changes an existing component,
existing screen, shared component, or route already present in the codebase.
Do not generate standalone greenfield mocks until this gate is complete.

Create a **Production-Derived Mock Parity Ledger** in the UI design artifact
(`docs/specs/ui/<feature>.md`) or as
`docs/specs/ui/<feature>-mock-parity-ledger.md` with these fields:

| Field | Required evidence |
|---|---|
| Affected existing component/screen | Exact component/screen name and current role in the product |
| Production source paths | File paths for the component, route, styles, design tokens, and parent containers |
| Current-state evidence | Current screenshot, visual baseline, or code-grounded render description with file:line citations |
| Intended final-state mock/evidence | Final mock or rendered target tied to the same component and state set |
| Affected usages/routes | Every route, parent surface, modal/sheet/toast usage, and responsive context using the component |
| Spec ACs and journeys covered | AC IDs, journey IDs, and state-machine steps that exercise the component |
| Required states and viewports | Loading, empty, error, focused, disabled, overflow, permission, and breakpoint states required by spec/journeys |
| Known exclusions with rationale | Any skipped usage/state/viewport and why it is out of scope |

Parity requirements:
- The existing component must be visibly present in the mock. A mock that
  replaces it with an unrelated layout does not satisfy this gate.
- Show the pre-change current state and intended final state for the same
  component/route/state whenever the change touches existing UI.
- Ground typography, spacing, colors, density, chrome, responsive behavior, and
  component structure in the production source paths and design tokens.
- Account for every spec, journey, state, usage, and viewport before proceeding.
- If current screenshots or baselines are unavailable, run `track-visuals`
  baseline/review first, or record a blocking gap with the exact missing capture.

**Hard fail:** generic "inspired by" mocks, isolated Dribbble-style frames,
or HTML variants that do not include the affected existing component are not
valid evidence for existing-component UI changes.

**Generic-design guard:** Use AP-22 (`references/anti-patterns.md`) as a critique lens, not a keyword ban. For each prominent pattern, ask which step of this screen's user job it helps, what current or same-job product screen supports the choice, and what would fail if it were removed. Replace generic copy, decorative structure, or borrowed layouts that have no answer. A familiar pattern can be the best choice when it makes the task clearer or faster.

### Step 2: Taste Memory

Before generating new concepts, read prior approved designs:

```bash
cat docs/specs/decisions/approved.json 2>/dev/null
ls docs/specs/decisions/taste-*.md 2>/dev/null
```

If prior approvals exist, bias toward the user's established preferences — font choices, density preferences, color temperature, decoration level. Taste compounds across sessions. A user who consistently picks minimal variants should not be shown maximalist options unless explicitly exploring a new direction.

### Step 2b: Aesthetic Configuration

Set density, visual expression, and motion from the user's task, content shape, existing design system, accessibility needs, and any stated preference. If a numeric dial helps compare directions, choose and explain it for this product; there is no default creativity, variance, or motion score. A restrained screen can be distinctive through hierarchy, terminology, and precise use of real data.

### Step 3: Concept Generation

Explore genuinely different text-only directions when the product decision is still open; include retaining the current pattern for an existing screen. Use only as many variants as needed to expose a meaningful tradeoff. Each direction must state the user job and expected effect on task success, comprehension, or trust, not merely change colors or shapes.

Bad (variations):
- Concept A: Blue buttons with rounded corners
- Concept B: Blue buttons with square corners
- Concept C: Teal buttons with rounded corners

Good (same-job directions for an operations screen):
- Concept A: **Exceptions first** — unresolved issues lead; the owner can act before scanning the full schedule.
- Concept B: **Timeline first** — shifts lead in time order; conflicts appear where they affect the plan.
- Concept C: **Summary first** — current status and next action lead; details stay one step away.

Each direction should name the user's job, information priority, relevant same-job screen evidence, expected task outcome, and resulting visual treatment. Typography, color, and density support that choice rather than define the concept.

### Step 4: Concept Confirmation

Present the text concepts to the user BEFORE generating HTML. This is a gate.

```
For [screen name], the user needs to [specific job]. The current screen and [same-job reference] suggest these meaningful choices:

A) [Choice tied to the primary action and expected outcome]
B) [Different hierarchy or interaction tied to the same outcome]
C) [Retain current pattern, if it already serves the job]

Which consequential direction should guide the rendered comparison?
```

In auto mode: P0 selects which concepts to generate with justification. In interactive mode: wait for user confirmation.

### Step 5: Variant Generation

For each confirmed concept, generate a self-contained HTML/CSS file:

- If Step 1.5 applies, the HTML/CSS must render the production-derived current
  component context and the intended final state side by side or in directly
  comparable states. Do not generate generic standalone mocks.
- Enough real HTML/CSS to render the affected screen and compare its meaningful states — not pseudocode or an isolated inspiration frame
- Inline styles or a `<style>` block — no external dependencies except Google Fonts
- Real content (not lorem ipsum) — use plausible data for the product's domain
- Responsive: looks reasonable at both 375px and 1200px
- Render the empty, error, overflow, or other states that the spec and current journey make material for this screen

```bash
# Generate variants
write docs/specs/ui/variants/<screen>-A-<job-choice>.html
write docs/specs/ui/variants/<screen>-B-<job-choice>.html
# Add another variant only when it exposes a consequential choice.

# Open comparison board in browser
gstack browse docs/specs/ui/variants/<screen>-A-<job-choice>.html
gstack browse docs/specs/ui/variants/<screen>-B-<job-choice>.html
```

### Step 6: Comparison and Selection

Open variants in browser (gstack browse) side by side for comparison.

- User picks direction (interactive) or P0 picks with justification (auto)
- Selection should note specific elements to keep, not just "I like B"
- Mixing is allowed: "B's layout with A's typography"

### Step 7: Iteration Loop

After selection:

1. **Capture feedback** — what to keep, what to change, what to combine from other variants
2. **Save taste preferences** — write approved direction to `docs/specs/decisions/approved.json`:

```json
{
  "screen": "<screen-name>",
  "date": "YYYY-MM-DD",
  "chosen_direction": "B — Dashboard",
  "keep": ["dense layout", "monospace accents", "compact sidebar"],
  "change": ["soften border-radius", "warmer background"],
  "combine_from": { "A": ["serif headings"] },
  "rejected": ["C — too playful for enterprise users"]
}
```

3. **Iterate or finalize** — generate a refined variant incorporating feedback, open in browser for verification. Repeat until approved.
4. **Log to decisions** — append to `docs/specs/decisions/` so future design shotgun runs inherit these preferences.

Taste preferences compound across runs. The first design shotgun for a project explores broadly; subsequent runs narrow based on established taste.

### Quick Reference

Variants should be genuinely different directions (not color swaps):
- Variant A: minimal/clean — lots of whitespace, muted colors
- Variant B: dense/functional — data-forward, compact layout
- Variant C: bold/branded — strong typography, distinctive personality
- etc.
