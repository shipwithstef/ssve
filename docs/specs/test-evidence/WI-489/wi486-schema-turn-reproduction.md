# WI-486 schema-turn reproduction preserved for WI-489

The source artifacts remain untouched in the paused WI-486 worktree. This file preserves their material fields and byte hashes so the WI-489 diagnosis remains reviewable after eventual hygiene cleanup.

## Attempt 1

- Receipt SHA-256: `235b57dc5ba0427926e53ce097fdeacb2e68a39ac4e07359fa7fffdc18b367d7`
- Event SHA-256: `33cface4503a7de45367ffa45aae83c28befbc781264d112ba6446a787a43ddb`
- Empty stderr SHA-256: `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`
- Launcher: `1.0.1`; Claude Code: `2.1.210`
- Requested/invoked tuple: Codex orchestration → Claude/Fable 5/high
- Receipt: `status=failure`, `classification=unknown_provider`, `effective_tuple=null`, fallback unused and ineligible, cache not reusable
- Event: `subtype=error_max_turns`, `is_error=true`, `num_turns=2`, `stop_reason=tool_use`, `terminal_reason=max_turns`, `errors=["Reached maximum number of turns (1)"]`
- Runtime models: `claude-fable-5` and allowed auxiliary `claude-haiku-4-5-20251001`; no Opus model

## Attempt 2

- Receipt SHA-256: `8b0ec44b312ae5f3b2cdabc903463abd4ba184eefedb8ec6bbfbaecf9fbb91f6`
- Event SHA-256: `f1805f64863f4958d050cfe3b3cb4a1399aa74b8b32992c6e777125a80c2fca1`
- Empty stderr SHA-256: `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`
- Launcher: `1.0.1`; Claude Code: `2.1.210`
- Requested/invoked tuple: Codex orchestration → Claude/Fable 5/high
- Receipt: `status=failure`, `classification=unknown_provider`, `effective_tuple=null`, fallback unused and ineligible, cache not reusable
- Event: `subtype=error_max_turns`, `is_error=true`, `num_turns=2`, `stop_reason=tool_use`, `terminal_reason=max_turns`, `errors=["Reached maximum number of turns (1)"]`
- Runtime models: `claude-fable-5` and allowed auxiliary `claude-haiku-4-5-20251001`; no Opus model

## Replay conclusion

Both paid primary invocations reached the structured-output tool boundary and were terminated by the CLI turn ceiling. Neither result is an availability failure or an Anthropic provider-safety route. The correction must recognize the structured result and must not trigger Opus.
