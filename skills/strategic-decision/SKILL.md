---
name: strategic-decision
version: "1.0"
handles_concerns:
  - paid-external-api
  - paid-llm-api
  - data-model-mutation
description: >-
  N-way strategic trade study spanning features, vendors, or years — build-vs-buy, framework/database/hosting/AI-model/payment-provider selection, pricing model, strategic pivot. Use when: "which X should I use", "compare providers", "trade study", "strategic decision". NOT for within-feature architecture (design-tech owns that). Also: "N-way decision", "pick vendor", "compare options before committing".
inputs:
  required:
    - { path: "~/.svc/builder-profile.md", artifact: builder-profile }
    - { artifact: "decision-question", note: "What choice are we making?" }
  optional:
    - { path: "docs/specs/vision.md", artifact: vision }
    - { path: "docs/specs/features/*.md", artifact: existing-features }
    - { path: "docs/specs/domain-profile.md", artifact: domain-profile }
    - { path: "docs/specs/analyze-competitors.md", artifact: competitor-analysis }
    - { path: "docs/specs/router-context.md", artifact: router-context }

outputs:
  produces:
    - { path: "docs/specs/decisions/YYYY-MM-DD-<slug>/DECISION.md", artifact: strategic-decision }
    - { path: "docs/specs/decisions/YYYY-MM-DD-<slug>/CONSTRAINT-PROFILE.md", artifact: constraint-profile }
    - { path: "docs/specs/decisions/YYYY-MM-DD-<slug>/DIMENSIONS.md", artifact: research-dimensions }
    - { path: "docs/specs/decisions/YYYY-MM-DD-<slug>/OPTIONS.md", artifact: option-enumeration }
    - { path: "docs/specs/decisions/YYYY-MM-DD-<slug>/SURVIVORS.md", artifact: post-gate-survivors }
    - { path: "docs/specs/decisions/YYYY-MM-DD-<slug>/QUESTIONNAIRE.md", artifact: per-option-questionnaire }
    - { path: "docs/specs/decisions/YYYY-MM-DD-<slug>/EV-MODEL.md", artifact: funnel-adjusted-forecast }
    - { path: "docs/specs/decisions/YYYY-MM-DD-<slug>/REVIEW.md", artifact: adversarial-review }
    - { path: "docs/specs/decisions/YYYY-MM-DD-<slug>/DECISION-<profile>.md", artifact: per-profile-decision, when: comparison-mode }
    - { path: "docs/specs/decisions/YYYY-MM-DD-<slug>/EV-MODEL-<profile>.md", artifact: per-profile-ev-model, when: comparison-mode }
    - { path: "docs/specs/decisions/YYYY-MM-DD-<slug>/MULTI-PROFILE-DELTA.md", artifact: multi-profile-delta, when: comparison-mode }
phases:
  - { id: P1-ClarifyQuestionAndConstraintProfile, required_for_completion: true, evidence: "ambiguous question resolved or skipped; constraint profile declared" }
  - { id: P2-ResearchDimensionsAndEvidence, required_for_completion: true, evidence: "DIMENSIONS.md records HARD/SOFT dimensions and evidence sources" }
  - { id: P3-OptionEnumerationAndEscapeHatch, required_for_completion: true, evidence: "OPTIONS.md written and escape-hatch analysis recorded" }
  - { id: P4-EliminationGates, required_for_completion: true, evidence: "SURVIVORS.md applies HARD gates before scoring" }
  - { id: P5-SurvivorQuestionnaire, required_for_completion: true, evidence: "QUESTIONNAIRE.md compares each survivor using the shared decision evidence contract" }
  - { id: P6-FunnelAdjustedEVModel, required_for_completion: true, evidence: "EV-MODEL.md or per-profile EV models written" }
  - { id: P7-AdversarialReview, required_for_completion: true, evidence: "REVIEW.md from strategic-reviewer produced and findings handled" }
  - { id: P8-DecisionSynthesisAndPipelineLog, required_for_completion: true, evidence: "DECISION.md written and pipeline decision log appended" }
  - { id: P9-SelfVerifyContinuation, required_for_completion: true, evidence: "self-verify complete and task graph continuation handled" }

chain:
  # Pre-lane skill. Operates ABOVE the 7-lane model. Output DECISION.md names the
  # downstream lane + skill to invoke next. Pre-lane positioning is documented in
  # intent-routing.md + lane-model.md; not expressed as a frontmatter flag.
  lanes: {}
  progressive: false
  self_verify: true
  human_checkpoint: true
  terminal: true
