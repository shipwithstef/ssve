# Framework Improvement: diagnose-bug auto-deploy pre-check + test-journeys S2 tightening + AP-26

**Status:** IMPLEMENTED (2026-04-14)
**Parent proposal:** `proposals/2026-04-14-evolution-wi054-session.md` P1-2, P1-1, P2-1

## Evidence

Three findings from the WI-054 session that share a common theme: **scope
discipline**. Each was a case where an agent defaulted to a behaviour
structurally wider or narrower than the user intended, and the user had to
intervene.

- **P1-2:** `diagnose-bug --diagnose-only` defaulted ON for all Base44 projects,
  even when the changeset only touched backend functions (which auto-deploy
  from `git push` alone). The flag should fire only when the fix requires an
  external deploy call.
  - Source file: `diagnose-bug/SKILL.md:48` (flag description) + `:170-174` (mode block)

- **P1-1:** `test-journeys` S2 (user-delegation) tier was too loosely defined,
  allowing the agent to hand off behavioural QA to the user when it should
  have run agent-driven S1 via the `browse` daemon.
  - Source file: `test-journeys/SKILL.md:244` (S2 definition) + user memory
    `feedback_manual_qa_over_playwright.md`

- **P2-1:** No framework rule named the anti-pattern of substituting skill X
  with a cheaper action Y and labelling the result as X. User called it out
  sharply: *"what is this shit you said gstack journey validation and then I
  see playwright e2e test what was used and why?!?!?!"*
  - Needed: new entry in `references/anti-patterns.md` (next slot: AP-26)

**Severity:** medium across all three — none blocks correctness, but each
recurred in this one session. AP-26 is the most generally applicable.

## Diagnosis

- **Root cause (common):** each finding was a scope-default problem. `--diagnose-only`
  defaulted too wide (all Base44). S2 defaulted too loose (any fresh-account need).
  Skill X → action Y substitution had no rule against it. The agent took the path
  of least resistance because no contract said not to.
- **Category:** drift (P1-2), fragility (P1-1), missing capability (P2-1)
- **Already in FRAMEWORK-STATE.md?** no — all three are new findings from today's session.

## Implementation

- **Route:** direct SKILL.md edits + reference doc edit + user memory edit. No
  new skills, no lane restructuring, no external blending.

- **Files changed:**
  1. `diagnose-bug/SKILL.md` — rewrote flag description (line 48) and added
     "Auto-Deploy Pre-check (MANDATORY before setting `--diagnose-only`)" block
     after the mode-setting section.
  2. `test-journeys/SKILL.md` — replaced the loose S2 escalation rule with a
     three-condition AND gate + explicit rule that behavioural/flow ACs on
     public entry points are never S2 candidates.
  3. `~/.claude/projects/-home-dianast-app-workspaces-example-marketplace/memory/feedback_manual_qa_over_playwright.md`
     — tightened S2 definition to match the skill, added the 2026-04-14 WI-054
     behavioural-handoff counter-example, updated the "How to apply" guidance.
  4. `references/anti-patterns.md` — added AP-26 (Skill Substitution Without
     Approval) before the Cross-References section at EOF.

