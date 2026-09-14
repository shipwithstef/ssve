# Self-Verify Checklist

Before declaring done, verify every check passes:

| # | Check | How |
|---|-------|-----|
| 1 | At least 3 opportunities presented | Count opportunity cards in output |
| 2 | Each opportunity has revenue evidence | Each card has "Evidence" with specific products/revenue, not speculation |
| 3 | Each opportunity is buildable in 1-2 weeks at builder's pace | Build time calculated from builder's hours/week, not generic estimate |
| 4 | Each opportunity uses free-tier infra | Infrastructure section shows $0 cost, no paid tools required |
| 5 | Scoring is complete for all 6 dimensions | Every opportunity has a filled score table with justifications |
| 6 | Distribution plan is specific to builder's channels | Plan references builder's actual platforms, follower counts, communities |
| 7 | No disqualified opportunities in the top 3 | Cross-check each opportunity against all 9 disqualifiers |
| 8 | Builder advantages are extracted and used | Step 1 output exists and each opportunity's "Why you" references it |
| 9 | `docs/specs/opportunities/top-3-opportunities.md` exists | File written to disk |
| 10 | If vision exists, ecosystem value is scored | Opportunities reference how they feed the big idea |
| 11 | Knowledge protocol conformance | Library checked first, project artifact written, knowledge persisted, .version updated |
| 12 | Funnel breadth: 10+ candidates investigated | Count distinct candidates in output (top 3 + rejected). Must be >= 10 total. |
| 13 | Evidence depth: 5+ proof points per top-3 candidate | Each top-3 card has a numbered proof chain with >= 5 sourced validations |
| 14 | Category diversity: 2+ distinct categories in top 3 | Top 3 candidates span at least 2 different product categories |
| 15 | Full funnel visible: all rejected candidates shown | "Considered and Rejected" section lists every investigated candidate not in top 3 |
| 16 | Parallel research used | Market scan used parallel agents for category clusters (or justified why sequential) |
| 17 | last30days social proof: 4 dimensions run | All 4 dimensions (pain, revenue, trend, gap) queried via last30days |
| 18 | Cross-dimension convergence analyzed | Synthesis identifies niches across 2+ dimensions |
| 19 | Social proof per top-3 candidate | Each proof chain includes >= 1 social proof point with engagement metrics |
| 20 | Platform context checked | Builder profile scanned for platform. Categories scored for compatibility, not eliminated. |
| 21 | Platform compatibility noted per opportunity | Each card shows platform fit: native (+3) / neutral (+0) / mismatch (-5) |
| 22 | Evidence strength scored per opportunity | Each opportunity has Evidence Strength 0-10. Strength < 4 = rejected. |
| 23 | Score inflation check applied | Low evidence → cap at `60 + strength * 2`. Cap noted in output. |
| 24 | Winner confidence calculated | Confidence = top_score - second_score. Platform/evidence overrides applied. |
| 25 | Pre-validation sanity check passed | MVP tasks estimated, compared to builder's available hours. Over by >20% = downgrade 20 pts. |
| 26 | Adversarial review completed | "Why this might fail" exists for top opportunity. No fatal flaw. |
| 27 | Anti-pattern cross-check passed | AP-5, AP-12, AP-18 checked. None triggered. |
| 28 | Pessimistic sensitivity analysis done | Revenue and build time at 25% and 2× assumptions. Opportunity still viable. |
| 29 | Auto-select respects all gates | Auto-select only when: confidence >20, top >80, evidence >= 7, ALL gates pass. |
| 30 | Full Delivery Mode respected | If auto-selected with high confidence, pipeline chains directly. Checkpoints honored if user wants review. |

If any check FAILs, fix before presenting to the user.
