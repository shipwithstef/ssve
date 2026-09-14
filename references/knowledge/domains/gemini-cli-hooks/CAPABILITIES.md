# Gemini CLI Hooks

**Source:** https://geminicli.com/docs/hooks/
**Last verified:** 2026-04-23

Provides synchronous lifecycle interception for Gemini CLI via `stdin`/`stdout` JSON communication.

- **11 Lifecycle Events**: `SessionStart`, `SessionEnd`, `BeforeAgent`, `AfterAgent`, `BeforeModel`, `AfterModel`, `BeforeToolSelection`, `BeforeTool`, `AfterTool`, `PreCompress`, `Notification`.
- **Strict stdout Contract**: stdout MUST contain only the final JSON object — no plain text. All logging goes to stderr. Stricter than Claude/Kimi/Codex.
- **Exit Code Semantics**: `0` = success (stdout parsed; can still block via `{"decision":"deny"}`); `2` = system block (stderr = reason); other = non-fatal warning, original params used.
- **Configuration Hierarchy** (high→low): `.gemini/settings.json` → `~/.gemini/settings.json` → `/etc/gemini-cli/settings.json` → extension-provided.
- **Environment Variables Injected**: `GEMINI_PROJECT_DIR`, `GEMINI_PLANS_DIR`, `GEMINI_SESSION_ID`, `GEMINI_CWD`, plus `CLAUDE_PROJECT_DIR` as explicit Claude-compat alias.
- **Timeout Unit**: milliseconds (default 60000) — different from Codex/Claude (seconds).
- **Matchers**: regex for tool events (`BeforeTool`, `AfterTool`, `BeforeToolSelection`); exact strings for lifecycle events; `"*"`/`""` wildcards.
- **Security Fingerprinting**: Project-level hooks are fingerprinted; changes require re-verification. Also gated by `security.folderTrust.enabled`.