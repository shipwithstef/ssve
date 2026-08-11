# Skill Pack Comparison: svc vs gstack vs superpowers

> Reference document for cross-pack capability mapping.
> Last updated: 2026-07-13 (coreyhaines rows refreshed to v2.6.0)
> **Last blend-registry checked: 2026-07-13.**
>
> **Update protocol:** after any blend session, scan this table row-by-row. For each
> row where svc shows "— gap —", check `FRAMEWORK-STATE.md` Blend History for a
> matching implementation. Update the row. This is enforced by `blend-external`
> self-verify check (added 2026-04-12).

## License Summary

| Pack | Author | License | Can derive from? |
|------|--------|---------|-----------------|
| svc | s7an-it | MIT | Yes, fully permissive |
| gstack | Garry Tan | MIT | Yes, fully permissive |
| superpowers | Jesse Vincent (obra) | MIT | Yes, fully permissive |
| taste-skill | Leonxlnx | MIT | Yes, fully permissive |

---

## At A Glance

| Area | svc | gstack | superpowers |
|------|-----------|--------|-------------|
| **Vision & Strategy** | `write-vision` (3 intents, evidence-backed) | — | — |
| **Personas** | `build-personas` (7 modes, trust tiers) | — | — |
| **Feature Discovery** | `validate-feature` (3-tier scan, Ship Brief) | `/office-hours` (6 forcing questions) | — |
| **Feature Types** | Feature / Enabler / Integration cascade | — | — |
| **Spec Authoring** | `write-spec` (consumer-first stories, ACs) | — | — |
| **AC Traceability** | `audit-ac` (shared table, 4 skills R/W) | — | — |
| **Spec-Code Drift** | `sync-spec-code` (PLANNED→RESOLVED→DRIFT) | — | — |
| **BDD Journeys** | `write-journeys` (6 modes, Layer 3 analysis) | — | — |
| **Journey QA** | `test-journeys` (4 modes, live URLs) | `/qa` (real browser, auto-fix, regression tests) | — |
| **Design System** | `design-ui` (Design Dials, Premium Patterns) | `/design-consultation` (DESIGN.md, full brand) | — |
| **Design Exploration** | `design-ui` (Metric-Based Dials 1-10) | `/design-shotgun` (variants, comparison board) | — |
| **Design Review** | `track-visuals` review mode `comprehension` | `/plan-design-review` + `/design-review` (0-10 audit) | — |
| **Design Production** | `design-ui` (Refraction, Inline Typography) | `/design-html` (Pretext-native, framework-aware) | — |
| **Technical Design** | `design-tech` (feasibility, motion guardrails) | `/plan-eng-review` (ASCII diagrams, state machines) | `brainstorming` (design doc) |
| **CEO/Scope Review** | `design-tech` (Scope Reduction Trigger) | `/plan-ceo-review` (4 scope modes) | — |
| **Auto-Review Pipeline** | — gap — | `/autoplan` (CEO→design→eng automatic) | — |
| **Change Set** | `plan-changeset` (manifest, task graph, AC/test mapping) | — | `writing-plans` (bite-sized tasks, zero-context) |
| **Plan Execution** | `execute-changeset` (checkpoint commits, Completeness Protocol) | — | `executing-plans` (batch + architect review) |
| **Subagent Dispatch** | via superpowers | — | `subagent-driven-development` (2-stage review) |
| **TDD** | `execute-changeset` (Red-Green enforcement) | "Boil the Lake" philosophy | `test-driven-development` (Iron Law) |
| **E2E Test Authoring** | `write-e2e` (a11y-first, journey-based) | regression tests from QA fixes | — |
| **Real Browser** | via gstack (browse daemon) | `/browse` (persistent daemon, ~100ms, ARIA refs) | — |
| **Code Review** | `review-gate` (G1-G7, two-stage review) | `/review` (SQL safety, LLM trust boundaries) | `requesting-code-review` + `receiving-code-review` |
| **Cross-Model Review** | `review-cross-model` (standalone review) | `/codex` (Claude + Codex, 3 modes) | — |
| **Debugging** | `diagnose-bug` (root-cause, pattern scan, pillars audit) | `/investigate` (auto-freeze, 3-attempt limit) | `systematic-debugging` (4-phase, 10 ref files) |
| **Security Audit** | `review-security` (OWASP, STRIDE, supply chain) | `/cso` (OWASP, STRIDE, supply chain) | — |
| **Safety Guardrails** | — gap — | `/careful` + `/freeze` + `/guard` | — |
| **Marketing Pipeline** | `analyze-marketing` (8 modes, weights) | — | — |
| **External Marketing** | coreyhaines interop (46 skills @ v2.6.0 — incl. marketing-loops ops layer, prospecting, sms, public-relations, offers, marketing-plan) | — | — |
| **Release Engineering** | `land-changeset` (promote, PR, cleaning) | `/ship` (version, changelog, test audit, PR) | `finishing-a-development-branch` (4 options) |
| **Deploy & Verify** | `verify-promotion` (G7 review, prod smoke) | `/land-and-deploy` (merge→CI→canary) | — |
| **Post-Deploy Monitor** | `verify-promotion` (canary monitoring) | `/canary` (screenshots, error watch, baselines) | — |
| **Doc Sync** | `sync-spec-code` (spec-to-code) | `/document-release` (README, ARCHITECTURE, CLAUDE.md) | — |
| **Performance** | `design-tech` (Cost Model, Motion Guardrails) | `/benchmark` (Core Web Vitals, before/after) | — |
| **Learning/Memory** | `manage-learnings` (JSONL, search, prune, export) | `/learn` (JSONL per-project, compounds) | — |
| **Retrospectives** | — gap — | `/retro` (commit analysis, per-person, streaks) | — |
| **Health Dashboard** | `audit-coverage` (canonical artifact catalog) | `/health` (weighted 0-10, trend tracking) | — |
| **Progress Checkpoints** | `lane-tasks.json` (file-backed persistence) | `/checkpoint` (save/resume state) | — |
| **Skill Routing** | `route-workflow` (Intent, Lane, Change-Type) | preamble-based proactive routing | `using-superpowers` (1% = must invoke) |
| **Skill Creation** | `create-skill` (svc-aware, benchmarking) | template auto-gen, CI validates | `writing-skills` (TDD for docs, pressure-test) |
| **Repo Modes** | bootstrap / convert | — | — |
| **Verification Gate** | built into skill handoffs + G1-G7 | part of QA/review | `verification-before-completion` (dedicated) |
| **Parallel Workflows** | `execute-changeset` (inner worktrees) | Conductor (10-15 branches) | `dispatching-parallel-agents` + `using-git-worktrees` |
| **Multi-Platform** | Claude / Codex / Gemini CLI | Claude Code + Codex CLI | Claude Code + Codex + OpenCode + Gemini |

