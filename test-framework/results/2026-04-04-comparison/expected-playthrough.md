# Expected Full Playthrough: S1 Scenario

> What SHOULD happen when each methodology runs against the S1 prompt.
> This is the test script for the next comparison run.

**The prompt (given identically to all four):**
"I want to make an app that suggests what to learn for AI based on what is trendy in social platforms today. Three deployment modes: (1) self-hosted free — anyone can run it themselves at no cost, (2) hosted for profit — someone hosts it and charges their users a subscription to use the tool, (3) self-hosted private — a company hosts it internally for their own team's use."

**Operator role:** When a skill asks questions, the operator answers as a technical founder who wants to ship fast, prefers simpler options, and stays consistent with the prompt. Answers are terse and decisive.

---

## 1. Serious Vibe Coding — Full 19-Skill Pipeline

### Skill 1: `write-vision`
- **Invoke:** `Skill: write-vision`
- **Input:** The S1 prompt verbatim
- **Expected behavior:** Creates or proposes `docs/specs/vision.md` with 12 canonical sections
- **Questions it may ask:** "Is this a new product or an evolution of an existing one?" → Answer: "New product, greenfield."
- **Output:** `docs/specs/vision.md` — must capture the three deployment modes in Section 3 (Who We Serve) and Section 4 (Value Proposition)
- **Verify before proceeding:** Does section 3 name all three modes? If not, tell it: "You missed the three deployment modes from my original prompt."

### Skill 2: `build-personas`
- **Invoke:** `Skill: build-personas`
- **Input:** Reads vision.md automatically
- **Expected behavior:** Mode 7 (Auto-Discovery from vision). Should produce at least P1 (individual learner), P2 (team lead / enterprise), P3 (platform operator for hosted mode)
- **Questions it may ask:** Approval of discovered personas → Answer: "Yes, those cover it."
- **Output:** `docs/specs/personas/P1.md`, `P2.md`, `P3.md`, `PERSONA_INDEX.md`
- **Verify:** P3 (platform operator) exists — this persona is the one who cares about deployment modes

### Skill 3: `route-workflow`
- **Invoke:** `Skill: route-workflow`
- **Input:** Project state (vision exists, personas exist, no specs yet)
- **Expected behavior:** Recommends `validate-feature` as next skill
- **Output:** Routing recommendation
- **Verify:** It suggests validate-feature, not write-spec directly

### Skill 4: `validate-feature`
- **Invoke:** `Skill: validate-feature`
- **Input:** Vision + personas + original prompt
- **Expected behavior:** 3-tier scan, asks business questions, produces Ship Brief
- **Questions it will ask:** Business questions about scope, priority, etc. → Answer concisely: "Focus on the trend aggregation and recommendation engine first. All three deployment modes from day one — that's the differentiator."
- **Output:** `docs/specs/features/YYYY-MM-DD-ai-trend-learning-brief.md`
- **Verify:** Ship Brief mentions deployment modes as a scope item

### Skill 5: `write-spec`
- **Invoke:** `Skill: write-spec`
- **Input:** Ship Brief
- **Expected behavior:** Creates DRAFT feature spec with user stories and ACs
- **Questions it may ask:** Clarifications about feature scope → Keep answers terse
- **Output:** `docs/specs/features/feature-trend-learning.md` with:
  - US for setup/config
  - US for viewing trends
  - US for getting recommendations
  - US for tracking skills
  - **US for deployment mode behavior** (NEW — this was missing in the actual run)
  - AC table with `DEPLOY-01: DEPLOY_MODE env var controls auth and feature gating`, `DEPLOY-02: Mode badge visible in UI`, `DEPLOY-03: Self-hosted free mode requires no login`, etc.
  - **Zero-state AC**: `SETUP-ZERO: App shows trending topics and default recommendations before user completes profile setup`
  - System dependencies (cascade discovery)
- **Verify:** (a) Deployment mode ACs exist, (b) Zero-state AC exists, (c) Cascade deps identified

