# Framework Evolution — 2026-04-20 — Design Benchmark Gate + Longitudinal Framework Self-Assessment

## Method

User-directed audit triggered by honest critique of WI-088 Storyboard landing-page output: *"why is the box so out of proportion — was a screenshot taken and analyzed against some practices? The animation is too fast, too many people too small, too many boxes, figures too basic. Why has this framework run so long and there's no assessment of it?"*

Evidence gathered by inspection:
- `design-ui/SKILL.md:10` — lists `docs/specs/analyze-competitors.md` as an OPTIONAL input
- `design-ui/SKILL.md:500-506` — instructs the skill to "run a web search for 5-10 products in the same space" ad-hoc per invocation
- `audit-implementation/SKILL.md:180` — "Aesthetic Scoring Rubric (Precision, Resonance, Novelty, Efficiency, Maturity)" target 90+, **conditional on a Vibe Contract file existing**
- `track-visuals/SKILL.md:412` — has 1-4 scale comprehension scoring across 6 dimensions
- `rules/web/design-quality.md` — "Anti-Template Policy" with banned patterns (correction rule, not a benchmark gate)
- FRAMEWORK-STATE Analysis History — 30+ framework-level improvements since 2026-04-13; zero "how did the output score vs. reference" entries
- `references/` directory — 16 reference docs; zero sector-landing-sample banks

Skipped (already in FRAMEWORK-STATE): OpenCode harness, agents primitive, review-plan gate, orchestrator parsimony, External Canvas Handoff repositioning, background-task hygiene, token instrumentation, project-secrets hygiene. All landed.

## Self-assessment of WI-088 landing output (the assessment that never happened)

Rated 1-10 on 8 dimensions against indie SaaS 2026 references (Linear, Raycast, Attio, Bench, Arc, Resend, Stripe, OpenTable). **No skill produced this score during the pipeline run.** I'm producing it now, post-hoc.

| Dimension | Score | Evidence |
|---|---|---|
| Proportion & density | 3/10 | 1600×900 scene with 15+ animated elements crammed into ~600×338 embedded card. Density ~3x too high for container. |
| Text hierarchy | 5/10 | Left column headline strong. Right scene's "13 minutes later, sold out." gradient competes at tiny scale, unreadable. |
| Motion tempo | 3/10 | 12 characters walking simultaneously at small size reads as busy noise, not narrative. Eye cannot pin a story. |
| Illustration craft | 4/10 | Flat-SVG walking people scaled from 80×140 to ~30×52 px read as colored blobs. Faces / bodies / props indistinguishable. |
| Viewport responsiveness | 5/10 | ResizeObserver scales uniformly; scene content doesn't reflow or simplify at smaller sizes. |
| Left-right balance | 7/10 | Classic copy + live-demo hero pattern is sound. Kept after restore. |
| First-5-sec comprehension | 4/10 | Left column conveys pitch. Right demo too dense to decode in 5 seconds. |
| Vs. best-in-class 2026 indie | 3/10 | Linear uses ONE dashboard clip with 3-4 elements; Raycast uses ONE command demo; we have 15+ elements scaled to 37% of design size. |

**Weighted average: ~4.3/10. Indie SaaS landing bar in 2026 is ~7-8.** Below bar.

**Root cause (not individual-contributor failure — framework-level gap):** svc has 7+ review skills but NONE of them compare the output to external best-in-class samples at the target viewport. Every review checks internal consistency (matches spec? matches plan? lint-clean? matches Vibe Contract?) — none ask "how does this stack up against 10 SHIPPED landing pages from the same sector?"

## Findings (by priority)

### P0 — Fix now (blocks quality)

#### F-001: No curated per-sector landing reference bank [Gap, CRITICAL confidence]

**Evidence:** `design-ui/SKILL.md:506` instructs *"Run a web search for 5-10 products in the same space"* but:
- Results are ad-hoc per invocation, not cached
- No `references/landing-bank/<sector>/` directory exists anywhere in svc
- Each project re-does reference collection imperfectly
- No persistence means no longitudinal comparison ("does our output improve vs. 2026-Q1 references?")

**Impact:** WI-088 `design-ui` run did NOT consult actual reference screenshots of Linear, Raycast, OpenTable, etc. The Vibe Contract was authored against a Claude Design output, which itself had no reference bank. Every decision downstream was "is this internally consistent" not "is this at the market bar."

