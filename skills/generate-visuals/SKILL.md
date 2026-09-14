---
name: generate-visuals
version: "1.0"
description: >
  Image and visual asset router. Takes one asset brief (class + style + brand
  context) and routes it across the available image-gen providers (Gemini
  Nano-Banana Pro / Imagen 4, Google Stitch MCP, Figma Make/Weave MCP, Claude
  Design Live Canvas, OpenAI gpt-image-2 with gpt-image-1.5 fallback, Storyset, Veo 3 for motion). Returns
  a ranked candidate set with provenance. Used by landing-page, design-ui,
  ad-creative, social, lead-magnets, programmatic-seo. Use when "make
  hero image", "generate UI mockup", "branded illustrations", "I need
  imagery", or any skill chain that needs visual assets.
inputs:
  required:
    - { path: "docs/specs/hero-assets/<slot>/brief.yaml", artifact: asset-brief, note: "asset class, style, count, brand context — see references/brief-format.md" }
  optional:
    - { path: "docs/specs/hero-assets/manifest.yaml", artifact: existing-assets }
    - { path: "docs/specs/marketing-context.md", artifact: marketing-context }
    - { path: "docs/specs/ui/constraint-matrix.md", artifact: stack-constraints }
outputs:
  produces:
    - { path: "docs/specs/hero-assets/<slot>/candidates/", artifact: candidate-set }
    - { path: "docs/specs/hero-assets/<slot>/provenance.yaml", artifact: provenance-log }
phases:
  - { id: P1-BriefParseAndClassMatch, required_for_completion: true, evidence: "asset brief parsed and class matched to provider matrix" }
  - { id: P2-ProviderSelectionAndLicenseFilter, required_for_completion: true, evidence: "primary/fallback providers selected and license constraints filtered" }
  - { id: P3-ProviderInvocationAndCandidateSave, required_for_completion: true, evidence: "provider attempts recorded and candidate files saved or partial reason logged" }
  - { id: P4-BrandFitScoring, required_for_completion: true, evidence: "candidate brand-fit scores and forbid-list violations recorded" }
  - { id: P5-ProvenanceLog, required_for_completion: true, evidence: "docs/specs/hero-assets/<slot>/provenance.yaml written" }
  - { id: P6-RankedSetReturn, required_for_completion: true, evidence: "top candidate paths returned without image data" }
  - { id: P7-SelfVerifyContinuation, required_for_completion: true, evidence: "self-verify complete and task graph continuation handled" }
chain:
  lanes: {}
  progressive: false
  self_verify: true
  human_checkpoint: false
---

> **Cognitive routing:** 🎨 [SENSE] for asset evaluation, ⚙️ [EXEC] for provider invocation. Provider selection is mechanical (table lookup); brand-fit scoring is model-driven.

# Generate Visuals

Single router for visual asset generation across all paid + free providers in the builder's capability registry. Eliminates per-skill ad-hoc decisions about "which image-gen do I use here". Outputs a candidate set with provenance for downstream human pick.

**Announce at start:** "I'm using generate-visuals to route the asset brief across N providers."

## Provider matrix (v1.1, 2026-04-26 — codex CLI promoted to primary)

