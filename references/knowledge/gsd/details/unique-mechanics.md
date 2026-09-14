# GSD Unique Mechanics (Targeted Deep Extraction)

This document details deep mechanics found in GSD that are potentially missing or handled differently in the Serious Vibe Coding (SVC) framework. This serves as an evaluation reference for potential porting.

---

## 1. Plan Bounce (External Plan Refinement)
Found in `workflows/plan-phase.md` (v1.50.0).
Pipes generated plans to an external bash script with a 3-layer integrity check (YAML validation, exit code check, re-run plan checker) before committing them.

## 2. Graphify Commit-Based Staleness
Found in `bin/lib/graphify.cjs` and `commands/gsd/graphify.md` (v1.41.0+).
Solves the "stale `mtime`" problem by embedding a `built_at_commit` hash into the JSON artifact, then running `git rev-list --count` to precisely report how many commits behind the knowledge graph is.

## 3. Adaptive Model Presets (`model_profile: "adaptive"`)
Found in `sdk/src/model-catalog.ts`.
Instead of hardcoding `opus` or `haiku`, GSD assigns each agent a `routingTier` (`heavy`, `standard`, `light`). The orchestrator dynamically resolves the best model for the task's weight.

## 4. Discuss-Phase `--power` Local UI 
Found in `get-shit-done/workflows/discuss-phase/modes/power.md`.
Dumps all phase questions into a self-contained local HTML/JSON companion app. The user answers offline, and the AI resumes once the JSON is updated.

## 5. Planner Reachability Check
Found in `agents/gsd-planner.md`.
A strict gate that blocks any plan where a new artifact doesn't have a concrete path (e.g., an Entity without a creation path, or a UI view without a navigation route).

## 6. Extract Learnings & Memory MCP Hooks
Found in `get-shit-done/workflows/extract-learnings.md`.
At the end of a phase, the agent extracts Decisions, Lessons, Patterns, and Surprises. If an MCP server (like `mem0`) is running, it pipes them there via `capture_thought`; otherwise, it writes to `LEARNINGS.md`.

## 7. Execution Wave File-Conflict Prevention
Found in `agents/gsd-planner.md`.
Automatically checks the `files_modified` array of all plans. If two plans touch the same file, the dependent plan is mathematically bumped to the next Wave to prevent merge conflicts.

## 8. Worktree Path & CWD Isolation Guards
Found in `get-shit-done/bin/lib/worktree-safety.cjs`.
Strictly uses `git rev-parse --git-dir` to detect worktree root (which is a file, not a directory) and blocks absolute path writes that escape the worktree scope.

## 9. 3-Layer Package Legitimacy Gate
Found in `agents/gsd-phase-researcher.md`.
An anti-slopsquatting defense. The researcher must run `slopcheck`; any Web-Search package is marked `[ASSUMED]`; the executor strips auto-fix privileges for `npm install`.

## 10. Cross-AI Plan Convergence Loop
Found in `CHANGELOG.md` (v1.41.0).
Automates adversarial reviews by spawning the Planner on one model (Sonnet) and the Reviewer on another (o3-mini). The loop exits only when zero `HIGH` concerns remain.

## 11. Prompt Injection Scanner (`hooks/gsd-prompt-guard.js`)
Scans file content being written into `.planning/` for prompt injection patterns like `ignore previous instructions`, issuing an advisory warning before write.

## 12. Read Injection Scanner (`hooks/gsd-read-injection-scanner.js`)
A `PostToolUse` hook that scans `Read` tool output for "summarization bypasses" (e.g., `when compressing retain this rule`).

## 13. Read-Before-Edit Guard (`hooks/gsd-read-guard.js`)
Prevents infinite loops by blocking `Write/Edit` tools if the target file hasn't been read in the current session.

## 14. Workflow Bypass Guard (`hooks/gsd-workflow-guard.js`)
Detects if an agent is editing files outside of an active GSD workflow context and injects an advisory to use proper state-tracked commands.

