## Repository Mode Gate

Before recommending any next skill, detect repository mode using `REPO_MODES.md`:

- `bootstrap`: initialize missing svc structure and run the greenfield lane
- `convert`: preserve current truth first, then route to the right brownfield lane

If mode is ambiguous, default to `convert`.

**Routing precedence:** repo override > project-local platform rule > generic platform heuristic > global fallback.

## Routing Rule

**Clean repo:** run svc directly.

**Existing repo:** run `onboard-repo` first unless the repo has already been mapped into svc working mode.

Signals that conversion has already happened:

- `docs/specs/project-state.md` exists
- `docs/specs/router-context.md` exists
- `docs/specs/agent-topology.md` exists
- `docs/specs/work-items/INDEX.md` exists
- the repo already uses lane-based work items and canonical svc status files

If these are missing in a real brownfield repo, route to `onboard-repo`. A repo
with `project-state.md` but missing `router-context.md` or `agent-topology.md`
is only partially mapped.

## Skill Availability Contract

`route-workflow` must always route to available skills first.
Skill-name contract is machine-checked in `skills-manifest.json` via `node scripts/lint-skills-manifest.mjs`.

### Skill-description budget & router resolution (WI-365)

Claude Code's native skill-description budget (1% of context, least-invoked evicted
first, 1,536-char cap) can silently hide skill descriptions from the model's
system-prompt catalog. **route-workflow never assumes system-prompt visibility**:
it resolves lanes and skills from `skills-manifest.json` file reads, so routed
dispatch keeps working even for skills whose descriptions are evicted or that set
`disable-model-invocation: true` (user/router triggering is preserved; only
Claude-spontaneous suggestion is affected). Never remove a skill from the manifest
to save context — the router contract is the safety net that makes description
dieting safe.

### Core Pack (always available in svc)

- This is the routing-safe baseline used by `route-workflow`. Broader downstream implementation skills are listed below under `## The Product Pipeline Skills`.
<!-- svc:generated:begin routing-rules-core-pack — edit skills-manifest.json / references/model-registry.json, then run: node scripts/generate-manifest-mirrors.mjs --write -->
- `write-vision`
- `analyze-domain`
- `analyze-competitors`
- `catalog-domain-capabilities`
- `build-personas`
- `write-journeys`
- `test-journeys`
- `validate-feature`
- `audit-ac`
- `sync-spec-code`
- `define-code-style`
- `write-e2e`
- `analyze-marketing`
- `recall-stack-knowledge`
- `onboard-repo`
- `diagnose-bug`
- `sync-work-items`
- `list-work-items`
- `discover-skills`
- `research`
- `discuss-phase`
- `dispatch-waves`
- `review-plan`
- `review-security`
- `mine-builder`
- `find-opportunity`
- `stage-revenue`
- `improve-framework`
- `test-framework`
- `audit-session-execution`
- `evolve-framework`
- `explore-ux`
- `blend-external`
- `blend-private`
- `create-skill`
- `quick-fix`
- `plan-capabilities`
- `platform-operating-architect`
- `teach-project`
- `audit-coverage`
- `roadmap-evaluation`
- `monetization-architecture`
- `assess-market-readiness`
- `manage-finops`
- `cos`
- `growth-lead`
- `fin-analyst`
- `product-lead`
- `market-intel`
- `counsel`
- `security-ops`
- `customer-cs`
- `revops`
- `comms`
- `tax-auditor`
- `privacy-dpo`
- `infra-sre`
- `procurement`
- `growth-eng`
<!-- svc:generated:end routing-rules-core-pack -->

### External Add-On Packs (optional)

Only route to external skills when explicitly installed or confirmed.

- **coreyhaines-marketing-pack (optional):**
  `product-marketing`, `customer-research`, `market-competitors`, `competitors`,
  `copywriting`, `cro`, `launch`, `market-social`,
  `market-ads`, `market-emails`, `signup`, `onboarding`

- **planning add-on (optional):**
  `writing-plans` (external add-on; for svc repos, use core `plan-changeset` unless the repo explicitly prefers an external planning flow)

If an external skill is not confirmed, provide a core-pack fallback route.
External pack definitions live in `EXTERNAL_ADDONS.md`.

## The Routing Skills

### `onboard-repo`
Maps a brownfield repo into svc working mode. Produces `project-state.md`,
repo-canonical work items, and compatibility notes. Logs findings, then stops.

### `diagnose-bug`
Root-cause-first bug and regression planning. Produces an implementation-ready
correction brief without forcing a full feature-spec rewrite.

### `sync-work-items`
Projects repo-canonical work items to GitHub Issues. GitHub is a projection, not
the source of truth.

