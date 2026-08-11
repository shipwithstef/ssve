# Manifest — WI-137: `_shared/` directory symlinking across all 5 hosts

**Spec:** `docs/specs/features/WI-137-shared-content-symlinks.md`
**Branch:** `bugfix-WI-137-shared-symlinks`
**Status:** DRAFTED
**Base branch:** `main`
**Base SHA:** `d2150d5977f890111df85867603796e8a0005dc5`
**Created:** 2026-04-29
**Lane:** framework
**Archetype:** Bounded feature (bugfix-shape) — universe is fully spec-defined; no grep sweep, no entry-point enumeration

---

## Implementation Summary

Make `_shared/` reachable from every host install path after `./setup --host <h>` by adding it to each host manifest's `infra_dirs`. Add a tier-1 validator that asserts reachability across every detected host install (not just the active one). Add a meta-rule to `lint-skills-manifest.mjs` that prevents recurrence by failing CI if any top-level dir referenced from SKILL.md content is missing from any host manifest.

**Invariants (must remain unchanged):**
- `setup` script's `infra_dirs` symlink loop body (no code change to `setup`).
- All other top-level dir symlinks (`references/`, `proposals/`, `templates/`, `examples/`, `hooks/`, `provision/`, `scripts/`) keep working as today.
- `rules/` dedicated install path — out of scope.
- Skill auto-discovery rule — `_shared/` does NOT get a `SKILL.md`; remains infra.
- Existing 5-source-of-truth lint check (skills-manifest ↔ README/EXTERNAL_ADDONS/REPO_MODES/route-workflow) — meta-rule is additive, does not modify existing pass.

**Major constraints:**
- Worktree must NOT be used as the active host's source-repo pointer (per WI-079/WI-134 lessons). All testing of "real" setup behavior happens against a tmpdir, never against `~/.claude/skills/`.
- New validator's "every detected host install" iteration must be tolerant of partial installs (only check hosts whose install path exists).

---

## Files Planned

| File | Action | Task | Purpose |
|------|--------|------|---------|
| `provision/hosts/claude.json` | MODIFY | task-1 | Add `"_shared"` to `infra_dirs` |
| `provision/hosts/codex.json` | MODIFY | task-1 | Add `"_shared"` to `infra_dirs` |
| `provision/hosts/opencode.json` | MODIFY | task-1 | Add `"_shared"` to `infra_dirs` |
| `provision/hosts/kimi.json` | MODIFY | task-1 | Add `"_shared"` to `infra_dirs` |
| `provision/hosts/gemini.json` | MODIFY | task-1 | Add `"_shared"` to `infra_dirs` |
| test-framework/evals/tier-1/validate-shared-content-symlinks.sh | CREATE | task-2 | Multi-host reachability validator |
| `scripts/lint-skills-manifest.mjs` | MODIFY | task-3 | Add meta-rule preventing future drift |
| test-framework/fixtures/wi137-negative-host.json | CREATE | task-4 | Negative-test fixture for meta-rule (synthetic manifest missing `_shared`) |
| test-framework/evals/tier-1/validate-shared-symlinks-meta-rule.sh | CREATE | task-4 | Persistent CI test: applies fixture in tmpdir, runs lint, asserts non-zero exit (per F2) |
| references/shared-content-dirs.json | CREATE | task-3 | Allow-list registry of top-level shared-content dirs that must appear in every host manifest's `infra_dirs`. Initial content: `["_shared"]`. Future additions are explicit (per F1). |

---

## Task Graph

### task-1 — host-manifests-add-shared
**Touched files:** provision/hosts/claude.json, provision/hosts/codex.json, provision/hosts/opencode.json, provision/hosts/kimi.json, provision/hosts/gemini.json
**Dependencies:** none
**AC coverage:** WI137-01, WI137-04
**What:** For each of the 5 host manifests, add the literal string `"_shared"` to the `infra_dirs` array. Position: append at end of array (preserves diff readability). Must remain valid JSON (jq parse-clean).
**Validation:**
```bash
for h in claude codex opencode kimi gemini; do
  jq -e '.infra_dirs | index("_shared") != null' provision/hosts/${h}.json >/dev/null \
    || { echo "FAIL: ${h}.json missing _shared"; exit 1; }
done
echo "PASS: all 5 host manifests include _shared"
```
**Checkpoint:** `task-1-done` — all 5 JSON files parse and contain `_shared`.

