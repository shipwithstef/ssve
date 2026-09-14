# Design System: TrendLearner

**Version:** 1.0.0
**Status:** DRAFT
**Mode:** Bootstrap (no prior design system)

---

## 1. Brand Personality

Data-driven, trustworthy, minimal, developer-oriented. TrendLearner is a tool for serious practitioners who ship production models and read papers -- not a consumer app. The aesthetic is closer to a well-built CLI dashboard than a SaaS marketing site. Information density is a feature, not a problem. Dark-mode-first. No decorative illustrations, no empty-state graphics, no gamification chrome.

---

## 2. Color Palette

All colors defined as semantic tokens. Dark mode is the primary design target; light mode is derived.

| Token | Light Mode | Dark Mode | Usage |
|-------|-----------|-----------|-------|
| `color.primary` | `#0E7C86` | `#2DD4BF` | Primary actions, active states, links |
| `color.primary.hover` | `#0A5F67` | `#5EEAD4` | Hovered primary elements |
| `color.secondary` | `#6366F1` | `#818CF8` | Secondary actions, accents |
| `color.surface` | `#FFFFFF` | `#1E1E2E` | Card backgrounds, panels |
| `color.surface.elevated` | `#F8FAFC` | `#2A2A3C` | Modals, slide-overs, dropdowns |
| `color.background` | `#F1F5F9` | `#11111B` | Page background |
| `color.text.primary` | `#0F172A` | `#E2E8F0` | Headings, body text |
| `color.text.secondary` | `#475569` | `#94A3B8` | Descriptions, metadata |
| `color.text.disabled` | `#94A3B8` | `#475569` | Disabled labels, placeholders |
| `color.border` | `#E2E8F0` | `#2A2A3C` | Dividers, card borders |
| `color.error` | `#DC2626` | `#F87171` | Validation errors, broken links |
| `color.warning` | `#D97706` | `#FBBF24` | Stale data, prerequisite warnings |
| `color.success` | `#059669` | `#34D399` | Completions, valid API keys |
| `color.info` | `#2563EB` | `#60A5FA` | Informational banners, hints |
| `color.trend.hot` | `#DC2626` | `#F87171` | Signal strength 80-100 |
| `color.trend.rising` | `#D97706` | `#FBBF24` | Signal strength 50-79 |
| `color.trend.stable` | `#2563EB` | `#60A5FA` | Signal strength 25-49 |
| `color.trend.fading` | `#6B7280` | `#6B7280` | Signal strength 0-24 |

---

## 3. Typography Scale

**Font stack:** `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
**Code font:** `'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace`

| Token | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| `type.h1` | 32px | 700 | 1.25 | Page titles (Trend Dashboard, Skill Profile) |
| `type.h2` | 24px | 600 | 1.33 | Section headings (Why Trending, Learning Path) |
| `type.h3` | 20px | 600 | 1.4 | Card titles (trend name, resource title) |
| `type.h4` | 16px | 600 | 1.5 | Subsection labels, filter group headings |
| `type.body` | 14px | 400 | 1.6 | Default body text, descriptions, explanations |
| `type.body.medium` | 14px | 500 | 1.6 | Emphasized body (signal scores, metadata values) |
| `type.small` | 12px | 400 | 1.5 | Timestamps, source counts, secondary metadata |
| `type.caption` | 11px | 400 | 1.45 | Badges, status labels, keyboard shortcut hints |
| `type.code` | 13px | 400 | 1.5 | Technical terms, API key fields, code references |

---

## 4. Spacing System

Base unit: **4px**. All spacing uses multiples of the base unit.

| Token | Value | Usage |
|-------|-------|-------|
| `spacing.xs` | 4px | Inline icon-to-text gap, badge padding |
| `spacing.sm` | 8px | Compact element padding, filter chip gap |
| `spacing.md` | 16px | Card padding, grid gap, section margins |
| `spacing.lg` | 24px | Section spacing, panel padding |
| `spacing.xl` | 32px | Page-level section breaks |
| `spacing.2xl` | 48px | Page top/bottom margins |

**Border radius:** `radius.sm` (4px), `radius.md` (8px), `radius.lg` (12px), `radius.full` (9999px for pills/badges).

---

## 5. Component Patterns

### TrendCard
Displays a single trending topic. Contains: trend title (`type.h3`), one-sentence summary (`type.body`), SignalStrengthIndicator, PlatformIcon row, StatusChip, and relevance rating controls. Background: `color.surface`. Border-left color derived from trend status. Padding: `spacing.md`. Desktop renders as an information-dense row; mobile as a stacked card.

