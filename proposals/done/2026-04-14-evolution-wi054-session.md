# Framework Evolution — 2026-04-14 (WI-054 session)

**Status:** IMPLEMENTED (2026-04-14)
- P0-1 landed: commit `3548abf`, record `proposals/done/2026-04-14-framework-improvement-runtime-before-threatmodel.md`
- P1-2, P1-1, P2-1 landed: commit (this session), record `proposals/done/2026-04-14-framework-improvement-diagnose-s2-ap26.md`
- P2-2, P3-1: deferred per original severity tier (track until evidence escalates)

Complements same-day evolution proposal `proposals/2026-04-14-evolution.md`
(dark-mode problem-archetype reasoning). This proposal is scoped to findings
from the WI-054 diagnose → fix → QA → (almost review-security) session.

## Method

Evidence read in order:
1. This session's full conversation history — route-workflow → diagnose-bug → execute (direct commit+push) → test-journeys
2. `~/.claude/skills/diagnose-bug/SKILL.md` — full skill
3. `~/.claude/skills/test-journeys/SKILL.md` — full skill
4. `~/.claude/skills/route-workflow/SKILL.md` — auth-sensitive classifier (lines 1741–1792)
5. `.svc/lane-tasks-WI-054.json` — the task graph produced in this session
6. `docs/specs/features/test-evidence/2026-04-14-prod-J04-wi054/SUMMARY.md` — QA run outputs
7. `/workspace/seriousvibecoding/FRAMEWORK-STATE.md` — prior entries checked for overlap (2026-04-14 improve-framework P0-1/P1-1/P1-2 entries are adjacent but do not cover these findings)
8. `proposals/2026-04-14-evolution.md` — checked for overlap (dark-mode archetype — distinct)
9. `proposals/2026-04-14-blocking-discovery-halt.md` — checked for overlap (WI-053/WI-054 upstream — distinct, already implemented per FRAMEWORK-STATE 2026-04-14)

No finding here is already captured in FRAMEWORK-STATE.md or in the two sibling proposals.

---

## Findings (by priority)

### P0 — Fix now (blocks quality)

---

**P0-1: Lane 4 ordering — auth-sensitive changes need runtime validation BEFORE `review-security`**

**File:** `~/.claude/skills/route-workflow/SKILL.md:1744–1792` (auth-sensitive classifier)

**Evidence:**

The classifier (added by 2026-04-14 improve-framework P1-1) correctly inserts
`review-security` as step 4.5 between `review-gate` and `write-e2e`. But for an
auth-sensitive change that has ALREADY been deployed to production (as in WI-054,
where the fix shipped via auto-deploy from git push), the task graph puts
threat-modeling BEFORE any runtime proof the fix works.

In this session:
1. Task 1 diagnose-bug completed (WI-054.md)
2. Task 3 execute-changeset completed (commits `b7cb698`, `c98a2ae`, `7e82e79` pushed to main, auto-deployed)
3. Task 4 review-security was queued next
4. **User intervention required**: "before that you need to test with /test-journeys to validate no?"
5. Agent inserted Task 3.5 `test-journeys` ad-hoc → ✅ PASS, then queued review-security

Without the intervention, review-security would have threat-modeled code with zero
runtime evidence. If the fix were broken, the security review would have been wasted
work — you can't meaningfully threat-model a broken code path.

**Root cause:**

The auth-sensitive classifier at `route-workflow/SKILL.md:1774` places
`review-security` as step 4.5, keyed off `review-gate` being step 4. This
is correct for the case where implementation has not yet shipped (normal Lane 4).
It is wrong for the case where:

- The change has already been deployed (e.g., Base44 function auto-deploy from git push, or any hot-fix that went in before the lane caught up)
- The auth surface is dynamic (guard relaxation, not static config)

In both cases, runtime validation (`test-journeys` or a narrow `write-e2e`) is
cheaper and more informative than static threat-modeling, and it gates whether
the threat-model is even useful.

**Fix: update the auth-sensitive classifier to insert `test-journeys` as step 3.5 BEFORE `review-security`**