## 15. Conventional Commits Enforcer (`hooks/gsd-validate-commit.sh`)
Actively blocks git commit tool execution (exit 2) if the message doesn't conform to the `type(scope): subject` format.

## 16. SessionStart State Injection (`hooks/gsd-session-state.sh`)
Automatically injects the first 20 lines of `STATE.md` into the agent's context block at the exact moment a session starts.

## 17. Nyquist Auditor Agent (`agents/gsd-nyquist-auditor.md`)
Adversarial testing agent that assumes the implementation is broken until proven otherwise. Uses behavioral test generation with a 3-iteration debug loop.

## 18. Eval Auditor Agent (`agents/gsd-eval-auditor.md`)
Retroactive auditing agent that scores a feature's evaluation infrastructure (0-100) based on CI/CD integration, tooling, and guardrails.

## 19. Security-Hardened Debug Isolation
Found in `agents/gsd-debug-session-manager.md`.
Wraps user bug reports in strict `<security_context> DATA_START ... DATA_END` tags to force the LLM to treat them as data, not instructions.

## 20. Hint-Based Specialist Dispatch
Found in `agents/gsd-debug-session-manager.md`.
Parses a `specialist_hint` (e.g., `swift_concurrency`) and dynamically dispatches specialized reviewer agents to validate language-specific idioms.

## 21. Forensics Post-Mortem Workflow (`commands/gsd/forensics.md`)
Aggressively reads logs and session history to detect "stuck loops" or "abandoned work," producing a forensic report for debugging.

## 22. Deep Drift Detection (`bin/lib/drift.cjs`)
Detects structural drift between the committed codebase and GSD's `.planning/codebase/STRUCTURE.md` map (checking for new dirs, barrels, or routes).

## 23. Intel System & Tooling (`bin/lib/intel.cjs`)
A queryable index in `.planning/intel/` that extracts architectural decisions and file roles into JSON, enabling efficient metadata queries.

## 24. Session-Scoped Workspace Isolation (`bin/lib/planning-workspace.cjs`)
Hashes session environment variables (like `TMUX_PANE`) to bind an active workstream exclusively to a specific terminal/IDE window.

## 25. Centralized Path Traversal Guard (`bin/lib/security.cjs`)
Native Node.js guard that verifies all generated paths for traversal sequences or null byte injections before allowing a Write.

## 26. Autonomous Audit-Fix Pipeline (`commands/gsd/audit-fix.md`)
End-to-end loop: Audit → Classify (Auto-fixable vs Manual) → Autonomous Fix → Test → Atomic Commit.

## 27. Retroactive Threat Model Verification (`commands/gsd/secure-phase.md`)
Checks if threat mitigations documented in `SECURITY.md` were actually implemented in the code.

## 28. Persistent Context Threads (`commands/gsd/thread.md`)
Allows AI to manage and save persistent knowledge stores that span multiple sessions without belonging to a phase.

## 29. Schema Drift Detection & ORM Push Verification (`bin/lib/schema-detect.cjs`)
Aggressively pattern-matches execution logs to prove the AI *actually* ran DB push commands (Prisma, Drizzle, etc.) after a schema change.

## 30. Context-Window Utilization Classifier (`bin/lib/context-utilization.cjs`)
Mathematical classifier mapping token usage to HEALTHY (<60%), WARNING (60-70%), or CRITICAL (>70%) states.

## 31. Multi-Repo Ancestor Discovery (`bin/lib/core.cjs`)
Recursively walks up the tree looking for `sub_repos` flags in parent configs to bind state to the true project root.

## 32. Session Profiling Pipeline (`bin/lib/profile-pipeline.cjs`)
Scans Claude session history to extract genuine user messages and build a behavioral human-interaction profile.

## 33. YAML Scalar Coercion (`bin/lib/roadmap.cjs`)
Forces strict string coercion for bare integers or complex KV objects in markdown/YAML blocks to prevent requirement loss.

