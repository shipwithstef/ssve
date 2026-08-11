# Product-Question Format (shared reference)

**What this is:** The mandatory format for product questions asked by any svc skill (validate-feature, write-spec, design-ux, design-tech, plan-changeset, execute-changeset, review-gate, test-journeys, diagnose-bug, audit-ac, sync-spec-code, route-workflow).

**Why it exists:** Without structure, product questions become surface-level yes/no exchanges that miss critical dimensions. Shipped features end up with broken edge cases the agent should have flagged. This format ensures every decision is auditable, grounded in competitor reality, and accompanied by its own risk + success + cost + persona + reversibility + innovation analysis.

**Origin:** User feedback during Example Marketplace WI-099 session 2026-04-21. Demonstrative first output at `docs/specs/work-items/WI-099-questions.md` in that repo.

---

## The 12-section template (in order)

Every product question asked during any phase uses this structure:

### 1. Plain translation
The question in the **owner's / customer's / user's voice**, not technical language. Example: "When I send a Flash Offer, who gets the push notification on their phone?"

### 2. 5 considerations (owner + customer POV)
Five distinct product dimensions that affect the decision, written in plain language. Examples: consent, relevance, platform reputation, acquisition vs. retention, customer overwhelm.

### 3. 5 competitors — what they actually do
Five NAMED companies + specifics of their implementation. Include both positive (they do it well) and negative (they tried, failed, retired) examples when available. Prefer direct competitors + adjacent-industry references. Use real market behavior, not fabricated facts.

### 4. Justification
The reasoning from considerations + competitor patterns. Explains the emerging direction.

### 5. Risk / counter-argument
The strongest case AGAINST the emerging direction. What would someone opposed to this decision say? Includes mitigation.

### 6. Success signal
One measurable, falsifiable indicator that tells us the decision was right within 30-90 days. Example: "Push-to-claim conversion > 8% (industry benchmark 5-7%)."

### 7. Cost/effort
T-shirt size (XS / S / M / L / XL) + 1-line reason. XS = no code or trivial change; XL = multi-week effort.

### 8. Persona fit
Which personas this decision serves most (P1 / P4 / P6 etc. — refer to `docs/specs/personas/` in the project). Explicitly flag any net-negative impact on any persona.

### 9. Reversibility
Bezos framework — **one-way door** (hard to reverse, e.g., schema change in production) vs **two-way door** (easy to revert, e.g., UI flow). Inform confidence weighting.

### 10. Innovation layer
Three parts:
- **(a) Industry-proven next-level move** — what leaders are piloting but not yet mainstream. Named example.
- **(b) Agent's creative take** — a novel idea the agent generates based on first-principles reasoning. Must be concrete enough to implement.
- **(c) Judgment** — for each of (a) and (b): **ADOPT NOW** / **ADOPT IN V2** / **ADOPT IN V3** / **DEFER** / **REJECT**, with a short reason.

### 11. Decision (synthesis — MUST be last after all analysis)
The recommendation that synthesizes everything above. **Decision explicitly incorporates any innovations from step 10 that were judged ADOPT**, and explains WHY (which consideration / risk / competitor pattern they address). The Decision is not a standalone assertion; it reads as a conclusion that follows from the preceding 10 sections.

### 12. Phase tag
Which pipeline phase the question arose during: `validate-feature` / `write-spec` / `design-ux` / `design-ui` / `design-tech` / `plan-changeset` / `execute-changeset` / `review-gate` / `test-journeys` / etc.

---

## Coverage rules

**Per feature (minimum):**
- **≥ 20 customer-facing questions** (if the feature has any user-visible surface)
- **≥ 20 system-facing questions** (persistence, race conditions, cross-entity, cost, observability, deployment)
- **Total: ≥ 40 questions answered** before a spec is BASELINED, a technical design is FINAL, or a plan-changeset manifest is SIMULATED.

Fewer = incomplete spec; refuse to proceed. Document the gap explicitly.

---

## Process rules

**1. Agent recommends first.** No open yes/no fishing. Follow the 12-section template with the agent's current best recommendation synthesized at step 11. User overrides if they disagree; default reply "AGREE" suffices.