| Asset class | Primary | Fallback | Free option |
|---|---|---|---|
| Photoreal hero / lifestyle | **Codex CLI** (`codex exec` — works for ChatGPT-Plus/Pro subs) | Gemini Nano-Banana Pro (manual app), Imagen 4 (needs API key) | Unsplash (license-checked) |
| Branded UI mockup (editable) | **Stitch MCP** (`mcp__stitch-builtin__generate_screen_from_text`) | Figma Make MCP | manual screenshot |
| Branded UI mockup (one-shot, not editable) | **Codex CLI** | Stitch MCP | n/a |
| Branded variants of existing UI | **Figma MCP** (`mcp__claude_ai_Figma__use_figma` + Weave) | Claude Design Live Canvas | n/a |
| Live HTML hero (interactive prototype) | **Claude Design** (External Canvas Handoff per design-ui Step B) | v0 (manual) | n/a |
| Product UI screenshot of own app | Playwright capture | track-visuals baseline | n/a |
| Branded illustrations | **Storyset** (free CDN, animated SVG) | Codex CLI | n/a |
| Icons | **lucide-react** (already in stack) | iconify | n/a |
| Hero motion / B-roll video | **Veo 3** via Flow (Gemini Pro paid) | Remotion (programmatic) | n/a |
| Logo / mark (final) | **`design-logo` skill** (SVG by construction, render-ladder + WCAG + kerning gates) | n/a — diffusion is FORBIDDEN for final marks | n/a |
| Logo moodboard / inspiration only | Codex CLI (raster moodboards only — never as final) | Imagen 4 | n/a |
| Diagrams (architecture / flow) | **Figma MCP** `generate_diagram` | Mermaid (code) | n/a |
| Quick iteration / variants | **Codex CLI** (parallel `codex exec` calls) | MiMo V2.5-Pro (dev-only ToS) | n/a |

**Hard constraints:**
- MiMo Token Plan is dev-only per ToS; never use its outputs as production marketing assets unless re-routed through MiMo Open Platform. Provenance log MUST record this when MiMo used.
- Codex CLI requires a ChatGPT-Plus/Pro subscription. If `~/.codex/auth.json` shows `tokens.id_token` is null/expired, route to fallback. Cost: each `codex exec` image counts against ChatGPT-sub message budget — DO NOT batch 100s of variants.

**Why codex moved to primary (2026-04-26):** Production-validated in Example Marketplace WI-116. `gemini` CLI has no native generate_image tool; Imagen 4 via Gemini OAuth returns 403; `gemini-2.5-flash-image` returns scope-insufficient; OpenAI direct fails because `OPENAI_API_KEY` is None for ChatGPT-sub users. Codex CLI's internal generate_image tool worked first-try, ~90s per 1672×941 PNG. See `references/knowledge/domains/codex/CAPABILITIES.md` and `framework-learnings.jsonl#codex-cli-is-image-gen-surface`.

## Process

### Step 1 — Parse brief

Brief format (`references/brief-format.md`):

```yaml
slot: hero-background           # named asset slot
class: photoreal-lifestyle      # row key in provider matrix
style: warm-golden-hour-cafe    # free-text style description
count: 3                        # candidates wanted
brand_context:
  palette: [terra-cotta, warm-cream, espresso]
  voice: trustworthy-warm-modern
  forbid: [stock-cliche, AI-slop-gradient, smiling-headset]
viewport: 1920x1080             # or aspect ratio
license: production-marketing   # constrains provider list
```

### Step 2 — Provider selection

Look up `class` in matrix. Pick primary; queue fallback if primary fails / quota'd / wrong stack. Filter by `license` constraint — production-marketing class excludes MiMo and unattributed Storyset.

### Step 3 — Provider invocation

For each selected provider, generate `count` candidates. Save to `docs/specs/hero-assets/<slot>/candidates/<provider>-<n>.{png,svg,mp4}`.

Provider invocation patterns are documented in `references/providers/<provider>.md` (one per provider). The orchestrator reads those — do NOT inline provider details here.

### Step 4 — Brand-fit scoring

Score each candidate 1-10 against `brand_context.forbid` and `brand_context.voice`. Mechanical first (forbid-list grep on Gemini description), then SENSE-model judgment for voice fit.

### Step 5 — Provenance log

Write `docs/specs/hero-assets/<slot>/provenance.yaml`:

```yaml
slot: hero-background
generated_at: 2026-04-26T10:00:00Z
brief: <inline-brief>
candidates:
  - file: stitch-1.png
    provider: stitch-mcp
    prompt: "..."
    brand_fit: 8
    license_ok: true
  - file: nano-banana-1.png
    provider: gemini-nano-banana-pro
    invoked_via: manual-gemini-app
    brand_fit: 9
    license_ok: true
```

