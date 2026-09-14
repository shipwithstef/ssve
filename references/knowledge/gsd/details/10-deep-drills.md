# Deep Drills: Top 10 GSD Mechanical Components

This document drills down into the exact algorithms, code snippets, and structural implementations of the 10 most complex mechanics found in the GSD codebase. This serves as a blueprint for porting these capabilities into the Serious Vibe Coding (SVC) framework.

---

## 1. Schema Drift Detection & Verification (`bin/lib/schema-detect.cjs`)

**The Problem:** An AI agent writes a new Prisma schema file, but forgets to run `npx prisma db push`. The code compiles, type-checks pass, but the live database is missing the table. The app crashes at runtime.
**The Algorithm:**
1. **Detect Changes:** GSD scans the git diff array against a hardcoded list of `SCHEMA_PATTERNS` (e.g., `/^prisma\/schema\/.*\.prisma$/`, `/^drizzle\/.*\.ts$/`).
2. **Require Execution Evidence:** If a schema change is detected, GSD grabs the entire phase's `executionLog` (the raw bash output from the tools).
3. **Pattern Match:** It runs a regex against the log to prove the specific command was run. For Prisma, it demands `/prisma\s+db\s+push/i` or `/prisma\s+migrate\s+deploy/i`.
4. **Halt:** If the schema changed but the log pattern is missing, the framework forcefully halts the validation phase with a blocking error.

## 2. Multi-Repo Ancestor Discovery (`bin/lib/core.cjs`)

**The Problem:** If a user spawns an agent deep inside `apps/frontend/src/components/`, the agent might accidentally create a local `.planning/` folder right there, fracturing project state.
**The Algorithm (`findProjectRoot`):**
1. Starts at `pwd`.
2. Loops `while (dir !== root)`.
3. Checks if the parent directory has a `.planning/config.json`.
4. If it does, parses it to see if `config.sub_repos` includes the current top-level segment (e.g., `apps/frontend`).
5. As a fallback, checks `isInsideGitRepo(parent)` (looking for a `.git` folder).
6. Once it hits the true project root, it binds all state reads/writes to that absolute path, preventing local state fracturing.

## 3. Event-Sourced Planning Journal (`sdk/src/planning-journal.ts`)

**The Problem:** Knowing *what* state changed isn't enough; you need to know *who* changed it (human, SDK, cloud daemon) and *why* for auditability.
**The Algorithm:**
1. State changes are routed through `PlanningJournal.append()`.
2. It generates a unique `requestHash`:
   ```typescript
   createHash('sha256').update(JSON.stringify({ projectId, type, payload, actor })).digest('hex')
   ```
3. It checks the `idempotencyKey` provided by the caller. If the key exists but the `requestHash` is different, it throws an error (preventing idempotency hijacking).
4. Appends a strict JSON line to `.gsd/journal.jsonl` containing `source`, `runId`, `actor`, `authority`, and `payload`.

## 4. Interactive Pattern Stripping (`sdk/src/prompt-sanitizer.ts`)

**The Problem:** System prompts heavily optimized for interactive terminal users contain commands like "Ask the user for permission" or "Run `/gsd-fast`", which break completely when the prompt is deployed to a headless/cloud environment.
**The Algorithm:**
It uses aggressive RegExp to scrub interactive commands before passing the prompt to the SDK:
- `/^.*\/gsd[:-]\S+.*$/gm` (strips `/gsd-` commands)
- `/^.*AskUserQuestion\s*\(.*$/gm` (strips interactive prompts)
- `/^.*\bSTOP\b(?:\s+(?:and\s+)?(?:wait|ask|here|now)).*$/gm` (strips manual stops)
It also seamlessly resolves `@~/.claude/get-shit-done/...` file paths by reading and inlining their contents dynamically.

## 5. YAML Scalar Coercion (`bin/lib/roadmap.cjs`)

