## Lane Model

### Pre-lane skills (operate ABOVE the 7-lane model)

Certain svc skills operate BEFORE lane classification. Their output recommends which lane + skill to invoke next. Do not try to classify these into an existing lane.

| Skill | Role | Output |
|---|---|---|
| `strategic-decision` | N-way strategic trade study (vendor/architecture/pricing choice spanning multiple features or years) | `docs/specs/decisions/<slug>/DECISION.md` with explicit "Next skill to invoke" routing downstream into a lane |

Pre-lane skills are reached via `skills/route-workflow/references/intent-routing.md` and chain into whichever lane their DECISION.md recommends. They are deliberately not part of any lane's progressive-mode chain because they change the shape of the work before lane selection happens.

### Universal Verification Principle (applies to ALL lanes)

**Every lane that changes code (`src/`, `base44/functions/`, or equivalent) MUST include runtime verification before closing.** No exceptions. No "deferred to deploy." No "pure deletion so it's safe."

#### Minimum-Path Scoping (start narrow, escalate if needed)

**Always start with the narrowest test that covers the change.** Never run the full E2E suite (500+ tests, 50+ min) when a single targeted spec would suffice. Escalate scope only when the narrow test fails or when the change is genuinely broad.

**Scoping decision tree:**

```
1. Identify changed files from the diff
2. Map each changed file to the pages/endpoints that USE it
3. Pick the MINIMUM set of tests/checks that exercise those pages/endpoints
4. Run that minimum set FIRST
5. If it passes → verification complete
6. If it FAILS → escalate:
   a. Run related specs (same journey/feature area)
   b. If those fail too → run full suite
   c. Root-cause the failure before declaring the change safe
```

**Scoping examples:**

