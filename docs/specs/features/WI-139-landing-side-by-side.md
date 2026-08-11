# Feature: Mandatory visual side-by-side gate for landing-page work

**Status:** VERIFIED
**Type:** Enabler
**Authoring mode:** `bugfix-behavior`
**Consumers:** `benchmark-landing` skill, `verify-promotion` skill, `landing-page` skill, every WI tagged `landing` / `marketing-page`
**WI:** WI-139
**Lane:** framework
**Priority:** high
**Created:** 2026-04-29

---

## Problem Statement

`benchmark-landing` is text-graded — its 8-dimension rubric is filled by introspection, not by looking at screenshots side-by-side. `verify-promotion` for landing-tagged WIs accepts bundle-grep as evidence (string presence, not visual presence). `landing-page` Step 0.5 produces market-gap analysis but no shippability gate against the named anchor.

**Actual behavior:** A landing iteration can pass every textual / contractual check (bundle-grep ✅, lane-tasks 5/5 ✅, perf budget ✅, gap "closed" via CSS-only mocks) and ship while the live page visually falls 50–60% short of the named sector anchor. No automated check or skill output ever renders the shipped page next to the benchmark anchor at the same scale.

**Expected behavior:** Before `benchmark-landing` scores any dimension, a stitched 4-up side-by-side image (target page + top-2 sector anchors + top-1 high-performer at 1440×900) MUST exist on disk and be referenced in the verdict. `verify-promotion` for landing-tagged WIs requires a post-deploy live-URL side-by-side. `landing-page` Step 0.5 emits a binary ship-readiness gate against the top anchor. A new tier-1 validator enforces the artifact's existence for any landing-tagged VERIFIED WI.

**Why this matters now:** Two recurrences with the same signature (Example Marketplace WI-088 iter1, WI-161) where landing iterations shipped self-graded PASS while the user caught visual thinness vs sector anchors on first inspection. Per `rules/learning-preload.md` learning-to-rule promotion threshold: pattern, not incident. Lost-credibility cost is high; fix cost is bounded (~half-day given `track-visuals` already supports external-URL capture and Playwright rendering).

---

## Behavior Contract — bugfix scope

### Invariant (must remain unchanged)

- `track-visuals` skill body — already supports `external-anchor` mode (capture third-party landing pages at 1440×900); reuse, do not modify.
- `landing-page` skill's existing flow (capture-idea → Step 0.5 market-gap → design-ui → execute) — only Step 0.5 gains a new sub-output.
- `benchmark-landing` skill's 8-dimension rubric content — gate is added BEFORE scoring, scoring rubric itself unchanged except for the visually-thin override of `below-fold-density`.
- `verify-promotion`'s G7 protocol for non-landing-tagged WIs — unchanged. New behavior is conditional on the `landing` / `marketing-page` tag.
- `references/landing-bank/<sector>/` and `references/landing-bank/_high-performers/` schemas — unchanged.

### Changes

1. `benchmark-landing/SKILL.md` — Step 0 gains a mandatory render+stitch+save that produces `docs/specs/landing/<wi>-side-by-side.jpg` before any dimension is scored. Refuses to score if artifact is missing. Verdict report includes artifact path + per-anchor honest aesthetic judgment line.
2. `landing-page/SKILL.md` — Step 0.5 adds a "Ship-readiness gate vs $ANCHOR_TOP_1" subsection emitting a binary yes/no + one-paragraph honest gap read.
3. `verify-promotion/SKILL.md` — adds a tagged-WI conditional: for any WI tagged landing/marketing-page, capture a post-deploy live-URL side-by-side (via `track-visuals --mode external-anchor`), diff against the pre-implementation side-by-side, require the change to be visible at comparison scale (not just present in bundle string), include post-deploy screenshot in receipt.
4. New tier-1 validator `test-framework/evals/tier-1/validate-landing-side-by-side-exists.sh` — iterates landing/marketing-page-tagged WIs in VERIFIED state; exits non-zero if any side-by-side artifact is missing.
5. New shared helper `scripts/stitch-side-by-side.mjs` — small node script invoked by all 3 skills to combine 4 captured screenshots into the canonical 4-up layout. Single source of truth for the stitching contract (image dimensions, layout, label placement) so all 3 skills emit identical-shape output.

