# Implementation Manifest — WI-498: install-anchored resolution (security) + Codex first-task activation

**Spec:** `docs/specs/work-items/WI-498.md`
**Branch:** `framework-WI-498-codex-first-task-activation`
**Status:** DRAFTED (rev5 — reshaped systemic scope; addresses reshaped-review F-001…F-007)
**Base SHA:** 5b2b444a00c787e68ac0fdc1bc2cd37bffd4ead0
**Timestamp:** 2026-07-18
**Mode:** `inline`
**Lane:** framework / bugfix+security
**Archetype (Step 0):** Cross-cutting concern — one invariant ("svc exec-paths are install-anchored, never consumer-relative") that must hold at every resolution site. Planning mode: enumerate the entry points (audit complete) then apply behavior uniformly.

## Upstream Alignment
- `upstream_completed`: route-workflow, diagnose-bug — WI-498.md §Problem (site-by-site audit) + §Live reproduction + external research (pre-commit/husky/`core.hooksPath`/`import.meta.url` tamper-resistance).
- `upstream_skipped_with_justification`: design-tech — bugfix lane; design captured in WI + manifest. Recorded in `.svc/lane-tasks-WI-498.json`.

## Implementation Summary

**Principle:** every svc executable path resolves from the self-located install root (`path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")`, realpath-canonicalized), never from the consumer repo's `cwd`/`worktree`/walked-up tree. `import.meta.url` resolves through the consumer-side symlink to the REAL install (node default, verified) ⇒ correct when the consumer has no svc code AND tamper-resistant against a consumer-planted shadow. Optional `SVC_HOME` env override honored only when it points at a validated install marker (`skills-manifest.json`).

