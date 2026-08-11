# Winner Selection Quality Gates

## Confidence Calculation

```
Confidence = top_score - second_score
```

**BUT FIRST — run the Quality Gates.** These prevent auto-selecting a bad
opportunity that happens to score well.

## Quality Gate 1: Pre-Validation Sanity Check

Break the MVP into actual tasks and estimate hours:

```markdown
**Task breakdown for [Opportunity Name] MVP:**
1. [Feature 1] — <N> hours
2. [Feature 2] — <N> hours
3. [Feature 3] — <N> hours
4. Setup/deploy — <N> hours
5. Testing/polish — <N> hours
**Total:** <N> hours
**Builder's available hours (2 weeks):** <hours/week * 2> hours
**Fits in 2 weeks?** <yes/no>
```

If total hours > available hours × 1.2 (20% buffer), **veto auto-select**.
The opportunity is too big. Downgrade score by 20 points.

## Quality Gate 2: Adversarial Review

Before declaring a winner, argue AGAINST it:

```markdown
**Adversarial review: Why Opportunity #1 might fail**
1. **Moat risk:** <Can a competitor copy this in 2 weeks? What's defensible?>
2. **Demand risk:** <What if the social proof was a fad? What if the niche is smaller than it looks?>
3. **Builder risk:** <What if the builder loses interest in 2 weeks? What if they can't debug this?>
4. **Platform risk:** <What if the platform changes pricing/terms? What if a dependency breaks?>
5. **Why #2 might actually be better:** <Specific scenario where #2 wins>
```

If the adversarial review finds a **fatal flaw** (moat risk = "none, easily
copied" OR demand risk = "single viral post, no sustained interest"), **veto
auto-select**. Present all 3 with the flaw noted.

## Quality Gate 3: Anti-Pattern Cross-Check

Read `references/anti-patterns.md`. Does the opportunity trigger any?

| Anti-Pattern | Check | If triggered |
|---|---|---|
| **AP-5: Building without validated demand** | Do we have evidence of PAYING customers, not just interest? | Veto auto-select |
| **AP-12: Competing on price with well-funded incumbents** | Is the angle "cheaper than X" where X has $10M+ funding? | Veto auto-select |
| **AP-18: Feature parity instead of differentiation** | Does this copy an incumbent's feature list? | Veto auto-select |
| **AP-20: Platform dependency risk** | Does the product die if one platform changes terms? | Flag as risk, require mitigation |

If ANY of AP-5, AP-12, or AP-18 triggers, auto-select is blocked.

## Quality Gate 4: Pessimistic Sensitivity Analysis

Run the numbers with pessimistic assumptions:

```markdown
**Optimistic scenario:** 100 customers × $10/mo = $1,000/mo (month 1)
**Pessimistic scenario:** 25 customers × $10/mo = $250/mo (month 1)
**Optimistic build time:** 10 days
**Pessimistic build time:** 20 days (2× estimate)
```

If the pessimistic scenario means:
- Revenue < $200/mo for 3+ months → **downgrade by 15 points**
- Build time > 3 weeks → **veto auto-select** (exceeds 2-week mandate)

Only auto-select if the opportunity survives pessimistic assumptions.

## Auto-Select Decision Matrix

| Confidence | Evidence Strength | Quality Gates | Action |
|---|---|---|---|
| **>20 pts** AND top >80 | >= 7 | All pass | **Auto-select.** "This is the clear winner. Shall I start building it?" |
| **>20 pts** AND top >80 | >= 7 | Any gate fails | Present with strong recommendation + noted risks |
| **10-20 pts** OR top 70-80 | >= 5 | — | Present with recommendation. User picks. |
| **<10 pts** OR all <70 | Any | — | Present as true choice. No auto-select. |

**Platform fit override:** If top opportunity has platform mismatch
(stack mismatch -5), add +5 to the second-place score for confidence
calculation. A neutral opportunity at 82 beats a mismatched one at 85.

**Evidence strength override:** Evidence strength < 7 blocks auto-select
regardless of score gap. High score + weak evidence = gambling, not investing.

If auto-select triggers but the user says "not that one," respect it
immediately and present the full 3-choice menu.
