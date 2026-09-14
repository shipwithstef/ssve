# Framework Knowledge Index — Canonical Advisor Pack

This is the single first-load surface for any skill that asserts facts about
the svc framework itself: `svc-advisor`, `cos`, `capability-concierge`,
`route-workflow` advisory answers, and any closeout that names framework
machinery.

## Binding rules

1. **Cite-before-assert.** Every material framework claim in user-facing
   output must map to a file path below (`path § section`). If neither this
   index nor its Authority paths cover it, say so explicitly — never improvise.
2. **Verify beats memory beats stamps.** When precision matters, run the
   block's **Verify** command. The **Derived-at** date is a freshness hint,
   not a source of truth.
3. **Restamp in the same commit.** Any change that touches a domain below
   (skill add/remove, lane/gate change, host manifest change, review policy,
   governor config) must refresh the affected blocks' Derived-at dates in the
   same commit that changes the framework.

Derived-at for all blocks: **2026-09-14** unless stated otherwise
(WI-FW-ADVISOR-KNOWLEDGE-02: Cursor CLI x-high review transport, 105 skills, 329 tier-1 validators, WI-566 bounded review receipts, Landlock containment, session recovery).

---

## 1. Identity & counts

| Fact | Value | Authority | Verify |
|---|---|---|---|
| First-party skills | 105 in `includedSkills`; 59 in router core pack | `skills-manifest.json` | `node -e "console.log(require('./skills-manifest.json').includedSkills.length)"` |
| Review gates | G1–G7 (write-spec, design-ux, design-ui, design-tech, execute-changeset, land-changeset, verify-promotion) | `skills-manifest.json` `gates` | `node -e "const m=require('./skills-manifest.json');console.log(Object.keys(m.reviewGates\|\|m.gates))"` |
| Workflow lanes | 7: greenfield, brownfield-conversion, brownfield-feature, bugfix, drift, refactor, framework | `skills-manifest.json` `laneDefinitions` | `node -e "console.log(Object.keys(require('./skills-manifest.json').laneDefinitions).join(','))"` |
| Anti-patterns | 34 APs in the reference doc | `references/anti-patterns.md` | `grep -cE '^###? AP-[0-9]+' references/anti-patterns.md` |
| Provisioned hosts | 9: claude, kimi, codex, gemini, opencode, mimo-code, antigravity, cursor, grok | `provision/hosts/*.json` | `ls provision/hosts/*.json \| wc -l` |
| Tier-1 validators | 329 shell validators (*.sh); 370 total tier-1 scripts when including .mjs AST and contract checkers | `test-framework/evals/tier-1/` | `ls test-framework/evals/tier-1/*.sh \| wc -l` (329); `ls test-framework/evals/tier-1/* \| wc -l` (370) |
| Bootstrap sequence | 26 steps (greenfield minimal order) | `skills-manifest.json` `bootstrapStartSequence` | read manifest |

> ✅ Knowledge surfaces restamped: `references/knowledge/svc/CAPABILITIES.md` and
> `references/knowledge/svc/details/infrastructure.md` restamped to 105 skills, 9 provisioned hosts,
> Landlock containment, and Cursor x-high review transport on 2026-09-14 (WI-FW-ADVISOR-KNOWLEDGE-02).
> ⚠️ Warning on adjacent surfaces: `references/knowledge/svc/CAPABILITIES.md` and `references/knowledge/INDEX.md` were historically frozen at 77 skills (now updated to 105); legacy sections of `AGENTS.md` and `CLAUDE.md` previously mentioned 24 APs (now 34). Live framework truth is strictly governed by `skills-manifest.json` (105 skills), `references/anti-patterns.md` (34 APs), and this index.

## 2. Lanes, pipeline, pre-lane

