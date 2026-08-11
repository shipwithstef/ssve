# Manifest — WI-139: Mandatory visual side-by-side gate for landing-page work

**Spec:** docs/specs/features/WI-139-landing-side-by-side.md
**Branch:** bugfix-WI-139-landing-side-by-side
**Status:** DRAFTED
**Base branch:** main
**Base SHA:** 0f972a8d59a72814fccc45c777c02f56cb4925e1
**Created:** 2026-04-29
**Lane:** framework
**Archetype:** Bounded feature (bugfix-shape) — universe spec-defined: 3 SKILL.md edits + 1 validator + 1 stitcher helper + 1 fixture

---

## Implementation Summary

Close the quality-gate gap that allows landing iterations to ship while visually failing against named sector anchors. Add a mandatory side-by-side render to benchmark-landing Step 0, a ship-readiness gate to landing-page Step 0.5, a landing-tagged WI handler to verify-promotion, and a tier-1 validator that enforces the artifact's existence. Reuse track-visuals (existing) for Playwright capture; add one shared stitcher helper so all 3 calling skills emit identical-shape output.

**Invariants (must remain unchanged):**
- track-visuals skill body — already supports external-anchor mode; reuse, do not modify.
- landing-page skill flow outside Step 0.5 — only the ship-readiness sub-section is added.
- benchmark-landing 8-dimension rubric — gate added before scoring; only below-fold-density gets a visually-thin override.
- verify-promotion G7 protocol for non-landing WIs — unchanged.
- references/landing-bank schemas — unchanged.

**Major constraints:**
- Image stitching must work without npm install if possible (graceful fallback to imagemagick convert).
- Skills must NOT reimplement Playwright capture; all rendering goes through track-visuals --mode external-anchor.

---

## Files Planned

| File | Action | Task | Purpose |
|------|--------|------|---------|
| scripts/stitch-side-by-side.mjs | CREATE | task-1 | Shared 4-up stitcher (sharp preferred, imagemagick fallback) |
| benchmark-landing/SKILL.md | MODIFY | task-2 | Step 0 mandatory side-by-side + visually-thin override |
| landing-page/SKILL.md | MODIFY | task-3 | Step 0.5 ship-readiness gate sub-section |
| verify-promotion/SKILL.md | MODIFY | task-4 | Landing-tagged WI conditional handler |
| test-framework/evals/tier-1/validate-landing-side-by-side-exists.sh | CREATE | task-5 | Tier-1 validator |
| test-framework/fixtures/wi139-empty-landing-dir/.gitkeep | CREATE | task-5 | Fixture support for validator self-test |

---

## Task Graph

### task-1 — stitcher-helper
**Touched files:** scripts/stitch-side-by-side.mjs (CREATE)
**Dependencies:** none
**AC coverage:** WI139-07, WI139-08
**What:** Node ESM script that takes 4 image paths + 4 labels via CLI args, outputs a 2×2 stitched JPEG. Capability detection at startup: prefer `sharp` (npm), fallback to shelling out to imagemagick `convert`. CLI surface includes `--help`, `--check-deps`, and the main stitch invocation. Stitching contract documented inline at top: 1440×900 per-tile, 2×2 layout, 2880×1800 total, JPEG quality ≥85, target top-left, anchor labels visible. **Path-casing convention (per F1 review):** all calling skills + the stitcher emit lowercase `<wi-lower>` in the output filename — e.g. `wi-139-side-by-side.jpg`, never `WI-139-side-by-side.jpg`.
**Validation:**
- node --check scripts/stitch-side-by-side.mjs
- node scripts/stitch-side-by-side.mjs --help exits 0
- node scripts/stitch-side-by-side.mjs --check-deps exits 0 with PASS line naming the active backend (sharp or imagemagick); exits non-zero with actionable message if neither is available
- Optional smoke: pass 4 dummy 1440×900 PNGs, assert output exists at expected dimensions
**Checkpoint:** task-1-stitcher-helper

