# Step 3b: Ship Decision — detail

Moved verbatim from SKILL.md (progressive disclosure).

### Decision

| Kill signals | Decision | Action |
|---|---|---|
| 0-1 | **SHIP** | Proceed to Step 4 (route to downstream skill) |
| 2, AND a stronger alternative exists | **PIVOT** | Present the alternative direction with evidence (see Pivot Protocol below) |
| 2, no clear alternative | **SHIP WITH WARNINGS** | Proceed but attach kill signals as risk flags to the brief |
| 2+, only K1/K6 firing AND blocked by Builder-Profile timing constraint (e.g., `[zero-to-revenue-gap]`, "no distribution yet", "pre-first-customer") | **DEFER (Milestone: `<condition>`)** | Shelf the feature without killing it. Feature is conceptually valid; only timing is wrong. See DEFER Protocol below. |
| 3+ (any mix) | **NO-SHIP** | Reject the feature. Present the full evidence package. Offer pivot. |

**NO-SHIP vs DEFER — which one applies?**

| Situation | Decision |
|---|---|
| K3 (competitor shipped), K4 (vision misalignment), K5 (no kill condition), K7 (already exists) fire | NO-SHIP — these are structural/strategic flaws that don't resolve by waiting. |
| K1 (no demand) fires because no users exist YET at this builder stage (pre-launch, pre-first-customer), AND the feature is for post-PMF scale | DEFER until the stage milestone is hit (e.g., "first paying customer", "100 active users", "post-distribution-channel-proven"). |
| K6 (MVP is a platform) fires because the feature is correctly-scoped but exceeds current time/capital budget | DEFER until the resource milestone is hit (e.g., "after Stage 1 revenue lands", "after co-founder joins"). |
| Any mix of K2/K3/K4/K5/K7 fires | NO-SHIP — DEFER is not an escape hatch for features with inherent flaws. |

**Core distinction:** NO-SHIP says "this feature is wrong." DEFER says "this feature is right, the timing isn't." If you cannot name a concrete milestone that would flip the kill signal, the decision is NO-SHIP, not DEFER.

### NO-SHIP Evidence Package

When the decision is NO-SHIP, produce a structured rejection — not a vague "maybe reconsider."

```markdown
## Ship Decision: NO-SHIP

### Kill Signals (N of 7 fired)

#### K1: No demand evidence — FIRED
**Evidence:** [specific findings — search results, engagement data, research output]
**What would change this:** [what evidence would flip this signal — e.g., "3 paying customers
or 100+ upvote thread describing this exact pain"]

#### K3: Competitor shipped it — FIRED
**Evidence:** [competitor name, launch date, traction signals]
**What would change this:** [e.g., "their implementation misses X, which is the actual pain"]

#### K6: MVP is a platform — FIRED
**Evidence:** [why the smallest version still requires N systems]
**What would change this:** [e.g., "scope to just the CSV import, drop the dashboard"]

### Recommendation
Do not build [feature name]. The evidence does not support it.

### If You Disagree
Override this decision by providing counter-evidence for at least N-1 kill signals.
The brief will be updated and re-scored.
```

**In auto mode:** NO-SHIP always stops the pipeline and presents findings to the user.
This is never a silent decision — killing a feature is always a User-class decision.

**In interactive mode:** Present the evidence package, explain the reasoning, offer the
pivot if one exists. The user can override with counter-evidence.

### DEFER Protocol

When the decision is DEFER, the feature is conceptually valid but timing-blocked. Produce a structured shelf-note, not a rejection. A DEFER decision MUST name:

1. **The blocking kill signal(s)** — which K1/K6 fired and why
2. **The Builder-Profile constraint** — which specific profile entry (e.g., `[zero-to-revenue-gap]`, "no audience yet") caused the timing conflict
3. **The unblocking milestone** — a CONCRETE, verifiable event that would flip the kill signal. "When users exist" is not a milestone; "after first paying customer lands" is. "When I have time" is not a milestone; "after M2 roadmap milestone closes" is.
4. **The revisit trigger** — what event or cadence causes the framework to re-evaluate this feature (e.g., "when roadmap-evaluation runs after milestone X hits", "monthly builder-profile refresh").

