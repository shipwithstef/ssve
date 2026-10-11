---
name: assess-market-readiness
version: "1.0"
description: >
  Scores whether the product is ready for its next milestone (launch, hackathon, VC pitch,
  PMF) from project artifacts: 0-100 score, blocking gaps and a GTM-vs-features route. Use
  for "is this ready?", "should I launch?", "market fit check".
inputs:
  required:
    - { path: "docs/specs/vision.md", artifact: vision }
  optional:
    - { path: "docs/specs/personas/", artifact: personas }
    - { path: "docs/specs/journeys/", artifact: journeys }
    - { path: "docs/specs/work-items/INDEX.md", artifact: work-items }
    - { path: "docs/specs/analyze-competitors.md", artifact: competitors }
    - { path: "docs/specs/project-state.md", artifact: project-state }
    - { path: "~/.svc/builder-profile.md", artifact: builder-profile }
outputs:
  produces:
    - { path: "docs/specs/readiness-assessment.md", artifact: readiness }
phases:
  - id: P1-StageModeAndEvidenceGathering
    trigger: always
    reads: ["docs/specs/vision.md", "docs/specs/personas/", "docs/specs/journeys/", "docs/specs/work-items/INDEX.md", "docs/specs/analyze-competitors.md", "docs/specs/project-state.md", "~/.svc/builder-profile.md", "visual and E2E result paths"]
    writes: ["stage mode and evidence inventory notes"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P2-DimensionScoring
    trigger: after:P1-StageModeAndEvidenceGathering
    reads: ["stage mode", "evidence inventory", "8-dimension scoring rubric"]
    writes: ["dimension scores and weighted overall score"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P3-JudgeSimulation
    trigger: after:P2-DimensionScoring
    reads: ["dimension scores", "stage-specific judge prompts", "project artifacts"]
    writes: ["judge verdict notes"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P4-GapClassification
    trigger: after:P3-JudgeSimulation
    reads: ["dimension scores", "judge verdict notes", "open WI state"]
    writes: ["blocking, action-locked, and traction-locked gap notes"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P5-ICPSimulation
    trigger: after:P4-GapClassification
    reads: ["vision", "personas", "web research results when launch/vc mode"]
    writes: ["ICP exemplar and adoption-likelihood notes"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P6-RoutingDecision
    trigger: after:P5-ICPSimulation
    reads: ["overall score", "blocking gaps", "routing table"]
    writes: ["single-position Next routing decision"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P7-AssessmentArtifactAndCommit
    trigger: after:P6-RoutingDecision
    reads: ["dimension scores", "judge verdict notes", "gap notes", "routing decision"]
    writes: ["docs/specs/readiness-assessment.md", "git commit"]
    evidence_kind: file
    required_for_completion: true
  - id: P8-SelfVerifyContinuation
    trigger: after:P7-AssessmentArtifactAndCommit
    reads: ["Self-Verify table", "docs/specs/readiness-assessment.md", ".svc/lane-tasks-<WI>.json"]
    writes: [".svc/lane-tasks-<WI>.json"]
    evidence_kind: command_output
    required_for_completion: true
chain:
  lanes: {}
  progressive: false
  self_verify: true
  human_checkpoint: false
---

# Market Readiness Assessment

The pipeline knows everything it needs to answer "is this ready?" — vision,
journeys, work items, competitors, visuals, test results, builder profile.
This skill reads those artifacts and scores readiness. It never asks the user
for information the pipeline already has.

**Announce at start:** "I'm using assess-market-readiness to score product readiness for [stage]."

## When to Invoke

1. **Automatically from `route-workflow`:** when active task graphs = 0 AND no
   critical/high severity WIs remain AND user asks "what's next?"
2. **Explicitly:** user says "is this ready?", "should I launch?", "hackathon
   judge", "VC review", "assess readiness", "market fit"
3. **After `verify-promotion`:** when the last WI in a milestone closes

## Modes

| Mode | Flag | What it judges | Who it simulates |
|---|---|---|---|
| **Launch** | `--stage launch` (default) | Ready for first paying customers? | Synthetic target user + YC partner |
| **Hackathon** | `--stage hackathon` | Would this win? | 3-person hackathon judge panel |
| **VC** | `--stage vc` | Would a seed investor take a meeting? | Seed-stage VC partner |
| **PMF** | `--stage pmf` | Does it have product-market-fit? | Retention analyst + power user |

Default mode is `launch` if not specified.

## Process

### Step 1: Gather project evidence (no user input)

Read these artifacts automatically — do NOT ask the user for any of this:

```bash
# Required
cat docs/specs/vision.md

# Optional but critical for scoring
ls docs/specs/personas/P*.md 2>/dev/null | head -10
ls docs/specs/journeys/J*.feature.md 2>/dev/null | head -30
cat docs/specs/work-items/INDEX.md 2>/dev/null
cat docs/specs/analyze-competitors.md 2>/dev/null
cat docs/specs/project-state.md 2>/dev/null
cat ~/.svc/builder-profile.md 2>/dev/null

# Visual baseline state
ls docs/specs/visuals/baseline/ 2>/dev/null | wc -l
ls .svc/visuals/ 2>/dev/null

# E2E pass rate (most recent run)
ls e2e/results/ 2>/dev/null || ls test-results/ 2>/dev/null
```

If critical artifacts are missing, that's a finding — not a blocker for
assessment. Score the missing dimension as 0 and flag it as a blocking gap.

**Step 2: Score across 8 dimensions** — Score each dimension 0-100 with weights by mode (launch, hackathon, VC, PMF): product completeness, user value clarity, competitive position, visual quality, technical reliability, monetization readiness, distribution readiness and market timing. A missing artifact scores 0 and is flagged as a blocking gap (for example no `analyze-competitors.md`); market timing defaults to 50 with no data. Remember the ceiling: a pre-launch product realistically scores 78-82, launch mode wins at 70+, anything above 85 at launch is probably inflated, and traction-locked dimensions (distribution, competitive position, market timing) improve only after shipping, so do not optimize them pre-launch. Details: `references/process.md`.

### Step 3: Simulate judge roles

Based on the mode, simulate the appropriate judge(s). Each judge reads
the dimension scores and produces a verdict.

#### Launch mode: Synthetic Target User + YC Partner

**Synthetic Target User** (from persona P1 or primary persona):
- "Would I use this product today, as it is?"
- "What's missing that would make me choose a competitor instead?"
- "Would I pay [pricing tier amount] for this?"
- "What would make me tell a friend about this?"

**YC Partner** (from gstack `/office-hours` 6 forcing questions, adapted):
1. What's the strongest evidence someone actually wants this?
2. What are users doing right now to solve this? (status quo)
3. What's the smallest version someone would pay for this week?
4. Have you watched someone use this without helping them?
5. Does this get more or less essential as the world changes?
6. What's the implementation path from here to $1K MRR?

Answer each from the project artifacts. If the artifact doesn't provide
enough evidence, that's a gap — score it, don't ask the user.

#### Hackathon mode: 3-person panel

Simulate 3 judges scoring independently:
- **Technical judge:** innovation, code quality, technical ambition
- **Design judge:** UX/UI polish, creativity, visual impact
- **Business judge:** market relevance, viability, user need

Each scores 0-10 on: Novelty, Completeness, Presentation potential,
Technical ambition, User impact. Average across judges.

#### VC mode: Seed-stage investor

Score against VC lens:
- **Market:** TAM/SAM/SOM estimate (from competitors + domain)
- **Traction:** any usage data, signups, revenue?
- **Team/Builder:** from builder profile — can this person execute?
- **Defensibility:** moat rating from competitor analysis
- **Timing:** why now? (from market timing dimension)

Verdict: "Would take a meeting" / "Need more traction" / "Pass"

#### PMF mode: Retention analyst + Power user

- **Retention signals:** is there a habit loop? daily/weekly usage pattern?
- **Expansion signals:** would users want more? (from feature backlog)
- **Power user simulation:** "I've been using this for 3 months — am I still finding value?"

### Step 4: Identify gaps

From the scored dimensions, classify gaps:

**Blocking gaps** (must fix before this stage's target):
- Any dimension scoring below 30
- Any critical/high WI still open
- Missing payment flow (for launch mode)
- No distribution channel identified (for launch mode)

**Action-locked non-blocking gaps** (can fix before first customer — do these first):
- Configuration gaps (payment mode, environment variables)
- Copy/messaging gaps (hero text, value prop clarity)
- Visual polish gaps (specific broken screens, a11y issues)
- Dimensions scoring 30–60 where the fix is a defined task

**Traction-locked non-blocking gaps** (can only improve AFTER first customer — do NOT block launch on these):
- Distribution: channels, audience, word-of-mouth, reviews
- Competitive position: customer quote evidence, moat validation by churn data
- Market timing: validated by real traction, not market research alone
- For each: note what the score looks like at 10 customers vs 100 customers

**Rule:** Never block a 70+ scoring product on traction-locked gaps. The act of
shipping is what unlocks them. Shipping first is the only way to improve them.

### Step 5: ICP simulation (launch and VC modes only)

After scoring, identify who would actually use this product and whether
they're reachable.

**Step 5a: Extract ICP definition**

From vision + personas, extract:
- Business type and size (e.g., "independent café, 1-3 locations, <20 employees")
- Geographic signal (e.g., "urban, English-speaking markets")
- Pain signature (e.g., "empty tables during off-peak, no loyalty program")
- Current tool stack (e.g., "Square POS, Instagram, paper punch cards")
- Budget range (from pricing tiers)

**Step 5b: Find real exemplars**

Use WebSearch to find 5–10 real businesses or people matching the ICP:
- "[business type] [city]" (e.g., "independent café Portland")
- "[business type] looking for [solution]" on Reddit, forums
- "[business type] reviews of [competitor]" (people actively shopping)
- LinkedIn search for role + industry + company size

For each exemplar, note:
- Name/handle (if public)
- How you found them (search query)
- Evidence of the pain (post, review, forum thread)

**Step 5c: Simulate adoption likelihood**

For each exemplar, score adoption (0–100):

| Factor | Weight | How to score |
|---|---|---|
| Pain match | 30% | Does their public content show the exact pain we solve? |
| Tool stack gap | 25% | Are they using something worse, or nothing at all? |
| Switching cost | 20% | How hard is it to switch from current solution? (lower = higher score) |
| Price fit | 15% | Can they afford our pricing based on business size signals? |
| Reachability | 10% | Can the builder actually contact them via existing channels? |

**Step 5d: Cold outreach brief per exemplar**

For the top 5 scoring exemplars, produce:

```markdown
### [Business/Person Name]
- **Found via:** [search query / platform]
- **Pain evidence:** [specific quote or post]
- **Current solution:** [what they use now]
- **Adoption score:** [0-100]
- **Lead with:** [specific value prop that matches their pain]
- **Don't mention:** [features they don't care about]
- **Channel:** [how to reach them — email, DM, forum reply]
- **Objection to prepare for:** [likely pushback]
```

### Step 6: Route decision

Based on the overall readiness score:

| Overall score | Routing | What to do |
|---|---|---|
| 70–100 | **GTM first** | Product is ready. Start outreach. Route to `/launch` or `/ai-cold-outreach`. Features can continue in parallel but are not blocking. |
| 40–69 | **Fix blocking gaps, then GTM** | Identify the 1-3 blocking gaps. Route to the WI or skill that closes each gap. Re-assess after. |
| 0–39 | **Build more** | Product is not ready. Route to the highest-severity open WI or the lowest-scoring dimension's fix skill. |

**The routing decision MUST be a single `**Next:**` line** — not "you could
either..." hedging. The pipeline takes a position.

> **Score interpretation reminder for the output:** After the routing table,
> include one sentence explaining what the score means in context. Example:
> "73/100 at launch stage is the win condition (threshold: 70). Action-locked
> gaps below are fixable this week. Traction-locked gaps (distribution,
> competitive position) improve automatically as customers arrive — do not delay
> launch waiting for them."

**Step 7: Write assessment** — Write `docs/specs/readiness-assessment.md` containing: header (date, stage, overall score, verdict GTM first / Fix gaps then GTM / Build more), the dimension score table (score, weight, weighted, key finding), judge verdicts, blocking and non-blocking gaps (each with dimension, score and a specific fix), the ICP simulation if applicable, a score-evolution roadmap (today, after 10 customers, after 100), and a routing decision naming the exact next skill or WI. Missing critical artifacts are findings, not blockers for the assessment itself. Details: `references/process.md`.

### Step 8: Commit the assessment to git

After producing the assessment file, commit it so it's versioned and traceable:

```bash
git add docs/specs/readiness-assessment.md
git commit -m "docs(readiness): [stage] assessment — [score]/100, [verdict]"
# Optional: tag the milestone for easy reference
# git tag "assessment-[stage]-$(date +%Y-%m-%d)"
```

**Why commit:** the assessment is a milestone snapshot. It should be in version
control so future assessments can compare against it and so the git log shows
the progression from build → launch. An uncommitted assessment file is invisible
to the project history and can be silently overwritten.

**Why not auto-tag:** tagging creates a public milestone marker. Some builders
want this; others don't. Tag if the assessment verdict is "GTM first" and the
builder treats this as the official launch decision. Skip the tag if this is
a routine re-assessment mid-build.

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | `docs/specs/readiness-assessment.md` exists | `test -f` | |
| 2 | All 8 dimensions scored | count dimension rows in output | |
| 3 | At least one judge verdict present | grep for judge role headers | |
| 4 | Blocking gaps identified (or explicitly empty) | grep for "Blocking Gaps" section | |
| 5 | Routing decision is a single position, not hedge | grep for "Routing Decision" — no "you could either" | |
| 6 | ICP exemplars found (launch/vc modes) | count exemplar briefs ≥ 3 | |
| 7 | No user input was requested for data the pipeline already has | review tool calls — no AskUserQuestion for artifact data | |
| 8 | Assessment committed to git | `git log --oneline docs/specs/readiness-assessment.md \| head -1` returns a commit | |
| 9 | Score Evolution Roadmap present in output | grep for "Score Evolution Roadmap" in readiness-assessment.md | |

## Phase Receipt Contract

When this skill runs inside a task graph, emit one receipt per completed phase
before marking the task complete:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-StageModeAndEvidenceGathering --evidence command_output:.svc/assess-market-readiness-evidence-<WI>.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-DimensionScoring --evidence command_output:.svc/assess-market-readiness-scoring-<WI>.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-JudgeSimulation --evidence command_output:.svc/assess-market-readiness-judges-<WI>.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-GapClassification --evidence command_output:.svc/assess-market-readiness-gaps-<WI>.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-ICPSimulation --evidence command_output:.svc/assess-market-readiness-icp-<WI>.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-RoutingDecision --evidence command_output:.svc/assess-market-readiness-routing-<WI>.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P7-AssessmentArtifactAndCommit --evidence file:docs/specs/readiness-assessment.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P8-SelfVerifyContinuation --evidence command_output:.svc/assess-market-readiness-self-verify-<WI>.log
```

If the mode does not require ICP simulation, record
`P5-ICPSimulation` with explicit skip evidence. If no task graph exists, report
the same phase evidence in the assistant response.

## Anti-Sycophancy Rules

These rules apply to every judge simulation in this skill:

- **Never say** "This is a promising product" without evidence of traction
- **Never inflate** scores to make the builder feel good — a 35 is a 35
- **Take a position** on every dimension. "It depends" is not a score.
- **If the product isn't ready, say so.** The builder needs truth, not comfort.
- **Score the product, not the effort.** "You've done a lot of work" is irrelevant
  to readiness. The market doesn't grade on effort.

## Pipeline Continuation

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`)
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume; on Codex, mirror only the active step in `update_plan`.
- Routing, parent-only host mirroring, completion/skip/next-task loading: `references/task-graph-chaining-protocol.md`.

### Chaining

This skill routes to the next action based on its readiness score.
The `**Next:**` trailer names the exact next skill or WI.

## Post-Compaction Recovery

Follow `references/task-graph-chaining-protocol.md` § Post-compaction recovery (lane-tasks file is the sole source of truth; never ghost-complete).
