# Deep Dive: Testing Agent Skills Systematically

## Mechanism: The Agent Skill Eval Loop
An agent skill is functionally an organized collection of prompts, tools, and instructions. Evaluating it requires a structured approach akin to end-to-end (E2E) testing. The fundamental loop is:
**Prompt** → **Captured Run** (Execution trace + Generated Artifacts) → **Set of Checks** (Deterministic + Qualitative) → **Score**.

### 1. Defining Success (The Four Pillars)
Before evaluating, success criteria must be split into four distinct, measurable categories:
1.  **Outcome Goals:** The final state. Did the app build? Are the tests passing?
2.  **Process Goals:** The journey. Did the agent explicitly invoke the target skill? Did it run `npm install` before trying to build?
3.  **Style Goals:** The conventions. Did the generated code follow the project's specific style guide?
4.  **Efficiency Goals:** The cost. Did the agent execute loops or repeat commands (thrashing)? Did it stay within the token budget?

### 2. Prompting Strategy for Evaluation
A robust evaluation dataset requires 10-20 targeted prompts per skill, classified by intent:
*   **Explicit Invocation:** "Use the `research` skill to find X." (Tests baseline functionality).
*   **Implicit Invocation:** "Find out how X works." (Tests the agent's routing ability to select the skill).
*   **Contextual Noise:** "I'm working on the auth system, by the way, find out how X works." (Tests robustness against distraction).
*   **Negative Control:** "Please do not search the web, just guess how X works." (Crucial for testing false positives; the skill should *not* trigger).

### 3. Execution & Validation Tooling
*   **Deterministic Checking:** Harnesses (like Codex CLI or SVC) should expose structured logs (e.g., JSONL traces via `--json`). This allows scripts to definitively check if `run_shell_command("npm test")` was executed.
*   **Qualitative Checking:** Validating "good code style" deterministically is fragile. Instead, orchestrate a secondary LLM call. Pass the artifact to the secondary LLM along with a grading rubric and an `--output-schema` (JSON Schema) to force a structured JSON output (e.g., `{"overall_pass": true, "score": 8}`).

### 4. Advanced Metrics: Pass@k vs. Pass^k & Thrashing
As agent capabilities evolve, binary pass/fail is insufficient for characterizing reliability. The industry standard utilizes:
*   **Pass@k (Capability Discovery):** The probability an agent succeeds *at least once* in $k$ attempts. Used to evaluate raw reasoning potential.
*   **Pass^k (Production Reliability):** The probability an agent succeeds *every single time* across $k$ attempts. A 75% per-trial success rate means an agent has only a ~42% chance of succeeding 3 consecutive times, emphasizing the fragility of single-pass evaluation.
*   **Thrashing Identification:** Tracking metrics like *repetition count* (calling the same tool with the exact same parameters), *context-induced amnesia* (re-reading files because context compaction dropped them), and *environment contention* (e.g., repeatedly failing against an apt/dpkg lock without waiting).

## Analysis
Evaluating agent skills systematically is the only way to prevent regressions. As the agentic ecosystem shifts toward massive Parallel Swarms and long-horizon tasks, relying on single-pass "vibes" is a failure mode. The ability to definitively prove a skill's reliability through deterministic JSONL tracing, rigorous negative control prompting (to prevent "skill inflation"), and evaluating for Pass^k reliability rather than Pass@k capability is foundational. It transforms "prompt engineering" into rigorous software engineering. 

## L4 Pointers
- Source: OpenAI Developer Blog ("Testing Agent Skills Systematically with Evals", Jan 2026).
- Framework integration points: SVC's `evaluate-rule` and `test-framework` skills heavily overlap with this doctrine.