```markdown
## Ship Decision: DEFER (Milestone: <concrete condition>)

### Kill Signals (N of 7 fired — all DEFER-eligible)

#### K1: No demand evidence — FIRED
**Evidence:** [specific findings]
**Why this is DEFER not NO-SHIP:** The feature concept is sound; K1 only fires because
  no users exist yet at this builder stage. The signal would flip once [milestone].
**What would unblock:** [specific measurable event]

#### K6: MVP is a platform — FIRED (optional — not all DEFER cases have K6)
**Evidence:** [specific findings]
**Why this is DEFER not NO-SHIP:** Scope is correctly bounded, but exceeds current
  time/capital budget. Once [milestone], the scope becomes tractable.
**What would unblock:** [specific measurable event]

### Builder-Profile Constraint
[Quote the specific builder-profile entry that creates the timing conflict. E.g.:
"`[zero-to-revenue-gap]` — builder has not closed first paying customer; feature
targets post-PMF scale problems."]

### Revisit Trigger
- **Milestone:** <concrete condition>
- **Verification:** <how to confirm the milestone hit — e.g., "count of Subscription
  entities where status='active' >= 1" or "roadmap-evaluation output shows M2 = DONE">
- **Auto-revisit:** If the roadmap-evaluation or capture-idea pipeline runs after the
  milestone event, this feature is re-surfaced automatically.

### Recommendation
Do not build [feature name] NOW. Shelve until milestone fires. On milestone fire,
re-invoke `/validate-feature` with this brief as context — the business case likely
re-scores to SHIP without further work.

### If You Disagree (override)
Override DEFER with counter-evidence that the timing constraint does not actually
apply (e.g., "I do have existing audience via X channel that pre-validates demand
without needing first paying customer"). The brief will be updated and re-scored.
```

**Artifact routing for DEFER:**

1. **Write the brief** — still write the Feature Ship Brief to `docs/specs/features/YYYY-MM-DD-<feature-name>-brief.md` with `Status: DEFERRED` in the frontmatter. The brief is not lost; it is a shelf record.

2. **Append to work-items index** — add an entry to `docs/specs/work-items/INDEX.md`:
   ```
   | WI-<id> | <feature name> | **DEFERRED** | blocked-by-<milestone> | <link to brief> |
   ```
   Severity tag: `blocked-by-<milestone-slug>` (e.g., `blocked-by-first-paying-customer`, `blocked-by-m2-revenue`). This is a distinct tag from `blocked-by-dependency` — it signals a timing block, not a technical block.

3. **Log the decision** — per the Decision Logging block above, pass `--decision "DEFER: <feature> (Until: <milestone>)"`. Auto-mode decision logs are queryable; deferred features can be listed later by grepping `pipeline-decisions.jsonl` for `DEFER`.

   All WI files must follow the canonical schema: see `references/work-item-schema.md`.

4. **Stop pipeline** — DEFER halts the current invocation the same way NO-SHIP does. No downstream skill runs. The difference is only in what gets produced (a shelved brief + index entry) vs what gets refused (NO-SHIP emits a rejection package, not a brief).

5. **Don't delete the idea** — DEFER is explicitly a non-destructive outcome. Future `roadmap-evaluation` passes and `manage-learnings` runs can surface deferred features as milestones land.

**In auto mode:** DEFER halts the pipeline and presents the shelf-note to the user. Still a User-class decision (the builder must confirm the milestone is correct). Never silent.

**In interactive mode:** Present the shelf-note with milestone, ask for confirmation, then write the brief with DEFERRED status.

### Pivot Protocol

When a PIVOT is recommended (or when the user requests alternatives after NO-SHIP):

1. **Identify what IS strong** — which business questions had solid answers? Which kill
   signals did NOT fire? The pivot builds on what works.

2. **Read the builder profile** — pivots MUST play to the builder's strengths, not
   just the market opportunity. A pivot that requires skills the builder doesn't
   have (and has failed at before) is not a real alternative. Consider:
   - Builder's technical skills → what can they actually build?
   - Builder's distribution channels → what can they actually reach?
   - Builder's time budget → what can they ship before losing momentum?
   - Builder's past failures → what patterns should this pivot avoid?
   - Builder's existing tools/subscriptions → what's cheapest to build?
   - Builder's reusable assets from past projects → code, domains, contacts

3. **Propose 1-3 alternative directions**, each with:
   - **Direction:** one sentence describing the alternative
   - **Why it's stronger:** which kill signals it avoids, what evidence supports it
   - **What it preserves:** which parts of the original intent survive
   - **What it sacrifices:** what gets dropped
   - **Smallest test:** the MVP for this direction

3. **Present as a choice:**
   ```
   The original feature [name] hit 3 kill signals. Here are alternatives that
   preserve your core intent:

   A) [Direction A] — avoids K1 and K3 because [evidence]
      MVP: [smallest version]
      Preserves: [what survives]
      Sacrifices: [what's dropped]

   B) [Direction B] — avoids K1 and K6 because [evidence]
      MVP: [smallest version]
      Preserves: [what survives]
      Sacrifices: [what's dropped]

   C) None of these — override the NO-SHIP with counter-evidence

   → Pick A, B, C, or override?
   ```

4. **If user picks a direction:** re-run Step 1 business questions for the pivoted
   direction (skip questions the pivot doesn't change), produce a new brief, and
   re-score. The pivot must pass the same kill signal gate.

5. **If user overrides:** require counter-evidence for at least N-1 kill signals.
   Update the brief with the override reasoning. Attach the original NO-SHIP evidence
   as a risk section. Proceed to Step 4.

---
