# UI Design: Trend-to-Learning Recommendation

**Feature:** feature-trend-learning
**Design System:** design-system.md (v1.0.0)
**Status:** DRAFT

---

## 1. Component Specifications

### S1: Trend Dashboard

The dashboard renders a ranked list of 5-10 trending AI/ML topics. Desktop uses information-dense rows (P1: "feels like Hacker News"). Mobile uses stacked TrendCards.

| Information Element | Component | Tokens | Notes |
|---------------------|-----------|--------|-------|
| Trend topic title | `type.h3` text within TrendCard | `color.text.primary` | Clickable; opens S2 slide-over |
| One-sentence summary | `type.body` text | `color.text.secondary` | Truncated to 1 line on mobile, 2 on desktop |
| Signal strength (1-100) | SignalStrengthIndicator + numeric label | `color.trend.*` per range, `type.body.medium` | Bar + number; never color-only [TRN-02] |
| Source platform icons | PlatformIcon row | `color.text.secondary`, `spacing.xs` gap | Collapsed to count ("3 sources") on mobile |
| Trend status | StatusChip | `color.trend.*`, `type.caption` | hot/rising/stable/fading pill |
| Subfield filters | FilterBar | `color.primary` active, `color.border` inactive | Horizontal chips; collapsed dropdown on mobile [TRN-04] |
| Last-refreshed timestamp | `type.small` text + icon | `color.text.secondary`; `color.warning` if stale | Banner position below FilterBar [TRN-05] |
| Relevance rating | Thumbs up/down icon buttons | `color.text.secondary`; `color.primary` on active | Inline per trend row; swipe on mobile [TRN-06] |

**Layout:** TrendCard grid with `spacing.md` gap. Desktop: single-column information-dense rows, max-width 1200px. Tablet: single-column, denser cards. Mobile: single-column stacked cards.

**Loading:** 5 skeleton TrendCards with pulse animation. **Empty:** "No trends yet. Data is loading from your configured sources." + link to S5. **Stale:** Yellow warning banner: "Last refreshed X hours ago" with manual refresh button.

### S2: Trend Detail (Slide-over Panel)

Opens when a trend is clicked on S1. Desktop: 40% width side panel sliding from right. Tablet: 50% width. Mobile: full-screen overlay.

| Information Element | Component | Tokens | Notes |
|---------------------|-----------|--------|-------|
| Trend title | `type.h2` | `color.text.primary` | Panel heading; receives focus on open |
| Trend summary | `type.body` | `color.text.primary` | 2-3 sentences |
| "Why trending" explanation | `type.body` in bordered section | `color.surface.elevated` background, `color.text.primary` | Must cite specific sources and numbers [TRN-03] |
| Source signal breakdown | Table: platform, mention count, recency | `type.small`, PlatformIcon | Sorted by count descending |
| "Start learning" button | Primary action button | `color.primary` bg, white text, `radius.md` | Full-width on mobile; right-aligned on desktop [LRN-01] |
| Related trends | List of linked trend titles | `type.body`, `color.primary` for links | Max 3 items |

**ACTION_PENDING state (path generation):** Button replaced with spinner + "Generating learning path..." text (2-5 second expected wait). Progress uses `color.primary`.

**Error state:** Inline error message below button: "Learning path generation failed. [Retry]". Identifies which service failed (social API vs. LLM).

### S3: Learning Path

Full page showing an ordered list of 3-8 learning resources for a trend.

