# Kimi CLI Tool Catalog

Kimi CLI provides a comprehensive suite of built-in tools designed for full-stack development and autonomous research.

## 1. Core Agent & Logic Tools

| Tool | Capability |
| :--- | :--- |
| **`Agent`** | Logic for spawning and interacting with subagents for delegated tasks. |
| **`Think`** | Triggers an internal "Thought" block, allowing the AI to perform complex reasoning or chain-of-thought processing without immediate action. |
| **`AskUser`** | Suspends execution to ask the user a structured question (supports multiple-choice). |
| **`SendDMail`** | **(Denwa Renji)** Sends a message back to a previous checkpoint, reverting the session context. |

## 2. Filesystem & Repository Operation

| Tool | Capability |
| :--- | :--- |
| **`ReadFile`** | Reads the content of a text file. |
| **`WriteFile`** | Creates or overwrites a file with the provided content. |
| **`StrReplaceFile`** | Performs a precise string replacement within a file (preferred over full rewrites). |
| **`Glob`** | Lists files matching a pattern within the repository. |
| **`Grep`** | Performs a text search across multiple files. |
| **`ReadMediaFile`** | Specialized tool for reading images and other non-text binaries for visual analysis. |

## 3. Shell & Background Execution

| Tool | Capability |
| :--- | :--- |
| **`Shell`** | Executes an arbitrary shell command. Supports interactive and non-interactive modes. |
| **`BackgroundBash`** | Launches a long-running shell command in the background. |
| **`TaskList`** | Lists all active and terminal background tasks. |
| **`TaskOutput`** | Reads the captured stdout/stderr of a background task. |
| **`TaskStop`** | Terminates a running background task. |

## 4. Web & Research

| Tool | Capability |
| :--- | :--- |
| **`SearchWeb`** | Performs a web search using configured providers. |
| **`FetchURL`** | Fetches the technical content of a specific URL (converts to Markdown). |

## 5. Planning & Project Management

| Tool | Capability |
| :--- | :--- |
| **`SetTodoList`** | Manages a persistent `todo.list` file in the repository root to track project progress. |
| **`PlanEnter`** | **(Heroes)** Enters "Plan Mode", switching the AI to a read-only research state with persistent plan artifacts. |
| **`PlanDisplay`** | Formats and displays the current plan content in the UI. |

## 6. Visualization & UI

| Tool | Capability |
| :--- | :--- |
| **`Display`** | Generic primitive for sending rich visualization blocks (Diffs, Shell output, Background status) to the Wire client. |