---

**Announce at start:** "I'm using strategic-decision to run a systematic N-way trade study. This will produce a decision document with evidence chain, per-profile EV model, and adversarial review."

# Strategic Decision Trade Study

## Product-runtime v2 adapter

Inside a `product-improvement-protocol-v2` run, compile the trade study into the unified product
graph and hand its single irreducible owner question to `decide`. Use
`references/owner-decision-runtime-v2.md`. Do not independently ask the owner, create a second
writable decision record, or omit rejected alternatives. Deduplicate by unresolved-decision digest;
an unchanged question is not a new decision round.

Systematic N-way decision analysis with constraint-profile awareness, funnel-adjusted
cost modeling, elimination gates, and adversarial review.

## When to use this skill

Use when the question has ≥3 viable options AND the decision has multi-feature or
multi-year impact. Typical triggers:

- "Which POI provider should I use for scout discovery?"
- "Google Places vs Foursquare vs HERE vs AI search?"
- "Which database for this app — Postgres, Mongo, or DynamoDB?"
- "Vercel vs Netlify vs Fly.io vs Railway?"
- "Should we build this ourselves or buy X?"
- "Which pricing model: freemium, per-seat, or usage-based?"

## When NOT to use this skill

| Not appropriate when... | Use instead |
|---|---|
| Within-feature technical architecture (already have feature spec, need to pick DB schema, etc.) | `explore-solutions` |
| Single feature go/no-go (should we build X?) | `validate-feature` |
| Code-level correctness audit | `audit-implementation` |
| Merchant-of-record-vs-direct-processor (narrow payment decision) | `mor-vs-stripe` |
| Pricing-tier shape (narrow pricing decision) | `pricing` |
| Finops optimization within a chosen vendor | `manage-finops` |
| Reverse-engineering a specific competitor product | `reverse-engineer` |

## Related framework primitives

- `_shared/constraint-profiles.md` — canonical decision contexts (Bootstrapper / Self-financed / Funded / Enterprise)
- `_shared/product-question-format.md` — the decision evidence contract applied in Phase 4
- `references/elimination-gate-protocol.md` — the HARD/SOFT gate pattern applied in Phase 3
- `agents/strategic-reviewer.md` — the adversarial reviewer invoked in Phase 6

## The 9-phase flow

| Phase | Label | Cognitive | Output |
|---|---|---|---|
| -1 | Clarify ambiguous question | PASS | (inline) |
| 0 | Declare constraint profile (interactive) | PASS | CONSTRAINT-PROFILE.md |
| 1a | Meta-research (what dimensions matter) | EXEC | DIMENSIONS.md (classification) |
| 1b | Layered research (fill data gaps) | DISC | DIMENSIONS.md (+ evidence) |
| 2 | Option enumeration (≥10 diverse) | EXEC | OPTIONS.md |
| 2.5 | Should we build this at all? escape hatch | STRAT | (appended to DIMENSIONS.md) |
| 3 | Elimination gates | EXEC | SURVIVORS.md |
| 4 | Evidence-backed comparison per survivor | STRAT | QUESTIONNAIRE.md |
| 5 | Funnel-adjusted EV model | PLAN | EV-MODEL.md |
| 6 | Adversarial review | REVIEW | REVIEW.md |
| 7 | Decision synthesis | STRAT | DECISION.md |
| 8 | Log to pipeline decision log | PASS | (.svc/pipeline-decisions.jsonl entry) |

Multi-profile mode adds per-profile artifacts + MULTI-PROFILE-DELTA.md.

---

## Phase -1 — Clarify ambiguous question

If the decision question is underspecified ("which auth should I use" — user/service/session?),
ask ONE structured clarification: "The phrase 'X' could mean (a), (b), or (c) — which?"

Do not proceed with a guessed interpretation. Wrong scope choice cascades through all 8
remaining phases wastefully.

Skip this phase if the question is clearly scoped.

## Phase 0 — Declare constraint profile (interactive)

### 0a. Elicit constraints

Present the 4 canonical profiles from `_shared/constraint-profiles.md` + let caller pick
one with optional overrides. DO NOT silently default.

Format the elicitation like this:

> "This decision's answer depends on your constraint profile. Pick one:
>
> 1. **Bootstrapper** — $0 budget, conservative, solo, growth=Base
> 2. **Self-financed** — $X pre-profit (you specify X), moderate, solo/small, growth=Base-Aggressive
> 3. **Funded startup** — $Y/mo burn covered, aggressive, small team, growth=Aggressive
> 4. **Enterprise** — budget-allocated, compliance-heavy, full team
>
> Or: tell me you want **comparison mode** and I'll run the analysis across 3 profiles
> to show where the winner flips."

### 0b. Comparison mode (optional)

If caller picks comparison mode, run Phases 1-7 three times (Bootstrapper / Self-financed /
Funded by default) and produce MULTI-PROFILE-DELTA.md showing:

| Profile | Winner | Runner-up | Key reason |
|---|---|---|---|
| Bootstrapper | X | Y | Free tier covers us |
| Self-financed | Z | X | $X budget lets us pay for quality |
| Funded | W | Z | Quality differentiator matters at scale |

Caller picks their profile based on the delta.

### 0c. Write CONSTRAINT-PROFILE.md

Stating the profile explicitly:

```markdown
# Constraint Profile — <decision slug>

**Profile:** Bootstrapper
**Overrides:** (none, or list e.g. "growth_scenario: Aggressive")

## Declared thresholds
- Acceptable monthly bill: $100 max
- Runway: indefinite but cash-zero
- Reversibility tolerance: weeks (1 migration ok)

## Validity
This decision is valid ONLY for this profile. A different profile may flip the recommendation —
see MULTI-PROFILE-DELTA.md if comparison mode was run.
```

### 0d. Stop-gate

If caller refuses to declare anything, STOP. Do not assume — wrong profile produces
wrong decision silently.

## Phase 1 — Research (meta-research + layered research)

### 1a. Meta-research — identify what dimensions matter

Before researching specific options, answer:

1. What does "right" mean for this decision under THIS profile? (cost / quality / coverage / lock-in / compliance / conversion / other)
2. Which dimensions are **HARD** (elimination gates) vs **SOFT** (scoring dimensions)? Apply `references/elimination-gate-protocol.md` classification rules.
3. Unit of measurement per dimension. ($mo, %, regions-covered, days-to-migrate, etc.)
4. Which dimensions are profile-sensitive? (A budget-eliminator at $0 becomes a budget-scorer at $10k funded)
5. Time-horizon weighting. (Y1 cost matters more than Y3 cost for Bootstrapper)
6. What does this decision block downstream? (Features, skills, hires, roadmap items)

Write DIMENSIONS.md with HARD-vs-SOFT classification + unit + profile-sensitivity per dimension.

### 1b. Layered research — local evidence first, then gap-targeted external fetches

Before any WebSearch or external fetch, perform a local index scan. This is a
hard order-of-operations rule, not a suggestion.

For each dimension, check these sources in order:

1. **Project research:** `docs/specs/research/*.md`
2. **Framework knowledge:** `references/knowledge/**/*.md`
3. **Past decisions:** `.svc/pipeline-decisions.jsonl`
4. **Builder profile:** `~/.svc/builder-profile.md`
5. **Domain profile:** `docs/specs/domain-profile.md`
6. **Competitor data:** `docs/specs/analyze-competitors.md`

Record the local scan in `DIMENSIONS.md` before any external citation:

```markdown
## Local Evidence Scan

| Source | Date | Depth | Covers | Verdict |
|---|---:|---:|---|---|
| docs/specs/research/<file>.md | YYYY-MM-DD | <lines>/<cited-sources> | <dim-list> | fresh / partial / stale |
```

Freshness + coverage gate:

- If a local source is <= 90 days old and covers >=80% of a dimension's
  subquestions, cite it with `file:line` evidence and do not duplicate that
  research externally.
- If a local source is stale or partial, cite the covered portion with
  `file:line` evidence, then enumerate only the uncovered questions as external
  research targets.
- If no local source exists for the dimension, mark `research-needed` in
  `DIMENSIONS.md` and proceed to targeted external research.

**If data is still missing after the local scan: use WebSearch inline — NOT the `research` skill.**

Why not the `research` skill? Because `skills/research/SKILL.md` mandates commit/tag/push per run.
Invoking research multiple times per dimension would create mid-analysis commit cascades.
Reserved for one-off explicit deep research.

Inline WebSearch queries per dimension:

```
WebSearch: "2026 pricing for <provider A, B, C> for <specific SKU>"
WebSearch: "completion rate benchmarks for <discovery pattern> vs <alternative>"
WebSearch: "TOS storage restrictions for <provider>"
WebSearch: "known failure modes for <vendor> in <region>"
```

Each result summarized + cited in DIMENSIONS.md with URL as source. External
research must be gap-targeted to the `research-needed` or `partial` rows from
the Local Evidence Scan.

If a dimension genuinely needs persisted multi-hour investigation, invoke `research` skill
as a SINGLE one-off escalation. Accept the commit side effect as deliberate.

## Phase 2 — Option enumeration (≥10 diverse; ≥30 if broad)

Enumerate across these categories — each must have ≥1 candidate:

| Category | Examples |
|---|---|
| Commercial vendors — tier 1 global | Google, AWS, Stripe, OpenAI equivalents |
| Commercial vendors — tier 2 regional / specialty | HERE, Mapbox, Clerk, Mistral |
| Open-source self-host | OSS alternative to commercial default |
| AI-composed | LLM + adjacent services replacing traditional API |
| Alternative data sources | Public records, government APIs, scraping, social geo-tags |
| User-input / friction-heavy | Manual typing, photo-OCR, QR-code, crowd-sourcing |
| Hybrid combinations | Primary + fallback, regional routing |
| Escape hatch — "don't do this" | See Phase 2.5 |

Force-generative prompts when stuck:
- "What's the laziest solution that meets the MUST criteria?"
- "What's the non-obvious path nobody in this domain is talking about?"
- "What would be true if we didn't solve this at all?"
- "What would someone from a completely different domain do?"

Write OPTIONS.md with ≥10 (or ≥30 if broad domain) 1-line descriptions + category tag per option.

## Phase 2.5 — Should we build this at all? (escape hatch)

Before eliminating, ask the higher-order question:

- Is there a viable outcome where we simply DON'T solve this problem?
- Does the user value require this specific capability, or can we deliver value another way?
- Are we building a feature competitors all have but nobody's customers actually use?
- What does the product look like if we remove this feature?
- Is there an innovative reframe (e.g., "we don't need a POI provider if we ship QR-code stickers to businesses") that eliminates the decision?

Append "Escape Hatch Analysis" section to DIMENSIONS.md:

```markdown
## Escape Hatch Analysis

| Option | Feasibility | Impact on core journey | Verdict |
|---|---|---|---|
| Don't build | high | core journey still works | **Pursue** → Route to validate-feature with reframe |
| Innovative reframe: QR-stickers | medium | changes product shape | Drop — premature |
```

If escape hatch is VIABLE, SHORT-CIRCUIT to Phase 7 with decision "don't build in original
form — adopt <reframe> instead" + route to `validate-feature` for the reframe. Stop.

If not viable, proceed to Phase 3.

## Phase 3 — Elimination gates

Apply `references/elimination-gate-protocol.md`.

For each option, apply HARD constraints from Phase 1a. Eliminated options logged with
one-line evidence-cited reason using canonical format:

```
ELIMINATED — <option> — <gate-family> — <one-line evidence>
```

Example:
```
ELIMINATED — Foursquare Places — Budget — $450/mo at Y2 Base exceeds $100/mo Bootstrapper threshold
```

Standard gate families (full list in elimination-gate-protocol.md): Legal/TOS, Budget,
Coverage, Effort, Role, Reversibility, Constitutional.

Write SURVIVORS.md with two sections:
1. Survivors table (options + gates cleared)
2. Eliminated appendix (one line per eliminated option with evidence)

Target survivor count: 3-8. If >8, gates too loose; if <3, gates too tight or decision is
unusually constrained — sanity-check your gates.

## Phase 4 — Evidence-backed survivor comparison

Compare each survivor using `_shared/product-question-format.md`: evidence, meaningful tradeoffs, recommendation rationale, persona fit, material risk/cost/reversibility, success signals and useful innovation. This is comparison work, not a requirement to ask the owner one question per option. Reuse resolved constraints; route only unresolved consequential owner choices through the applicable `decide` contract.

Write QUESTIONNAIRE.md for compatibility, with substantive per-survivor comparison blocks. Retain a Constraint Profile Validity header (profile plus overrides; identify which risks/personas change under another profile) and an Adoption Timing footer (Now / Next / Later / Never, tied to EV-MODEL.md or revisit triggers). Include funnel-impact cost evidence where relevant to Phase 5; mark unknown inputs instead of manufacturing precise values. No fixed section or competitor count.