| Information Element | Component | Tokens | Notes |
|---------------------|-----------|--------|-------|
| Path title (trend name) | `type.h1` | `color.text.primary` | Page heading |
| Path progress | ProgressBar + percentage label | `color.primary` fill, `type.small` | Below heading |
| Resource list | Ordered LearningPathCard stack | `spacing.md` gap | Prerequisite order [LRN-02] |
| Resource title | `type.h3` within LearningPathCard | `color.text.primary`; `color.primary` on hover | Links to external resource [LRN-03] |
| Difficulty level | SkillBadge | Level-tinted background, `type.caption` | beginner/intermediate/advanced |
| Format tag | StatusChip variant | `color.info` tint, `type.caption` | paper/tutorial/video/repo |
| Time estimate | `type.small` with clock icon | `color.text.secondary` | e.g., "~2 hours" |
| Prerequisite warning | Warning banner within card | `color.warning` icon + `type.small` text | Shown when prereqs unmet [LRN-05]; links to prereq resource |
| Completion toggle | Checkbox | `color.primary` when checked, `color.border` unchecked | 44px tap target on mobile [SKL-02] |
| External link | Arrow-out icon button | `color.text.secondary`; `color.primary` on hover | Opens resource in new tab |
| Resource feedback | "Helpful?" thumbs after completion | `color.text.secondary` | Appears after resource opened or completed [TRN-07] |

**Completed resource appearance:** Card opacity 0.7, title has strikethrough, checkbox filled with `color.success`.

**Desktop layout:** Table-like rows with all metadata visible in columns. Tablet/Mobile: stacked cards with metadata below title.

### S4: Skill Profile

| Information Element | Component | Tokens | Notes |
|---------------------|-----------|--------|-------|
| Page heading | `type.h1` | `color.text.primary` | "Your Skills" |
| Skill summary | Grid of skill category cards | `color.surface`, `spacing.md` gap | Each card: category name, ProgressBar, level label |
| Self-assessed vs. inferred | Dual indicators per skill | `color.primary` (self), `color.secondary` (inferred) | Side-by-side bars [SKL-03] |
| Editable skill selectors | Dropdown or slider per category | `color.surface.elevated`, `color.border` | beginner/intermediate/advanced/expert [SKL-01] |
| Recent completions | LearningPathCard variant list | `type.body`, `color.text.secondary` timestamps | Last 10 completions with dates [SKL-04] |

**Empty state (first visit):** Inline form prompting self-assessment. "Select your level for each skill category to personalize recommendations." Categories displayed as a grid of selectors.

**Desktop layout:** Radar/spider chart + grid. Mobile: vertical list with ProgressBars (P4 preference).

### S5: Setup / Configuration

| Information Element | Component | Tokens | Notes |
|---------------------|-----------|--------|-------|
| Wizard step indicator | Step bar (1-2-3-4) | `color.primary` active, `color.border` pending | Horizontal on desktop, vertical on mobile |
| Deployment mode selector | Radio card group | `color.surface.elevated`, `color.primary` selected border | Self-hosted free / Private / Operator [DEP-01/02/03] |
| API key inputs | Monospace input fields (`type.code`) | `color.surface`, `color.border`; `color.error` on invalid | Inline validation with check/cross icons |
| Platform toggles | Toggle switches with PlatformIcons | `color.primary` enabled, `color.border` disabled | Default: all 5 enabled |
| Refresh cadence | Dropdown selector | `type.body`, `color.surface.elevated` | Default: 24h [TRN-05] |
| Cost estimate | `type.small` info text | `color.info` | Displayed per API key: estimated monthly cost |

**Validation error:** Field border turns `color.error`. Inline message below in `type.small`, `color.error`.

### S6: Team Overview (Admin-only)

| Information Element | Component | Tokens | Notes |
|---------------------|-----------|--------|-------|
| Aggregate skill map | Bar chart / heatmap | `color.primary`, `color.secondary` fills | Distribution per category; no individual names [SKL-05] |
| Team activity summary | Metric cards (completions, active paths) | `type.h2` for numbers, `type.body` for labels | `color.surface.elevated` cards [SKL-06] |
| Popular trends this week | Ranked list with TrendCard compact variant | `type.body`, SignalStrengthIndicator | Top 5 trends viewed by team |

**Access denied state:** Centered message: "Team overview requires admin access." `color.text.secondary`, no retry action.

### S7: Resource Feedback (Modal)

