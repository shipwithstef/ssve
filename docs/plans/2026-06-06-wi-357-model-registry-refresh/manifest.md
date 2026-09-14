# Manifest: WI-357 — Model-Registry Refresh + Single-Sourced Model Tables + EXEC Economics Decision

- **Feature spec:** `docs/specs/work-items/WI-357.md` (framework WI — the WI doc is the spec)
- **Branch:** `refactor-wi-357-model-registry`
- **Status:** SIMULATED (22/22 file-level checks PASS, 2026-06-06 — see §Simulation Report)
- **Base branch / SHA:** `main` @ `dfe22a00` (origin-synced)
- **Created:** 2026-06-06T15:45Z
- **Lane:** framework (full mandatory chain; worktree required at execution)
- **Archetype:** Migration/sweep + embedded bounded decision (EXEC economics)

## Migration Universe (grep baseline, recorded before planning — `.svc/plan-changeset-archetype.log`)

| Pattern family | Live-surface files | Instances (repo-wide incl. historical) |
|---|---|---|
| `claude-opus-4-[0-9]` | 11 | 24 |
| `Opus 4\.[0-9]` | 22 | 101 |
| `claude-sonnet-*` | 8 | 17 |
| `Sonnet 4\.[0-9]` | 15 | 42 |
| `claude-haiku-*` | 8 | 17 |
| `Haiku 4\.[0-9]` | 12 | 21 |
| `gpt-5*/gpt-4o/o3` | 19 | 72 |
| `gemini-N.N / Gemini 2.x` | 18 | 158 |
| `kimi-for-coding / mimo-v2 / MiMo-V2` | 25 | 180 |

**Phase 1 (THIS changeset) — resolution-path surfaces (12 files modified; was 10, +2 from Tier-3 review NEW-002):** files consumed by `scripts/resolve-model.sh` / `scripts/resolve-adversarial-reviewer.sh` / dispatch preflight, or claiming to be authoritative tables/mirrors. **Coverage: 12/12 doc/config resolution-path files; 2 executable transport defaults deferred to WI-367 with preflight-gating evidence (see Files Planned disposition note).**