### Skill 6: `audit-ac`
- **Invoke:** `Skill: audit-ac`
- **Input:** Feature specs
- **Expected behavior:** Audits AC tables, converts old formats, ensures shared contract format
- **Output:** Audited AC tables with consistent format

### Skill 7: `write-journeys`
- **Invoke:** `Skill: write-journeys`
- **Input:** Specs + personas
- **Expected behavior:** Mode 1 (Bootstrap). Creates journey docs in Gherkin format. Layer 3 analysis finds ungrounded preconditions.
- **Output:** `docs/specs/journeys/J01-*.feature.md`, `J02-*.feature.md`, etc. + `JOURNEY_INDEX.md`
- **Verify:** Layer 3 findings flag dependencies (trend scraping service, recommendation engine)

### Skill 8: `design-ux`
- **Invoke:** `Skill: design-ux`
- **Input:** DRAFT spec + personas + journeys
- **Expected behavior:** Screen inventory, state machines, flow diagram, error states, responsive strategy
- **Questions it may ask:** UX choices → Answer simply, e.g., "Dashboard as home page. Trends on the left, recommendations on the right."
- **Output:** `docs/specs/ux/trend-learning.md`
- **Verify:** Screen inventory includes a settings/config screen showing deployment mode

### Skill 9: `design-ui`
- **Invoke:** `Skill: design-ui`
- **Input:** UX design + spec
- **Expected behavior:** Component specs, design tokens, visual hierarchy, responsive layout. Creates design-system.md if it doesn't exist.
- **Output:** `docs/specs/ui/trend-learning.md` + `docs/specs/design-system.md`
- **Verify:** Component list includes a deployment mode badge/indicator and a mode settings panel

### Skill 10: `design-tech`
- **Invoke:** `Skill: design-tech`
- **Input:** DESIGNED spec + all designs
- **Expected behavior:** Architecture, data model, feasibility matrix against ACs, risks, trade-offs
- **Output:** Technical design section added to feature spec. Status → BASELINED
- **Verify:** Feasibility matrix shows deployment mode ACs as feasible with specific implementation approach (env var + middleware)

### Skill 11: `review-gate`
- **Invoke:** `Skill: review-gate`
- **Input:** BASELINED spec
- **Expected behavior:** Self-review, self-judgment, cross-review. G4 gate check.
- **Output:** Findings list. Pass/fail decision.
- **Verify:** If findings mention deployment modes are under-specified, that's a GOOD catch. Fix and re-review.

### Skill 12: `plan-changeset`
- **Invoke:** `Skill: plan-changeset`
- **Input:** BASELINED spec + all designs
- **Expected behavior:** Writes actual code into worktree. All 8 parts. TDD order.
- **Vision cross-check (NEW):** Before finalizing, re-reads vision sections 3-4 and verifies every AC has code.
- **Output:** Full code in worktree + `docs/plans/YYYY-MM-DD-trend-learning/manifest.md`
- **Verify:** (a) `src/config.ts` has DEPLOY_MODE, (b) middleware for mode exists, (c) zero-state recommendations work, (d) unit tests exist

### Skill 13: `land-changeset`
- **Invoke:** `Skill: land-changeset`
- **Input:** Change set in worktree
- **Expected behavior:** Commits code on feature branch. Deviation check.
- **Output:** Committed code. Spec status → PROMOTED

### ⚡ Start the server here
```bash
cd /tmp/svc-test-S1-svc && npm install && npm start &
# Wait for http://localhost:3000
```

### Skill 14: `verify-promotion`
- **Invoke:** `Skill: verify-promotion`
- **Input:** Promoted code + specs
- **Expected behavior:** Runs validation commands, checks for deviations
- **Output:** Verification report. Spec status → VERIFIED

### Skill 15: `sync-spec-code`
- **Invoke:** `Skill: sync-spec-code`
- **Input:** Specs + code in worktree
- **Expected behavior:** For each AC, finds the code that implements it. Updates AC status from PLANNED to RESOLVED with file:line references.
- **Output:** Updated feature spec with RESOLVED annotations
- **Verify:** Deployment mode ACs show as RESOLVED (or DRIFT if missing)

