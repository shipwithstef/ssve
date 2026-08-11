# Framework Improvement: BLOCKING_DISCOVERY halt protocol across verifying skills

**Status:** BLOCKED (awaiting scope decisions; see "Why BLOCKED" below)

## Evidence

- **Source:** Example Marketplace WI-053/WI-054 live session 2026-04-14. Parent proposal:
  `example-marketplace/proposals/2026-04-14-blocking-discovery-halt.md` (P0-2 finding).
- **Finding:** When a verifying skill (`write-e2e`, `verify-promotion`,
  `audit-implementation`, `review-security`) discovers a blocking production
  bug mid-run, the framework has no structural gate to force a halt and
  reroute. The prose rule at `write-e2e/SKILL.md:79` ("Fix the App, Not
  the Test") is insufficient — in a live session, an agent read past it
  and shipped mocks-as-VERIFIED. P0-1 (self-verify #10 enumeration →
  principle) and P0-3 (diagnose-bug pre-lock rejection) address adjacent
  failures but do not cover the cross-skill halt contract.
- **Severity:** HIGH (the rule this replaces was already P0 per the parent
  proposal; prose rules without structural gates leak in practice)

## Diagnosis

- **Root cause:** The framework has no explicit event-type for
  "blocking discovery made during self-verify" and no artifact format to
  record one. Each verifying skill has its own self-verify checklist but
  no shared protocol for what to do when a check fails due to an upstream
  defect rather than a test flake. The downstream action (file a WI,
  block the parent) is described in prose per-skill, not in a single
  shared contract.
- **Category:** missing capability (cross-skill contract) + fragility
  (prose rules leak in high-pressure sessions)
- **Already in FRAMEWORK-STATE.md?** NO — adjacent entries exist (Step 0.4
  pre-lock rejection landed same day) but this specific cross-skill
  contract is new.

## Proposed Scope

This change is larger than a single SKILL.md edit. It touches:

1. **New artifact format** — `.svc/blocking-discovery-<parent-WI>.md`
   with a required schema (symptom, probable root cause, routing
   recommendation, evidence pointers). Needs a reference doc.

2. **New WI state lexicon entry** — `BLOCKED_ON_DISCOVERY` distinct from
   generic `BLOCKED`. Needs a definition in the INDEX template + a rule
   for how it unblocks (automatic on the blocking WI completing +
   re-run self-verify passing without workarounds).

3. **Shared halt contract across verifying skills:**
   - `write-e2e/SKILL.md` — self-verify check #8 and #10 must emit
     BLOCKING_DISCOVERY artifact when triggered, refuse PASS
   - `verify-promotion/SKILL.md` — smoke failure due to production bug,
     same contract
   - `audit-implementation/SKILL.md` — audit failure revealing missing
     code path, same contract
   - `review-security/SKILL.md` — security finding that reveals the
     change is unsafe, same contract

4. **`route-workflow/SKILL.md`** — recognize BLOCKING_DISCOVERY artifact
   as a signal to (a) mark parent WI as `BLOCKED_ON_DISCOVERY` in INDEX,
   (b) file the discovery as a new WI entering at `diagnose-bug` in
   symptom-only form (reject pre-locked fix per Step 0.4), (c) refuse to
   mark the parent WI `VERIFIED` while the blocking WI is unresolved.

## Why BLOCKED

Three scope questions must be answered before implementation begins:

**Q1: Artifact scope.** Is `BLOCKING_DISCOVERY.md` a full reference doc
(like `references/pillars-coverage-matrix.md`) with schema, examples, and
validators? Or an inline template inside each verifying skill? The first
is more discoverable and reusable; the second is less coordination
overhead. Recommendation: full reference doc.

**Q2: WI state lexicon governance.** Currently WI states are freeform
strings (`identified`, `in_progress`, `VERIFIED`, `NO-SHIP`, `BLOCKED`).
Introducing `BLOCKED_ON_DISCOVERY` argues for formalizing the lexicon
into a reference doc (`references/wi-state-lexicon.md`) so future states
don't proliferate. Do we want that formalization now, or keep it loose
and just add one string?

**Q3: Audit-implementation scope.** Does `audit-implementation` use the
same halt contract? Its "discovery" of a gap is structurally different
from a runtime test failure — it's a static audit. Do we treat audit-
discovered gaps as BLOCKING_DISCOVERY-worthy, or is that the existing
audit report format's job? Recommendation (tentative): audit findings
become BLOCKING_DISCOVERY only when the finding blocks the parent WI
from being correctly VERIFIED — otherwise they're informational.

## Routing When Unblocked

Per `improve-framework` routing rules:

> Larger pipeline/framework change → Normal svc pipeline

This change qualifies. Recommended entry: `write-spec` in delta mode on
the svc repo, then `design-tech` (artifact schema + state lexicon),
`plan-changeset` (per-skill edit plan), `execute-changeset`,
`review-gate`, replay via `test-framework` on a simulated
`write-e2e` → blocking-discovery scenario. **NOT a direct SKILL.md
edit** — the coordination across 5 skills + 2 new docs is too broad for
quick-fix routing.

## Implementation Placeholder

- **Route:** normal svc pipeline (when unblocked)
- **Files expected to change:**
  - NEW: `references/blocking-discovery-format.md`
  - NEW (maybe, per Q2): `references/wi-state-lexicon.md`
  - EDIT: `write-e2e/SKILL.md` (self-verify checks #8 + #10 + halt output)
  - EDIT: `verify-promotion/SKILL.md`
  - EDIT: `audit-implementation/SKILL.md` (scope per Q3)
  - EDIT: `review-security/SKILL.md`
  - EDIT: `route-workflow/SKILL.md` (BLOCKING_DISCOVERY recognizer + WI state handling)
  - EDIT: `onboard-repo/SKILL.md` (INDEX template mentions new state)
- **Commits:** TBD when implemented

## Replay Verification (TBD)

When implemented, replay the WI-053 session mentally:

- `write-e2e` self-verify detects `atomicEmployeeCreate` 401 in real
  backend → emits `.svc/blocking-discovery-WI-053.md` → marks
  parent WI `BLOCKED_ON_DISCOVERY: WI-054` → files WI-054 in symptom-
  only form (passes `diagnose-bug/SKILL.md:0.4`) → refuses self-verify
  PASS → returns control to user/parent skill for next routing decision.

If that flow runs end-to-end without workaround-path being reached,
replay PASSes.

## FRAMEWORK-STATE.md Mutations (TBD)

When implemented:
- Analysis History: new entry for halt protocol
- Known Gaps: close adjacent "prose rules leak under pressure" class
- Decisions: new state `BLOCKED_ON_DISCOVERY` locked; BLOCKING_DISCOVERY
  artifact format locked
- Capabilities (`svc/CAPABILITIES.md`): add halt-protocol capability

## How To Unblock

Answer Q1, Q2, Q3 above. Remove the `**Status:** BLOCKED` line from this
proposal. `improve-framework` Step 1.5 will pick it up on the next run.
