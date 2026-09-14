# Quality Gates

## Pre-Validation Sanity Check

| Check | Pass Criteria |
|-------|--------------|
| Task hours < builder available hours | MVP fits in time budget |
| Single deployable artifact | Not dependent on external services beyond free tier |
| No entity/legal blockers | Can launch with Dodo/Gumroad/LemonSqueezy |

## Adversarial Review

| Risk | Question |
|------|----------|
| Moat risk | Can someone copy this in a weekend? |
| Demand risk | Are people already paying for similar things? |
| Builder risk | Does this repeat a past failure pattern? |
| Platform risk | Does Apple/Google policy threaten this model? |

## Anti-Pattern Cross-Check

- AP-5: Building without distribution plan
- AP-12: Competing on features vs. differentiation
- AP-18: Solving a problem the builder imagines, not one users have

## Pessimistic Sensitivity

Re-score top opportunity with:
- 25% of projected customers
- 2× build time
- 50% of projected price

If still viable, pass.

## Auto-Select Decision Matrix

Auto-select triggers ONLY when ALL met:
- Confidence gap > 20 points (top_score - second_score)
- Top score > 80
- Evidence Strength >= 7
- ALL quality gates pass

Overrides that BLOCK auto-select:
- Evidence strength < 7
- Any quality gate fails
- Platform stack mismatch