### Legend
- **skill name** = has it, with the skill that provides it
- **via superpowers** = uses superpowers' implementation
- **— gap —** = doesn't have it yet

---

## Capability Matrix (Deep Reference)

### Product Discovery & Definition

| Capability | svc | gstack | superpowers (obra) |
|---|---|---|---|
| **Vision definition** | `write-vision` — 3 intents (create/refine/convert), 2 modes (grounded/scratch), 12-section canonical structure, evidence table, proposal-first with approval gates | None | None |
| **Persona modeling** | `build-personas` — 7 modes: build all, skill audit, add new, expand, interview, discover gaps, tiered auto-discovery. Lifecycle progression with trust tiers. Skill Implications feed downstream | None | None |
| **Feature discovery** | `validate-feature` — cross-validates against personas/journeys/specs before business questions. 3-tier scan (journeys→personas→code). Escape hatch for concept fragmentation. Produces Feature Ship Brief | `/office-hours` — 6 forcing questions (demand reality, status quo, specificity, wedge, observation, future-fit). Conversational, not structured cross-validation. Produces design doc | None |
| **Feature type system** | Feature / Enabler / Integration — same spec format, different consumer types. Cascade discovery: specifying one feature reveals all enablers/integrations it depends on | None — no feature taxonomy | None — no feature taxonomy |
| **Problem framing** | Part of `write-spec` Step 2 and `validate-feature` | `/office-hours` — startup mode vs builder mode. YC-style partner questioning | `brainstorming` — clarifying questions one at a time, but no structured framework |