**Proposed fix:** New skill `reference-bank-builder` (or extend `analyze-competitors`) that populates `references/landing-bank/<sector>/<product-name>/{screenshot.png,metadata.md}` with: year, persona type (indie vs enterprise), audience, sector, observable patterns (hero layout, element count, motion density, text hierarchy weights). Start with 10-sample bank for each: local-business-SaaS, dev-tools, productivity, commerce. The bank is framework-level (shared across projects), cached, and dated.

#### F-002: No automatic 1-10 quality score against external samples [Gap, CRITICAL]

**Evidence:** `audit-implementation/SKILL.md:180` Aesthetic Scoring Rubric (90+ target) is conditional on a `vibe-contract.json` existing — a feature-level INTERNAL contract check. `track-visuals/SKILL.md:412` has 1-4 scale comprehension scoring on isolated dimensions. Nothing computes **"output vs. sample bank → gap analysis → score."** For WI-088 this should have flagged "density 3x too high for embedded size, motion tempo chaotic at this viewport."

**Impact:** Framework has run 30+ landing-adjacent WIs without anyone generating a comparable score. No longitudinal trend. No regression detection. Output quality drifts undetected.

**Proposed fix:** New skill `benchmark-landing` (invoked by design-ui self-verify OR as a standalone gate). Inputs: local URL + target sector + target persona. Behavior:
1. Capture screenshot at 3 viewport widths (1600, 1024, 390)
2. Load the N samples from `references/landing-bank/<sector>/`
3. For each sample, extract: element count, hero layout (single/dual-col), motion count, text-hierarchy ratio, primary-content density
4. Compute per-dimension gap (ours vs. bank median)
5. Emit 1-10 score per dimension + aggregate weighted score
6. Block promotion if aggregate < 7 without explicit override + justification

Output shape: structured YAML (follows `references/plan-review-protocol.md` format so orchestrator parses deterministically).

#### F-003: No viewport-size-rerun rule in visual review [Gap, CRITICAL]

**Evidence:** `track-visuals/SKILL.md` captures screenshots but doesn't mandate re-review when the same scene is mounted at different sizes. WI-088: Storyboard reviewed at 1600×900 (full-bleed dev mode) then deployed at ~600×338 (embedded in right column of hero). Scale factor 0.375x destroys legibility. No alarm.

**Impact:** Any component that is scale-responsive (Tailwind aspect-ratio cards, embedded widgets, modals) can silently degrade at production size while passing review at design size. WI-088 is the concrete instance.

**Proposed fix:** Amendment to `track-visuals/SKILL.md`:
- Every visual review MUST capture at every viewport width the component is used at (not just design-size)
- MUST compute per-viewport score independently; flag any viewport where score < bank median
- Omni (mimo-v2-omni) prompt extended with: "flag any element that is readable at viewport X but unreadable at viewport Y"

### P1 — Fix soon (degrades quality)

#### F-004: `analyze-marketing` output not wired into `design-ui` input [Gap, HIGH]

**Evidence:** `design-ui/SKILL.md:10` inputs block lists `competitor-analysis` but NOT any marketing-context artifact. The product's positioning, audience signals, value-prop hierarchy live in `analyze-marketing` output (if it runs) but never flow into the design brief. Designer-skill operates without the product-marketing frame.

**Impact:** Design decisions are made in a marketing vacuum. Hero composition can't align to positioning because positioning isn't in the input. For WI-088 specifically: "Maria, solo café owner, cold traffic, 5-second judgment" was in the WI brief — but the Claude Design handoff happened without any ingested competitor-marketing-context file.

**Proposed fix:** Extend `design-ui` inputs block:
- Add REQUIRED input: `docs/specs/marketing-context.md` (or derived from `analyze-marketing` output)
- Add REQUIRED input: `docs/specs/landing-bank/<sector>.md` (pattern summary from F-001 bank)
- Skill self-verify blocks if either is missing; emits a skip-reason OR routes to `analyze-marketing` first.

#### F-005: No framework periodic self-assessment [Gap, HIGH]

**Evidence:** `test-framework` skill exists but is not invoked on a schedule. FRAMEWORK-STATE Analysis History has 30+ entries about framework CHANGES but zero entries about framework OUTPUT QUALITY scores over time. Cannot distinguish "framework is getting better" from "framework is getting more complex."

