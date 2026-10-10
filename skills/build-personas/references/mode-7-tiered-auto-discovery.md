## Mode 7: Tiered Auto-Discovery

Triggered when the user says "auto personas", "propose personas", "tiered personas",
"just run it automatically", or when `docs/personas/` does not exist and the user
wants to start from scratch.

### What it does

Reads the product entirely on its own, proposes a tiered set of personas for
approval, then builds only the approved ones. The product owner does not need to
provide any input beyond approving the proposal.

### Phase 1: Deep Read (automatic)

Read all of the following without asking the user:

```
1. docs/specs/VISION.md or docs/VISION.md or the closest equivalent
2. CLAUDE.md (for entity list, user roles, pricing tiers)
3. docs/specs/features/*.md — all AC checklists / feature specs
4. docs/specs/BUSINESS_SPEC.md if it exists
5. Any flow audit files (OWNER_FLOW_AUDIT.md, EMPLOYEE_FLOW_AUDIT.md, CUSTOMER_FLOW_AUDIT.md)
```

Build an internal model of:
- **User roles** (distinct auth paths, separate onboarding flows, different entity types)
- **Feature surface per role** (which features each role touches)
- **Platform maturity per role** (is the role fully built out, partially, or sketched?)
- **Value delivered vs. value potential** (what does the platform give each role today vs. what it COULD give with small additions?)

### Phase 2: Identify Persona Candidates

For each user role, identify the meaningful archetypes WITHIN that role. Not every
role is one persona — a café owner and a 5-location restaurant operator both have
the "Owner" role but have very different needs, sophistication, and platform usage.

**Factors that split a role into multiple personas:**
- Business scale (solo/micro vs. small chain vs. enterprise)
- Engagement depth (passive/minimal vs. active/power user)
- Specific capability focus (e.g., one owner lives in scheduling, another lives in loyalty)
- Job title / seniority within the role (e.g., full-time employee vs. part-time gig worker)
- Goal type (e.g., customer who hunts deals vs. customer who builds loyalty relationships)

**Merge aggressively.** If two candidates feel like the same person at different
life stages, that's one persona with two lifecycle instances — not two personas.

Aim for 3-7 total personas across all roles.

### Phase 3: Tier Classification

For each persona candidate, classify into one of three tiers based on how well
the CURRENT platform serves them:

#### Tier 1 — Platform-Native

The platform serves this persona completely today. No feature gaps. They can
sign up, get full value, and stay long-term on the current platform.

**Signals:** All their core jobs-to-be-done have corresponding features. Their
primary failure modes are onboarding/UX friction, not missing capabilities.

#### Tier 2 — Near-Future

The platform gives them real value today, but 1-3 focused additions would
fully close the gap. These additions are:
- Narrowly scoped (no new entities, no architectural changes)
- Clearly implied by existing product direction
- Could ship in a sprint or two

**Examples of Tier 2 additions:**
- A missing field on an existing form
- A filter/sort option on an existing list
- A notification type not yet implemented
- A small workflow improvement (e.g., bulk actions)

**Signals:** The persona gets ~70-80% of their value from the current platform.
The remaining gaps are irritants, not blockers. You can describe exactly what
the 1-3 additions would be.

#### Tier 3 — Vision

This persona would require significant platform investment to fully serve:
new entity types, new integrations, major new feature areas, or architectural
changes. They represent where the product COULD go, not where it is.

**Signals:** The persona's core jobs-to-be-done map to features that don't exist
yet. Serving them well would require a multi-sprint effort or a new product surface.

**Note:** Tier 3 personas are NOT bad personas — they're strategic signals.
They tell the product owner where growth opportunities lie.

### Phase 4: Proposal Output

Present the tiered persona proposal to the user. Do NOT write any files yet.

Format:

