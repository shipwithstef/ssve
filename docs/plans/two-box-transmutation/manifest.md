# Two-Box Planning and Deterministic Transmutation

**WI:** WI-FW-TWO-BOX-01
**Spec:** docs/specs/features/two-box-transmutation.md
**Lane:** framework
**Mode:** inline
**Status:** DRAFTED after RD01-RD12; awaiting root review; not an implementation PASS
**Branch:** framework-two-box-transmutation
**Base:** 0dcd69d255642dcc78db521e95afa2b18ea1276f
**Risk Flags:** runtime_concurrency, external_state_writer, config_schema_migration, cross_runtime_integration
**UX/UI:** N/A — headless operators; no product screens, tokens, or visual mocks. Operator-visible states are CLI/skill outcomes in the spec and J-FW-07. Persona S1 Framework Orchestrator.

## Root corrections and authority

Cursor authored this conversion. The root reviewer applied RC01–RC06 in the bound technical design: effective prompt inspection, trusted pre-implementation bootstrap, concrete frozen-input role launches, conditional research, signed review seal and immutable task context. Those exact corrected sections define implementation. Full original solution requirements remain bound for every task. Planning documents are already prepared and must not be rewritten by executor T7; T7 records tests/closeout in separate report/review-log files.

## Implementation Summary

Replace default-off blind-floor shadowing with Two-Box before conversion. Isolate Open Box with a facts directory and supported Codex sandbox argv. Assign two Contract-only scout processes. Assess without a fourth winner. Prepare a complete v5 contract (inline and dispatch) before the existing holistic review, then seal from the actual review-plan receipt. Share one research predicate with resume. Issue this WI as the frozen inline v4 bootstrap only.

Invariants: original AC01-AC18; fail-closed unproven isolation; no HOME/CODEX_HOME/dispatch-policy writes from recipes; current issuance cannot select old versions except the content-hashed bootstrap v4; package vs consumer identity; durable git-common-dir objects.

## Files Planned

| Task | Action | File | Purpose |
|---|---|---|---|
| T0 | CREATE | docs/plans/two-box-transmutation/manifest.md | Carry-forward; preserve reviewed bytes; no rewrite |
| T0 | CREATE | docs/plans/two-box-transmutation/plan-contract.json | Carry-forward; preserve reviewed bytes; no rewrite |
| T0 | CREATE | docs/plans/two-box-transmutation/planning-summary.md | Carry-forward; preserve reviewed bytes; no rewrite |
| T0 | CREATE | docs/plans/two-box-transmutation/immutable-baseline.md | Carry-forward; preserve reviewed bytes; no rewrite |
| T0 | CREATE | docs/plans/two-box-transmutation/rollback-rolling.md | Carry-forward; preserve reviewed bytes; no rewrite |
| T0 | CREATE | docs/plans/two-box-transmutation/simulation.md | Carry-forward; preserve reviewed bytes; no rewrite |
| T0 | CREATE | docs/plans/two-box-transmutation/research-consumer-census.md | Carry-forward; preserve reviewed bytes; no rewrite |
| T0 | CREATE | docs/plans/two-box-transmutation/solution-plan.md | Carry-forward; preserve reviewed bytes; no rewrite |
| T0 | CREATE | docs/plans/two-box-transmutation/solution-review-dispositions.md | Carry-forward; preserve reviewed bytes; no rewrite |
| T0 | CREATE | docs/plans/two-box-transmutation/root-design-review.md | Carry-forward; preserve reviewed bytes; no rewrite |
| T0 | CREATE | docs/plans/two-box-transmutation/planned-files.json | Carry-forward; preserve reviewed bytes; no rewrite |
| T0 | CREATE | docs/specs/work-items/WI-FW-TWO-BOX-01.md | Carry-forward; preserve reviewed bytes; no rewrite |
| T0 | CREATE | docs/specs/features/two-box-transmutation.md | Carry-forward; preserve reviewed bytes; no rewrite |
| T0 | CREATE | docs/specs/tech/two-box-transmutation.md | Carry-forward; preserve reviewed bytes; no rewrite |
| T0 | CREATE | docs/specs/journeys/J-FW-07-two-box-transmutation.feature.md | Carry-forward; preserve reviewed bytes; no rewrite |
| T0 | CREATE | docs/specs/relations/two-box-transmutation.branches.md | Carry-forward; preserve reviewed bytes; no rewrite |
| T0 | CREATE | docs/specs/privacy/v4-bootstrap-snapshot.json | Parent-exclusive freeze; T3 read-only |
| T1 | MODIFY | README.md | Owned implementation surface |
| T1 | MODIFY | DOCTRINE.md | Owned implementation surface |
| T2 | MODIFY | skills/blind-control-plan/SKILL.md | Owned implementation surface |
| T2 | MODIFY | scripts/blind-floor-route.mjs | Owned implementation surface |
| T2 | MODIFY | scripts/blind-floor-check.mjs | Owned implementation surface |
| T2 | MODIFY | scripts/blind-floor-judge.sh | Owned implementation surface |
| T2 | MODIFY | provision/hosts/antigravity.json | Owned implementation surface |
| T2 | MODIFY | provision/hosts/claude.json | Owned implementation surface |
| T2 | MODIFY | provision/hosts/codex.json | Owned implementation surface |
| T2 | MODIFY | provision/hosts/cursor.json | Owned implementation surface |
| T2 | MODIFY | provision/hosts/gemini.json | Owned implementation surface |
| T2 | MODIFY | provision/hosts/grok.json | Owned implementation surface |
| T2 | MODIFY | provision/hosts/kimi.json | Owned implementation surface |
| T2 | MODIFY | provision/hosts/mimo-code.json | Owned implementation surface |
| T2 | MODIFY | provision/hosts/opencode.json | Owned implementation surface |
| T2 | MODIFY | scripts/validate-host-authority-capabilities.mjs | Owned implementation surface |
| T2 | MODIFY | references/host-capabilities.md | Owned implementation surface |
| T2 | MODIFY | scripts/resolve-dispatch.mjs | Owned implementation surface |
| T2 | MODIFY | agents/svc-stage-plan.md | Owned implementation surface |
| T2 | MODIFY | scripts/stage-segment.mjs | Owned implementation surface |
| T2 | MODIFY | references/skill-runtime-contracts-v2.json | Owned implementation surface |
| T2 | MODIFY | references/model-routing.md | Owned implementation surface |
| T2 | MODIFY | schemas/dispatch-policy.schema.json | Owned implementation surface |
| T2 | MODIFY | scripts/run-external-review.mjs | Owned implementation surface |
| T2 | CREATE | scripts/two-box-plan.mjs | Owned implementation surface |
| T2 | CREATE | scripts/lib/two-box-protocol.mjs | Owned implementation surface |
| T2 | CREATE | scripts/lib/isolated-plan-analysis.mjs | Owned implementation surface |
| T2 | CREATE | scripts/lib/two-box-scout-assign.mjs | Owned implementation surface |
| T2 | CREATE | scripts/lib/two-box-role-launch.mjs | Owned implementation surface |
| T3 | MODIFY | schemas/receipts/control-plan.schema.json | Owned implementation surface |
| T3 | MODIFY | schemas/receipts/plan-manifest.schema.json | Owned implementation surface |
| T3 | MODIFY | scripts/emit-receipt.mjs | Owned implementation surface |
| T3 | MODIFY | scripts/check-chain-receipts.mjs | Owned implementation surface |
| T3 | MODIFY | scripts/lib/plan-manifest-contract.mjs | Owned implementation surface |
| T3 | MODIFY | scripts/prepare-plan-handoff.mjs | Owned implementation surface |
| T3 | MODIFY | scripts/lib/review-inputs.mjs | Owned implementation surface |
| T3 | MODIFY | skills/plan-changeset/SKILL.md | Owned implementation surface |
| T3 | MODIFY | skills/plan-changeset/references/manifest-templates.md | Owned implementation surface |
| T3 | MODIFY | skills/review-plan/SKILL.md | Owned implementation surface |
| T3 | MODIFY | scripts/review-plan-codex.sh | Owned implementation surface |
| T3 | MODIFY | scripts/review-plan-kimi.sh | Owned implementation surface |
| T3 | MODIFY | references/plan-review-protocol.md | Owned implementation surface |
| T3 | MODIFY | references/chain-receipt-contract.md | Owned implementation surface |
| T3 | MODIFY | agents/plan-reviewer.md | Owned implementation surface |
| T3 | CREATE | scripts/lib/control-plan-validate.mjs | Owned implementation surface |
| T3 | CREATE | scripts/lib/transmutation-seal.mjs | Owned implementation surface |
| T3 | CREATE | scripts/lib/receipt-issuance-epoch.mjs | Owned implementation surface |
| T3 | MODIFY | test-framework/tests/delivery-plan-contract.test.mjs | Owned implementation surface |
| T4 | MODIFY | skills/execute-changeset/SKILL.md | Owned implementation surface |
| T4 | MODIFY | skills/execute-changeset/references/process-details.md | Owned implementation surface |
| T4 | MODIFY | skills/execute-changeset/references/subagent-dispatch.md | Owned implementation surface |
| T5 | CREATE | scripts/lib/research-decision.mjs | Owned implementation surface |
| T5 | MODIFY | scripts/compile-delivery-graph.mjs | Owned implementation surface |
| T5 | MODIFY | scripts/validate-delivery-graph.mjs | Owned implementation surface |
| T5 | MODIFY | references/solution-confidence-protocol.md | Owned implementation surface |
| T5 | MODIFY | skills/research/SKILL.md | Owned implementation surface |
| T5 | MODIFY | skills/explore-solutions/SKILL.md | Owned implementation surface |
| T5 | MODIFY | skills/design-tech/SKILL.md | Owned implementation surface |
| T5 | MODIFY | skills/write-spec/SKILL.md | Owned implementation surface |
| T5 | MODIFY | skills/validate-feature/SKILL.md | Owned implementation surface |
| T5 | MODIFY | skills/analyze-domain/SKILL.md | Owned implementation surface |
| T5 | MODIFY | skills/recall-stack-knowledge/SKILL.md | Owned implementation surface |
| T5 | MODIFY | skills/route-workflow/references/lane-model.md | Owned implementation surface |
| T5 | MODIFY | skills/route-workflow/references/intent-routing.md | Owned implementation surface |
| T5 | MODIFY | skills/route-workflow/references/routing-rules.md | Owned implementation surface |
| T5 | MODIFY | rules/common/research-before-build.md | Owned implementation surface |
| T5 | MODIFY | rules/host-capability-research.md | Owned implementation surface |
| T6 | MODIFY | skills/manage-learnings/SKILL.md | Owned implementation surface |
| T6 | MODIFY | scripts/learning-lifecycle.mjs | Owned implementation surface |
| T7 | MODIFY | scripts/select-tier1-validators-v2.mjs | Proof/closeout output |
| T7 | MODIFY | test-framework/evals/tier-1/validate-tier1-selector-v2.mjs | Proof/closeout output |
| T7 | MODIFY | FRAMEWORK-STATE.md | Proof/closeout output |
| T7 | MODIFY | docs/specs/work-items/INDEX.md | Proof/closeout output |
| T7 | MODIFY | test-framework/evals/tier-1/validate-blind-floor.sh | Proof/closeout output |
| T7 | MODIFY | .claude/agents/plan-reviewer.md | Proof/closeout output |
| T7 | MODIFY | .claude/agents/svc-stage-plan.md | Proof/closeout output |
| T7 | MODIFY | references/skill-routing-index.json | Proof/closeout output |
| T7 | CREATE | test-framework/tests/two-box-plan.test.mjs | Proof/closeout output |
| T7 | CREATE | test-framework/tests/research-decision.test.mjs | Proof/closeout output |
| T7 | CREATE | test-framework/tests/two-box-receipts.test.mjs | Proof/closeout output |
| T7 | CREATE | test-framework/tests/two-box-learning.test.mjs | Proof/closeout output |
| T7 | CREATE | test-framework/evals/tier-1/validate-two-box-transmutation.sh | Proof/closeout output |
| T7 | CREATE | test-framework/evals/tier-1/fixtures/two-box/isolation-canary-facts.json | Proof/closeout output |
| T7 | CREATE | test-framework/evals/tier-1/fixtures/two-box/eligibility-nonexempt.json | Proof/closeout output |
| T7 | CREATE | scripts/run-live-two-box-canary.mjs | Proof/closeout output |
| T7 | CREATE | docs/plans/two-box-transmutation/review-log.yaml | Proof/closeout output |
| T7 | CREATE | docs/plans/two-box-transmutation/implementation-report.md | Proof/closeout output |
| T7 | CREATE | test-framework/evals/tier-1/fixtures/two-box/control-plan-v1.json | Proof/closeout output |
| T7 | CREATE | test-framework/evals/tier-1/fixtures/two-box/executor-discretion-cases.json | Proof/closeout output |

