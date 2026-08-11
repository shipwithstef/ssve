# Phase 4: Cross-Methodology Insights

> "The deliverable is not 'who wins' — it's 'what practices actually matter and why.'"

## Question 1: Does specs-before-code catch things code-first misses?

**Answer: YES, but with a critical caveat.**

svc's spec phase identified 5 cascade dependencies (trend-scraping service, recommendation engine, content aggregator, social platform APIs, LLM provider API). None of the other approaches discovered these as separate concerns — they just built them inline.

**The caveat:** Having specs didn't guarantee the code implemented them. Serious Vibe Coding identified 30 ACs but implemented ~20. The spec captured the three deployment modes in the vision doc, but the code had ZERO deployment mode references. The spec-to-code boundary is where svc loses information.

**The practice that matters:** Specs should be LOADED into context during code generation, not just written and filed. The spec is only useful if the agent reads it while writing code. svc's doctrine says this (Layer 2 cache), but the execution didn't enforce it.

## Question 2: Does progressive narrowing reduce ambiguity vs direct coding?

**Answer: MIXED.**

Progressive narrowing produced the best DOCUMENTATION:
- Vision doc: 12 sections, well-articulated product direction
- 3 personas with trust tiers
- 30 specific ACs (vs. ~0 for raw)
- Identified non-goals and boundaries

But it did NOT produce the best CODE:
- Raw and obra captured deployment modes; svc didn't
- Raw had best first-time UX; svc required profile setup
- Raw: 19/19 universal expectations; svc: 15/19

**Why:** Each phase narrows the SPEC, not the CODE. The narrowing chain (vision→persona→spec→UX→UI→tech→code) works IF each phase actually constrains the next. In this run, the code phase didn't fully read the spec phase's output. The agent wrote code from general knowledge, not from the accumulated constraints.

**The practice that matters:** Progressive narrowing is valuable if there's a HARD CONSTRAINT that code generation reads the spec. Without enforcement, the agent pattern-matches from training data instead of from the spec.

## Question 3: Does cascade discovery find dependencies others miss?

**Answer: YES — cascade discovery is valuable but under-leveraged.**

Serious Vibe Coding identified 5 dependencies. The other approaches built equivalent functionality inline without naming it:
- Obra: seed/trends.ts + seed/resources.ts (unnamed "trend scraping" and "content aggregation")  
- Raw: db.ts has both trend data and resource data (completely implicit)
- gstack: database.ts has everything in one file

Cascade discovery's value is ARCHITECTURAL CLARITY, not functional completeness. When you name a dependency, you can spec it separately, test it separately, and replace it separately. When it's inline, it's coupled forever.

**For an MVP:** Cascade discovery is overkill. The inline approach is faster.
**For a production system:** Cascade discovery prevents architectural debt.

## Question 4: Does pre-written E2E from journeys beat tests-after-code?

**Answer: INCONCLUSIVE — no approach wrote tests that ran against the live server.**

- Serious Vibe Coding: 16 unit tests (written as part of pipeline) — but no E2E
- gstack: 0 tests
- obra: 0 tests (despite TDD being an "Iron Law" of superpowers)
- raw: 0 tests

**The practice that matters:** None of the approaches demonstrated journey-based testing. The svc unit tests are genuine (16/16 pass), but they test service logic, not user journeys. This is a gap across ALL approaches.

## Question 5: Does gstack's design approach produce better UI than svc's?

**Answer: YES — gstack produced the most visually polished UI.**

Visual quality ranking:
1. **gstack** — Gradient header, velocity indicators (hot/warm/rising), platform emoji tabs, inline resources with reasons, distinct visual identity
2. **raw** — Dark mode with indigo accents, deployment mode badges, mode switcher cards, stat counters, platform tags
3. **obra** — Clean layout with CSS file, mode badge, score bars, category badges, but simpler visual design
4. **svc** — Tailwind CDN, clean but generic. Expandable trend cards, dark mode toggle, but no distinctive visual identity

**Why gstack wins on design:** The gstack agent (simulating office-hours) spent time on user experience before coding. It decided on platform filtering, search, and about page structure BEFORE writing code. The raw agent also scored well because it had no overhead — it wrote the UI directly.

**The practice that matters:** Design decisions should happen BEFORE implementation, but they don't need a formal design system spec. A few targeted questions about UX flow (gstack's "forcing questions") are more efficient than a full UX design + UI design + design system pipeline (svc's Phase 4-5).

## Question 6: What should svc ADOPT from the others?

### ADOPT from raw:
1. **Immediate value on first visit.** Show recommendations without requiring profile setup. Default recommendations based on trend scores alone, personalize after profile completion.
2. **Deployment mode as a first-class concept in code.** DEPLOY_MODE env var + middleware that gates features. This should be part of plan-changeset's config part.
3. **Mode switching UI in settings.** Show which mode is active, describe what each mode does.

### ADOPT from gstack:
4. **Forcing questions before spec.** Add a structured questioning phase (3-5 targeted questions) before write-spec. Office-hours style: "Who is persona 1?", "What platforms?", "What does output look like?" This bridges vision→spec faster than build-personas + validate-feature.
5. **Inline recommendations with reasons.** Don't separate trends from recommendations — show "Learn this because..." directly under each trend card.

### ADOPT from obra:
6. **Plan-to-code file map.** Obra's plan listed every file with its responsibility. This is better than svc's manifest which lists files but not responsibilities. The file map gives the agent more context.
7. **Dedicated middleware per deployment concern.** mode.ts + auth.ts pattern is clean and testable. svc's config.ts should evolve into middleware.
8. **Auth/registration for hosted mode.** The hosted-for-profit mode needs actual user accounts. Obra implemented login/register/logout.

## Question 7: What should svc DROP?

1. **Drop separate UX and UI design phases for MVPs.** Combined, they took significant tokens but didn't improve the code. The design system spec was generic. For a mature product, separate phases make sense. For greenfield MVP, merge into one "UI/UX brief" phase.
2. **Drop the requirement that recommendations need profile setup.** svc's spec said "recommendations ranked by relevance to user's declared skills" — this made the first-time experience empty. The spec was too prescriptive about the mechanism.
3. **Drop sync-spec-code as a separate post-build step.** It should be integrated INTO the code generation phase. The agent should annotate ACs as RESOLVED while writing the code, not after.

## The Meta-Insight

**The overhead/quality tradeoff is non-linear.**

| Approach | Overhead | Universal Score | Code Architecture |
|----------|----------|----------------|-------------------|
| Raw | 0 (no planning) | 19/19 | Minimal (2 files) |
| gstack | Low (forcing questions) | 17/19 | Compact (7 files) |
| obra | Medium (brainstorm+plan) | 18/19 | Excellent (21 files) |
| Serious Vibe Coding | High (9 phases, 15 specs) | 15/19 | Good (20 files) |

For an MVP, the relationship between planning overhead and user-visible quality is NEGATIVE. More planning produced worse user-facing results because:
1. Information was LOST at phase boundaries (spec→code translation)
2. The agent spent context window on spec compliance instead of user requirements
3. The most novel requirement (deployment modes) was in the vision doc but not in the agent's active attention during code generation

For a production system at scale, the relationship likely inverts — specs prevent architectural debt, cascade discovery catches integration gaps, review gates catch inconsistencies. But this test was MVP-scale.

**The right amount of planning depends on project maturity:**
- Greenfield MVP: Raw or gstack-style (forcing questions + direct coding)
- Growing product: obra-style (plan + execute with file map)  
- Mature product: svc-style (full spec pipeline, but with the fixes above)
