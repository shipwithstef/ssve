# Framework Evolution — 2026-04-09

**Status:** IMPLEMENTED (2026-04-09, worktree-only; replay-verified; no commit requested)

## Method

Read `FRAMEWORK-STATE.md` first to avoid rediscovering already-fixed task-graph and self-verify issues. Then compared the framework routing contract in `route-workflow/SKILL.md` and `skills-manifest.json` against a real brownfield repo (`example-marketplace`) that already carries heavy repo-local instructions in `AGENTS.md`, `CLAUDE.md`, platform config (`base44/config.jsonc` in this case), `docs/specs/project-state.md`, `docs/specs/work-items/INDEX.md`, and `docs/testing/BASE44_SKILLS_COMPLETE_REFERENCE.md`.

Focus of this review:
- whether repo-local routing-critical facts survive the `project-state.md` compression rule
- whether Pre-Flight actually checks the places where repos store local overrides
- whether generic platform heuristics lose to repo-local overrides in a deterministic way
- whether the framework distinguishes "platform supports agents" from "this repo has a defined delegation topology"

## Findings (by priority)

### P0 — Fix now (blocks routing quality)

#### 1. Repo-critical routing facts are not part of the router's compressed source of truth

**Category:** Gap / Fragility

**Evidence**
- `route-workflow/SKILL.md:83-86` tells the router to read `docs/specs/project-state.md` instead of exploring the repo.
- `route-workflow/SKILL.md:188-189` reinforces "Don't glob, don't git log, don't ls. The state file knows."
- `example-marketplace/docs/specs/project-state.md:21-40` lists artifact presence, but it does not summarize routing-critical rules like mandatory `base44-environment` deploy handling, code-style precedence, or platform-specific path constraints.
- `example-marketplace/AGENTS.md:7-23` contains mandatory deploy-routing rules.
- `example-marketplace/CLAUDE.md:55-69` and `example-marketplace/CLAUDE.md:146-150` contain additional hard overrides the router must know before routing or executing.

**Why this matters**

The framework currently treats `project-state.md` as the primary continuity artifact, but the repo's actual routing-critical contract still lives in prose elsewhere. That means a router can obey the framework and still miss the repo's most important override.

**Specific fix**

Add a first-class repo-routing artifact, for example `docs/specs/router-context.md` or a machine-readable `docs/specs/router-context.json`, generated during brownfield onboarding and refreshed when `AGENTS.md` / `CLAUDE.md` change.

Minimum fields:
- `required_skills_by_intent`
- `forbidden_tools_or_flows`
- `code_style_authority`
- `deployment_contract`
- `platform_signals`
- `repo_local_overrides`

Then update `route-workflow` so `project-state.md` points to this file and the router must load it before final skill selection.

#### 2. Pre-Flight checks for project skills in the wrong places for real repos

**Category:** Gap

**Evidence**
- `route-workflow/SKILL.md:1904-1905` says Pre-Flight should check `.claude/skills/` and `~/.claude/skills/` for project-specific skills.
- `example-marketplace/AGENTS.md:7-8` holds the strongest project-specific routing rule in the repo.
- `example-marketplace/CLAUDE.md:55-69` and `example-marketplace/CLAUDE.md:261-309` hold the actual deploy contract and deployment anti-patterns.
- `example-marketplace/base44/config.jsonc:1-12` exposes platform shape that should influence routing.
- `example-marketplace/docs/specs/project-state.md:39` explicitly records missing `skills-manifest.json`, so relying on repo-local skill packs is not sufficient here.

**Why this matters**

The Pre-Flight Protocol is supposed to stop skills from missing repo-specific overrides. In practice it only looks for overrides encoded as skills, while many mature repos encode them in `AGENTS.md`, `CLAUDE.md`, and platform config files.

**Specific fix**

Expand Pre-Flight into a repo-contract scan with explicit precedence:
1. repo `AGENTS.md`
2. repo `CLAUDE.md`
3. repo platform/runtime config (`base44/config.jsonc`, `package.json`, deploy config files, framework manifests)
4. repo-local skill directories
5. global skill directories

This should end in a short structured note inside task state, not just silent reading.

### P1 — Fix soon (degrades routing quality)

#### 3. Generic platform heuristics and repo-specific override skills have no explicit precedence contract

**Category:** Drift / Fragility

**Evidence**
- `example-marketplace/docs/testing/BASE44_SKILLS_COMPLETE_REFERENCE.md:31-40` says `base44-cli` / `base44-sdk` activate on any `base44` mention or `base44/` folder presence.
- `example-marketplace/docs/testing/BASE44_SKILLS_COMPLETE_REFERENCE.md:67-74` says `base44/config.jsonc` should route implementation work to `base44-sdk`.
- `example-marketplace/AGENTS.md:7-8` says deployment must always use `base44-environment`.
- `example-marketplace/CLAUDE.md:55-69` says the same, with stricter repo-specific constraints.

