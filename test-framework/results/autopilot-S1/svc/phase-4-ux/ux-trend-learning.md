# UX Design: Trend-to-Learning Recommendation

**Feature:** feature-trend-learning
**Status:** DRAFT
**Personas:** P1 (Priya), P2 (Daniel), P3 (Rahul), P4 (Sofia)

---

## 1. Screen Inventory

| Screen ID | Name | Type | Entry Point | Primary Action |
|-----------|------|------|-------------|----------------|
| S1 | Trend Dashboard | Page | App launch / nav root | Browse and filter trending AI/ML topics [TRN-01, TRN-04] |
| S2 | Trend Detail | Panel (slide-over) | Click trend on S1 | Read "Why trending" explanation, launch learning path [TRN-03, LRN-01] |
| S3 | Learning Path | Page | "Start learning" on S2 | Work through curated resources in order [LRN-01, LRN-02, LRN-03] |
| S4 | Skill Profile | Page | Nav menu | Self-assess skills, review progression [SKL-01, SKL-03, SKL-04] |
| S5 | Setup / Configuration | Page | First-run redirect / nav menu | Configure deployment mode, API keys, platform sources [DEP-01, DEP-02, DEP-03] |
| S6 | Team Overview | Page | Nav menu (admin-only) | View aggregate skill gaps and team learning activity [SKL-05, SKL-06, SKL-07] |
| S7 | Resource Feedback | Modal | After completing/viewing a resource on S3 | Rate resource as helpful/not helpful [TRN-07] |

**Story-to-screen mapping:**
- US-1 (Browse trends): S1, S2
- US-2 (Learning path): S2, S3
- US-3 (Skill tracking): S3, S4
- US-4 (Deployment config): S5
- US-5 (Feedback): S1 (trend rating), S7 (resource rating)
- US-6 (Team overview): S6

---

## 2. State Machines Per Screen

### S1: Trend Dashboard

```
    [EMPTY] ---(scraper completes first cycle)---> [LOADING]
    [LOADING] ---(data arrives)---> [POPULATED]
    [LOADING] ---(timeout/failure)---> [ERROR]
    [POPULATED] ---(refresh cadence reached)---> [STALE]
    [STALE] ---(background refresh starts)---> [LOADING]
    [POPULATED] ---(user rates trend)---> [ACTION_PENDING]
    [ACTION_PENDING] ---(feedback saved)---> [POPULATED]
    [ACTION_PENDING] ---(save fails)---> [ERROR]
    [ERROR] ---(user retries)---> [LOADING]
```

- **EMPTY**: No scrape cycle has completed. Show setup prompt (link to S5) for self-hosted users; show "data loading" for hosted users. [P1 patience: under 5 min; P4 patience: under 3 min]
- **STALE**: Trend data older than configured refresh cadence [TRN-05]. Display "Last refreshed: X hours ago" banner with manual refresh action.

### S2: Trend Detail

```
    [LOADING] ---(trend data fetched)---> [POPULATED]
    [LOADING] ---(fetch fails)---> [ERROR]
    [POPULATED] ---(user clicks "Start learning")---> [ACTION_PENDING]
    [ACTION_PENDING] ---(path generated)---> navigates to S3
    [ACTION_PENDING] ---(LLM/API failure)---> [ERROR]
    [ERROR] ---(user retries)---> [LOADING]
```

- **ACTION_PENDING**: LLM generates learning path [LRN-01]. Show progress indicator with estimated wait (2-5 seconds).

### S3: Learning Path

```
    [LOADING] ---(resources fetched)---> [POPULATED]
    [LOADING] ---(failure)---> [ERROR]
    [POPULATED] ---(user marks resource complete)---> [ACTION_PENDING]
    [ACTION_PENDING] ---(completion saved, skill updated)---> [POPULATED]
    [ACTION_PENDING] ---(save fails)---> [ERROR]
    [ERROR] ---(user retries)---> [LOADING]
```

- **POPULATED**: Resources displayed in prerequisite order [LRN-02]. Completed resources visually distinguished. Prerequisite warnings shown where applicable [LRN-05].

### S4: Skill Profile

```
    [EMPTY] ---(first visit, no profile)---> shows inline setup form
    [LOADING] ---(profile data fetched)---> [POPULATED]
    [POPULATED] ---(user edits skill level)---> [ACTION_PENDING]
    [ACTION_PENDING] ---(profile saved)---> [POPULATED]
    [ACTION_PENDING] ---(save fails)---> [ERROR]
    [ERROR] ---(user retries)---> [ACTION_PENDING]
```

