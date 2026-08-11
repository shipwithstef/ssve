# Framework Evolution — 2026-05-07: Competitive UX Explorer Gap

## Method

Read: `track-visuals/SKILL.md` (review mode comprehension rubric, lines 392-588), `test-journeys/SKILL.md` (exploratory patterns, lines 127-140), `benchmark-landing/SKILL.md` (sector bank scoring, 8 dimensions), `analyze-competitors/SKILL.md` (product mechanics focus), `proposals/done/2026-04-13-visual-coverage-and-comprehension.md` (comprehension rubric added), `proposals/done/2026-05-01-competitive-awareness-gap.md` (competitive mechanics gap), `proposals/done/2026-05-02-competitive-grounding-as-default.md` (Industry Grounding section), `FRAMEWORK-STATE.md` (Known Gaps — no visual/UX competitive exploration entry).

Evidence from current session: user explicitly states current skills will not flag "something not optimal vs competitors" from a "visual point of view" and "perceived good UX point of view."

---

## Findings

### P1 — Competitive visual/UX exploration is structurally missing

**Category:** Gap

**Evidence:**

| Skill | What it checks | Competitive lens? | Visual/UX depth? | Limitation |
|-------|---------------|-------------------|------------------|------------|
| `track-visuals` review mode | Self-referential rubric (6 dimensions, 1-4 scale) | ❌ No — scores against internal rubric only | ✅ Deep per screenshot | Cannot say "Competitor X does this better" |
| `benchmark-landing` | Sector reference bank (8 dimensions, 1-10 scale) | ✅ Yes — against captured competitor heroes | ✅ Deep for landing pages | Landing pages ONLY; no general app UX |
| `analyze-competitors` | Product mechanics (earn path, POS integration, pricing) | ✅ Yes — deep competitive intelligence | ❌ No visual/UX patterns | "How do they earn points?" not "How does their dashboard feel?" |
| `test-journeys` | AC-bound runtime verification | ❌ No — validates spec compliance | ⚠️ Screenshots for evidence, but AC-driven | Exploratory patterns exist (lines 127-140) but are unguided by competitive knowledge |