### task-2 — benchmark-landing-gate
**Touched files:** benchmark-landing/SKILL.md (MODIFY)
**Dependencies:** task-1
**AC coverage:** WI139-01, WI139-02, WI139-03
**What:** Insert a "Step 0 — Mandatory visual side-by-side" section BEFORE the existing scoring rubric. Specifies: invoke track-visuals --mode external-anchor for top-2 sector anchors + top-1 high-performer + target page; pass to scripts/stitch-side-by-side.mjs; save to `docs/specs/landing/<wi-lower>-side-by-side.jpg` (lowercase WI ID per F1); refuse-to-score if artifact missing. Add visually-thin detection rule — **clarified per F3 review as REVIEWER-JUDGED with the thresholds as guidance**: ">40% more white space than median anchor" and "product-UI section <50% of anchor's height" are guidance thresholds for the reviewer's honest aesthetic judgment line, NOT computed metrics. The visually-thin override caps below-fold-density at 4/10 when the reviewer judges the page meets either threshold. Update verdict-output template to include artifact path + per-anchor honest judgment line.
**Validation:**
- bash test-framework/evals/tier-1/validate-skill-structure.sh (existing) passes for benchmark-landing
- grep "side-by-side" benchmark-landing/SKILL.md returns ≥3 hits (gate, validation, verdict)
**Checkpoint:** task-2-benchmark-landing-gate

### task-3 — landing-page-ship-ready
**Touched files:** landing-page/SKILL.md (MODIFY)
**Dependencies:** task-1
**AC coverage:** WI139-05
**What:** Append a "Ship-readiness gate vs anchor" sub-section to Step 0.5 (after Market-Gap analysis, before design-ui handoff). Emits binary "ship-ready vs ANCHOR_TOP_1: yes|no" + one-paragraph honest gap read. Surfaced inline in lane-tasks skill_receipt.
**Validation:**
- bash test-framework/evals/tier-1/validate-skill-structure.sh passes for landing-page
- grep "ship-ready" landing-page/SKILL.md returns ≥1 hit
**Checkpoint:** task-3-landing-page-ship-ready

### task-4 — verify-promotion-landing-handler
**Touched files:** verify-promotion/SKILL.md (MODIFY)
**Dependencies:** task-1
**AC coverage:** WI139-04
**What:** Insert a "## Landing-tagged WI handler" section conditional on the WI's Tags field containing landing or marketing-page. For matched WIs: capture post-deploy live-URL screenshot via track-visuals --mode external-anchor; diff against pre-implementation side-by-side stored at WI start (path docs/specs/landing/<wi-lower>-side-by-side.jpg); require shipped change visible at comparison scale; include post-deploy screenshot in receipt.
**Validation:**
- bash test-framework/evals/tier-1/validate-skill-structure.sh passes for verify-promotion
- grep -i "landing-tagged\|marketing-page" verify-promotion/SKILL.md returns ≥1 hit
**Checkpoint:** task-4-verify-promotion-landing-handler

### task-5 — tier1-validator
**Touched files:** test-framework/evals/tier-1/validate-landing-side-by-side-exists.sh (CREATE), test-framework/fixtures/wi139-empty-landing-dir/.gitkeep (CREATE)
**Dependencies:** none (parallel with task-1)
**AC coverage:** WI139-06
**What:** Bash script that globs docs/specs/work-items/WI-*.md, parses Tags field for landing/marketing-page, parses Status for VERIFIED, asserts artifact at docs/specs/landing/<wi-lower>-side-by-side.jpg exists for each match. Exits 0 on full pass or zero matches. Uses set -euo pipefail. Read-only. Supports `--fixture-dir <path>` env override (or first positional arg) for self-test against fixture data.

