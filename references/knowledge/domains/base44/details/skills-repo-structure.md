# Base44 Skills Repository Structure

## Source
- **Repository:** `https://github.com/base44/skills`
- **Version:** CLI v0.0.50 (per `CLI_VERSION`)
- **License:** MIT

## Overview

The `base44/skills` repository publishes agent skills for Base44 development across multiple AI coding agents (Cursor, Claude Code, Codex, OpenCode). It contains three production-ready skills (`base44-cli`, `base44-sdk`, `base44-troubleshooter`), four internal meta-skills under `.claude/`, and plugin packaging for both Claude and Cursor.

> "Install these skills so your coding agents can assist with Base44 development. Supports many AI coding agents, including Cursor, Claude Code, Codex, and OpenCode."

## Installation Methods

### Claude Code (Plugin Marketplace)
```bash
/plugin marketplace add base44/skills
/plugin install base44@base44-skills
# Or directly:
claude plugin install base44@base44-skills
```

### Other Agents (skills CLI)
```bash
npx skills add base44/skills       # project-level
npx skills add base44/skills -g    # user-level
```

## Repository Layout

```
base44/skills/
├── README.md
├── CONTRIBUTING.md
├── CLI_VERSION                    # v0.0.50
├── LICENSE                        # MIT
├── skills/
│   ├── base44-cli/
│   │   ├── SKILL.md               # 530 lines
│   │   └── references/            # 31 .md files
│   ├── base44-sdk/
│   │   ├── SKILL.md               # 305 lines
│   │   └── references/            # 12 .md files
│   └── base44-troubleshooter/
│       ├── SKILL.md               # 60 lines
│       └── references/
│           └── project-logs.md
├── .claude/
│   └── skills/
│       ├── skill-creator/
│       ├── review-skills/
│       ├── sync-cli-skill/
│       └── sync-sdk-skill/
├── .claude-plugin/
│   ├── plugin.json
│   └── marketplace.json
├── .cursor-plugin/
│   └── plugin.json
├── scripts/
│   └── validate-template.mjs
└── .github/workflows/
    ├── claude.yml
    ├── claude-code-review.yml
    ├── readme-check.yml
    ├── sync-cli-skill.yml
    └── sync-sdk-skill.yml
```

## Skill Categories (per CONTRIBUTING.md)

### `.curated/`
Production-ready skills that are thoroughly tested, well-documented, following all guidelines, reviewed and approved.

### `.experimental/`
Work-in-progress skills that are functional but may have rough edges, still being refined, open for feedback.

## SKILL.md Format Contract

Required YAML frontmatter:
```yaml
---
name: your-skill-name
description: What this skill does and when to use it.
---
```

Required fields:
- `name` — unique identifier, lowercase, hyphens allowed, no spaces
- `description` — brief explanation including trigger phrases

Optional fields:
- `allowed-tools` — list of tools the skill can use

Recommended body sections (per CONTRIBUTING.md):
1. Title
2. Overview
3. When to Use
4. How It Works
5. Usage
6. Parameters
7. Output
8. Troubleshooting

## Naming Conventions

- Use lowercase with hyphens: `entity-crud`, `auth-setup`
- Be descriptive but concise
- Prefix with category when helpful: `base44-entities`, `base44-auth`

## Local Skill Testing

```bash
# From the repo root
npx skills add . --skill your-skill-name -a cursor
```

## Skill-Creator Principles (from `.claude/skills/skill-creator`)

Key doctrine for writing effective skills:

> "The context window is a public good. Skills share the context window with everything else Claude needs."

> "Default assumption: Claude is already very smart. Only add context Claude doesn't already have."

Progressive disclosure design:
1. **Metadata (name + description)** — Always in context (~100 words)
2. **SKILL.md body** — When skill triggers (<5k words recommended)
3. **Bundled resources** — As needed by Claude (unlimited because scripts can be executed without reading into context window)

Keep SKILL.md body under 500 lines. Split content into separate files when approaching this limit.

> "Information should live in either SKILL.md or references files, not both."

What NOT to include in a skill:
- README.md
- INSTALLATION_GUIDE.md
- QUICK_REFERENCE.md
- CHANGELOG.md
- Any auxiliary context about the process that went into creating it

## Agent Skills Specification

Skills follow the Agent Skills specification at `https://agentskills.io/specification`.

## Cross-References
- `skills-base44-cli.md` — CLI skill contract and commands
- `skills-sdk-contract.md` — SDK skill contract and modules
- `skills-meta-tooling.md` — Meta-skills for creation, review, and sync
- `skills-plugin-packaging.md` — Plugin packaging for Claude and Cursor
