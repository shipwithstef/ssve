# Decision engine: computed strategic decisions

`scripts/decision-engine.mjs` and `scripts/decision-ledger.mjs` turn `strategic-decision` from a prose trade study into a computed one. They also give Lane 13 (general outcome, `skills/route-workflow/references/general-lane.md`) its decision step.

## Why this exists

**History.** `strategic-decision` was written on 2026-04-21/22 (WI-123) from a real provider-selection problem. Its first dry run concluded "we did more work pre-skill than within the skill." Later work added phases, receipts (WI-290), a local-evidence scan (WI-313) and a v2 owner-decision adapter. None of that work added computation:

- **No arithmetic in code.** The skill asked for nine EV cells per option, break-even math and a sensitivity tornado, written by the model in prose. Self-verify only grepped for the text `P(complete) × LTV`.
- **The one in-repo run failed review.** That run (`docs/specs/decisions/exec-speed-gamechanger`, 2026-06-29) was rejected by its own adversarial reviewer at process fidelity 1/10, with all nine phases collapsed into one document.
- **No usage on record.** Neither `strategic-decision` nor `decide` has an entry in `.svc/pipeline-decisions.jsonl`.

**What a transformer constrains.** A language model is strong at structure: naming the options, finding the variables that matter, retrieving evidence, spotting a reframe, and writing the question in the owner's words. It is unreliable at what the old Phase 5 demanded:

- long chains of exact arithmetic;
- keeping probabilities consistent across dozens of cells;
- propagating correlated uncertainty, for example a conversion rate that drives both revenue and retention;
- knowing which unknown actually matters.

Those failures don't look like failures. The output reads well and the numbers are inconsistent. So the work is split:

| The model does | The engine computes |
|---|---|
| Options, including the escape hatch | Correlated Monte Carlo (Gaussian copula), seeded and reproducible |
| Variables with ranges and sources | HARD gates as probabilities: eliminate when P(violation) exceeds the tolerance |
| Correlations it can justify | EV distribution, P(best), expected regret per option |
| HARD gates and profiles | Value of information (EVPPI) per variable, i.e. which question is worth asking |
| The owner-facing wording | Break-even per variable, giving computed revisit triggers, and the winner per profile |

**Questions come from value of information.** No rule says "ask one question" or "ask five". The engine asks a question only when an answer could change the decision by more than the threshold (default 1% of the stake). It also says so plainly when nothing left is worth asking (`clear`). That is how "ask the right question, then answer so the outcome is obvious" becomes computation instead of judgement.

**It learns from outcomes.** People's 80% ranges are usually too narrow. The ledger records every prediction, takes real observations, re-runs the stored model with observed values pinned (was the choice still right?), and reports per-variable calibration and the direction of misses. That record is the domain expertise this repo can accumulate: priors corrected by its own outcomes.

## Use

```bash
node scripts/decision-engine.mjs validate MODEL.json
node scripts/decision-engine.mjs evaluate MODEL.json              # markdown: verdict, options, VOI, profiles, triggers
node scripts/decision-engine.mjs evaluate MODEL.json --json       # machine result (svc-decision-result/1)
node scripts/decision-ledger.mjs record  --model MODEL.json --id <slug>
node scripts/decision-ledger.mjs observe --id <slug> --metric 1500 --var ads_cpc=0.7
node scripts/decision-ledger.mjs review  --id <slug>               # hindsight with observed values pinned
node scripts/decision-ledger.mjs calibration                       # are our ranges honest?
node scripts/experiment-compare.mjs --variant theirs:40:3 --variant mine:38:1   # decide an A/B from counts
```

`experiment-compare` is the measurement half of an experiment: Bayesian beta-binomial, P(best), expected loss of shipping each variant, and a `ship` / `keep-running` verdict with the extra trials needed. Use it for social-post experiments, landing or component variants, and outreach scripts.

Worked example: `examples/decisions/launch-channel.model.json`, a non-coding decision (which acquisition channel to fund) with correlated conversion rates, a budget gate, an escape-hatch option and three constraint profiles.

## Model format (`schemas/decision-model.schema.json`)

- **`variables`**
  - Supported distributions: `const`, `uniform` (low/high), `triangular` (low/mode/high), `normal` (mean/sd), `lognormal` (p10/p90, the form people can actually estimate), and `discrete` (values/weights, for scenarios).
  - Give every uncertain variable a `source`. Give it a `question` if it is worth asking, or set `askable: false` when nobody can know it before deciding.
- **`derived`**: named intermediate expressions, evaluated in order.
- **`options[].value`**: the objective expression for that option, with optional per-option `params`. Expressions support `+ - * / % ^`, comparisons, `&& || !`, `?:`, `min max abs sqrt log exp floor ceil round clamp if`. They are compiled, never `eval`'d.
- **`gates`**: global or per option. `expr` must hold; `tolerance` is the allowed probability that it does not hold.
- **`correlations`**: rank dependence via a Gaussian copula. An inconsistent set (not positive definite) is rejected.
- **`profiles`**: variable overrides. Each profile is evaluated, and the output says where the winner flips.

## Verdicts

| verdict | rule |
|---|---|
| `ask-first` | some askable variable's EVPPI exceeds the threshold; the output names it as `next_question` |
| `clear` | total EVPI ≤ threshold: perfect information on everything would not be worth asking for |
| `decide-and-monitor` | EVPI > threshold but no single question pays; break-evens become revisit triggers |
| `no-survivor` | every option fails a HARD gate beyond its tolerance |