### Step 6 — Return ranked set

Stdout: top-3 candidates by brand_fit, paths only. No image data in stdout (per browser-verify-doctrine).

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | Brief parsed; class matches a matrix row | YAML parses cleanly and `class` value is a row key in the provider matrix | |
| 2 | At least one provider attempted; fallback used if primary failed | Provenance log lists ≥1 provider with `attempted_at`; if `status:failed` then a fallback row exists | |
| 3 | Candidate count == requested (or partial with reason) | `ls docs/specs/hero-assets/<slot>/candidates/` count matches `brief.count` OR provenance has `partial: true` + reason | |
| 4 | Provenance log written | `docs/specs/hero-assets/<slot>/provenance.yaml` exists with brief + candidates blocks | |
| 5 | Forbid-list violations flagged, not silently accepted | Each candidate's `brand_fit` < 5 has a `forbid_violations:` array naming the matched terms | |
| 6 | License constraint respected (no MiMo-Token-Plan in production-marketing) | When `brief.license == production-marketing`: grep provenance for `provider: mimo` returns no matches | |
| 7 | Stdout returns paths only, not image data | Skill stdout is ≤20 lines; no base64 / binary content (per `references/browser-verify-doctrine.md`) | |

## Phase Receipt Contract

When running with `.svc/lane-tasks-<WI>.json`, emit one phase receipt after
each required phase:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-BriefParseAndClassMatch --evidence file:docs/specs/hero-assets/<slot>/brief.yaml
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-ProviderSelectionAndLicenseFilter --evidence file:docs/specs/hero-assets/<slot>/provenance.yaml
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-ProviderInvocationAndCandidateSave --evidence file:docs/specs/hero-assets/<slot>/candidates/
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-BrandFitScoring --evidence file:docs/specs/hero-assets/<slot>/provenance.yaml
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-ProvenanceLog --evidence file:docs/specs/hero-assets/<slot>/provenance.yaml
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-RankedSetReturn --evidence command_output:.svc/generate-visuals-ranked-set-<WI>.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P7-SelfVerifyContinuation --evidence command_output:.svc/generate-visuals-self-verify-<WI>.log
```

For provider failures, still record `P3-ProviderInvocationAndCandidateSave` with
`provenance.yaml` and a command-output artifact naming the failed provider,
fallback provider, and partial-candidate reason. If no task graph exists, write
the same phase/evidence list in the final response so an orchestrator can
backfill the receipt.

## Pipeline Continuation

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`)
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume
- In Claude Code: mirror file state with `TaskList` / `TaskUpdate`; in Kimi use `/task` or `TaskList` / `TaskOutput` only as observation while the file remains authoritative; in Codex and other hosts without native task-mutation APIs: mirror only the active step in `update_plan`
- Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror

### Standalone mode (no active task graph)

**Next:** return the ranked candidate paths to the caller (typically `landing-page`, `design-ui`, `ad-creative`, `social`, `lead-magnets`, `programmatic-seo`, or `copywriting`); the calling skill picks one and proceeds. If invoked directly by the user, surface the top-3 candidate paths and ask which to ship.

## References

- `references/brief-format.md` — exact brief schema
- `references/providers/gemini-nano-banana.md` — manual Gemini app handoff (no API yet for this model from svc)
- `references/providers/stitch-mcp.md` — invocation patterns for Google Stitch MCP
- `references/providers/figma-mcp.md` — Figma + Weave MCP recipes
- `references/providers/claude-design.md` — External Canvas Handoff
- `references/providers/gpt-image.md` — OpenAI direct API: gpt-image-2 primary, gpt-image-1.5 fallback
- `references/providers/storyset.md` — license-safe free CDN illustrations
- `references/providers/veo-flow.md` — video / motion B-roll
- `references/providers/mimo.md` — dev-only ToS gate
