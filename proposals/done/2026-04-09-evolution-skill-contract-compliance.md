# Framework Evolution — 2026-04-09: Skill Contract Compliance Gap

## Method

Evidence: 5 concrete incidents from WI-012 Lane 4 execution (Example Marketplace, 2026-04-09) where a skill was loaded via the Skill tool but its contract was not systematically followed. Audited self-verify sections across 7 Lane 4 skills + checked for structural enforcement mechanisms.

## Root Cause Analysis

**The fundamental problem:** svc skills have two types of checks — **prerequisites** (things to do BEFORE work starts) and **self-verify** (things to check AFTER work is done). Both exist as prose in the SKILL.md. Neither is enforced.

| Check type | Where it lives | When it should run | Enforcement mechanism | Result |
|---|---|---|---|---|
| Prerequisites | Prose section at top of SKILL.md (e.g., write-e2e "PREREQUISITE: Read the Frontend") | BEFORE any work starts | **None** — agent reads it, may skip it | Agent skipped reading page components, ignored existing page objects |
| Self-verify | Table at bottom of SKILL.md | AFTER work is done, before chaining | **None** — agent is supposed to walk the table | Agent marked task 7 completed without running any verification |
| Process steps | Numbered steps in the body | During execution | **None** — agent may skip steps | Agent skipped pattern scan iteration, skipped test-and-iterate cycle |

**The Stop hook and Task-Graph Protocol don't solve this.** They enforce *completion* (all tasks must finish) and *anti-rationalization* (can't stop with excuses). But they don't enforce *quality within a task* — a skill can be "completed" with half its contract skipped.

## Findings (by priority)

### P0 — Fix now: Self-verify checks are post-hoc and unenforced

**Evidence:** `write-e2e/SKILL.md` has only 3 self-verify checks, and NONE of them verify the prerequisite was followed:

```
| 1 | At least one e2e test file produced | find e2e/specs ... |
| 2 | Test files reference AC IDs from spec | grep for AC ID patterns |
| 3 | No unresolved questions | grep for TBD, TODO |
```

Missing checks that would have caught the WI-012 failures:
- "Every page component touched by the test was READ before selectors were written" — would have caught skipping the prerequisite
- "Existing page objects in e2e/pages/ were checked and reused" — would have caught ignoring LoginPage
- "Test was run at least once and either passes or has a documented failure with diagnosis" — would have caught "deferred" without iteration
- "Project-specific e2e skills (e2e-automation, autonomous-verification) were checked" — would have caught ignoring available methodology

**File:** `write-e2e/SKILL.md:525-535` (Self-Verify section)

**Fix:** Add 4 self-verify checks to write-e2e covering prerequisite compliance, page object reuse, test execution, and project skill awareness.

---

### P0 — Fix now: No pre-flight gate between skill load and skill execution

**Evidence:** The Task-Graph Protocol says "load the skill before doing work" but has no step that says "walk the skill's prerequisites checklist and confirm each one before starting." The agent loads the skill, sees 600 lines of contract, and jumps to the "interesting" part (writing code) while skipping the "boring" part (reading existing infrastructure).

**File:** `route-workflow/SKILL.md` Task-Graph Execution Protocol — the "At each skill's completion" section has 4 steps. There is no corresponding "At each skill's START" section.

**Fix:** Add a **Pre-Flight Protocol** to the Task-Graph Execution Protocol. When a skill is loaded, before any work begins:

1. Read the skill's PREREQUISITE section (if it has one)
2. Execute each prerequisite check (read files, grep for patterns, check for existing infrastructure)
3. Log the pre-flight results in chat: "Pre-flight for write-e2e: ✅ read PhotoUpload.jsx, ✅ read Settings.jsx, ✅ found LoginPage in e2e/pages/, ✅ checked e2e-automation skill"
4. Only THEN start the skill's process steps

This is cheap (a few reads) and catches the exact failure mode from WI-012.

---

### P1 — Fix soon: write-e2e has 3 self-verify checks; diagnose-bug has 11

**Evidence:** Self-verify check counts across Lane 4 skills:

