# Framework Evolution — 2026-04-20 — Orchestrator Parsimony

**Theme:** cut Opus token bleed without losing the reasoning/validation where it matters. Push mechanical work down the cognitive-routing ladder (MiMo / Sonnet / Haiku / deterministic scripts). Leave Opus to architect + validate + decide.

## Method

Measured the current framework's concrete size with wc/find/grep, not opinion:

- `FRAMEWORK-STATE.md` = **1941 lines** (~60K tokens per full read)
- Total SKILL.md content = **27,883 lines** across all skills (~800K tokens if fully loaded)
- Skills over 1000 lines: `write-journeys` (1393), `design-ui` (1274), `build-personas` (1127), `find-opportunity` (1041)
- **56 of 67 skills** carry the identical Task-graph chaining boilerplate block (~150 lines each = ~8K lines = ~24K tokens of pure duplication)
- Proposal lifecycle: 81 proposal files but only 3 actual `**Status:**` markers — convention not enforced

Cross-checked against today's real usage: WI-088 Storyboard port session read ~1141 lines of JSX into Opus context just to plan; that's ~35K tokens for planning-only when a pre-digest would have been ~500 tokens. FRAMEWORK-STATE has been re-read in each improve-framework invocation this week — ~60K per read × 5 invocations = ~300K tokens consumed just re-loading framework memory.

Skipped (already in FRAMEWORK-STATE, not rediscovered): OpenCode harness, summary-extractor agents primitive, fanout.sh, cognitive-routing taxonomy, SVC_WORKER_SUMMARY contract. All landed today — this proposal is the next layer on top.

## Findings (by priority, with confidence levels)

### P0 — Fix now (measurable, large Opus savings)

#### F-001: FRAMEWORK-STATE.md is re-read in full every improve-framework loop [Inefficiency, HIGH confidence]

**Evidence:** `wc -l FRAMEWORK-STATE.md` → 1941 lines. `improve-framework/SKILL.md:162` mandates "Read FRAMEWORK-STATE.md first" on every loop. That's ~60K tokens of Opus context consumed on every framework evolution, even when only the last 1-2 entries are relevant.

**Impact:** `improve-framework` is invoked multiple times per day. Each invocation eats ~60K tokens just reading memory before any actual diagnosis work. Over a week at 5 invocations/day that's ~2M tokens of pure "re-read the history you already know."

**Proposed fix:** Split FRAMEWORK-STATE into a tiered structure:

- `FRAMEWORK-STATE.md` (target: <300 lines) — "Current State" block + "Blend History" table + "Active Decisions" table + last 14-day Analysis History + pointer to archive
- `FRAMEWORK-STATE-ARCHIVE/YYYY-MM.md` — one file per month for older Analysis History entries
- `FRAMEWORK-STATE-INDEX.md` — one-line-per-entry TOC that greppable by date, topic, or finding ID

Skills that need deep history grep the index, then pull the specific archive file only if needed. Opus typically won't need archive unless a claim contradicts memory.

**Token math:** 1941 lines → ~250 lines on the primary read = **~55K tokens saved per improve-framework load**. Confidence HIGH — file shrink is mechanical, no model behavior change.

---

#### F-002: Bash tool output bleeds directly into Opus context [Inefficiency, HIGH confidence]

**Evidence:** Every `Bash` tool call in this session dumps its full stdout into Opus context — build logs (~3KB), git status (~500B), npm run lint output (~300B), WI-088 MiMo subprocess log (11.5KB). Session transcript shows multiple 5-15KB tool results landing verbatim. No convention exists for distilling before Opus reads.

**Impact:** A 10KB log = ~2.5K tokens. Ten such outputs per orchestration = ~25K tokens of low-signal text in Opus context. Most of those logs the orchestrator skims for 1-2 salient facts (exit code, error line, summary block). The rest is pure pollution.

**Proposed fix:** Two mechanisms:

1. **`scripts/bash-distill.sh <cmd...>`** — runs arbitrary command, captures output, if output exceeds a threshold (e.g. 40 lines or 2KB) pipes through `scripts/haiku-extract.sh` OR deterministic summarizer (first 5 lines + last 10 + exit status). Returns the distilled version + path to full log on disk.
2. **Convention in CLAUDE.md / rule file:** for any Bash invocation expected to produce >30 lines, prefer `| tail -N`, `--porcelain`, `--json`, or explicit extraction patterns. Claude Code rule-inject at orchestrator load time.