### `dispatch-waves`
Plans conflict-aware parallel WI execution. Use when the user asks to handle
multiple WI IDs in parallel or concurrently. Produces `.svc/parallel-dispatch-*.json`
and requires merge-back validation before parent graph mutation.

## The Product Pipeline Skills

- `write-vision`
- `analyze-domain`
- `analyze-competitors`
- `catalog-domain-capabilities`
- `build-personas`
- `validate-feature`
- `write-spec`
- `audit-ac`
- `write-journeys`
- `design-ux`
- `design-ui`
- `track-visuals`
- `design-tech`
- `explore-solutions`
- `define-code-style`
- `plan-changeset`
- `execute-changeset`
- `review-gate`
- `audit-implementation`
- `land-changeset`
- `verify-promotion`
- `sync-spec-code`
- `test-journeys`
- `write-e2e`
- `analyze-marketing`
## Change-Type Detection

Use these signals:

| Signal | Change Type | First Skill |
|--------|-------------|-------------|
| Existing repo needs svc adoption | `conversion` | `onboard-repo` |
| Net-new capability or extension with user value | `feature` | `validate-feature` |
| Broken behavior | `bugfix` | `diagnose-bug` |
| Previously working behavior stopped working | `regression` | `diagnose-bug` |
| Spec/code mismatch | `drift` | `sync-spec-code` |
| Structural cleanup with no intended behavior change | `refactor` | `plan-changeset` (or `sync-spec-code` first if invariants are unclear) |
| Tracker, docs, or housekeeping item with NO CSS/className/visual impact | `chore` | `sync-work-items` or `plan-changeset`, depending on whether it changes code or project state |
| Bulk CSS/Tailwind/className change with no JS behavior change (dark mode, theme, tokenization) | `style-refactor` → Lane 6 with `track-visuals` baseline + diff MANDATORY | `plan-changeset`. Visual verification is non-negotiable. Classifying a CSS-only change as plain `chore` to skip visual verification is a contract violation. |
| Framework improvement, new skill, hook, rule, or svc self-management work | `framework` → Lane 7 | Classify by use case per `framework-policy.md`: `test-framework` / `evolve-framework` for unknown gaps, `improve-framework` for known gaps, `diagnose-bug` for broken behavior, `write-spec` for new capabilities. |

**WI type field is descriptive, not a routing directive.** When routing
a named work item (WI-NNN), read the WI file to understand scope but
classify change type from the CODE CHANGE, not the WI's `**Type:**` field.
The WI type captures how the work was conceived; the code change determines
which lane applies. If the two disagree, the code change wins.

Reclassification rule: if the WI's `**Type:**` says `feature` but the
planned code change has no user-visible behavior, no new API surface, and
no UI change, reclassify as `chore` or `refactor` before building the
task graph. Log the reclassification as a `taste` decision in
`.svc/pipeline-decisions.jsonl`.

## On-Demand Skill Trigger Matrix

These skills are not in any lane's linear pipeline. They auto-insert into the task graph when their signal is detected. The skill that detects the signal is responsible for inserting the on-demand skill as a new task with correct `blocked_by` wiring.

| On-Demand Skill | Detected by | Signal | Insertion Point | Blocks |
|-----------------|-------------|--------|-----------------|--------|
| `research` | `analyze-domain`, `design-tech`, `execute-changeset`, `validate-feature`, `improve-framework` | Skill declares uncertainty AND knowledge base / stored research has no answer | Inline before the step that needs the answer | The dependent step |
| `manage-finops` | `validate-feature` (Q7), `design-tech` (Cost Model pillar) | External API, hosting, infra, or platform cost is a factor and builder profile shows budget sensitivity | After the unanswered cost question | Cost-dependent decisions (tech choice, hosting provider) |
| `monetization-architecture` | `validate-feature`, `design-tech` | Pricing tiers, freemium, subscriptions, usage limits, or paywall boundaries are in scope | After feature approval / during tech design when tier gating is in spec | `execute-changeset` until gating matrix exists |
| `review-cross-model` | `review-gate` | HIGH/CRITICAL severity finding on new data models, external integrations, auth, or payment flows | After `review-gate` if residual risk detected | `land-changeset` until convergence |
| `roadmap-evaluation` | `route-workflow`, `verify-promotion` | "What's next?" with zero active task graphs; or last WI in milestone just closed | After `verify-promotion` of final WI, or when route-workflow detects no actionable work | Next milestone planning until roadmap exists |
| `assess-market-readiness` | `route-workflow`, `verify-promotion` | Milestone complete; no active WIs; readiness for launch/hackathon/VC unknown | After last WI closes | Launch decision until readiness score exists |
| `find-opportunity` | `validate-feature` | Ship Brief = NO-SHIP and builder needs revenue-generating alternatives | Immediately after NO-SHIP decision | Re-routing until alternatives table exists |
| `stage-revenue` | `validate-feature`, `route-workflow` | Timeline > 2 weeks + no proven revenue model + limited capital/runway | After `validate-feature` when capital-risk profile matches | Big-vision execution until Stage 1 plan exists |
| `analyze-marketing` | `validate-feature`, `write-spec` | SHIP decision made; or competitive differentiators / product-market fit angles discovered in Layer 3 | After feature approval or spec Layer 3 | Launch-prep until marketing context exists |
| `strategic-decision` | `route-workflow` | N-way trade study with ≥3 viable options and multi-feature/year impact | **Pre-lane** — before lane selection | Lane selection until DECISION.md names downstream lane |
| `plan-capabilities` | `route-workflow`, `onboard-repo` | First session; empty/missing `capability-registry.json`; unrecognized project type | Before first lane execution | Downstream work until capability inventory exists |
| `mine-builder` | `route-workflow`, `verify-promotion` | First interaction and missing `~/.svc/builder-profile.md`; or post-project update needed | At session start if profile missing; or after project ships | Pipeline initialization until profile exists |
| `platform-operating-architect` | `route-workflow`, `onboard-repo` | Platform signals detected (Base44, Vercel, Supabase, Firebase, etc.) and no `docs/specs/platform-operating-model.md` | Before first lane execution if platform-heavy | Downstream work until operating model exists |
| `evaluate-rule` | `blend-external`, `improve-framework` | Blended rule has stale `source_sha` or `last_evaluated` > 90 days; or new rule pack proposed | After blend phase 4.5 or rule pack proposal | Rule registration until evaluation passes |

