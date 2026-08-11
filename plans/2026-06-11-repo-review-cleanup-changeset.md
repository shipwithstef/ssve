# Repo Review Cleanup — Full Changeset Plan

**Date:** 2026-06-11
**Source:** Full repo review — logical issues + product improvements + deep functional audit
**Scope:** Repository hygiene, structural cleanup, product signal tightening, functional hardening
**Reviewed:** 2026-06-11 — v2 review caught 8 issues; v3 deep audit found 17 more functional issues
**Re-reviewed:** 2026-06-13 (Claude) — verified against live repo + linter; see Reviewer Corrections below.
**Re-reviewed:** 2026-06-14 (Claude, v8) — baseline now GREEN (corruption restored + base44 rule registered; full tier-1 223/0); WI-CLN-0/D0 RESOLVED; all other Exact-Change items re-verified still-pending. **Steps not yet executed — needs the D1–D4 defaults confirmed + greenlight to run the WIs.**

---

## Reviewer Corrections (2026-06-13, Claude) — BLOCKING, read before executing

Verified every claim against the working tree, `scripts/lint-skills-manifest.mjs`, and the tier-1 validators.

### 🔴 Will fail or break the framework as written
- **1.1 `git mv` aborts on untracked files.** Only `scrape.py`, `gen_gstack_prescope.js`, `urls.txt` are tracked. `scrape_eic.py`, `check_external.py`, `format_markdown.py`, `btrust_scraped.md`, `scraped_eic.json` are **untracked** → use plain `mv`. *(Fixed inline below.)*
- **1.2 / 1.3 false premise.** `package-lock.json` is **not tracked** (`git ls-files` empty) — it is correctly gitignored. `git rm package-lock.json` fails, and removing the `.gitignore` entry (1.3) is backwards. **Delete the package-lock parts of 1.2 and all of 1.3.** (Deleting tracked `package.json` is fine.)
- **2.6 breaks the linter.** `lint-skills-manifest.mjs:73-89` errors on any top-level dir with `SKILL.md` not in `includedSkills` (skip-list is only `.git/.worktrees/node_modules/test-framework/FRAMEWORK-STATE-ARCHIVE`). Removing `wsl2-audio`/`suno-architect` from `includedSkills` while the dirs remain = 2 lint failures. "Verified safe" is wrong — you must physically move the directories out of repo root to externalize them.
- **All manifest-array edits omit the generator step.** README/EXTERNAL_ADDONS/route-workflow/REPO_MODES are **generated mirrors** (WI-364); the linter runs `generate-manifest-mirrors.mjs --check` and fails if stale. After editing the manifest in 2.6/4.1/4.5, run `node scripts/generate-manifest-mirrors.mjs --write`. Do **not** hand-edit those mirrors (the plan's instructions to edit route-workflow/README are wrong).

### 🟡 Wrong premise / over-broad
- **4.7 "74 non-compliant skills" is a misread.** `validate-skill-before-starting.sh` is **date-gated** (only skills authored ≥2026-04-28 require the section; older/undated exempt) and **currently passes**. There is no gap. Backfilling 74 files + flipping to blocking is an unnecessary bulk hot-path edit (CLAUDE.md: "Never bulk-edit the hot path"). **Drop or rescope to new-skills-only.**
- **2.5 / 4.4 over-broad.** Only `prospect` and `ai-cold-outreach` are genuinely absent. `launch-strategy`, `cold-email`, `lead-magnets`, `free-tool-strategy`, `mor-vs-stripe`, `pricing-strategy` are **real installed addon skills**. The linter doesn't check `globalArtifacts.readBy` anyway (cosmetic). **Remove only `prospect` + `ai-cold-outreach`.**
- **2.1 vs 2.6 skill-count churn.** 2.1 sets 80→82, 2.6 sets →80. Pick the final count once. (Manifest currently 82; FRAMEWORK-STATE line 12 says 80 — it is hand-maintained, not generated.)
- **4.12 use the alternative fix.** `READY-FOR-UX` is not in `featureStates`; G2 already does DRAFT→UX-REVIEWED so G1 is a pure quality gate. Use `"DRAFT → DRAFT (quality gate, no state change)"` — do **not** add a new state (contract change).

### 🟢 Verified accurate & safe
- **4.3** G6 naming conflict is real (manifest G6 = post-land; review-exec self-labels G6 post-exec). Option A (doc rename to G5b) is fine — grep other "G6→review-exec" refs first.
- **4.6** duplicate `### Chaining` blocks confirmed (review-gate 255/258, plan-changeset 289/292).
- **4.8** `landing-page/SKILL.md:13` = `personas.md`; glob fix correct.
- **4.13** line counts exact (write-journeys 1512, diagnose-bug 991, design-ux 897).

### 🔵 Verify first
- **4.11** a concern-registry validator already exists (`validate-concern-registry-cross-host.sh`) — read REGISTRY.json structure and check it before adding a new `validate-concerns-registry.mjs` (duplication risk).

### Doc defect
- This plan's tail (≈ "Execution Order"→"Change Log") is **duplicated** (the second copy is stale: Change Log missing v3, execution table missing Phase 4). De-dupe before use.

### Delivery
Nearly every Phase-4 item edits `skills-manifest.json` (a contract change under `rules/plan-changeset-trigger.md` + refuse-mode chain). Decompose into sequential WIs — do **not** land this as one mega-changeset.

---

## Summary

37 findings across 4 categories: stray files polluting root, framework state drift, missing product integrations, and functional contract/routing gaps. Phases 1-3 address hygiene and product improvements. Phase 4 hardens the agent skill system's functional reliability.

---

## Phase 1: Root Cleanup (stray files, no skill changes)

### 1.1 Move research artifacts to `scratch/`

**Files to move:**
- `scrape.py` → `scratch/research/scrape.py`
- `scrape_eic.py` → `scratch/research/scrape_eic.py`
- `check_external.py` → `scratch/research/check_external.py`
- `format_markdown.py` → `scratch/research/format_markdown.py`
- `gen_gstack_prescope.js` → `scratch/research/gen_gstack_prescope.js`
- `urls.txt` → `scratch/research/urls.txt`
- `btrust_scraped.md` → `scratch/research/btrust_scraped.md`
- `scraped_eic.json` → `scratch/research/scraped_eic.json`

**Why:** These are one-off research/scraper scripts unrelated to the framework. They confuse onboarding and inflate root listing.

**Steps:**
```bash
mkdir -p scratch/research
# git mv for tracked files
git mv scrape.py scratch/research/
git mv gen_gstack_prescope.js scratch/research/
git mv urls.txt scratch/research/
# plain mv for untracked files (git mv fails on untracked)
mv scrape_eic.py scratch/research/
mv check_external.py scratch/research/
mv format_markdown.py scratch/research/
mv btrust_scraped.md scratch/research/
mv scraped_eic.json scratch/research/
```

### 1.2 Remove vestigial `package.json`

**File:** `package.json`
**Action:** Delete (scripts.test is a no-op, playwright dep is unused by the framework).

**Note:** `package-lock.json` is gitignored AND untracked — this is correct behavior, not contradictory. Do NOT remove it from .gitignore and do NOT try to `git rm` it.

**Steps:**
```bash
git rm package.json
```

### 1.3 Add `scratch/` cleanup note

**File:** `scratch/README.md` (create)
**Content:** Brief note that `scratch/` is for one-off research, prototypes, and artifacts. Not framework source. Auto-clean candidates older than 90 days.

---

## Phase 2: Framework State Fixes

### 2.1 Fix skill count drift in FRAMEWORK-STATE.md

**File:** `FRAMEWORK-STATE.md` line 12
**Change:** Update "Skills: 80" → "Skills: 82" (manifest has 82 `includedSkills` entries, verified by count script).

### 2.2 ~~Fix duplicate `track-visuals` in pipeline array~~ — INTENTIONAL, NO CHANGE

**Status:** NOT A BUG. `track-visuals` appears at pipeline indices 6 and 13 by design.
- Index 6: baseline capture (after design-ui/landing-page)
- Index 13: diff capture (after execute-changeset)

This matches the visual screenshot lifecycle documented in FRAMEWORK-STATE: "CAPTURED → DIFFED → PROMOTED → CLEANED." The pipeline needs both entries for the two-phase capture workflow. **No action required.**

### 2.3 Add stale proposal section to OPEN-PROPOSALS (do NOT move FP-023 yet)

**File:** `OPEN-PROPOSALS.md`
**Change:** Add a `## Stale (>30 days, no activity)` section at the bottom. Do NOT move FP-023 into it — it was created in-session and may still be under active consideration. The section is structural preparation for future use.

**Add section:**
```markdown
## Stale (>30 days, no activity)

| ID | Title | Last activity | Action needed |
|---|---|---|---|
| (none yet) | | | |
```

**Why:** The "never delete" rule means this list grows forever. A stale section provides a visible holding area without losing audit trail. FP-023 stays in the main table until confirmed abandoned.

### 2.4 Clean FRAMEWORK-STATE.md Known Gaps

**File:** `FRAMEWORK-STATE.md` lines 245-270
**Change:** Move all struck-through (CLOSED) items from the Known Gaps table to a dedicated `## Closed Gaps` subsection at the bottom of the file. The Known Gaps table should only contain actionable open items.

**Also update:** Skill count in Current State section (2.1 handles this).

### 2.5 Fix stale references in globalArtifacts

**File:** `skills-manifest.json` lines 341-356 (distributionPlan.readBy)
**Change:** Remove `prospect` and `ai-cold-outreach` from `distributionPlan.readBy` — these skills don't exist in the manifest or as directories.

### 2.6 Reclassify host-specific skills as external addons

**Files to modify:**
- `EXTERNAL_ADDONS.md` — add entries for `wsl2-audio` (host-support) and `suno-architect` (creative) with notes that they are host-specific
- `FRAMEWORK-STATE.md` — note that these are in `includedSkills` but are external-grade skills

**Why:** These dilute the framework's signal. `wsl2-audio` is host-specific troubleshooting; `suno-architect` is a creative/music skill.

**Important:** Do NOT remove from `includedSkills` — the linter (`validate-skill-structure.sh:73-89`) errors on any top-level dir with SKILL.md not in `includedSkills`. Keep them in the manifest; reclassify them in documentation only.

**Verified safe:** Neither skill is in `corePackForRouting`, `pipeline`, or any lane definition.

---

## Phase 3: Product Improvements

### 3.1 Wire `concerns/` into skill pipeline via helper script

**Architecture:** Concerns are explicitly documented as "routing primitives, not skills" (`concerns/SCHEMA.md`). Creating `concerns/SKILL.md` would contradict this. Instead, create a helper script that existing skills consume.

**New file:** `scripts/match-concerns.mjs`
- Input: file paths or diff content
- Output: matching concerns from `concerns/REGISTRY.json` based on signal matching (file_path_patterns, diff_keywords, packages_imported, env_vars_referenced)
- Usage: `node scripts/match-concerns.mjs --paths "src/auth/,src/billing/"`

**Files to modify:**
- `design-tech/SKILL.md` — add step to run `match-concerns.mjs` against planned file changes, load matching concern checklists
- `review-security/SKILL.md` — add concern-based security checklist auto-loading via helper
- `audit-implementation/SKILL.md` — add concern verification step via helper

**Why:** 100+ well-structured concern checklists exist but no skill knows about them. The helper script is the connective tissue between concerns (routing primitives) and skills (execution units).

### 3.2 Add host onboarding entrypoint

**New file:** `HOSTS.md` (or update `README.md`)
**Content:**
```markdown
## Host-Specific Setup

| Host | Context file | Install |
|---|---|---|
| Claude Code | `CLAUDE.md` | `./setup` |
| Kimi CLI | `KIMI.md` | `./setup --host kimi` |
| Codex CLI | (uses CLAUDE.md) | `./setup --host codex` |
| Gemini CLI | `GEMINI.md` | `./setup --host gemini` |
| OpenCode | (uses CLAUDE.md) | `./setup --host opencode` |
| Antigravity | `ANTIGRAVITY.md` | `./setup --host antigravity` |
| Cursor | (uses CLAUDE.md) | `./setup --host cursor` |

Start here: Read your host's context file, then run `./setup --host <your-host>`.
```

**Why:** New users on Codex, OpenCode, or Cursor have no clear entrypoint. Three host files exist at root but there's no document connecting them.

### 3.3 Add SKILL.md version field (two-step)

**Step 3.3a — Validator + contract update (this changeset):**
- `create-skill/SKILL.md` — document that new skills must include `version` field in frontmatter
- `test-framework/evals/tier-1/validate-skill-structure.sh` — add advisory (warning, not blocking) check for `version` field

**Step 3.3b — Batch backfill (separate commit):**
- Add `version: "1.0"` to all 82 SKILL.md files
- After backfill, flip validator from advisory to blocking
- This is a massive diff — keep it isolated in its own commit to avoid conflicts with in-flight work

**Why:** SKILL.md contracts change frequently. Without versioning, breaking changes to inputs/outputs silently break downstream skills. Splitting into two steps avoids a single 82-file commit that conflicts with everything.

### 3.4 Add FRAMEWORK-STATE.md decision archival policy

**File:** `FRAMEWORK-STATE.md` — add to "How to Update This File" section:
```markdown
- Move locked decisions older than 60 days to `FRAMEWORK-STATE-ARCHIVE/decisions-<period>.md`
  unless they are actively referenced by a skill's enforcement logic.
```

**Why:** The Decisions Made section is 100+ lines and growing. Most are from 2026-04-09. A rotation policy keeps the file scannable.

### 3.5 Create `examples/README.md` with navigation

**File:** `examples/README.md` (create)
**Content:** Index of examples with pipeline stage mapping:
```markdown
# Examples

| Example | Pipeline stages covered | Status |
|---|---|---|
| todo-api | plan → execute → land | Reference fixture |
```

**Note:** This is a placeholder — more examples are needed. The real fix is running the pipeline on 2-3 diverse projects and capturing them as examples.

---

## Phase 4: Functional Hardening (agent skill system reliability)

> **⚠️ Line numbers in this Phase are as-of 2026-06-11 and drift with every edit. Re-locate each target via `grep -n` before editing — do not trust the cited line.**
>
> **⚠️ Every step that edits `skills-manifest.json` (4.1, 4.2, 4.4, 4.5) MUST finish with the WI-364 generator + lint, or the linter fails on stale mirrors:**
> ```bash
> node scripts/generate-manifest-mirrors.mjs --write   # regenerates README/EXTERNAL_ADDONS/route-workflow/REPO_MODES
> node scripts/lint-skills-manifest.mjs                 # must pass
> ```

### 4.1 Fix `bootstrapStartSequence` — add mandatory `review-plan`

**File:** `skills-manifest.json` — the `bootstrapStartSequence` array (the actual array, ~line 440; the role doc is near line 23). Re-locate: `grep -n '"bootstrapStartSequence"' skills-manifest.json` then read the array.
**Current (verified 2026-06-13):** `…"plan-changeset", "execute-changeset"…` — **no `review-plan` between them** (confirmed bug; the `pipeline` array already has `review-plan` here, so bootstrap is inconsistent with pipeline).
**Fix:** Insert `review-plan` between them:
```json
"bootstrapStartSequence": [
  ...
  "plan-changeset",
  "review-plan",
  "execute-changeset",
  ...
]
```
**Pre-check:** `review-plan` is in `includedSkills` (subset assertion passes). ✓
**After edit:** run the generator + lint (REPO_MODES bootstrap sequence is a generated mirror).
**Why:** The mandatory chain requires `plan-changeset → review-plan → execute-changeset`. Bootstrap shipping unreviewed plans is a correctness bug.

### 4.2 Add `review-exec` to `pipeline` array

**File:** `skills-manifest.json` pipeline array
**Current:** `execute-changeset → track-visuals → benchmark-landing → review-gate → audit-implementation`
**Fix:** Insert `review-exec` after `execute-changeset`:
```json
"pipeline": [
  ...
  "execute-changeset",
  "review-exec",
  "track-visuals",
  "benchmark-landing",
  "review-gate",
  "audit-implementation",
  ...
]
```
**Pre-check:** `review-exec` is in `includedSkills` (subset assertion passes). ✓
**After edit:** `pipeline` is not a generated mirror, but run `node scripts/lint-skills-manifest.mjs` (subset check) — and `node scripts/lint-skills-manifest.mjs` again after 4.1/4.4/4.5 with the generator.
**Why:** `review-exec` is the G6 gate (mandatory self-review + adversarial review). The canonical product-build spine must include it. **Note:** depends on the 4.3 rename — once review-exec is relabelled G5b, update this rationale to "the G5b gate."

### 4.3 Fix G6 naming conflict — remap `review-exec` to G5b

**File:** `review-exec/SKILL.md` only (manifest `reviewGates.G6` correctly describes the post-`land-changeset` gate — leave it).
**Current (verified 2026-06-13):** manifest `reviewGates`: G5=after execute-changeset, **G6=after land-changeset**, G7=after verify-promotion. But `review-exec/SKILL.md` self-labels "G6" while running *post-exec/pre-land* → numbering collision.

**Fix — Option A (recommended): relabel review-exec to "G5b" in ALL occurrences (not just one line).** Verified G6 references in `review-exec/SKILL.md` as of 2026-06-13:
- **line 7** — `Mandatory G6 gate.` (frontmatter description) → `Mandatory G5b gate.`
- **line 65** — `It is the G6 gate in the chain:` → `It is the G5b gate in the chain:`
- **line 258** — `…at G5 (pre-exec) instead of G6 (post-exec).` → `…instead of G5b (post-exec).`
- **line 251** — `chain halts at G5 or G6` refers to gates generically (G6 = post-land halt) — **leave as-is.**

**Before editing:** `grep -rn 'G6' review-exec/ route-workflow/ references/chain-receipt-contract.md skills-manifest.json` to catch any other review-exec→G6 reference and avoid orphaning it. Re-confirm line numbers via `grep -n 'G6' review-exec/SKILL.md`.

**Option B:** Add G5b to manifest reviewGates:
```json
"G5b": {
  "after": "review-exec",
  "transition": "BASELINED → REVIEWED",
  "checks": "Self-review clean? Adversarial review resolved? Receipt emitted?"
}
```
Then shift G6 to G7, G7 to G8. This is more disruptive.

**Recommended:** Option A — minimal change, no state machine disruption.

### 4.4 Clean `globalArtifacts` genuinely absent skill references

**File:** `skills-manifest.json` lines 306-356
**Remove from `distributionPlan.readBy`:** `prospect`, `ai-cold-outreach` (these are genuinely absent — not installed as addons)

**Do NOT remove:** `launch-strategy`, `cold-email`, `lead-magnets`, `free-tool-strategy`, `mor-vs-stripe`, `pricing-strategy` — these are live installed addon skills from `coreyhaines-marketing-pack` and have legitimate cross-references.

**Also fix in Phase 2.5:** Same removal (2.5 and 4.4 are the same change).

**Note:** The linter doesn't check `globalArtifacts.readBy` — this edit is cosmetic. Do it for accuracy, not enforcement.

### 4.5 Remove `route-workflow` and `execute-changeset` from `corePackForRouting`

> **⚠️ Semantically debatable (MEDIUM risk) — confirm intent before doing.** This changes what the router surfaces; removing `execute-changeset` could stop the router from ever routing directly to execution. Consider deferring or doing as its own WI.

**File:** `skills-manifest.json` — the `corePackForRouting` array (`grep -n '"corePackForRouting"' skills-manifest.json`, ~line 135).
**Remove:** `route-workflow` and `execute-changeset` from the array (re-locate by content, not line number).
**Mirror sync:** `corePackForRouting` is the source of truth for the **route-workflow Core Pack mirror** — after editing, run `node scripts/generate-manifest-mirrors.mjs --write` then `node scripts/lint-skills-manifest.mjs`. **Do NOT hand-edit `route-workflow/SKILL.md`'s Core Pack list** — it is generated.

**Why:**
- `route-workflow` is the universal entry point — suggesting it as a "next step" creates routing loops
- `execute-changeset` should only run after `plan-changeset → review-plan` — router suggesting it directly bypasses the mandatory chain

Both skills are still in `includedSkills` and all lane definitions. This only affects what the router suggests to users.

### 4.6 Deduplicate task-graph boilerplate in 6+ skills

**Two distinct duplication patterns (verified 2026-06-13 — line numbers are stale, locate via grep):**

**Pattern A — repeated task-graph block inside a single `### Chaining` section** (`### Chaining` count = 1, but `update_plan`/`source of truth` lines doubled):
- `design-ux/SKILL.md` — 6 `update_plan` lines (≈2 blocks → keep 1)
- `design-tech/SKILL.md` — 6 (≈2 → keep 1)
- `land-changeset/SKILL.md` — 6 (≈2 → keep 1)
- `audit-implementation/SKILL.md` — 6 (≈2 → keep 1)
- `diagnose-bug/SKILL.md` — 6 (≈2 → keep 1)
- `verify-promotion/SKILL.md` — 8 (≈3 → keep 1)

**Pattern B — duplicate `### Chaining` header** (`### Chaining` count = 2, confirmed):
- `review-gate/SKILL.md` — 2 `### Chaining` headers → keep 1
- `plan-changeset/SKILL.md` — 2 `### Chaining` headers → keep 1

**Method (grep-driven, not line-number-driven):**
1. `grep -n '### Chaining\|update_plan\|source of truth' <file>/SKILL.md` to map the blocks.
2. Identify the most complete block (source-of-truth + Codex mirror + update_plan lines).
3. Delete the duplicate block(s); keep one.
4. Re-grep to confirm exactly one block remains.

**Why:** Duplicate boilerplate bloats SKILL.md files and may confuse agents about which block to follow. Largest single-file-touch operation — batch per-skill, one commit each. **All 8 are docs-exempt** (substantive prose, no frontmatter/process change) per `rules/plan-changeset-trigger.md` — direct commits OK.

### 4.7 `## Before Starting` — no action needed (date-gated validator)

**Status:** The `validate-skill-before-starting.sh` validator is **date-gated** — only skills authored on or after 2026-04-28 require `## Before Starting`. Older and undated skills are exempt, and the validator currently passes. There is no compliance gap.

**Action:** None. The "74 non-compliant" figure was a misread of the intentionally-scoped validator. Do NOT bulk-edit 74 SKILL.md files — this violates the "Never bulk-edit the hot path" convention in CLAUDE.md.

**If you still want to backfill:** Only backfill skills that will be authored going forward. The existing enforcement is already correct.

### 4.8 Fix `landing-page` personas path mismatch

**File:** `landing-page/SKILL.md` line 13
**Current:** `{ path: "docs/specs/personas.md", artifact: personas }`
**Fix:** Change to `{ path: "docs/specs/personas/P*.md", artifact: personas }`

**Why:** `build-personas` produces individual files at `docs/specs/personas/P*.md`, not a single `personas.md`. Other skills (write-spec, design-ux, write-journeys) correctly use the glob pattern.

### 4.9 Declare `plan-changeset` receipt artifact in outputs

**File:** `plan-changeset/SKILL.md` outputs section
**Add:**
```yaml
outputs:
  produces:
    - { path: "docs/plans/<date>-<name>/manifest.md", artifact: implementation-manifest }
    - { path: ".svc/receipts/<sha>/plan-manifest.json", artifact: plan-manifest-receipt }
```

**Why:** The receipt is read by 4 downstream skills (execute-changeset, land-changeset, verify-promotion, audit-implementation) but not declared as an output. This is a contract completeness gap.

### 4.10 Make `review-gate` inputs/outputs verifiable

**File:** `review-gate/SKILL.md` frontmatter
**Current:**
```yaml
inputs:
  required:
    - { path: "(artifact under review)", artifact: review-target }
outputs:
  produces:
    - { path: "(gate decision)", artifact: gate-decision }
```
**Fix:**
```yaml
inputs:
  required:
    - { path: "docs/specs/feature-*.md", artifact: review-target }
  optional:
    - { path: "docs/specs/journeys/*.feature.md", artifact: journey-docs }
    - { path: "docs/specs/personas/P*.md", artifact: personas }
outputs:
  produces:
    - { path: ".svc/review-gate-<timestamp>.md", artifact: gate-decision }
```

**Why:** Abstract paths break tier-1 validators and make the skill's data flow opaque. Concrete patterns let validators verify the contract.

### 4.11 Fix `concerns/REGISTRY.json` broken cross-references

**Structure (verified 2026-06-13):** `concerns` is an **array of 115 entries** (each with `name, domain, severity, signals, handled_by, related_concerns, …`); `skill_claims` is a separate top-level object. Edit by `name`, not by index.

**Fixes:**
- ✅ **VERIFIED** — `cache-eviction-policy.related_concerns` = `["cache-strategy-symmetry","memory-leak"]`; `"memory-leak"` is dead (only `memory-leak-risk` exists) → change to `"memory-leak-risk"`.
- ✅ **VERIFIED** — `cache-invalidation.related_concerns` = `["cache-strategy-symmetry","cache-eviction"]`; `"cache-eviction"` is dead (only `cache-eviction-policy` exists) → change to `"cache-eviction-policy"`.
- ⚠️ **VERIFY FIRST** — `pricing-tier-touch.handled_by.optional_skills`: confirm a `pricing-strategy` entry exists there AND that `pricing-strategy` is genuinely absent (it is an external addon skill — may be intentional). Only remove if truly dead.
- ⚠️ **VERIFY FIRST** — `skill_claims.exec-output-adversarial` and `skill_claims.chain-receipts-completeness` **do exist** (confirmed). Before removing, check whether they have backing concern `.md`/handler files; if backed, keep them.

**Also — do NOT build a duplicate validator.** A concern-registry validator already exists: `test-framework/evals/tier-1/validate-concern-registry-cross-host.sh`. **Read it first.** Only add `scripts/validate-concerns-registry.mjs` if these checks are genuinely missing from it; otherwise extend the existing validator to cover:
1. each `related_concerns` name exists in the `concerns` array
2. each `handled_by.*_skills` exists in `includedSkills` (or is a known external addon)
3. each `handled_by.*_rules` exists in `rulesRegistry`

**Why:** Broken cross-references silently fail — a concern fires but its cross-reference points to a renamed/deleted concern, so related context is lost.

### 4.12 Fix `FRAMEWORK-STATE.md` G1 transition state

**File:** `FRAMEWORK-STATE.md` reviewGates section or `skills-manifest.json` reviewGates.G1
**Current:** `transition: "DRAFT → ready for UX"` — "ready for UX" is not a `featureState`
**Fix:** Change to `transition: "DRAFT → DRAFT (quality gate, no state change)"`

**Why not add READY-FOR-UX:** Adding a new featureState ripples through every consumer of the state machine (review-gate, route-workflow, task-graph, etc.). G1 is a quality gate that doesn't advance state — G2 does that. Use the "no state change" alternative.

### 4.13 Reduce SKILL.md sizes via progressive disclosure (3 skills)

**Priority targets** (largest violations):
1. `write-journeys/SKILL.md` (1512 lines) → move Mode 6 (322 lines) to `write-journeys/references/mode-6.md`
2. `diagnose-bug/SKILL.md` (991 lines) → move retroactive mode and examples to `diagnose-bug/references/`
3. `design-ux/SKILL.md` (897 lines) → move state machine templates to `design-ux/references/`

**Method:** For each skill:
1. Identify the largest self-contained section
2. Move to `references/<section-name>.md`
3. Replace inline content with: `See [references/<section-name>.md](references/<section-name>.md) for full details.`
4. Verify `verify-skill-refactor.mjs` passes (old markers reachable in SKILL.md + references combined)

**Why:** Progressive disclosure is documented policy (locked 2026-04-19). These 3 skills are 1.2x-3x over the 500-line target.

### 4.14 Add `review-exec` to `pipeline` — validation

**Depends on:** 4.2
**File:** `skills-manifest.json`
**After adding review-exec to pipeline:** Run `node scripts/lint-skills-manifest.mjs` to verify the manifest linter accepts the change.

### 4.15 Wire hook telemetry for SubagentStart/SubagentStop

**Events confirmed (2026-06-13):** `SubagentStart` and `SubagentStop` are real Claude Code hook events (listed in `provision/hosts/claude.json` `hook_events`; mapped in `hooks/lib/hook-decision.mjs`). `hooks/hook-coverage-spec.md` currently marks them "Documented but not yet wired in svc" — **update that spec when wiring.** A reference implementation exists at `hooks/kimi/svc-kimi-subagent-start.sh` — mirror its shape.

**Files to modify:**
- `hooks/svc-subagent-start.mjs` (create) — log subagent spawn to `.svc/dispatch-log.jsonl` (file exists; append-only)
- `hooks/svc-subagent-stop.mjs` (create) — log subagent completion/failure to `.svc/dispatch-log.jsonl`
- `hooks/hooks.json` — register both for `SubagentStart`/`SubagentStop`
- `hooks/hook-coverage-spec.md` — flip both rows from "not yet wired" to wired

**Template:**
```javascript
// svc-subagent-start.mjs
const log = `${process.env.SVC_PROJECT_DIR || '.'}/.svc/dispatch-log.jsonl`;
const entry = { ts: new Date().toISOString(), event: 'subagent_start', ... };
fs.appendFileSync(log, JSON.stringify(entry) + '\n');
```

**Why:** SubagentStart/Stop are completely opaque — no telemetry on subagent lifecycle. This makes debugging parallel dispatch difficult.

---

## Execution Order (updated)

| Step | Phase | Risk | Revertible | Notes |
|---|---|---|---|---|
| 1.1 Move research artifacts | 1 | Low | Yes (git mv) | |
| 1.2 Delete package.json | 1 | Low | Yes (git checkout) | |
| 1.3 Create scratch/README.md | 1 | Low | Yes | |
| 2.1 Fix skill count to 82 | 2 | Low | Yes | |
| 2.2 ~~Fix track-visuals~~ | — | — | — | **Skipped — intentional duplication** |
| 2.3 Add stale proposal section | 2 | Low | Yes | Don't move FP-023 yet |
| 2.4 Clean Known Gaps | 2 | Low | Yes | Move closed items to bottom |
| 2.5 Fix stale references | 2 | Low | Yes | Remove prospect + ai-cold-outreach only |
| 2.6 Reclassify host skills as addons | 2 | Low | Yes | Doc-only, keep in includedSkills |
| 3.1 Create match-concerns.mjs | 3 | Medium | Yes | Helper script, not a skill |
| 3.2 Add HOSTS.md | 3 | Low | Yes | |
| 3.3a Version field validator | 3 | Low | Yes | Advisory only, not blocking |
| 3.4 Add decision archival policy | 3 | Low | Yes | |
| 3.5 Create examples README | 3 | Low | Yes | Placeholder only |
| 3.3b Batch backfill versions | 3 | High | Yes | Separate commit, 82 files |
| 4.1 Fix bootstrapStartSequence | 4 | Medium | Yes | Add review-plan between plan-changeset and execute |
| 4.2 Add review-exec to pipeline | 4 | Medium | Yes | Run manifest linter after |
| 4.3 Fix G6 naming conflict | 4 | Low | Yes | Rename to G5b in review-exec SKILL.md |
| 4.4 Clean globalArtifacts (8 skills) | 4 | Low | Yes | Extends 2.5 |
| 4.5 Remove route-workflow + execute from corePack | 4 | Medium | Yes | Affects router suggestions |
| 4.6 Deduplicate task-graph boilerplate | 4 | Medium | Yes | 8 files, keep most-complete block |
| 4.7 Before Starting — NO ACTION | — | — | — | Validator is date-gated and currently passes; no gap |
| 4.8 Fix landing-page personas path | 4 | Low | Yes | |
| 4.9 Declare plan-changeset receipt output | 4 | Low | Yes | |
| 4.10 Make review-gate I/O verifiable | 4 | Low | Yes | |
| 4.11 Fix concerns registry refs + add validator | 4 | Medium | Yes | |
| 4.12 Fix G1 transition state | 4 | Low | Yes | |
| 4.13 Reduce 3 SKILL.md sizes | 4 | Medium | Yes | Progressive disclosure, verify refactor |
| 4.14 Validate pipeline after 4.2 | 4 | Low | Yes | Linter only |
| 4.15 Wire SubagentStart/Stop hooks | 4 | Low | Yes | Telemetry only, no enforcement |

---

## Sequencing & WI Decomposition (implementation-ready — on paper only)

> This section turns the 30 active steps into commit-sized, dependency-ordered work items so a future implementation pass has nothing left to decide about *how* to sequence. **Nothing here is executed.** Chain class is per `rules/plan-changeset-trigger.md`: **DIRECT** = docs-exempt direct commit; **CHAIN** = contract/hot-path change → `write-spec → plan-changeset → review-plan → execute-changeset → review-exec → land`; **DECISION** = needs a human call before it can become a WI at all.

### Decision gates (resolve BEFORE these become WIs)

| # | Step(s) | Decision required | Default if unanswered |
|---|---------|-------------------|----------------------|
| D1 | 2.6 | Do we even want `wsl2-audio`/`suno-architect` de-emphasized? (docs-only reclass keeps them functional) | Do the doc reclass; do NOT remove dirs |
| D2 | 4.5 | Remove `route-workflow`+`execute-changeset` from `corePackForRouting`? Changes router behavior | **Defer** — own WI after confirming router still reaches execution via the chain |
| D3 | 3.3a/3.3b | Adopt a SKILL.md `version` field at all? 3.3b is an 82-file diff | Ship 3.3a advisory only; defer 3.3b |
| D4 | 4.11 (items 3-4) | Remove `pricing-strategy` claim + `exec-output-adversarial`/`chain-receipts-completeness` skill_claims? | Verify backing files first; keep if backed |

### Work items (grouped, ordered)

| WI | Steps | Chain | Risk | Depends on | Proof-of-done | Rollback |
|----|-------|-------|------|------------|---------------|----------|
| **WI-CLN-1** Root hygiene | 1.1, 1.2, 1.3 | DIRECT | Low | — | `git status` clean at root; `node scripts/lint-skills-manifest.mjs` PASS; `bash test-framework/evals/run-all-evals.sh --tier1` PASS | `git checkout` / `git revert` (1 commit) |
| **WI-CLN-2** FRAMEWORK-STATE hygiene | 2.1, 2.3, 2.4, 3.4, 2.6 | DIRECT | Low | — | `wc -c FRAMEWORK-STATE.md` < 51200; count reads 82; renders cleanly | `git revert` |
| **WI-CLN-3** Doc additions | 3.2 (HOSTS.md), 3.5 (examples README) | DIRECT | Low | — | files exist, links resolve | `git rm` new files |
| **WI-CLN-4** SKILL.md prose dedup | 4.6 (8 files) | DIRECT | Low-Med | — | per file: exactly one task-graph/Chaining block (`grep -c`); `validate-skill-structure.sh` PASS | per-file `git revert` (one commit each) |
| **WI-CLN-5** Manifest chain completeness | 4.1, 4.2, 4.14 | CHAIN | Med | — | generator run; `lint-skills-manifest.mjs` PASS; bootstrap & pipeline both contain review-plan+review-exec | `git revert` manifest + regenerate mirrors |
| **WI-CLN-6** Manifest dead-ref prune | 2.5 / 4.4 | CHAIN(light) | Low | — | `prospect`+`ai-cold-outreach` gone from `distributionPlan.readBy`; lint PASS | `git revert` |
| **WI-CLN-7** review-exec → G5b | 4.3 | CHAIN | Low | — | `grep -rn 'G6' review-exec/` returns only the generic line 251; cross-refs intact | `git revert` |
| **WI-CLN-8** G1 transition fix | 4.12 | CHAIN | Low | — | G1 transition = "DRAFT → DRAFT (quality gate)"; no new featureState added; lint PASS | `git revert` |
| **WI-CLN-9** Skill frontmatter I/O | 4.8, 4.9, 4.10 | CHAIN | Low | — | paths are concrete globs; `validate-contracts.sh` + `validate-skill-structure.sh` PASS | `git revert` |
| **WI-CLN-10** Concerns registry | 4.11 (items 1-2 verified) | CHAIN | Med | D4 for items 3-4 | dead refs fixed; existing `validate-concern-registry-cross-host.sh` PASS (extend, don't duplicate) | `git revert` REGISTRY.json |
| **WI-CLN-11** corePack routing | 4.5 | CHAIN | Med | **D2** | router still reaches execute via chain; generator run; lint PASS | `git revert` + regenerate |
| **WI-CLN-12** concerns wiring | 3.1 (match-concerns.mjs + wire 3 skills) | CHAIN | Med | — | script runs on sample paths; 3 skills load matches; lint PASS | `git rm` script + `git revert` skill edits |
| **WI-CLN-13** Subagent telemetry | 4.15 | CHAIN | Low | — | both hooks fire to dispatch-log; `hook-coverage-spec.md` rows flipped | `git revert` + unregister in hooks.json |
| **WI-CLN-14** SKILL.md size reduction | 4.13 (3 skills) | DIRECT | Med | — | each < target; `verify-skill-refactor.mjs` PASS (all markers reachable) | per-file `git revert` |
| **WI-CLN-15** version field (optional) | 3.3a, 3.3b | DIRECT/Big | High | **D3** | 3.3a advisory warns; 3.3b all 82 carry `version`, validator flipped blocking | `git revert` (3.3b isolated commit) |

### Recommended execution order (waves)

1. **Wave 1 (safe, parallel-able, DIRECT):** WI-CLN-1, -2, -3, -4 — pure hygiene/docs, no manifest risk, fast confidence.
2. **Wave 2 (CHAIN, low-risk, sequential):** WI-CLN-6, -7, -8, -9 — small contract fixes, one plan-changeset each.
3. **Wave 3 (CHAIN, the meaningful ones):** WI-CLN-5 (chain completeness), WI-CLN-10 (concerns), WI-CLN-12 (concerns wiring), WI-CLN-13 (telemetry).
4. **Wave 4 (gated/decision):** WI-CLN-11 (after D2), WI-CLN-14, WI-CLN-15 (after D3).

> **Hard rule (carried from CLAUDE.md + your convention):** Waves 2-4 are **one WI per pipeline run** through `/route-workflow` → the mandatory chain. Never batch-land manifest edits. Wave 1 may land as direct commits.

---

## Validation (updated)

After each phase, run:
```bash
# Phase 1
node scripts/lint-skills-manifest.mjs
bash test-framework/evals/run-all-evals.sh

# Phase 2
node scripts/lint-skills-manifest.mjs
wc -c FRAMEWORK-STATE.md  # must be < 51200

# Phase 3
node scripts/lint-skills-manifest.mjs
bash test-framework/evals/tier-1/validate-skill-structure.sh
node scripts/match-concerns.mjs --paths "src/auth/,src/billing/"
bash test-framework/evals/tier-1/validate-skill-structure.sh 2>&1 | grep -i version

# Phase 4
node scripts/lint-skills-manifest.mjs  # after 4.1, 4.2, 4.4, 4.5
bash test-framework/evals/tier-1/validate-skill-structure.sh  # after 4.6
node scripts/verify-skill-refactor.mjs  # after 4.13 (progressive disclosure)
node scripts/validate-concerns-registry.mjs  # after 4.11 (new script)
wc -c FRAMEWORK-STATE.md  # after any FRAMEWORK-STATE edit, must be < 51200
```

**IMPORTANT: Manifest edits require generator step.** Per WI-364, README/EXTERNAL_ADDONS/route-workflow/REPO_MODES are generated mirrors. After editing `skills-manifest.json`, always run:
```bash
node scripts/generate-manifest-mirrors.mjs --write
```
Then re-run the linter to verify no stale mirrors.

---

## Not in Scope (deferred)

These were identified but require separate work items:

1. **Full examples library** — needs 2-3 diverse project captures (1-2 days)
2. **Concerns auto-loading per tech stack** — needs a mapping table of tech-stack → concern-ids (0.5 day, after 3.1 lands)
3. **Tier-3 test expansion** — 34 unjudged scenarios (2-3 days, tracked by existing WI)
4. **Feature-like bugfix escalation** — needs route-workflow/diagnose-bug changes (tracked by existing WI)
5. **Remaining 4 SKILL.md size reductions** — design-tech, verify-promotion, strategic-decision, audit-implementation (after 4.13 targets land)

---

## Pre-flight Baseline Gate (WI-CLN-0) — ✅ RESOLVED 2026-06-14

**Original discovery (2026-06-13):** `lint-skills-manifest.mjs` was RED on two pre-existing issues:
```
- Included skill missing SKILL.md: analyze-marketing/SKILL.md
- rules/ file not registered in rulesRegistry: rules/base44/cli-site-deploy-decoupled.md
```

**RESOLVED 2026-06-14 (this session):**
- **Root cause was corruption, NOT a rename** (the v7 "half-done rename" diagnosis was superseded — see v8). `audit-session-execution/SKILL.md` had been overwritten with `analyze-marketing`'s content (`name: analyze-marketing`) and `analyze-marketing/SKILL.md` deleted. The user confirmed both are distinct native skills. **Fix:** `git checkout HEAD -- analyze-marketing/SKILL.md audit-session-execution/SKILL.md` restored both to their correct, distinct content (corrupt copy backed up to `scratch/corruption-backup-2026-06-14/`).
- **base44 rule registered** in `skills-manifest.json` `rulesRegistry` via the `improve-framework` gate (commit `5d7d5f06`), mirroring sibling base44 deploy rules.
- **Proof:** `node scripts/lint-skills-manifest.mjs` → PASS; full tier-1 → 223 passed, 0 failed.

**Implication for the rest of the plan:** the baseline is now GREEN, so every WI below CAN now prove its own "lint passes" gate. D0 is closed.

---

## Exact Changes — verified ready-to-apply (2026-06-13)

Each FIND was confirmed against the live file on 2026-06-13. Paper only — apply at implementation time.

**2.1 — `FRAMEWORK-STATE.md` line 12:** change only the number `**Skills:** 80` → `**Skills:** 82` (keep the changelog tail).

**2.5 / 4.4 — `skills-manifest.json` `globalArtifacts.distributionPlan.readBy`:**
FIND `["launch-strategy","cold-email","prospect","ai-cold-outreach","lead-magnets","free-tool-strategy"]`
REPLACE `["launch-strategy","cold-email","lead-magnets","free-tool-strategy"]` → then `generate-manifest-mirrors.mjs --write` + lint.

**4.1 — `skills-manifest.json` `bootstrapStartSequence`:** the adjacency `"plan-changeset","execute-changeset"` is unique to this array → insert `"review-plan"` between them: `"plan-changeset","review-plan","execute-changeset"`. Then generator + lint.

**4.3 — `review-exec/SKILL.md` G6→G5b (3 edits, verified):**
- L7 `Mandatory G6 gate.` → `Mandatory G5b gate.`
- L65 `It is the G6 gate in the chain:` → `It is the G5b gate in the chain:`
- L258 `…instead of G6 (post-exec).` → `…instead of G5b (post-exec).`
- leave L251 (generic). Confirm: `grep -rn 'G6' review-exec/` returns only L251.

**4.5 — `skills-manifest.json` `corePackForRouting`:** remove elements `"route-workflow"` and `"execute-changeset"`. Then generator + lint. ⚠️ gate **D2** first.

**4.8 — `landing-page/SKILL.md` line 13:**
FIND `    - { path: "docs/specs/personas.md", artifact: personas }`
REPLACE `    - { path: "docs/specs/personas/P*.md", artifact: personas }`

**4.11 — `concerns/REGISTRY.json` (2 verified dead refs):**
- `cache-eviction-policy.related_concerns`: `["cache-strategy-symmetry","memory-leak"]` → `["cache-strategy-symmetry","memory-leak-risk"]`
- `cache-invalidation.related_concerns`: `["cache-strategy-symmetry","cache-eviction"]` → `["cache-strategy-symmetry","cache-eviction-policy"]`

**4.12 — `skills-manifest.json` `reviewGates.G1.transition`:**
FIND `"transition":"DRAFT → ready for UX"`
REPLACE `"transition":"DRAFT → DRAFT (quality gate, no state change)"`

**4.6 / 4.13 — NOT inlined by design:** these touch hundreds of SKILL.md lines; byte-patches would bloat and rot the plan. Exactness = the grep-driven "one block remains" / `verify-skill-refactor.mjs` PASS already specified in those steps.

---

## Confidence Ledger (honest — 2026-06-13)

100% confidence is only truthful for mechanically-verified, decision-free, baseline-green changes. I will not stamp "100%" where a human decision or a red baseline remains.

| Item | Confidence | Still gated by |
|------|-----------|----------------|
| 2.1, 4.3, 4.8, 4.11, 4.12 | ✅ 100% — exact FIND verified | baseline green |
| 2.5/4.4, 4.1 | ✅ 100% content — needs generator+lint | baseline green |
| 4.5 | ⚠️ content exact; routing-impact | **D2** + baseline |
| 4.6, 4.13 | ✅ method verified (not byte-exact, by design) | — |
| WI-CLN-0 baseline | ✅ **RESOLVED 2026-06-14** — baseline GREEN (corruption restored + base44 rule registered; full tier-1 223/0) | — |
| 2.6, D1, D3, D4, P1, P2 | ❌ not 100% — **human decisions** | decision |

**Bottom line (updated 2026-06-14):** the baseline blocker is cleared and the plan is implementation-*exact* for the mechanical items. The only remaining gate to end-to-end 100% is the **human decisions** (2.6, D1–D4 defaulted below; P1/P2 in the MiMo doc) — those are irreducible: review cannot convert a product decision into a verified fact.

---

## Decisions Resolved (defaults adopted 2026-06-14)

Per "fix all of it," the open decision gates are resolved to their conservative defaults below (override any by editing this section). This removes them as blockers **on paper** — no framework mutation performed.

| Gate | Resolution | Effect |
|------|-----------|--------|
| **D0** analyze-marketing baseline | ✅ **RESOLVED 2026-06-14.** The v7 "half-done rename" diagnosis was WRONG — it was **corruption**: `audit-session-execution/SKILL.md` had been overwritten with `analyze-marketing`'s content and `analyze-marketing/SKILL.md` deleted. User confirmed both are distinct native skills. Restored both to HEAD (`git checkout HEAD -- …`); baseline GREEN. See WI-CLN-0. |
| **D1** wsl2-audio/suno-architect | **Docs-only reclass, keep in `includedSkills` + keep dirs** (2.6 already reflects this). |
| **D2** corePack removal (4.5) | **DEFER** — 4.5 becomes a standalone future WI, excluded from the first execution pass. |
| **D3** SKILL.md version field (3.3) | **3.3a advisory only; defer the 82-file 3.3b backfill.** |
| **D4** concerns claims (4.11 items 3-4) | **Keep both claims.** Apply ONLY the 2 verified `related_concerns` fixes (items 1-2). Do not remove `skill_claims` without backing-file proof. |
| **P1/P2** (MiMo host) | Out of scope here — live in `2026-06-13-mimo-code-capability-mapping.md`. |

**After defaults (updated 2026-06-14):** D0 is now RESOLVED (baseline GREEN). The only remaining blocker is **the greenlight to actually execute the WIs against the framework** (held under "paper only"). The decision defaults above (D1–D4) stand unless you override them.

---

## Change Log

| Version | Date | Change |
|---|---|---|
| v1 | 2026-06-11 | Initial plan from repo review |
| v2 | 2026-06-11 | Reviewed: fixed skill count (82 not 81), removed track-visuals "fix" (intentional), kept FP-023 in main table, replaced concerns/SKILL.md with helper script, split version field into validator+backfill, added pre-checks and validation commands |
| v3 | 2026-06-11 | Deep functional audit: added Phase 4 (17 items) — bootstrap chain fix, pipeline review-exec, G6 naming, globalArtifacts cleanup, corePack routing safety, task-graph dedup, Before Starting backfill, personas path, receipt declaration, review-gate I/O, concerns registry refs, G1 state, SKILL.md size reduction, SubagentStart/Stop hooks |
| v4 | 2026-06-13 | Claude re-review against live repo + linter: fixed 1.1 (git mv→mv for untracked), corrected 1.2/1.3 (package-lock is gitignored+untracked, not a bug), made 2.6 linter-safe (docs-only reclassify, keep in includedSkills), narrowed 2.5/4.4 to prospect+ai-cold-outreach only, 4.7 reclassified NO-ACTION (date-gated validator passes), 4.12 uses no-state-change alternative, added mandatory generate-manifest-mirrors.mjs step to Validation, removed duplicated stale tail. See Reviewer Corrections section at top. |
| v5 | 2026-06-13 | Claude enrichment (paper only, no implementation): folded corrections into step bodies (4.1/4.2/4.3/4.5/4.6/4.11/4.15) with verified facts + grep methods + line-drift warnings; verified 4.11 dead refs against live REGISTRY.json (115-entry array); confirmed SubagentStart/Stop are real events w/ Kimi reference impl; added **Sequencing & WI Decomposition** section (15 commit-sized WIs grouped DIRECT/CHAIN/DECISION, 4 decision gates, 4-wave order, per-WI proof-of-done + rollback). Plan is now implementation-ready on paper; execution still gated behind one-WI-per-run chain. |
| v6 | 2026-06-14 | Claude solution-confidence pass (paper only): discovered the repo baseline lint is RED from pre-existing state (deleted analyze-marketing still in manifest; unregistered base44 rule) → added **Pre-flight Baseline Gate (WI-CLN-0)** + D0. Added **Exact Changes** appendix (verified copy-paste FIND/REPLACE for 2.1, 2.5/4.4, 4.1, 4.3, 4.5, 4.8, 4.11, 4.12 — each confirmed against live files). Added **honest Confidence Ledger**: 100% only on mechanical/baseline-green items; true end-to-end 100% blocked on the red baseline + 6 human decisions (no rubber-stamp). |
| v7 | 2026-06-14 | Claude "fix all of it" pass (paper only): diagnosed the baseline-red as a half-done `analyze-marketing → audit-session-execution` rename (audit-session-execution/SKILL.md has `name: analyze-marketing`) — external WIP, not this plan, not auto-fixed. Added **Decisions Resolved** section adopting conservative defaults for D1–D4 (keep host skills, defer 4.5, advisory-only version field, keep concern claims). Remaining blockers reduced to: D0 (external rename WIP) + greenlight to execute. |
| v8 | 2026-06-14 | Claude re-review + corrections (after fixing the framework). **Superseded the v7 diagnosis: it was CORRUPTION, not a rename** — `audit-session-execution/SKILL.md` was overwritten with `analyze-marketing`'s content + the file deleted; both are distinct native skills (user-confirmed). Restored both to HEAD. Registered the base44 rule via improve-framework gate. **Baseline now GREEN; full tier-1 223/0.** Marked WI-CLN-0 RESOLVED, corrected D0, updated Confidence Ledger (baseline blocker cleared). Re-verified all other Exact-Change items (2.1, 2.5, 4.1, 4.2, 4.3, 4.5, 4.8, 4.11, 4.12) STILL accurately pending against current state. Only remaining blocker: greenlight to execute. |
