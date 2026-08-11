# Blend Plan: superpowers (re-blend)

**Status:** IMPLEMENTED — all 9 blend items landed (2026-04-08)

**Source:** https://github.com/obra/superpowers
**SHA:** 917e5f53b16b115b70a3a355ed5f4993b9f8b73d
**Version:** 5.0.7
**Date:** 2026-04-08
**Previous blend:** unknown-pre-registry (2026-04-05) — took task graph planning + TDD execution

## Summary

9 patterns to blend, 14 to skip, 2 previously taken (remain solid).

| # | Pattern | Target | What breaks without it | What changes after |
|---|---------|--------|----------------------|-------------------|
| 1 | CSO description anti-pattern | anti-patterns.md AP-20, create-skill | Claude reads skill description "9-step brainstorming gate with spec review," decides it already knows the skill, skips loading SKILL.md entirely — runs a shallow version missing all the gates | Every svc skill description audited; create-skill warns against summarizing workflow in descriptions; AP-20 codifies the rule |
| 2 | Anti-rationalization tables | create-skill | Agent encounters "I'll skip TDD because this is a one-line fix" — nothing in the skill preemptively names and rebuts this exact thought, so the agent rationalizes its way out | create-skill teaches table format: `Thought → Rebuttal` rows that preemptively name each skip-justification; discipline skills get structurally bulletproofed |
| 3 | Two-stage review ordering | execute-changeset Step 3 | Holistic review spends tokens noting "inconsistent naming in auth module" while 3 of 10 ACs are unimplemented — quality review on code that may be rewritten | Step 3 splits into Pass 1 (spec compliance, blocking) then Pass 2 (code quality, only after Pass 1 passes); same diff, two focused lenses |
| 4 | Mock-interface derivation gate | anti-patterns.md AP-14 | Interface defines `close()`, code calls `cleanup()`, mock implements `cleanup()` — tests pass because mock matches code, runtime crashes because code doesn't match interface | AP-14 gains a 5-step gate: find interface first → mock only interface methods → if test fails, fix code not mock |
| 5 | Layer-by-layer diagnostic instrumentation | diagnose-bug Investigation Protocol | Bug crosses API→service→DB; agent adds logging at API layer, runs, sees nothing wrong, moves to service layer, runs again, repeats — 4 runs instead of 1 | New technique: instrument ALL boundaries in one pass, run once, read all logs simultaneously to pinpoint exactly where data corrupts |
| 6 | Architectural escalation reframe | diagnose-bug 3-Attempt Escalation | After 3 failed hypotheses, agent says "I'm stuck, need domain knowledge" — misses the possibility that the design itself is wrong, not just the code | Escalation now asks: "Is this a design problem (wrong architecture) or a code problem (wrong implementation)?" — surfaces architectural issues |
| 7 | Anti-sycophancy for review reception | anti-patterns.md AP-21 | Cross-model reviewer says "add input validation on all endpoints"; agent immediately implements on 15 endpoints, but only 2 accept user input — 13 endpoints get unnecessary code | New rule: verify reviewer suggestion against codebase before implementing; grep for actual usage; push back with evidence if suggestion is gold-plating |
| 8 | Type/naming consistency check | plan-changeset self-verify | Task 2 defines `clearLayers()`, Task 5 calls `clearFullLayers()` — plan ships with naming drift, subagent implements what's written, runtime fails at integration | New self-verify item: scan all task descriptions for entity names, verify same entity uses same name everywhere |
| 9 | Pressure testing methodology | test-framework references | Skill says "always do TDD" but under time pressure + authority + sunk cost, agent skips it — no eval catches this because tier 1 only checks structure, not behavioral compliance | New reference doc: methodology for tier 2+ evals that combine 3+ pressure types and force A/B/C choices to test discipline under realistic stress |

---

## Blend Items

### 1. CSO Anti-Pattern for Skill Descriptions → `references/anti-patterns.md` (AP-20)

**From:** `skills/writing-skills/SKILL.md` — CSO (Claude Search Optimization) finding
**Into:** `references/anti-patterns.md` as AP-20, and `create-skill/SKILL.md` description section

