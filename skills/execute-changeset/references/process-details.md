# execute-changeset — Process details (gemini budget, local-first, delegation contract, persistence, sequential debugging, two-stage review, deviation, loop-backs)

### Step 0 Pre-flight: Gemini Context Budget (MANDATORY on Gemini CLI)

Before any multi-file execution, on Gemini CLI:
```bash
bash hooks/svc-gemini-context-check.sh
```
Blocks at POOR tier (>4 MB chat JSON). See [references/gemini-context-budget.md](../references/gemini-context-budget.md). On Claude Code this is a no-op. G1 from 2026-04-19 WI-085 audit.


### Step 0a: Pre/Post Validation Baseline

For bugfixes, regressions, runtime behavior changes, deploy-affecting changes,
or acceptance-validation corrections, load `references/pre-post-validation-loop.md`
before editing. Select the smallest acceptance-critical command, journey, probe,
or visual capture that should change. Run and record its pre-change output
before the fix when the target is reachable. After each fix batch, rerun the
same command and classify the delta before moving to review.
For machine-checkable closeout evidence, write
`pre-post-evidence.json` and run
`node scripts/validate-pre-post-validation-evidence.mjs --evidence <path>`.

### Step 0b: Local-First Execution

All implementation targets localhost. No cloud deployment variants.

**Deployment target:** always `localhost` (or `127.0.0.1`).

**Paid dependencies must be mocked:**

| Dependency type | Mock approach |
|----------------|---------------|
| Payment (Stripe, PayPal) | Local mock server or test-mode keys |
| Email (SendGrid, SES) | Console logger or local SMTP (mailhog) |
| SMS (Twilio) | Console logger |
| Storage (S3, GCS) | Local filesystem or MinIO |
| Auth (Auth0, Clerk) | Local JWT issuer or mock middleware |
| Search (Algolia, Elastic Cloud) | SQLite FTS or in-memory index |
| AI/ML APIs (OpenAI, etc.) | Recorded fixtures or deterministic stubs |
| CDN (Cloudflare, Fastly) | Direct serve from localhost |

**Rules:**
1. The app must start and work on `localhost` with zero external accounts
2. Mock implementations live in `src/mocks/` or equivalent
3. Tests run against mocks — never against live paid services
4. The mock must be realistic enough to exercise the AC (not just `return true`)
5. Document which dependencies are mocked in the manifest under "Mocked Dependencies"
6. Every external integration has both a mock and real implementation, selected by feature toggle
7. Feature toggles default to mock ON / real OFF
8. Create or update `docs/specs/toggle-registry.md` listing every toggle, its default, and per-environment state

**Feature toggle enforcement:**
- Before writing any integration code, check the tech design for the toggle
  mechanism. If none is defined, stop and route back to `design-tech`.
- Implement the mock FIRST. Get it passing E2E. Then implement the real
  version behind the toggle. The mock is not scaffolding — it ships and
  stays as the local/test default permanently.
- The toggle registry is a deliverable, not an afterthought. It goes in
  the manifest file list alongside source code.

**First-demo test:** After the last task checkpoint, start the app with
default config (all toggles at default = mocks ON). Navigate the primary
journey. If anything fails, shows an error, or requires credentials — the
implementation is not done.

**Why:** The first iteration must be demoable, sellable, and locally complete.
External integrations are enabled per-environment by flipping toggles — not
by rewriting code.

### Step 0c: Delegation Contract Check

Before deciding between single-agent execution, same-branch parallelism, or
inner worktrees, check for a repo-local delegation contract:

- `docs/specs/agent-topology.md` if present
- otherwise `docs/specs/router-context.md` for delegation notes

Use that repo contract to decide:
- whether delegation is allowed at all
- which work types should stay single-agent
- which paths should not be edited in parallel
- whether platform-level agent capability is actually configured in this repo

Platform agent support is insufficient mutation authority. Before a mutating
dispatch, require an active v2 controller lease and a host capability record
that proves stable child identity plus a real filesystem-containment adapter.
Create a nested execution graph, persist a task-specific delegation before
launch, and bind acceptance to a one-time token. If any prerequisite is absent,
run the task under the controller instead of weakening the guard.

**Conservative default:** if no repo delegation contract exists, do not infer
that platform support for agents means parallel subagent execution is preferred.
Default to single-agent unless the manifest's task structure makes the split obviously safe and cheap.

Within a wave, scopes must be pairwise disjoint after one-hop dependency
expansion. Unknown scopes and shared files (`.svc/**`, lockfiles, migrations,
and root configuration) always serialize. Each child receives its own inner
worktree; same-branch concurrent mutation is unsupported.

### Step 1: Read the manifest and confirm branch state

Extract:

- branch name
- base SHA
- task order
- expected files
- validation commands

