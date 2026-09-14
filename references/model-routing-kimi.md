# Kimi Code CLI — Profile & Orchestrator Guide

> **MIRROR:** model IDs/tables below mirror `references/model-registry.json` (single source). Edit the registry first, then sync this file. Cross-check: WI-357 validation command. Full generation pending WI-364.

This document explains how Kimi Code CLI fits into the svc model routing system defined in `references/model-routing.md`.

---

## Kimi as Orchestrator

Kimi Code CLI is a **first-class orchestrator host**. You can run the entire svc framework inside Kimi:

```bash
./setup --host kimi
cd your-project && kimi
```

When Kimi is detected as the orchestrator, the framework auto-selects the **`kimi-native`** profile by default. This means:
- Strategy → `kimi-for-coding` + thinking ON
- Execution → `kimi-for-coding` + thinking OFF
- Review → `kimi-for-coding` + thinking ON

No MiMo. No Claude. Everything stays inside Kimi.

---

## Kimi + MiMo Mixing

If you want Kimi to **orchestrate** but **delegate execution to MiMo** (the framework's proven pattern), switch profiles:

```bash
export SVC_MODEL_PROFILE=kimi-orchestrator-mixed
kimi
```

| Label | Harness | Model |
|-------|---------|-------|
| 🧠 [STRAT] | Kimi | `kimi-for-coding` + thinking ON |
| 📐 [PLAN] | Kimi | `kimi-for-coding` + thinking ON |
| ⚙️ [EXEC] | **MiMo** | **MiMo-V2.5** |
| 🛡️ [REVIEW] | Kimi | `kimi-for-coding` + thinking ON |
| 👁️ [SENSE] | **MiMo** | **MiMo-V2.5-Pro** |
| 🌐 [DISC] | Native | SearchWeb |
| 🔁 [PASS] | Claude | Haiku 4.5 (cheapest extraction) |

Or use the framework's **production default** (`svc-default`): STRAT/PLAN on Opus, EXEC/REVIEW on Sonnet, PASS on Haiku, SENSE delegated to MiMo when `MIMO_API_KEY` is set (WI-357) — regardless of which CLI is the orchestrator:

```bash
export SVC_MODEL_PROFILE=svc-default
kimi
```

---

## Kimi Model Characteristics

| Attribute | Value |
|-----------|-------|
| Model ID | `kimi-for-coding` (Kimi k2.6) |
| Context window | 256K tokens |
| Thinking toggle | ON/OFF via `--thinking` or `/model` |
| Background tasks | Native (`Shell` + `run_in_background=true`) |
| Subagents | `coder`, `explore`, `plan` built-in |

The same model ID serves every cognitive label — only the **thinking mode** changes.

---

## Label-by-Label Guidance (kimi-native)

### 🧠 [STRAT] — Strategic Determination
- **Model:** `kimi-for-coding` + **thinking ON**
- **When:** Product vision, feature validation, monetization architecture
- **Tip:** Use `/plan` mode for strategic decisions.

### 📐 [PLAN] — Architectural Blueprinting
- **Model:** `kimi-for-coding` + **thinking ON**
- **When:** Tech design, plan-changeset manifest, database schema
- **Tip:** Spawn a `plan` subagent for complex multi-file plans.

### ⚙️ [EXEC] — Agentic Execution
- **Model:** `kimi-for-coding` + **thinking ON**
- **When:** File edits, bash commands, test execution
- **Why thinking ON:** Complex multi-file changesets with interdependencies benefit from chain-of-thought reasoning to follow the manifest precisely.
- **Tip:** For trivial quick-fixes (≤3 files), use `quick-fix` skill or toggle thinking OFF via `/model` for lower latency.
- **Tip:** Enable YOLO mode (`/yolo`) for mechanical execution of a reviewed manifest.
- **Tip:** Batch `StrReplaceFile` edits. Use `run_in_background=true` for builds/tests.

### 🛡️ [REVIEW] — Grounded Verification
- **Model:** `kimi-for-coding` + **thinking ON**
- **When:** Code review, audit-implementation, verify-promotion, review-plan
- **Tip:** For adversarial plan review, use `scripts/review-plan-kimi.sh <manifest.md>` — produces the same structured YAML findings as Codex/Claude reviewers. This is the universal fallback when no other model family is installed.

### 👁️ [SENSE] — Temporal / Sensory QA
- **Model:** `kimi-for-coding` + **thinking ON**
- **When:** Video analysis, UI animation evaluation
- **Tip:** Use `ReadMediaFile`. Keep clips under input limits.

### 🌐 [DISC] — Grounded Discovery
- **Tool:** Native `SearchWeb` + `FetchURL`
- **When:** Live docs, competitor pages, SDK versions
- **Tip:** `SearchWeb(include_content=true)` when you need page content.

### 🔁 [PASS] — Pass-Through Distillation
- **Model:** `kimi-for-coding` + **thinking OFF**
- **When:** Summary extraction, log parsing, SVC_WORKER_SUMMARY blocks
- **Tip:** `--thinking=false --tools ""` guarantees input-in → output-shape-out.

---

## Configuration

The framework auto-detects Kimi CLI via `scripts/detect-host.sh`.

```bash
# Verify detection
bash scripts/detect-host.sh
# → kimi

# Verify default profile resolution
bash scripts/resolve-model.sh STRAT --json
# → { "profile": "kimi-native", "model": "kimi-for-coding", "thinking": true, ... }

# Switch to mixed profile
export SVC_MODEL_PROFILE=svc-default
bash scripts/resolve-model.sh EXEC --json
# → { "profile": "svc-default", "harness": "claude", "model": "claude-sonnet-4-6", ... }   # WI-357
```

Toggle thinking mode mid-session:
```
/model
# Select kimi-for-coding, enable/disable thinking
```

Or CLI flags:
```bash
kimi --thinking --prompt "Design the database schema..."
kimi --no-thinking --prompt "Fix the typo in src/utils.ts"
```