| Information Element | Component | Tokens | Notes |
|---------------------|-----------|--------|-------|
| Modal overlay | Dimmed backdrop (opacity 0.5) | `color.background` at 50% opacity | Closes on Escape or backdrop click |
| Prompt text | `type.h3` | `color.text.primary` | "Was this resource helpful?" |
| Rating buttons | Two icon buttons (thumbs up / down) | `color.surface.elevated`, `color.success`/`color.error` on select | 44px min touch target |
| Optional text input | Textarea | `color.surface`, `color.border` | "Any feedback? (optional)" |
| Submit button | Primary button | `color.primary` | Disabled until a rating is selected |

---

## 2. Visual Hierarchy

### S1: Trend Dashboard
1. **Highest weight:** Trend titles -- `type.h3`, `color.text.primary`, full contrast. Scanning anchor.
2. **High weight:** Signal strength number -- `type.body.medium`, color-coded by trend status. Quantitative anchor.
3. **Medium weight:** Summary text -- `type.body`, `color.text.secondary`. Context on scan.
4. **Low weight:** Platform icons, status chip, filter bar -- `type.small`/`type.caption`, muted colors. Metadata layer.
5. **Lowest weight:** Timestamp, rating controls -- `type.small`, `color.text.secondary`. Peripheral.

### S2: Trend Detail
1. **Highest:** "Start learning" button -- `color.primary` background, prominent placement.
2. **High:** Trend title + "Why trending" block -- `type.h2` and bordered section draw attention.
3. **Medium:** Source breakdown table -- evidence layer for trust.
4. **Low:** Related trends -- discovery aid, not primary action.

### S3: Learning Path
1. **Highest:** Resource titles -- `type.h3`, clickable. The things you actually go learn.
2. **High:** Prerequisite warnings -- `color.warning` icon + text. Safety-critical for P4.
3. **Medium:** Difficulty badge + time estimate -- decision-support metadata.
4. **Low:** Completion toggles, feedback controls -- action layer.

### S4: Skill Profile
1. **Highest:** Visual skill summary (chart/bars) -- at-a-glance overview.
2. **High:** Self-assessed vs. inferred comparison -- transparency signal.
3. **Medium:** Editable selectors -- configuration layer.
4. **Low:** Recent completions list -- evidence/history.

---

## 3. Dark Mode Behavior

Dark mode is the default. All screens use semantic tokens from design-system.md Section 2. No hardcoded colors anywhere.

- **S1:** TrendCard border-left accent must maintain visibility against `color.surface`. Skeleton uses `color.surface.elevated` pulse.
- **S2:** Panel uses `color.surface.elevated` for depth distinction. No drop shadows -- luminance only.
- **S3:** Completed resource opacity (0.7) must still pass contrast checks. Strikethrough: `color.text.disabled`.
- **S4:** Chart grid lines: `color.border`. Fill areas: `color.primary`/`color.secondary` at 30% opacity.
- **S5:** Input fields use `color.surface` (darker than panel) for inset appearance.
- **S6:** Chart colors remain distinguishable under color vision deficiency simulation.

---

## 4. Animation Specifications

| Interaction | Duration | Easing | Details |
|-------------|----------|--------|---------|
| S2 slide-over open | 250ms | ease-out | Slides from right; S1 dims on mobile (backdrop 0.3) |
| S2 slide-over close | 200ms | ease-in | Slides right; focus returns to originating TrendCard |
| S2 to S3 page transition | 200ms+200ms | ease-in/out | S2 closes, then S3 fades in |
| S7 modal open | 200ms | ease-out | Fade + scale from 0.95; backdrop to 50% |
| S7 modal close | 150ms | ease-in | Fade out; focus returns to resource |
| Skeleton loading pulse | 1500ms loop | ease-in-out | Opacity 0.5 to 1.0 on placeholder shapes (S1, S3) |
| Path generation spinner (S2) | 800ms/rev | linear | Continuous rotation + "Generating learning path..." text |
| Data refresh indicator (S1) | indeterminate | -- | Top-border progress bar in `color.primary` |
| Completion checkbox (S3) | 200ms | ease-out | Stroke draw-in; card fades to completed state over 300ms |
| Rating button press (S1, S7) | 100ms+150ms | ease-out | Scale 1.1 then back; color fill 150ms |
| Filter chip toggle (S1) | 150ms | ease-out | Background and text color transition |
| ProgressBar/SignalStrength fill | 300ms | ease-out | Width animates from previous to current value |

