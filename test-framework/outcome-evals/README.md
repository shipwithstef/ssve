# Outcome evals

These evals test whether the svc method changes what a model actually delivers, not whether a skill was followed.

**Runner:** `scripts/outcome-eval.mjs`.

- `run` executes tasks with real models through the headless Claude Code CLI.
- `check` proves that each grader passes its reference solution and fails a planted bug: a constant stub for greenfield tasks, the unchanged repository for brownfield ones.

## Method

Each task has these files:

| File | Contents |
|---|---|
| `spec.md` | The specification the agent receives |
| `visible.test.mjs` | A few example tests the agent can see |
| `hidden.test.mjs` | The grader. The agent never sees it |
| `ref.mjs`, or `repo/` plus `ref/` | The reference solution. `repo/` is the starting codebase for brownfield and full-stack tasks; `ref/` overlays the reference change on it |

Every arm gets the same files and the same tools in a fresh directory, and the same model. Only the instruction differs:

| Arm | Instruction |
|---|---|
| `plain` | Implement the spec |
| `lean` | Implement the spec, run every test, and fix until green: a generator with an external verifier in the loop |
| `blueprint` | The written svc procedure: a rules list, one test per rule, implement, verify loop |

Each row records:
- the share of hidden tests passed and whether all passed;
- cost in USD, turns and wall time, from the CLI's JSON result;
- the prompt's hash, so runs stay comparable when a prompt changes.

A run that hits its turn limit is graded as it stands; it is a failure to count, not an error to hide.

### Grounding

The `lean` and `blueprint` arms implement the generate-then-verify pattern from:

- Kambhampati et al., *LLMs Can't Plan, But Can Help Planning in LLM-Modulo Frameworks* (ICML 2024): external verifiers in the loop.
- Shinn et al., *Reflexion* (NeurIPS 2023), and Chen et al., *Teaching Large Language Models to Self-Debug* (ICLR 2024): feedback-driven repair.
- Ridnik et al., *Code Generation with AlphaCodium: From Prompt Engineering to Flow Engineering* (2024): test-based iterative flows.

Those gains were measured on earlier models and harder benchmarks. This eval asks whether they still hold for the current small model on the kinds of work svc routes.

## Results (2026-10-10, Haiku 5.5, 3 reps per cell, 66 runs, 0 errors)

Each cell shows hidden-grader solves out of runs, then mean cost per run.

| Task | Kind | plain | lean | blueprint |
|---|---|---|---|---|
| duration, semver, csv, intervals, roman | single-module spec | 15/15, $0.0051 | — | 15/15, $0.0151 |
| jsonpatch (RFC 6902), cron next-run | harder single-module spec | 6/6, $0.0086 | 6/6, $0.0122 | 6/6, $0.0304 |
| ledger-holds | brownfield: change a codebase without breaking its tests | 3/3, $0.0117 | 3/3, $0.0145 | 3/3, $0.0335 |
| market-stall | full-stack: HTTP API plus browser UI, graded with Playwright | 3/3, $0.0191 | 3/3, $0.0177 | 3/3, $0.0764 |

Raw rows are in `results/*.json`.

### What this changes

1. **The written ceremony buys no correctness on spec-complete work.** RULES.md and one test per rule cost 3.3× more on matched tasks (2.36–4.19× per task) and solved nothing extra, across 33 blueprint runs. The framework therefore stops asking for it on such work; the gate is in `references/delivery-profiles.json` under `method`.
2. **The verifier loop is kept as the default execution method.** Lean costs 1.18× plain on matched tasks (0.93–1.56× per task). Its benefit does not show at this difficulty because plain already solves everything. It is kept because the cited work shows the benefit as tasks get harder relative to the model, and a run that skips its tests has no evidence to show.
3. **These tasks sit at the model's ceiling, so they cannot separate the arms.** They stay in the suite as a regression floor: a cheaper model or a new prompt must keep solving them.

The open question is where the framework adds value: underspecified product requests, multi-session work and long-horizon changes. That needs tasks that a plain run fails, graded on product quality as well as tests. That is the next suite, in `outcome-evals/tasks-next.md`.

## Running

```bash
node scripts/outcome-eval.mjs check                       # free, offline
node scripts/outcome-eval.mjs run --model haiku --reps 3 --out test-framework/outcome-evals/results/<date>-haiku.json
node scripts/outcome-eval.mjs run --arms plain,lean --tasks market-stall --model sonnet
```

Cost of the full Haiku suite: about $1.30 for 66 runs.
