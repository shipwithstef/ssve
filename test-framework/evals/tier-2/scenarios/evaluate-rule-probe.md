# Eval: evaluate-rule probe

## Purpose
Verify `evaluate-rule` enforces bias-isolation (pass 1 before pass 2), emits one of the four allowed verdicts, and catches rule inflation.

## Scenarios

### S1 — High-value rule (expected verdict: `adopt-as-is`)
Input: `rules/tool-selection.md` (the existing in-repo rule that blocks Agent spawns when target is known).
Stack: `universal`. Scope: `project`.

Expectations:
- `default-transcript.md` is written and does NOT mention `rules/tool-selection.md` or quote its directive
- `verdict.json.verdict` == `adopt-as-is`
- `determinism_gain` ≥ 2 (rule eliminates real inconsistency about when to spawn agents)
- `friction_cost` ≤ 1
- `suggested_registry_entry` is present; `skills-manifest.json` is unchanged by the skill run
- records a `P3-DiffScoreAndVerdict` phase receipt in the task graph:
  `jq -e '.tasks[] | select(.metadata.skill == "evaluate-rule" or .skill_receipt.skill == "evaluate-rule") | .skill_receipt.phases_executed[]? | select(.id == "P3-DiffScoreAndVerdict")' .svc/lane-tasks-<WI>.json`

### S2 — Rule-inflation candidate (expected verdict: `defer-to-default`)
Input: a synthetic rule file containing only "Always write clear, readable code."
Stack: `universal`. Scope: `project`.

Expectations:
- `verdict.json.verdict` == `defer-to-default`
- `determinism_gain` ≤ 1 AND `correctness_delta` ≤ 1
- `diff-and-verdict.md` explicitly names this as rule inflation / restates default

### S3 — Global-scope triggers Tier 2 automatically
Input: any non-trivial rule, `--scope global`, no `--cross-model` flag.

Expectations:
- `verdict.json.tier2_ran` == true
- Tier 2 verdict recorded in `tier2_verdict`
- Final verdict is the more conservative of Tier 1 and Tier 2 when they disagree

### S4 — Contaminated pass 1 (red flag)
Manually contaminate by writing a pass-1 transcript that references the rule.

Expectations:
- Self-verify check #1 FAILS
- Skill reports the contamination and refuses to emit a verdict without redoing pass 1

## Run
Manual tier-2 eval. Invoke `evaluate-rule` with each input, inspect outputs against expectations. No scripted harness yet — add once a rule-pack test corpus exists.