| Fact | Authority |
|---|---|
| Lane selection is mandatory before any mutating work; if no lane fits, propose a new lane instead of forcing one | `skills/route-workflow/SKILL.md § Lane Model & Routing` |
| Pre-lane skill: `strategic-decision` operates ABOVE lanes and names the downstream lane in its DECISION.md | `skills/route-workflow/references/lane-model.md § Pre-lane skills` |
| Framework lane order: test-framework → evolve-framework → blend-external → blend-private → improve-framework (+ recall-stack-knowledge, plan-blast-radius, track-topology-diff, refresh-competitors as lane skills) | `skills-manifest.json` `laneDefinitions.framework.skills` |
| Universal Verification Principle: every code-changing lane must run runtime verification before closing; "deferred to deploy" is not verification | `skills/route-workflow/references/lane-model.md § Universal Verification Principle` |
| Delivery graph compiles at lane entry (`scripts/compile-delivery-graph.mjs`) into a normal `.svc/lane-tasks-<WI>.json` | `skills/route-workflow/references/lane-model.md § delivery graph` |

## 3. Review topology (v2)

| Fact | Authority |
|---|---|
| Topology is owner-configured in an external file (`SVC_REVIEWER_POLICY` / `~/.svc/reviewer-policy-v2.json` family); changing it needs no framework commit | `skills/review-exec/SKILL.md § Runtime v2 final-review station` |
| Deterministic resolution: `node scripts/review-topology-v2.mjs plan --orchestrator <host> --phase <phase>` emits schema v2 stations (observed mode: governed-triple; inline self-review always station 1; different-family external station owns release authority) | `scripts/review-topology-v2.mjs` |
| Cursor CLI x-high review station (WI-546): exact tuple `{ host: 'cursor', family: 'xai', model: 'cursor-grok-4.6-high', effort: 'high' }` maps to `cursor-agent` with `--model cursor-grok-4.6-high` (`fast: false`). Independent review authority requires explicit owner station opt-in `identity_requirement: "requested_accepted"`. Truthfully discloses requested CLI routing, NOT server-attested model identity; Auto/default remain advisory. Fails closed with no silent Claude/Sonnet remap (AC-546-6) | `FRAMEWORK-STATE.md § Session recovery and reviewer availability`; `test-framework/evals/tier-1/validate-wi546-cursor-live-acceptance.sh` |
| Bounded review receipts & 3-round cap (WI-566, WI-FW-CLEAN-MAIN-FOLLOWUP-01, WI-FW-PLAN-CERTIFICATION-01): pre-invocation check of signed 3-round inventory serialized by cycle lock through issuance. Completed attempts, route/usage, raw findings preserved in failure envelope + pre-failure receipt. Round-3 certification adjudication recognizes fixed-only High log dispositions; vetoes intact | `FRAMEWORK-STATE.md § Receipt cleanup compatibility` + `§ Released follow-up: review launcher recovery` + `§ Plan certification recovery` |
| Compression protocol (WI-557): self-pass + ONE external station; terminal confirm only if external found fixed HIGHs. Confirmatory re-reviews eliminated | `FRAMEWORK-STATE.md § Review Compression Protocol` |
| External-review fallback (WI-557): quota/billing/CLI-missing → local validation (tier-1 focused + manifest lint), log decision, mark PR `review-mode: local-validation`; retroactive review later. Never falls back on real test/lint/security failures | `FRAMEWORK-STATE.md § External Review Fallback Policy` + `§ Infrastructure Failure Auto-Fallback` |
| Claude-host post-exec review runs as ONE read-only fan-out (review-exec + auditor + specialists + visual lens over a frozen diff); non-Claude hosts keep the serial chain | `skills/route-workflow/SKILL.md § Post-exec review wave (WI-382)` |

## 4. Host wiring

