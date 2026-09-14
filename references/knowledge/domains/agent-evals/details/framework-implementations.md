# Deep Dive: Agent Eval Framework Implementations

## Mechanism: Trajectory Evaluation & Harness Engineering
Modern agent evaluation frameworks have shifted from evaluating the *final answer* to evaluating the *trajectory* (the sequence of steps and tool calls) that led to that answer. This requires specific infrastructure to capture and grade non-deterministic execution paths.

### 1. Harness Engineering (The Scaffold)
A major finding in 2026 benchmark analysis (e.g., SWE-bench) is that the "harness" (the scaffold surrounding the agent) often matters more than the underlying LLM. For instance, the same model can jump from a 2% to a 12% success rate simply by improving the harness.
- **Isolation:** A robust custom harness (like those used in SWE-bench) provides a clean, sandboxed Docker environment for *every single trial* to prevent state leakage between runs.
- **Deterministic Gating:** High-performing harnesses use deterministic "linters" that physically block an agent from submitting a final patch if it violates structural rules (e.g., "every API change must have a corresponding test file").

### 2. Promptfoo: Local, Deterministic Trajectory Evals
Promptfoo is the industry standard for CLI-first, local regression testing in CI/CD pipelines. It treats agent evaluation like traditional software testing.
- **OTLP Integration:** Promptfoo acts as an OpenTelemetry (OTLP) receiver. Agents instrument their tool calls to send spans, which Promptfoo ingests.
- **YAML Assertions:** It allows developers to define strict "Golden Paths" via declarative YAML. You can explicitly assert `trajectory:tool-used` or `trajectory:tool-sequence` to ensure the agent called `get_order_status` *before* `format_response`, and to enforce that prohibited tools were never invoked.

### 3. LangSmith: Visual Trajectory Debugging
LangSmith (by LangChain) utilizes a "Dataset + Evaluator" model, excelling at visual debugging for complex "trees of thought."
- **Trace Matching:** Using the `AgentEvals` package, it can compare an agent's `intermediate_steps` against a ground-truth trajectory defined in a dataset.
- **LLM-as-a-Judge:** It provides pre-built `TrajectoryEvalChain` evaluators to use an LLM to critique the agent's path dynamically when deterministic assertions are too brittle.

### 4. Braintrust: Trace-Driven Insights & Inline Scoring
Braintrust focuses on turning benchmarks into continuous integration workflows via Trace Analysis.
- **Inline Scorers:** Braintrust captures full traces of every tool call. Developers write "inline scorers" that trigger *only* when a specific tool is used in the trace (e.g., a scorer evaluating if the `sql_query` tool was used safely).
- **Regression Gates:** Braintrust versions "Golden Datasets". Every PR triggers an eval; if the aggregated `Pass@k` or `Pass^k` score drops below the established baseline, the CI build is blocked.

## Analysis
To be a true Subject Matter Expert (SME) in agentic software engineering, an agent must evaluate itself and its peers using Trajectory Evaluation. Relying solely on final-output grading obscures critical inefficiencies (like thrashing or unsafe tool usage). Integrating OpenTelemetry (OTLP) tracing to capture tool spans, and enforcing CI-gated deterministic assertions (like Promptfoo) is the gold standard for reliable, production-grade agent deployment.

## L4 Pointers
- Source: Promptfoo Trajectory Evaluation Documentation, LangSmith AgentEvals, Braintrust Trace Analysis (April 2026).
- Framework integration points: SVC's `audit-session-execution` and `test-framework` skills should adopt OTLP span analysis for CI regression testing.