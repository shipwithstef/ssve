# reverse-engineer — output templates

Loaded from `SKILL.md` Phase 2 and Phase 4.

## Phase 2 — `docs/specs/reverse-engineer/<name>-teardown.md`

```markdown
# Teardown: <name>

## One-Liner
<What it does in one sentence>

## Target Users
<Who uses it and why, with specific personas>

## Revenue Model
<How it makes money, estimated revenue, pricing tiers>

## Core Loop
<The user behavior loop that drives retention>
1. User does X
2. Product provides Y
3. User gets value Z
4. User returns because W

## Feature Map
| Feature | Purpose | Execution quality (1-10) | Difficulty to replicate |
|---|---|---|---|
| ... | ... | ... | easy / medium / hard / moat |

## Tech Stack (best estimate)
| Layer | Technology | Confidence |
|---|---|---|
| Frontend | ... | high/medium/low |
| Backend | ... | ... |
| Database | ... | ... |
| Infra | ... | ... |

## Growth Engine
| Channel | Estimated % of traffic | Replicable? |
|---|---|---|
| ... | ... | yes/no/partially |

## Moat Analysis
| Moat type | Strength (1-10) | How to overcome |
|---|---|---|
| ... | ... | ... |

## Weaknesses
| Weakness | Evidence | Opportunity |
|---|---|---|
| ... | (bad reviews, missing feature, complaint) | (what you'd do differently) |

## What Makes It Work (the 3 things)
1. <The #1 reason this succeeds — not a feature, a truth about the market>
2. <The #2 reason>
3. <The #3 reason>

## What's Overrated About It
<Things that look important but aren't actually why it works>
```

## Phase 4 — `docs/specs/reverse-engineer/<name>-build-brief.md`

```markdown
# Build Brief: <chosen-twist-name>

**Based on:** <original product/company/technique>
**Twist:** <the differentiation in one sentence>
**Builder:** <name from profile or "not profiled">

## Vision Draft
<2-3 paragraphs: what you're building, for whom, why now, how it's different>

## Target User
<Primary persona with specific needs the original doesn't serve>

## Core Features (MVP — ship in <timeframe>)
| # | Feature | Why included | Inspired by original? | Twist applied? |
|---|---------|-------------|----------------------|---------------|
| 1 | ... | ... | yes/no | yes — <how it's different> |

## Features to SKIP (deliberately)
| Feature in original | Why skip |
|---|---|
| ... | <not core to twist / too expensive / moat-dependent> |

## Revenue Model
<How this version makes money, day 1>

## Growth Plan (first 100 users)
| Week | Action | Channel | Expected result |
|---|---|---|---|
| 1 | ... | ... | ... |

## Tech Stack Recommendation
<Based on builder's skills + speed requirement>

## Risk Register
| Risk | Likelihood | Mitigation |
|---|---|---|
| Original company copies your twist | ... | Ship fast, build community |
| ... | ... | ... |

## Next Step
→ Feed this brief into `write-vision` to start the svc pipeline.
  The teardown at `docs/specs/reverse-engineer/<name>-teardown.md`
  becomes input for `analyze-competitors`.
```