**Why this matters**

A router can correctly detect the platform/runtime family and still select the wrong skill for a given intent because the repo-specific override is stronger than the generic platform heuristic. In Example Marketplace the evidence case is Base44; the same failure mode would appear with any platform-specific skill, framework-specific skill, or generic deploy helper that loses to a repo-local override. The precedence is obvious to a human reviewer but not encoded as a deterministic rule.

**Specific fix**

Introduce project-level skill-precedence overrides, either in the new router-context artifact or in a small `skills-manifest.json` for user repos.

Example:
- `intent=deploy` + `platform=base44` + `repo_override=base44-environment` => force `base44-environment`
- `intent=implementation` + `platform=base44` => prefer repo-local skill if present, else `base44-sdk`
- generalized rule: `repo override > project-local platform rule > generic platform heuristic > global fallback`

Also teach `route-workflow` to distinguish `platform skill` from `repo override skill`, regardless of whether the platform is Base44, Next.js/Vercel, Rails/Heroku, or an internal company stack.

#### 4. The framework has no explicit contract for repo delegation topology, only for task graphs

**Category:** Opportunity / Fragility

**Evidence**
- `example-marketplace/base44/config.jsonc:6` declares `agentsDir`.
- `example-marketplace/docs/testing/BASE44_SKILLS_COMPLETE_REFERENCE.md:37-44` says the platform SDK covers agents.
- `example-marketplace/docs/testing/BASE44_SKILLS_COMPLETE_REFERENCE.md:80-89` documents `base44/agents/` as part of the standard project structure.
- The actual repo has no `base44/agents/` directory.
- `route-workflow/SKILL.md` has strong rules for task graphs and skill loading, but no equivalent repo-level contract for when subagents should be preferred, forbidden, or assigned ownership.

**Why this matters**

You asked specifically about agentic capabilities. Right now the framework can reason about lane sequencing, but it cannot tell whether a repo is merely agent-capable because the underlying platform supports agents, or whether the repo is actually configured for delegation. Example Marketplace shows the failure mode through Base44 metadata, but the generalized issue is broader: "platform can do agents" is not the same thing as "this repo wants or benefits from multi-agent execution." That makes delegation decisions too implicit and too host-dependent.

**Specific fix**

Add a lightweight agent-topology artifact for repos:
- `docs/specs/agent-topology.md` or `agent-topology.json`

Minimum fields:
- `delegation_allowed: true|false`
- `preferred_roles_by_work_type`
- `ownership_boundaries`
- `shared_write_surfaces`
- `repo_native_agents_dir_present`
- `when_to_stay_single_agent`

Then wire `route-workflow` and `execute-changeset` to read it before delegation decisions.

### P2 — Improve when possible (nice to have)

#### 5. Project state exposes multiple active lanes and in-progress items without a single active-focus pointer

**Category:** Inefficiency / Fragility

**Evidence**
- `example-marketplace/docs/specs/project-state.md:14-17` lists four active lanes at once.
- `example-marketplace/docs/specs/work-items/INDEX.md:10-16` lists two in-progress items at once.
- `example-marketplace/.svc/lane-tasks.json:2-47` still points at a completed WI, so there is no obvious one-file answer to "what should the router continue right now?"

**Why this matters**

When a user says "continue" or "do the next thing," the framework has enough information to know the repo state, but not always enough to know the intended active focus. That looks like router weakness even when the lane logic is correct.

**Specific fix**

Add an explicit `Current Focus` section to `project-state.md`:
- active work item id
- active lane
- active task graph file
- fallback next work item if no graph is open

And archive or rotate completed `lane-tasks.json` files per work item so stale completed graphs are not mistaken for live context.

### P3 — Track (not actionable yet)

No additional P3 items. The gaps above are concrete and actionable.

## Comparison delta

What competing frameworks tend to do better here:
- gstack and related harness patterns lean harder on auto-loaded repo instructions (`CLAUDE.md` / harness registration) rather than assuming a separate state file will preserve every routing-critical fact.
- Platform docs can be platform-aware, but they do not solve repo-specific precedence. That gap has to be closed by svc, not by the platform skill itself.

Assessment:
- The biggest delta is not "more skills"; it is better encoding of repo-local routing contracts.
- Agent delegation quality will improve more from explicit repo topology and skill precedence than from adding more subagent patterns.

## Stale proposal audit

- No directly overlapping pending proposal found in `proposals/`.
- These findings are adjacent to the already-completed self-verify and task-graph fixes, but they are not duplicates of them. The new gap is repo-contract ingestion and repo-level agent topology, not task-state enforcement.