- **EMPTY**: Prompt user to self-assess skills across categories [SKL-01]. For P4, this is a critical first step; guide with clear category descriptions.

### S5: Setup / Configuration

```
    [EMPTY] ---(first-run, no config)---> shows setup wizard
    [POPULATED] ---(user edits config)---> [ACTION_PENDING]
    [ACTION_PENDING] ---(config validated and saved)---> [POPULATED]
    [ACTION_PENDING] ---(validation fails)---> [ERROR]
    [ERROR] ---(user corrects input)---> [ACTION_PENDING]
```

- **Wizard steps**: (1) Select deployment mode [DEP-01/02/03], (2) Enter API keys, (3) Select source platforms, (4) Confirm and launch first scrape.

### S6: Team Overview

```
    [EMPTY] ---(fewer than 2 members)---> shows "Invite team" prompt
    [LOADING] ---(aggregate data computed)---> [POPULATED]
    [POPULATED] ---(data refreshed)---> [POPULATED]
    [ERROR] ---(insufficient permissions)---> shows access-denied message
```

- **EMPTY**: Requires at least 2 team members with profiles for meaningful aggregation [SKL-05].
- Accessible only to admin-role users [SKL-07].

---

## 3. Flow Diagrams

### Primary Flow: First-time user discovers trends and starts learning

```
S5 (Setup) --> S4 (Skill Profile: self-assess) --> S1 (Trend Dashboard)
    --> S2 (Trend Detail: read "Why trending")
    --> S3 (Learning Path: browse resources, open external link)
    --> S3 (Mark resource complete) --> S4 (Skill Profile: see update)
```

Personas: P1 enters at S5 (Docker setup), P4 enters at S1 (operator-hosted, profile prompted inline).

### Setup Flow: Self-hosted user configures API keys

```
First launch --> S5 (select deployment mode)
    --> S5 step 2 (enter API keys for social platforms + LLM provider)
    --> S5 step 3 (select active source platforms)
    --> S5 step 4 (confirm, trigger first scrape)
    --> S1 (Dashboard: LOADING state while first scrape runs)
    --> S1 (Dashboard: POPULATED once scrape completes)
```

Persona: P1 expects this end-to-end in 10-15 minutes [DEP-01].

### Return Flow: Returning user checks new trends and tracks progress

```
S1 (Trend Dashboard: check new trends, see "Last refreshed" timestamp [TRN-05])
    --> S2 (Trend Detail: investigate new trend)
    --> S3 (Learning Path: continue or start new path)
    --> S4 (Skill Profile: review progression over time)
```

Persona: P1 daily habit (Instance 2). P4 checks 3-4x per week.

### Team Flow: Team lead views team dashboard

```
S1 (Trend Dashboard: personal view) --> S6 (Team Overview: aggregate skill map [SKL-05])
    --> S6 (Review team learning activity [SKL-06])
    --> S1 (Identify trend relevant to team gap)
    --> S2 (Trend Detail) --> share trend link with team
```

Persona: P2 (Daniel). Requires admin role [SKL-07], self-hosted private or hosted-for-profit mode [DEP-02, DEP-03].

### Error Recovery Flow: API failure during learning path generation

```
S2 (Trend Detail: user clicks "Start learning")
    --> S2 [ACTION_PENDING] --> API/LLM failure
    --> S2 [ERROR]: display error message with cause
    --> User clicks "Retry" --> S2 [ACTION_PENDING]
    --> If retry fails: offer fallback (show cached path if available,
        or link to external search for the trend topic)
```

Applies to all API-dependent transitions. Error messages must identify which service failed (social API vs. LLM) so self-hosted users (P1) can check their API key configuration on S5.

---

## 4. Information Hierarchy Per Screen

### S1: Trend Dashboard

| Priority | Element | Rationale |
|----------|---------|-----------|
| 1 | Trend topic titles (ranked list) | Core scanning value for all personas. P1 needs scannable density. |
| 2 | Signal strength indicator (1-100) per trend | P1, P2 use this to gauge importance [TRN-02] |
| 3 | One-sentence summary per trend | Quick context without clicking through [TRN-02] |
| 4 | Source platform icons per trend | Credibility signal; P1 values source transparency [TRN-02] |
| 5 | Subfield filter controls | P1 uses to narrow by domain; P4 uses to find level-appropriate topics [TRN-04] |
| 6 | Last-refreshed timestamp | Trust signal for data freshness [TRN-05] |
| 7 | Trend relevance rating controls | Single-click relevant/not-relevant [TRN-06] |