---

### task-2 — write-validator
**Touched files:** test-framework/evals/tier-1/validate-shared-content-symlinks.sh (CREATE)
**Dependencies:** none (parallel with task-1)
**AC coverage:** WI137-03, WI137-06
**What:** Create a bash script that:
1. Discovers framework root using the existing tier-1 idiom — resolve `BASH_SOURCE[0]` via `realpath` and walk up to repo root (mirror what other tier-1 validators do; do NOT reinvent — copy the existing pattern from e.g. `validate-skill-structure.sh`). Per F4 review.
2. Lists every file in `<root>/_shared/` (currently 3 files; loop over actual contents — do NOT hardcode names).
3. Probes the 5 host install paths: `~/.claude/skills/`, `~/.codex/skills/`, `~/.config/opencode/skills/`, `~/.kimi/skills/`, `~/.gemini/skills/`.
4. For each install path that exists, the assertion is per F3 review:
   a. Test `[ -e "<install>/_shared/<file>" ]` (existence through dir-symlink). Files are NOT individually symlinked under the new model — `setup` creates a single dir-symlink at `<install>/_shared`, files are reached path-through-symlink.
   b. Resolve the parent: `target=$(readlink -f "<install>/_shared")`. Assert `target` ends in `/_shared` AND its sibling contains a known framework root marker (e.g., `setup` and `skills-manifest.json` exist alongside `<target>/..`). This confirms it points inside a real framework checkout.
   c. Do NOT use `-L` per-file or expect each file to be a symlink — that would false-MISS under the new dir-symlink layout.
5. Emits per-host PASS/FAIL lines; exits 0 only if every detected install passes; exits non-zero with a non-empty failure list otherwise.
6. If zero install paths exist (CI-like environment): exit 0 with a "no host installs detected; skipping reachability check" message.

**Behavior contract:**
- Script must use `set -euo pipefail`.
- Must NOT modify any filesystem state — read-only.
- Output format: structured lines `OK <host> <file>` and `MISS <host> <file>` for grep-friendly diff.

**Validation:**
```bash
bash -n test-framework/evals/tier-1/validate-shared-content-symlinks.sh        # syntax OK
shellcheck test-framework/evals/tier-1/validate-shared-content-symlinks.sh     # lint OK
chmod +x test-framework/evals/tier-1/validate-shared-content-symlinks.sh
bash test-framework/evals/tier-1/validate-shared-content-symlinks.sh           # exits 0 in current state, AFTER task-5 has fixed claude install
```
**Checkpoint:** `task-2-done` — script created, executable, syntax-clean, lint-clean.

---

### task-3 — lint-meta-rule
**Touched files:** `scripts/lint-skills-manifest.mjs`, references/shared-content-dirs.json (CREATE allow-list registry)
**Dependencies:** task-1 (so the meta-rule passes after the JSONs are fixed)
**AC coverage:** WI137-07, WI137-08
**What:** Extend `lint-skills-manifest.mjs` with a new check (additive; does not alter existing 5-source-of-truth pass). Per F1 review, the algorithm uses an explicit allow-list registry rather than open-ended "any other top-level dir" pattern matching, and the extraction grammar is concrete.

