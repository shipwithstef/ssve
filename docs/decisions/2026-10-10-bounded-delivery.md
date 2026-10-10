# Plan: fast and reliable delivery — bounded plans that grow, cheap experiments against strong checks

## Context

The owner wants SSVE to deliver at the speed shown in two recent demos:
- **Egg drop (Anthropic, Opus 5.5 + 10 Haiku 5.5 subagents):** 86 designs tried in 58 s for $0.14, reaching the 32 m goal. Opus alone took 3:37 and $0.47 for 25 designs.
- **EcoBench sprint (Opus alone vs Opus + 10 Haiku, same 30 min):**
  - The swarm won 8.67 vs 8.17 by building more: 8 pages against 4.
  - It cost 14× the tokens, and on average only 5.2 of the 10 workers were busy.
  - It shipped dead QA files, and one worker wrote outside its folder.
  - Opus alone committed early and often (33 commits) and ran more test builds (18 vs 8).

The owner also asked for:
- "let the agent breathe";
- a plan that is **not** a full changeset but bounded, discovered and mutable through feedback;
- grounding in science (ML, chaos engineering, any language that helps);
- nothing generic or AI-sloppy;
- hooks, skills, CLAUDE.md, route-workflow and chaining revisited before any pilot;
- every request in the session checked.

**What exploration found:**
- **Planning is heavy and front-loaded.** A simple feature passes about 18–22 skills and 5 chain receipts. plan-changeset must write a complete sealed v5 contract (blueprints, AC digests, 15-environment table, six Two-Box roles, dry-run "simulation") before any code exists. Scope reduction words are banned.
  - `references/delivery-profiles.json` has prototype, MVP and production profiles, but route-workflow never reads it. The profile is chosen inside plan-changeset, after the chain is already fixed.
- **Discovery already has hooks:** amendment and reopen (`plan-changeset/SKILL.md:151,355`), `delivery_graph.mutation_history` (`apply-skill-outcome.mjs`), and the executor's discretion classes. They are built to reopen and re-review a sealed plan, not to grow it.
- **Reusable machinery:**
  - The fast oracle: `outcome-eval.mjs` `grade()` with `check()` proof, plus `compareSamples` and `promotionDecision`.
  - Test strength: `quality-probes.mjs` (mutation).
  - The bandit: `route-model.mjs` (Beta posterior, escalation ladder).
  - Ownership fence: `disjoint-scopes.mjs` and `partition-task-graph.mjs`.
  - Lane cap from the plan limit: `parallelism.mjs`.
  - Isolated calls on any harness: `harness-transports.mjs`.
- **Gaps:**
  - Nothing runs N mutating workers in parallel and picks a winner by an oracle. `population-compare.mjs` scores worker metadata, not outcomes.
  - There is no fault-injection or chaos code; only a Gherkin template exists.
  - `model-registry.json` still pins Opus 4.8, Sonnet 4.6 and Haiku 4.5.
- **Hooks:** about 300 ms per edit and 100 ms per shell call. One agent with 140 calls loses about 25 s; a swarm with 1,145 calls loses several minutes.
  - The Go client plus warm daemon (H3) is built, in scratchpad. It was blocked by the session classifier and needs a permission rule the owner adds; I cannot edit permission settings.
- **Requests:** 10 substantive asks are not in the ledger, and two ledger rows conflict with later instructions:
  - Row 35 says "full changeset depth"; the owner now says bounded and mutable.
  - Row 1 says "awaits approval"; the owner consented, and the real blocker is a permission rule.

## The formula

Reliable speed ≈ (checked experiments per minute) × (how often the check catches a real defect) × (how well the winner is picked) ÷ (coordination overhead).

| Term | What raises it | Grounding | What we measure |
|---|---|---|---|
| Experiments per minute | Small bounded tasks, cheap workers (Haiku 5.5) in parallel, a runnable skeleton early, small commits | FunSearch (Nature 2023) and AlphaEvolve (2025): an LLM proposes, an evaluator scores; tracer bullets and walking skeleton | Time to first runnable build; experiments per minute; commit cadence |
| Check quality | Executable checks written before the work: hidden-style tests, seeded simulations, property checks, fault injection | Chaos engineering principles (steady state, hypothesis, injected faults, small blast radius); property-based testing; mutation testing | Mutation score; chaos survival; graders proven by `check` |
| Selection | A strong lead or a statistic picks; effort shifts toward approaches that keep winning | Thompson sampling / Beta posterior (already `route-model.mjs`); bootstrap CI and permutation p (already `compareSamples`) | Regret against the best variant; promotion decisions |
| Overhead | Fast hooks; ceremony only at irreversible boundaries; disjoint ownership so workers never collide | Amdahl's law (the serial part caps the speed-up) | Hook ms per call; ceremony share of tokens; workers-busy share; merge conflicts |