- **Commits:** (this commit, same session as P0-1's commit `3548abf`)

## Replay Verification

- **Replay target — P1-2:** on the WI-054 trajectory, the agent set
  `--diagnose-only` and marked tasks 2-3 `manual` assuming Base44 always needs
  external deploy. Updated skill text now requires an Auto-Deploy Pre-check
  against `router-context.md`. For a changeset containing only
  `base44/functions/atomicEmployeeCreate/entry.ts`, the pre-check correctly
  classifies the path as `auto-deploys` and the agent would NOT set the flag.
  PASS by inspection.

- **Replay target — P1-1:** on the WI-054 trajectory, the agent initially
  offered user-handoff for `/test-journeys J04`. Updated skill text requires
  ALL THREE S2 conditions to hold, and explicitly names behavioural/flow ACs
  as never-S2. J04 invite flow is behavioural on a public entry point — new
  rule forces agent-driven S1. PASS by inspection.

- **Replay target — P2-1:** on the WI-054 trajectory, the agent substituted
  `test-journeys` with an SDK script. Updated anti-patterns doc now names this
  explicitly as AP-26. `review-gate` and `audit-coverage` gain a detection
  heuristic: claim-of-completion without evidence-artefacts = likely
  substitution. PASS by inspection.

All three replays are qualitative (skill-text-prescribes-the-behaviour) rather
than live (can't replay WI-054 — fix already shipped, lane in progress).

## FRAMEWORK-STATE.md Mutations

**Analysis History entry (to add):**

```markdown
### 2026-04-14: diagnose-bug auto-deploy pre-check + test-journeys S2 tightening + AP-26 skill substitution (proposal 2026-04-14-evolution-wi054-session.md P1-2, P1-1, P2-1)

**Source:** Example Marketplace WI-054 session findings. Three scope-discipline gaps surfaced:
(a) `--diagnose-only` defaulted ON for all Base44, causing unnecessary lane stranding for function-only changesets; (b) `test-journeys` S2 tier allowed user-handoff for behavioural QA that `browse` daemon could drive; (c) no framework rule named the anti-pattern of substituting skill X with a cheaper action Y.

**Changes landed:**

1. **`diagnose-bug/SKILL.md` flag description + "Auto-Deploy Pre-check" block.** Flag description now distinguishes resources that auto-deploy from git push (Base44 backend functions, Vercel-on-push) from those needing external calls (Base44 pages, entity schemas). Pre-check requires consulting `router-context.md` deploy matrix before setting the flag. Missing router-context defaults conservatively to `--diagnose-only` AND files a drift WI routed to `onboard-repo`.

2. **`test-journeys/SKILL.md` S2 tier.** Replaced loose "personalized content / payment flows / push notifications" with a three-condition AND gate (personalised data per user AND cannot be provisioned AND `browse` daemon cannot render). Added explicit rule: behavioural/flow ACs on public entry points are NEVER S2 candidates, regardless of fresh-account requirement — use disposable fixtures or route to `write-e2e`.

3. **`references/anti-patterns.md` AP-26.** New anti-pattern: Skill Substitution Without Approval. When user invokes skill X and agent runs cheaper action Y while claiming X completed. Enforcement rule: invoke means execute; surface trade-offs before substituting; use skill escape hatches for infeasibility. Detection heuristic for `review-gate` / `audit-coverage`: claim-of-completion without evidence-artefacts = likely AP-26.

**Replay:** qualitative PASS. Each skill-text now prescribes exactly what the user had to manually demand in the WI-054 session.

**Decisions locked:**

- `--diagnose-only` is the EXCEPTION, not the default, for Base44. Normal Lane 4 with `execute-changeset` handles any changeset whose paths auto-deploy from git push.
- S2 (user delegation) requires three conditions, all three documented in SUMMARY.md. Behavioural QA is S1, not S2. Disposable-fixture provisioning is always preferred over handoff.
- Skill X invocation means executing skill X. Substitution requires explicit user approval before execution.

**Evidence:**
- This commit — edits to `diagnose-bug/SKILL.md`, `test-journeys/SKILL.md`, `references/anti-patterns.md`, and `~/.claude/projects/-home-dianast-app-workspaces-example-marketplace/memory/feedback_manual_qa_over_playwright.md`
- Parent proposal: `proposals/2026-04-14-evolution-wi054-session.md`
- Landing record: `proposals/2026-04-14-framework-improvement-diagnose-s2-ap26.md`
- Triggering session (example-marketplace WI-054): full conversation 2026-04-14
```

**Known Gaps (no changes needed):** none of these three was previously tracked.

**Capabilities (`references/knowledge/svc/CAPABILITIES.md`):** no change — the edits sharpen existing capabilities (`diagnose-bug`, `test-journeys`, anti-patterns registry), don't add new ones.

**Blend registry:** N/A — internal findings, no external source.

**NOTICES:** N/A.

---

## Parent proposal status

`2026-04-14-evolution-wi054-session.md` had 6 findings total:

| Finding | Status |
|---|---|
| P0-1 — runtime-before-threat-model gate | ✅ IMPLEMENTED (prior commit `3548abf`, `proposals/2026-04-14-framework-improvement-runtime-before-threatmodel.md`) |
| P1-2 — `--diagnose-only` auto-deploy pre-check | ✅ IMPLEMENTED (this commit) |
| P1-1 — `test-journeys` S2 tightening + memory scope | ✅ IMPLEMENTED (this commit) |
| P2-1 — AP-26 skill substitution | ✅ IMPLEMENTED (this commit) |
| P2-2 — disposable-fixture provisioning reference doc | ⏭️ DEFERRED (P2 per evolution proposal guidance — track until 2+ projects need it) |
| P3-1 — auto-memory rule scope tightening | ⏭️ DEFERRED (P3 per evolution proposal guidance — track until conflict recurs) |

All P0 and P1 findings are now landed. P2-1 also landed. P2-2 and P3-1 are
tracked but not actionable yet.

**Parent proposal can move to `proposals/done/`** — all in-scope (P0/P1/P2-1) findings are implemented.
P2-2 and P3-1 are explicitly "track / not actionable yet" per their severity tier,
and deferring them is the right call per the evolve-framework skill guidance.
