### Step 0a: Ensure DESIGN.md Exists (Brand + Aesthetic Foundation)

```bash
cat DESIGN.md 2>/dev/null || cat docs/specs/DESIGN.md 2>/dev/null
```

If no DESIGN.md exists, create it at project root using the **Design Consultation** process below. This defines the design direction ABOVE the token level — brand personality, aesthetic approach, motion principles, accessibility baseline.

If DESIGN.md already exists, read it and ensure all UI design decisions align.

#### Design Consultation Process (creating DESIGN.md)

##### Phase 1: Product Context Gathering

Before making any design decisions, understand what you are designing for.

1. **Read the README** — what does this product claim to be? What problem does it solve?
2. **Read package.json** (or equivalent manifest) — what frameworks, UI libraries, and dependencies are already in play?
3. **Scan existing components** — `ls src/components/ 2>/dev/null`, `ls app/ 2>/dev/null`, `ls pages/ 2>/dev/null`. Are there existing patterns, a component library, or a blank slate?
4. **Read any existing design artifacts** — `docs/specs/vision.md`, personas, prior DESIGN.md attempts
5. **Summarize the product context:**
   - What is this product?
   - Who uses it? (demographics, technical comfort, context of use)
   - What stage is it at? (greenfield, MVP, scaling, redesign)
   - What constraints exist? (framework, existing UI, brand guidelines)

Before web research, read these if available:
- `docs/specs/domain-profile.md` — domain-native visual expectations (density, trust cues, terminology emphasis, audience sophistication level)
- `docs/specs/analyze-competitors.md` — competitor visual language and component patterns already documented

Research only gaps not covered by these artifacts.

##### Phase 2: Research the Landscape

For product UI, inspect real product screens that serve the same user job. Reuse current competitor evidence where it names the relevant screen; otherwise inspect accessible live screens, product tours, or documented captures. Record the page/screen URL or capture, its job match, and the specific hierarchy, density, state, or interaction choice that helps or harms that job. A company's marketing homepage is not evidence for an in-app task. Use enough relevant comparisons to challenge the chosen direction, without a product-count quota; if access is limited, name the evidence gap. Marketing pages use the landing bank and `landing-page` instead.

Then perform a **3-layer synthesis:**

- **Layer 1 — Familiar behavior:** Which patterns on same-job screens help users find the action or interpret the data? Keep them when they serve this job.
- **Layer 2 — Observed alternatives:** Which relevant screens solve the same task better, and what evidence shows the improvement? A style trend alone is not evidence.
- **Layer 3 — Product-specific choice:** Given this product's users and data, what should be retained, simplified, or changed so the task is clearer, faster, or more trustworthy?

##### Phase 3: Complete Design Proposal

Present the design direction as one coherent package. For each dimension, mark decisions as **SAFE** (following convention) or **RISK** (deliberate departure from norms).

Propose a departure from convention only when it improves this product's task or positioning enough to justify its implementation and learning cost. Zero departures is valid when the existing pattern serves users best. For each chosen difference, name the compared screen, the expected user outcome, and the simplest implementable change.

| Dimension | Description |
|-----------|-------------|
| **AESTHETIC** | Overall visual direction tied to this screen's job; cite relevant real product screens when they inform it. SAFE or RISK. |
| **DECORATION** | Border-radius, shadows, gradients, textures, dividers. How "decorated" vs "flat" is the UI? SAFE or RISK. |
| **LAYOUT** | Grid system, max-width, sidebar vs top-nav, content density. SAFE or RISK. |
| **COLOR** | Primary, secondary, accent, and semantic colors in supported themes. SAFE or RISK. |
| **TYPOGRAPHY** | Existing or proposed display, body, UI, and code treatment with a readability and product-fit rationale; no font-change quota. SAFE or RISK. |
| **SPACING** | Base unit, scale, density philosophy. SAFE or RISK. |
| **MOTION** | State whether motion helps the task; if used, specify easing, duration, and reduced-motion behavior. SAFE or RISK. |