Every change below raises one term without lowering another. Each is measured by the metric in its row.

## The new planning shape: a bounded plan that grows

This applies to the prototype and MVP profiles. Production keeps today's full chain, but only at irreversible boundaries (see Phase B).

**The plan is a one-page brief, not a changeset.** It has four parts:
1. **Done when.** The outcome and the executable checks that prove it. Steady-state checks are named for the chaos pass.
2. **Boundaries:**
   - which paths each worker owns, so the scopes are disjoint;
   - which interfaces are frozen, as a versioned contract file;
   - what is never touched;
   - which zones are irreversible (auth, money, data migrations, deploys, secrets). These zones switch on the full review chain.
3. **Open questions.** Each unknown has an experiment, the check that decides it, and a budget (time, tokens, number of variants).
4. **Decision log, append-only.** Each discovery adds: the decision, its evidence, its confidence, and what it changed. The plan grows here.
   - The contract changes only by a lead decision with a new version.
   - Two failed checks on the same question, or a boundary that must move, sends the plan back to the brief.

**The loop:**
1. **Skeleton.** The lead builds a walking skeleton, the contracts and the check harness. The first runnable commit is expected within minutes.
2. **Probe.** For each open question, N cheap variants run in parallel isolated sandboxes against its check. The lead picks the winner, and useful parts of the losers are kept in the decision log. This is the egg-drop engine.
3. **Fill.** Features fan out by disjoint ownership in small commits. The integration check runs on every merge.
4. **Harden.** A chaos pass (faults below) and a mutation probe on the tests.
5. **Gate.** Review and audit only where an irreversible zone was touched, and at release under the production profile.

## Phases (all before any pilot)

### Phase A — make the ledger complete and true (no model cost)
- Add rows for the 10 missing asks:
  - stage-level nudges and onboarding self-evals;
  - the UX bar from novice to expert;
  - cohesion and wiring (done: 3dc5e8c);
  - budget-aware paid upgrades;
  - alignment with session 016U3's outputs;
  - the RPG founder eval;
  - the skill alignment pass;
  - the delivery-speed target and the "no pilot until aligned" gate;
  - science, chaos and ML grounding in planning and grading;
  - the bounded, mutable plan;
  - expert terms first, with parallel teaching of the user from high level to deep (Phase B0).
- Revise row 35 (the bounded plan replaces "full changeset depth") and row 1 (consent given; a permission rule is the blocker).
- Mark which rows this plan closes and which stay open, with the reason.

### Phase B0 — learn the domain's words before the brief

This is the owner's addition. The most common failure is a person outside a field who cannot say precisely what they want, so the work goes back and forth for round after round.

- **First step of the bounded path, before the brief:**
  - The lead names **10 expert terms** for the thing being built. For each: one line on what it means, one line on how it changes what to ask for.
  - It then names **the one question to settle first** and what that answer decides. Chess example: who plays whom decides whether a server is needed at all.
  - Terms come from `analyze-domain` (domain profile and stack packs) and `references/knowledge/`, so they are grounded, not improvised.
  - The answer to the first question becomes the brief's first decision-log entry.
- **The user learns in parallel.** `teach-project` gains a domain mode that runs **alongside** the build in a separate session or page. It is not a new skill.
  - It teaches from a high level down to depth: the terms, then why each brief decision was made, then the code that implements it. The material comes from the brief, the decision log and the cockpit page.
  - It updates `~/.svc/builder-profile.md` as the user's knowledge grows.
  - The user can steer through the cockpit steering box at any depth. If they do not answer, the loop goes on with the stated default and records it as an assumption in the decision log.
- **Measured:**
  - A routing-style eval of ambiguous one-line requests (chess, booking, marketplace, game) with hidden intended specs.
  - Arms: a direct brief vs terms-first.
  - Metrics: rounds and tokens to reach a spec the hidden intent accepts.
  - Terms-first is kept only if it cuts rounds (promotion rule).

