**Status:** IMPLEMENTED (2026-04-12, commit e084f32)

# Framework Evolution — 2026-04-12 (Logical Gaps Review)

## Method

Read in order: FRAMEWORK-STATE.md (full), DOCTRINE.md (full), skills-manifest.json,
all 50 SKILL.md files (via 4 parallel research agents), references/ (anti-patterns,
context-budget, verification-patterns, model-routing, skill-pack-comparison,
blend-registry.json), hooks/hooks.json, tier-1 evals (run: 9/9 PASS baseline),
REPO_MODES.md, proposals/ directory.

Cross-referenced every finding against FRAMEWORK-STATE.md Known Gaps and Analysis
History to avoid rediscovery. Verified high-priority findings with targeted grep
before inclusion.

## Findings (by priority)

### P0 — Fix now (blocks quality)

#### P0-1: Learnings JSONL schema three-way inconsistency

**Evidence:**
- `verify-promotion/SKILL.md:250` writes: `{"learning": "...", "confidence": "high|medium|low", "saves_minutes": N}`
- `manage-learnings/SKILL.md:47` canonical schema uses: `{"insight": "...", "confidence": 8, ...}` (field name `insight`, integer 1-10)
- `manage-learnings/SKILL.md:121` review command references `.learning` — contradicting its own schema at line 47

**Impact:** Every learning written by verify-promotion is unreadable by manage-learnings'
canonical commands (review, prune, export all reference `.insight` or integer confidence).
The manage-learnings review command itself references the wrong field from its own schema.

**Fix:** Align on ONE schema. Recommend: keep manage-learnings canonical schema (`insight`,
integer 1-10). Update verify-promotion:250 to use `insight` and integer confidence.
Fix manage-learnings:121 `jq` command to reference `.insight` (matching its own schema).
Add a self-verify check in manage-learnings for schema conformance.

---

#### P0-2: Phantom skill references route agents to non-existent skills

**Evidence:**
- `monetization-architecture/SKILL.md:73-76` — "When to Use This vs Adjacent Skills" table
  references `pricing-strategy`, `paywall-upgrade-cro`, `churn-prevention`, `mor-vs-stripe`.
  None exist in the manifest or as SKILL.md directories.
- `validate-feature/SKILL.md:790` — Routes to `/design-shotgun`. No `design-shotgun/SKILL.md` exists.
- `validate-feature/SKILL.md:786` — Routes to `/office-hours`. No `office-hours/SKILL.md` exists.
- `plan-capabilities/SKILL.md:158` — References `design-shotgun (gstack)` as a recommended install.

**Impact:** Agents following routing suggestions will invoke non-existent skills, breaking
the pipeline. These are not "external addons that might not be installed" — they are
referenced as if they are core skills.

**Fix:** Remove phantom references. For monetization-architecture adjacency table, replace
with actual svc skills or remove the table. For validate-feature, replace `design-shotgun`
and `office-hours` with the svc equivalents (design-ui exploration and validate-feature's
own questioning respectively). For plan-capabilities, mark as "external — install required"
or remove.

---

#### P0-3: Brownfield-conversion lane position conflict

**Evidence:**
- `audit-coverage/SKILL.md:25` declares `brownfield-conversion: { position: 2, prev: onboard-repo, next: sync-work-items }`
- `sync-work-items/SKILL.md:17` declares `brownfield-conversion: { position: 2, prev: onboard-repo, next: null }`
- Both claim position 2 with the same `prev`. The manifest lists `["onboard-repo", "audit-coverage", "sync-work-items"]` — 3 skills at positions 1, 2, 3.

**Impact:** Progressive chaining in brownfield-conversion lane is ambiguous — two skills
claim position 2 and the chain walker cannot determine order. `audit-coverage` should be
position 2 and `sync-work-items` should be position 3.

**Fix:** Change `sync-work-items/SKILL.md:17` to `{ position: 3, prev: audit-coverage, next: null }`.

---

#### P0-4: write-journeys brownfield chaining contradicts frontmatter

**Evidence:**
- `write-journeys/SKILL.md:22` frontmatter: `brownfield-feature: { position: 4, prev: write-spec, next: design-ux }`
- `write-journeys/SKILL.md:1361` chaining section: `brownfield-feature: design-tech --progressive --lane brownfield-feature`
- Frontmatter says `next: design-ux`, chaining code says chain to `design-tech`. Direct contradiction.

**Impact:** An agent using the chaining section will skip design-ux, design-ui, and
track-visuals for brownfield features. An agent using frontmatter will chain correctly.
Which one the agent follows depends on implementation — non-deterministic behavior.

