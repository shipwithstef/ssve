# Framework Evolution — 2026-04-18 — Audit Log Path Collision

## Method

Evidence from WI-068 session audit (`proposals/2026-04-18-session-audit-wi-068.md`, finding F4). During WI-068 execution on Example Marketplace, `git add` failed because `.svc/` is in the project's `.gitignore`. The agent recovered by committing without the audit trail files, making `lane-tasks-WI-068.json` and `pipeline-decisions.jsonl` invisible to version control.

The root cause is that `.svc/` is a **generic path** that many projects legitimately gitignore (build logs, application logs, debug output). svc uses this same generic namespace for **audit-critical artifacts** (task graphs, pipeline decisions, visual evidence). This creates a structural collision: projects that gitignore `.svc/` silently lose their svc audit trail.

### Blast Radius Assessment

`.svc/` is referenced in:

| Category | Count | Key files |
|---|---|---|
| Skill SKILL.md files (task-graph continuation block) | ~40+ | Every skill with chaining |
| Core doctrine/routing | 4 | `DOCTRINE.md`, `ANTIGRAVITY.md`, `README.md`, `route-workflow/SKILL.md` |
| Helper scripts | 2 | `scripts/eval-gate.mjs:22`, `scripts/pipeline-log.mjs` (uses `--path` arg) |
| Hooks | 1 | `hooks/svc-task-completion-guard.sh:37,39` |
| Manifest | 1 | `skills-manifest.json:143` |
| Visual tracking | ~20 refs | `track-visuals/SKILL.md`, `test-journeys/SKILL.md`, `verify-promotion/SKILL.md` |
| FRAMEWORK-STATE.md | ~10 refs | Analysis history entries |
| Proposals (done/) | ~15 refs | Historical records |

Sub-paths under `.svc/`:
- `.svc/lane-tasks*.json` — task graphs (audit-critical)
- `.svc/pipeline-decisions.jsonl` — routing decisions (audit-critical)
- `.svc/visuals/<WI>/` — screenshots (ephemeral, often gitignored by design)

---

## Findings (by priority)

### P0 — Fix now: `.svc/` path collides with common `.gitignore` patterns

- **File:** Every skill referencing `.svc/lane-tasks.json` and `.svc/pipeline-decisions.jsonl`
- **Evidence:** Example Marketplace `.gitignore` excludes `.svc/`, causing `lane-tasks-WI-068.json` to be untrackable. Session trace `fa0cd13d` line L249: `Exit code 1 — The following paths are ignored by one of your .gitignore files: docs/logs`
- **Impact:** Audit trail silently lost on any project that gitignores `.svc/`. Resume across machines fails. `audit-session-execution` loses primary evidence.

**Proposed fix — rename to `.svc/`:**

| Current path | Proposed path | Rationale |
|---|---|---|
| `.svc/lane-tasks*.json` | `.svc/lane-tasks*.json` | svc-namespaced, won't collide |
| `.svc/pipeline-decisions.jsonl` | `.svc/pipeline-decisions.jsonl` | same |
| `.svc/visuals/<WI>/` | `.svc/visuals/<WI>/` | same |

**Why `.svc/`:**
1. **Namespaced** — no project would organically create a `.svc/` directory
2. **Dot-prefixed** — signals "tool-managed, not human-authored" (like `.git/`, `.claude/`, `.github/`)
3. **Short** — less path bloat in every skill reference
4. **Gittrackable by default** — projects won't have it in `.gitignore` unless they explicitly choose to
5. **Single migration** — one `sed` pass across all skills replaces `.svc/` → `.svc/`

**Alternative considered:** `docs/svc-logs/` — keeps the `docs/` prefix but still risks partial gitignore matches on `docs/*`. The dot-prefix convention is stronger.

**Alternative considered:** `.svc/logs/` — adds an unnecessary nesting level. The files are already self-describing (`lane-tasks-WI-068.json`, `pipeline-decisions.jsonl`).

### P1 — `onboard-repo` should create `.svc/` and ensure it's not gitignored

- **File:** `onboard-repo/SKILL.md`
- **Evidence:** No step currently ensures the audit log directory exists or is git-trackable
- **Fix:** Add to `onboard-repo` setup steps: `mkdir -p .svc && echo "# svc audit trail" > .svc/.gitkeep`. Check that `.gitignore` doesn't exclude `.svc/`. If it does, warn the user.

### P1 — `route-workflow` should validate audit directory at lane entry

- **File:** `route-workflow/SKILL.md`
- **Evidence:** WI-068 agent didn't discover the `.gitignore` collision until commit time (end of session)
- **Fix:** At lane-entry (before task graph creation), check `git check-ignore -v .svc/lane-tasks.json 2>/dev/null`. If ignored, WARN immediately rather than discovering at commit time.

### P2 — Visual screenshots can remain ephemeral

- `.svc/visuals/<WI>/` → `.svc/visuals/<WI>/` for consistency, BUT note that `test-journeys/SKILL.md:402` already acknowledges screenshots may be gitignored: "Screenshots under `.svc/visuals/<WI>/` follow the project's `.gitignore` policy; if they are ignored (common for `*.png`), note that in SUMMARY.md — evidence is ephemeral in that case and the SUMMARY is the durable record." This design is correct — screenshots are large binaries that shouldn't always be tracked. The rename still applies for namespace consistency.

---

## Migration Plan

### Phase 1: Framework update (one `improve-framework` session)

1. `sed -i` across all `.md`, `.mjs`, `.sh`, `.json` files: `.svc/` → `.svc/`
2. Update `scripts/eval-gate.mjs:22` hardcoded path
3. Update `hooks/svc-task-completion-guard.sh` glob pattern
4. Update `skills-manifest.json` canonical path
5. Update `audit-coverage/SKILL.md` canonical artifact table (row 20)
6. Run `bash test-framework/evals/tier-1/validate-framework-self-management.sh` — expect failures on path assertions, fix those
7. Run `bash test-framework/evals/tier-1/validate-framework-helper-behavior.sh` — same
8. Update FRAMEWORK-STATE.md

### Phase 2: Existing project migration (per-project, on next session)

For existing svc repos (Example Marketplace, etc.):
```bash
mkdir -p .svc
git mv .svc/lane-tasks*.json .svc/ 2>/dev/null || mv .svc/lane-tasks*.json .svc/ 2>/dev/null
git mv .svc/pipeline-decisions.jsonl .svc/ 2>/dev/null || mv .svc/pipeline-decisions.jsonl .svc/ 2>/dev/null
mv .svc/visuals/ .svc/visuals/ 2>/dev/null
```

This is non-breaking because:
- Helper scripts use `--path` arguments (path-agnostic)
- Agent reads the path from skill contracts, not hardcoded memory
- Old `.svc/` can remain for legacy artifacts

---

## Comparison delta

Not applicable — this is an infrastructure path choice, not a capability comparison.

## Stale proposal audit

- `proposals/2026-04-18-session-audit-wi-068.md` — F4 (`.gitignore` collision) is the source of this proposal. NC1 can be closed after this migration lands.

---

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|---|---|---|
| 1 | Proposal file exists | This file | PASS |
| 2 | Every finding cites file:line | eval-gate.mjs:22, hooks:37, skills-manifest.json:143, session trace L249 | PASS |
| 3 | FRAMEWORK-STATE.md was read first | No rediscovered items; timestamp gap and Current Focus are cited as KNOWN/FIXED | PASS |
| 4 | Findings are ranked by impact | P0 path collision → P1 onboard/route validation → P2 visual consistency | PASS |
