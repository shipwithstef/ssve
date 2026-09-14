# Mode 6: Capability Combinations

A dedicated combinatorial reasoning phase that looks across **all platform capabilities** and asks what 2-3 feature combinations produce emergent value that no single feature can claim alone.

**This is different from Step 7 (per-batch synthesis).** Step 7 is retrospective — it looks at what was just mined. Mode 6 is proactive and platform-wide — it treats all features as a capability map and systematically finds meaningful intersections.

**When to run:**
- After a full scan or full refresh completes (all features mined)
- User explicitly asks for combination reasoning ("what do our features unlock together", "what combos matter")
- When a new high-value feature is added — re-run to find new combinations it enables

---

## Steps

### 1. Build the capability map

Load all features from the tracker. For each feature, extract its core capability in one plain sentence (what it fundamentally enables, not what it does technically):

```
feature-matching      -> "filters by 7 compatibility dimensions before first message"
feature-trust -> "makes reputation behavioral and permanent"
feature-conversation -> "structures every conversation toward a decision"
feature-collab -> "gates ratings behind actual collaboration"
profiles         -> "makes intent, deal-breakers, and work style visible upfront"
feature-workspace    -> "shared persistent workspace per match"
micro-collab     -> "timeboxed real work before commitment"
decision-panel   -> "forces Commit/Pivot/Stop at structured checkpoints"
parallel-queues  -> "multiple simultaneous partnership searches"
feature-experts  -> "extends platform beyond co-founders to experts and investors"
referrals        -> "growth reward tied to collaboration quality not signup volume"
gamification     -> "badges and tiers that reward real milestones"
```

### 2. Run combination patterns — explicitly test each

For every pair and meaningful triplet, apply these five lenses:

| Pattern | Question to ask |
|---|---|
| **Sequential unlock chain** | Does Feature A's output become Feature B's input, producing an outcome better than either alone? |
| **Mutual amplification** | Do two features make each other stronger when used together? |
| **Emergent capability** | Do two features together enable something entirely new that neither provides alone? |
| **Safety stack** | Do multiple features together solve a psychological barrier completely that none solve individually? |
| **User journey arc** | Do features together cover a complete user journey from entry to outcome? |

### 3. Filter to genuine combinations only

A combination qualifies if:
- The combined claim could NOT be made by listing either feature alone — this is the primary test
- The combination produces a claim that is MORE compelling than the weakest source feature's standalone insight (i.e., the combination elevates the weaker feature, not just repeats the stronger one)
- A user would be moved by hearing the combination described together, not separately

**Note:** Do NOT apply a fixed "weight points above source" rule — it breaks when source insights are already high-weight (weight 90 + 10 = 102, which exceeds the cap). The emergence test above is the correct filter.

Reject combinations that are merely additive ("feature A + feature B = both benefits"). Require emergent or amplified value.

### 4. Generate 0-5 combination narratives

Each must:
- Have a clear `sources` list of the feature IDs it draws from
- Be written as a continuous marketing claim, not a list
- Pass the meetup test: would a user lean in hearing this?
- Be weighted 80+ (combinations below 80 aren't compelling enough to be combination narratives)

Write to tracker `narratives` array + "## Synthesized Narratives" section in context doc.

### 5. Flag missing single-feature insights

If combination reasoning reveals that a combination only works because Feature A has a strong insight but Feature B's insight is weak or missing — flag Feature B for a targeted re-mine (Mode 2) before the narrative lands properly.

---

## Combination Patterns Reference (ExampleProduct-specific)

Pre-identified high-value combinations to test first. These are starting hypotheses, not exhaustive:

| Combination | Pattern | Hypothesis |
|---|---|---|
| 7D matching + Code Vibe DNA + anti-preferences | Safety stack | "By the time you're talking, deal-breakers are already gone" |
| Parallel queues + Trust tiers + Ratings | Sequential unlock chain | "The platform develops your collaboration skill as you use it" |
| Micro-Collab Trial + Vision Canvas + Decision Panel | User journey arc | "From first match to first shipped artifact in a structured week" |
| Cryptographic disclosure + Progressive trust + Anti-preferences | Safety stack | "Share your idea only when the environment earns it" |
| Expert ecosystem + Investor queue + Team DNA | Emergent capability | "One platform from first match to funded team" |
| Referrals + Gamification + Trust tiers | Mutual amplification | "Growth rewards quality at every layer — not just signups" |
| Conversation modes + Decision Panel + Ghosting penalties | Sequential unlock chain | "Every conversation either commits or closes — no drift, no ghosts" |
| AI Tools (D1) + Vibe Velocity (D7) + Code Vibe DNA | Emergent capability | "Your co-builder codes at your pace, with your tools, at your hours — the full-resolution AI-era builder match that no other platform can produce" |
