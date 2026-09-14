# Base44 Skills Plugin Packaging

## Source
- `.claude-plugin/plugin.json`
- `.claude-plugin/marketplace.json`
- `.cursor-plugin/plugin.json`
- `scripts/validate-template.mjs`
- `.github/workflows/*.yml`

## Claude Plugin

### plugin.json
Standard Claude plugin manifest. References:
- `rules` directory (if present)
- `skills` directory
- `agents` directory
- `commands` directory

### marketplace.json
Marketplace listing metadata for the Base44 plugin.

## Cursor Plugin

### plugin.json
Cursor-specific plugin manifest with these fields:
- `name` — lowercase alphanumerics, hyphens, periods
- `logo` — path to logo asset
- `rules` — array of rule file paths
- `skills` — array of skill directory paths
- `agents` — array of agent file paths
- `commands` — array of command file paths
- `hooks` — array of hook file paths
- `mcpServers` — array of MCP server paths

## validate-template.mjs

Node.js validation script for Cursor plugin structure. Performs:

1. **Plugin manifest validation**
   - Reads `.cursor-plugin/plugin.json`
   - Validates `name` pattern: `/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/`

2. **Path reference validation**
   - Checks all manifest fields (`logo`, `rules`, `skills`, `agents`, `commands`, `hooks`, `mcpServers`)
   - Validates paths are safe relative paths (no `../`, no absolute prefixes)
   - Verifies referenced files exist

3. **Component frontmatter validation**
   - Scans `rules/` for `.md`/`.mdc`/`.markdown` files — requires `description` frontmatter
   - Scans `skills/` for `SKILL.md` files — requires `name` and `description` frontmatter
   - Scans `agents/` for `.md`/`.mdc`/`.markdown` files — requires `name` and `description` frontmatter
   - Scans `commands/` for `.md`/`.mdc`/`.markdown`/`.txt` files — requires `name` and `description` frontmatter

4. **Optional file warnings**
   - `hooks/hooks.json` — only needed when using hooks
   - `mcp.json` — only needed when using MCP servers

Frontmatter parser behavior:
- Requires `---\n` opening and `\n---\n` closing
- Parses key:value pairs (first `:` is separator)
- Skips blank lines and comments (`#`)

Exit codes:
- 0 = validation passed
- 1 = validation failed (errors listed)

## GitHub Workflows

### claude.yml
Workflow for Claude plugin operations.

### claude-code-review.yml
Automated skill review using the `review-skills` meta-skill.

### readme-check.yml
Validates README consistency against skill catalog.

### sync-cli-skill.yml
Automated CLI skill synchronization. Triggered on CLI releases or manual dispatch.

### sync-sdk-skill.yml
Automated SDK skill synchronization. Triggered on SDK releases or manual dispatch.

## Cross-References
- `skills-repo-structure.md` — Skill conventions and categories
- `skills-meta-tooling.md` — sync-cli-skill and sync-sdk-skill workflows
