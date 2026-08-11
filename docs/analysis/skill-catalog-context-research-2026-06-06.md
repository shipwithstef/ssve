# Skill-Catalog Context Research — how the ecosystem solves catalog-scale context cost (2026-06-06)

**Question:** can skills/rules load on demand instead of riding in every session's context — and how is this solved globally without breaking triggering?
**Sources:** (a) ecosystem scan via **gemini-cli** (primary per `rules/research-must-use-gemini-cli.md`; raw: `scratch/research-catalog-deferral-gemini.md`); (b) **claude-code-guide agent** verification against live Claude Code docs; (c) live-session primitive observation on this machine.
**Consumed by:** WI-361 (rules) and WI-365 (skills) designs; anti-goals adopted in plan v3.

## The reframe (the load-bearing discovery)

Claude Code **already budget-manages skill descriptions natively**: the catalog gets **1% of the context window** (configurable), each entry capped at **1,536 chars**, and over budget it **shortens/drops the least-invoked skills' descriptions first** (doc-verified). With 232 skills installed on this machine, eviction is plausibly active NOW — i.e., rarely-invoked svc skills are being shortened/dropped in favor of whichever packs get touched. **The problem is budget OCCUPANCY (trigger reliability), not raw token cost** — and every needed lever is native.

## Verified native levers (doc-confirmed 2026-06-06)

| Lever | Effect | Cost after applying |
|---|---|---|
| `disable-model-invocation: true` | Skill exits model context entirely until user-invoked | Zero (doc-quoted: "zero cost until invoked") |
| Per-project `enabledPlugins` (`.claude/settings.json`, committable) | Plugin loads only where enabled | Zero elsewhere; disabled plugins = zero tokens |
| `paths:` frontmatter | Skill loads only in matching directories | Zero outside globs |
| `skillOverrides` | Collapse chosen skills to name-only | Description cost saved |
| `skillListingBudgetFraction` / `maxSkillDescriptionChars` / `SLASH_COMMAND_TOOL_CHAR_BUDGET` | Resize/shape the catalog budget (1M-context models can afford 0.02) | Tunable |
| `context: fork` (v2.1.117+) | Skill BODY executes in forked subagent inheriting parent context | Parent context preserved for heavy skills |

Three-stage progressive disclosure recap: (1) metadata always-on ← the only real cost; (2) body on invoke; (3) `references/` on demand. svc already does (3) correctly; the issue is (1) × 232.

## Ecosystem scan (gemini-cli) — proven vs experimental

**Proven / production:** glob-scoped lazy rules (Cursor `.mdc`, Cline `.clinerules/`, Windsurf cascade) — deterministic, cheap; project partitioning; prompt-caching eager-load (masks cost, not attention); hierarchical router/planner pattern (= svc's route-workflow, already built); auto-compaction/state handoff at ~80% context.

**Experimental / risky:** tool-search-tool RAG retrieval (BM25/embedding-sensitive), generative tool-tokens (ToolGen — needs custom inference). OpenAI ecosystem: degradation past 20–30 tools, hard 128 limit, two-stage Tool-RAG standard, native `tool_search` recent. MCP: deferred schemas + tool-search now default-on in Claude Code.

**Documented failure modes of deferral (adopted as svc ANTI-GOALS):**
- *Vocabulary-gap trigger misses* — jargon doesn't match description → "I can't do that" while the capability exists
- *Bridge-tool blindness* — retrieval scores step-1 relevance, misses tools needed at step-3
- *Silent-fallback hallucination* — missing tool → synthesized text instead of action
- *Negotiation loops* — vague lazy-loaded schemas → repeated malformed calls
- *Ghost capabilities* — stale embeddings invoke evolved/removed tools

## The adopted design (WI-365, layered, each layer regression-gated)

L0 measure occupancy/eviction + trigger baseline → L1 `disable-model-invocation` ONLY on mechanically chain-independent skills (NEVER chain participants — cross-model finding) + `skillOverrides` name-only → L2 per-project `enabledPlugins` partitioning → L3 `paths:` glob-scoping for stack packs → L4 budget tuning + key-use-case-first description rewrites within the 1,536-char cap → L5 router safety net (route-workflow resolves from skills-manifest file reads, never assumes system-prompt visibility — svc's structural advantage over vanilla setups).

**Anti-goals:** no custom retrieval/deferral machinery (fights the native budget system + imports the failure modes above); no mass `user-invocable: false` for cost (descriptions still load); never remove skills from the manifest (router contract); never globally disable packs other projects use.

**Rules-side corollary (WI-361):** rules have NO native budget system — they are raw global injection (~34K tokens/session on this machine), so signal-gating remains a custom-but-ecosystem-proven build (the Cursor/Cline glob-scoped class), dual-triggered (PostToolUse Read/Grep/Glob pre-edit + Edit/Write catch-up; prefer PreToolUse additionalContext if verified supported).

## Incidental live evidence

Gemini's own review session emitted 60 skill-conflict warnings before producing output — the catalog-bloat thesis demonstrating itself on a sibling host. Gemini host also rejects `UserPromptSubmit`/`Stop` hook event names from project config (parity drift → WI-367 host-matrix corrections).
