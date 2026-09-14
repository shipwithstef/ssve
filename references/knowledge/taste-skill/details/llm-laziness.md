# LLM Laziness & Truncation Research

Comprehensive summary of research findings from `taste-skill/research/laziness/`.

## 1. Root Causes of Laziness

### Cognitive Shortcuts (LazyBench)
- Models exhibit "cognitive shortcutting" when tasks seem straightforward or context is excessively long.
- This is a behavioral choice, not a memory failure.

### RLHF & Compute Economics
- **Stopping Pressure:** Aggressive calibration to preserve GPU compute resources.
- **Brevity Bias:** Alignment training rewards short, confident summaries over exhaustive analysis.
- **Dynamic Throttling:** Performance scaled back during peak demand.

### Training Data Bias
- **Placeholder Propagation:** Imitation of abbreviated code patterns from sources like Stack Overflow and GitHub (e.g., `// implement here`).
- **Tutorial Patterns:** Models treat truncated code as the "correct" professional response format.

### Seasonal Anomalies
- Models internalized seasonal work patterns (e.g., shorter outputs in December due to holiday data).
- Stating "It is May" in a prompt can measurably increase output length.

### Output Limits
- Asymmetry between massive input windows (2M tokens) and capped output limits (8K tokens) forces preemptive compression.

## 2. Remediation Strategies

### Architectural Patterns
- **Lazy-Loaded Skills:** Using YAML front-matter metadata for discovery while keeping full instructions in the body to save context.
- **Model Context Protocol (MCP):** Bidirectional connection to live data sources to reduce hallucination and truncation.
- **Chunked Task Execution:** Breaking complex tasks into sequential, component-based requests.

### Parameter Tuning
- **Deterministic Paths:** Low temperature (0.0 - 0.5) and low Top-p (0.0 - 0.6) for code generation.
- **Gemini Thinking Level:** Setting `thinking_level` to `medium` or `high` for complex analysis.

### Prompt Engineering Techniques
- **Psychological Framing:** Stakes-based language ("This is critical to my career") or financial incentives ("$200 tip") activate high-effort data distributions.
- **Explicit Syntax Binding:** Forbidding placeholders and requiring evidence blocks/mandatory tool execution.
- **XML Structuring:** Using tags like `<context>`, `<data>`, and `<tasks>` to reduce cognitive load.
- **Chain of Verification:** Forcing iterative self-correction loops.

## 3. Reference Prompts

The repository provides several "Full-Output Enforcement" templates:
- **General:** Forbids placeholders, abbreviations, and summaries.
- **Code:** Mandates production-ready, unabridged implementation of every function and import.
- **Continuation:** Provides specific instructions for resuming from token limit pauses without recaps or repetition.

## 4. Empirical Results (2025 Study)
- **Compliance:** No model natively satisfies all complex instructions; truncation is a deliberate choice.
- **Stimulus:** Combined psychological stimuli can improve overall performance by up to 115%.
- **Resilience:** Models are resilient to context degradation but fail due to instruction complexity exceeding effort thresholds.
