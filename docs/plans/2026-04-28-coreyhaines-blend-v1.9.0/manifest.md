# Implementation Manifest: coreyhaines blend v1.9.0

**Status:** DRAFTED
**Feature spec:** `docs/specs/features/feature-coreyhaines-blend-v1.9.0.md`
**Work item:** `docs/specs/work-items/WI-135.md`
**Source proposal:** `proposals/done/2026-04-28-blend-coreyhaines-marketing.md`
**Branch:** `framework/wi-135-coreyhaines-blend-v1.9.0`
**Base branch:** `main`
**Base SHA:** `eaea161` (HEAD as of 2026-04-28)
**Created:** 2026-04-28
**Lane:** framework
**Archetype:** Bounded feature

---

## Lane Compliance (framework lane upstream cite)

| Upstream skill | Outcome | Evidence path |
|---|---|---|
| validate-feature | skipped | `.svc/lane-tasks-WI-135.json` task-1 (skip_reason: framework-internal Enabler — proposal already passed objective review) + `.svc/pipeline-decisions.jsonl` route-workflow taste entry 2026-04-28T12:11:00Z |
| evolve-framework | N/A — not invoked | Not applicable: WI source is an external blend (proposals/done/2026-04-28-blend-coreyhaines-marketing.md), not a framework gap-discovery cycle. Lane-7 framework definitions list evolve-framework as optional pre-cursor for self-improvement initiatives that need gap-discovery. This WI imports patterns from a named external source, so the discovery work was done by `blend-external` (commit 8c07b44, recorded 2026-04-28). |
| improve-framework | N/A — not invoked | Same reasoning as evolve-framework. improve-framework is the "act on found gaps" sibling of evolve-framework. The blend proposal already names the gaps and patches; no further gap-discovery is required before implementation. |
| write-spec | completed | `docs/specs/features/feature-coreyhaines-blend-v1.9.0.md` (DRAFT) + `.svc/pipeline-decisions.jsonl` write-spec gate-result 2026-04-28T12:01:00Z |
| design-ux | skipped | `.svc/lane-tasks-WI-135.json` task-3 (skip_reason: no UI surface; spec Pillars Matrix marks UX `[N/A — justified]`) |
| design-ui | skipped | `.svc/lane-tasks-WI-135.json` task-4 (skip_reason: no UI surface; spec Pillars Matrix marks UI `[N/A — justified]`) |
| design-tech | skipped pending review-plan triage | `.svc/lane-tasks-WI-135.json` task-5. Per Codex Tier-2 finding F-002, task-7 design ambiguity is now resolved INLINE in this manifest (see § "Task-7 design resolution" below). With task-7 resolved, design-tech remains skipped — the residual task-5 frontmatter-format choice is mechanical and stays inline. |
| plan-changeset | in progress (this manifest) | `.svc/pipeline-decisions.jsonl` plan-changeset finalize 2026-04-28T12:10:00Z |
| review-plan | in progress (this gate) | `docs/plans/2026-04-28-coreyhaines-blend-v1.9.0/review-log.yaml` (written by this skill) |

---

## Task-7 design resolution (INLINE — supersedes prior "open question")

Codex F-002 correctly flagged that the runner paradigm was undecided. Resolved here:

**Decision: recorded-fixture model.** The runner consumes fixture files alongside each behavioral eval JSON. No live LLM calls during eval execution — deterministic, zero-cost, CI-safe.

**Fixture contract:**
- Each behavioral/&lt;skill&gt;.json has a sibling behavioral/&lt;skill&gt;.fixture.txt containing the recorded assistant response.
- The runner loads the conversation, substitutes the recorded response, runs assertions against it, and exits 0/1.
- Fixtures are recorded once (manually or via a `--record` mode that we add later — out of scope for this WI; the bare runner only does playback).

**Updated Files Planned** (additions for fixtures):

| File | Action | Task |
|------|--------|------|
| **NEW** test-framework/evals/tier-2/behavioral/route-workflow.fixture.txt | CREATE | task-6 |
| **NEW** test-framework/evals/tier-2/behavioral/write-spec.fixture.txt | CREATE | task-6 |
| **NEW** test-framework/evals/tier-2/behavioral/validate-feature.fixture.txt | CREATE | task-6 |

