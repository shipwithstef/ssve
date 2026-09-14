# Agent Skills Integration (Layer 3)

## Mechanism

stitch-mcp docs promote pairing with [agentskills.io](https://agentskills.io) —
a skill format stitch-mcp adopts without defining. An Agent Skill is just a
directory with a `SKILL.md` file. No SDK, no runtime, no build step.

### `SKILL.md` format

```yaml
---
name: design-review                         # lowercase, hyphens, ≤64 chars, matches dir name
description: Review UI implementations ...  # ≤1024 chars, used for activation matching
license: MIT                                # optional
compatibility: Requires npx and network access to the Stitch API.
allowed-tools: mcp__stitch__get_screen mcp__stitch__list_screens Bash(stitch:*) Read
metadata:
  author: your-org
  version: "1.0"
---
## When to activate
...
## Steps
...
```

### Directory layout

```
design-review/
├── SKILL.md
├── scripts/       # optional executable helpers
├── references/    # optional extra docs (loaded on demand)
└── assets/        # optional templates, schemas
```

### Progressive disclosure (3 stages)

1. **Metadata** (~100 tokens) — `name` + `description` loaded at startup for all skills
2. **Instructions** (<5000 tokens) — full `SKILL.md` body loaded on activation
3. **Resources** (on demand) — `scripts/`, `references/`, `assets/` loaded only when referenced

Only the `description` costs tokens every session — so it MUST contain the
verbs/nouns users naturally say.

### `allowed-tools` field

Pre-approved tools the agent can call without prompting. Mix of:
- MCP tools: `mcp__stitch__get_screen`, `mcp__stitch__list_screens`
- Bash patterns: `Bash(stitch:*)`, `Bash(npx:*)`
- File access: `Read`, `Write`

Format varies by agent — "experimental" per the docs. Most Stitch skills list
both MCP names (for proxy-connected agents) and Bash patterns (CLI fallback).

### Validation

```bash
npx skills-ref validate ./my-skill
```

### Existing ecosystem

Reference: [google-labs-code/stitch-skills](https://github.com/google-labs-code/stitch-skills) (not extracted here)

| Skill | Purpose |
|-------|---------|
| `react-components` | Screens → React component systems with design token consistency |
| `design-md` | Project → `DESIGN.md` design system doc |
| `stitch-loop` | Prompt → complete multi-page site |
| `enhance-prompt` | Vague UI idea → polished Stitch prompt |
| `remotion` | Stitch projects → walkthrough videos |
| `shadcn-ui` | shadcn/ui + Stitch integration |

### Example skill pattern

`design-review` is the canonical example: retrieves design HTML via
`get_screen_code`, fetches screenshot via `get_screen_image`, reads user's
implementation files, diffs computed styles, reports discrepancies by
category (Colors, Typography, Spacing, Layout, Components).

## Analysis — competitive positioning vs svc

- **Format overlap:** svc skills and Agent Skills share the `SKILL.md` +
  frontmatter + body structure. Both use progressive disclosure. Both advise
  keeping body <500 lines with details in sub-dirs.
- **Scope difference:** svc skills are workflow/pipeline primitives with
  chain/gates/self_verify fields. Agent Skills are looser — just name,
  description, allowed-tools, arbitrary metadata.
- **Marketplace:** agentskills.io is a growing ecosystem alongside skills.sh,
  SkillHub, SkillsMP. Worth adding to `references/knowledge/skill-marketplaces/`
  inventory on next refresh.
- **Cross-compatibility:** svc could emit Agent-Skills-compatible frontmatter
  (subset of svc frontmatter) to allow svc skills to be consumed by non-svc
  agents. Low effort if frontmatter mapping is explicit.
- **`stitch-skills` as reference competitor:** the 6 existing skills
  (especially `react-components`, `design-md`, `stitch-loop`) are direct
  examples of "composing MCP tools into pipeline-like workflows" — which is
  what svc does at larger scale.

## Layer 4 pointers

- Format spec: https://agentskills.io
- Example repo: https://github.com/google-labs-code/stitch-skills (unextracted)
- stitch-mcp docs: `docs/agent-skills.md`, `docs/build-agent-skills.md`
- svc marketplace knowledge: `references/knowledge/skill-marketplaces/CAPABILITIES.md`
- Validator CLI: `npx skills-ref validate`