**The problem in svc today:**
svc has 46 skills. Each has a `description` field in YAML frontmatter. Claude sees
all 46 descriptions at startup (via available_skills list). When a description
summarizes the workflow — e.g., "9-step pre-implementation gate: explore context,
ask questions, propose approaches, write spec, self-review, user review, invoke
writing-plans" — Claude reads that summary and decides it already knows enough.
It then either skips invoking the Skill tool entirely (runs a shallow version from
the description) or loads the SKILL.md but skims it because the description already
primed its expectations.

**The superpowers evidence:**
The superpowers team tested and verified this behavior. They call it "CSO" (Claude
Search Optimization) — the description acts as a search result snippet. If the snippet
is comprehensive enough, the user (Claude) never clicks through to the full page
(SKILL.md). This was caught during skill authoring evals where Claude would cite
the description's steps instead of the SKILL.md's steps.

**What this changes in svc:**
1. New AP-20 in `references/anti-patterns.md`:
   - Problem: "Skill description summarizes the workflow (CSO shortcut)"
   - Fix: "Descriptions must contain ONLY triggering conditions. Never summarize
     what the skill does, its steps, or its output. The description answers
     'when to load this skill' not 'what this skill does.'"
   - Example: Bad: `"9-step brainstorming gate: explore context, questions, approaches, spec, review"`
   - Example: Good: `"Use when starting any creative work — features, components, modifications"`
2. Warning in `create-skill/SKILL.md` description optimization section (~line 388):
   complementary to AP-19 (pushy descriptions). AP-19 says "be aggressive about
   trigger situations." AP-20 says "but never summarize the workflow — that creates
   a shortcut bypass."
3. Action item: audit all 46 svc skill descriptions for workflow summaries.

**What NOT to take:**
- The full persuasion principles document (Cialdini theory) — over-engineering for svc
- The `<EXTREMELY_IMPORTANT>` injection pattern — svc uses route-workflow, not session injection

**Why this matters:**
This is a systemic risk, not a single-skill problem. Every description that
summarizes its workflow is a potential point where Claude skips the full skill
read. With 46 skills, even a 10% shortcut rate means 4-5 skills running degraded
in any given session. The fix is nearly free (rewording descriptions) and the
audit is a one-time effort.

---

### 2. Anti-Rationalization Table Format → `create-skill/SKILL.md`

**From:** Structural pattern across `skills/test-driven-development/SKILL.md`,
`skills/systematic-debugging/SKILL.md`, `skills/verification-before-completion/SKILL.md`
**Into:** `create-skill/SKILL.md` as a recommended structural element for discipline-enforcing skills

**The problem in svc today:**
svc's discipline skills (execute-changeset, diagnose-bug, review-gate) state rules
but don't preemptively name the rationalizations that lead to breaking them. When
the agent encounters time pressure, it thinks "This is a trivial change, TDD would
be overkill" — and nothing in the skill text explicitly addresses that thought. The
rule says "always do TDD" but the rationalization says "this isn't 'always', this
is an exception." The agent convinces itself the exception is valid.

**How superpowers solves this:**
Every discipline skill in superpowers has two structural elements:

1. **Rationalization table:** Each row names a specific thought the agent might have
   and provides a rebuttal. Example from TDD skill:

   | Thought | Reality |
   |---------|---------|
   | "This is too simple for TDD" | Simple things become complex. The test takes 30 seconds. |
   | "I already know this works" | Knowing ≠ proving. Write the test. |
   | "I'll add the test after" | After never comes. Every "after" is a lie. |

2. **Red Flags list:** Observable behaviors that indicate the rule was broken.
   Each maps to a corrective action. Example: "You wrote implementation code
   before a test exists" → "Delete the code. Write the test first. Then rewrite."

**Empirical grounding:**
Meincke et al. (2025, N=28,000) found that persuasion techniques applied to LLMs
doubled compliance from 33% to 72%. The most effective technique: "implementation
intentions" — specific "When X happens, do Y" rules beat general "always do Y"
rules. The rationalization table IS implementation intentions: "When you think
'this is too simple,' do: write the test anyway."