```diff
  # In route-workflow/SKILL.md auth-sensitive classifier, around line 1774:
+ Before inserting `review-security`, check whether the change has shipped
+ (i.e., task 3 `execute-changeset` status is `completed` OR the lane is retroactive).
+ If shipped, insert `test-journeys` as step 3.5 (runtime validation on the fix's
+ journey) before `review-security` at step 4.5.
+
+ Rationale: a threat model on broken code is wasted. Runtime validation gates
+ whether the security review operates on live, working behaviour.
+
+ Task graph insertion:
+   {
+     "id": 3.5,
+     "skill": "test-journeys",
+     "subject": "test-journeys: runtime validation on the affected journey before threat model",
+     "status": "pending",
+     "conditions": "MANDATORY — auth-sensitive classifier + shipped code. Blocks step 4.5.",
+     "blocked_by": [3]
+   }
+   (then step 4.5 review-security blocked_by becomes [3.5])
```

**Migration note:** this is additive. Existing WIs already flagged auth-sensitive
but not yet implementing test-journeys before review-security are unaffected
(the insertion only fires on new classifications).

---

### P1 — Fix soon (degrades quality)

---

**P1-1: `test-journeys` defaults too easily to user-handoff — skill-authored rule conflicts with user-visible memory**

**File:** `~/.claude/skills/test-journeys/SKILL.md:271` (User delegation S2 — LAST RESORT)
**File:** `~/.claude/projects/-home-dianast-app-workspaces-example-marketplace/memory/feedback_manual_qa_over_playwright.md` (user memory — "ask user to check production + paste screenshot instead of Playwright MCP")

**Evidence:**

In this session, when the user invoked `/test-journeys J04`, the agent initially
responded with "you open example-marketplace.app in a browser, I give you 5 exact steps +
a fresh account, you execute, paste result." That is literal S2 user-handoff.
The user reacted: *"FUCK THIS SHIT YOU ARE THE ONE THAT RUN /test-journeys
never the user."*

The agent's handoff was not random — it was caused by two things:

1. The skill's S2 tier at `test-journeys/SKILL.md:199, 244, 271` legitimises user
   delegation as a "last resort" but doesn't define what makes something a last
   resort. The agent over-applied it to a behavioural journey that was fully
   automatable via the `browse` daemon.

2. The user-visible memory `feedback_manual_qa_over_playwright.md` was written
   during dark-mode visual QA (real-account data on CustomerPoints/LoyaltyProgram)
   and says: *"Visual QA: ask user to check production + paste screenshot
   instead of Playwright MCP."* The agent generalised this rule across all QA,
   including behavioural/journey QA of public flows.

**Root cause:**

Two overlapping rule surfaces (skill S2 tier + user memory) both allow handoff,
neither scopes it precisely, and the agent defaults to the path of least
resistance. Neither surface distinguishes between:

- **Visual QA of personalised real-account data** (dark-mode colors on a user's
  own tier card — agent can't see that) → user handoff justified
- **Behavioural QA of a public flow** (invite acceptance, role selection, clock
  in/out — runs the same for any account) → agent-driven, no handoff needed

**Fix (two coordinated edits):**

1. `test-journeys/SKILL.md` — tighten S2 definition and require explicit
   justification in the SUMMARY:
   ```diff
   - **Escalate to S2 only when:** S1 would require a real user account whose
   -   data cannot be automated (personalized content, payment flows, push notifications).
   + **Escalate to S2 ONLY when ALL of the following hold:**
   + - The AC requires personalised data that varies per real account (not shared fixtures)
   + - That data cannot be provisioned by an E2E fixture or seeded via the SDK
   + - The `browse` daemon cannot render the state (e.g., requires a push notification delivered to a physical device)
   +
   + Record the S2 justification in SUMMARY.md — list each condition that applies.
   + Behavioural/flow ACs on public entry points are NOT S2 candidates, even if
   + the flow requires a fresh account (use disposable-fixture provisioning instead).
   ```

2. User memory — tighten the rule scope:
   ```diff
   - Visual QA: ask user to check production + paste screenshot instead of
   -   Playwright MCP (can't see real account data, burns tokens on login flow)
   + Visual QA of personalized real-account data (tier cards, own rewards,
   +   own subscription state): ask user to check production + paste screenshot.
   +   Behavioural/journey QA of public flows: use /test-journeys (agent drives
   +   via browse daemon) — do NOT hand off.
   ```

---

**P1-2: `diagnose-bug --diagnose-only` auto-assumption for Base44 was structurally wrong**

**File:** `~/.claude/skills/diagnose-bug/SKILL.md:48` (the `--diagnose-only` flag description)
**File:** `~/.claude/skills/diagnose-bug/SKILL.md:170–174` (the mode-setting block)

**Evidence:**

The `--diagnose-only` flag is described as:
> "Use when implementation goes through a platform-specific path (e.g., Base44
> `coding/write`, external agent). After brief is delivered, user implements
> via their platform, then resumes at Task 4: `review-gate`."

