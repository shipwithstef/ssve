# Framework Improvement: Cognitive Model Routing Taxonomy

**Status:** IMPLEMENTED (2026-04-19) — references/model-routing.md authored with 6-label taxonomy; skill annotations landed on plan-changeset, execute-changeset, review-gate, research, diagnose-bug, explore-solutions.

## Evidence
- **Source:** Architectural analysis of Claude 4.7 Opus token costs vs. Xiaomi MiMo V2 agentic execution capabilities (2026-04-19).
- **Finding:** The framework's previous model routing relied on a basic Haiku/Sonnet/Opus split. Using Opus 4.7 for mechanical execution loops (`execute-changeset`) causes extreme token burn and context rot. Using pure execution models for planning (`plan-changeset`) results in linear, fragile task graphs. Furthermore, video/audio QA and live dependency checks lack dedicated sensory/discovery models.
- **Severity:** high

## Diagnosis
- **Root cause:** Lack of a formalized "Architect vs. Builder" cognitive taxonomy. The framework assumes any capable model can or should perform any task, rather than separating Cognitive Load (Architecture) from Mechanical Execution (Bash/Typing) and Sensory QA (Video/Audio).
- **Category:** architecture / context-optimization
- **Already in FRAMEWORK-STATE.md?** no (new capability mapping)

## Implementation Plan
- **Route:** documentation (update references and framework state)

### 1. Formalize the Cognitive Routing Matrix
- **Action**: Create/Update `references/model-routing.md`.
- **Logic**: Define 6 explicit Cognitive Labels:
  1. `[STRAT-OPUS]` for Strategy/Product (Opus 4.7)
  2. `[PLAN-OPUS]` for strict dependency Blueprinting (Opus 4.7)
  3. `[EXEC-MIMO]` for Agentic Execution (MiMo-V2-Pro)
  4. `[REVIEW-SONNET]` for strict compliance Verification (Sonnet 4.6)
  5. `[SENSE-OMNI]` for Temporal/Sensory QA (MiMo-V2-Omni)
  6. `[DISC-SEARCH]` for Grounded Discovery (Web Search Plugin)

### 2. Remap Skill Assignments
- **Action**: Update routing recommendations across core skills.
- **Logic**: Explicitly route `plan-changeset` to Opus 4.7 to guarantee flawless task graphs. Explicitly route `execute-changeset` to MiMo-V2-Pro for high-speed terminal execution. Explicitly assign `review-gate` to Sonnet 4.6, as it only needs to verify against the strict Opus blueprint, saving costs.

### 3. Enable Native Web Search
- **Action**: Update capability recommendations.
- **Logic**: Enforce the use of the native `web_search` plugin for `research`, `diagnose-bug`, and `explore-solutions` to prevent dependency version hallucinations without requiring expensive scraper sub-agents.

## Replay Verification
- **Replay target**: Standard feature lane execution (e.g., `WI-008`).
- **Goal**: Verify that planning costs are isolated to Opus, execution iterations run rapidly via MiMo without rate limits, and sonnet catches architectural drift.

## FRAMEWORK-STATE.md Mutations
- **Analysis History**: Added Cognitive Model Routing and Architect vs. Builder paradigm.
- **Decisions**: Execution tasks are explicitly decoupled from planning tasks at the model layer.
- **Capabilities**: Integrates Xiaomi MiMo-V2-Pro (Executor) and Omni (Sensory QA) into the authorized stack.