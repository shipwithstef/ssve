# Large-input compatibility matrix — 2026-09-15

WI-FW-PROMPT-INSPECTION-01 / WI-FW-TWO-BOX-01. Distinguishes native CLI
capability, implemented general-review adapter, and qualified Two-Box
planning transport. Missing adapters stay explicit backlog; this repair
does not automatically expand planning onto new hosts.

| Host | Native large-input interface | General-review adapter | Two-Box planning | This repair |
|---|---|---|---|---|
| Codex 0.154.0 | `exec` stdin/`-`; `debug prompt-input` positional only | Yes (`run-external-review.mjs` stdin/file) | Only planning host | Frozen 1 MiB planning bytes; positional inspect when argv fits; no-inference Responses capture qualified against a native probe profile for oversized prompts; live inference remains stdin of those frozen bytes. Capture overlay is not live authority. |
| Claude Code | Piped print-mode input | Yes (stdin) | Unsupported | Unchanged. No new planning adapter. |
| Cursor Agent | Piped stdin | Yes (stdin) | Unsupported | Unchanged. |
| Grok Build | `--prompt-file` | Yes (file path) | Unsupported | Unchanged. Shared freeze/hash contract reused by the review reader. |
| AGY / Antigravity | Print/stdin; current adapter is agent-mediated file | Yes (agent-mediated) | Unsupported | Unchanged. Agent-mediated read is not a tool-free planning substitute. |
| Kimi Code | Print stdin | No canonical branch | Unsupported | Backlog only. |
| OpenCode | `run --file` | No canonical branch | Unsupported | Backlog only. |
| Gemini CLI | Documented pipe; not on this PATH | No canonical branch | Unsupported | Backlog only. |
| MiMo-Code | Native CLI not established | No canonical branch | Unsupported | Backlog only. |

Planning byte limit (1 MiB) is independent of token/context/output reserve
and of the larger ordinary-review package reader (tested through 1,235,010
bytes). Live/inspect planning resolves the selected model's context window
and output reserve from the local Codex models cache. Token estimate is one
token per UTF-8 byte plus native envelope bytes; missing catalog reserve fails
closed. A 1 MiB prompt can inspect without inference and still be not
live-eligible when that bound exceeds the catalog window.
Unsupported planning hosts still fail closed in
`two-box-role-launch.mjs` / `isolated-plan-analysis.mjs`.
