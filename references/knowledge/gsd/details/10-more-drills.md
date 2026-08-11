# Deep Drills: 10 More Advanced Implementations

This document continues the deep drill series, extracting 10 more highly specific architectural patterns and algorithms found in the core libraries of the GSD codebase (`sdk/src/` and `bin/lib/`).

---

## 1. Event Stream SDK Decoupling (`sdk/src/event-stream.ts`)

**The Architecture:** GSD relies on the underlying `@anthropic-ai/claude-agent-sdk`, but it refuses to leak those specific types into its own orchestrator logic.
**The Implementation (`mapSDKMessage`):**
It acts as a strict translation layer. It intercepts raw `SDKMessage` variants (like `SDKToolProgressMessage` or `SDKRateLimitEvent`) and maps them down to internal `GSDEvent` variants. This completely isolates the GSD framework from upstream API schema changes. If the underlying LLM provider updates their streaming format, GSD only has to update this one translation map.

## 2. Phase Runner State Machine (`sdk/src/phase-runner.ts`)

**The Architecture:** The entire end-to-end flow is managed by a strict state machine, not a loose script.
**The Implementation (`PhaseRunner.run`):**
It orchestrates the exact 7-step lifecycle: `discuss → research → plan → plan-check → execute → verify → advance`. 
It wraps the entire execution in a global try/catch block. If a failure occurs deep inside a sub-agent, it catches the raw error and wraps it in a typed `PhaseRunnerError`, permanently injecting the `phaseNumber` and `PhaseStepType` (e.g., `PhaseStepType.Discuss`) so the orchestrator knows exactly which node in the state machine failed.

## 3. Flat-to-Namespaced State Migration (`bin/lib/workstream.cjs`)

**The Architecture:** GSD supports moving from legacy "flat" `.planning/` directories to "namespaced" `.planning/workstreams/<name>/` directories without breaking existing state.
**The Implementation (`migrateToWorkstreams`):**
It employs an atomic, rollback-safe migration script. It identifies the 4 scope-specific artifacts (`ROADMAP.md`, `STATE.md`, `REQUIREMENTS.md`, and the `phases/` folder) and physically moves them into the new nested folder. Crucially, it leaves `PROJECT.md` and `config.json` at the root because they are "shared" across workstreams. If any `fs.renameSync` fails midway, it catches the error and moves the files back to their original locations.

## 4. Cross-Phase UAT Aggregation (`bin/lib/uat.cjs`)

**The Architecture:** Validating a single phase isn't enough; the framework must constantly verify that older phases haven't broken.
**The Implementation (`cmdAuditUat`):**
Rather than checking just the current phase, it recursively loops over *all* directories inside `.planning/phases/`. It reads the YAML frontmatter of every single `*-UAT.md` and `*-VERIFICATION.md` file in the project. It mathematically aggregates `total_files` and `total_items`, emitting a unified JSON status block containing the global health of the application.

## 5. Deterministic Secret Masking (`bin/lib/secrets.cjs`)

**The Architecture:** AI agents log a lot of data. You must prevent API keys from leaking into the terminal or `.jsonl` session files.
**The Implementation (`maskSecret`):**
GSD explicitly lists sensitive keys in a `SECRET_CONFIG_KEYS` set (e.g., `brave_search`, `firecrawl`).
When rendering config output, it checks if `isSecretKey` is true. If the secret is >= 8 characters, it returns `****<last-4>`. If it is less than 8 characters, it returns strictly `****`. This mathematically prevents "fractional leaking" where a 5-character secret might reveal 4 of its characters.

## 6. Dynamic Persona Generation (`bin/lib/profile-output.cjs`)

**The Architecture:** Instead of a static "You are an expert engineer" prompt, GSD dynamically generates its system prompts based on how the human developer behaves.
**The Implementation:**
It defines an 8-dimension `PROFILING_QUESTIONS` array. When a user completes the profiling step (or the AI parses their chat history), it maps their specific style (e.g., `fast-intuitive` vs `deliberate-informed`) directly to corresponding `CLAUDE_INSTRUCTIONS` text blocks. This compiles a custom persona file (`USER-PROFILE.md`) that fundamentally alters the AI's communication style.

## 7. Plan DAG Validation (`bin/lib/verify.cjs`)

**The Architecture:** The planner outputs an XML Directed Acyclic Graph (DAG) for execution tasks. If the graph is malformed, parallel execution will corrupt the repo.
**The Implementation (`cmdVerifyPlanStructure`):**
It parses the `<task>` blocks and issues hard errors if `<name>` or `<action>` tags are missing. Crucially, it validates the DAG constraint:
`if (fm.wave > 1 && (!fm.depends_on || fm.depends_on.length === 0))`
If a task is scheduled for Wave 2 but declares no dependencies from Wave 1, it throws a structural error, forcing the AI to fix the execution graph before it runs.

## 8. Summary Hallucination Guard (`bin/lib/verify.cjs`)

**The Architecture:** Agents frequently hallucinate that they created a file when they actually failed.
**The Implementation (`cmdVerifySummary`):**
It scans the AI's generated `SUMMARY.md` text for regex patterns like `Created: file.ts` or `` `file.js` ``. It then runs an absolute `fs.existsSync(path.join(cwd, file))` check. If the file the AI claims to have written isn't actually on the disk, it throws a "Missing files" error, forcing the AI to go back and actually write the code.

## 9. Context-Aware Initialization (`bin/lib/init.cjs`)

**The Architecture:** Spawning an executor requires deep environmental context, not just file paths.
**The Implementation (`cmdInitExecutePhase`):**
When spinning up an execution phase, the script actively probes the environment. It checks if `gsd-executor` is properly installed via `checkAgentsInstalled()`. It dynamically extracts the `project_title` from the headers of `PROJECT.md`, and it injects `response_language` into the runtime. This ensures the newly spawned AI agent boots with a flawless map of its environment and locale constraints.

## 10. Pipe-Based Commit Validation (`hooks/gsd-validate-commit.sh`)

**The Architecture:** Validating git commits via hooks often requires fragile dependencies like `jq`. 
**The Implementation:**
To avoid dependency issues, the bash pre-hook pipes standard input directly into a `node -e` one-liner. This allows Node.js to safely parse the JSON arguments payload and extract the `-m` (commit message) flag. It then runs a strict regex: `^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-z0-9_-]+\))?:\s.+`
If the AI tries to write a bad commit message, the hook exits with code `2`, blocking the execution instantly.