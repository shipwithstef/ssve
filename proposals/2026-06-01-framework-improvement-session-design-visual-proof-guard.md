# Framework Improvement: Session/design/visual proof guard

**Status:** DRAFT
accepted_wi: WI-331
source_project: `/home/svc-user/app-workspaces/example-marketplace`
source_wi: `docs/specs/work-items/WI-331.md`

## Evidence

- **Source:** Example Marketplace WI-330 / WI-331 recovery review, user report, and the
  production customer rewards screenshot from 2026-05-31.
- **Finding:** The framework had adjacent protections, but they did not compose
  into one hard guard for this failure class:
  1. the active Example Marketplace session contract still pointed at unrelated WI-329
     while customer rewards work was implemented and deployed,
  2. the user had asked for design/product evaluation before implementation,
     but the run continued into code before presenting the design checkpoint,
  3. production proof covered a clean seeded state while the reported degraded
     state still showed multiple primary cards titled `Business details unavailable`,
  4. the rewards spec rejected bare `Location` but did not mechanically reject
     degraded fallback copy in primary identity positions.
- **Severity:** HIGH. This failure can ship a user-visible bad product state
  while every individual proof artifact looks plausible in isolation.

## Diagnosis

- **Root cause:** The framework has siloed gates for session contracts,
  solution-confidence, visual evidence, and post-deploy proof. It lacks a
  composed pre-mutation and closeout rule that says: "for an onboarded project,
  the active WI/session, human design gate, required visual state inventory, and
  production proof target must all match the actual work before implementation
  or closeout can proceed."
- **Category:** fragility / contract enforcement.
- **Already in FRAMEWORK-STATE.md?** Partially. Adjacent fixes exist:
  - 2026-05-30 solution-confidence protocol and approval packet.
  - 2026-05-31 post-deployment evidence lock.
  - WI-scoped task/claim isolation for parallel sessions.
  This exact composition gap is new and should not be treated as closed by those
  adjacent fixes.

## Proposed Implementation

- **Route:** normal svc pipeline on the framework repo. This touches
  route-workflow, visual proof, and closeout semantics, so it should not be a
  drive-by quick fix.
- **Files likely changed:**
  - `route-workflow/SKILL.md`
  - `route-workflow/references/hot-path-operational-details.md`
  - `references/solution-confidence-protocol.md`
  - `track-visuals/SKILL.md`
  - `_shared/live-evidence.md`
  - `verify-promotion/SKILL.md`
  - `base44-environment/SKILL.md`
  - `test-framework/evals/tier-1/validate-session-design-visual-proof-guard.sh`
  - `FRAMEWORK-STATE.md`
- **Commits:** TBD after implementation.

## Required Contract Changes

### 1. Pre-Mutation Session Binding Guard

Before any mutating, deploy-affecting, or WI-bound work in an onboarded project,
`route-workflow` must verify that the latest session contract aligns with the
target WI/skill/lane and the user's latest request.

Allowed states:

- latest session contract is bound to the target WI,
- current branch/task claim resolves to the target WI,
- user explicitly asked to create a new WI/intake for the work,
- user explicitly requested an unbound emergency hotfix, with an override logged.

Blocked states:

- latest session contract points to an unrelated WI,
- route is about one product surface while active graph is for another surface,
- implementation starts before a fresh WI/claim is created.

### 2. Post-Design Human Gate Preservation

When `solution_confidence_mode=post_design_human_gate`, planning and
implementation remain blocked until all are true:

- `SOLUTION-CONFIDENCE.md` exists,
- it contains the action-by-action approval packet,
- user approval is explicit and logged,
- the task graph transitions `plan-changeset` out of blocked state only after
  that approval.

Existing solution-confidence validation covers parts of this. The new guard
must ensure later follow-up messages and stop-hook continuations do not bypass
the gate by continuing an implementation task from an unrelated WI.

### 3. Representative Visual State Inventory

For data-backed browser-visible UI changes, `track-visuals` and closeout must
require a state inventory before proof is accepted. The minimum inventory is:

- clean populated,
- empty/no data,
- degraded metadata/source,
- multi-row or grouping case,
- mobile viewport,
- any domain-specific semantic reject labels.

Skipping a state requires an explicit waiver in the evidence artifact. A clean
happy-path screenshot cannot satisfy a degraded-state report.

### 4. Semantic Reject Labels For Primary Identity

Specs and visual/E2E proof must be able to name forbidden fallback strings in
specific UI roles. Examples:

- `Business details unavailable` must not appear as a primary reward program
  card title or branch picker identity.
- `Location` must not appear as a generic fallback entity name.
- `Unknown` must not appear as a primary user-facing object identity unless the
  spec explicitly permits it for that role.

The rule must distinguish degraded recovery rows from primary identity
positions; fallback text may be allowed in a secondary recovery panel while
forbidden as a title or CTA context.

### 5. Post-Deploy Proof Binds To The Inventory

If the user asks for post-deploy validation, and a state inventory exists, the
production proof must cover the relevant required states after deployment. Local
proof, bundle checks, and clean seeded screenshots are supporting evidence only.

## Replay Verification

- **Replay target:** a new Tier-1 regression,
  `test-framework/evals/tier-1/validate-session-design-visual-proof-guard.sh`.
- **Fixture requirements:**
  1. A sample project has a latest session contract bound to `WI-329`.
  2. A new request targets a different surface and requires `WI-330`.
  3. A `post_design_human_gate` graph has `plan-changeset` blocked.
  4. A visual proof artifact covers only clean populated state.
  5. The validator must fail until the project has a fresh WI/session binding,
     explicit design approval, and visual proof for degraded metadata/source.
- **Result:** TBD.
- **Evidence:** TBD.

## Acceptance Criteria

- Route-workflow blocks mutating work when the active session contract is
  unrelated to the requested WI/surface unless a fresh WI or explicit override
  is recorded.
- `post_design_human_gate` cannot be bypassed by stop-hook continuation or by
  resuming an implementation task from another WI.
- Data-backed visual proof requires an explicit state inventory with degraded
  metadata/source coverage or a waiver.
- Post-deploy proof must cite production evidence for the required state
  inventory, not just any passing seeded state.
- The new Tier-1 replay reproduces the Example Marketplace WI-330/WI-331 failure class and
  passes only when the new guard text/checks are present.

## Rollback

Revert the route-workflow, track-visuals, verification, and Tier-1 validator
patches. The rollback leaves the existing solution-confidence and post-deploy
evidence-lock behavior intact; it only removes the new composed guard.

## FRAMEWORK-STATE.md Mutations

- **Analysis History:** Add a 2026-06-01 entry describing the WI-331 composition
  gap and proposal creation.
- **Known Gaps:** Track the gap as open until implementation and replay pass.
- **Decisions:** None locked yet; final implementation should lock the composed
  guard rule if accepted.
- **Capabilities:** No capability catalog update until implemented.

## Self-Verify

| # | Check | Result |
|---|---|
| 1 | Proposal is scoped to one gap | PASS |
| 2 | Evidence cites the user-reported WI-330/WI-331 failure class | PASS |
| 3 | Adjacent existing fixes are acknowledged instead of rediscovered | PASS |
| 4 | Proposed route is normal framework pipeline, not ad hoc quick-fix | PASS |
| 5 | Replay target names a concrete Tier-1 validator | PASS |