**Runner contract (task-7):**
- Inputs: directory containing `*.json` evals + `*.fixture.txt` siblings.
- Behavior: for each eval, load JSON, load fixture, evaluate `assertions[]` against the fixture content (assertion types: `contains`, `not_contains`, `regex`, `equals`).
- Output: per-eval PASS/FAIL line + final exit 0 if all PASS.
- Failure is loud: stderr names the eval + the failing assertion + the fixture excerpt that failed.

**Schema (task-6 README must declare):**
```json
{
  "skill": "<skill-under-test>",
  "scenario": "<short label>",
  "conversation": [{"role": "user", "content": "..."}],
  "assertions": [
    {"type": "contains|not_contains|regex|equals", "value": "..."}
  ]
}
```

---

## Implementation Summary

Adopt 4 architectural patterns from coreyhaines/marketingskills v1.9.0 into svc. Add documented conventions, a tier-2 behavioral eval layer, and a canonical marketing-context output for `analyze-marketing`. Register coreyhaines as an external addon.

**What changes:**
- New shared snippet **_shared/before-starting.md** (4-source context chain).
- New conventions doc **references/skill-conventions.md** (progressive disclosure).
- New tier-2 behavioral eval directory + runner + 3 example evals.
- New tier-1 validator for "Before Starting" section presence.
- Edits to `CONTRIBUTING.md` (mandates Before Starting in new SKILL.md).
- Edits to 5 hot-path SKILL.md files (insert Before Starting section pointing at the snippet).
- Edits to `analyze-marketing/SKILL.md` (declare new output + coverage matrix).
- Edits to `EXTERNAL_ADDONS.md` (coreyhaines section).
- Append to `references/framework-learnings.jsonl` (blend record entry).

