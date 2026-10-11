# Task-shaped delivery graphs, and a fast loop for improving the framework

Status: proposed 2026-10-11. Plan first: everything below is simulated before it is wired, then adversarially reviewed.

## Part 1: each task gets the stages that fit it

### Problem, simulated on the current compiler
`compile-delivery-graph.mjs` starts from a fixed list per lane (`LANE_BASE_SKILLS`, 18 skills for greenfield), swaps the upstream design skills for a short pair when the profile is prototype or MVP (`BOUNDED_UPSTREAM`), and adds stages on risk flags. Nothing removes a stage that does not fit the task. Simulated on nine typical tasks (`scratchpad/sim-graphs.mjs`, deterministic):

| Task | Stages | What is wrong |
|---|---|---|
| Typo in README | 15 | UX, UI and tech design, spec, AC audit, journeys for a one-word fix |
| Backend rate limiter | 15 | UX design, UI design and user journeys with no UI |
| Add SAML SSO | 15 | no security review: the stage is added only for the flag `auth-sensitive`, while zones use `auth`, and a path under `src/auth/` adds a zone but no review |
| Todo CLI prototype | 9 | ends with `verify-promotion` (post-deploy verification) with nothing deployed |
| CSV export button | 16 | reasonable |
| New product, production | 22 | plausible; nothing checks that each stage fits |
| Bugfix, refactor | 9–10 | reasonable |

### Decision: connect what the framework already has
The framework already designed this (request ledger row 18): `references/stage-registry.json` classes every stage `essential`, `conditional` or `situational`; `scripts/stage-activation.mjs` evaluates each conditional stage's condition mechanically over the plan's scope (`--manifest`, before any code exists) or a diff; `references/delivery-profiles.json` says which conditional stages each profile keeps. Three things stop it from shaping the graph a session follows:
1. most conditional stages have no condition (`activation_condition: null`), including `security`, `design-ux`, `design-ui`, `journeys`, `e2e`, `test-run`, `live-proof`;
2. `compile-delivery-graph.mjs` builds the graph from its own `LANE_BASE_SKILLS` list, and `task-graph.mjs generate` from the registry's story-type templates: two more stage vocabularies that ignore activation;
3. nothing applies an activation result to the task graph; it is printed only.

A first attempt added a fourth vocabulary (`stage-conditions.json`); it was removed unmerged and recorded in `docs/removals.md`.

The fix, in the existing vocabulary only:
1. **Conditions** in `stage-activation.mjs` and the registry for the conditional stages that have none, as path and content patterns: UI stages from front-end paths, `security` from auth, payment, secret and migration paths (closing the SSO gap), `live-proof` from deploy targets, `compliance` from personal-data paths. Patterns match code and configuration, not documents about them.
2. **One graph source.** The compiler derives stages from the registry: essential stages always; conditional stages when `stage-activation` triggers them on the known scope and the profile keeps them; lane-specific entry stages (diagnose-bug, sync-spec-code, onboard-repo, plan-capabilities, improve-framework) from the lane. Everything left out goes to the existing `skipped_skills` ledger with its condition. With no scope yet, conditional stages stay in and are re-decided at plan time.
3. **Plan-time narrowing.** When plan-changeset has named the files, activation re-runs on the plan and the graph is updated through its existing `mutation_history`.
4. **Ledger row 18** is corrected from done to partial, with the live-run evidence.

The receipt chain (the registry's essential stages), refuse mode and full review depth for zones do not change. The scenario simulation below is the acceptance test, re-run against the wired compiler.

## Part 2: a fast, safe loop for improving the framework

### Why framework work has been slow
Game builds use the bounded method: small steps, cheap variants in parallel, a quick check after each step. Framework work today ran serially, ran the full 438-check suite (about 25 minutes locally, 7 in CI) after most changes, cancelled CI by pushing on top of runs, and started agents from a stale base.

### The loop
1. **Pick** the target with the least measured value: a skill marked `unmeasured` or `no-gain-measured` in `references/capability-coverage.json`, a stage whose condition the simulation questions, or a finding from an audit.
2. **Decide the mode.**
   - *Clear fix* (a broken command, dead code, a duplicate, a wrong claim): rewrite directly; the proof is a tier-1 check.
   - *Uncertain value* (does this skill or stage make results better than bare?): measure first.
3. **Measure** with a cheap eval in the hill-climbing style: a realistic task, a hidden check, the bare model as baseline, a few runs on Haiku. `skill-ab-eval.mjs` scores a variant against the current version.
4. **Vary** in parallel with `probe-loop.mjs`: rewrite, simplify, merge with a sibling, or remove.
5. **Adopt** only a measured win that keeps every guarantee; a removal gets its `docs/removals.md` entry.
6. **Check** only what the change can affect (`trace-check-deps.mjs select`), then the full suite once per batch and in CI. Wait for CI before the next push.
7. **Run several targets at once**, one worktree each with disjoint files, every worktree started from the branch head.

Target: under 15 minutes per improvement for a clear fix, under an hour for a measured one.

### First targets
- Part 1 of this document (stage conditions), measured by the simulation table and then by one live Haiku run per task kind.
- `improve-framework` and `evolve-framework`, which overlap: decide one owner of the loop.
- The 93 `unmeasured` skills: start with those on the hot path of the chain.
