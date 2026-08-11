### Check Project State

Before routing, check for existing svc project state:

```bash
[ -f docs/specs/project-state.md ] && echo "EXISTS" || echo "NOT_FOUND"
```

If it exists, **read it first instead of re-exploring the repo blindly.**
This file is the broad project context — lanes, artifacts, decisions, work
items, continuity.

**Then check for a repo routing contract:**

```bash
[ -f docs/specs/router-context.md ] && echo "ROUTER_CONTEXT_EXISTS" || echo "ROUTER_CONTEXT_NOT_FOUND"
```

If `docs/specs/router-context.md` exists, read it before final skill selection.
`project-state.md` tells you the broad state of the repo. `router-context.md`
tells you the repo-specific routing-critical overrides that must beat generic
platform or framework heuristics.

If `router-context.md` does not exist in a brownfield repo, do a one-time
repo-contract scan before routing:
- `AGENTS.md` if present
- `CLAUDE.md` if present
- platform/runtime config (`package.json`, framework manifests, deploy config files)

Then log the absence as conversion/alignment drift and prefer creating the
router context through `onboard-repo` or a conversion refresh rather than
rediscovering the same repo rules every session.

If it doesn't exist, create it after the first skill completes.

#### Project State Template

**Under 100 lines. A digest, not an archive.** It points to other files
for details — doesn't duplicate them.

```markdown
# Project State

Last updated: <date> by <skill>

## Project (compressed — don't re-read vision/domain/competitors for this)
Product: <one sentence — what is this>
Domain: <industry / space>
Stack: <key tech>
Target user: <primary persona, one line>
Differentiation: <vs competitors, one line>
Builder: <key constraints from builder profile — budget, time, skills>

## Position
Lane: <greenfield / brownfield-feature / bugfix / etc>
Phase: <N> of <M> (<skill name>)
Status: <planning / executing / blocked / completed>
Next: <next skill>
Last activity: <date> — <what happened>
Product phase: <pre-revenue / live-users-no-money / taking-money / scaling> (§5 artifact-sets — `references/artifact-sets.md`)
Product type: <consumer-mobile / marketplace / b2b-saas / other> (§5 artifact-sets)

## Current Focus
Active work item: <WI-### or none>
Active lane: <lane name or none>
Active task graph: <.svc/lane-tasks-<WI>.json or none>
Fallback next item: <highest-priority identified item when no graph is active>

## Completed Phases
| # | Skill | Date | Output |
|---|-------|------|--------|
| 1 | write-vision | 2026-04-06 | docs/specs/vision.md |
| 2 | build-personas | 2026-04-06 | P1, P2, P3 |

## Active Artifacts
Vision: docs/specs/vision.md
Domain profile: docs/specs/domain-profile.md (exists/not yet)
Competitors: docs/specs/analyze-competitors.md (exists/not yet)
Router context: docs/specs/router-context.md (exists/not yet)
Agent topology: docs/specs/agent-topology.md (exists/not yet)
Spec: docs/specs/features/<name>.md (DRAFT)
Plan: not yet
Worktree: none

## Decisions (recent — full log in .svc/pipeline-decisions.jsonl)
- SQLite over JSON (taste, P0)
- Commander.js for CLI (taste, P0)

## Blockers
None.

## Builder Context (summary — full at ~/.svc/builder-profile.md)
$0 budget | 10 hrs/week | Python/Node/Docker | Reddit r/selfhosted
```

#### Continue-Here File

When a session is interrupted mid-skill (context limit, user exits, crash),
and there is **no active task graph**, write `.continue-here.md` at project root:

```markdown
---
skill: execute-changeset
task: 3 of 7
status: in_progress
last_updated: 2026-04-07T14:30:00Z
---

## What's done
- Task 1 (types): committed
- Task 2 (data layer): committed
- Task 3 (service): half done — wrote tests, implementation in progress

## What's left
- Task 3: finish service implementation, run tests
- Tasks 4-7: not started

## Decisions made this session
- Used better-sqlite3 over sql.js (performance for CLI)

## Next action
Start with: finish src/services/bookmark-service.ts, then run tests
```

**On session start:** glob `.svc/lane-tasks-*.json` for any files with pending tasks.
If any exist, read them first and resume the highest-priority in-progress WI. Only if
no task-graph files exist should you read `.continue-here.md`. Delete the
`.continue-here.md` file after successfully resuming (not the task-graph file).

**On session interrupt:** write `.continue-here.md` only for non-task-graph
sessions. This is ephemeral — it exists only between sessions.

#### Repo Routing Contract