```markdown
## Persona Proposal — [Product Name]

**Analyzed:** [N] feature specs + [N] entity types + [N] user roles
**Proposed personas:** [N] total ([N] Tier 1, [N] Tier 2, [N] Tier 3)

---

### Tier 1 — Platform-Native (fully served today)

**P1: [Name]** — [1-line archetype]
- **Role:** [which system role]
- **Who they are:** [2-3 sentences — specific enough to picture a real person]
- **What the platform gives them:** [core value they receive today]
- **Platform coverage:** ~[X]% of their needs
- **Feature gaps:** None significant

**P2: [Name]** — [1-line archetype]
[same structure]

---

### Tier 2 — Near-Future (1-3 small additions close the gap)

**P3: [Name]** — [1-line archetype]
- **Role:** [which system role]
- **Who they are:** [2-3 sentences]
- **What the platform gives them today:** [current value]
- **Platform coverage:** ~[X]% of their needs
- **What's missing (small additions):**
  1. [Specific small addition #1 — narrow scope, no new entities]
  2. [Specific small addition #2]
  3. [Optional: #3]
- **Why these are Tier 2 (not Tier 3):** [explain why these are small, not architectural]

---

### Tier 3 — Vision (significant new capabilities needed)

**P4: [Name]** — [1-line archetype]
- **Role:** [which system role]
- **Who they are:** [2-3 sentences]
- **What the platform gives them today:** [any current overlap]
- **Platform coverage:** ~[X]% of their needs
- **What would be needed to fully serve them:**
  - [Major capability/feature area #1]
  - [Major capability/feature area #2]
- **Strategic signal:** [Why this persona matters for the product roadmap]

---

## What I'll Build

**Your options:**

A) **Build Tier 1 + Tier 2 personas now** (recommended) — full persona files for P1-P3.
   Tier 3 personas get lightweight stubs.

B) **Build Tier 1 only** — full persona files for P1-P2. Skip the rest.

C) **Build all tiers** — full persona files for all personas including Tier 3.
   (Note: Tier 3 files will describe who the persona WOULD be if the platform
   existed, which is useful for roadmap planning.)

D) **Custom** — tell me exactly which personas to build.

Which option, or any changes to the proposed personas?
```

### Decision Logging

After persona selection is finalized (user approves or P0 decides in auto mode), log the decision. The `run_id` comes from the active task graph (`docs/log/lane-tasks-<WI>.json` → `wi` field).

```bash
# Persona selection (taste — multiple viable configurations exist)
node scripts/pipeline-log.mjs append \
  --path .svc/pipeline-decisions.jsonl \
  --run-id "<WI-ID>" \
  --skill build-personas \
  --phase "<task-id>" \
  --type taste \
  --decision "Personas: <N> Tier 1, <N> Tier 2, <N> Tier 3. Selected option: <A|B|C|D|custom>" \
  --reasoning "<why this configuration — e.g., 'P1 and P2 are fully served by MVP scope; P3 needs 2-3 additions'>" \
  --decided-by "<P0|user>" \
  --overrideable true
```

### Phase 5: Build Approved Personas

After the user approves (in full or with modifications), build the persona files.

**For Tier 1 and Tier 2 personas:** Full persona documents using the standard
template from Mode 1, Phase 3. The Feature Touchpoints section should map to
the ACTUAL feature specs found in the project (not the ExampleProduct examples).

**For Tier 3 personas (unless user requested full build):** Lightweight stub:

```markdown
# P[N]: [Name] — Vision Persona

**Tier:** 3 — Vision (significant new capabilities needed)
**Archetype:** [1 sentence]

## Who They Are

[2-3 sentences — who is this person in 2026]

## What They Need That Doesn't Exist Yet

| Capability needed | Why it matters | Effort estimate |
|-------------------|---------------|----------------|
| [feature/entity] | [what value it delivers] | [Small/Medium/Large] |

## Strategic Signal

[1-2 sentences: why building for this persona would matter, what market it opens]

## Platform Coverage Today

~[X]% — [describe what the current platform CAN do for them, even if incomplete]
```

**For the index:** Create `docs/specs/personas/PERSONA_INDEX.md` with all personas,
including Tier 3 stubs, using the standard index format from Mode 1, Phase 4.
Add a **Tier Summary** section at the top of the index.

### Phase 6: Tier 2 Addition Backlog

After building personas, output a consolidated list of all Tier 2 additions
identified across all Tier 2 personas. This is a ready-to-use input for
GitHub Issues or a product backlog:

```markdown
## Tier 2 Addition Backlog

These small additions would close the gap for Near-Future personas.
Each is narrowly scoped — no architectural changes required.

| # | Addition | Serves persona | Effort | Type |
|---|----------|---------------|--------|------|
| 1 | [what] | P[N] | XS/S/M | [Feature/UX/Config] |
```

Write this to `docs/specs/personas/TIER2_BACKLOG.md`.

### Important notes for Mode 7

- **No challenge library needed.** If `docs/personas/` doesn't exist, skip it.
  Reason from the product specs and entity list alone.
- **2026 context is still mandatory.** Even without challenge narratives, every
  persona must reflect the real world this person lives in in 2026. For a local
  business SaaS: AI tools are mainstream, labor market is tight, mobile is primary,
  customers expect instant gratification, small businesses are under margin pressure.
- **Tier 2 additions must be specific.** "Better analytics" is not Tier 2. "Add a
  date range filter to the visits chart" is Tier 2. Be specific enough that a
  developer could estimate and build it.
- **Tier classification is honest.** Don't downgrade Tier 3 personas to Tier 2
  to make the proposal feel more achievable. If it needs a new entity type or
  a new integration, it's Tier 3.
- **Proposal gate is real.** Do NOT write any files during Phase 4. The user must
  respond before any persona files are created.

---
