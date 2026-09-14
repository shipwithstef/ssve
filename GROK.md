# Serious Vibe Coding — Grok Build Context

> Read this file at the start of every Grok Build CLI session on this project.
> Tell Grok Build: "Read GROK.md and then let's work on [your goal]."

---

## Framework

This project uses **Serious Vibe Coding (svc)** — a progressive narrowing pipeline
for reliable agentic software engineering. You are operating as the Grok Build CLI host.

Framework doctrine: `~/.grok/skills/DOCTRINE.md`
Repo modes: `~/.grok/skills/REPO_MODES.md`
Worktree model: `~/.grok/skills/WORKTREES.md`

---

## Project State

<!-- onboard-repo fills this in -->
- **Repo mode:** <!-- bootstrap | convert -->
- **Active lane:** <!-- greenfield | brownfield-feature | bugfix | refactor | drift -->
- **Active skill:** <!-- current skill in pipeline -->
- **Active work item:** <!-- WI-NNN or — -->
- **Task graph:** `.svc/lane-tasks-<WI>.json` (source of truth for task status)

---

## How to Invoke Skills (Grok Build CLI)

Skills live at `~/.grok/skills/<skill-name>/SKILL.md`.

To use a skill, use the slash command or read the skill file directly:
> Run `/skill <skill-name>` or read `~/.grok/skills/<skill-name>/SKILL.md`

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

Full skill list: `~/.grok/skills/skills-manifest.json`

---

## Shell Interaction Guard (Harness-Specific)
- **Harness:** Grok Build CLI.
- **Problem:** Shell commands that require user input or use a terminal UI (PTY) will hang.
- **Enforcement:**
  1. **Always** use non-interactive flags for shell commands (e.g., `npm install --yes`, `git --no-pager`, `apt-get install -y`).
  2. **Never** run commands that open a terminal UI (`vim`, `htop`, `top`, `less` without `-F`).
  3. **Batch Execution:** When running tests or builds, always ensure "run once" or "CI" flags are set to prevent watch modes from hanging the session.

---

## Enforcement Rules (Grok Build CLI — Behavioral)

### File Edit Guard
- **Never** edit linter, formatter, type-checker, or test-runner config files to suppress errors. Fix the code, not the config.
- **Never** edit lock files (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `Cargo.lock`, `go.sum`) manually.
- **Never** write outside the current skill's declared output paths without stating an explicit reason.
- **Tooling:** Always use exact replacements; never use placeholders or truncated snippets.

### Git Guard
- **Never** use `--no-verify` or `--no-gpg-sign` git flags.
- Every commit must include a `Co-Authored-By: Grok Build CLI` trailer.
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

---

## Worktree Model

All implementation happens in a git worktree branched from main.
Never implement directly on main.

```bash
# Create worktree for a feature
bash ~/.grok/skills/scripts/worktree.sh create feature/your-feature-name

# Promote (squash merge) when done
bash ~/.grok/skills/scripts/worktree.sh promote feature/your-feature-name
```

Full model: `~/.grok/skills/WORKTREES.md`

---

## Task Graph (Cross-Session Continuity)

All task state lives in `.svc/lane-tasks-<WI>.json` — this is the source of truth across sessions and hosts.

At the start of each session:
1. Read `.svc/lane-tasks-<WI>.json`
2. Find the first `pending` or `in_progress` task
3. Resume from there
