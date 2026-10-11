<!-- Status: proposed 2026-10-11, revision 2 after owner review 5482766246, NOT approved. Under owner + external review. Source of truth for review; execution waits for owner approval. -->

# Plan: one organism that beats solo — component-by-component redesign, with proof

## 1. Context: start, achieved, why, goal

**Where we started.** Main was at d283041, the rc.1 baseline.
- 106 skills, 48 rules and 44 hook rows.
- About 67K characters loaded into every turn.
- The pre-edit hooks took 648 ms per edit.
- Hidden breakage, found on 10/11:
  - 64 scripts were no-ops through the symlinked install.
  - `task-graph checkpoint` did not exist, though 55 skills call it.
  - Worktrees were always refused.
  - Review failed closed with no policy file.
- So the framework did not really run in user projects.

**What was achieved (PR #127, 123 commits).**
- **Context:** always-loaded text 67K → 34.5K characters. Skills over 500 lines: 33 → 1.
- **Hooks:** Edit hooks 648 → 289–318 ms. Context injected per session 6366 → 442 characters. 15 hooks or behaviours were removed, each with its reason in `docs/removals.md`, and a validator refuses their return.
- **Fresh-project fixes** (fcf04a9, dac098a, 4a86f3a, 9d2fe48): the framework now runs end to end on a fresh project on Haiku for $0.02.
- **Measurement:**
  - `outcome-eval.mjs` runs four arms against hidden graders, with budgets.
  - A removals ledger with checks against reintroduction.
  - The cockpit.
  - A dependency tracer for choosing which checks to run.
- **Two measured wins:**
  - Owner rules carried to the next session: 19/20 vs 10/20 bare.
  - A one-sentence product on Haiku: 14.71/16 vs 7.14/16 for plain, at 8–10× the cost. This measured a condensed prompt, not the installed framework.

**Why.** The owner's words: a wrapper that *enhances* Claude Code. It should ship production-ready, distinctive products with just-enough engineering, as a probabilistic chain that is shaped per task, not a static process.

**North star (10/11 08:40).** Speed and cost near a solo run of the same model, with at least 2× its end-result score, by adding what the model does not think about on its own, robust for any task.

**Honest distance today.**
- The installed framework has never produced a scored run.
- The proxies (bounded, swarm) tie or trail solo on judged quality.
- 2× is impossible on rubrics where solo already scores 84–93%.
- The goal metric is undefined. Fixing that is step 1.

## 1b. Design rule that governs every section: dynamic, never static (owner, 10/11)
Models and harnesses change every week. Anything hard-wired dies in the first week. So every component follows these rules:
- **Fix the outcome, free the path.**
  - Skills state what "done" means and the check that proves it. They don't prescribe steps the model would take anyway.
  - Gates check results: tests, the reviewed tree, probes. They never check the ritual.
- **Everything that changes is data, not code.**
  - Models, efforts, prices, harnesses and roles live in `model-registry.json`, `harness-playbook.json` and `priors.json`.
  - Stages and conditions live in the stage registry and delivery profiles.
  - Slots are set by owner policy.
  - Validator: no model id, harness name or price outside those files (it extends `validate-slot-config`).
- **Thin adapters.**
  - A harness is one JSON entry plus the existing `orch/dispatch.mjs` launcher.
  - A new model is one registry line. The router (§3i) retries cheaper options automatically when a new id appears.
- **Detect, don't pin.** `harness-drift.mjs` runs weekly and on session start. A new model, harness version or Claude built-in (e.g. `/design-sync`) is picked up and tried. It is not ignored until someone edits code.
- **Let the model breathe.**
  - Prompts stay short.
  - Effort and turns are decided by the router, not fixed per skill.
  - The ≤80-line skill cores (X6) carry only techniques measured to beat bare.
- **The change-absorption test (new tier-1 check).** In a fixture:
  - add a fake model and a fake harness by editing data only;
  - the router, ladder, slots, cockpit and eval arms must all pick them up with no code change;
  - remove a harness, and everything fails over.

  If this test needs a code edit, the design is static and fails review.

## 2. The proof: a fixed benchmark (new component, small)

`test-framework/outcome-evals/northstar/`, reusing `outcome-eval.mjs` arms (`solo` = bare model; `framework` = installed, route-workflow driving, already built in d57d44e).

**The score is "what solo doesn't think about".** It is computed per task by hidden graders, not by a judge's taste. Five components, 0–1 each:

| Component | What it measures | Existing parts reused |
|---|---|---|
| **H** | Hidden acceptance checks solved: the stated behaviour | Each task's `hidden.test.mjs` |
| **E** | Edge and failure robustness: chaos checks (bad input, network loss, restart), dead-end walk | `chaos-probe.mjs`, the quest dead-end grader |
| **S** | Security and data: secrets, authz on every route, injection probes, migration safety | Lens-security prompts converted into probes. New: small per-task probe files |
| **P** | Production basics: README run-path works from clean, tests exist and fail on mutation, phone overflow, a11y smoke | web-probes, perception probes, mutation check |
| **J** | Judge, capped at 20% weight: taste and coherence | The existing judge |

**Score** = 0.3 H + 0.2 E + 0.2 S + 0.1 P + 0.2 J. Solo's measured weak spots (quest hidden 0/3, no security review, dead ends) are where the ≥2× is possible. The headline still reports H and J separately, so a framework win can't hide a regression on the stated task.

**Six tasks**, covering the "boxes / no boxes" range. Existing tasks are reused wherever one fits (review M-minor):
1. A one-sentence product (yoga-studio).
2. A game (ai-quest).
3. A brownfield feature (`csv` / `waitlist-feature`).
4. A bugfix (`bugfix-rootcause`).
5. An auth/money change (`security-payments`).
6. A typo/README fix (new and tiny; the proportionality check).

**Same model everywhere (review B1).**
- The eval sandbox pins every slot to the arm's model: a sandbox dispatch policy plus `CLAUDE_CODE_SUBAGENT_MODEL`.
- Each run records the models actually served from its usage. A run that used any other model is rejected.

**Chain policy in the sandbox (review M11).**
- Each run reports its `chain-policy` and `same_family_release` setting.
- The framework arm runs in advisory mode, with receipts still emitted and counted. A Claude-only sandbox can't satisfy cross-family release.

**Pre-registered and held out (review B2).**
- Before the baseline, I commit the weights, the grader hashes and this pass bar, and get them reviewed independently.
- Tasks 2 and 5, plus a separate probe set, are **held out**: harden and the improvement loop never see them. The loop iterates only on tasks 1, 3, 4 and 6.
- The headline result counts only if the held-out tasks also pass.

**Pass bar (revised after the owner review of `dc358c0`).** Decided by a new `northstar decide` step that uses the existing `compareSamples` bootstrap CI.
- **Headline (the 2×):**
  - The geometric mean of the **E, S and P** ratios (framework ÷ solo), taken only over tasks where that component applies.
  - It must be ≥ 2×, with the CI lower bound > 1.
  - These are the things solo does not think about. Ceiling components (H, J) are not averaged in, so a real gain there can't be hidden by a tie.
- **H is a constraint, per task:**
  - never more than 0.05 below solo;
  - never a miss where solo passes every hidden test.
- **The typo task is a constraint, outside the 2× mean:**
  - at most 4 stages;
  - cost at most 1.3× solo;
  - H not worse.
- **J** is reported, never in the headline.
- **Cost** is reported as three numbers per task and arm: prompt tokens, turns, and paid reviewer calls. The ≤1.5× cost and ≤1.3× wall-time caps apply to the **single-model advisory arm**: every slot pinned to one model, no cross-family review.
- **Zone review** (a second family on auth/money) is a separate column. It is not part of the north star unless the owner asks.
- **The router and the reviewer ladder stay out of the measured arm.** The router follows priors and may never un-pin a baseline.
- **Graders** are written from a task spec that does not cite the pilot postmortems (quest 0/3, SSO gap). Their hashes are frozen **before** `harden.mjs` and the security patterns are written, so the held-out tasks measure generalisation, not the probes.

**One budget.** Every run uses `--max-usd`. A step marked "owner yes" waits for a forecast and the owner's approval.

| Step | Runs | Cap | Owner yes |
|---|---|---|---|
| P1.1 Frozen baseline at `dc358c0`, Haiku, solo vs framework | 6 tasks × 2 arms × 3 = 36 | $20 | no |
| P1.2 Build swarm (Haiku about $5, Sonnet about $15) | agents | $20 | no |
| P1.3 After-number on the Program 1 organism | 36 | $20 | no |
| P1.4 Loop iterations, dev tasks only | variable | $10 | no |
| P2 waves: each batch's dev-slice re-measure | 12 per batch | $5 per batch | no |
| Opus confirmation (3 runs) | 36 | forecast first (about $150) | **yes** |

## 3. Component map — every component, decision, reason, proof
Legend: **K** keep · **S** sharpen · **M** merge · **R** rewrite · **X** remove (each gets a removals.md entry) · **N** new.

### 3a. Skills (108) — see §3a table (filled from the two full audits)
Two full audits read all 108 SKILL.md files.

**Measured so far:**
- 0 skills show a gain over bare.
- No gain: decide, discuss-phase, review-gate (5.7× tokens), write-spec (3.6× tokens).
- At ceiling (bare solves it too): review-plan, review-exec, review-security, audit-implementation, diagnose-bug, sync-spec-code, blind-control-plan (37× the cost of a bare build).
- The 2 framework wins came from *what "done" means* (yoga 7.14 → 14.71) and *standing rules carried across sessions* (10 → 19/20), not from review.

**So the redesign moves weight from review volume to the "done" definition, hardening and memory.**

**Cross-cutting fixes. Each is direct, proven by a tier-1 check:**
- **X1 Script paths: one resolver, no codemod (owner review).**
  - **Scope:** 86 SKILL.md files with 760 `node|bash scripts/…` calls keep their single relative form.
  - **Resolver:** one resolver maps a leading `scripts/` (or `bash scripts/`) that does not exist in the working directory to the framework root.
    - On Claude: a PreToolUse Bash rewrite (`updatedInput`), in the existing single injector process.
    - On other hosts: the same function, called from each host dispatcher.
    - The resolver uses `SVC_ROOT`, which SessionStart always exports (including inside the framework repo; this fixes `svc-origin-orchestrator-prompt.mjs:55` and `framework-root.mjs:21`).
  - **Absorbs layout changes:** a new layout is one resolver change, not another codemod. No bulk hot-path edit.
  - **Validator:** a script call in skills, references, agents or rules must use the relative `scripts/` form the resolver handles.
  - **Measured:** the hook latency added per Bash call, with `hook-bench.mjs`.
  - **Scheduling:** Program 2, unless the frozen baseline shows path failures cost the framework arm.
- **X2 Boilerplate:**
  - Re-counted: Task-Graph Mode in 82 skills, phase receipts in 78, compaction in 60.
  - This is also a codemod, in lane batches, never one bulk edit of the hot path.
  - The hook (WI-363) already records phases.
  - Replace these blocks with a one-line pointer to the shared reference (like 5ce26a1, but complete).
  - Pinned validators get updated in the same change.
- **X3 Safety bugs:**
  - `track-topology-diff` snapshots Kubernetes secrets into the repo: redact them.
  - `research` auto-commits and pushes: remove.
  - `discover-skills` auto-installs third-party skills: require approval.
  - `assess-market-readiness` auto-commits: remove.
  - `compile-delivery-graph.mjs:263` inserts base44-environment on any deploy work: only when Base44 is detected.
- **X4 Phantom references:**
  - Skills named that don't exist: mor-vs-stripe, pricing, launch, cro, eks-…, and quick-fix routes.
  - Lanes 8–12, which exist only in prose.
  - Hard-coded model names (Veo 3, Sol 6.1, gpt-5.6-luna, Sonnet 4.6) go to registry lookups.
  - A validator checks that every skill name a SKILL.md mentions exists or is an add-on known to the addon gateway.
- **X5 Consumer leftovers:** Example Marketplace, the loyalty domain, the Base44 app id, BG jurisdiction, adb/iOS. These move to examples in references or are deleted.
- **X6 Chain token weight:**
  - A full chain session loads about 200k tokens of instructions before any code. The bounded subset is about 8–10k.
  - Each chain skill gets a ≤80-line core that holds only its unique techniques. Everything else moves to on-demand references.
  - route-workflow's hot path is ≤60 lines.
  - Measured: tokens per chain session before vs after on the Haiku fresh-project run, with no northstar score loss.

**Per-skill decisions.** Unique techniques are kept. A merged or removed skill gets a removals.md entry (a skill entry also checks it is no longer shipped).

| Group | Skills | Decision | Reason / proof |
|---|---|---|---|
| **Chain: plan** | plan-changeset | **R** ≤80-line brief core. Keep work-shape classification, the dry-run against disk, the scope-cut ban with coverage matrix (prototype exemption stated), and the test-value inventory. **Add the hidden-requirements "done means" checklist**: the yoga win made explicit (journeys, empty/error states, auth, payments, data lifecycle, phone) | northstar H and P components; plan-task-with-hidden-requirements pillar |
| | review-plan | **S** Run `verify-plan-mechanical.sh` by default. External review only on irreversible zones or the production profile. Fix rounds 2 vs 3, two Self-Verify sections, the MiMo text | ceiling data; C5 |
| | review-gate | **Measure first.** Candidate: merge into review-exec. The PR-merge receipt name stays the same: an alias keeps `svc-workflow-guard.mjs:870-935`, `merge-pr-with-review-receipt.mjs` and `lib/pr-review-receipt.mjs` valid. Pinned in `mandatory-delivery-chain.mjs:5`, `validate-mandatory-delivery-chain.sh`, the visual-diff `before:"review-gate"` checks, 7 manifest lanes and 73 other files | The evidence is **PARTIAL**, not no-gain: benchmark-findings.md:17,97 shows 4 secondary findings vs 2. Only after a northstar A/B |
| **Chain: exec** | execute-changeset | **S** The harden step becomes `scripts/harden.mjs`, a **thin, profile-aware wrapper** over the existing `quality-probes.mjs` (tests, mutation), `web-probes`, `chaos-probe` and the dead-end walk. Prototype: own tests plus a smoke walk. MVP: plus probes. Production: mutation ≥0.6. Triggered by stage conditions (UI → web probes). Delete the 3× "Step 0" and the consumer cost tables | Targets the seed-bot failure. Reuses existing tools; the typo task must stay ≤1.3× |
| | review-exec | **R** One post-execution review, profile-aware: prototype = self-review plus harden results; mvp = one independent pass through the ladder (§3c); production and zones = lenses plus cross-family. **M** review-cross-model into it. Fix G5/G6 naming and round caps | ceiling 1.2–2.8× cost; C3 measures first |
| | audit-implementation | **S** Keep the per-AC verification contract. Drop the specialist dispatch (it duplicates the lenses). The post-merge scan moves to verify-promotion | ceiling; subtler-overclaim scenario test |
| | review-security | **S** Becomes the security lens, triggered by activation `security` (fixes the SSO gap) | scenario test SSO |
| | land-changeset | **S** One helper call. VERSION/CHANGELOG/coverage only in production. Delete the per-task audit (it duplicates audit). Local-only land for prototypes | — |
| | verify-promotion | **R** Split `verification: local|live`. Move the test-quality audit (circular tests, expected-value provenance) into harden. Live verification only when a deploy target exists | todo-CLI scenario; refuse-local-for-prod pillar |
| | route-workflow | **R** ≤60-line hot path: classify, compile, worktree. Closeouts move into scripts | ~44k tokens per session today; routing eval 0.86→0.89 |
| **Spec/design** | write-spec | **R** ~50-line template plus 3 checks (zero-state AC, vision trace, parseable table). **M** audit-ac into it | no gain at 3.6× |
| | design-ux | **S** Per-screen LOADING/EMPTY/ERROR plus the AC trace go into the bounded brief by default, triggered by activation `ui` | yoga, northstar P |
| | design-ui | **S** One design-system artifact. Keep the production-derived mock and test selectors | — |
| | design-tech | **S** Cost/ops scale with risk. Keep the feasibility matrix, contract map and deprecated-foundation scan | — |
| | write-journeys | **S** Gap analysis plus the producer→consumer check by default. Drop the approval rounds | hidden-journeys pillar |
| | write-e2e, test-journeys | **K/S** Fix the work-item path and quick-fix routes. Keep the evidence tiers | — |
| | track-visuals | **S** One viewport registry. The occlusion/safe-area gate is called from harden for web apps | — |
| | explore-solutions | **S** Only on one-way-door decisions; no forced 3/5 minimum | — |
| | explore-ux | **M** → propose-ux-improvements | — |
| | define-code-style | **M** → design-tech | bare does greenfield conventions |
| | write-vision, validate-feature | **S** Fix the chain fields. Keep the K1–K7 kill signals | — |
| **Research/upstream** | analyze-domain | **S** Terms mode is the core. Link its eval. Write consumer output to the project, not the framework | ambiguity n=36 |
| | analyze-competitors | **S**, **M** catalog-domain-capabilities into it (as a table-stakes checklist) | — |
| | build-personas | **S** Build and gap modes only. Only for user-facing features when activation `ui` is set | — |
| | research | **S** ~60-line question mode. Keep the volatile-fact live re-check. No auto-push. **M** recall-stack-knowledge into it | — |
| | sync-spec-code, onboard-repo | **K/S** Fix next-skill. No competitor sweep in onboarding by default. **M** audit-coverage into onboard-repo | ceiling |
| | plan-capabilities | **X** from the brownfield-conversion lane (on demand only). Remove phantom skill recommendations | — |
| | diagnose-bug | **S** ≤1.5K-word core: classify domain first, SKIP comments, persistence bisect, pattern scan | ceiling at 12× tokens |
| | audit-feature, align-feature | **R** Ship the branch-enumeration method in the skill. Move align-feature's aspect sweep into review-plan/review-exec. The consumer-specific rest goes to a reference example | — |
| **Decisions** | decide | **S** Inline the 7 card rules, cut 2/3. **M** discuss-phase into it | both no-gain; hidden-constraint decision test |
| | strategic-decision | **S** One-file lite mode by default. **M** procurement into it | — |
| | blind-control-plan | **X from the default path** (the script stays opt-in) | 37× cost for no gain |
| **Company roles (14)** | cos, comms, counsel, customer-cs, fin-analyst, growth-eng, growth-lead, infra-sre, market-intel, privacy-dpo, product-lead, revops, security-ops, tax-auditor | **M → one `company-role` skill** with role cards as references. cos stays the router | Same template. The owner set a condition ("only if outcomes hold"), so **measure first**: 3 role tasks, separate vs merged, Haiku, $2 |
| **Builder advisor** | capability-concierge, honest-diagnosis | **M → `builder-advisor`**. Fix the forced ≥3 blockers | — |
| | capability-registry | **K** as a command | — |
| | find-opportunity, assess-market-readiness, roadmap-evaluation, stage-revenue, mine-builder, launch-knowledge, manage-finops, monetization-architecture, platform-operating-architect | **K on demand / S**: dated facts get live re-checks with an as-of date. launch-knowledge becomes a knowledge pack. monetization's enforcement audit becomes a review lens for money paths | — |
| **Marketing/visual** | landing-page, benchmark-landing, design-logo, generate-visuals, analyze-marketing, ad-video-script, produce-ad-video, grow-social, design-sync, reverse-engineer, propose-ux-improvements | **K/S**. design-logo gets a stopping rule and budget. analyze-marketing is made generic. Providers come from the registry | — |
| **Framework self-improvement** | improve-framework | **S** Owner of the loop (§3e). **M** evolve-framework into it. "Done" requires `promote` for skill-text changes | — |
| | test-framework | **R** Around outcome-eval, skill-ab-eval, probe-loop and PILLARS | — |
| | evaluate-rule | **R** Pass 1 runs in a fresh subagent, or it becomes an outcome A/B | — |
| | create-skill | **S** Requires a capability-coverage row plus a bare A/B before shipping | — |
| | blend-external | **S**, **M** blend-private into it (`--private`; fix the multi-word leak grep) | — |
| | ingest-guide | **S**, **M** ingest-guide-batch into it | — |
| | audit-session-execution, manage-learnings, svc-advisor, teach-project | **K/S**. manage-learnings writes accepted owner rules into CLAUDE.md (the measured mechanism, 19/20) | — |
| **Infra** | plan-blast-radius, track-topology-diff | **S/R** Triggered by the compiler's infra irreversible-path rule, not phantom lanes. Topology secrets are redacted (X3) | — |
| **Ops/utility** | list-work-items, sync-work-items, dispatch-waves, craft-prompt, addon-gateway, discover-skills, base44-environment | **K/S**. addon-gateway is wired into route-workflow; discover-skills becomes a mode of it, with approval. base44 becomes an optional platform pack | — |
| **Remove** | quick-fix (stub), extract-bootstrap, suno-architect, wsl2-audio | **X**. Personal skills move to the owner's personal skill dir, not the framework. Fix the 3 quick-fix references | dead or personal |

Also covered:
- capture-idea: **S**. Fix the trigger conflict with intent-routing and the INDEX contradiction.
- refresh-competitors: **S**. On demand or scheduled; it fetches pricing pages and moves out of the framework lane.

**Net result:** 108 → about 77 skills if every merge passes measurement, and fewer merges otherwise. Every remaining skill has a coverage row whose status is measured or is "on demand, not in any default path".

**New components (only where a gap blocks the proof):**
- `scripts/harden.mjs`: the execute harden pack.
- The hidden-requirements checklist inside plan-changeset.
- The `company-role` and `builder-advisor` merges.
- The northstar benchmark.
- `capability-coverage next/record`.

No new skills beyond the two merges.

### 3b. Delivery chain and stage selection (the dynamic chain the framework already had)
Wire the existing parts. Add no parallel module (the rejected `stage-conditions` is in removals.md).

1. **Activation becomes a library (R).** `scripts/stage-activation.mjs` exports `evaluateActivation({registry, scope, profile})` behind an `__svcIsMain` guard. Its import-time `fail()`/exit path (:221-238) becomes a thrown error, so the compiler can load it. The CLI stays the same.
2. **Conditions (S).** Add `DEFAULT_CONDITIONS` entries for `ui`, `user-flow`, `security`, `live-proof` and `compliance`, and set them in `references/stage-registry.json` where the condition is now `null`.
   - Patterns match code and config extensions only, never docs about them.
   - `security` matches auth, payment, secret, crypto and migration paths and the flags `auth`/`auth-sensitive`. This unifies the vocabulary and closes the SSO gap.
   - **One commit, condition first:** add the `security` condition, point the registry stage at it, then add `security` to prototype `conditional_stages`. Landing the keep-list first would bring back the no-op the current head just removed.
   - A tier-1 case checks two diffs. A prototype diff under `android/` or an auth path keeps `security`. A docs-only diff does not.
3. **The compiler reads activation (R).** `compile-delivery-graph.mjs` starts from the lane's skills as today.
   - When planned files are known, it calls `evaluateActivation`.
   - It drops a non-chain skill only when every registry stage mapping to that skill is `na`/`deferred` (this handles the shared skills qa-companion/test-run → test-journeys and device/visuals → track-visuals).
   - Dropped skills go to `skipped_skills` with their condition.
   - The result is stored as `delivery_graph.stage_activation`.
   - With no scope yet, the stage stays in.
4. **Plan-time narrowing (S).** plan-changeset re-runs the same compile with `--existing-graph --planned-files`. `applyExistingGraph` widens its "drop unstarted research" rule to "drop unstarted non-chain tasks now inactive", recorded in `mutation_history`.
4b. **Diff re-check, because planned files are the author's own claim (review M6; removals.md:37-44):**
   - review-exec and land re-run `stage-activation --diff` on the actual diff.
   - A dropped stage that now activates is re-inserted, or land fails.
   - The security patterns also cover oauth, jwt, rbac/permission, Prisma/SQL schemas and `.github/workflows` release files.
5. **Fixes found by simulation (direct fixes):**
   - `planningMode` with no profile stays **contract for greenfield and underspecified product requests**. This protects the measured 14.71 vs 7.14 win.
   - It becomes mvp for brownfield-feature, bugfix and refactor work with named files.
   - The mvp-for-greenfield variant is measured first, on yoga-studio (review M5).
   - Personas, e2e and journeys are ordered before land in every mode.
   - `verify-promotion` gets `verification: live|local`: local when nothing is deployed, keeping its receipt.
   - review-plan on trivial work runs its **mechanical pass** (`verify-plan-mechanical.sh`) and still emits its receipt, so refuse mode holds and no skip is added. The dead skip id is removed from the registry, with a removals entry.
   - The overengineering chain score reads `stage_activation` (it is always 0 today).
   - route-workflow step 6 and plan-changeset give the exact commands.
6. **Ledger row 18** goes back to partial with live evidence; it returns to done only after item 7.
7. **Proof:**
   - `validate-dynamic-chain-scenarios.mjs`: the 9 simulated tasks plus 3 edge cases, asserting the stage set for each. Examples: the typo gets ≤ 4 stages and no UX/UI; SSO includes review-security; the todo-CLI prototype gets local verify; the backend limiter gets no UI stages.
   - Live Haiku runs of todo-CLI and SSO through route-workflow, under $2.

### 3c. Reviewers and agent slots (owner asks 79 and 85, both unmet)
1. **Slots are data, not code (R).** Every agent dispatch (plan, exec, each review station, lens, judge, scout) resolves through `resolve-dispatch.mjs` using its **existing** layers only: the framework default (`resolve-dispatch.mjs:421-428`), then the owner `~/.svc/dispatch-policy.json`, then the protected `--work-overlay` (planner per WI), then the receipt-gated `--session-override` (orchestrator per stage) (:819-822).
   - **No layer an agent can write ranks above the owner.** That is the design rejected in removals.md:10-17, and it stays rejected.
   - The gap is coverage, not layers: skills and agents with hard-coded models or effort bypass the resolver.
   - Proof: `validate-slot-config.mjs`, written test-first. It greps skills, agents and rules for hard-coded model or effort and finds none outside the registry. For each slot it shows that the owner file, the work overlay and the session override each change the resolved harness, model and effort without code changes. Overrides are recorded in the receipt.
2. **Reviewer ladder (build the revised decision, `docs/decisions/2026-10-11-reviewer-ladder.md`).**
   - **No probe and no cache as evidence** (removals.md:28-35, forgeable). The launcher tries the other family. Its signed failure receipt is the only proof that allows the fallback. A cached status may only hint at routing order.
   - Fallback when no other family is available: the same family's top pinned model at effort ≥ high, in plan mode, with a tree-unchanged check. It is labelled `same-family`, capped at 2, and never authorises promotion alone.
   - Opus high reviewing Sonnet or Haiku work is exactly the owner's example.
   - Plan, exec and general review all use the same ladder.
   - Proof: tests for each rung, written first (no-other-family, other-family-down, same-family cap), plus one live Haiku-exec / Opus-review run.

### 3d. Hooks and runtime
- Done this PR: 9 → 4 processes on Edit (5eabc6a).
- **Native front door (N, Go).** The Go hook client exists only in the scratchpad. Bring it in only if its benchmark in the repo shows a lower p50 per Edit than the single-process Node injector (289 ms) by more than 100 ms. Otherwise record it in removals.md as measured-no-gain.
  - Measured with `hook-bench.mjs` before and after.
  - The decision goes in removals or the ledger. Either way, ledger row 3 is corrected (it now overstates "built").
- **Hook-daemon permission rule:** stays not done. It changes permission settings, which is the owner's call. I will ask once with the measured gain.
- **5.5-era caching order (owner ask 89, never addressed) (S).**
  - Order the always-loaded content stable-first (CLAUDE.md, the rules index, skill descriptions), then per-session content (the root context hook), so the prompt cache prefix stays byte-stable.
  - Move the SessionStart dynamic text to the end and keep it tiny.
  - Proof:
    - A check that the framework-controlled static prefix is byte-identical across two sessions **in the same repo**.
    - The cache-read share is measured on two Haiku sessions with `usage.cache_read_input_tokens`.
    - The harness controls the overall order, so only our own part is claimed.

### 3e. Evals and the self-improvement loop (asks 33, 90, 92)
One loop, owned by `improve-framework`. `evolve-framework` merges into it, with a removals entry and a redirect stub if referenced.
1. **Pick:** `capability-coverage.mjs next` takes the highest-traffic component that is unmeasured or no-gain.
2. **Mode:**
   - A clear fix is a direct rewrite, proved by tier-1.
   - Uncertain value goes to measurement.
3. **Measure (new flag):** `skill-ab-eval.mjs --variant <path>` against the current version and bare, on Haiku, on a **dev** northstar task slice.
4. **Vary:** `probe-loop.mjs` runs variants in parallel: rewrite, simplify, merge, remove.
5. **Adopt (new):** `northstar decide` uses the `compareSamples` bootstrap CI. A win requires the CI lower bound above 0, not n=3 "solves more". The winner is written. `capability-coverage.mjs record` (new) stores the measurement. A removal writes its removals.md entry.
6. **Check fast:**
   - `trace-check-deps` becomes the engine of the **existing** focused mode (`SVC_TIER1_MODE=focused`, `select-tier1-validators-v2.mjs`). The old engine gets a removals entry. No second selector.
   - `references/check-deps.json` (now untracked) is committed.
   - A recall check replays today's 7 breakages and requires each would have been selected.
   - The full suite runs once per batch and in CI.
7. **Parallel:** `worktree.sh` defaults to HEAD on feature branches, so agents never start from a stale base.
8. Fix `improve-framework`'s call to the nonexistent `test-framework --replay`.

Proof: one full loop iteration run live on a real target, in under 15 minutes for a clear fix.

### 3f. Cockpit
- **K:** the live cockpit (2ddd5bf).
- **S:** add a north-star panel that reads the benchmark results JSON.
- Remaining cockpit asks (goal cards, pitch deck, portal, voice, multi-runtime) are **deferred**. They do not move the proof, so they stay open in the ledger with that reason.

### 3g. Proportionality cuts (weakening allowed when reasoned; each one is recorded)
| Cut | Protected | Evidence | Mode |
|---|---|---|---|
| C1 mvp is the default for brownfield, bugfix and refactor with named files; greenfield stays contract until measured | over-planning small work | the typo got 15 stages; yoga win protected | direct for non-greenfield, measure for greenfield |
| C2 docs-only changes run at light depth (no UX/UI/spec) | waste | simulation | direct |
| C3 one combined review on small work with no zone | review cost | PILLARS: review stages bought nothing at the small-task ceiling | measure first: northstar task 6 and task 3, $4 |
| C4 trimmed review-exec/review-plan prompts | tokens | pillar svc prompts cost 1.2–2.8× for no gain | measure, $3 |
| C5 review-plan on trivial work = mechanical pass with receipt | latency | ceiling data; refuse mode kept | direct |
| C6 doc paths are not irreversible zones | false full-depth | simulation | direct |

**Not cut:**
- Contract planning for underspecified products (14.71 vs 7.14).
- The three invariants (plan reviewed before exec, merge only a reviewed tree, tier-1 green on that tree), enforced at transitions and in CI (§3j).
- Full depth on zones (auth, money, data, deploys, secrets).
- Refuse mode, redefined as "invariant 2 required in CI" (§7 R-B1).

### 3i. AI harness router: a skill that grows and routes each task to the best harness, model and effort (owner ask, 10/11)

**What exists.**
- `scripts/route-model.mjs` (308 lines) already does the hard part:
  - a ladder per task type in `references/model-intel/priors.json`;
  - an expected-cost-per-completed-task pick: `E(i)=c(i)+(1-p(i))(penalty+E(i+1))`;
  - Beta posteriors after a minimum number of samples;
  - a reset when a new model id appears behind an alias;
  - escalation by failure kind.
- **But:**
  - it is Claude-only;
  - nothing calls `record` automatically: the call is documented only in a route-workflow reference, so it never learns;
  - it isn't joined to `resolve-dispatch.mjs` or `harness-playbook.json`;
  - its choice is never written onto the task.

**Design. Extend, don't add.**
1. **Arms become harness × model × effort.** Candidates are only the harnesses `harness-playbook.json` lists for the role (exec, review, analysis) that the owner policy allows. `resolve-dispatch` stays the authority on what is allowed; route-model picks the cheapest expected arm inside that set.
2. **It learns automatically, at zero tokens.**
   - The transition hook (the same one that replaces receipt bookkeeping, §3j) records each task's arm, outcome, tokens, cost and wall time.
   - The outcome is the task's deterministic check: tests pass, the review verdict, or the harden result.
   - Outcome-eval and northstar runs also record their arms.
3. **It stays fresh.** `harness-drift.mjs` detects new models and harness versions. The new id starts from the prior, so cheaper rungs get retried after each release. The `research` skill refreshes priors from sourced benchmarks with an as-of date (in `SOURCES.md`).
4. **Availability.** When quota runs out, the `run-external-review` error classification marks that harness unavailable for its reset window. The next pick moves to the next allowed harness (e.g. Codex or Grok for exec). This is the cockpit's multi-harness failover.
5. **Written onto the task.** The pick (harness, model, effort, expected cost, estimate) goes into the task in `lane-tasks`. The cockpit shows who works on what with which model and effort.
6. **Skill.** One thin `route-ai` skill (≤60 lines):
   - "why this model" explanations;
   - an owner override;
   - `stats` for which arm wins per task type;
   - a "teach it": the owner records a preference.
   - It wraps the script and replaces nothing else.
   - The hot path calls the script directly, never the skill.

**Proof.**
- **A replay test over the recorded outcomes:** the learned policy's regret is lower than a fixed policy's.
- **Unit tests:**
  - availability failover;
  - the prior reset on a new model id;
  - owner-policy bounds are never exceeded.
- **Live:** 10 small Haiku/Sonnet tasks. The router learns to pick the cheaper arm where pass rates are equal, with the cost saving measured.

### 3j. Receipts: rebuilt as automatic checks at transitions, three invariants, ~0 tokens (owner ask, 10/11)
**What the audit found:**
- **Size:** about 8,000 lines over 29 files, with 61 tier-1 validators pinning it.
- **Self-attestation:** 487 `record-phase` commands across 80 skills only record a path string; nothing checks that the evidence exists.
- **Model-written JSON:** exec-record, audit-implementation and verify-promotion are model-written JSON with only presence checks.
- **Cost:** about 10–20k output tokens per chain (estimated), about 14 git spawns per emit, and a hook that re-reads 1.3 MB of lane-tasks on every Edit.
- **History:**
  - 78 of 156 commits had no receipts, so a backfill project was needed.
  - A validator passed everything for months.
  - A 1-file quick-fix receipt was promoted onto a 26-file commit.
  - At least 4 logged bypasses (hooksPath=/dev/null and others).
  - At least 4 false blocks: a false 166-row debt, a stale cache, a false phase red, probe output.
  - About 20 work items were spent on the system itself.
  - **0 documented product defects caught by receipts.** The *reviews* caught defects; receipts recorded them.
- **Enforcement:** in practice, nothing. Hook mode defaults to advisory, notes are often not fetched (this clone holds 0), and CI has no receipt check.

**Keep exactly three invariants. Each is checked by a script at the moment it matters:**
1. **The plan was reviewed before execution.** `task-graph set-status <first exec task> in_progress` refuses unless the WI has a launcher-issued review-plan verdict: the mechanical pass on trivial work, an independent review on zones and production.
2. **Merge only a reviewed tree.** A passing review-exec verdict from the launcher (or the ladder, §3c), whose reviewed tree equals the PR head tree.
3. **Tier-1 is green on that tree.** This is CI already.

**Mechanism: one script, `stage-close`, about 150 lines.**
- **Trigger:** `task-graph set-status done` and `set-status in_progress` call it. No model is involved.
- **What it records:**
  - git facts: tree, diff hash and files, derived from git rather than written by the model;
  - the stage's machine artifact, if it has one: the launcher verdict hash or the tier-1 log;
  - one line in `.svc/transitions.jsonl` keyed `{wi, stage, tree}`.
- **What it checks:** the predecessor's record. It fails *at that transition*, so problems are caught on time, not at push.
- **Router and cockpit:** it also writes the outcome, cost and time to the router (§3i) and the cockpit (§3k).
- **Durable proof:**
  - The launcher writes its verdict as **one** note kind on the reviewed commit, and `stage-close` pushes it.
  - A **CI job** (new, in `ssve-checks.yml`) fetches that note and checks invariant 2 against the PR head tree.
  - When a GitHub token is available, the launcher also posts a commit status `ssve/review`, so branch protection can require it.
  - Squash merge keeps the tree, so the check survives.

**Delete:** each removal gets a removals.md entry with this evidence and a reintroduction pattern.
- Phase receipts: 487 commands, the autoemit hook, the phase enforcement, `phase-receipts.md`, and the phase checks in `completed-task-integrity`.
- Model-written receipt JSON: plan-manifest as a receipt (the plan stays as the plan), exec-record, audit-implementation, verify-promotion.
- `emit-receipt.mjs`: both the double validation and the 14-spawn note path.
- Post-commit promote, the mirror, aliases and staging.
- The low/full tiers, skill-coverage, and the reconcile range scans.
- Retroactive attestation becomes a frozen, read-only history.
- `chain-policy` merges into the one hook mode.
- The story-receipts doc load.
- About 45 of the 61 validators. The other ~16 are rewritten around the three invariants.
- CLAUDE.md's chain section is rewritten to match.

**Weakening, grounded:**
- What is removed has 0 documented catches and at least 8 false blocks or bypasses per real catch.
- Everything that did catch something (the reviews) stays, and becomes harder to bypass: CI plus a commit status instead of local advisory hooks.

**Proof:**
- **Negative tests, written first:**
  - exec before the plan review is refused at the transition;
  - a PR whose head tree differs from the reviewed tree fails CI;
  - a self-written verdict without launcher evidence fails;
  - a quick-fix record applied to a different tree fails.
- **The PR #127 workflow** still lands through the new CI check.
- **Measured,** on the Haiku fresh-project run before and after:
  - receipt tokens per chain;
  - process spawns per Edit;
  - wall time.

  The target is about 0 receipt tokens, with no hook re-reading lane-tasks per Edit.

**Order:**
- **Wave 1 F:** `stage-close`, the CI job and the negative tests, run side by side with the old system.
- **Wave 2:** after one green PR through the new path, delete the old system in one serial batch. This also replaces the X2 phase-receipt "pointer" step: those blocks are deleted, not pointed at.

### 3k. Cockpit: one entry point that steers everything (owner ask, 10/11)
**Today.**
- Three UIs: `live.html` is read-only; `cockpit.html`'s steer box is never read; the Orchestrator OS pane steers only workers.
- Two unjoined data models: lane-tasks and `orch/status.json`.
- Three skills send questions to a box nobody reads.

**Design.**
- **One model: `scripts/cockpit-state.mjs` becomes the single read model.** It joins:
  - projects from `~/.svc/projects.json` via `cross-project-state.mjs`;
  - goals, milestones and "needs you" from `orch/goals.mjs set-summary`;
  - phases and tasks from `.svc/lane-tasks-*.json`;
  - harness, model, effort, estimate and cost per task, written by the router (§3i) and the transition hook (§3j);
  - workers from `orch/collect.mjs`;
  - capacity from `parallelism.mjs`.
- **What the view shows:**
  - **Plan deviation:** estimate vs elapsed time and cost; a task re-run more than once; a stage inserted or dropped against the plan.
  - **Why blocked:** classified from `blocked_reason` plus the transition-hook verdict.
- **One UI.** `templates/cockpit/live.html`, served by `cockpit-serve.mjs` (with live push) and rendered by the shared `overview.mjs` (no LLM calls):
  - a box per project showing its goal and status;
  - expanding a box shows the workflow diagram: goal → phases/milestones → tasks, with who works on each, plus the queue, what remains, what's needed from the owner, why it's blocked, and any deviation.
- **Steering that arrives.**
  - `cockpit-serve` gets one authenticated POST `/api/steer`. It uses a localhost-only token from `~/.svc` and goes through `orch/dispatch.mjs steer`.
  - It targets either a worker or the project's orchestrator session (via `sessions.mjs` / SendMessage).
  - An "ask" box answers questions from the read model with a cheap model (Haiku, chosen by the router). It never mutates anything.
  - The three skills that told agents to use the old box now use `cockpit ask-owner`, which writes a "needs you" item the view shows.
  - Voice is deferred, with the reason recorded in the ledger.
- **Removals, each with a removals.md entry:**
  - `cockpit.html` and `cockpit-protocol.md`'s unimplemented loop;
  - `orch/serve.mjs` (replaced by the one UI);
  - `render-status.mjs`;
  - the deprecated `fanout.sh` and `dispatch-worker.sh` (`orch/dispatch.mjs` replaces them).
- **Multi-harness.** Failover comes from the router (§3i). Workers run on codex, cursor/Grok, claude or agy through `orch/dispatch.mjs`.

**Proof.**
- `validate-cockpit-live.mjs` is extended so a fixture with 2 projects renders boxes, the expanded diagram, needs-you items and a deviation.
- A steer POST without the token gets 403. With the token, the message reaches a fake worker and a fake orchestrator.
- Ask answers come only from the read model.
- Live: steer a running Haiku worker from the page.

### 3l. Founder layer: marketing context, formulas, design system, Claude Design (owner ask, 10/11)
**Today.**
- Founder skills write good artifacts, but delivery barely reads them: `plan-changeset`, `write-spec` and `execute-changeset` never read marketing context.
- Formulas are prose. Readiness contradicts itself (moat ×20 vs ×10). CAC is defined wrongly (cloud cost ÷ MAU).
- Tokens live in 3 homes and 2 formats; motion in 4 homes.
- The registry's `pricing` and `ab-testing` stages point to skills that don't exist.
- The marketing activation reads the framework's own capabilities file.

**Design.**
1. **One founder context file: `docs/specs/founder-context.md`.** Fixed sections: ICP/personas, positioning, claims with evidence, voice, pricing tiers and gating, north-star metric and funnel targets, and pointers to the design system and tokens.
   - `analyze-marketing`, `monetization-architecture`, `design-logo` and `grow-social` write their own sections.
   - The legacy `.agents/` write is dropped.
2. **Delivery reads it.**
   - plan-changeset and write-spec take it as input.
   - The plan brief gets a **Founder Trace** (persona, claim touched, pricing tier, tokens used). `validate-plan-contract.mjs` requires it on user-facing work.
   - Activation gets conditions `claims-marketing` and `priced-surface` that read the **product's** founder context.
   - The registry's `pricing` owner becomes `monetization-architecture`. The `ab-testing` stage is served by the formulas below.
3. **Formulas you can run: `scripts/founder-metrics.mjs`.**
   - LTV (ARPU × gross margin ÷ churn), CAC (S&M ÷ new customers), payback, LTV:CAC, burn multiple, runway and default-alive, NRR/GRR, quick ratio, funnel chain, K-factor, A/B sample size, bottom-up TAM/SAM/SOM, Van Westendorp price range.
   - The existing readiness, opportunity and BPS scores are made consistent: CAC and moat fixed, each weight labelled as an assumption.
   - Inputs come from `company-state/metrics.jsonl`, each with its source and an A–D evidence grade.
   - One tier-1 test per formula against published reference values.
   - The skills call the script instead of doing the maths in prose.
4. **One token spine.**
   - DTCG `docs/specs/ui/tokens.json` is canonical. Motion lives in it as `motion.duration.*` and `motion.easing.*`. Logo colours merge into it.
   - `design-tokens.mjs` converts to and from Claude Design's list format.
   - `lint-w3c-tokens.mjs` and a fixed motion validator (multi-file, token-based) run in harden for UI work.
5. **Claude Design.**
   - Rename the framework's `design-sync` skill to `design-bridge`, so it can't shadow a built-in `/design-sync`.
   - On Claude: pull tokens through the built-in when it's present, run a contrast check, then lint. The Claude Design canvas is the visual handoff for landing-page and storyboards.
   - **"Claude Motion" is not in the repo.** I verify against current Claude docs whether such a surface exists before wiring it. If it doesn't, motion stays tokens plus framer-motion, recorded in the ledger.

**Proof.**
- Formula tests.
- A plan-contract test: user-facing work without a Founder Trace fails.
- Activation scenarios: a pricing-page change inserts monetization-architecture.
- The northstar yoga task scores claims and pricing consistency through the judge.

### 3h. Owner asks without a component yet (tracked, not silently dropped)
Each stays in the ledger with a status and reason:
- Private repo per eval run: blocked by GitHub 403. The remedy is to grant the Claude GitHub App "Administration: write" on the shipwithstef account, or for the owner to create the repos. I will tell the owner.
- Learning quiz results: commit them to the quest results JSON and PILLARS (direct).
- Finops, game economy and artwork checks: these become S/P probes in the northstar game task.
- Managed Agents workflows, meta-harness, fleet 14→1, conversion loop, paid upgrades, 016U3 alignment, harness-agnostic boxes, constrained vs free path: deferred until the north-star proof passes. The ledger says so explicitly.

## 4. Order and parallelism (revised: prove, then build; owner review options 1 + 2, with the gates of option 4)

**Program 1: the proof.** The smallest organism that can clear the bar.

1. **P1.0 Plan edits:** the bar, the baseline order and the single budget. Done in this revision.
2. **P1.1 Frozen baseline (Gate A).**
   - Score solo vs the install at `dc358c0` on Haiku. Slots are pinned, the arm is advisory, and there are no compiler edits.
   - Graders, weights and hashes are pre-registered first.
   - Publish H, E, S, P and J per task, plus the three cost numbers.
3. **P1.2 Branch on the baseline:**
   - If the headline is under 1.1× or cost is over 3×, the only allowed next edits are the token cut (X6 on the chain cores) and `harden.mjs`.
   - If H is below solo on a task, stop and fix the done-definition first.
   - If E or S is 0 for both arms, build `harden.mjs` first.
4. **P1.3 The Program 1 organism.** Each piece is measured as its own treatment:
   - one ≤60-line route-workflow;
   - one done-means checklist in plan-changeset (the yoga win, made explicit);
   - one `harden.mjs`, selected by file type;
   - one owner-rule memory file (the 19/20 win);
   - the §3b activation wiring, condition first, plus its scenario test.
5. **P1.4 After-number** on dev tasks, then on held-out tasks.
6. **P1.5 Loop iterations** on dev tasks only, aimed at the biggest gap.

**Program 2: the full organism.** It runs after the first scored framework run, and each item is gated.

1. **Gate B:** the skill merges and rewrites run only if Program 1 shows the gap is in skill text, not in missing probes.
2. **Gate C:** the receipt rebuild (§3j) runs side by side until the baseline numbers exist. Invariant 2 never requires a paid external review inside the Haiku arm.
3. **Waves, in this order:**
   1. X1 resolver, X3 safety bugs, X4 phantom references, X5 consumer leftovers.
   2. §3c slots and ladder, then §3i router.
   3. §3j receipts: the deletion is a serial batch.
   4. X2/X6 skill rows, after the receipt deletion, because they touch the same files.
   5. §3k cockpit.
   6. §3l founder layer.
4. **The hooks decision:** the Go front door, then caching order.
5. **Ownership and the serial integrator** follow the wave 1 split in §7: disjoint scopes, plus one batch for the five source-of-truth files.
6. **Opus confirmation run** (owner yes). Then each ledger row is updated with its evidence.

### Build transport (owner ask: build with a swarm, then review)
- **The work goes to the cheapest model that can do it.** Every worker runs in its own worktree from HEAD, owns a disjoint set of files, and has a deterministic check as its gate.
  - **Haiku swarm, about 12–16 workers.** Mechanical, fully specified edits:
    - X1 path rewrite;
    - X3 safety bugs;
    - X4 phantom references;
    - X5 consumer leftovers;
    - X2 boilerplate pointers;
    - the "fix chain fields" rows.
    - Each worker gets about 5–8 skills, an exact before/after rule, and the validator to run.
  - **Sonnet workers, about 5.** Logic with tests:
    - the dynamic chain (3b);
    - slots and the ladder (3c);
    - loop tooling (3e);
    - `harden.mjs`;
    - the northstar graders.
    - Each is written test-first.
  - **Opus, me:**
    - writes each worker's spec;
    - rewrites the chain cores (X6, plan-changeset, review-exec, route-workflow), because they hold unique techniques that must not be lost;
    - reviews every worker diff before integration;
    - runs the full suite;
    - does the final adversarial review through the ladder.
- **Merges and removals of skills are serialized in one Sonnet worker.** They touch the five source-of-truth files (manifest, README, EXTERNAL_ADDONS, REPO_MODES, route-workflow), so parallel workers would conflict.
- **Gates:**
  - A worker diff fails integration when its validator fails, it touches files outside its scope, or a removals check fails.
  - A Haiku diff that fails twice goes to Sonnet.
- **Expected wall time:**
  - Wave 1 about 30–45 minutes; wave 2 about 45 minutes.
  - Integration and full suite: about 25 minutes, or less with `--changed`.
  - CI about 7 minutes per push.
  - Haiku baseline about 30–60 minutes.
  - The remaining bottleneck is evals and CI, not writing code.
- **Cost:** the Haiku swarm about $3–6, Sonnet workers about $10–20, evals under $15. The Opus confirmation run is separate and needs the owner's yes.

## 5. Verification
- Tier-1: new validators (dynamic-chain scenarios, slot config, ladder rungs, check-selection recall, caching prefix) plus the full suite. `framework-coherence.mjs` 0 findings; lint passes. CI green on each pushed head, with no push while CI runs.
- Live:
  - Haiku todo-CLI and SSO through the installed framework (stage sets match the scenario test).
  - The ladder with only the Claude family.
  - The northstar baseline.
- Every removal has a removals.md entry whose reintroduction check passes.
- The owner-requirements ledger is updated row by row with evidence links. No row says done without a run.

## 6. Independent review (Opus, high effort): disposition
All 23 findings were accepted and folded in above:
- **Blockers:**
  - B1: same-model pinning.
  - B2: pre-registration and held-out tasks.
  - B3: slots use the existing protected layers and the ladder uses no probe as evidence.
  - B4: baseline before rewrites.
- **Majors:**
  - M1/M2: corrected counts; codemod with a `${SVC_ROOT:-.}` fallback.
  - M3: review-gate is measure-first, with its merge-receipt alias and pinned files listed.
  - M4/C5: the mechanical pass keeps the receipt.
  - M5: greenfield stays contract.
  - M6: diff re-check at review and land.
  - M7: harden is a thin profile-aware wrapper.
  - M8: the existing focused selector, no second one.
  - M9: new flags are labelled new; bootstrap-CI decision.
  - M10: pass-bar aggregation and budget per phase.
  - M11: sandbox chain policy reported.
  - M12: ownership split plus a serial integrator.
- **Minors:**
  - ledger rows 64+;
  - capture-idea and refresh-competitors covered;
  - 14 roles and about 77 skills;
  - same-repo cache proof;
  - `ARM_LIMITS` aligned;
  - stage-activation throws instead of exiting;
  - the registry `lane_skills` edit on merge;
  - existing eval tasks reused.

## 7. Second independent review (Opus, high effort) of §3i–§3l: binding amendments
All 16 findings were accepted. Where an amendment conflicts with a section above, the amendment wins.

**Receipts (§3j).**
- **R-B1 Refuse mode.** It now means "CI invariant 2 is required, and the invariant-1 transition check blocks". The mechanical review-plan pass writes a `stage-close` record. §3g's "Not cut: the receipt chain" now reads "Not cut: the three invariants".
- **R-B2 Wave 1 F scope.** Wave 1 F also re-keys three places to the `stage-close` record and the new verdict ref:
  - `run-external-review.mjs:946-962` (the exec-record lookup and the `plan_manifest_sha256` binding);
  - `scripts/lib/pr-review-receipt.mjs`;
  - `merge-pr-with-review-receipt.mjs`.

  The `svc-workflow-guard.mjs:870-937` merge gate also matches the MCP merge (`merge_pull_request`). Negative tests are added for each.
- **R-B3 Honest provenance.** Local CI checks the tree binding and the verdict's shape, not who wrote it. For real provenance, the independent review runs **inside CI**: a `pull_request` job with an owner-held reviewer secret writes the verdict where agents cannot. Until the owner adds that secret, the check is labelled "binding only".
- **R-B4 Transport.**
  - Each verdict lives at its own ref, `refs/svc/review/<tree-sha>`, so there are no shared-ref races.
  - A failed verdict push fails loudly.
  - CI re-runs through `actions_run_trigger`.
  - CI compares against `pull_request.head.sha`'s tree.
  - Step 0 of F proves that the cloud git proxy accepts pushes of non-`refs/heads` refs. If it doesn't, the verdict goes as a JSON file in a PR comment, read by CI.
  - Making "SSVE Required" a required check in branch protection is an **owner action**, listed in the asks.
- **R-M3 Bypasses closed.**
  - The invariant-1 check also runs in the lane-tasks validator hook and in CI, so editing lane-tasks directly can't bypass it.
  - The status name is `completed`.
  - `assertExecuteChangesetReceipts` and `assertCanonicalReceiptCompletion` (`task-graph.mjs:1102`) are rewired.
  - The load-time `skill_receipt.loaded_at` stays, because the cockpit estimates use it.
- **R-M4 Consumer projects.**
  - Ship a reusable workflow template through `svc init-ci`.
  - Old consumer hooks become stubs that exit 0 with a pointer.
  - `check-chain-receipts --read-only` stays for repos that already have notes.
- **R-M5 Exempt class.** CI works it out from the diff itself, never from a declaration, so docs-only PRs need no paid review.
- **R-minor CI and docs.**
  - `oss-ci-workflow.test.mjs:151` is updated and the new job feeds `required`.
  - The CLAUDE.md rewrite fixes the pre-push "whole range" drift.
  - The receipt deletion runs after the step-5 baseline, as its own serial batch, separate from the X2/X6 edits to the same files.

**Router (§3i).**
- **R-M1 Owner list.** There is a new owner-protected `route_candidates.<role>`, read through `readProtectedJson`. With no list, the owner's resolved tuple is used unchanged, so the router never ranks above the owner.
  - Exec harnesses come from the playbook only: claude, grok and opencode today (Kimi is out of scope).
  - `priors.json` model names move to registry aliases, or the file is allowlisted by `validate-slot-config`.
- **R-M2 Availability is a hint.**
  - The availability cache only orders the candidates. It is never used in review gating.
  - Failure classification is added on the exec side in `orch/dispatch.mjs`.

**Cockpit (§3k).**
- **R-M6 Steer endpoint:**
  - a Host header allowlist (127.0.0.1/localhost:port), also for the existing GET routes;
  - an exact Origin match;
  - JSON content type only;
  - the token in the URL fragment printed to the terminal or in a SameSite=Strict HttpOnly cookie, never served by a GET;
  - a comparison that takes the same time whatever the input;
  - `expected_attempt`/`expected_session` required.
- **Steers are treated as prompts** carrying the worker's permissions. Orchestrator steering goes through a queue file that a hook injects at the next turn. No SendMessage from Node.

**Founder layer (§3l).**
- The finops "CAC" is renamed (cost to serve per user). It is a name clash, not a maths bug.
- The formulas are trimmed to LTV, CAC, payback, LTV:CAC, runway/default-alive, funnel and A/B sample size. Van Westendorp, K, NRR and TAM are deferred.
- The A/B calculator is tested against published values; the others against sourced worked examples.
- Founder Trace is required only when `founder-context.md` exists.
- The `design-sync` → `design-bridge` rename goes in the serial integrator batch (a built-in DesignSync exists).

**Scheduling.**
- §3i: router, wave 1 B, after the resolver.
- §3j: F, wave 1, running alongside the old system; deletion after the baseline.
- §3k: cockpit, wave 2.
- §3l: activation and registry parts in A; formulas, tokens and the founder context in wave 2.
- The change-absorption test (§1b) is in wave 1 B.

## 8. Owner review on `dc358c0` (review 5482766246): disposition
All findings are accepted and edited in above:
- **Bar:** E/S/P geometric mean, H and the typo task as constraints, three cost numbers, zone review as its own column, router and ladder out of the measured arm.
- **Baseline:** frozen at `dc358c0` before any wiring; wave 1's wiring is the first treatment.
- **Graders:** frozen from a spec that does not cite pilot numbers.
- **Budget:** one table.
- **X1:** a resolver instead of a codemod.
- **Security keep-list:** in the same commit as its condition, with a tier-1 case.
- **Order:** §4 renumbered as Program 1 (proof) then Program 2 (full organism), with Gates A–C.
- **Code:** the open `regrade --margin` note is fixed in this commit. A regrade keeps the report's margin unless `--margin` is given, with a tier-1 case.