Example RISK with rationale:
> **HIERARCHY — RISK:** Put the exception list before summary cards because the operator must resolve failed items first; the current screen and a captured same-job product screen show how summaries can hide the next action.

##### Font Guidance

Start with the product's existing type system. Change it only when the current typography weakens comprehension, density, accessibility, or the approved brand direction. Compare candidates using rendered content from this screen, including real labels and data; explain readability, licensing, load cost, and consistency with existing surfaces. Familiar fonts are acceptable when they serve the job. No font is rejected or adopted solely because it appears often in generated UI.

##### Phase 4: Generate Font + Color Preview

After the proposal is confirmed, generate an HTML preview page showing:
- Typography specimens (display, heading, body, UI, code) at actual sizes
- Color palette swatches with hex values and contrast ratios
- Every theme the product actually supports, side by side when there is more than one

Open in browser for visual confirmation before writing DESIGN.md.

#### DESIGN.md Structure

The final DESIGN.md at project root must follow this structure:

```markdown
# Design: [Project Name]

**Generated:** YYYY-MM-DD
**Last Updated:** YYYY-MM-DD

---

## Product Context

[What this product is, who it serves, what stage it's at, what constraints exist.
This section is the "why" behind every design decision below.]

---

## Aesthetic Direction

[Overall visual approach. SAFE/RISK classification.
Reference 2-3 existing products with similar aesthetic goals.
What makes this product feel like THIS product and not a generic template.]

---

## Typography

| Role | Font | Weight | Size | Line Height | Usage |
|------|------|--------|------|-------------|-------|
| Display | [specific font] | [weight] | [size] | [lh] | Hero headings, marketing |
| Body | [specific font] | [weight] | [size] | [lh] | Paragraphs, descriptions |
| UI | [specific font] | [weight] | [size] | [lh] | Buttons, labels, nav items |
| Data | [specific font] | [weight] | [size] | [lh] | Tables, metrics, numbers |
| Code | [specific font] | [weight] | [size] | [lh] | Code blocks, CLI output |

**Font stack:** `[primary], [fallback], [system fallback]`
**Loading strategy:** [Google Fonts / self-hosted / variable font]

---

## Color

**Approach:** [Monochromatic, complementary, analogous, split-complementary — and why]

### Core Palette

| Token | Light Mode | Dark Mode | Usage |
|-------|-----------|-----------|-------|
| `color.primary` | #XXXXXX | #XXXXXX | Primary actions, brand accent |
| `color.primary.hover` | #XXXXXX | #XXXXXX | Hover state |
| `color.secondary` | #XXXXXX | #XXXXXX | Secondary actions |
| `color.accent` | #XXXXXX | #XXXXXX | Highlights, badges, emphasis |
| `color.background` | #XXXXXX | #XXXXXX | Page background |
| `color.surface` | #XXXXXX | #XXXXXX | Card/container backgrounds |
| `color.surface.elevated` | #XXXXXX | #XXXXXX | Modals, dropdowns |
| `color.text.primary` | #XXXXXX | #XXXXXX | Primary text |
| `color.text.secondary` | #XXXXXX | #XXXXXX | Supporting text |
| `color.border` | #XXXXXX | #XXXXXX | Default borders |

### Semantic Colors

| Token | Light Mode | Dark Mode | Usage |
|-------|-----------|-----------|-------|
| `color.error` | #XXXXXX | #XXXXXX | Error states |
| `color.warning` | #XXXXXX | #XXXXXX | Warning states |
| `color.success` | #XXXXXX | #XXXXXX | Success states |
| `color.info` | #XXXXXX | #XXXXXX | Informational |

---

## Spacing

**Base unit:** [e.g., 4px]
**Scale:** [e.g., 4, 8, 12, 16, 24, 32, 48, 64, 96]
**Density philosophy:** [compact / comfortable / spacious — and why]

| Token | Value | Usage |
|-------|-------|-------|
| `spacing.xs` | [value] | Tight (related elements) |
| `spacing.sm` | [value] | Small (within components) |
| `spacing.md` | [value] | Medium (between components) |
| `spacing.lg` | [value] | Large (between sections) |
| `spacing.xl` | [value] | Extra large (page-level) |

---

## Layout

| Property | Value | Rationale |
|----------|-------|-----------|
| Grid system | [e.g., 12-column CSS Grid] | [why] |
| Max content width | [e.g., 1200px] | [why] |
| Border radius | [e.g., 8px default, 12px cards, 9999px pills] | [why] |
| Sidebar width | [if applicable] | [why] |
| Content measure | [max line length for readability] | [why] |

---

## Motion

**Approach:** [restrained / expressive — and why]

| Property | Value | Usage |
|----------|-------|-------|
| Easing (default) | [e.g., cubic-bezier(0.4, 0, 0.2, 1)] | Standard transitions |
| Easing (enter) | [e.g., cubic-bezier(0, 0, 0.2, 1)] | Elements entering |
| Easing (exit) | [e.g., cubic-bezier(0.4, 0, 1, 1)] | Elements leaving |
| Duration (fast) | [e.g., 100ms] | Micro-interactions |
| Duration (normal) | [e.g., 200ms] | Standard transitions |
| Duration (slow) | [e.g., 350ms] | Large transitions |

**Reduced motion:** where animation is used, provide an immediate or appropriately reduced transition.

---

## Decisions Log

| # | Decision | Classification | Rationale |
|---|----------|---------------|-----------|
| 1 | [e.g., Put unresolved exceptions before summary cards] | RISK | [helps the operator find the next action; cite a same-job screen] |
| 2 | [e.g., Retain the existing card pattern] | SAFE | [familiar behavior already supports the task] |
| 3 | [e.g., Keep the existing navigation] | SAFE | [no observed journey failure justifies a change] |

---

## Dark Mode Strategy

[Default or toggle? Semantic color tokens? Which surfaces change?
How is elevation communicated without shadows?]

---

## Accessibility Baseline

[WCAG target: AA minimum. Focus indicators. Touch targets ≥44px.
Minimum font sizes. Screen reader strategy. Contrast ratios.]
```