### Out of scope

- Reimplementing Playwright rendering in any skill (use existing `track-visuals` external-anchor mode).
- Auto-fixing visually-thin pages (this WI gates ship; remediation stays in `landing-page`'s existing flow).
- Mobile viewport side-by-side (1440×900 desktop only for v1; mobile is a follow-up WI).
- LLM-as-judge aesthetic scoring (the honest-judgment line is one-shot Sonnet output via existing track-visuals review mode, NOT an automated rubric).
- Changing the anchor selection logic (top-2 sector + top-1 high-performer is whatever `landing-page` already picks).

---

## Acceptance Criteria

| AC | Description | QA | E2E | Test |
|----|-------------|-----|-----|------|
| WI139-01 | `benchmark-landing` refuses to score any dimension if `docs/specs/landing/<wi>-side-by-side.jpg` is missing. Error message names the exact path expected and the command to produce it. | — | 🔲 | — |
| WI139-02 | `benchmark-landing` verdict output includes the side-by-side artifact path AND a one-line honest aesthetic judgment per anchor (matches density / falls 30% short / falls 60% short). The judgment line is required output, not optional. | — | 🔲 | — |
| WI139-03 | When the side-by-side shows visual thinness (>40% more white space than median anchor, OR product UI section <50% the height of the anchor's equivalent), `benchmark-landing` caps `below-fold-density` at 4/10 regardless of the textual checklist. | — | 🔲 | — |
| WI139-04 | `verify-promotion` for any WI tagged `landing` or `marketing-page` captures a post-deploy live-URL side-by-side via `track-visuals --mode external-anchor`, diffs against the pre-implementation side-by-side stored at WI start, requires the shipped change to be visible at comparison scale (not just present in bundle string). The post-deploy screenshot is included in the WI's verify-promotion receipt. | — | 🔲 | — |
| WI139-05 | `landing-page` Step 0.5 emits a binary ship-readiness verdict ("ship-ready vs $ANCHOR_TOP_1: yes" or "no") followed by one paragraph of honest gap read. Surfaced inline in the WI's lane-tasks `skill_receipt`. | — | 🔲 | — |
| WI139-06 | Tier-1 validator `test-framework/evals/tier-1/validate-landing-side-by-side-exists.sh` exists and runs as part of the tier-1 aggregate. Iterates all WIs tagged `landing` / `marketing-page` in VERIFIED state, exits non-zero if any side-by-side artifact is missing. | — | 🔲 | — |
| WI139-07 | All three calling skills (`benchmark-landing`, `verify-promotion` landing-handler, `landing-page` Step 0.5) reuse `track-visuals --mode external-anchor` for screenshot capture and `scripts/stitch-side-by-side.mjs` for the 4-up stitching. No skill reimplements Playwright invocation or image stitching internally. | — | 🔲 | — |
| WI139-08 | The side-by-side artifact's stitching contract is documented inline at the top of `scripts/stitch-side-by-side.mjs` and referenced from each of the 3 calling skills. Contract: 1440×900 per-tile, 4 tiles arranged 2×2, target top-left, anchor labels visible, output as JPEG with quality ≥85, total stitched dimensions 2880×1800. | — | 🔲 | — |

---

## System Dependencies

### This feature depends on:

| Dependency | Type | Spec exists? | What it provides | Mock strategy |
|-----------|------|-------------|-----------------|---------------|
| `track-visuals` skill (`external-anchor` mode) | Enabler | implicit (track-visuals/SKILL.md exists) | Playwright-backed page capture at any size | N/A — local Playwright |
| `references/landing-bank/<sector>/` + `_high-performers/` | Enabler | implicit (landing-page/SKILL.md references the schema) | Anchor URLs + pattern.md per anchor | N/A — local config |
| Existing `landing-page` Step 0.5 (anchor selection) | Enabler | implicit | Top-2 sector + top-1 high-performer per WI | N/A — already wired |
| Node `sharp` or `jimp` library | External | needs check | Image stitching for the 4-up layout | If unavailable: shell out to `imagemagick` `convert` (likely present) |

### Other features depend on this:

| Consumer | Type | What it needs from us |
|----------|------|----------------------|
| Every WI tagged `landing` / `marketing-page` | Feature | A side-by-side artifact at `docs/specs/landing/<wi>-side-by-side.jpg` before benchmark-landing scores; a post-deploy verification before verify-promotion completes |
| Future mobile-viewport WI | Feature | The stitching contract (AC-08) — mobile follow-up extends, not replaces |

---

## Pillars Coverage Matrix

| # | Pillar | State | Artifact / note |
|---|---|---|---|
| 1 | Product fit | `[UPDATED]` | Quality gate gap. WI-139 ticket + 2-recurrence pattern from Example Marketplace WI-088/WI-161. |
| 2 | Journey | `[N/A — justified: framework bugfix; the only "journey" is benchmark-landing → side-by-side render → score, captured in the Behavior Contract]` | — |
| 3 | Acceptance criteria | `[NEW]` | This spec — 8 ACs |
| 4 | UX | `[N/A — justified: no user-facing surface beyond the verdict text and stitched image, both already covered by ACs]` | — |
| 5 | UI | `[N/A — justified: same as UX]` | — |
| 6 | Tech architecture | `[UPDATED]` | Behavior Contract sections 1-5 enumerate the integration points; reuses track-visuals + adds 1 stitcher helper. No new architecture. |
| 7 | Cost model | `[UPDATED]` | Per-WI cost: ~3 Playwright screenshots + 1 stitch + 1 Sonnet judgment line (~$0.05-0.10 per benchmark-landing run). One-time cost only — runs at the gate, not on every render. |
| 8 | Operations & ownership | `[UPDATED]` | Owner: framework maintainers. Tier-1 validator catches missing artifacts on every CI run. Track-visuals and landing-bank are existing operational surfaces — no new monitoring needed. |

---

## Implementation Notes

To be added by `plan-changeset` and `execute-changeset`. High-level shape:

1. **Shared helper:** `scripts/stitch-side-by-side.mjs` — takes 4 image paths + 4 labels, outputs a 2×2 stitched JPEG at `docs/specs/landing/<wi>-side-by-side.jpg`. Choose between `sharp` (preferred, npm install) and `imagemagick convert` (fallback) based on availability check at script load.
2. **`benchmark-landing/SKILL.md` Step 0:** insert a pre-scoring section that calls `track-visuals --mode external-anchor` 3 times (top-2 sector anchors + top-1 high-performer) plus once for the target URL; passes the 4 paths to the stitcher; saves output to canonical path; only then proceeds to scoring. Add the visually-thin detection (white-space measurement + product-UI height ratio) as a pre-score override of `below-fold-density`.
3. **`landing-page/SKILL.md` Step 0.5:** append a Ship-readiness gate sub-section that produces the binary verdict + paragraph. Integrates with the existing `landing-page` lane-tasks receipt format.
4. **`verify-promotion/SKILL.md`:** add a `## Landing-tagged WI handler` section conditional on the WI tags. Captures live-URL screenshot post-deploy via `track-visuals --mode external-anchor`, diffs against pre-implementation, includes in receipt.
5. **`test-framework/evals/tier-1/validate-landing-side-by-side-exists.sh`:** glob `docs/specs/work-items/WI-*.md`, parse `**Tags:**` line for `landing` / `marketing-page`, parse `**Status:**` for `VERIFIED`, assert artifact at `docs/specs/landing/<wi-lower>-side-by-side.jpg` for each match. Exits 0 on full pass.
6. **Wire validator** into tier-1 (glob-based discovery already in place per `test-framework/evals/run-all-evals.sh`).

---

## Revision Log

_(empty — first draft)_

---

## Journey References

_None — framework bugfix with no user/system journey beyond the Behavior Contract above._