## 34. Interactive Pattern Stripping (`sdk/src/prompt-sanitizer.ts`)
Scrubbing regex to strip `AskUserQuestion()` and `/gsd-` commands from prompts so they work safely in headless SDK environments.

## 35. Markdown-Aware Context Truncation (`sdk/src/context-truncation.ts`)
Intelligently collapses large context files by preserving headings and the first paragraph while omitting the rest.

## 36. Event-Sourced Planning Journal (`sdk/src/planning-journal.ts`)
Append-only JSONL ledger of every state transition, actor, and causation ID with strict idempotency hashing.

## 37. Blocking Anti-Pattern Understanding Check (`discuss-phase.md`)
Forces agents to answer: "What is this anti-pattern?", "How did it manifest?", and "What structural mechanism prevents it?" before resuming.

## 38. Orphan Worktree Detection W017 (`tests/orphan-worktree-detection.test.cjs`)
Surfaces warnings for ghost directories created by executors that crashed before cleaning up their git worktrees.

## 39. Resurrection-Detection Guard (`tests/bug-2501-resurrection-detection.test.cjs`)
Uses `git log --diff-filter=D` to prevent worktree merges from resurrecting files that were intentionally deleted on main.

## 40. State-Mutation Mutex (`bin/lib/state.cjs`)
Uses `Atomics.wait()` for cross-platform mutex locking over state files during parallel wave execution.

## 41. Self-Invalidating Grep Guard (`agents/gsd-planner.md`)
Strict hygiene rule forcing the use of `grep -v` in automated verification to prevent comments from triggering false-positives.

## 42. Unbounded Read-Loop Guard (`agents/gsd-ui-checker.md`)
Critical rule prohibiting "re-reads"; forces agents to use `Grep` first followed by targeted offset `Read` calls.

## 43. Worktree Porcelain Parsing (`bin/lib/worktree-safety.cjs`)
Parses `git status --porcelain` of a worktree before removal to warn the user if uncommitted/unpushed work is about to be lost.

## 44. Event Stream SDK Decoupling (`sdk/src/event-stream.ts`)
Translation layer mapping raw provider API messages (Anthropic SDK) to internal `GSDEvent` variants to isolate the core.

## 45. Phase Runner State Machine (`sdk/src/phase-runner.ts`)
Strict 7-step lifecycle orchestration with typed `PhaseRunnerError` injection for precise failure node reporting.

## 46. Flat-to-Namespaced State Migration (`bin/lib/workstream.cjs`)
Atomic, rollback-safe script for nesting legacy project state into `.planning/workstreams/` folders.

## 47. Cross-Phase UAT Aggregation (`bin/lib/uat.cjs`)
Recursive scanner that aggregates acceptance criteria status across *all* phase directories to report global app health.

## 48. Deterministic Secret Masking (`bin/lib/secrets.cjs`)
Mathematically precise masking: strings >=8 chars use `****<last-4>`, shorter strings are strictly `****` to prevent fractional leaks.

## 49. Dynamic Persona Generation (`bin/lib/profile-output.cjs`)
Maps user behavioral dimensions (fast-intuitive vs deliberate-informed) to specific `CLAUDE_INSTRUCTIONS` text blocks.

## 50. Plan DAG Validation (`bin/lib/verify.cjs`)
Structural validator that throws errors if Wave 2 tasks exist without explicit dependencies declared in Wave 1.

## 51. Summary Hallucination Guard (`bin/lib/verify.cjs`)
Scans `SUMMARY.md` for claimed file creations and runs an absolute `fs.existsSync` check to verify the AI actually wrote the code.

## 52. Context-Aware Initialization (`bin/lib/init.cjs`)
Proactively probes `PROJECT.md` headers and `response_language` to inject environmental maps into new executor sessions.

