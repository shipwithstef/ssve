<!-- Status: APPROVED 2026-10-11 (revision 4 = owner rev 3 f05c82f + §11 reconciliation). -->

# Plan: one organism that beats solo, and keeps beating it as models and harnesses change

## 0. How to read revision 3

**What changed from revision 2.**
- One bar (§4), one order and one budget (§6). The old §6–§8 disposition sections are folded into the body. Appendix A records every review finding by its ID and quotes the body sentence that implements it.
- The headline is defined when solo scores 0. Failed runs score 0. Cost is total USD.
- Solo gets a private home. The framework arm runs from `git archive` of a sha. The home is built once and cloned.
- Opus confirmation comes before any deletion. Receipt deletion waits until Program 1 has passed on Haiku and on Opus.
- New direction (§2): durable versus decaying components, founder domain expertise as a scored component (K), one dated store of harness knowledge, and a router that has to beat the harness's own default.
- New evidence (§3): traversals run as commands at `7b48cc4`, not imagined. Several revision 2 assumptions failed. The compiler ignores the data files revision 2 called the source of truth. The launcher refuses most harnesses. The router has never recorded an outcome.
- A pre-mortem with kill criteria (§7) and an integration contract for #129 (§8).

**Precedence. There is one.**
1. §4 is the only bar. §6 is the only order and the only budget.
2. §5 says what to build and how to prove it, never when.
3. Appendix A adds no requirement. Where a row and the body disagree, the body wins and the row is a defect.
4. §11 (revision 4) overrides §0–§10 where they conflict. The body below is edited to match it; each edited sentence names its §11 item.

**Evidence rule.** A sentence about what runs today names a command in Appendix B, run at `7b48cc4`.

**Privacy rule.** This repository is public. The plan, PR comments and eval artifacts carry no machine paths, account names, consumer project names or private policy contents. A finding about a machine-local file names only the harness or model needed to reproduce it.

## 1. Context

**Where we started.** Main was at d283041, the rc.1 baseline.
- 106 skills, 48 rules and 44 hook rows. About 67K characters loaded into every turn. Pre-edit hooks took 648 ms per edit.
- Hidden breakage, found on 10/11:
  - 64 scripts were no-ops through the symlinked install.
  - `task-graph checkpoint` did not exist, though 55 skills call it.
  - Worktrees were always refused.
  - Review failed closed with no policy file.
- So the framework did not really run in user projects.

**What PR #127 achieved.**
- **Context:** always-loaded text 67K → 34.5K characters. Skills over 500 lines: 33 → 1.
- **Hooks:** context injected per session 6366 → 442 characters. 15 hooks or behaviours removed, each with its reason in `docs/removals.md`, and a validator refuses their return.
- **Hook latency is not settled.** The PR measured 289–318 ms per Edit. A later five-run synthetic `hook-bench` measured 562 ms PreToolUse/Edit and 345 ms PostToolUse/Edit (6108295955). §5.4 re-measures with a sanitised environment before any hook decision.
- **Fresh-project fixes** (fcf04a9, dac098a, 4a86f3a, 9d2fe48): the installed framework runs on a fresh project.
- **Measurement:** `outcome-eval.mjs` with four arms, hidden graders and budgets; a removals ledger; the cockpit; a dependency tracer.

**What the evidence supports, and what it does not.**
- Owner rules carried to the next session: 19/20 versus 10/20 bare (p = 0.002), from one two-session comparison. It is a reason to keep a memory component. It is not yet a component score.
- A one-sentence product on Haiku: 14.71/16 versus 7.14/16 for plain, at 8–10× the cost. This measured a condensed prompt, not the installed framework.
- Revision 2 said the framework runs end to end on a fresh project on Haiku for $0.02. No command, sha, stage list or token total for that figure is recorded in the repo. It is withdrawn as evidence. Tokens per chain session are a separate row in §4.
- "0 skills show a gain" covers the dozen or so skills that were measured. The other skills are unmeasured, not known no-gain.

**Why.** The owner's words: a wrapper that *enhances* the harness. It ships production-ready, distinctive products with just-enough engineering, as a probabilistic chain shaped per task, not a static process.

**North star (10/11 08:40).** Speed and cost near a solo run of the same model, with at least 2× its end-result score on what solo does not think about. It must hold for any task, and still hold after the next model and harness release.

**Honest distance today.** The installed framework has never produced a scored run. The proxies tie or trail solo on judged quality. Revision 2's headline was undefined exactly where the win would be; §4 fixes that.

## 2. Direction

Models and harnesses change every week. A framework that encodes what this week's model forgets is redundant by next quarter. A framework that carries what no model can know stays useful. This section sets the direction. §5 holds the design and §6 the order.

### 2a. Durable versus decaying

Every component gets one of two labels in the capability-coverage registry.

| Label | What it carries | Examples | Life |
|---|---|---|---|
| **Durable** | Facts and checks the model cannot have: private, recent, or outside the model | owner standing rules and decisions; founder context (ICP, pricing, claims); the product's domain bank; dated harness knowledge; hidden probes and graders; the three invariants; worktree isolation; company governance | Grows with the founder and the project |
| **Decaying** | Scaffolding a stronger model does on its own | step-by-step procedures; templates the model writes anyway; review volume at ceiling; prompt boilerplate; forced minimums | Shrinks with every release |

**Decay rule.**
- **Trigger:** `harness-drift` sees a new model id behind an allowed slot, or a harness version that changes a recorded flag.
- **Ablation:** each decaying component that serves that slot runs on versus off on the dev slice, with the new model.
- **Retire:** a component whose off arm scores within 0.05 of its on arm and costs less moves to on-demand. Its removals entry names the model id. It returns only by the same measurement.
- **Re-baseline:** when a vendor retires a pinned baseline model, the Program 1 baseline is re-run on its successor before any new claim.
- Durable components are never retired by the decay rule. K (§4) measures them.

### 2b. Founder domain expertise is the moat, so it gets a score

The lasting value to a founder is that each session knows more about this product, this market and this owner than a fresh model does. That layer exists today and is not connected:
- `scripts/expertise.mjs` preloads four layers: training, the domain bank with currency windows, the ledger and the playbook. The 13 company-role agents declare `domain:`. No delivery agent does. `expertise.mjs preload --agent svc-stage-exec` exits with "no 'domain:' declaration".
- `expertise.mjs refresh-scan` marks all 13 domain banks stale. Of 66 `.version` stamps under `references/knowledge/`, the newest is 2026-07-16, 87 days old. None is inside the 30-day domain window.
- The prototype profile starts even a typo fix with analyze-domain and `teach_terms` 10 (T2).

Direction:
- The product's domain bank lives in the product repo. Each fact carries `as_of`, `source` and `owner_confirmed`. analyze-domain's terms mode seeds it, and owner decisions add to it.
- Delivery agents (plan, exec, the review lenses) preload a bounded, topic-matched slice of it, plus the standing rules and the founder context.
- Teaching runs when a task brings terms the glossary lacks, not on every prototype task.
- A stale fact is shown as stale, never as current. It is refreshed when a task cites it, not on a schedule for every bank.

### 2c. Harness knowledge: one dated, sourced store

Harness and model truth is spread over seven places: `model-registry.json`, `model-intel/models.json`, `priors.json`, `harness-playbook.json`, `harness-baseline.json`, `provision/hosts/*.json`, and argv code in `orch/dispatch.mjs`. They disagree (T5–T7). `references/model-intel/` becomes the one store. Every fact carries `as_of` and `source`: a vendor page, or the command and output hash that verified it. The other six are generated from it (§5.9).

### 2d. Routing must beat the harness default, or step aside

Every harness already has a default: the model and effort it uses with no framework. The router has to beat that default on cost per solved task at equal or better quality, inside the owner's policy. With no evidence, it uses the owner's tuple. When the evidence says the default wins, the default wins (§5.10).

## 3. What runs today: real traversals at `7b48cc4`

Each row is a command in Appendix B. Nothing here is simulated.

| # | Path | What the command showed | Consequence |
|---|---|---|---|
| T1 | Compiler source of truth | Identical graphs after deleting the prototype profile from `delivery-profiles.json`, removing lane skills from `skills-manifest.json`, and adding `skip_skills`. Lanes are a JS constant (`LANE_BASE_SKILLS`, `compile-delivery-graph.mjs:40`) that disagrees with the manifest (greenfield 18 versus 25). Profile names, `validModes`, `IRREVERSIBLE_PATH` and `IRREVERSIBLE_FLAGS` are code too | "Everything that changes is data" is false today. Pointing the compiler at the manifest as it stands would add 7 greenfield skills, so the lists are reconciled first (§5.2) |
| T2 | Typo fix | Production: 15 tasks, from validate-feature through verify-promotion, including write-spec, audit-ac, write-journeys, design-ux, design-ui and design-tech; design-ui is also listed as skipped. Prototype: 9 tasks, starting with analyze-domain | The typo constraint fails today (§11 restates it as no lane-upstream stages beyond the invariant tail) |
| T3 | Product from one sentence, production | 22 tasks; write-e2e and test-journeys come after verify-promotion | Prerequisites after promotion (also 6108295955) |
| T4 | Auth and money | `auth-sensitive` attaches review-security as a required process step inside audit-implementation. The flag `auth`, which is in `IRREVERSIBLE_FLAGS`, attaches nothing. A payments webhook bugfix with no flag is marked an irreversible zone and gets no security review | Two vocabularies. The `security` condition must read the irreversible zones (§5.2) |
| T5 | Two routing authorities | For exec, `route-model.mjs` picks a Claude model, while the owner's machine-local policy resolves EXEC to a non-Claude harness. `route-model stats` shows every arm at n=0. No outcomes file exists in the repo or the home. `route-model check` passes with no coverage of the non-Claude harnesses the policy uses | The router has never learned, and nothing joins it to the policy (§5.10) |
| T6 | Launch by data | `orch/dispatch.mjs` `workerCommand` accepts only codex, cursor, agy and claude. Anything else throws "cli must be codex, cursor, agy or claude". The cursor path hard-codes a grok model version that differs from the one in the policy and the registry. The policy's EXEC harness, opencode, kimi and a fake fixture harness are refused | The change-absorption test fails today at its second step (§5.1) |
| T7 | Drift | `harness-drift.mjs` has no codex host. `harness-playbook.mjs verify` reports broken flags for opencode and kimi. The Codex CLI on the review machine is configured with a model id that no registry file lists | Drift and flag checks are not joined and do not cover the harnesses in use (§5.9) |
| T8 | Hard-coded model ids | 170 model-id strings in 61 non-test files under skills, agents, rules, hooks and scripts; 33 distinct ids, some retired. Some are legitimate (pricing tables, provider docs) | A "no model id outside the store" validator fails on 61 files today. It needs a migration list and an allowlist (§5.9) |
| T9 | Expertise | §2b: no delivery agent declares `domain:`; 13 of 13 banks stale; newest stamp 87 days old | K is unwired (§5.11) |
| T10 | Cross-harness evals | `scripts/lib/harness-transports.mjs` exports `TRANSPORTS = { claude }` | No eval can compare harnesses, so the router cannot be measured against another harness's default (§5.10) |
| T11 | Install follows the branch | Installed skill links point into this repo's working tree, so a branch checked out in the main checkout changes what every installed host loads. A stale merge driver left in local git config by an earlier in-repo eval crashes `git merge-tree` until overridden | Eval runs use `git archive` of a sha (§4). In-repo evals never write repo config (§5.5) |
| T12 | #129 | A dry merge with #127 conflicts in 5 files. The ledger's hindsight replays the model file now on disk, not the recorded one. A discrete distribution listed out of order returns p10 100, p50 1, p90 10 | §8 |

