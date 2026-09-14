# Kimi CLI Advanced Features

Kimi Code CLI includes several advanced systems for context control, performance optimization, and autonomous refinement.

## 1. Denwa Renji & D-Mail (Context Reversibility)
Named after *Steins;Gate*, this system allows the agent to intentionally revert its context to a previous state ("world-line") to correct mistakes or explore alternative solutions.

- **`DenwaRenji`**: The core controller that manages context checkpoints.
- **`SendDMail` Tool**: Allows the AI to send a "D-Mail" (Digital Mail) back to a specific `checkpoint_id`.
- **Mechanism**: When a D-Mail is sent, the `KimiSoul` catches a `BackToTheFuture` exception, restores the context to the selected checkpoint, and appends the D-Mail message as a user prompt to guide the "new" timeline.
- **Status**: Currently supports context reversal; future plans include filesystem state restoration.

## 2. kagent Sidecar (Rust Kernel)
To improve performance while maintaining the existing Python UI and extensibility, Kimi CLI supports a **Rust-based kernel** called `kagent`.

- **Architecture**: `kagent` acts as a sidecar process communicating over the **stdio Wire protocol**.
- **`WireBackedSoul`**: A Python proxy that manages the `kagent` lifecycle, forwarding events and requests (approvals, tool calls) to the Python UI or ACP server.
- **Fallback**: If the Rust kernel fails to start or crashes, the system can automatically fall back to the native Python `KimiSoul`.
- **Platform Support**: Distributed as a platform-specific binary within the Python wheel.

## 3. Ralph Mode (Iterative Refinement)
Enabled via `--max-ralph-iterations`, this mode converts a single user prompt into an autonomous loop.

- **Logic**: It automatically wraps the prompt in an **Agent Flow** that cycles through implementation and self-decision (CONTINUE or STOP).
- **Termination**: Ends either when the agent explicitly chooses to `STOP` or the iteration limit is reached.

## 4. Heroes Planet (Persistent Plans)
The "Heroes" naming convention provides a human-readable way to manage persistent session artifacts.

- **Slugs**: Uses a list of Marvel and DC hero names to generate multi-part slugs (e.g., `thor-batman-nebula`).
- **Storage**: Plans are persisted in `~/.kimi/plans/`, allowing the agent to "Enter" a previous plan and resume research effortlessly.
- **Uniqueness**: If collisions occur, it appends a short session ID fragment to ensure file uniqueness.
