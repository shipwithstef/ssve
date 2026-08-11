# Proposal: Shift-Left Concern Routing & Validation Parity

**Date:** 2026-05-12
**Status:** Proposed
**Author:** Gemini CLI
**Context:** This proposal addresses the systemic failure mode where end-of-pipeline validation gates crash because upfront routing signals were forgotten.
**deferred_until**: 2026-08-25
**reason**: auto-triage during WI-CHAIN-TIER1-FIXES; proposal stays open pending re-review after chain validation green | re-triaged 2026-06-29: batch backlog-sequenced behind active framework work — flagged for individual triage by 2026-07-29
**blocked_reason**: Beyond the 14-day defer window: imported/backlog evolution proposal awaiting a dedicated triage pass (re-deferred 2026-06-29, not abandoned).

---

## 1. The Problem: Late-Binding Validation Failures

Currently, Serious Vibe Coding (SVC) treats **Validation** (the gates at the end of the pipeline, like `review-gate`) and **Routing** (the concerns scanned at the start of the pipeline by `route-workflow`) as disconnected, manual processes.

When a developer or AI agent adds a new validation requirement (e.g., "All features must have a `FEATURE_VALIDATION_LEDGER.md`"), they add it to the `review-gate`. If they forget to create a corresponding `concerns/*.md` file to trigger the creation of that ledger upfront, the system fails catastrophically.

### What this breaks today:
1. **Token & Time Waste:** The `route-workflow` skill doesn't know the ledger is required, so it skips the `validate-feature` phase. The agent proceeds to write code, burning hundreds of thousands of tokens and significant wall-clock time. The pipeline only realizes the mistake at the very end when `review-gate` fails due to the missing artifact.
2. **Fragile Framework Upgrades:** As seen in the recent Codex review (Failure F-6), agents successfully ship new validation ledgers but routinely forget the upfront wiring. This makes evolving the framework highly error-prone.
3. **Developer Frustration:** A human user asks to build a feature, waits for the code to be written, and is then hit with a hard block requiring them to go back and do the planning phase they didn't know was required.

---

## 2. The Solution: "Shift-Left" Architectural Guarantees

To solve this, we must adopt a "Shift-Left" philosophy: **Never wait until the execution phase to discover a missing specification dependency.** 

I propose a two-part solution: an immediate linting fix to stop the bleeding, and a long-term architectural shift.

### Phase 1: The Validation-to-Concern Linter (Immediate Fix)

We cannot rely on humans or agents to "remember" to keep routing and validation in sync. We will enforce it mathematically in CI.

**How it works:**
We introduce a new tier-1 linting script: `scripts/validate-concern-parity.mjs`.
1. The script parses the Delivery Graph Compiler (`scripts/compile-delivery-graph.mjs`) and the `review-gate` logic to extract a list of all active validation evidence families (e.g., `provider_fidelity`, `feature_validation_closeout`).
2. For every evidence family found at the *end* of the pipeline, it checks the `concerns/` directory at the *start* of the pipeline.
3. It asserts that a corresponding `concerns/<family>.md` file exists.

**What it solves:**
If an agent (like Codex) writes a PR that adds a new validation requirement to `review-gate` but forgets the routing file, the `tier-1` pre-commit hooks and CI pipelines will instantly fail with:
`Error: Validation gate 'provider_fidelity' lacks an upfront concern routing file. Add concerns/provider-fidelity.md.`
This prevents incomplete framework features from ever landing on `main`.

### Phase 2: Declarative Artifact Dependency Graph (Architectural Evolution)

While the linter prevents bad code from merging, the ultimate goal is to make the framework self-assembling. We will evolve SVC to use an automatic dependency graph.

**How it works:**
1. **Declarative Outputs:** Upstream skills will declare the artifacts they produce in their `SKILL.md` frontmatter. For example, `validate-feature` will declare `produces: [FEATURE_VALIDATION_LEDGER.md]`.
2. **Declarative Inputs:** Downstream gates will declare what they require. `review-gate` will declare `requires: [FEATURE_VALIDATION_LEDGER.md]`.
3. **Dynamic Graph Resolution:** When `route-workflow` initializes a task graph, it reads the requirements of the final gates. If `review-gate` requires the ledger, the orchestrator automatically walks the dependency graph backwards, finds that `validate-feature` produces it, and seamlessly injects `validate-feature` into the active lane.

**What it solves:**
*   **Zero "Forgotten" Routing:** The pipeline becomes a mathematically proven dependency tree. If an end-gate needs a file, the system automatically schedules the skill that creates it.
*   **True Autonomy:** Developers and agents can add new validation gates to the end of the pipeline without needing to manually wire up regex signals at the start. The framework handles the dependency resolution autonomously.

---

## 3. Proof of Concept: Progressive Dynamic Delivery Scenarios

To prove that the Declarative Artifact Dependency Graph (Phase 2) is superior to both our current regex-based routing and GSD's static XML DAGs, here are 5 concrete scenarios. These demonstrate that the new architecture mathematically guarantees safety without causing regressions in fast-paths, fully supporting SVC's progressive dynamic delivery model.