## 4. The proof: one bar

`test-framework/outcome-evals/northstar/`, on `outcome-eval.mjs` arms. `solo` is the bare model. `framework` is the installed framework with route-workflow driving.

**Components.** Hidden graders score each run from 0 to 1 per component. They score the built artifact, for both arms. They are not the install's own checks; the install at `dc358c0` never runs them.

| Component | Measures | Reuses |
|---|---|---|
| H | Hidden acceptance checks: the stated behaviour | each task's `hidden.test.mjs` |
| E | Edge and failure robustness: bad input, network loss, restart, dead ends | `chaos-probe.mjs`, the dead-end grader |
| S | Security and data: secrets, authz on every route, injection, migration safety | lens-security prompts turned into probes |
| P | Production basics: README run-path from clean; tests that fail on mutation. For UI tasks, the numbers `web-probes.mjs` already records (axe serious/critical, contrast, tab reach, overflow at 390×844, tap targets under 44 px, load-to-interactive, JS bytes, frame p95) plus `mobile-occlusion.mjs` with a logged-in session where the control needs one | `web-probes`, `mobile-occlusion`, the mutation check |
| K | Knowledge the model cannot have: a standing rule from an earlier session, a private domain fact, a founder pricing rule, each checked in the build | the continuity-rules task; one embedded fact per reserve task |
| J | Judge: taste and coherence | the existing judge. Reported, never in the headline |

The weighted formula from revision 2 is deleted. There is one score.

**Tasks.**
- **Dev** (the loop may see these): 1 yoga-studio (a product from one sentence); 2 ai-quest (a game); 3 brownfield (`csv` / `waitlist-feature`); 4 `bugfix-rootcause`; 5 `security-payments`; 6 a typo/README fix (new, tiny); 7 `continuity-rules` (two sessions).
- **Reserve** (unseen): R1, a product task, and R2, an auth/money task, each with one embedded private fact for K. Tasks 2 and 5 informed the diagnosis, so they are dev tasks now, not holdouts.
- The reserve is written in a fresh session that gets only the task template, not the pilot evidence. Only the grader hashes are committed. The files stay outside the repo until the after-number.
- An applicability matrix says which of E, S, P and K applies to which task. It is committed with the bar, before the baseline.

**Headline, pre-registered.**
- A cell is one task and one of E, S, P or K that the matrix applies to it.
- A crashed, timed-out, capped or skipped run scores 0 on every component, and its spend stays in the cost. The report names how many runs entered each mean. A cell with fewer than 3 finished runs per arm gets no number.
- **Δ** is the mean over cells of (framework mean − solo mean). Its 95% interval is the paired bootstrap that `compareSamples` already computes on a difference of means, resampling runs within task and arm.
- **R** is the sum of framework means divided by the sum of solo means over the same cells. A both-zero cell adds 0 to both sums. If solo scores 0 on every cell, R is reported as "not defined: solo 0 everywhere", never as infinity.
- **Pass:** R ≥ 2.0 (or R not defined), Δ ≥ 0.20, and Δ's lower bound above 0. This must hold on dev and, separately, on the reserve.

**Constraints, per task.**
- **H:** never more than 0.05 below solo, and never a miss where solo passes every hidden test.
- **Typo task:** no lane-upstream stages beyond the invariant tail (counted after the §5.2 compiler change), H not worse, and total USD at most 1.3× solo net of the measured catalog overhead (§11 item 1).
- **Product tasks** (1–5, R1, R2): total USD at most 1.5× solo and wall time at most 1.3× solo, in the single-model advisory arm.

**Cost is money.** Cost is actual total USD from usage: input, output, cache, subagents, failed attempts and repairs. These are reported beside it as diagnostics:
- prompt tokens;
- turns;
- paid reviewer calls;
- browser-probe seconds;
- hook seconds (edits × measured p50).

The always-loaded catalog overhead is measured on an empty task and reported, so the token cut has a target. Nothing is subtracted from the product-task caps; only the typo cap is net of it (§11 item 1).

**Fair arms.**
- **Same model everywhere.** Every slot is pinned to the arm's model (a sandbox dispatch policy plus `CLAUDE_CODE_SUBAGENT_MODEL`). Every model's tokens are recorded. A run is rejected only when a model other than the arm's did real work; the CLI's small background calls are tolerated (§11 item 7).
- **Solo gets a private HOME with no skills and no ancestor `CLAUDE.md`.**
- **The framework arm runs from `git archive` of its sha** into its own private HOME, so no branch checked out on the machine can leak in (T11).
- **The framework home is built once per sha and cloned into each job.** `./setup` does not run once per framework job.
- **A row whose `builder_sandbox` is null is rejected, for every arm.**
- **Grader cleanup.** The grader copied into the build (`__hidden.test.mjs`) is deleted in a `finally` before the build is kept, including when the judge throws.
- **Chain policy.** Each run reports its chain policy and `same_family_release`. The framework arm runs advisory, with receipts still emitted and counted.
- **Router and ladder stay out of the measured arm.** The router follows the pins and may never un-pin a baseline. Zone review by a second family is its own column, outside the headline.
- **Fail-open counter.** Each framework run reports the fail-open counter (§5.4).
  - A non-zero count marks the run "rules not loaded". It is re-run once. If it repeats, it is scored as it is and flagged.
  - The install at `dc358c0` has no counter, so its runs are marked "counter absent".
- **Checkpoints.** The eval profile sets every `human_checkpoint` to log-and-continue through the profile, not through a prompt sentence that overrules the skill. At `dc358c0` that profile does not exist, so the baseline keeps its current prompt sentence and the report says so.

**Run shape.**
- `--parallel 4` is stated on every run. Host-state validators keep their sequential pre-pass.
- The `ARM_LIMITS` values are part of the pre-registration. They are a safety timeout, the same for both arms: 2× the task's time and 3× its turns (§11 item 2). A run the timeout stops scores 0, and the bar judges the measured USD and wall time.
- **Manifest first.** Before any paid run, `northstar plan` prints a balanced manifest:
  - every task × arm × rep is funded at or above the $0.50 per-run floor;
  - both arms have the same task contract and the same isolation;
  - a manifest that cannot fund every pair does not start.
- Wall time is forecast from the first wave and printed before the rest.

**Decision.** `northstar decide` implements exactly this section. Its fixtures cover:
- zeros and missing components;
- paired outcomes;
- interrupted runs;
- mixed usage;
- exhausted budgets.

The loop gets at most 3 iterations on dev before the reserve is opened, once. Before the baseline, these are committed and reviewed independently:
- the graders;
- the matrix;
- the bar;
- `ARM_LIMITS`;
- the reserve hashes.

## 5. Components: what to build and how to prove it

Legend: **K** keep · **S** sharpen · **M** merge · **R** rewrite · **X** remove (each gets a removals.md entry) · **N** new.

### 5.1 The change-absorption test (tier-1, written first)

In a fixture, editing data only:
1. Add a fake model. The router, ladder, slots, cockpit and eval arms all pick it up.
2. Add a fake harness record to the store. `orch/dispatch.mjs` launches it from its argv template, and the eval runner has a transport for it.
3. Edit a delivery profile. The compiled skill list changes, with no SKILL.md edit and no manifest edit.
4. Remove Claude from the playbook. design-bridge drops off the visual step, and non-Claude hosts stay on the file path.
5. Mark a model id as new. A decay ablation is scheduled (§2a).
6. Remove a harness. Everything fails over to the next allowed one.

It fails today at steps 2 and 3 (T6, T1). A design that needs a code edit to pass it fails review.

### 5.2 Delivery chain: one scheduler, compiled from data

**Today.**
- The compiled graph comes from a JS constant (T1).
- Skills also continue on their own: 28 skills set `progressive: true` and tell the model to start their `next` skill, so a skill the compiler dropped still starts.
- 46 skills set `human_checkpoint: true`.

1. **Lanes are data.**
   - First, the manifest lists are reconciled to the lists the compiler runs today. A tier-1 case compiles every lane × profile before and after the switch and requires identical output.
   - Then the compiler reads the manifest, and later edits go through data.
2. **Activation is a library (R).** `stage-activation.mjs` exports `evaluateActivation` behind an `__svcIsMain` guard. Its import-time exit becomes a thrown error.
3. **Conditions with real patterns.**
   - `ui`, `user-flow`, `security`, `live-proof` and `compliance` match code and config only, never docs about them.
   - Each registry stage points its `activation_condition` at its condition in the same commit that adds the condition, with a tier-1 case.
   - design-ux and design-ui point at `ui`. `marketing` gets real route patterns.
   - `security` matches the irreversible zones of class auth, payments, secrets and migrations, plus the flags `auth`, `auth-sensitive`, `security-sensitive`, `payments`, `money` and `secrets`. A payments bugfix with no flag gets review-security (T4).
   - The prototype keep-list gets `security` in the same commit as the condition. A prototype diff under an auth path keeps it; a docs-only diff does not.
4. **Flags the compiler reads.** route-workflow or diagnose-bug writes a lean record on the task. No `next` pointer may override a flag.

   | Flag | Default | Drops when false |
   |---|---|---|
   | `new_product` | false on brownfield, bugfix, refactor and typo work | write-vision, analyze-domain, analyze-competitors |
   | `ui` | from the `ui` condition | build-personas, design-ux, design-ui |
   | `marketing_page` | from the `marketing` condition | landing-page, benchmark-landing |
   | `one_way_door` | false | explore-solutions. The 3-paradigm / 5-approach gate is deleted in the same change |
   | `drift` | false | sync-spec-code, which is not `essential` on a feature or a typo |
   | `behavior_change` | true; false on refactor | design-tech, unless `one_way_door` is set |
   | `claude_design` | true only when the harness pick is Claude and the Design built-in is present | design-logo and generate-visuals. design-bridge is the visual step |
   | `new_terms` | true when the task brings terms the glossary lacks | analyze-domain teach mode |