**Reduced motion:** When `prefers-reduced-motion: reduce` is active, all durations become 0ms. No pulse, no slide, no fill animation.

---

## 5. Responsive Layout

### S1: Trend Dashboard

| Breakpoint | Grid | FilterBar | TrendCard | Signal Indicator |
|-----------|------|-----------|-----------|-----------------|
| Mobile (<768px) | 1 column, `spacing.md` gap | Collapsed dropdown/sheet | Stacked card: title, summary, metadata row | Compact numeric badge only |
| Tablet (768-1024px) | 1 column, `spacing.md` gap | Horizontal scrollable pills | Denser card with inline metadata | Numeric badge + short bar |
| Desktop (>1024px) | 1 column, max-width 1200px | Persistent horizontal bar | Information-dense row: all data on one line | Full bar (80px) + numeric |

### S2: Trend Detail
Mobile: full-screen overlay. Tablet: side panel at 50% width. Desktop: side panel at 40% width. "Why trending" is a collapsible accordion on mobile (expanded by default), always expanded on larger screens.

### S3: Learning Path
Mobile: stacked LearningPathCards, metadata below title, prerequisite warnings as full-width banners. Tablet: inline metadata. Desktop: table-like rows with all columns (difficulty, format, time, link) visible; prerequisite as inline indicator + tooltip.

### S4: Skill Profile
Mobile: vertical list with ProgressBars, full-width dropdowns. Tablet: 2-column grid. Desktop: radar chart + 3-column grid, inline dropdowns.

### S6: Team Overview
Mobile: simplified bar chart + stacked metric cards. Tablet: full chart + compact table. Desktop: interactive chart with tooltips + sortable table.

---

## 6. Component State Table

| Component | Default | Hover | Active/Selected | Disabled | Loading | Error |
|-----------|---------|-------|----------------|----------|---------|-------|
| TrendCard | `color.surface` bg, `color.border` border | `color.surface.elevated` bg, cursor pointer | `color.primary` left-border accent | N/A | Skeleton card, pulse animation | N/A (error is page-level) |
| LearningPathCard | `color.surface` bg | `color.surface.elevated` bg | Completed: opacity 0.7, strikethrough | Prerequisite unmet: `color.warning` border, muted content | Skeleton card | Dead link: `color.error` indicator on link icon |
| SkillBadge | Level-tinted bg at 15% opacity | Darken bg to 25% opacity | N/A | `color.text.disabled`, no bg tint | N/A | N/A |
| SignalStrengthIndicator | Bar filled to score %, status color | N/A | N/A | `color.text.disabled` bar and label | Bar at 0% width, `color.border` track | N/A |
| PlatformIcon | `color.text.secondary` | `color.text.primary`, tooltip shown | `color.primary` (if filtering by platform) | `color.text.disabled` (platform unavailable) | N/A | `color.error` (platform API failed) |
| FilterBar chip | `color.border` border, `color.text.secondary` text | `color.text.primary` text | `color.primary` bg 15%, `color.primary` text | `color.text.disabled`, no interaction | N/A | N/A |
| ProgressBar | Track: `color.border`, fill: `color.primary` | N/A | N/A | Track only, no fill, `color.text.disabled` label | Indeterminate animation | N/A |
| StatusChip | Status-color bg at 15%, status-color text | Darken bg to 25% | N/A | `color.text.disabled`, neutral bg | N/A | N/A |
| Primary button | `color.primary` bg, white text | `color.primary.hover` bg | Scale 0.98, darker bg | `color.text.disabled` text, `color.border` bg | Spinner replacing label text | `color.error` bg |
| Checkbox | `color.border` border, empty | `color.primary` border | `color.primary` bg, white checkmark | `color.text.disabled` border | N/A | N/A |
| Input field | `color.surface` bg, `color.border` border | `color.primary` border | `color.primary` border, subtle shadow | `color.text.disabled` text, `color.surface` bg | N/A | `color.error` border, error message below |

