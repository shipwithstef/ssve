# GSD Parity Scorecard

**Purpose:** Per-feature comparison of svc vs GSD (`get-shit-done` v1.50.0) and gsd-2 (Pi SDK harness v2.78.1). Drives the per-feature iteration the user mandated: for any feature where GSD does something svc doesn't (or does it better), produce a 10-scenario impact analysis + blast radius BEFORE deciding whether to adopt. Adopt only when ALL 10 scenarios are positive AND blast radius is zero-regression.

**Sources:**
- `references/knowledge/gsd/CAPABILITIES.md` (GSD v1.50.0)
- `references/knowledge/gsd-2/CAPABILITIES.md` (gsd-2 / Pi SDK)
- `references/knowledge/gsd/details/*.md` (21 detail files, ~200 micro-features extracted)
- `references/knowledge/gsd-2/details/*.md` (10 detail files)
- `proposals/done/2026-04-08-blend-gsd-reblend.md` (PR-merged)
- `proposals/done/2026-04-30-blend-gsd-2.md` (PR-merged)
- `proposals/2026-05-12-blend-gsd-read-before-edit.md` (open in worktree, never landed)
- `proposals/2026-05-12-blend-gsd-validation-routing.md` (open in worktree, never landed; concludes svc is BETTER → SKIP)

**Verdict legend:**
- ✅ already-have — svc has functional equivalent (cite the artifact)
- 🟡 partial — svc has some, gaps exist
- ❌ missing — svc has no equivalent
- ✋ skipped — prior analysis decided not to adopt (link)
- 🟢 done-blend — already merged into svc via prior blend PR
- 🔵 open-blend — proposal exists, not yet shipped
- 🆕 not-yet-proposed — first time on the radar

