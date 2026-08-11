# Proposal — design-logo skill evolution: reach designer-grade with AI alone

**Date:** 2026-05-02 (revised — designer-handoff rule REMOVED)
**Triggered by:** Example Marketplace session 2026-05-01 → 2026-05-02 — 4 rounds, 60+ generated options, "winner" still feels unspecial. User: "this can't be the solution."
**Author:** Claude (Example Marketplace session)

## Reframe — AI era, no human designer escape hatch

The current skill (Phase 9 saturation gate) treats designer handoff as the legitimate exit when AI plateaus at ~60/70. **This proposal removes that rule entirely.** In the AI era, "hire a designer" is not the answer — the skill must reach designer-grade output itself or it has failed.

This means:

- **No score ceiling.** The skill must drive ≥65/70 every run.
- **No handoff brief.** Phase 9b "Designer-handoff is graduation" is deleted.
- **Failure to reach 65/70 is a SKILL bug, not an acceptable outcome.** Every plateau triggers a deeper iteration mode, not a handoff.
- The new Phase 9 verdict at <65/70 is: "the iteration loop wasn't deep enough — re-enter Phase 8 with new constraints" — not "give up and pay a human."

The bar is now: **what a senior designer at Pentagram / Collins / Mucho would ship after 40 hours of work.** Reach it with AI orchestration or fix the skill.

## Why the current skill produces ~60/70 plateaus

Reading the current SKILL.md (317 lines, 14 phases) reveals the skill is well-designed for **batch SVG-coded generation** but misses the orchestration moves that real senior designers make:

1. **Skill never auto-triggers from ad-hoc image-gen sessions.** When the user pastes Base44 image-gen URLs and asks for evaluation, route-workflow doesn't recognize this as a design-logo run. We did 60+ options across 4 rounds without ever entering the formal phase progression. No saturation gate was ever evaluated.

2. **No love-test / impressive-test.** Every check is "is this competent / legible / on-brand." Nothing asks "is this **memorable** / **impressive** / **lovable**." A logo can pass all 7 rubric axes AND still feel like nothing-special.

3. **No lockup-stutter test.** A monogram of letter X cannot sit next to a wordmark starting with X — "H + Example Marketplace" is visual stutter. Caught manually after declaring round-4 #6 the winner.

4. **Breadth-over-depth iteration.** Phase 8 says "iteration loop on top 3" but in practice we keep generating NEW concepts each round rather than refining 2-3 in depth. After round 2, all generation should be deep variations of survivors.

5. **No multi-tool-orchestration for refinement.** Senior designers iterate by combining tools (Figma + Illustrator + hand sketches + critique). The skill calls one image-gen provider per round and treats output as final. Real designer-grade iteration uses: image-gen for ideation → SVG hand-edit for geometry refinement → image-gen img-to-img for style polish → vector trace → kerning + curve audit → final raster.