### Step 9: Assemble The UI Design Document

Write the complete UI design to `docs/specs/ui/<feature-name>.md`:

```markdown
# UI Design: [Feature Name]

**Feature Spec:** `docs/specs/features/<feature-name>.md`
**UX Design:** `docs/specs/ux/<feature-name>.md`
**Design System:** `docs/specs/design-system.md`
**Status:** DRAFT (pending G3 review)
**Type:** [Feature | Enabler | Integration]
**Created:** [YYYY-MM-DD]

---

## Component Specifications

[From Step 2]

---

## Design Token Usage

[From Step 3]

---

## Visual Hierarchy

[From Step 4]

---

## Dark Mode

[From Step 5]

---

## Animation and Motion

[From Step 6]

---

## Component States

[From Step 7]

---

## Responsive Layout

[From Step 8]

---

## Design System Changes

[New tokens or patterns added to the design system for this feature]
[If none: "No design system changes required."]

---

## AC Traceability

| AC | Persona(s) | Screen | Component(s) | States Covered | Responsive? |
|----|------------|--------|-------------|---------------|-------------|
| [AC-ID] | [P2 / docs/specs/personas/P2.md] | [Screen] | [Components involved] | [Which states render this AC] | [Yes — all viewports / Partial] |

---

## Open Questions

[Any visual design decisions that need stakeholder input]
```


### Step 2: Component Specifications

For each screen in the UX design's screen inventory, specify the components that render it. Each element from the information hierarchy becomes a component with specific design tokens.

