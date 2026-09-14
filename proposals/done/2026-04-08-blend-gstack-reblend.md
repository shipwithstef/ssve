# Blend Plan: gstack (re-blend)

**Source:** https://github.com/garrytan/gstack
**SHA:** 9d34baa973475d4901c8e8aee2e94e33f9417679
**Date:** 2026-04-08
**Previous blend:** unknown-pre-registry (2026-04-05, 9 patterns)

## Summary

8 patterns to blend, 17 to skip, 9 already present.

| # | Pattern | Target | What breaks without it | What changes after |
|---|---------|--------|----------------------|-------------------|
| 1 | Review Army specialist dispatch | `audit-implementation/SKILL.md` | Single-pass review misses domain-specific issues (SQL safety, perf, data-migration) — reviewer spreads thin | Parallel specialist subagents + adaptive gating |
| 2 | Plan completion audit | `land-changeset/SKILL.md` | File-set check passes but 3 of 10 planned tasks are missing — PR merges incomplete work | Per-task DONE/PARTIAL/MISSING status before push |
| 3 | Scope drift detection | `audit-implementation/SKILL.md` | Unplanned files sneak into the diff — refactors mixed with feature work | Diff-vs-manifest comparison flags unplanned changes |
| 4 | Failure ownership triage | `execute-changeset/SKILL.md` | Pre-existing test failures block feature execution — agent stuck fixing old bugs | 3-bucket triage: branch/pre-existing/flaky |
| 5 | AI Slop blacklist | `references/anti-patterns.md` | design-ui generates gradient hero + three-column benefit cards — generic AI aesthetic | 10-item blacklist as AP-22 |
| 6 | Completeness principle | `DOCTRINE.md` | Agent picks 90% shortcut when 100% costs 30 extra seconds — incomplete edge cases ship | "Boil the Lake" — always complete when marginal cost is near-zero |
| 7 | Search Before Building discipline | `execute-changeset/SKILL.md` | Agent builds custom auth middleware when the framework has built-in — reinvents worse | 3-layer search check before unfamiliar patterns |
| 8 | Test framework bootstrap | `execute-changeset/SKILL.md` | Greenfield project has no test runner — TDD loop fails at step 1 | B2-B5 detect/install/verify pipeline |

## Blend items

### 1. Review Army specialist dispatch → `audit-implementation/SKILL.md`

**From:** gstack `review/SKILL.md` (Review Army), `scripts/resolvers/review-army.ts`, `review/specialists/*.md`
**Into:** `audit-implementation/SKILL.md` Phase 2 (after loading upstream context)

**The problem in svc today:**
audit-implementation runs a single agent that traces behavior end-to-end across all dimensions: correctness, performance, security, data integrity, API contracts. When the diff is 500+ lines touching 3 subsystems, one reviewer cannot hold all specializations in working memory simultaneously. Result: it catches behavioral correctness issues (its strength) but misses SQL N+1 queries, missing test negative-paths, or data migration reversibility — domain-specific issues that require focused attention.

**How the source solves it:**
gstack dispatches 7 specialist subagents in parallel, each with a focused scope:
- testing (negative-path, edge-case, isolation, flaky, security tests)
- maintainability (dead code, DRY, stale comments, conditional side effects)
- security (input validation, auth bypass, injection, crypto, secrets, XSS)
- performance (N+1, missing indexes, algorithmic complexity, bundle size)
- data-migration (reversibility, data loss risk, lock duration, multi-phase safety)
- api-contract (breaking changes, versioning, error consistency, backwards compat)
- red-team (5 adversarial attack vectors against the diff)

Findings are merged with fingerprinting for dedup. Key innovation: **adaptive gating** — specialists with 0 findings over 10+ dispatches get skipped on future runs (saves tokens), EXCEPT security and data-migration which are NEVER_GATE (always run regardless of hit rate).

**What this changes in svc:**
Before: audit-implementation Phase 2 is one agent doing everything.
After: Phase 2 gains a "Specialist Dispatch" sub-step. The audit agent dispatches 4-7 specialist subagents (selected based on diff scope — skip data-migration if no migrations, skip api-contract if no API changes). Each specialist gets the diff + its focused checklist. Findings merge into the audit report with source attribution. Over time, specialists with consistently 0 findings get gated (except security + data-migration = NEVER_GATE).