### Specification & Requirements

| Capability | svc | gstack | superpowers (obra) |
|---|---|---|---|
| **Feature spec authoring** | `write-spec` — DRAFT specs with user stories, ACs, system dependencies. Consumer-first stories (human/service/external). Triggers write-journeys. Cascade creates enabler specs | None — design doc from `/office-hours` serves as loose spec | None — `brainstorming` produces design doc, not formal spec |
| **Acceptance criteria** | `audit-ac` — shared AC table contract (`\| AC \| Description \| QA \| E2E \| Test \|`). Converts old formats. 4 skills read/write the same table | None — no AC traceability | None — no AC format |
| **Spec-code drift detection** | `sync-spec-code` — PLANNED/RESOLVED/DRIFT/UPDATED/REVERTED annotations with file:line proof. Bidirectional audit | None | None |
| **Spec lifecycle** | DRAFT → UX-REVIEWED → DESIGNED → BASELINED → CHANGE-SET-APPROVED → PROMOTED → VERIFIED. Status tracked in spec file header. Each phase has a dedicated skill | None — design docs are one-shot | None — design docs saved but no lifecycle |

### BDD / Journey Layer

| Capability | svc | gstack | superpowers (obra) |
|---|---|---|---|
| **Journey definition** | `write-journeys` — 6 modes (bootstrap/expand/refresh/migrate/auto/tiered). Gherkin .feature.md format. Multi-feature flows with persona trust tiers | None | None |
| **Layer 3 analysis** | Built into `write-journeys` — finds contradictions, dead ends, ungrounded preconditions, concept fragmentation, missing transitions. Routes findings to other skills | None | None |
| **System steps in journeys** | User journeys wrap system behavior as marked dependency steps. Layer 3 traces each back to enabler spec | None | None |
| **Journey-based QA** | `test-journeys` — 4 modes (smoke/regression/feature-ac/exploratory). Executes against live URLs. Updates QA column in AC tables. Evidence screenshots | `/qa` + `/qa-only` — real browser testing but not journey-structured. Finds bugs and fixes them with atomic commits. Auto-generates regression tests | None |

### Design & UI

| Capability | svc | gstack | superpowers (obra) |
|---|---|---|---|
| **Design system spec** | Gap — no DESIGN.md equivalent yet | `/design-consultation` — builds complete design system from scratch: brand, typography, colors, spacing, motion, grain texture. Creates DESIGN.md | None |
| **Design exploration** | Gap | `/design-shotgun` — generate multiple AI design variants, open comparison board in browser, iterate. Taste memory biases toward preferences | None |
| **Design review (planning)** | Gap | `/plan-design-review` — rates each dimension 0-10, explains what a 10 looks like, edits plan to get there. AI slop detection | None |
| **Design review (live)** | Gap | `/design-review` — audits live site, fixes issues with atomic commits, before/after screenshots | None |
| **Production HTML generation** | Gap | `/design-html` — Pretext-native HTML/CSS, text reflow, computed heights, framework detection (React/Svelte/Vue) | None |
| **UI in technical design** | `design-tech` — component tables with responsibilities. References design system (when it exists) | Design system feeds into all design skills | `brainstorming` mentions architecture/components but not design-specific |

### Technical Design & Planning