```markdown
## Component Specifications

### S1: [Screen Name]

#### Layout

[Overall layout structure — grid, flex, regions]
[Reference design system spacing tokens]

#### Components

| Element | Component | Variant | Tokens | Notes |
|---------|-----------|---------|--------|-------|
| [Primary action] | Button | Primary | `color.primary`, `type.button`, `spacing.sm` | Full width on mobile |
| [Result list] | CardList | Default | `spacing.md` gap, `color.surface` cards | Virtualized for large lists |
| [Filter panel] | CollapsiblePanel → BottomSheet (mobile) | Outlined | `color.border`, `spacing.lg` padding | Collapses below `breakpoint.md` |
| [Page title] | Heading | H1 | `type.h1`, `color.text.primary` | — |
| [Supporting text] | Text | Body | `type.body`, `color.text.secondary` | Max-width for readability |
```

**Rules:**
- Every element from the UX information hierarchy (Step 5) must have a component row
- Every token reference must exist in the design system (or be added to it)
- Component names should describe function, not implementation (e.g., "CardList" not "div.flex.flex-col")
- Note responsive behavior changes per component (from UX responsive strategy)

### Step 3: Design Token Usage

Map exactly which design system tokens each screen uses. This ensures the design system is sufficient and the feature is consistent.

```markdown
## Design Token Usage

### Tokens Used

| Token | Used In | Purpose |
|-------|---------|---------|
| `color.primary` | S1 primary button, S2 active tab | Brand action color |
| `color.surface` | S1 cards, S2 panels | Container backgrounds |
| `spacing.md` | S1 card list gap, S2 form fields | Standard component separation |
| `type.h1` | S1 page title | Screen heading |
| `motion.duration.normal` | S1 card expand, S2 panel toggle | Standard interaction transitions |

### New Tokens Required

| Token | Proposed Value (Light) | Proposed Value (Dark) | Justification |
|-------|----------------------|----------------------|---------------|
| [New token] | [Value] | [Value] | [Why this feature needs it] |
```

**If new tokens are required:** Add them to `docs/specs/design-system.md` before using them in the UI design. The design system grows through feature demands, not speculation.

### Step 4: Visual Hierarchy

For each screen, map how the information hierarchy (from UX) translates to visual weight. Priority 1 elements must be visually dominant; lower priority elements must be visually subordinate.

```markdown
## Visual Hierarchy

### S1: [Screen Name]

| Priority | Element | Visual Treatment | Size/Weight | Contrast |
|----------|---------|-----------------|-------------|----------|
| 1 | [Primary content] | [How it dominates — larger, bolder, higher contrast] | `type.h1` / `type.display` | High against `color.background` |
| 2 | [Secondary content] | [How it supports — medium weight, standard size] | `type.body` | Standard against `color.surface` |
| 3 | [Tertiary content] | [How it recedes — smaller, lighter] | `type.body.small` / `type.caption` | Lower, using `color.text.secondary` |
| Nav | [Navigation] | [Persistent but not dominant] | `type.button` | Medium |
| Meta | [Metadata] | [Minimal visual footprint] | `type.caption` | Low, using `color.text.disabled` or `color.text.secondary` |
```

**Rules:**
- Visual hierarchy must match information hierarchy from UX design — do not promote tertiary content visually
- Use typography scale, color, and spacing to create hierarchy — not decoration
- Every priority level must be visually distinguishable from adjacent levels

### Step 5: Supported Themes

Specify each theme the product actually supports. When dark mode exists, describe its screen-specific behavior and contrast; do not add a new theme to satisfy a template.

```markdown
## Dark Mode

### Strategy

[Reference design system dark mode strategy]

### Screen-Specific Dark Mode Behavior

| Screen | Element | Light Mode | Dark Mode | Notes |
|--------|---------|-----------|-----------|-------|
| S1 | Card surface | `color.surface` (light value) | `color.surface` (dark value) | Elevation communicated via border, not shadow |
| S1 | Primary button | `color.primary` (light) | `color.primary` (dark) | May need adjusted contrast ratio |
| S1 | Images/avatars | Full brightness | Dimmed to 85% | Prevent eye strain from bright images on dark background |
| S2 | Dividers | `color.border` (light) | `color.border` (dark) | May need opacity adjustment |
```

