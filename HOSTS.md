# Host-Specific Setup

svc runs on multiple agent hosts. Read your host's context file, then run `./setup --host <your-host>`. Per-host capabilities live in `provision/hosts/<host>.json`.

| Host | Context file | Install |
|---|---|---|
| Claude Code | `CLAUDE.md` | `./setup` (or `./setup --host claude`) |
| Kimi CLI | `KIMI.md` | `./setup --host kimi` |
| Codex CLI | (uses `CLAUDE.md`) | `./setup --host codex` |
| Gemini CLI | `GEMINI.md` | `./setup --host gemini` |
| OpenCode | (uses `CLAUDE.md`) | `./setup --host opencode` |
| MiMo Code | `AGENTS.md` (auto-generated) | `./setup --host mimo-code` |
| Antigravity | `ANTIGRAVITY.md` | `./setup --host antigravity` |
| Cursor | (uses `CLAUDE.md`) | `./setup --host cursor` |

**Start here:** read your host's context file, then run `./setup --host <your-host>`. The setup script reads `provision/hosts/<host>.json` and symlinks skills + infra accordingly.