**The Problem:** Standard YAML/Markdown parsers silently drop bare integers or nested key-value objects when an agent incorrectly formats a bulleted list.
**The Algorithm (`coerceTruthToString`):**
If the parser returns an object instead of a string, GSD doesn't throw an error. It iterates through a prioritized array of known AI output keys: `['title', 'text', 'name', 'rule', 'path', 'provides']`. 
```javascript
for (const k of ['title', 'text', 'name']) {
  if (typeof t[k] === 'string' && t[k].trim()) return t[k];
}
```
If it finds a bare number (e.g., `- 3`), it forces `String(t)`. This guarantees no business requirements are silently lost during phase aggregations.

## 6. Context-Window Utilization Math (`bin/lib/context-utilization.cjs`)

**The Problem:** Visual status bars often mix math and UI rendering, making them hard to unit test and easy to break.
**The Algorithm:**
GSD extracts the math into a pure, side-effect-free module.
```javascript
const ratio = Math.min(tokensUsed / contextWindow, 1);
const percent = Math.min(Math.round(ratio * 100), 100);
if (ratio < 0.60) return { percent, state: 'healthy' };
else if (ratio < 0.70) return { percent, state: 'warning' };
else return { percent, state: 'critical' };
```
This strict mathematical boundary is then fed to `hooks/gsd-context-monitor.js`, which injects a literal text warning into the agent's prompt if the state hits `critical`.

## 7. Plan Bounce Integrity Guard (`workflows/plan-phase.md`)

**The Problem:** Running an AI's plan through an external bash script is dangerous. The script might corrupt the file, delete it, or mangle the markdown structure.
**The Algorithm:**
1. Backup: `cp "$PLAN" "$PLAN.pre-bounce"`
2. Execute: `$BOUNCE_SCRIPT "$PLAN"`
3. Guard 1 (Exit Code): `if [ $? -ne 0 ]; then restore_backup; fi`
4. Guard 2 (Frontmatter): `if ! head -1 "$PLAN" | grep -q "^---$"; then restore_backup; fi`
5. Guard 3 (Agent Validation): It spawns the `gsd-plan-checker` sub-agent. If the checker finds a regression, it restores the backup.

## 8. Orphan Worktree Detection (`tests/orphan-worktree-detection.test.cjs`)

**The Problem:** Parallel agents spawn git worktrees. If the agent crashes, the worktree is orphaned, silently eating disk space and creating git lock issues.
**The Algorithm:**
The health inspector (`bin/lib/worktree-safety.cjs`) runs `git worktree list --porcelain`. It compares the active worktrees against the `.planning/phases/` directories currently marked `in_progress` in `STATE.md`. If a worktree exists but the phase is dead/completed, it throws a `W017` warning, alerting the user to run `git worktree prune`.

## 9. Resurrection-Detection Guard (`tests/bug-2501-resurrection-detection.test.cjs`)

**The Problem:** In a git worktree, if a file was deleted on `main`, but the worktree doesn't have the deletion, merging the worktree will "resurrect" the deleted file.
**The Algorithm:**
GSD loops over all files modified in the worktree. For each file, it checks the main branch ancestry:
`git log origin/main --diff-filter=D -- "$FILE"`
If the `git log` returns a hit, the file was definitively deleted by a human on `main`. The agent's worktree is forced to honor the deletion by running `git rm "$FILE"` before the merge happens.

## 10. Tri-State Git Commit Staleness (`bin/lib/graphify.cjs`)

**The Problem:** How do you mathematically prove a generated Knowledge Graph (AST) isn't stale? You can't use file modification time (`mtime`) because checking out a branch resets `mtime`.
**The Algorithm:**
1. At build time, Graphify gets the exact HEAD commit: `git rev-parse HEAD`.
2. It injects this hash into `graph.json` as `built_at_commit`.
3. At read time, it runs: `git rev-list --count ${built_at_commit}..HEAD`.
4. It maps this to a Tri-State flag:
   - `0`: Perfectly synced (`current`).
   - `>0`: `commits_behind` the active code (`stale`).
   - Command fails: Commit was garbage collected or deleted (`unreachable`).