| Capability | svc | gstack | superpowers (obra) |
|---|---|---|---|
| **Technical design** | `design-tech` — architecture, components, data model, feasibility matrix against ACs, risks, trade-offs. DESIGNED → BASELINED | `/plan-eng-review` — ASCII diagrams, data flow, state machines, edge cases, test matrix, error paths. Forces hidden assumptions visible | `brainstorming` — covers architecture/components in design doc |
| **CEO/scope review** | Gap | `/plan-ceo-review` — 4 modes: expansion, selective expansion, hold scope, reduction. Challenges premises, rethinks scope | None |
| **Auto-review pipeline** | Gap | `/autoplan` — runs CEO → design → eng review automatically with encoded decision principles | None |
| **Change set authoring** | `plan-changeset` — implementation manifest with task graph, file-touch plan, AC/test mapping, validation commands, checkpoint plan. No code payload duplication | Part of the plan output from eng review, but no structured task metadata format | `writing-plans` — bite-sized tasks, zero-context assumption. DRY/YAGNI/TDD. No YAML metadata, no parallel groups, no spec chain |
| **Dependency analysis** | Built into `plan-changeset` — task dependencies, file-touch plan, AC/test coverage, cross-file intent | Not formalized | Not formalized |
| **Mandatory spec chain** | `plan-changeset` + `execute-changeset` — implementation tasks, spec/journey updates, and verification hooks stay attached to the plan | None | None |

### Implementation & Execution

| Capability | svc | gstack | superpowers (obra) |
|---|---|---|---|
| **Plan execution** | `execute-changeset` — executes one task at a time on the branch, stages only the current task diff, checkpoint commits, loop-backs on contradictions | Claude Code does the coding, fed by plan artifacts. No formalized execution skill | `executing-plans` — batch execution (3 tasks default) with architect review between batches. Load → Review → Execute → Report |
| **Subagent-per-task** | Optional via external add-ons; core model is task-by-task staged review on one branch | No subagent dispatch system | `subagent-driven-development` — fresh subagent per task + two-stage review (spec compliance then code quality). 4 prompt templates |
| **TDD enforcement** | Built into the implementation manifest and G5 review — tests are explicit tasks with validation before downstream implementation tasks | "Boil the Lake" philosophy — tests are the cheapest lake, never defer | `test-driven-development` — Iron Law: "NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST." Red-Green-Refactor. Delete code written before tests |
| **Parallel agents** | Optional via external add-ons; core model keeps checkpoints and staged diffs as the review surface | Conductor supports 10-15 simultaneous branches. Random port browser daemon | `dispatching-parallel-agents` — one agent per independent problem domain. Decision flowchart for when to parallelize |
| **Git worktrees** | Branch/worktree is the canonical change set and review surface | Not formalized (uses Conductor workspaces instead) | `using-git-worktrees` — systematic directory selection, safety verification, .gitignore enforcement |

### Code Review & Quality

| Capability | svc | gstack | superpowers (obra) |
|---|---|---|---|
| **Code review (request)** | Uses superpowers' model | `/review` — pre-landing PR review. SQL safety, LLM trust boundaries, conditional side effects. Auto-fixes obvious issues | `requesting-code-review` — dispatches code-reviewer subagent with git SHA tracking. Template-based |
| **Code review (receive)** | Uses superpowers' model | Not formalized — but cross-model review with `/codex` serves similar purpose | `receiving-code-review` — technical rigor over emotional performance. Verify before implementing. Forbidden: "You're absolutely right!" |
| **Cross-model review** | `review-cross-model` — standalone second-model review for diffs, specs, and manifests | `/codex` — independent Codex CLI review. 3 modes: review (gate), challenge (adversarial), consult (continuity). Claude + Codex disagreement = signal | None |
| **Code quality flywheel** | sync-spec-code detects drift, audit-ac ensures ACs, test-journeys verifies | Review → QA → fix → regression test cycle | TDD → code review → verification-before-completion cycle |

