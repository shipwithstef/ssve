# Hook Events

Hooks are triggered by specific events in the Gemini CLI lifecycle.

## Execution Model
Hooks run synchronously. Gemini CLI waits for all matching hooks to complete before continuing the agent loop.

## Events List
- **SessionStart**: Inject context, load resources.
- **SessionEnd**: Clean up, save state.
- **BeforeAgent**: Block turns or add context before planning.
- **AfterAgent**: Review output, force retry or halt execution.
- **BeforeModel**: Modify prompts, swap models, mock LLM responses.
- **AfterModel**: Filter or redact responses, log interactions.
- **BeforeToolSelection**: Filter available tools to optimize selection.
- **BeforeTool**: Validate arguments, block dangerous operations.
- **AfterTool**: Process results, run tests, hide results.
- **PreCompress**: Save state or notify user before context compression.
- **Notification**: Forward system notifications to desktop alerts or logging.

## Exit Codes
- **0 (Success)**: stdout parsed as JSON. Can still enforce blocks via payload (`{"decision": "deny"}`).
- **2 (System Block)**: Target action is aborted. stderr is used as the rejection reason.
- **Other (Warning)**: Non-fatal failure. Original parameters used.