### Phase B — the bounded plan and the loop (reuse first)

**Scope decision:** prototype and MVP use the bounded plan; production and the framework repo keep the full chain. Production moves to the bounded plan only if the pilot shows no loss on the hidden checks, chaos survival and the founder claims (`promotionDecision`).
- **Routing.** `route-workflow` reads `delivery-profiles.json` at routing time, so the profile is known before the chain is chosen.
  - Prototype and MVP take the bounded path.
  - Production and the framework repo keep the mandatory chain. The chain policy and receipt envelope are not weakened.
- **Compiler and validator.** `compile-delivery-graph.mjs` gains mode `bounded`:
  - mandatory steps are brief → loop → verify-promotion;
  - review-exec and audit-implementation are added automatically when a diff touches an irreversible zone (the zone list lives in the brief and in `stage-activation.mjs` patterns);
  - `validate-delivery-graph.mjs` enforces that.
- **plan-changeset** gets a brief mode: the template, the decision-log format, and the contract-version rule. The full v5 contract mode stays for production.
  - Existing amendment and `mutation_history` plumbing records decision-log entries, so no parallel mechanism is added.
- **New `scripts/probe-loop.mjs`**, an oracle-scored generate-and-select:
  - **Input:** a question, a variant count, the worker model, the check command, a budget and the owned paths.
  - **Run:** workers go through `harness-transports.mjs` (Claude first; other harnesses via the same interface), each in its own temp copy or worktree. The scope is fenced by `disjoint-scopes.mjs`, and the lane count is capped by `parallelism.mjs maxParallel()`.
  - **Score:** each variant is scored with the task's check (`outcome-eval grade()` style).
  - **Output:** a ranking, the winner's diff, and the losers' notes. Selection uses `compareSamples` when there are repeats.
  - `population-compare.mjs` gains an oracle score field, so selection is by outcome, not metadata.
- **execute-changeset** in bounded mode:
  - commit after every passing check;
  - workers get only their owned paths and the contract;
  - a write outside the owned paths fails the variant;
  - generated QA or scratch files that nothing references are flagged before merge.

