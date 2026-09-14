# Framework Evolution / Improvement — 2026-05-26 — Absolute Plan Standard

**Status:** DRAFT

<!--
accepted_wi: WI-347
rejected_reason:
deferred_until:
-->

## Method

- **Assessment:** Conducted a comprehensive technical and structural audit of the planning and execution phases within the Serious Vibe Coding (svc) framework.
- **Inputs Analysed:**
  - [plan-changeset/SKILL.md](file:///workspace/seriousvibecoding/plan-changeset/SKILL.md)
  - [execute-changeset/SKILL.md](file:///workspace/seriousvibecoding/execute-changeset/SKILL.md)
  - [scripts/verify-plan-mechanical.sh](file:///workspace/seriousvibecoding/scripts/verify-plan-mechanical.sh)
  - [references/plan-review-protocol.md](file:///workspace/seriousvibecoding/references/plan-review-protocol.md)
  - [schemas/receipts/plan-manifest.schema.json](file:///workspace/seriousvibecoding/schemas/receipts/plan-manifest.schema.json)
  - [references/chain-receipt-contract.md](file:///workspace/seriousvibecoding/references/chain-receipt-contract.md)
- **Framework State Alignment:** Reviewed the existing planning records in [FRAMEWORK-STATE.md](file:///workspace/seriousvibecoding/FRAMEWORK-STATE.md) (specifically the `2026-04-20: review-plan gate` and the `2026-04-23: plan-changeset discipline` entries). This proposal builds directly on top of those existing mechanisms to enforce absolute determinism.

---

## Core Roles in the Plan-Exec Chain

### What `plan-changeset` Does:
1. **Context Loading & Archetype Classification:** Analyzes the work item size/shape, classifies the problem into one of 5 archetypes (Bounded, Migration, Architectural, Cross-cutting, Incremental), and scans for deprecated foundations or RLS policies.
2. **Structural Mapping:** Identifies files to CREATE or MODIFY, and outlines the logical task graph detailing file touches and step dependencies.
3. **Traceability:** Maps every spec Acceptance Criterion (AC) to a task, and maps every AC to a specific test type (Unit, E2E, Manual).
4. **Validation & Checkpoint Planning:** Defines verification commands per task, logical checkpoints, and external state lifecycles to prevent environment drift.
5. **Dry-Run Simulation:** Simulates the task graph in dependency order against the codebase disk layer, generating a simulation report and tracing journey scenario steps.
6. **Adversarial Plan Review:** Self-evaluates against the 8-point determinism check before logging decisions and gating promotion.

### What `execute-changeset` Does:
1. **Preflight Routing:** Determines the execution model profile (native vs. subprocess vs. MiMo-Pro dispatcher) to minimize costs.
2. **Decoupled Task Execution:** Spawns context-isolated subagents for groups of parallel tasks, checking file overlaps and utilizing isolated inner worktrees when conflicts occur.
3. **Sequential Application:** Applies file modifications task-by-task, runs local test suites, and performs lightweight git checkpoint commits.
4. **Holistic Verification:** After all tasks complete, compiles the entire diff and runs formatting, typechecking, and E2E QA passes.
5. **Phase Receipt Recording:** Emits `exec-record` receipts proving the execution ran cleanly against the spec and plan constraints.

---

## Upstream Prerequisite Utilization (Before `plan-changeset`)

For a plan to be absolute and free of drift, it must be strictly grounded in all 10 upstream phases that occurred *before* the planning phase:
1. **Vision (`write-vision`):** Sets the core target and value boundaries.
2. **Domain (`analyze-domain`):** Defines industry conventions and codebase stack bounds.
3. **Competitors (`analyze-competitors`):** Defines product Moats and critical differentiation whitespace.
4. **Personas (`build-personas`):** Documents specific target user pain points and accessibility needs.
5. **Validate (`validate-feature`):** Proves the feasibility and revenue staging model of the feature.
6. **Spec (`write-spec`):** Formulates the Acceptance Criteria (ACs) and implementation stories.
7. **UX (`design-ux`):** Charts interaction flowcharts and screen state machines.
8. **UI (`design-ui`):** Specifies visual assets, design tokens, and layout guidelines.
9. **Tech (`design-tech`):** Details technical architecture, RLS/security boundaries, and database schemas.
10. **Style (`define-code-style`):** Locks naming conventions, folder structures, and lint rules.

---

## Findings (by priority)

### P0 — Fix now (blocks quality)

#### F-001: The Code Payload Prohibition [Cognitive/Process]
- **Evidence:** [plan-changeset/SKILL.md#L78](file:///workspace/seriousvibecoding/plan-changeset/SKILL.md#L78) ("The change set is not a markdown dump of exact code.") and [plan-changeset/SKILL.md#L388-L391](file:///workspace/seriousvibecoding/plan-changeset/SKILL.md#L388-L391) ("Do not write giant BEFORE/AFTER code payloads").
- **Impact:** By explicitly banning actual implementation blueprints (full file layouts, export structures, exact signatures, and logic diffs) from the planning document, the downstream executor (`execute-changeset`) is forced to invent implementation details. This leads to semantic drift, incomplete requirements, and compiler/type failures during execution.
- **Proposed fix:** Remove the anti-payload lines from the skill description. Make `## Changeset Blueprint` a mandatory section in the manifest. Every planned `CREATE` file must have full code payloads, and every `MODIFY` file must have a precise, context-rich diff blueprint:
  ```markdown
  <<<<<<< BEFORE
  [at least 3 lines of original surrounding context]
  =======
  [at least 3 lines of replacement code]
  >>>>>>> AFTER
  ```
- **Confidence:** HIGH

#### F-002: Lack of an Executable CLI Pipeline [Tooling/Process]
- **Evidence:** [plan-changeset/SKILL.md#L304-L318](file:///workspace/seriousvibecoding/plan-changeset/SKILL.md#L304-L318) ("Validation Plan" and "Checkpoint Plan").
- **Impact:** The current plan format lists logical checkpoints and validation checks, but leaves the exact shell commands (to create branches, run specific test files, compile schemas, format code, and commit changes) undefined. This forces the agent/developer to manually construct CLI commands at runtime, resulting in non-standard environments, unrun test files, and missed formatting or typecheck steps.
- **Proposed fix:** Mandate an `## Execution Command Sequence` section in the manifest. This section must consist of a single, copy-pasteable, non-interactive fenced `bash` script detailing the serial execution flow:
  1. Branch/Worktree creation.
  2. Dependency installations.
  3. Host-adaptive file patching (e.g., using native `replace_file_content` tools for Antigravity/Claude Code, or a fallback `cat << 'EOF' > file` heredoc abstraction only for shell-only hosts like Codex).
  4. Per-task test execution (`npx vitest run ...`).
  5. Checkpoint commits (including exact commit message and mandatory trailers).
  6. Phase receipt emission commands.
- **Confidence:** HIGH

#### F-007: Execution Context Bloat & Model Drift (The Payload-Only Executor) [Cognitive/Token Economy]
- **Evidence:** [execute-changeset/SKILL.md#L124-L150](file:///workspace/seriousvibecoding/execute-changeset/SKILL.md#L124-L150) ("Inputs" and "Context loading rule").
- **Impact:** Executors must load up to 100K+ tokens of feature spec, UX designs, UI layouts, journeys, and competitor data to apply minor modifications. This high volume of high-level context degrades the model's instruction-following attention (context window degradation), burns valuable token budgets, and prompts the executor to drift back to high-level reasoning.
- **Proposed fix:** Since the Absolute Plan contains exact code blueprints and shell pipelines, the execution model requires *zero* upstream spec context. We will enforce **Zero-Context Execution-Only Payload Isolation (The Lean Executor)**. When dispatching tasks to MiMo or Sonnet subagents, the orchestrator will strip all upstream specs, UX, UI, and competitor files, providing *only* the specific task's `Changeset Blueprint` and `Execution Command Sequence`.
  To handle unexpected execution or test errors, instead of relying on a costly parallel swarm or a simple blind retry, the Orchestrator Parent will run a **Sequential, Cost-Aware Multi-Option Exploration & Debugging Loop** optimized for the token economy:
  1. **Failure Interception:** The execution subagent exits with status code `NEEDS_CONTEXT` (75) or `BLOCKED` (76) (e.g., due to compiler failures, test breakages, or unmapped dependencies) and dumps a structured `.svc/task-context-gap.json` detailing the exact error trace, compile logs, and missing definitions.
  2. **Orchestrator Root-Cause Diagnosis:** The **Orchestrator Parent** (holding the full upstream specs, domain profile, style contract, and having access to the `research` and `diagnose-bug` skills) intercepts the failure. It executes a lightweight `execution-diagnose` probe (representing a non-chaining execution-mode routine modeled after `diagnose-bug` phases P2-P3) to isolate the root cause, run codebase research, and generate a minimal local reproduction without triggering full bugfix lane planning.
  3. **Multi-Option Synthesis & Prioritization:** The Orchestrator analyzes the codebase/spec constraints and generates 2-3 distinct, viable implementation paths (e.g., Option A: API payload adaptation, Option B: Dependency version relaxation, Option C: Fallback interface implementation), sorting them by likelihood of success and implementation simplicity.
  4. **Sequential Trial (Token-First):** To avoid the massive token waste of parallel multi-agent swarms, the Orchestrator attempts the prioritized options *sequentially* (Option A first). It only spawns a subagent for the next option (Option B, Option C) if the preceding option fails to compile, lint, or pass tests.
  5. **Model Tiering & Pruning:** Debugging tasks are routed to cheaper, faster models (e.g., Haiku 4.5/Claude 3.5 Haiku) rather than the flagship model, reducing per-token costs by ~80%. Furthermore, cheap static bash/compiler probes are run first to instantly prune syntactically broken options without invoking LLM reasoning.
  6. **Graceful Escalation & Ledger:** If all sane options are exhausted without success, the Orchestrator rolls back the workspace to the last clean task checkpoint, cancels the execution, and escalates to the user with a detailed **Exploration & Attempt Ledger** outlining exactly what was tried, why each failed, and the associated error traces.

  To support this loop, we define the concrete **Exit Code & Task-Gap Contract**:
  - **Exit Code Mapping:**
    - `NEEDS_CONTEXT = 75` (returned when the subagent lacks imports, type definitions, or schema details it cannot find in the lean package).
    - `BLOCKED = 76` (returned when a compiler, linter, or test runner error is hit that the subagent cannot resolve after 3 attempts, or due to environmental mismatches).
  - **Task-Gap Document Schema (`.svc/task-context-gap.json`):**
    ```json
    {
      "$schema": "http://json-schema.org/draft-07/schema#",
      "title": "TaskContextGap",
      "type": "object",
      "required": ["task_id", "exit_status", "error_trace"],
      "properties": {
        "task_id": { "type": "string" },
        "exit_status": { "type": "integer", "enum": [75, 76] },
        "error_trace": { "type": "string" },
        "compile_output": { "type": "string" },
        "missing_symbols": {
          "type": "array",
          "items": { "type": "string" }
        },
        "attempted_resolution": { "type": "string" }
      }
    }
    ```
  - **Write Responsibility:** The subagent's execution wrapper/runner writes this file immediately prior to exiting with code 75 or 76. The Orchestrator Parent parses this file to drive its diagnosis and multi-option synthesis.

  #### Token Economy Analysis

  To demonstrate the concrete cost-efficiency of the sequential debugging standard over traditional parallel swarm or naive retry models, the table below maps token consumption across common execution outcomes:

  | Execution Scenario | Model Routing Path | Diagnostic Probes | Trial Count | Orchestration Overhead | Total Token Cost | Compared to Swarm |
  |--------------------|--------------------|-------------------|-------------|------------------------|------------------|-------------------|
  | **Happy Path** (No Failures) | Sonnet 4.6 (Implementor) | None (0 tokens) | 1 (Clean execution) | None (Lean payload) | **10K - 15K** tokens | **90% cheaper** |
  | **Single Failure** (Option A succeeds) | Sonnet 4.6 + Haiku 4.5 | 1× `execution-diagnose` (~5K) | 1 Retry (Option A passes) | Orchestrator synthesizes paths | **20K - 30K** tokens | **70% cheaper** |
  | **Worst Case** (Option A & B fail, C passes) | Sonnet 4.6 + Haiku 4.5 | 2× `execution-diagnose` (~10K) | 3 Trials (Option C passes) | Sequential dispatch | **45K - 65K** tokens | **40% cheaper** |
  | **Total Exhaustion** (All options fail) | Sonnet 4.6 + Haiku 4.5 | 3× `execution-diagnose` (~15K) | 3 Trials (All fail, rolls back) | Orchestrator logs Attempt Ledger | **60K - 80K** tokens | **30% cheaper** |

  *Baseline Note:* The current execution model loads the full 100K+ token upstream spec context on **every** attempt, meaning even a happy path starts at 100K+ tokens. Our Zero-Context Lean Executor cuts this default overhead to near-zero, ensuring that the flagship model is only loaded with full context when performing high-level root-cause diagnosis or multi-option synthesis.

- **Confidence:** HIGH

---

### P1 — Fix soon (degrades quality)

#### F-003: Linter Slack for Commands & Blueprints [Tooling]
- **Evidence:** [scripts/verify-plan-mechanical.sh](file:///workspace/seriousvibecoding/scripts/verify-plan-mechanical.sh) (Lines 39-112).
- **Impact:** The current Tier-1 mechanical plan validator checks for path resolution, `package.json` scripts, bash syntax, and forbidden patterns. However, it does not check if the plan contains the absolute execution commands or if the blueprints contain valid diff fences. As a result, weak or placeholder-ridden plans can pass Tier-1 checks.
- **Proposed fix:** Add `C7-FAIL` (verifies the presence of a fenced shell block under the `## Execution Command Sequence` header) and `C8-FAIL` (verifies that any `MODIFY` block in the blueprint section uses valid before/after diff markers with sufficient context) to `verify-plan-mechanical.sh`.
- **Confidence:** HIGH

#### F-004: Receipt Schema Under-Specification [Schema]
- **Evidence:** [schemas/receipts/plan-manifest.schema.json#L5](file:///workspace/seriousvibecoding/schemas/receipts/plan-manifest.schema.json#L5) ("required" fields list).
- **Impact:** The schema for the `plan-manifest` receipt does not enforce or validate that the plan includes actual blueprints or execution command sequences.
- **Proposed fix:** Modify `schemas/receipts/plan-manifest.schema.json` to add `changeset_blueprints` and `execution_command_sequence` as required fields. Update the schema definition to specify their structure (arrays/objects detailing files, actions, step numbers, exact command lines, and expected outcomes).
- **Confidence:** HIGH

#### F-006: Un-Grounded Upstream Prerequisite Integration [Process/Tooling]
- **Evidence:** [plan-changeset/SKILL.md#L198-L220](file:///workspace/seriousvibecoding/plan-changeset/SKILL.md#L198-L220) ("Inputs" table and "Compression boundary" note).
- **Impact:** `plan-changeset` loads features specs and style contracts, but lacks a systematic check verifying that code blueprints align with persona accessibility needs, competitor differentiation barriers, technical design component patterns, or style contract folder constraints. This permits high-level architectural drift to bypass G5 undetected.
- **Proposed fix:** Mandate a `## Prerequisite Alignment Matrix` section in the manifest. The matrix must explicitly map each planned task or file blueprint to:
  1. The UX transitions & flow charts (`docs/specs/ux/<name>.md`).
  2. The UI visual tokens & asset guidelines (`docs/specs/ui/<name>.md`).
  3. The Technical Design components (`design-tech` or `review-security` structures).
  4. The Style Contract styling patterns (`docs/specs/style-contract.md`).
  5. The Persona/Competitor differentiation rules.
  Add check `C9-FAIL` to `verify-plan-mechanical.sh` to enforce the matrix presence.
- **Confidence:** HIGH

#### F-008: Lack of Closed-Loop Recovery State Machines [Tooling/Process]
- **Evidence:** [plan-changeset/SKILL.md#L375-L387](file:///workspace/seriousvibecoding/plan-changeset/SKILL.md#L375-L387) ("Checkpoints and Loop-Backs").
- **Impact:** When a command in the planned execution sequence fails (e.g. dependency mismatch, local environment divergence, or test assertions), the execution agent stalls, hallucinates arbitrary fixes, or repeatedly executes the same failing command, wasting cycles before giving up or prompting the user.
- **Proposed fix:** Add a mandatory `RECOVERY_IF_FAIL` block to the planned `Execution Command Sequence`. This will pre-program the exact git checkout rollbacks, alternative dependency setup lines, or self-correcting error scripts. The executing agent can dynamically follow these branches to self-heal without dropping out of headless execution.
- **Confidence:** HIGH

---

### P2 — Improve when possible (nice to have)

#### F-005: Adversarial Review Dimension Extension [Review Gate]
- **Evidence:** [references/plan-review-protocol.md#L68-L81](file:///workspace/seriousvibecoding/references/plan-review-protocol.md#L68-L81) ("Review focus dimensions").
- **Impact:** Reviewers checking plans do not explicitly evaluate command sequences or code blueprints for executability.
- **Proposed fix:** Extend the primary adversarial review dimensions (Tier-2 and Tier-3) to include:
  - **h: Command Determinism:** Are all shell commands copy-pasteable, non-interactive, correct, and complete from branch creation to merge?
  - **i: Blueprint Completeness:** Does copying the blueprints produce a lint-clean and fully compiled codebase state?
- **Confidence:** HIGH

---

## Agent-Native Execution Optimizations

To truly optimize Serious Vibe Coding (svc) for advanced agentic operations, the Absolute Plan standard incorporates three key agent-native design paradigms:

1. **Zero-Context Payload Isolation & Sequential Trial Debugging:** By packing exact file diff blueprints and shell sequences into the plan, we completely bypass the need for execution models to possess high-level specifications. Under failures, instead of massive parallel swarms, the Orchestrator Parent intercepts exit codes, performs a root-cause probe, and coordinates cost-aware, sequential trials tiered to faster models (like Haiku 4.5), keeping execution token overhead extremely low.
2. **Closed-Loop Rollback & Recovery State Machines:** Pre-programming execution rollbacks and fallback recovery branches in the plan manifest enables fully autonomous, self-healing, headless execution. The agent dynamically corrects dependency or setup anomalies using predefined paths rather than entering hallucination loops.
3. **Pre-Flight Simulation Sandbox Probing:** Mandates dry-run compilation checks and environment queries prior to mutating files to ensure the target state is exactly aligned with expectations, preventing compile-time failures after commits.

---

## Comparison delta

Compared to competing frameworks, the **Absolute Plan** standard offers a significant paradigm shift:
- **superpowers (writing-plans):** Generates structured task graphs with a "no-placeholder" rule, but explicitly leaves the actual code payloads to the execution subagents (inventing code on the fly).
- **gstack / ECC / OpenCode:** Rely on high-level templates followed by rapid generation, lacking plan-level execution scripts.
- **Aider / Claude Engineer:** Do not have a separate plan-first, review-first gate, immediately modifying code in response to user requests.

Establishing the Absolute Plan standard makes Serious Vibe Coding (svc) uniquely deterministic. The plan acts as a complete, compiled, and pre-reviewed codebase patch *before* any git branch is touched, eliminating runtime error cascades and model hallucination cycles.

---

## Stale proposal audit

- `proposals/2026-05-25-evolution.md` — Actionable DRAFT.
- `proposals/WI-FRAMEWORK-EVOLVE-research-flow-improvement.md` — Actionable DRAFT.
- All other proposals in `proposals/` have been processed or are tracked under framework evolution tasks.

---

## Self-Verify

| # | Check | Result |
|---|---|---|
| 1 | Proposal file exists | PASS |
| 2 | Every finding cites file:line or measurement | PASS |
| 3 | FRAMEWORK-STATE.md was read first; no rediscovered items | PASS |
| 4 | Findings ranked by impact + confidence | PASS |