**Negative-path coverage (per F2 review):** Create fixture at test-framework/fixtures/wi139-empty-landing-dir/ containing a synthetic WI markdown with `**Tags:** landing` + `**Status:** VERIFIED` and NO companion artifact under docs/specs/landing/. Add an inline self-test in the validator OR a separate test runner that points the validator at the fixture dir and asserts non-zero exit. This exercises the failure path on every CI run, not just when a real landing WI ships.
**Validation:**
- bash -n test-framework/evals/tier-1/validate-landing-side-by-side-exists.sh
- shellcheck test-framework/evals/tier-1/validate-landing-side-by-side-exists.sh
- Positive path: `bash test-framework/evals/tier-1/validate-landing-side-by-side-exists.sh` exits 0 against the real repo (zero VERIFIED landing-tagged WIs today).
- Negative path: `bash test-framework/evals/tier-1/validate-landing-side-by-side-exists.sh --fixture-dir test-framework/fixtures/wi139-empty-landing-dir/` exits non-zero with a message naming the missing artifact path. The validator's own bottom block runs both paths inline if invoked with `--self-test` flag.
**Checkpoint:** task-5-tier1-validator

### task-6 — wire-validator
**Touched files:** none (glob discovery already in place)
**Dependencies:** task-5
**AC coverage:** WI139-06 (completion)
**What:** Confirm new validator picked up by tier-1 aggregate glob-discovery (run-all-evals.sh uses `for script in tier-1/*.sh`).
**Validation:**
- bash test-framework/evals/run-all-evals.sh --tier1 2>&1 | grep validate-landing-side-by-side-exists shows the validator running
**Checkpoint:** task-6-wire-validator

---

## AC-to-Task Mapping

| AC | Task(s) |
|----|---------|
| WI139-01 | task-2 (refuse-to-score gate) |
| WI139-02 | task-2 (verdict template) |
| WI139-03 | task-2 (visually-thin override) |
| WI139-04 | task-4 (verify-promotion handler) |
| WI139-05 | task-3 (Step 0.5 sub-section) |
| WI139-06 | task-5 + task-6 (validator + wiring) |
| WI139-07 | task-1 + task-2/3/4 (track-visuals reuse + stitcher invocation) |
| WI139-08 | task-1 (contract documented inline at script top) |

Coverage: 8/8 ACs mapped.

---

## AC-to-Test Mapping

| AC | Test type | Where |
|----|-----------|-------|
| WI139-01 | Manual / behavioral | Run benchmark-landing without artifact, expect refuse-to-score with named path in error |
| WI139-02 | Behavioral | Inspect benchmark-landing verdict output template grep |
| WI139-03 | Behavioral | Inspect override rule grep |
| WI139-04 | Manual (post-merge against a real landing WI) | verify-promotion run produces post-deploy capture |
| WI139-05 | Behavioral | grep ship-ready in landing-page Step 0.5 |
| WI139-06 | Unit (tier-1) | Validator runs and exits 0 |
| WI139-07 | Unit (grep skill bodies) | All 3 calling skills reference track-visuals + stitcher |
| WI139-08 | Unit (grep stitcher header) | Contract block present at top of stitch-side-by-side.mjs |

---

## External State

| # | Environment | What state | Coupling | Lifecycle wiring |
|---|-------------|------------|----------|------------------|
| 1 | Local filesystem — docs/specs/landing/<wi-lower>-side-by-side.jpg | Created by benchmark-landing Step 0 + verify-promotion landing-handler; one per landing/marketing-tagged WI | coupled | tier-1 validator (task-5) catches missing artifacts on every CI run |
| 2 | Per-skill SKILL.md text (3 files) | Mutated by tasks 2/3/4 | coupled | Existing tier-1 validate-skill-structure.sh enforces frontmatter + section conventions |
| 3 | tier-1 eval registry | New validator auto-discovered via glob | coupled | task-6 confirms via aggregate run |

**Untouched environments (taxonomy walked, found nothing):** Cloud/SaaS deployments, database, CDN/edge cache, DNS/TLS, CI secrets/env vars, package registries, browser extension stores, mobile app stores, Slack/Discord/email integrations, GitHub repository settings, webhook endpoints, feature-flag service, monitoring/alert config, backup/snapshot store, license/compliance registries.

---

## Validation Plan

### Per-task validation
See each task's "Validation" block above.

