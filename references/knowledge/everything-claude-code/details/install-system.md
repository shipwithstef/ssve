# ECC Install System — Detail

Source: `install.sh`, `install.ps1`, `README.md`, `WORKING-CONTEXT.md`, `manifests/`

## Install Methods

### Option A: Claude Code Plugin (Recommended)

```bash
# In Claude Code session:
/plugin marketplace add https://github.com/affaan-m/everything-claude-code
/plugin install ecc@ecc
```

Or add to `~/.claude/settings.json`:
```json
{
  "extraKnownMarketplaces": {
    "ecc": {
      "source": { "source": "github", "repo": "affaan-m/everything-claude-code" }
    }
  },
  "enabledPlugins": { "ecc@ecc": true }
}
```

Plugin slug is `ecc`; legacy `everything-claude-code` paths remain for compatibility.

### Option B: OSS Installer

```bash
git clone https://github.com/affaan-m/everything-claude-code.git
cd everything-claude-code
npm install  # or pnpm/yarn/bun

# Full profile (macOS/Linux)
./install.sh --profile full

# Language-specific
./install.sh typescript python golang swift php

# Target-specific
./install.sh --target cursor typescript
./install.sh --target gemini --profile full
./install.sh --target antigravity typescript

# Windows
.\install.ps1 --profile full
npx ecc-install typescript  # cross-platform npm entrypoint
```

### Profiles

| Profile | Contents |
|---------|----------|
| core | Core agents (code-reviewer, planner, tdd-guide, security-reviewer) + essential skills (tdd-workflow, coding-standards, security-review) + key commands |
| developer | Core + language patterns + testing skills |
| security | Developer + security/compliance skills + AgentShield |
| research | Developer + research/AI skills |
| full | Everything — all 47 agents, 181 skills, 79 commands |

### Selective Install Architecture (v1.9.0+)

- `manifests/` directory: module definitions
- `install-plan.js`: generates install plan from manifests + selected languages/targets
- `install-apply.js`: applies plan to filesystem
- SQLite state store: tracks what's installed, enables incremental updates
- Install modules: `framework-language`, `operator-workflows`, `media-generation`, `security`, `business-content`, etc.

## Package Manager Detection

Priority order:
1. `CLAUDE_PACKAGE_MANAGER` env var
2. `.claude/package-manager.json`
3. `package.json` `packageManager` field
4. Lock file detection (package-lock.json → npm, yarn.lock → yarn, pnpm-lock.yaml → pnpm, bun.lockb → bun)
5. `~/.claude/package-manager.json`
6. First available package manager

```bash
node scripts/setup-package-manager.js --global pnpm   # set global
node scripts/setup-package-manager.js --project bun   # set project
node scripts/setup-package-manager.js --detect        # show current
# Or via skill: /setup-pm
```

## Rules (Manual Install Required)

Plugin cannot distribute rules automatically. Clone repo and copy:
```bash
# Copy whole language directory (not individual files — relative refs break)
cp -r rules/common ~/.claude/rules/common
cp -r rules/typescript ~/.claude/rules/typescript
```

## Repair

After account/setup wipe:
```bash
ecc list-installed   # check what's installed
ecc doctor           # diagnose issues
ecc repair           # restore ECC-managed files
```

## Requirements

- Claude Code CLI v2.1.0+ (hooks auto-loading from plugin changed in v2.1)
- Node.js (for scripts and hooks)
- `multi-*` commands need `npx ccg-workflow` runtime for external dependencies

## Cross-Harness Install Targets

| Target | Directory | Mechanism |
|--------|-----------|-----------|
| Claude Code | `~/.claude/` | Plugin system or direct copy |
| Codex | `~/.codex/` | AGENTS.md, agent.yaml, config.toml via sync script |
| Cursor | `.cursor/` | Rules directory |
| OpenCode | `.opencode/` | Plugin with compiled TypeScript dist |
| Gemini | `.gemini/` | Skill files |
| Antigravity/Trae/Kiro/CodeBuddy | `.agents/` | OpenAI-format agent YAML |