**Deferred (explicitly, with counts — NOT silent scope reduction; content/historical surfaces that do not feed resolution):** docs/analysis (3 — evaluation records old pins as findings, frozen), proposals + proposals/done (~12, historical), docs/specs/research-* logs/prescopes (5, historical), docs/specs/rules-evaluation fixtures (5, frozen test evidence), framework-parity scorecards (2, historical), manage-finops vendor-pricing references (6 — vendor content, owned by finops refresh cadence), generate-visuals provider matrix (3 — separate provider registry domain), references/knowledge/** (historical extractions), FRAMEWORK-STATE.md (model mentions updated under its own G7/verify-promotion contract — authenticity-protected; also owned by WI-362), examples/ + coupleshub/ + scratch/ (non-framework). agent definition pins (plan-reviewer, strategic-reviewer, summary-extractor) verified CURRENT (sonnet-4-6, haiku-4-5-20251001) — no change needed.

## Lane Compliance (framework lane — F-001)

| Chain skill | Status | Evidence |
|---|---|---|
| route-workflow | completed | `.svc/lane-tasks-WI-357.json` task 1 — skill_receipt + 6 phase receipts (P1-P6); concern scan 0 matches; capability diagnosis clean |
| plan-changeset | completed | task 2 — skill_receipt + 6 phase receipts; this manifest; plan-manifest receipt staged |
| design-tech | skipped | task 9 `skip_reason` (no architecture surface; invariants in §Implementation Summary) + `.svc/pipeline-decisions.jsonl` taste entry 2026-06-06 "design-tech marked skipped in lane graph" |
| review-plan | in progress | task 3 — this review (Tier 1 PASS, Tier 1.5 PASS, Tier 2 codex, Tier 3 pending) |
| execute-changeset / review-exec / audit-implementation / land-changeset / verify-promotion | pending | tasks 4-8, blocked on review-plan PASS |
| Lane-model validator | PASS | `node scripts/validate-task-graph-lane.mjs .svc/lane-tasks-WI-357.json` → `missing: []`, status consistent (2026-06-06) |

(evolve-framework / improve-framework / write-spec are not mandatory for this WI's path: the WI was intaken via capture-idea from the 2026-06-06 evaluation — `emitted_leaves` entry in pipeline-decisions — and the lane validator confirms no missing mandatory skills.)

## Implementation Summary

Refresh the model registry to verified-current model IDs, flip svc-default EXEC to the operatively-true harness, align every resolution-path table/mirror with the registry (mirror-markers + cross-check command; full codegen deferred to WI-364), and record the EXEC-economics decision with evidence.

**Invariants:** resolver CLI contract (`resolve-model.sh <LABEL> [--json|--harness-only|--thinking|--invocation]`, exit codes 0/1/2) unchanged; profile NAMES unchanged; registry schema shape (version 2) unchanged — value updates plus one additive variants-note field; reviewer-resolution pairs (claude→codex/gemini) unchanged; NO hook/preflight behavior changes (dispatch preflight already implements sonnet fallback — the registry catches up to operative reality, not vice versa); `scripts/resolve-model.sh` and `scripts/resolve-adversarial-reviewer.sh` source NOT touched.

**Verified-current ID evidence (host-capability-research compliance — live sources, not training data):**
- Anthropic: live harness env declares `claude-opus-4-8` (1M-context variant id `claude-opus-4-8[1m]`), Sonnet 4.6 `claude-sonnet-4-6`, Haiku `claude-haiku-4-5-20251001` — matches agents/ pins
- Codex: operative `~/.codex/config.toml` → `model = "gpt-5.5"`, `model_reasoning_effort = "xhigh"` (registry value confirmed operative)
- Kimi: operative `~/.kimi/config.toml` → `kimi-for-coding` ✓
- MiMo: registry pricing/source rows dated 2026-04-25 retained; **operative status on this machine: `MIMO_API_KEY` not set → `scripts/check-mimo-quota.sh` emits `USE_SONNET`** (decision evidence)
- Gemini: not a registry harness (used only by the adversarial-reviewer CLI path) — out of scope

## EXEC Economics Decision (embedded deliverable, AC-06)

**Decision: svc-default `EXEC` → `claude/sonnet` (Sonnet 4.6).** Candidates:

| Candidate | Verdict | Evidence |
|---|---|---|
| MiMo-V2.5 (incumbent) | Demote to keyed profiles | `MIMO_API_KEY` absent on this machine → dispatch preflight ALREADY falls back to Sonnet (`check-mimo-quota.sh` → `USE_SONNET`); evaluation 2026-06-06 dim-6: "cheapest model on costliest-to-review path = inverted economics"; this change aligns declared state with operative state, REDUCING drift |
| fast-mode Opus | Rejected for dispatch | /fast is a session toggle on the orchestrator, not a `claude -p --model`-addressable ID — cannot be dispatched to workers; viable only as inline-orchestrator execution, which the worktree dispatch model doesn't use |
| Sonnet 4.6 | **ADOPT** | REVIEW-grade quality (already trusted for the REVIEW label), mid cost, no cross-harness round-trip, matches the operative fallback that has been silently executing anyway |

MiMo execution remains first-class in `opencode-mimo` and `kimi-orchestrator-mixed` profiles (unchanged). `SENSE` stays `mimo/mimo-v2.5-pro` (multimodal need; no Claude-dispatchable video-multimodal equivalent in registry) with an added key-requirement rationale note. **No hook/preflight change required**: preflight already prefers-MiMo-when-keyed and falls back; post-decision, svc-default *declares* Sonnet, and MiMo use becomes an explicit profile choice — the intended end state. No follow-up WI needed.

## Files Planned

| # | File | Action | Task | Purpose |
|---|------|--------|------|---------|
| 1 | `references/model-registry.json` | MODIFY | task-1 | opus id 4-7→4-8 (+invocation, +1M-variant note), svc-default EXEC label → claude/sonnet, profile description, SENSE rationale note |
| 2 | `references/model-routing.md` | MODIFY | task-2 | Profile table rows (L19,21,23), label table (L73-79), key-insight para (L81), example (L158); mirror-marker under H1 |
| 3 | `rules/common/model-selection.md` | MODIFY | task-2 | Host-table Claude column Opus 4.6→4.8 (3 rows); mirror-marker under H1 |
| 4 | `CLAUDE.md` | MODIFY | task-2 | Profile EXEC row MiMo→Sonnet per decision; caveat line refresh; MiMo-harness paragraph EXEC claim |
| 5 | `AGENTS.md` | MODIFY | task-3 | L367 co-author trailer Opus 4.6→4.8 (host mirror) |
| 6 | `KIMI.md` | MODIFY | task-3 | L208 "delegates EXEC/SENSE to MiMo" → EXEC Sonnet / SENSE MiMo-keyed wording |
| 7 | `plan-changeset/SKILL.md` | MODIFY | task-3 | L62 header "Opus 4.7"→"Opus 4.8" |
| 8 | `design-ui/SKILL.md` | MODIFY | task-3 | L37 header "Opus 4.7"→"Opus 4.8" |
| 9 | `execute-changeset/SKILL.md` | MODIFY | task-3 | L35 header [EXEC-MIMO]→resolver-routed wording; L169 "Opus 4.7"→"Opus 4.8"; L275 "Opus 4.6"→"Opus 4.8 1M tier" |
| 10 | `land-changeset/SKILL.md` | MODIFY | task-3 | L60 header [EXEC-MIMO]→resolver-routed wording |
| 11 | `references/model-toggle.md` | MODIFY | task-2 | (Tier-3 NEW-002) svc-default table Opus 4.7→4.8, EXEC MiMo→Sonnet, SENSE V2-Omni→V2.5-Pro; mirror-marker under H1 |
| 12 | `references/model-routing-kimi.md` | MODIFY | task-3 | (Tier-3 NEW-002) kimi-mixed table MiMo family names V2-Pro/V2-Omni→V2.5/V2.5-Pro (harness intentionally stays MiMo for this profile); L125 svc-default example output → claude/sonnet; mirror-marker under H1 |

**File 9 expanded (Tier-3 NEW-001):** `execute-changeset/SKILL.md` additionally gets L170 Implementor row (MiMo-V2-Pro→resolver-routed/Sonnet), L172-173 prose ("fast model (MiMo)" claim), and L180 example (`SVC_WORKER_MODEL="xiaomi/mimo-v2-pro"` → resolver-derived example with WI-357 fallback literal).

**Deferred executable surfaces (Tier-3 NEW-002 disposition — ACCEPT-PARTIAL):** `scripts/dispatch-worker.sh` L31 (`MODEL="mimo-v2-pro"` default) and `scripts/plan-parallel-wi-dispatch.mjs` L236/239/242 (mimo auto-routing literals) are EXECUTABLE transport defaults, not docs. Deferred to **WI-367** (native transport re-base, which likely deletes both scripts) with zero operative drift TODAY: the dispatch preflight runs `check-mimo-quota.sh` BEFORE these literals are reachable and `MIMO_API_KEY` absent → `USE_SONNET` short-circuits them (live probe 2026-06-06). Tracking note appended to the WI-367 doc as part of this review's closeout.

## Changeset Blueprints

### 1. references/model-registry.json (4 precise edits)

```markdown
<<<<<<< BEFORE
      "models": {
        "opus":   { "id": "claude-opus-4-7",   "contextWindow": 200000, "invocation": "claude -p --model claude-opus-4-7" },
        "sonnet": { "id": "claude-sonnet-4-6", "contextWindow": 200000, "invocation": "claude -p --model claude-sonnet-4-6" },
        "haiku":  { "id": "claude-haiku-4-5-20251001", "contextWindow": 200000, "invocation": "claude -p --model claude-haiku-4-5-20251001" }
=======
      "models": {
        "opus":   { "id": "claude-opus-4-8",   "contextWindow": 200000, "invocation": "claude -p --model claude-opus-4-8", "variants": { "claude-opus-4-8[1m]": { "contextWindow": 1048576, "note": "1M-context tier; active orchestrator id observed live 2026-06-06" } } },
        "sonnet": { "id": "claude-sonnet-4-6", "contextWindow": 200000, "invocation": "claude -p --model claude-sonnet-4-6" },
        "haiku":  { "id": "claude-haiku-4-5-20251001", "contextWindow": 200000, "invocation": "claude -p --model claude-haiku-4-5-20251001" }
>>>>>>> AFTER
```

```markdown
<<<<<<< BEFORE
  "profiles": {
    "svc-default": {
      "description": "Framework default: proven multi-harness mixing. Claude orchestrates + MiMo executes + MiMo-V2.5-Pro senses. This is the production profile. Updated 2026-04-24 to route EXEC/SENSE to V2.5 family (released 2026-04-22 — matches V2-Pro at half cost).",
      "labels": {
=======
  "profiles": {
    "svc-default": {
      "description": "Framework default. Claude orchestrates + Sonnet executes + MiMo-V2.5-Pro senses (key-gated). Updated 2026-06-06 (WI-357): EXEC moved mimo→claude/sonnet to match the operative dispatch-preflight fallback (MIMO_API_KEY-gated) and review-grade execution quality; MiMo execution remains first-class via opencode-mimo / kimi-orchestrator-mixed profiles.",
      "labels": {
>>>>>>> AFTER
```

```markdown
<<<<<<< BEFORE
        "PLAN":   { "harness": "claude", "model": "opus",   "rationale": "Deterministic blueprinting needs frontier reasoning" },
        "EXEC":   { "harness": "mimo",   "model": "mimo-v2.5",     "rationale": "High-volume edits; V2.5 matches V2-Pro quality at $0.40/$2.00 per Mtok" },
        "REVIEW": { "harness": "claude", "model": "sonnet", "rationale": "Quality verification against Opus blueprint" },
=======
        "PLAN":   { "harness": "claude", "model": "opus",   "rationale": "Deterministic blueprinting needs frontier reasoning" },
        "EXEC":   { "harness": "claude", "model": "sonnet",        "rationale": "WI-357 decision 2026-06-06: review-grade execution quality; matches operative preflight fallback when MIMO_API_KEY absent; MiMo EXEC lives in opencode-mimo/kimi-orchestrator-mixed profiles" },
        "REVIEW": { "harness": "claude", "model": "sonnet", "rationale": "Quality verification against Opus blueprint" },
>>>>>>> AFTER
```
*(scoped to the `svc-default` profile block ONLY — `kimi-orchestrator-mixed` and `opencode-mimo` EXEC labels intentionally untouched; svc-default-block uniqueness verified in simulation)*

```markdown
<<<<<<< BEFORE
        "REVIEW": { "harness": "claude", "model": "sonnet", "rationale": "Quality verification against Opus blueprint" },
        "SENSE":  { "harness": "mimo",   "model": "mimo-v2.5-pro", "rationale": "Multimodal (text+image) sensory QA; V2.5-Pro supersedes V2-Omni with 57.2% SWE-bench Pro" },
        "DISC":   { "harness": "native", "tool":  "web_search",    "rationale": "Live docs via native search" },
=======
        "REVIEW": { "harness": "claude", "model": "sonnet", "rationale": "Quality verification against Opus blueprint" },
        "SENSE":  { "harness": "mimo",   "model": "mimo-v2.5-pro", "rationale": "Multimodal (text+image) sensory QA; V2.5-Pro supersedes V2-Omni with 57.2% SWE-bench Pro. Requires MIMO_API_KEY; without it dispatch preflight falls back per execute-changeset" },
        "DISC":   { "harness": "native", "tool":  "web_search",    "rationale": "Live docs via native search" },
>>>>>>> AFTER
```
*(svc-default block only, same scoping note)*

### 2. references/model-routing.md (6 edits + mirror marker under H1)

Mirror marker (insert directly after the H1 line):
```markdown
> **MIRROR:** model IDs/tables below mirror `references/model-registry.json` (single source). Edit the registry first, then sync this file. Cross-check: WI-357 validation command. Full generation pending WI-364.
```

```markdown
<<<<<<< BEFORE
| Profile | Orchestrator | EXEC Harness | SENSE Harness | Best For |
|---------|-------------|--------------|---------------|----------|
| **`svc-default`** | Any | **MiMo-V2-Pro** | **MiMo-V2-Omni** | Production. Proven mixing: Claude strategy + MiMo execution |
| **`kimi-native`** | Kimi | **Kimi** | **Kimi** | Pure Kimi. Everything inside Kimi CLI |
=======
| Profile | Orchestrator | EXEC Harness | SENSE Harness | Best For |
|---------|-------------|--------------|---------------|----------|
| **`svc-default`** | Any | **Claude Sonnet 4.6** | **MiMo-V2.5-Pro** (key-gated) | Production. Claude strategy + Sonnet execution (WI-357) |
| **`kimi-native`** | Kimi | **Kimi** | **Kimi** | Pure Kimi. Everything inside Kimi CLI |
>>>>>>> AFTER
```

```markdown
<<<<<<< BEFORE
| **`codex-native`** | Codex CLI / app | **GPT-5.5** | **GPT-5.5** | Pure Codex. Best for Windows Codex app + WSL2 |
| **`kimi-orchestrator-mixed`** | Kimi | **MiMo-V2-Pro** | **MiMo-V2-Omni** | Kimi orchestrates + MiMo executes |

**Profile selection:**
=======
| **`codex-native`** | Codex CLI / app | **GPT-5.5** | **GPT-5.5** | Pure Codex. Best for Windows Codex app + WSL2 |
| **`kimi-orchestrator-mixed`** | Kimi | **MiMo-V2.5** | **MiMo-V2.5-Pro** | Kimi orchestrates + MiMo executes |

**Profile selection:**
>>>>>>> AFTER
```

```markdown
<<<<<<< BEFORE
| 🧠 **[STRAT]** | Claude | Opus 4.7 | Highest reasoning depth for strategy |
| 📐 **[PLAN]** | Claude | Opus 4.7 | Deterministic blueprinting |
| ⚙️ **[EXEC]** | **MiMo** | **MiMo-V2-Pro** | High-volume edits, cheap token burn |
| 🛡️ **[REVIEW]** | Claude | Sonnet 4.6 | Quality verification against Opus blueprint |
| 👁️ **[SENSE]** | **MiMo** | **MiMo-V2-Omni** | Video/audio sensory QA |
=======
| 🧠 **[STRAT]** | Claude | Opus 4.8 | Highest reasoning depth for strategy |
| 📐 **[PLAN]** | Claude | Opus 4.8 | Deterministic blueprinting |
| ⚙️ **[EXEC]** | Claude | Sonnet 4.6 | Review-grade execution (WI-357); MiMo EXEC via keyed profiles |
| 🛡️ **[REVIEW]** | Claude | Sonnet 4.6 | Quality verification against Opus blueprint |
| 👁️ **[SENSE]** | **MiMo** | **MiMo-V2.5-Pro** | Multimodal sensory QA (requires MIMO_API_KEY) |
>>>>>>> AFTER
```

```markdown
<<<<<<< BEFORE
| 🔁 **[PASS]** | Claude | Haiku 4.5 | Cheapest pass-through extraction |

**Key insight:** The orchestrator can be Claude, Kimi, Codex, Gemini, or OpenCode — but `svc-default` still delegates EXEC and SENSE to MiMo because that's the framework's proven execution stack. If you want the orchestrator's native model for everything, use `<orchestrator>-native` where available (`kimi-native`, `claude-native`, `codex-native`).

---
=======
| 🔁 **[PASS]** | Claude | Haiku 4.5 | Cheapest pass-through extraction |

**Key insight:** The orchestrator can be Claude, Kimi, Codex, Gemini, or OpenCode. Since WI-357 (2026-06-06), `svc-default` executes with Claude Sonnet (matching the operative key-gated fallback) and delegates only SENSE to MiMo; MiMo-everything remains available via `opencode-mimo`, and `<orchestrator>-native` profiles cover single-harness setups (`kimi-native`, `claude-native`, `codex-native`).

---
>>>>>>> AFTER
```

```markdown
<<<<<<< BEFORE
**❌ Don't do this:**
> "Use Claude Opus 4.7 for this step."

**✅ Do this:**
=======
**❌ Don't do this:**
> "Use Claude Opus 4.8 for this step."

**✅ Do this:**
>>>>>>> AFTER
```

### 3. rules/common/model-selection.md (3 row edits + mirror marker under H1)

```markdown
<<<<<<< BEFORE
| **[STRAT]** | Claude Opus 4.6 | `kimi-for-coding` + thinking ON | Gemini 2.5 Pro | o3 | MiMo V2.5-Pro |
| **[PLAN]** | Claude Opus 4.6 | `kimi-for-coding` + thinking ON | Gemini 2.5 Pro | o3 | MiMo V2.5-Pro |
| **[EXEC]** | Claude Sonnet 4.6 | `kimi-for-coding` + thinking OFF | Gemini 2.5 Flash | codex | MiMo V2.5 |
=======
| **[STRAT]** | Claude Opus 4.8 | `kimi-for-coding` + thinking ON | Gemini 2.5 Pro | o3 | MiMo V2.5-Pro |
| **[PLAN]** | Claude Opus 4.8 | `kimi-for-coding` + thinking ON | Gemini 2.5 Pro | o3 | MiMo V2.5-Pro |
| **[EXEC]** | Claude Sonnet 4.6 | `kimi-for-coding` + thinking OFF | Gemini 2.5 Flash | codex | MiMo V2.5 |
>>>>>>> AFTER
```

```markdown
<<<<<<< BEFORE
| **[REVIEW]** | Claude Sonnet 4.6 | `kimi-for-coding` + thinking ON | Gemini 2.5 Pro | codex | MiMo V2.5-Pro |
| **[SENSE]** | Claude Opus 4.6 | `kimi-for-coding` + thinking ON | Gemini 2.5 Pro | gpt-4o | MiMo V2.5-Pro |
| **[PASS]** | Claude Haiku 4.5 | `kimi-for-coding` + thinking OFF | Gemini 2.5 Flash | gpt-4o-mini | MiMo V2.5 |
=======
| **[REVIEW]** | Claude Sonnet 4.6 | `kimi-for-coding` + thinking ON | Gemini 2.5 Pro | codex | MiMo V2.5-Pro |
| **[SENSE]** | Claude Opus 4.8 | `kimi-for-coding` + thinking ON | Gemini 2.5 Pro | gpt-4o | MiMo V2.5-Pro |
| **[PASS]** | Claude Haiku 4.5 | `kimi-for-coding` + thinking OFF | Gemini 2.5 Flash | gpt-4o-mini | MiMo V2.5 |
>>>>>>> AFTER
```

Mirror marker (same text as §2) inserted after the H1 `# Model Selection for Agent Tasks`.

### 4. CLAUDE.md (3 edits)

```markdown
<<<<<<< BEFORE
| **[PLAN]** | Claude | Opus 4.8 |
| **[EXEC]** | **MiMo** | **MiMo-V2.5** |
| **[REVIEW]** | Claude | Sonnet 4.6 |
=======
| **[PLAN]** | Claude | Opus 4.8 |
| **[EXEC]** | Claude | Sonnet 4.6 |
| **[REVIEW]** | Claude | Sonnet 4.6 |
>>>>>>> AFTER
```

```markdown
<<<<<<< BEFORE
> ⚠️ Model IDs single-sourced from `references/model-registry.json` — registry refresh pending **WI-357** (registry still pins `claude-opus-4-7`); this table updated 2026-06-06, WI-364 will make it generated.

MiMo is an **execution harness**, not an orchestrator. The framework delegates high-volume file edits (EXEC) and video QA (SENSE) to MiMo while keeping strategy and review in Claude.
=======
> ⚠️ Model IDs single-sourced from `references/model-registry.json` — refreshed by **WI-357** (2026-06-06; EXEC→Sonnet per economics decision). Table generation pending WI-364 — until then edit the registry first, then sync mirrors.

MiMo is an **execution harness**, not an orchestrator. Since WI-357, svc-default runs EXEC on Sonnet 4.6 and delegates only video/visual QA (SENSE) to MiMo when `MIMO_API_KEY` is set; MiMo-everything execution remains available via the `opencode-mimo` profile.
>>>>>>> AFTER
```

### 5-10. Single-line exact replacements (uniqueness grep-verified in simulation)

| File | Exact BEFORE (unique line) | AFTER |
|---|---|---|
| `AGENTS.md` L367 | `- **Co-author trailer:** \`Co-Authored-By: Claude Opus 4.6 (1M context) <contact-cd29c5ac34@example.invalid>\`` | `- **Co-author trailer:** use the ACTIVE orchestrator model — currently \`Co-Authored-By: Claude Opus 4.8 (1M context) <contact-cd29c5ac34@example.invalid>\`` |
| `KIMI.md` L208 | `Or use the production default (\`svc-default\`) which delegates EXEC/SENSE to MiMo and strategy/review to Claude:` | `Or use the production default (\`svc-default\`): strategy/planning on Opus, execution/review on Sonnet, SENSE delegated to MiMo when MIMO_API_KEY is set (WI-357):` |
| `plan-changeset/SKILL.md` L62 | `> **Cognitive routing:** 📐 [PLAN-OPUS] — architectural blueprinting demands Opus 4.7 for strict dependency graphs. See \`references/model-routing.md\`.` | same with `Opus 4.8` |
| `design-ui/SKILL.md` L37 | full line containing `with Opus 4.7 for strategic framing` | same with `Opus 4.8` |
| `execute-changeset/SKILL.md` L35 | `> **Cognitive routing:** ⚙️ [EXEC-MIMO] — high-volume file editing and bash loops are mechanical; route to MiMo-V2-Pro (or Sonnet 4.6) to decouple execution cost from Opus planning. See \`references/model-routing.md\`.` | `> **Cognitive routing:** ⚙️ [EXEC] — execution routes via \`resolve-model.sh EXEC\`: Sonnet 4.6 under svc-default (WI-357); MiMo under keyed profiles (opencode-mimo). See \`references/model-routing.md\`.` |
| `execute-changeset/SKILL.md` L169 | `| **Orchestrator** | Opus 4.7 | medium | Reads manifest, identifies groups, spawns subagents via \`scripts/dispatch-worker.sh\`, runs holistic review |` | same with `Opus 4.8` |
| `execute-changeset/SKILL.md` L170 | `| **Implementor** | MiMo-V2-Pro | high | Receives task + file constraints, writes test → writes code → runs test → commits |` | `| **Implementor** | resolver-routed (\`resolve-model.sh EXEC\` — Sonnet 4.6 under svc-default per WI-357) | high | Receives task + file constraints, writes test → writes code → runs test → commits |` |
| `execute-changeset/SKILL.md` L172-173 | `write code. This separation means the expensive model (Opus) spends tokens` / `on decisions, and the fast model (MiMo) spends tokens on generation. ` | `write code. This separation means the orchestrator (Opus) spends tokens` / `on decisions, and the EXEC-resolved model (Sonnet under svc-default per WI-357; MiMo under keyed profiles) spends tokens on generation. ` |
| `execute-changeset/SKILL.md` L180 | `SVC_WORKER_SKILL="execute-changeset" SVC_WORKER_MODEL="xiaomi/mimo-v2-pro" bash scripts/dispatch-worker.sh "Execute Task 3. Target ONLY these files: src/app/auth.tsx. Task details: [insert task intent from manifest]"` | `SVC_WORKER_SKILL="execute-changeset" SVC_WORKER_MODEL="claude-sonnet-4-6" bash scripts/dispatch-worker.sh "Execute Task 3. Target ONLY these files: src/app/auth.tsx. Task details: [insert task intent from manifest]"  # model = svc-default EXEC per WI-357; resolve dynamically via resolve-model.sh EXEC` |
| `references/model-toggle.md` (under H1) | mirror-marker insertion (same text as §2) after `# Model Toggle & Profile Reference` | — |
| `references/model-toggle.md` table | 5-row window `| [STRAT] | Claude | Opus 4.7 |` through `| [SENSE] | **MiMo** | **MiMo-V2-Omni** |` | STRAT/PLAN→`Opus 4.8`; EXEC→`| [EXEC] | Claude | Sonnet 4.6 |`; SENSE→`**MiMo-V2.5-Pro**` |
| `references/model-routing-kimi.md` (under H1) | mirror-marker insertion after `# Kimi Code CLI — Profile & Orchestrator Guide` | — |
| `references/model-routing-kimi.md` L38/L40 | `| ⚙️ [EXEC] | **MiMo** | **MiMo-V2-Pro** |` and `| 👁️ [SENSE] | **MiMo** | **MiMo-V2-Omni** |` (3-line windows incl. adjacent rows) | family names → `**MiMo-V2.5**` / `**MiMo-V2.5-Pro**` — harness column stays MiMo (kimi-mixed profile intent) |
| `references/model-routing-kimi.md` L125 | `# → { "profile": "svc-default", "harness": "mimo", "model": "mimo-v2-pro", ... }` | `# → { "profile": "svc-default", "harness": "claude", "model": "claude-sonnet-4-6", ... }   # WI-357` |
| `execute-changeset/SKILL.md` L275 | `When the context window is 500K+ tokens (Opus 4.6, Sonnet 4.6 with 1M context):` | `When the context window is 500K+ tokens (Opus 4.8 1M tier, Sonnet 4.6 with 1M context):` |
| `land-changeset/SKILL.md` L60 | `> **Cognitive routing:** ⚙️ [EXEC-MIMO] — branch push, PR open, merge, cleanup are pure mechanical git ops. Route to MiMo-V2-Pro or Sonnet 4.6; Opus wastes budget. See \`references/model-routing.md\`.` | `> **Cognitive routing:** ⚙️ [EXEC] — branch push, PR open, merge, cleanup are mechanical git ops; routes via \`resolve-model.sh EXEC\` (Sonnet 4.6 under svc-default per WI-357). See \`references/model-routing.md\`.` |

## Task Graph

| Task | Title | Files | Deps | AC coverage | Validation | Checkpoint |
|---|---|---|---|---|---|---|
| task-1-registry | Registry value refresh + EXEC decision encoding | 1 | — | AC-01, AC-06 | `python3 -m json.tool references/model-registry.json >/dev/null`; `bash scripts/resolve-model.sh <each of 7 labels> --json` exit 0; EXEC resolves harness=claude id=claude-sonnet-4-6; STRAT/PLAN id=claude-opus-4-8 | `checkpoint-1-registry` |
| task-2-tables | Authoritative tables + mirrors aligned | 2-4 | task-1 | AC-04 | cross-check command (Validation Plan) exits 0; `grep -c "MIRROR:"` == 1 in each of files 2-3 | `checkpoint-2-tables` |
| task-3-headers-hosts | SKILL headers + host mirrors swept | 5-10 | task-1 | AC-05 | stale-pin narrow + adjacent sweeps == 0 hits on the 10 in-scope files | `checkpoint-3-sweep` |
| task-4-branch-validation | Full-branch validation | — | 1..3 | AC-02, AC-03, AC-07 | reviewer pair valid; `node scripts/lint-skills-manifest.mjs` PASS; `bash test-framework/evals/run-all-evals.sh --tier1` PASS; `git diff --name-only main...HEAD` == manifest file set (+ manifest + lane-tasks) | (gate before G5) |

No parallel groups. TDD: N/A — config/docs migration; resolver source untouched; validation = dry-runs + greps.

## AC-to-Task / AC-to-Test Mapping

| AC | Statement | Task | Test type |
|---|---|---|---|
| AC-01 | Registry carries verified-current IDs (opus=claude-opus-4-8 + 1M variant note; sonnet/haiku/kimi/codex confirmed operative) | task-1 | Manual (resolver dry-run outputs in checkpoint) |
| AC-02 | `resolve-model.sh` exits 0 for all 7 labels post-change, JSON well-formed | task-4 | Manual |
| AC-03 | `resolve-adversarial-reviewer.sh` returns valid primary/fallback pair | task-4 | Manual |
| AC-04 | 3 tables match registry (cross-check exits 0) + mirror markers present | task-2 | Manual (scripted cross-check) |
| AC-05 | Zero stale pins on the 10 resolution-path files (narrow + adjacent sweeps) | task-3 | Manual (grep == 0) |
| AC-06 | EXEC decision: 3 candidates + evidence + registry encoding | task-1 + manifest §EXEC | N/A (decision artifact = this manifest section; no executable behavior to test) |
| AC-07 | tier-1 194/194 + lint PASS on branch; diff equals manifest file set | task-4 | Manual (suite runs) |

## Prerequisite Alignment Matrix

| Task | UX | UI | Tech design | Style contract | Persona trace |
|---|---|---|---|---|---|
| task-1..4 | N/A — no user-facing surface (framework config/docs; no screens/flows/states) | N/A — same | design-tech SKIPPED in lane graph with logged reason; constraints carried by manifest §Invariants + resolver contract (read 2026-06-06) | N/A for JSON/markdown config; repo markdown conventions followed | **N/A — justified:** framework-internal tooling; no end-user persona surface. Sole stakeholder = P0 owner-builder (global builder profile); framework lane carries no persona table by design. |

Browser-visible MODIFY mock-parity ledger: **N/A — no browser-visible component/route/visual state touched** (markdown/JSON only).

## External State

| # | Environment | What state | Coupling | Lifecycle wiring |
|---|---|---|---|---|
| 1 | `~/.claude/skills/*` symlinks (host-install surface) | registry + SKILL.md edits visible immediately via symlinks (no copies) | coupled | symlinks resolve into the repo — same-file identity; `scripts/check-install-drift.sh` exists for drift detection |
| 2 | kimi-host inline-injected KIMI copy (generated host config, kimi skills dir) | repo KIMI.md edit; kimi-side inline copy regenerates on next `setup --host kimi` | decoupled-justified | Kimi host not in active use this cycle (out-of-scope orchestrator per CLAUDE.md chain section); drift window closes at next setup run; tier-1 `validate-kimi-host.sh` checks kimi-side consistency. Recovery: `./setup --host kimi`. |
| 3 | MiMo API key/quota (external service) | READ-ONLY probe by `check-mimo-quota.sh`; decision consumes output; nothing mutated | coupled (read-only) | the probe script is the check; no state written |

Untouched taxonomy environments (walked, nothing): package registries, DBs/RLS, CI providers, browser/device state, OAuth/token stores, cloud infra, cron/schedulers, MCP server state, container runtimes, OS services, third-party webhooks, marketplace listings.

## Validation Plan

**Cross-check command (AC-04):**
```bash
OPUS_ID=$(python3 -c "import json;print(json.load(open('references/model-registry.json'))['harnesses']['claude']['models']['opus']['id'])")
EXEC_RES=$(python3 -c "import json;p=json.load(open('references/model-registry.json'))['profiles']['svc-default']['labels']['EXEC'];print(p['harness'],p['model'])")
test "$OPUS_ID" = "claude-opus-4-8" && test "$EXEC_RES" = "claude sonnet" && \
grep -q "Opus 4.8" references/model-routing.md && grep -q "Opus 4.8" rules/common/model-selection.md && grep -q "Sonnet 4.6" CLAUDE.md && \
! grep -nE "Opus 4\.[0-7]([^0-9]|$)" references/model-routing.md rules/common/model-selection.md CLAUDE.md
```

**Stale-pin sweep (AC-05) — narrow + adjacent (pattern-family completeness):**
```bash
SCOPE="references/model-registry.json references/model-routing.md references/model-toggle.md references/model-routing-kimi.md rules/common/model-selection.md CLAUDE.md KIMI.md AGENTS.md plan-changeset/SKILL.md design-ui/SKILL.md execute-changeset/SKILL.md land-changeset/SKILL.md"
! grep -nE "claude-opus-4-[0-7]" $SCOPE
PROSE_SCOPE="references/model-routing.md references/model-toggle.md references/model-routing-kimi.md rules/common/model-selection.md CLAUDE.md KIMI.md AGENTS.md plan-changeset/SKILL.md design-ui/SKILL.md execute-changeset/SKILL.md land-changeset/SKILL.md"
! grep -nE "Opus 4\.[0-7]|MiMo-V2-Pro|MiMo-V2-Omni|\[EXEC-MIMO\]|xiaomi/mimo-v2-pro" $PROSE_SCOPE
```
*(registry keeps `mimo-v2-pro`/`mimo-v2-omni` MODEL CATALOG ENTRIES — real ids of still-existing models — hence excluded from the prose sweep)*

**AC-04 mirror-marker checks (F-005 — part of the AC-04 command):**
```bash
test "$(grep -c 'MIRROR:' references/model-routing.md)" = 1
test "$(grep -c 'MIRROR:' rules/common/model-selection.md)" = 1
test "$(grep -c 'MIRROR:' references/model-toggle.md)" = 1
test "$(grep -c 'MIRROR:' references/model-routing-kimi.md)" = 1
```

**Final branch-level:** all 7 label dry-runs · reviewer pair · `node scripts/lint-skills-manifest.mjs` · `bash test-framework/evals/run-all-evals.sh --tier1` (flag PROVEN live 2026-06-06: documented in CLAUDE.md Commands and three same-day runs honored it — "RESULT: PASS (tier-1 only)") · **exact final diff set (F-004):** `git diff --name-only main...HEAD | sort` equals EXACTLY the 10 planned files + the 3 process artifacts in the table below — nothing open-ended.

**Process artifacts (explicit touches block — F-004):**

| File | Action | Owning task |
|---|---|---|
| `docs/plans/2026-06-06-wi-357-model-registry-refresh/manifest.md` | CREATE (this plan) + review-log sibling | plan-changeset / review-plan |
| review-log.yaml (same plan dir — created at review close, Step 6 of review-plan) | CREATE | review-plan |
| `.svc/lane-tasks-WI-357.json` | MODIFY (status/receipts) | all chain tasks |
| `.svc/pipeline-decisions.jsonl` | MODIFY (append-only: plan + review + exec decision entries) | all chain tasks |

## Execution Command Sequence

```bash
set -euo pipefail
# 1. Worktree
bash scripts/worktree.sh create refactor-wi-357-model-registry
cd .worktrees/refactor-wi-357-model-registry
bash scripts/worktree.sh guard --skill execute-changeset --lane framework --branch refactor-wi-357-model-registry

# 2. Dependencies — none (config/docs only)

# 3. task-1: registry — native Edit tool per blueprint §1 (4 edits)
python3 -m json.tool references/model-registry.json >/dev/null
for L in STRAT PLAN EXEC REVIEW SENSE DISC PASS; do bash scripts/resolve-model.sh "$L" --json; done
bash scripts/resolve-model.sh EXEC --json | grep -q '"harness": "claude"'
bash scripts/resolve-model.sh STRAT --json | grep -q 'claude-opus-4-8'
git add references/model-registry.json && git commit -m "WI-357 checkpoint-1-registry: refresh ids + EXEC->sonnet decision encoding"

# 4. task-2: tables — Edit tool per blueprints §2-4; then AC-04 cross-check command
git add references/model-routing.md rules/common/model-selection.md CLAUDE.md
git commit -m "WI-357 checkpoint-2-tables: align tables/mirrors with registry"

# 5. task-3: headers + host mirrors — Edit tool per §5-10 (uniqueness pre-grep each BEFORE line)
git add AGENTS.md KIMI.md plan-changeset/SKILL.md design-ui/SKILL.md execute-changeset/SKILL.md land-changeset/SKILL.md
git commit -m "WI-357 checkpoint-3-sweep: skill headers + host mirrors to current ids"

# 6. task-4: branch validation
bash scripts/resolve-adversarial-reviewer.sh | grep -q '"selected"'
node scripts/lint-skills-manifest.mjs
bash test-framework/evals/run-all-evals.sh --tier1

# RESUME GUARDS (F-006 — run BEFORE each task on any re-entry):
#   git log --oneline -5 | grep -q "checkpoint-<N>" && { echo "task <N> already committed — skip"; }
#   git status --porcelain | grep -q . && git diff --quiet || echo "diff applied but uncommitted — validate then commit"
#   # partially-applied edits (some blueprints in, some not): HALT -> diagnose-bug; never replay blindly

# CHECKPOINT SHA RECORDING (F-002 — immediately after EVERY checkpoint commit):
#   git rev-parse HEAD >> .svc/wi-357-checkpoints.log

# RECOVERY_IF_FAIL (F-002 — commit-scoped, status-gated):
#   test -z "$(git -C .worktrees/refactor-wi-357-model-registry status --porcelain)" \
#     || git -C .worktrees/refactor-wi-357-model-registry switch -c rescue/wi-357-$(date +%s)  # preserve dirty state FIRST
#   CKPT=$(tail -1 .svc/wi-357-checkpoints.log)   # explicit recorded SHA, never HEAD~1 arithmetic
#   git -C .worktrees/refactor-wi-357-model-registry reset --hard "$CKPT"
#   # full abort: preserve dirty state as above, THEN bash scripts/worktree.sh remove refactor-wi-357-model-registry; re-enter from manifest
```

## Checkpoint Plan

1. `checkpoint-1-registry` — rollback anchor for resolver inputs
2. `checkpoint-2-tables` — rollback anchor for doc alignment
3. `checkpoint-3-sweep` — rollback anchor for header/host sweep
Strict order; each a worktree commit with its SHA appended to `.svc/wi-357-checkpoints.log` at commit time (F-002); rollback = status-gated reset to the RECORDED checkpoint SHA (never positional HEAD~N), dirty state preserved on a rescue branch first; resume = checkpoint-detection guards per §Execution Command Sequence (F-006).

## Loop-Back Targets

- Resolver dry-run mismatch → HALT; route `diagnose-bug` on resolve-model.sh (resolver source is INVARIANT here — do not patch it in this WI)
- Reviewer-pair breakage → same halt + `diagnose-bug` on resolve-adversarial-reviewer.sh
- Unexpected validator coupling to registry → `improve-framework`

## Promotion Readiness Checklist

- [x] All planned files accounted (10 MODIFY, 0 CREATE/DELETE)
- [x] Every task has validation commands
- [x] All 7 ACs mapped to tasks + test types
- [x] Checkpoints named + ordered
- [x] Final diff must equal manifest file set — enforced in task-4
- [x] Schema-drift check: no ORM schemas touched — N/A
- [x] No banned scope-reduction phrases; deferred surfaces explicitly counted in §Migration Universe

## Simulation Report (2026-06-06)

22 exact-string existence+uniqueness checks across all 10 MODIFY targets — **22/22 PASS, 0 FAIL** (every blueprint BEFORE-block found exactly once on disk; svc-default-block EXEC/SENSE lines confirmed unique vs other profiles' differently-worded rationales). No new dependencies (package.json untouched); no API routes; no test-framework needs (config/docs migration). Tooling present: python3, `scripts/resolve-model.sh`, `scripts/check-mimo-quota.sh`.

| Check class | Count | Result |
|---|---|---|
| MODIFY target exists + BEFORE unique | 22 | PASS |
| CREATE targets | 0 | N/A |
| New deps / route conflicts / test config | 0 needed | PASS |

## Scenario Coverage

N/A — framework-lane WI; no `docs/specs/journeys/` scenarios exist for WI-357 (no user-facing flow). Behavioral coverage = resolver dry-runs (AC-02/03) + cross-checks (AC-04/05).
