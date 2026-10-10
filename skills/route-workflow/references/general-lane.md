# Lane 13: General Outcome

The lane for work whose deliverable is not a code change in this repo: business and product strategy, research, content, company operations, personal or financial decisions, creative work. It is also the fallback when no other lane fits, so "no lane fits" produces a flow, not only a `**Proposal:** New lane` line.

It is host-agnostic. Every step is either an existing skill, a plain `node` script, or a host-native dynamic workflow, so Claude Code, Codex and Grok run the same flow.

## Flow

Each step may be skipped with a one-line reason recorded in the session's decision log.

1. **Frame the outcome.** State what done looks like as 1–3 metrics, each with a target and a date: "20 paying users by 2026-12-01", not "grow the newsletter". If the owner gave no metric, propose one and ask once. Without a metric there is nothing to verify, and the lane becomes advice.
2. **Decide (when there is a real choice).** With two or more viable options, or one consequential parameter (price, budget, timing), run `strategic-decision`. It writes `MODEL.json` and calls `scripts/decision-engine.mjs`. Then act on the engine's verdict:
   - `ask-first`: ask exactly the engine's `next_question` and nothing else, then re-run with the answer.
   - `clear` or `decide-and-monitor`: proceed without asking.
   - `no-survivor`: report which HARD gates eliminated every option.

   Questions are asked because their answer is worth more than the threshold, never to fill a quota.
3. **Compose the steps.** Choose steps from existing skills by reading their descriptions. For example: `research` for facts, `analyze-competitors` and `find-opportunity` for markets, `grow-social` and `analyze-marketing` for content, `manage-finops` for costs, the company-fleet roles for operating passes. `node scripts/skill-router.mjs route --intent "<text>"` is a hint, not an authority. Any step no skill covers runs as a dynamic workflow on the host:
   - **Claude Code:** the Workflow tool or subagents. Read-only fan-outs follow `references/workflow-fanout-protocol.md`.
   - **Codex:** plan steps.
   - **Other hosts:** sequential inline steps.

   Every step names its input, its output artifact and its done-test.
4. **Execute.** Run the steps. Sending, posting, publishing, buying, signing, deploying or contacting people requires explicit owner confirmation each time, whatever the model's confidence.
5. **Verify.** Measure each outcome metric against its target. Record real values with `node scripts/decision-ledger.mjs observe --id <decision> --metric <n> --var <name>=<value>`. Then run `review --id <decision>`, which re-runs the stored model with what is now known. If the choice no longer holds or a revisit trigger fired, go back to step 2 with the observed values. When the step was an experiment (two posts, two landing variants, two outreach scripts), decide it from the counts with `node scripts/experiment-compare.mjs --variant A:<trials>:<successes> --variant B:<trials>:<successes>`, which says `ship` or how many more trials are needed, instead of eyeballing percentages.
6. **Learn.** `node scripts/decision-ledger.mjs calibration` shows which estimates run too narrow, too high or too low. Use it to widen or shift the next model's ranges. When the same composed flow repeats three or more times, propose a dedicated skill or lane through `evolve-framework`.

## Hand-offs

- If the decision is to build or change software, route to the matching code lane (greenfield, brownfield-feature, bugfix, …) with `DECISION.md` as input. Code is delivered only through those lanes and their mandatory chain.
- `scripts/compile-delivery-graph.mjs` refuses `--lane general` on purpose: this lane has no code delivery graph.

## Artifacts

- `docs/specs/decisions/<date>-<slug>/`: `MODEL.json`, `EV-MODEL.md` (engine output), `DECISION.md`.
- `.svc/decision-ledger.jsonl`: predictions and observations, append-only.
- Outcome metrics and their targets live in `DECISION.md` §Outcome metrics, so verification has one place to read.