## Task Graph

T0 is parent-only preparation/carry-forward. CREATE describes the Git delta, not regeneration authority. It preserves already-authored reviewed bytes and exclusively freezes the signed snapshot after review. T1–T7 wait for T0. Cursor implementation batches exclude all T0 paths. T7 only changes its remaining proof/closeout surfaces. T4 waits for T3 and T5.

T1 AC01 docs, blocked_by none, proof V01.
T2 AC02 AC03 AC04 AC05 AC10 isolation/roles/scouts, blocked_by none, proofs V02 V03 V04 V05 V10.
T3 AC06 AC07 AC08 AC13 AC14 v5 package including review-inputs.mjs, blocked_by T2; parent freezes signed bootstrap after review PASS and before source edits; T3 follows T2. Proofs V06 V07 V08 V13 V14.
T4 AC07 AC08 AC09 sealed handoff and discretion, blocked_by T3 and T5, proof V09.
T5 AC11 AC12 predicate and 16 consumers, blocked_by none, proofs V11 V12.
T6 AC15 learning origin, blocked_by none, proof V15.
T7 AC16 AC17 AC18 tests/evals/install docs, blocked_by T1 T2 T3 T4 T5 T6, proofs V16 V17 V18.

One exact owner per write path. Scope union equals task.files. T4 waits for T3 and T5 so execution consumes the verified seal/current-execution gate and researchDecision.

## AC-to-Task Mapping

| AC | Task |
|---|---|
| AC01 | T1 |
| AC02 | T2 |
| AC03 | T2 |
| AC04 | T2 |
| AC05 | T2 |
| AC06 | T3 |
| AC07 | T3 |
| AC08 | T3 |
| AC09 | T4 |
| AC10 | T2 |
| AC11 | T5 |
| AC12 | T5 |
| AC13 | T3 |
| AC14 | T3 |
| AC15 | T6 |
| AC16 | T7 |
| AC17 | T7 |
| AC18 | T7 |

## AC-to-Test Mapping

| AC | Observation | Command |
|---|---|---|
| AC01 | source | grep claim-audit README.md DOCTRINE.md |
| AC02-AC05 AC10 AC14 | unit | node --test test-framework/tests/two-box-plan.test.mjs |
| AC06 AC07 AC08 AC13 | unit | node --test test-framework/tests/two-box-receipts.test.mjs |
| AC09 | hosted | Bounded real EXEC policy-comprehension cases within V19; source consistency review retained |
| AC11 AC12 | unit | node --test test-framework/tests/research-decision.test.mjs |
| AC15 | unit | node --test test-framework/tests/two-box-learning.test.mjs |
| AC16 | unit | two-box-plan.test.mjs and run-live-two-box-canary.mjs --mode offline |
| AC17 | source | reporter OFFLINE/LIVE fields |
| AC18 | unit | validate-tier1-selector-v2.mjs and validate-two-box-transmutation.sh |

## Prerequisite Alignment Matrix

