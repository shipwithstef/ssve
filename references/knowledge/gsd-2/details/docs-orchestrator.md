# GSD-2 Orchestrator, Workflows, and Documentation

## Mechanism

### Orchestrator SKILL.md (`/tmp/gsd-2/gsd-orchestrator/SKILL.md`)

The orchestrator is an autonomous agent skill that builds software by driving the `gsd` CLI as a subprocess. No SDK, no RPC — shell commands, exit codes, and JSON output only.

**Metadata (YAML frontmatter):**
- `name: gsd-orchestrator`
- `description`: Build software autonomously via GSD headless mode; handles spec → launch → poll → blockers → costs → verify.
- `openclaw.requires.bins: [gsd]`
- `openclaw.install.kind: node`, `package: gsd-pi`, `bins: [gsd]`

**Critical rules:**
1. **Flags before command.** `gsd headless [--flags] [command] [args]`. Flags after the command are ignored.
2. **Redirect stderr.** JSON to stdout; progress to stderr. Always `2>/dev/null` when parsing JSON.
3. **Exit codes.** `0`=success, `1`=error, `10`=blocked (needs orchestrator), `11`=cancelled.
4. **Use `query` to poll.** Instant (~50ms), no LLM cost. Use between steps, not `auto` for status.
5. **Budget awareness.** Track `cost.total` from query results. Set limits before long runs.
6. **One project directory per build.** Each project needs its own directory with a `.gsd/` folder.

**Routing section:**
- Build from scratch → `workflows/build-from-spec.md`
- Check running/completed build → `workflows/monitor-and-poll.md`
- Fine-grained control → `workflows/step-by-step.md`
- JSON output reference → `references/json-result.md`
- Pre-supply answers → `references/answer-injection.md`
- Command lookup → `references/commands.md`

**Quick reference commands:**
- Launch full build: `gsd headless --output-format json --context spec.md new-milestone --auto 2>/dev/null`
- Check state (free): `gsd headless query | jq '{phase: .state.phase, progress: .state.progress, cost: .cost.total}'`
- Resume: `gsd headless --output-format json auto 2>/dev/null`
- One step: `gsd headless --output-format json next 2>/dev/null`

**Flags table:**
- `--output-format <fmt>`: `text`, `json`, `stream-json`
- `--json`: alias for `--output-format stream-json`
- `--bare`: skip CLAUDE.md, AGENTS.md, user settings, user skills (CI/ecosystem)
- `--resume <id>`: resume prior headless session
- `--timeout N`: default 300000ms (0 = disable)
- `--model ID`: override LLM model
- `--supervised`: forward interactive UI requests to orchestrator via stdout/stdin
- `--response-timeout N`: 30000ms default in supervised mode
- `--answers <path>`: pre-supply answers/secrets JSON
- `--events <types>`: filter JSONL event types (comma-separated, implies `--json`)
- `--verbose`: show tool calls in progress
- `--context <path>` / `--context-text <text>`: spec input for `new-milestone`
- `--auto`: chain into auto-mode after `new-milestone`

**Answer injection schema:**
```json
{
  "questions": { "question_id": "selected_option" },
  "secrets": { "API_KEY": "sk-..." },
  "defaults": { "strategy": "first_option" }
}
```
- `defaults.strategy`: `"first_option"` (default) or `"cancel"` for unmatched questions.

**Event streaming:**
- 13 available event types: `agent_start`, `agent_end`, `tool_execution_start`, `tool_execution_end`, `tool_execution_update`, `extension_ui_request`, `message_start`, `message_end`, `message_update`, `turn_start`, `turn_end`, `cost_update`, `execution_complete`.

**All commands:**
`auto`, `next`, `query`, `new-milestone`, `dispatch <phase>`, `stop`/`pause`, `steer <desc>`, `skip`/`undo`, `queue`, `history`, `doctor`, `knowledge <rule>`.

### Build-From-Spec Workflow (`/tmp/gsd-2/gsd-orchestrator/workflows/build-from-spec.md`)

End-to-end workflow: product idea → working software.

