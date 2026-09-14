# Gemini CLI Capabilities (Layer 3 - Exhaustive)

This document provides a detailed inventory of all Gemini CLI features, tools, sub-agents, and configuration surfaces, established through exhaustive "grind" extraction.

## 1. Feature Surface
- **Modes**: 
  - **Interactive TUI**: Full REPL with Vim keybindings and slash commands.
  - **Non-Interactive**: Headless mode via `--non-interactive` or `-p/--prompt`. Requires `GOOGLE_API_KEY` or `GOOGLE_APPLICATION_CREDENTIALS`.
  - **Plan Mode**: Read-only research phase (`--approval-mode=plan`) for safe context gathering.
  - **Shell Mode**: Direct system interaction (`!`) and dedicated manual mode.
- **Workflow & Lifecycle**:
  - **Chapters (v0.38.0+)**: Automatically groups interactions into narrative chapters based on intent and tool usage. Improves multi-step task continuity and allows selective history expansion.
  - **Context Injections**: Git-aware file/directory injection using the `@` symbol.
  - **Worktree Management**: Automated branch/worktree creation and promotion (experimental).
  - **Checkpointing**: Filesystem snapshots before edits with full `/restore [tool_call_id]` capability.
  - **History Management**: Context Compression Service (background) and `/compress` command for history distillation.
  - **Security (Conseca)**: LLM-driven real-time tool call evaluation against intent. Enabled via `security.enableConseca`.

## 2. Tool Inventory
- **File System**: `read_file`, `write_file`, `replace`, `list_directory`, `glob`, `grep_search`, `read_many_files`.
- **Execution**: `run_shell_command` (supports non-interactive and background execution).
- **Web**: `google_web_search`, `web_fetch` (supports `directWebFetch` to bypass summarization).
- **Browser (Experimental)**: `navigate`, `click`, `type`, `scroll`, `wait`, `screenshot`, `analyze_screenshot`.
- **Planning & Task**: `enter_plan_mode`, `exit_plan_mode`, `write_todos`, `complete_task` (internal).
- **Meta & Framework**: `ask_user`, `save_memory`, `activate_skill`, `get_internal_docs` (file-based in `docs/`).

## 3. Sub-Agent Ecosystem
Specialized agents running in isolated loops:
- **`codebase_investigator`**: Deep analysis, dependency mapping, and root-cause discovery.
- **`cli_help`**: Authority on CLI commands, configuration, and documentation.
- **`browser_agent`**: Chrome/Chromium-based web automation and research.
- **`memory_manager`**: Agentic fact organization and de-duplication.
- **Custom Agents**: Store `.md` files in `~/.gemini/agents/` (global) or `.gemini/agents/` (project).
  - **Schema**:
    ```yaml
    ---
    name: agent-slug            # Unique identifier
    description: "Brief summary" # Used by router
    kind: local                 # local | remote
    tools: [ read_file, glob ]  # Tool whitelist
    model: gemini-3-flash-preview # Defaults to session model
    temperature: 0.2
    max_turns: 30
    ---
    System prompt text...
    ```

## 4. IDE Integration (Gemini CLI Companion)
Synchronizes session context with the user's active editor (VS Code, Cursor).
- **Context Sync**: CLI receives the last 10 accessed files and active cursor position.
- **Selection**: Shares active text selection (up to 16KB limit).
- **Protocol**: Socket-based communication via `GEMINI_CLI_IDE_SERVER_PORT`.
- **Docker Support**: Uses `host.docker.internal` for cross-boundary sync.

## 5. Configuration & Lifecycle Hooks
- **Configuration (`~/.gemini/settings.json`)**: Hierarchical schema (General, Context, Model, Security, UI, MCP).
- **Hooks**: Registered in `settings.json` under `hooks`.
  - **Events**: `SessionStart`, `SessionEnd`, `BeforeModel`, `BeforeTool`, `AfterTool`.
  - **BeforeModel Capabilities**: Receives `llm_request` via `stdin`. Can modify prompt/history or provide a **Synthetic Response**.
  - **Environment**: `GEMINI_PROJECT_DIR` is exported to all hook processes.

## 6. Security, Trust & Redaction
- **Policy Engine**: Fine-grained governance via TOML files in `~/.gemini/policies/`. Supports `priority` and persistent approvals.
- **Folder Trust**: `security.folderTrust.enabled`. Untrusted projects run in "safe mode" (no project settings, no auto-acceptance).
- **Redaction**: `environmentVariableRedaction` masks secrets by name (e.g., `TOKEN`) and value patterns.

## 7. Extension Ecosystem
Decentralized, manifest-driven expansion system.
- **Discovery**: Automatically indexes GitHub repos with the `gemini-cli-extension` topic.
- **Installation**: `gemini extensions install <source>`. Supports platform-specific binaries in GitHub Releases.

## 8. Quotas & CI Automation
- **GitHub Action**: Automates PR reviews, issue triage, and `@gemini-cli` assistance.
- **Quotas**:
  - Free Tier: 250 - 1,000 requests/day.
  - Pro/Ultra/Enterprise: 1,500 - 2,000 requests/day.
  - Rate Limits: Standard 60 requests/minute.

## 9. Integration Notes for SVC
- **Rule Injection**: Use `@-imports` in project `GEMINI.md` to link global rules.
- **Skill Deployment**: Symlink `SKILL.md` files into `~/.gemini/skills/`.
- **Verification Hooks**: Use `AfterTool` hooks to trigger framework validation.
- **CI Sync**: Leverage `--non-interactive` mode and `GOOGLE_API_KEY` for framework-governed CI gates.
- **IDE Context**: SVC designers can assume the agent knows the user's active file/cursor if the companion is installed.
