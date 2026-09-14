# SVC Framework Evaluation — 2026-06-06

**Evaluator:** Claude Opus 4.8 (1M) · deep exploration (3 parallel audits: skills catalog, runtime hooks, product-shipping evidence) + measured probes on this machine · adversarially reviewed tri-model (see `docs/specs/reviews/framework-eval-plan-cross-model.md`)
**Scope:** the framework as installed and operating on this machine, scored against mid-2026 agent-harness state of the art and Claude Code native capabilities.
**Fix backlog derived from this doc:** WI-357..WI-371 (`docs/specs/work-items/INDEX.md`), executed sequentially per `~/.claude/plans/dazzling-chasing-honey.md` (plan v3).

## What this is

A 2-month, 1,018-commit effort (2026-04-06 → 2026-06-06): 82 manifest skills (212 SKILL.md files on disk incl. external packs), 7 lanes, 7 gates, refuse-mode plan→exec→review chain enforced by git hooks + receipts (git notes on `refs/notes/svc-receipts`), 117-concern subject-matter routing registry, 4-tier eval system (194 tier-1 hermetic validators), cross-model adversarial review (Codex/Gemini), 5-host capability matrix, and an incident→learning→rule→validator self-healing loop.

## Scorecard

| # | Dimension | Score | One-line justification |
|---|---|---|---|
| 1 | Verification & evidence discipline | **9/10** | Receipts-as-git-notes, evidence-graded findings, pre/post validation loop, provider-fidelity contract — ahead of industry |
| 2 | Learning / self-improvement loop | **8/10** | Auto-capture (correction-after-failure + recursive-reproduction detection), confidence scoring, 3-fires→rule promotion, `evaluate-rule` gate |
| 3 | Safety & git discipline | **8/10** | Destructive-op evidence pre-checks, worktree isolation, config protection, no-verify blocking |
| 4 | Determinism & mechanical enforcement | **7/10** | Refuse-mode chain + L1/L2/L3 strong; but no CI (now WI-358 local-first), many MANDATORY steps prose-only |
| 5 | Framework testability | **7/10** | 194 tier-1 hermetic + promotion discipline; tier-3 LLM-judge at 2.8% coverage (WI-368) |
| 6 | Multi-model orchestration | **6.5/10** | Profiles + resolver + adversarial-reviewer resolution ahead of most; registry pins `claude-opus-4-7` (WI-357); EXEC=MiMo economics inverted (cheapest model on costliest-to-review path) |
| 7 | Skill & routing architecture | **6/10** | Lane model sound, review-family boundaries crisp, concern registry novel; but 212 SKILL.md ≈ 930K tokens of catalog, core-path skills 830–1,106 lines with est. 25–45% mandatory-step dropout |
| 8 | Runtime hook engineering | **5/10** | 28-event coverage + cross-host parity matrix excellent; but 14 subprocess spawns/Edit (~55–90ms each, ~1s total measured), live duplicate wiring (`svc-loop-guard` ×2), 914-line monolith guard |
| 9 | Docs/state coherence | **5/10** | FRAMEWORK-STATE.md 368KB/4,950 lines (unreadable in one call — WI-362); CLAUDE.md contradicted live chain mode + skill count + model IDs (fixed 2026-06-06); 3 model tables disagreed |
| 10 | Native-harness alignment (mid-2026) | **5/10** | Hand-rolled fanout/dispatch/extraction predates native Workflow tool, `Agent(isolation:worktree)`, TaskCreate, cron (WI-367); host matrix itself found stale (Background-tasks row wrong) |
| 11 | Product ROI | **4/10** | 54% of classified commits are framework-on-framework; 313 WIs are ~all framework-scoped; Example Marketplace (real, 2,540 commits) lives elsewhere; revenue shipped: none visible. The repo ships `honest-diagnosis`/`stage-revenue` — it knows |
| 12 | Context economy | **3/10** | ~34K tokens of rules (42 files, 137KB on disk) injected into EVERY session on this machine + 232 skills globally symlinked; violates the repo's own `references/context-budget.md` doctrine at the harness layer |

**Weighted overall ≈ 6/10** — with two 9-class subsystems most teams don't have, dragged by two fixable failure modes (context economy, self-absorption).

## Measured evidence (this machine, 2026-06-06)

- Hook timings (warm): `svc-workflow-guard` 60ms, `svc-loop-guard` 91ms, `svc-skill-artifact-authenticity` 55ms; **14 hook commands fire per Edit** (8 PreToolUse + 6 PostToolUse) ≈ ~1s blocking per edit
- Live duplicate wiring in `~/.claude/settings.json`: `svc-loop-guard` twice (one with `"$TOOL_INPUT"`, one without — wire-hooks dedup is substring-based); `svc-workflow-guard` spawns twice (default + `--phase-boundary`)
- Rules: 42 files / 248KB dir / ~137KB injected text ≈ ~34K tokens per session, every project
- Skills: 232 symlinks in `~/.claude/skills/`; native description budget = 1% of context window with least-invoked-dropped-first eviction → svc skills compete with capacitor/marketing packs for budget slots (live trigger-reliability risk, not just cost)
- Commit-ratio: of classifiable commits, ~54% framework-self-improvement vs ~46% product; 116 FRAMEWORK-STATE analysis entries (53 in May–Jun alone)
- Receipts gap found during execution: 2 unpushed research commits carried only ineligible quick-fix receipts; pre-push validates the whole range (caught by Codex live-probing; backfilled 2026-06-06)

