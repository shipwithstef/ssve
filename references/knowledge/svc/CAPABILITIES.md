# svc (Serious Vibe Coding) — Capabilities

Source: this repo (/workspace/seriousvibecoding)
Version: v1.5.3 (77 skills, 31 APs, 18 references, 7 lanes, 7 gates)
Last updated: 2026-07-23
Self-extracted: full L3 analysis

## What It Is

Progressive deterministic development framework — vision to verified code in one prompt. Builder-aware: mines who you are before deciding what to build. Rejects bad ideas with evidence. Self-assesses market readiness instead of asking. 77 skills, 7 review gates (G1-G7), 7 workflow lanes, 31 anti-patterns, 17 reference docs.

## Pre-Pipeline (builder-aware)

| Capability | Skill | What it does |
|---|---|---|
| Builder profiling | `mine-builder` | Financial, time, skills, social, tools, entity, goals, project history, failure patterns → ~/.svc/builder-profile.md |
| Opportunity finding | `find-opportunity` | Reverse-engineer market winners, match to builder advantages, score top 3 |
| Revenue staging | `stage-revenue` | Break big ideas into Stage 1 (fast money 1-2 weeks) → Stage 2 (reinvest) → Stage 3 (the real thing) |
| Idea intake | `capture-idea` | Zero-friction backlog intake. Formats high-level ideas structurally and deduplicates against existing features and work items with "Something like that might exist" follow-ups. |
| Candidate reservoir and triage | `scripts/candidate-harness.mjs` + `/cos` | Imports high-volume pre-WI candidates into project/scope-keyed local SQLite, exports deterministic Git mirrors, verifies declared code targets, ranks with the exact product/grounding/growth/DB/security formula, and records explicit retry-safe promote/reject decisions without touching customer databases or creating WIs. |
| Intent routing | `route-workflow` | Freeform text → right skill/lane. Autorun drives one-prompt-to-product within the active session, with file-backed resume when sessions stop. P0 virtual founder takes human checkpoints. Auto-readiness trigger when graphs=0 + no critical WIs. |
| Solution confidence protocol | `route-workflow` + `design-tech` + `explore-solutions` + delivery graph compiler/validator | Triggered by "best solution", "right design", "all cards on the table", "golden standard", real-world examples, cost/cache grounding, or "by design auto" language. Defaults to `design_auto`: run grounding/research/design/exploration and then continue through planning/implementation via the normal lane after `SOLUTION-CONFIDENCE.md` selects a direction and includes an action-by-action approval packet. A human gate happens after design only if the user explicitly requests `post_design_human_gate`; the delivery graph mechanically blocks `plan-changeset` until approval in that mode. The artifact covers current-state grounding, prior-decision analysis, five-or-more sourced examples, cost/cache/freshness classes, options, tradeoffs, an action-by-action what/why/how impact/proof packet, outcome coverage, and external-suggestion triage. |
| Market readiness judge | `assess-market-readiness` | 4 modes (launch/hackathon/vc/pmf), 8-dimension scoring, multi-role judge simulation (YC partner, VC, hackathon panel, synthetic user), ICP discovery with real exemplar search, cold outreach briefs. Never asks user — reads project artifacts. |

## Pipeline (progressive narrowing) — Greenfield Lane (21 skills)