5. **One scheduler.**
   - When a skill finishes, it starts the next compiled task, not its `next` field.
   - `progressive: true` means only "continue without asking", never "start this skill".
   - Checkpoints read the profile: production stops; eval logs and continues.
6. **The session sees only what it may run.** After compile, the host skill listing for the session is the compiled list plus on-demand skills. The model is never offered a skill the compiler dropped, and the prompt is smaller.
7. **Order and dedupe.**
   - Personas, e2e and journeys come before land in every mode (T3).
   - Each stage maps to one skill:
     - one track-visuals diff after implementation, with a baseline only when an earlier capture exists;
     - one test-journeys stage;
     - one write-e2e stage.
   - The UI profile includes journeys and e2e.
8. **Obligations rebuild edges.** When activation or risk raises review depth, the compiler adds the obligation and rebuilds the dependency edges. A completed task whose obligation changed reopens. This is tested on bounded→production and safe→auth-sensitive transitions with an already completed graph.
9. **Diff re-check.**
   - review-exec and land re-run activation on the actual diff.
   - A dropped stage that now activates is reinserted, or land fails.
   - Security patterns also cover oauth, jwt, rbac, schema files and release workflows.
10. **Registry owners.** Every stage key has an owner skill that exists, or it leaves the registry in the same change. A tier-1 check fails otherwise.
    - Six stages have no owner today: `ledger`, `translations`, `evasion`, `demo-asset`, `destructive-migration` and `native-release`.
    - Six more name skills that are not in the repo: `perf`, `device-proof`, `pricing`, `analytics`, `ab-testing` and `seo-audit`.
    - `perf` owns the web-probes performance numbers with render and asset patterns, or it leaves the registry.
    - `device-proof` owns `mobile-occlusion` plus the device diff.
    - `pricing` points at monetization-architecture.
11. **Planning mode.** Contract planning stays the default for greenfield and underspecified product requests. It protects 14.71 versus 7.14. Brownfield, bugfix and refactor work with named files gets mvp. mvp-for-greenfield is measured first, on yoga-studio.
12. **review-plan on trivial work** runs its mechanical pass (`verify-plan-mechanical.sh`) and still emits its record, so refuse mode holds and no skip is added.
13. **base44-environment** is inserted only when the platform contract detects Base44. Today `compile-delivery-graph.mjs:263` adds it on any `deploy-affecting` flag; that is the defect to fix (§11).

**UI surfaces.**
- **App screen:** the state list (LOADING / EMPTY / ERROR, AC trace) inside the brief; design-ui for components and tokens; implement; one track-visuals diff; harden.
- **Marketing page:** the app-screen flow, then landing-page, with benchmark-landing as its gate.
- design-logo is on demand. design-ui's `next` matches the split.
- The UX experience document and the solution templates stay where skill slimming moved them:
  - `skills/design-ux/references/process.md`
  - `skills/explore-solutions/references/artifact-templates.md`
  - `skills/explore-ux/references/templates.md`

**Proof.** `validate-dynamic-chain-scenarios.mjs` asserts the stage set for every traversal in §3 and every path in review 5482813786:
- the typo gets no lane-upstream stage beyond the invariant tail, and no UX or UI (§11);
- a payments bugfix with no flag gets review-security;
- a production product puts personas, e2e and journeys before land;
- an app screen gets no landing page and no logo;
- a profile edit changes the list.

`validate-delivery-graph.mjs` also asserts ordering. Today it passes graphs with prerequisites after promotion. Live: todo-CLI and SSO through route-workflow on Haiku, under $2.

### 5.3 Skills

Two full audits read every SKILL.md. Of the dozen or so skills measured, none shows a gain over bare. The two framework wins came from *what "done" means* (yoga 7.14 → 14.71) and *standing rules carried across sessions* (10 → 19/20), not from review. So weight moves from review volume to the done-definition, hardening and memory.

**Cross-cutting fixes, each proven by a tier-1 check.**
- **X1 Script paths: a launcher that works without hooks.**
  - Skills move from `node scripts/<name>` to `svc-run <name>` lane by lane, never in one bulk edit. Setup installs `svc-run`. It resolves through `SVC_ROOT`, which SessionStart always exports, and falls back to the install root.
  - The form names a script, not a layout, so a later layout change is one launcher change.
  - The validator accepts both forms during the migration and only `svc-run` after it.
  - All of this launcher work is conditional under rev 4 (§11 item 9): it is built only if the baseline shows path failures on hookless hosts.
  - A Claude PreToolUse rewrite may later be added as a speed-up. It is allowed only if it produces the same argv as the launcher, and it never ships on a failed parse.
  - **Acceptance:**
    - installed-consumer tests for advisory, enforce and repo-off;
    - Claude, Codex and a hookless host;
    - an unset root, spaces in paths, an explicit workdir, a local `scripts/` collision, nested invocation, and `cd` before invocation;
    - the latency added per call is measured on each host.
  - **When:** Program 2, unless the baseline shows path failures cost the framework arm.
  - **Rev 4 contract (§11 item 9):** skills call `"$SVC_ROOT"/scripts/…`, which SessionStart exports. The `svc-run` launcher is built only if the baseline shows path failures on hookless hosts.
- **X2 Boilerplate.**
  - Re-counted at `7b48cc4`: Task-Graph Mode in 85 skills, phase receipts in 79, compaction in 60.
  - Phase-receipt blocks are deleted with §5.6, not pointed at.
  - The rest become one-line pointers, in lane batches. Pinned validators are updated in the same change.
- **X3 Safety bugs:**
  - `track-topology-diff` redacts Kubernetes secrets;
  - `research` no longer auto-commits or pushes;
  - `discover-skills` requires approval to install;
  - `assess-market-readiness` no longer auto-commits.
- **X4 Phantom references:**
  - Skills named that do not exist, and lanes 8–12 that exist only in prose.
  - Hard-coded model names become store lookups.
  - A validator checks that every skill a SKILL.md names exists or is an add-on known to the addon gateway.
- **X5 Consumer leftovers:** consumer-specific examples move to reference examples or are deleted. The audit lists them; this public plan does not repeat them.
- **X6 Chain token weight.**
  - ≤80-line cores for the chain skills and for design-ux, design-ui and track-visuals; everything else moves to on-demand references.
  - route-workflow's hot path is ≤60 lines.
  - Measured: tokens per chain session before and after, on Haiku, with no score loss. Revision 2's estimates (about 200k for a full chain, 8–10k bounded) are re-measured, not quoted.
- **X7 execute-changeset stays byte-identical.** A Two-Box executor key is bound to those bytes. A change rotates the key and records a new retained run in the same commit.
- **X8 Author family from identity, not a default.** craft-prompt, `blind-floor-check.mjs` and `prompt-floor-judge.sh` take the author family from the actual orchestrator, so a same-family review is never certified as independent.

**Per-skill decisions.** Unique techniques are kept. A merged or removed skill gets a removals.md entry.

| Group | Skills | Decision | Reason / proof |
|---|---|---|---|
| **Chain: plan** | plan-changeset | **R** ≤80-line brief core. Keep work-shape classification, the dry-run against disk, the scope-cut ban with its coverage matrix, and the test-value inventory. **Add the hidden-requirements "done means" checklist**: journeys, empty/error states, auth, payments, data lifecycle, phone | northstar H and P |
| | review-plan | **S** Mechanical pass by default. External review only on irreversible zones or the production profile | ceiling data |
| | review-gate | **Measure first.** Candidate merge into review-exec, with the PR-merge receipt name kept by an alias. Pinned in `mandatory-delivery-chain.mjs:5`, `validate-mandatory-delivery-chain.sh`, the visual-diff `before:"review-gate"` checks and 7 manifest lanes | Its no-gain label cites an older model's benchmark (§5.5) |
| **Chain: exec** | execute-changeset | **K bytes** (X7). The harden step is `scripts/harden.mjs`, called by the step and selected by file type: a thin, profile-aware wrapper over `quality-probes.mjs`, `web-probes`, `mobile-occlusion`, `chaos-probe` and the dead-end walk. Prototype: own tests plus a smoke walk. MVP: plus probes. Production: mutation ≥0.6 | the pilot failure where a build passed its own checks and failed in use |
| | review-exec | **R** One post-execution review, profile-aware. **M** review-cross-model into it | ceiling 1.2–2.8× cost |
| | audit-implementation | **S** Keep the per-AC verification contract. Drop the specialist dispatch | ceiling |
| | review-security | **S** The security lens, triggered by the `security` condition (§5.2 step 3) | T4 |
| | land-changeset | **S** One helper call. VERSION/CHANGELOG/coverage only in production. Local-only land for prototypes | — |
| | verify-promotion | **R** `verification: local|live`; live only when a deploy target is in the task record. The test-quality audit moves into harden | — |
| | route-workflow | **R** ≤60-line hot path: classify, write the lean record, compile, worktree | 44k tokens per session today |
| **Spec/design** | write-spec | **R** ~50-line template plus 3 checks. **M** audit-ac into it, after the AC digest sees later user stories (§5.8) | no gain at 3.6× |
| | design-ux, design-ui | **S** Under the `ui` flag. The app-screen and marketing-page split (§5.2) | — |
| | design-tech | **S** Cost and ops scale with risk. Keep the feasibility matrix, contract map and deprecated-foundation scan | — |
| | write-journeys, write-e2e, test-journeys | **S** One stage each, ordered before land | T3 |
| | track-visuals | **S** One diff after implementation, under the X6 cap | — |
| | explore-solutions | **S** Only under `one_way_door`. The 3/5 minimum is deleted | — |
| | explore-ux | **M** → propose-ux-improvements. The live browse stays opt-in | a network tour on every UI fix otherwise |
| | define-code-style | **M** → design-tech. It leaves the lane in the same change | — |
| | write-vision, validate-feature | **S** Under `new_product`. Keep the K1–K7 kill signals | — |
| **Research/upstream** | analyze-domain | **S** Terms mode is the core. Teach only under `new_terms`. It writes to the product's domain bank (§5.11) | T2 |
| | analyze-competitors | **S** Under `new_product`. **M** catalog-domain-capabilities into it as a table-stakes checklist; catalog leaves the lane in the same change | — |
| | build-personas | **S** Build and gap modes only, under `ui` | — |
| | research | **S** ~60-line question mode. Keep the volatile-fact live re-check. No auto-push. **M** recall-stack-knowledge into it | — |
| | sync-spec-code, onboard-repo | **S** sync-spec-code only under `drift`. Onboarding writes the lean flags and stops, or continues into brownfield-feature with them. **M** audit-coverage into onboard-repo | ceiling |
| | plan-capabilities | **X** from the brownfield-conversion lane: on demand only | — |
| | diagnose-bug | **S** ≤1.5K-word core. It writes the lean record | ceiling at 12× tokens |
| | audit-feature, align-feature | **R** Ship the branch-enumeration method. align-feature's aspect sweep moves into review-plan and review-exec | — |
| **Decisions** | decide | **S** Inline the 7 card rules. **M** discuss-phase into it | both no-gain |
| | strategic-decision | **S** One-file lite mode by default, computed by the #129 engine (§8). **M** procurement into it | — |
| | blind-control-plan | **X from the default path**; the script stays opt-in | 37× cost for no gain |
| **Company roles (14)** | the role skills | **M → one `company-role` skill**, with role cards as references and cos as the router. **Measure first**: 3 role tasks, separate versus merged, Haiku, $2 | owner condition |
| **Builder advisor** | capability-concierge, honest-diagnosis | **M → `builder-advisor`**. Remove the forced ≥3 blockers | — |
| | find-opportunity, assess-market-readiness, roadmap-evaluation, stage-revenue, mine-builder, launch-knowledge, manage-finops, monetization-architecture, platform-operating-architect, capability-registry | **K on demand / S.** Dated facts get live re-checks with an as-of date | — |
| **Marketing/visual** | landing-page, benchmark-landing, design-logo, generate-visuals, analyze-marketing, ad-video-script, produce-ad-video, grow-social, design-sync, reverse-engineer, propose-ux-improvements | **K/S.** design-logo gets a stopping rule and a budget. design-sync is renamed design-bridge (§5.8). Providers come from the store | — |
| **Self-improvement** | improve-framework | **S** Owns the loop (§5.5). **M** evolve-framework into it | — |
| | test-framework, evaluate-rule, create-skill | **R/S** Around outcome-eval and skill-ab-eval. create-skill requires a coverage row and a four-arm A/B | — |
| | blend-external, ingest-guide | **S** **M** blend-private and ingest-guide-batch into them | — |
| | manage-learnings | **S** It gets the standing-rules write it lacks today; it exports a paste block now (§5.11) | 19/20 |
| | audit-session-execution, svc-advisor, teach-project, capture-idea, refresh-competitors | **K/S** | — |
| **Infra** | plan-blast-radius, track-topology-diff | **S/R** Triggered by the compiler's infra irreversible-path rule. Topology secrets redacted (X3) | — |
| **Ops** | list-work-items, sync-work-items, dispatch-waves, craft-prompt, addon-gateway, discover-skills, base44-environment | **K/S.** discover-skills becomes an addon-gateway mode, with approval. base44 becomes an optional platform pack | — |
| **Remove** | quick-fix (stub), extract-bootstrap, suno-architect, wsl2-audio | **X** from the install set, not only from the lane lists. Personal skills move to the owner's personal skill dir | dead or personal |

