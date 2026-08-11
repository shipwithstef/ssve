# Base44 Skills And Versioning - Detail

## Mechanism (factual)

Base44's official docs treat skills as a first-class AI-development surface and explicitly say they should be kept in sync with the CLI.

On 2026-04-18, the version-specific facts were:

- npm `base44` latest: `0.0.50`
- npm publish time for `0.0.50`: `2026-03-30T13:14:35.199Z`
- official skills repo: `https://github.com/base44/skills`
- skills repo HEAD at research time: `c7039b37eca0e2916a565a7395040c00055bcf8b`
- skills repo `CLI_VERSION`: `v0.0.50`
- skills repo `.claude-plugin/plugin.json` version: `1.0.0-beta.1`
- skills repo `.claude-plugin/marketplace.json` version: `1.0.0-beta.1`

The source repo contains more than the three public Base44 skills. It includes:

- `skills/base44-cli`
- `skills/base44-sdk`
- `skills/base44-troubleshooter`
- plugin metadata for Claude and Cursor
- internal sync/review skills under `.claude/skills/`
- CI workflows for sync and validation

When installed globally via `npx skills add base44/skills -g -y`, the user-facing installed pack exposes the three public skills under `~/.agents/skills/`:

- `base44-cli`
- `base44-sdk`
- `base44-troubleshooter`

The installed `base44-cli` skill includes frontmatter metadata:

```yaml
metadata:
  sourcePackage:
    name: base44
    version: 0.0.50
```

That is the strongest local indicator that the installed skill pack was intended to align with CLI `0.0.50`.

The official docs page for skills confirms:

- install globally with `npx skills add base44/skills -g`
- Base44 skills are maintained in `base44/skills`
- keep skills in sync with the CLI after CLI upgrades

The changelog records a key milestone on February 28, 2026:

- Base44 skills gained a dedicated `base44-troubleshooter` skill
- global installation via `npx skills add base44/skills -g` was announced

One notable internal inconsistency exists between official surfaces:

- official docs recommend global CLI install via `npm install -g base44@latest`
- the `base44-cli` skill text says "NEVER call `base44` directly" and insists on `npx base44 ...` / local dependency usage

So the product docs and the skill pack are aligned on version matching, but not perfectly aligned on invocation style.

## Analysis (expert commentary)

- **Useful for:** deciding whether a machine is actually aligned with the latest Base44 agent/tooling stack and recording an exact revision instead of vague "latest" language.
- **Trade-offs:** the version chain is split across npm, docs, plugin manifests, and skill frontmatter. That gives several cross-check points, but it also means drift can show up in subtle ways.
- **Similar to:** toolchains where the CLI, plugin pack, and registry package evolve together but are published through separate channels.
- **Could improve svc by:** teaching Base44-oriented skills to verify four things together: npm CLI version, skills repo HEAD or manifest version, local installed skill pack, and docs/changelog sync guidance.
- **Assumptions:** a freshly installed global skill pack from `npx skills add base44/skills -g -y` corresponds closely to repo HEAD at install time; the local install does not preserve a standalone commit marker beyond file contents and source metadata.
- **Watch out for:** the `base44-cli` skill's "local installation only" doctrine conflicts with official Base44 docs that recommend global CLI install. Teams should treat that as a real ambiguity and choose one house rule instead of mixing invocation styles casually.

## Key Source Files (L4 pointers)

- `https://docs.base44.com/developers/backend/overview/skills`
- `https://docs.base44.com/developers/changelog`
- `https://docs.base44.com/developers/references/cli/get-started/overview`
- `https://github.com/base44/skills`
- `base44/skills@c7039b37:CLI_VERSION`
- `base44/skills@c7039b37:.claude-plugin/plugin.json`
- `base44/skills@c7039b37:.claude-plugin/marketplace.json`
- `base44/skills@c7039b37:skills/base44-cli/SKILL.md`
- `base44/skills@c7039b37:skills/base44-sdk/SKILL.md`
- `base44/skills@c7039b37:skills/base44-troubleshooter/SKILL.md`