## Phase 5 — Funnel-adjusted EV model

For each survivor, compute expected value per action, NOT just unit infra cost:

```
EV_per_action = P(action_completes_given_friction) × LTV_per_completed_action − Cost_per_attempt
```

Required inputs:
- Unit infra cost per action (from Phase 1b)
- Completion rate per option (from Phase 1b research / industry benchmarks)
- LTV per completed action (from business spec / builder projections)

Required outputs per survivor:
- EV per action at Y1 / Y2 / Y3
- Under Low / Base / High growth scenarios (9 cells per option)
- Break-even math: at what completion rate does this go net-negative?
- Sensitivity tornado: rank inputs by EV impact

### manage-finops invocation policy (optional helper, NOT required)

`skills/manage-finops/SKILL.md` requires `docs/specs/vision.md`. `strategic-decision` treats vision
as optional because many strategic decisions happen pre-vision (vendor / framework / database
picks before product exists).

**Default:** Phase 5 computes EV directly from builder-profile + Phase 1b research +
QUESTIONNAIRE §7.

**Optional escalation:** IF vision.md exists AND decision is specifically
infrastructure/platform-cost-heavy, invoke `manage-finops` for richer FinOps Spec. Skill
continues without it if vision absent.

### Multi-profile handling

If Phase 0b ran comparison mode:
- Run EV model per profile → `EV-MODEL-<profile>.md`
- Produce `MULTI-PROFILE-DELTA.md` showing where winner flips

Otherwise single `EV-MODEL.md`.

## Phase 6 — Adversarial review

Invoke `agents/strategic-reviewer` with input manifest:

**Always pass:**
- `docs/specs/decisions/<slug>/` (all phase artifacts)
- `skills/strategic-decision/SKILL.md` (meta-prompt to audit against)
- `_shared/constraint-profiles.md`
- `_shared/product-question-format.md`
- `references/elimination-gate-protocol.md`

**Conditional pass (if relevant):**
- Feature specs cited in QUESTIONNAIRE Persona Fit
- Journeys referenced by cited features
- Personas referenced by features / journeys
- Vision.md / domain-profile.md / analyze-competitors.md if decision cites them
- Research files cited in DIMENSIONS.md or EV-MODEL.md
- CLAUDE.md / router-context.md if platform/deployment-constrained
- `~/.svc/builder-profile.md` if CONSTRAINT-PROFILE has overrides
- `.svc/pipeline-decisions.jsonl` (grep-scoped to same-topic past decisions)

### Host-adaptive invocation

| Host | Mechanism |
|---|---|
| Claude Code | `scripts/dispatch-worker.sh --agent strategic-reviewer --input-paths <manifest>` → runtime enforces tool allowlist + fresh context |
| Kimi CLI | same script; Kimi's runtime enforces agent YAML |
| Codex CLI | inline load of `agents/strategic-reviewer.md` append content; no runtime enforcement — prompt-level discipline + eval regression catches violations |
| Gemini CLI | same as Codex |

Agent emits YAML findings (see `agents/strategic-reviewer.md` output format). Parent
(this skill) writes the YAML to REVIEW.md.

### What to do with findings

- CRITICAL → must be resolved before proceeding; loop back to the phase the reviewer flagged
- HIGH → address in DECISION.md §Why NOT alternatives with explicit reasoning
- MEDIUM → note in DECISION.md §Risks for revisit
- LOW → optional; note if worth capturing

## Phase 7 — Decision synthesis

### 7a. Reconciliation rule between Phase 4 (qualitative) and Phase 5 (quantitative)

The decision is driven by EV (Phase 5) PRIMARILY, with Phase 4 as tiebreaker and disqualifier:

1. Rank survivors by EV.
2. Take top 3.
3. For each, check Phase 4 for any SEVERE finding in Risk, Reversibility, or Persona Fit.
4. Drop options with SEVERE findings. Highest-EV surviving option wins.
5. If all top 3 have SEVERE findings, return to Phase 4 with stricter gates — survivor set too loose.

Avoids two failure modes:
- **Quantitative-only:** cheapest option even if architectural nightmare
- **Qualitative-only:** hand-wave numbers, pick by vibes

EV dominates because grounded in data. Qualitative vetoes, doesn't vote.

### 7b. Produce DECISION.md