---

## 7. AC-to-Component Map

| AC ID | Component(s) | Screen(s) | Notes |
|-------|-------------|-----------|-------|
| TRN-01 | TrendCard (grid of 5-10) | S1 | Ranked by signal strength, top 10 displayed |
| TRN-02 | TrendCard: SignalStrengthIndicator + PlatformIcon row + `type.body` summary | S1 | Each entry shows title, summary, icons, signal score |
| TRN-03 | S2 "Why trending" bordered section + source breakdown table | S2 | Explanation with cited sources and numbers |
| TRN-04 | FilterBar (subfield filter chips) | S1 | Applied filters update TrendCard list; collapsed dropdown on mobile |
| TRN-05 | Last-refreshed timestamp (`type.small`) + refresh button | S1 | Warning banner in STALE state; auto-refresh on cadence |
| TRN-06 | Thumbs up/down icon buttons inline on TrendCard | S1 | Swipe/long-press on mobile; inline icons on desktop |
| TRN-07 | S7 Resource Feedback modal (thumbs + optional text) | S7 (on S3) | Appears after resource opened or marked complete |
| TRN-08 | TrendCard re-ordering + LearningPathCard re-ordering | S1, S3 | Rankings reflect accumulated feedback; optionally badged "Personalized" |
| LRN-01 | "Start learning" primary button (S2) + LearningPathCard list (S3) | S2, S3 | Button triggers path generation; S3 renders 3-8 resources |
| LRN-02 | LearningPathCard ordered list | S3 | Resources in prerequisite order; completed ones visually distinguished |
| LRN-03 | LearningPathCard: title + format tag + time estimate + SkillBadge + external link | S3 | All metadata visible on desktop; stacked on mobile |
| LRN-04 | LearningPathCard list (filtered by skill profile) | S3 | Path adapts to user level; advanced users see different resources than beginners |
| LRN-05 | Prerequisite warning banner within LearningPathCard | S3 | `color.warning` icon + text; links to prerequisite resource |
| SKL-01 | Skill Profile editable selectors (dropdown per category) | S4 | Self-assessment across 8+ categories; inline form on first visit |
| SKL-02 | Completion checkbox on LearningPathCard | S3 | Marks resource complete; triggers skill profile update |
| SKL-03 | Skill summary grid: ProgressBar pairs (self-assessed + inferred) | S4 | Dual bars per category with `color.primary` / `color.secondary` |
| SKL-04 | Skill summary auto-update + recent completions list | S4 | Inferred level updates within session after completion |
| SKL-05 | Aggregate skill map (bar chart / heatmap) | S6 | Distribution per category; no individual names; admin-only |
| SKL-06 | Team activity metric cards + popular trends list | S6 | Completions, active paths, top trends this week |
| SKL-07 | Access-denied message (non-admin) / full S6 render (admin) | S6 | Permission gate; error state shows "requires admin access" |
| DEP-01 | S5 setup wizard (steps 1-4) | S5 | Deployment mode select, API keys, platforms, confirm |
| DEP-02 | S5 role/user management section (private mode) | S5 | Admin/member roles; shared API key management |
| DEP-03 | S5 tenant management section (operator mode) | S5 | Multi-tenant isolation config; operator admin panel |
| DEP-04 | All components above | All | Feature parity across deployment modes; no mode-specific component omissions |
