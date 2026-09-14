# Cognitive Model Routing Taxonomy

> **MIRROR:** model IDs/tables below mirror `references/model-registry.json` (single source). Edit the registry first, then sync this file. Cross-check: WI-357 validation command. Full generation pending WI-364.

This document defines the **host-agnostic** model selection strategy for Serious Vibe Coding. The framework separates:

- **Orchestrator** — the CLI host running the session (Claude Code, Kimi CLI, etc.)
- **Execution Harness** — the model/system that handles each cognitive label
- **Profile** — the mapping from labels to harnesses

Skills reference **cognitive labels** (e.g., `[STRAT]`, `[EXEC]`). The framework resolves each label via `scripts/resolve-model.sh`, which reads the active **profile** from `references/model-registry.json`.

---

## Profiles

A profile defines which harness handles each cognitive label. The framework ships with five profiles:

| Profile | Orchestrator | EXEC Harness | SENSE Harness | Best For |
|---------|-------------|--------------|---------------|----------|
| **`svc-default`** | Any | **Claude Sonnet 5** (effort:high declared) | **MiMo-V2.5-Pro** (key-gated) | Production. Opus strategy/plan + Sonnet 5 execution/review; effort:high declared in the registry, consumer-applied (WI-470) |
| **`kimi-native`** | Kimi | **Kimi** | **Kimi** | Pure Kimi. Everything inside Kimi CLI |
| **`claude-native`** | Claude | **Claude Sonnet** | **Claude Opus** | Pure Claude. No MiMo delegation |
| **`codex-native`** | Codex CLI / app | **GPT-5.5** | **GPT-5.5** | Pure Codex. Best for Windows Codex app + WSL2 |
| **`kimi-orchestrator-mixed`** | Kimi | **MiMo-V2.5** | **MiMo-V2.5-Pro** | Kimi orchestrates + MiMo executes |

**Profile selection:**
```bash
# Auto-selected based on orchestrator host
# Kimi CLI → kimi-native
# Codex CLI/app → codex-native
# Claude Code → svc-default

# Override explicitly:
export SVC_MODEL_PROFILE=svc-default
export SVC_MODEL_PROFILE=codex-native
export SVC_MODEL_PROFILE=kimi-orchestrator-mixed
```

---

## Dynamic Resolution

```bash
# What harness + model should I use for execution right now?
bash scripts/resolve-model.sh EXEC --json

# What harness + model for strategy?
bash scripts/resolve-model.sh STRAT --json

# Just the invocation command:
bash scripts/resolve-model.sh EXEC --invocation
```

---

## The Cognitive Labels

<!-- svc:generated:begin model-routing-cognitive-labels — edit skills-manifest.json / references/model-registry.json, then run: node scripts/generate-manifest-mirrors.mjs --write -->
1.  🧠 **[STRAT] Strategic Determination:** High-stakes decisions, product invention, spatial UX reasoning, resolving ambiguity.
2.  📐 **[PLAN] Architectural Blueprinting:** Dependency graphs, JSON manifests, task logic, strict planning.
3.  ⚙️ **[EXEC] Agentic Execution:** High-volume file editing, terminal commands, running tests, bash loops.
4.  🛡️ **[REVIEW] Grounded Verification:** Code review, architectural drift detection, spec alignment.
5.  👁️ **[SENSE] Temporal / Sensory QA:** Video, UI animations, audio interactions, visual regression.
6.  🌐 **[DISC] Grounded Discovery:** Live docs, competitor pages, exact SDK versions, web search.
7.  🔁 **[PASS] Pass-Through Distillation:** Mechanical extraction, reformatting, no reasoning needed.
<!-- svc:generated:end model-routing-cognitive-labels -->

---

## svc-default Profile (Framework Default)

This is the **production profile**. It mixes models across harnesses for optimal cost/reasoning tradeoffs.

<!-- svc:generated:begin model-routing-svc-default — edit skills-manifest.json / references/model-registry.json, then run: node scripts/generate-manifest-mirrors.mjs --write -->
| Label | Harness | Model | Rationale |
|-------|---------|-------|-----------|
| 🧠 **[STRAT]** | Claude | Opus 4.8 | Highest reasoning depth for strategy |
| 📐 **[PLAN]** | Claude | Opus 4.8 | Deterministic blueprinting |
| ⚙️ **[EXEC]** | Claude | Sonnet 5 | Sonnet 5 execution; effort:high declared (WI-470); MiMo EXEC via keyed profiles |
| 🛡️ **[REVIEW]** | Claude | Sonnet 5 | WI-470 2026-06-30: REVIEW runs on Sonnet 5 (subagents pinned) against the Opus blueprint; effort:high declared here, consumer-applied via the Agent dispatch effort param |
| 👁️ **[SENSE]** | **MiMo** | **MiMo-V2.5-Pro** | Multimodal sensory QA (requires MIMO_API_KEY) |
| 🌐 **[DISC]** | Native | web_search | Live docs via native search |
| 🔁 **[PASS]** | Claude | Haiku 4.5 | Cheapest pass-through extraction |
<!-- svc:generated:end model-routing-svc-default -->

**Key insight:** The orchestrator can be Claude, Kimi, Codex, Gemini, or OpenCode. Since WI-357 (2026-06-06), `svc-default` executes with Claude Sonnet (matching the operative key-gated fallback) and delegates only SENSE to MiMo; MiMo-everything remains available via `opencode-mimo`, and `<orchestrator>-native` profiles cover single-harness setups (`kimi-native`, `claude-native`, `codex-native`).

---

## kimi-native Profile

