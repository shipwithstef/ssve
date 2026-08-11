# Framework Evolution — 2026-04-13: Market Readiness Judge + ICP Simulation + Competition Depth

## Method

Evidence sources read:
- `FRAMEWORK-STATE.md` (full blend history + analysis history — no prior readiness/judge work found)
- `analyze-competitors/SKILL.md` (full — hardcoded "top 5" found at lines 65, 77-80, 204)
- `analyze-marketing/SKILL.md` (first 60 lines — persona validation exists but no readiness scoring)
- `route-workflow/SKILL.md` (lines searched — "launch.ready" returns 0 hits; the pipeline defers to user)
- `references/skill-pack-comparison.md` (lines 22, 34, 80, 118 — CEO/scope review is a confirmed gap vs gstack)
- `references/knowledge/gstack/details/skills-catalog.md` (lines 20-57 — `/office-hours` + `/plan-ceo-review` + `/autoplan` documented)
- `references/knowledge/svc/details/skills.md` (framework skill listing)

**User observation that triggered this:** After WI-032 closed (all active task graphs = 0), `route-workflow` output asked "if the app is launch-ready" as a user question. The pipeline should NEVER defer this question to the user — the pipeline has all the information needed to answer it (vision, journeys, pending WIs, E2E pass rate, competitive position, visual baseline).

Evidence: `route-workflow/SKILL.md` "strategic flag" pattern — no routing rule exists for "assess readiness before suggesting GTM vs features."

---

## Findings (by priority)

### P0 — Fix now (blocks quality)

#### 1. `route-workflow` defers launch-readiness to the user instead of self-assessing

**Category:** Gap  
**Evidence:** Live session — route-workflow answered WI-032 close with "Strategic flag: If the app is launch-ready...". No skill, routing rule, or heuristic in `route-workflow/SKILL.md` covers "after all active WIs close, assess readiness before suggesting next item." The pipeline has the inputs to self-assess:
- `docs/specs/vision.md` — target user + problem
- `docs/specs/work-items/INDEX.md` — all WIs, types, severities
- `docs/specs/personas/` — expected user expectations
- `docs/specs/analyze-competitors.md` — competitive table stakes
- `e2e/` pass rate + visual baseline state
- `docs/specs/project-state.md` — active lane + position

**Fix:** Add `assess-market-readiness` to the `route-workflow` cross-skill routing table. Trigger: "when active task graphs = 0 AND no critical/high severity WIs remain AND user asks what's next." Route to `assess-market-readiness` instead of guessing GTM vs features. See proposed new skill below.

---

### P1 — Fix soon (degrades quality)

#### 2. `analyze-competitors` is capped at 5 — too shallow for real competitive intelligence

**Category:** Gap  
**Evidence:** `analyze-competitors/SKILL.md:77` — "Select the 5 most relevant competitors." Self-verify check at line 204: "At least 3 competitors analyzed." User explicitly states the framework should track "up to 20, more versatile." 5 competitors gives:
- Direct: 3
- Adjacent: ≤2
- Emerging: 1 (if it fits the 5)

This misses the full landscape for any mature domain. A startup entering SMB SaaS will have 15+ relevant competitors across direct/adjacent/disruption vectors.

**Fix:** Restructure `analyze-competitors/SKILL.md` Step 2 and the output template to support 4-tier tracking:

| Tier | Count | Criteria |
|---|---|---|
| Direct | up to 6 | Same problem, same user, same category |
| Adjacent | up to 5 | Same user, different solution OR same solution, different user |
| Emerging/Insurgent | up to 5 | New entrants, funded startups, open-source disruptors |
| Macro disruptors | up to 4 | AI models, platform incumbents that could absorb the space |

