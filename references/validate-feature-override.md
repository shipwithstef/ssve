# validate-feature Override Contract

The `validate-feature` gate (enforced by `test-framework/evals/tier-1/validate-feature-gate.sh` per WI-109) requires that any VERIFIED WI in a lane that normally requires business validation has EITHER run `validate-feature` OR logged a deliberate override.

## Lanes requiring validate-feature

- `greenfield` — new product features
- `brownfield-feature` — feature additions to existing product
- `brownfield-conversion` — product migrations

## Lanes exempt

- `framework` — self-improvement of svc itself
- `bugfix` — fixes without new business intent
- `refactor` — internal restructuring, no behavior change
- `drift` — syncing spec to existing code

## Override contract

When validate-feature is intentionally skipped, the orchestrator MUST append an entry to `.svc/pipeline-decisions.jsonl`:

```json
{
  "timestamp": "2026-MM-DDTHH:MM:SSZ",
  "run_id": "WI-NNN",
  "skill": "validate-feature",
  "decision": "skip-validate-feature",
  "decision_type": "taste",
  "reasoning": "non-empty explanation of why validate-feature is inappropriate for this WI"
}
```

All four fields are mandatory. A non-empty `reasoning` field is what separates a legitimate override from the bug pattern this gate exists to prevent (WI-077: skill skipped silently, wrong problem solved).

## When an override is appropriate

- **Framework self-bootstrapping.** The WI that BUILDS `validate-feature` itself cannot use it.
- **Trivial docs-only changes.** A typo fix or README wording update.
- **Emergency hotfix.** A prod-down regression where validate-feature ceremony costs more than the fix is worth. Must be followed by a retrospective.
- **Follow-on WI where the parent already ran validate-feature.** E.g., WI-094 → WI-104..108 decomposition; validate-feature ran at the parent level.

## When an override is abuse

- "validate-feature was slow, I skipped it." → Not acceptable. Fix the skill, don't skip the gate.
- "The feature seemed obvious." → Not acceptable. The gate exists because "obvious" features are exactly where wrong-problem-solving happens.
- "The user asked me to skip it." → Only acceptable if the user explicitly named `validate-feature` AND provided the rationale. A blanket "just do it" does not qualify.

## Grace period

For WIs closed before 2026-05-02 (7 days after WI-109 lands), the validator reports gaps as WARNINGS (exit 0). After the grace period, gaps become FAILURES (exit 1).

Migration path for legacy WIs:
1. Triage the WI against this doc.
2. If it should have run validate-feature → log a retro `skip-validate-feature` entry with `reasoning: "retro classification per WI-109 grace period: <judgment>"`.
3. If it fits an exempt lane → re-label the WI's Lane field and the validator will skip it.

## Related

- WI-077 — the original incident that motivated this rule.
- WI-095 — hard close-out gate (adjacent — verifies artifact consistency, not skill sequence).
- WI-099 T2-B — the deferred proposal that became WI-109.
- `rules/common/code-review.md` — severity taxonomy used for findings.