**Three coupled fixes:**
- **D1 (resolution):** install-anchor every consumer-relative svc-exec-path site, per the per-file derivation table below (self-location depth differs per file; the copied OpenCode plugin uses a verified-symlink skills-root binding, NOT `dirname/..`).
- **D2/F-001+F-011 (enforcer, UNIFORM rule for BOTH tokens):** the enforcer authorizes the bootstrap AND loader tokens under ONE rule — the **install-absolute** path (realpath-equal to `installedEnsureWorktree()`/`installedLoadSkill()`), OR the repo-relative spelling only when `realpath(cwd)===repo_root` (which makes a nested-cwd shadow impossible — node resolves the relative path against the same `repo_root` the predicate validated). Bootstrap Arm A already has this cwd guard (WI-494 F-001); this WI adds the identical guard to the loader token, closing F-011 without breaking the framework-repo case where repo==install. `deny()` renders the **install-absolute** recovery command for both (F-002; a fail-closed diagnostic if the installed sibling cannot be resolved), so the recovery is always a command the enforcer accepts.
- **D3 (deadlock):** new atomic `task-graph.mjs activate-skill` (Codex-only caller) flips the first-runnable-pending task to `in_progress` in one `updateJsonAtomic` write. **Numeric task-ids only** (F-003 — graph task ids are numeric by construction; the enforcer's `recoverableId` string/number matching stays at the AUTHORITY layer and is unchanged). `codex-load-skill.mjs` calls it via the install-anchored sibling; session receipt only on exit 0.

**Invariants:** I1 install-anchoring is self-locating (per-file derivation; no consumer input; optional `SVC_HOME` honored only if it points at a validated `skills-manifest.json` marker). I2 Claude host untouched — `activate-skill` additive + Codex-only caller; `load-skill`/`set-status`/`validate`/`next`/`record-phase` byte-identical (proven by re-running task-graph tier-1). I3 no new enforcer exemption for `active.ok===false` (the loader token is NARROWED, not widened). I4 `cwd:worktree` retained only as the child process workdir, never as a script-path base.

## Executable-path Semantic Inventory (F-005 — every audit hit classified)

| Site | Source base (today) | Executable sink | Trust class | Disposition |
|------|--------------------|-----------------|-------------|-------------|
| `scripts/codex-load-skill.mjs:40` | `worktree` (consumer) | `spawnSync(node, task-graph.mjs)` | UNTRUSTED | FIX → install root (`dirname(import.meta.url)`) |
| `hooks/svc-phase-receipt-autoemit.mjs:113` | `cwd` (consumer) | `execFileSync(node, task-graph.mjs)` | UNTRUSTED | FIX → existing `SVC_ROOT` |
| `hooks/svc-lane-tasks-validate-edit.mjs:43` | walk-up (consumer tree) | exec task-graph | UNTRUSTED | FIX → install root |
| `hooks/svc-lane-tasks-validate-content.mjs:39` | walk-up (consumer tree) | exec task-graph | UNTRUSTED | FIX → install root |
| `scripts/validate-wave-closeout.mjs:268` | validated-repo `root` | `execFileSync(node, task-graph.mjs)` | UNTRUSTED | FIX → install root |
| `hooks/opencode/svc-opencode-plugin.ts:165` | `skillsPath` (install skills dir) | exec task-graph | INSTALL-derived but COPIED file | KEEP → already install-anchored via findSkillsPath (validated skills-root binding, G6-F003) |
| `hooks/codex/svc-codex-stop-firewall.mjs:56` | `ctx.repo_root` (consumer) | `spawnSync(bash, svc-task-completion-guard.sh)` | UNTRUSTED (.sh exec, G6-F006) | FIX → self-located install dir (import.meta.url); test-mode override retained |
| `scripts/scenario-runner.mjs:89`, `kimi-e2e-test.mjs`, `framework-test-catalog.mjs` | FRAMEWORK_ROOT-then-workspace | exec (test only) | TEST HARNESS (framework-repo only) | ALLOWLIST (documented; guard excludes) |
| `scripts/svc-migrate-install.mjs:*` | `repoRoot` (install SOURCE) | copies/execs during install | INSTALL-time source | ALLOWLIST (repoRoot IS the framework source at install) |
| enforcer bootstrap Arm A | repo-relative + `cwd===repo_root` guard | authorizes bootstrap | GUARDED (WI-494) | KEEP guard; unify with loader (D2) |
| enforcer loader token | repo-relative UNGUARDED | authorizes loader | UNTRUSTED (F-011) | FIX → add `cwd===repo_root` guard / install-absolute (D2) |

## Per-file install-root derivation (F-004)

| File | Location relative to install | Root derivation |
|------|------------------------------|-----------------|
| `scripts/codex-load-skill.mjs` | `<install>/scripts/` | `realpath(dirname(fileURLToPath(import.meta.url)))` → sibling `task-graph.mjs` in the SAME dir |
| `hooks/svc-phase-receipt-autoemit.mjs` | `<install>/hooks/` | existing `SVC_ROOT = dirname(import.meta.url)/..` → `SVC_ROOT/scripts/task-graph.mjs` |
| `hooks/svc-lane-tasks-validate-{edit,content}.mjs` | `<install>/hooks/` | `dirname(import.meta.url)/../scripts/task-graph.mjs` |
| `scripts/validate-wave-closeout.mjs` | `<install>/scripts/` | `dirname(import.meta.url)/task-graph.mjs` |
| `hooks/opencode/svc-opencode-plugin.ts` | COPIED into the opencode install (not run from svc `scripts/`) | resolve via the wired skills-root binding whose runtime realpath is verified against a `skills-manifest.json` marker; NOT `dirname/..` |

## Files Planned

| # | File | Change | Why |
|---|------|--------|-----|
| 1 | `scripts/task-graph.mjs` | MODIFY — ADD atomic `activate-skill` command (updateJsonAtomic, recoverableId, first-runnable-pending/in-progress predicate); existing commands byte-identical | Deadlock atomic op (D3) |
| 2 | `scripts/codex-load-skill.mjs` | MODIFY — resolve `task-graph.mjs` from install root (self-located, realpath-canonical); call `activate-skill`; session receipt only on exit 0 | D1 + D3 |
| 3 | `hooks/svc-phase-receipt-autoemit.mjs` | MODIFY — line 113 use the already-computed `SVC_ROOT` instead of `cwd` | D1 |
| 4 | `hooks/svc-lane-tasks-validate-edit.mjs` | MODIFY — resolve `task-graph.mjs` from install root, not walk-up the consumer tree | D1 |
| 5 | `hooks/svc-lane-tasks-validate-content.mjs` | MODIFY — same install-anchor | D1 |
| 6 | `scripts/validate-wave-closeout.mjs` | MODIFY — exec the install's `task-graph.mjs`, not the validated repo's `root` | D1 |
| 7 | `hooks/opencode/svc-opencode-plugin.ts` | NO CHANGE — audit found it is ALREADY install-anchored: `findSkillsPath()` resolves `~/.claude/skills`/`~/.config/opencode/skills` gated on `route-workflow/SKILL.md` presence (a validated skills-root binding), never the consumer repo. Allowlisted in the guard + inventory with this rationale (F-004/G6-F003) | D1 |
| 8 | `hooks/codex/svc-codex-skill-load-enforcer.mjs` | MODIFY — UNIFORM install-bind rule for BOTH bootstrap + loader tokens (install-absolute OR relative-with-`cwd===repo_root`, F-001); `deny()` renders install-absolute recovery + fail-closed diagnostic (F-002) | D2 |
| 9 | test-framework/evals/tier-1/validate-install-anchored-resolution.sh | CREATE — anti-regression guard with an EXPLICIT detection contract (F-005): flags any `path.join/resolve` whose first arg ∈ {cwd, process.cwd(), worktree, walk-up var, repo/root derived from consumer} feeding a `.mjs/.sh` that is then spawned/exec'd/imported; reads the checked-in inventory table as the allowlist source; ships with seeded POSITIVE (must-catch) and NEGATIVE (must-not-flag) fixtures | IAR-07 |
| 10 | test-framework/evals/tier-1/validate-codex-first-task-activation.sh | CREATE — hermetic e2e (real enforcer): planted-shadow negative (IAR-02), install-absolute loader-token bind (IAR-03), bootstrap→loader→activate→mutation ALLOW (IAR-04), atomicity/idempotency/failure-injection (IAR-05), string+numeric ids | IAR-02..05 |

### Fixture construction (hermetic + deterministic)
`validate-codex-first-task-activation.sh`: `mktemp -d` root + `trap rm -rf EXIT`; isolate `HOME`/`CODEX_HOME`/`XDG_*`/`SVC_CODEX_RUNTIME_DIR` under the root; build a fixture-owned installed tree (copy real `scripts/task-graph.mjs`, `scripts/state-io.mjs` + transitive deps, `scripts/codex-load-skill.mjs`, `hooks/codex/svc-codex-skill-load-enforcer.mjs` + `hooks/lib`/`hooks/codex/lib` deps); a test repo (`git init`, `.svc`), pending graph, session+turn vars; NO installer, NO network. Plant a hostile `scripts/task-graph.mjs` in the test repo and assert the INSTALL copy runs (IAR-02). Exercise direct-source AND symlink-farm layouts.

## Task Graph

| id | title | files | deps | AC | validation | checkpoint |
|----|-------|-------|------|----|-----------|-----------|
| E1 | atomic activate-skill | `scripts/task-graph.mjs` | — | IAR-04,05,06 | node --check + fixture | — |
| E2 | install-anchor loader + call activate-skill | `scripts/codex-load-skill.mjs` | E1 | IAR-01,02,04 | node --check + fixture | — |
| E3 | install-anchor the hook/script D1 sites | `hooks/svc-phase-receipt-autoemit.mjs` | — | IAR-01,02 | node --check + guard | — |
| E4 | enforcer loader-token install-absolute (F-011) | `hooks/codex/svc-codex-skill-load-enforcer.mjs` | E2 | IAR-03,06 | node --check + fixture | — |
| E5 | anti-regression guard | (new guard fixture) | E3 | IAR-07 | run the guard | — |
| E6 | hermetic e2e + shadow + failure-injection fixture | (new fixture) | E2,E4 | IAR-02,03,04,05 | run the fixture | — |
| E7 | install-anchor D1 files 4-7 + Claude-host non-regression proof | `hooks/svc-lane-tasks-validate-edit.mjs`, `hooks/svc-lane-tasks-validate-content.mjs`, `scripts/validate-wave-closeout.mjs`, `hooks/opencode/svc-opencode-plugin.ts` | E3 | IAR-01,06 | node --check + guard + `task-graph` tier-1 (proves load-skill/set-status/validate/next byte-identical) | — |
| E8 | DEPLOY to hosts, record realpaths+hashes, THEN live re-proof (F-006) | all | E1..E7 | IAR-08 | `setup --host claude && setup --host codex` (farm re-link) + local-main FF; capture installed realpath+sha256 of loader/task-graph/enforcer; run the consumer proof against those hashes | human_checkpoint |
| E9 | full tier-1 green | all | E1..E8 | IAR-08 | run-all-evals --tier1 | human_checkpoint |

## AC-to-Task
| AC | Task |
|----|------|
| IAR-01 install-anchored sites | E2,E3 (+ files 4-7) |
| IAR-02 shadow negative | E2,E6 |
| IAR-03 loader-token install-absolute | E4,E6 |
| IAR-04 hermetic deadlock proof | E1,E2,E6 |
| IAR-05 atomic/idempotent/recovery | E1,E6 |
| IAR-06 no new exemption + Claude unchanged | E1,E4 |
| IAR-07 anti-regression guard | E5 |
| IAR-08 tier-1 + live | E7 |

## AC-to-Test
| AC | Test type |
|----|-----------|
| IAR-01 | Static — read each fixed site + the anti-regression guard |
| IAR-02 | Fixture — planted-shadow, assert install copy ran |
| IAR-03 | Hermetic — enforcer denies relative/shadowed loader token, allows install-absolute |
| IAR-04 | Hermetic E2E — bootstrap→loader→activate→mutation ALLOW (numeric+string ids) |
| IAR-05 | Fixture — atomicity, byte-identity on reject, idempotent reload, failure-injection recovery |
| IAR-06 | Regression — task-graph tier-1 green; Claude path unchanged |
| IAR-07 | Suite — the anti-regression guard fails on a seeded consumer-relative resolution |
| IAR-08 | Suite+live |

## Prerequisite Alignment Matrix
| Pillar | Trace | Status |
|--------|-------|--------|
| Persona | Codex orchestrator (gpt-5.6-sol) + PostToolUse hooks running in an onboarded product repo — session 019f735d, example-marketplace | traced |
| tech | install-anchor pattern (`import.meta.url` self-location, symlink→realpath), enforcer contract (WI-486/494/496), task-graph status model, updateJsonAtomic | traced |
| UX / UI | none — framework internal tooling | N/A |
| style | `.mjs`/`.sh` conventions; `import.meta.url` root pattern already in ~20 scripts | traced |

## External State
| # | Taxonomy entry | What state | Coupling | Lifecycle wiring |
|---|----------------|------------|----------|------------------|
| 6 | Local filesystem / repo working tree | task-graph JSON status flips at load; session receipt file | coupled | updateJsonAtomic write; session_dir; live/die with worktree/session |
| 11 | Installed artifact / distribution (`~/.claude/skills`, codex farm symlinks) | ALL fixed sites now resolve execs from here; loader token bound to it | coupled | `import.meta.url` self-locates the real install through the symlink; `setup --host` (re)links; rollback = revert + FF |

Taxonomy walk (all 15 visible): 1 git-remote — untouched; 2 CI — untouched; 3 cloud — untouched; 4 DB — untouched; 5 registries — untouched; **6 local FS — TOUCHED**; 7 browser/session — untouched; 8 env vars — reads optional `SVC_HOME`/`SVC_AUTOEMIT_SKILLS_ROOT` override (validated marker) — coupled-read only; 9 host settings — untouched; 10 MCP — untouched; **11 installed artifact — TOUCHED**; 12 cron — untouched; 13 deploy — untouched; 14 secrets — untouched; 15 DNS/SSL/index/downstream-artifacts — untouched. No `decoupled-justified` entries.

## Validation Plan
- Static: `node --check` on every modified `.mjs`; grep guard that the enforcer `active.ok===false` branch adds no new allowed shape.
- Fixtures: the anti-regression guard + the hermetic e2e/shadow/failure-injection fixture.
- Suite: `run-all-evals.sh --tier1`.
- Live (E7): example-marketplace WI-SOCIAL-01 — loader→activation→governed mutation ALLOW against the deployed enforcer.

## Execution Command Sequence
```bash
cd .worktrees/framework-WI-498-codex-first-task-activation
node --check scripts/task-graph.mjs
node --check scripts/codex-load-skill.mjs
node --check hooks/svc-phase-receipt-autoemit.mjs hooks/svc-lane-tasks-validate-edit.mjs hooks/svc-lane-tasks-validate-content.mjs scripts/validate-wave-closeout.mjs
node --check hooks/codex/svc-codex-skill-load-enforcer.mjs
node --check hooks/svc-lane-tasks-validate-edit.mjs hooks/svc-lane-tasks-validate-content.mjs
node scripts/task-graph.mjs validate .svc/lane-tasks-WI-498.json   # Claude-path non-regression (F-007)
bash test-framework/evals/tier-1/validate-install-anchored-resolution.sh
bash test-framework/evals/tier-1/validate-codex-first-task-activation.sh
export PATH="$HOME/.local/bin:$PATH"
bash test-framework/evals/run-all-evals.sh --tier1
# DEPLOY before live proof (F-006):
./setup --host claude && ./setup --host codex          # re-link farms to the fixed sources
git -C /workspace/seriousvibecoding checkout main && git merge --ff-only <this-branch>
# record deployed identities, then run the live consumer proof against them:
realpath ~/.codex/skills/scripts/task-graph.mjs ~/.codex/skills/scripts/codex-load-skill.mjs; sha256sum <those>
```
RECOVERY_IF_FAIL: updateJsonAtomic leaves the pre-write graph intact on failure; session receipt never written after a failed activation; re-run the exact loader to restore an authorized state; revert per-file to fall back. DEPLOYMENT rollback (F-006): `git revert` the merge on main + FF + re-run `setup --host {claude,codex}` to re-link the farms to the reverted sources (symlink lifecycle stays coupled to the source).

## Checkpoint Plan
- human_checkpoint at E7 (deployed-enforcer live re-proof + full suite).

## Tier-1 Promotion Notes (rules/tier-1-promotion.md)

**validate-codex-first-task-activation.sh**
- validator_path: `test-framework/evals/tier-1/validate-codex-first-task-activation.sh`
- failure_class: Codex bootstrap/activation deadlock + consumer-shadow exec of svc scripts
- promotion_signal: signal #1 (same class observed ≥2× in 60d — WI-494, WI-496, WI-498) AND signal #3 (protects the codex enforcer/loader hot path; a regression re-deadlocks every onboarded Codex session)
- expected_runtime_budget: <5s (hermetic; mktemp + node, no network/LLM)
- why_tier_2_or_targeted_is_insufficient: the deadlock silently returns on any change to enforcer/loader/task-graph; only an always-on gate catches it before it re-ships to every consumer

**validate-install-anchored-resolution.sh**
- validator_path: `test-framework/evals/tier-1/validate-install-anchored-resolution.sh`
- failure_class: svc executable path resolved from a consumer-controlled base (untrusted-path / consumer-shadow RCE class)
- promotion_signal: signal #3 (guards hook execution + script resolution hot path; a new consumer-anchored exec path is an ACE vector) AND signal #2 (documented RCE anti-pattern — git core.hooksPath-override class)
- expected_runtime_budget: <2s (grep over scripts/hooks/bin + 2 seed checks)
- why_tier_2_or_targeted_is_insufficient: this is a security invariant that must hold on EVERY commit; a consumer-anchored exec path added in any future change must fail the build immediately, not surface in a periodic scan

## Promotion Readiness Checklist
- [ ] Every modified `.mjs`/`.sh` passes `node --check`/parse; enforcer `active.ok===false` allowed-shape set unchanged except loader-token now install-absolute-only.
- [ ] Anti-regression guard green; hermetic e2e (shadow + activation + failure-injection) green; full tier-1 green.
- [ ] Live: example-marketplace WI-SOCIAL-01 loader→activation→governed-mutation ALLOW.
- [ ] No ORM/schema files touched (N/A).
- [ ] 5-receipt envelope emitted (refuse mode).