**5-step process:**

1. **Prepare project directory**
   ```bash
   mkdir -p "$PROJECT_DIR" && cd "$PROJECT_DIR" && git init
   ```

2. **Write spec file**
   - Must include: what the user can DO, technical constraints, out-of-scope items.
   - Quality rule: vague specs produce vague results.

3. **Launch build**
   - Fire-and-forget: `gsd headless --output-format json --timeout 0 --context spec.md new-milestone --auto 2>/dev/null`
   - CI/ecosystem: add `--bare`
   - Budget-limited: use step-by-step mode (see `workflows/step-by-step.md`)

4. **Handle result by exit code**
   - `0` → verify deliverables, inspect `cost.total`, `commits.length`, run `query | jq '.state.progress'`
   - `1` → inspect stderr, check `.gsd/STATE.md`, retry or escalate
   - `10` → query for blocker details; options: steer, supply answers (`--answers`), force phase (`dispatch replan`), or escalate to human
   - `11` → cancelled; resume with `--resume <sessionId>`

5. **Verify deliverables**
   - `query | jq '{phase, progress, cost}'`
   - `git log --oneline`
   - Run project tests (`npm test`, `make test`)

**Complete example in the doc:** Todo API (Node.js + Express) with in-memory storage, 4 REST endpoints, health check, input validation, no auth.

### Monitor-and-Poll Workflow (`/tmp/gsd-2/gsd-orchestrator/workflows/monitor-and-poll.md`)

Primary monitoring via `gsd headless query` (~50ms, no LLM cost).

**Key `jq` fields:**
- Overall: `{phase, milestone, slice, task, progress, cost}`
- Next action: `.next` → `{action: "dispatch", unitType, unitId}`
- Done check: `.state.phase == "complete"`

**Phase meanings (13 phases):**
`pre-planning`, `needs-discussion`, `discussing`, `researching`, `planning`, `executing`, `verifying`, `summarizing`, `advancing`, `evaluating-gates`, `validating-milestone`, `completing-milestone`, `complete`, `blocked`, `paused`.

**Blocker handling (4 options):**
1. Steer: `gsd headless steer "Skip the database dependency..."`
2. Supply answers: write JSON answers file, run `gsd headless --answers fix.json auto`
3. Force phase: `gsd headless dispatch replan`
4. Escalate to user

**Cost tracking:**
- `query | jq '.cost.total'` — cumulative
- `query | jq '.cost.workers'` — per-worker breakdown
- Budget enforcement pattern provided as bash function `check_budget()` using `bc -l`.

**Poll-and-react loop:**
- Bash function `poll_project()` that emits `COMPLETE`, `BLOCKED`, or `IN_PROGRESS` with cost and progress string.

**Resuming work:**
- `gsd headless --output-format json auto 2>/dev/null`
- Or `gsd headless --resume "$SESSION_ID" --output-format json auto 2>/dev/null`

**Post-build artifact inspection:**
- `.gsd/PROJECT.md`, `.gsd/DECISIONS.md`, `.gsd/REQUIREMENTS.md`, `.gsd/milestones/M001-*/M001-*-SUMMARY.md`, `git log --oneline`

### GitBook Documentation (`/tmp/gsd-2/gitbook/`)

Structured documentation with the following hierarchy (from `SUMMARY.md`):

**Getting Started**
- Installation, Your First Project, Choosing a Model

**Core Concepts**
- `project-structure.md` — Milestone → Slice → Task hierarchy; `.gsd/` directory layout
- `step-mode.md` — Interactive one-step-at-a-time; wizard adapts to project state
- `auto-mode.md` — Autonomous execution loop; deep planning; runtime tool policy; reactive task execution; git isolation; crash recovery; timeout supervision; verification gates; stuck detection; cost tracking; dashboard (`Ctrl+Alt+G`); HTML reports; diagnostic tools (`doctor`, `forensics`)

**Configuration**
- Preferences, Providers, Custom Models, Git & Worktrees, Notifications, MCP Servers

