# Framework Install Packaging Gap

> Found during first brownfield onboard-repo run on a real project.
> 14 skills failed their REPO_MODES.md mode gate because root infrastructure
> files were never installed.

---

## P0: `npx skills add` installs skills but not framework infrastructure (CRITICAL)

### Problem

The svc repo contains two categories of content:

1. **Skills** — 30+ directories each containing `SKILL.md` (and optional scripts/references)
2. **Framework infrastructure** — root-level files that skills depend on at runtime:
   - `DOCTRINE.md` — methodology claims, referenced by `evolve-framework`
   - `REPO_MODES.md` — mode detection, referenced by 14 skills on startup
   - `skills-manifest.json` — lane definitions and core pack list
   - `EXTERNAL_ADDONS.md` — external add-on pack definitions
   - `WORKTREES.md` — worktree conventions for execute/land-changeset
   - `scripts/worktree.sh` — worktree helper
   - `scripts/lint-skills-manifest.mjs` — manifest validation
   - `proposals/` — evolution proposal history
   - `test-framework/` — evals, results, benchmark scripts

`npx skills add s7an-it/seriousvibecoding` clones the repo, walks every
directory looking for `SKILL.md` files (line 455 of cli.mjs: `stat(join(dir, "SKILL.md"))`),
symlinks each skill folder into `~/.claude/skills/`, and ignores everything else.

Root files don't contain `SKILL.md`, so they're invisible to the installer.

### Evidence

After `npx skills add`:
```
~/.agents/skills/route-workflow/SKILL.md     ✅ installed (symlinked)
~/.agents/skills/validate-feature/SKILL.md   ✅ installed (symlinked)
~/.agents/DOCTRINE.md                        ❌ missing
~/.agents/REPO_MODES.md                      ❌ missing
~/.agents/skills-manifest.json               ❌ missing
~/.agents/scripts/                           ❌ missing
~/.agents/proposals/                         ❌ missing
~/.agents/test-framework/                    ❌ missing
```

### Impact

- 14 skills check `REPO_MODES.md` on startup → all fall through to heuristics
- `evolve-framework` reads `DOCTRINE.md` as Step 1 → can't audit methodology claims
- `lint-skills-manifest.mjs` can't run → no automated consistency validation
- `test-framework` evals can't run → no pipeline self-testing
- Proposals history invisible → `evolve-framework` can't check for stale proposals

### Root Cause

Format mismatch between what `npx skills` expects and what svc provides:

| What `npx skills` expects | What svc provides |
|---|---|
| `{ name: "...", skills: ["path1", "path2"] }` | `{ includedSkills: [...], laneDefinitions: {...}, ... }` |
| Each installable unit is a directory with `SKILL.md` | Framework = skills + root infrastructure |

The `npx skills` tool has no concept of "framework" — only skill collections.

### Fix Options

**Option A: Post-install hook (minimal change)**

Add a `postinstall.sh` or `setup.sh` at repo root that copies/symlinks root files:

```bash
#!/bin/bash
# Run after npx skills add to install framework infrastructure
AGENTS_DIR="${HOME}/.agents"
SKILLS_DIR="${HOME}/.claude/skills"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

for f in DOCTRINE.md REPO_MODES.md WORKTREES.md skills-manifest.json EXTERNAL_ADDONS.md; do
  cp "$SCRIPT_DIR/$f" "$AGENTS_DIR/" 2>/dev/null
  ln -sf "../../.agents/$f" "$SKILLS_DIR/$f" 2>/dev/null
done

for d in scripts proposals test-framework; do
  cp -r "$SCRIPT_DIR/$d" "$AGENTS_DIR/" 2>/dev/null
  ln -sf "../../.agents/$d" "$SKILLS_DIR/$d" 2>/dev/null
done
```

Document: after `npx skills add`, run `bash ~/.agents/skills/route-workflow/../setup.sh` or
bundle it into a `create-skill` post-install step.

**Option B: Wrapper skill (no external tooling change)**

Create a `svc-framework/SKILL.md` skill that exists solely to carry the root files
as bundled resources:

```
svc-framework/
├── SKILL.md          (describes the framework, triggers setup)
├── scripts/          (worktree.sh, lint-skills-manifest.mjs)
├── references/       (DOCTRINE.md, REPO_MODES.md, WORKTREES.md, etc)
└── assets/           (skills-manifest.json, EXTERNAL_ADDONS.md)
```

Since `npx skills` installs any directory with `SKILL.md`, this would get installed
automatically. The skill's instructions would symlink its bundled files to the
expected locations on first invocation.

