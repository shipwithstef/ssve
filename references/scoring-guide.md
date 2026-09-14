# Scoring Guide

## Six Dimensions (Weights)

| Dimension | Weight | Description |
|-----------|--------|-------------|
| Guaranteed revenue | 30% | Evidence that similar products make money |
| Builder fit | 25% | Skills, stack, and experience match |
| Distribution fit | 20% | Builder can reach first 100 users |
| Speed to first $ | 15% | How fast from build to first revenue |
| Self-sustaining | 5% | Free-tier infra, no entity needed |
| Ecosystem value | 5% | Builds toward larger vision or reusable assets |

## Evidence Strength (0-10)

Separate from score. Gates auto-selection.

| Score | Meaning |
|-------|---------|
| 0-3 | Anecdotal or theoretical only |
| 4-5 | Some signals but unverified |
| 6-7 | Verified revenue or strong launch data |
| 8-9 | Multiple verified examples, clear pattern |
| 10 | Direct comparable with public revenue data |

## Score Anti-Inflation Cap

```
max_score = min(calculated_score, 60 + evidence_strength * 2)
```

Example: calculated_score = 92, evidence_strength = 5 → capped at 70.

## AI Wrapper Special Path

AI wrappers get scored with adjusted expectations:
- Revenue potential: lower ceiling unless differentiated
- Speed to first $: higher score (fast to build)
- Moat risk: higher penalty (easy to copy)
- Multi-wrapper strategy: recommend portfolio of 2-3 wrappers instead of one
