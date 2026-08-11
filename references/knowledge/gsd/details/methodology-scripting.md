# Deep Drills: The Final GSD Methodology & Scripting Layers

This final document in the deep drill series extracts the last 10 "hidden" layers of GSD intelligence. This covers its story-splitting methodology, specialized thinking models, and maintenance scripts. This brings our total count to **85 mapped mechanics**.

---

## 1. SPIDR Story Splitting Rules (`references/spidr-splitting.md`)

**The Mechanic:** A structured methodology for breaking down "too large" user stories into manageable phases.
**The Five Axes:**
1. **Spike:** If an unknown exists, split out a research phase.
2. **Paths:** Split happy path first, then edge cases.
3. **Interfaces:** Split by platform (Web first, API next, Mobile last).
4. **Data:** Split by scope (one user, one team, large dataset).
5. **Rules:** Split by rule complexity (basic validation first, then complex policy).
**The Workflow:** If a story names >2 capabilities, >1 actor, or is >120 chars, the framework *forces* the user into a SPIDR axis selection.

## 2. Thinking Models: Execution Cluster (`references/thinking-models-execution.md`)

**The Mechanic:** Decision-making filters for the executor agent.
**Key Models:**
- **Circle of Control:** Prohibits modifying any code not listed in the plan's `<files>` section. "While I'm here" fixes are strictly banned.
- **Chesterton's Fence:** Prohibits removing code without forståing its original `git blame` or purpose.
- **Forcing Function:** Resolves ambiguity at build-time (e.g., using `never` types) rather than runtime.

## 3. Thinking Models: Debug Cluster (`references/thinking-models-debug.md`)

**The Mechanic:** Systematic root-cause analysis.
**Key Models:**
- **Fault Tree Analysis:** Start with the symptom, branch into all possible causes (AND/OR gates). This tree is the investigation roadmap.
- **Hypothesis-Driven (PREDICT/TEST):** Prohibits making random changes. The agent must predict the result *before* running the test.
- **Counterfactual Thinking:** "If I change ONLY this one variable, the bug should disappear."

## 4. Thinking Models: Verification Cluster (`references/thinking-models-verification.md`)

**The Mechanic:** Failure-first auditing.
**Key Models:**
- **Inversion:** Instead of checking if it's right, list 3 specific ways it could be WRONG (e.g., silent data loss).
- **Planning Fallacy Calibration:** If a task touches >2 files or modifies shared infra, it is automatically re-classified as "Large" regardless of the AI's estimate.

## 5. Artifact Taxonomy Lifecycle (`references/artifact-types.md`)

**The Mechanic:** Defines exactly which artifacts are "inert" vs "active."
**The Rule:**
An artifact only has meaning if a workflow *consumes* it. For example, `ROADMAP.md` is active because it drives the `plan-phase` orchestrator. `DISCUSSION-LOG.md` is inert because it is for human review only. This prevents the agent from writing dead-weight files.

## 6. Doc Conflict Engine (`references/doc-conflict-engine.md`)

**The Mechanic:** A standardized safety gate for merging external knowledge into `.planning/`.
**The Logic:**
It uses a 3-bucket severity model:
- **[BLOCKER]**: Contradicts a locked decision. Exits immediately with code 1.
- **[WARNING]**: Overlaps with existing context. Requires explicit `yes/no` user approval.
- **[INFO]**: New information only.
It strictly prohibits using markdown tables for reports, enforcing a plain-text format for maximum LLM parsing reliability.

## 7. Smart Discuss (Autonomous Mode) (`references/autonomous-smart-discuss.md`)

**The Mechanic:** High-throughput gray-area resolution for headless sessions.
**The Workflow:** 
Instead of a slow back-and-forth chat, the agent generates a batched "Grey Area Table" (Questions | Recommended | Alternatives). The user accepts/changes the batch in one shot. It also includes "Infrastructure Detection" to skip discussion entirely if the phase is purely technical (e.g., a "migration" phase).

## 8. Shipped-Path Cherry-Pick Filter (`scripts/diff-touches-shipped-paths.cjs`)

**The Mechanic:** A script used during hotfixes to decide if a commit actually changes the NPM package.
**The Logic:**
It reads the `package.json` `files` array and treats each entry as a prefix. It then compares the `git diff-tree` of the hotfix commit. If the commit only touches `tests/` or `docs/` (not in the `files` prefix list), the commit is automatically skipped, preventing unnecessary hotfix releases.

## 9. Prose Token Stripping (`scripts/strip-prose-atrefs.cjs`)

**The Mechanic:** A performance optimizer that scrubs redundant file paths from instructions.
**The Logic:**
Paths declared in `<execution_context>` are already loaded into memory. This script uses regex to strip redundant prose references (e.g., "Follow the workflow from @path/to/file") in `<process>` blocks, saving ~900 tokens per invocation by removing dead-weight "path tokens" that the AI already knows.

## 10. Traceability Table Extraction (`bin/lib/gap-checker.cjs`)

**The Mechanic:** Robust requirement parsing from markdown.
**The Logic:**
Uses a prefix-agnostic `ID_PATTERN = '[A-Z][A-Z0-9]*-[A-Za-z0-9_-]+'` to extract any requirement-like string (REQ-01, TST-07). It scans both checkbox lists and tables, explicitly skipping separator rows (`|---|`) to ensure that traceability mapping remains 100% accurate even in messy markdown files.