| Change | Narrow verification (do this) | Over-scoped (don't do this) |
|---|---|---|
| Removed `initialData:[]` from `Deals.jsx` | `npx playwright test deals` or visit `/deals`, verify data loads | Run all 500+ E2E tests |
| Changed a shared hook (`useFollowedLocations`) | Visit 2-3 pages that use the hook, verify data | Run full suite |
| Modified `secureOperation.ts` (backend, 30+ callers) | Run smoke E2E for 3 representative journeys (owner, employee, customer) | Still don't run all 500+ — but scope is wider because blast radius is wider |
| Fixed a typo in `Dashboard.jsx` JSX text | Visit `/dashboard`, confirm the text | Run any E2E at all |
| Refactored query-client.js (global) | Run critical path E2E: login → dashboard → one owner page → one customer page | Full suite IS justified here — global change |

**The rule:** verification cost should be proportional to blast radius. A 1-file deletion gets a 1-page smoke. A global config change gets a critical-path E2E. Only genuinely cross-cutting changes justify the full suite.

#### Verification Tier Table

| Change scope | Minimum verification | Acceptable forms |
|---|---|---|
| User-facing pages/components changed | Targeted E2E or manual smoke of affected pages | `npx playwright test <specific-spec>`, or manual page visit with pass/fail logged |
| Backend functions changed | API call test on affected endpoint | `curl` test, targeted E2E that exercises the endpoint |
| Query/data layer changed (hooks, contexts, stores) | Page smoke on 2-3 pages that use the changed query | Visit pages, verify data loads, log results |
| Shared infrastructure (auth, routing, query-client) | Critical-path E2E across representative journeys | `npx playwright test critical/` or manual smoke of login → dashboard → key pages |
| Config/build only | Build + dev server start | `npm run build` + `npm run dev` + verify app loads |
| Docs/specs only (no `src/` changes) | Skip allowed | Log: "no code changes, verification skipped" |

#### Escalation Protocol

If the minimum-path test **fails**:
1. Don't retry blindly — read the failure
2. Run the next-wider scope (related specs in the same journey area)
3. If that also fails — the change has a broader impact than expected; run critical-path or full suite
4. Log: what scope was tried, what failed, what the escalation revealed

If the minimum-path test **passes**: verification is complete. Do not run wider tests "just to be safe" — that's wasted time with no diagnostic value.

#### Anti-Patterns

- **"Run full suite to be safe"** — proportional verification, not maximal
- **"Deferred to deploy"** — not verification; execute before lane closes
- **"Pure deletion so it's safe"** — still needs a page visit to confirm nothing broke
- **"No E2E exists for this page"** — then manual smoke IS the verification; log what you visited and what you saw

### Conditional On-Demand Skills

These skills are not part of the linear lane pipeline. They auto-invoke when their trigger signal is detected by the lane or by a skill within the lane. The lane executor or the invoking skill MUST check the signal before proceeding; if the signal is present, insert the on-demand skill into the task graph at the appropriate position and update `blocked_by` dependencies.

| Skill | Trigger Signal | Auto-invoked from | Insertion Point |
|-------|---------------|-------------------|-----------------|
| `solution-confidence-protocol` | User asks for "best solution", "right design", "all cards on the table", "golden standard", real-world examples, cost/cache grounding, "by design auto", or high-stakes design has UI + data/cost/cache/native implications | `route-workflow`, `design-tech`, `explore-solutions`, delivery graph compiler/validator | Confidence protocol. Set `solution_confidence_required: true` plus `solution_confidence_mode`. Default `design_auto`: skills/research/design/exploration/planning/implementation are actionable through the normal lane once `docs/specs/decisions/<slug>/SOLUTION-CONFIDENCE.md` selects a direction. Use `post_design_human_gate` only when the user explicitly asks to wait/review/approve after design; the compiled graph blocks `plan-changeset` until approval. Use `intake_only` only when the user explicitly asks not to design/decide yet. |
| `research` | Unknown API, pattern, framework version, or domain concept; knowledge base has no answer | `analyze-domain`, `design-tech`, `execute-changeset`, `validate-feature`, `improve-framework` | Inline before the skill step that needs the answer; blocks the dependent step until research completes |
| `manage-finops` | Cost/hosting/infrastructure question unanswered; external APIs or hosting selection needed | `validate-feature` (Q7), `design-tech` (Cost Model pillar) | After the question is identified; blocks downstream cost-dependent decisions |
| `monetization-architecture` | Pricing tiers, freemium, subscriptions, or paywall boundaries mentioned | `validate-feature`, `design-tech` | After feature approval / during tech design when tier gating is in spec; blocks execute-changeset until gating matrix exists |
| `review-cross-model` | `review-gate` findings include HIGH/CRITICAL severity on new data models, external integrations, auth, or payment flows | `review-gate` | After review-gate if residual risk detected; blocks land-changeset until convergence |
| `roadmap-evaluation` | "What's next?" asked; zero active task graphs; milestone just closed | `route-workflow`, `verify-promotion` | After verify-promotion of last WI in milestone, or when route-workflow detects no actionable work |
| `assess-market-readiness` | Milestone complete; no active WIs; readiness score unknown | `route-workflow`, `verify-promotion` | After last WI closes; produces readiness score that gates launch vs continue-building decision |
| `find-opportunity` | Ship Brief = NO-SHIP; builder needs revenue-generating alternatives | `validate-feature` | Immediately after NO-SHIP decision; blocks re-routing until alternatives table exists |
| `stage-revenue` | Timeline > 2 weeks + no proven revenue model + limited capital | `validate-feature`, `route-workflow` | After validate-feature when capital-risk profile matches; produces Stage 1/2/3 plan |
| `analyze-marketing` | SHIP decision made; competitive differentiators or product-market fit angles discovered | `validate-feature`, `write-spec` | After feature approval or Layer 3 spec completion; blocks launch-prep until marketing context exists |
| `strategic-decision` | N-way trade study with ≥3 viable options and multi-feature/year impact | `route-workflow` | **Pre-lane** — before any lane selection; emits DECISION.md that names the downstream lane |
| `plan-capabilities` | First session; empty or missing `capability-registry.json`; unrecognized project type | `route-workflow`, `onboard-repo` | Before first lane execution; blocks downstream work until capability inventory exists |
| `mine-builder` | First interaction; missing `~/.svc/builder-profile.md`; or post-project update needed | `route-workflow`, `verify-promotion` | At session start if profile missing; or after project ships in Mode 3 (post-project update) |
| `platform-operating-architect` | Platform signals detected (Base44, Vercel, Supabase, Firebase deps) and no `docs/specs/platform-operating-model.md` | `route-workflow`, `onboard-repo` | Before first lane execution if platform-heavy; blocks downstream work until operating model exists |
| `evaluate-rule` | Blended rule pack has stale `source_sha` or `last_evaluated` > 90 days; or new rule proposed | `blend-external`, `improve-framework` | After blend phase 4.5 or after rule pack proposal; blocks rule registration until evaluation passes |

**Insertion rules:**
1. On-demand skills are inserted as **new tasks in the existing lane's task graph**, not as new lanes.
2. The inserting skill MUST set `blocked_by` so the on-demand skill blocks the step that depends on its output.
3. If the trigger signal is absent, the on-demand skill is **not inserted** — no skip reason needed.
4. If the on-demand skill's output changes the lane shape (e.g., `strategic-decision` selects a different lane, `find-opportunity` routes to a new feature), the inserting skill MUST update the lane-tasks JSON and log a `taste` decision to `pipeline-decisions.jsonl`.

### Delivery Graph Initial Compilation Rules (WI-298)

At lane entry, `route-workflow` compiles a `delivery_graph` before any downstream
mutating skill starts. The compiler begins with the selected lane's base skill
list, then inserts conditional mandatory skills from risk/platform signals, then
records any explicit N/A evidence in `skipped_skills`.

| Signal | Compiler effect |
|---|---|
| `change_type=feature` on `brownfield-feature` | require product, AC, journey, plan/review, code review, audit, and promotion evidence families |
| `change_type=framework` on `framework` | require `improve-framework`, `review-gate`, `test-framework`, and `verify-promotion` |
| `browser-visible` | insert `track-visuals`; mark visual evidence `required` |
| `user-facing` or `admin-facing` | insert `test-journeys`; mark runtime evidence `required` |
| `change_type=feature` plus `user-facing` or `admin-facing` | insert `build-personas` and `write-e2e`; mark `feature_validation_closeout` evidence `required`; if a manual graph bypasses the compiler, `scripts/task-graph.mjs validate` requires either `build-personas` or top-level `persona_coverage` with an artifact/skip rationale |
| `backend-function`, `external-integration`, `data-model-change`, or `concurrency` | insert `design-tech` and `audit-implementation` if not already present |
| `auth-sensitive` | insert `review-security` |
| `base44-platform` or `base44-environment` platform contract | insert `base44-environment`; mark deploy evidence `required` |
| `deploy-affecting` | mark production/platform verification `required`; insert `base44-environment` when Base44 is present |
| `retroactive` or `graph-mismatch` | insert `audit-session-execution`; mark session-forensics evidence `required` |
| `change_type=docs` or `docs-only` | mark product/runtime/visual/deploy evidence `n/a` and add skip-ledger entries for visual/runtime skills |

The compiler helper is:

```bash
node scripts/compile-delivery-graph.mjs \
  --wi WI-123 \
  --lane brownfield-feature \
  --change-type feature \
  --intent "normalized user goal" \
  --risk-flags browser-visible,user-facing \
  --out .svc/lane-tasks-WI-123.json
```

The output is still a normal `.svc/lane-tasks-<WI>.json` file. The
`delivery_graph` block explains why the tasks exist and becomes the source for
later graph mutation and closeout classification.

For user/admin-facing feature work, closeout is not a set of loose receipts.
The graph must close `feature_validation_closeout` by producing
`docs/specs/features/test-evidence/<run>/FEATURE_VALIDATION_LEDGER.md` and
passing:

```bash
node scripts/validate-feature-closeout-ledger.mjs \
  --feature docs/specs/features/<feature>.md \
  --ledger docs/specs/features/test-evidence/<run>/FEATURE_VALIDATION_LEDGER.md
```

The ledger is the AC-by-AC connector across `validate-feature`, `write-spec` or
`sync-spec-code`, `audit-ac`, `build-personas`, `write-journeys`, `write-e2e`,
`test-journeys`, `track-visuals`, `review-gate`, and `verify-promotion`.
Downstream skills may skip only with evidence recorded in the ledger row that
depends on the skipped output.

If no delivery graph exists because the task graph was manually created, the
same feature-class persona rule still applies: include `build-personas` or a
top-level `persona_coverage` decision before `write-spec`, `write-journeys`,
`design-ux`, `design-ui`, or planning can be treated as framework-valid.

### Lane 1: Greenfield Feature

Use when:
- mode = `bootstrap`
- the repo is clean or effectively clean
- behavior is still being discovered

Route:
1. `write-vision`
2. `analyze-domain`
3. `analyze-competitors`
4. `build-personas`
5. `validate-feature`
6. `write-spec`
7. `audit-ac`
8. `write-journeys`
9. `design-ux`
10. `design-ui`
11. `track-visuals` (baseline for browser-visible features)
12. `design-tech`
13. `explore-solutions`
14. `define-code-style`
15. `plan-changeset`
16. `execute-changeset`
17. `track-visuals` (diff for browser-visible changes)
18. `review-gate`
19. `audit-implementation`
20. `land-changeset`
21. `verify-promotion`

### Lane 1b: Auto Greenfield ("build me an app")

Use when:
- mode = `bootstrap`
- the prompt is effectively "build me an app"
- there is no meaningful existing repo state to preserve

Behavior:
- run the greenfield lane end-to-end automatically
- stop only for real blockers, contradictions, or missing product intent that cannot be safely assumed

### Lane 2: Brownfield Conversion

Use when:
- mode = `convert`
- the repo has not yet been mapped into svc working mode

Route:
1. `onboard-repo`
2. `sync-work-items` if the team wants GitHub visibility
3. route each resulting item by type

### Lane 3: Brownfield Feature Extension

Use when:
- mode = `convert`
- the repo is already mapped
- the item type is `feature`

Route:
1. `sync-spec-code`
2. `validate-feature`
3. `write-spec` in delta mode
4. `write-journeys` in expand mode
5. `design-ux` when the change affects screens, flows, accessibility, or responsive behavior
6. `design-ui` when the change affects visual layout, components, or breakpoint behavior
7. `track-visuals` in baseline mode when UI design is updated for a browser-visible feature
8. `design-tech`
9. `explore-solutions`
10. `define-code-style`
11. `plan-changeset`
12. `execute-changeset`
13. `track-visuals` in diff mode when browser-visible UI changed
14. `review-gate`
15. `audit-implementation`
16. `land-changeset`
17. `verify-promotion`

Pure background Enabler/Integration work may explicitly skip `design-ux`, `design-ui`, and `track-visuals`, but user-facing or admin-facing changes must not bypass them.

**Pillars Coverage Matrix (mandatory, Lane 1 + Lane 3):** every feature spec produced by this lane — greenfield or extension — MUST end with a complete Pillars Coverage Matrix per `references/pillars-coverage-matrix.md`. All 8 pillars (product fit, journey, acceptance criteria, UX, UI, tech architecture, cost model, operations & ownership) must be populated with an explicit state: `[NEW]`, `[UPDATED]`, `[UNCHANGED — VERIFIED]`, or `[N/A — justified]`. Blank cells, TODOs, or "skipped" placeholders are a hard fail. In Lane 1, pillars are almost always `[NEW]`. In Lane 3, pillars are a mix of `[UPDATED]` / `[UNCHANGED — VERIFIED]` / `[N/A — justified]` — but every cell must be explicit. Lane 3's "pure background" exception applies only to UX, UI, and Cost, and only with a specific justification; journey, AC, tech architecture, and operations are NEVER skippable in Lane 3.

### Lane 4: Bugfix / Regression

Use when:
- item type is `bugfix` or `regression`
- behavior is wrong, broken, or changed unexpectedly

Route:
1. `diagnose-bug` — MUST produce: root cause, **pattern scan** (grep the codebase for the same class of defect elsewhere), **Pillar Revisit Audit** (walk all 8 pillars per `references/pillars-coverage-matrix.md` — product fit, journey, AC, UX, UI, tech architecture, cost model, operations & ownership — and mark each affected/unaffected with evidence), **register discoveries** (Process Step 5.5 — evaluate if findings decompose into multiple independent WIs, create WI files + update INDEX, route `**Next:**` to highest-priority child), affected-artifact impact list (specs, journeys, ACs, tests), and learnings (rule/feedback-memory that would have prevented the bug). If the Pillar Revisit Audit surfaces pillar(s) affected beyond the code fix itself, the audit output MUST file a follow-up WI routed to the correct lane (Lane 3 for UX/UI/tech changes, Lane 5 for spec drift, `validate-feature` re-run for product-fit doubts) OR bundle the update into the current bugfix if scope and safety allow.
2. `plan-changeset` if a formal implementation plan is needed
3. `execute-changeset`
4. `review-gate`
5. `write-e2e` or `test-journeys` — **MANDATORY for any user-facing or admin-facing surface** (anything a customer, employee, or operator interacts with in a browser, mobile app, or CLI they invoke directly). Runtime verification with a real fixture (test image, test input, real API call) is the only acceptable evidence. Source-grep assertions, type-checks, and lint passes do NOT satisfy this step — they verify shape, not behavior. Background jobs / internal enablers / pure data-layer fixes may skip this with an explicit justification logged in `pipeline-decisions.jsonl`.
6. `land-changeset`
7. `verify-promotion` — production runtime smoke on every affected surface
8. **Close WI** — update WI file `**Status:**` to `VERIFIED`, update `docs/specs/work-items/INDEX.md` row to `VERIFIED`, update `docs/specs/project-state.md` `Current Focus` if the file exists, append learnings to feedback memory, and **append the final routing decision to `.svc/pipeline-decisions.jsonl`**. **Journey tag promotion (conditional):** if `write-e2e` or `test-journeys` ran in this lane and produced passing evidence for scenarios documented in `docs/specs/journeys/J*.feature.md`, promote verified ACs from `[SPEC]` → `[LIVE]` in those journey files before closing. Run `node scripts/check-journey-tags.ts` (if it exists) after promotion to audit counts. Skip if the WI has no journey-level scenario coverage. This step has no skill invocation — it is a chore executed after `verify-promotion` passes.

**Auth-Sensitive Classifier — MANDATORY before writing the Lane 4 task graph**

`review-gate` is a general code review. It is not an adversarial threat model. For changesets that touch authorization, authentication, or access-control boundaries, `review-gate` alone is insufficient — privilege-escalation vectors, session-token handling, and CSRF/origin validation need `review-security`.

Before writing `.svc/lane-tasks-<WI>.json`, classify the WI as auth-sensitive or not. If **any** of the signals below match, force-insert `review-security` as **step 4.5** (between `review-gate` and `write-e2e`) and record the classification trigger in the task graph's `flags` array as `"auth-sensitive:<signal>"`.

**File-path signals (target files of the changeset, if known):**

| Pattern | Example |
|---|---|
| `**/auth/**`, `**/secure*`, `**/validate*`, `**/csrf*` | `src/auth/`, `secureOperation`, `validateUserType` |
| `**/functions/*auth*`, `**/functions/*secure*`, `**/functions/*validate*` | `base44/functions/secureCheckIn`, `base44/functions/validateAction` |
| Middleware/guard layers: `**/middleware/**`, `**/guards/**`, `**/permissions/**` | generic auth middleware |
| Session/cookie/JWT handling: `**/session*`, `**/jwt*`, `**/cookie*`, `**/token*` | |

**Code-signal signals (grep target files AND diff, if available):**

| Pattern | What it catches |
|---|---|
| `user.user_type`, `user.role`, `user.permissions` | Role-based access check |
| `asServiceRole`, `adminClient`, `privileged(` | Elevated-privilege path |
| `Response.json({ error: 'Unauthorized'` / `status: 401` / `status: 403` | Explicit auth guard |
| `req.auth`, `verifyToken`, `decodeJwt`, `validateOrigin` | Request-level auth |
| `Employee.create`, `TeamMember.create`, `User.update({user_type` | Entity writes that encode role |

**Text signals (WI title + body):**

| Pattern | Example |
|---|---|
| "auth", "authorization", "authentication", "permission", "privilege", "access control" | WI title mentions any of these |
| "invite", "onboard", "role assignment", "self-registration" | WI touches identity boundaries |
| "rate limit", "csrf", "spoof", "session hijack", "escalation" | WI touches attack-surface |

**When any signal matches — insert step 4.5 in the task graph:**

```json
{
  "id": 4.5,
  "skill": "review-security",
  "subject": "review-security: adversarial threat-model for auth-sensitive change in <WI>",
  "status": "pending",
  "conditions": "MANDATORY — classifier triggered by <signal>. Blocks step 5 (write-e2e) until PASS.",
  "blocked_by": [4]
}
```

And update step 5's `blocked_by` to `[4.5]`. Add `"auth-sensitive:<signal>"` to the graph's top-level `flags` array so the trigger is auditable.

**Do NOT skip this classifier because the fix looks small.** The WI-054 case (single-line change to `atomicEmployeeCreate` owner guard) is the archetype: a one-line relaxation of an auth check can open a privilege-escalation path if not adversarially reviewed. The classifier catches this exact pattern.

**Scope note:** this classifier applies in Lane 4 (bugfix) and Lane 3 (feature) when the change touches auth boundaries. For Lane 5 (drift), auth-sensitive spec corrections are already rare and `review-security` can be invoked manually.

---

**Runtime-validation-before-threat-model gate (inserted 2026-04-14 per proposal `2026-04-14-evolution-wi054-session.md` P0-1):**

When the auth-sensitive classifier fires AND the code has already shipped (task 3 `execute-changeset` is `completed`, OR the lane is retroactive, OR the platform auto-deploys from the same commit that lands the fix — e.g. Base44 backend functions from `git push`), ALSO insert `test-journeys` as step 3.5 BEFORE `review-security`.

```json
{
  "id": 3.5,
  "skill": "test-journeys",
  "subject": "test-journeys: runtime validation on the affected journey before threat model",
  "status": "pending",
  "conditions": "MANDATORY — auth-sensitive + shipped code. Journey scope = the journey whose AC the fix is supposed to restore. Blocks step 4.5.",
  "blocked_by": [3]
}
```

And update step 4.5 `review-security` `blocked_by` from `[4]` (or `[3]`) to `[3.5]`.

**Why:** `review-security` is a threat model — expensive, high-cognition. A threat model on code that doesn't actually function is wasted work. If the fix is broken, the security review's conclusions don't apply to the real behaviour; you'd re-run it after fixing. Runtime validation is the cheaper gate: it takes one journey play-through (~5 min via `browse` daemon) and either confirms the fix works or sends the lane back to `diagnose-bug`. WI-054 case: the fix shipped to prod via Base44 auto-deploy before `review-security` could run; inserting `test-journeys` at 3.5 caught one adjacent defect (WI-056, portal first-render race) and proved the atomic creation flow works before threat-modeling began.

**Scope:** this additional insertion applies ONLY when both conditions hold: (a) auth-sensitive classifier fired, (b) the fix has shipped or will ship on the same push as the final commit. For non-shipped auth-sensitive changes, step 4.5 `review-security` remains blocked_by step 4 `review-gate` as before — the runtime gate comes later at step 6 `write-e2e`.

**Detection of "shipped":** inspect the changeset's target paths against the project's `router-context.md` deploy matrix. If any path is in a category that auto-deploys from `git push` (Base44 backend functions, Vercel-on-push repos, Cloudflare Workers with git integration, etc.), treat the post-commit state as shipped.

**Retroactive Lane 4 Execution** (when the fix was already committed outside the framework):

Sometimes a bugfix lands in `main` before the lane ran — a developer fixed it in an earlier session, another agent fixed it without routing, or an out-of-band hotfix went in. Do NOT treat this as "done" just because code is committed. Do NOT propose a new close-out skill — the same Lane 4 applies, run retroactively:

**MANDATORY FIRST ACTION (before any diagnostic work):** Create `.svc/lane-tasks-<WI>.json`. The task graph is not optional retroactively — it is the enforcement mechanism. Without it, the stop hook cannot block premature completion, the eval gate hook cannot enforce the Pillar Revisit Audit, and INDEX.md will not get a close-WI step. Create the graph, THEN diagnose.

| Step | Retroactive meaning |
|---|---|
| 1. `diagnose-bug` | Read the committed diff + every affected caller. Produce root cause, pattern scan, affected-artifact list, learnings — same contract as forward execution. If the commit is missing information (no message explaining WHY), diagnose-bug MUST still produce the brief from the code alone. |
| 2. `plan-changeset` | Skip unless the committed fix is incomplete. If diagnose-bug finds the brief prescribes MORE than what was committed (e.g., pattern scan found 3 other broken components), plan-changeset covers the delta. |
| 3. `execute-changeset` | Only for the delta (step 2). If the committed fix is complete, skip. |
| 4. `review-gate` | Gate the committed diff retroactively. PASS/FAIL on: does the commit match what diagnose-bug's brief would have prescribed? |
| 5. `write-e2e` / `test-journeys` | **Still mandatory for user-facing surfaces.** The fact that the fix is already in `main` does not waive runtime verification. Write or update the e2e, run it, confirm it passes. |
| 6. `land-changeset` | Verify landing was complete: lint passes, assertion scripts wired into `npm run check` or pre-commit, CI green. |
| 7. `verify-promotion` | Production runtime smoke. |
| 8. **Close WI** | Update WI file `**Status:**` to `VERIFIED`. Update `docs/specs/work-items/INDEX.md` row to reflect `VERIFIED`. Update `docs/specs/project-state.md` `Current Focus` if it exists. Append learnings to feedback memory. Append final routing decision to `.svc/pipeline-decisions.jsonl`. **Journey tag promotion (conditional):** if `write-e2e` or `test-journeys` ran and produced passing evidence for scenarios in `docs/specs/journeys/J*.feature.md`, promote `[SPEC]` → `[LIVE]` in those files and run `node scripts/check-journey-tags.ts` (if it exists). |

Only after all eight retroactive steps pass may the work item be marked `done`. The retroactive path is not a shortcut — it is the same lane, executed on a different timeline.

**Pillars Coverage Matrix (mandatory, Lane 4):** every bugfix brief — forward or retroactive — MUST end with a Pillars Coverage Matrix per `references/pillars-coverage-matrix.md`. The matrix shows, for each of the 8 pillars, its post-fix state: `[UPDATED]` (the fix changed this pillar), `[UNCHANGED — VERIFIED]` (actively checked, confirmed still correct), or `[N/A — justified]` (specific reason). **`[UNCHANGED — VERIFIED]` is not a free pass** — it means an agent opened the artifact, read it, and confirmed the fix does not contradict it. "I didn't think about it" is not verification. A bugfix whose matrix has any blank cell, TODO, or un-verified `[UNCHANGED]` claim is a hard fail at `review-gate`.

### Lane 5: Drift / Maintenance

Use when:
- item type is `drift`
- specs, journeys, and code disagree

Route:
1. `sync-spec-code`
2. selective spec or code remediation
3. `write-journeys` refresh if user flows changed
4. `test-journeys` or `write-e2e` — **verification is mandatory when code files changed.** Even "pure deletion" or "mechanical cleanup" changes can break behavior in unexpected ways. If the drift remediation only touched spec/doc files (no `src/` changes), skip with explicit justification. Otherwise: run E2E for user-facing surfaces, or manual smoke check with documented results (page visited, what was verified, pass/fail). "Deferred to deploy" is NOT acceptable — verification must happen before the lane closes.
5. `sync-work-items` if tracker visibility matters
6. **Close WI** — update WI file `**Status:**` to `VERIFIED`, update `docs/specs/work-items/INDEX.md` row to `VERIFIED`, update `docs/specs/project-state.md` `Current Focus` if it exists, append learnings to feedback memory, and **append the final routing decision to `.svc/pipeline-decisions.jsonl`**. **Journey tag promotion (conditional):** if `write-e2e` or `test-journeys` ran in this lane with passing evidence for scenarios in `docs/specs/journeys/J*.feature.md`, promote `[SPEC]` → `[LIVE]` in those files. Skip promotion if the WI is doc-only with no runtime verification.

### Lane 6: Refactor / Chore

Use when:
- item type is `refactor` or `chore`
- behavior should stay materially the same, or the work is primarily structural/state-management

**Browser-visible check (MANDATORY FIRST STEP):** Before building the Lane 6 task graph, inspect the WI's planned file set. If ANY of the following are true, the change is browser-visible and `track-visuals` baseline + diff MUST be inserted into the task graph:

- Any `.jsx` / `.tsx` / `.vue` / `.svelte` / `.html` / `.css` / `.scss` / `.module.css` file is modified
- Any `className` string is added, removed, or changed (even if JS behavior is unchanged)
- Any Tailwind utility, design token, or theme variable is touched
- Any SVG / image / icon / asset is swapped

"Mechanical class additions" IS browser-visible. CSS changes ARE browser-visible. "No JS behavior change" does not imply "no visual change." Do NOT conflate the two.

If browser-visible: insert `track-visuals` baseline before `execute-changeset` and `track-visuals` diff after `execute-changeset` in the task graph below. Each task description must include `WI: <WI-ID>` and feature spec path (per Step 5 mandatory-step validation).

If NOT browser-visible: log an explicit `SKIP: not browser-visible because [specific reason — e.g., 'pure CI config change', 'docs-only update']` in the lane decision log.

Route (baseline — insert track-visuals steps per the check above):
1. `sync-spec-code` if behavior invariants or current truth are unclear
2. `plan-changeset`
3. **`track-visuals` (baseline mode)** — if browser-visible
4. `execute-changeset`
5. **`track-visuals` (diff mode)** — if browser-visible
6. `review-gate`
7. `land-changeset`
8. `test-journeys` or `write-e2e` — **verification is mandatory when code files changed.** Refactors and chores that change code MUST verify no regressions. Run E2E for user-facing surfaces, or manual smoke check with documented results. Skip ONLY if the change is purely docs/config with no `src/` impact — log the skip reason explicitly.
9. `verify-promotion` — always run when code was changed. Not conditional.
10. `sync-work-items` if tracker visibility matters
11. **Close WI** — update WI file `**Status:**` to `VERIFIED`, update `docs/specs/work-items/INDEX.md` row to `VERIFIED`, update `docs/specs/project-state.md` `Current Focus` if it exists, append learnings to feedback memory, and **append the final routing decision to `.svc/pipeline-decisions.jsonl`**. **Journey tag promotion (conditional):** if `write-e2e` or `test-journeys` ran in this lane with passing evidence for scenarios in `docs/specs/journeys/J*.feature.md`, promote `[SPEC]` → `[LIVE]` in those files. Skip promotion for doc-only or config-only chores.

### Lane 7: Framework / svc Self-Improvement

Use when:
- The repo under discussion is **svc itself**
- The work improves the framework, its skills, hooks, rules, tests, or documentation
- The work is NOT about using svc on another project (that routes to lanes 1–6)

**This lane is a decision tree, not a linear pipeline.** Framework work is classified by use case before routing. See [references/framework-policy.md](references/framework-policy.md) for the full svc-on-svc classification matrix.

**Framework Work Classification (MANDATORY FIRST STEP):**

| Use case | Start skill | Autorun behavior |
|---|---|---|
| Known framework gap, pending proposal, or implementation-ready finding | `improve-framework` | Auto-execute if evidence exists. Human checkpoint if plan touches >2 files or >50 lines (plan-changeset discipline). |
| Broken framework behavior or regression | `diagnose-bug` | Auto-execute diagnosis. Human checkpoint if root cause affects multiple skills or requires architectural change. |
| New framework capability or deliberate behavior change | `write-spec` | **Always human checkpoint.** New framework capabilities need spec review before implementation. |
| Concrete session/WI replay forensics | `audit-session-execution` | Auto-execute if session log exists. Human checkpoint if findings require multi-skill changes. |
| Unknown gaps, prioritization, or proof that svc works | `test-framework` or `evolve-framework` | Auto-execute evidence gathering. Human checkpoint before any implementation. |
| Import patterns from external repo | `blend-external` or `blend-private` | **Always human checkpoint.** External code import is high-risk. |

**Universal Framework Rules (apply to ALL framework work):**

1. **Plan-changeset discipline:** Apply `rules/plan-changeset-trigger.md` before implementation. Framework changes with a contract change, hot-path behavior change, or refactor-without-behavior-change MUST route through the normal svc pipeline (`write-spec` → `plan-changeset` → `execute-changeset` in a worktree). Pure additive and documentation-only exemptions from that rule may land directly with a recorded rationale.
2. **Host capability verification:** Before implementing any host-specific feature (hooks, CLI integration, host-dependent scripts), verify current host capabilities via `research`. Do not rely on training data for host API surface.
3. **explore-solutions is mandatory** when `design-tech` introduces a hard-to-reverse architecture choice: new task-state backend, new host abstraction layer, new external dependency, new persistence model.
4. **Runtime verification:** Even framework-only changes must pass `bash test-framework/evals/run-all-evals.sh` before landing. No exceptions.
5. **Framework review-gate policy:** Apply the Lane 7 review-gate classifier below before merge. If any required-review signal is present, insert `review-gate` into the task graph and block landing on its PASS verdict.

#### Framework Review-Gate Policy (Lane 7)

`review-gate` is mandatory for framework changes that alter enforcement, routing, host integration, or validation behavior. Treat the gate as required when the changeset touches any of these surfaces:

| Surface | Required-review signal |
|---|---|
| Tiered evals and validators | Adds, removes, or changes tier-1 validators, tier-1.5/tier-2/tier-3 evals, eval harness behavior, validator severity, or aggregate pass/fail semantics. New tier-1 validators must also satisfy `rules/tier-1-promotion.md` with a promotion note. |
| Hooks and host adapters | Changes Stop hooks, PreToolUse/PostToolUse/UserPromptSubmit/SessionStart/SessionEnd/PreCompact/Notification hooks, files under `hooks/`, `scripts/wire-hooks.mjs`, or host-specific hook adapters. |
| Task-state and closeout enforcement | Changes task graphs, session contracts, phase receipts, lane-task validators, completion guards, stale-task handling, verification/closeout classification, review/landing/promotion enforcement, or `.svc` state writers. |
| Host integration | Adds or changes setup/provision behavior for Codex, Kimi, Claude, Gemini, OpenCode, Antigravity, Cursor, or any cross-host compatibility rule. |
| Safety and framework policy | Introduces or changes enforcement policy, safety guards, concern scanners, lock/state writers, routing classifiers, or cross-host behavior. |

Low-risk framework PRs may skip `review-gate` only when they are strictly references-only, fixtures-only, or typo/wording clarifications with no enforcement, hook, validator, routing, task-state, setup, or host behavior change. The skip MUST be logged in `.svc/pipeline-decisions.jsonl` and in the task graph with a concrete reason, for example: `review-gate-skip: references-only — clarified existing doctrine, no executable behavior changed`. If the classification is uncertain, include `review-gate`.

Required review tasks MUST be explicit in `.svc/lane-tasks-<WI>.json` and MUST bind to the skill through `metadata.skill: "review-gate"`:

```json
{
  "id": 6,
  "subject": "review-gate: framework-lane review for <WI>",
  "status": "pending",
  "blocked_by": [5],
  "metadata": {
    "skill": "review-gate"
  }
}
```

Invoke: `/review-gate` on the framework diff before `land-changeset`.

**Route (decision tree — pick the branch that matches the use case):**

- **Evidence gathering branch:** `test-framework` or `evolve-framework` → `improve-framework` → `plan-changeset` (if >2 files / >50 lines) or `route-workflow` (quick-fix retired — if ≤2 files / ≤50 lines and not host-specific, conditional stage activation applies) → `execute-changeset` → `review-gate` → `land-changeset` → `verify-promotion`
- **Bugfix branch:** `diagnose-bug` → `plan-changeset` → `execute-changeset` → `review-gate` → `land-changeset` → `verify-promotion`
- **New capability branch:** `write-spec` → `audit-ac` → `design-tech` → `explore-solutions` (if high-stakes) → `plan-changeset` → `execute-changeset` → `review-gate` → `audit-implementation` → `land-changeset` → `verify-promotion`
- **Blend branch:** `blend-external` or `blend-private` → `review-gate` → `land-changeset` → `verify-promotion`

**Close WI** — same contract as other lanes: update WI file `**Status:**` to `VERIFIED`, update `docs/specs/work-items/INDEX.md` row to `VERIFIED`, update `docs/specs/project-state.md` `Current Focus` if it exists, append learnings to feedback memory, and **append the final routing decision to `.svc/pipeline-decisions.jsonl`**. Because framework work rarely produces journey-level scenarios, journey tag promotion is usually skipped; log the skip reason explicitly.



---

## Infrastructure Lanes (added by WI-SPINE-003 per proposal `2026-04-30-infra-project-support.md`)

These 5 lanes catch infra-class work — Terraform, Kubernetes, CI/CD, IAM, observability, FinOps — that otherwise gets force-fit into product lanes with mismatched gates. They reuse the existing skill set with templates / annexes / mode flags (no new skills beyond `recall-stack-knowledge`, `plan-blast-radius`, `track-topology-diff`).

**Phase-0 of every infra-* lane is `recall-stack-knowledge`** — the Spine gate fetches stack-specific knowledge before any other skill runs, preventing rediscovery.

**All infra lanes evaluate three cross-cutting dimensions at every relevant phase** (per proposal §17): FinOps (cost envelope), Security (IAM + policy packs), Scalability (SLO + capacity headroom). Declared in `docs/specs/stack-profile.md`; mandatory spec sections via `validate-infra-spec-dimensions.sh` (added in WI-SPINE-004).

### Lane 8: Infra Greenfield

**Trigger signals:** Empty repo + `*.tf` / `Chart.yaml` / `pulumi.yaml` / `terragrunt.hcl` / `.github/workflows/` planned. User says "set up terraform", "bootstrap a k8s cluster", "scaffold pulumi", "new infra repo".

**Phase chain:**
1. `recall-stack-knowledge` (phase-0 gate) — fetches relevant `references/knowledge/domains/<stack>/` slices.
2. `plan-capabilities --mode=infra` — infra-specific inventory: IaC tool, cloud(s), k8s flavor, observability, secret manager, CI/CD platform, policy engine, cost tool.
3. `capture-idea` / `validate-feature` — frame the infra capability being built.
4. `write-spec` (with `templates/infra-feature.md` template) — SLO/RTO/RPO/blast-radius/cost-envelope/IAM-scope sections.
5. `design-ux` (with `templates/infra-topology.md`) — resource graph + trust/network boundaries.
6. `design-ui` (with `templates/infra-runbook.md`) — operator runbook (alerts, dashboards, manual procedures, rollback).
7. `design-tech` (with `references/infra-tech-design.md` annex) — provider/module/state-backend/secrets choices.
8. `review-security` (pulled forward to design phase) — IAM least-privilege, policy packs from `domains/<stack>/policy/`.
9. `plan-changeset` — consumes `terraform plan` JSON / `helm diff` output as manifest input.
10. `plan-blast-radius` — SEV tier classification; SEV-1/2 forces human checkpoint.
11. `review-security --mode=cost-impact` — Infracost gate against stack-profile envelope.
12. `review-plan` — fans out cost + security findings.
13. `execute-changeset --infra --dry-run` — mandatory dry-run; receipt gains `dry_run_artifact_path`.
14. `execute-changeset` — real apply.
15. `verify-promotion --infra` — `terraform state list` / `kubectl get all -A -o json` matches plan.
16. `review-gate` — post-apply smoke + SLO probe.
17. `track-topology-diff` — snapshot resource graph; baseline.
18. `test-journeys` (with `templates/chaos.feature.md`) — failure-injection scenarios.
19. `audit-implementation` — verify all spec sections satisfied.
20. `drift` lane scheduled — continuous drift watch.

### Lane 9: Infra Feature

**Trigger signals:** Existing infra repo + capacity/feature ask. User says "add a module", "scale this", "add a queue", "wire a new pipeline stage".

**Phase chain:** Same as Lane 8 (Infra Greenfield) but skips `plan-capabilities --mode=infra` (already populated). Stack-profile already exists; recall pulls from it.

### Lane 10: Infra Migration

**Trigger signals:** Two-system signal: "from X to Y", "replace X with Y", "migrate", "cutover", "decommission". Examples: CAST AI replacing cluster autoscaler, GHES → GHEC, Jenkins → GH Actions, CloudFormation → Terraform, Datadog → New Relic, Heroku → Render.

**Phase chain (Lane 8's chain + 4 migration-specific phases):**
- Phases 1-7 (recall through tech-design) as Lane 8.
- **Phase 5a — Source assessment** (`audit-coverage` against source) — `docs/specs/migrations/<slug>/source-state.md`. Inventory current resources, configs, secrets, RBAC, integrations, traffic, dependencies.
- **Phase 5b — Target design** — `target-state.md` + `mapping.md` (resource-by-resource).
- **Phase 5c — Cutover plan** (`design-ui` cutover-runbook variant) — phased cutover (typically dual-run → shadow → percentage rollout → flip → decommission), each phase with rollback procedure.
- Phases 8-19 (review through audit) as Lane 8.
- **Phase 20+ — Decommission** (migration-only, after drift watch). Removes source system, archives final state. `decommission-receipt.md` archived. Required to close the WI.

### Lane 11: Infra Incident

**Trigger signals:** Pager / incident ID / explicit "production down" / drift causing outage. User says "production is down", "rollback the deploy", "tighten this IAM now".

**Phase chain:** Compressed from Lane 8 — recall + diagnose + plan-blast-radius + dry-run + apply + verify + smoke + postmortem-learning. Typical phases:
1. `recall-stack-knowledge` (phase-0 gate).
2. `diagnose-bug` — root-cause analysis with infra-specific signals.
3. `plan-changeset` — minimal-blast hotfix.
4. `plan-blast-radius` — SEV-1/2 forces human checkpoint.
5. `execute-changeset --infra --dry-run` then `execute-changeset`.
6. `verify-promotion --infra` + `review-gate`.
7. **Postmortem learning (mandatory)** — `manage-learnings` writes to `references/knowledge/domains/<stack>/incidents/<date>-<slug>.md`. Surfaces in next session's recall — same incident class doesn't recur.

### Lane 12: Infra Cost Optimization

**Trigger signals:** Cost report / budget alert / explicit FinOps request. User says "we're spending too much", "rightsize", "kill unused", "FinOps".

**Phase chain:** Same as Lane 9 (Infra Feature) but with `review-security --mode=cost-impact` elevated to primary gate (not secondary). FinOps dimension is the load-bearing concern; Security and Scalability are guardrails.

### Continuous drift watch

Existing `drift` lane (Lane 5) handles infra drift reconciliation when scheduled via `/schedule`. No new lane needed — drift findings flow into `manage-learnings` which surfaces in the next infra session's recall.
