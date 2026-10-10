# Pillar evals: does each svc stage beat the bare model?

The product-build eval (`README.md`) measures one thing: what a model builds from a request. svc is a chain of stages and checkpoints, and each one claims to add something. This file measures the stages one at a time. Each pillar is a scenario with a planted defect, or a hidden fact list, that a stage claims to catch.

## Method

**Arms.** Each pillar task (`tasks/<id>/task.json` with `pillar`) runs two arms with the same model, files and tools:

| Arm | Prompt |
|---|---|
| `bare` | The task's instruction only |
| `svc` | The same instruction plus the framework's own files for that stage, verbatim: the skill or agent prompt that ships |

The `svc` arm runs the real prompt, not a summary of it, so a result is a verdict on what ships.

**Grading.**
- Graders are hidden from the agent and must be checkable without a model.
- `outcome-eval.mjs check` proves each grader three ways: it passes the reference answer (`ref/`), fails the untouched repository, and fails a plausible wrong answer (`ref-wrong/`).
- Review graders also cap findings that match no planted defect, so listing everything does not win.

**Multi-session tasks.** These declare `steps`. Each step is a fresh session in the same directory, so only what an earlier session left on disk carries over.

**Statistics.** Same as `README.md`: a bootstrap 95% interval and a permutation p. A difference counts only when both agree.

**Changing a prompt.** A candidate prompt runs as `svc:<variant>` (`task.json` `variants`). It is adopted only through the promotion rule (`outcome-eval.mjs promote`), and the shipped prompt is re-measured after it is wired in.

## Matrix

Every pillar below was run on Haiku 5.5. Cells show solved runs out of runs, then mean cost per run. A run counts as solved only when every hidden test passes.

| Pillar (svc stage) | Task | What is planted or hidden | bare | svc | Verdict |
|---|---|---|---|---|---|
| Build from a full spec (execute-changeset) | 7 spec tasks | Hidden contract tests | 21/21 | (lean/blueprint) | Ceiling; the blueprint costs 3.3× for nothing (README) |
| Brownfield change safety | ledger-holds | The repo's own tests plus new behaviour | 3/3 | 3/3 | Ceiling |
| Full-stack with browser e2e | market-stall | Playwright journeys | 3/3 | 3/3 | Ceiling |
| Product from one sentence (spec + plan + build + verify) | yoga-studio | Blind 16-point production judge | 7.14/16 | **14.71/16** | **svc wins**, p = 0.0007 (README) |
| Underspecified game | vague-market | Blind 12-point judge | 11.0/12 | 11.3/12 | No difference |
| review-exec, small change | review-faults | 4 faults: off-by-one capacity, refund race, fail-open auth, path traversal | 3/3, $0.013 | 3/3, $0.015 | Ceiling |
| review-exec, multi-file change | review-faults-large | 4 cross-file faults among correct-looking code (decoys) | 5/5, $0.012 | 5/5, $0.019 | Ceiling |
| review-plan | plan-defects | Uncovered AC, missing file, bad step order, step without a verification, scope creep | 3/3, $0.008 | 3/3, $0.011 | Ceiling |
| review-security | security-payments | Client-set price, refund IDOR, unsigned webhook accepted, signing material logged | 3/3, $0.010 | 3/3, $0.014 | Ceiling |
| audit-implementation | audit-claims | A record claiming all ACs; 2 claims false, 1 test vacuous | 2/3, $0.009 | 3/3, $0.014 | Ceiling (the one bare miss was an ambiguous AC, since fixed) |
| bugfix (diagnose-bug) | bugfix-rootcause | Reported symptom in one feature; the shared cause breaks an unreported second one; DST | 3/3, $0.007 | 3/3, $0.020 | Ceiling: bare also fixed the root cause |
| drift (sync-spec-code) | drift-detect | 6 spec claims, 3 drifted | 2/3, $0.006 | 3/3, $0.008 | Ceiling (the bare miss never wrote its file) |
| **Multi-session continuity** | continuity-rules | Owner rules given only in session 1; session 2 builds on them | 10/20, $0.013 | 11/20, $0.016 before; **19/20, $0.017 after the fix** | **svc wins after a measured fix**, p = 0.002 vs bare; see below |
| Hook latency | hook-bench | Per-event budgets | base 648 ms | 335 ms | Gate passes (`references/hook-budgets.json`) |

## What the matrix says

