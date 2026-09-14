# Claude Code Hook Decision Format

## Modern Format (Preferred)

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow | deny | ask | defer",
    "permissionDecisionReason": "Explanation",
    "updatedInput": { "command": "modified command" },
    "additionalContext": "Context for Claude"
  }
}
```

`permissionDecision` values:
- `allow` — skips permission prompt
- `deny` — prevents tool call
- `ask` — prompts user to confirm
- `defer` — pauses for external resume (requires `-p` flag)

**Merge precedence when multiple hooks return different decisions:** `deny > defer > ask > allow`.

## Universal Fields (All Events)

```json
{
  "continue": true,
  "stopReason": "Reason to stop Claude",
  "suppressOutput": false,
  "systemMessage": "Warning message"
}
```

## Legacy Format (Deprecated but Supported)

```json
{ "decision": "approve" | "block", "reason": "Explanation" }
```

Maps to modern:
- `approve` → `allow`
- `block` → `deny`

## Exit Code Semantics

| Code | Meaning |
|---|---|
| `0` | Success — stdout JSON parsed for decision; proceed |
| `2` | Blocking error — stdout ignored; block action per event; stderr shown to Claude |
| Other | Non-blocking error — first line of stderr shown in transcript; proceed |

## Cross-Host Convergence

The modern Claude format is **identical** to:
- Kimi CLI `hookSpecificOutput.permissionDecision`
- Codex CLI `hookSpecificOutput.permissionDecision`

So one serializer covers 3 of 4 hosts. Only Gemini diverges with `{decision: "deny"}` stdout + strict-stdout contract.

## Output Capping

Context-injected output (`additionalContext`, `systemMessage`, plain stdout) is capped at **10,000 characters**. Overflow is written to a file with preview and file path shown to Claude.