## What is genuinely ahead of the industry (preserve at all costs)

1. **Receipts chain** — SHA-keyed envelopes as pushable git notes, verified at pre-push, reconciled L3. Unfakeable provenance.
2. **Concern registry** — subject-matter → required-thinker routing with severity calibration, FP mitigation, waiver-with-audit, hit logging. Not productized anywhere else we found.
3. **Learning pipeline** — SessionStart preload, auto-captured correction/recursion detection, confidence scoring, promotion-to-rule, and `evaluate-rule` (gating rule adoption on *beating default model behavior* — a question most teams never ask).
4. **Provider-fidelity test contract** — assert source + quality + monetary consistency, never `success===true`.
5. **Host capability matrix** — doc-verified per host (and the discipline that maintains it: `rules/host-capability-research.md`).

## Ranked fixes → work items

| Fix | WI | Expected effect |
|---|---|---|
| Context diet ph.1 — signal-gated rules (~6 always-on) | WI-361 | ~25–30K tokens/turn reclaimed; measurably better instruction-following |
| Hook dedup + async observational hooks | WI-359 | ~½–1s/edit reclaimed; dedup-bug class killed at wire layer |
| Local pre-push tier-1 gate (cloud CI deferred — private-repo minutes) | WI-358 | "forgot to lint" class dies at zero quota cost |
| Model-registry refresh + single-sourced tables | WI-357 | Ceremonies can't break on retired model IDs (FIRST to execute) |
| Quick-fix carve-out for exempt-class commits | WI-360 | Policy/mechanics gap closed; docs commits stop needing envelopes |
| Skill-catalog budget occupancy (flags/plugins/paths/budget) | WI-365 | Right descriptions occupy the native budget; trigger reliability |
| FRAMEWORK-STATE slim | WI-362 | Self-knowledge file readable in one call |
| Phase-receipt automation (observable phases only) | WI-363 | Ceremony dropout class shrinks; judgment stays manual |
| Generate-don't-lint (5-way sync) | WI-364 | Doc drift impossible instead of detected |
| Core-skill diet (5 skills ≤300 lines) | WI-366 | Hot-path cognitive load down |
| Native transport re-base research | WI-367 | Roadmap to delete custom transport ×5 hosts; host-matrix corrections |
| Tier-3 judge coverage top-10 | WI-368 | Semantic eval signal |
| Decay discipline + ratio telemetry (measurement only) | WI-369 | Scar-tissue accumulation stops; 54% number visible monthly |
| Hook dispatcher consolidation (conditional on 359 re-measure) | WI-370 | Remaining latency, if any |
| Phase-0 meta-WI (this intake) | WI-371 | Honest envelope provenance |

## Appendix — native-capability verification (2026-06-06, via claude-code-guide agent against live docs)

- `disable-model-invocation: true` → skill exits model context entirely until user-invoked (**zero cost**, doc-quoted); `user-invocable: false` → hidden from / menu, description still loads; `context: fork` (v2.1.117+) → skill runs in forked subagent inheriting parent context
- **Skill-description budget exists natively**: 1% of context window default, least-invoked dropped first, 1,536-char/entry cap; knobs: `skillListingBudgetFraction`, `maxSkillDescriptionChars`, `SLASH_COMMAND_TOOL_CHAR_BUDGET`, `skillOverrides` (name-only collapse), `paths:` frontmatter (glob-scoped loading)
- Plugins: bundle `skills/` + `agents/` + `hooks/hooks.json` (**auto-wired on enable** — retires wire-hooks settings-mutation on Claude host) + `.mcp.json` + `monitors/`; per-project committable `enabledPlugins`; disabled = zero tokens; marketplace.json schema under-documented → probe before building
- Async hooks: `"async": true` / `"asyncRewake": true` (wakes on exit-2); per-event support not enumerated → verify empirically
- Native subagent frontmatter: 16 fields incl. `maxTurns`, `permissionMode`, `disallowedTools`, per-agent `hooks:`, `skills:` preload, `memory:`, `background:`, `effort`, `isolation: worktree`
- **FRAMEWORK-STATE host matrix found stale** (audited 2026-05-09, wrong by 2026-06-06): "Background tasks ❌" false (live: `run_in_background`, `/tasks`, `background: true`); Workflow/Monitor/Cron/plugin-auto-wiring absent; gemini host logs `Invalid hook event name: "UserPromptSubmit"/"Stop"` (parity drift) → corrections are a WI-367 deliverable via live probes
- `claude plugin details <name>` shows projected token cost — present in live CLI help, absent from docs (CLI is authority)
- Ecosystem (gemini-cli scan, `scratch/research-catalog-deferral-gemini.md` → merged in `docs/analysis/skill-catalog-context-research-2026-06-06.md`): glob-scoped rules and project partitioning are PROVEN patterns; custom tool/skill retrieval is EXPERIMENTAL with documented failure modes (vocabulary-gap trigger misses, bridge-tool blindness, silent-fallback hallucination) → adopted as svc anti-goals