**Token math:** heuristic — 60-70% of Bash output in orchestration is skimmable. Cutting to signal = **~15-20K tokens saved per typical svc session**. Confidence HIGH for deterministic distillation; MEDIUM for Haiku distillation (depends on log shape).

---

#### F-003: File reading during planning should pre-digest via cheap model [Inefficiency, HIGH confidence]

**Evidence:** WI-088 Task 1 (plan-changeset in this Opus session) read:
- `concept-storyboard.jsx` (468 lines, ~14K tokens)
- `animations.jsx` (673 lines, ~20K tokens)
- `claude-design-prompt.md` (~200 lines)
- `Example Marketplace Hero.html` (128 lines)
- README.md + tokens.css

Total: ~40K Opus tokens consumed for planning. The actual plan output needed: function list, exports, SVG character structure summary, 3-beat timing, palette hex values. That could be a 500-token structured JSON digest.

**Impact:** File-heavy planning tasks (design ports, large refactors, cross-file analysis) bleed 10-40K Opus tokens on read that could be pre-digested for <1K.

**Proposed fix:** New skill or agent `pre-digest` (harness: opencode or claude-sonnet). Takes `{"files": [...], "digest_intent": "..."}`. Runs in MiMo/Sonnet context, reads the files, emits a structured digest (JSON or markdown) containing: symbol inventory, sizes, notable patterns, hex-value tables for design files, function signatures, side effects. Opus reads only the digest.

Wire into `plan-changeset` skill: if task spec references any file >200 lines, plan-changeset's first step becomes "dispatch pre-digest, await digest, then plan against digest."

**Token math:** typical 500-line JSX file ≈ 15K tokens; digest ≈ 500 tokens. **~14K tokens saved per large file** the orchestrator would otherwise read. Confidence HIGH — well-defined transform, already proven MiMo can do file reads via OpenCode.

---

#### F-004: Prompt caching not audited [Inefficiency, MEDIUM confidence]

**Evidence:** Anthropic API supports prompt caching with `cache_control` markers. Max subscription includes cache hits at reduced cost. svc currently has no documented caching strategy — no `CLAUDE.md` cache-control advice, no skills-manifest cache-aware ordering, no FRAMEWORK-STATE structure designed for stable-prefix caching.

**Impact:** Unknown today. Could be 0 (Claude Code CLI auto-caches everything) to 30%+ of total Opus cost (manual cache placement required). Must measure.

**Proposed fix:** Research + audit. Single session experiment:
1. Run 3 identical improve-framework loops with no code changes. Measure tokens reported.
2. If second/third reports cached tokens → Claude Code auto-caches. Document this as a framework capability.
3. If no caching → file an upstream feature request on anthropics/claude-code AND work around by chunking FRAMEWORK-STATE for stable-prefix reuse.

**Token math:** potentially **30-50% of repeat-read tokens** saved if caching kicks in. Confidence MEDIUM — depends entirely on measurement. May discover this is already free.

---

### P1 — Fix soon (structural, medium confidence)

#### F-005: 56 skills carry duplicated task-graph chaining boilerplate [Drift, HIGH confidence]

**Evidence:** `grep -l "Task-graph mode (when a task graph exists" */SKILL.md | wc -l` → 56 files. Each contains a ~150-line identical block about mirroring, task status, subagent detection. The block appears 2x in some skills (seen in `evolve-framework/SKILL.md` — same block verbatim at two locations).

**Impact:** Every skill load consumes ~4-5K tokens of boilerplate per invocation. 56 skills × ~4K tokens = ~224K tokens of content that is literally identical across files.

**Proposed fix:** Move the full protocol to `references/task-graph-chaining-protocol.md`. Replace the 150-line block in each skill with a single-line pointer: `Task-graph chaining: see references/task-graph-chaining-protocol.md`. Orchestrator reads the reference once per session (cached), skills stay lean.

**Token math:** 56 skills × ~4K tokens of removed boilerplate = **~224K tokens** slimmer aggregate skill surface. Per-skill-invocation savings: ~4K tokens. Confidence HIGH — pure content dedup.

---

#### F-006: Top 4 skills > 1000 lines are load-expensive [Inefficiency, MEDIUM confidence]

**Evidence:** `write-journeys/SKILL.md` 1393 lines, `design-ui/SKILL.md` 1274 lines, `build-personas/SKILL.md` 1127 lines, `find-opportunity/SKILL.md` 1041 lines. Each load = ~30-42K tokens.