### Testing & QA

| Capability | svc | gstack | superpowers (obra) |
|---|---|---|---|
| **E2E test authoring** | `write-e2e` — accessibility-first selectors, read component code before testing, fix app not test. Journey-based test structure | QA skills write regression tests for found bugs. `/browse` provides real browser | None — TDD skill covers unit tests only |
| **Real browser testing** | `test-journeys` executes against live URLs but relies on available browser tooling | `/browse` — persistent Chromium daemon, sub-second latency, cookies/tabs/localStorage persist. ARIA ref system. 3 ring buffers | None |
| **Browser daemon** | Gap — no persistent browser infrastructure | Custom Bun-compiled binary. First call ~3s, subsequent ~100-200ms. Random port for parallel workspaces. Bearer token auth | None |
| **Cookie management** | Gap | `/setup-browser-cookies` — import cookies from Chrome/Arc/Brave/Edge. Interactive picker | None |
| **Live browser view** | Gap | `/connect-chrome` — Side Panel extension, watch every action live, headed/headless toggle | None |
| **Performance benchmarks** | Gap | `/benchmark` — baseline Core Web Vitals, resource sizes. Before/after on every PR. Trend tracking | None |
| **Test enforcement** | `plan-changeset` + `execute-changeset` — tests are planned as first-class tasks and validated at G5 review | "Boil the Lake" — completeness is near-free, never defer tests | `test-driven-development` — Iron Law, but no tiered enforcement system |

### Marketing & Content

| Capability | svc | gstack | superpowers (obra) |
|---|---|---|---|
| **Feature-to-marketing pipeline** | `analyze-marketing` — 8 modes: full scan, single feature, refresh, foundation, compact, capability combinations, quality eval, persona validation. Weighted insights with live status | None | None |
| **Marketing context doc** | Produces `.agents/product-marketing-context.md` — foundational sections (1-12) + atomic insights + cross-feature narratives | None | None |
| **External marketing packs** | Interop with coreyhaines marketing pack (46 skills @ v2.6.0; rename migration WI-477 pending) via `EXTERNAL_ADDONS.md` | None | None |

### Security

| Capability | svc | gstack | superpowers (obra) |
|---|---|---|---|
| **Security audit** | `review-security` — OWASP Top 10 + STRIDE + supply chain audit before implementation | `/cso` — OWASP Top 10, STRIDE threat modeling, supply chain audit (dependencies + CI/CD + skill ecosystem), LLM/AI risks. Daily (zero-noise, 8/10 confidence gate) vs comprehensive (monthly) | None |
| **Safety guardrails** | Gap | `/careful` (warn before destructive ops), `/freeze` (restrict edits to one directory), `/guard` (both combined), `/unfreeze` (clear restrictions) | None — relies on Claude Code's built-in safety |

### Release & Operations

| Capability | svc | gstack | superpowers (obra) |
|---|---|---|---|
| **Release engineering** | Gap | `/ship` — sync main, run tests, audit coverage, push, create PR. Auto-bootstrap test frameworks. Version bump + CHANGELOG | `finishing-a-development-branch` — 4 options: merge, PR, keep branch, discard. No version/changelog management |
| **Deploy & verify** | Gap | `/land-and-deploy` — merge PR, wait for CI/deploy, verify production via canary | None |
| **Post-deploy monitoring** | Gap | `/canary` — periodic screenshots, console error watching, performance regression detection, baseline comparison | None |
| **Documentation sync** | Gap | `/document-release` — updates README, ARCHITECTURE, CONTRIBUTING, CLAUDE.md to match shipped code. Catches stale docs | None |

### Debugging & Investigation

