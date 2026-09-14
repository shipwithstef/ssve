# svc Skills Catalog — Detail

Source: */SKILL.md (77 files)
Extracted: 2026-05-09

## Pre-Pipeline Skills (4)

### mine-builder
**Purpose:** Mine builder context — finances, time, skills, team, social presence, tools, entity, goals, project history, failure patterns
**Inputs:** optional builder-profile
**Outputs:** ~/.svc/builder-profile.md
**Lanes:** none (standalone)
**Key:** Interview-based profiling that persists globally across projects. Failure patterns adjust kill signal sensitivity in validate-feature.

### find-opportunity
**Purpose:** Reverse-engineer what's making money NOW, match to builder skills/distribution, score and rank opportunities
**Inputs:** required builder-profile; optional vision
**Outputs:** docs/specs/opportunities/top-3-opportunities.md
**Lanes:** none (standalone)
**Key:** Market scan + builder advantage matching. Revenue target: $1K/mo minimum.

### stage-revenue
**Purpose:** Break big idea into revenue stages — Stage 1 (fast money 1-2 weeks), Stage 2 (reinvest), Stage 3 (the real thing)
**Inputs:** required builder-profile + vision-or-feature-brief
**Outputs:** docs/specs/staging-plan.md
**Lanes:** none (standalone)
**Key:** Prevents builder burnout by ensuring income before the big build.

### route-workflow
**Purpose:** Universal entry point — routes freeform intent to the right skill/lane
**Inputs:** optional builder-profile, project-state
**Outputs:** (routes to another skill)
**Lanes:** none (router)
**Key:** Autorun mode with P0 virtual founder. Freeform text matching. Adaptive communication based on user technical level.

## Pipeline Skills — Vision & Discovery (8)

### write-vision
**Purpose:** Create/refine/convert product vision documents
**Outputs:** docs/specs/vision.md (status: ACTIVE)
**Position:** greenfield:1
**Key:** 3 intents (create, refine, convert). Evidence-first, proposal-first workflow. Supports bootstrap and convert repo modes.

### analyze-domain
**Purpose:** Identify and build domain expertise
**Outputs:** docs/specs/domain-profile.md
**Position:** greenfield:2
**Key:** Reads knowledge library first, fills gaps with research. Writes back to library for future projects.

### analyze-competitors
**Purpose:** Systematic product intelligence on up to 20 competitors across 4 tiers (direct/adjacent/emerging/macro) with moat scoring
**Outputs:** docs/specs/analyze-competitors.md
**Position:** greenfield:3
**Key:** Finds whitespace and differentiation opportunities. NOT marketing copy — product decisions.

### build-personas
**Purpose:** Build user personas from vision, specs, domain, and competitor data
**Outputs:** docs/specs/personas/P*.md + PERSONA_INDEX.md
**Position:** greenfield:4
**Key:** 7 modes (build/refresh, audit, add, expand, interview, discover gaps, tiered auto-discovery). Trust tiers for progressive detail.

