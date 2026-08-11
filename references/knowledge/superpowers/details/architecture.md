# superpowers — Architecture Details

## Bootstrap Injection (3 parallel mechanisms)

### Claude Code
- `hooks/hooks.json`: SessionStart event, matcher `startup|clear|compact` (NOT `resume`)
- Command: `"${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd" session-start`
- `async: false` — blocks until injection completes
- `session-start` (extensionless bash script) reads `using-superpowers/SKILL.md`, JSON-escapes via
  bash parameter substitution (5 passes: `\`, `"`, `\n`, `\r`, `\t`), emits platform-specific JSON
- Output format: `hookSpecificOutput.additionalContext` (Claude Code), `additional_context` (Cursor),
  `additionalContext` (Copilot CLI)
- Content wrapped in `<EXTREMELY_IMPORTANT>` tags

### OpenCode
- `.opencode/plugins/superpowers.js` — ESM plugin with two hooks:
  - `config` hook: pushes `superpowersSkillsDir` to `config.skills.paths` (live config mutation)
  - `experimental.chat.messages.transform`: prepends bootstrap to first user message
- Idempotency guard: checks for `'EXTREMELY_IMPORTANT'` before injection
- Inline frontmatter parser (no dependency)
- First user message injection (not system) — avoids per-turn token bloat and Qwen compatibility

### Gemini CLI
- `GEMINI.md` with two `@include` directives pointing to SKILL.md and gemini-tools.md
- `gemini-extension.json` wires up `contextFileName: "GEMINI.md"`

## Cross-Platform Hook System

### Polyglot `.cmd` Wrapper
- `run-hook.cmd` is valid in both CMD.exe and bash simultaneously
- Trick: `: << 'CMDBLOCK'` — label in CMD (ignored), no-op + heredoc in bash
- CMD block searches for bash: `C:\Program Files\Git\bin\bash.exe` → x86 path → `where bash`
- Silent exit on no-bash (`exit /b 0`) — graceful degradation
- `.gitattributes` enforces LF on `.cmd` files (counter-intuitive but required for polyglot)
- Extensionless hook files avoid Claude Code's Windows auto-detection issue

### Platform Detection Order
1. `CURSOR_PLUGIN_ROOT` → Cursor format
2. `CLAUDE_PLUGIN_ROOT && !COPILOT_CLI` → Claude Code format
3. Else → Copilot/unknown format

## Version Management

### `bump-version.sh` + `.version-bump.json`
- 5 JSON manifests must agree: `package.json`, `.claude-plugin/plugin.json`,
  `.cursor-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `gemini-extension.json`
- Config-driven: `files[].path` + `files[].field` with dotted notation (`plugins.0.version`)
- Three modes: `--check` (show all), `--audit` (check + grep repo), `<version>` (bump all)
- Audit excludes: CHANGELOG, RELEASE-NOTES, node_modules, .git, self
- Uses `jq` for safe JSON field read/write

## Plugin Install Methods

| Platform | Install method |
|---|---|
| Claude Code | `/plugin install superpowers@claude-plugins-official` |
| Claude Code (dev) | `/plugin marketplace add obra/superpowers-marketplace` then `/plugin install` |
| Codex CLI | Clone to `~/.codex/superpowers`, symlink `skills/` to `~/.agents/skills/superpowers` |
| Codex App | Same as CLI but sandboxed — `git checkout -b`, `git push`, `gh pr create` blocked |
| OpenCode | Add to `opencode.json` plugin array (auto-installs via Bun) |
| Gemini CLI | `gemini extensions install https://github.com/obra/superpowers` |
| Cursor | `hooks-cursor.json` with camelCase `sessionStart` |
| Copilot CLI | Detected via `COPILOT_CLI` env var |

## Codex App Compatibility (PRI-823)

- Detection: compare `git-dir` vs `git-common-dir` (if different → linked worktree)
- Decision matrix: (linked+detached) → skip creation, emit handoff payload;
  (linked+named branch) → skip creation, full finish flow; (normal) → unchanged
- Handoff payload: commit SHA, suggested branch name, suggested commit message
- `cd && pwd -P` handles both relative paths and macOS symlinks (`/tmp → /private/tmp`)
- `network_access = true` silently broken on macOS (Codex issue #10390)

## Contribution Gate

- 94% PR rejection rate stated explicitly in CLAUDE.md
- Hard rejections: third-party deps, compliance rewrites without eval evidence, domain-specific skills
- Skill changes require `superpowers:writing-skills` usage + adversarial pressure testing
- "Protect your human partner" framing — agent as advocate, not tool
- Zero-dependency design is a hard architectural constraint

## Analysis — What's valuable for svc

The polyglot hook wrapper technique solves a real cross-platform problem cleanly.
The version drift detection across manifests is directly applicable to svc's
five-source-of-truth linting. The bootstrap injection architecture demonstrates
three independent solutions to the same problem, each adapted to platform constraints.

## L4 Pointers

- Polyglot technique: `hooks/run-hook.cmd` + `docs/windows/polyglot-hooks.md`
- OpenCode plugin: `.opencode/plugins/superpowers.js` (inline frontmatter parser pattern)
- Version management: `scripts/bump-version.sh` + `.version-bump.json`
- Codex App detection: `docs/superpowers/specs/2026-03-23-codex-app-compatibility-design.md`