**Features**
- Cost Management, Token Optimization, Dynamic Model Routing, Skills, Captures & Triage, Debug Sessions, Workflow Visualizer, Workflow Templates, Web Interface, Remote Questions, Working in Teams, Parallel Orchestration, Headless & CI Mode, GitHub Sync

**Reference**
- Commands, Keyboard Shortcuts, CLI Flags, Environment Variables, Troubleshooting, Migration from v1

**Key docs read in detail:**

| File | Key Content |
|------|-------------|
| `README.md` | GSD elevator pitch; 12 key features (autonomous execution, 20+ LLM providers, git isolation, cost tracking, crash recovery, skills, parallel milestones, remote questions, web UI, VS Code extension, headless mode); quick start `npm install -g gsd-pi` |
| `core-concepts/project-structure.md` | `.gsd/` canonical layout: `PROJECT.md`, `REQUIREMENTS.md`, `DECISIONS.md`, `KNOWLEDGE.md`, `RUNTIME.md`, `STATE.md`, `milestones/<MID>/<MID>-ROADMAP.md`, `slices/<SID>/<SID>-PLAN.md`, etc. |
| `core-concepts/auto-mode.md` | Execution loop: Plan → Execute → Complete → Reassess → Validate. Tool policies: `all`, `planning`, `planning-dispatch`, `docs`. Reactive execution: parallel subagents when ≥3 ready tasks. Git isolation modes: `none`, `worktree`, `branch`. Timeout tiers: soft 20min, idle 10min, hard 30min. Verification commands config. Worktree telemetry in forensics. |
| `core-concepts/step-mode.md` | `/gsd` starts step mode; states: no `.gsd/` → vision discussion; milestone exists → research/plan; roadmap exists → plan/execute; mid-task → resume. Between steps: `/gsd discuss`, `/gsd skip`, `/gsd undo`, `/gsd auto`. |
| `features/skills.md` | Skill directories: `~/.agents/skills/` (global), `.agents/skills/` (project-local, committable). Install via `npx skills add`. Discovery modes: `auto`, `suggest` (default), `off`. Preferences: `always_use_skills`, `prefer_skills`, `avoid_skills`, `skill_rules`. Custom skill: directory + `SKILL.md`. Skill health dashboard with staleness detection (`skill_staleness_days: 60`). |
| `features/workflow-templates.md` | 8 built-in templates: `bugfix`, `spike`, `feature`, `hotfix`, `refactor`, `security-audit`, `dep-upgrade`, `full-project`. Custom workflows via YAML with phases, dependencies, config per step. Commands: `/gsd start`, `/gsd templates`, `/gsd workflow new/run/list/validate/pause/resume`. |
| `features/web-interface.md` | Launch: `gsd --web`. Flags: `--host`, `--port`, `--allowed-origins`. Features: project management, real-time progress, multi-project via `?project=`, onboarding flow, model selection. Windows build skipped due to Next.js compatibility. |
| `features/parallel.md` | Enable via `parallel.enabled: true`, `max_workers: 2`. Workers: separate GSD process, own worktree, branch `milestone/<MID>`, own metrics.json, own auto.lock. File-based IPC in `.gsd/parallel/`. Eligibility: not complete, dependencies satisfied, file overlap warning. Merge reconciliation: `.gsd/` auto-resolved; code conflicts halt. Budget ceiling tracked across all workers. |
| `features/teams.md` | Team mode: `mode: team` in `.gsd/PREFERENCES.md`. Effects: `unique_milestone_ids`, `git.push_branches`, `git.pre_merge_check`. `.gitignore` guidance: local-only files (lock, metrics, state, activity, worktrees) vs shared files (PROJECT.md, REQUIREMENTS.md, DECISIONS.md, milestones/). Parallel development: each dev gets own worktree and branch; dependencies declared in milestone frontmatter. |
| `reference/commands.md` | 48+ commands across session, config/diagnostics, milestone management, parallel orchestration, workflow templates, custom workflows, extensions, GitHub sync, session management, GSD worktree management. |
| `reference/cli-flags.md` | Flags for starting GSD (`--continue`, `--model`, `--web`, `--worktree`, `--no-session`, `--extension`, `--append-system-prompt`, `--tools`), non-interactive (`--print`, `--mode`), session management (`sessions`, `--list-models`), config (`config`, `update`), headless (`--timeout`, `--max-restarts`, `--json`, `--context`, `--auto`, `query`), web (`--host`, `--port`, `--allowed-origins`). |