### Scenario 1: The Codex F-6 Failure (Missing Ledger)
*   **The Situation:** A developer adds a new requirement to `review-gate` (e.g., `requires: [FEATURE_VALIDATION_LEDGER.md]`) but forgets to create `concerns/feature-validation-closeout.md`. A user asks to build a new feature.
*   **Before (Current SVC):** `route-workflow` relies on the missing concern file, misses the upstream dependency, and skips `validate-feature`. The execution agent writes the code, burning ~100k tokens. `review-gate` runs at the very end, realizes the ledger is missing, and crashes the pipeline.
*   **After (Declarative DAG):** `route-workflow` compiles the delivery graph at session start. It sees that `review-gate` requires `FEATURE_VALIDATION_LEDGER.md`. It automatically traces this dependency backwards to `validate-feature` (which produces it) and injects it into the lane. The developer's forgotten routing file is rendered irrelevant by the artifact graph. **Result: Zero waste, failure prevented upfront.**

### Scenario 2: Greenfield API with Paid Provider (Mid-Flight Dynamic Injection)
*   **The Situation:** A user asks to "Add a checkout flow" in a greenfield project, which will ultimately use Stripe.
*   **Before (Current SVC):** `route-workflow` relies on `concerns/paid-external-api.md` matching the word "Stripe" in the initial prompt. Because the user didn't explicitly say "Stripe", the regex misses, and `manage-finops` is completely bypassed.
*   **After (Declarative DAG):** `design-tech` runs and produces `ARCHITECTURE.md`, which declares an external dependency on Stripe. The DAG compiler re-evaluates the graph *mid-flight*. It sees a paid API was added, so the `execute-changeset` node now dynamically `requires: [FINOPS_APPROVAL.md]`. The DAG automatically pauses execution and routes to `manage-finops`. 
*   **Progressive Delivery:** If the architecture changes to a free API later, the dependency is dropped from `ARCHITECTURE.md`, and `manage-finops` is skipped.

### Scenario 3: Brownfield UI Typo (Optional Component Skip)
*   **The Situation:** A user asks to fix a typo on a landing page via the `bugfix` lane.
*   **Before (Current SVC):** Broad regex concerns might accidentally trigger heavy visual tracking (`track-visuals`) or UX design phases just because a `.tsx` file is touched, slowing down a trivial fix.
*   **After (Declarative DAG):** The user invokes `/quick-fix`. The `quick-fix` skill explicitly overrides the delivery graph, declaring it does not require `VISUAL_REGRESSION_REPORT.md` or `UX_SPEC.md`. Because those artifacts are no longer required by the end-gates for this specific fast-lane, the upstream skills (`track-visuals`, `design-ux`) are safely excluded from the graph. **Result: No regression in fast paths.**

### Scenario 4: Cross-System Contract Map (Conditional Escalation)
*   **The Situation:** A user modifies a complex authentication flow spanning multiple systems.
*   **Before (Current SVC):** Relies on a brittle, regex-heavy pre-dispatch script (`validate-system-contract-map.mjs`) to scan the prompt and guess if the flow crosses system boundaries.
*   **After (Declarative DAG):** `design-tech` evaluates the change and sets a state flag: `cross_system_boundary: true`. The delivery graph compiler instantly updates, making `SYSTEM_CONTRACT_MAP.md` a required input for `plan-changeset`. The pipeline dynamically adapts to the discovered complexity and invokes `write-spec` to produce the map, without relying on prompt-guessing.

### Scenario 5: E2E Test Generation (Artifact-Based Skipping)
*   **The Situation:** A user requests E2E tests for a new feature.
*   **Before (Current SVC):** The pipeline might blindly run `write-journeys` even if the journeys already exist, or crash if they don't, because it relies on hardcoded sequential steps.
*   **After (Declarative DAG):** `write-e2e` declares `requires: [JOURNEYS.md]`. The DAG traces this back to `write-journeys`, which in turn requires `DOMAIN_CAPABILITIES.md`. 
    *   *Path A:* If this is a brand new domain, the DAG schedules `catalog-domain-capabilities` -> `write-journeys` -> `write-e2e`.
    *   *Path B:* If `DOMAIN_CAPABILITIES.md` already exists and is fresh, the DAG recognizes the dependency is fulfilled, skips `catalog-domain-capabilities`, and starts at `write-journeys`.
    *   *Path C:* If `JOURNEYS.md` already exists, it skips directly to `write-e2e`. **Result: Efficient progressive narrowing based on actual file state on disk, not hardcoded sequences.**

---

## 4. Implementation Plan

1.  **Write `scripts/validate-concern-parity.mjs`** (Phase 1).
2.  **Add it to `test-framework/evals/tier-1/`** so it runs on every commit.
3.  **Retrofit the missing concern files** (`concerns/feature-validation-closeout.md` and `concerns/provider-fidelity.md`) that caused the F-6 failure, so the new linter passes.
4.  **File a framework-evolution Work Item (WI)** to track the development of the Phase 2 Declarative Artifact Graph.

## 5. Conclusion

By shifting dependency validation to the far left (either at lint-time or intent-time), we completely eliminate the "late-binding" crashes that currently waste tokens and frustrate users. This moves SVC closer to true mathematical determinism, proving far more resilient than regex-based routing or static DAGs.