Everything inside Kimi CLI. No cross-harness delegation.

| Label | Harness | Model | Toggle |
|-------|---------|-------|--------|
| 🧠 **[STRAT]** | Kimi | `kimi-for-coding` | thinking ON |
| 📐 **[PLAN]** | Kimi | `kimi-for-coding` | thinking ON |
| ⚙️ **[EXEC]** | Kimi | `kimi-for-coding` | thinking OFF |
| 🛡️ **[REVIEW]** | Kimi | `kimi-for-coding` | thinking ON |
| 👁️ **[SENSE]** | Kimi | `kimi-for-coding` | thinking ON |
| 🌐 **[DISC]** | Native | SearchWeb | — |
| 🔁 **[PASS]** | Kimi | `kimi-for-coding` | thinking OFF |

---

## Pipeline Routing Matrix

All profiles share the same cognitive labels. Only the harness changes.

### Layer 1: Pre-Pipeline & Product

| Skill | Label | Rationale |
| :--- | :--- | :--- |
| `write-vision` | 🧠 **[STRAT]** | Define the "North Star" |
| `validate-feature` | 🧠 **[STRAT]** | Cross-examine business viability |
| `monetization-architecture` | 🧠 **[STRAT]** + 🌐 **[DISC]** | Maps features to tiers + live API limits |
| `analyze-competitors` | ⚙️ **[EXEC]** + 🌐 **[DISC]** | Heavy scraping, cheap text processing |

### Layer 2: Design & Spec

| Skill | Label | Rationale |
| :--- | :--- | :--- |
| `write-spec` | 🧠 **[STRAT]** | Strict BDD scenario mapping |
| `write-journeys` | 🧠 **[STRAT]** | Traceable journey generation |
| `design-ux` | 🧠 **[STRAT]** | Spatial reasoning for state machines |
| `design-ui` | 🧠 **[STRAT]** | Design-token generation |

### Layer 3: Tech & Planning

| Skill | Label | Rationale |
| :--- | :--- | :--- |
| `design-tech` | 🧠 **[STRAT]** | Database schema, system architecture |
| `explore-solutions` | 🧠 **[STRAT]** + 🌐 **[DISC]** | Challenge design with live comparisons |
| `plan-changeset` | 📐 **[PLAN]** | **CRITICAL:** strict manifest + task graph |

### Layer 4: Implementation

| Skill | Label | Rationale |
| :--- | :--- | :--- |
| `execute-changeset` | ⚙️ **[EXEC]** | Reads plan, writes code, runs tests |
| `quick-fix` | ⚙️ **[EXEC]** | Fast-lane typo fixing |
| `diagnose-bug` | 🧠 **[STRAT]** + 🌐 **[DISC]** | Root-cause + live issue-tracker data |

### Layer 5: QA, Audit, and Vibe Check

| Skill | Label | Rationale |
| :--- | :--- | :--- |
| `review-gate` | 🛡️ **[REVIEW]** | Detects architectural drift |
| `audit-implementation` | 🛡️ **[REVIEW]** | Correctness audit against spec |
| `verify-promotion` | 🛡️ **[REVIEW]** | Checks deployed artifacts |
| `land-changeset` | ⚙️ **[EXEC]** | Mechanical git ops |
| `track-visuals` | 👁️ **[SENSE]** | Video/screen recording analysis |
| `test-journeys` (E2E) | ⚙️ **[EXEC]** | Playwright/Cypress execution |
| `test-journeys` (Voice) | 👁️ **[SENSE]** | Voice-agent / real-time video testing |

---

## For Skill Authors

When writing a SKILL.md that spawns an external agent or recommends a model:

**❌ Don't do this:**
> "Use Claude Opus 4.8 for this step."

**✅ Do this:**
> "Use the [STRAT] label for this step. The framework resolves it via `bash scripts/resolve-model.sh STRAT`. Under `svc-default` this is Claude Opus; under `kimi-native` this is `kimi-for-coding` with thinking ON."

This keeps skills portable across all orchestrators and profiles.

---

## Detached Kimi Runner — Per-Skill Cap Defaults

The detached Kimi runner (`scripts/run-kimi-detached.sh`, see
`references/kimi-detached-pattern.md`) reads the block below to pick a
default `--max-seconds` for the calling skill. Caller may override via
`--max-seconds`; `KIMI_DETACHED_HARD_CAP` env (default 7200) truncates
whatever the caller asked for.

The block is machine-parsed by the runner. Add a row only when a skill
needs a cap different from the bucket defaults; the runner falls back to
`default` for anything it doesn't find.

<!-- KIMI_DETACHED_CAPS_BEGIN -->
default=1800
review=1200
ingestion=3600
research=3600
exploration=1800
ingest-guide=3600
ingest-guide-batch=3600
explore-solutions=1800
<!-- KIMI_DETACHED_CAPS_END -->

| Skill / bucket | Default cap | Rationale |
|---|---|---|
| `default` | 1800s (30 min) | Safe ceiling for most skills |
| `review` | 1200s (20 min) | Mirrors hook-side review timeout |
| `ingestion` / `ingest-guide` / `ingest-guide-batch` | 3600s (60 min) | Long social-content extractions |
| `research` | 3600s (60 min) | Multi-source synthesis runs long |
| `exploration` / `explore-solutions` | 1800s (30 min) | Alternative-paradigm comparison |

To raise the hard cap (e.g., for a one-off batch run):

```bash
KIMI_DETACHED_HARD_CAP=10800 scripts/run-kimi-detached.sh \
  --skill research --prompt-file /tmp/p --max-seconds 10800
```