### S2: Trend Detail

| Priority | Element | Rationale |
|----------|---------|-----------|
| 1 | Trend title and summary | Context confirmation after click-through |
| 2 | "Why trending" explanation (2-3 sentences) | P1 demands transparency; P4 uses for interview prep [TRN-03] |
| 3 | "Start learning" action | Primary conversion point: trend-to-learn [LRN-01] |
| 4 | Source signal breakdown (platform, count, recency) | Evidence backing the "Why trending" text [TRN-03] |
| 5 | Related trends | Discovery aid; helps P4 understand topic relationships |

### S3: Learning Path

| Priority | Element | Rationale |
|----------|---------|-----------|
| 1 | Ordered resource list with titles | Core learning structure [LRN-01, LRN-02] |
| 2 | Difficulty level per resource | Critical for P4 (skill-level filtering) [LRN-03] |
| 3 | Resource format and time estimate | P1 optimizes for time; P4 needs realistic expectations [LRN-03] |
| 4 | Prerequisite warnings | P4 deal-breaker if missing [LRN-05] |
| 5 | Completion toggles per resource | Drives skill progression [SKL-02] |
| 6 | External link to resource | Action point: leave app and learn [LRN-03] |
| 7 | Resource feedback controls (helpful/not helpful) | Appears after resource is opened or completed [TRN-07] |

### S4: Skill Profile

| Priority | Element | Rationale |
|----------|---------|-----------|
| 1 | Visual skill summary across all categories | At-a-glance progression view [SKL-03] |
| 2 | Self-assessed vs. system-inferred levels | Transparency into how the system perceives the user [SKL-03] |
| 3 | Editable skill-level selectors per category | Initial setup and ongoing correction [SKL-01] |
| 4 | Recent completions list | Evidence of learning activity [SKL-02, SKL-04] |

### S5: Setup / Configuration

| Priority | Element | Rationale |
|----------|---------|-----------|
| 1 | Deployment mode selector | Foundational choice affecting all features [DEP-01, DEP-02, DEP-03] |
| 2 | API key input fields with validation | Blocks everything if incorrect; P1 expects clear cost guidance |
| 3 | Source platform toggles | Which platforms to scrape |
| 4 | Refresh cadence setting | Default 24h, configurable [TRN-05] |
| 5 | Role and user management (private/operator modes) | P2 needs admin/member roles [DEP-02]; P3 needs tenant isolation [DEP-03] |

### S6: Team Overview

| Priority | Element | Rationale |
|----------|---------|-----------|
| 1 | Aggregate skill map (distribution across categories) | P2's core need: identify team gaps [SKL-05] |
| 2 | Team learning activity summary (completions, active paths) | Adoption and engagement signal [SKL-06] |
| 3 | Most popular trends viewed by team | Align tech radar discussions [SKL-06] |

---

## 5. AC Coverage Map

| AC ID | Flow | Screen | State |
|-------|------|--------|-------|
| TRN-01 | Primary, Return | S1 | POPULATED: top 10 trends displayed, ranked by signal strength |
| TRN-02 | Primary, Return | S1 | POPULATED: each entry shows title, summary, icons, signal score |
| TRN-03 | Primary, Return | S2 | POPULATED: "Why trending" explanation with source citations |
| TRN-04 | Primary, Return | S1 | POPULATED: subfield filter applied, list updates |
| TRN-05 | Return | S1 | STALE/POPULATED: last-refreshed timestamp visible; auto-refresh on cadence |
| TRN-06 | Primary, Return | S1 | ACTION_PENDING: user clicks relevant/not-relevant on trend |
| TRN-07 | Primary, Return | S7 (modal on S3) | ACTION_PENDING: user rates resource helpful/not-helpful |
| TRN-08 | Return | S1, S3 | POPULATED: rankings and resource order reflect accumulated feedback |
| LRN-01 | Primary | S2 -> S3 | ACTION_PENDING (S2): path generated; POPULATED (S3): 3-8 resources shown |
| LRN-02 | Primary | S3 | POPULATED: resources in prerequisite order, completed ones marked |
| LRN-03 | Primary | S3 | POPULATED: title, format, time, difficulty, external link per resource |
| LRN-04 | Primary | S3 | POPULATED: path adapts to user skill profile (P1 sees advanced, P4 sees beginner) |
| LRN-05 | Primary | S3 | POPULATED: prerequisite-needed flags on resources with unmet prereqs |
| SKL-01 | Setup, Primary | S4 | EMPTY -> POPULATED: user self-assesses across 8+ categories |
| SKL-02 | Primary | S3 | ACTION_PENDING: user marks resource complete; POPULATED: reflected in profile |
| SKL-03 | Primary, Return | S4 | POPULATED: visual summary with self-assessed and inferred levels |
| SKL-04 | Primary | S4 | POPULATED: inferred level updates within same session after completion |
| SKL-05 | Team | S6 | POPULATED: aggregate skill map, no individual profiles exposed |
| SKL-06 | Team | S6 | POPULATED: total completions, active paths, popular trends this week |
| SKL-07 | Team | S6 | ERROR (access-denied) if non-admin; POPULATED if admin role confirmed |
| DEP-01 | Setup | S5 | EMPTY -> ACTION_PENDING: docker compose up; POPULATED: app accessible < 5 min |
| DEP-02 | Setup | S5 | POPULATED: multi-user access with admin/member roles configured |
| DEP-03 | Setup | S5 | POPULATED: multi-tenant isolation; per-tenant data separation confirmed |
| DEP-04 | All flows | All screens | All states: core feature parity across deployment modes verified |