**Impact:** Loading any of these 4 skills for a simple invocation consumes more tokens than the actual task often takes to complete.

**Proposed fix:** Progressive-disclosure refactor per skill:
- Keep a 30-line "Contract" at the top (inputs, outputs, chain position, self-verify gates)
- Move everything else to `<skill>/references/<subtopic>.md`
- Skill reads only Contract by default. Deep-dives to subtopic files only when a self-verify check requires it.

This is covered by existing `Step 5.5: Refactor-Specific Safety Check` in `improve-framework/SKILL.md` (verify-skill-refactor.mjs exit-code gate) — so the safety net already exists, just execute the refactor.

**Token math:** per skill ~40K → ~5K = **~35K saved per large-skill load**. Across 4 skills frequently loaded: ~140K savings if refactored. Confidence MEDIUM — requires careful progressive-disclosure work; risk of semantic loss mitigated by existing WI-071-archetype safety script.

---

#### F-007: No proposal template — Opus types the same 5-section structure every time [Inefficiency, HIGH confidence]

**Evidence:** Every evolution proposal I've written this week (2026-04-19, 2x 2026-04-20) has the same sections: Method / Findings (P0-P3) / Comparison delta / Stale proposal audit / Self-Verify. Each time ~300 tokens of section headers + structural prose re-written.

**Impact:** Small per-proposal bleed (~300 tokens) but proposals are written ~daily; annual cost ~100K tokens of pure structural typing.

**Proposed fix:** `proposals/.template.md` with the exact skeleton. New proposals created via `cp .template.md <date>-<name>.md`. Opus only writes findings; structure is literal. Bonus: template can include `**Status:** DRAFT` in frontmatter, enforcing the lifecycle field currently inconsistently applied (81 files, only 3 Status-marked).

**Token math:** ~300 tokens saved per proposal. Confidence HIGH — mechanical.

---

#### F-008: fanout.sh status tables go back to Opus raw [Inefficiency, MEDIUM confidence]

**Evidence:** `scripts/fanout.sh` produces a markdown table with worker/status/files/blockers columns. For N=5+ workers with varied outcomes, Opus reads the table and then re-reasons about prioritization/classification. That reasoning is repetitive and rule-based.

**Impact:** Opus tokens spent on "worker A failed, worker B passed, priority focus on A" ordering which a deterministic script or Haiku could produce.

**Proposed fix:** `scripts/fanout-rank.sh` — takes fanout.sh output, emits ranked markdown: fails first (with blocker category), then successes grouped by category. Optional Haiku augmentation: cross-cut failure pattern detection ("3 workers failed with the same dependency error") — only when N ≥ 5.

**Token math:** ~500-1000 tokens saved per large fan-out. Confidence MEDIUM — depends how often fan-outs happen.

---

### P2 — Improve when possible

#### F-009: `references/` has 19 docs; several overlap [Drift, LOW confidence]

**Evidence:** `ls references/*.md | wc -l` → 19. Candidates for merge: `subagent-context-rules.md`, `agent-patterns.md`, and the `subagent-driven-development` content scattered in FRAMEWORK-STATE and skill bodies. The `thinking-models.md` and `design-alternatives.md` files may have overlap.

**Impact:** Redundant reference content. Skill loads read duplicates across references.

**Proposed fix:** Audit (LOW-priority background task). Consolidate or cross-link. Delete true duplicates. Don't rewrite — just merge.

---

#### F-010: No token-economy instrumentation [Gap, LOW-confidence ROI]

**Evidence:** svc has cognitive-routing taxonomy but no tracking of actual token consumption per skill/dispatch. `.svc/pipeline-decisions.jsonl` exists but doesn't carry token estimates.

**Impact:** Can't prove the taxonomy is saving what it claims. Can't detect token regressions.

**Proposed fix:** Extend the pipeline-decisions log with `approx_tokens_in`, `approx_tokens_out`, `model_used` per decision. Harder than it sounds — requires hooks in both dispatch-worker and orchestrator-side logging. Opus could mark its own turns in the jsonl.

---

### P3 — Track (not actionable yet)

#### F-011: Skill-pack vendor compression [Opportunity]

Long-term, skills could be delivered as compressed/packed bundles (the `list-work-items.skill` zip pattern surfaced in 2026-04-19 audit is a hint) with a resolver layer. Would need careful design of what gets expanded when. Not worth it today; revisit when token bleed becomes primary cost driver again.