## Analysis

- **The orchestrator is a meta-skill, not a runtime.** It has no compiled code in the read set — it is purely a Markdown contract that tells an outer agent how to shell out to `gsd`. This is a clean separation: GSD does the work; the orchestrator manages the loop.
- **Headless mode is the real API surface.** All programmatic interaction goes through CLI flags, exit codes, and JSON/JSONL output. There is no HTTP API, no library binding, no gRPC. This makes GSD trivial to wrap in shell scripts, CI pipelines, cron jobs, and other agents.
- **Documentation is product-grade.** The GitBook structure covers installation → concepts → configuration → features → reference, with a comprehensive command reference and CLI flag reference. This suggests GSD is intended for end-user consumption, not just internal tooling.
- **The `.gsd/` directory is the single source of truth.** State is derived from files on disk (markdown frontmatter, checkboxes in ROADMAP.md/PLAN.md) rather than a database. This makes the system inspectable, version-controllable, and resilient to crashes — but also means file I/O performance matters at scale.
- **Parallel mode is worktree-based, not thread-based.** Each worker is a full separate GSD process with its own context window, metrics, and lock file. This is expensive but provides true isolation. The coordinator uses file-based IPC (heartbeat/signal files), which is simple but may have latency issues under high-frequency polling.
- **Team mode and parallel mode overlap conceptually** but serve different audiences: team mode is about multi-developer concurrency on the same repo; parallel mode is about running multiple milestones simultaneously. Both use git worktrees.
- **Tool policy enforcement is runtime, not prompt-only.** Auto-mode units declare a `ToolsPolicy` in their `UnitContextManifest`, and GSD enforces it before tool calls. This is a hard security boundary: planning units cannot write source files or run arbitrary bash, even if the model tries.

## L4 Pointers

- **Missing workflow file:** `workflows/step-by-step.md` is referenced in the orchestrator routing section but was not read. It is the budget-enforcement alternative to `--auto`.
- **Missing reference files:** `references/json-result.md` (HeadlessJsonResult schema), `references/answer-injection.md` (full answer-file mechanism), `references/commands.md` (full command reference) were referenced but not in the read set.
- **Exit code 10 (blocked) semantics:** The orchestrator says "needs you" but does not specify the JSON shape of blocker data inside the `query` result. The monitor workflow shows `jq '{phase, blockers, nextAction}'` but the exact schema of `.state.blockers` is undocumented in the read set.
- **Event streaming gaps:** 13 event types are listed, but the JSON schema for each type is not documented in the read files. The example shows `.type`, `.toolName`, `.message`, `.title` fields.
- **Supervised mode:** `--supervised` forwards "interactive UI requests to orchestrator via stdout/stdin" with a default 30s response timeout. This is a critical path for fully autonomous loops but its wire protocol is not detailed in the read files.
- **Headless crash recovery:** Auto-mode in headless has exponential backoff (5s → 10s → 30s, up to 3 restarts). This is mentioned in `auto-mode.md` but not in the orchestrator SKILL.md, which only documents `--max-restarts N` in CLI flags.
- **GitBook not fully read:** `getting-started/installation.md`, `getting-started/first-project.md`, `getting-started/choosing-a-model.md`, `configuration/*.md`, `features/cost-management.md`, `features/token-optimization.md`, `features/dynamic-model-routing.md`, `features/captures.md`, `features/debug.md`, `features/visualizer.md`, `features/remote-questions.md`, `features/headless.md`, `features/github-sync.md`, `reference/keyboard-shortcuts.md`, `reference/environment-variables.md`, `reference/troubleshooting.md`, `reference/migration.md` were all referenced in `SUMMARY.md` but not read.
