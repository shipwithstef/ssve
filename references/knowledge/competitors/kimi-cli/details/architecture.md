# Kimi CLI Architecture (Deep Dive)

Kimi Code CLI is built with a highly modular, decoupled architecture designed for performance, extensibility, and robustness.

## 1. Monorepo Primitives

The codebase is organized into several internal packages that provide the core primitives:

### `kaos` (Backend Abstraction)
Provides a unified interface for filesystem and process operations.
- **`local.py`**: Standard local filesystem operations.
- **`path.py`**: A cross-platform path abstraction (`KaosPath`) and metadata system.
- **`ssh.py`**: Native support for **Remote SSH Backends**, allowing the agent to operate on remote servers as if they were local.

### `kosong` (Agent Loop Primitives)
The core "Agent logic" package.
- **`chat_provider`**: Abstraction layer for LLM providers (supporting various backends).
- **`message.py`**: Defines the data structures for conversation history, tool calls, and content parts (Text, Think, Image, Audio, Video).
- **`tooling`**: Provides the base classes (`CallableTool2`, `ToolResult`) for defining agent capabilities.

## 2. The Multi-Kernel Strategy (`kagent`)

To achieve maximum performance while maintaining the rich Python UI, Kimi CLI implements a sidecar architecture.

- **Python Kernel (`KimiSoul`)**: The original implementation, ideal for development and plugin/skill prototyping.
- **Rust Kernel (`kagent`)**: A highly optimized kernel implemented in Rust.
- **`WireBackedSoul`**: A Python proxy that launches `kagent` and bridges JSON-RPC stdio communication to the Python UI and ACP servers.
- **Fallback Logic**: The system can automatically detect kernel failures and revert to the Python implementation.

## 3. Denwa Renji (Context Reversibility)

Inspired by *Steins;Gate*, the "Denwa Renji" (Phone Microwave) system provides the agent with "time travel" capabilities over its own context history.

- **Checkpoints**: The system automatically snapshots the conversation state at every turn.
- **D-Mail**: A specialized message that triggers a jump to a previous `checkpoint_id`.
- **`BackToTheFuture`**: An internal exception used to unwind the execution loop and resume from a previous state.

## 4. Context Compaction

To handle long-running sessions that exceed the LLM's token limit:
- **Trigger**: Activated when context usage exceeds a `trigger_ratio`.
- **Strategy**: Summaries or removes older turns while preserving essential "Plan" context and recent interactions.
- **Denwa Renji Awareness**: Compaction must respect checkpoints to avoid breaking the reversibility of recent history.