Add to `audit-implementation/SKILL.md` after Phase 1:
```
### Phase 1.5: Specialist Dispatch (parallel)

Select specialists based on diff scope:
| Specialist | Dispatch when |
|---|---|
| testing | always |
| security | always (NEVER_GATE) |
| performance | >100 LOC changed OR database queries touched |
| data-migration | migration files present (NEVER_GATE) |
| api-contract | API routes or response shapes changed |
| maintainability | >200 LOC changed |

Dispatch as parallel Agent subagents. Each receives: the diff, the feature spec ACs, and their specialist checklist. Merge findings by dedup (same file:line = one finding, highest severity wins).
```

**What NOT to take:**
- The red-team specialist (svc already has adversarial review in review-gate Step 3 cross-review).
- The Greptile integration (third-party dependency).
- The design specialist (svc handles design at G2/G3 gates, not at audit time).
- The full adaptive gating JSONL persistence system (too complex for initial blend — add specialist selection heuristics instead, evolve to data-driven gating later).

**Why this matters:**
A 500-line diff touching payments, API routes, and database models needs at least security, performance, and data-migration expertise. One generalist reviewer allocates ~equal attention to each dimension and misses the SQL N+1 in the payments query (performance), the missing CSRF token on the new API route (security), and the irreversible column drop in the migration (data-migration). Parallel specialists find all three because each one focuses entirely on their domain.

---

### 2. Plan completion audit → `land-changeset/SKILL.md`

**From:** gstack `ship/SKILL.md` Step 3.45
**Into:** `land-changeset/SKILL.md` Step 1 (Validate in the worktree)

**The problem in svc today:**
land-changeset Step 1b compares branch diff FILES against manifest FILES — "every changed file is in the manifest, every manifest file appears in the diff." This checks file-level coverage but not task-level completion. A manifest with 10 tasks and 15 files could have all 15 files touched but only 7 of 10 tasks fully implemented. The remaining 3 tasks might have stub implementations that pass file-set checks but don't satisfy their ACs. The PR merges with 30% of planned behavior missing.

**How the source solves it:**
gstack's /ship Step 3.45 walks through every actionable item in the plan and cross-references against the git diff. Each item gets a status:
- DONE — implementation matches plan intent
- PARTIAL — started but incomplete
- MISSING — no evidence in diff
- CHANGED — implemented differently than planned
- NOT_STARTED — no code for this item

Only DONE items pass. PARTIAL/MISSING/CHANGED items are flagged with specific evidence of what's missing.

**What this changes in svc:**
Before: Step 1b checks files only.
After: Step 1b gains a sub-step 1b-ii "Task completion audit":

```
**1b-ii. Cross-reference manifest tasks against diff:**

For each task in the manifest:
1. Read the task's intent and AC slice
2. Check the diff for files this task should have touched
3. Verify the implementation satisfies the AC (not just file presence)
4. Mark: DONE | PARTIAL | MISSING | CHANGED

If any task is PARTIAL or MISSING: STOP. List what's missing.
Do not proceed to push with incomplete tasks.
```

