# Tool/Library Knowledge: Agent Harnesses

## Codex Hooks
- **Description:** Extensibility framework to inject deterministic scripts into the agentic loop.
- **Use Cases:** Logging, prompt scanning, custom validation, controlling tool usage, influencing conversation flow.
- **Configuration:** `hooks.json` file or inline `[hooks]` tables in `config.toml`.
- **Events Supported:** `SessionStart`, `PreToolUse`, `Stop`, and others.
- **Mechanism:** Hooks receive session data as JSON on `stdin` and can influence Codex by returning JSON on `stdout` (e.g., to block actions or provide context).
- **Status:** Opt-in via `[features] hooks = true`; supported in native Windows and WSL2 Codex environments.
- **Source:** https://developers.openai.com/codex/hooks
