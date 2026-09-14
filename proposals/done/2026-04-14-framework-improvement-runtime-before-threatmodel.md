# Framework Improvement: runtime-validation-before-threat-model for auth-sensitive shipped code

**Status:** IMPLEMENTED (2026-04-14)
**Parent proposal:** `proposals/2026-04-14-evolution-wi054-session.md` P0-1

## Evidence

- **Source:** user-driven intervention during WI-054 Lane 4 execution (Example Marketplace session, 2026-04-14)
- **Finding:** `route-workflow/SKILL.md:1775–1788` auth-sensitive classifier inserts `review-security` as step 4.5 keyed only on `review-gate` completion. For code that ships before the lane reaches step 4 (Base44 auto-deploy, Vercel-on-push, etc.), this means threat-modeling runs on code with zero runtime evidence that the fix actually works.
- **Severity:** high — threat modeling on unverified code is wasted work and masks actual defects

## Diagnosis

- **Root cause:** the classifier doesn't account for two modes: "code not yet shipped" vs "code already in prod". For shipped code, runtime validation is cheaper than static threat-modeling AND gates whether the threat model is meaningful.
- **Category:** gap (missing lane ordering for shipped-before-reviewed case)
- **Already in FRAMEWORK-STATE.md?** no — the 2026-04-14 improve-framework entry landed the classifier itself (P1-1), but did not address shipped-before-reviewed ordering

## Implementation

- **Route:** direct SKILL.md edit (no new skill, no lane restructure — an additional insertion rule keyed on existing conditions)
- **Files changed:** `route-workflow/SKILL.md` — added "Runtime-validation-before-threat-model gate" block after the existing auth-sensitive classifier (`proposals/2026-04-14-evolution-wi054-session.md` P0-1)
- **Commits:** (this commit)

### What the edit does

When the auth-sensitive classifier fires AND the changeset's target paths match the project's "auto-deploy on push" deploy matrix (per `router-context.md`), OR the lane is retroactive, OR task 3 `execute-changeset` is already completed — then ALSO insert `test-journeys` at step 3.5 and re-parent `review-security` at step 4.5 to be blocked on 3.5 instead of 4.

For non-shipped auth-sensitive changes, existing ordering is preserved (`review-security` still blocked_by `review-gate`).

## Replay Verification

- **Replay target:** on the WI-054 trajectory that triggered this loop, reconstruct the task graph and verify that `test-journeys` is inserted at 3.5 BEFORE `review-security` at 4.5.
- **Result:** PASS (verified by inspection of the updated SKILL.md text — the classifier now explicitly covers the Base44-auto-deploy case). Live replay would require rerunning WI-054 from `diagnose-bug`, which is not reversible (the WI is `planned`, fix already shipped). Qualitative replay is sufficient here: the skill text now prescribes exactly what the user had to manually demand during the original run.
- **Evidence:** `route-workflow/SKILL.md` lines containing "Runtime-validation-before-threat-model gate" — insertion rule present, conditions specified, scope note present.

## FRAMEWORK-STATE.md Mutations

**Analysis History entry (to add):**

```markdown
### 2026-04-14: route-workflow runtime-validation gate before threat-model for shipped auth-sensitive code (proposal 2026-04-14-evolution-wi054-session.md P0-1)

**Source:** Example Marketplace WI-054 session. Fix shipped via Base44 auto-deploy from `git push` before the Lane 4 task graph reached review-gate / review-security. User had to manually demand `test-journeys` as a runtime gate before agreeing to `review-security`. Without that intervention, the threat model would have run on code with zero runtime evidence.

**Root cause:** the auth-sensitive classifier added 2026-04-14 (proposal P1-1 — `example-marketplace/proposals/2026-04-14-blocking-discovery-halt.md`) inserts `review-security` at step 4.5 keyed on `review-gate` (step 4). It has no conditional for the case where the fix has ALREADY shipped — which is the default on platforms with git-triggered auto-deploy.

**Changes landed:**

1. **`route-workflow/SKILL.md`** — added "Runtime-validation-before-threat-model gate" block immediately after the auth-sensitive classifier (same file). When both (a) classifier fires AND (b) code has shipped (task 3 completed OR retroactive lane OR target paths auto-deploy per `router-context.md`), inserts `test-journeys` at step 3.5 and re-parents `review-security` (4.5) to `blocked_by: [3.5]`.

**Replay:** qualitative PASS — the rule text now prescribes exactly what the user manually demanded mid-session. No re-execution of WI-054 possible (fix already shipped; WI is in `planned` status).

**Decisions locked:**

- For shipped auth-sensitive code, runtime validation (`test-journeys`) runs BEFORE static threat-modeling (`review-security`). This is the cheaper gate and prevents wasted threat-model work on broken code.
- "Shipped" is defined by the project's `router-context.md` deploy matrix, not by the git push alone. Projects that use `git push` for code review + manual `deploy` step are NOT considered shipped at push time.
- For non-shipped auth-sensitive code, existing ordering (`review-security` at 4.5 blocked by `review-gate` at 4) is preserved.

**Evidence:**
- Commit (this session) — `route-workflow/SKILL.md` edit + proposal landing + FRAMEWORK-STATE entry
- Parent proposal: `proposals/2026-04-14-evolution-wi054-session.md`
- Triggering session artifacts: `example-marketplace/.svc/lane-tasks-WI-054.json` (task 3.5 was manually inserted before this edit), `example-marketplace/docs/specs/features/test-evidence/2026-04-14-prod-J04-wi054/SUMMARY.md`
```

**Known Gaps (no changes needed):** this gap was not previously tracked.

**Capabilities (`references/knowledge/svc/CAPABILITIES.md`):** no change — the edit sharpens an existing capability (auth-sensitive classifier), doesn't add a new one.

**Blend registry:** N/A — no external source.

**NOTICES:** N/A — no external pattern imported.

---

## Parent proposal findings still pending

`2026-04-14-evolution-wi054-session.md` has 5 additional findings (P1-1, P1-2, P2-1, P2-2, P3-1). This improve-framework run lands only P0-1. The parent proposal stays in `proposals/` (NOT moved to done/) until all P0/P1 findings are implemented.

Recommended next runs:
- P1-2 (diagnose-bug `--diagnose-only` pre-check for auto-deploy paths) — direct SKILL.md edit
- P1-1 (test-journeys S2 tightening + user memory scope tightening) — SKILL.md edit + memory file edit
- P2-1 (anti-patterns AP-26) — reference doc edit