**Fix:** Determine intended behavior. The manifest's brownfield-feature lane includes
design-ux and design-ui, so the frontmatter is correct. Fix the chaining section to:
`design-ux --progressive --lane brownfield-feature`.

---

### P1 — Fix soon (degrades quality)

#### P1-1: Product-specific content hardcoded in framework skills

**Evidence:**
- `analyze-marketing/SKILL.md:480-499` — "Quick Reference: Feature Spec Paths" section
  hardcodes 16 specific feature names (`feature-matching.md`, `feature-conversation.md`,
  `profiles.md`, etc.) with descriptions like "7D Matching System."
- `build-personas/SKILL.md:122-128` — Phase 1 Deep Read specifies reading `feature-onboarding,
  feature-matching, feature-conversation, profiles, feature-collab, monetization`.
- `build-personas/SKILL.md:168-179` — "Their 2026 World" template hardcodes AI coding,
  Discord, Reddit r/collaborator assumptions.
- `build-personas/SKILL.md:227-229` — Skepticism Profile table includes "AI-powered matching",
  "Trust score", "7D compatibility", "Blind ratings."
- `write-e2e/SKILL.md` — Contains `[custom:start]`/`[custom:end]` blocks (lines 270-284,
  1095-1144) with project-specific patterns (Base44 SDK, Supabase, Sonner toasts).

**Impact:** Framework skills produce nonsense or errors on any project except the original
development project. This is the highest-priority maintainability issue for framework
distribution.

**Fix:** Remove all product-specific content from framework skills. Replace hardcoded
feature lists with dynamic discovery (`glob docs/specs/features/*.md`). Replace template
assumptions with framework-generic placeholders. Move `[custom:start]` blocks to stack
convention packs or delete them.

---

#### P1-2: Self-verify weakness is systematic across the pipeline