Every installable skill is either in a lane under a flag or in an on-demand registry the compiler can refuse to start. The net result is 108 → about 77 skills if every merge passes measurement, and fewer merges otherwise.

### 5.4 Hooks and speed, at the same quality

Same quality means the same checks, answers and artifacts. Cut repeated work in this order:
1. **Turns first.** A skipped skill saves a model turn, tens of seconds. Skip these, each only where a run already showed no gain:
   - the compiled listing (§5.2 step 6) and the lean flags;
   - the second track-visuals pass without a baseline;
   - explore-solutions off one-way doors (unmeasured, so off by default and labelled unmeasured; §11);
   - logo and landing on an app screen;
   - review stages on at-ceiling, non-zone tasks, which keep their mechanical record.
2. **Process starts.** The rule, learning and owner injectors run inside the existing dispatcher process and share its git memo. Targets from `references/hook-budgets.json` (H3), in Node starts:
   - PreToolUse Edit 14 → 4;
   - PostToolUse Edit 10 → 2;
   - Read 4.5 → 1;
   - Stop 12 → 4.
3. **Read, Grep and Glob exit early** when the session marker says the path was already injected.
4. **Byte-stable prefix.** Stable text comes first (CLAUDE.md, the rules index, skill descriptions) and session text last. Nothing is appended to CLAUDE.md. Cache reads are measured on two turns in the same repo, and only the framework's own part is claimed.
5. **A native client last.** The Go client to a warm Node handler (`docs/decisions/2026-10-10-speed-and-defaults.md`) comes only after H3 is measured.
   - **Acceptance:** the same captured inputs go through old and new. Decisions, stdout/stderr, statuses and filesystem effects must match. This covers policy changed between requests, concurrent callers, daemon death, ambiguous timeouts, malformed payloads, symlinked worktrees and unsupported hosts.
   - **Adoption** is decided on full-event p50/p95 and cumulative task time in a UI-sized edit session (edits × p50), not on one Edit sample.

**Measurement hygiene.**
- `hook-bench` sanitises `SVC_REPO_MODE`, `SVC_DISABLED_HOOKS` and `SVC_HOOK_PROFILE`, and fails on child failures, before any number is used.
- **Fail-open counter.** Any fail-open path increments one file under `.svc`, recording the hook name and the error class. The exit code is unchanged, and no rule text is printed. The cockpit shows the count.
- **Memory recall.** A newer correction supersedes the advice it corrects. Caches are keyed by what they prove.
- **Tier-1 runner.**
  - In-shell timing replaces the two clock-only Node launches per validator (878 a run).
  - task-graph load shares repository discovery (15 git calls → 5).
  - Reconcile invalidation is dependency-specific.
  - Mutation candidates run in private copies in parallel.
  - None of this touches the measured arm.

**Not for speed:** shortening a skill whose moved template is what the step checks; dropping harden, the hidden checks or the occlusion probe; a Go port before H3 is measured. The hook-daemon permission rule stays the owner's call. It is asked once, with the measured gain.

### 5.5 Evals and the improvement loop

One loop, owned by improve-framework.
1. **Pick.** `capability-coverage next` takes the highest-traffic component that is unmeasured or no-gain. After a model release, decaying components go first (§2a).
2. **Repair the instruments first.**
   - The three A/B graders that accept empty substance are fixed.
   - `skill-ab-eval` stops returning earns-keep from one failed bare run against one passing skill run. Incomplete evidence never recommends keep.
   - Evidence labels are bound to the measured candidate and model.
3. **Two arms** on priority skills (§11 item 5): bare versus the skill, with the skill's whole folder mounted. Adoption needs n ≥ 5 per arm and p < .05, else "inconclusive", confirmed on a held-out task (§11 item 8).
4. **Vary, contained.** probe-loop variants (rewrite, simplify, merge, remove) run only after containment:
   - checks run inside the worker sandbox;
   - ownership is inspected after the checks;
   - result contents are bound;
   - destination ancestry is validated without following escaping links;
   - the full result is preflighted before any write.

   A broken checker stops the experiment instead of condemning candidates.
5. **Adopt.** `northstar decide` for the north star; `compareSamples` with its interval above 0 for single components. No point estimates. `capability-coverage record` stores the result.
6. **Check fast.**
   - trace-check-deps drives the existing focused mode.
   - Selection keeps the deleted side of a rename.
   - `references/check-deps.json` is committed.
   - A recall check replays known breakages.
7. **Migrate pending graphs** when a skill is merged or renamed.
8. **Isolation.** `worktree.sh` defaults to HEAD on feature branches. In-repo evals use run-scoped git config and never write the repo's own (T11).

### 5.6 Receipts become three invariants, checked at transitions

**What the audit found:**
- **Size:** about 8,000 lines over 29 files, pinned by 61 tier-1 validators.
- **Self-attestation:** 487 `record-phase` commands that check nothing.
- **Model-written JSON:** exec-record, audit and verify are model-written JSON with presence checks only.
- **History:**
  - at least 4 logged bypasses and at least 4 false blocks;
  - about 20 work items spent on the system itself;
  - **0 documented product defects caught by receipts.** The reviews caught defects; receipts recorded them.

**Three invariants:**
1. **The plan was reviewed before execution.**
2. **Merge only a reviewed tree.**
3. **Tier-1 is green on that tree.**

**Mechanism: `stage-close`, about 150 lines,** called by `task-graph set-status`.
- **It records:**
  - git facts derived from git, not written by the model: the tree, the diff hash and the files;
  - the plan digest, the scope and policy version, the attempt and predecessor identity, and the trusted issuer;
  - the stage's machine artifact.
- **It checks** the predecessor's record and fails at that transition.
- **It feeds** outcomes to the router (§5.10) and the cockpit.

**Durable proof:**
- **Verdict ref.** The launcher writes one verdict at `refs/svc/review/<tree-sha>`. A failed push fails loudly.
- **Fallback transport.** Step 0 proves the push path accepts non-branch refs. If it does not, the verdict goes as a JSON file in a PR comment.
- **CI check.** A CI job checks the merge candidate's tree and base against the reviewed tree. Squash keeps the tree only when the base has not moved.
- **Commit status.** When a GitHub token is available, the launcher posts `ssve/review`.
- **Provenance.** Local CI checks the binding and the shape, not the author. Real provenance needs a review job that runs trusted base code with an owner-held secret. Fork PRs get no secret. Until that exists, the check is labelled "binding only".

**Migration:**
- **Refuse mode** means "CI invariant 2 is required and the invariant-1 transition check blocks".
- **Consumers re-keyed in the same change:**
  - `run-external-review.mjs:946-962`;
  - `scripts/lib/pr-review-receipt.mjs`;
  - `merge-pr-with-review-receipt.mjs`;
  - `lib/plan-manifest-contract.mjs:57-66`;
  - `prepare-plan-handoff.mjs:54-69`;
  - stage-segment.

  The `svc-workflow-guard.mjs` merge gate also matches the MCP merge.
- **Bypasses closed.**
  - The lane-tasks validator hook and CI also run invariant 1.
  - `assertExecuteChangesetReceipts` and `assertCanonicalReceiptCompletion` are rewired.
  - `skill_receipt.loaded_at` stays for the cockpit.
- **Consumers.**
  - `svc init-ci` ships a reusable workflow.
  - An enforce-mode consumer keeps its enforcement until its replacement workflow, required check and secret exist.
  - `check-chain-receipts --read-only` stays.
- **The exempt class** is computed from the diff, never declared.
- **The compiler schedules** review-plan and review-exec, not the receipt hook.

**Delete after Gate C (§6), each with a removals.md entry:**
- phase receipts, with their hook and checks;
- model-written receipt JSON;
- the `emit-receipt.mjs` note path;
- post-commit promote, the mirror and aliases;
- the low/full tiers and the range scans;
- `chain-policy`, merged into the one hook mode;
- about 45 of the 61 validators, with the rest rewritten around the invariants;
- the CLAUDE.md chain section, rewritten.

