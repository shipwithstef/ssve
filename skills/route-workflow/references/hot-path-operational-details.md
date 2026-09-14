# Route-Workflow Hot-Path Operational Details

This file holds the longer operational clauses that used to live in
`skills/route-workflow/SKILL.md`. The skill body is the hot path; this reference is
loaded only when a route needs the detail.

## Session Setup

Detect host and model profile with:

```bash
bash <SKILLS_PATH>/scripts/detect-host.sh
bash <SKILLS_PATH>/scripts/resolve-model.sh STRAT --json
```

Use `<SKILLS_PATH>` for the active host:

| Host | Skills path |
|---|---|
| Kimi | `~/.kimi/skills/` |
| Claude | `~/.claude/skills/` |
| Codex | `~/.codex/skills/` |
| Gemini | `~/.gemini/skills/` |
| OpenCode | `~/.config/opencode/skills/` |
| Antigravity | `~/.gemini/antigravity/skills/` |
| Cursor | `~/.cursor/skills/` |

If `.svc/` is missing, initialize it with:

```bash
node <SKILLS_PATH>/scripts/init-project-state.mjs
```

This creates `.svc/orchestrator-state.json`, `.svc/capability-registry.json`,
`.svc/framework-gaps.jsonl`, and `.svc/pipeline-decisions.jsonl`.

## Session Contract Details

The most recent `.svc/session-contract.jsonl` row binds the session:

```json
{"ts":"ISO-8601","bound_to":"user-request|wi-backlog|framework-evolution","execution_mode":"normal|end_to_end","request":"<summary>","wi":null,"skill":null,"guard_override_count":0}
```

Write a fresh row at session start, on explicit intent switch, after a
completed prior request followed by an imperative decision word, when a skill
finishes and the user says continue, or when the user asks for end-to-end work.

## Pre-Lane On-Demand Skills

Check these before lane selection:

| Signal | Skill |
|---|---|
| N-way trade study with >=3 viable options | `strategic-decision` |
| First session, empty capability registry, or unrecognized project type | `plan-capabilities` |
| Missing builder profile | `mine-builder` |
| Platform-heavy repo without operating model | `platform-operating-architect` |
| "What's next?" and no active task graph | `roadmap-evaluation` |
| Milestone complete and launch readiness unknown | `assess-market-readiness` |
| Launch/legal/credits/incorporation/tax prompt | `launch-knowledge` |
| Landing/marketing/home/pricing/feature page prompt or WI tag | `landing-page` |
| Visual asset request or visual asset needed by another skill | `generate-visuals` |
| New skill proposal or "create a skill" request | `create-skill` |
| Competitive UX gap or interactive UX comparison request | `explore-ux` |

If invoked, the pre-lane skill determines the downstream lane and must be logged
as a `taste` decision.

## Discussion-Phase Routing

Use `discuss-phase` only for bounded high-impact ambiguity after choosing the
entry lane. Reroute precedence:

1. broken known behavior or regression -> `diagnose-bug`
2. unvalidated demand, wedge, or feature value -> `validate-feature`
3. unresolved gray-area cluster with expensive downstream consequences -> `discuss-phase`
4. no actionable ambiguity -> continue the current lane

When a discussion artifact exists, read `docs/specs/discussions/<topic>.md` and
respect its `blocked`, `rerouted`, or `proceed` status.

## Lifecycle Context For Recommendation Skills

Before `landing-page`, `cro`, `popups`, `signup`,
`paywalls`, or `pricing`:

1. Read `docs/specs/project-state.md`.
2. Extract `project_lifecycle.stage` and `project_lifecycle.paying_customers`.
3. If unreadable, invoke `assess-market-readiness` or ask the user.
4. Pass the lifecycle block to the downstream skill.

## Concern Scan Gate

Before mutating code or dispatching a mutating WI, run:

```bash
node <SKILLS_PATH>/scripts/scan-concerns.mjs --project <repo-root> --diff
```

Use `--staged` or `--paths <files...>` when that better matches the scope.
Exit-code handling:

| Exit | Meaning | Route action |
|---|---|---|
| 0 | no blocking concern | proceed |
| 3 | CRITICAL | hard-block until required skill/rule or explicit waiver |
| 4 | HIGH only | require PR/body ack per concern |
| other | MEDIUM/LOW | advisory; log to `.svc/concern-hits.jsonl` |