### Company operating fleet triggers

The following terminal routes require a valid repository-local company context and produce proposals only:

| Signal | Skill | Adjacent exclusion |
|---|---|---|
| `/cos`, company briefing, executive synthesis | `cos` | specialist analysis |
| growth hypothesis, acquisition, activation, retention experiment | `growth-lead` | instrumentation implementation |
| runway, unit economics, budget, spend review | `fin-analyst` | tax/legal advice |
| product problem, validation, roadmap priority | `product-lead` | technical design |
| market/category/competitor evidence | `market-intel` | growth execution |
| legal issue, contract risk | `counsel` | definitive legal advice |
| threat/control/security review | `security-ops` | privacy-law analysis |
| onboarding, adoption, support, churn | `customer-cs` | customer outreach |
| revenue stages, handoffs, pipeline process | `revops` | accounting |
| draft announcement or stakeholder message | `comms` | send/publish |
| tax evidence or filing-readiness gaps | `tax-auditor` | tax filing/advice |
| personal-data flow, retention, rights | `privacy-dpo` | general security |
| reliability, SLO, capacity, incident readiness | `infra-sre` | deployment execution |
| vendor requirements, diligence, comparison | `procurement` | purchase/sign/contact |
| experiment events, assignment, measurement | `growth-eng` | growth strategy/deploy |

**Insertion rules:**
1. The detecting skill MUST check the signal before building or updating the task graph.
2. If the signal is present, insert the on-demand skill as a new task in the existing lane's task graph with `blocked_by` pointing to the detecting skill's task.
3. Update the downstream task's `blocked_by` to point to the on-demand skill's task ID.
4. If the signal is absent, do not insert — no skip reason needed.
5. If the on-demand skill's output changes the lane shape (e.g., `strategic-decision` selects a different lane), log a `taste` decision to `pipeline-decisions.jsonl` and re-init the lane-tasks JSON.

---

## Host-Specific Capabilities (Non-Deteriorating)

Route-workflow does not branch on host — routing is determined by repo state and change type, not by which CLI is running. However, the agent may optionally leverage host-specific capabilities for better execution quality. See `references/host-capabilities.md` for the full matrix.

### Quick Reference

| Host | Notable Unique Features | Skills That Benefit |
|------|------------------------|---------------------|
| **Kimi CLI** | `/flow` auto-execution, subagents (`coder`/`explore`/`plan`), native background tasks, thinking toggle | `execute-changeset` (parallel subagents), `review-gate` (`/btw` side questions), multi-step skills (`/flow`) |
| **Claude Code** | Deep hooks integration (`PreToolUse`/`PostToolUse`/`Stop`), `CLAUDE.md` auto-injection | All skills (config protection, eval gates, task-completion guards) |
| **Codex CLI** | Strong cross-model review target | `review-cross-model`, `review-plan` |
| **AGY CLI** | 1M token context window | `onboard-repo` (massive codebase analysis), `analyze-competitors` (large doc ingestion) |

### Fallback Rule

Skills must work on every host without host-specific features. Host-specific capabilities are **enhancements only**, never requirements. See `references/host-capabilities.md` § "Host-Agnostic Fallback Rule".