**What this changes in svc:**
Add a "Structural Bulletproofing" section to `create-skill/SKILL.md` with:
- Rationalization table template (Thought | Reality columns)
- Red Flags list template (Observable behavior | Corrective action)
- Guidance: use for discipline-enforcing skills (TDD, debugging, verification,
  scope prohibition). Do NOT use for reference/guidance skills (knowledge-protocol,
  context-budget) — those don't need behavioral compliance enforcement.

**What NOT to take:**
- The full persuasion principles document — too academic; the actionable pattern
  is the table format itself
- "Violating the letter is violating the spirit" phrase — superpowers' voice, not svc's
- ALWAYS/NEVER language guidance — svc already has its own voice conventions

**Why this matters:**
The gap is that svc's discipline rules can be rationalized away because they don't
preemptively address the agent's counter-arguments. This is particularly acute under
pressure (large context, many tasks remaining, simple-seeming changes). The table
format is cheap to add (10-20 lines per skill) and empirically doubles compliance.

---

### 3. Two-Stage Review Ordering → `execute-changeset/SKILL.md`

**From:** `skills/subagent-driven-development/SKILL.md` — review ordering
**Into:** `execute-changeset/SKILL.md` Step 3 (Holistic review)

**svc's current approach:**
execute-changeset runs a single holistic review after ALL tasks complete (Step 3,
line 354). The rationale is documented and sound: "Per-task review catches nothing
that style contract + spec ACs + TDD don't already prevent, and costs 5-10K tokens
x N tasks. One holistic review at the end catches cross-task issues."

The holistic review checks 6 things in one blended pass:
1. Full AC coverage (spec compliance)
2. Cross-file consistency (quality)
3. No orphaned code (spec compliance)
4. Toggle registry complete (spec compliance)
5. Style contract compliance (quality)
6. No TODO/FIXME (quality)

Items 1, 3, 4 are spec compliance checks. Items 2, 5, 6 are code quality checks.
They're currently interleaved in a single pass with no ordering constraint.

**The failure mode this creates:**
The reviewer reads the diff and naturally interleaves findings. It might report:
- "Missing AC for password reset flow" (spec — 3 of 10 ACs unimplemented)
- "Inconsistent naming: `userAuth` in service, `authUser` in controller" (quality)
- "Missing input validation on email field" (quality)
- "No test for error path in payment handler" (spec)

The quality findings on the auth module are potentially wasted — if 3 ACs are
missing, the auth code may be significantly rewritten once those ACs are
implemented. Every token spent reviewing the quality of incomplete code is a
token that could be spent fixing the spec gaps first.

**How superpowers solves this:**
Two separate reviewers run in strict order:

1. **Spec compliance reviewer** (first, blocking gate) — explicitly adversarial.
   Told: "Do NOT trust the implementer report, read actual code." Compares
   implementation to requirements line by line. Checks: missing requirements,
   extra/unneeded work (YAGNI violations), misunderstandings. Returns pass/fail.
   **If this fails, code quality review never runs.**

2. **Code quality reviewer** (second, only after spec passes) — standard review:
   naming, separation of concerns, style, growth detection. This reviewer knows
   the code meets specs, so its findings are actionable.

The ordering principle: you wouldn't proofread a chapter that tells the wrong story.