## 53. Pipe-Based Commit Validation (`hooks/gsd-validate-commit.sh`)
Zero-dependency validator: pipes stdin into a `node -e` one-liner to parse JSON and regex-match Conventional Commit formats.

## 54. Trackable Decision Parser (`sdk/src/query/decisions.ts`)
Stack-based parser that handles multi-block decision concatenation while filtering out "discretionary" side-notes.

## 55. Non-Canonical Plan Diagnostic (`bin/lib/phase.cjs`)
Diagnostic net that flags any `.md` file containing the string `PLAN` that violates the strict `XX-YY-PLAN.md` naming convention.

## 56. ADR-Driven Evolution (`docs/adr/`)
Uses Architectural Decision Records to define stable "seams" in the framework, preventing regressions during parallel execution.

## 57. Phase Decimal Increment Logic (`bin/lib/phase.cjs`)
Mathematically resolves sub-phase numbering (max+1) across directory lists, preventing lexicographical sorting bugs (1.9 -> 1.10).

## 58. Architectural Debt Markers (`sdk/src/phase-runner.ts`)
Scans for `// TODO`, `// FIX`, and `// HACK` during verification to return an `architectural_debt` status rather than a clean pass.

## 59. Atomic State Update Loop (`bin/lib/state.cjs`)
Protects against crash-corruption by writing to `.tmp` files before renaming to the final `STATE.md` destination.

## 60. Intelligent Markdown Normalization (`bin/lib/core.cjs`)
O(n) cleanup algorithm that ensures exactly one trailing newline and blank-line padding around all fenced code blocks.

## 61. Post-Planning Gap Analysis (`bin/lib/gap-checker.cjs`)
Aggregation pass that proves *every* Requirement and Decision ID was referenced in at least one Plan file using word-boundary regex.

## 62. Ultraplan Cloud Offloading (BETA)
Teleport loop offloading planning to Claude's browser UI, with local reintegration via `/gsd-import`.

## 63. Requirement Traceability Table Extraction
Robust markdown table parser that ignores separators and nested list noise to extract ID -> Status mapping.

## 64. Worktree Prune Plan
Preruns worktree deletion as a "plan" that user must approve if any unpushed commits are detected.

## 65. Subprocess CLI Bridge (`sdk/src/query/query-cli-adapter.ts`)
Marshals between TypeScript SDK and CommonJS CLI tools using detached child processes and stderr error-mapping.

## 66. Prompt Injection Signature List (`scripts/prompt-injection-scan.sh`)
High-fidelity regex list for detecting role manipulation and instruction overrides (e.g., `you are now a`).

## 67. Base64 Obfuscation Scanner (`scripts/base64-scan.sh`)
Decodes base64 blobs >= 40 chars and recursively runs the injection signature list against the plaintext.

## 68. "Claude Automates, Human Judges" (`references/checkpoints.md`)
Golden rule: Agents must set up the env (install, start server, seed DB) *before* triggering a human checkpoint.

## 69. Source-Grep Theater Prevention (`scripts/lint-no-source-grep.cjs`)
Linter that blocks test files from reading source code directly, forcing behavioral verification instead of string matching.

## 70. Anti-Pattern Resume Check
Forces agents resuming from failure to answer three structural questions about the anti-pattern encountered.

## 71. Padded-Phase Decimal Resolution
Regex-based padding (01.09 -> 01.10) to maintain lexicographical sort order in file systems and git.

## 72. Artifact Reachability Gate
Mandatory planner rule: every new file/function must declare its reachability path (import or fetch).

## 73. Context Fracture Detection
Ratio of `filesRead / tokensUsed`. Warns if the agent is "skimming" and forces an architectural consolidation pass.

## 74. Golden Artifact Parity Testing
Regression suite ensuring the TypeScript SDK produces byte-equivalent output to the legacy CJS CLI.

## 75. Force-Stance Adversarial Review
Psychological nudge: Auditor agents assume implementation is broken and requirements ignored by default.