```markdown
# Strategic Decision: <topic>
**Date:** YYYY-MM-DD
**Constraint profile:** <link to CONSTRAINT-PROFILE.md>
**Validity:** Valid ONLY for declared constraint profile.

## Decision
<Chosen option — one line>

## Confidence
<High / Medium / Low — tied to Phase 5 sensitivity + Phase 6 rubric score>

## Evidence Chain
- DIMENSIONS.md — what dimensions matter
- OPTIONS.md — N options enumerated
- SURVIVORS.md — cleared elimination gates
- QUESTIONNAIRE.md — Evidence-backed comparison per survivor
- EV-MODEL.md — funnel-adjusted P&L
- REVIEW.md — adversarial stress test

## Research Grounding
<Summarize which dimensions were answered from local evidence first. Cite
DIMENSIONS.md Local Evidence Scan rows and any external gap-targeted fetches.>

## Why this option
<Cite specific QUESTIONNAIRE sections + EV-MODEL cells that drove the pick>

## Why NOT the top 3 runners-up
- Runner 1: <name> — <cited reason from QUESTIONNAIRE + EV-MODEL>
- Runner 2: <name> — <cited reason>
- Runner 3: <name> — <cited reason>

## Revisit Triggers (MANDATORY — ≥2 rows)
Revisit this decision if any of:
- <numeric threshold> — e.g., "monthly bill > $500 for 2 consecutive months"
- <qualitative condition> — e.g., "provider loses > 20% of target region"
- <time-based> — e.g., "annually regardless, to re-audit profile"

## Rollback / Migration Plan
<Concrete steps, time estimate, cost estimate>

## Downstream Implications
<What this decision unblocks — features, skills, hires>
Next skill to invoke: <greenfield-lane | brownfield-feature-lane | validate-feature | write-spec>
```

## Phase 8 — Log to pipeline decision log

Append to `.svc/pipeline-decisions.jsonl` using canonical `type: taste` (close-call P0 call):

```bash
node scripts/pipeline-log.mjs append \
  --path .svc/pipeline-decisions.jsonl \
  --run-id "<slug>" \
  --skill strategic-decision \
  --phase "phase-8-log" \
  --type taste \
  --decision "Chose <option> for <question>" \
  --reasoning "<short summary citing DECISION.md>" \
  --decided-by P0 \
  --overrideable true
```

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|---|---|---|
| 1 | Constraint profile declared | `test -f docs/specs/decisions/<slug>/CONSTRAINT-PROFILE.md` | |
| 2 | Dimensions meta-research done with HARD/SOFT classification | grep for "HARD" and "SOFT" in DIMENSIONS.md | |
| 3 | Phase 1b local evidence scan happened before WebSearch | DIMENSIONS.md contains "Local Evidence Scan" with `docs/specs/research/`, `references/knowledge/`, or `.svc/pipeline-decisions.jsonl` file:line citations before URL-only citations | |
| 4 | ≥10 options enumerated (≥30 if broad) | count rows in OPTIONS.md | |
| 5 | Escape-hatch section present | grep "Escape Hatch Analysis" in DIMENSIONS.md | |
| 6 | Elimination gates applied before questionnaire | SURVIVORS.md exists; fewer rows than OPTIONS.md | |
| 7 | Every survivor has substantive shared-contract evidence + Validity header + Adoption Timing footer | inspect per-survivor evidence and unresolved consequential decisions in QUESTIONNAIRE.md | |
| 8 | Funnel-impact cost in EV model | EV-MODEL.md contains `P(complete) × LTV` term, not just unit cost | |
| 9 | Adversarial review via strategic-reviewer agent (not plan-reviewer, not review-gate) | REVIEW.md exists; YAML cites `reviewer: strategic-reviewer` | |
| 10 | Revisit triggers concrete (≥2 rows) | DECISION.md §Revisit Triggers has ≥2 rows with numeric or qualitative conditions | |
| 11 | Pipeline decision log updated with canonical type | `.svc/pipeline-decisions.jsonl` has new entry with `"type": "taste"` | |
| 12 | Comparison-mode artifacts (if comparison mode ran) | if Phase 0b ran in comparison mode, DECISION-<profile>.md + EV-MODEL-<profile>.md + MULTI-PROFILE-DELTA.md all exist | |
| 13 | DECISION.md names downstream lane + skill | grep "Next skill to invoke" in DECISION.md | |

## Phase Receipt Contract

