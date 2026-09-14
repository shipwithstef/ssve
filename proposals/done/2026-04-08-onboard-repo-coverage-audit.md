# Framework Improvement: onboard-repo Coverage Audit Gap

## Evidence

- **Source:** Real brownfield use of `onboard-repo` on the Example Marketplace repo at `~/app-workspaces/example-marketplace`. Onboarding ran 2026-04-06 (commit `00cefd1`). The skill produced `docs/specs/project-state.md` reporting `conversion status: mapped ✅` and a foundational artifact status table listing vision, personas, journeys, feature specs, tests, project state, and work items index — all CANONICAL.
- **Finding:** During a `route-workflow` brownfield-state check on 2026-04-08, manual inspection surfaced 6+ canonical svc artifacts that were silently absent or in foreign form, all unreported by `onboard-repo`:
  - `docs/specs/domain-profile.md` — MISSING (no `analyze-domain` ever ran)
  - `docs/specs/analyze-competitors.md` — MISSING in svc form, but FOREIGN: `docs/analysis/02-COMPETITOR-ANALYSIS.md` + 22 sibling research files (`03-SWOT-ANALYSIS.md`, `04-FEATURE-COMPARISON-MATRIX.md`, `05-MARKET-POSITIONING.md`, `12-TOTAL-ADDRESSABLE-MARKET-REALITY.md`, etc.) exist with substantive content but were invisible to the pipeline
  - `docs/specs/code-style.md` — MISSING; partial code style rules live in CLAUDE.md and `~/.claude/rules/frontend-react.md` (global)
  - Design contracts (`design-ux`, `design-ui`, `design-tech`) — MISSING; not inline in feature specs and no per-feature design directories
  - `docs/track-visuals/baseline/` — MISSING; no visual baseline captured for any browser route
  - `docs/specs/product-marketing-context.md` — MISSING in svc form, but FOREIGN: `docs/marketing/PRICING_LOYALTY_SAMPLE_PLAN.md` (103KB) + `docs/marketing/PROMOTION_STRATEGY.md` exist
- **Severity:** **high** — every brownfield onboard from now on under-reports gaps. Cascades into Lane 3 (Brownfield Feature Extension) silently skipping `design-ux`/`design-ui`/`track-visuals` because the foundational artifacts they depend on are absent. The Example Marketplace run is the first concrete evidence of the regression but the gap applies to every brownfield repo.

## Diagnosis