### Skill 16: `test-journeys`
- **Invoke:** `Skill: test-journeys`
- **Input:** Journeys + live server URL (http://localhost:3000)
- **Expected behavior:** Tests each journey scenario against the running server. Updates QA column in AC tables.
- **Output:** QA column updates (✅ / ❌ per AC)
- **Verify:** Server must be running. Check QA results for zero-state AC.

### Skill 17: `write-e2e`
- **Invoke:** `Skill: write-e2e`
- **Input:** Journeys + ACs
- **Expected behavior:** Generates Playwright test files AND runs them against localhost:3000
- **Output:** E2E test files + test results (pass/fail)

### Skill 18: `analyze-marketing`
- **Invoke:** `Skill: analyze-marketing`
- **Input:** Feature specs
- **Expected behavior:** Mode 4 (Foundation) then Mode 2 (Single Feature)
- **Output:** `.agents/product-marketing-context.md`

### Skill 19: `test-framework`
- **Invoke:** `Skill: test-framework`
- **Input:** All outputs from skills 1-18
- **Expected behavior:** Coverage report, metrics
- **Output:** Coverage + metrics report

**Total expected skill invocations:** 19
**Total expected user interactions:** ~8-12 (vision approval, persona approval, validate-feature questions, spec clarifications, UX choices, review decisions)

---

## 2. gstack — Office Hours + Review Pipeline + Build + QA

### Step 1: `/office-hours` (Builder mode — this is a side project / tool)
- **Invoke:** `Skill: office-hours`
- **Input:** The S1 prompt verbatim
- **Expected behavior:** Detects builder mode (this is a tool/product, not a startup with revenue yet). Asks questions ONE AT A TIME via AskUserQuestion.
- **Phase 2B questions and expected answers:**

  **Q: "What's the coolest version of this?"**
  → "An app that tells you exactly what to learn next in AI based on what people are actually talking about today — not what a course says. Personalized to your level. And it works in three modes: free self-hosted, paid SaaS, or private enterprise."

  **Q: "Who would you show this to? What would make them say 'whoa'?"**
  → "AI engineers who waste hours scrolling Twitter and Reddit trying to figure out what's worth learning. The 'whoa' moment is opening the app and seeing 'Here's what's trending in AI today, and here's what YOU should learn based on your skills.'"

  **Q: "What's the fastest path to something you can actually use or share?"**
  → "A single web page that shows trending AI topics from social media and suggests learning resources. Mock data is fine for now — real API integration later."

  **Q: "What existing thing is closest to this, and how is yours different?"**
  → "Hacker News trending is close but not personalized and not AI-focused. Daily.dev is close but no learning recommendations. Mine combines trend detection with personalized learning suggestions, and the three deployment modes make it unique."

  **Q: "What would you add if you had unlimited time?"**
  → "Real-time scraping of Twitter/X, Reddit, HN, YouTube, LinkedIn. LLM-powered personalization. Learning path generation. Team dashboards for the enterprise mode. Skill gap analysis."

- **Phase 2.75 (Landscape Awareness):** Skill may WebSearch for "AI learning recommendation tool" — answer "Yes, search away" if asked.

- **Phase 3 (Premise Challenge):** Presents premises for agreement:
  ```
  PREMISES:
  1. People want AI learning recommendations based on social trends — agree/disagree?
  2. Mock data is sufficient for MVP; real scraping is Phase 2 — agree/disagree?
  3. Three deployment modes are the differentiator — agree/disagree?
  ```
  → "Agree on all three."

- **Phase 3.5 (Cross-model second opinion):** "Want a second opinion?" → "No, proceed to alternatives."

- **Phase 4 (Alternatives):** Presents 2-3 approaches. → Pick the recommended one (likely "monolith with config-driven modes").

- **Phase 5 (Design doc):** Writes design doc to `~/.gstack/projects/{slug}/` or `docs/`

- **Output:** Design doc with problem statement, constraints, premises, chosen approach, success criteria

### Step 2: `/design-consultation`
- **Invoke:** `Skill: design-consultation`
- **Input:** Reads design doc from Step 1
- **Expected behavior:** Proposes a complete design system — aesthetic, typography, colors, spacing, motion. Researches landscape. Generates font+color preview pages.
- **Questions:** "What's the vibe? Dark/light? Techy/friendly?" → "Dark mode, techy, developer-focused. Think terminal meets dashboard."
- **Output:** `DESIGN.md` with full brand spec, color palette, typography scale, component patterns

### Step 3: `/autoplan` (auto-review pipeline)
- **Invoke:** `Skill: autoplan`
- **Input:** Design doc from Step 1
- **Expected behavior:** Runs CEO review → design review → eng review sequentially with auto-decisions. Surfaces taste decisions for final approval.
- **Questions:** May surface 2-3 taste decisions for approval → Answer decisively
- **Output:** Fully reviewed plan with review report appended to design doc

### Step 4: Write code
- **No skill — direct coding** guided by the reviewed plan and DESIGN.md
- Write Express + TypeScript + EJS app with SQLite
- Must implement DEPLOY_MODE env var, mode middleware, mode badge in UI
- Must include all three deployment modes as the design doc specified
- Server on port 3001

### Step 5: `/qa`
- **Invoke:** `Skill: qa`
- **Input:** Running server URL (http://localhost:3001)
- **Expected behavior:** Opens headless browser via browse daemon, systematically tests pages, finds bugs, fixes them with atomic commits
- **Output:** Bug fixes committed, regression tests generated

### Step 6: `/review`
- **Invoke:** `Skill: review`
- **Input:** git diff of all changes
- **Expected behavior:** Checks for SQL safety, LLM trust boundaries, conditional side effects
- **Output:** Review findings, auto-fixes for obvious issues

### Step 7: `/ship` (optional)
- **Invoke:** `Skill: ship`
- **Expected behavior:** Version bump, changelog, PR creation
- **Output:** PR ready for review

**Total expected skill invocations:** 6-7
**Total expected user interactions:** ~10-15 (office-hours questions, design consultation vibe, autoplan taste decisions, QA approval)

---

## 3. obra / Superpowers — Brainstorm → Plan → TDD → Execute → Review → Verify

### Step 1: `superpowers:brainstorming`
- **Invoke:** `Skill: superpowers:brainstorming`
- **Input:** The S1 prompt verbatim
- **Expected behavior (per SKILL.md checklist):**
  1. Explore project context (check files, docs, recent commits)
  2. Offer visual companion if needed → Probably not needed for backend-heavy
  3. Ask clarifying questions ONE AT A TIME:

  **Q: "What's the primary goal — trend discovery, learning recommendations, or both?"**
  → "Both. Show what's trending in AI on social media, then suggest what to learn based on those trends."

  **Q: "Who are the main users?"**
  → "Individual learners who self-host for free, and teams/companies who use hosted or private versions."

  **Q: "What social platforms should we track?"**
  → "Twitter/X, Reddit, Hacker News at minimum. Mock data for now."

  **Q: "How should recommendations work?"**
  → "Match trending topics to learning resources. Score by relevance to the user's skill level if they've set one, otherwise just show popular ones."

  **Q: "Any tech stack preferences?"**
  → "Node.js, TypeScript, Express, EJS, SQLite. Keep it simple."

  4. Propose 2-3 approaches with trade-offs and recommendation
  5. Present design in sections, get user approval after each
  6. Write design doc to `docs/superpowers/specs/YYYY-MM-DD-trendlearn-design.md` and commit
  7. Spec self-review (check for placeholders, contradictions, ambiguity)
  8. User reviews written spec → "Looks good, proceed."
  9. Transition: invoke writing-plans

- **Output:** `docs/superpowers/specs/2026-04-04-trendlearn-ai-design.md` — committed

### Step 2: `superpowers:writing-plans`
- **Invoke:** `Skill: superpowers:writing-plans`
- **Input:** Design doc from Step 1
- **Expected behavior:**
  1. File map — every file with its responsibility
  2. Bite-sized tasks (2-5 min each): "write failing test" → "run it" → "implement" → "run tests" → "commit"
  3. Each task specifies which files to touch and what to test
- **Output:** `docs/superpowers/plans/2026-04-04-trendlearn-ai.md` with task list
- **Verify:** Plan includes tasks for all three deployment modes and zero-state UX

### Step 3: `superpowers:test-driven-development` (woven into execution)
- **Not a standalone invocation** — TDD discipline is enforced DURING execution
- **Iron Law:** No production code without a failing test first
- Every feature gets: write test → see it fail → write minimal implementation → see it pass → refactor → commit

### Step 4: `superpowers:executing-plans`
- **Invoke:** `Skill: superpowers:executing-plans`
- **Input:** Plan from Step 2
- **Expected behavior:**
  1. Load plan, identify next batch of tasks (default: 3 at a time)
  2. For each task: review relevant code → execute → run tests → commit
  3. After each batch: architect review (check alignment with design doc)
  4. Report progress after each batch
- **Questions between batches:** "Batch 1 complete (types + database + seed data). Tests passing. Continue?" → "Yes, continue."
- **Output:** Implemented code in worktree, tests passing, committed per task

### Step 5: Start the server
```bash
cd /tmp/svc-test-S1-obra && npm install && npm run build && npm start &
```

### Step 6: `superpowers:requesting-code-review`
- **Invoke:** `Skill: superpowers:requesting-code-review`
- **Input:** Git diff of all changes
- **Expected behavior:** Dispatches code-reviewer subagent with two-stage review (spec compliance, then code quality)
- **Output:** Review findings

### Step 7: `superpowers:verification-before-completion`
- **Invoke:** `Skill: superpowers:verification-before-completion`
- **Input:** Running server + test results
- **Expected behavior:** Runs verification commands, confirms output before making success claims. "Evidence before assertions."
- **Output:** Verification evidence (server responds, tests pass, features work)

### Step 8: `superpowers:finishing-a-development-branch`
- **Invoke:** `Skill: superpowers:finishing-a-development-branch`
- **Input:** Verified code
- **Expected behavior:** Presents 4 options: merge, PR, keep branch, discard
- **Questions:** "How would you like to proceed?" → "Keep the branch for comparison."
- **Output:** Branch preserved

**Total expected skill invocations:** 6-7
**Total expected user interactions:** ~8-12 (brainstorming Q&A, design approval, spec review, batch continue, branch decision)

---

## 4. Raw — Single Prompt

### The only step
- **No skills invoked**
- **Input:** "Build [the S1 prompt]. Produce a complete, runnable Node.js application with Express, TypeScript, EJS views, and SQLite. Include mock/seed data for trending AI topics from social platforms. Implement all three deployment modes with a DEPLOY_MODE environment variable. The server must listen on port 3003. Make the homepage show useful content immediately without requiring any setup."
- **Expected behavior:** Agent writes all files directly, installs dependencies, starts server
- **Output:** Running server on port 3003

**Total expected skill invocations:** 0
**Total expected user interactions:** 0

---

## Comparison Execution Checklist

After all four approaches complete:

- [ ] All four servers running (ports 3000, 3001, 3002, 3003)
- [ ] Phase 0 expectations scored for all four
- [ ] Methodology usage audit completed (skills invoked vs recommended)
- [ ] Suite 8 (first-time UX) run against all four
- [ ] Suite 9 (vision-to-code traceability) run against svc
- [ ] File counts, LOC, test counts collected
- [ ] Deployment mode code evidence grepped in all codebases
- [ ] comparison.json and comparison.md written
- [ ] Worktrees closed

## Time Budget Estimate

| Approach | Estimated skill invocations | Estimated user interactions | Estimated time |
|----------|---------------------------|----------------------------|----------------|
| Serious Vibe Coding | 19 | 8-12 | 45-60 min |
| gstack | 6-7 | 10-15 | 30-40 min |
| obra | 6-7 | 8-12 | 30-40 min |
| Raw | 0 | 0 | 5-10 min |
| Measurement | N/A | N/A | 15-20 min |
| **Total** | | | **~2-3 hours** |

Run sequentially (not parallel) so the operator can play the user role for each.