| Fact | Authority |
|---|---|
| Capability matrix per host (hook events, wire protocol, task UI, subagents, background tasks) audited 2026-09-14 | `FRAMEWORK-STATE.md § Host Capability Matrix` |
| Per-host wirer scripts: claude `wire-hooks.mjs`, kimi `wire-kimi-hooks.mjs`, codex `wire-codex-hooks.mjs`, gemini `wire-gemini-hooks.mjs`, opencode `wire-opencode-hooks.mjs`, mimo-code `wire-opencode-hooks.mjs --host mimo-code`, cursor `wire-cursor-hooks.mjs`, grok `wire-grok-hooks.mjs`; antigravity none (skills-only) | same matrix row "svc wirer script" |
| Cursor hook wirer: `scripts/wire-cursor-hooks.mjs` configures `~/.cursor/hooks.json` (JSON stdin/stdout, exit-code-2 blocking, `CURSOR_TRACE_ID`, `CURSOR_AGENT`) | `scripts/wire-cursor-hooks.mjs` |
| PreTool decision engine: `hooks/lib/pretool-decision-engine.mjs` provides argv-aware fast path with native p95 budget; keeps mutation authority fail-closed across all hosts | AGENTS.md § Durable Mutation Authority; `hooks/lib/pretool-decision-engine.mjs` |
| Codex runs ONE serialized PreToolUse dispatcher through the `svc-enforce` launcher (WI-529) — not "no hooks"; coverage remains a guardrail, not a containment boundary | `FRAMEWORK-STATE.md § Truthful AGY receipts…` + AGENTS.md § Durable Mutation Authority |
| Gemini rejects `UserPromptSubmit`/`Stop` hook event names from project config (WI-367 live evidence) | `FRAMEWORK-STATE.md § Gemini parity-drift note` |
| Install = `./setup [--host X]`; content-addressed, transactional; refuses to run inside `.worktrees/` unless `SVC_SETUP_ALLOW_WORKTREE=1`; drift check `bash scripts/check-install-drift.sh --all-hosts` | AGENTS.md § Build; `setup` |
| Deploying/wiring hosts without a fresh `./setup` receipt is forbidden | AGENTS.md § Multi-Host Install Protection |

## 5. Worktree & mutation authority

| Fact | Authority |
|---|---|
| Feature work happens in git worktrees under `.worktrees/<branch>`; never `/tmp`; branch name = worktree dir name; `worktree.sh create` idempotent | AGENTS.md § Worktree Model; `scripts/worktree.sh` |
| Mutation baton: `repository → WI → branch → absolute_worktree → session_id → binding_generation`, established by `node scripts/svc-ensure-worktree.mjs --wi <WI> --branch <branch> --from origin/main --json --print-cd` before the FIRST repo write | `skills/route-workflow/SKILL.md § Hot Path` step 4 |
| Controller ownership = repository-shared CAS lease v2 with generation-bound resume/handover/recovery (WI-502); stale claim-v1 tuples auto-reclaim once via CAS (WI-505); active v2 lease evidence blocks v1 reclaim | `FRAMEWORK-STATE.md § Durable authority v2` + `§ Automatic stale complete-tuple reclaim` |
| Session recovery (WI-FW-SESSION-RECOVERY-01/02): registered external worktree resume without repeating `SVC_APPROVED_WORKTREE_ROOTS` when exact same-session tuple matches; dead/expired controller recovery when old checkout disappeared; foreign live owners and ambiguous worktrees remain denied | `FRAMEWORK-STATE.md § Session recovery correction` + `§ Session recovery and reviewer availability` |
| Read-only observation recovery (WI-FW-READONLY-OBSERVATION-01): strict local systemctl observation verbs and journalctl query options operate without WI/lease/task state; pagers disabled before classification; service mutations/redirections remain governed | `FRAMEWORK-STATE.md § Read-only observation and pending-task recovery` |
| Mutating child tasks require persisted delegation + isolated inner worktree; supported on Linux via probed Landlock wrapper (`scripts/svc-contained-exec.mjs`) across Claude, Codex, Gemini, Kimi, Cursor, and Grok; OpenCode/MiMo controller-only; Antigravity skills-only (`hooks: false`) | `FRAMEWORK-STATE.md § Durable authority v2 (WI-502)`; `provision/hosts/cursor.json`; `provision/hosts/grok.json`; AGENTS.md § Durable Mutation Authority |
| Parallel WI dispatch: conflict-aware waves, transport resolution, per-worker write_scope, sequential merge-back; `agents:true` alone is never mutation authority | `skills/dispatch-waves/SKILL.md § Dispatch Rules` |

