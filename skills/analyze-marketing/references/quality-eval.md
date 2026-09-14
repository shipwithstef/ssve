# Mode 7: Quality Eval

A systematic evaluation pass that catches gaps, errors, and missing reasoning across all mined content. Structured around eval principles: define success criteria, test for false positives (wrong things present) AND false negatives (right things missing), grade each criterion, produce actionable remediation.

**When to run:**
- After Mode 6 (Capability Combinations) completes a full-platform pass
- When any downstream skill reports that insights feel generic or incomplete
- Explicitly requested by user ("eval the insights", "what are we missing")
- After a major spec change that might invalidate multiple existing insights

**Do NOT run Mode 7 during active mining** — it's an evaluation pass, not a mining pass. Run mining first, eval after.

---

## Eval Inputs (load before starting)

1. Full tracker JSON — all features, all insights, all narratives
2. Context doc — foundational sections + mined insights + narratives
3. Quick Stats Reference — for stat coverage check
4. Mode 6 Combination Patterns Reference — for combination gap check

---

## EVAL 1 — False Negative: Missing High-Value Insights

*"What valuable marketing angles did the skill fail to produce?"*

For each feature with priority 1-2 (feature-matching, feature-conversation, feature-trust, profiles, feature-collab, monetization):
- Is there at least 1 insight with weight >= 80? **FAIL if not.**
- Was unlock reasoning applied to the primary mechanic? **WARN if no second-order insight exists.**
- Was stat amplification checked against Quick Stats? **WARN if a Quick Stats entry is thematically related to this feature but no insight references it.**

For each feature with priority 3-4:
- Is there at least 1 insight with weight >= 65? **WARN if not, FAIL if weight of top insight < 55.**

Grade each feature: PASS / WARN / FAIL. List specific gap if WARN or FAIL.

---

## EVAL 2 — False Positive: Engineering Language Contamination

*"Are insights written in marketer language or engineer language?"*

Scan every insight in the tracker. Flag any that contain:
- Internal variable names, dimension codes (D1, D6, etc.) or field names
- Architecture terms (OCC, CEIL(N/2), cosine similarity, SHA-256, RCP-XXXXXX)
- Feature flag names or spec internal IDs
- Passive construction that describes a system, not a user benefit ("The system creates...", "Users are shown...")

Grade: PASS (none found) / FAIL (list each offending insight ID + the specific term).
Remediation: rewrite insight in user-outcome language before next context doc update.

---

## EVAL 3 — Accuracy: Unvalidated Stats in High-Weight Positions

*"Are any unverified claims being used as primary weight justification?"*

Flag any insight where ALL of the following are true:
- `validated: false`
- Weight >= 75
- The insight copy contains a specific number or percentage

These are high-risk: if the stat turns out to be wrong, the insight's credibility collapses.

Grade: PASS (none) / WARN (list insight IDs — require validation before deploying to homepage/social) / FAIL (insight is already in `deployed_in` without validation).

---

## EVAL 4 — Coverage: Unlock Chain Gaps

*"For features with weight >= 70 mechanics, was second-order reasoning applied?"*

For each of the top 8 features by max insight weight:
- Does the feature have at least one insight that describes an *outcome* (what happens over time) vs just a *capability* (what the feature does)?
- If the feature mechanic rewards repeated use — are the compounding benefits captured somewhere (either as a Layer 1 insight or a Layer 2 narrative)?

Grade per feature: PASS / WARN ("unlock reasoning present but only direct benefit captured") / FAIL ("only capability described, no outcome or compound benefit exists").

---

## EVAL 5 — Coverage: Capability Combination Gaps

*"Which high-value feature combinations have never been evaluated?"*

Load the Mode 6 Combination Patterns Reference table. For each pre-seeded combination:
- Does a narrative exist in the tracker that draws from all the listed source features?
- If not — has Mode 6 been run and explicitly rejected this combination (documented reason)?