Verify the branch is clean before starting a task.

**1f. Verify test infrastructure:**

Before TDD can work, a test runner must exist:
1. Run the manifest's validation command (dry run / `--list` mode if available)
2. If it fails with "command not found" or "no test runner configured":
   a. Detect language from manifest file extensions
   b. Install standard test framework:
      - JS/TS: vitest or jest (check package.json for preference signals)
      - Python: pytest
      - Ruby: rspec or minitest
      - Go: built-in (no install needed)
   c. Write a trivial passing test to verify the runner works
   d. Run validation command again — must exit 0
3. If validation passes: proceed to task execution

Do not start TDD without a working test runner. This check is idempotent —
it's a no-op when test infrastructure already exists.

Source: gstack ship/SKILL.md B2-B5 (test bootstrap), MIT, Copyright 2025 Garry Tan.

### Persistence Model

Execution is a verified completion loop, not a one-pass attempt. For each task:

```
LOOP per task (max 5 iterations):
  1. Write test (RED)
  2. Run test → must FAIL
  3. Write implementation
  4. Run test → must PASS
  5. Run full test suite → must PASS (no regressions)
  6. Checkpoint commit (with trailers)
  7. VERIFY: does this task's AC actually pass? (not just tests — check the behavior)
  
  If step 5 fails:
    → Triage each failure:
      a. Run tests on base state (git stash, run, git stash pop)
      b. BRANCH-INTRODUCED: passes on base, fails on HEAD → must fix
      c. PRE-EXISTING: fails on both base and HEAD → log in progress.md, continue
      d. FLAKY: passes on retry → log in progress.md, continue
    → Only BRANCH-INTRODUCED failures trigger the regression fix loop
    → Fix the regression, re-run, iterate
    → If same error 3 times: STOP, report fundamental issue
    
  If step 7 fails (AC not satisfied):
    → Revise implementation, re-run from step 3
    → Log what was wrong in progress tracking
```

**Progress tracking** — maintain a task status file at `docs/plans/<name>/progress.md`:

```markdown
# Execution Progress

| Task | Status | Iterations | Last error | AC verified? |
|------|--------|------------|------------|-------------|
| task-1 | ✅ done | 1 | — | yes |
| task-2 | 🔄 in progress | 3 | regression in task-1 test | no |
| task-3 | ⏳ pending | 0 | — | — |
```

This file survives session interruption. When execution resumes (worktree.sh create is idempotent), read progress.md to know which tasks are done.

**Completeness Protocol (Anti-Laziness):**
To prevent mid-task truncation and "AI slop," adhere to these strict output rules:
- **Zero-Placeholder Policy:** BANNED: `// ...`, `// rest of code`, `// implement here`, `/* ... */`, or bare ellipses.
- **Exhaustive Generation:** If a 500-line file is required, produce all 500 lines. No "similar to above" shortcuts.
- **Pause/Resume Pattern:** If a response approaches the host's token limit, STOP at a clean breakpoint (e.g., end of a function or file) and wait for a "continue" instruction.
- **Mandatory Trailer:** End limit-approaching responses with: `[PAUSED — X of Y complete. Send "continue" to resume from: <next_section>]`.

### Cost-Aware Sequential Debugging Standard (Sequential Trial Loop)

When a task execution or test run fails, rather than a simple blind retry or spawning an expensive parallel swarm, follow the cost-aware debugging sequence:

1. **Failure Interception & Exit Codes:**
   If a task hits a resolver roadblock, the implementer subagent exits with:
   - `NEEDS_CONTEXT = 75` (e.g., missing type definitions, schemas, or import structures).
   - `BLOCKED = 76` (e.g., compiler failures or test runner assertions unresolved after 3 attempts).
   Before exiting, the subagent wrapper must dump a structured `.svc/task-context-gap.json` file.

2. **Orchestrator Root-Cause Diagnosis:**
   The Orchestrator Parent intercepts exit codes 75/76 and triggers a lightweight `execution-diagnose` probe. This probe represents a fast, non-chaining execution-mode routine modeled after `diagnose-bug` phases P2 (reproduction) and P3 (root cause) to isolate the error and search the codebase.

3. **Multi-Option Synthesis:**
   The parent parses the gap file, explores alternatives, and prioritizes 2-3 distinct, viable resolution paths (e.g. Option A: API parameter mapping, Option B: Dependency adjustments).

4. **Sequential Trial (Token-First):**
   Prioritized options are tried *sequentially* (Option A first). A trial for the next option is only dispatched if the preceding option fails to compile, lint, or pass tests. Cheap static checks/compilers are used first to immediately discard syntactically broken variations.