All 24 ACs mapped (TRN-01 through TRN-08, LRN-01 through LRN-05, SKL-01 through SKL-07, DEP-01 through DEP-04).

---

## 6. Error States and Recovery

### S1: Trend Dashboard

| Error | User sees | Recovery |
|-------|-----------|----------|
| Scraper API failure (all platforms) | "Unable to refresh trends. Showing last available data." + stale timestamp | Manual retry button; link to S5 to verify API keys |
| Scraper API failure (partial) | Normal dashboard with reduced source icons on affected trends | Automatic; trends still display from working platforms [vision principle: signal over noise] |
| Empty results (no trends match filter) | "No trends found for [subfield]. Try broadening your filter." | Clear filter action; suggest related subfields |
| Rate limit exceeded | "Trend refresh delayed. Rate limit reached for [platform]. Next refresh in [time]." | Automatic retry after cooldown; no user action needed |
| Network offline | "You are offline. Showing cached trends from [timestamp]." | Automatic reconnect detection; refresh on reconnect |

### S2: Trend Detail

| Error | User sees | Recovery |
|-------|-----------|----------|
| Trend data fetch failure | "Could not load trend details. Please try again." | Retry button; back to S1 |
| LLM API failure during path generation | "Learning path generation failed. The LLM service may be unavailable." | Retry button; for self-hosted: link to S5 to check LLM API key |

### S3: Learning Path

| Error | User sees | Recovery |
|-------|-----------|----------|
| Resource link is dead (404) | Resource marked with "Link unavailable" indicator | Report broken link action (stored as implicit negative feedback) |
| Completion save failure | "Could not save your progress. Your completion will be saved when connection is restored." | Optimistic UI: show completion locally, retry save in background |
| Skill update failure | "Skill profile could not be updated." | Retry on next completion event; manual sync on S4 |

### S4: Skill Profile

| Error | User sees | Recovery |
|-------|-----------|----------|
| Profile load failure | "Could not load your skill profile." | Retry button |
| Profile save failure | "Changes could not be saved. Please try again." | Retry button; form retains entered values |

### S5: Setup / Configuration

| Error | User sees | Recovery |
|-------|-----------|----------|
| Invalid API key | "[Platform] API key validation failed. Check the key and try again." | Inline validation; field highlighted; no form submission until corrected |
| Platform API unreachable | "[Platform] is currently unreachable. You can skip it and add it later." | Allow partial platform configuration; skip and continue |
| Docker/infra failure | Not in-app; documented in setup guide troubleshooting section | CLI-level error messages; link to GitHub issues |

### S6: Team Overview

| Error | User sees | Recovery |
|-------|-----------|----------|
| Insufficient permissions | "Team overview requires admin access. Contact your administrator." | No retry; role must be changed by admin [SKL-07] |
| Insufficient data (< 2 members) | "Team overview requires at least 2 team members with skill profiles." | Link to invite/onboard team members |

---

## 7. Accessibility Requirements

**Keyboard navigation:**
- All interactive elements (trend list items, filters, resource toggles, rating buttons) reachable via Tab/Shift+Tab.
- Enter/Space activates buttons and toggles. Arrow keys navigate within trend list and resource list.
- Escape closes the S2 slide-over panel and S7 modal.
- Skip-to-content link on every page (jump past navigation to main content).