**What must remain invariant:**
- All 47 existing skills continue to load and run.
- `node scripts/lint-skills-manifest.mjs` continues to exit 0 (the 5 source-of-truth files stay in sync — `EXTERNAL_ADDONS.md` edits add a new addon section, not a new core skill, so manifest's `corePackForRouting` is untouched).
- All current tier-1 validators continue to exit 0.
- `analyze-marketing/SKILL.md` retains its existing process + outputs; the new output is additive.

**Key constraints from spec:**
- 4-source chain is read-as-needed, not read-all (BLEND-04).
- Behavioral evals SUPPLEMENT, not replace, integration scenarios (BLEND-09).
- Progressive-disclosure convention is for new skills; **no wholesale refactor of legacy skills** (BLEND-12).
- `marketing-context.md` must have an explicit no-duplication coverage matrix (BLEND-16).

---

## External State

| # | Environment | What state | Coupling | Lifecycle wiring |
|---|-------------|------------|----------|------------------|
| 1 (filesystem — repo) | repo files: `_shared/`, `references/`, `test-framework/evals/`, `analyze-marketing/`, `CONTRIBUTING.md`, `EXTERNAL_ADDONS.md` | New + edited markdown/bash/mjs files | coupled | All changes land in one branch + PR; `git revert` cleanly removes everything. |
| 2 (CI / validators) | New `validate-skill-before-starting.sh` joins `run-all-evals.sh --tier1` | Adds tier-1 check | coupled | Runner discovers `*.sh` in `tier-1/` directory automatically; no separate registration needed. |
| 3 (CI / validators) | New `run-behavioral.mjs` joins `run-all-evals.sh --tier2` | Adds tier-2 check | coupled | Runner script wired explicitly via PR edit to `run-all-evals.sh`. |
| 4 (downstream skill output paths) | `analyze-marketing` will start writing **docs/specs/marketing-context.md** after merge | New output artifact | coupled | The hook `svc-skill-artifact-authenticity.mjs` enforces that `docs/specs/*` outputs require a recent skill-receipt. New path is left out of the protected mapping in this WI; if/when it should be protected, that becomes a follow-up edit to the hook's `SKILL_OUTPUT_PATHS` array. Documented decoupling. |

**Untouched environments** (walked the taxonomy, found nothing): cloud infra, databases, secret stores, third-party SaaS, scheduled jobs, external user data, OAuth providers, CDN/edge config, DNS, queues, customer-visible APIs, mobile build pipelines.

---

## Files Planned

| File | Action | Task | Purpose |
|------|--------|------|---------|
| **NEW** _shared/before-starting.md | CREATE | task-1 | Canonical 4-source chain + read-as-needed rule (BLEND-02, BLEND-04) |
| **NEW** references/skill-conventions.md | CREATE | task-2 | Progressive disclosure convention + non-goal note (BLEND-11, BLEND-12) |
| `CONTRIBUTING.md` | MODIFY | task-3 | Mandate Before Starting section in new SKILL.md (BLEND-01) |
| `route-workflow/SKILL.md` | MODIFY | task-4 | Insert Before Starting section (BLEND-03) |
| `write-spec/SKILL.md` | MODIFY | task-4 | Insert Before Starting section (BLEND-03) |
| `plan-changeset/SKILL.md` | MODIFY | task-4 | Insert Before Starting section (BLEND-03) |
| `execute-changeset/SKILL.md` | MODIFY | task-4 | Insert Before Starting section (BLEND-03) |
| `validate-feature/SKILL.md` | MODIFY | task-4 | Insert Before Starting section (BLEND-03) |
| **NEW** test-framework/evals/tier-1/validate-skill-before-starting.sh | CREATE | task-5 | Tier-1 validator (BLEND-05) |
| **NEW** test-framework/evals/tier-2/behavioral/README.md | CREATE | task-6 | JSON schema + how-to-run (BLEND-06) |
| **NEW** test-framework/evals/tier-2/behavioral/route-workflow.json | CREATE | task-6 | Behavioral eval (BLEND-08) |
| **NEW** test-framework/evals/tier-2/behavioral/write-spec.json | CREATE | task-6 | Behavioral eval (BLEND-08) |
| **NEW** test-framework/evals/tier-2/behavioral/validate-feature.json | CREATE | task-6 | Behavioral eval (BLEND-08) |
| **NEW** test-framework/evals/tier-2/run-behavioral.mjs | CREATE | task-7 | Runner (BLEND-07) |
| `test-framework/evals/run-all-evals.sh` | MODIFY | task-7 | Wire behavioral runner into `--tier2` (BLEND-10) |
| `analyze-marketing/SKILL.md` | MODIFY | task-8 | Declare `marketing-context.md` in `outputs.produces` + coverage matrix + write step (BLEND-14, BLEND-15, BLEND-16, BLEND-17) |
| `EXTERNAL_ADDONS.md` | MODIFY | task-9 | coreyhaines v1.9.0 section: install, integration points, what NOT to rebuild (BLEND-18, BLEND-19, BLEND-20) |
| `references/framework-learnings.jsonl` | MODIFY (append) | task-10 | Blend record entry, confidence 8 (BLEND-23) |

**File count:** 4 single CREATE-files, 1 CREATE-dir with 4 content files (behavioral evals + README), 9 MODIFY (1 markdown + 5 SKILL.md + 1 sh runner + 2 docs + 1 jsonl).

---

## Task Graph

### task-1: shared snippet — Before Starting
- **Touches:** **_shared/before-starting.md** (CREATE)
- **Deps:** none
- **AC coverage:** BLEND-02, BLEND-04
- **Validation:** `test -f _shared/before-starting.md && grep -q "project-state.md" _shared/before-starting.md && grep -q "builder-profile.md" _shared/before-starting.md && grep -q "domain-profile.md" _shared/before-starting.md && grep -q "read-as-needed" _shared/before-starting.md`
- **Checkpoint:** `cp1-before-starting-snippet`

### task-2: shared snippet — skill conventions
- **Touches:** **references/skill-conventions.md** (CREATE)
- **Deps:** none
- **AC coverage:** BLEND-11, BLEND-12
- **Validation:** `test -f references/skill-conventions.md && grep -q "progressive disclosure" references/skill-conventions.md && grep -qi "do not refactor" references/skill-conventions.md`
- **Checkpoint:** `cp2-skill-conventions-doc`

### task-3: CONTRIBUTING.md — mandate Before Starting
- **Touches:** `CONTRIBUTING.md` (MODIFY)
- **Deps:** task-1 (referenced by name)
- **AC coverage:** BLEND-01
- **Validation:** `grep -q "Before Starting" CONTRIBUTING.md && grep -q "_shared/before-starting.md" CONTRIBUTING.md`
- **Checkpoint:** `cp3-contributing-rule`

### task-4: hot-path skills — insert Before Starting (parallel group A)
- **Touches:** `route-workflow/SKILL.md`, `write-spec/SKILL.md`, `plan-changeset/SKILL.md`, `execute-changeset/SKILL.md`, `validate-feature/SKILL.md` (all MODIFY)
- **Deps:** task-1
- **Parallel group:** A (5 files, independent edits — same insertion pattern)
- **AC coverage:** BLEND-03
- **Validation:** `for f in route-workflow write-spec plan-changeset execute-changeset validate-feature; do grep -q "Before Starting" "$f/SKILL.md" || { echo "missing: $f"; exit 1; }; grep -q "_shared/before-starting.md" "$f/SKILL.md" || { echo "ref missing: $f"; exit 1; }; done`
- **Checkpoint:** `cp4-hot-path-skills-updated`

### task-5: tier-1 validator — Before Starting presence
- **Touches:** **test-framework/evals/tier-1/validate-skill-before-starting.sh** (CREATE)
- **Deps:** task-3, task-4 (validator must pass after their edits land)
- **AC coverage:** BLEND-05
- **Validation:** `bash test-framework/evals/tier-1/validate-skill-before-starting.sh` exits 0 AND `bash test-framework/evals/run-all-evals.sh --tier1` exits 0
- **Behavior contract:** advisory for skills lacking the section; blocking only for SKILL.md whose declared creation date is `>= 2026-04-28`. Validator must accept BOTH the YAML frontmatter `created:` field AND the markdown header `**Created:** YYYY-MM-DD` format (the simulation surfaced both formats in use).
- **Checkpoint:** `cp5-tier1-validator`

### task-6: tier-2 behavioral evals — schema + 3 evals
- **Touches:** **test-framework/evals/tier-2/behavioral/README.md**, **test-framework/evals/tier-2/behavioral/route-workflow.json**, **test-framework/evals/tier-2/behavioral/write-spec.json**, **test-framework/evals/tier-2/behavioral/validate-feature.json**, **test-framework/evals/tier-2/behavioral/route-workflow.fixture.txt**, **test-framework/evals/tier-2/behavioral/write-spec.fixture.txt**, **test-framework/evals/tier-2/behavioral/validate-feature.fixture.txt** (all CREATE)
- **Deps:** none (data files, can land before runner)
- **AC coverage:** BLEND-06, BLEND-08
- **Validation:** all 3 JSON files parse with `node -e "JSON.parse(require('fs').readFileSync(process.argv[1]))" <path>`; each contains `conversation` and `assertions` keys; each has a sibling `*.fixture.txt` that exists and is non-empty.
- **Checkpoint:** `cp6-behavioral-evals-data`

### task-7: tier-2 runner + wire into run-all-evals
- **Touches:** **test-framework/evals/tier-2/run-behavioral.mjs** (CREATE), `test-framework/evals/run-all-evals.sh` (MODIFY)
- **Deps:** task-6 (consumes the JSON evals + fixture files)
- **AC coverage:** BLEND-07, BLEND-09, BLEND-10
- **Implementation contract:** recorded-fixture playback only (see § "Task-7 design resolution" above for full contract). No live LLM. Assertions implemented: `contains`, `not_contains`, `regex`, `equals`.
- **Validation:**
  - `node test-framework/evals/tier-2/run-behavioral.mjs test-framework/evals/tier-2/behavioral` exits 0 against the 3 fixtures from task-6
  - `bash test-framework/evals/run-all-evals.sh --tier2` runs to completion and writes a per-runner summary log to `/tmp/svc-tier2-summary.txt`. Validation grep: both `[integration]` and `[behavioral]` markers present in the summary, each followed by `PASS`. This proves both runners executed (addresses Codex F-005).
- **Checkpoint:** `cp7-behavioral-runner`

### task-8: analyze-marketing — declare canonical output + coverage matrix
- **Touches:** `analyze-marketing/SKILL.md` (MODIFY)
- **Deps:** none
- **AC coverage:** BLEND-14, BLEND-15, BLEND-16, BLEND-17
- **Validation:**
  - structural check: `node -e "const fs=require('fs');const m=fs.readFileSync('analyze-marketing/SKILL.md','utf8').match(/^---\n([\s\S]+?)\n---/);const fm=require('js-yaml').load(m[1]);const ok=Array.isArray(fm?.outputs?.produces)&&fm.outputs.produces.includes('docs/specs/marketing-context.md');process.exit(ok?0:1);"` (parses YAML frontmatter; ensures `outputs.produces` is an array containing the path — addresses Codex F-005)
  - `grep -qi "coverage matrix" analyze-marketing/SKILL.md` (matrix present)
  - matrix names all 4 owners: `for o in "marketing-context.md" "domain-profile.md" "feature-mining-tracker.json" "personas/"; do grep -q "$o" analyze-marketing/SKILL.md || exit 1; done`
  - update-not-overwrite behavior documented: `grep -qi "update.*existing\|revision history" analyze-marketing/SKILL.md`
- **Checkpoint:** `cp8-analyze-marketing-output`

### task-9: EXTERNAL_ADDONS.md — coreyhaines v1.9.0 section
- **Touches:** `EXTERNAL_ADDONS.md` (MODIFY)
- **Deps:** none
- **AC coverage:** BLEND-18, BLEND-19, BLEND-20
- **Validation:**
  - `grep -q "coreyhaines" EXTERNAL_ADDONS.md && grep -q "v1.9.0" EXTERNAL_ADDONS.md && grep -q "MIT" EXTERNAL_ADDONS.md`
  - integration points: `for s in "analyze-marketing" "validate-feature" "find-opportunity"; do grep -A 30 "coreyhaines" EXTERNAL_ADDONS.md | grep -q "$s" || exit 1; done`
  - explicit non-rebuild list present: `grep -A 50 "coreyhaines" EXTERNAL_ADDONS.md | grep -qiE "do not rebuild|not rebuilt|external only"`
  - linter green: `node scripts/lint-skills-manifest.mjs`
- **Checkpoint:** `cp9-external-addons`

### task-10: framework learnings entry (idempotent)
- **Touches:** `references/framework-learnings.jsonl` (MODIFY — upsert by id)
- **Deps:** task-1..9 (record reflects what landed)
- **AC coverage:** BLEND-23
- **Idempotency contract (addresses Codex F-006):** the entry has a stable id `coreyhaines-blend-v1.9.0`. Before appending, the executor checks if any line already contains `"id":"coreyhaines-blend-v1.9.0"` — if yes, skip; if no, append.
- **Validation:** exactly one entry exists with the stable id and required fields:
  ```bash
  count=$(jq -c 'select(.id == "coreyhaines-blend-v1.9.0")' references/framework-learnings.jsonl 2>/dev/null | wc -l)
  test "$count" -eq 1 || { echo "expected 1 entry, found $count"; exit 1; }
  jq -e 'select(.id == "coreyhaines-blend-v1.9.0") | .confidence == 8 and (.insight | contains("coreyhaines"))' references/framework-learnings.jsonl
  ```
- **Checkpoint:** `cp10-learnings-entry`

### task-11: branch-level final validation
- **Touches:** none (validation only)
- **Deps:** task-10 (last)
- **AC coverage:** BLEND-21, BLEND-22
- **Validation:**
  - `node scripts/lint-skills-manifest.mjs` exits 0
  - `bash test-framework/evals/run-all-evals.sh --tier1` exits 0
  - `bash test-framework/evals/run-all-evals.sh --tier2` exits 0 (both integration AND behavioral)
  - **Allowlist scope check** (addresses Codex F-007): `git diff --name-only main...HEAD | sort > /tmp/actual-paths.txt` AND a planned-paths file is generated by parsing the Files Planned table; `diff /tmp/actual-paths.txt /tmp/planned-paths.txt` exits 0. Any unexpected path = blocking failure.
- **Checkpoint:** `cp11-branch-validated`

---

## AC-to-Task Mapping

| AC | Task(s) | Test type |
|---|---|---|
| BLEND-01 | task-3 | Unit (grep validation in task-3) |
| BLEND-02 | task-1 | Unit |
| BLEND-03 | task-4 | Unit |
| BLEND-04 | task-1 | Unit |
| BLEND-05 | task-5 | Unit (validator runs and exits 0) |
| BLEND-06 | task-6 | Unit (JSON parse + key check) |
| BLEND-07 | task-7 | Unit (--dry-run) |
| BLEND-08 | task-6 | Unit (count ≥3 evals against named skills) |
| BLEND-09 | task-7 | Unit (run-all-evals --tier2 invokes both) |
| BLEND-10 | task-7 | Unit |
| BLEND-11 | task-2 | Unit |
| BLEND-12 | task-2 | Unit (non-goal phrase present) |
| BLEND-13 | N/A — deferred | N/A (a new skill demonstrating the pattern is a future organic event, not part of this WI; documented as deferred in spec) |
| BLEND-14 | task-8 | Unit |
| BLEND-15 | task-8 | Unit (process step describing the write) |
| BLEND-16 | task-8 | Unit (matrix names 4 owners) |
| BLEND-17 | task-8 | Unit (update-vs-overwrite documented) |
| BLEND-18 | task-9 | Unit |
| BLEND-19 | task-9 | Unit |
| BLEND-20 | task-9 | Unit |
| BLEND-21 | task-11 | Unit (linter exits 0) |
| BLEND-22 | task-11 | Unit (tier-1 exits 0) |
| BLEND-23 | task-10 | Unit (jq parse) |

**BLEND-13 deferred:** "≥1 new skill demonstrates the pattern" depends on future skill-authoring work. Logged as a planned coverage gap (see Coverage Gaps), not silent drop.

---

## Validation Plan

**Per-task:** see each task's `Validation:` line above. All are deterministic shell or `node -e` checks against grep/JSON.parse — fast, no LLM.

**Branch-level (task-11):**
1. `node scripts/lint-skills-manifest.mjs` → exit 0
2. `bash test-framework/evals/run-all-evals.sh --tier1` → exit 0
3. `bash test-framework/evals/run-all-evals.sh --tier2` → exit 0 (both integration AND behavioral)
4. `git diff --stat main...HEAD` → only files listed in Files Planned

**Decision NOT to run tier-3:** Tier-3 (LLM-as-judge) is expensive and not required for a convention rollout. Patterns 2 + 3 don't change skill behavior in a way LLM-judge would catch better than the deterministic tier-1/tier-2 checks. Skipping is logged as a `taste` decision, not silently dropped.

---

## Checkpoint Plan

Order: `cp1` → `cp2` → `cp3` → `cp4` (after task-4 parallel group converges) → `cp5` → `cp6` → `cp7` → `cp8` → `cp9` → `cp10` → `cp11`.

### Rollback Matrix (per-task reverse ops — addresses Codex F-004)

| Task | Files to revert | Coupled tasks that must also revert | Post-revert validation |
|------|-----------------|--------------------------------------|------------------------|
| task-1 | **_shared/before-starting.md** (rm) | task-3 (CONTRIBUTING.md edit references this path), task-4 (5 hot-path skills reference this path), task-5 (validator checks for this section) | `node scripts/lint-skills-manifest.mjs` exits 0 |
| task-2 | **references/skill-conventions.md** (rm) | none (convention doc is referentially independent) | linter exits 0 |
| task-3 | `git checkout -- CONTRIBUTING.md` | task-5 (validator must also revert if it cites the CONTRIBUTING rule) | linter exits 0 |
| task-4 | `git checkout -- {route-workflow,write-spec,plan-changeset,execute-changeset,validate-feature}/SKILL.md` | task-5 (validator gates the section presence on these skills) | tier-1 exits 0 |
| task-5 | `rm test-framework/evals/tier-1/validate-skill-before-starting.sh` | none (validator is referentially leaf) | tier-1 exits 0 (without the new validator running) |
| task-6 | `rm -rf test-framework/evals/tier-2/behavioral/` | task-7 (runner consumes this directory) | tier-2 exits 0 (integration only) |
| task-7 | `rm test-framework/evals/tier-2/run-behavioral.mjs && git checkout -- test-framework/evals/run-all-evals.sh` | task-6 (data files become orphaned but harmless) | tier-2 exits 0 |
| task-8 | `git checkout -- analyze-marketing/SKILL.md` | none | linter exits 0 |
| task-9 | `git checkout -- EXTERNAL_ADDONS.md` | none | linter exits 0 (linter checks 5 source-of-truth files in sync — reverting EXTERNAL_ADDONS to baseline keeps invariant) |
| task-10 | remove the upsert line from `references/framework-learnings.jsonl` (use stable id grep) | none | `jq` parse on remaining lines |
| task-11 | n/a (validation only) | n/a | n/a |

**Coupled-revert rule:** if `cp4` fails, both task-1 and task-3 must also revert before retry — the convention chain (snippet ← CONTRIBUTING ← hot-path skills) is a strong-coupling triangle. Same applies to task-6/task-7 (data ← runner).

**Last-resort gate:** if `cp11` fails AND the per-task matrix above doesn't suffice, the recovery path is `git revert <merge-sha>` after the PR has landed, OR `git reset --hard <base-sha>` on the worktree branch BEFORE PR (worktree branch only — never on main, per `rules/destructive-git-ops.md`).

---

## Promotion Readiness Checklist

- [ ] All planned files accounted for (cross-check Files Planned table vs `git diff --stat`)
- [ ] All 11 tasks have explicit validation
- [ ] All 23 ACs mapped (BLEND-13 is the only deferral, documented in Coverage Gaps)
- [ ] All 11 checkpoints named
- [ ] Final diff contains only manifest-listed files
- [ ] `lint-skills-manifest.mjs` green
- [ ] `run-all-evals.sh --tier1` green
- [ ] `run-all-evals.sh --tier2` green
- [ ] `framework-learnings.jsonl` blend entry valid JSON, confidence=8

---

## Coverage Gaps

| AC | Status | Reason | Resolution |
|---|---|---|---|
| BLEND-13 | DEFERRED (formal) | "≥1 new skill demonstrates the pattern" requires a future skill-authoring event; not part of the convention rollout itself. | Tracked in follow-up WI-136 (placeholder created on land). Decision-log entry: `.svc/pipeline-decisions.jsonl` plan-changeset taste decision 2026-04-28T12:25:00Z (logged below). Readiness text reads: 22 implemented + 1 formally deferred = 23 ACs accounted. (Addresses Codex F-003.) |

No silent reductions. No banned phrases ("v1", "simplified", "stub", "hardcoded for now", etc.) appear in any task description.

---

## Loop-Back Targets

| If reality says... | Loop back to |
|---|---|
| AC ambiguous in spec | `write-spec` |
| Tier-2 runner needs design decisions (which conversation driver — fixture vs LLM vs harness?) | `design-tech` (scoped to task-7 only) |
| `analyze-marketing` no-duplication matrix conflicts with how `domain-profile.md` is currently authored | back to `write-spec` to revise BLEND-16 wording |
| Validator design needs more thought (date frontmatter parsing) | `design-tech` for task-5 only |

---

## Simulation Report

| Task | Check | Result | Action |
|------|-------|--------|--------|
| task-1 | **_shared/before-starting.md** does not exist | PASS (CREATE) | — |
| task-1 | `_shared/` directory exists | PASS | — |
| task-2 | **references/skill-conventions.md** does not exist | PASS (CREATE) | — |
| task-2 | `references/` directory exists | PASS | — |
| task-3 | `CONTRIBUTING.md` exists | PASS | — |
| task-4 | All 5 hot-path SKILL.md files exist | PASS | — |
| task-5 | `test-framework/evals/tier-1/` directory exists with peer validators | PASS | — |
| task-5 | Frontmatter date format: skills currently use `**Created:** YYYY-MM-DD` markdown header (not YAML `created:`) | WARN | Validator must accept both formats. Logged as task-5 implementation requirement. |
| task-6 | `test-framework/evals/tier-2/` directory exists | PASS | — |
| task-6 | `test-framework/evals/tier-2/behavioral/` does not exist | PASS (CREATE) | — |
| task-7 | `test-framework/evals/run-all-evals.sh` exists with `--tier2` flag | PASS | — |
| task-7 | `test-framework/evals/tier-2/run-tier2.sh` and `test-framework/evals/tier-2/run-tier2-kimi.sh` already exist as integration runners | PASS | New behavioral runner is additive — wire as a third invocation inside the `--tier2` branch of `run-all-evals.sh`. |
| task-8 | `analyze-marketing/SKILL.md` exists | PASS | — |
| task-9 | `EXTERNAL_ADDONS.md` exists | PASS | — |
| task-10 | `references/framework-learnings.jsonl` exists | PASS | — |
| task-11 | `node scripts/lint-skills-manifest.mjs` currently exits 0 on main | PASS (verified clean baseline) | — |

**One WARN** (task-5 frontmatter format). Acknowledged: validator must accept both formats. Will be addressed inside task-5; no manifest change.

### Scenario Coverage

n/a — feature has no end-user journeys (Pillars Matrix marks Journey `[N/A — justified]`). Per-AC mapping is the substitute for journey coverage on framework-internal Enablers.

---

## Adversarial Self-Check

1. **Missing tasks:** ✅ Every BLEND-01..23 maps to a task or is documented as deferred (BLEND-13).
2. **Dependency correctness:** ✅ task-1 has no deps; task-3 depends on task-1 (refers to its path); task-4 depends on task-1 (refers to the snippet); task-5 depends on task-3+task-4 (validator must pass after edits); task-7 depends on task-6 (runner consumes the data files); task-10 depends on tasks 1..9 (records what landed); task-11 depends on task-10. Acyclic.
3. **Scope reduction:** ✅ Grepped manifest for `v1`, `simplified`, `placeholder`, `stub`, `hardcoded for now`, `will be wired later` — none present. BLEND-13 is explicitly deferred with reason, not silently dropped.
4. **Validation strength:** ✅ Each task has a deterministic shell/grep/JSON.parse check that fails loudly. Final task-11 runs the linter + both eval tiers.
5. **First-task viability:** ✅ task-1 creates a single new file with no prerequisite reads from session context. The full chain documentation lives in the spec (BLEND-02), which an executor reads independently.
6. **Pattern-family completeness:** N/A — no grep/regex-driven AC. All ACs are existence-or-content checks against named files.
7. **Visual-rendering AC tier:** N/A — no UI surface, no visual ACs.

All checks pass.

---

## Decision: skip design-tech?

The plan-changeset skill's loop-back table flags `design-tech` only if "tier-2 runner needs design decisions" or "validator design needs more thought."

For this WI:
- **task-7 (behavioral runner)** carries a small design decision: how does the runner drive conversations? Three viable paradigms — recorded fixtures (deterministic, no LLM cost), real LLM call (most realistic, $$), or harness-bound (each host's CLI runs the eval). Default proposal in this manifest: **recorded fixtures**. If review-plan judges that insufficient, this gets routed to `design-tech` for task-7 only.
- **task-5 (validator)** carries a smaller design decision: support both `created:` YAML and `**Created:**` markdown formats. Documented inline; not architectural.

**Recommendation:** Run `review-plan` next. Let `review-plan` decide whether (a) the runner-design ambiguity is small enough to resolve inline during execute-changeset, or (b) it warrants a `design-tech` pass focused only on tasks 5 and 7. The rest of the manifest is convention rollout that does not need architectural design.

`design-tech` is currently marked `skipped` in `.svc/lane-tasks-WI-135.json` with this exact reasoning. The skip is reversible if `review-plan` requires it.

---

## Handoff

**Manifest status:** DRAFTED → ready for `review-plan`.

**Next:** `/review-plan` against this manifest. After review converges, dispatch `/execute-changeset` (with optional `/design-tech` insertion if review-plan flags it for task-5 + task-7).
