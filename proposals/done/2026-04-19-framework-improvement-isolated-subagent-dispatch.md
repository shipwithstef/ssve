# Framework Improvement: Isolated Subagent Dispatch & Explicit File Scoping Protocol

**Status:** IMPLEMENTED (2026-04-19) — `scripts/dispatch-worker.sh` shipped + `execute-changeset/SKILL.md` mandates its use. Commits: 6da7169, b8c6990, 4f7a68f, fcefe6d, 7ad69f4.

## Evidence
- **Source:** Cognitive Model Routing Taxonomy (2026-04-19) and testing of programmatic Claude execution (`claude -p`).
- **Finding:** The "Architect vs. Builder" paradigm requires Opus 4.7 to handle planning and MiMo-V2-Pro (or Sonnet 4.6) to handle execution. Using Claude Code's built-in `<tool>Agent</tool>` spawns an in-process subagent that forcibly inherits the parent's entire 100K-200K token conversation history, causing massive token waste and cost bloat before execution even begins. Furthermore, sending a zero-history worker to "execute changes" without explicit file boundaries forces the worker to waste tokens running `glob` or `grep` across the entire repository to find what needs changing.
- **Severity:** high (wastes $3-$6 per execution loop, breaks model decoupling, and causes unnecessary repo-scanning by un-scoped subagents).

## Diagnosis
- **Root cause:** The orchestrator lacks a programmatic, stateless transport to spawn executor subagents AND a mechanism to explicitly constrain their scope. The framework currently relies on in-process subagents that inherit context organically, but zero-context workers need explicit file constraints to avoid burning tokens on discovery.
- **Category:** architecture / subagent-orchestration
- **Already in FRAMEWORK-STATE.md?** no

## Implementation Plan
- **Route:** execute-changeset (script addition and skill update)

### 1. The Isolated Dispatch Wrapper
- **Action**: Create/Update `scripts/dispatch-worker.sh` (Implemented).
- **Logic**: A shell script that wraps `claude -p` (programmatic execution) and accepts dynamic model targeting via the `SVC_WORKER_MODEL` environment variable. It passes `SVC_SUBAGENT="1"` to bypass host UI task mirroring, creating a true, headless, zero-context worker. Crucially, it accepts `SVC_WORKER_SKILL` and injects a hardcoded prompt instructing the subagent: "CRITICAL FIRST STEP: You must locate and read the SKILL.md instructions for this skill. That file is the absolute source of truth." This guarantees the zero-context worker immediately aligns with the framework doctrine without needing the orchestrator to copy-paste the rules.

### 2. Explicit File Scoping (The Opus Constraint)
- **Action**: Update orchestrator skill instructions (`execute-changeset` & `diagnose-bug`).
- **Logic**: Instruct the Opus 4.7 orchestrator that it MUST extract the "touched files" from the `lane-tasks.json` blueprint and pass them explicitly to the worker script. 
- **Command Structure**:
  ```bash
  SVC_WORKER_SKILL="execute-changeset" SVC_WORKER_MODEL="xiaomi/mimo-v2-pro" bash scripts/dispatch-worker.sh "Execute Task 3. Target ONLY these files: src/app/auth.tsx, src/lib/utils.ts"
  ```
- **Why**: This guarantees that the MiMo-V2-Pro worker immediately reads the correct files and begins execution, completely bypassing the "discovery phase" (which Opus already completed during planning).

## Replay Verification
- **Replay target**: A full feature pipeline with iterative bash testing (e.g., `WI-008`).
- **Goal**: The Opus orchestrator reaches `plan-changeset` and successfully spawns the isolated subagent using `scripts/dispatch-worker.sh`, passing the specific file paths. The child process starts with 0 inherited context tokens, skips repository scanning, modifies only the targeted files, and exits. Opus is billed only for the orchestrator overhead.

## FRAMEWORK-STATE.md Mutations
- **Analysis History**: Added Isolated Subagent Dispatch protocol via stateless `claude -p` execution with Explicit File Scoping.
- **Decisions**: Orchestrators must use `scripts/dispatch-worker.sh` instead of the internal `Agent` tool to prevent context bloat. Orchestrators must explicitly declare file scopes to zero-history workers to prevent discovery token waste.
- **Capabilities**: Full end-to-end multi-model autonomy achieved with zero context-inheritance waste and perfectly constrained execution perimeters.