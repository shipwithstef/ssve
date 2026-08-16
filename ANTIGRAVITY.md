# Serious Vibe Coding — Antigravity Session Context

> Read this file at the start of every Antigravity session on this project.
> Tell Antigravity: "Read ANTIGRAVITY.md and then let's work on [your goal]."

---

## Framework

This project uses **Serious Vibe Coding (svc)** — a progressive narrowing pipeline
for reliable agentic software engineering. You are operating as the Antigravity host.

Framework doctrine: `~/.gemini/antigravity/skills/DOCTRINE.md`
Repo modes: `~/.gemini/antigravity/skills/REPO_MODES.md`
Worktree model: `~/.gemini/antigravity/skills/WORKTREES.md`

---

## Project State

<!-- onboard-repo fills this in -->
- **Repo mode:** <!-- bootstrap | convert -->
- **Active lane:** <!-- greenfield | brownfield-feature | bugfix | refactor | drift -->
- **Active skill:** <!-- current skill in pipeline -->
- **Active work item:** <!-- WI-NNN or — -->
- **Task graph:** `.svc/lane-tasks.json` (source of truth for task status)

---

## How to Invoke Skills (Antigravity)

Skills live at `~/.gemini/antigravity/skills/<skill-name>/SKILL.md`.

To use a skill, say:
> "Use the `<skill-name>` skill"

Antigravity will read the `SKILL.md` and follow its instructions exactly.

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

Full skill list: `~/.gemini/antigravity/skills/skills-manifest.json`

---

## Enforcement Rules (Antigravity — Behavioral, Not Hook-Enforced)

Antigravity does not have Claude Code's PreToolUse/PostToolUse/Stop hook runtime.
These rules are enforced behaviorally — Antigravity follows them as standing instructions.

### File Edit Guard
- **Never** edit linter, formatter, type-checker, or test-runner config files to
  suppress errors. Fix the code, not the config.
- **Never** edit lock files (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`,
  `Cargo.lock`, `go.sum`) manually.
- **Never** write outside the current skill's declared output paths without
  stating an explicit reason.
- **Antigravity Tooling:** Never use bash `sed`, `awk`, or `cat <<EOF` to edit files. ALWAYS use your native `replace_file_content` or `multi_replace_file_content` tools for robust editing.

### Git Guard
- **Never** use `--no-verify` or `--no-gpg-sign` git flags.
- Every commit must include a `Co-Authored-By: Antigravity` trailer.
- Commit messages must be specific: scope + imperative verb + what changed + why.
  ❌ "fix stuff" ❌ "update" ✅ "feat(auth): add email verification on signup"

### Task Completion Guard
Before marking any task complete, verify:
1. All acceptance criteria in the spec are addressed
2. Tests pass (run the test command for this project's stack)
3. No linter errors in files touched this session
4. The task's eval matrix pillars are filled (correctness, test coverage, spec alignment,
   security, performance, UX, accessibility, maintainability)
5. **Antigravity UI Artifacts:** When finalizing major markdown documents (like `manifest.md` or feature specs), invoke `write_to_file` with `IsArtifact: true` to surface the final document directly in the user's chat!

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
<!-- e.g. @~/.gemini/antigravity/skills/rules/react/patterns.md -->

---

## Worktree Model

All implementation happens in a git worktree branched from main.
Never implement directly on main.

```bash
# Create worktree for a feature
bash ~/.gemini/antigravity/skills/scripts/worktree.sh create feature/your-feature-name

# Promote (squash merge) when done
bash ~/.gemini/antigravity/skills/scripts/worktree.sh promote feature/your-feature-name
```

Full model: `~/.gemini/antigravity/skills/WORKTREES.md`

---

## Task Graph (Cross-Session Continuity)

All task state lives in `.svc/lane-tasks.json` — this is the source of truth
across sessions and hosts.

At the start of each session:
1. Read `.svc/lane-tasks.json`
2. Find the first `pending` or `in_progress` task
3. Resume from there

Antigravity does not have native TaskList/TaskUpdate tools. Use the file directly
and report status in conversation.

---

## Notes for Antigravity

- Skills are the authoritative instructions. When in doubt, re-read the `SKILL.md`.
- The pipeline is progressive: do not skip phases without an explicit skip rationale
  recorded in `.svc/pipeline-decisions.jsonl`.
- When a phase produces an artifact, commit it before moving to the next phase.
- One worktree per feature. Never mix features on the same branch.
- On rejection (NO-SHIP signal), produce a structured rejection with evidence and
  propose 2–3 alternative directions. Do not abandon silently.