Total: up to 20. Each tier needs only the dimensions that matter for that tier (macro disruptors don't need G2 reviews; direct competitors need full depth).

Self-verify check update: "At least 3 per tier OR explicit justification why a tier has fewer."

#### 3. No moat assessment dimension in any skill

**Category:** Gap  
**Evidence:** `analyze-competitors/SKILL.md:98-107` — Step 4 synthesizes whitespace (what nobody does), competitive features, and user pain. No "moat" concept appears. `validate-feature/SKILL.md` has kill signals but not moat scoring. `references/skill-pack-comparison.md` confirms no moat assessment gap row exists.

A moat is not just whitespace — it's a durable reason a user who chose you stays with you. Whitespace = an opening. Moat = why they can't easily leave. These are different questions with different answers.

**Fix:** Add a **Moat Assessment** section to `analyze-competitors/SKILL.md` Step 4, after whitespace synthesis:

```markdown
## Moat Assessment

For each whitespace opportunity, score moat durability (1–5):
- 1 = Feature parity: competitor can ship the same thing in a sprint
- 2 = Execution gap: competitor CAN do it but is slower/worse
- 3 = Data/network moat: requires accumulated data or users to replicate
- 4 = Integration lock-in: switching cost after setup is real
- 5 = Structural moat: regulatory, geographic, certification, or proprietary pipeline

Products with no moat (all 1s) are revenue plays, not defensible businesses.
Products with mixed moats can be defensible if the 3+ moats reinforce each other.
```

#### 4. No `assess-market-readiness` skill (the judge persona gap)

**Category:** Opportunity (NEW SKILL NEEDED)  
**Evidence:**
- `references/skill-pack-comparison.md:34` — CEO/scope review is a confirmed gap vs gstack's `/plan-ceo-review`
- `references/skill-pack-comparison.md:22` — Feature discovery gap vs gstack's `/office-hours`
- gstack's `/autoplan` runs CEO + design + eng + DX reviews sequentially — svc has no equivalent multi-role assessment
- No "launch readiness" trigger exists in `route-workflow/SKILL.md`

**What it needs to do:** Read the project's own artifacts and simulate multiple judges scoring the product. Not ask the user — answer the question the pipeline already knows the data for.

**Proposed skill: `assess-market-readiness`**

Modes:
1. **`--stage launch`** — Is the product ready to acquire first paying customers? Score across 8 dimensions.
2. **`--stage hackathon`** — Would this win? Score against hackathon judging rubrics (novelty, completeness, presentation potential, technical ambition).
3. **`--stage vc`** — Would a seed investor take a meeting? Score against: market size, traction signal, team/builder fit, moat, execution evidence.
4. **`--stage product-market-fit`** — Does this have it? Score against retention proxy, expansion revenue potential, word-of-mouth surface.

**Inputs read automatically (no user input needed):**
- `docs/specs/vision.md` — problem + target user
- `docs/specs/personas/` — who uses this, what they need
- `docs/specs/journeys/` — what the product actually does end-to-end
- `docs/specs/work-items/INDEX.md` — open WIs, severities, types
- `docs/specs/analyze-competitors.md` — competitive position
- `docs/specs/project-state.md` — phase, active lane, completed work
- `.svc/visuals/` — visual baseline state
- E2E pass rate (from most recent run logs)
- Builder profile (`~/.svc/builder-profile.md`) — for VC/launch mode

**Output:** A scored assessment (not just words) with:
- Overall readiness score per mode (0–100)
- Per-dimension breakdown with specific gap callouts
- Blocking gaps (things that MUST be fixed before this mode's target)
- Non-blocking gaps (nice to have before this mode's target)
- Recommended next action: `continue features (WI-XXX first)` OR `start GTM (route to /launch-strategy)`

**Judge roles simulated:**
- YC partner (office hours mode): forces 6 questions, pushes on demand evidence
- Seed VC (vc mode): TAM, defensibility, traction, team
- Hackathon judge: 3-5 rubric criteria + demo-ability score
- Synthetic target user persona (launch mode): would THEY use this, or do they want more?

**Integration into `route-workflow`:** When active lane graphs = 0 AND all critical/high WIs are resolved AND user asks "what's next?", `route-workflow` should run `assess-market-readiness --stage launch` automatically and include the score in its routing output. The routing becomes: `if score >= 70 → GTM first, then features / if score < 70 → fix highest-blocking gap first`.

---

#### 5. No ICP simulation — who exactly would use this and would they?

**Category:** Gap (NEW CAPABILITY)  
**Evidence:** `analyze-marketing/SKILL.md` has "persona validation" but it validates messaging copy, not "find real people and simulate whether they'd adopt." `build-personas/SKILL.md` creates fictional personas from vision. Neither skill:
- Identifies real businesses/people who match the ICP
- Uses social profile data to simulate adoption likelihood
- Scores individual prospects before cold outreach

**Proposed addition to `assess-market-readiness` or new `find-icp` skill:**

**Step: Synthetic ICP discovery + adoption simulation**

1. From vision + personas: extract the ICP definition (business type, size, geography, role, pain signature)
2. Search for real exemplars: 5-10 real businesses or people that match the ICP profile (via WebSearch: "[business type] [city] [size signal]", Reddit/LinkedIn posts matching the pain)
3. For each exemplar: simulate adoption likelihood based on:
   - Does their current tool stack have this gap?
   - Do they talk about this pain in public (reviews, forums, posts)?
   - What's their switching cost profile?
   - What objections would they raise?
4. Produce a **cold outreach target brief** per exemplar: why they'd care, what to lead with, what to avoid
5. Score the exemplar pool: are these people findable and reachable via the builder's existing channels?

This turns "who would use this?" from a guess into a simulation grounded in real profiles.

---

### P2 — Improve when possible

#### 6. `analyze-competitors` has no staleness trigger

**Category:** Fragility  
**Evidence:** `analyze-competitors/SKILL.md:42-48` — knowledge-first check exists but has no staleness rule. A competitor analysis from 30+ days ago may be factually wrong (pricing changes, feature launches, company acquisitions). The framework has no mechanism to flag stale competitive intelligence.

**Fix:** Add staleness check to Step 1 of `analyze-competitors`: if `docs/specs/analyze-competitors.md` exists and was last updated >30 days ago, warn "competitive landscape may be stale — re-run with `--refresh` to update." Add `--refresh` mode that updates only the "current buzz" and pricing rows without full re-analysis.

#### 7. User expectation gap has no cross-stage scan

**Category:** Gap  
**Evidence:** `validate-feature/SKILL.md` checks if users NEED a feature. No skill checks if users are SATISFIED with what's built — "do they expect this, or something more?" This is the retention question: is the product delivering on the promise made in the vision, from the user's perspective?

**Fix (small):** Add a "Expectation Audit" to `assess-market-readiness --stage launch` that cross-references: for each journey in `docs/specs/journeys/`, does the current implementation fully deliver the user value described? Gaps become "expectation shortfalls" — distinct from bugs (broken) and WIs (planned). An expectation shortfall is "works but undershoots."

---

### P3 — Track (not actionable yet)

#### 8. Visual quality assessment against competitor benchmarks

**Category:** Opportunity  
**Evidence:** `track-visuals` captures and diffs screenshots but does not score them against competitive visual quality. gstack's `/plan-design-review` rates design dimensions 0-10. The question "will users like the visuals?" requires comparing to competitors' UX quality bar, not just internal consistency.

**Status:** Not actionable until `assess-market-readiness` exists (visual score is one of its 8 dimensions). Blocked on P1 #4.

---

## Comparison delta

| Capability | svc today | gstack | Assessment |
|---|---|---|---|
| Market readiness scoring | None — defers to user | `/plan-ceo-review` (4 scope modes) + `/autoplan` runs all reviews | **High-value gap** — P1 fix |
| Multi-role judge (VC, YC, customer) | None | `/office-hours` YC-mode | **High-value gap** — P1 fix |
| Competitive depth | Top 5 | Not specified but broader | **Medium gap** — P1 fix |
| ICP simulation | None | None observed | **New capability** — P1 addition |
| Moat assessment | None | Partial (whitespace analysis) | **Medium gap** — P1 fix |
| Staleness detection | None (knowledge-first exists) | Not observed | **Small gap** — P2 fix |

---

## Stale proposal audit

| Proposal | Status |
|---|---|
| `2026-04-12-framework-improvement-blend-last30days.md` | Pending — check if implemented |
| `2026-04-13-visual-coverage-and-comprehension.md` | Pending — P1 findings, not yet implemented |

---

## Implementation Roadmap

| Priority | Action | Skill target | Effort |
|---|---|---|---|
| P0 | Add `assess-market-readiness` routing rule to `route-workflow` | `route-workflow/SKILL.md` | XS (3 lines) |
| P1 | Expand `analyze-competitors` to 4-tier (up to 20) + moat scoring | `analyze-competitors/SKILL.md` | S |
| P1 | Create `assess-market-readiness` skill (new skill, 4 modes) | new `assess-market-readiness/SKILL.md` | L |
| P1 | Add ICP simulation to `assess-market-readiness` or new `find-icp` | new skill or sub-step | M |
| P2 | Staleness trigger for `analyze-competitors` | `analyze-competitors/SKILL.md` | XS |
| P2 | Expectation audit in `assess-market-readiness --stage launch` | new skill | included in L above |

**Recommended implementation order:** Create `assess-market-readiness` first (it's the anchor). Then expand `analyze-competitors` (its output feeds the new skill). Then wire `route-workflow` (the routing fix is trivial once the skill exists).
