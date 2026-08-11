# Kimi Code CLI - Sub-Agents

## Mechanism
Kimi Code CLI supports subagents defined in YAML configuration files. An agent configuration defines the system prompt, available tools, and optional subagents. Subagents run in isolated contexts, avoiding pollution of the main agent's history, and can run in parallel.
- **Built-in Agents:** `default` and `okabe` (experimental).
- **Built-in Subagent Types:**
  - `coder`: General software engineering. Has shell and write tools.
  - `explore`: Read-only codebase exploration. Has shell, but no write tools.
  - `plan`: Implementation planning. No shell, no write tools.
- **Agent Tool:** The main agent launches subagents via the `kimi_cli.tools.agent:Agent` tool. Subagents are prohibited from nesting the `Agent` tool.
- **Inheritance:** Agent files can use `extend` to inherit and override configurations (e.g., `extend: default` or relative paths).
- **System Prompt Variables:** Supports variables like `${KIMI_WORK_DIR}`, `${KIMI_AGENTS_MD}`, `${KIMI_SKILLS}` and Jinja2 `{% include %}` directives.

## Analysis
The sub-agent architecture in Kimi Code CLI is designed to constrain agent capabilities strictly based on their role, enforcing a separation of concerns (e.g., planners cannot write code, explorers cannot run shell commands). This pattern enforces progressive narrowing at the tool access level within a single session. The isolated context and parallelism allow complex tasks to be delegated without overwhelming the main orchestrator's context window.

## L4 Pointers
- Documentation source: `https://www.kimi.com/code/docs/en/kimi-code-cli/customization/sub-agents.html`
- Tool reference: `kimi_cli.tools.agent:Agent`