6. **No "memorable hook" requirement.** Great marks have ONE undescribable element (the FedEx arrow, the Toblerone bear, the Wendy's hidden "mom"). The skill doesn't require concepts to demonstrate this.

7. **No constraint-tightening when plateaus hit.** Real designers respond to plateaus by ADDING constraints (one-color only, geometric only, must work in negative space, must have hidden meaning). The skill doesn't escalate constraints when iterations flatline.

8. **Image-gen output treated as terminal.** Image-gen is a SKETCH stage. The skill needs an explicit refinement pipeline that takes the sketch → hand-edited vector → motion test → context test → sand-grain polish.

## Concrete additions

### Add Phase 1c — Concept commitment ledger
After Phase 1, the skill writes `docs/specs/logo-pack/concept-ledger.md`:

```yaml
round: 1
mode: exploration  # exploration | refinement | polish | terminal
concepts_introduced: 8
concepts_advanced: 3
new_concepts_allowed_next_round: 0  # AFTER round 2, no new concepts
```

Hard rule: **after round 2 the mode flips to `refinement`. No new concepts may be introduced.** Rounds 3-5 are 4-variation deep-dives on survivors. Round 6+ flips to `polish` mode (sand-grain refinement on the single chosen mark). New concepts in refinement/polish mode = skill failure.

### Add Phase 5b — Love-test gate (the 5 questions that actually matter)

After self-score and exemplar-2up, before persona simulation, run on top 3:

1. **Tattoo test:** "Would the founder tattoo this on their forearm?" If no — concept is competent, not lovable. Flag for deeper iteration in Phase 8.
2. **$5k test:** "If a top-tier studio handed this to the founder for $5k, would they accept it as the deliverable?" If no — same flag.
3. **Reverse-jealousy test:** "If a competitor shipped this tomorrow, would the founder be impressed or shrug?" Shrug = flag.
4. **5-year test:** "Will this look intentional or dated in 2031?" Dated = disqualified outright (catches gradients, AI-render-of-the-month, palette-of-the-year).
5. **Stranger test:** "Show this to one person OUTSIDE the project for 2 seconds. Ask 'what does this company do?' If wrong/unknown → semantic fit fail."

Failures here do NOT trigger handoff — they trigger **constraint-tightening Phase 8** (see below).

### Add Phase 7b — Lockup-stutter test (mandatory for monogram-class marks)

If the chosen mark is a single letter AND that letter is the first letter of the brand name, render mark + wordmark side-by-side at 4:1 horizontal lockup. If the letter visually duplicates against the wordmark's first character (Pinterest P + "Pinterest", Example Marketplace H + "Example Marketplace"), the mark is **disqualified for production lockup use** regardless of rubric score. The skill loops back to Phase 3 and generates non-letterform alternatives.

### Rewrite Phase 8 — Multi-tool refinement pipeline (the designer-grade move)

Replace the current 3-pass loop with a **toolchain pipeline** mimicking how senior designers actually work:

```
Refinement pipeline (run on each top-3 concept):

Stage A — Geometry refinement (hand-edit SVG)
  - Vectorize the image-gen sketch (potrace → manual cleanup)
  - Optical correction: weights, balance, asymmetric tension
  - Bezier curve smoothing (no kinks, no over-anchored points)
  - Save vector pre-polish

Stage B — Style transfer iteration (image-gen img-to-img)
  - Send Stage-A vector + 3 different style prompts back to image-gen
  - "Same composition, executed in [Pentagram, Collins, Sagmeister] style"
  - "Same composition, with one ASYMMETRIC tension element added"
  - "Same composition, find and embed a HIDDEN second meaning"
  - Pick best of 3 by eyeball + score

Stage C — Vector trace + kerning + curve audit
  - Re-trace Stage-B winner to clean SVG
  - Per-pair kerning (Tr, AV, LT, Wo, rs)
  - Bezier smoothing pass 2
  - Optical compensation at 16px, 32px, 64px

Stage D — Motion + context test
  - Animate mark draw-on (~600ms reveal) — does the geometry FLOW?
  - Render in 5 contexts (nav header, favicon, app icon, OG card, storefront mockup)
  - Eyeball on each — passes Phase 5b love-test in EVERY context?

Stage E — Sand-grain polish
  - Sub-pixel adjustments (anchor point cleanup, stroke endpoints, micro-radii)
  - Color value tuning (hex codes vary by ±2 for optical balance — purple at 16px ≠ purple at 256px)
  - Final 2-up against the named exemplar from Phase 5
  - If exemplar still outclasses → re-enter Stage A with constraint added

Each stage MUST improve combined score by ≥2 points or the stage is failed and retried with new constraint.
```

The pipeline is non-negotiable: 5 stages × 3 candidates = 15 micro-iterations per refinement round. AI-orchestrated, no human designer.

### Add Phase 8b — Constraint-escalation when plateau hits

When a refinement round produces zero score improvement (combined-score delta ≤1), escalate constraints:

| Plateau # | Added constraint |
|---|---|
| 1 | One-color only (force geometric primacy) |
| 2 | Must work in negative space (force structural cleverness) |
| 3 | Must contain a HIDDEN second meaning (FedEx arrow class) |
| 4 | Must be drawable in ≤5 path operations (force radical reduction) |
| 5 | Must embed a brand-vocabulary glyph (e.g. for Example Marketplace: a clock-mark, time-mark, or hours-glyph) |

Each constraint forces the agent out of safe territory. Plateaus stop being "the AI hit its ceiling" — they become "we haven't constrained the search hard enough."

### Tighten Phase 9 — saturation gate WITHOUT designer handoff

```
| Combined score | Action |
|---|---|
| ≥ 65/70 | Promote. Run Phase 5b love-test once more. If 5/5 pass → terminal Phase 13. If <5/5 → Phase 8 Stage A with new constraint. |
| 60–64 | Phase 8 full pipeline rerun + Phase 8b plateau escalation |
| 56–59 | Phase 8b ALL constraints stacked simultaneously + cross-model judge re-score (Phase 6) |
| < 56 | Brief itself is broken — re-enter Phase 0 with constraint forensics ("which axis are concepts failing on?") |
```

**No designer handoff exit. Ever. The skill terminates only at ≥65/70 with 5/5 love-test pass.**

If the agent finds itself plateaued for 3+ rounds despite constraint escalation, it MUST log a framework-gap entry naming the specific failure mode — not punt to a human.

### Delete Phase 9b designer-handoff entirely

Current SKILL.md lines 256-291 (Designer-handoff brief, "What's needed from you", "Why we stopped") are removed. Replaced with:

```
## Why the skill cannot stop below 65/70

The skill is responsible for reaching designer-grade output via AI orchestration alone.
Plateau is a search-space problem, not a craft-ceiling problem. Every plateau has a
constraint that breaks it. Find the constraint or log the framework gap.

There is no human designer escape hatch.
```

### Add Phase 13 amendment — Founder-eyeball as the saturation truth

Phase 13's eyeball check currently focuses on technical fails (orphan text, palette mismatch). Add the **emotion check**:

After capturing in-app verification screenshots, the skill asks the founder ONE question:

> "Looking at this on the live site with fresh eyes — does this impress you, or does it just look fine?"

A "fine" / "okay" / "I guess" / "sure" answer is the same as a hard-fail. The skill drops back to Phase 8 Stage A with constraint escalation. **A shrug from the founder is decisive — it cannot be overridden by rubric score.**

This is the move the current session needed and never got: I kept declaring 7-8/10 winners; the founder kept shrugging; the skill should have caught that as a saturation failure and re-iterated, not let me confirmation-bias above 60.

### Add route-workflow recognition rule

When the user pastes ≥3 image URLs from a known image-gen domain (`media.base44.com`, `oaiusercontent.com`, `r2.cloudflarestorage.com`, `imagine-image.app`, `cdn.midjourney.com`) AND the surrounding text mentions "logo" / "mark" / "brand" / "concept", route-workflow auto-invokes design-logo in **evaluation mode** (skips Phase 1-3, enters at Phase 5 with the user's pasted images as concepts). This catches the failure mode of this session: image-gen iteration without skill formalism.

### Extend exemplar bank with "memorable hook" entries

Add to `references/exemplar-bank-2026.md` ≥10 entries demonstrating the hidden-meaning / hook quality:

- FedEx (negative-space arrow)
- Toblerone (bear in the mountain)
- Amazon (a-to-z curve)
- Hershey's Kisses (Kiss in the wordmark gaps)
- Tour de France (cyclist in the R)
- Pittsburgh Zoo (gorilla + lion in negative space)
- Wendy's (hidden "mom")
- Baskin-Robbins (31 in BR)
- Tostitos (two friends + chip + salsa)
- Galleries Lafayette (G-L ligature)

Each entry documents the "principle" — what makes the hook DISCOVERABLE vs hidden. The skill reads these in Phase 5b before love-testing.

## Acceptance criteria for landing this proposal

- New `Phase 1c` concept-ledger added; new-concepts-after-round-2 rule enforced by validator
- New `Phase 5b` love-test added with 5 explicit questions
- New `Phase 7b` lockup-stutter check added
- `Phase 8` rewritten as 5-stage multi-tool pipeline (geometry → style transfer → vector → motion/context → sand-grain)
- New `Phase 8b` constraint-escalation ladder added
- `Phase 9` rewritten — no handoff exit, only constraint-tightening loop
- `Phase 9b` and "Designer-handoff brief" sections DELETED entirely
- `Phase 13` amended with founder-emotion check
- route-workflow updated to auto-invoke design-logo on pasted image-gen URLs
- `references/exemplar-bank-2026.md` extended with 10 hidden-hook entries
- Test: Example Marketplace session re-evaluated under new skill should iterate INTO ≥65/70 mark via constraint escalation, not handoff
- Validator: `validate-design-logo-no-handoff.sh` greps SKILL.md for forbidden phrases ("hire a designer", "designer handoff", "AI ceiling", "human designer", "external designer") and fails the lint if any present

## Files touched (proposed)

- `design-logo/SKILL.md` (~+150 lines net after deleting handoff section)
- `design-logo/references/exemplar-bank-2026.md` (+~80 lines for hidden-hook entries)
- `route-workflow/SKILL.md` or `route-workflow/references/intent-routing.md` (+~10 lines)
- `test-framework/evals/tier-1/validate-design-logo-ledger.sh` (new)
- `test-framework/evals/tier-1/validate-design-logo-no-handoff.sh` (new — enforces no-handoff rule)
- `references/framework-learnings.jsonl` (new entries: lockup-stutter, founder-shrug-as-saturation-truth, no-handoff-exit-rule)

## Application to Example Marketplace immediately

The new rules say **don't hire a designer, don't ship the mediocre arch, escalate constraints and iterate.** Concretely:

1. Take the current arch-doorway+half-clock as the structural starting point.
2. Apply Phase 8b constraint #1: one-color only. Force the agent to find the SHAPE that works without color helping.
3. Apply Phase 8b constraint #3: must contain a hidden second meaning. The arch + clock should encode TWO ideas (door = walking into a business, clock = hours) AND a hidden third (e.g. an "H" formed by negative space, or the clock hand pointing at a specific narrative time, or the threshold doubling as a smile).
4. Apply Phase 8b constraint #4: drawable in ≤5 path operations. Forces radical reduction.
5. Run Stage B style-transfer with senior-studio prompt vocabulary (Pentagram, Collins, Mucho, Sagmeister).

If after 3 rounds of constraint-stacked iteration we still plateau below 65, log a framework-gap entry naming the specific failure mode and continue iterating — never handoff.

## Decision required

- Land this proposal via plan-changeset (proper framework lane)? — say "yes land it"
- Apply the new rules to Example Marketplace immediately (3 rounds of constraint-stacked image-gen on the arch survivor)? — say "iterate example-marketplace"
- Both? — say "both"
