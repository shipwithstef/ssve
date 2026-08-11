# Claude Design: App & Interface Guide (Layer 3)

Absolute domain expertise on the relationship between Claude Desktop, Claude Code Desktop, and the design-to-code handoff integration.

## 1. Unified Application Architecture
As of April 2026, Anthropic provides a single **Claude Desktop** application that houses two distinct operational "modes" via top-level tabs.

| Interface | Primary Role | Design Capability |
| :--- | :--- | :--- |
| **Claude Chat** | General-purpose assistant | Brainstorming, logic, prompt testing. |
| **Claude Code** | Agentic engineering orchestrator | **Handoff ingestion, code generation, Live Preview.** |

## 2. Claude Code Desktop (The "Code" Tab)
This is the specialized environment for design-to-code implementation. It is **not** a separate app, but a specialized view within the Desktop application.
- **Direct Filesystem Access**: Automatically maps local project folders without Docker.
- **Integrated Terminal**: Native shell for running `npm`, `git`, and build commands.
- **Mission Control**: The sidebar provides a "Handoff" tray where bundles from `claude.ai/design` appear instantly for one-click implementation.

## 3. "Hand off to Engineering" Workflow
The specialized integration works as follows:
1.  **Design**: You create and refine UI in **Claude Design** (Web Live Canvas).
2.  **Handoff**: Clicking the "Hand off to Engineering" button in the web UI triggers a secure socket signal to your local **Claude Desktop** application.
3.  **Implement**: In the **Code Tab**, a notification appears: *"Design Bundle Ready."* Clicking "Implement" automatically generates a new Git worktree, extracts the W3C tokens, and begins scaffolding the components.
4.  **Verify**: The **Live App Preview** pane in the Code Tab connects to your `localhost` port to show the results in real-time.

## 4. Why Use the Desktop Interface?
While the CLI can ingest bundles via `web_fetch`, the **Desktop Interface** (Code Tab) provides three exclusive advantages:
- **Visual Diff Viewer**: See design mockups and implemented code side-by-side with semantic highlighting.
- **Computer Use (Research Preview)**: The Desktop app can control your mouse/keyboard to test components in native environments (like mobile simulators) that the CLI cannot reach.
- **Side Chats**: Ability to ask "How does this layout work?" in a side panel without interrupting the main implementation agent.

## 5. Integration Notes for SVC
- **Orchestration**: SVC users should prefer the **Code Tab** for `design-ui` and `execute-changeset` lanes to leverage the integrated preview.
- **Artifact Sync**: Use the "Handoff Bundle" to automatically populate `docs/specs/ui-tokens.json` within the local project structure.
- **Pixel-Perfect Verification**: The **Code Tab** natively supports high-fidelity vision audits, allowing Opus 4.7 to compare the Live Preview pane against the Design Bundle with 1:1 precision.