### Final branch-level validation
```bash
# 1. Stitcher syntax + help
node --check scripts/stitch-side-by-side.mjs
node scripts/stitch-side-by-side.mjs --help

# 2. Skill structure validation (catches frontmatter regressions)
bash test-framework/evals/tier-1/validate-skill-structure.sh

# 3. Validator script
bash -n test-framework/evals/tier-1/validate-landing-side-by-side-exists.sh
shellcheck test-framework/evals/tier-1/validate-landing-side-by-side-exists.sh
bash test-framework/evals/tier-1/validate-landing-side-by-side-exists.sh

# 4. AC content checks (grep-based)
grep -q "side-by-side" benchmark-landing/SKILL.md
grep -q "ship-ready" landing-page/SKILL.md
grep -qi "landing-tagged\|marketing-page" verify-promotion/SKILL.md

# 5. Tier-1 aggregate
bash test-framework/evals/run-all-evals.sh --tier1
```

### Post-merge validation (verify-promotion)
- The next time a landing-tagged WI runs benchmark-landing, the gate fires.
- The new tier-1 validator runs as part of every CI pass.
- Spot-check: trigger the negative path manually (delete a hypothetical artifact, expect validator non-zero).

---

## Checkpoint Plan

Sequential:
1. task-1-stitcher-helper
2. task-2-benchmark-landing-gate
3. task-3-landing-page-ship-ready
4. task-4-verify-promotion-landing-handler
5. task-5-tier1-validator
6. task-6-wire-validator

Tasks 1 + 5 are independent (parallelizable). 2/3/4 depend on 1. 6 depends on 5.

---

## Promotion Readiness Checklist

- [ ] All 6 planned files in task graph
- [ ] 8/8 ACs mapped
- [ ] All checkpoints named
- [ ] No banned scope-reduction phrases
- [ ] Tier-1 aggregate green
- [ ] No incidental file edits in final diff

---

## Simulation Report

| Task | Check | Result |
|------|-------|--------|
| task-1 | scripts/ directory exists | PASS |
| task-1 | sharp / imagemagick available — UNKNOWN at plan time | WARN — execute-changeset detects at runtime |
| task-2 | benchmark-landing/SKILL.md exists | PASS (verified) |
| task-3 | landing-page/SKILL.md exists | PASS (verified) |
| task-4 | verify-promotion/SKILL.md exists | PASS (verified) |
| task-5 | test-framework/evals/tier-1/ glob-discovered | PASS (run-all-evals.sh confirmed glob-based) |
| task-5 | test-framework/fixtures/ exists | PASS (created in WI-137) |
| task-6 | run-all-evals.sh tier-1 glob mechanism | PASS (verified during WI-137) |

### Scenario coverage
Framework bugfix; no Gherkin scenarios. Coverage via 8/8 AC mapping.

---

## Adversarial Plan Review (inline self-check)

1. **Missing tasks:** All 8 ACs mapped. ✓
2. **Dependency correctness:** task-1 first (helper others depend on); 2/3/4 in parallel after task-1; task-5 independent; task-6 confirms task-5. DAG valid. ✓
3. **Scope reduction:** No banned phrases. ✓
4. **Validation strength:** Each task validation actually exercises the change (grep for inserted strings, run actual scripts, run actual tier-1). ✓
5. **First-task viability:** task-1 only needs node + (sharp OR imagemagick) which are universal on the dev machine. ✓
6. **Pattern-family completeness:** No grep-AC patterns; the grep checks ARE the validation, not the AC. ✓
7. **Visual-rendering AC tier:** This entire WI IS the visual-rendering layer being added — the gate it builds (refuse-to-score until side-by-side exists) is itself the answer to the broader visual-AC question. No screenshots needed for these meta-level ACs since the artifact each calling skill produces IS the screenshot evidence going forward. ✓

All 7 checks pass. Manifest moves DRAFTED → SIMULATED.

---

## Loop-Back Anchors

- Spec ambiguity → write-spec
- Track-visuals can't capture a given anchor URL → research (rare; Playwright handles most modern landing pages)
- Image-stitching capability missing both `sharp` and `imagemagick` → design-tech (would need to add a 3rd fallback or vendor a small JS implementation)

---

## Status

**DRAFTED → SIMULATED** (per inline adversarial review).
