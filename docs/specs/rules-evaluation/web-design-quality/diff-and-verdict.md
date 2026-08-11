# Diff and Verdict — web/design-quality.md

**Rule type:** correction  
**Source:** ECC rules/web/design-quality.md (SHA 125d5e61)  
**Scope:** project  
**Stack:** web

---

## Diff by Scenario

### S1: Build a landing page in React/Tailwind (unconstrained)

**Rule prescribes:**
- Anti-Template Policy: explicit banned patterns list (default card grid, centered hero + gradient blob, unmodified library defaults, flat layouts, uniform radius/spacing/shadows, safe gray-on-white, dashboard-by-numbers)
- Required Qualities: at least 4 of 10 named qualities per meaningful surface
- "Before Writing Code": pick a style direction, define palette intentionally, choose typography deliberately, gather references

**Default said:** "Without constraints, my default output would be: centered hero + feature cards + gradient blob + testimonial row. Safe template. Without explicit instruction, yes, I'd ship this."

**Diff:** Rule changes behavior in S1. My default WOULD produce exactly what this rule bans (centered hero, card grid, gradient blob). The Anti-Template Policy and Before Writing Code sections change the ordering — I'd pick a style direction first rather than starting to code. **DG: 2, CD: 2**

---

### S2: Build a dashboard in React (unconstrained)

**Rule prescribes:** Same Anti-Template Policy applies — "Dashboard-by-numbers layouts with sidebar + cards + charts and no point of view" is explicitly banned.

**Default said:** "My default: sidebar + stat cards + charts. This is exactly the 'dashboard-by-numbers' pattern."

**Diff:** Without this rule I'd produce the banned pattern. With it, I'm required to either pick a distinct layout approach or explicitly justify the conventional one. Real behavior change. **DG: 2, CD: 2**

---

### S3: Frontend code review (uniformity assessment)

**Rule prescribes:** Component Checklist — "Does it avoid looking like a default Tailwind/shadcn template? Does it have intentional hover/focus/active states? Would this look believable in a real product screenshot?"

**Default said:** "I'd flag technical issues (a11y, contrast, responsiveness) but not reliably call out 'this looks like every other SaaS.'"

**Diff:** The checklist changes what I look for in review. Without it, template-ness is not a first-class review concern. With it, it's explicit. **DG: 1, CD: 1**

---

## Token Cost Assessment

The rule body is ~55 lines. That's meaningful per-turn overhead. The Worthwhile Style Directions list (10 items, ~12 lines) is the highest-cost low-signal section — it names directions I already know (neo-brutalism, glassmorphism, etc.) but doesn't mandate any of them. It's more of a reference list than a directive.

The rest — Anti-Template Policy, Required Qualities (10 items), Before Writing Code (5 steps), Component Checklist (5 items) — are all genuinely directive. These change what Claude outputs and checks.

**Recommended edit:** Strip the "Worthwhile Style Directions" list (~12 lines) — it's documentation, not a directive. Keep everything else.

**FC after edit:** 1 (some overhead with Required Qualities list, but justified by behavior change)

---

## Scoring

| Axis | Score | Rationale |
|---|---|---|
| determinism_gain | 2 | Resolves "which design approach?" from "safe template" to "must demonstrate intentionality." The Anti-Template Policy + Required Qualities eliminate the safe-default path. |
| correctness_delta | 2 | Prevents shipping generic template UI as if it were a finished design — a real class of frontend quality failures. |
| friction_cost | 1 | Rule adds explicit checklist overhead. Justified by behavior change, but non-zero. Strip the style directions list to keep this at 1 not 2. |
| convention_conflict | 0 | Aligns with svc's design quality focus (track-visuals comprehension mode uses similar criteria). |

**Net: DG=2, CD=2, FC=1, CC=0**

Meets `adopt-with-edits` threshold (DG ≥ 2 AND CD ≥ 2, FC ≤ 1, CC ≤ 1).

---

## Required Edits Before Adoption

1. **Remove the "Worthwhile Style Directions" list** (10-item enumeration of style movements) — this is reference content, not a directive. Removing it cuts ~12 lines without losing any behavior change.

2. **Remove "Use ECC design/frontend skills where relevant"** from the Before Writing Frontend Code section — ECC-internal reference, not applicable in svc.

3. **Add `paths` frontmatter** to scope firing to `**/*.{tsx,jsx,html,css,scss}` files — prevents the rule from injecting into non-frontend turns.

**Result after edits:** ~40 lines with the three genuinely directive sections intact (Anti-Template Policy, Required Qualities, Component Checklist, Before Writing Code).

---

## Verdict

**`adopt-with-edits`**

This rule fixes a real default behavior: unconstrained frontend work produces generic template-looking UI. The Anti-Template Policy's banned patterns list and the Required Qualities checklist both change what Claude outputs and what it flags in review. This is a genuine correction for web projects — not what Claude gets wrong in general, but what Claude gets wrong when given no design direction.

The Worthwhile Style Directions section is inflation — strip it. After edits, the rule earns its per-turn cost for any project where template-avoidance is part of the quality bar.