| Tasks | Product/UX/technical source | Applicable contract |
|---|---|---|
| T1 | AC01; S1 Framework Orchestrator | Headless launch docs; no product UI, tokens, or visual mock |
| T2 | AC02-AC05 AC10; Codex exec --help 2026-09-15 | Facts-dir isolation; dispatch-policy roles; nine host JSON |
| T3 | AC06-AC08 AC13 AC14; live AC hash ff42508d5ae7fe0829e761e77630f0b464f320b9c5668aaf05c8f770355a2486 | v5 both modes; bootstrap v4 snapshot; review-inputs.mjs in package |
| T4 | AC09; execute-changeset process-details | Local repair vs amendment |
| T5 | AC11 AC12; research-consumer-census.md | Shared predicate + resume |
| T6 | AC15 | origin plus evaluate-rule |
| T7 | AC16-AC18 | Offline proofs; selector; generated registries; land/verify producers |

## Validation Plan

Decisive proofs are V01-V18 in the v4 body. No test in this conversion has been run. Live canary is explicit --mode live and is not default tier-1. Full corpus is a release-boundary obligation. RD12: report genuine baseline failures separately.

## Hook and receipt consumer census

| Surface | Required treatment | Proof |
|---|---|---|
| PreTool authority | Unchanged; this delegate remains read-only | Existing foreign/escaping denial |
| emit-receipt / check-chain-receipts / review-inputs | Same provenance gate; v5 current; bootstrap v4 hash | two-box-receipts.test.mjs |
| review-plan | Reviews complete prepared contract; seal binds this receipt | transmutation-seal.mjs |
| git notes / public root | Historical v1/v3/v4 readers; no fabricated notes | historical fixture |
| generated .claude agents and skill-routing-index | T7 regenerates after T2/T3 agent/skill edits | sync-native-agents and compile-skill-router-index |
| setup / check-install-drift | verify-promotion on canonical main | existing land/verify producers |

## External State

| # | Environment | What state | Coupling | Lifecycle wiring |
|---|---|---|---|---|
| 1 | Host filesystem outside repo | Installed skills/helpers after promotion | coupled | ./setup --all-hosts and check-install-drift.sh --all-hosts inside verify-promotion |
| 2 | Host config files | Owner ~/.svc/dispatch-policy.json and ~/.codex/config.toml | decoupled-justified | Recipes never write those files; Open Box fail-closed if isolation is unproven; owner policy remains outside the repo |
| 3 | Out-of-tree git-common-dir | svc-review-evidence objects | coupled | putObject O_EXCL; rollback-rolling.md revert then setup |
| 12 | Downstream framework artifacts | schemas, skills, nine hosts, selector | coupled | T2/T3/T5/T7 plus validate-two-box-transmutation.sh |
| 15 | Runtime tmp/facts-dir | FACTS_DIR and canary scratch | coupled | isolated-plan-analysis.mjs unlinks tmp; objects remain in git-common-dir |

Untouched environments (walked the taxonomy, found nothing): 4, 5, 6, 7, 8, 9, 10, 11, 13, 14.

Environment 2 justification: mutating HOME, CODEX_HOME, or global Codex config would change owner-global state for every session. Isolation is proven by argv, facts-dir, preflight, and canary instead. Recovery is IsolationUnsupported without spend.

## Execution Command Sequence

Ready-now commands live in the v4 body. After review PASS, the parent freezes the reviewed bootstrap snapshot under the current package; T3 later pins that digest in the trusted package. Inline orchestrator edits owned files between checks. Release commands are consumed only by existing land/verify skills after their gates. No invented output field or future Git SHA is used.

```bash
set -euo pipefail
node scripts/prepare-plan-handoff.mjs --capabilities
bash scripts/verify-plan-mechanical.sh docs/plans/two-box-transmutation/manifest.md . --phase plan
node scripts/validate-task-graph-lane.mjs .svc/lane-tasks-WI-FW-TWO-BOX-01.json
```

RECOVERY_IF_FAIL: retain the candidate, failing output, and valid earlier evidence; fix the named task; rerun invalidated checks. Do not switch schemas or fabricate review results.

## Checkpoint Plan and rollback

T1-T7 local checkpoints. Final promotion through existing chain. Revert via rollback-rolling.md; immutable-baseline.md is not rewritten. Old notes stay readable.

## Promotion Readiness Checklist

- Every AC has a task and a V0x proof
- Mechanical plan-phase checks pass before implementation
- freeze-bootstrap before T3 validator edits
- Selector lists validate-two-box-transmutation.sh
- Nine-host setup only after merge on canonical main
- RD12 baseline failures remain labeled baseline

## Simulation Report

See docs/plans/two-box-transmutation/simulation.md. Analysis only. Zero tests run.

## Whole-solution readiness and allowed local decisions

Local: helper names, fixture filenames under test-framework/evals/tier-1/fixtures/two-box/, import order.
Forbidden: different isolation flags; trusting caller eligible; new dispatch v3 issuance; fifth winner; getObject on digests; mutating global Codex or dispatch-policy; fabricating historical notes; embedding a future commit SHA.

