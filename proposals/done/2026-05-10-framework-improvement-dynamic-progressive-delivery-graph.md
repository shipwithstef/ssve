# Framework Improvement: Dynamic Progressive Delivery Graph

**Status:** DRAFT
**Date:** 2026-05-10
**Source:** Example Marketplace WI-233 closure audit + follow-up route-workflow review
**Scope:** one framework gap

## Gap

`route-workflow` is the universal entrypoint, but it still behaves too much like a router plus scattered rulebook. It can choose a lane and name the next skill, but it does not yet compile the full delivery system into one durable graph before execution starts.

That leaves too much orchestration in agent memory. A user can correctly start with `$route-workflow`, and an agent can still omit or under-specify mandatory evidence steps such as:

- `validate-feature`, `write-spec`, `audit-ac`, `write-journeys`
- `design-ux`, `design-ui`, `design-tech`
- `track-visuals` baseline/diff for browser-visible changes
- `test-journeys` or `write-e2e` for user/admin-facing runtime behavior
- `plan-changeset`, `review-plan`, `execute-changeset`
- `review-gate`, `audit-implementation`, `review-security`
- platform-specific deployment verification such as `base44-environment`
- `audit-session-execution` when execution diverges from the expected graph
- explicit skip/N/A evidence for anything omitted

The root problem is not missing individual skills. The root problem is that route-workflow does not yet act as a deterministic delivery-graph compiler and graph maintainer.

## Desired Framework Shape

The ideal user interaction should remain simple:

```text
$route-workflow <goal> end-to-end
```

The framework should own the orchestration:

1. normalize the user's request
2. bind the session contract
3. classify repo mode and change type
4. infer risk flags and platform obligations
5. compile a full `delivery_graph`
6. create lane tasks from the graph
7. mark non-applicable evidence families as explicit `N/A` with proof
8. require skill receipts and phase receipts
9. mutate the graph when skill outcomes add new signals
10. verify proportional runtime and production evidence
11. classify closeout as `runtime-accepted`, `corrective-closure-complete`, `framework-complete`, or `blocked`

The user should not need to remember the internal chain. The user states intent, scope, and urgency. The framework compiles and enforces the right path.

## Proof This Is Missing

This proposal is evidence-backed, not a preference.

Framework evidence:

- `route-workflow/references/lane-model.md` defines lanes and says when `track-visuals`, `test-journeys`, `write-e2e`, and `audit-implementation` are mandatory.
- `route-workflow/references/task-graph-protocol.md` says omitted lane steps require skip reasons and browser-visible changes require visual evidence.
- `references/skip-conditions.json` documents per-skill skip conditions.
- `review-plan/SKILL.md`, `track-visuals/SKILL.md`, `test-journeys/SKILL.md`, `audit-implementation/SKILL.md`, and `audit-session-execution/SKILL.md` already contain strong local contracts.
- Existing scripts such as `scripts/validate-task-graph-lane.mjs` catch some missing mandatory steps.

But these are fragmented. There is no canonical `delivery_graph` artifact that records, before execution:

- which evidence families apply
- which skills are required because of those families
- which skills are conditionally mandatory from risk flags
- which skills are N/A and why
- how downstream skill outcomes mutated the graph
- whether closeout is framework-complete or merely runtime-accepted

Example Marketplace WI-233 evidence:

- `.svc/lane-tasks-WI-233.json` contained only corrective tasks: `write-e2e`, `review-gate`, `verify-promotion`, and closeout.
- The graph had no `delivery_graph` block and no `retrospective_closure` block.
- It did not include, or explicitly mark N/A, upstream skills such as `validate-feature`, `write-spec`, `audit-ac`, `write-journeys`, `design-tech`, `plan-changeset`, `review-plan`, `execute-changeset`, or `audit-implementation`.
- `.svc/pipeline-decisions.jsonl` had no WI-233 route decision entries.
- The later audit concluded product behavior was fixed, but the original execution was not full-framework compliant.

Causal chain:

```text
No compiled delivery graph
  -> no single source of required evidence families
  -> partial task graph can look acceptable
  -> omitted skills have no durable N/A ledger
  -> runtime proof can be mistaken for framework completion
```

PR #88 and PR #89 address closeout wording and retrospective closure completeness. They do not solve the upstream compiler gap.

## Proposed Fix

Add a delivery-graph compiler to `route-workflow` and make it the source of truth for lane tasks, mandatory insertions, skip/N/A evidence, graph mutation, and closeout classification.

