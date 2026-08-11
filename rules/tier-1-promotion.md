# Rule: Tier-1 Validator Promotion Discipline

Tier-1 is the framework hot path. A new always-on validator must earn that slot;
otherwise it belongs in tier-2, tier-3, a targeted script, or a proposal until
the failure class proves common or severe enough.

## Promotion Signals

A validator may be added to `test-framework/evals/tier-1/` only when at least
one condition is true:

1. The same failure class was observed at least two times in the past 60 days,
   with evidence in WIs, session logs, closeout reviews, or
   `references/framework-learnings.jsonl`.
2. The failure class is already documented in `references/anti-patterns.md` or
   another active rule with correction severity.
3. The validator protects a framework hot path listed in
   `rules/plan-changeset-trigger.md`, and a regression would block install,
   routing, hook execution, skill contract parsing, or promotion verification.

## Required Promotion Note

Any WI, spec, plan, or PR that adds a tier-1 validator must name:

- `validator_path`
- `failure_class`
- `promotion_signal`
- `expected_runtime_budget`
- `why_tier_2_or_targeted_is_insufficient`

If this note is missing, review-gate should block the validator addition until
the author either supplies the note or moves the check out of tier-1.

## Runtime Budget

Tier-1 validators should stay hermetic and fast:

- no network calls
- no LLM calls
- no provider credentials
- no browser/device launch unless the validator is explicitly scoped as a fast
  smoke check and has a bounded timeout
- expected runtime under 5 seconds unless the PR explains why the hot-path cost
  is justified

## Demotion

If a tier-1 validator repeatedly times out, duplicates another validator, or
only guards a one-off product incident, demote it to a targeted validator or
tier-2 scenario and keep a narrow smoke check only when needed for registry
integrity.
