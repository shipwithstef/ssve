# Hermes Agent: Agentic Loop & Trajectories

## 1. Context Control Engine
Hermes Agent uses a pluggable `ContextEngine` system (`agent/context_engine.py`) to maintain long-horizon stability.

### The Compaction Cycle
- **Trigger**: The engine checks `should_compress()` after every turn. By default, this fires when usage exceeds the `threshold_percent` (usually 75%).
- **Mechanism**: The `compress()` method can use various strategies (summarization, DAG pruning, or standard message dropping).
- **Protection**: It uses `protect_first_n` and `protect_last_n` to ensure critical system prompts and the immediate recent history are never pruned.
- **Pre-flight Estimation**: Supports a rough token usage estimate (`should_compress_preflight`) to avoid costly API calls that might immediately fail due to context overflow.

### Pluggable Extensions
The system supports third-party engines (like LCM - Local Context Manager) placed in `plugins/context_engine/`. These can expose specialized tools to the agent, such as `lcm_grep` or `lcm_expand`.

## 2. Reasoning Trajectories
Detailed tracking of internal thought processes is a core primitive for fine-tuning Nous models.

### Thinking Tags
- **Cognitive Trace**: The agent uses `<REASONING_SCRATCHPAD>` tags internally, which are converted to standard `<think>` tags (`trajectory.py`) for compatibility with modern reasoning models (Hermes 3, DeepSeek).
- **Incomplete Handling**: Includes logic to detect and handle incomplete scratchpads (`has_incomplete_scratchpad`), preventing malformed tool payloads.

### Dataset Export
- **Trajectory Samples**: Successful conversations are appended to `trajectory_samples.jsonl` in ShareGPT format.
- **Failure Analysis**: Failed turns are captured in `failed_trajectories.jsonl` for offline regression analysis.
- **Model Metadata**: Every entry includes the specific model, timestamp, and completion status.

## 3. Tool Dispatch & Safety
- **Handler Pattern**: Similar to the SVC framework, tool results are returned as structured strings.
- **Error Classification**: Uses an `error_classifier.py` to distinguish between "retriable" errors (timeouts, rate limits) and "fatal" logic errors (bad arguments), triggering different agent responses.
- **Rate Guard**: Employs `nous_rate_guard.py` specifically for Nous Research API endpoints to prevent thrashing.