**2. Convergence before advance.** Next question cannot start until the current one is explicitly confirmed (`AGREE` / counter-answer that the agent acknowledges + updates Decision + re-confirms). Never advance on ambiguous signals.

**3. Persistent per-feature companion file.** Questions accumulate in `docs/specs/features/<feature>-questions.md` (or `docs/specs/work-items/<WI>-questions.md`) as a living log. Phase-tagged so questions from different pipeline phases co-exist. Resumed sessions read this file first.

**4. Promotion gates check the companion file.**
- `write-spec` can't flip DRAFT → BASELINED unless all `phase: validate-feature` and `phase: write-spec` questions are AGREE.
- `design-ux` adds its own questions, blocks UX-REVIEWED until those are AGREE.
- `design-tech` adds its questions, blocks BASELINED until those are AGREE.
- `plan-changeset` simulation step reads the companion file; manifest cannot reach SIMULATED unless questions in all covered phases are AGREE.
- `review-gate` G1 checks completeness.

**5. Innovation-from-questions compounds.** Every Q's innovation-layer ADOPT-IN-V2 / ADOPT-IN-V3 judgment becomes a candidate for `docs/framework/OPEN-PROPOSALS.md` "Innovation backlog" section (or project equivalent). Avoids innovation rot — ideas become trackable candidates without demanding immediate action.

**6. Recommend+synthesize flow, not dimension list.** When the agent displays a question to the user, the 12 sections appear as HUMAN-READABLE REASONING, not a tech checklist. Language stays in the owner's / customer's voice, not jargon. Technical details go in sub-bullets or collapsed "Technical notes" — skippable for the PM.

---

## Bulk-review protocol

Users review in batches:

```
Q8 AGREE
Q9 OVERRIDE → <what they want changed>
Q10-Q20 AGREE
Q21 OVERRIDE → <change>
Q22-Q47 AGREE
```

Agent applies OVERRIDEs (updates Decision + reconciles Risk/Success/Cost sections as needed), re-confirms each changed Q, then marks the feature's question set as complete for that phase.

---

## Canonical reference implementation

See `docs/specs/work-items/WI-099-questions.md` in the Example Marketplace repo (`archived-contributor/example-marketplace`) for 47 questions in this format. Use as template when applying this pattern to new features in other repos.

---

## When this format applies

| Phase | Typical question count | Examples |
|---|---|---|
| `validate-feature` | 5-10 | Is this worth building? Persona fit? Competitive differentiation? |
| `write-spec` | 20-40 (bulk) | User stories, acceptance criteria edge cases, data model shape, lifecycle states |
| `design-ux` | 10-20 | Screen flows, state machines, empty/error/loading states |
| `design-ui` | 5-10 | Component variants, typography, responsive breakpoints |
| `design-tech` | 10-20 | Architecture trade-offs, concurrency, scalability, cost |
| `plan-changeset` | 2-5 | Phasing, task ordering, rollback plan (simulation step) |
| `execute-changeset` | 1-5 | Implementation-surfaced unknowns (e.g., "API doesn't support X, fall back to Y?") |
| `review-gate` | 3-5 | Missed edge cases, convergence, ship vs. block |
| `test-journeys` | 2-5 | Coverage gaps, reality-vs-spec drift surfaced by live run |
| `diagnose-bug` | 3-5 | Root cause, user impact, fix vs. work-around |

Cumulative across phases ≥ 40 questions per feature; the `<feature>-questions.md` companion file accumulates them phase-tagged.

---

## Why this is mandatory (not optional)

Product bugs that slip past specs usually fail one of the 12 sections:
- Missing competitor reference → team reinvents a failed pattern
- Missing risk section → failure mode ships unmitigated
- Missing success signal → feature ships without measurement, no feedback loop
- Missing reversibility → one-way-door decision made lightly
- Missing innovation judgment → creative improvement rots forever in someone's head

Evidence: Example Marketplace 2026-04-21 session — WI-091 and WI-093 shipped with 2 post-launch schema-drift bugs (WI-097, WI-098) + 1 tier-differentiator mgmt-UI gap. All three were structurally catch-able via this format at spec time. Past sessions without the format produced these drifts repeatedly.