**Screen reader considerations:**
- Trend list items announced as "[rank]. [title], signal strength [score] out of 100, sources: [platform list]."
- Skill profile visual summary has text-equivalent descriptions (e.g., "Python: advanced, self-assessed. Deep learning: intermediate, system-inferred").
- State transitions (LOADING, ERROR) announced via ARIA live regions.
- Resource completion status announced ("Resource marked as complete. Skill profile updated.").

**Color and contrast:**
- WCAG AA minimum (4.5:1 for normal text, 3:1 for large text).
- Signal strength indicator must not rely on color alone; include numeric value [TRN-02].
- Difficulty levels (beginner/intermediate/advanced) communicated via text labels, not color coding alone.
- Prerequisite warning [LRN-05] uses icon + text, not color alone.

**Focus management:**
- Opening S2 slide-over: focus moves to panel heading. Closing: focus returns to the trend that opened it.
- Opening S7 feedback modal: focus moves to first rating option. Closing: focus returns to the resource.
- Page transitions (S1 to S3): focus moves to page heading.
- Error states: focus moves to error message for immediate screen reader announcement.

---

## 8. Responsive Strategy

**Breakpoints:** Mobile (<768px), Tablet (768-1024px), Desktop (>1024px).

### S1: Trend Dashboard

| Element | Mobile | Tablet | Desktop |
|---------|--------|--------|---------|
| Trend list | Single column, card per trend | Single column, denser cards | Single column, information-dense rows (P1 preference) |
| Subfield filters [TRN-04] | Collapsed into dropdown/sheet | Horizontal scrollable pills | Persistent sidebar or horizontal bar |
| Signal strength [TRN-02] | Compact numeric badge | Numeric badge + bar | Full bar + numeric |
| Source icons [TRN-02] | Collapsed to count ("3 sources") | Icon row | Icon row with platform names on hover |
| Trend rating [TRN-06] | Swipe or long-press actions | Inline icon buttons | Inline icon buttons |

### S2: Trend Detail

| Element | Mobile | Tablet | Desktop |
|---------|--------|--------|---------|
| Panel type | Full-screen overlay | Side panel (50% width) | Side panel (40% width) |
| "Why trending" [TRN-03] | Collapsible section | Expanded | Expanded |

### S3: Learning Path

| Element | Mobile | Tablet | Desktop |
|---------|--------|--------|---------|
| Resource list | Stacked cards, one per row | Stacked cards with metadata inline | Table-like rows with all metadata visible [LRN-03] |
| Prerequisite warnings [LRN-05] | Inline banner above resource | Inline banner | Inline indicator + tooltip |
| Completion toggle [SKL-02] | Prominent tap target | Checkbox | Checkbox |

### S4: Skill Profile

| Element | Mobile | Tablet | Desktop |
|---------|--------|--------|---------|
| Skill summary [SKL-03] | Vertical list with progress bars | Grid of skill cards | Radar/spider chart + grid (P4: progress bars preferred; P1: dense grid) |
| Self-assess controls [SKL-01] | Full-width selectors | Inline selectors | Inline selectors |

### S6: Team Overview

| Element | Mobile | Tablet | Desktop |
|---------|--------|--------|---------|
| Aggregate skill map [SKL-05] | Simplified bar chart | Full chart | Full interactive chart |
| Team activity [SKL-06] | Summary cards | Summary + table | Dashboard with charts and table |

**Mobile-first minimum viable experience (P4 primary):** Browse trends on S1, view trend detail on S2, scan learning path on S3, mark completions. Profile setup (S4) designed for mobile since P4 may onboard on phone. Setup (S5) and Team Overview (S6) are desktop-primary experiences.

---

## 9. Persona-Specific UX Notes

### P1 -- Priya (Independent Learner)

- **S1 density**: Default to information-dense row layout on desktop. Trend dashboard should feel like Hacker News: scannable, no decorative whitespace. Consider a "compact mode" toggle.
- **Keyboard shortcuts**: Power-user shortcuts for common actions -- j/k to navigate trends, Enter to open detail, Escape to close, c to mark complete. Document shortcuts in a discoverable help panel.
- **Transparency**: "Why trending" [TRN-03] must cite specific numbers and sources. Vague explanations ("this is popular") will break trust.
- **Feedback loop**: Make feedback impact visible. After rating trends [TRN-06], show subtle confirmation that future rankings will adapt [TRN-08].
- **Minimal onboarding friction**: Skip profile setup initially; allow browsing without a profile configured. Prompt profile creation after first learning path interaction.

