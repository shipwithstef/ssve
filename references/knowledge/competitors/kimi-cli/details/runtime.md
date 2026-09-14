# Kimi CLI Runtime & UIs

Kimi CLI provides multiple interfaces and runtime modes tailored for different development environments.

## Runtime Modes
- **Agent Mode (Default)**: Normal interactive turn-based collaboration.
- **Shell Mode**: Direct shell execution with interception for special commands.
- **Print Mode (`--print`)**: One-shot or non-interactive mode. In version 1.37+, it supports waiting for in-flight background tasks before exiting.
- **Plan Mode**: A special state focused on research and planning.
    - Uses a `PlanModeInjectionProvider` to remind the AI it is in read-only mode for files.
    - Persistent artifacts ("plans") are stored in a common directory keyed by session ID.
- **Yolo Mode**: Disables all tool call and hook approvals for fully autonomous operation.

## User Interfaces
- **Web UI (`kimi web`)**: A browser-based interface built with React/Vite. Supports drag-and-drop file operations and rich visualization of reasoning steps.
- **Terminal UI (`kimi term`)**: A modern terminal interface built using the Toad engine (Textual).
- **Visualizer (`kimi vis`)**: A specialized dashboard for inspecting session traces, context usage, and the Wire event timeline.
- **Zsh Plugin**: Provides shell-level shortcuts (`kimi-cli` command) to launch sessions.

## Special Features
- **Steer Input**: Users can "steer" the agent mid-turn (e.g., providing corrections via `/btw`) which are queued and injected after the current step.
- **Background Tasks**: The CLI can launch and manage background agent tasks, with a manager that can list, stop, and report summaries of these tasks.