**Option C: Add `npx skills` manifest format (upstream fix)**

Add a `skills.json` at repo root in the format `npx skills` expects:

```json
{
  "name": "seriousvibecoding",
  "skills": ["route-workflow", "validate-feature", "..."],
  "postInstall": "bash scripts/setup-framework.sh"
}
```

This requires `npx skills` to support `postInstall` — check if it does. If not,
this is a feature request to the skills CLI.

### Recommendation

Option B (wrapper skill) is the most self-contained — no external tooling changes,
works with existing `npx skills add`, and the framework infrastructure gets
installed automatically because it's inside a skill folder.

---

## P1: `onboard-repo` must verify code claims, not transcribe conversation context (HIGH)

### Problem

When `onboard-repo` captures findings from conversation history (prior sessions,
user reports, or chat context), it can produce work items with unverified code-level
claims — wrong field names, wrong function signatures, wrong root causes.

### Evidence

During a real brownfield onboard, a work item was created that:
- Named specific field mismatches without grepping the actual code
- Named specific functions without reading the actual files
- Recommended routing to an external add-on (`writing-plans`) instead of core pack (`plan-changeset`)
- Assigned a severity based on conversation tone, not system verification

The user caught it: work items produced by the system must be checked through system means.

### Fix

Add to `onboard-repo/SKILL.md` under Process, before Step 3 (Capture findings as work items):

```markdown
### Verification Rule for External Claims

When capturing findings from conversation context, prior sessions, or user reports:

1. **Every code-level claim must be verified by reading the actual file.**
   "The function bypasses secureOperation" → Read the function. Confirm.
2. **Every field/function/component name must be grep-verified.**
   "Field mismatch: writes discount_percent, reads discount_percentage" → Grep both names. Confirm.
3. **Route recommendations must use Core Pack skills only.**
   Check the route against `skills-manifest.json` includedSkills. No external add-ons as primary routes.
4. **If verification fails, mark the finding as `unverified-report`** and note what couldn't be confirmed.
   Do not assign severity above `medium` to unverified findings.

The work item must contain evidence from system tools (Read, Grep, Bash),
not from conversation history.
```

---

## P1: `validate-feature` routing graph references external add-on as alternative (MEDIUM)

### Problem

`validate-feature/SKILL.md` line 112 contains a routing graph node:
```
plans [label="/plan-changeset →\nexecute-changeset\n(small, skip design;\nexternal: /writing-plans)"]
```

This legitimizes `writing-plans` (an external add-on, also deprecated in superpowers-tms-fork)
as an alternative route for "small" features. When an agent follows this graph, it may
route to the external add-on instead of the core pack skill.

### Evidence

In the same brownfield session, a work item was created with route recommendation
`superpowers-tms-fork:write-plan` — which is deprecated. The validate-feature graph's
mention of `writing-plans` normalizes this routing pattern.

### Fix

Remove the external reference from the routing graph in `validate-feature/SKILL.md`:

```diff
-    plans [label="/plan-changeset →\nexecute-changeset\n(small, skip design;\nexternal: /writing-plans)"];
+    plans [label="/plan-changeset →\nexecute-changeset\n(small, skip design)"];
```

Core pack skills should never suggest external add-ons as primary alternatives.
External add-ons are opt-in via `EXTERNAL_ADDONS.md`, not embedded in core routing graphs.

---

## P2: `workflow-compass` references 6 dead skill names (LOW)

### Problem

`workflow-compass/SKILL.md` description references pre-rename skill names:
`vision-sync`, `persona-builder`, `journey-sync`, `feature-discovery`, `spec-ac-sync`,
`agentic-e2e-playwright`. None exist. Current names: `write-vision`, `build-personas`,
`write-journeys`, `validate-feature`, `audit-ac`, `write-e2e`.

### Fix

Either update `workflow-compass` to current names, or deprecate it — `route-workflow`
supersedes it entirely with correct names and lane definitions.

---

## P2: Duplicate skill `spec-code-sync` alongside canonical `sync-spec-code` (LOW)

### Problem

Both `spec-code-sync/SKILL.md` and `sync-spec-code/SKILL.md` exist with near-identical
descriptions. `sync-spec-code` is the canonical name (in Core Pack, in lane definitions).
`spec-code-sync` is the old name, still referenced by `workflow-compass`.

### Fix

Remove `spec-code-sync/` from the repo. Update any remaining references to use
`sync-spec-code`.