### validate-feature
**Purpose:** Cross-validate feature ideas against personas, journeys, and specs
**Outputs:** docs/specs/features/*-brief.md (Ship Brief or NO-SHIP)
**Position:** greenfield:5, brownfield-feature:2
**Key:** 7 kill signals (K1-K7). Produces Ship Brief for approved features or NO-SHIP evidence package with pivot alternatives.

### discuss-phase
**Purpose:** Resolve bounded gray areas into a durable discussion artifact with explicit next-step routing
**Outputs:** docs/specs/discussions/<topic>.md
**Position:** conditional interstitial after `validate-feature`, `write-spec`, `design-ux`, or `design-tech` when unresolved one-way-door ambiguity remains
**Key:** Captures 3-7 gray areas with evidence, decisions, blockers, and reroute status. Downstream skills must treat settled rows as fixed constraints unless a later revision explicitly supersedes them.

### write-spec
**Purpose:** Define feature as DRAFT spec with user stories, ACs, and system dependencies
**Outputs:** docs/specs/features/<name>.md (status: DRAFT)
**Position:** greenfield:6, brownfield-feature:3
**Key:** Consumer-first stories. Feature/Enabler/Integration cascade discovery. Supports greenfield and brownfield delta-spec work.

### audit-ac
**Purpose:** Ensure every User Story has complete, testable acceptance criteria
**Outputs:** (same spec, audited)
**Position:** greenfield:7
**Key:** Rewrites vague ACs and writes missing ones. Single feature or all-features mode.

### write-journeys
**Purpose:** Generate BDD journey docs with Gherkin scenarios and AC traceability
**Outputs:** docs/specs/journeys/J*.feature.md + JOURNEY_INDEX.md
**Position:** greenfield:8, brownfield-feature:4, drift:2
**Key:** 7 modes (create, expand, sync, audit, bootstrap, tiered auto-discovery, regression refresh). Layer 3 analysis for Enabler dependencies.

## Pipeline Skills — Design (5)

### design-ux
**Purpose:** Screen flows, state machines, information hierarchy, interaction patterns
**Outputs:** docs/specs/ux/<name>.md
**Position:** greenfield:9, brownfield-feature:5
**Key:** Produces UX-REVIEWED status. Persona-aware. Error states, edge cases, a11y.

### design-ui
**Purpose:** Component specifications, design token usage, responsive layout
**Outputs:** docs/specs/ui/<name>.md + design-system.md
**Position:** greenfield:10, brownfield-feature:6
**Key:** Produces DESIGNED status. AI Slop blacklist (AP-22). Design system creation/extension.

### track-visuals
**Purpose:** Capture visual state baseline and diffs
**Outputs:** docs/specs/visuals/baseline/ or diffs/
**Position:** greenfield:11+17, brownfield-feature:7+13
**Key:** Sidecar skill — runs after design-ui (baseline) and after execute-changeset (diff). Browser screenshots at breakpoints.

### design-tech
**Purpose:** Architecture, data model, feasibility, tech choices
**Outputs:** feature-spec enriched (status: BASELINED)
**Position:** greenfield:12, brownfield-feature:7
**Key:** G4 gated. Feasibility matrix for all ACs. Maps to implementation parts.

### explore-solutions
**Purpose:** Challenge chosen approach with alternative paradigms
**Outputs:** docs/specs/explorations/<name>/DECISION.md
**Position:** greenfield:13, brownfield-feature:8
**Key:** Evidence-based comparison. Produces decision document with trade-offs.

## Pipeline Skills — Implementation (7)

### define-code-style
**Purpose:** Code style contract for the project
**Outputs:** docs/specs/style-contract.md
**Position:** greenfield:14, brownfield-feature:8
**Key:** Analyzes existing codebase (brownfield) or design system + tech stack (greenfield). Audit mode for existing contracts.

### plan-changeset
**Purpose:** Implementation manifest with task graph, file set, validation plan
**Outputs:** docs/plans/<date>-<name>/manifest.md
**Position:** greenfield:15, brownfield-feature:9, bugfix:2, refactor:2
**Key:** Scope prohibition (banned phrases). Schema drift detection. AC/test mapping. 9-check self-verify including claim provenance.

### execute-changeset
**Purpose:** Code in worktree with TDD, checkpoint commits, deviation handling
**Outputs:** code + commits in branch
**Position:** greenfield:16, brownfield-feature:10, bugfix:3, refactor:3
**Key:** Worktree isolation. 4 deviation rules. Analysis paralysis guard. 3-attempt limit. Adaptive context enrichment for 1M models. Two-stage review. Search Before Building. Test framework bootstrap.

### review-gate
**Purpose:** 5-step review protocol at G1-G7
**Outputs:** gate decision
**Position:** greenfield:18, brownfield-feature:11, bugfix:4, refactor:4
**Key:** Self-review → self-judgment → cross-review → convergence → gate decision. Stall detection. Max 3 iterations. 6 specialist subagents in Phase 0.5.

### audit-implementation
**Purpose:** Deep correctness audit before landing
**Outputs:** docs/specs/audit/<name>-analysis.md
**Position:** greenfield:19, brownfield-feature:12, bugfix:5, refactor:5
**Key:** Review Army — 6 parallel specialist subagents with adaptive gating. Scope drift detection.

### land-changeset
**Purpose:** Squash merge to main, version bump, PR
**Outputs:** PR merged
**Position:** greenfield:20, brownfield-feature:13, bugfix:6, refactor:6
**Key:** Plan completion audit (per-task DONE/PARTIAL/MISSING). Worktree cleanup.

### verify-promotion
**Purpose:** Post-merge spec-sync + QA + E2E proof
**Outputs:** feature-spec → VERIFIED
**Position:** greenfield:21, brownfield-feature:14, bugfix:7, refactor:7
**Key:** Test quality audit. G7 review. Responsive evidence for browser-visible features.

## Quality/Testing Skills (5)

### test-journeys — Manual QA against live server, journey-by-journey
### write-e2e — Playwright E2E tests from journey scenarios, real browser
### sync-spec-code — Detect PLANNED→RESOLVED→DRIFT drift between specs and code
### review-cross-model — Adversarial review via Codex CLI, accept/reject per finding
### review-security — OWASP Top 10 + STRIDE, not invoked automatically

## Utility Skills (11)

### quick-fix — Fast lane for ≤3 file changes, spec sync check
### diagnose-bug — Root-cause-first debugging, hypothesis tracking, bugfix lane entry
### manage-learnings — Persistent learning store with 3-question quality gate
### teach-project — Owner guide calibrated to builder's knowledge gap
### plan-capabilities — Classify project type, recommend MCPs/skills/research
### analyze-marketing — Feature mining for product marketing context
### onboard-repo — Convert existing repo to svc (brownfield-conversion lane entry)
### sync-work-items — Sync work items to GitHub Issues
### discover-skills — Find and install external skills
### extract-bootstrap — Extract reusable patterns from existing codebases
### wsl2-audio — WSL2 audio setup for voice mode

## Framework Skills (7)

### test-framework — Static validation + live server tests + autopilot + comparison
### audit-session-execution — Expected-vs-actual session forensics from WI/task graph/logs/transcript plus host-trace discovery
### evolve-framework — Ranked gap proposals from evidence
### blend-external — Exhaustive dimensional comparison with external sources
### improve-framework — Orchestrates evidence → diagnosis → implementation → verification
### create-skill — Skill creation with eval infrastructure (forked from anthropic/skills)
### research — On-demand knowledge extraction, full L3 analysis

## L4 Pointers
- All skill source files: */SKILL.md (46 directories)
- Manifest: skills-manifest.json
- Lane definitions: skills-manifest.json → laneDefinitions
- Bootstrap sequence: skills-manifest.json → bootstrapStartSequence
