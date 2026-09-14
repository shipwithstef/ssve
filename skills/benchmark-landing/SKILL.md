---
name: benchmark-landing
version: "1.0"
description: >
  Score a landing page against the curated sector reference bank on 8 measurable
  dimensions. Emits a 1-10 score per dimension + weighted aggregate. Blocks
  promotion below 7 unless orchestrator provides written override. Runs at every
  production viewport the page ships at, not only the design canvas. Use when
  landing-page / marketing-page design is complete and before handing to
  execute-changeset or deploy.
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
    reads: ["candidate URL or local path", "predecessor benchmark yaml when iterating"]
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
    reads: ["candidate captures", "top-3 captured bank samples", "predecessor.png when iterating"]
    writes: [".svc/benchmark-landing-omni.yaml"]
    evidence_kind: file
    required_for_completion: true
  - id: P6-AggregateGateOutput
    trigger: always
    reads: ["mechanical measurements", ".svc/benchmark-landing-omni.yaml", "side-by-side artifact"]
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
    - { path: "references/landing-bank/<sector>/", artifact: sector-bank, note: "must contain ≥5 samples with pattern.md" }
  optional:
    - { path: "docs/specs/marketing-context.md", artifact: marketing-context }
outputs:
  produces:
    - { path: "docs/specs/benchmark/<date>-<candidate>.yaml", artifact: benchmark-score }
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

Measure a landing-page candidate against the curated reference-bank median per dimension. Emit a score. Block promotion below threshold.

**Announce at start:** "I'm using benchmark-landing to score the landing against the sector reference bank."

## The 10 dimensions (fixed rubric — v2, 2026-04-21)

Each dimension scored 1-10. Weighted aggregate = weighted mean. Rubric v1 (8 dimensions) deprecated after WI-088 iter1 exposed two gaps: (a) "motion tempo" conflated count, cycle-time, and perceptibility; (b) no dimension measured visual delta from a predecessor, so iterations could land in the same visual neighborhood as baseline and still PASS. See `proposals/done/2026-04-21-evolution-benchmark-landing-liveness-gap.md` (F-013, F-015).

1. **Proportion & density** — elements per viewport area. Must be within 1.5× sector median. Weight 1.0.
2. **Text hierarchy** — headline : subhead : body weight ratio. Must follow sector convention (~3:1:1). Weight 1.0.
3a. **Motion count** — number of simultaneously-animating elements. Must be ≤ sector 75th percentile. Weight 0.75. (Anti-chaos guardrail; kills the 12-character-animation failure mode.)
3b. **Liveness perceptibility** — for each motion element in the hero, does its cycle complete within ≤4s AND does it occupy ≥0.5% of hero viewport area (post-compositing)? A motion element that ticks slower than 4s or is smaller than 0.5% does NOT count toward perceived liveness. Scored 1-10 on whether the hero reads as *static*, *subtly-live*, or *clearly-live* to a cold-glance visitor in 3 seconds. Weight 1.0. (Prevents "1 motion element at 8-second interval, 0.01% area" from scoring as "matches sector median motion" while being practically invisible.)
4. **Illustration craft** — tier of visual asset (photography / bespoke / flat-svg / screenshot / live-ui). Must match sector convention. Weight 1.0.
5. **Viewport responsiveness** — does the scene REFLOW (not just scale) at every shipping viewport? Weight 1.0.
6. **Left-right balance** — if split-hero, does the split follow sector convention? Weight 0.5 (sector-dependent).
7. **First-5-sec comprehension** — can a cold visitor name the product's purpose in 5s looking at the hero alone? Weight 1.0.
8. **Vs. best-in-class anchor** — pick the top-3-rated samples in the bank; score candidate vs. them specifically. Weight 1.5 (heaviest — this is the "honest bar" dimension). **Requires captured `hero.png` + `hero.webm` + `pattern.md` per top-3 sample** (see Step 0 precondition). If samples lack captures, this dimension cannot be scored and the skill HALTS — no asserted-without-evidence anchoring.
9. **Design delta vs baseline** — when iterating on an existing design, score how visually distinguishable the candidate is from its predecessor within the first 3 seconds of cold view. Weight 0.75. Evidence requirement: Omni prompt with `predecessor.png` + `candidate.png` side-by-side, asked "would a cold visitor perceive these as the same hero or different heroes?" Scored 1-10 where 1-4 = cold-glance-indistinguishable, 5-7 = recognizably different on close look, 8-10 = obviously different silhouette/content. **Not applicable on greenfield first-pass** (no predecessor exists); dimension skipped and weight redistributed. **Mandatory on any iteration where the previous version shipped or was merged.**

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
2. Render the top-2 sector anchors (from `references/landing-bank/<sector>/`) and the top-1 high-performer (from `references/landing-bank/_high-performers/`) at the same size, also via `track-visuals --mode external-anchor`.
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

7. **Visually-thin override** (reviewer-judged with thresholds as guidance): if the reviewer judges the target page meets EITHER threshold against the median anchor — (a) >40% more white space than the median, OR (b) product-UI section <50% the height of the anchor's equivalent — then `below-fold-density` is **capped at 4/10** regardless of the textual checklist's completeness. The thresholds are guidance for the reviewer's honest aesthetic judgment line; they are NOT computed metrics in this skill. The reviewer records the judgment + override application in the verdict.