**Proof.**
- **Negative tests, written first:**
  - exec before the plan review;
  - head tree differs from the reviewed tree;
  - a self-issued verdict;
  - a changed plan;
  - the wrong WI;
  - a quick-fix record on another tree.
- **A fresh consumer** with no legacy notes completes prepare → review → execute → review.
- **An enforce consumer** without the replacement CI keeps its enforcement.

### 5.7 Cockpit

**Read model.** `cockpit-state.mjs` is the single read model. It joins:
- projects;
- goals and "needs you";
- lane-tasks phases;
- the router's harness, model, effort and cost per task;
- workers;
- capacity.

**What a person sees.**
- **One sentence when nothing is asked:** "Booking screen is in progress. Nothing needed from you." The chat reply and the card use the same sentence, written by the read model.
- **A feed only where it is needed:** one line per actionable change (needs you, blocked, stalled, over the estimate, goal finished). Five lines are visible.
- **The card is the high-level view:** goal, one status word, and one fact. The diagram, workers, cost and deviation are one click in.
- **Updates are deltas:** "2 finished, 1 needs you". A stage finishing is a row in the open card, not a toast.

**Security, now.**
- The token covers the existing GET routes and the event stream, not only a future POST.
- It comes from the fragment the terminal prints.
- A wrong token gets the same response as an unknown path.

**Steering.**
- One POST `/api/steer` with:
  - a Host allowlist;
  - an exact Origin match;
  - a JSON content type;
  - a constant-time compare;
  - `expected_attempt`/`expected_session`.
- Steers are prompts carrying the worker's permissions. Orchestrator steering goes through a queue file that a hook injects at the next turn.

**Also on the card.** The fail-open count, which bots are on, and whether company briefing is on for each.

**Removals:**
- `cockpit.html`;
- `orch/serve.mjs`;
- `render-status.mjs`;
- `fanout.sh`;
- `dispatch-worker.sh`.

**Proof.** `validate-cockpit-live.mjs` fixtures:
- one running project renders one sentence and no toast;
- a blocked project renders one question;
- five projects render five cards and a feed of only the ones that need a person;
- GET and POST without the token get the unknown-path response.

### 5.8 Founder layer

1. **`docs/specs/founder-context.md`**, in the product repo, with one owner skill per fact. Its sections:
   - ICP;
   - positioning;
   - claims with evidence;
   - voice;
   - pricing;
   - funnel targets;
   - pointers to the design system.
2. **Delivery reads it.**
   - plan-changeset and write-spec take it as input.
   - A Founder Trace is required on user-facing work when the file exists.
   - The activation conditions `claims-marketing` and `priced-surface` read the product's own file.
3. **Formulas you can run.** `scripts/founder-metrics.mjs` covers:
   - LTV;
   - CAC;
   - payback;
   - LTV:CAC;
   - runway and default-alive;
   - the funnel chain;
   - A/B sample size.

   Inputs come from `company-state/metrics.jsonl`, each with an evidence grade. The finops "CAC" is renamed cost-to-serve. Each formula is tested against a sourced worked example. The #129 engine reads these outputs; there is no second formula set (§8).
4. **One token spine.**
   - DTCG `docs/specs/ui/tokens.json` is canonical.
   - Motion round-trips through the token file.
   - The storyboard continues to `produce-ad-video` only under the ad flag.
5. **Claude Design.**
   - The framework's `design-sync` becomes `design-bridge`, in the serial integrator batch, so it cannot shadow the built-in.
   - It is the visual step only under `claude_design` (§5.2).
   - Other harnesses use design-ui files only. The canvas is never called on them, and the skill is never renamed there.
6. **Document correctness.**
   - The AC digest must see later user stories. This is fixed before the done-definition is measured (§6, P1.3).
   - Semantic document changes are never classified as cosmetic.
   - "Implemented" is not "available" in marketing claims.

### 5.9 Harness knowledge store

- **Store.** `references/model-intel/`:
  - `models.json` is extended to every family the playbook launches.
  - A new `harnesses.json` holds, per harness:
    - the version probe;
    - argv templates per role (exec, review, analysis);
    - capability flags (hooks, skills dir, rule injection, subagents, sandbox modes, Design built-in);
    - the governance fields (§5.12);
    - quirks.
  - Every fact is `{value, as_of, source}`.
- **Generated, not hand-edited.** These are derived from the store:
  - `model-registry.json`;
  - `priors.json` model aliases;
  - `harness-playbook.json`;
  - `harness-baseline.json`;
  - `provision/hosts` fragments;
  - the dispatch argv.

  `model-intel derive --check` fails when a derived file was edited by hand.
- **First step, read-only.** `model-intel check` joins the seven sources and reports where they disagree (T5–T7). It ships before any consolidation.
- **Drift.**
  - `harness-drift` covers every installed harness, and the playbook flag verify runs in the same pass.
  - Machine-local observations, with `as_of`, are written under `~/.svc/`.
  - A scheduled daily job runs drift, flag verify and a vendor changelog check, then opens a PR with the store diff for the owner.
  - SessionStart runs only the cached version check.
- **Freshness.**
  - Model ids and prices: 30 days.
  - argv and flags: re-verified on every harness version change.
  - Quirks: 90 days.
  - A stale fact makes its arm "unverified". The owner may still pin it; exploration never picks it.
- **Validator.** It extends `validate-slot-config`: no model id outside the store and its derived files.
  - A migration list starts with the 61 files in T8 and may only shrink.
  - An allowlist covers pricing tables and provider docs.
  - Retired ids are removed, or allowlisted with a reason.

### 5.10 Router and slots

- **One authority.**
  - `resolve-dispatch` returns the allowed set and the owner's tuple, through its existing layers: framework default, owner file, work overlay, session override. No layer an agent can write ranks above the owner.
  - `route-model` picks inside the allowed set and writes one reason onto the task.
  - With no owner `route_candidates` list, the owner's tuple is used unchanged.
- **Arms** are harness × model × effort, limited to what the store marks verified and the policy allows.
- **The default arm is the control.** It is what the harness does with no framework: Claude Code's configured default, or the model and effort in the Codex config. It is always a candidate.
- **Leaving the default.** The router leaves the default only when one of these holds:
  - the alternative's posterior pass rate is at least the default's minus 0.05, and its expected cost per solved task is lower;
  - its pass rate is higher, within the cost cap.
- **Exploration.** At most 10% of non-zone tasks, never on irreversible zones. Every task gets a bounded attempt envelope: maximum attempts and maximum USD.
- **Learning.**
  - `stage-close` records the arm, the outcome (tests, review verdict, harden), tokens, USD and wall time.
  - Records are deduplicated by id.
  - A correction removes the stale metric.
- **Availability** is classified on both the review and exec sides. It only orders candidates and is never used in review gating.
- **Cross-harness measurement.** The first non-Claude eval transport is codex, with argv from the store. Arms are named `harness:model:effort`.
- **Reviewer ladder.**
  - The launcher tries the other family. Its signed failure receipt is the only evidence that allows the fallback; no probe or cache counts as evidence.
  - The fallback is the same family's top pinned model at effort ≥ high, in plan mode, with a tree-unchanged check. It is labelled `same-family`, capped at 2, and never authorises promotion alone.
- **Skill.** `route-ai`, ≤60 lines, wraps the script for "why this model", owner overrides and `stats`. The hot path calls the script.
- **Proof.**
  - Replay regret below the default policy's on recorded outcomes.
  - Unit tests: owner bounds are never exceeded; the prior resets on a new id; failover works; an unverified arm is never explored.
  - Live: 20 small tasks across two harnesses. The router equals or beats the default on cost per solved task.

### 5.11 Founder domain expertise (K)

- The plan, exec and lens agents declare `domain: product`. It resolves to the project's domain bank, standing rules and founder context, topic-matched and capped in bytes.
- `expertise.mjs` learns a product bank path inside the product repo.
- A fact is refreshed when a task cites it. A stale fact carries its stale label into the prompt.
- **Standing rules.** manage-learnings writes accepted owner rules, which it does not do today. Two variants are measured on K at equal cost, and the better one is adopted:
  - a capped always-loaded block of at most 2 KB, never appended to `CLAUDE.md` (the 19/20 mechanism);
  - topic-injected files, 4 KB per topic and 16 KB in total (§11).
- The #129 decision ledger is the record of owner decisions that K tasks can test (§8).
- **Proof.**
  - K on dev and on the reserve.
  - A fixture that cites a stale fact shows the stale label.
  - Preload bytes are measured per agent.

### 5.12 Company governance and always-on agents

- **Governance fields on every harness record:**
  - `company_briefing`: `off` or `bounded`;
  - `ledger`: `never`;
  - `outward_actions`: `deny`, `approval` or `allow`.

  Dispatch refuses a host that lacks them. A sandbox-bypass flag is passed only when `outward_actions` is `allow` for a role that is not company work.
- **Always-on agents** get their own record:
  - `kind: always-on`;
  - `product`;
  - `role`;
  - `company_briefing`;
  - `outward_actions`, default `approval`.

  The agent returns finished work and the decisions it could not make. COS writes the decision card after a person approves. A product with no record is not a company worker. CLI hosts stay process launchers.
- **First slice.**
  - A scoped briefing, status, recall and pending-proposal surface over the existing company state.
  - One real connection per always-on product, tested for identity, freshness, interruption and resume. Deferred until the owner supplies documented APIs or an export sample (§11 item 4).
  - The vendor pages establish connection surfaces, not provisioning APIs.
- **Briefing.**
  - Counts and pending asks come from `dashboard --json`, with no filesystem path and no ledger body.
  - Nothing is cut on a byte boundary.
  - The person gets one sentence.
- **Queue.**
  - Three asks are shown; a fourth is stored and not shown.
  - `append-decision` requires `recall` for that role since the last outcome.
  - Bypasses are logged on the card.
  - Role names are canonical, and recall reads both old names.
  - Scaffold refuses to write inside a git work tree where `company-state/` is not ignored.
- **Repairs:**
  - approved cards fail the product bridge today;
  - multi-bot submission needs atomic ids and idempotency;
  - a quiet COS run is a success.

### 5.13 Repairs found by review

**Before measurement (Program 0):**
- probe-loop containment (§5.5 step 4);
- reopened stages keep obsolete edges (§5.2 step 8);
- a completed effect disappears from recovery when its lease expires right after;
- crash recovery must use the durable verdict, not retry arguments;
- incomplete A/B evidence recommends keep;
- the AC digest misses later user stories;
- prerequisites after promotion (T3).

**In Program 2, wave 1** (check status first, then fix or close with evidence):
- withdrawn or reassigned research edges are rebuilt;
- deterministic ranking never vetoes an eligible owner choice;
- outcome correction removes stale metrics;
- Kimi's post-compaction text matches runnable-task selection;
- rollback is allowed after outcome observation begins;
- the review-cache protection is kept;
- bounded plans satisfy the lane validator's required handoff;
- the compiler honours the CLI delivery profile.

