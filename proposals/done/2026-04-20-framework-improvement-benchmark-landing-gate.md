# Framework Improvement: benchmark-landing gate + landing reference bank

**Status:** IMPLEMENTED (2026-04-20, MVP — F-001/F-002/F-003/F-004 of evolve proposal)

## Evidence
- **Source:** user critique 2026-04-20 of WI-088 Storyboard landing output: box out of proportion, animation too fast, too many people too small, figures too basic, framework run for weeks with no assessment. Evolution proposal: `proposals/done/2026-04-20-evolution-design-benchmark-gate.md` (contains 7 findings ranked P0-P3).
- **Finding (from proposal):** svc had 7+ review skills (review-plan, review-gate, audit-implementation, track-visuals, review-security, review-cross-model, Vibe Contract rubric) but zero benchmarked against external best-in-class samples. Every internal check passed for WI-088 while the output landed at ~4.3/10 vs. 2026 indie SaaS bar of 7-8.
- **Severity:** high (framework-level gap; every UI-producing WI is exposed to unscored shipment).

## Diagnosis
- **Root cause:** `design-ui/SKILL.md:506` instructed skill to "web search for 5-10 products" ad-hoc per invocation — results uncached, per-project, imperfect, uncomparable across runs. No framework-level reference bank. No automatic "output vs. bank median gap → score → block" gate. No viewport-size-aware re-review.
- **Category:** missing capability (new skill + new reference-bank primitive + skill-level amendments)
- **Already in FRAMEWORK-STATE.md?** No — this is the first output-quality benchmark infrastructure in svc.

## Implementation
- **Route:** new skill creation + new reference primitive + direct SKILL.md amendments + skills-manifest update
- **Files changed:**
  - `references/landing-bank/` (new directory primitive) — 2 files: top-level README (schema + workflow), `local-business-saas/README.md` (sector dossier with 5 starter samples + sector median table)
  - `benchmark-landing/SKILL.md` (new skill) — 8-dimension rubric, 3-step process (capture → mechanical-measure → Omni-subjective → aggregate), min-viewport aggregation rule, override protocol
  - `scripts/benchmark-landing-capture.sh` (new, 80 lines) — playwright capture across 5 viewports (1600/1280/1024/768/390), handles ESM module-resolution by writing capture script to project root temporarily
  - `track-visuals/SKILL.md` — added "Hard rule — multi-viewport capture" section after Overview (F-003)
  - `design-ui/SKILL.md` inputs block — added REQUIRED `docs/specs/marketing-context.md` + `references/landing-bank/<sector>/` (F-004)
  - `skills-manifest.json` — `benchmark-landing` added to `includedSkills`
  - `FRAMEWORK-STATE.md` — Analysis History entry with decisions + deferred follow-ups
- **Commits:** pending on next push

## Replay Verification
- **Replay target 1:** `benchmark-landing-capture.sh http://localhost:5174/` captures 5 viewports × 2 states = 10 PNG files
- **Result:** PASS. 10 PNGs in `/tmp/hh-bench-test/`, sizes 216KB–899KB. Mobile 390 captured 216KB (validates narrow-viewport render); desktop 1600 captured 899KB (validates design-canvas render).
- **Replay target 2:** produce first benchmark-score YAML for WI-088 landing at `docs/specs/benchmark/<date>-<wi>-landing.yaml`
- **Result:** PASS. File written at `example-marketplace/docs/specs/benchmark/2026-04-20-wi-088-landing.yaml` with per-viewport scores and min-aggregate = 3.8 (< 7 threshold → BLOCK). Block reasons and priority fixes enumerated.
- **Replay target 3:** skills-manifest.json contains `benchmark-landing` in includedSkills
- **Result:** PASS (verified by jq query)
- **Replay target 4:** design-ui REQUIRED inputs now include marketing-context + landing-bank
- **Result:** PASS (verified by head of design-ui/SKILL.md)

## FRAMEWORK-STATE.md Mutations
- **Analysis History:** new 2026-04-20 entry at top of Analysis History
- **Current State:** skills count should bump (55 → 56 with benchmark-landing), reference-docs count already reflects landing-bank via its README
- **Known Gaps:** no change — F-005/F-006/F-007 tracked explicitly as deferred-followups
- **Decisions (new, locked):** aggregate is min not mean; reference bank is framework-level; 6-month sample-stewardship cadence; override requires written justification + revisit date; illustrated-character-scene hero is anti-pattern for LB-SaaS sector per bank evidence

## First honest assessment produced
WI-088 Storyboard landing scored **3.8/10 aggregate** (min of per-viewport scores across 1600/1280/1024/768/390). Desktop 1600: 4.6/10. Tablet 768: 4.1/10 (with right-card entirely hidden). Mobile 390: 4.4/10 (same hide-not-reflow regression). Gate decision: BLOCK.

This is the assessment the user demanded — the one the framework never produced until now.

## Deferred follow-ups
- **F-005:** periodic framework self-assessment. Stop hook + `scripts/quality-report.sh --since <date>` reading `.svc/quality-timeseries.jsonl`. Establishes longitudinal trend across WIs.
- **F-006:** illustration-craft rule amendment in `rules/web/design-quality.md`.
- **F-007:** blend watchlist for taste GPTs, Mobbin/Land-book imports.
- **F-001-expansion:** expand sample bank from 5 → 10 per sector; add dev-tools, productivity sectors as new WIs demand.
- **F-002-followup:** auto-dispatch Omni from benchmark-landing (currently Omni analysis is manual via script-driven prompt).
- **Phase-B application to WI-088:** iterate the landing page using the score's `next_iteration.priority_fixes` block (reduce scene to 3-4 elements, reflow mobile below copy, reconsider illustration tier). Target: aggregate ≥ 7/10. Tracked as follow-up in example-marketplace WI-088.

## External sources consulted
None this pass — the 5 starter samples are authored from public knowledge of the products at the 2026 bar; no scraping. Sample schema designed svc-native but easily imports Mobbin/Land-book patterns later.

## Notes for orchestrators
- Until auto-dispatch lands, the Omni step in benchmark-landing is manual: after capture, orchestrator dispatches MiMo Omni with the 5 viewport screenshots + top-3 bank sample references, asks for per-dimension score, writes YAML.
- The mechanical-measurement step (element count, density, text hierarchy ratio) is NOT automated yet — orchestrator provides these manually based on screenshot inspection. This is the F-002-followup work.
- The gate is real: if the produced YAML has `gate_decision: BLOCK` and no `override`, the skill's self-verify check #6 fails and downstream skills should refuse to promote.
- Override is allowed but leaves a durable record: `.svc/quality-timeseries.jsonl` (when F-005 lands) will have every override logged with the orchestrator's justification.
