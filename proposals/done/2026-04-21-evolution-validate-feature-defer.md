# Framework Evolution — 2026-04-21 — Validate-Feature "Defer to Milestone" State

**Status:** IMPLEMENTED (2026-04-21, via `improve-framework` direct SKILL.md edit route — see `proposals/done/2026-04-21-framework-improvement-validate-feature-defer.md`). P0 finding F-001 landed in `validate-feature/SKILL.md` (DEFER decision state + disambiguation table + DEFER Protocol + artifact routing + self-verify extension) and `FRAMEWORK-STATE.md` (2026-04-21 Analysis History entry).

## Method
- Read `validate-feature/SKILL.md` sections on "Ship Decision", "Kill Signals", and "Builder History Weighting".
- Reviewed the current outcomes (SHIP, SHIP WITH WARNINGS, PIVOT, NO-SHIP).
- Analyzed the gap articulated by the user regarding early-stage feature timing (e.g., "ship after first paying customer" vs "not ship at all").

## Findings (by priority)

### P0 — Fix now (blocks quality)
#### F-001: Validate-Feature lacks a "DEFER" state for valid ideas with bad timing [Gap]
**Evidence:** `validate-feature/SKILL.md:684-691` — The Decision table only permits `SHIP`, `PIVOT`, `SHIP WITH WARNINGS`, or `NO-SHIP`. 
**Impact:** When a feature is a genuinely good idea but hits K1 (No demand evidence) or K6 (MVP is a platform) strictly because of a Builder Profile constraint (like `[zero-to-revenue-gap]`), it is rejected as `NO-SHIP`. `NO-SHIP` implies the feature should never be built. This forces the builder to either lose the idea eternally or maliciously override the framework. The framework is currently incapable of saying "Great feature, but wait until milestone X."
**Proposed fix:** 
1. **Decision Matrix Update:** Add `DEFER (Milestone: <Condition>)` to the Decision matrix in `validate-feature` (around line 684).
2. **Clarify NO-SHIP vs DEFER:** Explicitly define that `NO-SHIP` is for inherently flawed or strategically misaligned features (e.g., K3/K4/K5), whereas `DEFER` is for conceptually valid ideas blocked *only* by timing/Builder profile constraints (e.g., K1/K6 firing simply because of a zero-to-revenue rule). 
3. **Pipeline Logging:** Update the `scripts/pipeline-log.mjs` example instruction in `validate-feature/SKILL.md` to include `DEFER: <feature name> (Until: <Milestone>)` in the allowed `--decision` types.
4. **Artifact Routing:** Specify that a `DEFER` decision still produces the Feature Ship Brief with a `DEFERRED` status and explicitly instructs the skill to append the item to `docs/specs/work-items/INDEX.md` as `Status: DEFERRED` and `Severity: blocked-by-[milestone]`, effectively shelving it safely without killing it.
**Confidence:** HIGH

## Comparison delta
Traditional Product Management frameworks (like RICE or MoSCoW) natively support generic backlog deferment ("Won't have this time"). The SVC framework's binary `SHIP/NO-SHIP` forcing function is excellent for killing bloat, but overly punitive for solo builders who legitimately need to queue up "Stage 2" features without losing them. A conditional `DEFER` retains SVC's high bar for execution today, while respecting the builder's long-term roadmap.

## Stale proposal audit
No stale proposals audited this pass.

## Self-Verify
| # | Check | Result |
|---|---|---|
| 1 | Proposal file exists | PASS |
| 2 | Every finding cites file:line or measurement | PASS |
| 3 | FRAMEWORK-STATE.md was read first; no rediscovered items | PASS |
| 4 | Findings ranked by impact + confidence | PASS |