1. **On single-checkpoint tasks of this size, Haiku 5.5 is already at the ceiling without the framework.** Every review, audit, bugfix and drift task above was solved bare. The shipped stage prompts cost 1.2–2.8× more there and bought nothing measurable. That does not show the stages are useless. It shows these scenarios are too small to separate the arms. The next step is harder scenarios, not claims.
2. **The framework wins where the model has to decide what "done" means** (yoga-studio).
3. **The framework wins only if state reaches the next session.** In continuity, bare and shipped svc both lost the owner's rules about half the time. The failure looked different in each arm:
   - Bare often wrote the rules to `CLAUDE.md`, which Claude Code loads into every session, and otherwise asked the owner in session 2.
   - Svc wrote them to `docs/` files that session 2 never opened, then sometimes shipped a guessed policy.

### Continuity: the fix, and a mistake made while testing it

- **The candidate:** a standing-rules rule. Record each owner rule in `CLAUDE.md` (mirrored in `AGENTS.md`), read it before acting, and never invent a missing money, security or legal rule.
- **The first measurement was invalid.** The candidate's example rule was the task's own refund policy, which leaked the answer: it scored 18/20 and is not evidence. Its results file is marked `invalid`.
- **The guard:** `task.json` `leak_terms`, checked in tier-1, now fails any framework text that contains a task's answer.
- **The real measurement:** the leak-free rule is wired into `_shared/before-starting.md`, which every skill reads, and the shipped arm is re-measured below.

The shipped arm after the change, run 20 times. All 20 rows carry one prompt hash. At the time, the runner computed it when each row was written rather than when the prompt was sent, and no prompt file changed during the run. Since this run the runner hashes the prompts it sends:

| Arm | Solved | Mean cost | vs shipped-before (95% CI, p) | vs bare (95% CI, p) |
|---|---|---|---|---|
| bare | 10/20 | $0.013 | n/a | n/a |
| svc before | 11/20 | $0.016 | n/a | +0.05 |
| **svc with standing rules** | **19/20** | **$0.017** | **+0.40 [0.15, 0.65], p = 0.008** | **+0.45 [0.20, 0.70], p = 0.002** |

The gain is established against both baselines at 8% more cost per run than the old svc prompt. In the one remaining failure, session 2 found no recorded rounding rule for half refunds and threw "not decided yet" instead of guessing. That is the rule's third clause working as written; the scenario's half-refund rounding really was unstated.

**What this changes:** owner rules now live in `CLAUDE.md` (and `AGENTS.md`), which the harness loads into every session, instead of in files a later session has to find. It is the first svc change that went through the whole loop: a pillar exposed the failure, a candidate was measured, the promotion rule accepted it, and the shipped prompt was re-measured after wiring.

## Next pillars (not yet built)

| Pillar | Scenario | Grader |
|---|---|---|
| route-workflow | 20 founder requests, each with a known right lane | Exact lane match |
| write-journeys | One-line request | Hidden list of required journeys (payment failure, refund, owner override) |
| onboard-repo | An unfamiliar 30-file repo | Hidden fact quiz answered by a fresh session from the onboarding output |
| land / verify-promotion | A "deployed" change where only local evidence exists | Must refuse to claim production proof |
| Full chain over sessions | plan → exec → review → audit, each a fresh session | Hidden tests plus planted plan and exec faults |
| Harder review | A 1,500-line change, faults in interactions | As review-faults |
| Larger model check | The ceiling pillars rerun with a weaker and a stronger model | As above |

## Running

```bash
node scripts/outcome-eval.mjs check
node scripts/outcome-eval.mjs run --model haiku --judge none --reps 5 --arms bare,svc --tasks review-faults,continuity-rules --out results/<file>.json
node scripts/outcome-eval.mjs run --arms svc:<variant> --tasks <task> ...   # a candidate prompt
node scripts/outcome-eval.mjs promote --candidate svc:<variant> --baseline svc results/<files>.json
```

Raw rows are in `results/2026-10-10-pillars-*.json`. The round-1 plan-defects rows predate a fix to the task: the plan had real defects that were not planted, so thorough reviews broke the noise cap. Only the round-2 rows are counted. security-payments was rerun (`-security-v2.json`) after the planted secret leak was changed to read injected config instead of the environment. GitHub code scanning flags intentionally vulnerable fixtures that read `process.env`, and this repository uses default setup, which has no path exclusions. Both versions scored 3/3 in both arms; the table shows v2.
