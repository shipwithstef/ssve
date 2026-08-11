# Serious Vibe Coding — Kimi Code CLI Context

> Read this file at the start of every Kimi Code CLI session on this project.
> Tell Kimi CLI: "Read KIMI.md and then let's work on [your goal]."

---

## Framework

This project uses **Serious Vibe Coding (svc)** — a progressive narrowing pipeline
for reliable agentic software engineering. You are operating as the Kimi Code CLI host.

Framework doctrine: `~/.kimi/skills/DOCTRINE.md`
Repo modes: `~/.kimi/skills/REPO_MODES.md`
Worktree model: `~/.kimi/skills/WORKTREES.md`

---

## Project State

<!-- onboard-repo fills this in -->
- **Repo mode:** <!-- bootstrap | convert -->
- **Active lane:** <!-- greenfield | brownfield-feature | bugfix | refactor | drift -->
- **Active skill:** <!-- current skill in pipeline -->
- **Active work item:** <!-- WI-NNN or — -->
- **Task graph:** `.svc/lane-tasks-<WI>.json` (source of truth for task status)

---

## How to Invoke Skills (Kimi Code CLI)

Skills live at `~/.kimi/skills/<skill-name>/SKILL.md`.

Kimi discovers skills automatically from `~/.kimi/skills/` and project-level `.kimi/skills/`.
To load a skill explicitly, use the slash command:
> `/skill:<name>` — e.g., `/skill:route-workflow`

To execute a multi-step flow skill:
> `/flow:<name>` — e.g., `/flow:code-review`

**Quick reference — most common skills:**

| Intent | Skill |
|---|---|
| Route work to the right lane | `route-workflow` |
| Don't know what to build | `find-opportunity` |
| New product / major feature | `write-vision` → `analyze-domain` → `build-personas` |
| Validate a feature idea | `validate-feature` |
| Write a feature spec | `write-spec` |
| Design UX / UI | `design-ux` → `design-ui` |
| Technical architecture | `design-tech` |
| Build the implementation plan | `plan-changeset` |
| Execute the plan (code it) | `execute-changeset` |
| Review before merge | `review-gate` |
| Land and merge | `land-changeset` |
| Verify after merge | `verify-promotion` |
| Fix a bug | `diagnose-bug` → `plan-changeset` → `execute-changeset` |
| Onboard existing repo | `onboard-repo` |
| Quick trivial fix (≤3 files) | `quick-fix` |

Full skill list: `~/.kimi/skills/skills-manifest.json`

---

## Kimi-Specific Superpowers

### Subagents
Kimi has built-in subagent types. Use them strategically:
- **`coder`** — general software engineering (read/write files, run commands)
- **`explore`** — fast read-only codebase exploration (no write tools)
- **`plan`** — implementation planning and architecture design (no Shell, no write tools)

Dispatch a subagent when you need isolated context or parallel work:
> Launch an `explore` subagent to map the codebase while you plan.

### Background Tasks
Use `Shell` with `run_in_background=true` for long-running builds, tests, or servers.
Monitor them with the `/task` TUI browser or `TaskList` / `TaskOutput` tools.

### Plan Mode
Toggle with `/plan` or use `EnterPlanMode` / `ExitPlanMode` tools.
In plan mode, you can only use read-only tools to explore and write a plan file.
Use this for architectural decisions before touching code.

### Model Switching
Use `/model` to toggle thinking mode or switch models mid-session.
For deep reasoning (architecture, strategy): enable thinking.
For fast execution (file edits, bash loops): disable thinking.

### YOLO Mode
Use `/yolo` to auto-approve all actions during mechanical execution phases.
Enable when executing a fully-reviewed plan-changeset manifest.
Disable before any operation that could damage data or production.

---

## Enforcement Rules (Kimi Code CLI — Behavioral)

### File Edit Guard
- **Never** edit linter, formatter, type-checker, or test-runner config files to suppress errors. Fix the code, not the config.
- **Never** edit lock files (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `Cargo.lock`, `go.sum`) manually.
- **Never** write outside the current skill's declared output paths without stating an explicit reason.

### Git Guard
- **Never** use `--no-verify` or `--no-gpg-sign` git flags.
- Every commit must include a `Co-Authored-By:` trailer.
  - For Kimi CLI sessions: `Co-Authored-By: Kimi Code CLI <contact-4baf1bf8ca@example.invalid>`
- Commit messages must be specific: scope + imperative verb + what changed + why.
  ❌ "fix stuff" ❌ "update" ✅ `feat(auth): add email verification on signup`