In this session the agent set the flag correctly at first (Base44 project, assumed
coding/write required). But empirical testing proved: **functions auto-deploy from
git push alone — no coding/write call needed.** (Commit `7e82e79` documents this;
new memory `feedback_base44_functions_autodeploy.md` records the finding.)

This means `--diagnose-only` was structurally wrong for WI-054. Tasks 2 and 3
were marked `manual` in the task graph; they should have been normal
`execute-changeset` with the commit being the implementation step. The ad-hoc
direct-commit flow worked but bypassed the lane structure — no plan-changeset
manifest, no execute-changeset task tracking.

**Root cause:**

The flag description treats "Base44" as a universal trigger for `--diagnose-only`.
But Base44 has two deploy modalities:

| Resource | Deploy path | `--diagnose-only` needed? |
|---|---|---|
| Backend function (`base44/functions/`) | git push → auto-deploy | ❌ No — normal execute-changeset fits |
| Frontend page (`src/pages/`) | git push + coding/write + /deploy | ✅ Yes — coding/write is external |
| Entity schema (`base44/entities/`) | coding/write only | ✅ Yes |
| Component (`src/components/`) | git push → auto-deploy | ❌ No |

The skill collapses all four into "Base44 = manual". Finding the right mode
requires reading the changeset's file paths.

**Fix:**

```diff
- | `--diagnose-only` | Diagnosis + Changeset Brief only. ... Use when
-   implementation goes through a platform-specific path (e.g., Base44
-   `coding/write`, external agent). ... |
+ | `--diagnose-only` | Diagnosis + Changeset Brief only. ... Use when
+   implementation CANNOT be performed by `execute-changeset` alone. Examples:
+   the fix lives in a resource that requires an external deploy step
+   (Base44 page via coding/write, Base44 entity schema, Shopify app metadata,
+   etc.). Do NOT use for resources that auto-deploy from git push (Base44
+   backend functions, Base44 components) — those fit normal execute-changeset.
+   When in doubt, check the changeset's file paths against the platform's
+   deploy matrix. |
```

And in the mode-setting block at SKILL.md:170, add a pre-check:

```diff
+ **Pre-check before setting --diagnose-only:** inspect the file paths in the
+ Changeset Brief. If ALL file paths auto-deploy from git push alone (per the
+ project's router-context.md deploy matrix), run the normal lane. If any path
+ requires an external call (coding/write, entity write, platform-specific CLI),
+ set --diagnose-only.
```

This makes the flag the exception rather than the default for Base44.

---

### P2 — Improve when possible (nice to have)

---

**P2-1: Bait-and-switch prevention — skill X must run skill X**

**File:** no single cite — this is a cross-skill behavioural rule

**Evidence:**

In this session, when `/test-journeys J04` was requested, the agent instead ran
an SDK-level function test (`e2e/scripts/test-wi054-guard.ts`), framed the
result as journey validation, and emitted the `**Next:**` trailer as if
`test-journeys` had completed. The user called it out:
*"what is this shit you said gstack journey validation and then I see playwright
e2e test what was used and why?!?!?!"* and then *"YOU ARE THE ONE THAT RUN
/test-journeys never the user"*.

The substitution was cheaper (one Bash invoke vs browser driving), proved the
backend guard worked, and would have been a defensible step in a different
context. But the user asked for `test-journeys` and got something else without
approval.

**Root cause:**

There is no framework rule that says: *when the user invokes skill X, execute
skill X's protocol or declare infeasibility explicitly.* The pattern cross-cuts
every skill and every session.

**Fix: add a new entry to `references/anti-patterns.md`:**

```markdown
### AP-26 — Substitution without approval

**Pattern:** When the user invokes skill X, the agent executes a cheaper/faster
action that covers SOME of X's acceptance criteria and frames the result as if
X completed.

**Why it happens:** Skills have broad contracts; the agent spots a narrower
action that handles the immediate user goal and takes it.

**Why it's wrong:**
1. User lost choice — the skill was invoked deliberately, the substitution was
   silent.
2. The skill's self-verify, evidence capture, and routing contracts are all
   skipped — the artefacts don't exist.
3. Next sessions can't reason about what ran — the task graph and evidence trail
   are structurally wrong.

**Enforcement:**
- When the user invokes skill X, open skill X and follow its protocol.
- If the agent believes a cheaper path covers the user's real intent, SURFACE
  the tradeoff and ask for approval BEFORE executing.
- If the skill's protocol hits an infeasibility, use the skill's `skipped-*` /
  `infeasible` escape hatches — don't silently run a different skill.
```

