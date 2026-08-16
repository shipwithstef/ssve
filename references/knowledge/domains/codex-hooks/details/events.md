# Codex Hook Events — Payload Schemas

## Common Input Fields (every event)

```json
{
  "session_id": "string",
  "transcript_path": "string | null",
  "cwd": "string",
  "hook_event_name": "string",
  "model": "string"
}
```

Turn-scoped events (`PreToolUse`, `PermissionRequest`, `PostToolUse`, `PreCompact`, `PostCompact`, `UserPromptSubmit`, `SubagentStart`, `SubagentStop`, `Stop`) also include `turn_id: string` where documented by the active host.

## Per-Event Schemas

### SessionStart

**Input adds:**
```json
{ "source": "startup | resume" }
```

**Matcher:** filters on `source` (e.g., `"startup|resume"`).

**Response:** plain text on stdout becomes extra developer context, OR:
```json
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "string"
  }
}
```

### PreToolUse

**Input adds:**
```json
{
  "tool_name": "Bash | apply_patch | MCP tool name",
  "tool_use_id": "string",
  "tool_input": {
    "command": "string",
    "workdir": "string | null",
    "path": "string | null",
    "file_path": "string | null"
  }
}
```

For operation authority, `tool_input.workdir` is the only trusted explicit
per-call working directory. Resolve it relative to the session `cwd`, require it
to exist, canonicalize it, and preserve the session repository separately.
File tools derive authority from every parsed mutation target; a target/workdir
contradiction denies. The Bash hook rejects obvious cross-root forms, while the
host sandbox or contained command wrapper supplies the actual filesystem
boundary.

**Matcher:** filters on `tool_name`; `apply_patch` also matches `Edit` and `Write` aliases.

**Block response (new format):**
```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "string"
  }
}
```

**Block response (legacy format):** `{"decision":"block","reason":"string"}` OR exit 2 with stderr reason.

### PermissionRequest

**Input adds:**
```json
{
  "tool_name": "Bash | apply_patch | MCP tool name",
  "tool_input": { "command": "string", "description": "string | null" }
}
```

**Allow response:**
```json
{
  "hookSpecificOutput": {
    "hookEventName": "PermissionRequest",
    "decision": { "behavior": "allow" }
  }
}
```

**Deny response:**
```json
{
  "hookSpecificOutput": {
    "hookEventName": "PermissionRequest",
    "decision": { "behavior": "deny", "message": "string" }
  }
}
```

**Aggregation:** if multiple hooks match — any `deny` wins; otherwise any `allow` skips the approval prompt.

### PostToolUse

**Input adds:**
```json
{
  "tool_name": "Bash | apply_patch | MCP tool name",
  "tool_use_id": "string",
  "tool_input": { "command": "string" },
  "tool_response": "JSON value"
}
```

**Response:**
```json
{
  "decision": "block",
  "reason": "string",
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": "string"
  }
}
```

Note: `decision: "block"` does NOT undo the command — it replaces the tool result with your feedback and the loop continues.

### UserPromptSubmit

**Input adds:** `{ "prompt": "string" }`

**Block response:** `{"decision":"block","reason":"string"}` OR exit 2 with stderr reason.

### Stop

**Input adds:**
```json
{
  "stop_hook_active": "boolean",
  "last_assistant_message": "string | null"
}
```

**Continuation response:**
```json
{ "decision": "block", "reason": "Your reason becomes the continuation prompt" }
```

Important: `block` here means "continue the turn with this prompt", not "reject".

### SubagentStart and SubagentStop

Codex exposes lifecycle hooks when a subagent starts and when it stops. These events are
useful for deterministic audit and policy context, but their presence is not evidence that
the native spawn transport carried an SSVE stable principal, delegation token, exact
worktree, allowed paths, or containment policy. Mutation authorization remains a separate
persisted-and-validated contract.

### SessionEnd, PreCompact, and PostCompact

Current Codex documentation also exposes `SessionEnd`, `PreCompact`, and `PostCompact`.
`SessionEnd` applies to the main thread, not subagents. Treat compact lifecycle events as
context-management seams, never as substitutes for durable task or authority state.
