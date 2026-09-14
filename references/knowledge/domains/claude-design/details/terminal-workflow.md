# Claude Design: Terminal-Native Workflow (Layer 3)

Absolute domain expertise on using Claude Design (Live Canvas) and Claude Code exclusively via the terminal/CLI, bypassing the "Desktop App" requirement.

## 1. CLI-Native Handoff Mechanism
Unlike the Desktop App's "Hand off" button, terminal users bridge visual intent using protocol-level tools.
- **`web_fetch` Ingestion**: Designers share the Live Canvas session URL. The CLI agent uses `web_fetch <url>` to retrieve the **Handoff Bundle** (JSON components, W3C tokens) directly into the session context.
- **Sub-Agent Delegation**: The terminal agent often spawns an `explore` sub-agent to fetch and parse the design URL while keeping the main orchestrator focused on implementation.
- **Manual Export (@)**: Users can export design tokens/JSON from `claude.ai/design` into the `.claude/handoff/` project folder and reference them via `@.claude/handoff/bundle.json`.

## 2. Visual Auditing in the Terminal
CLI-only users perform visual verification via native screenshot integration.
- **`screenshot` Tool**: The agent invokes a native capture tool (macOS `screencapture`, Linux `gnome-screenshot`, or WSL `wsl-screenshot-cli`).
- **Multimodal Feedback Loop**: The agent captures the current state of the local dev server (e.g., `localhost:3000`), analyzes the high-res image via **Opus 4.7 vision**, and compares it to the retrieved Design Bundle.
- **Verification Ladder**: CLI agents follow the `Static -> DOM -> Screen` ladder, using the screenshot as the final "Layer 4" proof of implementation correctness.

## 3. Local Preview & Sync
Terminal users manage the visual preview outside the AI interface.
- **Decoupled Preview**: The developer runs their local server (`npm run dev`) in a separate terminal tab or tmux pane.
- **Dynamic Refresh**: The CLI agent can use the `navigate` and `wait` tools (via an MCP browser server) to reload the local preview and verify changes without human intervention.

## 4. Operational Comparison

| Feature | CLI-Native (Terminal) | GUI-Integrated (Desktop) |
| :--- | :--- | :--- |
| **Handoff** | Tool-based (`web_fetch` / `@`) | Button-driven ("Hand off") |
| **Preview** | External Browser / `localhost` | Built-in App Pane |
| **Audit** | `screenshot` tool + Opus 4.7 | Integrated screen analysis |
| **Control** | Sub-agent / Tool-call control | GUI sliders and knobs |

## 5. Integration Notes for SVC
- **CLI Automation**: Configure SVC `design-ui` to prompt the user for the Design Session URL if no `tokens.json` is found, triggering an automatic `web_fetch` ingestion.
- **Validation Gates**: Implement a `G5 (Visual)` gate that enforces at least one `screenshot` tool call to be analyzed by Opus 4.7 before marking a UI task complete.
- **CWD Confinement**: Remind agents that `screenshot` file outputs must remain within the `docs/visuals/` project directory to stay within the native sandbox.