**Algorithm:**
1. Read the allow-list registry at references/shared-content-dirs.json — initial contents: `["_shared"]`. Future additions to this list are explicit edits, not implicit pattern detection. The registry is the source of truth for "which top-level dirs ship to host installs as shared content."
2. Walk every SKILL.md file at the framework root using a one-level-deep glob (each immediate subdirectory's SKILL.md), EXCLUDING the following parent dirs: `node_modules/`, `.worktrees/`, `proposals/`, `examples/`, `templates/`, `references/` (these are not invocable skills). The set of files walked is identical to the discovery glob in `setup`'s skill-detection loop.
3. For each SKILL.md, run the concrete extraction regex per allow-listed dir against the file CONTENT (not file path). Regex shape: negative-lookbehind for `[\w/.]` then `<dir>/` then one-or-more of `[A-Za-z0-9_.-]` then literal extension `.md`. Note: this matches `_shared/before-starting.md` literally as it appears in skills' content, but NOT `https://example.com/_shared/something.md` (the negative-lookbehind blocks slash-prefix and word-prefix forms typical in URLs / sub-paths).
4. Build the set R of allow-listed dirs that have ≥1 reference in any walked SKILL.md.
5. **Sanity assertion (per F1 review):** Today, `_shared` MUST appear in R (audit confirms 25 call sites across 14 SKILL.md files). If `_shared` is in the registry but R is empty, the extractor itself is broken — exit non-zero with a clear "extractor self-test failed" message. This catches a future regex regression.
6. Define explicit exception list: `["rules"]` (rules/ has its own dedicated install path per setup script — kept out of `infra_dirs` by design).
7. For each dir D in R that is NOT in the exception list: assert D appears in `infra_dirs` of EACH of the 5 host manifests (claude, codex, opencode, kimi, gemini). Compute the missing-host set per dir.
8. On violation: emit a clear error line naming the dir, the missing host(s), the count of referencing SKILL.md files, and the first reference's `path:line`. Exit non-zero.

**Error message shape (example):**
```
META-CHECK FAIL: top-level dir `_shared` is referenced from <N> SKILL.md files
                 but missing from infra_dirs of host manifest(s): [codex, opencode]
                 First reference: capture-idea/SKILL.md:42
                 Fix: add "_shared" to provision/hosts/{codex,opencode}.json
```

**Validation:**
```bash
node scripts/lint-skills-manifest.mjs   # exits 0 with task-1 changes applied
```
**Checkpoint:** `task-3-done` — lint passes after task-1 applied.

---

### task-4 — negative-test (persistent CI test, per F2 review)
**Touched files:** test-framework/fixtures/wi137-negative-host.json (CREATE), test-framework/evals/tier-1/validate-shared-symlinks-meta-rule.sh (CREATE)
**Dependencies:** task-3
**AC coverage:** WI137-08
**What:** Per F2 review, the negative test is now a permanent tier-1 validator (not a one-shot inline swap during execute-changeset). The validator and the fixture together exercise the meta-rule's negative path on every CI run, so future regressions of `lint-skills-manifest.mjs` are caught immediately.

1. Create fixture test-framework/fixtures/wi137-negative-host.json — a copy of `provision/hosts/claude.json` with `"_shared"` removed from `infra_dirs`.
2. Create test-framework/evals/tier-1/validate-shared-symlinks-meta-rule.sh. Behavior:
   a. Create a tmpdir staging area (`mktemp -d`).
   b. Copy the entire `provision/hosts/` directory into the tmpdir.
   c. Overwrite the tmpdir's `claude.json` with the fixture (synthetic violation: missing `_shared`).
   d. Invoke `lint-skills-manifest.mjs` configured to read host manifests from the tmpdir (via env var `SVC_HOSTS_DIR`, OR if linter has no such hook, snapshot+swap+lint+restore in a `trap` block — but only ever modifying the tmpdir copy, NEVER the real `provision/hosts/`).
   e. Assert lint exits non-zero (negative path) AND the error message contains the substring `_shared` and the host name `claude`. If either assertion fails: PRINT the lint output and exit non-zero from the validator.
   f. Clean up the tmpdir on exit (`trap` ensures cleanup even on early exit).
3. `set -euo pipefail`. Read-only against the real repo. Does NOT mutate `provision/hosts/` ever.

**Validation (worktree-time):**
```bash
bash -n test-framework/evals/tier-1/validate-shared-symlinks-meta-rule.sh
shellcheck test-framework/evals/tier-1/validate-shared-symlinks-meta-rule.sh
chmod +x test-framework/evals/tier-1/validate-shared-symlinks-meta-rule.sh
bash test-framework/evals/tier-1/validate-shared-symlinks-meta-rule.sh   # must exit 0 (the validator passes when the meta-rule correctly rejects the synthetic violation)
```
**Note on linter env hook:** if `lint-skills-manifest.mjs` does not currently support `SVC_HOSTS_DIR` env override, the cleanest fix is to add it as part of task-3 (1-line change to the host-manifests loader). This avoids the more fragile snapshot+swap pattern.

**Checkpoint:** `task-4-done` — fixture created; tier-1 validator created; both shellcheck-clean; validator exits 0 (i.e., correctly catches the synthetic violation).

---

### task-5 — brownfield-cleanup-doc
**Touched files:** none (documentation in this manifest only)
**Dependencies:** task-1, task-2
**AC coverage:** WI137-02, WI137-05
**What:** Document the post-merge migration path in this manifest's Validation Plan section so the user can verify AC-02 and AC-05 after merge (NOT in worktree — running setup against `~/.claude/skills/` from a worktree binds source-repo to ephemeral path).

**Migration path (post-merge, runs once per host):**
```bash
# After PR merge to main, on the user's machine:
./setup --host claude       # rm -rf wipes manual partial _shared; dir-symlink replaces
./setup --host codex
./setup --host opencode
./setup --host kimi
./setup --host gemini
bash test-framework/evals/tier-1/validate-shared-content-symlinks.sh   # all PASS
```

**Validation:** N/A in worktree. AC-02 and AC-05 are verified post-merge during `verify-promotion`.
**Checkpoint:** `task-5-done` — documented; deferred to verify-promotion.

---

### task-6 — verify-tier1-discovery (no-op confirmed, per F5 review)
**Touched files:** none (orchestrator confirmed during planning that `run-all-evals.sh` uses glob-based discovery: `for script in "$SCRIPT_DIR/tier-1"/*.sh; do …`. Both new validators created in tasks 2 and 4 are auto-discovered.)
**Dependencies:** task-2, task-4
**AC coverage:** WI137-03 (completion criterion)
**What:** Confirm the new validators are picked up by glob — no code edit needed.

**Validation:**
```bash
bash test-framework/evals/run-all-evals.sh --tier1 2>&1 | grep -E "validate-shared-content-symlinks|validate-shared-symlinks-meta-rule"
# Both names must appear in the run; aggregate exits 0
```
**Checkpoint:** `task-6-done` — both validators run as part of tier-1 aggregate.

---

## AC-to-Task Mapping

| AC | Task(s) | Notes |
|----|---------|-------|
| WI137-01 | task-1 | Setup populates `~/.claude/skills/_shared/` (post-merge — config edit makes it work) |
| WI137-02 | task-5 | Idempotency — verified post-merge by running setup twice |
| WI137-03 | task-2, task-6 | Validator exists, lint-clean, wired into tier-1 |
| WI137-04 | task-1 | All 5 hosts include `_shared` in `infra_dirs` (config edit) |
| WI137-05 | task-5 | Brownfield cleanup — post-merge verification |
| WI137-06 | task-2 | Validator iterates every detected host install (built into script logic) |
| WI137-07 | task-3 | Meta-rule in `lint-skills-manifest.mjs` |
| WI137-08 | task-4 | Negative-test fixture confirms meta-rule fails on synthetic missing dir |

**Coverage:** 8 / 8 ACs mapped. Zero unmapped.

---

## AC-to-Test Mapping

| AC | Test type | Where |
|----|-----------|-------|
| WI137-01 | Manual (post-merge) | `./setup --host claude && ls -la ~/.claude/skills/_shared/` |
| WI137-02 | Manual (post-merge) | Run setup twice; second run cleanly replaces partial state |
| WI137-03 | Unit (tier-1) | bash test-framework/evals/tier-1/validate-shared-content-symlinks.sh |
| WI137-04 | Manual (post-merge) | Run setup against each of 5 hosts; validator green |
| WI137-05 | Manual (post-merge) | Verify no leftover broken symlinks via `find ~/<host>/skills/_shared/ -xtype l` |
| WI137-06 | Unit | Validator's iteration logic — covered by task-2's test |
| WI137-07 | Unit (tier-1) | `node scripts/lint-skills-manifest.mjs` exits 0 with `_shared` in all manifests |
| WI137-08 | Unit (negative) | Fixture swap test in task-4 |

---

## External State

| # | Environment | What state | Coupling | Lifecycle wiring |
|---|-------------|------------|----------|------------------|
| 1 | Local filesystem — symlinks at `~/<host>/skills/_shared/` across 5 host install paths | Created/replaced when user runs `./setup --host <h>`; existing partial manual symlinks are wiped by setup's `[ -e "$dst" ] && rm -rf "$dst"` line | coupled | validate-shared-content-symlinks.sh (added in task-2) detects drift on every tier-1 run; `scripts/lint-skills-manifest.mjs` meta-rule (task-3) prevents the JSON config from drifting and silently breaking installs |
| 2 | Provision config files — host manifests under `provision/hosts/` | Mutated by task-1 (5 files) | coupled | Lint meta-rule (task-3) ties JSON state to SKILL.md `_shared/` references; CI fails if they drift apart |
| 3 | tier-1 eval registry | New validator registered | coupled | task-6 confirms registration; `run-all-evals.sh` invocation surfaces missing validator |

**Untouched environments (taxonomy walked, found nothing):** Cloud/SaaS deployments (no remote service), database (no DB writes), CDN/edge cache (no asset distribution), DNS/TLS (no host config), CI secrets/env vars (no credential changes), package registries (no publish), browser extension stores (N/A), mobile app stores (N/A), Slack/Discord/email integrations (N/A), GitHub repository settings (no branch protection/secrets/labels change), webhook endpoints (none), feature-flag service (none), monitoring/alert config (none), backup/snapshot store (none), license/compliance registries (none).

---

## Validation Plan

### Per-task validation
See each task's "Validation" block above.

### Final branch-level validation (run before `land-changeset`)
```bash
# 1. JSON parse + content check (task-1)
for h in claude codex opencode kimi gemini; do
  jq -e '.infra_dirs | index("_shared") != null' provision/hosts/${h}.json >/dev/null
done

# 2. Validator scripts syntax + lint (tasks 2 and 4)
for s in validate-shared-content-symlinks.sh validate-shared-symlinks-meta-rule.sh; do
  bash -n test-framework/evals/tier-1/$s
  shellcheck test-framework/evals/tier-1/$s
done

# 3. Lint with meta-rule (task-3)
node scripts/lint-skills-manifest.mjs

# 4. Negative-test (task-4) — runs as a tier-1 validator (operates entirely in tmpdir, never touches real provision/hosts/)
bash test-framework/evals/tier-1/validate-shared-symlinks-meta-rule.sh

# 5. Tier-1 aggregate (task-6 confirmation)
bash test-framework/evals/run-all-evals.sh --tier1
```

All five blocks must exit 0.

### Post-merge validation (verify-promotion phase, NOT worktree)
```bash
# On user's machine, after PR merges to main:
./setup --host claude
./setup --host codex
./setup --host opencode
./setup --host kimi
./setup --host gemini
bash test-framework/evals/tier-1/validate-shared-content-symlinks.sh   # green across all detected hosts
```

---

## Checkpoint Plan

Sequential order:
1. `task-1-done` — all 5 host JSONs include `_shared`
2. `task-2-done` — validator script created, syntax-clean
3. `task-3-done` — lint meta-rule added; lint passes after task-1
4. `task-4-done` — negative-test fixture created; negative test green
5. `task-5-done` — brownfield cleanup documented (no code; goes to verify-promotion)
6. `task-6-done` — validator wired into tier-1 aggregate run

**Rollback anchors:** Each task's checkpoint is its rollback anchor. Worktree commits are per-task; reverting any one task's commit restores the prior state without touching others.

---

## Promotion Readiness Checklist

- [ ] All planned files accounted for in task graph (10 files, 6 tasks — added shared-content-dirs.json registry and validate-shared-symlinks-meta-rule.sh validator per review responses)
- [ ] All tasks have a validation command
- [ ] All 8 ACs mapped to ≥1 task each
- [ ] All 6 checkpoints named in order
- [ ] Final branch diff contains only manifest-listed files (no incidental edits)
- [ ] No banned scope-reduction phrases — manually verified
- [ ] Tier-1 aggregate green
- [ ] Negative-test green
- [ ] External State section walked taxonomy + identified 3 coupled environments

---

## Simulation Report

| Task | Check | Result | Action |
|------|-------|--------|--------|
| task-1 | `provision/hosts/claude.json` exists + has `infra_dirs` array | PASS — verified inline (`["scripts","references","proposals","examples","hooks","provision","templates"]`) | — |
| task-1 | Same for codex/opencode/kimi/gemini host manifests | PASS — assumed structurally identical (audit confirmed). Execute-changeset must verify per-file. | — |
| task-2 | `test-framework/evals/tier-1/` directory exists | PASS — `ls test-framework/evals/tier-1/` contains existing validators | CREATE-shaped task |
| task-2 | `_shared/` directory has files to enumerate | PASS — 3 files: before-starting.md, constraint-profiles.md, product-question-format.md | — |
| task-3 | `scripts/lint-skills-manifest.mjs` exists and is editable Node ESM | PASS — referenced in CLAUDE.md as the canonical linter | — |
| task-4 | `test-framework/fixtures/` directory exists | UNKNOWN — execute-changeset must check; create if missing | Add `mkdir -p` to task-4 prereqs |
| task-6 | `test-framework/evals/run-all-evals.sh` exists | PASS — referenced in CLAUDE.md tier-1 commands | — |
| task-6 | Discovery mechanism (glob vs registry) — unknown without reading file | UNKNOWN | Execute-changeset Step 1 of task-6: read run-all-evals.sh first |

### Scenario Coverage

This is a framework bugfix; no Gherkin journey scenarios exist. Coverage is via AC mapping above (8/8).

---

## Adversarial Plan Review (self-check, inline)

1. **Missing tasks:** All 8 ACs mapped. WI137-02 and WI137-05 are post-merge by nature (require live `./setup` runs); explicitly handled by task-5 and verify-promotion. ✓
2. **Dependency correctness:** task-1 and task-2 are independent (parallelizable). task-3 needs task-1 (lint must pass on the fixed manifests). task-4 needs task-3 (negative test exercises the new meta-rule). task-5 needs task-1 + task-2 (post-merge verification depends on both). task-6 needs task-2 (wires what task-2 created). DAG valid. ✓
3. **Scope reduction:** No banned phrases. Coverage 8/8 ACs. No phase split. ✓
4. **Validation strength:** Each validation actually exercises the change — `jq -e index("_shared") != null` confirms the literal addition; `shellcheck` confirms validator quality; lint exit-code confirms meta-rule fires; negative-test fixture explicitly validates the meta-rule's negative path. ✓
5. **First-task viability:** task-1 is 5 trivial JSON edits; doable from clean worktree given only the spec and this manifest. ✓
6. **Pattern-family completeness:** No grep/regex ACs (the meta-rule itself uses regex internally, but its AC is "lint exits non-zero on synthetic violation" — covered by the negative test). ✓
7. **Visual-rendering AC tier:** No UI ACs. ✓

All 7 checks pass. Manifest moves DRAFTED → SIMULATED.

---

## Loop-Back Anchors

- Spec ambiguity → `write-spec` (e.g., if execute-changeset finds an undeclared shared-content dir besides `_shared/` and the meta-rule's exception logic needs respec)
- Technical infeasibility → `design-tech` (e.g., if a host manifest schema turns out to need additional fields beyond `infra_dirs` to support `_shared`)

---

## Status

**DRAFTED → SIMULATED** (per adversarial review pass above).

**Next:** `review-plan` for primary adversarial review, then `execute-changeset`.