**The real-world evidence:**
superpowers' 2025-11-28 user feedback documented a false positive integration:
code called OpenAI but the `model` field showed `claude-sonnet`. Verification
checked existence ("does the integration file exist?"), not correctness ("does the
integration call the right API?"). A spec-compliance-first review with explicit
adversarial distrust would have caught this — the spec said "integrate with Claude"
and the code integrated with OpenAI.

**What this changes in svc:**
Split execute-changeset Step 3 into two sequential passes on the same `git diff main..HEAD`:

**Pass 1 — Spec compliance (blocking gate):**
- Every AC in the spec has code + test
- No orphaned code that no AC requires
- Toggle registry complete
- No scope creep (nothing built that wasn't planned)
- Explicitly distrust task checkpoint messages — verify against actual diff

If Pass 1 fails → fix the gaps → re-run Pass 1. Do NOT proceed to Pass 2.

**Pass 2 — Code quality (only after Pass 1 passes):**
- Cross-file consistency
- Style contract compliance
- No TODO/FIXME
- No duplicate logic, inconsistent naming

**What this does NOT change:**
- The decision to skip per-task review remains — the token economics argument holds
- The two passes are on the SAME diff, not separate review agents
- This costs almost zero additional tokens: it's the same diff read with two lenses,
  and the second lens only runs if the first passes
- The loop-back rules remain unchanged

**What NOT to take:**
- The full subagent re-dispatch loop — svc already has loop-back mechanisms
- The model selection matrix — svc has this in subagent-context-rules.md Rule 5
- Per-task two-stage review — the token economics still argue against per-task review

**Why this matters:**
The cost is near-zero (same diff, two focused passes instead of one blended pass).
The benefit is concrete: no wasted review effort on incomplete code, and a formal
gate between "does it meet requirements" and "is it well-written." This is the
highest ROI change in this blend — minimal implementation effort, immediate
quality improvement in every execution run.

---

### 4. Mock-Interface Derivation Gate → `references/anti-patterns.md` (AP-14 strengthening)

**From:** `docs/plans/2025-11-28-skills-improvements-from-user-feedback.md` — Problem 5
**Into:** `references/anti-patterns.md` AP-14 (currently "test the mock, not the system")

**What AP-14 says today:**
"The agent writes a test, mocks every dependency, and the test passes. But it proves
nothing — it verifies that the mock returns what the mock was told to return."

Fix: "Integration tests should test real interactions where feasible. Unit tests mock
at boundaries, not within the unit under test."

This is correct but incomplete. It tells you WHERE to mock (boundaries) but not
HOW to derive the mock's shape.

**The specific bug this missed:**
From superpowers' production debugging (2025-11-28 user feedback, Problem 5):

```
Interface defines:   close(): Promise<void>
Implementation calls: cleanup(): Promise<void>   ← wrong method name
Mock implements:     cleanup(): Promise<void>   ← derived from code, not interface
```

What happened: the developer (agent) looked at the implementation code to see what
methods it called, then wrote a mock that matched those calls. The test passed
because the mock matched the code. But the code didn't match the interface contract.
At runtime, the real dependency expected `close()` to be called, got nothing, and
the connection leaked.

The root cause: the mock was derived from the **code** (what it actually does)
instead of from the **interface** (what it should do). When code has a bug, a
code-derived mock bakes that bug into the test.

**What this changes in svc:**
Expand AP-14 with a 5-step gate function:

1. STOP before writing a mock
2. Find the interface/type definition (NOT the implementation code)
3. List all interface methods/fields
4. Mock ONLY those methods/fields — if the code calls a method not in the interface,
   that's a code bug the test should catch, not a mock method to add
5. If the test fails because the code calls something the mock doesn't have,
   fix the code — not the mock

Add the `close()`/`cleanup()` example as illustration.

**What NOT to take:**
- The full user feedback document — other problems are already covered or too specific
- The "process cleanup before E2E tests" pattern — svc's test infrastructure differs

**Why this matters:**
Mock-interface drift is a class of bug where tests pass and production breaks.
It's particularly dangerous in agentic development because agents optimize for
"test passes" as a signal of correctness. The 5-step gate makes the mock
derivation source explicit, catching the exact moment where a code-derived mock
would bake in a bug.

---

### 5. Layer-by-Layer Diagnostic Instrumentation → `diagnose-bug/SKILL.md`

**From:** `skills/systematic-debugging/SKILL.md` — Phase 1 technique
**Into:** `diagnose-bug/SKILL.md` Investigation Protocol, Step 4 (Trace)

**What diagnose-bug does today:**
Step 4 says "Trace — follow the data flow end-to-end through the fault surface."
This is correct but unspecific about technique. In practice, the agent adds a log
at the API layer, runs the test, reads the log, sees something unexpected, adds
a log at the service layer, runs again, reads, moves to the DB layer, runs again.
Each layer takes a full run cycle.

For a 4-layer system (API → service → DB → response), that's 4 separate runs
to find where the data corrupts. If each run takes 30 seconds, that's 2 minutes
of debugging just to locate the layer — before any hypothesis formation.

**superpowers' technique:**
Instrument ALL component boundaries in one pass:

```
# Add these BEFORE running:
→ API handler receives: {user_id: 123, action: "update"}
← API handler returns: {status: 200, body: {updated: true}}
→ Service.update receives: {user_id: 123, action: "update"}
← Service.update returns: {rows_affected: 0}    ← BUG IS HERE
→ DB.execute receives: "UPDATE users SET ..."
← DB.execute returns: {rows_affected: 0}
```

One run. Read all boundary logs simultaneously. The data enters the service
correctly but the service returns `rows_affected: 0` while the DB also returns
`rows_affected: 0` — the bug is in the SQL query within the service, not in
the API or the response formatting.

**What this changes in svc:**
Add a subsection under Investigation Protocol Step 4:

"**Multi-boundary instrumentation:** When the fault surface spans multiple
components (API → service → DB → response), add logging at EVERY component
boundary in a single pass — log what enters and what exits each layer. Run
once. Read all boundary logs simultaneously. This pinpoints the exact layer
where data corrupts without iterative guess-and-check."

**What NOT to take:**
- root-cause-tracing.md — diagnose-bug already has root-cause investigation
- defense-in-depth.md — the 4-layer validation pattern is good but too detailed;
  diagnose-bug's scope is finding the bug, not hardening after the fix
- find-polluter.sh — test pollution bisection is too niche

**Why this matters:**
The technique is simple but the discipline is not. Agents naturally add one log,
run, read, add another — it's the obvious approach. The explicit instruction to
instrument all boundaries at once converts 4 debug cycles into 1. For complex
multi-service bugs, this can save 5-10 minutes per investigation.

---

### 6. Reframe 3-Attempt Escalation → `diagnose-bug/SKILL.md`

**From:** `skills/systematic-debugging/SKILL.md` — Phase 3
**Into:** `diagnose-bug/SKILL.md` 3-Attempt Escalation section (line ~156)

**What diagnose-bug says today:**
"After 3 failed investigation hypotheses: Stop investigating. The root cause is
non-obvious. Report: what was tried, what was ruled out, current best hypothesis.
Escalate: ask the user for domain knowledge or pair debugging. Do NOT start
guessing fixes."

**What's missing:**
The framing assumes the code is wrong but the design is right. All 3 hypotheses
target implementation bugs: "maybe the null check is wrong," "maybe the SQL
query has an off-by-one," "maybe the cache invalidation timing is wrong." When
all 3 fail, the escalation asks for "domain knowledge" — which means "help me
find the code bug I can't find."

But sometimes 3 failed hypotheses means the design itself is wrong. The function
isn't buggy — it's the wrong function. The API isn't misconfigured — it's the
wrong API for this use case. No amount of code-level debugging will find a
design-level problem.

**superpowers' framing:**
"After 3+ failed fixes, question the architecture." Not "I'm stuck, help me" but
"Is the design itself the problem?"

**What this changes in svc:**
Modify the 3-Attempt Escalation section. Current text stays but gains one addition:

"After 3 failed hypotheses, explicitly consider: **is this a design problem
(wrong architecture) or a code problem (wrong implementation)?** If all 3
hypotheses targeted code-level causes and all failed, the root cause may be
architectural — the component is doing the wrong thing, not doing the right
thing incorrectly. Surface this distinction in your escalation report."

**What NOT to take:**
- The pressure test scenarios (test-pressure-1/2/3.md) — methodology is captured
  in blend item 9; specific scenarios are too tied to debugging skill
- The "human partner" terminology — svc uses "user"

**Why this matters:**
The reframe costs one sentence in diagnose-bug. The impact is changing the
agent's mental model at the exact moment it's most stuck: from "I need help
finding the bug" to "maybe there is no bug — maybe the design is wrong." This
surfaces architectural issues that would otherwise stay hidden behind "I need
more domain knowledge."

---

### 7. Anti-Sycophancy Rules for Review Reception → `references/anti-patterns.md` (AP-21)

**From:** `skills/receiving-code-review/SKILL.md`
**Into:** `references/anti-patterns.md` as AP-21

**The problem in svc today:**
When review-gate or review-cross-model returns findings, the agent implementing
fixes has a systematic bias: agree with everything and implement immediately.
This manifests as:
- "Great catch! Implementing now." (implements without verifying)
- Reviewer says "add input validation on all endpoints" → agent adds validation
  to 15 endpoints, but only 2 accept user input → 13 endpoints get unnecessary code
- Reviewer says "use proper error handling" → agent wraps every function in
  try/catch, but most functions already have error handling via the framework

The agent optimizes for appearing responsive to feedback rather than evaluating
whether the feedback is correct for this specific codebase.

**How superpowers handles this:**
The receiving-code-review skill has explicit rules:
1. Do NOT respond with "You're absolutely right!" or "Great point!"
2. Restate the suggestion in your own words (proves understanding)
3. Verify against the codebase: is this suggestion actually applicable HERE?
4. YAGNI check: before implementing "properly do X," grep for actual usage of X.
   If X isn't used anywhere, the suggestion may be gold-plating.
5. If the suggestion is wrong: push back with technical evidence, not deference

**What this changes in svc:**
Add AP-21: "Sycophantic review acceptance"

"When receiving review feedback (from review-gate, review-cross-model, or human),
the agent must verify each suggestion against the codebase before implementing.
Grep for actual usage. Check if the suggestion applies to this specific code, not
just code in general. If the suggestion is incorrect or unnecessary for this
codebase, push back with evidence — do not implement gold-plating because a
reviewer suggested it."

Cross-reference from review-gate and review-cross-model skills.

**What NOT to take:**
- Specific forbidden response strings ("You're absolutely right!") — too prescriptive
- "Strange things are afoot at the Circle K" signal phrase — idiosyncratic
- The full 6-step reception process — an anti-pattern entry should be brief

**Why this matters:**
Every unnecessary change from sycophantic acceptance adds code that must be
maintained, tested, and reviewed. In the worst case, it introduces bugs (validation
logic that rejects valid input, error handling that swallows real errors). The
fix is a single verification step before implementation — cheap insurance against
a systematic bias.

---

### 8. Type Consistency Check → `plan-changeset/SKILL.md`

**From:** `skills/writing-plans/SKILL.md` — self-review section
**Into:** `plan-changeset/SKILL.md` self-verify section

**The problem in svc today:**
plan-changeset writes tasks that reference shared entities — functions, types,
API endpoints, file names. These references are written in natural language
within task descriptions. When Task 2 introduces `clearLayers()` and Task 5
(written later in the same plan) references it as `clearFullLayers()`, the
plan has a naming drift bug.

During execution, the Task 5 subagent implements exactly what its task says:
`clearFullLayers()`. The Task 2 subagent implemented `clearLayers()`. At
integration time, the call fails because the function name doesn't match.

This is particularly common when:
- Plans have 8+ tasks (more surface area for drift)
- Entity names are compound (e.g., `getUserAuthToken` vs `getAuthTokenForUser`)
- Tasks reference the same database column or API field with slight variations

**What this changes in svc:**
Add one row to plan-changeset's self-verify table:

| # | Check | How |
|---|-------|-----|
| N | Type/naming consistency | Scan all tasks for function names, type names, file paths, API endpoints, DB columns. Verify same entity uses same name in every task that references it. Flag any drift. |

**What NOT to take:**
- The full no-placeholder iron law with 6 failure modes — svc already has scope
  prohibition with banned phrases
- The "Similar to Task N" ban — svc's task format differs

**Why this matters:**
Naming drift is a silent plan bug — it doesn't look wrong in any single task
viewed in isolation. It only breaks at integration. The check is cheap (one scan
of the plan after writing it) and catches a specific class of integration failure
before execution starts.

---

### 9. Pressure Testing Methodology → `test-framework/` reference

**From:** `skills/writing-skills/testing-skills-with-subagents.md` + `skills/systematic-debugging/test-pressure-{1,2,3}.md`
**Into:** `test-framework/references/pressure-testing.md` (new reference file)

**The problem in svc today:**
svc's tier 1 evals validate skill structure: frontmatter present, chain refs valid,
self-verify sections exist, worktree safety. These are static checks — they verify
the skill is well-formed, not that it works under pressure.

There is no tier 2 methodology for testing whether an agent actually follows a
discipline skill when conditions make it tempting not to. A skill can say "always
do TDD" and pass every tier 1 eval, but under time pressure + sunk cost + authority
pressure, the agent skips TDD anyway.

**How superpowers tests this:**
They designed three specific pressure scenarios that target the three highest-
probability rationalization paths:

1. **Emergency** (test-pressure-1): $15K/minute production loss, manager on call,
   forces A/B/C choice between systematic debugging (35+ min) vs. quick retry (5 min)
   → Tests: time pressure + authority + economic stakes

2. **Sunk cost** (test-pressure-2): 4 hours debugging, 8pm, dinner plans, 6 failed
   timeout attempts, colleague suggests "just increase the timeout"
   → Tests: sunk cost + exhaustion + social pressure

3. **Authority** (test-pressure-3): Senior engineer + tech lead present, everyone
   wants the call to end, senior says "just ship it"
   → Tests: deference to authority + social hierarchy

Key design rules:
- Combine 3+ pressure types per scenario (single pressures are too easy to resist)
- Force A/B/C choice (not open-ended "what would you do?")
- Run baseline WITHOUT skill first, document exact rationalizations verbatim
- Run WITH skill, verify compliance
- For each new rationalization found: add counter to skill's rationalization table

**What this changes in svc:**
Create `test-framework/references/pressure-testing.md` with:
- The 6 pressure type taxonomy (Time, Sunk cost, Authority, Economic, Exhaustion, Social)
- The 3+ combined pressure rule
- The A/B/C forcing pattern
- The baseline-then-intervention protocol
- Guidance on building scenarios for specific discipline skills
- How to integrate with tier 2 evals

This enables test-framework to validate that discipline skills (execute-changeset's
deviation rules, diagnose-bug's root-cause-first principle, plan-changeset's scope
prohibition) actually hold under realistic pressure, not just in ideal conditions.

**What NOT to take:**
- The specific test-pressure-1/2/3.md scenarios — they're debugging-specific; svc
  needs its own scenarios per skill
- The CLAUDE.md variant testing — svc doesn't use CLAUDE.md injection
- The full TDD-for-skills metaphor — too meta for a reference doc
- Subagent-based testing infrastructure — svc already has evals/run-all-evals.sh

**Why this matters:**
Discipline rules that aren't tested under pressure are untested rules. The
methodology is transferable to any discipline skill and provides the framework
for tier 2 evals that test behavioral compliance, not just structural correctness.
Without this, svc has no way to verify that "always do X" rules actually hold
when conditions make it tempting to skip X.

---

## Skipped Items

| External skill/pattern | Reason for skip |
|---|---|
| `using-superpowers` (meta-bootstrapper) | svc uses route-workflow + description optimization; different architecture |
| `brainstorming` (9-step gate) | svc's progressive narrowing (validate-feature → write-spec → design-ux/ui) is more granular |
| `executing-plans` (inline fallback) | svc's execute-changeset is more sophisticated (worktrees, checkpoint commits, deviation rules) |
| `dispatching-parallel-agents` | Covered by execute-changeset inner worktrees + harness agent patterns |
| `using-git-worktrees` | scripts/worktree.sh covers this |
| `finishing-a-development-branch` | land-changeset handles more (version bumps, squash merges) |
| `verification-before-completion` | verification-patterns.md + AP-18 cover this with more structure |
| `requesting-code-review` | review-gate covers this |
| Visual companion / brainstorm server | Interesting zero-dep engineering but not pipeline-critical; no svc equivalent needed |
| Document review loops | review-gate G1-G7 provides structured review at all phases |
| Implementer status codes (DONE/DONE_WITH_CONCERNS/BLOCKED/NEEDS_CONTEXT) | Minor improvement; execute-changeset has deviation rules that cover these cases |
| Lean context finding | subagent-context-rules.md Rule 2 already says "context is passed, not discovered" + "orchestrator reads once and distributes" |
| Defense-in-depth 4 layers | Good post-fix hardening pattern but too detailed for diagnose-bug's scope; diagnose-bug finds bugs, it doesn't harden systems |
| Condition-based waiting patterns | Useful testing pattern (replace setTimeout with polling) but too niche for a framework-level reference doc |
| Persuasion principles (full Cialdini) | Over-engineering; the actionable insight (implementation intentions double compliance) is captured in blend item 2's empirical citation |
| Graphviz conventions | svc doesn't use Graphviz in skills |
| Platform tool mappings (Codex/Copilot/Gemini) | svc uses host adapter provisioning with JSON manifests, not per-platform tool mapping docs |
| Cross-platform polyglot hooks | svc targets Linux; the CMD/bash polyglot wrapper is clever engineering but not applicable |

## Rethink: Past Blend Reassessment

### Blended Patterns Reassessed

| Pattern | svc skill | Verdict | Action |
|---|---|---|---|
| Task graph planning | plan-changeset | Solid — working well, enhanced with GSD deviation rules and scope prohibition | KEEP |
| TDD execution discipline | execute-changeset | Solid — working well, core to execution flow, checkpoint commits added | KEEP |

### Skipped Patterns Reconsidered

Previous blend had no explicit skipped patterns recorded. Reviewing what was
available at the time vs. what's available now at v5.0.7:

| Pattern | Why it wasn't taken (2026-04-05) | Reassessment | Action |
|---|---|---|---|
| Anti-rationalization tables | Not identified as a transferable pattern | Now clearly valuable — superpowers uses it in 4+ skills with empirical backing | BLEND (item 2) |
| CSO description finding | Didn't exist in pre-registry version | New in v5.0.6+, tested and verified | BLEND (item 1) |
| Two-stage review | Not identified separately from SDD | Now clearly valuable — the ordering principle is independent of the execution model | BLEND (item 3) |
| Pressure testing | Not identified as transferable methodology | Now clearly valuable — provides the missing tier 2 eval methodology | BLEND (item 9) |

## svc Advantages Over superpowers (documented for completeness)

| svc capability | superpowers equivalent | Why svc is better |
|---|---|---|
| 46-skill progressive pipeline | 14 skills, single-session workflow | Far more granular phase decomposition — each phase has its own skill with specific inputs/outputs |
| 7 review gates (G1-G7) | No structured gates | Formal quality checkpoints at every phase transition, not just end-of-execution |
| Builder profiling + kill signals | No equivalent | Pipeline can reject bad ideas with evidence before any code is written |
| Revenue staging + opportunity finding | No equivalent | Builder-aware economics — what to build is as important as how |
| 7 workflow lanes | Single workflow | Lane-specific behavior for greenfield/brownfield/bugfix/drift/refactor/framework |
| 3-layer knowledge system | No equivalent | Persistent expertise that compounds across projects and sessions |
| Framework self-improvement loop | No equivalent | Closed loop: test → evolve → blend → improve (this blend plan is itself a product of the loop) |
| Agent architecture patterns (6) | Basic parallel dispatch | Pipeline, fan-out, expert pool, producer-reviewer, supervisor, hierarchical |
| Host adapter provisioning | Plugin per platform with manual per-host code | Declarative JSON manifests per host, capability-based install |
| Feature lifecycle (7+2 states) | No state tracking | DRAFT → BASELINED → ... → VERIFIED + REJECTED/PIVOTED |
| Compression boundaries | No equivalent | Late phases use compressed artifacts, preventing context bleed from earlier phases |

## Attribution Update

Add to NOTICES:

```
superpowers (re-blend 2026-04-08)
https://github.com/obra/superpowers
Copyright (c) Jesse Vincent
MIT License

Patterns derived:
- CSO anti-pattern for skill descriptions → references/anti-patterns.md AP-20
- Anti-rationalization table format → create-skill/SKILL.md
- Two-stage review ordering → execute-changeset/SKILL.md
- Mock-interface derivation gate → references/anti-patterns.md AP-14
- Layer-by-layer diagnostic instrumentation → diagnose-bug/SKILL.md
- 3-fixes architectural escalation → diagnose-bug/SKILL.md
- Anti-sycophancy review rules → references/anti-patterns.md AP-21
- Type consistency check → plan-changeset/SKILL.md
- Pressure testing methodology → test-framework/references/
```