**Rules:**
- Every component from Step 2 must work in each supported theme.
- Check text and control contrast in each supported theme; when dark mode exists, describe its screen-specific surface treatment.
- Do not require a dark-mode design or capture for a product that does not support it.
- Images may need treatment (dimming, border) to avoid visual harshness

### Step 6: Animation and Motion

Specify motion only for state transitions or interactions where it improves feedback or comprehension. Record "none" for immediate transitions; omit unused animation rows.

```markdown
## Animation and Motion

### State Transitions

| Screen | Transition | Animation | Duration | Easing | Reduced Motion Fallback |
|--------|-----------|-----------|----------|--------|------------------------|
| S1 | LOADING → POPULATED | None; show content immediately | — | — | Same behavior |
| S1 | POPULATED → ACTION_PENDING | Existing loading indicator, if needed | Existing token if animated | Existing token if animated | Static loading indicator |

### Micro-Interactions

| Element | Interaction | Animation | Duration | Easing |
|---------|------------|-----------|----------|--------|
| Button | Hover/focus | Existing visible state; animation only if useful | Existing token if animated | Existing token if animated |
| Toggle | State change | Immediate state update or justified transition | Existing token if animated | Existing token if animated |
```

**Rules:**
- Specify motion only where it clarifies a state change, provides useful feedback, or is part of the approved interaction; an immediate transition is valid.
- Every actual animation must have a reduced-motion fallback and must not block interaction.
- Use existing design-system motion tokens for animations that remain.

### Step 7: Component States

For every interactive component in the feature, specify all visual states.

- **Interactive UI Controls (Tabs, Accordions, Dropdowns, etc.):** Design specifications must define the exact visual states (e.g., active, hover, selected/expanded) and map these states to required HTML/ARIA attributes (`aria-selected="true"`, `aria-expanded="false"`, etc.). The design must explicitly state which panel content is visible for each state and which panels are hidden/unmounted, ensuring mutual exclusion (exactly one active panel at a time). Clicking a control must change more than just button styling — the active panel must change accordingly. Missing panel visibility mapping or ARIA state documentation → **G3 FAIL** (cite this rule to the review-gate).

```markdown
## Component States

### Primary Button (S1, S2)

| State | Background | Text | Border | Shadow | Cursor | Additional |
|-------|-----------|------|--------|--------|--------|------------|
| Default | `color.primary` | `color.text.on-primary` | none | `shadow.sm` | pointer | — |
| Hover | `color.primary.hover` | `color.text.on-primary` | none | `shadow.md` | pointer | Visible state; no animation required |
| Active | `color.primary.active` | `color.text.on-primary` | none | `shadow.none` | pointer | Visible pressed state |
| Disabled | `color.primary` at 40% opacity | `color.text.disabled` | none | none | not-allowed | — |
| Loading | `color.primary` | hidden | none | `shadow.sm` | wait | Spinner centered |
| Focus | `color.primary` | `color.text.on-primary` | `color.border.focus` 2px | `shadow.sm` | pointer | Focus ring visible |
| Error | `color.error` | `color.text.on-error` | none | `shadow.sm` | pointer | Context-dependent |

### Card (S1)

| State | Background | Border | Shadow | Additional |
|-------|-----------|--------|--------|------------|
| Default | `color.surface` | `color.border` 1px | `shadow.sm` | — |
| Hover | `color.surface.elevated` | `color.border` 1px | `shadow.md` | Slight lift |
| Selected | `color.primary` at 8% opacity | `color.primary` 2px | `shadow.md` | Check indicator |
| Disabled | `color.surface` at 60% opacity | `color.border` 1px | none | Content dimmed |
| Loading | `color.surface` | `color.border` 1px | `shadow.sm` | Skeleton shimmer |

[Repeat for every interactive component]
```

