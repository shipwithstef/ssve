# gstack Infrastructure — Details

## Mechanism

### Multi-Host System (8 hosts)

Each host is a typed TypeScript config (`hosts/*.ts`) declaring:
- Install paths (globalRoot, localSkillRoot, hostSubdir)
- Frontmatter transform (allowlist/denylist fields)
- Path rewrites (`.claude/skills` → `.codex/skills`)
- Tool rewrites (`Agent tool` → `sessions_spawn`)
- Adapter for complex hosts (OpenClaw)
- Co-author trailer, learnings mode, env var usage

Adding a host: create one TS file, register in index.ts. Zero code changes
to generator, setup, or tooling.

### Host Configs

| Host | Key differences |
|---|---|
| Claude | Primary. Denylist mode. Full learnings |
| Codex | Allowlist (name + description only). 1024 char desc limit. Suppresses 5 resolvers. Sidecar yaml. Boundary instruction |
| Cursor | Same as Claude but different paths |
| Factory | Tool rewrites (Bash → terminal), conditional fields, user-invocable extra field |
| Kiro | Same as Claude but different paths |
| OpenClaw | Path rewrites (CLAUDE.md → AGENTS.md), tool rewrites (Agent → sessions_spawn), full adapter module |
| OpenCode | Same as Claude but different paths |
| Slate | Same as Claude but different paths |

### Template System

```
SKILL.md.tmpl (human prose + {{PLACEHOLDERS}})
  → gen-skill-docs.ts (reads source code, runs resolvers)
  → SKILL.md (committed, auto-generated sections)
```

12+ resolvers:
| Resolver | What it generates |
|---|---|
| PREAMBLE | Update check, session tracking, contributor mode, AskUserQuestion format, Search Before Building |
| COMMAND_REFERENCE | Categorized command table from commands.ts |
| SNAPSHOT_FLAGS | Flag reference from snapshot.ts |
| BROWSE_SETUP | Binary discovery + setup instructions |
| BASE_BRANCH_DETECT | Dynamic base branch detection |
| QA_METHODOLOGY | 6-phase QA workflow |
| DESIGN_METHODOLOGY | Design audit methodology |
| REVIEW_DASHBOARD | Review Readiness Dashboard for /ship |
| TEST_BOOTSTRAP | Test framework detection (B2-B8 pipeline) |
| REVIEW_ARMY | 7 specialists with adaptive gating |
| LEARNINGS | Full/basic mode cross-project learnings |
| DX_FRAMEWORK | 8 principles, 7 characteristics, 10 cognitive patterns |
| CODEX_PLAN_REVIEW | Cross-model plan review |
| CONFIDENCE | 1-10 confidence calibration rubric |
| DESIGN_SETUP | $D binary discovery |
| DESIGN_SHOTGUN_LOOP | Comparison board feedback loop |

### Setup Script (~600 lines bash)

1. Builds browse binary (`bun build --compile`, smart rebuild)
2. Links skills into `~/.claude/skills/gstack/` (real dirs with symlinked SKILL.md)
3. Generates host-specific SKILL.md from templates
4. Manages team mode via settings hooks
5. Flags: `--host`, `--local`, `--prefix/--no-prefix`, `--team/--no-team`, `-q`

### Team Mode

SessionStart hook in `~/.claude/settings.json`:
- `gstack-session-update`: background fork, throttled 1h, PID lockfile
- Runs `git pull --ff-only` then `./setup -q` if HEAD moved
- Network-failure-safe, completely silent
- `gstack-team-init`: generates CLAUDE.md section + optional PreToolUse hook

### Bin Scripts (28+)

| Category | Scripts |
|---|---|
| Config | gstack-config (YAML read/write), gstack-settings-hook, gstack-relink |
| Telemetry | gstack-telemetry-log (JSONL append), gstack-telemetry-sync (Supabase batch POST) |
| Analytics | gstack-analytics (bar charts, skill durations, success rates) |
| Learnings | gstack-learnings-log (append), gstack-learnings-search (confidence decay, dedup, cross-project) |
| Timeline | gstack-timeline-log (local-only session timeline), gstack-timeline-read |
| Review | gstack-review-log (atomic JSON append), gstack-review-read |
| Session | gstack-session-update (SessionStart auto-update hook) |
| Platform | gstack-platform-detect, gstack-slug, gstack-repo-mode (solo vs collaborative) |
| Scope | gstack-diff-scope (categorizes git diff into FRONTEND/BACKEND/TESTS/etc) |
| Install | gstack-uninstall, gstack-update-check (version + snooze system) |
| Dev | dev-setup, dev-teardown, gstack-patch-names |
| Community | gstack-community-dashboard (Supabase aggregates) |
| Specialist | gstack-specialist-stats (per-specialist hit rates, GATE_CANDIDATE detection) |
| Browser | chrome-cdp (Chrome with CDP on port 9222), gstack-extension, gstack-open-url |
| Discovery | gstack-global-discover.ts (scans Claude/Codex/Gemini sessions, dedup by remote) |

### Worktree Manager

`lib/worktree.ts` — WorktreeManager class for git worktree lifecycle.
Used by sidebar agent (isolated per session) and conductor.

## Analysis

The multi-host architecture is gstack's most novel infrastructure pattern.
By encoding all host differences as declarative config (path rewrites, frontmatter
transforms, tool name rewrites), a new host is one file. The template resolver
system ensures SKILL.md files stay in sync with source code — if a command exists
in code, it appears in docs.

Team mode solves the "version drift across developers" problem cleanly: SessionStart
hook + background git pull. The auto-detection of vendored copies and migration to
team mode is thoughtful.

The bin scripts provide a comprehensive CLI toolkit for analytics, learnings, and
session management. The specialist stats with adaptive gating (0 findings in 10+
dispatches → gate candidate) is a data-driven approach to review optimization.

## L4 Pointers

- Setup script: `setup` (~600 lines)
- Host configs: `hosts/` (8 files + index.ts)
- Template system: `scripts/gen-skill-docs.ts`, `scripts/resolvers/` (12+ files)
- Host config type: `scripts/host-config.ts`
- Adding a host: `docs/ADDING_A_HOST.md`
- Worktree: `lib/worktree.ts`
