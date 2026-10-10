# Model intel: sources and refresh

`scripts/route-model.mjs` picks a model and effort from two files here:

- `models.json`: facts per model (ID, price, context, effort levels, cache behaviour).
- `priors.json`: per task type, a 3-rung ladder and a starting success estimate per rung.

Recorded outcomes (`.svc/model-outcomes.jsonl` in the repo, `~/.svc/model-outcomes.jsonl` across repos) update the estimates automatically. This file says where the starting numbers come from and how to refresh them.

## What counts as evidence, strongest first

1. **Our own outcomes.** Pass or fail from a deterministic check: tests, validators, `check-chain-receipts`, review verdicts, CI. Recorded with `route-model record`. Once an arm has `min_samples` outcomes it outweighs everything below. This is the only evidence about *our* tasks.
2. **Official model documentation.** Model IDs, prices, context, effort levels and defaults, and cache behaviour. These are facts, not opinions, and the first thing to update on a release:
   - https://platform.claude.com/docs/en/about-claude/models/overview
   - https://code.claude.com/docs/en/model-config (effort guide per level)
   - https://code.claude.com/docs/en/prompt-caching (which changes keep the cache)
   - Each release's prompting guide (for example "Calibrate effort" for Opus 5.5)
3. **Contamination-resistant and independent benchmarks.** Prefer ones that use fresh tasks or run their own evaluation:
   - SWE-rebench (fresh GitHub issues after each model's cutoff)
   - Artificial Analysis and Vals AI (independent runs, cost and latency)
   - Epoch AI and METR (independent capability and time-horizon studies)
   - Terminal-Bench and the Aider leaderboards (agentic and edit-format coding)
   - LMArena (preference; a weak signal for coding)
   - NVIDIA NeMo Evaluator (open source, 100+ benchmarks) for running a benchmark yourself against an OpenAI-compatible endpoint
   Treat a vendor quoting only one saturated benchmark as a yellow flag.
4. **Practitioner reviews.** Useful for what benchmarks miss (taste, instruction following, long-session drift). Starting list, to verify as still active before use: Simon Willison (simonwillison.net), Ethan Mollick (oneusefulthing.org), Nathan Lambert (interconnects.ai), Zvi Mowshowitz (thezvi.substack.com), swyx and Alessio (latent.space), Paul Gauthier (aider.chat), Hamel Husain (hamel.dev), Eugene Yan (eugeneyan.com), Dan Shipper and the Every team (every.to "vibe checks"), Andrej Karpathy, Jeremy Howard, Riley Goodside, Theo Browne. Collect at least 20 posts per release across at least 8 people before a review changes a prior.

## How a source earns weight

A source's opinion only moves a prior in proportion to how well its past claims predicted our own outcomes:

1. Log each claim as a signal row in `references/model-intel/signals.jsonl` (create it on first use): `{date, source, kind: official|benchmark|reviewer, model, task_type, claim: better|worse|same, vs_model, url}`.
2. When our outcomes for that `task_type` and model pair reach `min_samples`, mark each earlier claim as confirmed or contradicted.
3. Weight = confirmed / (confirmed + contradicted), with a floor of 0.2 for sources not yet checked. Sources that keep contradicting our data fade out on their own.

## Refresh cadence

- **On every model release:** update `models.json` facts from the official docs, add the new model's rungs where the evidence supports it, and run `node scripts/route-model.mjs check`. `check` fails when `models.json` is older than `max_age_days`.
- **Weekly (scheduled routine):** collect new benchmark results and reviewer posts into `signals.jsonl` with URLs. No prior changes without cited signals.
- **Monthly:** compare priors with `route-model stats`. Where outcomes contradict a prior, change the prior in a reviewed PR that cites the outcome counts.

Every change to `models.json` or `priors.json` goes through review like code, by a reviewer from a different model family where the repo's review policy requires one. The data is plain JSON with sources so anyone can audit why the router picks what it picks.
