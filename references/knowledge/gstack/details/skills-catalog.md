# gstack Skills Catalog — Details

## Mechanism

Every skill is a directory with SKILL.md (generated from SKILL.md.tmpl via
gen-skill-docs.ts). Each starts with a {{PREAMBLE}} block that handles:
update check, session tracking, contributor mode, AskUserQuestion format,
Search Before Building ethos.

### Sprint Process

Think → Plan → Build → Review → Test → Ship → Reflect

Each skill feeds into the next: /office-hours writes design doc → /plan-ceo-review
reads it. /plan-eng-review writes test plan → /qa picks it up. /review catches
bugs → /ship verifies they're fixed.

## Skill Details

### /office-hours — YC Office Hours
6 forcing questions that reframe the product before code:
1. What's the pain? (specific examples, not hypotheticals)
2. Status quo? (what do they do today?)
3. Who's desperate? (narrowest possible wedge)
4. What did you observe? (not what did they say)
5. What's the future look like?
6. What's the implementation?

Two modes: startup (forcing questions) and builder (design thinking brainstorming).
Voice triggers supported for natural activation.

### /plan-ceo-review — CEO/Founder Review
10-section review with 4 scope modes:
- SCOPE EXPANSION — dream big, find the 10-star product
- SELECTIVE EXPANSION — hold scope + cherry-pick expansions
- HOLD SCOPE — lock scope, improve within constraints
- REDUCTION — cut scope to ship faster

Challenges premises, expands scope when it creates a better product.

### /plan-eng-review — Eng Manager Review
Forces hidden assumptions: ASCII diagrams for data flow, state machines, error
paths. Test matrix, failure modes, security concerns. Architecture lock-in.

### /plan-design-review — Designer Review
Rates each design dimension 0-10, explains what a 10 looks like, fixes plan.
AI Slop detection: generic gradients, stock icons, meaningless animations.
Interactive — one AskUserQuestion per design choice.

### /plan-devex-review — DX Lead Review
3 modes: DX EXPANSION, DX POLISH, DX TRIAGE.
8 first principles, 7 characteristics, 10 cognitive patterns.
20-45 forcing questions. TTHW (Time To Hello World) benchmarks.
DX Hall of Fame: 8 passes of gold standards and anti-patterns.

### /autoplan — Auto-Review Pipeline
Runs CEO → design → eng → DX reviews sequentially with auto-decisions.
6 decision principles for auto-accepting/rejecting. Surfaces only taste
decisions (close approaches, borderline scope) for user approval.

### /review — Pre-Landing Review
Two-pass: AUTO-FIX obvious, ASK for judgment calls.
Review Army: 7 parallel specialists with adaptive gating.
Cross-review dedup with previous /review or /ship runs.
Confidence scoring: 1-10 scale with display rules.

### /investigate — Root-Cause Debugging
4 phases: investigate, analyze, hypothesize, implement.
Iron Law: no fixes without root cause investigation.
Auto-freezes to the module being investigated.
Stops after 3 failed fix attempts.

### /qa — QA Testing + Bug Fixing
6-phase QA methodology. Opens real browser.
Finds bugs → fixes with atomic commits → re-verifies.
Auto-generates regression tests for every fix.
Issue taxonomy: 7 categories, 4 severity levels.
QA report template with health score.

### /browse — Browser Daemon
The browse daemon skill. Full command reference generated from source code.
Snapshot flags, @ref system, chain commands, state persistence.
See details/browse-daemon.md for full architecture.

### /ship — Release Engineer
Sync main → run tests → coverage audit → Review Army → push → open PR.
Bootstraps test frameworks from scratch if missing.
Review Readiness Dashboard shows pre-ship status.
Auto-invokes /document-release for doc updates.
Re-runs execute every verification step (idempotent actions only skip).

### /cso — Chief Security Officer
OWASP Top 10 + STRIDE threat model + supply chain audit.
17 false positive exclusions, 8/10+ confidence gate.
Each finding includes concrete exploit scenario.
Independent finding verification.

### /design-consultation — Design System Creation
Researches the landscape, proposes creative risks.
Generates realistic product mockups via $D.
Writes DESIGN.md with design language.

### /design-shotgun — Design Explorer
Generates 4-6 mockup variants → comparison board → feedback → iterate.
Taste memory learns preferences. Hands off to /design-html.
See details/design-tool.md for full pipeline.

### /design-html — Design Engineer
Approved mockup → production HTML/CSS.
Pretext computed layout: text reflows, heights adjust, dynamic layouts.
30KB overhead, zero deps. Detects React/Svelte/Vue.
Smart API routing per design type (landing/dashboard/form/card).

### /retro — Weekly Retrospective
Team-aware: per-person breakdowns with praise and growth areas.
Shipping streaks, test health trends.
`/retro global` runs across all projects and AI tools.
Persistent history for trend tracking.

### /codex — Cross-Model Review
3 modes: review (pass/fail gate), adversarial challenge, open consultation.
Sends diff + goals to Codex CLI. Cross-model analysis when both /review
and /codex have reviewed same branch.

### /pair-agent — Multi-Agent Browser Sharing
One command, one paste, connected. Scoped tokens, tab isolation.
Auto-launches headed mode. Auto-starts ngrok tunnel for remote agents.
Rate limiting, domain restrictions, activity attribution.
Same-machine shortcut writes credentials directly.

### /canary — Post-Deploy Monitoring
Watches for console errors, perf regressions, page failures.
Periodic screenshots. Compares against pre-deploy baselines.

### /benchmark — Performance Regression
Baseline page load times, Core Web Vitals, resource sizes.
Compare before/after on every PR. Trend tracking.

### /learn — Institutional Memory
Manages learnings across sessions. Confidence decay over time.
Cross-project support. Review, search, prune, export.
Operational self-improvement: agents log learnings at end of each session.

## Analysis

The sprint process (Think → Plan → Build → Review → Test → Ship → Reflect)
with each skill feeding into the next is gstack's core value proposition.
The /autoplan pipeline that chains reviews with auto-decisions reduces the
36-skill surface area to one command for the common case.

The founder persona throughout (/office-hours reframes products, /plan-ceo-review
finds the 10-star product) reflects Garry Tan's YC background — these aren't
generic tools, they encode startup methodology.

The Review Army (7 specialists, adaptive gating, cross-review dedup) and
/codex (cross-model review) push code review beyond what any single-pass
reviewer can achieve.

## L4 Pointers

- All skills: `<skill-name>/SKILL.md` (36 directories)
- Skill deep dives: `docs/skills.md` (~1164 lines)
- Sprint process: README.md "The sprint" section
- DX hall of fame: `plan-devex-review/dx-hall-of-fame.md`
- QA taxonomy: `qa/references/issue-taxonomy.md`
- QA report template: `qa/templates/qa-report-template.md`
