# Antigravity Harness Deep Dive
Layer 3 Extraction

## Core Architecture
Antigravity is structurally divergent from Bash-oriented CLIs (Claude Code/Codex). It bridges the gap between semantic artifact signaling and code execution. Rather than running a raw PTY, agentic actions are constrained by `ANTIGRAVITY.md` project rules globally.

## Tool Mechanics
- Implements specific API tool hooks (e.g., `multi_replace_file_content`, `run_command`, `view_file`). 
- **Artifact-Driven State:** Information transfer primarily occurs via the `Cwd` Brain directory, persisting structured intelligence in `.md` files like `task.md` and `walkthrough.md`.

## Framework Defenses Required (svc compatibility)
- Because it relies on tool schemas, it lacks a pre-tool PTY intercept. A user cannot hit `Ctrl+C` to cleanly break a sub-process without the system handling termination signals.
- **audit-session-execution requirement:** The auditor must mechanically enforce completion signals (like AP-27 Ghost Executions) since the Antigravity runtime uses softer semantic UI guardrails before tools trigger.