At lane entry, route-workflow must write a machine-readable `delivery_graph` block into `.svc/lane-tasks-<WI>.json` before any downstream skill starts.

Minimum schema:

```json
{
  "delivery_graph": {
    "compiler_version": 1,
    "user_intent": "<normalized user goal>",
    "repo_mode": "bootstrap|convert",
    "change_type": "feature|bugfix|regression|drift|refactor|chore|framework",
    "lane": "greenfield|brownfield-feature|bugfix|drift|refactor|framework",
    "delivery_mode": "interactive|end_to_end",
    "risk_flags": [
      "browser-visible",
      "user-facing",
      "admin-facing",
      "backend-function",
      "auth-sensitive",
      "external-integration",
      "data-model-change",
      "deploy-affecting",
      "base44-platform",
      "retroactive",
      "graph-mismatch"
    ],
    "platform_contracts": ["base44-environment"],
    "evidence_families": {
      "product": "required|n/a|satisfied",
      "acceptance_criteria": "required|n/a|satisfied",
      "journey": "required|n/a|satisfied",
      "visual": "required|n/a|satisfied",
      "runtime": "required|n/a|satisfied",
      "plan_review": "required|n/a|satisfied",
      "code_review": "required|n/a|satisfied",
      "implementation_audit": "required|n/a|satisfied",
      "deploy": "required|n/a|satisfied",
      "promotion": "required|n/a|satisfied",
      "session_forensics": "required|n/a|satisfied"
    },
    "required_skills": [],
    "conditional_mandatory_skills": [],
    "skipped_skills": [
      {
        "skill": "design-ui",
        "skip_condition_id": "design-ui:no-visual-surface",
        "reason": "backend-only; no browser-visible surface",
        "evidence": "planned file set contains only base44/functions/**"
      }
    ],
    "verification_tiers": {
      "local": [],
      "runtime": [],
      "production": []
    },
    "mutation_history": [],
    "closeout_classification_required": true
  }
}
```

## Conditional Mandatory Rules

Use "conditional mandatory", not "optional", for skills that are required when a signal is present.

| Signal | Mandatory graph insertion |
|---|---|
| New feature or materially changed behavior | `validate-feature`, `write-spec`, `audit-ac`, `write-journeys` |
| User-facing or admin-facing runtime behavior | `test-journeys` or `write-e2e` |
| Browser-visible UI/CSS/layout/asset change | `track-visuals` baseline, `track-visuals` diff, review-gate viewport evidence, visual promotion/update handling |
| Non-trivial plan, cross-file behavior change, infra path, or execution dispatch | `plan-changeset`, `review-plan`, `execute-changeset` |
| Backend function, external integration, auth, payment, data model, concurrency, high blast radius | `design-tech`, `review-gate`, `audit-implementation` |
| Auth-sensitive change | `review-security`; if already shipped or platform auto-deploys, runtime validation before threat model |
| Base44 deploy-affecting work | `base44-environment`, root `entry.ts` check, real API/function verification |
| Graph mismatch, missing route logs, challenged closeout, retroactive/corrective closure | `audit-session-execution` |
| Any omitted lane step | explicit `skipped_skills` entry with registry-backed skip condition or graph-level N/A evidence |

## Skill Outcome Contract

Every major skill must emit a machine-readable outcome that route-workflow can use to mutate the graph.

Minimum `skill_outcome` shape:

```json
{
  "skill_outcome": {
    "skill": "diagnose-bug",
    "status": "pass|partial|blocked|fail",
    "signals_added": ["browser-visible", "graph-mismatch"],
    "required_insertions": ["track-visuals", "audit-session-execution"],
    "artifacts_produced": ["docs/specs/..."],
    "graph_mutations_requested": [
      {
        "action": "insert_task|mark_n_a|escalate|reclassify_lane",
        "target": "test-journeys",
        "reason": "user-facing bug requires runtime journey proof"
      }
    ],
    "closeout_impact": "framework-complete|runtime-accepted|corrective-closure-complete|blocked"
  }
}
```

The graph compiler must re-run after these skills, because they can discover new facts:

- `diagnose-bug`
- `validate-feature`
- `write-spec`
- `design-tech`
- `plan-changeset`
- `execute-changeset`
- `review-plan`
- `review-gate`
- `audit-implementation`
- `test-journeys`
- `write-e2e`
- `verify-promotion`
- `audit-session-execution`