**Iteration process per row** (the user's directive):
1. Work the curated **Next-action queue** at the bottom of this scorecard FIRST (those are the priority rows). When the queue is empty, then pick the topmost remaining row whose verdict is ❌ / 🟡 / 🔵 / 🆕. (Codex round-2 caught the conflict between "topmost row" and the queue.)
2. Open `docs/specs/framework-parity/feature-deep-dives/<feature-slug>.md`
3. Write **10 concrete improvement scenarios** (real session situations where svc would behave better) AND **blast radius** (every existing svc artifact this would touch + regression risk)
4. Submit the deep-dive to `codex review --base origin/main` for adversarial check
5. If all 10 scenarios positive AND blast radius = zero-regression → open implementation PR via `plan-changeset` → `review-plan` (codex) → `execute-changeset` → `review-cross-model` (codex) → `land-changeset`
6. If any scenario fails OR regression risk surfaces → mark ✋ skipped with link to the deep-dive
7. Update this scorecard's verdict column on every adoption / rejection

---

## Master feature table

### Big-rocks (CAPABILITIES.md headers)

| # | Feature | Source | svc current state | Adjacent svc artifact | Prior blend | Verdict | Next |
|---|---------|--------|-------------------|----------------------|-------------|---------|------|
| 1 | 4-layer stack (Command → Workflow → Agent → CLI) | gsd/CAPABILITIES.md § Core Architecture | 🟡 partial | skill / SKILL.md / scripts/lib/*.mjs (3-layer) | 🟢 (covered by 2026-04-08 reblend) | ✅ already-have-different-shape | none |
| 2 | File-based state in `.planning/` | gsd § Core Architecture | ✅ | `.svc/` directory + state-io.mjs atomicity | 🟢 | ✅ | none |
| 3 | Fresh context per agent | gsd § Core Architecture | 🟡 partial | dispatch-worker.sh isolates execution but not strictly fresh per task | 🟢 (partial) | 🟡 | deep-dive |
| 4 | Thin orchestrators | gsd § Core Architecture | ✅ | route-workflow + skill files | 🟢 | ✅ | none |
| 5 | Vertical MVP / TDD / UAT planning track | gsd § Core Architecture (v1.50.0) | ❌ | (none) | 🆕 | ❌ | deep-dive |
| 6 | Six namespace meta-skills (gsd:workflow, etc.) | gsd § Core Architecture (v1.41.0) | ❌ | (none) | 🆕 | ❌ | deep-dive |
| 7 | Absent = enabled (config defaults) | gsd § Core Architecture | 🟡 partial | some configs default to enabled, not consistent | 🆕 | 🟡 | deep-dive |
| 8 | discuss → plan → execute → verify → ship pipeline | gsd § Pipeline | ✅ | route-workflow lanes + plan-changeset / execute-changeset / verify-promotion / land-changeset | 🟢 | ✅ | none |
| 9 | new-project: 4x parallel research → synthesis | gsd § Pipeline | 🟡 | research skill exists, parallel-4x synthesis pattern not formalized | 🆕 | 🟡 | deep-dive |
| 10 | discuss-phase: assumptions-analyzer / advisor-researcher | gsd § Pipeline | 🟡 partial | `discuss-phase/SKILL.md` exists as a generic phase orchestrator but does NOT implement GSD's specific assumptions-analyzer or advisor-researcher agent patterns. The autonomous-discuss-phase proposal (`proposals/2026-05-12-autonomous-discuss-phase-with-adversarial-review.md`) is still DRAFT, never implemented. (Codex round-1 caught the false ✅) | 🔵 (proposal only, not landed) | 🟡 | deep-dive |
| 11 | plan-phase: research → plan → verify loop (max 3) | gsd § Pipeline | 🟡 | plan-changeset has loop, not bounded at 3 with bounce | 🆕 | 🟡 | deep-dive |
| 12 | execute-phase: wave execution with atomic commits | gsd § Pipeline | ✅ | dispatch-waves/SKILL.md | 🟢 | ✅ | none |
| 13 | verify-work: human acceptance testing UAT | gsd § Pipeline | 🟡 | test-journeys covers some, no UAT.md artifact | 🆕 | 🟡 | deep-dive |
| 14 | ship: PR creation | gsd § Pipeline | ✅ | land-changeset + merge-pr-with-review-receipt | 🟢 | ✅ | none |
| 15 | Package Legitimacy Gate (v1.42.0) — 3-layer hallucinated-package defense | gsd § New Core Mechanisms | ❌ | (none) | 🆕 | ✅ adopt | **deep-dive #2 verdict: 10/10 positive, zero-regression with offline-fallback. Implementation PR pending.** |
| 16 | Graphify Commit-Based Staleness (v1.41.0) — `built_at_commit` in graph.json | gsd § New Core Mechanisms | ❌ | (none) | 🆕 | ❌ | deep-dive |
| 17 | Context-Window Utilization Guard (v1.40.0) — warn 60%, critical 70% | gsd § New Core Mechanisms | 🟡 partial | hooks/svc-pre-compact-snapshot.mjs is adjacent (snapshot, not warn) | 🆕 | ✅ adopt v1 (Claude-only) | **deep-dive #3 verdict: 10/10 positive, zero-regression. v1 ships Claude-only; v2 expands per-host.** |
| 18 | Phase-Lifecycle Status-Line | gsd § New Core Mechanisms | ❌ | (none) | 🆕 | ❌ | deep-dive |
| 19 | TDD Pipeline Mode (v1.36.0) | gsd § New Core Mechanisms | 🟡 | write-e2e/SKILL.md is partial coverage | 🆕 | 🟡 | deep-dive |
| 20 | Plan Bounce (v1.36.0) — bounce inadequate plans back | gsd § New Core Mechanisms | ❌ | (none) | 🆕 | ❌ | deep-dive |
| 21 | TypeScript SDK for headless/programmatic execution | gsd § SDK | 🟡 | scripts/* is bash-and-node, no SDK exposed | 🆕 | 🟡 (low priority) | defer |

### gsd-2 (Pi SDK harness) features

| # | Feature | Source | svc current state | Adjacent svc artifact | Prior blend | Verdict | Next |
|---|---------|--------|-------------------|----------------------|-------------|---------|------|
| 22 | 6 execution modes (TUI / RPC / web / print / sub / auto) | gsd-2 § Core Architecture | ✅ | svc is host-agnostic; modes flow from the host's surface | 🟢 (per gsd-2 reblend) | ✅ | none |
| 23 | State machine auto mode: Milestone → Slice → Task | gsd-2 § Core Architecture | 🟡 | route-workflow lanes + lane-tasks have a state machine, not formalized as Milestone hierarchy | 🟢 (partial) | 🟡 | deep-dive |
| 24 | Fresh session per unit (clean ~200K context) | gsd-2 § Core Architecture | 🟡 | dispatch-worker.sh fresh-spawns; per-task freshness not enforced | 🟢 (partial) | 🟡 | deep-dive (overlaps #3) |
| 25 | Git isolation via worktrees | gsd-2 § Core Architecture | ✅ | scripts/worktree.sh | 🟢 | ✅ | none |
| 26 | Extension-first loading (21 bundled + topological sort) | gsd-2 § Core Architecture | 🟡 | skills-manifest.json + EXTERNAL_ADDONS.md, no topological sort | 🟢 (partial) | 🟡 | deep-dive |
| 27 | Pi SDK monorepo (pi-ai, pi-agent-core, pi-coding-agent, ...) | gsd-2 § Core Architecture | 🟡 | references/model-registry.json + scripts/resolve-model.sh; no monorepo SDK | 🟢 (partial) | 🟡 (low priority) | defer |
| 28 | Native Rust engine (libgit2, ripgrep, ast-grep, ...) | gsd-2 § Core Architecture | ❌ | (none — svc uses node + bash) | 🆕 | ✋ SKIPPED | **deep-dive #6: 0/10 positive, 6 negative (rewrite scope, zero-dep doctrine violation, install-flow degradation, new failure surface, maintainer-burden, user explicitly said no rewrite). Hedge: targeted helpers can use rg/ast-grep IF AVAILABLE without adopting the engine.** |
| 29 | Discovery (package.json `pi` manifest precedence) | gsd-2 § Extensions | 🟡 | skills-manifest.json + scripts/lint-skills-manifest.mjs | 🟢 (partial) | 🟡 | deep-dive |
| 30 | Validation D-03–D-10 (extension validation) | gsd-2 § Extensions | 🟡 | scripts/validate-* covers some validation classes | 🟢 (partial) | 🟡 | deep-dive |
| 31 | `/gsd` command with 26 natural-language routes | gsd-2 § GSD Extension | ✅ | route-workflow handles freeform intent routing | 🟢 | ✅ | none |
| 32 | 16-category preferences wizard | gsd-2 § GSD Extension | ❌ | mine-builder skill is adjacent | 🆕 | ❌ | deep-dive |
| 33 | 12 bootstrap tool sets | gsd-2 § GSD Extension | 🟡 | bootstrapStartSequence in skills-manifest is adjacent | 🆕 | 🟡 | deep-dive |
| 34 | Write-gate with depth verification | gsd-2 § GSD Extension | 🟡 | hooks/svc-workflow-guard.mjs has write-gate; "depth verification" missing | 🆕 | 🟡 | deep-dive |
| 35 | Tool-call loop guard (SHA-256) | gsd-2 § GSD Extension | ✅ | hooks/svc-loop-guard.mjs | 🟢 | ✅ | none |
| 36 | 20+ LLM provider support | gsd-2 § Pi SDK | 🟡 | references/model-registry.json supports 5 hosts; provider expansion possible | 🟢 (partial) | 🟡 | defer |
| 37 | Three-tier model registry (generated/custom/patches) | gsd-2 § Pi SDK | 🟡 | references/model-registry.json is single-tier | 🆕 | 🟡 | deep-dive |
| 38 | OAuth + API key auth | gsd-2 § Pi SDK | 🟡 | host-specific (claude/codex/gemini/kimi all have own auth) | 🆕 | 🟡 | defer |
| 39 | Compaction | gsd-2 § Pi SDK | 🟡 | hooks/svc-pre-compact-snapshot.mjs covers pre-compact snapshot | 🟢 (partial) | 🟡 | deep-dive |
| 40 | Session manager | gsd-2 § Pi SDK | 🟡 | .svc/session-contract.jsonl is adjacent | 🟢 (partial) | 🟡 | deep-dive |
| 41 | Blob store / artifact manager | gsd-2 § Pi SDK | ❌ | (none) | 🆕 | ❌ | deep-dive |
| 42 | Skills loading | gsd-2 § Pi SDK | ✅ | skills-manifest.json + provision/hosts/* | 🟢 | ✅ | none |
| 43 | N-API Rust modules (git, grep, AST, glob, fuzzy, diff, process tree, TTSR, truncate, JSON, stream, xxHash) | gsd-2 § Native Engine | ❌ | (none — bash + node) | 🆕 | ✋ SKIPPED | **superseded by deep-dive #6.** Same rationale as #28: architecture-level + zero-dep doctrine + rewrite. |
| 44 | Web UI / Studio / VS Code extension | gsd-2 § Web/Studio | ❌ | (none — svc is CLI-only) | 🆕 | ❌ | defer (out of scope for now) |
| 45 | 5 built-in agents (worker, planner-sonnet, reviewer-sonnet, researcher, debugger-sonnet) | gsd-2 § Agents | 🟡 partial | svc has the AGENT primitive (`agents/README.md` defines it as distinct from skills — locked-down sub-sessions, often `tools: []`) and 4 actual agents: `plan-reviewer.md`, `strategic-reviewer.md`, `summary-extractor.md`, `svc-kimi-executor.md`. GSD has 5 with different role coverage: worker (executor), planner-sonnet (planner), reviewer-sonnet (reviewer — closest svc match: plan-reviewer/strategic-reviewer), researcher (research role; svc has `research/SKILL.md` but as skill not agent), debugger-sonnet (debug role; svc has none). Codex round-3 caught the conflation of skills vs agents — they are distinct primitives. | 🟢 (primitive landed) + 🆕 (role-coverage gap) | 🟡 | deep-dive (which of GSD's 5 agent roles need svc agent equivalents?) |
| 46 | Memory: 4-entry-point ingest with secret redaction (10 regex patterns) | gsd-2 § Memory | 🟡 | hooks/svc-auto-capture-learnings.mjs + manage-learnings; secret-redaction missing | 🟢 + 🆕 | ✅ SHIPPED in PR #136 | **deep-dive #4 → implementation: catastrophe-class secret leak closed. 25/25 fixtures.** |
| 47 | Orchestrator meta-skill for autonomous builds (5-step spec→software) | gsd-2 § Orchestrator | ✅ | route-workflow + autorun-orchestrator pattern | 🟢 | ✅ | none |

### Detail-file deep-dives (200+ micro-features)

These are the candidate features extracted from `references/knowledge/gsd/details/*.md` and `gsd-2/details/*.md`. Listed with one-line descriptors here; full per-row analysis happens only when a 10-scenario deep-dive is started for that micro-feature.

| # | Feature | Source | svc current state | Adjacent svc artifact | Prior blend | Verdict | Next |
|---|---------|--------|-------------------|----------------------|-------------|---------|------|
| 48 | Markdown frontmatter parsing (`bin/lib/frontmatter.cjs`) | 10-common-drills #1 | ✅ | yaml-parse equivalents in scripts | — | ✅ | none |
| 49 | Config loading & merging (`bin/lib/config.cjs`) | 10-common-drills #2 | ✅ | provision/hosts/*.json + skills-manifest.json | — | ✅ | none |
| 50 | LLM XML tag parsing (`sdk/src/plan-parser.ts`) | 10-common-drills #3 | ❌ | (svc uses markdown not XML in plans) | — | ✋ SKIPPED | **deep-dive #7: 0/10 positive, 9 negative (JSON is strictly less ambiguous; LLMs emit malformed XML in more ways; even GSD-2 moved to SQLite+JSON; svc's JSON+markdown is the right shape).** |
| 51 | Agent prompt building (`sdk/src/prompt-builder.ts`) | 10-common-drills #4 | ❌ | (svc skill files ARE the prompts) | — | ✅ | none |
| 52 | Event stream transport & ANSI coloring | 10-common-drills #5 | ❌ | (host handles UI) | — | ✅ | none |
| 53 | Temp file garbage collection | 10-common-drills #6 | 🟡 | scripts/state-lock.mjs has stale-cleanup at 10min | 🆕 | 🟡 | deep-dive |
| 54 | Cross-platform path normalization | 10-common-drills #7 | 🟡 | scripts/lib/* uses node:path; not exhaustive | 🆕 | 🟡 (low) | defer |
| 55 | Sub-repo detection | 10-common-drills #8 | ❌ | (none) | 🆕 | ❌ | deep-dive |
| 56 | JSON error boundaries | 10-common-drills #9 | 🟡 | scripts/state-io.mjs + try/catch idioms | 🆕 | 🟡 | deep-dive |
| 57 | Git command wrapper | 10-common-drills #10 | 🟡 | scripts/dispatch-worker.sh + scripts/worktree.sh | 🆕 | 🟡 | defer |
| 58 | Schema drift detection & verification | 10-deep-drills #1 | 🟡 | scripts/sync-spec-code is adjacent | 🆕 | 🟡 | deep-dive |
| 59 | Multi-repo ancestor discovery | 10-deep-drills #2 | ❌ | (none) | 🆕 | ❌ | deep-dive |
| 60 | Event-sourced planning journal | 10-deep-drills #3 | 🟡 | .svc/pipeline-decisions.jsonl is event-sourced | 🆕 | 🟡 | deep-dive |
| 61 | Interactive pattern stripping (prompt sanitizer) | 10-deep-drills #4 | ❌ | (none) | 🆕 | ❌ | deep-dive |
| 62 | YAML scalar coercion | 10-deep-drills #5 | 🟡 | (yaml-parse libraries handle this) | — | ✅ | none |
| 63 | Context-window utilization math | 10-deep-drills #6 | ❌ | (none — overlaps #17) | 🆕 | ✅ adopt v1 (overlapping with #17) | **superseded by deep-dive #3.** Pure-math classifier ships in row #17's implementation PR. |
| 64 | Plan bounce integrity guard | 10-deep-drills #7 | ❌ | (overlaps #20) | 🆕 | ❌ | deep-dive |
| 65 | Orphan worktree detection | 10-deep-drills #8 | 🟡 | scripts/worktree.sh has list/clean | 🆕 | 🟡 | deep-dive |
| 66 | Resurrection-detection guard | 10-deep-drills #9 | ❌ | (none — high-value pattern) | 🆕 | ✅ adopt | **deep-dive #5 verdict: 10/10 positive, zero-regression. Catches silent merge resurrections.** |
| 67 | Tri-state git commit staleness | 10-deep-drills #10 | 🟡 | overlaps #16 graphify staleness | 🆕 | 🟡 | deep-dive |
| 68 | Event stream SDK decoupling | 10-more-drills #1 | 🟡 | (svc uses jsonl event log) | — | 🟡 | defer |
| 69 | Phase runner state machine | 10-more-drills #2 | 🟡 | route-workflow phases + lane-tasks | — | 🟡 | defer |
| 70 | Flat-to-namespaced state migration | 10-more-drills #3 | ❌ | (none — svc has stayed flat) | 🆕 | ❌ | deep-dive |
| 71 | Cross-phase UAT aggregation | 10-more-drills #4 | ❌ | (overlaps #13) | 🆕 | ❌ | deep-dive |
| 72 | Deterministic secret masking | 10-more-drills #5 | ❌ | (overlaps #46 secret-redaction) | 🆕 | ✅ SHIPPED (in PR #136) | **superseded by deep-dive #4 + PR #136.** Both regex-pattern redaction AND config-key masking shipped. |
| 73 | Dynamic persona generation | 10-more-drills #6 | 🟡 | build-personas/SKILL.md is the equivalent | 🟢 | ✅ | none |
| 74 | Plan DAG validation (`bin/lib/verify.cjs`) | 10-more-drills #7 | ✋ SKIP GSD pattern + 🟡 pending compensating linter | GSD's XML DAG approach correctly skipped per deep-dive #8 (0/10 positive, 8 negative — svc's concern-routing architecture is strictly better). The compensating action — `scripts/validate-concern-parity.mjs` (linter for F-6 deploy-concurrent failure mode) — remains pending as a separate small implementation PR. | 🔵 (analysis: skip GSD pattern + add svc linter) | ✋ SKIP (deep-dive #8) + 🟡 pending linter | **deep-dive #8: 0/10 positive, 8 negative.** GSD's DAG NOT adopted. Linter ships as separate ~50-line PR. |
| 75 | Summary hallucination guard | 10-more-drills #8 | 🟡 | hooks/svc-skill-artifact-authenticity.mjs is adjacent | 🆕 | 🟡 | deep-dive |
| 76 | Context-aware initialization | 10-more-drills #9 | 🟡 | scripts/setup is svc init | 🆕 | 🟡 | defer |
| 77 | Pipe-based commit validation (`hooks/gsd-validate-commit.sh`) | 10-more-drills #10 | 🟡 | hooks/svc-pre-commit-multi-host-check.sh | 🆕 | 🟡 | deep-dive |
| 78 | Read-Before-Edit Guard (`hooks/gsd-read-guard.js`) | hooks.md / 2026-05-12-blend-gsd-read-before-edit | ❌ | (proposal exists, never landed) | 🔵 | ✅ adopt | **deep-dive #1 verdict: 10/10 positive, zero-regression with fixture-path exemption + compaction-invalidation mitigations. Proposal hardened across 6 codex rounds + Phase-2 round-1 + round-2. Implementation PR pending.** |
| 79 | Statusline hook | hook-internals.md | 🟡 | hooks/svc-notification-surface.mjs is adjacent | 🆕 | 🟡 | deep-dive |
| 80 | Context monitor hook | hook-internals.md | 🟡 | overlaps #17 | 🆕 | ✅ adopt v1 (overlapping with #17) | **superseded by deep-dive #3.** Hook ships in row #17's implementation PR. v2 expands per-host. |
| 81 | Verifier few-shot patterns | intelligence-data #1 | 🟡 | review-gate skill is adjacent; no few-shot library | 🆕 | 🟡 | deep-dive |
| 82 | Plan-checker negative control examples | intelligence-data #2 | 🟡 | review-plan skill is adjacent | 🆕 | 🟡 | deep-dive |
| 83 | Parallel phase XML schema | intelligence-data #3 | ❌ | (svc uses md not XML) | — | ✋ SKIPPED | **superseded by deep-dive #7.** Same rationale as #50. |
| 84 | Requirement traceability table | intelligence-data #4 | 🟡 | docs/specs/work-items + INDEX.md is adjacent | 🆕 | 🟡 | deep-dive |
| 85 | UI-SPEC visual contract | intelligence-data #5 | 🟡 | design-ui/SKILL.md exists; UI-SPEC template missing | 🆕 | 🟡 | deep-dive |
| 86 | Goal-backward verification logic | intelligence-data #6 | 🟡 | references/verification-patterns.md exists | 🟢 | ✅ | none |
| 87 | Context degradation warning signs | intelligence-data #7 | 🟡 | references/context-budget.md exists | 🟢 | ✅ | none |
| 88 | Continuous context thread schema | intelligence-data #8 | ❌ | (none) | 🆕 | ❌ | deep-dive |
| 89 | AI framework selection matrix | intelligence-data #9 | 🟡 | references/knowledge/competitive-domains.json + competitors/ | 🟢 | ✅ | none |
| 90 | Force-stance review prompt (Nyquist auditor) | intelligence-data #10 | 🟡 | review-cross-model has adversarial framing | 🟢 | 🟡 | deep-dive |
| 91 | Post-planning gap analysis | last-bits #1 | 🟡 | review-plan tier-1 covers some | 🆕 | 🟡 | deep-dive |
| 92 | Ultraplan cloud offloading | last-bits #2 | ❌ | (none — interesting paradigm) | 🆕 | ❌ | defer (depends on cloud infra) |
| 93 | Atomic state patches | last-bits #3 | ✅ | scripts/state-io.mjs writeJsonAtomic | 🟢 | ✅ | none |
| 94 | Multi-block decision merging | last-bits #4 | 🟡 | .svc/pipeline-decisions.jsonl is single-block-per-line | 🆕 | 🟡 | deep-dive |
| 95 | Subprocess CLI bridge | last-bits #5 | 🟡 | scripts/dispatch-worker.sh is adjacent | 🆕 | 🟡 | defer |
| 96 | iOS app scaffold mandate (XcodeGen) | meta-reasoning #1 | ❌ | (out of scope — Capacitor/Ionic skills handle iOS) | — | ✅ (intentional skip) | none |
| 97 | SwiftUI API availability gate | meta-reasoning #2 | ❌ | (out of scope) | — | ✅ (intentional skip) | none |
| 98 | First principles thinking model | meta-reasoning #3 | 🟡 | references/thinking-models.md exists | 🟢 | ✅ | none |
| 99 | Simpson's paradox awareness | meta-reasoning #4 | 🟡 | references/thinking-models.md exists | 🟢 | ✅ | none |
| 100 | Survivorship/confirmation bias counters | meta-reasoning #5 | 🟡 | references/thinking-models.md exists | 🟢 | ✅ | none |
| 101 | Steel man alternative analysis | meta-reasoning #6 | 🟡 | references/thinking-models.md exists | 🟢 | ✅ | none |
| 102 | Pre-mortem analysis model | meta-reasoning #7 | ❌ | (none — explicit pre-mortem skill missing) | 🆕 | ❌ | deep-dive |
| 103 | MECE task decomposition | meta-reasoning #8 | 🟡 | dispatch-waves uses MECE-ish breakdown | 🆕 | 🟡 | defer |
| 104 | Reversibility test (Analysis vs Cost) | meta-reasoning #9 | ✅ | rules/destructive-git-ops.md is adjacent + system prompt has reversibility framing | 🟢 | ✅ | none |
| 105 | Curse of knowledge counter | meta-reasoning #10 | 🟡 | references/thinking-models.md exists | 🟢 | ✅ | none |
| 106 | SPIDR story splitting rules | methodology-scripting #1 | ❌ | (none) | 🆕 | ❌ | deep-dive |
| 107 | Thinking models clusters (Execution / Debug / Verification) | methodology-scripting #2-4 | 🟡 | references/thinking-models.md is single-doc | 🟢 (partial) | 🟡 | deep-dive |
| 108 | Artifact taxonomy lifecycle | methodology-scripting #5 | 🟡 | docs/specs structure is artifact-typed | 🟢 (partial) | 🟡 | deep-dive |
| 109 | Doc conflict engine | methodology-scripting #6 | 🟡 | scripts/sync-spec-code is adjacent | 🆕 | 🟡 | deep-dive |
| 110 | Smart Discuss (autonomous mode) | methodology-scripting #7 | 🔵 | proposals/2026-05-12-autonomous-discuss-phase-with-adversarial-review.md (open) | 🔵 | 🔵 | already in flight |
| 111 | Shipped-path cherry-pick filter | methodology-scripting #8 | ❌ | (none) | 🆕 | ❌ | deep-dive |
| 112 | Prose token stripping | methodology-scripting #9 | ❌ | (none) | 🆕 | ❌ | deep-dive |
| 113 | Traceability table extraction | methodology-scripting #10 | 🟡 | overlaps #84 | — | 🟡 | merge with #84 |
| 114 | Trackable decision parser | final-drills #1 | 🟡 | .svc/pipeline-decisions.jsonl is queryable | 🆕 | 🟡 | deep-dive |
| 115 | Non-canonical plan diagnostic | final-drills #2 | ❌ | (none) | 🆕 | ❌ | deep-dive |
| 116 | ADR-driven evolution (`docs/adr/`) | final-drills #3 | 🟡 | proposals/ + decisions/ in svc are adjacent | 🆕 | 🟡 | deep-dive |
| 117 | Phase decimal increment logic | final-drills #4 | ❌ | (none — svc uses tranches not decimal phases) | 🆕 | ❌ | deep-dive |
| 118 | Architectural debt markers | final-drills #5 | ❌ | (none) | 🆕 | ❌ | deep-dive |
| 119 | Atomic state update loop | final-drills #6 | ✅ | scripts/state-io.mjs | 🟢 | ✅ | none |
| 120 | Intelligent markdown normalization | final-drills #7 | 🟡 | (some scripts handle markdown; not exhaustive) | 🆕 | 🟡 | defer |
| 121 | Hook architecture / lifecycle events | hooks-security § Hook Architecture | 🟡 | hooks/* exists; not as event-typed as gsd's Stop / SessionEnd / PreToolUse / etc. | 🟢 (partial via WI-343) | 🟡 | deep-dive |
| 122 | Hook safety properties | hooks-security § Hook Safety Properties | 🟡 | hooks/svc-workflow-guard.mjs has guards | 🆕 | 🟡 | deep-dive |
| 123 | Security system | hooks-security § Security System | 🟡 | rules/destructive-git-ops + svc-config-protection guard | 🟢 (partial) | 🟡 | deep-dive |
| 124 | Build system | hooks-security § Build System | ❌ | (svc has no build — SKILL.md files load as prompts) | — | ✅ (intentional skip) | none |
| 125 | SDK internals | sdk-internals.md | ❌ | (svc has no SDK; overlaps #21) | — | 🟡 | defer |

---

## Open questions (resolve via codex review on this scorecard)

1. Are there GSD features NOT in `references/knowledge/gsd/details/` or `gsd-2/details/` that this scorecard misses? (Codex should grep its own knowledge against the latest GSD repo.)
2. Are any of the "✅ already-have" classifications actually false-positives (svc has the noun but not the substance)?
3. Are any of the "❌ missing" classifications actually false-negatives (svc has it under a different name)?
4. Which deep-dive priorities should be re-ordered? (Currently flagged PRIORITY: #15 Package Legitimacy Gate, #17 Context-Window Utilization Guard, #46 Memory Secret Redaction, #66 Resurrection-Detection Guard, #72 Deterministic Secret Masking, #78 Read-Before-Edit Guard.)

## Codex review record

| Round | Submit SHA | Diff SHA | Model | Findings | Resolution |
|---|---|---|---|---|---|
| 1 | `d373f93` | `2ba26b6` | gpt-5.5 (codex review) | 2 P2: orphan blend proposals not committed; row #10 false-positive ✅ | both addressed in `c280f30`-precursor |
| 2 | `ed536e3` | `ea2531c` | gpt-5.5 (codex review) | 3 P2: detail-table column count mismatch; queue-vs-topmost conflict; read-before-edit proposal used wrong (host-specific) tool names | all addressed in `c280f30` |
| 3 | `c280f30` | `e959bc5` | gpt-5.5 (codex review) | 4 findings (2 P2 + 2 P3): apply_patch multi-file gap; read-cache path not gitignored; row #45 (agents) misclassified as ✅; this review-record table was stale | all addressed in `ed6179b` |
| 4 | `ed6179b` | `bb2a78e` | gpt-5.5 (codex review) | 3 P2 on read-before-edit proposal: Add-File would be hard-blocked; OpenCode lowercase tool names missed entirely; Grep wrongly satisfies cache | all addressed in `c5cde86` |
| 5 | `c5cde86` | `48bef97` | gpt-5.5 (codex review) | 3 findings (2 P2 + 1 P3): Codex has NO Read tool surface (need Bash-command-pattern strategy); Gemini matcher should be `write_file\|replace\|edit` not `replace_string`; this table missing round 4 | all addressed in `52c2f47` |
| 6 | `52c2f47` | `95a6451` | gpt-5.5 (codex review) | 3 P2: extractFilePath return-type change would break existing callers; row #74 ✋ would drop the validate-concern-parity linter work; family-to-concern slug snake_case-vs-kebab-case mismatch in validation-routing proposal | findings #1 + #2 addressed in this commit; finding #3 (slug normalization) carried as **acknowledged residual** for the validation-routing implementation PR — NOT a scorecard-level blocker. Per cross-model-review-loop proposal's 6-round cap: terminal_state = `cap_reached_with_acknowledged_residuals`. |

## Next-action queue

**Completed deep-dives** (deep-dives done; next step is the IMPLEMENTATION PR for each):

| Row | Status | Implementation PR |
|---|---|---|
| #78 Read-Before-Edit Guard | Deep-dive #01 ADOPT, proposal hardened across 6+1+1 codex rounds | pending |
| #15 Package Legitimacy Gate | Deep-dive #02 ADOPT | pending |
| #17 / #63 / #80 Context-Window Utilization Guard | Deep-dive #03 ADOPT v1 (Claude-only) | pending |
| #46 / #72 Memory Secret Redaction | Deep-dive #04 ADOPT — TOP PRIORITY | **SHIPPED in PR #136** |
| #66 Resurrection-Detection Guard | Deep-dive #05 ADOPT | pending |
| #28 / #43 Native Rust Engine | Deep-dive #06 SKIP | n/a |
| #50 / #83 LLM XML plan parsing | Deep-dive #07 SKIP | n/a |
| #74 Plan DAG Validation | Deep-dive #08 SKIP GSD pattern + pending `validate-concern-parity.mjs` linter | pending small PR |

**Next deep-dive candidates** (after the pending implementations land):

Topmost-row scan finds these as the next-highest-priority unresolved rows:
- #3 Fresh context per agent — 🟡 partial
- #5 Vertical MVP / TDD / UAT planning track — ❌
- #6 Six namespace meta-skills — ❌
- #11 plan-phase: research → plan → verify loop (max 3) — 🟡
- #16 Graphify Commit-Based Staleness — ❌
- #20 Plan Bounce — ❌

Each deep-dive is its own commit, submitted to codex review, with verdict updated in this scorecard's Verdict column.
