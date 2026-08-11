# Serious Vibe Coding — Gemini CLI Context

> Read this file at the start of every Gemini CLI session on this project.
> Tell Gemini CLI: "Read GEMINI.md and then let's work on [your goal]."

---

## Framework

This project uses **Serious Vibe Coding (svc)** — a progressive narrowing pipeline
for reliable agentic software engineering. You are operating as the Gemini CLI host.

Framework doctrine: `~/.gemini/skills/DOCTRINE.md`
Repo modes: `~/.gemini/skills/REPO_MODES.md`
Worktree model: `~/.gemini/skills/WORKTREES.md`

---

## Project State

<!-- onboard-repo fills this in -->
- **Repo mode:** <!-- bootstrap | convert -->
- **Active lane:** <!-- greenfield | brownfield-feature | bugfix | refactor | drift -->
- **Active skill:** <!-- current skill in pipeline -->
- **Active work item:** <!-- WI-NNN or — -->
- **Task graph:** `.svc/lane-tasks.json` (source of truth for task status)

---

## How to Invoke Skills (Gemini CLI)

Skills live at `~/.gemini/skills/<skill-name>/SKILL.md`.

To use a skill, you can use the built-in `activate_skill` tool if available, or read the file directly:
> Read the skill instructions at `~/.gemini/skills/<skill-name>/SKILL.md`

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

Full skill list: `~/.agents/skills/skills-manifest.json`

---

## Shell Interaction Guard (Harness-Specific)
- **Harness:** Gemini CLI.
- **Problem:** Shell commands that require user input or use a terminal UI (PTY) will hang and prompt to "press tab to focus."
- **Enforcement:**
  1. **Always** use non-interactive flags for shell commands (e.g., `npm install --yes`, `git --no-pager`, `apt-get install -y`).
  2. **Never** run commands that open a terminal UI (`vim`, `htop`, `top`, `less` without `-F`) unless the user explicitly requests manual interaction.
  3. **Headless Mode:** If the project environment supports it, prefer setting `enableInteractiveShell: false` in `~/.gemini/settings.json`.
  4. **Batch Execution:** When running tests or builds, always ensure "run once" or "CI" flags are set to prevent watch modes from hanging the session.

---
## Enforcement Rules (Gemini CLI — Behavioral)

### File Edit Guard
- **Never** edit linter, formatter, type-checker, or test-runner config files to suppress errors. Fix the code, not the config.
- **Never** edit lock files (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `Cargo.lock`, `go.sum`) manually.
- **Never** write outside the current skill's declared output paths without stating an explicit reason.
- **Gemini CLI Tooling:** Always use the `replace` and `write_file` tools to edit files. Never use `sed`, `awk`, or `cat <<EOF`. Do NOT use placeholders when editing code; provide the exact literal replacement.

### Git Guard
- **Never** use `--no-verify` or `--no-gpg-sign` git flags.
- Every commit must include a `Co-Authored-By: Gemini CLI` trailer.
- Commit messages must be specific: scope + imperative verb + what changed + why.
  ❌ "fix stuff" ❌ "update" ✅ "feat(auth): add email verification on signup"

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
<!-- onboard-repo wires these — list detected stacks and relevant rule files -->
<!-- e.g. @~/.agents/rules/react/patterns.md -->

---

## Worktree Model

All implementation happens in a git worktree branched from main.
Never implement directly on main.

```bash
# Create worktree for a feature
bash ~/.agents/skills/scripts/worktree.sh create feature/your-feature-name

# Promote (squash merge) when done
bash ~/.agents/skills/scripts/worktree.sh promote feature/your-feature-name
```

Full model: `~/.agents/skills/WORKTREES.md`

---

## Task Graph (Cross-Session Continuity)

All task state lives in `.svc/lane-tasks.json` — this is the source of truth across sessions and hosts.

At the start of each session:
1. Read `.svc/lane-tasks.json`
2. Find the first `pending` or `in_progress` task
3. Resume from there

Gemini CLI does not have native TaskList/TaskUpdate tools. Use the file directly and report status in conversation.

---

## Notes for Gemini CLI

- Skills are the authoritative instructions. When in doubt, re-read the `SKILL.md`.
- The pipeline is progressive: do not skip phases without an explicit skip rationale recorded in `.svc/pipeline-decisions.jsonl`.
- When a phase produces an artifact, commit it before moving to the next phase.
- One worktree per feature. Never mix features on the same branch.
- On rejection (NO-SHIP signal), produce a structured rejection with evidence and propose 2–3 alternative directions. Do not abandon silently.

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