`docs/specs/router-context.md` is the canonical repo-local routing contract for
brownfield repos. It exists so the router does not have to rediscover critical
rules from scattered prose every session.

Minimum contents:

```markdown
# Router Context

Last updated: <date> by <skill>

## Required Skills By Intent
- deploy -> <repo-specific deploy skill if any>
- implementation -> <repo/platform-specific implementation skill if any>
- qa -> <repo-specific QA skill if any>

## Precedence
- repo override > project-local platform rule > generic platform heuristic > global fallback

## Forbidden Tools Or Flows
- <tool/flow> — <reason>

## Code Style Authority
- Canonical source: <path>
- Overrides generic/global rules: yes/no

## Deployment / Runtime Contract
- Runtime/platform signals: <key files or directories that identify the stack>
- Deploy path: <what must happen>
- Anti-patterns: <what must never happen>

## Delegation Notes
- Single-agent only for: <work types>
- Delegation allowed for: <work types>
- Ownership caveats: <shared write surfaces or merge hazards>
```

This file is intentionally short. It is a routing contract, not a full system
design document.

#### Agent Topology Contract

`docs/specs/agent-topology.md` is the canonical repo-local delegation contract.
It answers a different question from platform capability: not "can this
platform support agents?" but "how should work in this repo be delegated, if at all?"

Minimum contents:

```markdown
# Agent Topology

Last updated: <date> by <skill>

## Delegation Policy
- Delegation allowed: true|false
- Default mode: single-agent | selective delegation | parallel worker slices

## Preferred Roles By Work Type
- research -> explorer
- bounded implementation -> worker
- tightly-coupled bugfix -> single-agent

## Ownership Boundaries
- <module/path> -> <owner or worker type>

## Shared Write Surfaces
- <paths that should not be edited in parallel>

## Platform Signals
- Agent-capable signals present: <yes/no + evidence>
- Repo-native agent configuration present: <yes/no + evidence>

## Stay Single-Agent When
- <conditions where delegation is more expensive or risky than local work>
```

If `agent-topology.md` is missing, default conservatively: do not infer that
platform support for agents means the repo wants or benefits from delegation.

#### How Product-Lane Skills Use Project State

**On start:** product-lane skills that own state transitions should read
`docs/specs/project-state.md`. This tells you where you are, what exists,
and what was decided. Don't re-explore — trust the state.

**On routing-sensitive decisions:** also read `docs/specs/router-context.md`
when it exists. The router context is the repo-local override layer:
- required skills by intent
- forbidden tools or flows
- code-style authority
- deployment/runtime contract
- platform signals
- delegation constraints

`project-state.md` is the continuity digest. `router-context.md` is the
repo-specific routing contract. Do not collapse them into one mental model.

**On completion:** the skill that just advanced the product lane updates
`docs/specs/project-state.md`:
- Advance phase
- Add completed phase to table
- Update active artifacts
- Update "Last updated" line

**This replaces broad repo exploration.** Don't glob the whole repo or rely on
memory when `project-state.md` and `router-context.md` already exist. If either
is stale, fix it — don't ignore it and re-scan everything from scratch.

### Session Continuity

**For product work:** `project-state.md` is the primary continuity artifact,
and `router-context.md` is the primary routing-override artifact:

- Which phase is in progress → resume there
- Which artifacts exist → load only those
- Which decisions are active → don't re-ask
- Which session this is → append to session log
- Which repo-specific overrides beat generic heuristics → read `router-context.md`

If project-state.md doesn't exist, fall back to:
1. Check `.svc/pipeline-decisions.jsonl` — last entry shows where the pipeline was
2. Check `git worktree list` — if a feature worktree exists, a changeset is in progress
3. Check `git log -1 --format=%ci` — if recent, likely resuming

Then create `project-state.md` from what you find. If brownfield repo-local
rules are discovered in `AGENTS.md`, `CLAUDE.md`, or platform config, create
`router-context.md` too.

**For framework work:** reading FRAMEWORK-STATE.md answers everything:

- What was already analyzed → don't rediscover
- What was already fixed → don't re-propose
- What's intentionally deferred → don't re-raise without new evidence
- What decisions are locked → don't re-litigate
- What known gaps remain → start here

If the user is working ON svc (this repo) to diagnose or prioritize framework
gaps, use FRAMEWORK-STATE.md.
If the user is doing product-style feature work ON svc itself, use both:
FRAMEWORK-STATE.md for framework memory and `docs/specs/project-state.md` for
the active implementation lane.
If working ON a user project, use project-state.md.

**Create `~/.svc/builder-profile.md`:**

```markdown
# Builder Profile

Last updated: <date>