<!-- SVC_PLAN_BODY -->
```json
{
  "receipt_type": "plan-manifest",
  "schema_version": 4,
  "wi": "WI-FW-TWO-BOX-01",
  "mode": "inline",
  "lane": "framework",
  "timestamp": "2026-09-15T00:30:00.000Z",
  "scope": {
    "included": [
      "docs/plans/two-box-transmutation/manifest.md",
      "docs/plans/two-box-transmutation/plan-contract.json",
      "docs/plans/two-box-transmutation/planning-summary.md",
      "docs/plans/two-box-transmutation/immutable-baseline.md",
      "docs/plans/two-box-transmutation/rollback-rolling.md",
      "docs/plans/two-box-transmutation/simulation.md",
      "docs/plans/two-box-transmutation/research-consumer-census.md",
      "docs/plans/two-box-transmutation/solution-plan.md",
      "docs/plans/two-box-transmutation/solution-review-dispositions.md",
      "docs/plans/two-box-transmutation/root-design-review.md",
      "docs/plans/two-box-transmutation/planned-files.json",
      "docs/specs/work-items/WI-FW-TWO-BOX-01.md",
      "docs/specs/features/two-box-transmutation.md",
      "docs/specs/tech/two-box-transmutation.md",
      "docs/specs/journeys/J-FW-07-two-box-transmutation.feature.md",
      "docs/specs/relations/two-box-transmutation.branches.md",
      "docs/specs/privacy/v4-bootstrap-snapshot.json",
      "README.md",
      "DOCTRINE.md",
      "skills/blind-control-plan/SKILL.md",
      "scripts/blind-floor-route.mjs",
      "scripts/blind-floor-check.mjs",
      "scripts/blind-floor-judge.sh",
      "provision/hosts/antigravity.json",
      "provision/hosts/claude.json",
      "provision/hosts/codex.json",
      "provision/hosts/cursor.json",
      "provision/hosts/gemini.json",
      "provision/hosts/grok.json",
      "provision/hosts/kimi.json",
      "provision/hosts/mimo-code.json",
      "provision/hosts/opencode.json",
      "scripts/validate-host-authority-capabilities.mjs",
      "references/host-capabilities.md",
      "scripts/resolve-dispatch.mjs",
      "agents/svc-stage-plan.md",
      "scripts/stage-segment.mjs",
      "references/skill-runtime-contracts-v2.json",
      "references/model-routing.md",
      "schemas/dispatch-policy.schema.json",
      "scripts/run-external-review.mjs",
      "scripts/two-box-plan.mjs",
      "scripts/lib/two-box-protocol.mjs",
      "scripts/lib/isolated-plan-analysis.mjs",
      "scripts/lib/two-box-scout-assign.mjs",
      "scripts/lib/two-box-role-launch.mjs",
      "schemas/receipts/control-plan.schema.json",
      "schemas/receipts/plan-manifest.schema.json",
      "scripts/emit-receipt.mjs",
      "scripts/check-chain-receipts.mjs",
      "scripts/lib/plan-manifest-contract.mjs",
      "scripts/prepare-plan-handoff.mjs",
      "scripts/lib/review-inputs.mjs",
      "skills/plan-changeset/SKILL.md",
      "skills/plan-changeset/references/manifest-templates.md",
      "skills/review-plan/SKILL.md",
      "scripts/review-plan-codex.sh",
      "scripts/review-plan-kimi.sh",
      "references/plan-review-protocol.md",
      "references/chain-receipt-contract.md",
      "agents/plan-reviewer.md",
      "scripts/lib/control-plan-validate.mjs",
      "scripts/lib/transmutation-seal.mjs",
      "scripts/lib/receipt-issuance-epoch.mjs",
      "test-framework/tests/delivery-plan-contract.test.mjs",
      "skills/execute-changeset/SKILL.md",
      "skills/execute-changeset/references/process-details.md",
      "skills/execute-changeset/references/subagent-dispatch.md",
      "scripts/lib/research-decision.mjs",
      "scripts/compile-delivery-graph.mjs",
      "scripts/validate-delivery-graph.mjs",
      "references/solution-confidence-protocol.md",
      "skills/research/SKILL.md",
      "skills/explore-solutions/SKILL.md",
      "skills/design-tech/SKILL.md",
      "skills/write-spec/SKILL.md",
      "skills/validate-feature/SKILL.md",
      "skills/analyze-domain/SKILL.md",
      "skills/recall-stack-knowledge/SKILL.md",
      "skills/route-workflow/references/lane-model.md",
      "skills/route-workflow/references/intent-routing.md",
      "skills/route-workflow/references/routing-rules.md",
      "rules/common/research-before-build.md",
      "rules/host-capability-research.md",
      "skills/manage-learnings/SKILL.md",
      "scripts/learning-lifecycle.mjs",
      "scripts/select-tier1-validators-v2.mjs",
      "test-framework/evals/tier-1/validate-tier1-selector-v2.mjs",
      "FRAMEWORK-STATE.md",
      "docs/specs/work-items/INDEX.md",
      "test-framework/evals/tier-1/validate-blind-floor.sh",
      ".claude/agents/plan-reviewer.md",
      ".claude/agents/svc-stage-plan.md",
      "references/skill-routing-index.json",
      "test-framework/tests/two-box-plan.test.mjs",
      "test-framework/tests/research-decision.test.mjs",
      "test-framework/tests/two-box-receipts.test.mjs",
      "test-framework/tests/two-box-learning.test.mjs",
      "test-framework/evals/tier-1/validate-two-box-transmutation.sh",
      "test-framework/evals/tier-1/fixtures/two-box/isolation-canary-facts.json",
      "test-framework/evals/tier-1/fixtures/two-box/eligibility-nonexempt.json",
      "scripts/run-live-two-box-canary.mjs",
      "docs/plans/two-box-transmutation/review-log.yaml",
      "docs/plans/two-box-transmutation/implementation-report.md",
      "test-framework/evals/tier-1/fixtures/two-box/control-plan-v1.json",
      "test-framework/evals/tier-1/fixtures/two-box/executor-discretion-cases.json"
    ],
    "excluded": [
      ".svc/pipeline-decisions.jsonl",
      ".svc/session-contract.jsonl",
      ".svc/lane-tasks-WI-FW-TWO-BOX-01.json"
    ]
  },
  "dependencies": [
    {
      "artifact": "docs/plans/two-box-transmutation/solution-plan.md",
      "citation": "docs/plans/two-box-transmutation/solution-plan.md:59"
    },
    {
      "artifact": "docs/plans/two-box-transmutation/root-design-review.md",
      "citation": "docs/plans/two-box-transmutation/root-design-review.md:8"
    },
    {
      "artifact": "scripts/lib/review-inputs.mjs",
      "citation": "scripts/lib/review-inputs.mjs:32"
    },
    {
      "artifact": "scripts/run-external-review.mjs",
      "citation": "scripts/run-external-review.mjs:127"
    },
    {
      "artifact": "scripts/lib/review-evidence-store.mjs",
      "citation": "scripts/lib/review-evidence-store.mjs:23"
    },
    {
      "artifact": "schemas/receipts/review-plan.schema.json",
      "citation": "schemas/receipts/review-plan.schema.json:1",
      "reason": "Explicit dependency requested by formal reviewer for canonical review receipt validation."
    },
    {
      "artifact": ".svc/external-review-artifacts/two-box/freeze-bootstrap.mjs",
      "citation": ".svc/external-review-artifacts/two-box/freeze-bootstrap.mjs:1",
      "reason": "Reviewable one-shot parent producer for T0; preserved in durable evidence, not a generic current-issuance exemption API."
    }
  ],
  "decision_trace": [
    {
      "question": "How is Open Box isolated?",
      "alternatives": [
        "unsupported --read-only plus --ignore-rules as AGENTS",
        "facts-dir plus --ephemeral --sandbox read-only --ignore-user-config with preflight/canary"
      ],
      "chosen": "facts-dir plus supported sandbox argv and fail-closed preflight",
      "rationale": "RD01; installed Codex exec --help; Landlock is write confinement",
      "reversal_conditions": "A later proven equivalent transport with canary"
    },
    {
      "question": "What does new plan-manifest issuance use?",
      "alternatives": [
        "v5 inline only and dispatch stays v3",
        "v5 for inline and dispatch; v3/v4 readers plus one bootstrap v4"
      ],
      "chosen": "v5 both modes; readers for history; one frozen bootstrap v4",
      "rationale": "RD02 RD03"
    },
    {
      "question": "How is eligibility decided?",
      "alternatives": [
        "caller eligible JSON",
        "recompute quick-fix-eligibility on real diff"
      ],
      "chosen": "recompute classifier; v5 lightweight if eligible",
      "rationale": "RD05"
    },
    {
      "question": "What is a selection winner?",
      "alternatives": [
        "five-way including reject_innovation",
        "three-way winner plus dispositions"
      ],
      "chosen": "open_win contract_win combination; reject_innovation is disposition",
      "rationale": "RD10"
    }
  ],
  "task_graph": [
    {
      "id": "T0",
      "files": [
        "docs/plans/two-box-transmutation/manifest.md",
        "docs/plans/two-box-transmutation/plan-contract.json",
        "docs/plans/two-box-transmutation/planning-summary.md",
        "docs/plans/two-box-transmutation/immutable-baseline.md",
        "docs/plans/two-box-transmutation/rollback-rolling.md",
        "docs/plans/two-box-transmutation/simulation.md",
        "docs/plans/two-box-transmutation/research-consumer-census.md",
        "docs/plans/two-box-transmutation/solution-plan.md",
        "docs/plans/two-box-transmutation/solution-review-dispositions.md",
        "docs/plans/two-box-transmutation/root-design-review.md",
        "docs/plans/two-box-transmutation/planned-files.json",
        "docs/specs/work-items/WI-FW-TWO-BOX-01.md",
        "docs/specs/features/two-box-transmutation.md",
        "docs/specs/tech/two-box-transmutation.md",
        "docs/specs/journeys/J-FW-07-two-box-transmutation.feature.md",
        "docs/specs/relations/two-box-transmutation.branches.md",
        "docs/specs/privacy/v4-bootstrap-snapshot.json"
      ],
      "blocked_by": [],
      "ac_ids": [
        "AC06",
        "AC07",
        "AC08",
        "AC13",
        "AC18"
      ],
      "validation_ids": [
        "V00"
      ],
      "context_refs": [
        {
          "path": "docs/specs/tech/two-box-transmutation.md",
          "start_line": 1,
          "end_line": 188,
          "excerpt_sha256": "0353f791af1902ddd0b65d034aeb5cdd3d54aaf07db2ff42908167fe21214157"
        },
        {
          "path": "docs/plans/two-box-transmutation/solution-plan.md",
          "start_line": 1,
          "end_line": 116,
          "excerpt_sha256": "13667ce4668c54381934c6936b81b86acf52c4988e572fbae6bea8fb0480cb87"
        }
      ]
    },
    {
      "id": "T1",
      "files": [
        "README.md",
        "DOCTRINE.md"
      ],
      "blocked_by": [
        "T0"
      ],
      "ac_ids": [
        "AC01"
      ],
      "validation_ids": [
        "V01"
      ],
      "context_refs": [
        {
          "path": "docs/specs/tech/two-box-transmutation.md",
          "start_line": 1,
          "end_line": 188,
          "excerpt_sha256": "0353f791af1902ddd0b65d034aeb5cdd3d54aaf07db2ff42908167fe21214157"
        },
        {
          "path": "docs/plans/two-box-transmutation/solution-plan.md",
          "start_line": 1,
          "end_line": 116,
          "excerpt_sha256": "13667ce4668c54381934c6936b81b86acf52c4988e572fbae6bea8fb0480cb87"
        }
      ]
    },
    {
      "id": "T2",
      "files": [
        "skills/blind-control-plan/SKILL.md",
        "scripts/blind-floor-route.mjs",
        "scripts/blind-floor-check.mjs",
        "scripts/blind-floor-judge.sh",
        "provision/hosts/antigravity.json",
        "provision/hosts/claude.json",
        "provision/hosts/codex.json",
        "provision/hosts/cursor.json",
        "provision/hosts/gemini.json",
        "provision/hosts/grok.json",
        "provision/hosts/kimi.json",
        "provision/hosts/mimo-code.json",
        "provision/hosts/opencode.json",
        "scripts/validate-host-authority-capabilities.mjs",
        "references/host-capabilities.md",
        "scripts/resolve-dispatch.mjs",
        "agents/svc-stage-plan.md",
        "scripts/stage-segment.mjs",
        "references/skill-runtime-contracts-v2.json",
        "references/model-routing.md",
        "schemas/dispatch-policy.schema.json",
        "scripts/run-external-review.mjs",
        "scripts/two-box-plan.mjs",
        "scripts/lib/two-box-protocol.mjs",
        "scripts/lib/isolated-plan-analysis.mjs",
        "scripts/lib/two-box-scout-assign.mjs",
        "scripts/lib/two-box-role-launch.mjs"
      ],
      "blocked_by": [
        "T0"
      ],
      "ac_ids": [
        "AC02",
        "AC03",
        "AC04",
        "AC05",
        "AC10"
      ],
      "validation_ids": [
        "V02",
        "V03",
        "V04",
        "V05",
        "V10"
      ],
      "context_refs": [
        {
          "path": "docs/specs/tech/two-box-transmutation.md",
          "start_line": 1,
          "end_line": 188,
          "excerpt_sha256": "0353f791af1902ddd0b65d034aeb5cdd3d54aaf07db2ff42908167fe21214157"
        },
        {
          "path": "docs/plans/two-box-transmutation/solution-plan.md",
          "start_line": 1,
          "end_line": 116,
          "excerpt_sha256": "13667ce4668c54381934c6936b81b86acf52c4988e572fbae6bea8fb0480cb87"
        }
      ]
    },
    {
      "id": "T3",
      "files": [
        "schemas/receipts/control-plan.schema.json",
        "schemas/receipts/plan-manifest.schema.json",
        "scripts/emit-receipt.mjs",
        "scripts/check-chain-receipts.mjs",
        "scripts/lib/plan-manifest-contract.mjs",
        "scripts/prepare-plan-handoff.mjs",
        "scripts/lib/review-inputs.mjs",
        "skills/plan-changeset/SKILL.md",
        "skills/plan-changeset/references/manifest-templates.md",
        "skills/review-plan/SKILL.md",
        "scripts/review-plan-codex.sh",
        "scripts/review-plan-kimi.sh",
        "references/plan-review-protocol.md",
        "references/chain-receipt-contract.md",
        "agents/plan-reviewer.md",
        "scripts/lib/control-plan-validate.mjs",
        "scripts/lib/transmutation-seal.mjs",
        "scripts/lib/receipt-issuance-epoch.mjs",
        "test-framework/tests/delivery-plan-contract.test.mjs"
      ],
      "blocked_by": [
        "T0",
        "T2"
      ],
      "ac_ids": [
        "AC06",
        "AC07",
        "AC08",
        "AC13",
        "AC14"
      ],
      "validation_ids": [
        "V06",
        "V07",
        "V08",
        "V13",
        "V14"
      ],
      "context_refs": [
        {
          "path": "docs/specs/tech/two-box-transmutation.md",
          "start_line": 1,
          "end_line": 188,
          "excerpt_sha256": "0353f791af1902ddd0b65d034aeb5cdd3d54aaf07db2ff42908167fe21214157"
        },
        {
          "path": "docs/plans/two-box-transmutation/solution-plan.md",
          "start_line": 1,
          "end_line": 116,
          "excerpt_sha256": "13667ce4668c54381934c6936b81b86acf52c4988e572fbae6bea8fb0480cb87"
        }
      ]
    },
    {
      "id": "T4",
      "files": [
        "skills/execute-changeset/SKILL.md",
        "skills/execute-changeset/references/process-details.md",
        "skills/execute-changeset/references/subagent-dispatch.md"
      ],
      "blocked_by": [
        "T0",
        "T3",
        "T5"
      ],
      "ac_ids": [
        "AC07",
        "AC08",
        "AC09"
      ],
      "validation_ids": [
        "V07",
        "V08",
        "V09"
      ],
      "context_refs": [
        {
          "path": "docs/specs/tech/two-box-transmutation.md",
          "start_line": 1,
          "end_line": 188,
          "excerpt_sha256": "0353f791af1902ddd0b65d034aeb5cdd3d54aaf07db2ff42908167fe21214157"
        },
        {
          "path": "docs/plans/two-box-transmutation/solution-plan.md",
          "start_line": 1,
          "end_line": 116,
          "excerpt_sha256": "13667ce4668c54381934c6936b81b86acf52c4988e572fbae6bea8fb0480cb87"
        }
      ]
    },
    {
      "id": "T5",
      "files": [
        "scripts/lib/research-decision.mjs",
        "scripts/compile-delivery-graph.mjs",
        "scripts/validate-delivery-graph.mjs",
        "references/solution-confidence-protocol.md",
        "skills/research/SKILL.md",
        "skills/explore-solutions/SKILL.md",
        "skills/design-tech/SKILL.md",
        "skills/write-spec/SKILL.md",
        "skills/validate-feature/SKILL.md",
        "skills/analyze-domain/SKILL.md",
        "skills/recall-stack-knowledge/SKILL.md",
        "skills/route-workflow/references/lane-model.md",
        "skills/route-workflow/references/intent-routing.md",
        "skills/route-workflow/references/routing-rules.md",
        "rules/common/research-before-build.md",
        "rules/host-capability-research.md"
      ],
      "blocked_by": [
        "T0"
      ],
      "ac_ids": [
        "AC11",
        "AC12"
      ],
      "validation_ids": [
        "V11",
        "V12"
      ],
      "context_refs": [
        {
          "path": "docs/specs/tech/two-box-transmutation.md",
          "start_line": 1,
          "end_line": 188,
          "excerpt_sha256": "0353f791af1902ddd0b65d034aeb5cdd3d54aaf07db2ff42908167fe21214157"
        },
        {
          "path": "docs/plans/two-box-transmutation/solution-plan.md",
          "start_line": 1,
          "end_line": 116,
          "excerpt_sha256": "13667ce4668c54381934c6936b81b86acf52c4988e572fbae6bea8fb0480cb87"
        }
      ]
    },
    {
      "id": "T6",
      "files": [
        "skills/manage-learnings/SKILL.md",
        "scripts/learning-lifecycle.mjs"
      ],
      "blocked_by": [
        "T0"
      ],
      "ac_ids": [
        "AC15"
      ],
      "validation_ids": [
        "V15"
      ],
      "context_refs": [
        {
          "path": "docs/specs/tech/two-box-transmutation.md",
          "start_line": 1,
          "end_line": 188,
          "excerpt_sha256": "0353f791af1902ddd0b65d034aeb5cdd3d54aaf07db2ff42908167fe21214157"
        },
        {
          "path": "docs/plans/two-box-transmutation/solution-plan.md",
          "start_line": 1,
          "end_line": 116,
          "excerpt_sha256": "13667ce4668c54381934c6936b81b86acf52c4988e572fbae6bea8fb0480cb87"
        }
      ]
    },
    {
      "id": "T7",
      "files": [
        "scripts/select-tier1-validators-v2.mjs",
        "test-framework/evals/tier-1/validate-tier1-selector-v2.mjs",
        "FRAMEWORK-STATE.md",
        "docs/specs/work-items/INDEX.md",
        "test-framework/evals/tier-1/validate-blind-floor.sh",
        ".claude/agents/plan-reviewer.md",
        ".claude/agents/svc-stage-plan.md",
        "references/skill-routing-index.json",
        "test-framework/tests/two-box-plan.test.mjs",
        "test-framework/tests/research-decision.test.mjs",
        "test-framework/tests/two-box-receipts.test.mjs",
        "test-framework/tests/two-box-learning.test.mjs",
        "test-framework/evals/tier-1/validate-two-box-transmutation.sh",
        "test-framework/evals/tier-1/fixtures/two-box/isolation-canary-facts.json",
        "test-framework/evals/tier-1/fixtures/two-box/eligibility-nonexempt.json",
        "scripts/run-live-two-box-canary.mjs",
        "docs/plans/two-box-transmutation/review-log.yaml",
        "docs/plans/two-box-transmutation/implementation-report.md",
        "test-framework/evals/tier-1/fixtures/two-box/control-plan-v1.json",
        "test-framework/evals/tier-1/fixtures/two-box/executor-discretion-cases.json"
      ],
      "blocked_by": [
        "T1",
        "T2",
        "T3",
        "T4",
        "T5",
        "T6",
        "T0"
      ],
      "ac_ids": [
        "AC16",
        "AC17",
        "AC18"
      ],
      "validation_ids": [
        "V16",
        "V17",
        "V18",
        "V19"
      ],
      "context_refs": [
        {
          "path": "docs/specs/tech/two-box-transmutation.md",
          "start_line": 1,
          "end_line": 188,
          "excerpt_sha256": "0353f791af1902ddd0b65d034aeb5cdd3d54aaf07db2ff42908167fe21214157"
        },
        {
          "path": "docs/plans/two-box-transmutation/solution-plan.md",
          "start_line": 1,
          "end_line": 116,
          "excerpt_sha256": "13667ce4668c54381934c6936b81b86acf52c4988e572fbae6bea8fb0480cb87"
        }
      ]
    }
  ],
  "validation_plan": [
    {
      "id": "V01",
      "ac_ids": [
        "AC01"
      ],
      "observation_kind": "source",
      "command": "node scripts/lint-skills-manifest.mjs && rg -n \"Two-Box|Deterministic Transmutation|receipt|specification\" README.md DOCTRINE.md",
      "expected_outcome": "unsupported numeric savings, entropy equation, attention-reset guarantee, and universal superiority claims are removed or qualified; business remains aspirational",
      "sufficiency": "Source inventory supports root claim-by-claim review; text matches alone do not prove claims."
    },
    {
      "id": "V02",
      "ac_ids": [
        "AC02"
      ],
      "observation_kind": "unit",
      "command": "node --test test-framework/tests/two-box-plan.test.mjs",
      "expected_outcome": "Two-Box required unless recomputed eligibility is true; caller eligible true does not skip; files<=3 does not skip",
      "sufficiency": "unit covers exemption gate"
    },
    {
      "id": "V03",
      "ac_ids": [
        "AC03"
      ],
      "observation_kind": "unit",
      "command": "node --test test-framework/tests/two-box-plan.test.mjs",
      "expected_outcome": "Open Box refuses --read-only, review-package, and worktree cwd; uses --sandbox read-only and facts-dir; contamination enum tested",
      "sufficiency": "unit plus offline isolation fixture; live canary is V16 live path not this command"
    },
    {
      "id": "V04",
      "ac_ids": [
        "AC04"
      ],
      "observation_kind": "unit",
      "command": "node --test test-framework/tests/two-box-plan.test.mjs",
      "expected_outcome": "two scout processes; coverage.complete false when only citations exist",
      "sufficiency": "unit"
    },
    {
      "id": "V05",
      "ac_ids": [
        "AC05"
      ],
      "observation_kind": "unit",
      "command": "node --test test-framework/tests/two-box-plan.test.mjs",
      "expected_outcome": "winner is only open_win contract_win combination; reject_innovation disposition; conflict blocks; original and revised distinct",
      "sufficiency": "unit"
    },
    {
      "id": "V06",
      "ac_ids": [
        "AC06"
      ],
      "observation_kind": "unit",
      "command": "node --test test-framework/tests/two-box-receipts.test.mjs",
      "expected_outcome": "missing source_decision fails prepareForReview; original requirements object is bound",
      "sufficiency": "unit"
    },
    {
      "id": "V07",
      "ac_ids": [
        "AC07"
      ],
      "observation_kind": "unit",
      "command": "node --test test-framework/tests/two-box-receipts.test.mjs",
      "expected_outcome": "Real signed review evidence and exact reviewed manifest/tree bindings required; separate seal leaves reviewed manifest bytes unchanged; unknown semantic fields and tampering fail.",
      "sufficiency": "unit"
    },
    {
      "id": "V08",
      "ac_ids": [
        "AC08"
      ],
      "observation_kind": "unit",
      "command": "node --test test-framework/tests/delivery-plan-contract.test.mjs && node --test test-framework/tests/two-box-receipts.test.mjs",
      "expected_outcome": "v5 inline and dispatch validate; new v3/v4 emit refused except bootstrap hash; review-inputs accepts v5",
      "sufficiency": "unit of complete package consumers"
    },
    {
      "id": "V09",
      "ac_ids": [
        "AC09"
      ],
      "observation_kind": "hosted",
      "command": "node scripts/run-live-two-box-canary.mjs --mode live",
      "expected_outcome": "Held-out executor discretion cases correctly classified with justification and affected decision/proof handling by the real configured EXEC model.",
      "sufficiency": "One bounded skill-comprehension call in V19; source review plus real model scenario evidence, not an invented classifier or a grep-only proof."
    },
    {
      "id": "V10",
      "ac_ids": [
        "AC10"
      ],
      "observation_kind": "unit",
      "command": "node --test test-framework/tests/two-box-plan.test.mjs",
      "expected_outcome": "absent roles inherit PLAN/EXEC; Open Box host without isolation fails before spend",
      "sufficiency": "unit"
    },
    {
      "id": "V11",
      "ac_ids": [
        "AC11"
      ],
      "observation_kind": "unit",
      "command": "node --test test-framework/tests/research-decision.test.mjs",
      "expected_outcome": "full RD06 order table including resolved local, missing score analysis, freshness without score, score 6 research, score 7 no network",
      "sufficiency": "unit"
    },
    {
      "id": "V12",
      "ac_ids": [
        "AC12"
      ],
      "observation_kind": "unit",
      "command": "node --test test-framework/tests/research-decision.test.mjs",
      "expected_outcome": "compiler/validator fixtures require resume edge and reject fabricated research receipts",
      "sufficiency": "unit"
    },
    {
      "id": "V13",
      "ac_ids": [
        "AC13"
      ],
      "observation_kind": "unit",
      "command": "node --test test-framework/tests/two-box-receipts.test.mjs",
      "expected_outcome": "Actual versioned schema loader accepts named OFFLINE control-plan-v1.json under historical inspection, refuses it for new issuance/execution, and validates strict v2; snapshot/object tampering fails.",
      "sufficiency": "unit"
    },
    {
      "id": "V14",
      "ac_ids": [
        "AC14"
      ],
      "observation_kind": "unit",
      "command": "node --test test-framework/tests/two-box-plan.test.mjs",
      "expected_outcome": "getObject survives worktree rmdir; package source_root differs from consumer checkout in nested worktree fixture",
      "sufficiency": "unit"
    },
    {
      "id": "V15",
      "ac_ids": [
        "AC15"
      ],
      "observation_kind": "unit",
      "command": "node --test test-framework/tests/two-box-learning.test.mjs",
      "expected_outcome": "origin accepted; elevate without evaluate-rule fails",
      "sufficiency": "unit"
    },
    {
      "id": "V16",
      "ac_ids": [
        "AC16"
      ],
      "observation_kind": "unit",
      "command": "node --test test-framework/tests/two-box-plan.test.mjs && node scripts/run-live-two-box-canary.mjs --mode offline",
      "expected_outcome": "offline labeled OFFLINE; live mode not invoked by this command",
      "sufficiency": "Offline integration fixtures prove mechanics; V19 separately requires the bounded live full-cycle proof."
    },
    {
      "id": "V17",
      "ac_ids": [
        "AC17"
      ],
      "observation_kind": "source",
      "command": "grep -n 'OFFLINE\\|LIVE\\|cost_usd' scripts/run-live-two-box-canary.mjs test-framework/evals/tier-1/validate-two-box-transmutation.sh",
      "expected_outcome": "reports distinguish offline/live and include omissions/cost fields",
      "sufficiency": "source of reporter; no paid benchmark launched"
    },
    {
      "id": "V18",
      "ac_ids": [
        "AC18"
      ],
      "observation_kind": "unit",
      "command": "node test-framework/evals/tier-1/validate-tier1-selector-v2.mjs && bash test-framework/evals/tier-1/validate-two-box-transmutation.sh",
      "expected_outcome": "selector lists validate-two-box-transmutation.sh; focused validator passes on the implementation tree",
      "sufficiency": "focused evals; full Tier-1 at release boundary; install via land/verify producers"
    },
    {
      "id": "V00",
      "ac_ids": [
        "AC06",
        "AC07",
        "AC08",
        "AC13",
        "AC18"
      ],
      "observation_kind": "source",
      "command": "node .svc/external-review-artifacts/two-box/freeze-bootstrap.mjs --check",
      "expected_outcome": "Parent freeze/check verifies signed review, actual public root, exact body/manifest/spec/context and no implementation; T0 bytes are preserved.",
      "sufficiency": "Real post-review pre-implementation bootstrap evidence. T3/T7 delegate paths exclude T0."
    },
    {
      "id": "V19",
      "ac_ids": [
        "AC16",
        "AC17"
      ],
      "observation_kind": "hosted",
      "command": "node scripts/run-live-two-box-canary.mjs --mode live",
      "expected_outcome": "One bounded real full cycle on configured supported tuples, with effective isolation proof, actual output/coverage/usage identities and no claim of universal superiority.",
      "sufficiency": "LIVE transport and integrated model-flow evidence; unknown cost stays null and limitations remain explicit."
    }
  ],
  "risk_rollback": {
    "action": "revert the promoted implementation using the existing reviewed revert path then rerun canonical all-host setup",
    "immutable_baseline": "docs/plans/two-box-transmutation/immutable-baseline.md",
    "rolling_rollback": "docs/plans/two-box-transmutation/rollback-rolling.md"
  },
  "execution_command_sequence": [
    {
      "step": 1,
      "command": "node scripts/prepare-plan-handoff.mjs --capabilities",
      "expected_outcome": "exit 0 on current v4 package; after T3 issuance_versions includes 5"
    },
    {
      "step": 2,
      "command": "bash scripts/verify-plan-mechanical.sh docs/plans/two-box-transmutation/manifest.md . --phase plan",
      "expected_outcome": "C1-C11 pass at plan phase"
    },
    {
      "step": 3,
      "command": "node scripts/validate-task-graph-lane.mjs .svc/lane-tasks-WI-FW-TWO-BOX-01.json",
      "expected_outcome": "framework mandatory chain present; design-tech exists if risk flags declared"
    },
    {
      "step": 4,
      "command": "node --test test-framework/tests/two-box-plan.test.mjs test-framework/tests/research-decision.test.mjs test-framework/tests/two-box-receipts.test.mjs test-framework/tests/two-box-learning.test.mjs test-framework/tests/delivery-plan-contract.test.mjs",
      "expected_outcome": "offline unit proofs for AC02-AC16 after implementation"
    },
    {
      "step": 5,
      "command": "bash test-framework/evals/tier-1/validate-two-box-transmutation.sh",
      "expected_outcome": "focused tier-1 wrapper exit 0 after T7"
    },
    {
      "step": 6,
      "command": "node scripts/run-live-two-box-canary.mjs --mode live",
      "expected_outcome": "Bounded live canary passes; preserve actual results and capability limits."
    },
    {
      "step": 7,
      "command": "node scripts/lint-skills-manifest.mjs",
      "expected_outcome": "Skill registry and public documentation remain aligned."
    },
    {
      "step": 8,
      "command": "EVALS=0 bash test-framework/evals/run-all-evals.sh",
      "expected_outcome": "Release requires full Tier1 pass. Compare real baseline failures; do not manufacture historical evidence."
    },
    {
      "step": 9,
      "command": "bash scripts/worktree.sh promote framework-two-box-transmutation",
      "expected_outcome": "Only land-changeset after review-exec/audit/full release gates: existing adapter produces actual PR/merge identity; no invented future SHA."
    },
    {
      "step": 10,
      "command": "./setup --all-hosts && bash scripts/check-install-drift.sh --all-hosts",
      "expected_outcome": "Only verify-promotion from canonical promoted source: all nine installs converge and drift check passes."
    }
  ],
  "ac_digests": {
    "spec_path": "docs/specs/features/two-box-transmutation.md",
    "spec_ac_table_sha256": "ff42508d5ae7fe0829e761e77630f0b464f320b9c5668aaf05c8f770355a2486",
    "entries": [
      {
        "ac_id": "ac01",
        "digest": "launch narrative claim-audit; business aspirational"
      },
      {
        "ac_id": "ac02",
        "digest": "both boxes unless recomputed eligibility"
      },
      {
        "ac_id": "ac03",
        "digest": "facts-dir sandbox isolation not --read-only"
      },
      {
        "ac_id": "ac04",
        "digest": "two scouts; coverage from supplied/observed"
      },
      {
        "ac_id": "ac05",
        "digest": "three winners; reject is disposition"
      },
      {
        "ac_id": "ac06",
        "digest": "reconcile specs; original ACs survive"
      },
      {
        "ac_id": "ac07",
        "digest": "seal verifies actual review receipt"
      },
      {
        "ac_id": "ac08",
        "digest": "v5 inline and dispatch; bootstrap v4 only"
      },
      {
        "ac_id": "ac09",
        "digest": "one discretion rule repair vs amendment"
      },
      {
        "ac_id": "ac10",
        "digest": "dispatch roles inherit; no policy file writes"
      },
      {
        "ac_id": "ac11",
        "digest": "researchDecision table including freshness"
      },
      {
        "ac_id": "ac12",
        "digest": "shared predicate all consumers"
      },
      {
        "ac_id": "ac13",
        "digest": "current issuance v5/v2; history readable"
      },
      {
        "ac_id": "ac14",
        "digest": "durable store; package vs consumer"
      },
      {
        "ac_id": "ac15",
        "digest": "learning origin plus evaluate-rule"
      },
      {
        "ac_id": "ac16",
        "digest": "offline fixtures; labeled not live"
      },
      {
        "ac_id": "ac17",
        "digest": "honest eval reports; no unpaid-broad benchmark"
      },
      {
        "ac_id": "ac18",
        "digest": "selector, tier-1, land, nine-host install"
      }
    ]
  }
}
```
<!-- /SVC_PLAN_BODY -->