Each graph mutation must append to `delivery_graph.mutation_history` with timestamp, source skill, reason, and affected tasks.

## Closeout Rules

`framework-complete` is allowed only when every required evidence family is `satisfied` or explicitly `n/a` with proof.

Closeout states:

- `runtime-accepted`: runtime/prod behavior passes, but one or more framework evidence families are missing.
- `corrective-closure-complete`: a retroactive/corrective pass repaired evidence, but original execution was incomplete.
- `framework-complete`: compiled graph is satisfied, mandatory skills ran or have valid N/A evidence, post-merge/promotion evidence exists where required.
- `blocked`: required evidence cannot be obtained or a mandatory skill failed.

If the user challenges completion, or if actual execution differs from the compiled graph, `audit-session-execution` becomes mandatory before closeout can claim `framework-complete`.

## User Interaction Contract

The user-facing ideal stays:

```text
$route-workflow build/fix <thing> end-to-end, use the proper framework flow, land and verify it.
```

Useful modifiers:

- `minimal safe path` — proportional verification, not every possible test.
- `full product lane` — force discovery/spec/personas/journeys/design before implementation.
- `retroactive audit` — reconstruct execution and classify runtime versus framework completeness.
- `proposal only` — diagnose and log improvement without implementation.
- `no deploy` — stop before production deployment and classify honestly.

These modifiers improve precision, but they are not required for correctness. A plain `$route-workflow <goal>` must still compile the safest complete graph.

## Acceptance Criteria

- `route-workflow` defines delivery-graph compilation as mandatory before downstream skill dispatch.
- `.svc/lane-tasks-<WI>.json` includes `delivery_graph` for mutating, deploy-affecting, end-to-end, corrective, and framework-evolution runs.
- Graph compilation populates risk flags, evidence families, required skills, conditional mandatory skills, skipped skills, verification tiers, mutation history, and closeout requirements.
- Browser-visible changes fail validation unless `track-visuals` baseline/diff evidence is present or visual evidence is explicitly N/A with proof.
- User/admin-facing runtime behavior fails validation unless `test-journeys` or `write-e2e` evidence is present or explicitly N/A with proof.
- Backend/external/auth/data/concurrency/high-blast-radius changes fail validation unless `audit-implementation` is present or explicitly skipped using the registered skip condition.
- Non-trivial plans fail validation unless `review-plan` is present or skipped with a valid trivial/prior-review reason.
- Base44 deploy-affecting work fails validation unless `base44-environment` obligations are represented in the graph and verified.
- Graph mismatch, missing route logs, user-challenged closeout, or retroactive closure fails validation unless `audit-session-execution` is present.
- Each major skill emits a `skill_outcome`, and route-workflow records any resulting graph mutation.
- Closeout cannot claim `framework-complete` unless every required evidence family is satisfied or validly N/A.

## File Impact

Likely implementation files:

- `route-workflow/SKILL.md`
- `route-workflow/references/lane-model.md`
- `route-workflow/references/task-graph-protocol.md`
- `references/skip-conditions.json`
- `scripts/task-graph.mjs`
- `scripts/validate-task-graph-lane.mjs`
- `test-framework/evals/tier-1/` delivery graph validators
- `test-framework/fixtures/` delivery graph fixtures

Likely skill contract updates:

- `diagnose-bug/SKILL.md`
- `validate-feature/SKILL.md`
- `plan-changeset/SKILL.md`
- `review-plan/SKILL.md`
- `execute-changeset/SKILL.md`
- `review-gate/SKILL.md`
- `audit-implementation/SKILL.md`
- `track-visuals/SKILL.md`
- `test-journeys/SKILL.md`
- `write-e2e/SKILL.md`
- `verify-promotion/SKILL.md`
- `audit-session-execution/SKILL.md`
- `base44-environment/SKILL.md`

## Replay Fixtures

Required fixtures:

1. Example Marketplace WI-233 partial corrective graph: fails until required/skip graph and session-forensics evidence are explicit.
2. CSS-only chore: requires browser-visible flag and `track-visuals`.
3. User-facing bugfix: requires `test-journeys` or `write-e2e`.
4. Backend Base44 function: requires `base44-environment` and `audit-implementation`.
5. Docs-only change: passes with no-code verification N/A evidence.
6. User-challenged closeout: requires `audit-session-execution` before framework-complete.

## Rollback

Remove the `delivery_graph` requirement and validators. Existing lane task graphs remain readable because the block is additive.