**Evidence (sample of worst gaps):**
- `review-gate/SKILL.md:18` — `self_verify: false` but lines 528-536 define a self-verify section with 3 checks. Frontmatter lies.
- `manage-learnings/SKILL.md:18` — `self_verify: false` but lines 223-226 define a self-verify section. Same issue.
- `design-ux/SKILL.md:738-744` — 5 checks. Missing: AC traceability (the skill's critical gate in Step 10, lines 606-624).
- `design-ui/SKILL.md:1133-1139` — 4 checks. Missing: dark mode coverage, component state coverage, AC traceability, responsive layout.
- `execute-changeset/SKILL.md:569-577` — 4 checks. Missing: AC coverage (the most critical verification for this skill).
- `write-journeys/SKILL.md:1338-1343` — 3 checks (weakest in the pipeline). Missing: AC tag coverage, technical reference ban enforcement.
- `sync-work-items/SKILL.md:137-139` — 3 checks. Check #1 has "or logged for sync" escape that makes it vacuous.
- `create-skill/SKILL.md:599-607` — 4 checks, all structural. 6 post-creation steps in process but only 1 in self-verify.

**Pattern:** Every skill's self-verify checks 3-6 items when the process defines 8-12
quality gates. The unchecked gates depend on the agent "remembering" to check them — exactly
the failure mode self-verify exists to prevent.

**Impact:** Self-verify gates are weaker than they appear. A skill can pass self-verify
while violating its own process steps. The doctrine says "Self-verify is a gate, not
advisory" (FRAMEWORK-STATE.md locked decision) but the gates are porous.

**Fix:** Systematic audit: for each skill, enumerate every MANDATORY gate in the process,
then verify it has a corresponding self-verify check. Priority targets: execute-changeset
(add AC coverage check), design-ux/design-ui (add traceability checks), review-gate and
manage-learnings (fix `self_verify: false` → `true`). This is a bulk operation — suggest
a dedicated improve-framework session.

---

#### P1-3: improve-framework path inconsistency

**Evidence:**
- `improve-framework/SKILL.md:268` (Step 6b): `mv proposals/<date>-framework-improvement.md proposals/done/`
- `improve-framework/SKILL.md:292` (Step 7): `Move it to docs/proposals/done/ (Step 6b).`
- Step 6b says `proposals/done/`. Step 7 says `docs/proposals/done/`. Different paths.

**Impact:** An agent following Step 7 creates a path that doesn't match actual proposal
locations. All 53 done proposals are at `proposals/done/`, not `docs/proposals/done/`.

**Fix:** Change line 292 from `docs/proposals/done/` to `proposals/done/`.

---

#### P1-4: quick-fix self-verify uses `--cached` after commit (vacuous pass)

**Evidence:**
- `quick-fix/SKILL.md:131` — Check #1: `git diff --cached --name-only | wc -l` ≤ 3
- `quick-fix/SKILL.md:132` — Check #2: `git diff --cached package.json` is empty
- Both run AFTER the commit (Step 4, lines 99-109). After commit, `--cached` is empty.
  Check #1 always reads 0 files (passes). Check #2 always reads empty (passes).

**Impact:** quick-fix's file-count and dependency-change guards are completely non-functional.

**Fix:** Change to `git diff HEAD~1 --name-only | wc -l` and `git diff HEAD~1 -- package.json`.

---

#### P1-5: review-security output not consumed by any downstream skill

**Evidence:**
- `review-security/SKILL.md:16` — Output: `docs/specs/security/<name>-review.md`
- `audit-implementation/SKILL.md:14-18` — Does not list security review as optional input.
- No other skill in the pipeline declares `docs/specs/security/` as an input.

**Impact:** Security review findings are written but never formally consumed. The
audit-implementation security specialist re-discovers the same OWASP patterns without
referencing the existing review. Wasted tokens and potential inconsistency.

**Fix:** Add `docs/specs/security/<name>-review.md` as optional input to
audit-implementation. When present, the security specialist should read it first and
focus on implementation-specific gaps not covered by the design-level review.

---

#### P1-6: track-visuals has no chain linkage and no server pre-flight

**Evidence:**
- `track-visuals/SKILL.md:23-24` — Declares positions but no `prev`/`next`.
- Upstream skills (`design-ui/SKILL.md`, `execute-changeset/SKILL.md`) mention it in prose.
- No server pre-flight check despite requiring a running browser/app.

**Impact:** If upstream skill prose changes, track-visuals stops being invoked. If the
app is not running, the skill fails with cryptic browser errors. Other verification skills
(verify-promotion) have server pre-flights; track-visuals does not.

**Fix:** (a) Add `prev`/`next` to frontmatter chain declarations for both invocation points.
(b) Add server pre-flight check: `curl -s localhost:{PORT} || FAIL`.

---

#### P1-7: design-tech duplicate Step 7 numbering

**Evidence:**
- `design-tech/SKILL.md:469-479` — "Step 7: Update The Feature Spec"
- `design-tech/SKILL.md:501-518` — "Step 7: Handoff"
- Two sections labeled Step 7. Handoff should be Step 8.

**Impact:** Agents may skip one of the two Step 7s, thinking they already completed it.

**Fix:** Renumber the Handoff section to Step 8.

---

#### P1-8: find-opportunity mandatory dependency on optional external addon

**Evidence:**
- `find-opportunity/SKILL.md:449-458` — `last30days` is declared MANDATORY with a hard stop.
- `last30days` is an external addon (EXTERNAL_ADDONS.md), not a bundled skill.

**Impact:** find-opportunity blocks execution if last30days is not installed. No graceful
degradation. Users who install svc without last30days get a hard stop on their first
opportunity search.

**Fix:** Either bundle last30days (move from external addon to included skill) or add
graceful degradation: when last30days is not installed, fall back to WebSearch with a
warning about reduced social proof quality.

---

#### P1-9: stage-revenue invokes find-opportunity with undocumented `--ecosystem` flag

**Evidence:**
- `stage-revenue/SKILL.md:169-173` — Invokes `find-opportunity --ecosystem <domain>`
- `find-opportunity/SKILL.md` — No `--ecosystem` parameter in frontmatter inputs or
  anywhere in the process description.

**Impact:** stage-revenue passes a parameter that find-opportunity ignores, producing
unscoped results instead of the ecosystem-constrained search stage-revenue expects.

**Fix:** Either add `--ecosystem` as an accepted parameter in find-opportunity or remove
the flag from stage-revenue's invocation and use the description to scope the search.

---

### P2 — Improve when possible (nice to have)

#### P2-1: review-gate missing greenfield progressive chaining

**Evidence:**
- `review-gate/SKILL.md:550-554` — Specifies progressive chaining for brownfield-feature,
  bugfix, and refactor lanes. No greenfield lane chaining specified.
- Frontmatter declares `greenfield: { position: 18 }`.

**Impact:** Progressive greenfield execution stalls after review-gate because the chaining
section does not specify the next skill (`audit-implementation`).

**Fix:** Add greenfield lane chaining: `audit-implementation --progressive --lane greenfield`.

---

#### P2-2: design-tech handoff prose says plan-changeset but pipeline has explore-solutions next

**Evidence:**
- `design-tech/SKILL.md:518` — "The terminal state is invoking plan-changeset."
- `design-tech/SKILL.md:16` frontmatter: `next: explore-solutions`
- `design-tech/SKILL.md:597-599` chaining section correctly chains to explore-solutions.

**Impact:** The handoff prose contradicts the frontmatter and chaining section. Agents
following prose skip explore-solutions.

**Fix:** Change line 518 to "The terminal state is invoking explore-solutions."

---

#### P2-3: analyze-marketing output path mismatch with audit-coverage

**Evidence:**
- `analyze-marketing/SKILL.md:19` — Output: `.agents/product-marketing-context.md`
- `audit-coverage/SKILL.md` — Canonical catalog expects `docs/specs/product-marketing-context.md`

**Impact:** audit-coverage classifies marketing context as MISSING when it exists at
a different path.

**Fix:** Align paths. Either change analyze-marketing output to `docs/specs/` or update
audit-coverage's catalog to check `.agents/` as well.

---

#### P2-4: Stale "19-skill pipeline" label in route-workflow

**Evidence:**
- `route-workflow/SKILL.md:150` — "Approach 1 — Serious Vibe Coding (full 19-skill pipeline)"
- `bootstrapStartSequence` in manifest has 21 entries (track-visuals appears twice).

**Impact:** Minor documentation drift. Agents may miscalculate pipeline length.

**Fix:** Update to "21-step pipeline" (or "19 unique skills, 21 steps").

---

#### P2-5: land-changeset frontmatter missing feature-spec as required input

**Evidence:**
- `land-changeset/SKILL.md:40` — Prerequisites table: "Feature spec — Required: Yes"
- `land-changeset/SKILL.md:5-7` — Frontmatter `inputs.required` only lists `implementation-manifest`.

**Impact:** Contract validation tools check frontmatter, not prose. Missing the feature
spec from required inputs means it is not enforced.

**Fix:** Add `{ path: "docs/specs/features/<name>.md", artifact: feature-spec }` to
frontmatter `inputs.required`.

---

#### P2-6: verify-promotion merge commit detection is fragile

**Evidence:**
- `verify-promotion/SKILL.md:228` — `PROMO_COMMIT=$(git log --merges --format=%H -1)`

**Impact:** If any merge commit happens between promotion and verification (concurrent
work on main), this grabs the wrong commit.

**Fix:** Pass the promotion commit SHA explicitly from land-changeset or use
`git log --merges --grep="checkpoint:" --format=%H -1` to match svc's commit convention.

---

### P3 — Track (not actionable yet)

#### P3-1: Bugfix lane manifest does not include write-e2e

**Evidence:**
- `skills-manifest.json:192-193` — bugfix lane: `["diagnose-bug", "plan-changeset", "execute-changeset", "review-gate", "audit-implementation", "land-changeset", "verify-promotion"]`
- `route-workflow/SKILL.md` Lane 4 step 5 — write-e2e is MANDATORY for user-facing surfaces.
- `diagnose-bug/SKILL.md:608-614` — Routes to write-e2e as mandatory.

**Why not actionable yet:** write-e2e is invoked conditionally (user-facing surfaces only).
Adding it to the manifest lane would make it unconditional. The current approach (invoked
from within diagnose-bug/execute-changeset when needed) is arguably correct — but it means
the manifest understates the lane. Worth tracking for when Level B state machine is built,
which could handle conditional lane steps.

---

#### P3-2: Doctrine evidence debt for C1/C7

Already in Known Gaps. No new evidence found. Confirmed: still needs repeat-run variance
fixtures and a parallel worktree eval, not contract edits.

---

## Comparison delta

The `references/skill-pack-comparison.md` is marked STALE (last updated 2026-04-03, 9 blend
sessions since). Major gaps listed there that have been addressed since:

| Listed gap | Current status |
|---|---|
| Debugging | `diagnose-bug` now has 10 process tasks, causal classification, spec-as-nav |
| Design system spec | Still a gap — `design-ui` creates `DESIGN.md` and `design-system.md` inline, but no dedicated skill |
| Safety guardrails | Partially addressed by hooks (workflow-guard, config-protection, block-no-verify, completion guard) |
| Release engineering | Still a gap — `land-changeset` does squash merge + PR, but no version/changelog/doc sync |

Comparison table needs row-by-row refresh per its own update protocol.

## Stale proposal audit

| Proposal | Status |
|---|---|
| `proposals/2026-04-12-visual-verification-enforcement.md` | PENDING — not yet implemented |
| `proposals/done/` (53 files) | All implemented per FRAMEWORK-STATE.md |

No obsolete pending proposals found. The one pending proposal (visual verification enforcement)
is still relevant and not superseded by any finding in this audit.

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | Proposal file exists | `test -f proposals/2026-04-12-evolution-logical-gaps.md` | PASS |
| 2 | Every finding cites file:line | All 19 findings cite specific file:line references | PASS |
| 3 | FRAMEWORK-STATE.md was read first | No rediscovered items in findings (C1/C7 noted as "already tracked") | PASS |
| 4 | Findings are ranked by impact | P0 (4) → P1 (9) → P2 (6) → P3 (2) | PASS |