Project-side concerns under `<project>/.svc/concerns/` shallow-merge over the
universal concern registry.

## Pre-WI Dispatch Gate

Before reading `.svc/lane-tasks-<WI>.json`:

1. Read the session contract.
2. Proceed if the latest user message references the WI by ID/name/subject.
3. Otherwise proceed only if it references the pending skill/lane.
4. Otherwise proceed only if `bound_to == "wi-backlog"` and the user said continue.
5. Otherwise pause with an advisory and log the gate outcome.

Terminal skills default this gate to advisory mode until the user explicitly
switches context.

## Visual Evidence Obligation

Visual-output skills must not complete without live in-app evidence. Resolve
the directory from `outputs.produces` with `artifact: live-page-screenshots`;
fallback to `docs/specs/<skill>/in-app-verification/`. Capture both light and
dark screenshots in the last 30 minutes or log an explicit override.

## Pre/Post Validation Obligation

For mutating, corrective, deploy-affecting, or acceptance-validation work, pass
`references/pre-post-validation-loop.md` to the downstream execution and
verification skills. The task graph is not closeable until the selected
acceptance-critical command, journey, probe, or visual capture has pre-change
evidence, post-change evidence, and a comparison classification, or an explicit
`no_pre_baseline_reason`.
When machine-readable evidence exists, require
`node scripts/validate-pre-post-validation-evidence.mjs --evidence <path>` in
the closeout.

## Post-Compaction Recovery

After compaction:

1. Read `.svc/lane-tasks-<WI>.json`.
2. Find the first `in_progress` task, else first unblocked `pending` task.
3. Re-load the skill with `node scripts/task-graph.mjs load-skill`.
4. Re-read the skill body.
5. Resume from the task graph, not memory.
6. Never complete a task without a matching skill receipt.

Review tasks must set `metadata.skill: "review-gate"` so the review protocol
cannot be ghost-completed.

## SME-agent dispatch (WI-435)
Beyond skills/tools, a stage or domain may have a registered subject-matter-EXPERT agent (`skills-manifest.json` `expertiseRegistry`). When a task maps to a registered stage/domain, resolve the SME agent with `node scripts/expertise.mjs resolve --stage <stage>` (or `--domain <domain>`) — it prints the matching agent(s) + a machine-readable `AGENT=<name>` — and sequence that agent into `.svc/lane-tasks-<WI>.json`. The agent loads its current, sourced domain expertise + experience at run-start via `expertise.mjs preload` (the 4-layer contract). E.g. a finance/economics stage → `financial-analyst`; an `appsec-secops` domain → `security-ops`. This is the agent-level companion to the skill-level owner resolution; the SME agent is propose-only and dispatched, never self-selecting.

## Remaining Operational Gates

- **SDKG:** route registry triggers through `scripts/lib/post-task-trigger-router.mjs`; malformed registered framework-evolution state blocks unless an explicitly logged `SVC_SDKG_FAIL_OPEN=true` decision exists.
- **Provider fidelity:** set `provider_fidelity: required`, load `references/provider-fidelity.md`, emit the named evidence file, and run `node scripts/validate-provider-fidelity-evidence.mjs --evidence <path>`.
- **Cross-system work:** require `_shared/system-contract-map.md`, run `node scripts/validate-system-contract-map.mjs --map <path>`, and on the third same-WI diagnosis run `node scripts/check-cross-system-iteration-cap.mjs --lane-tasks .svc/lane-tasks-<WI>.json`.
- **Phase changes:** compare `Product phase:` with `.svc/orchestrator-state.json:lastSeenPhase`, activate the new artifact set, then persist the new phase.
- **Solution confidence:** apply `references/solution-confidence-protocol.md`; default `design_auto`, and use a human gate or intake-only mode only when explicitly requested.
- **Capability blockers:** run `node scripts/diagnose-capability-blocker.mjs --text "<blocker>" --ledger .svc/capability-blockers.jsonl --state detected --source route-workflow --wi <WI>`, route the detected class, then run `node scripts/validate-capability-blocker-ledger.mjs --ledger .svc/capability-blockers.jsonl`.
- **Intended owners and company fleet:** resolve `ownersRegistry`, project task owners, `expertiseRegistry`, and company-link context before dispatch. Project rows shadow global rows; fleet roles are proposer-only.