| Skill | Checks | Assessment |
|---|---|---|
| diagnose-bug | 11 (was 3, expanded this session to 11) | Thorough |
| plan-changeset | 9 | Adequate |
| review-gate | 56 | Excessive (but it's a gate) |
| execute-changeset | 4 | Light |
| write-e2e | 3 | **Dangerously light** — the most complex skill with the fewest checks |
| land-changeset | 4 | Light |
| verify-promotion | 3 | Light |

write-e2e's contract is ~600 lines covering auth patterns, API waits, overlay defense, file uploads, two-user testing, flaky test diagnosis, page objects, toast selectors, and dozens of gotchas. But its self-verify has only 3 checks: "file exists", "has AC IDs", "no TODOs." That's output-shape verification, not execution-quality verification.

**File:** `write-e2e/SKILL.md:525-535`

**Fix:** Expand write-e2e self-verify to 8-10 checks covering: prerequisite compliance (page components read), existing infrastructure reused (page objects, helpers), test executed and iterated until pass or documented failure, auth pattern matches repo convention, no workarounds for production bugs.

---

### P1 — Fix soon: Skills with critical prerequisites don't mark them as mandatory gates

**Evidence:** write-e2e has a bolded PREREQUISITE section that says "This is non-negotiable" — but it's prose, not a gate. There's no structural difference between "this is non-negotiable" and a regular paragraph. The agent treats both as "I should read this" rather than "I must execute this before proceeding."

Compare with `diagnose-bug` which has Process Step 4.4 "Pillar Revisit Audit — MANDATORY" and Process Step 4.5 "Pattern scan — MANDATORY" — these are numbered steps that get walked sequentially. write-e2e's prerequisite is a standalone section outside the numbered process, easy to skip.

**File:** `write-e2e/SKILL.md:1-50` (PREREQUISITE section)

**Fix:** Convert write-e2e's PREREQUISITE from a standalone section into **Process Step 0** — a numbered step that precedes Step 1. Give it a self-verify check: "Step 0 pre-flight logged with file reads." This makes it part of the sequential process flow rather than a detachable preamble.

---

### P1 — Fix soon: No "test must pass or document why not" self-verify check in write-e2e

**Evidence:** The WI-012 execution wrote an e2e spec, ran it once, it failed on auth, and the agent said "deferred." The write-e2e skill says "Fix the App, Not the Test" and describes the debug pattern — but none of this is in the self-verify table. A spec file that was never successfully run passes all 3 current self-verify checks.

**File:** `write-e2e/SKILL.md:525` — Self-Verify table

**Fix:** Add self-verify check: "Test executed at least once with result: PASS, or FAIL with documented diagnosis (page errors captured, root cause identified, fix applied or filed as separate WI)." A test that was written but never run is a self-verify failure. A test that failed and was "deferred" without diagnosis is a self-verify failure.

---

### P2 — Improve: Task completion should verify self-verify passed

**Evidence:** The Task-Graph Protocol says skills must call `TaskUpdate` to mark their task completed. But there's no check that self-verify actually passed before the task is marked completed. The agent can mark a task done while self-verify has failing checks.

**File:** `route-workflow/SKILL.md` Task-Graph Protocol — Skill contract obligation section

**Fix:** Add to the Skill contract obligation: "Before marking a task `completed`, run ALL self-verify checks. If any check FAILS, the task stays `in_progress` and the failure is reported. A task cannot be marked `completed` with failing self-verify checks."

---

### P2 — Improve: Project-specific skills should be checked at skill load

**Evidence:** Example Marketplace has `e2e-automation` and `autonomous-verification` project skills. write-e2e's contract mentions checking for repo conventions but doesn't say "check if the project has its own e2e skill that overrides or supplements the general write-e2e contract."

**Fix:** Add to the Pre-Flight Protocol: "Check for project-specific skills that overlap with the loaded skill. If a project skill exists for the same domain (e.g., `e2e-automation` for `write-e2e`), load and read it BEFORE starting work — it may contain repo-specific auth patterns, selectors, or conventions that override the general skill."

---

## Comparison delta

Not applicable — this is an internal execution quality finding, not a capability gap vs competitors.

## Stale proposal audit

| Proposal | Status |
|---|---|
| `proposals/2026-04-09-48-skill-task-graph-audit.md` | In `done/` — appears moved by a prior session's linter. Still relevant as a mechanical task but not blocking. |

No other pending proposals.