5. **Model Tiering & Escalation:**
   To maximize the reasoning accuracy and success rate of diagnostic probes, debugging/exploratory tasks should not default to Haiku when Claude Code is used. Instead, route them to **Sonnet 4.6 with thinking enabled (high)** if available, or **Codex with high reasoning** if Sonnet 4.6 is unavailable. Other model profiles and hosts must use their own available models (defaulting to the best model from the active parent session if undefined). If all options are completely exhausted, the Orchestrator rolls back the workspace to the last clean task checkpoint, cancels the execution, and escalates to the user with a detailed **Exploration & Attempt Ledger**.

#### exit_status gap schema (.svc/task-context-gap.json)
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "TaskContextGap",
  "type": "object",
  "required": ["task_id", "exit_status", "error_trace"],
  "properties": {
    "task_id": { "type": "string" },
    "exit_status": { "type": "integer", "enum": [75, 76] },
    "error_trace": { "type": "string" },
    "compile_output": { "type": "string" },
    "missing_symbols": {
      "type": "array",
      "items": { "type": "string" }
    },
    "attempted_resolution": { "type": "string" }
  }
}
```

**Completion gate:**
Execution is NOT done until:
- Every task has `status: done` and `AC verified: yes`
- Full test suite passes
- No TODO/FIXME in committed code (checked at the end)

If any task is stuck (3 strikes), execution is BLOCKED — report and stop.


### Step 3: Two-stage holistic review (replaces per-task review)

After ALL tasks are complete, review the full feature diff in two ordered passes:

```bash
git diff main..HEAD
```

**Pass 1 — Spec compliance (blocking gate):**
- Full AC coverage — every AC in the spec has code + test
- No orphaned code — nothing written that no AC requires
- Toggle registry complete — every external integration has mock + real + toggle
- No scope creep — nothing built that wasn't in the plan
- **Distrust checkpoint messages** — verify against the actual diff, not task
  commit messages. Code may claim "implemented auth flow" while the diff shows
  a stub.

**If Pass 1 fails:** fix the gaps, then re-run Pass 1. Do NOT proceed to Pass 2.
Reviewing code quality on incomplete code wastes tokens on code that may be
rewritten once the missing ACs are addressed.

**Pass 2 — Code quality (only after Pass 1 passes):**
- Cross-file consistency — no contradictions between tasks
- Style contract compliance — one pass, not N passes
- No TODO/FIXME in committed code
- No duplicate logic or inconsistent naming across tasks

This is two focused passes on the same diff instead of one blended pass. It
catches cross-task issues (duplicate logic, inconsistent naming, missing
integration) that per-task reviews inherently miss because they see each task
in isolation. The ordering prevents wasted quality review on code that doesn't
meet specs yet.

Source: superpowers subagent-driven-development two-stage review ordering

### Deviation Rules

When execution encounters something unexpected, classify it before acting:

| Rule | When | Action | Example |
|------|------|--------|---------|
| **Auto-fix: bugs** | Test reveals a bug in code you just wrote | Fix immediately, no approval needed | Off-by-one in loop, null check missing |
| **Auto-fix: missing critical** | Implementation needs validation, error handling, or security that the plan didn't mention | Add it, log as deviation | Input sanitization, null guard, error boundary |
| **Auto-fix: blocking** | Missing import, dependency, or config that prevents the task from running | Fix immediately | `npm install` a missing dep, add a missing env var |
| **STOP and ask** | Architectural change — new DB table, switching libraries, changing API contract, modifying files outside the plan's scope | Do NOT proceed. Present the issue and wait. | "The plan says use REST but this needs WebSocket" |

**Scope boundary:** Only fix issues DIRECTLY caused by the current task's changes.
Do not fix pre-existing bugs, unrelated tech debt, or "while I'm here" improvements.
Those go to `docs/learnings/` as future work items.

**Fix attempt limit:** 3 attempts per task. If a task fails 3 times, STOP and
report the blocker with evidence.

**Analysis paralysis guard:** If you make 5+ consecutive Read/Grep/Glob calls
without any Write or Edit, you must either: (a) explain why you're still
investigating, or (b) write code, or (c) report "blocked on [specific issue]."
Investigation without action is a failure mode.

### Step 4: Loop-back rules

If execution reveals a defect in earlier phases:

- spec ambiguity -> loop back to `write-spec`
- UX flow impossible -> loop back to `design-ux`
- UI/design-system insufficiency -> loop back to `design-ui`
- technical infeasibility -> loop back to `design-tech`

Do not patch through phase defects silently.

After correction, resume from the last good checkpoint rather than starting over.

### Step 5: Final G5 surface

After all tasks are complete:

- review the full feature diff against `main`
- ensure all manifest files are represented
- ensure task checkpoints are complete
- confirm AC-to-task and AC-to-test coverage

This is the final G5 review input.
