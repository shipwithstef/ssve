# Kimi CLI Communication Protocol

The "Wire" protocol is Kimi CLI's low-level message-passing layer for structured bidirectional communication.

## Wire Protocol
- **Version**: Current version 1.9.
- **Message Types**: All messages are either an `Event` (one-way notification) or a `Request` (expects a response).
- **Format**: Typically JSONL in `wire.jsonl` logs or stream-able JSON objects.

### Key Events
- `TurnBegin` / `TurnEnd`: Demarcate the start and end of a user interaction.
- `StepBegin` / `StepInterrupted`: Demarcate individual agent reasoning/action steps.
- `CompactionBegin` / `CompactionEnd`: Signal context compression.
- `StatusUpdate`: Provides context usage, token counts, and MCP status.
- `BtwBegin` / `BtwEnd`: Signals the processing of a "By The Way" side question.
- `SubagentEvent`: Events forwarded from a subagent instance.

### Key Requests
- `ApprovalRequest`: Asks the user to approve a tool call or action.
- `ToolCallRequest`: Routes a tool call to the client for execution.
- `QuestionRequest`: Asks the user structured questions (options/multi-select).
- `HookRequest`: Requests the client to handle a hook event (e.g., blocking a pattern).

## ACP (Agent Client Protocol)
ACP is used to integrate Kimi CLI with IDEs like Zed.
- **Multi-Session**: The ACP server supports multiple concurrent sessions.
- **Bridging**: Bridges ACP requests to the internal Wire protocol.