<!-- SVC_PLAN_VIEWS -->
| Task | AC IDs | Validation IDs | Write paths |
|---|---|---|---|
| T0 | AC06, AC07, AC08, AC13, AC18 | V00 | docs/plans/two-box-transmutation/manifest.md, docs/plans/two-box-transmutation/plan-contract.json, docs/plans/two-box-transmutation/planning-summary.md, docs/plans/two-box-transmutation/immutable-baseline.md, docs/plans/two-box-transmutation/rollback-rolling.md, docs/plans/two-box-transmutation/simulation.md, docs/plans/two-box-transmutation/research-consumer-census.md, docs/plans/two-box-transmutation/solution-plan.md, docs/plans/two-box-transmutation/solution-review-dispositions.md, docs/plans/two-box-transmutation/root-design-review.md, docs/plans/two-box-transmutation/planned-files.json, docs/specs/work-items/WI-FW-TWO-BOX-01.md, docs/specs/features/two-box-transmutation.md, docs/specs/tech/two-box-transmutation.md, docs/specs/journeys/J-FW-07-two-box-transmutation.feature.md, docs/specs/relations/two-box-transmutation.branches.md, docs/specs/privacy/v4-bootstrap-snapshot.json |
| T1 | AC01 | V01 | README.md, DOCTRINE.md |
| T2 | AC02, AC03, AC04, AC05, AC10 | V02, V03, V04, V05, V10 | skills/blind-control-plan/SKILL.md, scripts/blind-floor-route.mjs, scripts/blind-floor-check.mjs, scripts/blind-floor-judge.sh, provision/hosts/antigravity.json, provision/hosts/claude.json, provision/hosts/codex.json, provision/hosts/cursor.json, provision/hosts/gemini.json, provision/hosts/grok.json, provision/hosts/kimi.json, provision/hosts/mimo-code.json, provision/hosts/opencode.json, scripts/validate-host-authority-capabilities.mjs, references/host-capabilities.md, scripts/resolve-dispatch.mjs, agents/svc-stage-plan.md, scripts/stage-segment.mjs, references/skill-runtime-contracts-v2.json, references/model-routing.md, schemas/dispatch-policy.schema.json, scripts/run-external-review.mjs, scripts/two-box-plan.mjs, scripts/lib/two-box-protocol.mjs, scripts/lib/isolated-plan-analysis.mjs, scripts/lib/two-box-scout-assign.mjs, scripts/lib/two-box-role-launch.mjs |
| T3 | AC06, AC07, AC08, AC13, AC14 | V06, V07, V08, V13, V14 | schemas/receipts/control-plan.schema.json, schemas/receipts/plan-manifest.schema.json, scripts/emit-receipt.mjs, scripts/check-chain-receipts.mjs, scripts/lib/plan-manifest-contract.mjs, scripts/prepare-plan-handoff.mjs, scripts/lib/review-inputs.mjs, skills/plan-changeset/SKILL.md, skills/plan-changeset/references/manifest-templates.md, skills/review-plan/SKILL.md, scripts/review-plan-codex.sh, scripts/review-plan-kimi.sh, references/plan-review-protocol.md, references/chain-receipt-contract.md, agents/plan-reviewer.md, scripts/lib/control-plan-validate.mjs, scripts/lib/transmutation-seal.mjs, scripts/lib/receipt-issuance-epoch.mjs, test-framework/tests/delivery-plan-contract.test.mjs |
| T4 | AC07, AC08, AC09 | V07, V08, V09 | skills/execute-changeset/SKILL.md, skills/execute-changeset/references/process-details.md, skills/execute-changeset/references/subagent-dispatch.md |
| T5 | AC11, AC12 | V11, V12 | scripts/lib/research-decision.mjs, scripts/compile-delivery-graph.mjs, scripts/validate-delivery-graph.mjs, references/solution-confidence-protocol.md, skills/research/SKILL.md, skills/explore-solutions/SKILL.md, skills/design-tech/SKILL.md, skills/write-spec/SKILL.md, skills/validate-feature/SKILL.md, skills/analyze-domain/SKILL.md, skills/recall-stack-knowledge/SKILL.md, skills/route-workflow/references/lane-model.md, skills/route-workflow/references/intent-routing.md, skills/route-workflow/references/routing-rules.md, rules/common/research-before-build.md, rules/host-capability-research.md |
| T6 | AC15 | V15 | skills/manage-learnings/SKILL.md, scripts/learning-lifecycle.mjs |
| T7 | AC16, AC17, AC18 | V16, V17, V18, V19 | scripts/select-tier1-validators-v2.mjs, test-framework/evals/tier-1/validate-tier1-selector-v2.mjs, FRAMEWORK-STATE.md, docs/specs/work-items/INDEX.md, test-framework/evals/tier-1/validate-blind-floor.sh, .claude/agents/plan-reviewer.md, .claude/agents/svc-stage-plan.md, references/skill-routing-index.json, test-framework/tests/two-box-plan.test.mjs, test-framework/tests/research-decision.test.mjs, test-framework/tests/two-box-receipts.test.mjs, test-framework/tests/two-box-learning.test.mjs, test-framework/evals/tier-1/validate-two-box-transmutation.sh, test-framework/evals/tier-1/fixtures/two-box/isolation-canary-facts.json, test-framework/evals/tier-1/fixtures/two-box/eligibility-nonexempt.json, scripts/run-live-two-box-canary.mjs, docs/plans/two-box-transmutation/review-log.yaml, docs/plans/two-box-transmutation/implementation-report.md, test-framework/evals/tier-1/fixtures/two-box/control-plan-v1.json, test-framework/evals/tier-1/fixtures/two-box/executor-discretion-cases.json |

