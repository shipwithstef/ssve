# Blend Plan & Analysis: GSD vs SVC Validation Routing

**deferred_until**: 2026-08-25
**reason**: auto-triage during WI-CHAIN-TIER1-FIXES; proposal stays open pending re-review after chain validation green | re-triaged 2026-06-29: batch backlog-sequenced behind active framework work — flagged for individual triage by 2026-07-29
**blocked_reason**: Beyond the 14-day defer window: imported/backlog evolution proposal awaiting a dedicated triage pass (re-deferred 2026-06-29, not abandoned).

**Source:** https://github.com/gsd-build/get-shit-done
**Date:** 2026-05-12
**Focus:** Upfront Dependency Routing & Validation Gates (Addressing Codex Review Failure F-6)

## Summary

The user challenged the assumption that GSD's upfront validation (Plan DAG Validation) is structurally superior to SVC's Concern Routing. This document performs a deep, multi-layer analysis of how both frameworks handle validation routing, concluding that **SVC's architecture is actually superior and more scalable**, and that blending GSD's approach would be a regression.

| # | Pattern | Target | Verdict | Action |
|---|---------|--------|---------|--------|
| 1 | Plan DAG Validation (`verify.cjs`) | `validate-delivery-graph.mjs` | SVC's dynamic Concern Registry + Delivery Graph is more robust than GSD's static XML DAG validation. | **SKIP** (Ours is better) |
| 2 | Pre-flight Precondition Gates | `route-workflow` / `scan-concerns.mjs` | GSD hardcodes preconditions. SVC uses decoupled signal-matching. The F-6 failure was a missing registry entry, not a framework flaw. | **IMPROVE** (Add the Linter, do not blend GSD) |

---

## The Deep Comparison: Validation Layers

### 1. How GSD Does It (The XML DAG)
GSD relies on a static Directed Acyclic Graph (DAG) for planning. 
*   **The Layer:** `bin/lib/verify.cjs` runs after the Planner agent outputs `PLAN.md`.
*   **The Mechanic:** It parses `<task>` XML blocks. If Task B requires an artifact from Task A, it mathematically verifies that Task A is scheduled first.
*   **The Weakness:** It is entirely constrained to the active execution plan. If the developer adds a new security requirement to the final `ship` command, but forgets to tell the Planner agent about it, the DAG validation passes, the agent codes, and the final ship fails. GSD suffers from the exact same "late-binding developer error" that caused F-6 in SVC.

### 2. How SVC Does It (The Decoupled Signal Engine)
SVC separates "what changed" from "who needs to check it."
*   **The Layer:** `scripts/scan-concerns.mjs` running at 4 distinct lifecycle points (Session start, Pre-WI dispatch, Pre-commit, Review-gate).
*   **The Mechanic:** When an agent proposes a change (e.g., editing `schema.sql`), SVC scans the diff against `concerns/*.md`. It sees the `schema.sql` signal and automatically injects the `base44-schema` validation skill into the task graph *before* execution starts.
*   **The Strength:** It is completely decoupled. A security engineer can drop a new `concerns/pii-data.md` file into the repo, and immediately, any feature touching PII will be blocked until the `review-security` skill runs. No agent prompts need to be updated. No XML DAG needs to be rewritten.

## Diagnosing the Codex F-6 Failure

**The Incident:** Codex added `feature_validation_closeout` to `review-gate` (the end of the pipe) but forgot to add `concerns/feature-validation-closeout.md` (the start of the pipe). The pipeline crashed at the end.

**Why SVC is still better:** 
If we used GSD's system, Codex would have added the check to the `ship` command and forgotten to update the `gsd-planner` agent prompt. The exact same failure would occur. The root cause wasn't a flaw in SVC's routing architecture; it was a **human/agent error in deploying a new framework feature**. 

We do not need to rewrite SVC's architecture to match GSD. We simply need to enforce that SVC's components are deployed concurrently.

---

## Action Plan (No External Blend Required)

After full dimensional comparison, I judge that **we should NOT blend GSD's Plan DAG Validation.** SVC's dynamic delivery graph and concern routing are significantly more advanced and flexible.

Instead of blending external code, we must fortify SVC's own internal consistency:

### The Fix: The Validation-to-Concern Linter
As proposed in my initial diagnostic, the correct solution is an SVC-native CI linter (`scripts/validate-concern-parity.mjs`). 

**What it changes in SVC:**
*   It reads `scripts/compile-delivery-graph.mjs` and extracts all recognized validation families (e.g., `provider_fidelity`, `feature_validation_closeout`).
*   **Slug normalization (Codex review caught the mismatch):** delivery-graph family identifiers are snake_case (`provider_fidelity`, `feature_validation_closeout`) but concern files are kebab-case (`concerns/provider-fidelity.md`, `concerns/feature-validation-closeout.md`). The linter MUST normalize via `family.replace(/_/g, '-')` before the `concerns/<family>.md` existence check. The lookup target is the kebab-case form; the snake_case form is the source. A future v2 may also accept already-kebab-case families (some delivery-graph evolution may emit them) — implementation falls back to direct match if the snake-to-kebab transform returns the same string.
*   It checks that a corresponding `concerns/<kebab-family>.md` file exists.
*   If a developer or agent tries to merge a PR that adds a new validation gate without adding its upfront routing concern, the linter fails with: `Error: Validation gate 'provider_fidelity' lacks an upfront concern routing file. Add concerns/provider-fidelity.md.` (Note: error message names the kebab-case path the linter looked for.)

## Assessment B: External Addon Viability
**Runtime addon?** NO. GSD's verification scripts are deeply tied to its specific `.planning/` directory structure and `<task>` XML syntax. They cannot operate as addons for SVC.

## Verdict
**SKIP GSD BLEND.** SVC's architecture is definitively superior. The F-6 issue is a linting gap, not an architectural deficit.