- **Root cause:** `onboard-repo/SKILL.md` Step 2 ("Map current artifacts into svc form") was written as a soft heuristic — "classify current truth into the nearest svc concepts" — with a hand-listed subset of 6 artifact types (vision, personas, journeys, feature specs, implementation notes, work queues). The svc canonical artifact catalog has grown to ~20 distinct types as the framework matured (domain profile, competitor analysis, code style contract, design-ux/ui/tech contracts, visual baselines, marketing context, security spec, etc.) but the mapping checklist in `onboard-repo` did not grow with it. There was no forcing function that tied the skill to the canonical artifact list, no three-state classification (CANONICAL/FOREIGN/MISSING), and no scan for foreign-form content in non-canonical paths. The skill's Self-Verify only required "subsystem map and work-item summary" — neither check would catch a missing canonical artifact.
- **Category:** missing capability (the Coverage Audit phase did not exist) + drift (the skill's mapping checklist drifted from the canonical catalog over time)
- **Already in FRAMEWORK-STATE.md?** No. This is a NEW finding. The closest prior entry is "2026-04-06 Install Packaging Gap" with `P1: onboard-repo must verify code claims — FIXED (verification rule)`, but that addressed unrelated finding-verification requirements, not artifact coverage.

## Implementation

- **Route:** Direct skill surgery — new skill creation + targeted edits to existing files. Quick-fix discipline (no lane/gate semantics changed). Not routed through the full pipeline because the change is contract-level for one skill plus its callers, not a feature.
- **Files changed:**
  - **NEW:** `audit-coverage/SKILL.md` — full skill with frontmatter, canonical artifact catalog (20 rows in 7 categories: foundational specs, feature lifecycle, design contracts, code & style contracts, test contracts, state files, global), three-state classifier process, foreign-location glob patterns, output spec, self-verify checks, chain handoffs. Standalone-runnable AND callable from `onboard-repo --from onboard-repo` flag.
  - **EDIT:** `onboard-repo/SKILL.md` — outputs frontmatter gained `coverage-audit.md`; chain `next` changed from `sync-work-items` to `audit-coverage`; Project State File section now references the canonical catalog instead of listing a subset; Step 2 references the canonical catalog; new mandatory Step 2.5 invokes `audit-coverage --from onboard-repo`; Self-Verify gained checks 4 (coverage-audit.md exists) and 5 (Coverage Gaps section in project-state.md); Chaining text updated to invoke `audit-coverage` next.
  - **EDIT:** `skills-manifest.json` — added `audit-coverage` to `includedSkills` (47→48), `corePackForRouting` (30→31), and `brownfield-conversion` lane skills (`onboard-repo, sync-work-items` → `onboard-repo, audit-coverage, sync-work-items`).
  - **EDIT:** `README.md` — added `audit-coverage` line to the Included Skills list.
  - **EDIT:** `EXTERNAL_ADDONS.md` — added `audit-coverage` to the Core Pack list.
  - **EDIT:** `route-workflow/SKILL.md` — added `audit-coverage` to Core Pack section + new freeform routing table row for "what svc artifacts are missing", "coverage gaps", "is the brownfield repo aligned", "audit coverage", "what alignment is needed".
  - **EDIT:** `REPO_MODES.md` — Suggested conversion sequence and Brownfield Conversion lane diagram now include `audit-coverage` between `onboard-repo` and `sync-work-items`.
  - **EDIT:** `references/knowledge/svc/CAPABILITIES.md` — added `audit-coverage` capability row to the Other Lanes table; bumped skill count and version (46 → 48 — also corrects pre-existing drift from `reverse-engineer` not being counted); updated brownfield-conversion lane row to include the new sequence.
  - **EDIT:** `FRAMEWORK-STATE.md` — Current State skill count 46 → 48 (and lint expectation 30 → 31 routing); new Analysis History entry `2026-04-08: onboard-repo Coverage Audit Gap`.
- **Commits:** _(filled in after commit)_

## Replay Verification

- **Replay target:** Execute `audit-coverage` against `~/app-workspaces/example-marketplace` (following the new skill's catalog walk + classification process) and confirm the produced `docs/specs/coverage-audit.md` lists the 6+ gaps surfaced manually before the skill existed.
- **Result:** **PASS**
- **Evidence:**
  - `~/app-workspaces/example-marketplace/docs/specs/coverage-audit.md` written: 8 CANONICAL / 2 FOREIGN / 10 MISSING / 40% coverage
  - All predicted gaps confirmed:
    - `domain-profile` → MISSING ✓
    - `analyze-competitors` → FOREIGN (23 files in `docs/analysis/` enumerated) ✓
    - `code-style` → MISSING ✓
    - `design-ux` inline → MISSING (0 / 36 feature specs have `## Design-UX` section, grep-verified) ✓
    - `design-ui` inline → MISSING (0 / 36, grep-verified) ✓
    - `design-tech` inline → MISSING (0 / 36, grep-verified) ✓
    - `track-visuals` baseline → MISSING (no `docs/track-visuals/` or `e2e/snapshots/baseline/`) ✓
    - `product-marketing-context` → FOREIGN (`docs/marketing/PRICING_LOYALTY_SAMPLE_PLAN.md` + `PROMOTION_STRATEGY.md` enumerated) ✓
  - `~/app-workspaces/example-marketplace/docs/specs/project-state.md` updated with `## Coverage Gaps` section linking to the audit report
  - All 7 tier-1 evals PASS after the skill addition: `validate-chain-references` 222, `validate-contracts` 243 (after fixing initial output-overlap finding), `validate-self-verify-sections` 172, `validate-skill-structure` 543, `validate-worktree-safety` 6, `validate-frontmatter-ast` 1365, `validate-markdown-ast` 989
  - `node scripts/lint-skills-manifest.mjs` PASS: 48 included skills, 31 routing core skills, 12 coreyhaines

**Iteration in this loop:** First eval run failed `validate-contracts` because both `onboard-repo` and `audit-coverage` declared `coverage-audit.md` and `project-state.md` as `outputs.produces`. Fix: only `audit-coverage` declares `coverage-audit.md`; `audit-coverage` removed `project-state.md` from its produces list (it appends a section as side-effect, not full ownership). Re-run: PASS.

## Lint Verification

- `node scripts/lint-skills-manifest.mjs` must pass after the changes. Specifically the lint compares `manifest.includedSkills` against the README "## Included Skills" section, the `EXTERNAL_ADDONS.md` Core Pack section, and verifies each included skill has a `SKILL.md` file. All four lists must agree.
- AST evals (`test-framework/evals/tier-1/validate-frontmatter-ast.mjs` and `validate-markdown-ast.mjs`) must pass for the new `audit-coverage/SKILL.md` (proper frontmatter schema, H1 present, heading nesting, announce pattern, Self-Verify table columns).

## FRAMEWORK-STATE.md Mutations

- **Current State:** Skills 46 → 48 (audit-coverage + already-existing reverse-engineer drift correction); Last lint expectation routing 30 → 31
- **Analysis History:** new entry `2026-04-08: onboard-repo Coverage Audit Gap (Example Marketplace evidence)` with Source, Root cause, Implementation, Replay sections
- **Known Gaps:** none of the existing gaps are closed by this proposal
- **Decisions Made:** no new locked decisions
- **Capabilities (`references/knowledge/svc/CAPABILITIES.md`):** new `audit-coverage` row in Other Lanes capability table; brownfield-conversion lane row updated to show new sequence; skill count + version bumped

## Status

IMPLEMENTED (2026-04-08, commit 977c546)
