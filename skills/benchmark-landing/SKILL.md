---
name: benchmark-landing
version: "1.1"
description: >
  Score a landing page against the curated sector reference bank on 8 measurable
  dimensions. Emits a 1-10 score per dimension + weighted aggregate. Blocks
  promotion below 7 unless orchestrator provides written override. Runs at every
  production viewport the page ships at, not only the design canvas. Use when
  the marketing page has been implemented and rendered after `execute-changeset`,
  before promotion, or when a hero, copy, or mascot change needs a visitor
  panel before paid traffic. Deployed conversion-journey proof is a separate
  required check.
phases:
  - id: P1-SampleBankPrecondition
    trigger: always
    reads: ["references/landing-bank/<sector>/", "references/landing-bank/<sector>/*/pattern.md"]
    writes: [".svc/benchmark-landing-bank-check.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P2-SideBySideArtifact
    trigger: always
    reads: ["candidate URL or local path", "references/landing-bank/<sector>/", "references/landing-bank/_high-performers/"]
    writes: ["docs/specs/landing/<wi-lower>-side-by-side.jpg"]
    evidence_kind: file
    required_for_completion: true
  - id: P3-ViewportAndMotionCapture
    trigger: always
    reads: ["candidate URL or local path", "predecessor benchmark yaml when iterating", "predecessor source when regression testing is selected"]
    writes: ["/tmp/benchmark-<ts>/*.png", "/tmp/benchmark-<ts>/1600-motion.webm"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P4-MechanicalMeasurement
    trigger: always
    reads: ["/tmp/benchmark-<ts>/*.png", "scripts/benchmark-landing-measure.mjs"]
    writes: ["/tmp/benchmark-<ts>/*.json"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P5-OmniAnchorScoring
    trigger: always
    reads: ["candidate captures", "top-3 captured bank samples", "predecessor.png when iterating", "docs/specs/benchmark/<date>-<candidate>-visitor-panel.md when Step 1b wrote it"]
    writes: [".svc/benchmark-landing-omni.yaml"]
    evidence_kind: file
    required_for_completion: true
  - id: P6-AggregateGateOutput
    trigger: always
    reads: ["mechanical measurements", ".svc/benchmark-landing-omni.yaml", "side-by-side artifact", "docs/specs/benchmark/<date>-<candidate>-visitor-panel.md when Step 1b wrote it"]
    writes: ["docs/specs/benchmark/<date>-<candidate>.yaml"]
    evidence_kind: file
    required_for_completion: true
  - id: P7-SelfVerifyContinuation
    trigger: always
    reads: ["docs/specs/benchmark/<date>-<candidate>.yaml", ".svc/lane-tasks-<WI>.json"]
    writes: [".svc/lane-tasks-<WI>.json"]
    evidence_kind: command_output
    required_for_completion: true
inputs:
  required:
    - { path: "(url or local path)", artifact: landing-page-candidate }
    - { path: "references/landing-bank/<sector>/", artifact: sector-bank, note: "must supply three relevant captured marketing-page anchors with pattern.md for scoring" }
  optional:
    - { path: "docs/specs/marketing-context.md", artifact: marketing-context }
    - { path: "docs/specs/personas/", artifact: personas, note: "Step 1b sample source; cold traffic fills empty seats" }
outputs:
  produces:
    - { path: "docs/specs/benchmark/<date>-<candidate>.yaml", artifact: benchmark-score }
    - { path: "docs/specs/benchmark/<date>-<candidate>-visitor-panel.md", artifact: visitor-panel, note: "optional Step 1b; written beside the benchmark YAML" }
chain:
  lanes:
    greenfield: { position: 21, prev: track-visuals, next: review-gate }
    brownfield-feature: { position: 16, prev: track-visuals, next: review-gate }
  progressive: false
  self_verify: true
  human_checkpoint: false
---

> **Cognitive routing:** 🛡️ [REVIEW-SONNET] + 👁️ [SENSE-OMNI] for per-viewport screenshot analysis. Script-driven mechanical measurement first (element counts, density ratios); model-driven analysis second (subjective dimensions like hierarchy, comprehension).

# Benchmark Landing

Measure a marketing landing-page candidate against captured, relevant pages and the visitor's decision. Emit the existing visual score and gate; the score is visual evidence, not proof of conversion or product effectiveness. This skill does not score in-app product screens or CLI/backend changes. Use the same visitor job and page type when choosing anchors, and explain any cross-sector comparison.

**Announce at start:** "I'm using benchmark-landing to score the landing against the sector reference bank."

## The 10 dimensions (fixed rubric — v2, 2026-04-21)

Each dimension scored 1-10. Weighted aggregate = weighted mean. Rubric v1 (8 dimensions) deprecated after WI-088 iter1 exposed two gaps: (a) "motion tempo" conflated count, cycle-time, and perceptibility; (b) no dimension measured visual delta from a predecessor, so iterations could land in the same visual neighborhood as baseline and still PASS. See `proposals/done/2026-04-21-evolution-benchmark-landing-liveness-gap.md` (F-013, F-015).

1. **Proportion & density** — elements per viewport area. Compare with the relevant-page median, then judge whether this page's actual product evidence and CTA remain findable. A deviation needs explanation, not automatic imitation. Weight 1.0.
2. **Text hierarchy** — headline : subhead : body weight ratio. Compare with captured pages, then judge whether the visitor can identify the product, claim, and next action. Weight 1.0.
3a. **Motion count** — number of simultaneously-animating elements. Must be ≤ sector 75th percentile. Weight 0.75. (Anti-chaos guardrail; kills the 12-character-animation failure mode.)
3b. **Liveness perceptibility** — if motion is used to explain or demonstrate the product, check whether a cold visitor can perceive it; count a hero motion element only when its cycle completes within ≤4s and it occupies ≥0.5% of the hero after compositing. A deliberately static page can score well when motion would add no user value. Do not add animation merely to improve this dimension. Weight 1.0.
4. **Illustration craft and product evidence** — judge whether the chosen photography, illustration, screenshot, live UI, or absence of imagery helps this visitor trust and understand the actual product. Sector convention is context, not a required asset tier. Weight 1.0.
5. **Viewport responsiveness** — does the scene REFLOW (not just scale) at every shipping viewport? Weight 1.0.
6. **Left-right balance** — if split-hero, does the composition direct attention to the claim, product evidence, and action without crowding? Weight 0.5 (sector-dependent).
7. **First-5-sec comprehension** — can a cold visitor name the product's purpose in 5s looking at the hero alone? Weight 1.0. When Step 1b wrote a report, that report is evidence for this score, and the dimension-7 rationale and the benchmark YAML both cite its path. Phone rates count only when that report's status is complete. The weight does not change.
8. **Vs. relevant captured anchors** — select the strongest captured pages serving a comparable visitor decision; score this page against their clarity, trust, and product evidence, and explain which choice transfers to this product. Weight 1.5. **Requires captured `hero.png` + `hero.webm` + `pattern.md` for each selected anchor** (see Step 0 precondition). If comparable captures are missing, this dimension cannot be scored and the skill HALTS — no asserted-without-evidence anchoring.
9. **Design delta vs baseline** — on a shipped-page iteration, compare `predecessor.png` and `candidate.png` side by side and record whether a cold visitor would notice the intended hierarchy or content change. Weight 0.75. A large visual delta is not inherently better: an effective small repair may retain the silhouette. Explain how the visible difference, or deliberate continuity, supports the visitor decision. **Not applicable on greenfield first-pass**; keep the predecessor capture mandatory for shipped-page iterations.

## Process

### Step 0 — Sample-capture precondition (MANDATORY before scoring)

**Rationale (F-012):** dimension 8 (`vs_best_in_class_anchor`) is the heaviest-weighted dimension (1.5×). Scoring it against a *claim* about a sector leader rather than a *captured* artifact produces rubber-stamp scores. WI-088 iter1 scored 7/10 on "OpenTable-archetype" without any OpenTable capture in the bank. Never again.

Before running any scoring step:

```bash
SECTOR=<sector-slug>
BANK_DIR="references/landing-bank/$SECTOR"

# Count samples with full capture bundle
READY=$(find "$BANK_DIR" -mindepth 2 -name "hero.png" | while read f; do
  d=$(dirname "$f")
  [ -f "$d/pattern.md" ] && echo "$d"
done | wc -l)

if [ "$READY" -lt 3 ]; then
  echo "HALT: benchmark-landing requires ≥3 samples with captured hero.png + pattern.md in $BANK_DIR/<sample>/"
  echo "Currently ready: $READY. Run sample-capture maintenance before scoring."
  exit 1
fi
```

Each sample in `references/landing-bank/<sector>/<sample-slug>/` MUST contain:
- `hero.png` — current 1600×900 hero capture, ≤6 months old
- `hero.webm` — 3-second motion capture of the same hero (for dimension 3b evidence)
- `pattern.md` — measured element count, motion element count + per-element cycle time + per-element area %, text hierarchy ratio, illustration tier, layout convention, positioning tag (enterprise-defensive vs indie-alive)

If Step 0 halts, the orchestrator routes to sample-bank maintenance (not to a forced override). No capture → no scoring. The sector README's "Pattern density summary" table MUST be regenerated from the per-sample `pattern.md` files (computed, not hand-asserted).

### Step 0b — Mandatory visual side-by-side (WI-139, MANDATORY before any scoring)

**Rationale (WI-139):** Two prior sessions (Example Marketplace WI-088 iter1, WI-161) shipped landing iterations that passed every textual / contractual check while the live page visually fell 50–60% short of the named sector anchor. The textual rubric grades introspectively; nothing ever rendered the shipped page next to the benchmark at the same scale. Step 0b closes that gap.

Before scoring any dimension:

1. Render the target page at 1440×900 via `track-visuals --mode external-anchor` (target URL as the input).
2. Render three selected captured anchors serving a comparable visitor decision at the same size, also via `track-visuals --mode external-anchor`. Use a high-performer only when its audience or page job actually matches; record why each anchor is relevant.
3. Pass the 4 paths to `scripts/stitch-side-by-side.mjs` to produce a 2880×1800 stitched JPEG.
4. Save output to `docs/specs/landing/<wi-lower>-side-by-side.jpg` — **lowercase `wi-NNN`** (e.g. `wi-139-side-by-side.jpg`, never `WI-139-...`). The path-casing convention is enforced by the stitcher and by the tier-1 validator `validate-landing-side-by-side-exists.sh`.
5. **Refuse to score** if the artifact does not exist on disk after the render attempt. Error message format:

   ```
   benchmark-landing HALT: side-by-side artifact missing at docs/specs/landing/<wi-lower>-side-by-side.jpg.
   Run Step 0b first:
     node scripts/stitch-side-by-side.mjs \
       --target <target.png> --target-label "<wi> (this branch)" \
       --anchor1 ... --anchor2 ... --highperf ... \
       --output docs/specs/landing/<wi-lower>-side-by-side.jpg
   ```

6. The verdict report MUST include the artifact path AND a one-line honest aesthetic judgment per anchor — examples: "matches density", "falls 30% short", "falls 60% short". The judgment line is REQUIRED output, not optional. Reviewer (typically a one-shot Sonnet pass via existing track-visuals review mode) writes the line by inspecting the stitched image.

7. **Visually-thin review:** compare the rendered product evidence and decision path with the relevant anchors. Large whitespace or a short product-UI section is a problem only when it hides necessary proof or weakens comprehension; record the observed user-facing deficit and any score adjustment. Do not cap a dimension solely from a ratio against a page serving a different job.

If Step 0b halts (artifact missing), the orchestrator MUST run the stitcher first; no scoring proceeds without the artifact.

### Step 1 — Capture at every production viewport

Invoke `scripts/benchmark-landing-capture.sh <url-or-local-path>` which screenshots the candidate at: 1600, 1280, 1024, 768, 390 pixel widths. Outputs to `/tmp/benchmark-<ts>/<viewport>.png`. **Also produces `/tmp/benchmark-<ts>/1600-motion.webm`** — a 3-second motion capture of the desktop hero used for dimension 3b (liveness perceptibility) scoring.

**Iteration case (F-015):** if `docs/specs/benchmark/<prev>.yaml` exists AND references a predecessor candidate, additionally capture the predecessor hero at 1600×900 as `/tmp/benchmark-<ts>/predecessor.png` (from the predecessor's deployed URL or a git-worktree of the pre-iteration commit). This is the evidence input for dimension 9 (Design delta vs baseline). If no predecessor is declared, dimension 9 is skipped and its 0.75 weight is redistributed proportionally across remaining dimensions.

**Regression testing:** when a predecessor-versus-candidate or two-variant comparison is selected, also capture the predecessor at the same widths as the candidate, including 390, as `/tmp/benchmark-<ts>/predecessor-<viewport>.png`. If a matching phone capture cannot be produced, the visitor panel marks the phone comparison unavailable and must not state a regression conclusion. Do not invent the missing file.

**Hard rule (F-003 cross-reference):** every viewport is scored independently. If mobile 390 scores < 7 but desktop 1600 scores 9, the aggregate is capped at min(viewport scores). No mobile-amnesia.

### Step 1b — Visitor panel (optional)

Recommend this optional panel for the changes in the left column. Record any declined or unavailable run in the benchmark YAML. A missing comparison capture skips only the comparison, not a first-pass panel on the captures this run already has. Protocol, device rules, independent families, cultural and story checks, and the report template are in `references/visitor-panel.md`.

| Recommend it | Not a reason to skip the first-pass panel |
|---|---|
| Hero, headline, or body copy changed | Mechanical-only rescore (density, type ratio, or viewport math) and no visitor-facing picture or sentence changed. Record that the recommendation does not apply |
| Mascot, illustration, or motion story changed | The owner declined the panel, or a family could not run. Record the decline or the gap |
| Before paid traffic | A written waiver of paid traffic |
| Predecessor versus candidate, or two captured variants | A matching comparison capture is missing. Run the first-pass panel, mark the comparison unavailable, and do not invent pixels |

**Inputs.** Reuse this run's captures, including `predecessor-<viewport>.png` when regression testing was selected. Do not open a second capture pass, and do not score a mock or a design frame. The five-second test uses only the above-the-fold image. Phone is the 390 capture. Desktop is the 1600 capture. Score 1280, 1024, and 768 when those captures exist. Full-page scores use the rest of the bundle this run already wrote. Use `1600-motion.webm` for the story check when the page has an interactive or mascot moment.

**Panel.** About 12 simulated visitors per model family, drawn from the project's personas plus cold traffic. Include a skeptic, a non-native reader, phone-first visitors, an older visitor, one person from each target market, and at least three cold arrivals. Each visitor gets a one-line profile and an arrival channel: an ad, a search, or a friend's link. If no personas exist, fill the seats from cold traffic and name `build-personas` as the missing upstream. Do not write a persona file here.

**Two families.** Two model families score independently. They share the seat rules, not the sheets, and neither sees the other's table before it finishes. Rank a variant only when the families agree on the paired phone-rate direction. Absolute-rate gaps are descriptive. If only one family can run, mark the report `single-family` and omit agreement.

**Scores.** Buyer interrogation and fix priority stay in `analyze-marketing` (`skills/analyze-marketing/references/persona-validation.md`). Apply the frozen verdicts in `references/visitor-panel.md` to the rendered captures. Run the cultural and story checks there. Do not restate that interrogation.

**Honesty.** Use the panel for ranking and regression only. It is not a conversion, revenue, or cost forecast. The report may include an owner-run test proposal. Contacting participants, or spending on recruitment or compensation, requires explicit human authorization. This skill does not grant it.

**Output.** Write `docs/specs/benchmark/<date>-<candidate>-visitor-panel.md` beside the benchmark YAML.

**How it meets the rubric.** When that report is present, the dimension-7 rationale and the benchmark YAML cite its path. Do not change weights, add a dimension, or move the gate. On a comparison, use the matching predecessor viewports from Step 1. If the matching phone capture is missing or unreadable, mark the phone comparison unavailable and do not state a regression conclusion.

### Step 2 — Mechanical measurement (scripted, model-free)

`scripts/benchmark-landing-measure.mjs <screenshot> <viewport>` extracts numeric-measurable dimensions via DOM + image analysis:
- Count distinct interactive/animated surfaces
- Compute total-elements / viewport-area
- Measure primary-headline font-size vs. subhead font-size ratio
- Detect motion via repeated screenshot diffs over 2s

Output: structured JSON per viewport.

### Step 3 — Sector bank comparison

For each dimension, compare candidate measurement to the median of relevant captured pages (from their `pattern.md` files). The ratio is diagnostic; the reviewer still judges whether a deviation helps the named visitor decision. Do not treat sector prevalence as a requirement to add imagery, motion, or sections:

| Ratio | Review question |
|---|---|
| Much less than median | Inspect whether necessary information or proof is missing; deliberate focus may be strong |
| Near median | Inspect clarity and actionability; similarity alone does not pass |
| Much more than median | Inspect whether content helps the decision or creates noise |

### Step 4 — Subjective dimensions via locked-down Omni

Dimensions 3b (liveness perceptibility), 4 (craft), 6 (balance), 7 (comprehension), 8 (vs best-in-class anchor), and 9 (design delta vs baseline) need a model. Dispatch to MiMo Omni via `scripts/dispatch-worker.sh` with `SVC_HARNESS=opencode SVC_WORKER_SKILL=benchmark-landing-omni`, scope-locked to these inputs only:
- candidate screenshots (all viewports) + candidate motion capture (`1600-motion.webm`)
- three selected relevant bank samples (captured `hero.png` + `hero.webm` + `pattern.md` — mandatory per Step 0)
- predecessor screenshot (if iterating — `predecessor.png`)
- optional visitor panel report when Step 1b wrote one (`docs/specs/benchmark/<date>-<candidate>-visitor-panel.md`)

Emits structured YAML per the review-plan protocol format. The prompt MUST explicitly instruct Omni that: (a) dimension 3b applies perceptibility thresholds only to motion actually used and accepts purposeful static design; (b) dimension 8 compares only captured pages with a stated visitor-decision match and refuses asserted archetypes; (c) dimension 9 compares predecessor and candidate for the intended user-facing change, not novelty alone; (d) when the visitor panel report is present, the dimension-7 rationale cites that report path and does not treat an unavailable or incomplete phone metric as a passing rate.

### Step 5 — Aggregate + gate

Write `docs/specs/benchmark/<date>-<candidate>.yaml`:

```yaml
candidate: <url-or-path>
sector: local-business-saas
viewports_scored: [1600, 1280, 1024, 768, 390]
per_viewport_scores:
  1600:
    proportion_density: 6           # weight 1.0
    text_hierarchy: 7               # weight 1.0
    motion_count: 8                 # weight 0.75 (was "motion_tempo" pre-v2)
    liveness_perceptibility: 4      # weight 1.0 — NEW v2 (F-013): rejects sub-threshold motion
    illustration_craft: 5           # weight 1.0
    viewport_responsiveness: 5      # weight 1.0
    left_right_balance: 7           # weight 0.5
    first_5_sec_comprehension: 5    # weight 1.0; rationale cites visitor_panel.report when that report is present
    vs_best_in_class: 4             # weight 1.5 — requires captured anchors
    design_delta_vs_baseline: 3     # weight 0.75 — NEW v2 (F-015); skipped if no predecessor
    weighted: 5.1
  600:
    # ... same structure, independent score
    weighted: 3.8
aggregate: 3.8           # min across viewports (capped by worst)
gate_threshold: 7
gate_decision: BLOCK     # aggregate < 7 → BLOCK
override: null           # orchestrator writes here if blocking is explicitly accepted
visitor_panel:
  report: docs/specs/benchmark/<date>-<candidate>-visitor-panel.md  # cite when Step 1b wrote the report
  skipped: false
  status: complete       # incomplete when phone evidence is unavailable; then dimension_7_evidence is false
  dimension_7_evidence: true
  weights_changed: false
```

When the visitor panel report is present, the dimension-7 rationale and this YAML cite `visitor_panel.report`. `dimension_7_evidence` is true only when that report's status is `complete`. A declined or unavailable panel sets `skipped: true` and a reason, and does not cite a report that was not written. A missing comparison capture does not set `skipped: true`.

- `aggregate < 7` → BLOCK promotion. Orchestrator must either iterate the design OR write an `override` entry with justification (logged in FRAMEWORK-STATE for longitudinal audit).
- `aggregate ≥ 7` → PASS. Still writes the score for the time series.

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|---|---|---|
| 1 | Every production viewport captured | `ls /tmp/benchmark-<ts>/` has one PNG per declared viewport | |
| 2 | Motion capture exists for desktop hero | `test -f /tmp/benchmark-<ts>/1600-motion.webm` | |
| 3 | Mechanical measurements present | JSON exists per viewport | |
| 4 | Three selected anchors have captures and a comparable visitor decision (Step 0) | Report cites each page/capture and job match; `hero.png` + `pattern.md` exist for the selected anchors | |
| 5 | Predecessor captured IFF iterating | if previous benchmark yaml exists → `test -f /tmp/benchmark-<ts>/predecessor.png`; else skip. Regression testing also requires `predecessor-390.png`, or the panel marks the phone comparison unavailable and states no regression conclusion | |
| 6 | Omni analysis ran, emitted valid YAML | parse-check; dimensions 3b + 9 present in output unless greenfield-first-pass | |
| 7 | Aggregate = min of viewport scores (not mean) | sanity check | |
| 8 | Gate decision written | `grep gate_decision <output.yaml>` returns BLOCK/PASS | |
| 9 | If BLOCK without override, skill emits non-zero exit | CI can halt | |
| 10 | Rubric version recorded in output yaml | `grep rubric_version <output.yaml>` returns `v2` or later | |
| 11 | Visitor panel, when it runs, is evidence only | Report path is cited by the dimension-7 rationale and `visitor_panel.report` when the file exists. Phone evidence requires a readable 390 capture and scored phone visitors; otherwise status is incomplete, metrics are unavailable, and holds stay open. A decline or unavailable run is `skipped: true` with a reason. Weights unchanged. | |

## Phase Receipt Contract

When running in task-graph mode, record these phase receipts before marking the `benchmark-landing` task complete:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-SampleBankPrecondition --evidence command_output:.svc/benchmark-landing-bank-check.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-SideBySideArtifact --evidence file:docs/specs/landing/<wi-lower>-side-by-side.jpg
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-ViewportAndMotionCapture --evidence command_output:.svc/benchmark-landing-capture.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-MechanicalMeasurement --evidence command_output:.svc/benchmark-landing-measure.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-OmniAnchorScoring --evidence file:.svc/benchmark-landing-omni.yaml
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-AggregateGateOutput --evidence file:docs/specs/benchmark/<date>-<candidate>.yaml
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P7-SelfVerifyContinuation --evidence command_output:.svc/benchmark-landing-self-verify.log
```

## Pipeline Continuation

Follow the canonical task-graph chaining contract: see `references/task-graph-chaining-protocol.md`.

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`)
- Treat `Invoke: /skill-name` and `metadata.skill` as routing instructions, not explanatory prose
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume
- In Claude Code: mirror file state with `TaskList` / `TaskUpdate`; in Kimi use `/task` or `TaskList` / `TaskOutput` only as observation while the file remains authoritative; in Codex and other hosts without native task-mutation APIs: mirror only the active step in `update_plan`
- Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
- Evaluate the next task's conditions from its description
- If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
- If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
- Per `route-workflow` Task-Graph Execution Protocol

Default next skill after PASS: `review-gate` (standard post-execution lane order); promotion also requires the deployed conversion-journey and supported-theme/viewport proof described in `landing-page` Phase Z.
On BLOCK: log the failed dimensions, return to the earliest responsible design or implementation step, and repeat planning/review if the fix changes the plan. Do not promote an unverified page.

## Override protocol

`aggregate < 7` blocks by default. Orchestrator MAY override by writing to the output YAML:

```yaml
override:
  justified_by: "<human-readable reason>"
  override_date: "2026-04-20"
  accepting_gaps: [motion_tempo, illustration_craft]
  revisit_at: "2026-06-01"  # mandatory follow-up date
```

All overrides land in `.svc/quality-timeseries.jsonl` (via F-005 when landed). No silent bypasses.

## MVP vs. full implementation

**MVP (this commit):** skill contract + capture script + measurement stub + aggregation. Omni dispatch is a manual invocation; mechanical measurements are partial (element count + density; hierarchy + motion-tempo partial).

**Full (next pass):** complete mechanical measurement via tree-sitter DOM analysis + automated Omni-dispatch; integration into design-ui self-verify as a blocking final step.

## Non-goals

- NOT a taste review. This is measurement vs. sample bank, not aesthetic critique. Aesthetic is covered by `audit-implementation`'s Vibe Contract rubric.
- NOT a security or accessibility audit. Those are `review-security` and `track-visuals`.
- NOT a generic web-design-rules check. That's `rules/web/design-quality.md`.

## Post-Compaction Recovery

If Kimi CLI compacted context and you lost track of framework state:

1. **Read the lane-tasks file** — `.svc/lane-tasks-<WI>.json` is the sole source of truth
2. **Find the next task** — First `in_progress`, else first `pending` with blockers satisfied
3. **Re-load the skill** — `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`
4. **Re-read this SKILL.md** — Refresh context for the current step
5. **Resume execution** — Continue from where the task left off
6. **Never ghost-complete** — Verify `skill_receipt` exists before marking any task complete

If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.
