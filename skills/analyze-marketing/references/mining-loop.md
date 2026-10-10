## Per-Feature Mining Loop (7 Steps)

### Step 1: Extract Raw Material

Read the spec file at `docs/specs/features/<name>.md`.

**Read only the first 100 lines initially.** This covers Problem Statement, Solution Overview, and Success Criteria. Deep-read the full spec ONLY if preliminary analysis suggests weight >= 60.

Extract:
- **Problem statement** — What breaks without this feature?
- **Solution mechanism** — How does it work? (for understanding, not output)
- **Metrics / numbers** — Any quantified claims
- **Live vs Planned** — Check spec status field AND `docs/specs/INDEX.md`. For planned sub-features, scan Implementation Notes for sync-spec-code annotations (`RESOLVED`, `FIXED`, `UPDATED`, `DRIFT`, `REVERTED`) — these override raw spec status when newer.

### Step 2: Evaluate and Deepen

Use `references/evaluation-framework.md` as thinking scaffolding (internalize the 6 categories after first read). Identify the 1-5 strongest marketing angles with preliminary weight estimates.

Then apply these two deepening passes:

**Stat amplification:** Scan the Quick Stats Reference and Proof Points for numbers that directly amplify any mechanism you identified. "Direct amplification" means the stat is the quantitative backbone of the mechanism — making the claim statistically provable. When you find one: mark the angle `validated: true`, incorporate the stat directly into the insight copy (don't keep them separate), and skip web research for that angle. What is NOT stat amplification: a stat that is merely adjacent but doesn't prove the specific claim.

**Unlock reasoning:** Features don't just *do* things — they *unlock* things. For every mechanism, ask:
1. **What can the user NOW DO that they couldn't before?** (direct unlock)
2. **What behavior does this feature encourage over time?** (enabled behavior)
3. **What compounds with repeated use across sessions?** (compound outcome)

The unlock chain often produces the highest-weight insights because it reveals paradigm shifts. When unlock reasoning reveals a cross-feature benefit, flag it for Step 7 (Layer 2 narrative) instead of forcing it into a single-feature insight.

**Unlock patterns to watch for:**
- Feature that **rewards repeated use** -> compound growth narrative
- Feature that **removes a cost** -> freed capacity narrative
- Feature that **changes what's possible at scale** -> power user vs casual user split
- Feature that **combines with another** -> flag for Step 7, not a single-feature insight

### Step 3: Web Research Validation

**Required for insights with preliminary weight >= 70. Max 3 searches per feature.**

Use specific search templates:
- `"[competitor] co-founder matching [feature keyword] pricing"`
- `"YC co-founder matching [feature]"`
- `"[pain point] statistics [year]"`

**Skip web research** for insights weighted < 70.

### Step 4: Generate Insights (1-5 per feature, hard cap)

**Before drafting, enumerate user roles for this feature:** List every distinct user type that interacts with it (idea-owner, technical builder, new user, serial founder, team lead). For each role, write one sentence from THAT ROLE'S first-person perspective: "As [role], what I get from this is: ___". If any role-specific sentence is MORE concrete than the feature-level description, that sentence is the insight.

Each insight MUST pass these four checks — any FLAG means revise before proceeding:

| # | Check | Pass | Flag |
|---|-------|------|------|
| 1 | **User-centric language** | Every sentence from user POV; no "we built", no feature names as subjects | Contains "we", "the system", implementation nouns as subjects |
| 2 | **Specific claim** | Contains a concrete fact, number, mechanism, or testable outcome | Only vague praise ("better", "easier") with nothing to grab onto |
| 3 | **Differentiated** | A competitor could NOT copy this claim truthfully today | Any platform could say the same thing |
| 4 | **Unlock reasoning applied** | The "what does this enable next?" question was asked; answer is woven in or routed to Step 7 | Insight describes a static capability with no downstream thinking |

If 3+ checks FLAG: discard and generate a replacement. If 1-2 FLAG: revise inline.

**Deduplication:** Before writing each insight, compare semantically against existing insights from Pre-Flight step 4. "Credits on mutual accept" and "you only pay when both sides say yes" = same concept, skip.

| Bad (engineering) | Good (marketing) |
|-------------------|-----------------|
| "Cosine similarity across 7 vectors" | "Matched on the 7 things that predict co-builder success" |
| "Majority vote consensus CEIL(N/2)" | "Your team decides together — no single person can override" |
| "OCC conflict resolution" | "Two people editing at once? Changes merge automatically" |
| "Rate-limited Edge Function" | *(Don't market this at all)* |
| "Queue intent type matching" | "You're not 'a user' — you're an idea-owner looking for execution, or a builder looking for a worthy project" |

### Step 5: Assign Final Weights

Use `references/weight-calibration.md` anchors (internalize after first read).

1. Start with base score from evaluation
2. Apply modifiers: +10 unique, +5 stat backup, -10 competitors have
3. **Planned feature penalty** (tiered, not flat):
   - Homepage/social: -15
   - Blog/email: -5
   - Roadmap/pitch: 0
4. Compare against anchors, clamp 1-100

### Step 6: Record Results

**Write to tracker immediately** after each feature (not at end of batch). If the conversation ends mid-batch, progress is preserved.

Update `docs/marketing/feature-mining-tracker.json`:
- Merge new insights (never delete existing)
- Initialize `deployed_in: []` on every new insight
- Update `last_mined` timestamp
- Recompute summary stats by counting actual array lengths — do NOT increment stored counters

Append to `.agents/product-marketing-context.md`:
- Only insights with weight >= 55 (aligns with Mode 5 compaction threshold)
- Use HTML comment format: `<!-- weight:85 source:feature-matching validated:true -->`
- Organize by **weight tier** (Category-Defining / Strong Differentiators / Meaningful Value)
- Mark planned features with "(Coming soon)"
- **Each insight is atomic** — one trait, one claim, one audience, one weight. Never merge.

### Step 7: Cross-Feature Synthesis (after batch completes)

After all features in the batch are mined, look across the batch for **narrative combinations** — marketing stories powered by multiple features together.

**Rules:**
- Generate 0-3 narratives per batch (don't force it)
- Each narrative MUST back-reference the atomic insight IDs it draws from
- Initialize `deployed_in: []` on every new narrative
- Narratives go in a separate `"narratives"` array in the tracker
- Narratives go in a separate "## Synthesized Narratives" section in the context doc
- **Narratives never replace their source insights.**
- **Overlap detection:** After creating a narrative, check if any source insight is fully subsumed (the narrative says everything the insight says, plus more). If so, mark the insight `"status": "elevated_to_narrative"` with `"elevated_to": "<narrative-id>"`. Elevated insights stay in the tracker but are removed from the context doc — the narrative carries their value now. This prevents the context doc from saying the same thing twice at different abstraction levels.

---