## 6. Order: the only order

**Program 0: make the measurement able to measure.** No change to the framework arm.
- **P0.1 Runner repairs:** everything under "Fair arms" and "Run shape" in §4, plus `northstar plan` and `northstar decide` with their fixtures.
- **P0.2 Instruments:** the §5.5 step 2 repairs, probe-loop containment, and the §5.13 Program 0 list.
- **P0.3 Pre-registration:**
  - the reserve tasks are written blind;
  - graders, the matrix, the bar, `ARM_LIMITS` and the hashes are committed;
  - an independent review of all of it.
- **P0.4 The fail-open counter.**
- **Exit:** a balanced dry-run manifest, green fixtures, and a reviewed pre-registration.

**Program 1: the proof.**
1. **P1.1 Frozen baseline (Gate A).** Solo versus `git archive dc358c0` on Haiku, all 9 tasks. The reserve results are sealed.
2. **P1.2 Branch on the baseline:**
   - If Δ ≤ 0 or cost is over 3×, the next edits are only the token cut (X6 on the chain cores) and `harden.mjs`.
   - If H is below solo on a task, fix the done-definition first.
   - If E or S is near 0 for both arms, build `harden.mjs` first.
3. **P1.3 The Program 1 organism.** Each piece is a cumulative treatment, measured on the dev slice:
   - a. the ≤60-line route-workflow and the compiled listing;
   - b. the done-means checklist in plan-changeset, after the AC digest fix;
   - c. `harden.mjs`, selected by file type;
   - d. the standing-rules write;
   - e. the §5.2 wiring: the lanes-as-data no-op switch, condition-first commits, ordering and security;
   - f. the K preload for delivery agents.
4. **P1.4 After-number** on dev and on the reserve. The reserve is opened once.
5. **P1.5 Loop:** at most 3 iterations, on dev only.
6. **P1.6 Opus confirmation (owner yes).** The full bar, on Opus.
   - If it fails, Program 2 does not start.
   - It gates deletions, merges and any 2× claim. Additive owner asks (cockpit, router, slots, founder formulas, governance records) may proceed after P1.4, each re-measured per batch (§11 item 3).
   - Decaying components whose effect vanished on Opus are retired by §2a instead.

Program 1 passes only when P1.4 (or the last P1.5 iteration) and P1.6 both pass.

**Track F: safety fixes, now, in parallel.**
- X3;
- the cockpit read token.

Neither touches a northstar task path.

**Track R: routing and knowledge, in parallel.** It never un-pins a slot in the measured arm and never deletes anything.
- **R1** `model-intel check`, drift across all installed harnesses joined with flag verify, and the daily schedule.
- **R2** `stage-close` recording outcomes to the router, side by side with the old receipts.
- **R3** The change-absorption test, written; it fails until R4 and P1.3e land.
- **R4** dispatch argv from the store; the codex eval transport.
- **R5** The router's default-arm control, its deviation rule, and the replay regret test.

**Program 2: only after Program 1 passes on Haiku and on Opus.** This gates deletions, merges and any 2× claim; the additive items of §11 item 3 may start after P1.4.
- **Gate B:** skill merges and rewrites run only if Program 1 shows the gap is in skill text, not in missing probes.
- **Gate C:** receipt deletion runs after Program 1 passes, one green PR through the new path, and the consumer compatibility tests.
- **Waves, in this order:**
  1. X1 launcher, X4, X5, the §5.13 Program 2 list, store consolidation (`derive`), and the §5.12 governance fields.
  2. Slots and the ladder.
  3. Receipt deletion, as a serial batch.
  4. X2/X6 skill rows.
  5. Cockpit.
  6. Founder layer and company governance.
- **Hooks:** the §5.4 order.
- **Each batch** is re-measured on the dev slice. A batch that lowers Δ is reverted.
- **Ownership:** disjoint scopes, plus one serial integrator for the five source-of-truth files and every rename.

**Build transport.**
- **Program 1: no swarm.** Its edits are few and serial, and each one is measured.
  - Opus writes the chain cores.
  - Sonnet writes tested logic: runner repairs, `harden.mjs`, `northstar decide`.
- **Program 2:**
  - a Haiku swarm for mechanical rows (X2 pointers, X4, X5, chain-field rows, launcher migration batches);
  - Sonnet for logic with tests;
  - one base sha for every worktree;
  - a Haiku diff that fails twice goes to Sonnet;
  - merges and renames are serialized.
- **Time and cost** come only from the budget table and `ARM_LIMITS`. There are no other estimates.

**The only budget.** Every paid run uses `--max-usd`.

| Step | Runs | Cap | Owner yes |
|---|---|---|---|
| P0 fixtures and dry runs | fake runner | $0 | no |
| P1.1 baseline, Haiku | 9 tasks × 2 arms × 3 = 54 | $35 | no |
| P1.3 treatments | 6 × 12 (dev slice, framework arm) | $8 each, $48 | no |
| P1.4 after-number, Haiku | 54 | $35 | no |
| P1.5 loop | at most 3 × 12 | $8 each, $24 | no |
| P1.6 Opus confirmation | 54 | forecast printed first | **yes** |
| Track R live router | 20 tasks | $10 | no |
| Decay ablation per model release | 12 per component group, at most 4 groups | $8 per group | yes above $32 |
| P2 batch re-measure | 12 | $8, at most 10 batches | no |

Haiku total before Opus: $152 at most. The authoring sessions that write Program 1's edits are not metered by `--max-usd`.

## 7. Pre-mortem: it is January 2027 and this plan failed

| # | How it failed | Evidence today | Guard | Kill criterion |
|---|---|---|---|---|
| 1 | The bar never measured the framework | Solo inherits the real home; graders not frozen; ratio undefined at solo 0 | Program 0; fair-arms rules | Any row with real-home access or a null sandbox voids its run |
| 2 | Won on Haiku, vanished on Opus | Opus already does more of what E and S add | P1.6 before any deletion | Opus fails the bar → Program 2 does not start |
| 3 | Won on seen tasks only | Tasks 2 and 5 informed the diagnosis | Reserve written blind, opened once | Reserve fails → no headline claim |
| 4 | Static rot: every model or harness change needed code | T1, T6 | §5.1 absorption test; store | Absorption test red → the wave stops |
| 5 | The router never beat the default | n=0 everywhere (T5); no non-Claude transport (T10) | Default arm as control; R2 recording | After 50 recorded tasks per type, regret not below default → the router stays advisory |
| 6 | Harness knowledge rotted | T7; newest knowledge stamp 87 days old | Store with `as_of`; daily drift | A slot on an unverified arm dispatches only by explicit owner pin, with a visible warning |
| 7 | Receipts deleted before the replacement proved itself | 0 catches, but also the only local brake | Gate C | Any negative test red → no deletion |
| 8 | Budget overrun | Revision 2 had three budgets and no total | One table, loop ≤3, ≤10 batches | A step with no row does not run |
| 9 | A stale section built a cancelled design | Revision 2's transport block kept the codemod | One order; stale-string check (§9) | Stale string found → the revision is not pushed |
| 10 | Founder knowledge never reached delivery | T9 | §5.11 wiring; K scored | K not above solo after wiring → stop expanding the founder layer |
| 11 | The chain got longer, not shorter | T2: 15 stages for a typo | Lean flags; one scheduler | Typo with a lane-upstream stage beyond the invariant tail, or a dropped skill started by `next` → tier-1 red |
| 12 | Hooks failed open and nobody knew | No counter today | §5.4 counter | Non-zero counter → the run is not clean |
| 13 | Money paths shipped without security review | T4 | §5.2 step 3 | The payments scenario test is red → land fails |
| 14 | #129 merged by conflict resolution only | T12 | §8 contract | The two reproduced defects are open → no merge |
| 15 | The plan outgrew the owner's attention | 40+ review threads; 3 revisions in a day | One order; owner yes only at Opus and decay over cap | Program 1 not started within 7 days of approval → re-scope to P1.1 alone |
| 16 | A branch switch on the machine changed what the eval loaded | T11 | `git archive`, private homes | A run whose installed root is not its archive is void |

**Whole-plan kill.** If Δ's lower bound is still ≤ 0 on dev and on the reserve after 3 loop iterations, Program 2 stops. The negative result goes into PILLARS and the ledger. The framework ships as the durable components that did measure (standing rules and the done-definition), and the rest goes on demand.

## 8. #129 integration contract

#129 adds the decision engine (Monte Carlo with a Gaussian copula, EVPPI), the decision ledger, experiment comparison and Lane 13 for non-code work.

1. **Order.** #129 merges after #127, by a merge of #127 into its branch, not a rebase. The 5 conflicts resolve toward #127's slimmed files:
   - `.svc/manifest-digest.json`;
   - `FRAMEWORK-STATE.md`;
   - `references/skill-routing-index.json`;
   - `skills/route-workflow/SKILL.md`;
   - `skills/strategic-decision/SKILL.md`.

   Lane 13 goes into data (manifest and registry), not route-workflow prose.
2. **Lane kind.** #127's coherence utility injects the code-delivery chain into every lane. It reads a lane kind and leaves the non-code lane alone.
3. **Fix before merge.** Each has a test:
   - **Hindsight replay.** Hindsight replays a content-addressed snapshot of the model stored with the prediction, not the file now on disk. The test changes the model file after recording.
   - **Discrete quantiles.** `rangeOf` and `quantile` sort discrete values with their weights before accumulating. The test lists values out of order and requires p10 ≤ p50 ≤ p90.
4. **One statistics helper.** `experiment-compare` and `northstar decide` share `compareSamples`. There is no second bootstrap.
5. **Shared inputs.** Founder formulas (§5.8) produce the engine's variables from `company-state/metrics.jsonl`. There is no second formula set.
6. **Slimming keeps the engine.** strategic-decision's lite mode calls the engine. Slimming the skill must not remove that call.
7. **Decisions as knowledge.** The ledger is the record of owner decisions that K tasks can test (§5.11).

PR #128's head is an ancestor of #127, and #127 carries its fixes, so #128 can close.

## 9. Verification

- **Tier-1:**
  - the absorption test;
  - dynamic-chain scenarios;
  - registry owners;
  - delivery-graph ordering;
  - `model-intel derive --check`;
  - slot config;
  - ladder rungs;
  - check-selection recall;
  - prefix stability;
  - `northstar decide` fixtures;
  - cockpit density fixtures;
  - a `framework-coherence.mjs` run with 0 findings and a passing lint.
- **CI** is green on each pushed head, with no push while CI runs.
- **Live:**
  - todo-CLI and SSO;
  - the ladder with only the Claude family;
  - the baseline;
  - the router across two harnesses.
