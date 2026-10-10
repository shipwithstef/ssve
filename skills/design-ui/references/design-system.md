## The Design System

The design system is a foundational artifact — created once, evolved as features demand new patterns.

**Path:** `docs/specs/design-system.md`

### If The Design System Does Not Exist

Before designing any feature's UI, the design system must exist. If `docs/specs/design-system.md` is missing, create it first. This is a one-time bootstrapping step.

**Design system creation process:**

1. **Read the vision** (`docs/specs/vision.md`) for brand personality, target audience, and product positioning
2. **Read existing personas** for context on user demographics and technical comfort
3. **Survey the codebase** for any existing UI patterns, CSS variables, theme files, or component libraries already in use
4. **Create the design system** inspired by established systems (Google Material, Stitch, Tailwind) but adapted to this project's specific brand and needs

**Design system structure:**

```markdown
# Design System

**Project:** [Project name from vision]
**Created:** [YYYY-MM-DD]
**Last Updated:** [YYYY-MM-DD]

---

## Brand Personality

[Voice, tone, visual feeling — derived from vision.md]

---

## Color Palette

### Semantic Colors

| Token | Light Mode | Dark Mode | Usage |
|-------|-----------|-----------|-------|
| `color.primary` | [value] | [value] | Primary actions, brand accent |
| `color.primary.hover` | [value] | [value] | Hover state for primary elements |
| `color.secondary` | [value] | [value] | Secondary actions, supporting elements |
| `color.surface` | [value] | [value] | Card and container backgrounds |
| `color.surface.elevated` | [value] | [value] | Elevated surfaces (modals, dropdowns) |
| `color.background` | [value] | [value] | Page background |
| `color.text.primary` | [value] | [value] | Primary text |
| `color.text.secondary` | [value] | [value] | Supporting text, labels |
| `color.text.disabled` | [value] | [value] | Disabled element text |
| `color.error` | [value] | [value] | Error states, destructive actions |
| `color.warning` | [value] | [value] | Warning states, caution |
| `color.success` | [value] | [value] | Success states, confirmation |
| `color.info` | [value] | [value] | Informational states |
| `color.border` | [value] | [value] | Default borders |
| `color.border.focus` | [value] | [value] | Focus ring |

---

## Typography

| Token | Value | Usage |
|-------|-------|-------|
| `type.display` | [font, size, weight, line-height] | Hero headings |
| `type.h1` | [font, size, weight, line-height] | Page titles |
| `type.h2` | [font, size, weight, line-height] | Section headings |
| `type.h3` | [font, size, weight, line-height] | Subsection headings |
| `type.body` | [font, size, weight, line-height] | Body text |
| `type.body.small` | [font, size, weight, line-height] | Secondary body text |
| `type.caption` | [font, size, weight, line-height] | Labels, metadata |
| `type.code` | [font, size, weight, line-height] | Code blocks, monospace |
| `type.button` | [font, size, weight, line-height, letter-spacing] | Button labels |

---

## Spacing

| Token | Value | Usage |
|-------|-------|-------|
| `spacing.xs` | [value] | Tight spacing (between related elements) |
| `spacing.sm` | [value] | Small spacing (within components) |
| `spacing.md` | [value] | Medium spacing (between components) |
| `spacing.lg` | [value] | Large spacing (between sections) |
| `spacing.xl` | [value] | Extra large spacing (page-level separation) |

### Base Unit

[Define the base unit and scale — e.g., 4px base with multiples]

---

## Breakpoints

| Token | Value | Target |
|-------|-------|--------|
| `breakpoint.sm` | [value] | Mobile |
| `breakpoint.md` | [value] | Tablet |
| `breakpoint.lg` | [value] | Desktop |
| `breakpoint.xl` | [value] | Wide desktop |

---

## Component Patterns

### Button

| Variant | Usage | Tokens |
|---------|-------|--------|
| Primary | Main actions | `color.primary`, `type.button`, `spacing.sm` padding |
| Secondary | Supporting actions | `color.secondary`, `type.button` |
| Ghost | Tertiary actions, links | `color.text.primary`, `type.button` |
| Destructive | Delete, remove | `color.error`, `type.button` |

| State | Visual Change |
|-------|--------------|
| Default | [base appearance] |
| Hover | [change] |
| Active/Pressed | [change] |
| Disabled | [change — opacity, color] |
| Loading | [spinner, disabled interaction] |
| Focus | [focus ring using `color.border.focus`] |

### Card
[Pattern definition]

### Modal
[Pattern definition]

### Form Input
[Pattern definition]

### Navigation
[Pattern definition]

[Additional patterns as needed by the project]

---

## Motion (if used)

Record only tokens used by the approved interaction; write "none" when an immediate state change is clearer.

| Token | Value | Usage |
|-------|-------|-------|
| `motion.duration.fast` | [value] | Micro-interactions (hover, toggle) |
| `motion.duration.normal` | [value] | Standard transitions (expand, collapse) |
| `motion.duration.slow` | [value] | Large transitions (page enter, modal open) |
| `motion.easing.default` | [value] | Standard easing curve |
| `motion.easing.enter` | [value] | Elements entering view |
| `motion.easing.exit` | [value] | Elements leaving view |

### Motion Principles

- [When to animate vs. instant transitions]
- [Reduced motion behavior — what changes when `prefers-reduced-motion` is set]
- [Maximum animation duration — nothing blocks interaction longer than X]

---

## Dark Mode Strategy (only when supported)

[Approach: automatic from system preference / user toggle / both]
[Surface elevation in dark mode — how depth is communicated without shadows]
[Image treatment — dimming, border handling]
[Color adjustments beyond token swaps — contrast considerations]

---

## Accessibility Baseline

[Minimum contrast ratios]
[Focus indicator style]
[Touch target minimum sizes]
[Font size minimums]
```

**The design system is NOT a copy of Material or Tailwind.** It is inspired by established systems but adapted to the project's brand, audience, and technical stack. Read the vision and personas before choosing values.

### If The Design System Exists

Read it. Every UI design decision must reference design system tokens. If the feature requires a pattern that does not exist in the design system, extend the design system first, then use the new tokens in the feature UI design.
