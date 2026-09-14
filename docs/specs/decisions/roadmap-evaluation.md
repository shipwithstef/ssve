# Design Decisions: roadmap-evaluation

**Date:** 2026-04-09
**Skill:** write-spec
**Mode:** auto (P0 picks)

---

## D1: Feature Type — Enabler vs Feature

| # | Alternative | Justification | Trade-offs |
|---|------------|---------------|------------|
| 1 | **Enabler** (chosen) | Consumed by route-workflow and stage-revenue programmatically; builder reads output but doesn't interact with a UI | Other skills parse the output; Enabler type keeps the spec focused on contracts |
| 2 | Feature | Builder directly invokes and reads the roadmap | Would require UX/UI pillars; adds spec weight for no value since output is markdown |

**Decision:** Enabler. The primary consumers are downstream skills. The builder reads the output, but the interaction model is "invoke skill, read file" — identical to mine-builder and find-opportunity.

---

## D2: Output Format — Structured markdown vs JSON vs YAML

| # | Alternative | Justification | Trade-offs |
|---|------------|---------------|------------|
| 1 | **YAML frontmatter + markdown** (chosen) | Human-readable body for the builder + machine-parseable frontmatter for downstream skills | Slight parsing complexity vs pure JSON |
| 2 | Pure JSON | Easy for skills to parse | Unreadable for the builder; defeats the purpose of a roadmap document |
| 3 | Pure markdown | Most readable | Downstream skills can't reliably extract structured data |
| 4 | Separate JSON + markdown files | Best of both | Two files to keep in sync; doubles maintenance |
| 5 | YAML file | Structured and somewhat readable | Less flexible for long-form milestone descriptions |

**Decision:** YAML frontmatter + markdown. Matches the svc convention (SKILL.md uses this pattern). Builder reads the markdown; skills parse the YAML.

---

## D3: Milestone Count — Fixed vs Dynamic

| # | Alternative | Justification | Trade-offs |
|---|------------|---------------|------------|
| 1 | **3-5 milestones** (chosen) | Enough granularity to show a path; few enough to be actionable | May need to group small items; may split large ones |
| 2 | 1 milestone per work item | Direct mapping | Too granular; 20 WIs = 20 milestones = unreadable |
| 3 | Exactly 3 (Stage 1/2/3) | Aligns with stage-revenue | Too rigid; not all projects need revenue staging |
| 4 | Unlimited | Most flexible | No constraint = no focus; builder gets overwhelmed |
| 5 | 1 milestone only (next action) | Maximum focus | Loses the planning horizon; builder can't see the path |

**Decision:** 3-5 milestones. Enough to show the path to first revenue without overwhelming. Aligns with the "narrowest wedge" principle — each milestone is a testable revenue hypothesis.

---

## D4: Cost Estimation Approach — Token-based vs Time-based vs Flat-rate

| # | Alternative | Justification | Trade-offs |
|---|------------|---------------|------------|
| 1 | **Skills-invoked x avg tokens** (chosen) | Directly maps to how agent costs accrue; builder sees "this milestone requires ~N skill invocations at ~$X each" | Requires maintaining average token costs per skill; estimates will be rough |
| 2 | Time-based (hours x rate) | Familiar to builders | Agent costs don't scale linearly with time; misleading |
| 3 | Flat rate per milestone | Simple | Inaccurate; a 2-WI milestone costs less than a 10-WI one |
| 4 | Historical from builder profile | Most accurate for this builder | Requires project history; cold start problem for new builders |
| 5 | Range bands (S/M/L) | Easy to understand | Too vague for budget planning against a $150/mo ceiling |

**Decision:** Skills-invoked x average token cost. Most honest mapping to how costs actually accrue. The builder profile provides the budget ceiling; the estimate shows how close each milestone gets to it.