- **Removals:** every removal has a removals.md entry whose reintroduction check passes.
- **Ledger:** the owner-requirements ledger is updated row by row with evidence links. No row says done without a run.
- **Plan hygiene, before any revision is pushed:**
  - a stale-string check finds no cancelled design in the body;
  - every Appendix A quote is found verbatim in the body;
  - a privacy check finds no machine path or account name.

## 10. Owner asks without a component (tracked, not dropped)

- **Private repo per eval run:** blocked by GitHub 403. The remedy is for the repo owner to grant the GitHub App administration write access, or to create the repos.
- **Learning quiz results:** commit them to the quest results and PILLARS.
- **Finops, game economy and artwork checks:** these become S and P probes in the game task.
- **Deferred until the proof passes:**
  - Managed Agents workflows;
  - meta-harness;
  - fleet 14→1;
  - the conversion loop;
  - paid upgrades;
  - harness-agnostic boxes;
  - constrained versus free path.
- **Owner actions:**
  - make "SSVE Required" a required check;
  - add the reviewer secret;
  - decide the hook-daemon permission rule.

## Appendix A. Dispositions, keyed by review or comment ID

Every finding below is accepted unless the row says otherwise. Each row quotes the body sentence that implements it. Comment IDs are as they stand on the PRs after the owner's account re-posted the external review comments. The original posting time is recorded in each comment.

**Owner review 5482766246** (inline 4241067286, 4241067288, 4241067292, 4241067294, 4241067297)

| ID | Finding | Implemented by |
|---|---|---|
| 4241067286 | A six-task geometric mean cannot see the win | "**Pass:** R ≥ 2.0 (or R not defined), Δ ≥ 0.20, and Δ's lower bound above 0." |
| 4241067288 | Budgets disagree; swarm spend missing | "**The only budget.** Every paid run uses `--max-usd`." |
| 4241067292 | The baseline is not a before | "Solo versus `git archive dc358c0` on Haiku, all 9 tasks." |
| 4241067294 | X1 codemod breaks the dynamic rule | "The form names a script, not a layout, so a later layout change is one launcher change." Superseded in part by 6108295301 §3: a hook-only rewrite is not portable |
| 4241067297 | Security keep-list before its condition | "The prototype keep-list gets `security` in the same commit as the condition." |

**Owner review 5482788622** (inline 4241088665, 4241088668, 4241088671, 4241088678, 4241088680, 4241088683)

| ID | Finding | Implemented by |
|---|---|---|
| 4241088665 | Ratio undefined at solo 0; helper is a difference | "If solo scores 0 on every cell, R is reported as "not defined: solo 0 everywhere", never as infinity." |
| 4241088668 | Typo cost cap vetoes a real win | "total USD at most 1.3× solo net of the measured catalog overhead". Superseded by §11 item 1: the cap stays, net of overhead |
| 4241088671 | The install cannot produce this baseline | "**Solo gets a private HOME with no skills and no ancestor `CLAUDE.md`.**" |
| 4241088678 | §7 outranks the new order | "§4 is the only bar. §6 is the only order and the only budget." |
| 4241088680 | Opus confirmation after deletions; Two-Box key | "If it fails, Program 2 does not start." and "A Two-Box executor key is bound to those bytes." |
| 4241088683 | Transport block builds the cancelled design | "**Program 1: no swarm.**" |
| body | Bash rewrite on the hottest hook | "it never ships on a failed parse." |
| body | Loop cap; evidence limits | "The loop gets at most 3 iterations on dev before the reserve is opened, once." and "The other skills are unmeasured, not known no-gain." |

**Owner review 5482798288** (inline 4241098827, 4241098829, 4241098833, 4241098835, 4241098838)

| ID | Finding | Implemented by |
|---|---|---|
| 4241098827 | The app-screen path is a marketing path | "**Marketing page:** the app-screen flow, then landing-page, with benchmark-landing as its gate." |
| 4241098829 | A condition named `ui` attaches to nothing; phantom `perf` | "design-ux and design-ui point at `ui`." and "`perf` owns the web-probes performance numbers" |
| 4241098833 | P ignores recorded performance and occlusion | "plus `mobile-occlusion.mjs` with a logged-in session where the control needs one" |
| 4241098835 | One Edit sample; probe time missing | "browser-probe seconds" and "in a UI-sized edit session (edits × p50)" |
| 4241098838 | Live browse pulled onto the default path | "The live browse stays opt-in" |
| body | Line 80 formula; X6 cap | "The weighted formula from revision 2 is deleted." and "for design-ux, design-ui and track-visuals" |

**Owner review 5482805428** (inline 4241106101, 4241106103, 4241106107, 4241106110)

| ID | Finding | Implemented by |
|---|---|---|
| 4241106101 | Claude pick never moves UI to Design; motion does not round-trip | "It is the visual step only under `claude_design` (§5.2)." and "Motion round-trips through the token file." |
| 4241106103 | One-way-door rule is prose; 3/5 gate still in skill | "The 3-paradigm / 5-approach gate is deleted in the same change" |
| 4241106107 | Personas and vision still run by `next` | "No `next` pointer may override a flag." |
| 4241106110 | Absorption test proves models, not skills | "Edit a delivery profile. The compiled skill list changes, with no SKILL.md edit and no manifest edit." |
| body | `--parallel 4` | "`--parallel 4` is stated on every run." |

**Owner review 5482813786 (twenty paths).** Accepted, with one correction from T1: the compiled path comes from a JS constant in the compiler. It does not come from the manifest lane lists. `next` is the second scheduler.

| Path | Implemented by |
|---|---|
| 1–4, 10–13 | "route-workflow or diagnose-bug writes a lean record on the task." |
| 5, 16 | "**The compiler schedules** review-plan and review-exec, not the receipt hook." |
| 6 | "**K bytes** (X7)." |
| 7 | "one test-journeys stage" |
| 8, 14 | "A payments bugfix with no flag gets review-security (T4)." |
| 9 | "live only when a deploy target is in the task record" |
| 15 | "Read, Grep and Glob exit early" |
| 17 | "the governance fields (§5.12)" |
| 18 | "Edit a delivery profile." |
| 19 | "**Manifest first.**" |
| 20 | "**X** from the install set, not only from the lane lists." |

**5482822752** (inline 4241122846, 4241122849): "The UX experience document and the solution templates stay where skill slimming moved them"

**5482842504** (inline 4241141780, 4241141787, 4241141794)

| Item | Implemented by |
|---|---|
| One scheduler (4241141780) | "When a skill finishes, it starts the next compiled task, not its `next` field." |
| Checkpoints are data | "Checkpoints read the profile: production stops; eval logs and continues." |
| Six stages without an owner (4241141787) | "Every stage key has an owner skill that exists, or it leaves the registry in the same change." |
| Learnings must not grow CLAUDE.md (4241141794) | "Two variants are measured on K at equal cost, and the better one is adopted" |
| Build the home once | "**The framework home is built once per sha and cloned into each job.**" |

**5482855196** (inline 4241152067, 4241152069): "The rule, learning and owner injectors run inside the existing dispatcher process and share its git memo." and "Nothing is appended to CLAUDE.md."

**Scope notes 5482864982–5482865399, 5482870221, 5482891154, 5482909037, 5482932554**

| ID (inline) | Implemented by |
|---|---|
| 5482864982 (4241160229) | "A crashed, timed-out, capped or skipped run scores 0 on every component, and its spend stays in the cost." |
| 5482865077 (4241160313) | "the host skill listing for the session is the compiled list plus on-demand skills" and "**A row whose `builder_sandbox` is null is rejected, for every arm.**" |
| 5482865197 (4241160385) | "It is withdrawn as evidence." |
| 5482865328 (4241160519) | "The token covers the existing GET routes and the event stream" |
| 5482865399 (4241160594) | "Any fail-open path increments one file under `.svc`" |
| 5482870221 (4241164228) | "**One sentence when nothing is asked:**" |
| 5482891154 (4241180447, 4241180451) | "Dispatch refuses a host that lacks them." |
| 5482909037 (4241193834, 4241193841) | "**Always-on agents** get their own record:" |
| 5482932554 (4241213418) | "Three asks are shown; a fourth is stored and not shown." |

**External review comments on #127** (re-posted under the owner's account; each records its original time)

| ID | Finding | Implemented by |
|---|---|---|
| 6108294804 | Probe workers; bounded plans; risk relabels; host precedence; hook-bench inputs; #129 lane kind | "probe-loop containment (§5.5 step 4)", "A completed task whose obligation changed reopens.", "`hook-bench` sanitises", "It reads a lane kind and leaves the non-code lane alone." Repairs it verified as done are not repeated |
| 6108295065 | Probe checks outside the sandbox; symlinked apply; reopened stages' edges | "checks run inside the worker sandbox", "destination ancestry is validated without following escaping links", "rebuilds the dependency edges" |
| 6108295301 §1 | Holdouts were seen; statistic; total USD; isolation; balanced manifest | "Tasks 2 and 5 informed the diagnosis", "Cost is actual total USD from usage", "**Manifest first.**" |
| 6108295301 §2 | Containment before the loop | "probe-loop variants (rewrite, simplify, merge, remove) run only after containment" |
| 6108295301 §3 | X1 hook rewrite is not portable | "Skills move from `node scripts/<name>` to `svc-run <name>` lane by lane" |
| 6108295301 §4 | Receipt migration and provenance | "the plan digest, the scope and policy version, the attempt and predecessor identity, and the trusted issuer" and "Squash keeps the tree only when the base has not moved." |
| 6108295301 §5–§8 | Activation obligations; harness adapters; trustworthy telemetry; cockpit and founder downstream | "the compiler adds the obligation", "argv templates per role", "Records are deduplicated by id.", "**Program 2: only after Program 1 passes on Haiku and on Opus.**" |
| 6108295531 | A/B graders accept empty answers; point estimates; labels; four arms; missing context; model-specific calibration | "The three A/B graders that accept empty substance are fixed.", "**Two arms** on priority skills", "K (§4) measures them.", "with the new model" |
| 6108295729 | AC digest; semantic changes; product documents; implemented versus available; one owner per fact | "The AC digest must see later user stories.", "with one owner skill per fact" |
| 6108295955 | Prerequisites after promotion; base44; author family; speed table | "Personas, e2e and journeys come before land in every mode (T3).", "Today it passes graphs with prerequisites after promotion.", "**X8 Author family from identity, not a default.**", "In-shell timing replaces the two clock-only Node launches per validator (878 a run)." |
| 6108296140 | Memory recall; process reuse first; native acceptance | "A newer correction supersedes the advice it corrects.", "the same captured inputs go through old and new." |
| 6108296334 | Always-on products; approved cards fail the bridge; atomic ids; quiet runs | "The vendor pages establish connection surfaces, not provisioning APIs.", "approved cards fail the product bridge today" |
| 6108296509 | 14 stateful journeys | "a completed effect disappears from recovery when its lease expires right after", "Selection keeps the deleted side of a rename.", "A broken checker stops the experiment instead of condemning candidates.", "**Migrate pending graphs** when a skill is merged or renamed.", "Every task gets a bounded attempt envelope" |

