# Kimi CLI Background Tasks & Subagents

Kimi CLI features a robust background task management system that allows the agent to delegate long-running or autonomous work to external processes or sub-agents.

## 1. Background Task Architecture

The system is managed by the `BackgroundTaskManager`, which handles task persistence, lifecycle, and notifications.

- **Persistence**: Task specifications (`TaskSpec`) and runtime state (`TaskRuntime`) are stored in `~/.kimi/sessions/{id}/tasks/`.
- **Worker Processes**: For bash tasks, a separate `__background-task-worker` process is launched to execute the command, manage heartbeats, and capture output.
- **Task Store**: Uses JSON-based persistence with explicit `write_runtime` and `write_control` gates to prevent race conditions between the main process and workers.

## 2. Task Types

### Bash Tasks
- Runs arbitrary shell commands in a persistent background process.
- **Heartbeats**: Workers send periodic heartbeats; the manager "reconstructs" or "reconciles" stale tasks during session resumes.
- **Kill/Signal Handling**: Supports graceful termination (`SIGTERM`) and forced kills (`taskkill` on Windows).

### Agent Tasks (Subagents)
- Launches a separate agent instance to perform a specific sub-task (e.g., "Analyze this folder while I wait").
- **`BackgroundAgentRunner`**: Orchestrates the sub-agent's execution loop within an `asyncio.Task`.
- **Communication**: Sub-agent events are forwarded back to the main UI via `SubagentEvent` wire messages.

## 3. The Subagent Lifecycle

Subagents are defined in the `AgentSpec` and can be instantiated dynamically.

- **`SubagentStore`**: Tracks the status of all active and terminal subagent instances.
- **Isolation**: Each subagent has its own `Runtime`, `Soul`, and `Context`, allowing them to operate independently of the main thread.
- **Integration**: While subagents can run in the foreground (blocking the main agent), the background mode allows the user to continue interacting with the main agent while the sub-task progresses.

## 4. Notification System

Task updates are treated as first-class `Notification` events.
- **Terminal Notifications**: When a task completes, fails, or is lost, the system publishes a notification with a summary and a "tail" of the output.
- **UI Integration**: These notifications are displayed as toasts or status bar updates in the Web and Terminal UIs.
- **Auto-Wait**: In certain modes (like `--print`), the system can be configured to wait for all in-flight background tasks to reach a terminal state before exiting.