If Step 0b halts (artifact missing), the orchestrator MUST run the stitcher first; no scoring proceeds without the artifact.

### Step 1 — Capture at every production viewport

Invoke `scripts/benchmark-landing-capture.sh <url-or-local-path>` which screenshots the candidate at: 1600, 1280, 1024, 768, 390 pixel widths. Outputs to `/tmp/benchmark-<ts>/<viewport>.png`. **Also produces `/tmp/benchmark-<ts>/1600-motion.webm`** — a 3-second motion capture of the desktop hero used for dimension 3b (liveness perceptibility) scoring.

**Iteration case (F-015):** if `docs/specs/benchmark/<prev>.yaml` exists AND references a predecessor candidate, additionally capture the predecessor hero at 1600×900 as `/tmp/benchmark-<ts>/predecessor.png` (from the predecessor's deployed URL or a git-worktree of the pre-iteration commit). This is the evidence input for dimension 9 (Design delta vs baseline). If no predecessor is declared, dimension 9 is skipped and its 0.75 weight is redistributed proportionally across remaining dimensions.

**Hard rule (F-003 cross-reference):** every viewport is scored independently. If mobile 390 scores < 7 but desktop 1600 scores 9, the aggregate is capped at min(viewport scores). No mobile-amnesia.

### Step 2 — Mechanical measurement (scripted, model-free)

`scripts/benchmark-landing-measure.mjs <screenshot> <viewport>` extracts numeric-measurable dimensions via DOM + image analysis:
- Count distinct interactive/animated surfaces
- Compute total-elements / viewport-area
- Measure primary-headline font-size vs. subhead font-size ratio
- Detect motion via repeated screenshot diffs over 2s

Output: structured JSON per viewport.

### Step 3 — Sector bank comparison

For each dimension, compare candidate measurement to bank median (from `references/landing-bank/<sector>/README.md` "Pattern density summary"):

| Ratio | Per-dimension score |
|---|---|
| ≤ 0.8× median | 8-10 (at or above bar) |
| 0.8-1.2× median | 7 (acceptable) |
| 1.2-2.0× median | 5 (drifting) |
| > 2.0× median | 3 or below (fail) |

### Step 4 — Subjective dimensions via locked-down Omni

Dimensions 3b (liveness perceptibility), 4 (craft), 6 (balance), 7 (comprehension), 8 (vs best-in-class anchor), and 9 (design delta vs baseline) need a model. Dispatch to MiMo Omni via `scripts/dispatch-worker.sh` with `SVC_HARNESS=opencode SVC_WORKER_SKILL=benchmark-landing-omni`, scope-locked to these inputs only:
- candidate screenshots (all viewports) + candidate motion capture (`1600-motion.webm`)
- top-3 bank samples (captured `hero.png` + `hero.webm` + `pattern.md` — mandatory per Step 0)
- predecessor screenshot (if iterating — `predecessor.png`)

Emits structured YAML per the review-plan protocol format. The prompt MUST explicitly instruct Omni that: (a) dimension 3b ignores motion elements whose cycle > 4s or area < 0.5%; (b) dimension 8 compares against captured samples only — refuse to score on asserted-archetype claims; (c) dimension 9 asks "cold-glance same or different hero?" against predecessor.png.

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
    first_5_sec_comprehension: 5    # weight 1.0
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
```

- `aggregate < 7` → BLOCK promotion. Orchestrator must either iterate the design OR write an `override` entry with justification (logged in FRAMEWORK-STATE for longitudinal audit).
- `aggregate ≥ 7` → PASS. Still writes the score for the time series.

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|---|---|---|
| 1 | Every production viewport captured | `ls /tmp/benchmark-<ts>/` has one PNG per declared viewport | |
| 2 | Motion capture exists for desktop hero | `test -f /tmp/benchmark-<ts>/1600-motion.webm` | |
| 3 | Mechanical measurements present | JSON exists per viewport | |
| 4 | Top-3 bank samples have hero.png + pattern.md (Step 0) | `find references/landing-bank/<sector> -name hero.png \| wc -l >= 3` | |
| 5 | Predecessor captured IFF iterating | if previous benchmark yaml exists → `test -f /tmp/benchmark-<ts>/predecessor.png`; else skip | |
| 6 | Omni analysis ran, emitted valid YAML | parse-check; dimensions 3b + 9 present in output unless greenfield-first-pass | |
| 7 | Aggregate = min of viewport scores (not mean) | sanity check | |
| 8 | Gate decision written | `grep gate_decision <output.yaml>` returns BLOCK/PASS | |
| 9 | If BLOCK without override, skill emits non-zero exit | CI can halt | |
| 10 | Rubric version recorded in output yaml | `grep rubric_version <output.yaml>` returns `v2` or later | |

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

Default next skill after PASS: `design-tech` (standard lane order).
On BLOCK: return to `design-ui` for iteration; log the specific dimensions that failed into the iteration brief.

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
