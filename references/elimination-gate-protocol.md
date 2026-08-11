# Elimination Gate Protocol

Shared framework pattern: **apply HARD constraints as gates BEFORE scoring** to eliminate
options cheaply and reduce downstream analysis burden.

Used by `strategic-decision` Phase 3, `explore-solutions` Phase 3, `validate-feature` K1-K7
kill signals. Any skill that evaluates N ≥ 3 options should use this pattern.

## Core principle

Scoring all N options on all K dimensions is O(N×K). Elimination-first cuts N before
scoring — typically reducing scoring work to O(survivors × K). Survivors are usually 20-40%
of N, so the elimination phase saves ~60-80% of total analysis cost.

**More importantly:** eliminating for the WRONG reasons (vague concerns, gut feels, "too
new") produces systematically bad decisions. This protocol forces eliminations to be
evidence-cited against HARD constraints declared upfront.

## HARD vs SOFT constraints

Distinction is precise:

| Class | Definition | Example |
|---|---|---|
| **HARD** | Failing this constraint makes the option structurally non-viable, regardless of how it scores elsewhere | TOS prohibits storage → option cannot meet our data-retention requirement |
| **SOFT** | Failing this constraint makes the option less attractive but doesn't disqualify it; contributes to final score | Provider is 30% more expensive than the cheapest → penalty, not disqualification |

A HARD constraint is an **eliminator**. A SOFT constraint is a **scorer**. Do not mix them.

Guideline for classifying:
- If you can't describe a scenario where the option is acceptable despite failing the constraint → HARD
- If the option might still be best despite failing the constraint (because it wins on other dimensions) → SOFT

## Standard gate families

These recur across decision types. Not all apply to every decision, but most decisions use ≥3:

### Legal / TOS gates
- Can we store required data under this option's terms? (HARD if our data retention is a
  product requirement)
- Does this expose us to compliance risk (SOC2, HIPAA, PCI, GDPR)? (HARD if our domain
  requires compliance)
- Attribution or licensing constraints we can't honor?

### Budget gates
- Cost at BASE scenario exceeds constraint profile's acceptable-loss threshold? (HARD)
- Free tier exhausted at MAU threshold reachable in 12 months? (HARD for Bootstrapper;
  SOFT for Funded)

### Coverage gates
- Does the option serve our target regions / markets / personas? (HARD if any critical
  population is unserved)
- Does it support the languages / locales / device classes we require? (HARD)

### Effort gates
- Migration cost exceeds the option's lifetime value at projected scale? (HARD — negative ROI)
- Requires ongoing team attention we don't have? (HARD if solo-profile)

### Role gates
- Requires a dedicated operator / security team / compliance officer? (HARD if solo / small team)
- Requires capabilities we don't have and can't easily acquire? (HARD)

### Reversibility gates
- Lock-in exceeds the constraint profile's tolerance? (HARD; tolerance depends on profile)
- No exit path if provider changes pricing or policy? (HARD for high-risk decisions)

### Constitutional gates
- Violates product vision principles? (HARD)
- Violates domain-profile conventions in ways that create user friction? (HARD)

## Gate application mechanics

### Step 1 — Classify dimensions

At the start of elimination, list every dimension. For each, classify:

```
Dimension: Budget at Y2 Base scale
Classification: HARD
Threshold: ≤ $100/mo (from CONSTRAINT-PROFILE.md — Bootstrapper)
Elimination criterion: option's Y2 Base monthly cost > $100
```

### Step 2 — Apply gates in cost order (cheap checks first)

Gate in order from cheapest-to-evaluate to most-expensive. Short-circuit on first failure:

1. TOS / legal (single-look check per option)
2. Budget (single math operation per option)
3. Coverage (may require cited data)
4. Effort (requires some analysis)
5. Reversibility (requires understanding lock-in)

An option failing gate 1 doesn't need to be checked against gates 2-5. Log the elimination
and move on.

### Step 3 — Log each elimination with evidence

Use the canonical format:

```
ELIMINATED — <option> — <gate> — <evidence>
```

Example:
```
ELIMINATED — Foursquare Places — Budget — $15/1k after 500/mo free tier
  means $450/mo at 30k calls/mo Y2 Base, exceeds $100/mo threshold
  declared in CONSTRAINT-PROFILE.md
```

**No bare eliminations.** "Foursquare — too expensive" without a cited threshold is not a
valid elimination. The reviewer WILL flag this as a process violation.

### Step 4 — Output survivors + eliminated appendix

```markdown
# SURVIVORS.md

Options that cleared all HARD gates under constraint profile <profile>:

| Option | Gates cleared | Notes |
|---|---|---|
| Google Places | Legal✓ Budget✓ Coverage✓ Effort✓ Reversibility✓ | — |
| HERE Places | Legal✓ Budget✓ Coverage⚠ Effort✓ Reversibility✓ | Warning on emerging-markets coverage |
| Groq+Brave | Legal✓ Budget✓ Coverage✓ Effort✓ Reversibility✓ | — |

## Eliminated

- **Foursquare Places** — ELIMINATED — Budget — $450/mo at Y2 Base exceeds $100 cap
- **Apple MapKit** — ELIMINATED — Legal — TOS prohibits permanent storage, required by product
- **Yandex Places** — ELIMINATED — Coverage — no meaningful non-Russia POI density
```

## Anti-patterns

- **Soft eliminations masquerading as hard.** "This is too expensive" without a threshold
  from CONSTRAINT-PROFILE.md → invalid. Should be a scorer, not an eliminator.
- **Eliminating by popularity.** "Nobody uses this" is not a HARD gate. If the option meets
  the product's real constraints, popularity is scorer-class at most.
- **Eliminating before declaring constraint profile.** Gates depend on profile. Do Phase 0
  before Phase 3.
- **Skipping eliminated-appendix.** The appendix is evidence of work AND surfaces
  assumptions the reviewer can challenge. Skipping it invites re-litigation.
- **Gate stacking without priority.** If 4 gates fire on one option, log the first one that
  killed it, not all 4 — false sense of evidence.

## Protocol for SOFT constraints

SOFT constraints are NOT applied here. They go to the scoring phase (12-section
questionnaire per survivor, EV model across survivors). Keep hard and soft separate — mixing
them causes scoring drift.

## When to revisit gates

If the elimination phase produces:
- **> 80% of options eliminated:** gates are too tight. Re-examine. Maybe one gate is
  actually a SOFT constraint, not HARD.
- **< 20% of options eliminated:** gates are too loose. Either the decision IS unusually
  constrained (rare), or the constraint profile is too permissive.
- **1 or 0 survivors:** the decision is pre-decided; no analysis needed. Likely the
  question is not actually a multi-option decision, or one gate is so strict it's the whole
  decision.

Target: 3-8 survivors for subsequent scoring.

## See also

- `_shared/constraint-profiles.md` — canonical profiles that drive gate thresholds
- `_shared/product-question-format.md` — 12-section format applied to survivors post-gate
- `strategic-decision/SKILL.md` Phase 3 — the main consumer of this protocol
- `explore-solutions/SKILL.md` Phase 3 — older implementation of the pattern, embedded in one skill
- `validate-feature/SKILL.md` K1-K7 — binary kill-signals; conceptually the same pattern
  applied to single-feature go/no-go