| Validation | AC IDs | Observation | Expected outcome |
|---|---|---|---|
| V01 | AC01 | source | unsupported numeric savings, entropy equation, attention-reset guarantee, and universal superiority claims are removed or qualified; business remains aspirational |
| V02 | AC02 | unit | Two-Box required unless recomputed eligibility is true; caller eligible true does not skip; files<=3 does not skip |
| V03 | AC03 | unit | Open Box refuses --read-only, review-package, and worktree cwd; uses --sandbox read-only and facts-dir; contamination enum tested |
| V04 | AC04 | unit | two scout processes; coverage.complete false when only citations exist |
| V05 | AC05 | unit | winner is only open_win contract_win combination; reject_innovation disposition; conflict blocks; original and revised distinct |
| V06 | AC06 | unit | missing source_decision fails prepareForReview; original requirements object is bound |
| V07 | AC07 | unit | Real signed review evidence and exact reviewed manifest/tree bindings required; separate seal leaves reviewed manifest bytes unchanged; unknown semantic fields and tampering fail. |
| V08 | AC08 | unit | v5 inline and dispatch validate; new v3/v4 emit refused except bootstrap hash; review-inputs accepts v5 |
| V09 | AC09 | hosted | Held-out executor discretion cases correctly classified with justification and affected decision/proof handling by the real configured EXEC model. |
| V10 | AC10 | unit | absent roles inherit PLAN/EXEC; Open Box host without isolation fails before spend |
| V11 | AC11 | unit | full RD06 order table including resolved local, missing score analysis, freshness without score, score 6 research, score 7 no network |
| V12 | AC12 | unit | compiler/validator fixtures require resume edge and reject fabricated research receipts |
| V13 | AC13 | unit | Actual versioned schema loader accepts named OFFLINE control-plan-v1.json under historical inspection, refuses it for new issuance/execution, and validates strict v2; snapshot/object tampering fails. |
| V14 | AC14 | unit | getObject survives worktree rmdir; package source_root differs from consumer checkout in nested worktree fixture |
| V15 | AC15 | unit | origin accepted; elevate without evaluate-rule fails |
| V16 | AC16 | unit | offline labeled OFFLINE; live mode not invoked by this command |
| V17 | AC17 | source | reports distinguish offline/live and include omissions/cost fields |
| V18 | AC18 | unit | selector lists validate-two-box-transmutation.sh; focused validator passes on the implementation tree |
| V00 | AC06, AC07, AC08, AC13, AC18 | source | Parent freeze/check verifies signed review, actual public root, exact body/manifest/spec/context and no implementation; T0 bytes are preserved. |
| V19 | AC16, AC17 | hosted | One bounded real full cycle on configured supported tuples, with effective isolation proof, actual output/coverage/usage identities and no claim of universal superiority. |
<!-- /SVC_PLAN_VIEWS -->