## 6. Resource & ceremony governors

Derived-at: **2026-09-14** (WI-FW-SESSION-RECOVERY-01/02, WI-546). Exact registered
same-session resume and task-scoped reviewer pool observations are documented
in `FRAMEWORK-STATE.md § Session recovery and reviewer availability`. Cursor
independence requires the explicit exact-route identity contract (`cursor/xai/cursor-grok-4.6-high/high`, `requested_accepted`); Auto is advisory.
Runtime `<policy>.resources.json` stores failure-only observations with per-pool launch locks
preventing concurrent account failure repeats; unknown balances remain null.
Verify with `node --test test-framework/tests/session-recovery.test.mjs`.

| Governor | What it controls | Authority |
|---|---|---|
| Capability registry `~/.svc/capabilities/registry.json` | Per-builder paid/free resource inventory: sub-budgets, quotas, reset cadence, last-verified | `skills/capability-registry/SKILL.md` |
| Cross-project state snapshot `~/.svc/state-snapshot.json` | Snapshot rows feeding concierge lenses; must be <24h old or concierge refuses | `skills/capability-concierge/SKILL.md § Preconditions` |
| Chain policy `.svc/chain-policy.json` | Ceremony tiering opt-in (`ceremony_tiering:"measured"`), reconcile refusal mode | `skills/route-workflow/SKILL.md § Measured tiering (WI-383)`; `scripts/svc-reconcile.mjs` |
| Reviewer/dispatch policy (owner-only, outside repo) | Which review stations exist, preference order, availability probes | `skills/review-exec/SKILL.md`; `scripts/review-topology-v2.mjs` |
| Tier-1 promotion discipline | A new always-on validator needs ≥2 observed failures of the class or hot-path trigger; else targeted/tier-2 | `rules/tier-1-promotion.md` |
| Plan-changeset trigger | Framework changes gate through plan-changeset on contract-change / hot-path-behavior / refactor signals; additive+docs exempt | `rules/plan-changeset-trigger.md` |

## 7. Task graph & state