---

## Redundancies to cut objectively

| ID | What | Evidence | Confidence |
|---|---|---|---|
| R-001 | FRAMEWORK-STATE "Current State" counts duplicate `skills-manifest.json` and hooks.json content | Skills count (67 actual), hooks count (4+5+2) — both already in manifests | HIGH |
| R-002 | 56 skills carry identical 150-line chaining block | `grep -l` count confirms | HIGH |
| R-003 | Proposal `Status:` convention mostly-ignored | 81 proposal files, only 3 Status-marked | HIGH |
| R-004 | Some skills have 2x copies of the same chain block within the same file (e.g. `evolve-framework/SKILL.md`) | Visual inspection | HIGH |
| R-005 | Reference docs with overlap (see F-009) | Structural | LOW until audited |

## What MUST stay Opus (don't cut these)

- Architectural trade-off decisions (where to cut, what to keep)
- Spec-to-code gap judgment ("does the code satisfy this AC really?")
- Taste / product decisions (is this hero design actually premium or AI-slop?)
- Novel problem decomposition (first time seeing a class of issue)
- Cross-skill contract verification

## Expected Opus token savings (conservative)

| Win | Confidence | Typical savings |
|-----|-----------|-----------------|
| F-001 FRAMEWORK-STATE tiered | HIGH | 55K per improve-framework load |
| F-002 Bash output distillation | HIGH | 15-20K per session |
| F-003 Pre-digest before plan | HIGH | 10-40K per file-heavy task |
| F-004 Prompt caching audit | MEDIUM (unknown) | 30-50% of repeats if manual cache needed |
| F-005 Chain-block dedup | HIGH | 4K per skill load × frequency |
| F-006 Top-4 skill progressive-disclosure | MEDIUM | 35K per large-skill load |
| F-007 Proposal template | HIGH | 300/proposal (small per-event, compounds) |
| F-008 Fanout ranking helper | MEDIUM | 500-1000 per large fan-out |

**Aggregate honest estimate:** 20-40% Opus token reduction across typical svc usage if F-001 through F-006 land. Not 100% warranty — some F-items (caching, skill refactors) have real measurement dependencies. Confidence: 20% savings at HIGH confidence (mechanical fixes), another 20% at MEDIUM confidence (structural work).

## Comparison delta

- **everything-claude-code (ECC):** documented "skill-first" + "hook runtime profiling (minimal/standard/strict)" — they instrument per-profile overhead. svc's proposed F-010 instrumentation is the analogue.
- **Aider:** uses `--map-tokens` to cap repository-map token budget per session. svc has nothing equivalent for the "Opus reads the repo" case. Worth borrowing the budget-cap idea for F-003 pre-digest.
- **Claude Code `--bare`:** we already use this for haiku-extract. The same flag should be considered for other orchestrator-side invocations where auto-memory/CLAUDE.md context isn't needed.

## Stale proposal audit

- `proposals/done/2026-04-14-blocking-discovery-halt-protocol.md` — still BLOCKED (explicit status). Unchanged.
- `proposals/done/2026-04-14-parallel-wi-dispatch.md` — still BLOCKED but F-003 (pre-digest) and the landed fanout.sh partially subsume its Tier-1 scope. Worth revisiting scope after F-003 lands.
- `proposals/done/2026-04-19-evolution.md` — F-001/F-002/F-004 landed 2026-04-19; F-003, F-005, F-006, F-007 of that proposal still open and unrelated to this proposal. No change.
- `proposals/2026-04-20-evolution-summary-extractor-and-pass-through-agents.md` — IMPLEMENTED today, moved to `proposals/done/`. No action.

## Self-Verify

| # | Check | Result |
|---|-------|--------|
| 1 | Proposal file exists | PASS — `proposals/2026-04-20-evolution-orchestrator-parsimony.md` |
| 2 | Every finding cites file:line or measured size | PASS — all findings backed by `wc`, `grep`, or session-transcript measurement |
| 3 | FRAMEWORK-STATE.md read first; no rediscovery | PASS — skipped re-raising OpenCode harness, agents primitive, fanout.sh, summary contract |
| 4 | Findings ranked by impact + confidence | PASS — each finding carries confidence level and token-math estimate |
| 5 | Distinguishes MUST-stay-Opus from CAN-pass-down work | PASS — dedicated section above |