### Phase C — chaos and simulation as checks, in the loop and in grading
- **New `scripts/chaos-probe.mjs`** for Node web and real-time apps. It is generic and driven by the steady-state checks in the brief. Faults:
  - process kill and restart mid-session (state survives or degrades as stated);
  - added latency and jitter on the socket or HTTP path;
  - malformed, oversized and unknown messages;
  - floods;
  - the same paid or economic action sent concurrently (duplication races);
  - clock skew;
  - seeded bot swarms for N steps (generalising harbor-game's `play(seed, bot)`).
- **Grading.** Add to `quality-probes.mjs` and `quality-dimensions.json` (layers *gate* and *quality*):
  - chaos survival;
  - time to first runnable;
  - commit cadence;
  - workers-busy share;
  - ceremony share of tokens.
- **rpg-founder hidden checks** gain a concurrency economy race and a restart-survival check. Both are proven with `outcome-eval check` (the reference passes, ref-wrong fails).

### Phase D — speed of the harness itself
- **Hooks:**
  - Move H3 (Go `svc-hookc` plus warm `svc-hookd`, with the argv-hash allowlist) from the scratchpad into the repo (`hooks/native/`). Wire it only behind an install-time opt-in.
  - The owner adds the allow rule to `.claude/settings.json` and commits it. Until then it stays unwired and D6 applies: explore-time rule injection becomes opt-in.
  - Re-benchmark with `hook-bench.mjs`.
  - Either way, add a **worker hook profile**: `SVC_HOOK_PROFILE=minimal` for loop workers keeps only the safety guards (destructive git, secrets, outside-ownership writes). It drops orchestration hooks that do nothing inside a sandbox.
  - Measure: hook ms per call per profile.
- **Model registry:** refresh `references/model-registry.json` to the 5.5 family (Opus 5.5 lead, Haiku 5.5 workers, Sonnet 5.5 reviewers), with the agent `host_resolution` comments and the generated CLAUDE.md table to match.
- **Let the agent breathe:**
  - The skills on the loop path state the outcome, the check and the boundary, not step lists: route-workflow, plan-changeset (brief mode), execute-changeset (bounded mode), explore-solutions.
  - The 33 skills over 500 lines get progressive disclosure: the body keeps what the model needs to act, and detail moves to `references/`. `verify-skill-refactor.mjs` proves nothing was lost.
  - This is done in parallel on disjoint skill sets, with `framework-coherence.mjs` and tier-1 kept green.
- **CLAUDE.md:** stays at 200 lines or fewer, and states the bounded path in two lines.

### Phase E — the pilot (only after A–D are green)
- **rpg-founder arms, same brief, Opus 5.5 lead:**
  - bare Opus alone;
  - bare Opus + Haiku 5.5 swarm (native subagents);
  - SSVE bounded loop.
- One rep per arm first, under the $60 cap.
- **Measured:**
  - hidden checks and chaos survival;
  - the 30 founder claims (blind Opus judge);
  - time to first runnable, commits over time, workers-busy share, cost and tokens.
- Publish an anonymised results page.

## Critical files

**New**
- `scripts/probe-loop.mjs`
- `scripts/chaos-probe.mjs`
- `skills/plan-changeset/references/brief-template.md`
- tier-1 `validate-probe-loop.mjs`
- tier-1 `validate-chaos-probe.mjs`

**Edited**
- `skills/route-workflow/SKILL.md`
- `skills/plan-changeset/SKILL.md`
- `skills/execute-changeset/SKILL.md`
- `scripts/compile-delivery-graph.mjs`
- `scripts/validate-delivery-graph.mjs`
- `scripts/stage-activation.mjs` (irreversible-zone patterns)
- `scripts/population-compare.mjs`
- `scripts/quality-probes.mjs`
- `references/quality-dimensions.json`
- `references/model-registry.json`
- `references/delivery-profiles.json`
- `hooks/hooks.json`
- `scripts/wire-hooks.mjs` (worker profile)
- `docs/analysis/owner-requirements-2026-10-10.md`
- `CLAUDE.md`
- `test-framework/outcome-evals/tasks/rpg-founder/*`
- the 33 oversized skills (progressive disclosure)

**Reused**
- `outcome-eval.mjs` (`grade`, `check`, `compareSamples`, `promotionDecision`, `pool`)
- `route-model.mjs`
- `disjoint-scopes.mjs`, `partition-task-graph.mjs`, `parallelism.mjs`
- `harness-transports.mjs`
- `apply-skill-outcome.mjs` (`mutation_history`)
- `verify-skill-refactor.mjs`
- `hook-bench.mjs`, `measure-always-loaded.mjs`
- `framework-coherence.mjs`

## Verification
- `node scripts/framework-coherence.mjs` reports 0 findings.
- The tier-1 suite has no new failures against main (the 4 pre-existing ones stay listed). CI is green on PR #127.
- **probe-loop:**
  - a fake-worker tier-1 test proves the oracle picks the passing variant;
  - a write outside the owned paths fails its variant;
  - the lane count never exceeds `maxParallel()`.
- **chaos-probe:**
  - the harbor and rpg references survive;
  - planted fragile builds (lost state on restart, duplicated gold under a race) fail;
  - both are proven by `outcome-eval check`.
- **Compiler:** a bounded graph without review is valid. The same graph touching `auth/` or a payments path is invalid without review-exec and audit-implementation. Production graphs are unchanged; the existing validators pass.
- **Hooks:** `hook-bench.mjs` before and after, per profile. Safety-guard tests still pass under the worker profile.
- **Skills:** `verify-skill-refactor.mjs` passes for every slimmed skill; `measure-always-loaded.mjs` before and after.
- **Ledger:** every ask has a row, a status and evidence; rows 1 and 35 are corrected.

## Result: terms first (Phase B0), 2026-10-10

`scripts/ambiguity-eval.mjs` ran 6 ambiguous requests × 6 reps per arm (Haiku builder and owner, blind Sonnet judge):

| | Direct | Terms first, blocking |
|---|---|---|
| Hidden-intent claims met | 81% | 87% |
| Owner rounds | 1.0 | 1.7 |
| Cost | $0.013 | $0.016 |

- **Claims met:** +7 pts, CI [-2, 15], p = 0.15. Not established.
- **Owner rounds:** +0.72, p < 0.001.
- **Cost:** +22%.

**Decision:** terms first is never a blocking gate. The terms and the first question are written with the default being built on; the build proceeds at once. `teach-project` domain mode teaches alongside the build, and an answer that arrives later is an amendment in the decision log. This keeps the teaching at zero cost in owner rounds.

## Result: RPG founder pilot (Phase E), 2026-10-10

Setup:
- The same founder request ("an online fantasy RPG I can play solo and with friends… tell me everything I need to take it to launch").
- Opus 5.5 builder, one run per arm.
- Hidden checks: solo play, multiplayer, hostile clients, 4-player load, IP gate, founder docs.
- A blind Opus judge on 30 founder claims.
- Results: `test-framework/outcome-evals/results/2026-10-10-rpg-pilot.json`.

| Arm | Hidden checks | Judge (of 30) | Cost | Wall time | Turns | Mutation score | Source lines | Commits |
|---|---|---|---|---|---|---|---|---|
| Opus alone | 6/6 | 25 | $3.72 | 16 min | 84 | 0.47 | 1,076 | 0 |
| Opus + Haiku swarm | 5/6 (load p95 ~50 ms vs 25 ms) | 24 | $1.93 | 13 min | 32 | 0.33 | 2,312 | 0 |
| Bounded (this method) | 6/6 | 23 | $3.71 | 24 min | 25 | 0.27 | 716 | 9 (first at 4.7 min) |

Hidden-check verdicts are from the fixed grader, identical across three regrades. The pilot found two grader defects, both fixed and proven before regrading:
- **IP gate:** it flagged internal notes that name the inspiration in order to avoid it.
- **Movement check:** moves that cancel out failed a game that clearly moved, and world ticks alone could pass a dead game.

What the bounded arm did:
- Settled two real questions with `probe-loop`: live sync (long-poll) and durable persistence (group-commit snapshot).
- Its own chaos pass held through all 7 faults.
- Committed in small steps.
- Shipped the smallest codebase.

**Verdict: not established, and not better on this run.**
- One run per arm cannot separate the arms.
- The bounded arm tied Opus alone on hidden checks.
- It scored 2 judge points lower.
- It had the weakest tests by mutation score.
- It took the longest.

The method's process goals happened (early runnable commit, probed decisions, chaos pass). The quality goals did not show.

**Next:**
- Raise its test-strength step: the mutation probe must pass a floor, not just run.
- Run 3+ runs per arm before any claim.

The swarm was cheapest and fastest but the only arm to miss a hidden check (frame-time budget under four players).

## Result: RPG founder pilot, round 2 and both rounds combined, 2026-10-10

Round 2 used the same request, grader and judge, with two runs per arm. The bounded loop now had a mutation-score floor of 0.6. Results: `test-framework/outcome-evals/results/2026-10-10-rpg-pilot-r2.json`.

| Arm | Run | Hidden checks | Failed check | Judge (of 30) | Cost | Wall time | Source lines | Mutation score |
|---|---|---|---|---|---|---|---|---|
| Opus alone | 1 | 6/6 | — | 24 | $3.96 | 17 min | 1,182 | 0.27 |
| Opus alone | 2 | 4/6 | load (p95 33 ms), IP gate | 25 | $5.71 | 24 min | 1,753 | 0.40 |
| Swarm | 1 | 5/6 | IP gate | 27 | $1.81 | 16 min | 1,639 | own tests fail |
| Swarm | 2 | 5/6 | load (p95 50 ms) | 25 | $1.80 | 13 min | 2,249 | own tests fail |
| Bounded | 1 | 6/6 | — | 20 | $2.57 | 15 min | 549 | own tests fail |
| Bounded | 2 | 6/6 | — | 21 | $2.31 | 9 min | 540 | 0.87 |

The table counts the mutation score as missing when the build's own tests fail as shipped, because the probe cannot score them.

Both rounds combined, three runs per arm:

| Arm | Solved all hidden checks | Mean judge | Mean cost | Mean wall time | Mean source lines |
|---|---|---|---|---|---|
| Opus alone | 2/3 | 24.7 | $4.46 | 19.0 min | 1,337 |
| Swarm | 0/3 | 25.3 | $1.85 | 14.1 min | 2,067 |
| Bounded | 3/3 | 21.3 | $2.86 | 15.8 min | 602 |

Permutation tests use `compareSamples`, with three runs against three. The smallest two-sided p this design can reach is about 0.1.
- **Bounded vs Opus alone:**
  - judge −3.3 points, CI [−4.7, −1.7], p = 0.097;
  - cost −$1.60, CI [−2.81, −0.48], p = 0.097;
  - hidden-check score +0.11, CI [0, 0.33], p = 1.
- **Bounded vs swarm:**
  - hidden-check score +0.17, p = 0.097;
  - judge −4, CI [−6, −2], p = 0.097;
  - cost +$1.02, p = 0.097.

**Verdict: a consistent trade-off, not established at p < 0.05.**
- **Hidden checks:** bounded is the only arm that passed every one in every run (3/3).
- **Cost:** it cost about a third less than Opus alone.
- **Size:** it shipped less than half the code.
- **Judge:** it scored lowest on every run.

The judge rows show why the judge score is lower. In every bounded run the judge found the founder breadth items missing:
- hosting choice;
- art direction;
- name and voice;
- cooperation design;
- the delivery estimate.

The brief keeps the build to what its checks prove. Founder deliverables with no check get dropped. The trade-off is correctness and cost against breadth of founder material.

The mutation floor held in one of two bounded runs (0.87). In the other, the build shipped with one of its own tests failing. Three of the six builds in round 2 shipped failing tests of their own.

**Next:**
- Give the brief's "done when" a check for each founder deliverable the request names, so that breadth is held to a check and not dropped. Then re-measure the judge gap.
- Make "own tests pass" a gate before the harden step ends, not just an instruction.
- Production stays on the full changeset (the promotion rule needs no loss on the judge, and there is a loss).

## Result: RPG founder pilot, round 3 (revised bounded method), 2026-10-10

What changed after round 2:
- The brief gives every deliverable the request names its own done-when check, documents included.
- The build's own tests must pass before it stops.

Round 3 ran three revised bounded runs and two more runs of Opus alone. Results:
- `test-framework/outcome-evals/results/2026-10-10-rpg-pilot-r3-bounded.json`
- `test-framework/outcome-evals/results/2026-10-10-rpg-pilot-r3-solo.json`

| Arm | Runs | Solved all hidden checks | Judge (of 30) | Mean cost | Mean wall time | Mean source lines | Mutation score of own tests |
|---|---|---|---|---|---|---|---|
| Opus alone, rounds 1–3 | 5 | 4/5 | 25, 24, 25, 27, 25 (mean 25.2) | $4.30 | 19.0 min | 1,385 | 0.47, 0.27, 0.40; two runs shipped a failing test of their own |
| Bounded, before the revision | 3 | 3/3 | 23, 20, 21 (mean 21.3) | $2.86 | 15.8 min | 602 | 0.27, one run with failing own tests, 0.87 |
| Bounded, revised | 3 | 3/3 | 24, 23, 23 (mean 23.3) | $3.74 | 13.7 min | 719 | 0.93, 1.00, 0.80; own tests pass in every run |

Revised bounded against Opus alone (`compareSamples`, 3 runs against 5):
- judge −1.9 points, CI [−2.9, −0.9], p = 0.088;
- cost −$0.56, CI [−1.66, 0.55], p = 0.50;
- hidden-check score +0.07, p = 1.

Revised against earlier bounded runs: judge +2.0, CI [0.3, 3.3], p = 0.31.

**Verdict.**
- **What the revision fixed:**
  - The judge gap narrowed from 3.9 to 1.9 points.
  - The test-strength problem is gone: every revised run's own tests pass. Their mutation scores (0.80–1.00) are above every scored run of Opus alone (0.27–0.47).
  - The bounded method still solved every hidden check in every run, 6 of 6 across both versions.
  - It is the fastest arm on wall time.
- **What it did not fix:** it still trails Opus alone on the blind founder judge, by about 2 points of 30. That gap is not established at p < 0.05.
- **Cost:** it no longer differs from Opus alone in a way this sample can detect.

**Decision:** prototype and MVP keep the bounded method. Its measured advantages are correctness (hidden checks), test strength and speed.

Production stays on the full changeset, because the promotion rule needs no judge loss and there is still about a 2-point one. The next lever is the judge items every revised run still missed:
- the delivery estimate;
- name and voice;
- art direction;
- environments, feature flags and launch posts, which Opus alone also misses in nearly every run.

Pilot spend across the three rounds, builds plus judge: $57.49 of the $60 cap.