**Rules:**
- Every interactive component must specify: default, hover, active, disabled, focus, loading states at minimum
- Error state is required for components that can enter an error condition (forms, submissions)
- All values must reference design system tokens
- Disabled and loading states must prevent interaction (cursor, pointer-events)

### Step 8: Responsive Layout Specifics

Translate the UX responsive strategy (behavior) into specific layout decisions (implementation-ready).

```markdown
## Responsive Layout

### Grid System

| Viewport | Columns | Gutter | Margin | Max Content Width |
|----------|---------|--------|--------|-------------------|
| Small (`< breakpoint.md`) | [N] | `spacing.sm` | `spacing.md` | 100% |
| Medium (`breakpoint.md` — `breakpoint.lg`) | [N] | `spacing.md` | `spacing.lg` | [value] |
| Large (`>= breakpoint.lg`) | [N] | `spacing.md` | auto (centered) | [value] |

### Screen Layouts

#### S1: [Screen Name]

**Small viewport:**
```
┌──────────────────┐
│ [Header]         │
├──────────────────┤
│ [Primary content]│
│ (full width)     │
├──────────────────┤
│ [Filters — as    │
│  bottom sheet]   │
├──────────────────┤
│ [Results list]   │
│ (single column)  │
├──────────────────┤
│ [Bottom nav]     │
└──────────────────┘
```

**Large viewport:**
```
┌──────────────────────────────────────┐
│ [Header + Navigation]                │
├──────────┬───────────────────────────┤
│ [Filter  │ [Primary content]         │
│  Panel]  │                           │
│          │ [Results grid — 2-3 cols] │
│          │                           │
│ (sidebar)│                           │
└──────────┴───────────────────────────┘
```

[Repeat for each screen]

### Component Responsive Behavior

| Component | Small | Medium | Large |
|-----------|-------|--------|-------|
| Navigation | Bottom tab bar | Bottom tab bar | Side navigation |
| Card grid | 1 column, full width | 2 columns | 3 columns |
| Filter panel | Bottom sheet (toggle) | Side panel (collapsible) | Side panel (persistent) |
| Modal | Full screen | Centered, 80% width | Centered, max 600px |
| Form fields | Stacked, full width | Stacked, full width | Inline where logical |
```

**Rules:**
- Every screen from the UX screen inventory must have a small and large viewport layout
- Layouts must preserve all ACs on all viewport sizes
- Use ASCII diagrams for layout — these are structural, not pixel-perfect
- Reference breakpoint tokens from the design system


### Step 10: AC Traceability Check

Walk through every AC from the feature spec and verify the UI design addresses it visually.

```markdown
### AC Traceability

| AC | Persona(s) | Screen | Component(s) | States Covered | Responsive? |
|----|------------|--------|-------------|---------------|-------------|
| MATCH-01 | P2 | S3 | CardList, MatchCard | POPULATED, hover, selected | Yes — 1/2/3 col grid |
| MATCH-02 | P2 | S2 | SkeletonLoader → CardList | LOADING → POPULATED | Yes — same layout all viewports |
| MATCH-03 | P2 | S2 | ErrorBanner, RetryButton | ERROR | Yes — full width all viewports |
```

**Gate:** Every AC must have visual specifications. If an AC cannot be visually specified:
- The UX design may be incomplete (feedback loop to `design-ux`)
- The design system may lack required patterns (extend it first)
- The AC may be purely backend (confirm with spec — backend ACs skip UI design)

For user/admin-facing ACs, the `Persona(s)` column must cite concrete persona
IDs/paths. Generic labels such as `customer`, `admin`, `all users`, or `PASS`
do not satisfy the UI trace.

### Step 12: Update Feature Spec Status

On G3 PASS, update the feature spec:

```markdown
**Status:** DESIGNED
```

Add a UI Design reference:

```markdown
## UI Design

**Artifact:** `docs/specs/ui/<feature-name>.md`
**Design System:** `docs/specs/design-system.md`
**G3 Review:** PASS — [date]
```
