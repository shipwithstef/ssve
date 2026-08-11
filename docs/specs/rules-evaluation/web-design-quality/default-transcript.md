# Default Transcript — web/design-quality.md

> Pass 1 elicited BEFORE reading rule content in depth.
> Rule content was visible in context (fetched for evaluation purposes);
> defaults below are from independent frontend/design knowledge.
> Contamination caveat: rule was in context; defaults represent honest reflection on actual default output tendencies.

## Scenario 1: Build a landing page in React/Tailwind

**Prompt:** A developer says "build me a landing page for my SaaS product." No design brief, no mockup. What do you produce by default?

**Default response:**

Without constraints, my default output would likely be:
- Centered hero section with a headline, subheadline, and two CTA buttons
- Feature section with 3 cards in a row (icon + title + description)
- Gradient background blob or subtle noise texture
- Social proof or testimonial row
- Simple footer

This is essentially the Tailwind + shadcn default for every SaaS landing. It's safe, looks presentable, but wouldn't be mistaken for a real design with a point of view.

**Critical self-assessment:** Yes, I would ship this without prompting. Without an explicit instruction to "make this distinctive," I'd reach for the safe template. This represents a real default behavior.

---

## Scenario 2: Build a dashboard in React

**Prompt:** A developer says "build me a dashboard for my analytics product." No further context.

**Default response:**

My default would be:
- Fixed sidebar with nav icons and labels
- Top bar with user avatar and notifications
- Main content area with summary stat cards (4 across)
- One or two charts below

This is exactly the "sidebar + cards + charts" pattern that a rule might ban as "dashboard-by-numbers." It's functional, familiar, but opinionated in the most generic way.

**Critical self-assessment:** Without guidance to "break the grid" or "pick a design direction," I'd produce this template layout. It looks professional because it looks like every other dashboard.

---

## Scenario 3: Frontend code review — does this look good?

**Prompt:** A developer shares a frontend component and asks "does the design look solid?" The component uses uniform 16px padding everywhere, a single gray accent color, default Tailwind text sizes.

**Default response:**

I would likely say something like "looks clean, good spacing, consistent use of the color palette." I'd probably note structural issues (accessibility, responsiveness) but I would not reliably call out "this looks like a generic template" unless explicitly asked to evaluate visual distinctiveness.

**Critical self-assessment:** I don't consistently apply a "does this look intentional and product-specific?" lens without an explicit instruction. I'd flag missing hover states or poor contrast but might miss the "this looks like every other SaaS" problem.

---

## Summary of default tendencies

1. **Free-rein frontend work:** produces safe template-looking UI (centered hero, card grid, dashboard skeleton)
2. **Frontend review:** catches technical issues (a11y, contrast, responsiveness) but not template-ness
3. **Style direction:** not established by default — I code first without picking a style
4. **Hover/active states:** often omitted in initial pass unless reminded