**Impact:** Framework runs for 2+ weeks with zero data on whether its outputs have improved. Blind self-improvement. This proposal itself exists ONLY because the user manually noticed; no alarm from the framework.

**Proposed fix:** New Stop hook `svc-output-quality-snapshot` OR `test-framework` extension: every N framework runs OR every 7 days, runs `benchmark-landing` + `assess-market-readiness` + similar scorers against the last K committed artifacts, appends to `.svc/quality-timeseries.jsonl`. New report script `scripts/quality-report.sh --since <date>` surfaces trends. 30-line time series catches regressions.

### P2 — Improve when possible

#### F-006: Illustration craft bar not enforced at asset level [Gap, MEDIUM]

**Evidence:** Storyboard scene's 12-character SVG art was a direct port from Claude Design's output. No skill asked "is the illustration fidelity at the bar for target-persona?" `rules/web/design-quality.md` bans flat-gray templates but doesn't gate character art craft specifically.

**Impact:** Generic character SVGs acceptable for a sketch become an embarrassment at production. Affects any component with illustrated assets.

**Proposed fix (later, scope-specific):** Add to `rules/web/design-quality.md` a "Required Qualities" line for illustration assets: "When using character/scene illustrations, reference bank samples must be weighted ≥ 30% to ensure craft-tier consistency." Low priority until F-001 / F-002 land.

### P3 — Track (not actionable yet)

#### F-007: Taste skills blend from external ecosystem [Opportunity]

User mentioned: *"we tried to take the taste skill for gpt but more there are few with many landing pages examples."* Worth blending specific ones. Not actionable until we have the F-001 reference bank in place to compare against.

**Proposed watchlist:**
- ChatGPT Apps / Custom GPTs with design-example corpora
- Mobbin / Page Flows / Land-book / Lapa Ninja — UI screenshot libraries (can we import as reference bank?)
- GitHub: search "landing-page-examples" with recent stars
- Aider / Cursor community skills that grade design output

Revisit as a blend proposal once reference bank shape is settled in F-001.

## Comparison delta

- **ECC (everything-claude-code)** — has ~47 agents including design-review. Does their design-review have benchmark-comparison? Worth checking. If yes, blend; if no, our F-002 is genuinely novel.
- **Aider** — no equivalent. Aider operates at code-diff level, not design-output level.
- **Stitch / v0 / Lovable** — these ARE the external design tools svc hands off to. They each have internal review loops we don't see. But they don't provide post-ship benchmarking either.
- **ChatGPT web-design "taste" GPTs (SaaS Landing Page Expert, Landing Page Analyzer, etc.)** — user mentioned these. They essentially perform the F-002 function manually. Worth blending their rubric.

**Key delta:** no framework I've seen institutionalizes "output vs. 10 shipped references in sector" as a BLOCKING GATE. svc could be first.

## Stale proposal audit

Pending (`proposals/`):
- `2026-04-14-blocking-discovery-halt-protocol.md` — still BLOCKED (scope decisions pending)
- `2026-04-14-parallel-wi-dispatch.md` — still BLOCKED (scope decisions pending). Note: `scripts/fanout.sh` landed today partially subsumes Tier-1 scope. Worth revisiting to unblock.
- `2026-04-19-evolution.md` — F-001/F-002/F-004 landed 2026-04-19; F-003, F-005, F-006, F-007 still open, unrelated to this proposal.

Nothing needs to move or be deleted from this proposal's scope.

## Self-Verify

| # | Check | Result |
|---|---|---|
| 1 | Proposal file exists | PASS — `proposals/2026-04-20-evolution-design-benchmark-gate.md` |
| 2 | Every finding cites file:line or concrete evidence | PASS — F-001 cites design-ui:506; F-002 cites audit-implementation:180 + track-visuals:412; F-003 cites track-visuals general; F-004 cites design-ui:10; F-005 cites FRAMEWORK-STATE history; F-006 cites rules/web/design-quality.md |
| 3 | FRAMEWORK-STATE.md read first; no rediscovered items | PASS — checked all 2026-04-20 entries; this proposal introduces genuinely new findings not previously tracked |
| 4 | Findings ranked by impact | PASS — P0 (3 critical gaps blocking quality) / P1 (2 high-impact wirings) / P2 (craft rule) / P3 (blend watchlist) |
| 5 | Honest self-score included | PASS — WI-088 output scored 4.3/10 with per-dimension evidence, bar is 7-8 for indie SaaS 2026 |
