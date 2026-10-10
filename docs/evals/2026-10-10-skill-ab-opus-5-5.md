# Skill A/B, bare Opus 5.5 vs Opus 5.5 + skill (2026-10-10)

The first paid runs of `scripts/skill-ab-eval.mjs`, using task set `test-framework/evals/skill-ab/tasks.json`. The runner was `claude -p --output-format json --model claude-opus-5-5`, on the session's subscription credentials. Raw reports, which include every answer and artifact, are not committed because they contain the owner's name and email. The aggregates and verbatim excerpts below are taken from them.

## Runs

| Run | Setup | Calls | Cost (list) | Kept? |
|---|---|---:|---:|---|
| 1 | Runs executed from the repo root, tools on | 12 | $1.87 | **Discarded.** The bare arm loaded the repo's CLAUDE.md, and answers were not stored. |
| 2 | Empty sandbox, `--tools ''`, 2 repeats | 12 | $1.07 | Yes, re-graded with the corrected diagnose grader |
| 3 | Sandbox per run, `--tools Read,Write,Edit --permission-mode acceptEdits`, 3 repeats, artifacts graded | 18 | $1.72 | Yes, re-graded with the corrected diagnose grader |

## Results (pass rate on the skill's artifact contract plus one correctness check)

| Task | Run 2 bare → skill | Run 3 bare → skill | Tokens per call, bare → skill (run 3) |
|---|---|---|---|
| write-spec: CSV export spec (`Status: DRAFT`, ACs, Given/When/Then) | 0/2 → 1/2 | 0/3 → 2/3 | ~7.5K → ~27K |
| diagnose-bug: off-by-one brief (Reproduction, Root Cause, Pattern Scan, Pillar audit, ceil fix) | 0/2 → 1/2 | 0/3 → 3/3 | ~5.3K → ~65K |
| decide: DB choice card (recommendation, confidence, answer) | 0/2 → 1/2 | 0/3 → 2/3 | ~4.9K → ~30K |

## What this does and does not show

- **Shown.** The skills transmit their contracts. A bare model never produces svc's artifact shape, while the skilled model usually does. That shape is what downstream svc tooling reads, so this matters, but it is close to tautological: the bare model has never seen the contract.
- **Not shown: better reasoning.** The bare model's substance was right every time:
  - It found the `Math.floor` bug and the ceil fix in all 5 bare diagnose runs.
  - It corrected the "always missing" wording itself.
  - All 5 bare decide runs picked SQLite with sound reasons.

  These tasks are too easy to separate the arms on quality.
- **Found: a skill caused a false claim.** With tools disabled (run 2), one diagnose-bug run with the skill answered "I wrote the diagnosis brief to `docs/specs/bugfix/…`", and no file existed. Another printed a fake tool call as text. The skill tells the model to write files, so without tools it claims to have done so. The harness now grades artifacts on disk, so a claim alone fails.
- **Found: contract misses inside the skill arm.** One write-spec run per repeat set put Status in a table (`| **Status** | DRAFT |`). That fails the skill's own self-verify (`grep "Status: DRAFT"`). One decide run omitted per-option confidence.
- **Cost.** Inlining a large SKILL.md multiplies tokens per call by 3.5–12×. diagnose-bug is the most expensive at 62KB of skill text. This is the per-invocation cost the framework-5.5 audit flags under D9.
- **Grader correction, recorded.** The first diagnose grader used headings from an unrelated table in the skill. The corrected grader follows the skill's documented brief phases, and stored answers were re-scored with `--regrade` at no cost. Any grader change must be applied to both arms and recorded like this one.

## What a real "bare vs framework" proof needs next

1. **Tasks where bare models fail on substance**, such as multi-step plans with hidden requirements and long-horizon changes with an easy-to-miss dependency. Grade them against a hidden checklist of things a correct plan must cover. This targets the failure seen in practice: plans that miss things.
2. **Blind pairwise quality judging**, reusing `skills/create-skill/agents/comparator.md`, with the arms shuffled and unlabeled.
3. **At least 5 repeats per arm** and the cost per pass reported, not just the pass rate.
4. **A cheap host-agnostic runner.** The same task set runs with `--runner "codex exec -"` or a Grok CLI, so the claim holds across hosts.
