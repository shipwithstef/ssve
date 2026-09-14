# Model Toggle & Profile Reference

> **MIRROR:** model IDs/tables below mirror `references/model-registry.json` (single source). Edit the registry first, then sync this file. Cross-check: WI-357 validation command. Full generation pending WI-364.

Serious Vibe Coding uses **profiles** to map cognitive labels to execution harnesses. A profile defines which model handles each type of work (strategy, execution, review, etc.).

---

## Architecture: Orchestrator vs Harness

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Orchestrator  │────→│     Profile     │────→│    Harness      │
│  (Claude/Kimi/  │     │  (svc-default/  │     │ (Claude/MiMo/   │
│Codex/Gemini/OC) │     │ kimi-native/etc)│     │   Kimi/Native)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

- **Orchestrator** — the CLI host running the session. Auto-detected by `scripts/detect-host.sh`.
- **Profile** — the label-to-harness mapping. Selected automatically or via `SVC_MODEL_PROFILE`.
- **Harness** — the actual model/system that executes the work.

---

## Built-in Profiles

### `svc-default` (Production Default)
The framework's proven multi-harness mixing. Used automatically when Claude Code is the orchestrator.

| Label | Harness | Model |
|-------|---------|-------|
| [STRAT] | Claude | Opus 4.8 |
| [PLAN] | Claude | Opus 4.8 |
| [EXEC] | Claude | Sonnet 4.6 |
| [REVIEW] | Claude | Sonnet 4.6 |
| [SENSE] | **MiMo** | **MiMo-V2.5-Pro** |
| [DISC] | Native | web_search |
| [PASS] | Claude | Haiku 4.5 |

### `kimi-native` (Kimi Default)
Auto-selected when Kimi CLI is the orchestrator. Everything stays inside Kimi.

| Label | Harness | Model |
|-------|---------|-------|
| [STRAT] | Kimi | `kimi-for-coding` + thinking ON |
| [PLAN] | Kimi | `kimi-for-coding` + thinking ON |
| [EXEC] | Kimi | `kimi-for-coding` + thinking OFF |
| [REVIEW] | Kimi | `kimi-for-coding` + thinking ON |
| [SENSE] | Kimi | `kimi-for-coding` + thinking ON |
| [DISC] | Native | SearchWeb |
| [PASS] | Kimi | `kimi-for-coding` + thinking OFF |

### `claude-native`
Everything inside Claude Code. No MiMo delegation.

### `kimi-orchestrator-mixed` (Experimental)
Kimi orchestrates + MiMo executes (V2.5) + MiMo senses (V2.5-Pro).

---

## How to Select a Profile

### Auto-Selection (Default)
The framework picks a profile based on the detected orchestrator:

| Orchestrator | Auto-Selected Profile |
|--------------|----------------------|
| Claude Code | `svc-default` |
| Kimi CLI | `kimi-native` |
| Codex CLI / app | `codex-native` |
| Gemini CLI | `svc-default` |

### Explicit Override
```bash
# Use the production mixed profile regardless of orchestrator
export SVC_MODEL_PROFILE=svc-default

# Use pure Kimi regardless of orchestrator
export SVC_MODEL_PROFILE=kimi-native

# Use pure Codex regardless of orchestrator
export SVC_MODEL_PROFILE=codex-native

# Use Kimi + MiMo mixing
export SVC_MODEL_PROFILE=kimi-orchestrator-mixed
```

### Per-Skill Override
Force a specific harness/model for one skill:
```bash
export SVC_EXECUTE_CHANGESET_HARNESS=mimo
export SVC_EXECUTE_CHANGESET_MODEL=mimo-v2.5
```

---

## Dynamic Resolution

```bash
# Resolve a label through the active profile
bash scripts/resolve-model.sh STRAT
# → claude:claude-opus-4-8  (svc-default)
# → kimi:kimi-for-coding     (kimi-native)

# Full JSON with harness, model, rationale, invocation command
bash scripts/resolve-model.sh EXEC --json

# Just the invocation command (for spawning external agents)
bash scripts/resolve-model.sh EXEC --invocation
# → claude -p --model claude-sonnet-4-6  (svc-default, WI-357)
# → opencode run --model mimo/mimo-v2.5  (opencode-mimo)
```

---

## Cross-Model Reviewer

Specific to `review-cross-model` and `review-plan` skills. Controls the adversarial second opinion.

| Env Var | Behavior |
|---------|----------|
| `SVC_CROSS_MODEL_REVIEWER=codex` (default) | Use OpenAI Codex CLI for second opinion |
| `SVC_CROSS_MODEL_REVIEWER=kimi` | Use a second Kimi instance |
| `SVC_CROSS_MODEL_REVIEWER=sonnet` | Use Claude Sonnet |

---

## MiMo Harness Setup

MiMo is an **execution harness**, not an orchestrator host. To use MiMo for EXEC/SENSE:

1. Install OpenCode CLI + MiMo config: see `references/opencode-mimo-config.json` (and set `MIMO_API_KEY`)
2. Use `opencode-mimo` or `kimi-orchestrator-mixed` profile (svc-default executes on Sonnet since WI-357)
3. The resolver will emit `opencode run --model mimo/mimo-v2.5` as the invocation under those profiles

---

## Backward Compatibility

- **No env vars set:** Framework auto-detects orchestrator and picks an appropriate profile.
- **Claude users:** Continue using `svc-default` (the production profile). Since WI-357 its EXEC runs on Sonnet 4.6; only SENSE delegates to MiMo (key-gated).
- **Kimi users:** Get `kimi-native` by default. Set `SVC_MODEL_PROFILE=kimi-orchestrator-mixed` (or `opencode-mimo`) if you want MiMo execution delegation.
- **Codex users:** Get `codex-native` by default, especially on Windows app + WSL2 where external delegate CLIs may not be installed.
- **Skills:** Reference cognitive labels only. No SKILL.md changes needed.

---

## Reference Files

| File | Purpose |
|------|---------|
| `references/model-registry.json` | Canonical registry: orchestrators, harnesses, profiles |
| `references/model-routing.md` | Host-agnostic routing taxonomy |
| `references/model-routing-kimi.md` | Kimi-specific guidance |
| `scripts/detect-host.sh` | Orchestrator auto-detection |
| `scripts/resolve-model.sh` | Label → harness + model resolution |