**In-session reviews (no GitHub ID).** Revision 1 review: B1–B4, M1–M12 and minors. Revision 2 review: R-B1–R-B4, R-M1–R-M6 and minors. All remain in force:
- **B1:** "**Same model everywhere.**"
- **B2:** "The reserve is written in a fresh session"
- **B3:** "no probe or cache counts as evidence"
- **B4 and owner review:** "Solo versus `git archive dc358c0`"
- **M5:** "Contract planning stays the default for greenfield"
- **M6:** "A dropped stage that now activates is reinserted, or land fails."
- **M8:** "trace-check-deps drives the existing focused mode."
- **R-B1:** "**Refuse mode** means"
- **R-B2:** "`run-external-review.mjs:946-962`"
- **R-B3:** "Until that exists, the check is labelled "binding only"."
- **R-B4:** "The launcher writes one verdict at `refs/svc/review/<tree-sha>`."
- **R-M1:** "With no owner `route_candidates` list, the owner's tuple is used unchanged."
- **R-M2:** "It only orders candidates and is never used in review gating."
- **R-M6:** "a constant-time compare"

## Appendix B. Traversal commands (run at `7b48cc4`)

Run from a checkout or `git archive` of `7b48cc4`. `C` is shorthand for `node scripts/compile-delivery-graph.mjs --wi WI-T`.

| # | Command | Read |
|---|---|---|
| T1 | `C --intent "fix typo in README" --lane brownfield-feature --delivery-profile prototype --change-type docs --planned-files README.md --risk-flags docs-only`. Run it, then delete `prototype` from `references/delivery-profiles.json`, remove lane skills from `skills-manifest.json`, add `skip_skills`, and run it again. `grep -n LANE_BASE_SKILLS scripts/compile-delivery-graph.mjs` | identical `tasks[].metadata.skill` both times |
| T2 | the T1 command with `--delivery-profile production`, and with `prototype` | 15 tasks; 9 tasks starting with analyze-domain |
| T3 | `C --intent "yoga studio booking app" --lane greenfield --delivery-profile production --change-type feature --planned-files src/app/page.tsx --risk-flags user-facing,browser-visible` | 22 tasks; write-e2e and test-journeys after verify-promotion |
| T4 | `C --intent "fix stripe webhook double charge" --lane bugfix --delivery-profile mvp --change-type bugfix --planned-files src/payments/webhook.ts`, then with `--risk-flags auth` and `--risk-flags auth-sensitive` | `planning.irreversible_zones`, `conditional_mandatory_skills`, and audit-implementation's `required_process_steps` |
| T5 | `node scripts/route-model.mjs stats`; `node scripts/route-model.mjs check`; `node scripts/resolve-dispatch.mjs model --label EXEC --orchestrator claude` | n=0 on every arm; the two picks |
| T6 | `grep -n "cli must be" scripts/orch/dispatch.mjs`; call `workerCommand` with `cli` set to a fixture harness | the thrown error |
| T7 | `node scripts/harness-drift.mjs`; `node scripts/harness-playbook.mjs verify` | hosts covered; broken flags |
| T8 | `grep -rEo` over skills, agents, rules, hooks and scripts for `claude-(opus\|sonnet\|haiku\|fable)-…`, `gpt-…`, `grok-…`, `gemini-…`, `mimo-v…`, test files excluded | 170 strings, 61 files |
| T9 | `node scripts/expertise.mjs preload --agent svc-stage-exec`; `node scripts/expertise.mjs refresh-scan` (in a scratch copy: it writes `.svc/knowledge-refresh-triggers.jsonl`) | the exit message; 13 of 13 stale |
| T10 | `grep -n TRANSPORTS scripts/lib/harness-transports.mjs` | `{ claude }` |
| T11 | `readlink` on an installed skill link, then check out another branch in the main checkout and read the same skill file through the link | the installed content changes with the branch. The merge-driver crash: `git merge-tree --write-tree` of #127 and #129 without a run-scoped merge driver |
| T12 | `rangeOf({dist:"discrete", values:[100,1,10], weights:[0.2,0.4,0.4]})` from #129's `decision-engine.mjs` | p10 100, p50 1, p90 10 |

---

## 11. Revision 4: reconciliation of rev 3 with the verified review verdicts (this section overrides §0–§10 where they conflict)
Rev 3 (owner, f05c82f) is the base. Each item below was checked at `7b48cc4`. For each, the better-grounded version against the goal is kept: at least 2× on what solo misses, at near-solo cost and speed, robust, with no over-engineering.

**Factual corrections to rev 3:**
- **"Typo ≤ 4 stages" can't be met**, because the mandatory tail is 8 tasks (T2: production 15, prototype 9). It is replaced in §4, §5.2 and §7 #11 by: *no lane-upstream stages beyond the invariant tail*, counted after the §5.2 compiler change.
- **The injectors are already one process** (§5.4 step 2): `svc-rule-injector` already runs the learning and owner injectors in-process. Hooks run in parallel, so wall time ≈ the slowest handler (the dispatcher, 321 ms in `hook-bench` today). H3 folds the rule injector into the dispatcher, which saves one Node start and shares the git memo. The budget is lowered only when the measured wall drops.
- **§5.2 step 13 describes target behaviour as current.** Today `compile-delivery-graph.mjs:263` adds base44-environment on any `deploy-affecting` flag. The fix is Base44 detection.
- **Appendix B's T11 and T12 don't match §3.** The commands get relabelled, and an install-follows-the-branch command is added for §3 T11.
- **Internal contradictions:**
  - §5.4 treats explore-solutions as a "measured no-gain" skip, but it is **unmeasured**. It is off by default (`one_way_door`), labelled unmeasured.
  - §5.11's CLAUDE.md variant conflicts with "nothing appended to CLAUDE.md". The memory variants are a capped always-loaded block (≤2 KB) vs topic files (4 KB per topic, 16 KB in total). CLAUDE.md is never appended to.

**Where the verified verdicts override rev 3:**
1. **Typo cost.** It stays capped at ≤1.3× solo, **net of the measured fixed catalog overhead**. Reporting it uncapped would drop the near-solo-speed requirement for the most common task.
2. **`ARM_LIMITS`.** It stays a safety timeout (2× time, 3× turns). The bar judges the *measured* total USD and wall time. A hard cap that scores a stopped run 0 would truncate runs that would have succeeded, and score the framework below what it does.
3. **Opus gate.** P1.6 Opus confirmation (owner yes) gates **deletions, merges and any 2× claim**. Additive owner asks (cockpit, router, slots, founder formulas, governance records) may proceed after P1.4, each re-measured per batch.
4. **Always-on agents (§5.12).** The governance record, the needs-you approval item and COS as the sole card writer are adopted. The "one real connection per product" slice is **deferred** until the owner supplies documented APIs or an export sample. Both products are unverified here.
5. **No four-arm skill matrix** (§5.5, §5.3). A/B uses bare vs skill, with the skill's whole folder mounted. create-skill requires a coverage row plus a bare A/B.
6. **Failover** (§5.1, §5.10) is a fresh attempt under the same task, between supported CLIs only, with one quota-after-partial-write test. No full fault matrix.
7. **Served models.** Every model is recorded with its tokens. A run is rejected only when a non-arm model did **real work**, so the CLI's small background calls are tolerated.
8. **Adoption rule.** n ≥ 5 per arm and p < .05, else "inconclusive", confirmed on a held-out task. The n ≥ 3 bootstrap rule stays for the exploratory headline only.
9. **X1.** The contract is `"$SVC_ROOT"/scripts/…`, exported at SessionStart, which already works on the fresh-project run. The `svc-run` launcher is built only if the baseline shows path failures on hookless hosts.
10. **Founder context** is a **generated view** over the existing owner files, never a third source of truth.
11. **trace-check-deps.** It resolves relative paths and keeps paths to missing files. A check whose trace failed or came back empty is always selected.
12. **Review skip on small work.** The runtime proxy is no zone, a small diff and green tests. It never applies to auth, money, data or a failing check. It is measured before adoption.
13. **Kept from rev 3 over my earlier verdict:** a run with a non-zero fail-open counter is re-run once, then scored as is and flagged. Excluding it would flatter the framework.

**Moved to Program 0 / Track F** (live defects or exposures; tests first):
- #6 security-payments: every arm's prompt carries the deliverable contract (a test checks it names SECURITY.json).
- #9 skill-ab: n ≥ 3 per arm, otherwise `inconclusive`.
- #11 classify-change-risk: skill, rule, CLAUDE.md and spec-AC edits become `logic`; a README typo stays cosmetic.
- #12 craft-prompt: `--orchestrator-family` is required and passed from the host.
- The Codex review sandbox bypass (`harness-playbook.json:87,130`) is replaced by a read-only sandbox, or our bwrap read-only.
- The company briefing becomes the `dashboard --json` payload: no path, never cut mid-line.
- The over-engineering score strips negated clauses (it stays advisory).
- §5.12/governance: `plan_sha` in the transition record; never run PR code under `pull_request_target`; inventory the AC-digest producers and consumers before Gate C.

**Small adds from my verdicts:**
- review-gate is relabelled `partial` (4 vs 2 secondary findings), with model, date and n on coverage rows.
- Hermes is never offered by the router.
- The graph is recompiled after the harness pick.
- route-workflow's four-line announcement moves to the agent log.
- destructive-migration → review-security; native-release → verify-promotion live.
- Budget: P1.5 ≥ $18 and Program 2 batches ≥ $6 (the $0.50 floor). The preflight refuses a run below the floor.

**Owner side requests:**
- **Games repo.** After approval, once the owner creates an empty private repo `shipwithstef/hearthlight` (repo creation from this session is blocked by a GitHub 403):
  1. `add_repo`.
  2. Copy every kept game build into `rpg/<title>/` and `quest/<title>/`. These are the 9 ai-quest builds and every rpg-founder build under `~/.svc/outcome-eval-artifacts`, Hearthlight and Ardwyn included.
  3. Strip `__hidden.test.mjs`, eval notes, `node_modules` and any secrets.
  4. Give each a README: arm, model, date, hidden score, judge score. The rev 3 §0 privacy rule applies: no personal or company data.
  5. Commit as the owner's author, then push.
- **Plan file.** The plan doc in the repo is updated to this rev 4 in the same push as the first Program 0 commit.