| Capability | svc | gstack | superpowers (obra) |
|---|---|---|---|
| **Root cause analysis** | Gap — routes to external debugging | `/investigate` — systematic root-cause. Iron Law: no fixes without investigation. Auto-freezes to module. Stops after 3 failed fixes | `systematic-debugging` — 4-phase investigation. Iron Law: no fixes without root cause. 10 supporting reference files including find-polluter.sh |
| **Debug support files** | None | None specific | `root-cause-tracing.md`, `condition-based-waiting.md` + example, `defense-in-depth.md`, `find-polluter.sh`, 3 test-pressure scenarios |

### Meta / Process

| Capability | svc | gstack | superpowers (obra) |
|---|---|---|---|
| **Skill routing** | `route-workflow` — knows dependency graph of all 13+ skills, recommends next skill based on project state | Proactive skill routing — notices what you're doing and suggests. Preamble in every skill checks context | `using-superpowers` — mandatory skill check before any action. 1% chance = must invoke. Red flag table for rationalization |
| **Skill creation** | `create-skill` — svc-aware skill creation, updates, and eval benchmarking | Template auto-generation from SKILL.md.tmpl. CI validates freshness | `writing-skills` — TDD applied to documentation. Pressure-test with subagents. 45K anthropic-best-practices.md reference |
| **Learning/memory** | `manage-learnings` — JSONL-based project learnings with search/prune/export | `/learn` — JSONL-based per-project learnings. Compound across sessions. Confidence-filtered (5+ min savings threshold) | None |
| **Retrospectives** | Gap | `/retro` — weekly retro from commit history. Per-person breakdowns, shipping streaks, test health trends. Cross-project global mode | None |
| **Progress checkpoints** | Gap | `/checkpoint` — save/resume working state. Git state, decisions, remaining work. Survives workspace handoffs | None |
| **Health dashboard** | Gap | `/health` — weighted 0-10 score from type checker, linter, test runner, dead code. Trends over time | None |
| **Repository modes** | `REPO_MODES.md` — bootstrap (greenfield) vs convert (brownfield). Every skill adapts behavior | None — assumes existing project | None — assumes existing project |
| **Verification gate** | Built into each skill's routing/handoff | Part of QA/review cycle | `verification-before-completion` — dedicated skill. Iron Law: no claims without fresh evidence |
| **Completion protocol** | Each skill has explicit handoff with summary | DONE / DONE_WITH_CONCERNS / BLOCKED / NEEDS_CONTEXT status protocol | `finishing-a-development-branch` — 4 integration options |

### External Integrations

| Capability | svc | gstack | superpowers (obra) |
|---|---|---|---|
| **External skill packs** | `EXTERNAL_ADDONS.md` — coreyhaines marketing (46 skills @ v2.6.0; v2.0.0 renames pending migration WI-477), implementation-planning. Interop contracts defined | Self-contained — no external pack integration | Self-contained — personal skill overrides via shadowing |
| **Multi-platform support** | Claude Code focused | Claude Code + Codex CLI (`/codex` skill) | Claude Code + Codex + OpenCode + Gemini (docs for each) |
| **Telemetry** | None | Opt-in Supabase telemetry. 3 modes: community (usage data), anonymous (count only), off. Schema in repo | None |

---

## Philosophy Comparison

| Dimension | svc | gstack | superpowers (obra) |
|---|---|---|---|
| **Core metaphor** | Product development pipeline — vision through marketing | Virtual 23-person engineering team | Development discipline enforcement |
| **Target user** | Technical founders, product engineers, teams with product/QA workflow | Solo technical founders shipping at scale (10K-20K LOC/day) | Developers using Claude Code who need process guardrails |
| **Key principle** | Every shipping component gets a spec. Cascade discovery. Consistency enforced automatically | "Boil the Lake" — completeness is near-free with AI, always do the complete thing | Iron Laws — no code without tests, no fixes without root cause, no claims without evidence |
| **Voice** | Structured, methodical, process-oriented | Direct, punchy, builder ethos. Anti-AI-slop. "Wild." Incomplete sentences | Principled, disciplined, gate-oriented |
| **Artifact philosophy** | Living documents that mature (DRAFT→UX-REVIEWED→DESIGNED→BASELINED→CHANGE-SET-APPROVED→PROMOTED→VERIFIED) | Design docs → plans → code → ship. One-directional | Plans saved to docs/, reviewed in batches |
| **Completeness model** | Full product lifecycle (vision→code→marketing) | Full engineering lifecycle (idea→production→monitoring) | Development discipline only (plan→code→review→merge) |
| **Scalability** | Scales by feature type (Feature/Enabler/Integration cascade) | Scales by parallelism (Conductor, 10-15 branches) | Scales by subagent dispatch (parallel agents, worktrees) |