| Fact | Authority |
|---|---|
| `.svc/lane-tasks-<WI>.json` is THE cross-host/cross-session source of truth; host task UIs are parent-session mirrors only; subagents must not mirror | every SKILL.md § Task Graph; `skills/route-workflow/references/task-graph-protocol.md` |
| Session contract `.svc/session-contract.jsonl`: latest row within 4h binds the WI; task-graph init fails closed without a fresh referencing row | `skills/route-workflow/SKILL.md § Self-Verify #11`; `hooks` init guard |
| Phase receipts: `node scripts/task-graph.mjs record-phase …` before completion; skip requires authorization evidence (WI-510 classifier) | each SKILL.md § Phase Receipt Contract; `FRAMEWORK-STATE.md § Analysis History` (2026-07-23, WI-510 in PR #175) |
| Chain receipts: `node scripts/svc-reconcile.mjs` before routing; bounded range check (WI-509); stored cryptographically on `refs/notes/svc-receipts` (durable, pushable; mirror at `.svc/receipts/<sha>/` is regenerable cache); coverage receipt strict-validate-if-present, hard-requirement deferred (WI-556 decision) | `skills/route-workflow/SKILL.md § Before Starting`; `references/chain-receipt-contract.md`; `FRAMEWORK-STATE.md § WI-556 Enforcement-Arming Decision` |
| Bounded-review receipts & raw fail adjudication (WI-566): dual-identity binding (requested CLI route vs effective runtime), 3-round hard cap, terminal failure preserved in envelope | `FRAMEWORK-STATE.md § Receipt cleanup compatibility` + `§ Released follow-up: review launcher recovery` |
| Stale lane-tasks hygiene: merged WI ⇒ graph is stale; check `git log --all --grep=<WI>` before reporting pending/blocked | `rules/verify-state-before-context.md § Stale lane-tasks files` |

## 8. Change discipline & execution governance

| Mechanism | Rule & Invariants | Authority |
|---|---|---|
| Change Impact Triad | Every mutation answers `breaks_what`, `intended_behavior`, `product_surface`. Deterministic risk floors: `high` (auth, billing, schema, hooks, policy) strictly requires behavioral/runtime proof and binding to a different-family independent review task; `logic` requires mapped test; `cosmetic` requires static diff. Path: `.svc/impact-triad/WI-N/task-N.json` | `references/change-impact-triad.md` |
| Persona Trace Contract | Every feature artifact must trace concrete persona IDs (`P1`, `P2`, etc.) across Spec → BDD Journeys (`.feature.md`) → UX → UI → Tech Design → Plan → E2E closeout ledger. Tier-1 validator `validate-persona-trace-feature-ledger.sh` rejects generic `PASS`/`satisfied`/`customer`/`admin` placeholders | `_shared/persona-trace-contract.md`; `test-framework/evals/tier-1/validate-persona-trace-feature-ledger.sh` |
| Execution Controller v2 & Direction-to-Live SLO | Append-only runtime journal, durable CAS leases, release/rollback canary proof. Direction-to-live SLO: at least 24x faster than baseline, ≤60 active engineering minutes. Publication truth separation: implemented ≠ locally verified ≠ committed ≠ pushed ≠ merged ≠ installed ≠ production-proven | `references/runtime-v2-cutover.md`; `references/owner-decision-runtime-v2.md`; `FRAMEWORK-STATE.md § Execution Controller v2` |
| Autonomous-Loop Contract | Recurring routines (`/loop`, cron, fleet) colocated under one of three roots (framework `.svc/loops/`, product `.agents/loops/`, fleet `$COMPANY_STATE_DIR/loops/`) with cursor, dedupe set, cooldown map. Two-tier action model: Tier 1 (autonomous-safe) vs Tier 2 (gated: spend/send/publish/delete — hard-capped max 20% budget shift per run; always escalate legal/financial). Advisory v1. Vanity-loop detector flags zero-action loops | `references/autonomous-loop-contract.md` |
| Autorun Contract | Zero-human interaction mode (`SVC_AUTORUN=1`) produces identical artifacts to interactive runs. Skipped human checkpoints logged in `.svc/pipeline-decisions.jsonl` with `autorun:true` and `human_checkpoint_skipped:<reason>`. Never bypasses eval gates or artifact validation | `references/autorun-contract.md` |
| Company Operating Fleet | 15 company-operating skills (WI-507 in `skills-manifest.json` / `FRAMEWORK-STATE.md`) wielding domain skills under an owner queue; operating across a two-tier topology (company-decision repo vs app repo) via `scripts/company-state.mjs` (`$COMPANY_STATE_DIR/`). The fleet proposes; the owner queue disposes | `FRAMEWORK-STATE.md § Current State`; `references/company-operating-fleet.md` |
| Commercial Engine & Benchmark Landing | `landing-page` orchestrator fuses copy, imagery, motion, and sector references; `benchmark-landing` scores candidate on 10 dimensions (rubric v2), hard-blocking <7, with `landing-page` requiring ≥7.5 weighted aggregate. Video ad suite: `ad-video-script` emits 6×~10s modular beat sheets with character lock and last-frame seeding, rendered by `produce-ad-video` | `skills/benchmark-landing/SKILL.md`; `skills/landing-page/SKILL.md`; `skills/ad-video-script/SKILL.md`; `skills/produce-ad-video/SKILL.md` |
| 5-Layer Knowledge Spine | L1 World Knowledge (`references/knowledge/domains/` with 3-tier INDEX/CAPABILITIES/details), L2 Project Intent (`.svc/spec-index.json`), L3 Learnings (`learnings.jsonl`), L4 Decisions (`.svc/pipeline-decisions.jsonl`), L5 Identity (`~/.svc/builder-profile.md`). JIT topic recall via `recall-stack-knowledge` with provenance tracking (`.sources.jsonl`) | `skills/recall-stack-knowledge/SKILL.md`; `proposals/done/2026-04-30-infra-project-support.md` |
| Self-Evolution Loop | `audit-session-execution` extracts real failure modes from transcripts/logs; `evolve-framework` prioritizes gaps; `improve-framework` implements and replay-verifies fixes. Tracked via `FRAMEWORK-STATE.md`, `blend-registry.json`, and SQLite candidate reservoir (WI-508) | `skills/evolve-framework/SKILL.md`; `skills/improve-framework/SKILL.md`; `test-framework/evals/tier-1/` |
| Guard Arsenal & Runtime Hooks | PreTool decision engine (`hooks/lib/pretool-decision-engine.mjs`) filters read-only safe verbs, injects `--no-optional-locks`, enforces CAS leases v2; `hooks/svc-workflow-guard.mjs` blocks lockfiles/linter config/phase-boundary drift; `--bash-guard` blocks `--no-verify`; `svc-task-completion-guard.sh` blocks premature stop; `svc-stop-quality.js` formats/typechecks on exit; `svc-eval-gate-pre/post` blocks task completion without evaluation matrix | `hooks/lib/pretool-decision-engine.mjs`; `hooks/svc-workflow-guard.mjs`; `hooks/hooks.json` |
| Context Budget & Degradation Tiers | Context is the scarcest resource: PEAK (0-30%), GOOD (30-50%), DEGRADING (50-70%), POOR (70%+). At POOR (70%+), agent experiences silent degradation — external checkpoint is mandatory. Orchestrator reads summaries not code; pass file paths to subagents, never raw contents | `references/context-budget.md` |
| Solution Confidence Protocol | Triggered by "best solution", "golden standard", "by design auto". Defaults to `design_auto`: grounded in current state, why-current-exists, ≥5 real-world examples, cost/cache/freshness models, action-by-action proof packet in `SOLUTION-CONFIDENCE.md` before planning | `references/solution-confidence-protocol.md`; `skills/route-workflow/SKILL.md` |

## 9. Routing surfaces

| Surface | Role | Authority |
|---|---|---|
| `route-workflow` | Universal entry point; lane selection, baton, concern gates | `skills/route-workflow/SKILL.md` |
| JIT routing index `references/skill-routing-index.json` | Compiled, content-addressed, byte-stable; regenerate `node scripts/compile-skill-router-index.mjs`; NEVER hand-edit; invocation currently suggest-only | `FRAMEWORK-STATE.md § JIT Skill Routing Surface (2026-08-25)` |
| `scripts/skill-router.mjs route` | Pins resolve before BM25-lite ranking; concern-required skills never displaced | same |
| `svc-advisor` | Grounded framework Q&A; loads THIS index first | `skills/svc-advisor/SKILL.md` |
| Router references | lane-model / routing-rules / intent-routing / framework-policy under `skills/route-workflow/references/` | those files |
| Concerns | Subject-matter routing (signals → required skills/rules) at session start, pre-dispatch, pre-commit, review-gate | `rules/concern-routing.md`; `concerns/SCHEMA.md` |

## 10. Answer protocol (advisor checklist)

1. Classify the question against the domains above.
2. Load the relevant block(s) + run Verify commands where numbers matter.
3. Answer with: direct position → citation (`path § section`) → nuance → action.
4. Disclose staleness when a Derived-at date is old or an Authority disagrees
   with this index (Authority wins; then fix the index in the same session).
5. If uncovered here: say so, offer `research` (knowledge extraction) or
   `evolve-framework` (gap filing). Never silently improvise.

---

*Restamp log:* initial extraction 2026-08-26 (WI-FW-ADVISOR-KNOWLEDGE-01); refreshed 2026-09-14 (WI-FW-ADVISOR-KNOWLEDGE-02: Cursor CLI x-high review transport, 105 skills, 329 tier-1 validators, WI-566 bounded review receipts, Landlock containment, WI-FW-SESSION-RECOVERY-01/02 & WI-FW-READONLY-OBSERVATION-01, Section 8 Change Discipline & Execution Governance).