### LearningPathCard
Displays a learning resource within a path. Contains: resource title (`type.h3`), format tag (paper/tutorial/video/repo), difficulty SkillBadge, time estimate (`type.small`), external link icon, completion checkbox, and prerequisite warning (if applicable). Completed state: reduced opacity (0.7) with strikethrough on title.

### SkillBadge
Pill-shaped label showing a skill and level. Background: level-dependent tint (beginner: `color.info` at 15% opacity, intermediate: `color.primary` at 15%, advanced: `color.secondary` at 15%). Text: `type.caption`, font-weight 500. Border-radius: `radius.full`.

### SignalStrengthIndicator
Horizontal bar (height 4px) filled proportionally to the signal score (0-100). Fill color maps to trend status tokens. Always accompanied by a numeric score label (`type.body.medium`) for accessibility. Width: 80px on desktop, 48px on mobile.

### PlatformIcon
16x16 monochrome icons for Twitter/X, Reddit, Hacker News, LinkedIn, YouTube. Default: `color.text.secondary`. Hover: `color.text.primary` with platform tooltip. Arranged in a horizontal row with `spacing.xs` gap.

### FilterBar
Horizontal row of filter chips. Each chip: `type.small`, `radius.full`, border `color.border`, padding `spacing.xs` vertical and `spacing.sm` horizontal. Active chip: `color.primary` background at 15% opacity, `color.primary` text. Scrollable horizontally on mobile. Categories: platform, difficulty, recency, subfield.

### ProgressBar
Thin horizontal bar (height 6px, `radius.full`) showing learning path completion percentage. Track: `color.border`. Fill: `color.primary`. Label: percentage in `type.small` to the right.

### StatusChip
Pill label for trend status. Uses `type.caption`, `radius.full`. Color-coded: hot (`color.trend.hot`), rising (`color.trend.rising`), stable (`color.trend.stable`), fading (`color.trend.fading`). Background at 15% opacity, text in full token color.

---

## 6. Motion Principles

All animations are subtle and purposeful. No decorative or attention-seeking motion.

| Interaction | Duration | Easing | Property |
|-------------|----------|--------|----------|
| Hover state transitions | 150ms | ease-out | background-color, border-color, color |
| Slide-over panel (S2) enter | 250ms | ease-out | transform (translateX) |
| Slide-over panel (S2) exit | 200ms | ease-in | transform (translateX) |
| Modal (S7) enter | 200ms | ease-out | opacity, transform (scale from 0.95) |
| Modal (S7) exit | 150ms | ease-in | opacity |
| Skeleton loading pulse | 1500ms | ease-in-out | opacity (0.5 to 1.0, loop) |
| Completion checkbox | 200ms | ease-out | background-color, stroke (checkmark draw) |
| Filter chip toggle | 150ms | ease-out | background-color, color |
| Progress bar fill | 300ms | ease-out | width |
| Toast notification enter | 250ms | ease-out | transform (translateY), opacity |
| Toast notification exit | 200ms | ease-in | opacity |

**Reduced motion:** Respect `prefers-reduced-motion`. When active, replace all transitions with instant state changes (duration: 0ms).

---

## 7. Dark Mode Strategy

Dark mode is the default. Light mode is opt-in via a toggle in the navigation header. All component styles reference semantic tokens (Section 2), never raw color values. Theme switching swaps the token map; no component-level conditional logic required.

**Key rules:** Elevated surfaces are lighter than base surfaces (depth via luminance, not shadow). Shadows removed in dark mode. Chart colors maintain WCAG AA contrast in both modes. Trend status colors are tuned per-mode for readability.

---

## 8. Responsive Breakpoints

| Token | Breakpoint | Target |
|-------|-----------|--------|
| `breakpoint.mobile` | < 768px | Phones, small tablets in portrait |
| `breakpoint.tablet` | 768px -- 1024px | Tablets, small laptops |
| `breakpoint.desktop` | > 1024px | Laptops, monitors |

**Layout strategy:**
- Mobile: single-column, stacked cards, collapsed navigation (hamburger), touch-optimized targets (min 44px).
- Tablet: single-column with denser cards, side panel at 50% width for S2.
- Desktop: information-dense rows for S1 (P1 preference), persistent sidebar navigation, S2 panel at 40% width, full metadata visibility.

**Max content width:** 1200px on desktop, centered with `spacing.lg` horizontal padding.
