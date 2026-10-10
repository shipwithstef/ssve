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

### Underspecified request (vague-market, 2026-10-10)

The founder-style request was "a market-stall game whose economy can't break", with no API or UI contract. Haiku 5.5 built it. Grading had two parts:
- A generic smoke check: the server starts, the page loads, and every button is clicked in Chromium with no page errors.
- A blind Sonnet 5.5 judge with a 12-point rubric: loop, economy (including a money-pump probe), server authority, architecture, tests and UX.

Judge reliability: three judgings of the same artifact gave identical scores (2/12; it found a real interest exploit in the reference).

| Arm | Smoke | Mean judge score | Mean cost |
|---|---|---|---|
| plain | 2/3 | 10.67 / 12 | $0.104 |
| lean | 2/3 | 11.67 / 12 | $0.110 |
| brief (plan first) | 3/3 | 10.67 / 12 | $0.225 |

No build had a money pump. Lean scored highest at plain cost; the brief arm was the only one to pass every browser check, at twice the cost. With 3 runs per arm these differences are not significant; the next step is more repeats.

**Grader correction:** Node reports a test cancelled by its timeout as `cancelled`, not `fail`. Two runs (plain#0, lean#2) were first scored as passing for that reason. `parseTap` now counts cancellations as failures, and those rows are corrected in the results file with a `regraded` note.

### One-sentence product request (yoga-studio, 2026-10-10)

The request was "a paid booking web app for a small yoga studio: customers book and pay for classes online, and the owner manages the schedule", plus environment facts only (no network, no npm, `node server.mjs`). Haiku 5.5 built it. Grading had two parts:
- The browser smoke check.
- A blind Opus 5.5 judge with a 16-point production checklist: spec depth, journeys verified end to end, payments, auth and security, data integrity, architecture, sellable UX and ops readiness. It also counts the journeys that are both specified and covered by a passing test.

| Arm | Smoke | Mean judge score | Verified journeys | Mean cost |
|---|---|---|---|---|
| plain | 2/3 | 6.0 / 16 | 0, 0, 0 | $0.066 |
| production (svc method in one instruction) | 0/3 | **14.67 / 16** | 15, 21, 12 | $0.70 |

**This is the first measured case where the framework's method changes the outcome.** The production arm wrote a spec with roles and 12–21 journeys, then verified each journey with tests. It also delivered:
- signed, de-duplicated payment webhooks with idempotent refunds;
- hashed passwords with httpOnly sessions;
- overbooking protection;
- a README and a health endpoint.

None of the plain builds had a spec. One plain build had a real money pump: five concurrent cancels of a paid booking issued five refunds. The extra cost is about $0.63 per product build.

The production arm still failed the browser smoke check in every run, and the judge noted its UIs were "never run in a real browser". The method is fixed accordingly: verification now drives the main journeys in a real browser with zero console errors. Both arms now get the same environment fact, that a test browser is available. The rerun is recorded below as v2.

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