### Task Completion Guard
Before marking any task complete, verify:
1. All acceptance criteria in the spec are addressed
2. Tests pass (run the test command for this project's stack)
3. No linter errors in files touched this session
4. The task's eval matrix pillars are filled (correctness, test coverage, spec alignment, security, performance, UX, accessibility, maintainability)

### Session End Quality Check
At the end of every execute-changeset session, run:
- Format check on all files edited this session
- Type check (if TypeScript/Go/Rust/Python)
- Test suite for affected modules

---

## Project Rules

<!-- onboard-repo / define-code-style fills this in per project -->

### Tech Stack
<!-- e.g. Next.js 14, TypeScript, Supabase, Dodo Payments -->

### Code Style Authority
<!-- e.g. "Follow the pattern in src/components/Card.tsx" -->

### Deployment / Runtime Contract
<!-- e.g. "Vercel Edge Runtime — no Node.js built-ins in /app/api routes" -->

### Forbidden Patterns
<!-- e.g. "Never use useEffect for data fetching — use TanStack Query" -->

### Steering Rules (Stack-Specific)
After `onboard-repo` or `define-code-style` detects the active stack, load the relevant steering rules explicitly:

```bash
# Example for React + web + Base44 projects
cat ~/.kimi/skills/rules/web/performance.md
cat ~/.kimi/skills/rules/web/design-quality.md
cat ~/.kimi/skills/rules/react/patterns.md
cat ~/.kimi/skills/rules/react/coding-style.md
cat ~/.kimi/skills/rules/base44/schema.md
```

If a stack has no populated rule file (placeholder only), skip it and rely on the style contract instead.

---

## Worktree Model

All implementation happens in a git worktree branched from main.
Never implement directly on main.

```bash
# Create worktree for a feature
bash ~/.kimi/skills/scripts/worktree.sh create feature/your-feature-name

# Promote (squash merge) when done
bash ~/.kimi/skills/scripts/worktree.sh promote feature/your-feature-name
```

Full model: `~/.kimi/skills/WORKTREES.md`

---

## Task Graph (Cross-Session Continuity)

All task state lives in `.svc/lane-tasks-<WI>.json` — this is the source of truth across sessions and hosts.

At the start of each session:
1. Read the active `.svc/lane-tasks-<WI>.json`
2. Find the first `pending` or `in_progress` task
3. Resume from there

Kimi CLI has native `TaskList`/`TaskOutput` tools. Use them to query background work, but keep the file as the authoritative task record.
Load named skills with `/skill:<name>` (or by opening the matching `SKILL.md`) and record the load via `node scripts/task-graph.mjs load-skill ...` before marking a task completed.

---

## Host Auto-Detection & Dynamic Model Routing

This framework auto-detects that you are running on **Kimi Code CLI**. The default profile is **`kimi-native`** — everything stays inside Kimi.

### Default (kimi-native)
- **[STRAT]** → `kimi-for-coding` + thinking ON
- **[PLAN]** → `kimi-for-coding` + thinking ON
- **[EXEC]** → `kimi-for-coding` + thinking OFF
- **[REVIEW]** → `kimi-for-coding` + thinking ON
- **[SENSE]** → `kimi-for-coding` + thinking ON
- **[DISC]** → Native `SearchWeb` / `FetchURL`
- **[PASS]** → `kimi-for-coding` + thinking OFF

### Switch to Mixed Profile (Kimi + MiMo)
If you want Kimi to orchestrate but delegate heavy execution to MiMo (the framework's proven pattern):
```bash
export SVC_MODEL_PROFILE=kimi-orchestrator-mixed
```

Or use the production default (`svc-default`): strategy/planning on Opus, execution/review on Sonnet, SENSE delegated to MiMo when MIMO_API_KEY is set (WI-357):
```bash
export SVC_MODEL_PROFILE=svc-default
```

Verify resolution anytime:
```bash
bash ~/.kimi/skills/scripts/resolve-model.sh STRAT --json
bash ~/.kimi/skills/scripts/resolve-model.sh EXEC --json
```

For cross-model review (`review-cross-model`), spawn a second Kimi instance or use the built-in `/btw` side-question for adversarial checking.

---

## Framework Evolution

When the framework itself needs changes — new hooks, new skills, routing fixes, gap closure — **do NOT use normal product lanes**.

Framework work has its own skills:

| Intent | Skill |
|---|---|
| Add new framework capabilities, architecture changes | `evolve-framework` |
| Fix existing framework, close gaps, optimize | `improve-framework` |
| Test the framework end-to-end | `test-framework` |
| Create a new skill | `create-skill` |

**Rule:** Before editing anything under `~/.kimi/hooks/`, `~/.kimi/skills/`, `~/.kimi/rules/`, or `~/.kimi/config.toml`, load `evolve-framework` or `improve-framework` first.

Framework gaps are tracked in `.svc/framework-gaps.jsonl` with `type: framework`.

---

## Notes for Kimi Code CLI

- Skills are the authoritative instructions. When in doubt, re-read the `SKILL.md`.
- The pipeline is progressive: do not skip phases without an explicit skip rationale recorded in `.svc/pipeline-decisions.jsonl`.
- When a phase produces an artifact, commit it before moving to the next phase.
- One worktree per feature. Never mix features on the same branch.
- On rejection (NO-SHIP signal), produce a structured rejection with evidence and propose 2–3 alternative directions. Do not abandon silently.
- Use `/compact` when context grows large; Kimi handles compaction gracefully.
- Use `/export` to archive a session before a long break; use `/import` to resume context.


## Mandatory Plan-Exec-Review Chain (added 2026-05-13)

This repo now ships a three-layer enforcement chain that makes
plan-changeset + review-plan + execute-changeset + review-exec +
audit-implementation + land-changeset + verify-promotion mandatory for
every non-quick-fix change.

Key entry points for this host:
- `scripts/run-external-review.mjs` — sole paid Claude/Codex independent-review launcher
- `scripts/resolve-adversarial-reviewer.sh` — probe-free exact tuple policy view
- `scripts/svc-reconcile.mjs` — local L3 gate; route-workflow preflight runs this
- `scripts/emit-receipt.mjs` — one-call receipt emitter every chain skill must invoke
- `references/chain-receipt-contract.md` — schema and lifecycle contract
- Receipts are stored as git notes on `refs/notes/svc-receipts` (durable,
  pushable; mirror at `.svc/receipts/<sha>/` is a regenerable cache)

The chain is currently in **warn-only mode** (Phase A-D shipped). The
warn → refuse flip happens in Phase E by setting
`.svc/chain-policy.json` to `{"mode": "refuse"}`.

Out-of-scope as orchestrators for this plan: OpenCode, Gemini, Kimi, MiMo.
Out-of-scope as reviewers: Kimi, MiMo.
Reviewer allowlist: `{codex, claude, gemini}`.

See the full plan in this commit's history and the `mandatory-chain-v1.0` tag.