**What NOT to take:**
- NOT_STARTED status (svc's execute-changeset progress.md already tracks this during execution).
- The full /ship workflow (svc's land-changeset is already more structured with worktree validation).

**Why this matters:**
File-set validation is necessary but not sufficient. A file can be "touched" with a 2-line import and a TODO comment — it shows up in `git diff --name-only` but the task is not done. The plan completion audit catches this by checking task intent against actual implementation, preventing incomplete features from landing.

---

### 3. Scope drift detection → `audit-implementation/SKILL.md`

**From:** gstack `review/SKILL.md` Step 2 (scope drift detection)
**Into:** `audit-implementation/SKILL.md` Phase 1 (Load Upstream Context)

**The problem in svc today:**
execute-changeset has deviation rules that catch drift DURING execution (auto-fix bugs, STOP for architecture changes). But once execution is complete and review begins, there's no explicit check comparing the final diff against the planned scope. If the agent added a "helpful" refactor to 3 files not in the manifest, or quietly expanded a task's scope beyond its AC, audit-implementation won't flag it — it evaluates correctness of what's there, not whether what's there matches what was planned.

**How the source solves it:**
gstack's /review compares every file in the diff against the plan. Files not in the plan are flagged as "unplanned changes." The reviewer then decides: intentional expansion (accept with note) or scope creep (reject).

**What this changes in svc:**
Before: audit-implementation Phase 1 loads upstream context but doesn't compare diff scope against plan scope.
After: Phase 1 gains a "Scope Drift Check":

```
### Phase 0.5: Scope Drift Check

Before analyzing correctness, verify scope:
1. `git diff --name-only main..HEAD` → actual changed files
2. Read manifest file set → planned changed files
3. Diff the two lists:
   - Files in diff but NOT in manifest → UNPLANNED (flag)
   - Files in manifest but NOT in diff → MISSING (flag)
4. For each UNPLANNED file: is the change related to a planned task (dependency resolution, test fixture)? If yes: JUSTIFIED. If no: SCOPE CREEP.
5. Report scope drift before proceeding to correctness audit.
```

**What NOT to take:**
- gstack's scope drift is embedded in /review (pre-landing). svc already has review-gate. The better home is audit-implementation, which runs deeper analysis before landing.

**Why this matters:**
Scope creep is the #1 source of "the PR is too big to review." An agent that adds 200 lines of refactoring alongside a 300-line feature makes review harder and increases merge risk. Catching this at audit time — before the PR is created — prevents bloated PRs from reaching main.

---

### 4. Failure ownership triage → `execute-changeset/SKILL.md`

**From:** gstack `ship/SKILL.md` Step 3 (failure ownership triage)
**Into:** `execute-changeset/SKILL.md` Persistence Model (Step 5: run full test suite)

**The problem in svc today:**
The persistence model runs `full test suite → must PASS (no regressions)` at step 5. If a test fails, the agent assumes it's a regression from the current task and tries to fix it. But in brownfield projects, pre-existing failures are common — tests that were already broken before the feature branch started. The agent wastes 3 iterations trying to fix a test it didn't break, hits the 3-strike rule, and reports BLOCKED. The feature execution stalls on someone else's bug.

**How the source solves it:**
gstack categorizes every test failure into three buckets:
- **Introduced by this branch** — test passes on base, fails on HEAD → blocker
- **Pre-existing** — test also fails on base commit → not a blocker (log and continue)
- **Flaky** — test fails intermittently (passes on retry) → not a blocker (log and flag)

Only branch-introduced failures block execution.

**What this changes in svc:**
Before: Step 5 says "Run full test suite → must PASS."
After: Step 5 gains failure triage:

```
5. Run full test suite
   If failures:
   a. Run `git stash && <test-command> && git stash pop` to test on base state
   b. Categorize each failure:
      - Fails on HEAD but passes on base → BRANCH-INTRODUCED (must fix)
      - Fails on both HEAD and base → PRE-EXISTING (log, continue)
      - Passes on retry → FLAKY (log, continue)
   c. Only BRANCH-INTRODUCED failures trigger the regression fix loop
   d. PRE-EXISTING failures logged in progress.md with "pre-existing: <test-name>"
```

**What NOT to take:**
- gstack's full /ship test framework bootstrap (B2-B8) — that's a separate blend item (#8).
- The health score rubric (8 weighted categories) — svc doesn't need a dashboard.

**Why this matters:**
In a brownfield project with 3 pre-existing test failures, every single feature execution hits the 3-strike wall and reports BLOCKED. The developer has to manually debug which failures are theirs. Failure triage automates this — the agent knows which failures it caused and only blocks on those. This unblocks brownfield execution entirely.

---

### 5. AI Slop blacklist → `references/anti-patterns.md`

**From:** gstack `design-review/SKILL.md` (AI Slop blacklist, 10 items)
**Into:** `references/anti-patterns.md` as AP-22

**The problem in svc today:**
design-ui generates component specs with taste memory and variant exploration. But it has no explicit guard against the most common AI-generated design patterns that make every product look the same. When the user says "design a landing page," the agent reliably produces: gradient hero section with centered text, three-column benefit cards with generic icons, floating action button, "Get started" CTA. This is because these patterns dominate training data. Without a blacklist, the agent defaults to statistical majority.

**How the source solves it:**
gstack's design-review maintains a 10-item blacklist of known AI slop patterns:
1. "Hover to reveal" anything
2. Feature cards with icons and generic headers
3. Gradient hero sections with centered text
4. "Three column benefit cards" layout
5. Floating action buttons on desktop
6. Modal-heavy interactions for simple tasks
7. Skeleton loaders for synchronous data
8. Toast notifications for non-errors
9. Generic "Get started" CTAs
10. Emoji-heavy UI text

These are explicitly forbidden. When the agent generates a variant containing any of these, it must replace with a project-specific alternative.

**What this changes in svc:**
Add AP-22 to `references/anti-patterns.md`:

```
### AP-22: AI Slop in UI Design

AI models default to statistically dominant design patterns from training data.
These patterns make every product look identical. Blacklist:

1. Gradient hero sections with centered text
2. Three-column benefit/feature cards with generic icons
3. Floating action buttons on desktop
4. "Get started" / "Learn more" generic CTAs
5. Skeleton loaders for synchronous data
6. Toast notifications for non-error feedback
7. Modal dialogs for simple tasks
8. "Hover to reveal" interactions
9. Emoji as UI decoration (not content)
10. Stock illustration hero images

**Fix:** When generating UI, scan output against this list. If any pattern
appears, replace with a project-specific alternative derived from the design
system, personas, and competitive analysis. The replacement must be SPECIFIC
to this product, not another generic pattern.
```

Also add a reference to AP-22 in `design-ui/SKILL.md` Step 3 (Concept Generation).

**What NOT to take:**
- gstack's full 80-item design review checklist (svc's design phases are spec-based, not live-audit-based).
- The AUTO-FIX/ASK classification (svc uses review-gate for this).

**Why this matters:**
A product whose landing page has a gradient hero, three-column benefits, and a "Get started" button is indistinguishable from every other AI-generated product. For builders trying to differentiate (especially those svc's find-opportunity and stage-revenue identified), generic design is a competitive disadvantage. The blacklist forces the agent to think harder.

---

### 6. Completeness principle (Boil the Lake) → `DOCTRINE.md`

**From:** gstack `ETHOS.md` (Boil the Lake principle)
**Into:** `DOCTRINE.md` new section after "The Science"

**The problem in svc today:**
DOCTRINE.md explains progressive narrowing and why it works. It has scope prohibition (banned phrases like "placeholder", "hardcoded for now") in plan-changeset. But there's no positive principle saying: when AI makes the marginal cost of completeness near-zero, always do the complete thing. The scope prohibition prevents scope REDUCTION but doesn't encourage scope COMPLETION. An agent implementing 8 of 10 error paths satisfies the letter of the rules (no banned phrases) but violates the spirit (incomplete).

**How the source solves it:**
gstack's ETHOS.md defines "Boil the Lake":
- A "lake" is boilable: 100% test coverage for a module, all edge cases, complete error paths.
- An "ocean" is not: rewriting an entire system, multi-quarter migration.
- When evaluating "approach A (full, ~150 LOC) vs approach B (90%, ~80 LOC)" — always prefer A when the delta costs seconds.
- Anti-pattern: "Choose B — it covers 90% with less code."

The compression ratio table (boilerplate 100x, tests 50x, features 30x, bugs 20x, architecture 5x, research 3x) grounds the principle in evidence.

**What this changes in svc:**
Add to DOCTRINE.md after "The Science" section:

```
## The Completeness Principle

AI-assisted coding makes the marginal cost of completeness near-zero. When
the complete implementation costs minutes more than the shortcut — do the
complete thing.

**Lake vs ocean:** A "lake" is boilable — all error paths, all edge cases,
complete test coverage for a module. An "ocean" is not — rewriting an entire
system, multi-quarter migration. The pipeline boils lakes. It flags oceans
as out of scope.

**Compression ratios:**
| Task type | Human team | AI-assisted | Ratio |
|-----------|-----------|-------------|-------|
| Boilerplate | 2 days | 15 min | ~100x |
| Tests | 1 day | 15 min | ~50x |
| Features | 1 week | 30 min | ~30x |
| Bug fix + regression | 4 hours | 15 min | ~20x |
| Architecture | 2 days | 4 hours | ~5x |

When evaluating "approach A (complete, 150 LOC) vs approach B (90%, 80 LOC)"
— prefer A. The 70-line delta costs seconds. Shipping shortcuts is legacy
thinking from when human engineering time was the bottleneck.

This principle complements the scope prohibition in plan-changeset: scope
prohibition prevents REDUCING planned scope; the completeness principle
encourages COMPLETING all planned scope to full depth.
```

**What NOT to take:**
- The "Build for Yourself" section (philosophy, not methodology).
- The "Golden Age" framing (marketing, not doctrine).
- User Sovereignty (svc already has human checkpoints at every gate).

**Why this matters:**
Without this principle, an agent correctly follows the spec but implements the "90% path" — covers the happy path, skips 2 of 5 error states, writes 3 of 5 tests. Each individual shortcut is rational ("this error state is unlikely"). Cumulatively, 10 such decisions across 10 tasks ship a product with 30% of edge cases missing. The completeness principle makes the default "implement everything" rather than "implement enough."

---

### 7. Search Before Building discipline → `execute-changeset/SKILL.md`

**From:** gstack `ETHOS.md` (Search Before Building, 3 layers)
**Into:** `execute-changeset/SKILL.md` Core Rules section

**The problem in svc today:**
execute-changeset's subagent template says "Follow the style contract exactly. Do not invent conventions." This prevents convention drift. But when a task requires building something the agent hasn't seen in the style contract (auth middleware, file upload handler, cron scheduler), there's no instruction to check if the framework already has a built-in. The agent defaults to building from scratch — reinventing something that exists as a one-liner in the framework.

**How the source solves it:**
gstack injects a "Search Before Building" discipline into every skill's preamble. Three layers:
- **Layer 1: Tried and true** — standard patterns, battle-tested. Check if the runtime/framework has a built-in.
- **Layer 2: New and popular** — ecosystem conventions. Check if there's a well-adopted library.
- **Layer 3: First principles** — original reasoning. Only when L1+L2 don't apply.

The most valuable outcome: understand what everyone does (L1+L2), then discover why conventional wisdom is wrong for this case (L3 — the "eureka moment").

**What this changes in svc:**
Add to execute-changeset Core Rules:

```
- **Search before building.** When a task requires infrastructure, middleware,
  or patterns not in the style contract:
  1. Check if the framework has a built-in (Layer 1)
  2. Check if there's a well-adopted library (Layer 2)
  3. Only build from scratch if L1+L2 don't apply (Layer 3)
  The cost of checking is near-zero. The cost of reinventing is 100+ wasted
  LOC that a one-liner would have replaced.
```

**What NOT to take:**
- The full "eureka moment" concept (interesting but over-philosophical for execution rules).
- The WebSearch integration (svc's research skill handles external search when needed).
- The Mr. Market analogy (colorful but not actionable).

**Why this matters:**
A real scenario: the agent builds a 150-line custom rate limiter when Express has `express-rate-limit` (3 lines). The custom version ships, passes tests, but has edge cases the library handles. The agent spent 150 lines of context budget and introduced maintainability debt — all because it didn't check Layer 1 first.

---

### 8. Test framework bootstrap → `execute-changeset/SKILL.md`

**From:** gstack `ship/SKILL.md` Steps B2-B8, `qa/SKILL.md` test bootstrap
**Into:** `execute-changeset/SKILL.md` Step 1 (before task execution begins)

**The problem in svc today:**
execute-changeset's TDD loop assumes a test runner exists: "write the test FIRST, run it (must FAIL)." In greenfield projects or brownfield projects without test infrastructure, step 1 fails — there's no test command to run. The agent either (a) skips TDD entirely and writes code without tests, or (b) tries to install a test framework mid-task and loses coherence. Neither outcome is acceptable.

**How the source solves it:**
gstack's /ship and /qa have a test bootstrap pipeline (B2-B8):
- B2: Detect existing framework (`package.json` scripts, `pytest.ini`, `Gemfile`, etc.)
- B3: If none found, install one (detect language, pick standard framework)
- B4: Write a trivial passing test to verify the runner works
- B5: Verify `<test-command>` exits 0

This runs before any feature tests. The TDD loop always has a working runner.

**What this changes in svc:**
Add to execute-changeset Step 1 (Read the manifest and confirm branch state), after "Verify the branch is clean":

```
**1f. Verify test infrastructure:**
1. Run the manifest's validation command (dry run)
2. If it fails with "command not found" or "no test runner":
   a. Detect language from manifest file extensions
   b. Install standard test framework:
      - JS/TS: vitest or jest (check package.json for preference)
      - Python: pytest
      - Ruby: rspec or minitest
      - Go: built-in (no install needed)
   c. Write a trivial passing test (e.g., `test('true is true', () => expect(true).toBe(true))`)
   d. Run validation command again — must pass
3. If it passes: proceed to task execution

Do not start TDD without a working test runner. This check is idempotent —
it's a no-op when test infrastructure already exists.
```

**What NOT to take:**
- B6 (full suite), B7 (coverage report), B8 (document patterns) — these are /ship concerns, not execution concerns. svc handles coverage at verify-promotion.
- The health score rubric (svc doesn't need a quality dashboard).
- The CI/CD bootstrap (out of scope for execution).

**Why this matters:**
In greenfield, the first task's TDD cycle determines whether the entire feature gets tested. If the agent can't run tests at task 1, it writes all 10 tasks without tests, then tries to add tests retroactively — which is dramatically less effective than TDD. The bootstrap ensures TDD works from task 1.

---

## Skipped items

| External | Reason for skip |
|----------|----------------|
| `devex-review` + `plan-devex-review` | Full new skills, not patterns. svc has no DX dimension — would need new lane position, new gate. DEFER to future skill creation |
| `pair-agent` | Multi-agent browser sharing — svc's architecture doesn't need it |
| `open-gstack-browser` (headed mode) | Implementation detail of browse daemon, not a methodology pattern |
| `design-html` (Pretext) | Adds OpenAI dependency, svc's text-based component specs are sufficient |
| `benchmark` (performance regression) | Project-specific, not pipeline-critical |
| `checkpoint` (save/resume) | svc's .continue-here.md + progress.md are sufficient |
| `document-release` (post-ship doc sync) | verify-promotion covers spec-sync, general doc update is project-specific |
| `health` (code quality dashboard) | Nice-to-have, not pipeline-critical |
| `autoplan` (auto-review pipeline) | svc's progressive chaining covers this |
| Design tool (`$D` GPT Image API) | Adds OpenAI dependency, text-based design is sufficient for svc |
| Chrome extension + sidebar | Implementation artifact, not a methodology pattern |
| Template resolvers | Different architecture — svc skills are self-contained markdown |
| Team mode auto-update | Install method is locked decision |
| Content security layers | svc browses own app (test-journeys), not untrusted web |
| Multi-host declarative config | svc's provisioning already works for 2 hosts |
| Conductor parallel sprints | No equivalent architecture in svc |
| `retro` (weekly retrospective) | Interesting but svc is a pipeline framework, not a team management tool |

## Rethink: past blend reassessment

### Blended patterns reassessed

| Pattern | svc skill | Verdict | Action |
|---------|-----------|---------|--------|
| P0 founder persona | route-workflow | Solid. Working well | KEEP |
| Adversarial CEO/design/eng reviews | review-gate | Working. Review Army (blend #1) upgrades this at audit-implementation level | KEEP + EXTEND |
| /cso OWASP + STRIDE | review-security | Working | KEEP |
| /learn institutional memory | manage-learnings | svc added 3-question quality gate — now better than gstack's /learn | KEEP (svc improved) |
| /browse headless browser | test-journeys, track-visuals, write-e2e | Working | KEEP |
| /investigate debugging | diagnose-bug | svc added diagnostic instrumentation + escalation reframe from superpowers | KEEP (svc improved) |
| /ship PR workflow | land-changeset | Working but missing plan completion audit — blend #2 addresses this | KEEP + EXTEND |
| /canary post-deploy | verify-promotion | Working | KEEP |
| /design-consultation + /design-shotgun | design-ui | Working but missing AI slop guard — blend #5 addresses this | KEEP + EXTEND |

### Skipped patterns reconsidered

| Pattern | Original skip reason | Reassessment | Action |
|---------|---------------------|--------------|--------|
| (no patterns were explicitly skipped in the first blend — registry had empty skipped list) | — | — | — |

## Attribution update

Add to NOTICES under gstack entry:
- Review Army specialist dispatch pattern (7 parallel specialists with adaptive gating)
- Plan completion audit (DONE/PARTIAL/MISSING task-level verification)
- Scope drift detection (diff-vs-manifest comparison)
- Failure ownership triage (branch/pre-existing/flaky categorization)
- AI Slop blacklist (10-item design anti-pattern list)
- Completeness principle (Boil the Lake)
- Search Before Building discipline (3-layer knowledge check)
- Test framework bootstrap (B2-B5 detection and installation)