Grade: PASS (narrative exists or combination explicitly evaluated and rejected) / WARN (combination never tested) / FAIL (combination was tested and produced a narrative but the narrative is missing from the context doc).

---

## EVAL 6 — Consistency: Foundation vs Tracker Conflicts

*"Do numbers in the foundational sections match the tracker's corrected values?"*

For every insight in the tracker that has a `weight_note` containing a specific number, percentage, or named claim:
- Search the foundational sections (lines 1 to "## Mined Marketing Insights" header) for that number
- If found in a different form (e.g., tracker says "5%" but foundation says "10%"), grade FAIL with exact line reference

Grade: PASS / FAIL (list each conflict as "tracker: X | foundation line N: Y").

---

## EVAL 7 — Freshness: Planned Features That Are Now Live

*"Are any insights still carrying planned-feature penalties for features that shipped?"*

For every insight with `weight_note` containing "Planned feature" or `status: "pending_validation"`:
- Check the corresponding spec file's Implementation Notes for `**X-N RESOLVED YYYY-MM-DD**`
- If RESOLVED exists and date is after insight creation date -> **FAIL**: insight weight is stale, penalty should be removed

Grade: PASS / FAIL (list each stale insight with correct weight recalculation).

---

## EVAL 8 — Deduplication: Near-Duplicate Insights Across Channels

*"Are any insights making the same core claim targeted at the same use_in channel?"*

Semantically compare all insights with overlapping `use_in` arrays. Two insights are duplicates if they make the same core claim — even with different wording. Focus on:
- Social channel duplicates (most constrained)
- Homepage duplicates (highest visibility risk)

Grade: PASS / WARN (list duplicate pair IDs and the shared claim — let human decide which to keep).

---

## EVAL 9 — Dead Insights: Deployed but Not Tracked

*"Are there insights that have been used in content but `deployed_in` was never updated?"*

Check `deployed_in: []` on all insights with weight >= 70 that have been in the tracker for 30+ days. Flag any that are likely deployed but untracked based on:
- High weight (likely used first by downstream skills)
- `use_in` includes "homepage" or "social"

Grade: WARN (list candidates for human to verify and update `deployed_in`).

---

## EVAL 10 — Summary Stats Integrity

*"Does the tracker summary match the actual data?"*

Compute:
- `actual_total = sum(len(feature.insights) for all features)`
- `actual_avg = sum(all weights) / actual_total`
- `actual_high_value = count(insights with weight >= 70)`
- `actual_narratives = len(narratives array)`

Compare against `summary` object. Grade: PASS (within 1 of each) / FAIL (any divergence > 1 — recompute and write corrected summary).

---

## Eval Output Format

After running all 10 evals, produce:

```markdown
## Mode 7 Quality Eval — [date]

| Eval | Criterion | Grade | Issues Found |
|------|-----------|-------|--------------|
| 1 | Missing high-value insights | PASS/WARN/FAIL | [list] |
| 2 | Engineering language | PASS/FAIL | [list] |
| 3 | Unvalidated stats at high weight | PASS/WARN/FAIL | [list] |
| 4 | Unlock chain gaps | PASS/WARN/FAIL | [list] |
| 5 | Combination gaps | PASS/WARN/FAIL | [list] |
| 6 | Foundation conflicts | PASS/FAIL | [list] |
| 7 | Stale planned-feature penalties | PASS/FAIL | [list] |
| 8 | Near-duplicate insights | PASS/WARN | [list] |
| 9 | Dead deployed_in tracking | WARN | [list] |
| 10 | Summary stats integrity | PASS/FAIL | auto-corrected if FAIL |

**Overall grade:** PASS (0 FAILs) / WARN (FAILs exist but low-risk) / FAIL (action required)

**Remediation plan:**
1. [Specific action — insight ID, what to fix, which mode to run]
2. ...
```

Only output the table and remediation plan — do not re-explain each eval criterion in the session output.
