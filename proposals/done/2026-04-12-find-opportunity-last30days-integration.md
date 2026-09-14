# Framework Improvement: find-opportunity last30days Mandatory Integration

**Status:** IMPLEMENTED (2026-04-12)

## Evidence
- **Source:** User-reported gap during real pipeline run. find-opportunity ran 3 iterations (v1-v3) for Stefan's builder profile. WebSearch returned blog posts and listicles but ZERO social proof — no Reddit threads with upvotes, no HN discussions, no X posts with likes. User correctly identified that "something exists" is not proof; "real users want this" with engagement metrics IS proof.
- **Finding:** find-opportunity/SKILL.md Step 3a treated last30days as optional ("if available, run it"). When it wasn't installed, WebSearch was the sole research tool. WebSearch cannot access Reddit comment threads, HN discussions, or X posts — it returns articles ABOUT markets, not demand signals FROM users. The skill also used a single generic query template instead of multi-dimensional discovery.
- **Severity:** high — the skill's core differentiator (evidence-backed opportunity selection) was non-functional without last30days. The "evidence" was blog posts dressed up as validation.

## Diagnosis
- **Root cause:** last30days was a nice-to-have addon, not a mandatory dependency. The skill had no multi-dimensional query strategy — it ran one search per category. Social proof (Reddit upvotes, HN points, X likes) was listed as desirable but not enforced in self-verify or proof chains.
- **Category:** inefficiency + missing capability
- **Already in FRAMEWORK-STATE.md?** No (new finding from first real pipeline run of find-opportunity)

## Implementation
- **Route:** direct SKILL.md edit (skill contract surgery)
- **Files changed:**
  1. `find-opportunity/SKILL.md` — Step 3a completely rewritten:
     - last30days is now MANDATORY (not optional). Skill stops with error if not installed.
     - 4-dimension query strategy: Pain Discovery, Revenue Discovery, Trend Discovery, Gap Discovery
     - Each dimension has a specific query template and extraction rules
     - Cross-dimension convergence analysis required (pain + revenue = strong signal)
     - Niche-down rule: broad results trigger follow-up drill-down queries
     - WebSearch demoted to "3b: Supplemental Research" — validates what last30days found
  2. `find-opportunity/SKILL.md` — Self-verify expanded 16→19 checks:
     - #17: last30days 4 dimensions all run
     - #18: Cross-dimension convergence analyzed
     - #19: Social proof per top-3 candidate (at least 1 engagement-metric-backed signal each)
  3. `find-opportunity/SKILL.md` — Proof chain format updated: social proof requirement added (at least 1 of 5 evidence points must be from last30days with engagement metrics)
  4. `EXTERNAL_ADDONS.md` — find-opportunity integration point changed from "Market research" to "MANDATORY — 4-dimension social proof discovery"
  5. `find-opportunity/SKILL.md` — Continuation mode added to Prerequisites: reads existing opportunity docs, preserves WebSearch data, layers social proof on top, expands funnel with diversity
  6. `find-opportunity/SKILL.md` — Diversity mandate added to Step 3a: each dimension runs TWO queries (in-domain + cross-domain), producing 8 queries total instead of 4

## Replay Verification
- **Replay target:** tier-1 eval suite
- **Result:** PASS (9 scripts, 0 failures)
- **Evidence:** `bash test-framework/evals/run-all-evals.sh --tier1` → PASS

## FRAMEWORK-STATE.md Mutations
- **Analysis History:** Added "find-opportunity last30days mandatory integration"
- **Known Gaps:** n/a (new finding)
- **Decisions:** last30days is now a hard dependency for find-opportunity, not an optional addon
- **Capabilities:** find-opportunity now has 4-dimension social proof discovery