| Position | Skill | Artifact | Status transition |
|---|---|---|---|
| 1 | `write-vision` | docs/specs/vision.md | → ACTIVE |
| 2 | `analyze-domain` | docs/specs/domain-profile.md | — |
| 3 | `analyze-competitors` | docs/specs/analyze-competitors.md (4-tier: direct/adjacent/emerging/macro, up to 20, moat scoring 1-5, staleness trigger) | — |
| 4 | `build-personas` | docs/specs/personas/P*.md + PERSONA_INDEX.md | — |
| 5 | `validate-feature` | docs/specs/features/*-brief.md (Ship Brief or NO-SHIP) | — |
| 6 | `write-spec` | docs/specs/features/<name>.md | → DRAFT |
| 7 | `audit-ac` | (same spec, audited ACs) | — |
| 8 | `write-journeys` | docs/specs/journeys/J*.feature.md + JOURNEY_INDEX.md | — |
| 9 | `design-ux` | docs/specs/ux/<name>.md | → UX-REVIEWED |
| 10 | `design-ui` | docs/specs/ui/<name>.md + design-system.md | → DESIGNED |
| 11 | `track-visuals` (baseline) | docs/specs/visuals/baseline/ | — |
| 12 | `design-tech` | (spec enriched with architecture) | → BASELINED |
| 13 | `explore-solutions` | docs/specs/explorations/<name>/DECISION.md | — |
| 14 | `define-code-style` | docs/specs/style-contract.md | — |
| 15 | `plan-changeset` | docs/plans/<date>-<name>/manifest.md | → CHANGE-SET-APPROVED |
| 16 | `execute-changeset` | Code in worktree + checkpoint commits | — |
| 17 | `track-visuals` (diff) | docs/specs/visuals/diffs/ | — |
| 18 | `review-gate` | Gate decision (G5) | — |
| 19 | `audit-implementation` | docs/specs/audit/<name>-analysis.md | — |
| 20 | `land-changeset` | PR merged to main | → PROMOTED |
| 21 | `verify-promotion` | Spec updated to VERIFIED | → VERIFIED |

**Conditional interstitial skill:** `discuss-phase` runs only when bounded gray areas remain after validation, spec, UX, or technical design work. It produces `docs/specs/discussions/<topic>.md`, records the decision set, and routes onward as `proceed`, `blocked`, `rerouted`, or `not-needed`.

## Other Lanes

| Lane | Skills | Purpose |
|---|---|---|
| brownfield-conversion | onboard-repo → audit-coverage → sync-work-items | Convert existing repo to svc + classify canonical artifact coverage |
| brownfield-feature | sync-spec-code → validate-feature → write-spec → write-journeys → design-ux → design-ui → track-visuals → design-tech → explore-solutions → define-code-style → plan-changeset → execute-changeset → track-visuals → review-gate → audit-implementation → land-changeset → verify-promotion | Add feature to existing project |
| bugfix | diagnose-bug → plan-changeset → execute-changeset → review-gate → audit-implementation → land-changeset → verify-promotion | Fix bugs with root-cause-first approach |
| drift | sync-spec-code → write-journeys → sync-work-items | Detect and fix spec-code drift |
| refactor | sync-spec-code → plan-changeset → execute-changeset → review-gate → audit-implementation → land-changeset → verify-promotion | Restructure without behavior change |
| framework | test-framework → evolve-framework → blend-external → improve-framework | Self-improvement loop for known gaps and evidence-driven fixes; svc-on-svc regressions and new capabilities route separately per policy |

## Reject/Pivot System

| Capability | How |
|---|---|
| 7 kill signals | K1-K7: no demand, no pain, competitor shipped, vision misalignment, no kill condition, MVP is platform, existing solution |
| Builder history weighting | Past failures adjust kill signal sensitivity |
| NO-SHIP evidence package | Per-signal evidence + "what would change this" |
| Pivot protocol | 1-3 alternatives that play to builder strengths |
| Override | User provides counter-evidence for N-1 signals |

## Review System

| Gate | After | Type | Checks |
|---|---|---|---|
| G1 | write-spec | Revision | Stories testable? ACs specific? Dependencies identified? |
| G2 | design-ux | Revision | Flows cover all stories? States complete? Error handling? |
| G3 | design-ui | Revision | Design system consistency? Responsive? Component reuse? |
| G4 | design-tech | Revision | All ACs feasible? Architecture sound? Risks identified? |
| G5 | execute-changeset | Pre-flight | Diff matches design? Tasks cover ACs? No placeholders? |
| G6 | land-changeset | Pre-flight | Squash diff matches manifest? No unplanned changes? |
| G7 | verify-promotion | Revision+Escalation | Tests pass? QA complete? E2E complete? Spec updated? Responsive evidence? |

**Gate taxonomy:** 4 canonical types — pre-flight (validate before starting), revision (loop with feedback + stall detection), escalation (surface to developer), abort (stop to prevent damage).

**Stall detection:** If issue count doesn't decrease between consecutive review passes, escalate immediately instead of continuing to max iterations.

## Execution Discipline

| Capability | How |
|---|---|
| Deviation rules | Auto-fix bugs/missing/blocking, STOP for architecture changes |
| Scope prohibition | Banned phrases: "v1", "placeholder", "hardcoded for now" |
| Analysis paralysis guard | 5+ reads without a write = must explain or report blocked |
| 3-attempt limit | Task fails 3 times → stop, report blocker |
| Compression boundary | Late phases use compressed artifacts, not raw vision/personas |
| Stall detection | Review loop escalates if issue count doesn't decrease between passes |
| Test quality audit | Catch disabled tests, circular patterns, weak assertions, tautological expected values |
| Adaptive context enrichment | 1M models get richer subagent prompts (prior summaries, full spec context) |
| Schema drift detection | ORM changes without migration tasks flagged as pre-flight blockers |
| Claim provenance tagging | AP-24: every factual claim tagged FROM-SPEC/FROM-CODE/FROM-RESEARCH/ASSUMED |
| Agent completion markers | AP-23: standardized ## TASK COMPLETE / BLOCKED / CHECKPOINT handoff |
| Explicit task-graph contracts | Every skill now carries its own task-graph block; `Invoke: /skill-name` is routing metadata, not prose |
| File-backed task graph | `.svc/lane-tasks.json` is the cross-host source of truth; host-native task systems are mirrors |
| Repo-contract scan in Pre-Flight | Skill startup now checks router context, repo docs, platform config, then local/global skills in precedence order |
| Two-stage review | Pass 1 (spec compliance) then Pass 2 (code quality) — never mixed |
| Search Before Building | 3-layer check (framework → library → scratch) before unfamiliar patterns |
| Solution Confidence Before Planning | For confidence/right-design asks, require current-state grounding, why-current-exists analysis, world grounding with at least five real examples, cost/cache/freshness model, alternatives, tradeoffs, action-by-action what/why/how impact/proof coverage, outcome coverage, and external-suggestion triage before plan quality is considered valid; no human checkpoint unless the user explicitly requests one after design |
| Post-Deploy Evidence Lock | If a request or project context asks for post-deploy/live/production E2E, browser, visual, smoke, API, or validation proof, route-workflow preserves that as a hard evidence-stage constraint; local/pre-deploy evidence can support but cannot satisfy the proof, and onboarded project AGENTS/CLAUDE deployment rules override generic assumptions |
| Production-derived UI mock parity | Existing-component/screen UI changes require a `design-ui` mock parity ledger before planning or execution: affected component, production source paths, current-state evidence, intended final-state mock/evidence, usages/routes, spec ACs, journeys, states, viewports, and exclusions. `track-visuals`, `plan-changeset`, `review-gate`, and `test-journeys` consume the ledger so generic mocks or final-only screenshots cannot satisfy visual safety gates. |
| Active user intent precedence | UserPromptSubmit records latest prompts, correction/unrelated/stop/ignore signals, and explicit same-WI continuation in `.svc/active-intent-state.json`; the Stop completion guard checks that state before hard-blocking and downgrades stale suppressed WI pressure, or concrete WI contracts older than a latest non-WI prompt, to advisory-only output. |
| Persona coverage task-graph gate | New feature-class task graphs must carry `build-personas` or a top-level `persona_coverage` decision with an artifact/skip rationale; `scripts/task-graph.mjs validate` blocks manual `greenfield`/`brownfield-feature` graphs that silently omit persona evidence even when the delivery graph compiler was bypassed. |
| Persona trace evidence gate | Feature-class artifacts must carry concrete persona IDs/paths through spec, journeys, UX/UI, technical design, plan, E2E, and closeout evidence; `scripts/validate-feature-closeout-ledger.mjs` rejects weak `Persona(s)` cells such as `PASS`, `satisfied`, `customer`, `admin`, or `all users` unless the row gives an explicit `N/A - ...` reason. |
| Test framework bootstrap | Auto-detect/install test runner before TDD loop starts |
| Exact review-to-execute dispatch | WI-559 local remediation binds named/numeric WIs to exact one-read plan bytes, requires global same-WI manifest uniqueness and one YAML review-authority document, binds cache policy/mode/phase/station/workspace provenance, and never cache-replays Cursor workspace reviews. Execute preflight, file-backed Grok transport, canonical containment root, no-follow schema-v2 logger, and staged-src guard all re-resolve the current owner-policy tuple. Expanded local 99-case proof is green; independent remediated-tree review, promotion/install, and consumer replay remain pending. |
| Skill contract validators | `scripts/verify-skill-contract.mjs` checks declared output families, `track-visuals` review report arithmetic, and `test-journeys` next-skill validity before close-out |
| Leftover disposition closeout | `scripts/validate-leftover-disposition.mjs` blocks dirty mutating/end-to-end closeout unless every remaining path has a valid `committed`, `gitignored`, `deleted`, `local-evidence`, `deferred`, or `user-owned` disposition per `references/leftover-disposition.md`; explicit clean-repo requests require actually cleaning, committing, preserving, or removing residue rather than leaving a ledger-only handoff; tracked files still present in `git status` cannot be closed as `gitignored` |
| Wave closeout validation | `scripts/validate-wave-closeout.mjs` reconciles multi-WI batches against WI docs, INDEX rows, lane task graphs, latest zero-fail runtime evidence, and scoped worktree cleanup |

## Anti-Patterns (25 total)

| Category | APs | Key rules |
|---|---|---|
| Context/Token | AP-1 to AP-4 | Orchestrator reads summaries not code; pass paths not contents; never read auto-loaded skills; constrain searches |
| Execution | AP-5 to AP-10 | Specific git staging; respect locked decisions; progressive depth not checklists; no unrequested artifacts; stay in scope; no "while I'm here" |
| Code Quality | AP-11 to AP-15 | Chesterton's Fence; don't cargo-cult; existence ≠ implementation; test real interactions (mock gate); no hardcoded values |
| Communication | AP-16 to AP-18 | Ask on ambiguity; investigate failing tests; evidence for every claim |
| Skill Design | AP-19 to AP-20 | Pushy descriptions with trigger situations; never summarize workflow in description (CSO) |
| Review | AP-21 | Anti-sycophancy: verify before implementing reviewer suggestions |
| UI Design | AP-22 | AI Slop blacklist: 10 banned generic patterns |
| Subagent | AP-23 | Completion markers: ## TASK COMPLETE / BLOCKED / CHECKPOINT |
| Provenance | AP-24 | Tag every claim: FROM-SPEC / FROM-CODE / FROM-RESEARCH / ASSUMED |
| Security | AP-25 | Untrusted content fencing: wrap external web content in `<untrusted_content>` before LLM processing |

## Knowledge System

| Capability | How |
|---|---|
| 3-layer knowledge | INDEX.md → CAPABILITIES.md → details/ (load on demand) |
| 4-pass protocol | Shape → frontmatter scan → compare → deep dive |
| Library vs project | references/knowledge/ (reusable) vs docs/specs/ (project-specific) |
| Variable staleness | SHA for repos, 7 days for competitors, 30 days for domains |
| Self-knowledge | This file — svc describes itself in the same format it describes others |
| 6 external sources analyzed | GSD, gstack, superpowers, harness, anthropic-skills, oh-my-claudecode |
| Route-time research gate | Provider/API uncertainty should compile a blocking `research` task before dependent lane steps; `route-workflow` validates graph insertion while `research` owns domain gating and provenance. |

## State & Continuity

| Capability | How |
|---|---|
| Project state | `docs/specs/project-state.md` — <100 lines, read first by every skill; includes Current Focus (active WI/lane/task graph/fallback next item) and must sync at lane entry/resume when the active graph changes |
| Repo routing contract | `docs/specs/router-context.md` — repo-local routing-critical overrides: required skills by intent, forbidden flows, code-style authority, deployment/runtime contract, platform signals |
| Repo delegation topology | `docs/specs/agent-topology.md` — whether delegation is allowed, preferred roles by work type, ownership boundaries, shared write surfaces, stay-single-agent cases |
| Host-aware task continuity | `.svc/lane-tasks.json` is primary. Claude Code mirrors it with `TaskCreate` / `TaskUpdate` / `TaskList`; Kimi uses `/task` plus `TaskList` / `TaskOutput` for observation while the file remains authoritative; Codex mirrors the active step in `update_plan`; Gemini mirrors the active step in `write_todos`. Persisted top-level task timestamps are audit-grade wall-clock evidence, not placeholders. Resume logic must also short-circuit closed WIs: if a named WI graph has no actionable tasks and the WI file is already `VERIFIED`, svc returns a closed-state summary instead of resuming execution. |
| Dependency-safe task graphs | `scripts/task-graph.mjs` rejects duplicate ids, missing blockers, self-dependencies, and cycles; derives graph-level status from child tasks; `next` returns only runnable tasks with completed blockers; `init` / `set-status` provide replay-safe wall-clock timestamps for live task graphs; `load-skill` records cross-host skill-load receipts and `set-status ... completed` rejects non-skip completion without a matching receipt |
| Secure portable runtime state | One shared dependency-free resolver classifies runtime roots for Node and shell consumers: unset/nonexistent XDG falls back to a private current-user home-cache leaf, while existing unsafe roots fail closed and `/run/user/<uid>` is never manufactured. Repository-shared exact-OID Git CAS protects authority locks. The Codex loader proves receipt storage and current WI authority before graph activation, then exact retry forward-completes the sanctioned graph-first crash state. Promoted WI-506 proof refreshed all eight hosts with zero drift and replayed the original invalid-XDG Example Marketplace WI-496 ensure/loader path twice without product-tree change. |
| Deterministic bounded receipt reconcile | WI-509 promoted at `188ce557` and live-replayed: `scripts/svc-reconcile.mjs` batches checkpoint intervals into one bounded range check; the range validator reuses direct-SHA semantics through an ordered, capped, timeout-bounded worker pool with exact-SHA fail-closed infrastructure attribution. The original 166-SHA interval passes 166/166 in 3.84 seconds and canonical reconcile completes in 6.333 seconds with zero false debt and safe checkpoint advancement. Promotion repair remains detached behind atomic lock/outcome files, the watcher cutoff is preserved across degraded windows, and historical gaps close only through independently reviewed per-SHA envelopes with a write-once notes backup; mass waiver is not a recovery mode |
| Phase-receipt-aware completion integrity | WI-510 promoted in PR #175: one dependency-free task-local classifier gives the focused skip-integrity gate and overlapping registry/lane validators the same `executed`, `authorized-skip`, `legacy-compatible`, or fail-closed `invalid` interpretation. Current execution requires a matching structurally valid Phase-D receipt with safe non-empty evidence references; a skip additionally requires skill-bound delivery authorization, applicable registry condition, and matching justification. Prose-only, malformed, dangling, unregistered, backdated, and unsupported legacy-shaped claims remain red. |
| Continue-here | `.continue-here.md` — fallback resume file for non-task-graph sessions, deleted after pickup |
| Decision log | `.svc/pipeline-decisions.jsonl` — structured audit trail |
| Framework state | `FRAMEWORK-STATE.md` — what was analyzed, fixed, deferred, locked |
| Builder profile | `~/.svc/builder-profile.md` — persists across projects |
| Feature lifecycle | DRAFT → UX-REVIEWED → DESIGNED → BASELINED → CHANGE-SET-APPROVED → PROMOTED → VERIFIED + REJECTED/PIVOTED |

## Quality & Testing Skills

| Skill | What it does |
|---|---|
| `test-journeys` | Journey-first manual QA against live server |
| `write-e2e` | Playwright E2E tests from journey scenarios |
| `sync-spec-code` | Detect spec-code drift (PLANNED→RESOLVED→DRIFT) |
| `review-cross-model` | Adversarial review via second model (Codex CLI) |
| `review-security` | OWASP Top 10 + STRIDE threat model |
| `audit-implementation` | Deep correctness audit with 6 specialist subagents |

## Utility Skills

| Skill | What it does |
|---|---|
| `quick-fix` | Fast lane for ≤3 file changes |
| `diagnose-bug` | Root-cause-first debugging with hypothesis tracking and automatic discovery decomposition into independent WIs |
| `manage-learnings` | Persistent learning store with 3-question quality gate |
| `teach-project` | Owner guide calibrated to builder's knowledge gap |
| `plan-capabilities` | Classify project type, recommend MCPs/skills/research |
| `platform-operating-architect` | Classify platform operating model, split local/dev/staging/prod, define integration boundaries, and encode how svc should coexist with hosted platforms |
| `analyze-marketing` | Feature mining for product marketing context |
| `onboard-repo` | Convert existing repo to svc conventions |
| `audit-coverage` | Classify project against full svc canonical artifact catalog (CANONICAL/FOREIGN/MISSING) with consolidation recommendations |
| `sync-work-items` | Sync work items to GitHub Issues |
| `discover-skills` | Multi-source skill discovery (skills.sh + SkillHub) with merged ranking by install count + AI quality ratings |
| `monetization-architecture` | Feature→tier gating matrix with evidence grading (A-F), gating mechanism selection, wedge protection, enforcement audit |
| `extract-bootstrap` | Extract reusable patterns from existing codebases |
| `wsl2-audio` | WSL2 audio setup for voice mode |
| `audit-session-execution` | Session-forensics evidence engine: reconstruct expected vs actual execution from WI/task graph/logs/transcript, with host-trace discovery before declaring transcript evidence unavailable, before `evolve-framework` |

## Framework Self-Improvement

| Skill | Role in loop |
|---|---|
| `test-framework` | Evidence engine — static validation (9 scripts), live server tests, autopilot, comparison |
| `audit-session-execution` | Session replay engine — expected-vs-actual forensics from real runs, with framework-gap extraction and host-trace resolution |
| `evolve-framework` | Diagnosis engine — ranked gap proposals |
| `blend-external` | External comparison — exhaustive dimensional diff + dual assessment (blend opportunities + external addon viability) |
| `improve-framework` | Orchestrator — routes evidence → diagnosis → implementation → verification |
| `create-skill` | New skill creation with eval infrastructure |
| `research` | On-demand knowledge extraction (full L3 analysis) |

**svc-on-svc policy:** known framework gap or pending proposal → `improve-framework`; broken framework behavior → `diagnose-bug`; new framework capability → normal product pipeline on this repo; `explore-solutions` is mandatory after `design-tech` for hard-to-reverse framework architecture choices.

## Infrastructure

| Capability | How |
|---|---|
| Install | `git clone + ./setup --host claude` — symlinks skills + infra. `setup` refuses to run from inside `.worktrees/<name>/` (commit 52ef4eb 2026-04-25); bypass with `SVC_SETUP_ALLOW_WORKTREE=1` + mandatory reason. |
| Self-heal | SessionStart hook (`hooks/svc-session-start-healthcheck.mjs`) auto-runs setup against the canonical repo whenever it detects dangling symlinks under `~/.<host>/skills/` OR missing hook-command paths in host settings. Three-strategy `detectRepoRoot()` (WI-134 2026-04-29): (1) read `.source-repo`, reject `.worktrees/` substrings; (2) walk `scripts/` symlink, reject `.worktrees/`; (3) terminal fallback — filesystem scan over `~/app-workspaces` and `$SVC_REPO_SEARCH_PATHS` filtering `.worktrees/`, requiring `setup`+hook+`skills-manifest.json` to confirm a candidate, deterministic tie-break (basename-match → realpath-canonical → setup mtime), falling through to warn-and-exit-0 if multiple candidates remain ambiguous. Means even a fully-broken install (both `.source-repo` AND `scripts/` symlink simultaneously dead) self-heals on next session start. Escape hatch: `SVC_SELF_HEAL_DISABLE=1`. Inflow guard: `validate-source-repo-not-worktree.sh` (tier-1). Outflow regression: `validate-self-heal-survives-double-dead-pointer.sh` (tier-1). |
| Worktrees | `scripts/worktree.sh` — guard, create, promote, cleanup |
| Stale claim-v1 complete-tuple recovery | `scripts/svc-ensure-worktree.mjs` + `hooks/lib/wi-claim.mjs` classify one secure exact claim/binding tuple, preserve fresh foreign ownership, CAS stale foreign generation once with source provenance in the first durable winner write, retire the exact source binding, and resume the registered worktree in place. A post-CAS winner forward-completes without another generation bump. Malformed/mismatched/same-generation-foreign/ambiguous/symlinked/foreign-owned state denies; active or uncertain controller-lease-v2 evidence blocks standard v1 reclaim, and v1 never silently migrates to v2. WI-505 is promoted, installed, and live-proven by the original Example Marketplace WI-496 generation-1 to generation-2 reclaim plus idempotent second ensure. Full Tier-1 baseline exceptions remain separately documented; all WI-505-owned focused and review gates pass. |
| Hooks | 4 PreToolUse hooks (workflow-guard with config-protection, phase-boundary, bash-guard with block-no-verify+commit-quality, eval-gate-pre) + 2 PostToolUse (eval-gate-post, edit-accumulator) + 2 Stop (batch format+typecheck, completion guard). Profile: SVC_HOOK_PROFILE=minimal\|full. Selective disable: SVC_DISABLED_HOOKS. |
| Lint | `node scripts/lint-skills-manifest.mjs` — validates 5 source-of-truth files agree |
| Decision-log helper | `scripts/pipeline-log.mjs` appends JSONL only when `type` and `decided_by` match the documented enums |
| Provisioning | `provision/hosts/{claude,codex,gemini,kimi}.json` — capability-based install per host, including global builder-profile path, host capability flags, and task-graph contract metadata |
| AST eval validators | `validate-frontmatter-ast.mjs` + `validate-markdown-ast.mjs` — structural YAML/Markdown validation without grep-only shortcuts |

## Reference Docs (15 total)

| Reference | What it covers |
|---|---|
| `anti-patterns.md` | 24 universal anti-patterns across 8 categories |
| `verification-patterns.md` | 4-level verification (Exists/Substantive/Wired/Functional) + integration coherence (4 boundary areas) |
| `context-budget.md` | 4-tier degradation (PEAK/GOOD/DEGRADING/POOR) with actions per tier |
| `thinking-models.md` | 5 structured reasoning models for execution decisions |
| `design-alternatives.md` | 5-ranked alternatives protocol for every key design decision |
| `feature-toggles.md` | Mock-by-default convention for external dependencies |
| `agent-patterns.md` | 6 architecture patterns (pipeline, fan-out, expert pool, producer-reviewer, supervisor, hierarchical) |
| `subagent-context-rules.md` | 5 rules for scoped subagent prompts |
| `browse-integration.md` | gstack browse daemon integration for browser-dependent skills |
| `knowledge-protocol.md` | 4-pass extraction, library vs project storage, staleness rules |
| `skill-pack-comparison.md` | svc vs gstack vs superpowers capability mapping |
| `benchmark-findings.md` | Real measured results from framework testing |
| `pillars-coverage-matrix.md` | Canonical 8-pillar matrix for feature and bugfix close-out |
| `model-routing.md` | Haiku/Sonnet/Opus routing table per svc skill category + context-aware downgrade rule |
| `leftover-disposition.md` | Closeout ledger for remaining git-status paths, generated evidence placement, and transient log/cache handling |
| `wave-closeout-validation.md` | Batch WI closeout contract for WI docs, index rows, task graphs, runtime evidence, and scoped worktrees |

## Blend History (8 sources, 61 patterns taken)

| Source | Date | Patterns |
|---|---|---|
| gstack | 2026-04-05 | 9 (P0 persona, adversarial reviews, security audit, browse integration, etc.) |
| gstack (re-blend) | 2026-04-08 | 8 (Review Army, plan completion audit, scope drift, failure triage, etc.) |
| superpowers | 2026-04-05 | 2 (task graph, TDD execution) |
| superpowers (re-blend) | 2026-04-08 | 9 (CSO AP, anti-rationalization, two-stage review, mock gate, etc.) |
| oh-my-claudecode | 2026-04-05 | 4 (ambiguity gate, commit trailers, tri-model review, learning extraction) |
| claude-code-setup | 2026-04-05 | 2 (solution exploration, systems analysis) |
| GSD | 2026-04-06 | 11 (context budget, verification patterns, anti-patterns, deviation rules, etc.) |
| GSD (re-blend) | 2026-04-08 | 7 (gates taxonomy, stall detection, test quality audit, adaptive context, etc.) |
| anthropic-skills | 2026-04-06 | 1 (skill-creator fork) |
| harness | 2026-04-08 | 6 (agent patterns, pushy descriptions, near-miss testing, adaptive communication, etc.) |
| last30days-skill | 2026-04-12 | 2 (untrusted content fencing AP-25, fixture-based behavioral testing pattern) |

## What We DON'T Have (Known Gaps)

| Gap | Impact | Status |
|---|---|---|
| Gray area discussion phase | MED-HIGH | validate-feature partially covers |
| Wave-based parallel execution | MEDIUM | Inner worktrees exist, no wave numbering |
| Runtime context monitor hook | MEDIUM | Documented but no hook implementation |
| Prompt injection scanner hook | MEDIUM | Not implemented |
| Auto-advance state machine | MEDIUM | Level A is explicit across all skills; Level B branching/auto-eval still session-bound and host-dependent |
| Doctrine evidence debt for C1/C7 | MEDIUM | Needs repeat-run variance fixtures |
| Route-workflow provider/API research trigger gate | HIGH | Proposal drafted 2026-05-16; implementation still needs uncertainty-bound blocker signals, route-workflow detector docs, graph-shape validation, and tier-1 fixtures |

## What We Have That Others Don't

| Capability | Unique to svc |
|---|---|
| Builder profile (financial, social, tools) | Pipeline decisions are builder-aware |
| Kill signal reject/pivot | Pipeline can say "don't build this" with evidence |
| Revenue staging | First-project strategy: fast money → reinvest → real thing |
| Opportunity finding | Reverse-engineer market for builders without ideas |
| Progressive narrowing with 7 gates | More granular than GSD's discuss→plan→execute |
| Feature spec lifecycle (7+2 states) | DRAFT → ... → VERIFIED + REJECTED/PIVOTED |
| Mock-by-default with toggles | Every external dep has mock ON, real behind toggle |
| Teach-project owner guide | Builder learns what was built, calibrated to their knowledge gap |
| Framework self-improvement lane | test → evolve → blend → improve closed loop |
| Layered knowledge system | 3-depth persistent expertise that compounds across projects |
| AST-based eval validation | Proper YAML/Markdown parsing, not grep — 2263 structural checks |
| 24 anti-patterns | Most comprehensive anti-pattern collection across all frameworks |

## Details (Layer 3)

| Area | File |
|---|---|
| Skills catalog | [details/skills.md](details/skills.md) |
| References | [details/references.md](details/references.md) |
| Infrastructure | [details/infrastructure.md](details/infrastructure.md) |
| Doctrine | [details/doctrine.md](details/doctrine.md) |