---

## Complementarity Map

### svc + superpowers (current integration)
svc handles product definition and verification. superpowers informed the implementation-discipline layer. `plan-changeset` now matches obra-level planning depth, while `execute-changeset` keeps the actual code in the branch rather than duplicating it in docs.

### svc + gstack (potential integration)
| svc provides | gstack provides | Together |
|---|---|---|
| Feature specs with ACs | Design system + design review | Specs that include visual design contracts |
| Journey-based QA methodology | Real browser daemon + persistent state | Journey QA that actually opens a browser |
| Spec-code drift detection | Post-deploy canary monitoring | Drift detection from spec through production |
| Marketing insights pipeline | Release engineering + doc sync | Full ship-to-market pipeline |
| Feature/Enabler/Integration taxonomy | Security audit (OWASP/STRIDE) | Security as a feature type with specs |

### gstack + superpowers (overlap analysis)
| Capability | gstack approach | superpowers approach | Better for agents |
|---|---|---|---|
| Planning | CEO/eng/design review pipeline | brainstorming → writing-plans | gstack (more structured reviews) |
| Code review | `/review` + `/codex` cross-model | Two-stage subagent (spec→quality) | superpowers (subagent separation) |
| TDD | "Boil the Lake" philosophy | Iron Law enforcement | superpowers (stricter discipline) |
| Debugging | `/investigate` + auto-freeze | systematic-debugging + 10 reference files | superpowers (more reference material) |
| Execution | No formal execution skill | executing-plans + subagent-driven-development | superpowers (formalized) |
| Safety | `/careful` + `/freeze` + `/guard` | None (relies on Claude defaults) | gstack (explicit guardrails) |

---

## Gap Analysis: What svc Should Build Next

### From gstack (MIT — can derive freely)
1. **Design system spec** — foundational artifact like vision/personas. DESIGN.md with brand, typography, colors, spacing, motion
2. **Design review** — audit dimensions 0-10, explain what 10 looks like, fix to get there
3. **Security audit hard-wiring** — existing `review-security` should gain stronger pipeline triggering and replay coverage
4. **Release engineering** — version, changelog, doc sync, deploy verification
5. **Post-deploy monitoring** — canary checks, baseline comparison
6. **Real browser infrastructure** — persistent daemon for test-journeys
7. **Learning/memory automation** — existing `manage-learnings` should move from manual review to broader automatic capture
8. **Health dashboard** — weighted quality score with trend tracking
9. **Safety guardrails** — freeze/careful/guard for production work

### From superpowers (MIT — already partially integrated)
1. **Systematic debugging** — 4-phase root cause + reference files (partially via fork)
2. **Verification gate** — dedicated evidence-before-claims skill
3. **Receiving code review** — technical rigor over performative agreement
4. **Skill creation hardening** — existing `create-skill` should absorb more TDD-style pressure testing
5. **Test anti-patterns** — reference file for common testing mistakes

### Original to svc (no external source)
1. **Design system skill** — adapted for svc's spec-first workflow
2. **write-spec evolution** — Feature/Enabler/Integration cascade (already done)
3. **Ship Record** — unified document tracking full lifecycle of a change
4. **Enabler journey patterns** — system journeys for crons, pipelines, events
