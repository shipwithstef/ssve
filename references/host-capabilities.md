# Host Capability Matrix

## Execution Controller v2 ingress

Every provisioned host declares `runtime_ingress_v2`. Hook-capable hosts normalize lifecycle events
through a thin hook adapter with the same CLI fallback; Antigravity uses the CLI adapter.
Both transports append generation-bound events to the canonical runtime journal. Lane tasks,
orchestrator state, receipt mirrors and decision logs are generated projections and never writable
workflow truth. Hooks remain optional normalization/UX adapters, not authority, containment,
progress, completion or security boundaries. See `scripts/svc-host-runtime-adapter-v2.mjs`.

Reference doc for orchestrator hosts supported by Serious Vibe Coding. Skills and route-workflow can consult this matrix when deciding whether to use host-specific features (e.g., Kimi `/flow`, Claude hooks, native background tasks).

**This doc is purely additive.** It does not change routing logic — it only informs the agent of available capabilities on the current host.

---

## Capability Definitions

| Capability | Description |
|------------|-------------|
| **Skills** | Auto-discovery of `SKILL.md` files |
| **Hooks** | Lifecycle event hooks (PreToolUse, PostToolUse, Stop, etc.) |
| **Plugins** | Custom executable tools via `plugin.json` |
| **MCP** | Model Context Protocol servers |
| **Commands** | Slash commands (`/skill`, `/plan`, `/model`, etc.) |
| **Agents** | Custom agent definitions with system prompts and tool lists |
| **Subagents** | Built-in subagent types (coder, explore, plan) |
| **Flow Skills** | Multi-step automated workflows via Mermaid/D2 + `/flow` |
| **Background Tasks** | Native `Shell(run_in_background=true)` + task browser |
| **Thinking Toggle** | ON/OFF reasoning mode per request |
| **Plan Mode** | Built-in read-only planning mode with approval gates |
| **Side Questions** | Isolated context side-chat without modifying conversation |
| **Session Export/Import** | Save and resume session state |
| **Stable Authority Identity** | Stable session and, for children, independently attributable dispatch principal |
| **Filesystem Containment** | Host sandbox or probed wrapper that kernel-denies writes outside the delegated worktree |

---

## Matrix

| Capability | Claude Code | Kimi CLI | Codex CLI | Gemini CLI | OpenCode CLI | Antigravity | Cursor | Grok Build |
|------------|:-----------:|:--------:|:---------:|:----------:|:------------:|:-----------:|:------:|:----------:|
| Skills | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Hooks | ✅ | ✅ (beta) | ✅ (opt-in) | ✅ | ✅ (plugin) | ❌ skills-only | ✅ (native) | ✅ (native) |
| Plugins | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ |
| MCP | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Commands | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Agents | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Subagents | ❌ | ✅ (built-in) | ❌ | ❌ | ✅ (general/explore) | ❌ | ❌ | ❌ |
| Flow Skills | ❌ | ✅ (`/flow`) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Background Tasks | ❌ | ✅ (native) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Thinking Toggle | ❌ | ✅ (`/model`) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Plan Mode | ❌ | ✅ (`/plan`) | ❌ | ❌ | ✅ (Tab key) | ❌ | ❌ | ❌ |
| Side Questions | ❌ | ✅ (`/btw`) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Session Export/Import | ❌ | ✅ (`/export`, `/import`) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

### Skills-Only Hosts

Antigravity is a first-class install target for `SKILL.md` discovery and framework infrastructure, but is not a hook-enforced host yet. Its manifest sets `capabilities.hooks=false`, and `references/canonical-gates.json` classifies it under `skills_only_hosts` until a host-specific hook wirer is researched, implemented, and validated.

Route output and reviews must describe Antigravity as **skills-only** or **limited** for enforcement. Do not claim "cross-host hook enforcement" includes Antigravity; `.svc/lane-tasks-<WI>.json` remains the source of truth for that host.

## Durable Mutation Authority

The `authority_capabilities` object in each provisioned manifest is the
machine-readable source of truth. Claude, Codex, Gemini, Kimi, Cursor, and Grok
can enable mutating child execution only after the canonical Landlock wrapper
probe passes; OpenCode and MiMo-Code remain controller-only because their current
plugin is observational and cannot enforce path-scoped capability checks.
Antigravity remains skills-only.

PreTool classification rejects obvious cross-root forms and validates authority,
but it is an authority guardrail, not a complete shell security boundary. Shell
execution containment comes from the host sandbox or
`scripts/svc-contained-exec.mjs`. If the configured backend cannot be probed,
dispatch denies before child launch.

---

## When to Leverage Host-Specific Features

Skills should remain **host-agnostic** in their core contract. However, when a skill detects it is running on a host with extra capabilities, it may optionally use them for better UX or efficiency.

### Kimi CLI Unique Features

| Feature | Skill Use Case |
|---------|----------------|
| `/flow:<skill>` | Multi-step skills (`code-review`, `release`) can auto-execute their full flow instead of loading as a static prompt |
| Subagents (`coder`/`explore`/`plan`) | Parallel exploration + planning + coding without polluting main context |
| Background tasks (`run_in_background=true`) | Long builds/tests run in parallel while the agent continues planning |
| `/btw` | Side questions during review gates without derailing the main task graph |
| `/plan` | Plan mode for architectural decisions before touching code |
| Thinking toggle | Deep reasoning for STRAT/PLAN/REVIEW; fast direct response for PASS |

### Claude Code Unique Features

| Feature | Skill Use Case |
|---------|----------------|
| Hooks (`PreToolUse`, `PostToolUse`, `Stop`) | Config-protection guards, eval-gate enforcement, task-completion blocks |
| `CLAUDE.md` auto-injection | Project context automatically loaded every session |

### Codex CLI

| Feature | Skill Use Case |
|---------|----------------|
| Cross-model review | Natural second-opinion harness for `review-cross-model` skill |
| Hooks | Bash/apply_patch/MCP guardrails when `[features] hooks = true` |
| Windows app + WSL2 | Use WSL2 when the repo and tooling live under `/home/...`; install Linux Node.js inside WSL for svc hook scripts |

### Gemini CLI

| Feature | Skill Use Case |
|---------|----------------|
| Large context (1M tokens) | Good for massive codebase onboarding or long document analysis |

---

## Host-Agnostic Fallback Rule

When writing a skill that can benefit from a host-specific feature:

1. **Default path:** Write the skill using only universal tools (ReadFile, WriteFile, Shell, Grep, etc.). This works on every host.
2. **Enhancement path:** Add an optional note: *"If running on Kimi CLI, you may use `/flow:<name>` to auto-execute this multi-step workflow."*
3. **Never require a host-specific feature** for the skill to function.

This ensures skills degrade gracefully when moved between hosts.
