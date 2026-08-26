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

Derived-at for all blocks: **2026-08-26** unless stated otherwise
(WI-FW-ADVISOR-KNOWLEDGE-01 initial extraction).

---

## 1. Identity & counts

| Fact | Value | Authority | Verify |
|---|---|---|---|
| First-party skills | 103 in `includedSkills`; 58 in router core pack | `skills-manifest.json` | `node -e "console.log(require('./skills-manifest.json').includedSkills.length)"` |
| Review gates | G1–G7 (write-spec, design-ux, design-ui, design-tech, execute-changeset, land-changeset, verify-promotion) | `skills-manifest.json` `gates` | `node -e "const m=require('./skills-manifest.json');console.log(Object.keys(m.reviewGates\|\|m.gates))"` |
| Workflow lanes | 7: greenfield, brownfield-conversion, brownfield-feature, bugfix, drift, refactor, framework | `skills-manifest.json` `laneDefinitions` | `node -e "console.log(Object.keys(require('./skills-manifest.json').laneDefinitions).join(','))"` |
| Anti-patterns | 34 APs in the reference doc | `references/anti-patterns.md` | `grep -cE '^###? AP-[0-9]+' references/anti-patterns.md` |
| Provisioned hosts | 9: claude, kimi, codex, gemini, opencode, mimo-code, antigravity, cursor, grok | `provision/hosts/*.json` | `ls provision/hosts/*.json \| wc -l` |
| Tier-1 validators | ~325 shell validators | `test-framework/evals/tier-1/` | `ls test-framework/evals/tier-1/*.sh \| wc -l` |
| Bootstrap sequence | 26 steps (greenfield minimal order) | `skills-manifest.json` `bootstrapStartSequence` | read manifest |

> ⚠️ Known-stale surfaces: `references/knowledge/svc/CAPABILITIES.md` still
> says "77 skills" and `references/knowledge/svc/details/infrastructure.md`
> says "five hosts / codex hooks unavailable" — both superseded by this index
> until a full `research` L3 re-extraction restamps them.

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
| Compression protocol (WI-557): self-pass + ONE external station; terminal confirm only if external found fixed HIGHs. Confirmatory re-reviews eliminated | `FRAMEWORK-STATE.md § Review Compression Protocol` |
| External-review fallback (WI-557): quota/billing/CLI-missing → local validation (tier-1 focused + manifest lint), log decision, mark PR `review-mode: local-validation`; retroactive review later. Never falls back on real test/lint/security failures | `FRAMEWORK-STATE.md § External Review Fallback Policy` + `§ Infrastructure Failure Auto-Fallback` |
| Claude-host post-exec review runs as ONE read-only fan-out (review-exec + auditor + specialists + visual lens over a frozen diff); non-Claude hosts keep the serial chain | `skills/route-workflow/SKILL.md § Post-exec review wave (WI-382)` |

## 4. Host wiring

| Fact | Authority |
|---|---|
| Capability matrix per host (hook events, wire protocol, task UI, subagents, background tasks) dated 2026-08-17 | `FRAMEWORK-STATE.md § Host Capability Matrix` |
| Per-host wirer scripts: claude `wire-hooks.mjs`, kimi `wire-kimi-hooks.mjs`, codex `wire-codex-hooks.mjs`, gemini `wire-gemini-hooks.mjs`, opencode `wire-opencode-hooks.mjs`, cursor `wire-cursor-hooks.mjs`, grok `wire-grok-hooks.mjs`; antigravity none (skills-only) | same matrix row "svc wirer script" |
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
| Mutating child tasks require persisted delegation + isolated inner worktree; Claude/Codex/Gemini/Kimi only via probed Landlock wrapper; OpenCode/MiMo controller-only; Antigravity/Cursor skills-only | `FRAMEWORK-STATE.md § Durable authority v2 (WI-502)` |
| Parallel WI dispatch: conflict-aware waves, transport resolution, per-worker write_scope, sequential merge-back; `agents:true` alone is never mutation authority | `skills/dispatch-waves/SKILL.md § Dispatch Rules` |

## 6. Resource & ceremony governors

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
| Chain receipts: `node scripts/svc-reconcile.mjs` before routing; bounded range check (WI-509); coverage receipt strict-validate-if-present, hard-requirement deferred (WI-556 decision 2026-08-22) | `skills/route-workflow/SKILL.md § Before Starting`; `FRAMEWORK-STATE.md § WI-556 Enforcement-Arming Decision` |
| Stale lane-tasks hygiene: merged WI ⇒ graph is stale; check `git log --all --grep=<WI>` before reporting pending/blocked | `rules/verify-state-before-context.md § Stale lane-tasks files` |

## 8. Routing surfaces

| Surface | Role | Authority |
|---|---|---|
| `route-workflow` | Universal entry point; lane selection, baton, concern gates | `skills/route-workflow/SKILL.md` |
| JIT routing index `references/skill-routing-index.json` | Compiled, content-addressed, byte-stable; regenerate `node scripts/compile-skill-router-index.mjs`; NEVER hand-edit; invocation currently suggest-only | `FRAMEWORK-STATE.md § JIT Skill Routing Surface (2026-08-25)` |
| `scripts/skill-router.mjs route` | Pins resolve before BM25-lite ranking; concern-required skills never displaced | same |
| `svc-advisor` | Grounded framework Q&A; loads THIS index first | `skills/svc-advisor/SKILL.md` |
| Router references | lane-model / routing-rules / intent-routing / framework-policy under `skills/route-workflow/references/` | those files |
| Concerns | Subject-matter routing (signals → required skills/rules) at session start, pre-dispatch, pre-commit, review-gate | `rules/concern-routing.md`; `concerns/SCHEMA.md` |

## 9. Answer protocol (advisor checklist)

1. Classify the question against the domains above.
2. Load the relevant block(s) + run Verify commands where numbers matter.
3. Answer with: direct position → citation (`path § section`) → nuance → action.
4. Disclose staleness when a Derived-at date is old or an Authority disagrees
   with this index (Authority wins; then fix the index in the same session).
5. If uncovered here: say so, offer `research` (knowledge extraction) or
   `evolve-framework` (gap filing). Never silently improvise.

---

*Restamp log:* initial extraction 2026-08-26 (WI-FW-ADVISOR-KNOWLEDGE-01).