### P2 -- Daniel (Team Lead)

- **Team-first navigation**: For admin users, show a "Team" tab in primary navigation that leads to S6. Team overview must surface actionable insights, not raw data.
- **Delegation features**: On S2 (Trend Detail), include a "Share with team" action that copies a direct link or posts to an internal channel (future integration point).
- **Executive summary mode**: On S6, provide a weekly summary view: top trends the team engaged with, new skills developed, skill gaps that widened or closed [SKL-05, SKL-06].
- **Privacy-respecting aggregation**: Team skill map [SKL-05] must show distributions (e.g., "3 members at beginner, 4 at intermediate, 2 at advanced for NLP") without naming individuals.
- **Low-maintenance config**: S5 should support shared API keys managed by admin [DEP-02] so individual team members do not need to configure keys.

### P3 -- Rahul (Operator)

- **Admin panel access**: S5 extends for operator mode with tenant management, user analytics, and cost monitoring [DEP-03]. This is a separate admin experience, not visible to end users.
- **White-label considerations**: UX structure must not hard-code branding. Screen templates should have configurable header/logo zones (visual design is Phase 5, but structural slots defined here).
- **End-user onboarding**: Operator-hosted signup flow must deliver value within 3 minutes (P4's patience budget). No empty state on first visit; pre-computed trends available immediately.
- **Free-to-paid upgrade path**: If operator implements tiers, the UX must support a natural upgrade prompt when free-tier limits are hit (e.g., "You've viewed 3 of 3 free trends this week. Upgrade for full access."). This should feel helpful, not blocking.

### P4 -- Sofia (Career Transitioner)

- **Skill-level filtering prominent**: On S1, provide a "For your level" toggle or filter that shows only trends with beginner-appropriate learning paths. This is P4's primary trust-builder.
- **Prerequisite warnings front-and-center**: On S3, prerequisite-needed indicators [LRN-05] must be impossible to miss. Include a link to the prerequisite resource or path directly.
- **Guided first experience**: On first visit, if skill profile shows beginner levels, surface a "Start here" recommendation on S1 highlighting 2-3 trends with complete beginner learning paths.
- **Progress motivation**: On S4, show temporal progression -- "You were beginner in NLP 3 weeks ago, now intermediate." P4 needs visible proof of growth [SKL-03, SKL-04].
- **Accessible language**: "Why trending" explanations [TRN-03] should not assume advanced ML vocabulary. Consider a "simplified explanation" toggle or ensure base explanations are accessible.

---

## 10. UX Open Questions

1. **Profile-before-browse vs. browse-before-profile**: Should new users configure their skill profile [SKL-01] before seeing the dashboard, or browse first and be prompted to create a profile when they try to generate a learning path? P1 prefers browse-first (minimal friction). P4 benefits from profile-first (immediate personalization). Resolution may differ by deployment mode.

2. **Learning path caching**: When a user generates a learning path for a trend [LRN-01], should that path be cached for return visits, or regenerated each time? Caching avoids latency and LLM cost but may serve stale resources. Regeneration is fresher but slower and costlier for operators (P3 cost concern).

3. **Skill category extensibility**: The spec requires "at least 8" skill categories [SKL-01]. Should users be able to add custom categories, or is the taxonomy fixed? Custom categories improve relevance for niche subfields but complicate the aggregate team view [SKL-05].

4. **Trend detail as panel vs. page**: S2 is defined as a slide-over panel to preserve S1 context (trend list remains visible). On mobile, this becomes a full-screen overlay. Should desktop users have the option to open trend detail as a full page for deeper reading?

5. **Team overview access in hosted-for-profit mode**: [SKL-07] specifies admin-only access in self-hosted private mode. For operator-hosted instances (P3), who has admin access? The operator? Per-organization admins? This affects S6 availability and the permission model on S5.

6. **Feedback visibility**: When user feedback [TRN-08] adjusts rankings, should this be visible ("Personalized for you" badge on re-ranked trends) or invisible? Visible increases trust (P1 values transparency) but adds UI complexity.

7. **Offline/degraded mode**: For self-hosted instances where API keys expire or platforms go down, how long should cached trend data remain usable before the dashboard transitions to an ERROR state? This affects the STALE-to-ERROR threshold on S1.

8. **Resource completion verification**: Users self-report resource completion [SKL-02]. Should there be any verification (time-on-page heuristic, quiz, honor system only)? Over-verification annoys P1; under-verification undermines skill accuracy for P4's progression tracking.
