---
description: Host-agnostic model selection via cognitive labels and dynamic resolver
scope: project
stack: universal
source: blended:ecc
source_sha: 125d5e619905d97b519a887d5bc7332dcc448a52
---

# Model Selection for Agent Tasks

> **MIRROR:** model IDs/tables below mirror `references/model-registry.json` (single source). Edit the registry first, then sync this file. Cross-check: WI-357 validation command. Full generation pending WI-364.

This framework uses **host-agnostic cognitive labels** instead of hardcoded model IDs. The resolver (`scripts/resolve-model.sh`) maps each label to the best model for the currently running host.

## Quick Reference

<!-- svc:generated:begin model-selection-quick-ref — edit skills-manifest.json / references/model-registry.json, then run: node scripts/generate-manifest-mirrors.mjs --write -->
```bash
# Resolve the current host's model for a cognitive label
bash scripts/resolve-model.sh STRAT   # Strategic reasoning
bash scripts/resolve-model.sh EXEC    # File editing / execution
bash scripts/resolve-model.sh REVIEW  # Code review / verification
bash scripts/resolve-model.sh PASS    # Lightweight extraction
```
<!-- svc:generated:end model-selection-quick-ref -->

## Cognitive Labels

<!-- svc:generated:begin model-selection-cognitive-labels — edit skills-manifest.json / references/model-registry.json, then run: node scripts/generate-manifest-mirrors.mjs --write -->
| Label | Icon | Use for | Host Resolution |
|-------|------|---------|-----------------|
| **[STRAT]** | 🧠 | Strategic decisions, architecture, north-star definition | `scripts/resolve-model.sh STRAT` |
| **[PLAN]** | 📐 | Blueprinting, dependency graphs, manifest creation | `scripts/resolve-model.sh PLAN` |
| **[EXEC]** | ⚙️ | File edits, bash commands, tests, execution | `scripts/resolve-model.sh EXEC` |
| **[REVIEW]** | 🛡️ | Code review, drift detection, spec alignment | `scripts/resolve-model.sh REVIEW` |
| **[SENSE]** | 👁️ | Video, UI animations, visual regression | `scripts/resolve-model.sh SENSE` |
| **[DISC]** | 🌐 | Web search, live docs, competitor research | Native web tools (no model) |
| **[PASS]** | 🔁 | Mechanical extraction, reformatting, no reasoning | `scripts/resolve-model.sh PASS` |
<!-- svc:generated:end model-selection-cognitive-labels -->

## Host-Specific Resolutions

| Label | Claude Code | Kimi CLI | Gemini CLI | Codex CLI | OpenCode CLI |
|-------|-------------|----------|------------|-----------|--------------|
| **[STRAT]** | Claude Opus 4.8 | `kimi-for-coding` + thinking ON | Gemini 2.5 Pro | o3 | MiMo V2.5-Pro |
| **[PLAN]** | Claude Opus 4.8 | `kimi-for-coding` + thinking ON | Gemini 2.5 Pro | o3 | MiMo V2.5-Pro |
| **[EXEC]** | Claude Sonnet 4.6 | `kimi-for-coding` + thinking OFF | Gemini 2.5 Flash | codex | MiMo V2.5 |
| **[REVIEW]** | Claude Sonnet 4.6 | `kimi-for-coding` + thinking ON | Gemini 2.5 Pro | codex | MiMo V2.5-Pro |
| **[SENSE]** | Claude Opus 4.8 | `kimi-for-coding` + thinking ON | Gemini 2.5 Pro | gpt-4o | MiMo V2.5-Pro |
| **[PASS]** | Claude Haiku 4.5 | `kimi-for-coding` + thinking OFF | Gemini 2.5 Flash | gpt-4o-mini | MiMo V2.5 |

For full details see `references/model-routing.md` and `references/model-registry.json`.

## Context Window Management

Avoid the last 20% of context for:
- Large-scale refactoring spanning multiple files
- Feature implementation across many interdependent files
- Debugging complex cross-file interactions

Lower context-sensitivity tasks (safe to run at any context depth):
- Single-file edits
- Independent utility creation
- Documentation updates
- Simple bug fixes

## When to Apply

- Designing a multi-agent system → assign Haiku to worker agents by default
- Orchestrator agent → Sonnet
- One-shot deep reasoning tasks (architectural decisions, plan evaluation) → Opus
