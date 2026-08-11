---
name: ingest-guide
version: "1.0"
description: >-
  Route pasted long-form content (X threads, LinkedIn posts, blog mirrors) through extraction → catalog cross-check → claim comparison → routing decision: discard, store-as-reference, blend-or-link, or promote-to-skill. Use when: "ingest this thread", "process this post", "what should we do with this guide". Also: "I pasted this guide", "process this LinkedIn article", "evaluate this X thread". Also: "what should we do with this post".
phases:
  - id: P1-SourceLabelExtractionDispatch
    trigger: always
    reads: ["docs/specs/ingest-guide/<source-id>-raw.md", "docs/specs/ingest-guide/<source-id>-ingest-ready.json", "skills/research/SKILL.md"]
    writes: ["docs/specs/ingest-guide/<source-id>-ingest-ready.json"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P2-CatalogAddonDedup
    trigger: always
    reads: ["skills-manifest.json", "EXTERNAL_ADDONS.md", "references/blend-registry.json", "skill frontmatter"]
    writes: []
    evidence_kind: command_output
    required_for_completion: true
  - id: P3-ClaimKnowledgeExperimentFraming
    trigger: always
    reads: ["ingest-ready claims", "references/knowledge/", "docs/specs/", "docs/learnings/learnings.jsonl"]
    writes: []
    evidence_kind: command_output
    required_for_completion: true
  - id: P4-ProjectFitRubricDecision
    trigger: always
    reads: ["~/.svc/state-snapshot.json", "~/.svc/capabilities/registry.json", "docs/specs/project-state.md", "decision matrix"]
    writes: []
    evidence_kind: command_output
    required_for_completion: true
  - id: P5-ReportDecisionPersistence
    trigger: always
    reads: ["routing decisions", "ingest report template", "decision log schema"]
    writes: ["docs/specs/ingest-guide/<source-id>.md", ".svc/pipeline-decisions.jsonl", "references/knowledge/<domain>/"]
    evidence_kind: file
    required_for_completion: true
  - id: P6-SelfVerifyHandoff
    trigger: always
    reads: ["Self-Verify checklist", ".svc/lane-tasks-<WI>.json", "human checkpoint requirements"]
    writes: [".svc/lane-tasks-<WI>.json", "assistant response"]
    evidence_kind: command_output
    required_for_completion: true
inputs:
  required:
    - { path: "docs/specs/ingest-guide/<source-id>-raw.md", artifact: pasted-text }
  optional:
    - { path: "references/knowledge/INDEX.md", artifact: knowledge-index }
    - { path: "docs/specs/project-state.md", artifact: project-state }
    - { path: "skills-manifest.json", artifact: skills-manifest }
    - { path: "EXTERNAL_ADDONS.md", artifact: external-addons }
    - { path: "references/blend-registry.json", artifact: blend-registry }
    - { path: "~/.svc/capabilities/registry.json", artifact: capability-registry }
outputs:
  produces:
    - { path: ".svc/pipeline-decisions.jsonl", artifact: decision-log }
    - { path: "docs/specs/ingest-guide/<source-id>.md", artifact: ingest-report }
chain:
  lanes: {}
  progressive: false
  self_verify: true
  human_checkpoint: true
---

> **Cognitive routing:** 🧠 [STRAT] for claim-vs-knowledge comparison and routing decisions; 🌐 [DISC] delegated to `research` skill for extraction. See `references/model-routing.md`.

# ingest-guide

Route manually-pasted long-form content through a disciplined pipeline: extract, compare against existing knowledge, design experiments for new claims, frame benefits, then decide whether to discard, store as reference, or promote to a new skill.

**Announce at start:** "I'm using the ingest-guide skill to process this content."

**Doctrine (binding):** knowledge is earned by execution, not by extraction. Pasting a guide does NOT yet make it knowledge. The claim comparison + experiment + benefit framing steps are how this skill stays honest.

## Inputs

- **Pasted content** — unstructured text from the builder. No fetcher in v1 — manual paste only.
- **Source label** — a short identifier the builder provides (e.g., `x-thread-foo-bar-2026-04-24`). Used as `<source-id>` for output paths.

If the builder did not supply a source label, ask for one before proceeding.

## Pipeline (11 steps)

### Step 1 — Delegate extraction to `research` (with upstream-fetch requirement)

Hand the pasted content to the refactored `research` skill (see `skills/research/SKILL.md`). Research handles:
- Pre-scope manifest of the pasted content
- Sub-agent selection (gemini-cli primary, Claude fallback)
- Single-pass extraction
- Domain classification gate

**Input to research:** the pasted text + "analyze" mode.
**Expected output:** structured knowledge — a list of distinct **claims** / **techniques** / **results** / **conditions**, each with supporting text.

**Short-circuit — already-extracted content:** Before dispatching research, check if a canonical `ingest-ready.json` already exists at `docs/specs/ingest-guide/<source-id>-ingest-ready.json`. If it does, validate it against `skills/ingest-guide/references/ingest-ready-schema.json` and start at Step 2 (catalog cross-check). Also check fallback locations:
- `docs/specs/ingest-guide/<source-id>-extracted.{json,md}`
- `docs/specs/research-prescope-<source-id>.md`
- `references/knowledge/domains/<source-id>/CAPABILITIES.md`
If found in a fallback location but no `ingest-ready.json` exists, run the converter first:
```bash
node skills/ingest-guide/scripts/convert-to-ingest-ready.mjs \
  --source-id <source-id> \
  --input <fallback-path> \
  --output docs/specs/ingest-guide/<source-id>-ingest-ready.json \
  --from <capabilities-md|prescope-md|raw-md>
```
Then start at Step 2. Log the short-circuit in the report's `## Upstream Fetch` section as `n/a — extraction reused from <path> and normalized to ingest-ready.json`.

**Detached-runner path (long extractions):** If the content is raw (>2,000 tokens or multi-page upstream source) and no `ingest-ready.json` exists, use the dispatcher:
```bash
node skills/ingest-guide/scripts/dispatch-research-detached.mjs \
  --source-id <source-id> \
  --raw-file docs/specs/ingest-guide/<source-id>-raw.md \
  --skip-if-extracted
```
This script:
1. Checks for pre-existing `ingest-ready.json` (short-circuit)
2. If none, constructs a strict JSON-structured prompt
3. Dispatches via `scripts/run-kimi-detached.sh` (60 min cap for `ingest-guide`)
4. Polls `scripts/kimi-job-status.sh` until `state: done`
5. Converts the raw log to canonical `ingest-ready.json` via `convert-to-ingest-ready.mjs --from research-log`

Parent session is unblocked during the entire extraction. See `references/kimi-detached-pattern.md`.

**Upstream-fetch requirement (NEW):** If the pasted content cites a public source URL (GitHub repo, gist, primary-doc page, public blog), the `research` dispatch MUST attempt to fetch the upstream and incorporate its substantive content (e.g. the actual SKILL.md files of a referenced skill pack) — the marketing copy alone is not sufficient. If the fetch fails (404, gated, network error), record the attempt with the failure reason in the report's `## Upstream Fetch` section and proceed with a **REDUCED-CONFIDENCE** flag on every downstream claim. Never silently skip the fetch.

If research cannot produce a clean extraction (partial coverage, sub-agent failure after fallback), STOP and report the failure. Do NOT proceed with a half-extracted guide.

### Step 2 — Catalog cross-check (NEW)

For each extracted claim that describes a **capability, skill, or workflow stage**, scan the existing svc skill catalog for functional overlap before any classification:

1. Read `skills-manifest.json` `includedSkills` array and `EXTERNAL_ADDONS.md` core-pack list.
2. For each candidate-overlap skill identified by name+description match, read its SKILL.md frontmatter (`description`, `inputs`, `outputs`) — NOT the full body — to confirm or reject the overlap.
3. Tag every claim with one of:
   - **catalog-overlap-strong** — an existing svc skill already does ≥80% of what the claim describes (cite skill name + one-line evidence)
   - **catalog-overlap-partial** — an existing svc skill covers ≤79% — note both the overlap and the delta worth borrowing
   - **catalog-novel** — no existing svc skill addresses this capability

Record per-claim catalog tags in the report under `## Catalog Cross-Check`. Strong overlaps tilt the routing decision toward `discard` or `store-as-reference (delta-note)`, never `promote-to-skill`.

### Step 3 — External-addons / blend dedup check (NEW)

If the source looks like a multi-skill pack, named ecosystem, or external repo (signals: contains a "kit"/"pack"/"suite" framing, names ≥3 sub-skills, points at a single repo URL):

1. Grep `EXTERNAL_ADDONS.md` for the source name, author, or repo handle.
2. Grep `references/blend-registry.json` for prior blend entries from the same source.
3. Tag the source as one of:
   - **addon-known-blended** — already imported; route any net-new claims to `store-as-reference` only
   - **addon-known-not-blended** — recognized but not yet imported; eligible for `blend-or-link` decision
   - **addon-novel** — neither in EXTERNAL_ADDONS nor in blend-registry; eligible for `blend-or-link`

For `addon-known-not-blended` and `addon-novel`, the routing decision in Step 10 may select **`blend-or-link`** which hands off to `blend-external` (or `blend-private` if the source is private and authorized). Do NOT call `blend-external` from inside this skill — only set the routing decision and surface the recommendation to the builder.

Record per-source addon tag in the report under `## Addon Dedup Check`.

### Step 4 — Claim-vs-knowledge comparison

For each extracted claim, grep `references/knowledge/` + `docs/specs/` + `references/framework-learnings.jsonl` + `docs/learnings/learnings.jsonl` (if present) for existing content on the same topic. Classify each claim as one of:

- **already-known** — we have this; record the reference path.
- **new** — we don't have this; needs validation.
- **contradicts-known** — clashes with existing knowledge; flag for human review with the conflicting reference cited.

Store the classification in `docs/specs/ingest-guide/<source-id>.md` under `## Claim Classification`. The catalog-cross-check tag from Step 2 and the knowledge classification from Step 4 are independent — a claim can be `catalog-novel` AND `already-known` (knowledge exists in references but no skill implements it), which is a strong signal to consider `promote-to-skill`.

### Step 5 — Experiment design (for `new` and `contradicts-known` only)

For each claim classified `new` or `contradicts-known`, propose a concrete runnable experiment:

- **What to do** — smallest possible scope; must be runnable in this repo or a test fixture.
- **Success criterion** — observable, binary or numeric. "Improves thing X by Y%" or "Test T passes under condition C".
- **Time box** — max execution time if the experiment runs autonomously.
- **Rollback** — how to undo if the experiment harms the repo.

`already-known` claims skip this step.

Experiments are recorded but NOT executed by this skill. Execution is a separate downstream action (the builder can run them or hand to `execute-changeset`).

### Step 6 — Benefit framing

For each validated (post-experiment) or already-known technique, articulate **separately**:

- **(a) Product project benefit** — how this could help the current product project (read `docs/specs/project-state.md` for context).
- **(b) svc framework benefit** — how this could improve the svc framework itself.

Both angles, separately. If a claim benefits neither, mark it for likely discard.

### Step 7 — Project-fit query (NEW)

Invoke `capability-concierge` (read-only) to retrieve the active list of shippable projects with their state and persona context. For each surviving claim, tag it with:

- **applicable_projects:** array of project IDs where this claim plausibly applies (cite the project's persona/domain/stage when justifying)
- **project_fit_strength:** `strong` (clear use case in a current project), `weak` (speculative tie), or `none` (no current project benefits)

Source for the query:
- `~/.svc/state-snapshot.json` (cross-project state)
- `~/.svc/capabilities/registry.json` (resource inventory — already covered by capability-concierge contract)
- The current repo's `docs/specs/project-state.md` if present

If `capability-concierge` is unavailable or returns empty, fall back to reading `~/.svc/state-snapshot.json` directly and explain the fallback in the report's `## Project Fit` section.

**Routing influence:** `project_fit_strength: none` makes `promote-to-skill` invalid for this run — a pattern with no project to land in is dead-letter. Default to `discard` or `store-as-reference` instead, and recommend revisiting if/when a fitting project appears.

### Step 8 — Validation rubric

Apply a 4-dimension rubric to each surviving claim:

| Dimension | Score 1-5 | Evidence |
|-----------|-----------|----------|
| Signal | high-quality vs vague | |
| Novelty | new to us vs restated | |
| Actionability | can we run with it tomorrow | |
| Source credibility | author track record, verifiable | |

Aggregate score per claim. Low-signal + low-novelty + low-actionability = discard candidate.

### Step 9 — Decision matrix (catalog × knowledge × project-fit) (NEW)

Before picking a routing label, apply this decision matrix to every surviving claim. The columns combine outputs from Steps 2 (catalog), 3 (addon), 4 (knowledge), and 7 (project-fit):

| Catalog | Knowledge | Project-fit | Default routing |
|---|---|---|---|
| catalog-overlap-strong | any | any | `discard` (already covered in skills) OR `store-as-reference` if there's a delta-note worth keeping |
| catalog-overlap-partial | any | strong | `store-as-reference` (delta-note) — the gap is documented, the existing skill enhanced later |
| catalog-overlap-partial | any | weak / none | `store-as-reference` (delta-note) — no urgency to act |
| catalog-novel | already-known | strong | `promote-to-skill` candidate (knowledge exists, skill missing, project ready) |
| catalog-novel | already-known | weak / none | `store-as-reference` — wait for project demand |
| catalog-novel | new | strong | `promote-to-skill` candidate after experiment validates the new claim |
| catalog-novel | new | weak / none | `store-as-reference` (with pending experiment) — DO NOT promote yet |
| (any) | contradicts-known | (any) | HUMAN CHECKPOINT — never auto-route a contradicting claim |
| addon-known-not-blended OR addon-novel (multi-skill source) | (any) | strong, AND ≥1 claim is catalog-novel | `blend-or-link` candidate (recommend `blend-external`) — there is genuinely-novel functionality in the pack worth importing |
| addon-known-not-blended OR addon-novel (multi-skill source) | (any) | strong, AND all claims are catalog-overlap-{strong,partial} | `selective-blend` recommendation — cherry-pick only the catalog-overlap-partial sub-skills' deltas via `improve-framework` against the existing svc skill; do NOT blend the full pack |
| addon-known-not-blended OR addon-novel (multi-skill source) | (any) | weak / none | `store-as-reference` — pack is interesting but no project to land in; revisit if a fitting project appears |

### Tie-break precedence (when multiple rows match)

Per-claim rows always evaluate first. Source-level rows (the addon-* lines above) only fire when ≥1 claim survived per-claim routing into `store-as-reference` or `promote-to-skill`. If a claim is `discard`, it does not contribute to the source-level decision.

Source-level resolution within a single ingest run:

1. If ≥1 surviving claim is `catalog-novel`, the source-level recommendation is `blend-or-link` (full pack).
2. If all surviving claims are `catalog-overlap-{strong,partial}` AND the source is multi-skill AND project-fit is strong, the source-level recommendation is **`selective-blend`** — name the specific sub-skills whose deltas justify import; route to `improve-framework` against the existing svc skill rather than blending the full pack. This avoids creating duplicates in the catalog.
3. Otherwise no source-level recommendation; per-claim routing stands.

The matrix is a **default**, not a verdict. The actual routing in Step 10 may override the default if the rubric (Step 8) score or builder feedback dictates — but the override must be justified in the report.

### Step 10 — Routing decision

For each claim, pick exactly one of:

- **Discard** — log the decision + reason; no artifact written beyond the decision log.
- **Store as reference knowledge** — invoke the domain gate (`node skills/research/scripts/domain-gate.mjs ...`) and write to `references/knowledge/<domain>/`. Include claim status + experiment outcome (or "experiment pending") + benefit framing in the knowledge file. For `catalog-overlap-partial`, the knowledge file MUST contain a `## Delta vs <existing-skill>` section.
- **Blend-or-link (NEW)** — when the source is a multi-skill pack scoring `addon-known-not-blended` or `addon-novel` AND at least one claim has `project_fit_strength: strong` AND ≥1 surviving claim is `catalog-novel`, recommend running `blend-external` on the upstream source. This skill does NOT execute the blend — it logs the recommendation and exits. The builder confirms via human checkpoint before `blend-external` actually runs. If the source is private and authorized for blending, recommend `blend-private` instead.
- **Selective-blend (NEW)** — when the source is a multi-skill pack but ALL surviving claims are `catalog-overlap-{strong,partial}` (i.e. nothing genuinely novel) AND project-fit is strong, recommend `improve-framework` against the existing svc skill(s) to absorb the specific deltas, rather than blending the full pack. Names the sub-skills whose deltas justify the absorption. This skill logs the recommendation as a `selective-blend` decision in `.svc/pipeline-decisions.jsonl` (do NOT call `improve-framework` directly — log + exit, builder confirms).
- **Promote to new skill** — hand off to `create-skill` with a draft brief that includes:
  - The validated experiment (or pending experiment) as proof / precondition
  - Product + framework benefit framing
  - The decision-matrix justification showing why `promote` over `blend-or-link` or `store`
  - A question to the builder: **on-demand** skill vs **embedded in an existing lane**?

Only ONE routing decision per claim. Aggregate claims may produce multiple routing decisions per ingest run, including a `blend-or-link` recommendation that wraps the whole source.

### Step 11 — Log and handoff

Append a single entry to `.svc/pipeline-decisions.jsonl`:

```json
{
  "skill": "ingest-guide",
  "source_id": "<source-id>",
  "claims_extracted": N,
  "classified": {"already-known": N, "new": N, "contradicts-known": N},
  "catalog_check": {"strong": N, "partial": N, "novel": N},
  "addon_check": "addon-known-blended | addon-known-not-blended | addon-novel | n/a",
  "project_fit": {"strong": N, "weak": N, "none": N},
  "upstream_fetch": "ok | failed | n/a",
  "routing": {"discard": N, "store": N, "blend-or-link": N, "selective-blend": N, "promote": N},
  "experiments_pending": N,
  "report_path": "docs/specs/ingest-guide/<source-id>.md",
  "timestamp": "YYYY-MM-DDTHH:MM:SSZ"
}
```

Then produce a short summary to the builder: claims found, classification breakdown, routing breakdown, experiments pending, path to the full report.

## Human Checkpoint

Before any `promote-to-skill` handoff, confirm with the builder: the new skill title, brief, and placement (on-demand vs embedded). `create-skill` requires this confirmation per its human_checkpoint setting.

Before any `blend-or-link` handoff, confirm with the builder: the upstream source URL, the addon-tag (known-not-blended vs novel), and whether to dispatch `blend-external` (public source, attribution allowed) or `blend-private` (authorized private source, no source identifiers). This skill does NOT auto-trigger a blend.

Before any `contradicts-known` claim is stored, confirm with the builder that the existing knowledge should be superseded — this skill does NOT silently overwrite prior knowledge.

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | Source label present | `<source-id>` is a concrete string | |
| 2 | Research extraction succeeded | `research` returned non-partial output (coverage = 100%) | |
| 3 | Upstream fetch attempted when cited | If pasted content cited a public URL, the report's `## Upstream Fetch` section records ok/failed/n/a — never silently skipped | |
| 4 | Catalog cross-check performed | `## Catalog Cross-Check` section in the report tags every capability-class claim with strong/partial/novel and cites the matched skill name(s) | |
| 5 | Addon dedup check performed | `## Addon Dedup Check` section in the report records the source's addon-tag (known-blended / known-not-blended / novel / n/a) with evidence from `EXTERNAL_ADDONS.md` and `references/blend-registry.json` | |
| 6 | Every claim is classified | no unclassified items in `## Claim Classification` | |
| 7 | Experiments proposed for new/contradicts | each `new` or `contradicts-known` claim has a runnable experiment | |
| 8 | Benefit framing covers both angles | product + framework benefit, separately, for each surviving claim | |
| 9 | Project-fit query performed | `## Project Fit` section in the report tags every surviving claim with `applicable_projects` and `project_fit_strength`; if `capability-concierge` was unavailable, the fallback is documented | |
| 10 | Decision matrix applied | every surviving claim has a default-routing entry derived from the matrix in Step 9, plus any override justification | |
| 11 | Rubric applied | 4 scores per surviving claim | |
| 12 | Routing decision per claim | exactly one of discard/store/blend-or-link/selective-blend/promote per claim or source | |
| 13 | Domain gate invoked for any store | `domain-gate.mjs` exit 0 before any write under `references/knowledge/` | |
| 14 | Decision logged | entry appended to `.svc/pipeline-decisions.jsonl` with the new fields (catalog_check, addon_check, project_fit, upstream_fetch) populated | |
| 15 | Full report written | `docs/specs/ingest-guide/<source-id>.md` exists with all sections including the four new ones | |
| 16 | Report structurally validated | `node skills/ingest-guide/scripts/validate-ingest-report.mjs --report <path>` exits 0 with `verdict: pass` — every required section present, every claim count consistent across tables, upstream fetch status valid, project-fit columns correct | |
| 17 | Catalog cross-check row-complete | Catalog table row count == extracted claim count | |
| 18 | Project-fit row-complete | Project-fit table row count == extracted claim count | |
| 19 | Routing row-complete | Routing decisions table row count == extracted claim count | |
| 20 | Research dispatch short-circuit evaluated | If pre-existing extraction exists for `<source-id>`, Step 1 was skipped and `## Upstream Fetch` records `n/a — extraction reused` | |
| 21 | Detached runner used for long raw content | If content >2,000 tokens and no pre-existing extraction, `dispatch-research-detached.mjs` was invoked and returned `method: detached` | |

## Phase Receipt Contract

After loading this skill into the lane task graph, emit receipts for each required phase before marking the task complete:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-SourceLabelExtractionDispatch --evidence command_output:.svc/ingest-guide-extraction-dispatch.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-CatalogAddonDedup --evidence command_output:.svc/ingest-guide-catalog-addon.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-ClaimKnowledgeExperimentFraming --evidence command_output:.svc/ingest-guide-claim-comparison.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-ProjectFitRubricDecision --evidence command_output:.svc/ingest-guide-project-fit-routing.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-ReportDecisionPersistence --evidence file:docs/specs/ingest-guide/<source-id>.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-SelfVerifyHandoff --evidence command_output:.svc/ingest-guide-self-verify.log
```

## Pipeline Continuation

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`)
- Treat `Invoke: /skill-name` in the task description and `metadata.skill` as routing instructions, not explanatory prose
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume
- In Claude Code: mirror file state with `TaskList` / `TaskUpdate`; in Kimi use `/task` or `TaskList` / `TaskOutput` only as observation while the file remains authoritative; in Codex and other hosts without native task-mutation APIs: mirror only the active step in `update_plan`
- Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
- Evaluate the next task's conditions from its description
- If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
- If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
- Per `route-workflow` Task-Graph Execution Protocol

### Chaining

ingest-guide is on-demand — it does not participate in progressive chains. Upstream dispatches and downstream handoffs:

**Upstream (read-only) dispatches during the pipeline:**
- Step 1 → `research` (extraction + upstream fetch)
- Step 7 → `capability-concierge` (read-only project-fit query)

**Downstream handoffs from the routing decision:**
- `store` → writes directly to `references/knowledge/`; control returns to the builder.
- `blend-or-link` → recommends `blend-external` (public source) or `blend-private` (authorized private source) to the builder; **human_checkpoint required**. ingest-guide logs the recommendation and exits — it does NOT auto-invoke either skill.
- `promote` → hands off to `create-skill` (human_checkpoint). ingest-guide logs the handoff and exits.
- `discard` → logs the decision. Control returns to the builder.

## Scripts

- `skills/ingest-guide/scripts/log-decision.mjs` — appends a decision line to `.svc/pipeline-decisions.jsonl` with validation. Supports all routing types (discard, store, blend-or-link, selective-blend, promote) plus catalog, addon, project-fit, and upstream-fetch fields.
- `skills/ingest-guide/scripts/validate-ingest-report.mjs` — structural validator for generated ingest reports. Checks section completeness, claim-count consistency across tables, upstream-fetch status validity, and project-fit column presence.
- `skills/ingest-guide/scripts/dispatch-research-detached.mjs` — conditional research dispatcher with short-circuit for already-extracted content. Checks canonical `ingest-ready.json`, reuses if valid, otherwise dispatches via `run-kimi-detached.sh`, polls to completion, and normalizes output to `ingest-ready.json`.
- `skills/ingest-guide/scripts/convert-to-ingest-ready.mjs` — normalizes various research outputs (detached log, CAPABILITIES.md, prescope, raw JSON) into canonical `ingest-ready.json`.
- `skills/ingest-guide/references/ingest-ready-schema.json` — JSON Schema for the canonical handoff format between `research` and `ingest-guide`.
- `skills/ingest-guide/references/ingest-report-template.md` — template for `docs/specs/ingest-guide/<source-id>.md`.