When running with `.svc/lane-tasks-<WI>.json`, emit one phase receipt after
each required phase:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-ClarifyQuestionAndConstraintProfile --evidence file:docs/specs/decisions/<slug>/CONSTRAINT-PROFILE.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-ResearchDimensionsAndEvidence --evidence file:docs/specs/decisions/<slug>/DIMENSIONS.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-OptionEnumerationAndEscapeHatch --evidence file:docs/specs/decisions/<slug>/OPTIONS.md --evidence file:docs/specs/decisions/<slug>/DIMENSIONS.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-EliminationGates --evidence file:docs/specs/decisions/<slug>/SURVIVORS.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-SurvivorQuestionnaire --evidence file:docs/specs/decisions/<slug>/QUESTIONNAIRE.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-FunnelAdjustedEVModel --evidence file:docs/specs/decisions/<slug>/EV-MODEL.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P7-AdversarialReview --evidence file:docs/specs/decisions/<slug>/REVIEW.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P8-DecisionSynthesisAndPipelineLog --evidence file:docs/specs/decisions/<slug>/DECISION.md --evidence file:.svc/pipeline-decisions.jsonl
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P9-SelfVerifyContinuation --evidence command_output:.svc/strategic-decision-self-verify-<WI>.log
```

For conditional branches, still record the relevant phase with skip or branch
evidence:
- `P1-ClarifyQuestionAndConstraintProfile`: record
  `--evidence command_output:.svc/strategic-decision-clarification-skip-<WI>.log`
  when the decision question was already scoped.
- `P3-OptionEnumerationAndEscapeHatch`: if the escape hatch short-circuits the
  decision, record the phase with `DIMENSIONS.md` and then route directly to
  `P8-DecisionSynthesisAndPipelineLog`.
- `P6-FunnelAdjustedEVModel`: in comparison mode, record one or more
  `--evidence file:docs/specs/decisions/<slug>/EV-MODEL-<profile>.md` entries
  plus `MULTI-PROFILE-DELTA.md`.

If no task graph exists, write the same phase/evidence list in the final
response so an orchestrator can backfill the receipt.

## Pipeline Continuation

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`)
- Treat `Invoke: /skill-name` and `metadata.skill` as routing instructions, not explanatory prose
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume
- In Claude Code: mirror file state with `TaskList` / `TaskUpdate`; in Kimi use `/task` or `TaskList` / `TaskOutput` only as observation while the file remains authoritative; in Codex and other hosts without native task-mutation APIs: mirror only the active step in `update_plan`
- Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
- Evaluate the next task's conditions from its description
- If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
- If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
- Per `route-workflow` Task-Graph Execution Protocol

Multi-phase progress tracked via phase-artifact files (durable across all 4 hosts);
`.svc/lane-tasks-strategic-<slug>.json` optional for host-UI mirroring.

File-state authority: re-entry reads existing phase artifacts and resumes at first missing
phase. No reliance on host UI task state. Works identically whether session is Claude Code /
Kimi CLI / Codex CLI / Gemini CLI.

## Host-agnostic contract

The 9-phase flow runs identically on all 4 hosts. Invocation mechanics differ per host but
the contract is identical:

| Host | Skill load | Agent invocation (Phase 6) | Research (Phase 1b) |
|---|---|---|---|
| Claude Code | `Skill` tool | `dispatch-worker.sh --agent strategic-reviewer` | `WebSearch` tool inline |
| Kimi CLI | `Skill` tool (or `/flow:strategic-decision`) | `dispatch-worker.sh` | built-in `explore` subagent OR WebSearch |
| Codex CLI | Direct SKILL.md load | inline append of agent's system prompt | inline research |
| Gemini CLI | `activate_skill` | inline append | inline research |

## Key principles

- **Constraint-profile-first.** Decisions without declared profile produce wrong answers silently.
- **Elimination before scoring.** Apply HARD gates first; cheaper, reduces scoring work by 60-80%.
- **Funnel cost > infra cost at scale.** Completion rate × LTV dominates raw API pricing at real SaaS scale.
- **EV drives, qualitative vetoes.** Numbers grounded in research lead; qualitative evidence can disqualify an option; it is not a vote.
- **Adversarial review is non-optional.** Output has no credibility without it.
- **Revisit triggers are concrete, not "review periodically."** Numeric or qualitative thresholds only.
- **File-state is source of truth.** Artifacts are durable across sessions and hosts.