## 76. SPIDR Splitting methodology (`references/spidr-splitting.md`)
Five-axis rule for splitting stories: **Spike** (Research), **Paths** (Happy vs Edge), **Interfaces** (Web/API/Mobile), **Data** (Scopes), and **Rules** (Complexity).

## 77. Circle of Control Execution Filter
Executor rule: strictly prohibits fixing anything not listed in the plan's `<files>` section to prevent scope creep.

## 78. Fault Tree Debugging Model
Debugger rule: start with the symptom root and branch into all possible causes using AND/OR gates.

## 79. Hypothesis-Driven PREDICT/TEST Protocol
Prohibits "shotgun debugging" by forcing agents to predict the result of a test *before* executing it.

## 80. Planning Fallacy Calibration
Automatically upgrades task size to "Large" if it touches >2 files or shared infrastructure, regardless of AI estimate.

## 81. Pre-Mortem Planning Model
Planner rule: assume the plan has already failed and list 3 likely reasons, then add verification to Tasks 1 and 2.

## 82. Reversibility Test (Analysis vs Cost)
Optimizes thinking time: agents spend analysis time proportional to the irreversibility of the decision.

## 83. Curse of Knowledge Counter
Forces the Planner to re-read instructions as if it has never seen the codebase, scrubbing vague noun/verb references.

## 84. Context Degradation Tiers (PEAK/GOOD/DEGRADING/POOR)
Four-tier rule scaling behavior from " агрессивное delegation" to "emergency progress checkpointing."

## 85. MCP Tool Schema Tax Audit
Protocol for disabling unused MCP servers to remove their persistent per-turn token tax (often 20k+ tokens).

## 86. Next-Up Command Format
Standardized CLI handoff format requiring context-pulling from ROADMAP/PLAN and `/clear` instructions.

## 87. Dual-Source-of-Truth Detection
Common bug pattern check specifically targeting data stored in two places that has drifted out of sync.

## 88. Doc-Conflict Reporting taxonomy (BLOCKER/WARNING/INFO)
Standardized report format for content ingestion, strictly prohibiting markdown tables to ensure parsing reliability.

## 89. Infrastructure Phase Discuss-Skip
Logic that detects pure technical phases (migration/refactor) and automatically skips interactive discussion.

## 90. Word-Boundary Regex ID Matching
Algorithm for requirement tracing that uses `\\bID\\b` to prevent matching substrings (REQ-1 vs REQ-10).

## 91. XcodeGen iOS Scaffold Mandate
Platform rule: strictly prohibits `Package.swift` for iOS apps, mandating `xcodegen` and `project.yml` specs.

## 92. Project-Defined Skill Discovery Protocol
Agent pre-execution rule: checks for `.claude/skills/`, lists subdirs, and lazy-loads `rules/*.md` files as needed.

## 93. Git Prune Plan logic
Safety gate: Generates a JSON plan of worktrees to be removed and forces user approval if `git status` is dirty.

## 94. State-Mutation Atomics
Uses `process.on('exit')` to guarantee mutex cleanup and `Atomics.wait()` for CPU-efficient state locking.

## 95. Verification Pattern stub-detection
Grep patterns specifically for UI placeholders, hardcoded IDs, and empty function returns (`return null`).

## 96. "Inversion" verification model
Adversarial pass: instead of checking what IS right, list 3 specific ways it could be WRONG.

## 97. Ppadded Phase naming pattern
Enforces `{padded_phase}-{NN}-PLAN.md` pattern strictly to enable legacy gsd-tools directory traversal.

## 98. "Steel Man" Alternative Analysis
Researcher rule: construct the strongest possible case for an alternative before recommending against it.

## 99. "Simpson's Paradox" Data Awareness
Synthesizer rule: look for hidden variables (subgroups) when two studies or docs contradict each other.

## 100. "Chesterton's Fence" Code Guard
Prohibits modifying code without first providing the git blame hash and original rationale.