**The gap:** There is no skill that browses a live app and evaluates its UX from a "I have seen 30 competitors and this feels off" perspective. The existing skills are either:
- **Self-referential** (track-visuals: does this match our own rubric?)
- **Narrowly scoped** (benchmark-landing: hero sections only)
- **Mechanics-focused** (analyze-competitors: product decisions, not UX quality)
- **AC-bound** (test-journeys: verifies the spec, doesn't challenge it)

**What the user is correctly identifying:** A competitor-visible UX issue (e.g., "our onboarding flow has 4 screens while every competitor does it in 2") will pass ALL current skills:
- `track-visuals` review: screenshots look fine per rubric
- `benchmark-landing`: N/A (not a landing page)
- `analyze-competitors`: mentions onboarding as a feature, doesn't score flow efficiency
- `test-journeys`: AC says "user can complete onboarding" — PASS

The framework currently has **zero skills** that perform competitive UX benchmarking on general app surfaces (dashboards, settings, forms, wizards, modals, empty states).

---

### P2 — Exploratory testing is unguided by competitive knowledge

**Category:** Gap

**Evidence:** `test-journeys/SKILL.md:127-140` lists 10 exploratory patterns (boundary values, empty states, rapid actions, invalid input, interruption, permission edges, responsive, accessibility, state persistence, concurrency). These are **generic QA patterns** — they do not incorporate domain-specific competitive knowledge.

Example: In loyalty/SMB POS space, the exploratory pattern "empty states" should include competitive intelligence like "Toast's empty state shows a QR code for immediate first-customer enrollment; ours shows 'No data'." Generic exploratory testing misses the competitive benchmark.

---

### P3 — `comprehension` rubric has no competitive baseline

**Category:** Drift (between skill capability and user expectation)

**Evidence:** `track-visuals/SKILL.md:426-457` defines the comprehension scoring rubric with 6 dimensions scored 1-4. The rubric defines "4 (Polished)" in absolute terms, not relative to competitors. A page can score 4/4 on all dimensions and still be competitively inferior if competitors have moved the baseline (e.g., every competitor now uses animated empty-state illustrations; a static icon scores 3/4 "Good" but is actually behind).

This is the same failure mode that produced `benchmark-landing` (WI-088 iter1 scored well internally but was visually indistinguishable from pre-change baseline).

---

## Proposed Fix

### Option A: Extend `track-visuals` with `competitive-ux` concern

Add a new review-mode concern to `track-visuals`:

```markdown
| `competitive-ux` | Compares the current screenshot against competitor UX patterns from the knowledge base. Flags where competitors handle the same surface better (fewer steps, clearer hierarchy, richer states, smoother transitions). Proposes specific improvements with competitor citations. |
```

**Requirements:**
- Reads `references/knowledge/competitors/<slug>/CAPABILITIES.md` and `references/landing-bank/<sector>/` for pattern reference
- Performs interactive browsing (not just static screenshots) to verify flow efficiency
- Outputs: ranked improvement proposals with competitive citations, not just issue flags

**Pros:** Reuses existing track-visuals infrastructure.
**Cons:** `track-visuals` is designed for static screenshot analysis; competitive UX often requires flow comparison (multi-step interactions).

### Option B: New skill `explore-ux`

Create `explore-ux/SKILL.md` as an interactive competitive UX exploration skill:

**Modes:**
- `competitive-benchmark` — browse app flows, compare step count / clarity / delight against competitor knowledge base
- `friction-audit` — identify unnecessary steps, dead ends, cognitive load vs. competitor best-in-class
- `innovation-proposal` — propose UX improvements grounded in competitor patterns + domain knowledge

**Inputs:**
- `references/knowledge/competitors/<slug>/` (competitor knowledge base)
- `references/landing-bank/<sector>/` (visual reference bank)
- Live app URL

**Outputs:**
- `docs/specs/ux-exploration/<run-id>.md` — findings + competitive citations + proposals
- `.svc/ux-exploration/<WI>/proposals.jsonl` — structured improvement proposals

**Pros:** Dedicated skill with clear scope; can require interactive browsing for flow analysis.
**Cons:** New skill to maintain; overlaps partially with `test-journeys` exploratory mode and `track-visuals` review mode.

### Recommendation

**Adopt Option B as a new skill.** The gap is large enough and distinct enough from existing skills that extending `track-visuals` would overload its contract (static screenshot analysis vs. interactive flow benchmarking). `explore-ux` can explicitly declare `analyze-competitors` and `benchmark-landing` as prerequisites, ensuring it runs only when competitive knowledge exists.

---

## Comparison delta

| Capability | svc (current) | gstack | superpowers | Gap? |
|-----------|--------------|--------|-------------|------|
| Competitive visual benchmarking (landing) | `benchmark-landing` (8 dimensions) | Not documented | Not documented | No gap |
| Competitive visual benchmarking (general UX) | None | `plan-design-review` (0-10 scoring against design.md) | Not documented | **Yes — this proposal** |
| Interactive competitive flow exploration | None | Not documented | Not documented | **Yes — this proposal** |
| Exploratory testing with competitive knowledge | `test-journeys` (generic patterns) | Not documented | Not documented | **Yes — this proposal** |

---

## Stale proposal audit

- `proposals/done/2026-04-13-visual-coverage-and-comprehension.md` — comprehension rubric added, but competitive lens not included
- `proposals/done/2026-05-01-competitive-awareness-gap.md` — competitive mechanics gap identified, visual/UX gap not covered
- `proposals/done/2026-05-02-competitive-grounding-as-default.md` — Industry Grounding section for specs, no interactive exploration skill

---

## Recommendation

1. Accept this proposal
2. File as framework work item (explore-ux skill creation)
3. Run `write-spec` → `plan-changeset` for `explore-ux` skill
4. After landing, `explore-ux` becomes an optional pre-lane skill triggered when user asks competitive UX questions or when `route-workflow` detects visual/UX exploratory intent