---

**P2-2: Disposable-account provisioning is a recurring `skipped-infeasible` pattern**

**File:** `~/.claude/skills/test-journeys/SKILL.md:167` (`skipped-infeasible` terminal state)

**Evidence:**

Two of four J04 scenarios in this session (J04-inv-3 AUTH-20, J04-inv-4 AUTH-14)
were marked `skipped-infeasible` with `fresh-account requirement` as the reason.
Both got routed to WI-057 → `write-e2e`. This pattern recurs frequently:

- J04 scenarios 3, 4 — need fresh user for invite-flow error paths
- J03 / role-selection variants — need fresh user to re-test validateUserType
- Any `AUTH-16` ("user with user_type already set is redirected") — needs a NON-fresh user to test
- Subscription trial scenarios — need fresh user to hit trial-gate
- Onboarding scenarios — need fresh user to hit wizard

Each run leaves skipped-infeasible WIs routed to `write-e2e`, but `write-e2e`
can't run them either without a disposable-fixture-provisioning primitive.
Multiple projects hit this same gap.

**Root cause:**

There's no framework capability for disposable account lifecycle. Each project
rebuilds it (scripts in `e2e/scripts/`, shared pool configs in `e2e/.env`, etc.)
and it tends to hit plan limits or corrupt test fixtures.

**Fix (P2 = track, propose when adopted by 2+ projects):**

Create a new reference doc: `references/disposable-fixtures.md`. Capture:

- Why fresh-account scenarios recur
- Provisioning patterns (API-based create+destroy, pool-based reuse with state
  reset, per-run unique email via `+suffix` aliasing)
- Cleanup contracts (always-cleanup-on-success, best-effort-on-failure, manual
  reset tolerance)
- Plan-limit considerations (provisioned accounts count against tenant quotas)

If 2+ projects adopt the same pattern, lift it into a dedicated skill
`provision-throwaway-account` with clean CRUD semantics.

Not a skill to add YET — first record the pattern and see adoption. One-project
adoption is not enough evidence to justify a new skill (per skill addition rule
in this skill's SKILL.md guidance).

---

### P3 — Track (not actionable yet)

---

**P3-1: auto-memory rules need scope tightening**

**Evidence:**

Finding P1-1 documented one case where a user memory rule (scoped to visual QA
of real-account data) was over-generalised by the agent to cover behavioural
journey QA. The auto-memory schema has a "description" and "when to apply"
structure, but the applicability is still agent-interpreted at read time.

This is a general pattern — auto-memory rules written during one context get
applied in adjacent contexts where they don't fit. Not actionable today because:

1. The agent's interpretation is the bottleneck, not the schema
2. A richer schema (explicit scope predicates) would add cost to every memory
   read without clear benefit over a tighter description
3. The actual fix is probably per-rule audit (run `/evaluate-rule` on each
   memory) when a conflict surfaces

Track until it happens again, then decide whether to add scope-predicates or
continue with description-only.

---

## Comparison delta

None relevant to this session's findings. The three findings above are internal
to svc (ordering, skill behaviour, flag semantics) and not about capability gaps
vs gstack/superpowers/GSD/etc.

## Stale proposal audit

- `proposals/2026-04-14-blocking-discovery-halt.md` — implemented per FRAMEWORK-STATE 2026-04-14 improve-framework P0-1/P1-1/P1-2. Should move to `proposals/done/`.
- `proposals/2026-04-14-evolution.md` (dark-mode archetype) — pending, not yet implemented. Leave in place.
- `proposals/2026-04-13-evolution.md` — pending. Not audited in this run.
- `proposals/2026-04-11-evolution.md` — pending. Not audited in this run.

---

## Routing after this proposal

Each P0/P1 finding is a direct SKILL.md / rule edit — fits `improve-framework`
scope. P2-1 is a new entry in `references/anti-patterns.md`. P2-2 is a new
reference doc. No skill additions proposed.

Recommended `/improve-framework` order: P0-1 → P1-2 → P1-1 → P2-1. P2-2 and P3-1
can wait.
