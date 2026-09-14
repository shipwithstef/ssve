# Claude Code hooks — verified integration guidance

**Verified:** 2026-09-06 against the [official hooks reference](https://code.claude.com/docs/en/hooks). Retrieval hashes are in `.sources.jsonl`.

## Verified capabilities

- Handlers support `command`, `http`, `mcp_tool`, `prompt`, and `agent` types. Command handlers receive event JSON on stdin and return results through stdout and exit status.
- Event-specific schemas define matching and decision behavior. Consult the relevant event before assigning a blocker or observer role; do not reuse one event’s response shape for another.
- Command hooks support asynchronous execution. Prompt and agent handlers invoke models, so they are not zero-token substitutes for local checks.
- Hook configuration can restrict when a handler runs. The current reference documents both matcher behavior and handler conditions.

## SSVE operating guidance

Use command hooks for deterministic ownership, parsing, and focused validation. Reserve model evaluation for judgments that require it. Measure invocation frequency and latency; keep recovery actionable and bounded. Validate settings against the host’s actual supported schema before installation.

## Historical material

The old “28 events” census and cross-host superiority claims are withdrawn. This retrieval verifies this capability summary only. Existing `details/` files are historical snapshots, not current schema authority; reverify a detail against official documentation before using it.

Public documentation retrieval did not invoke Claude or change any live host settings.
