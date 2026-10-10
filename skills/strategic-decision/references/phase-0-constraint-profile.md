### 0a. Elicit constraints

Present the 4 canonical profiles from `_shared/constraint-profiles.md` + let caller pick
one with optional overrides. DO NOT silently default.

Format the elicitation like this:

> "This decision's answer depends on your constraint profile. Pick one:
>
> 1. **Bootstrapper** — $0 budget, conservative, solo, growth=Base
> 2. **Self-financed** — $X pre-profit (you specify X), moderate, solo/small, growth=Base-Aggressive
> 3. **Funded startup** — $Y/mo burn covered, aggressive, small team, growth=Aggressive
> 4. **Enterprise** — budget-allocated, compliance-heavy, full team
>
> Or: tell me you want **comparison mode** and I'll run the analysis across 3 profiles
> to show where the winner flips."

### 0b. Comparison mode (optional)

If caller picks comparison mode, run Phases 1-7 three times (Bootstrapper / Self-financed /
Funded by default) and produce MULTI-PROFILE-DELTA.md showing:

| Profile | Winner | Runner-up | Key reason |
|---|---|---|---|
| Bootstrapper | X | Y | Free tier covers us |
| Self-financed | Z | X | $X budget lets us pay for quality |
| Funded | W | Z | Quality differentiator matters at scale |

Caller picks their profile based on the delta.

### 0c. Write CONSTRAINT-PROFILE.md

Stating the profile explicitly:

```markdown
# Constraint Profile — <decision slug>

**Profile:** Bootstrapper
**Overrides:** (none, or list e.g. "growth_scenario: Aggressive")

## Declared thresholds
- Acceptable monthly bill: $100 max
- Runway: indefinite but cash-zero
- Reversibility tolerance: weeks (1 migration ok)

## Validity
This decision is valid ONLY for this profile. A different profile may flip the recommendation —
see MULTI-PROFILE-DELTA.md if comparison mode was run.
```
