# WI-502 Changeset: Canonical operation scope and durable authority

- **Spec:** `docs/specs/features/wi-502-durable-authority.md` (BASELINED)
- **Work item:** `docs/specs/work-items/WI-502.md`
- **Diagnosis:** `docs/specs/bugfix/wi-502-operation-scope-authority-brief.md`
- **Solution confidence:** `docs/specs/decisions/2026-07-20-wi-502-durable-authority/SOLUTION-CONFIDENCE.md`
- **Exploration decision:** `docs/specs/explorations/wi-502-durable-authority/DECISION.md`
- **Journey:** `docs/specs/journeys/J-FW-05-multi-session-contention.feature.md`
- **Branch:** framework-WI-502-durable-authority
- **Worktree:** .worktrees/framework-WI-502-durable-authority
- **Base branch / SHA:** origin/main / `0f3bc54d5404b361259469081cf55822b01aae6c`
- **Lane:** framework
- **Delivery tier:** FULL
- **Archetype:** architectural change + cross-cutting authority concern
- **Mode:** inline
- **Status:** SIMULATED
- **Created:** 2026-07-20
- **Implementation stop:** execute-changeset remains pending until this plan completes canonical external review.
- **Protected main residue:** pre-existing .svc/lane-tasks-WI-499.json, .svc/learning-fires.jsonl, and .svc/session-contract.jsonl in the default checkout are outside this changeset and must remain byte-identical.

## Architectural preflight

### Current invariants

| Invariant | Must remain true |
|---|---|
| Unbound mutation | Governed mutation without exact current authority denies. |
| Exact tuple | Repository, worktree, WI, task, skill receipt, session/principal, and generation agree. |
| Read availability | Proved read-only inspection does not require mutation authority. |
| Foreign isolation | Foreign graphs/claims/receipts are diagnostic only. |
| Checkout isolation | No implementation mutation occurs in the default checkout. |
| Lane order | One execute-changeset lane task remains in progress; leaf parallelism is nested. |
| Parent integration | Children never update the parent graph/lease or merge themselves. |
| Shell honesty | PreToolUse classification is never described as complete filesystem containment. |
| Cost | Mutation hot path makes zero model/provider calls. |

### Reversibility

Every task is a checkpoint. Task 2 can revert to v1 authority with only the new operation-scope consumer changes removed. Task 3 adds v2 behind explicit migration and keeps exact v1 backup/rollback. Task 4 delegation is disabled unless v2 and host capabilities pass. Task 5 can disable delegated mutation per host without weakening controller authority. No partial checkpoint is promoted independently.

### Entry-point universe

| Concern family | Count | Plan disposition |
|---|---:|---|
| Codex session-context consumers | 3 | Mutation consumer takes operation scope; prompt/Stop preserve session context and receive regression tests. |
| Shared exact-WI/worktree consumers | 6 | One scope/authority adapter; no second target parser. |
| Mutation target parsers | 2 | Consolidate into operation-scope; old helpers delegate or retire. |
| Core claim/binding runtime modules | 4 core + 10 downstream | Explicit v1 compatibility/migration inventory; no implicit authority. |
| Dispatch/reference/runtime surfaces | 11 | Separate WI-level waves from new within-WI execution graph; one capability/receipt contract. |
| Provisioned hosts | 8 | Every manifest declares identity, containment, and delegated-mutation support state. |

Inventory evidence: `docs/specs/test-evidence/WI-502/framework-surface-inventory.md`.

## Implementation Summary

Build one canonical operation-scope object from trusted host fields, complete structured targets, realpath/nearest-parent anchors, and exact Git identity before mutation authority. Evolve v1 claims into a repository-shared, revision-CAS controller lease with generation-bound resume/handover/recovery. Add nested execution graphs and explicit inner-worktree child capabilities, recomputed completion receipts, and sequential parent merge. Add obvious Bash escape rejection plus a real containment adapter/capability gate; unsupported hosts remain controller-only. Roll out through all host manifests and installed-source drift checks.

The `plan-blast-radius` skill is not used because its contract is Terraform/Helm/Kubernetes IaC-only. The architectural blast map above and task-scoped file universe provide the relevant equivalent.

## Files Planned

Legend: UPSTREAM files are already authored during diagnosis/design/planning; implementation tasks may only validate or synchronize them. REVIEW-EVIDENCE files are immutable outputs from a completed review round. CREATE paths are intentionally absent on disk until their task.

| File | Action | Task | Purpose |
|---|---|---:|---|
| docs/specs/work-items/WI-502.md | UPSTREAM | plan | Normative acceptance contract |
| docs/specs/work-items/WI-503.md | UPSTREAM/FOLLOW-UP | review | Independent review-adapter path bug discovered during Fable invocation |
| docs/specs/work-items/INDEX.md | UPSTREAM | plan | WI registration |
| docs/specs/bugfix/wi-502-operation-scope-authority-brief.md | UPSTREAM | plan | Repro/root cause/pillar audit |
| docs/specs/features/wi-502-durable-authority.md | UPSTREAM | plan | BASELINED architecture |
| docs/specs/decisions/wi-502-durable-authority.md | UPSTREAM | plan | Design decisions |
| docs/specs/decisions/2026-07-20-wi-502-durable-authority/SOLUTION-CONFIDENCE.md | UPSTREAM | plan | Grounding, alternatives, approval packet |
| docs/specs/explorations/wi-502-durable-authority/PROBLEM_BRIEF.md | UPSTREAM | plan | Exploration framing |
| docs/specs/explorations/wi-502-durable-authority/SOLUTION_MAP.md | UPSTREAM | plan | Paradigm map |
| docs/specs/explorations/wi-502-durable-authority/ANALYSIS.md | UPSTREAM | plan | AC tradeoff analysis |
| docs/specs/explorations/wi-502-durable-authority/COMPARISON.md | UPSTREAM | plan | Non-code finalist probe |
| docs/specs/explorations/wi-502-durable-authority/DECISION.md | UPSTREAM | plan | Selected direction |
| docs/specs/journeys/J-FW-05-multi-session-contention.feature.md | UPSTREAM | plan | FW05-S13..S16 |
| docs/specs/test-evidence/WI-502/framework-surface-inventory.md | UPSTREAM | plan | Frozen entry-point universe |
| docs/specs/test-evidence/WI-502/declared-file-set.txt | UPSTREAM | plan | Mechanical final and per-task path allowlist |
| docs/specs/test-evidence/WI-502/task-paths.json | UPSTREAM | plan | Machine-readable exact paths per implementation checkpoint |
| docs/plans/2026-07-20-wi502-durable-authority/manifest.md | UPSTREAM | plan | Reviewed deterministic plan |
| docs/plans/2026-07-20-wi502-durable-authority/review-log.yaml | CREATE | review | Fable findings and dispositions |
| docs/plans/2026-07-20-wi502-durable-authority/review-round1-findings.json | REVIEW-EVIDENCE | review | Schema-valid Fable round-1 findings |
| docs/plans/2026-07-20-wi502-durable-authority/review-round2-findings.json | REVIEW-EVIDENCE | review | Schema-valid Fable round-2 findings |
| docs/plans/2026-07-20-wi502-durable-authority/review-round3-findings.json | CREATE | review | Pending schema-valid Fable convergence review |
| docs/plans/2026-07-20-wi502-durable-authority/progress.md | CREATE | 1 | Execution checkpoint ledger |
| AGENTS.md | MODIFY | 6 | Document the manifest-driven host set, including mimo-code |
| test-framework/evals/tier-1/validate-operation-scope-authority.sh | CREATE | 1 | Red/green scope and structured-target matrix |
| test-framework/evals/tier-1/validate-controller-lease-handover.sh | CREATE | 1 | Red/green lease/CAS/migration races |
| test-framework/evals/tier-1/validate-delegated-execution-authority.sh | CREATE | 1 | Red/green partition/capability/receipt/merge matrix |
| test-framework/evals/tier-1/validate-shell-containment-contract.sh | CREATE | 1 | Structured shell escape + host capability matrix |
| hooks/lib/operation-scope.mjs | CREATE | 2 | Pure host/workdir/target/Git scope resolver |
| hooks/lib/hook-payload.mjs | MODIFY | 2 | Preserve session context and expose adapter inputs; retire partial target extraction |
| hooks/codex/lib/codex-hook-context.mjs | MODIFY | 2 | Separate session context from normalized mutation scope |
| hooks/codex/svc-codex-skill-load-enforcer.mjs | MODIFY | 2 | Resolve mutation authority from canonical scope and validate sanctioned targets |
| hooks/svc-worktree-isolation-guard.mjs | MODIFY | 2 | Consume shared scope, deny contradictions/mixed repos, retain host-neutral guard |
| schemas/controller-lease.schema.json | CREATE | 3 | v2 lease contract |
| schemas/authority-handover-receipt.schema.json | CREATE | 3 | Handover/recovery audit contract |
| hooks/lib/authority-store.mjs | CREATE | 3 | Repository-shared locked/CAS lease and token store |
| hooks/lib/wi-claim.mjs | MODIFY | 3 | v1 adapter, explicit migration/rollback support, no dual authority |
| hooks/lib/resolve-wi.mjs | MODIFY | 3 | Principal/repo digest/v2 controller or child resolution |
| scripts/svc-authority.mjs | CREATE | 3 | status/renew/resume/migrate/handover/recover/release CLI |
| scripts/codex-load-skill.mjs | MODIFY | 2 | Bind mutation receipts to current authority generation and lease |
| scripts/svc-ensure-worktree.mjs | MODIFY | 3 | Bootstrap/reattach through v2 store while preserving residue and v1 migration boundary |
| schemas/execution-graph.schema.json | CREATE | 4 | Nested wave/task state contract |
| schemas/delegation-capability.schema.json | CREATE | 4 | Scoped generation-bound child authority |
| schemas/delegation-completion-receipt.schema.json | CREATE | 4 | Child result/diff/validation receipt |
| hooks/lib/delegation-authority.mjs | CREATE | 4 | Issue/accept/check/revoke/freeze/adopt capability logic |
| scripts/plan-execution-wave.mjs | CREATE | 4 | Dependency/shared-resource partition fence |
| scripts/dispatch-execution-task.mjs | CREATE | 4 | Inner worktree creation, persisted edge, token acceptance, contained launch |
| scripts/validate-execution-merge-back.mjs | CREATE | 4 | Recompute receipt, sequential merge, mapping, revalidation |
| scripts/dispatch-worker.sh | MODIFY | 4 | Mutating mode requires accepted capability and emits schema receipt; no parent graph mutation |
| execute-changeset/SKILL.md | MODIFY | 4 | Nested execution graph and capability gate |
| execute-changeset/references/process-details.md | MODIFY | 4 | Partition, child, merge, failure, adoption workflow |
| execute-changeset/references/subagent-dispatch.md | MODIFY | 4 | One inner worktree per mutating child; overlap serializes |
| dispatch-waves/SKILL.md | MODIFY | 4 | Distinguish WI-level waves from within-WI leaf execution |
| references/parallel-dispatch-transport.md | MODIFY | 4 | Versioned delegation/completion transport |
| scripts/svc-contained-exec.mjs | CREATE | 5 | Host-adaptive real containment launcher and escape probe |
| scripts/validate-host-authority-capabilities.mjs | CREATE | 5 | Validate all manifest identity/containment/support declarations |
| provision/hosts/antigravity.json | MODIFY | 5 | Explicit unsupported child-mutation capability |
| provision/hosts/claude.json | MODIFY | 5 | Verified identity/containment adapter declaration |
| provision/hosts/codex.json | MODIFY | 5 | Codex payload, agent identity, workspace sandbox declaration |
| provision/hosts/cursor.json | MODIFY | 5 | Explicit unsupported child-mutation capability |
| provision/hosts/gemini.json | MODIFY | 5 | Verified/unsupported capability declaration based on probe |
| provision/hosts/kimi.json | MODIFY | 5 | Verified/unsupported capability declaration based on probe |
| provision/hosts/mimo-code.json | MODIFY | 5 | Verified/unsupported capability declaration based on probe |
| provision/hosts/opencode.json | MODIFY | 5 | Verified/unsupported capability declaration based on probe |
| references/host-capabilities.md | MODIFY | 5 | Truthful stable identity + containment support matrix |
| references/knowledge/domains/codex-hooks/details/events.md | MODIFY | 5 | Current tool workdir/target/session/subagent payload contract |
| WORKTREES.md | MODIFY | 6 | Controller/inner-worktree lifecycle and cleanup |
| DOCTRINE.md | MODIFY | 6 | Authority guardrail versus containment boundary |
| FRAMEWORK-STATE.md | MODIFY | 6 | Record v2 authority capability and rollout state |
| scripts/check-install-drift.sh | MODIFY | 6 | Capability/install source drift validation |
| test-framework/evals/tier-1/validate-session-authority-isolation.sh | MODIFY | 6 | v1/v2 cross-host regression parity |
| test-framework/evals/tier-1/validate-session-worktree-binding.sh | MODIFY | 6 | Resume/handover/generation compatibility |
| test-framework/evals/tier-1/validate-parallel-wi-dispatch.sh | MODIFY | 6 | Ensure WI-level dispatch stays distinct and compatible |
| .svc/lane-tasks-WI-502.json | UPSTREAM/STATE | all | Cross-host chain state; child mutation forbidden |
| .svc/pipeline-decisions.jsonl | UPSTREAM/STATE | plan | Framework-lane skill decisions and IaC-only blast-radius skip |

## Task Graph

Execution stays single-controller. No task is delegated while the capability being built is unproven.

```json
{
  "tasks": [
    {"id":"task-1-red-contracts","blocked_by":[],"touches":["test-framework/evals/tier-1/validate-operation-scope-authority.sh","test-framework/evals/tier-1/validate-controller-lease-handover.sh","test-framework/evals/tier-1/validate-delegated-execution-authority.sh","test-framework/evals/tier-1/validate-shell-containment-contract.sh","docs/plans/2026-07-20-wi502-durable-authority/progress.md"],"checkpoint":"wi502-red-contracts"},
    {"id":"task-2-operation-scope","blocked_by":["task-1-red-contracts"],"touches":["docs/plans/2026-07-20-wi502-durable-authority/progress.md","hooks/lib/operation-scope.mjs","hooks/lib/hook-payload.mjs","hooks/codex/lib/codex-hook-context.mjs","hooks/codex/svc-codex-skill-load-enforcer.mjs","hooks/svc-worktree-isolation-guard.mjs","scripts/codex-load-skill.mjs","test-framework/evals/tier-1/validate-operation-scope-authority.sh"],"checkpoint":"wi502-operation-scope"},
    {"id":"task-3-controller-lease","blocked_by":["task-2-operation-scope"],"touches":["docs/plans/2026-07-20-wi502-durable-authority/progress.md","schemas/controller-lease.schema.json","schemas/authority-handover-receipt.schema.json","hooks/lib/authority-store.mjs","hooks/lib/wi-claim.mjs","hooks/lib/resolve-wi.mjs","scripts/svc-authority.mjs","scripts/svc-ensure-worktree.mjs","test-framework/evals/tier-1/validate-controller-lease-handover.sh"],"checkpoint":"wi502-controller-lease"},
    {"id":"task-4-delegated-execution","blocked_by":["task-3-controller-lease"],"touches":["docs/plans/2026-07-20-wi502-durable-authority/progress.md","schemas/execution-graph.schema.json","schemas/delegation-capability.schema.json","schemas/delegation-completion-receipt.schema.json","hooks/lib/delegation-authority.mjs","scripts/plan-execution-wave.mjs","scripts/dispatch-execution-task.mjs","scripts/validate-execution-merge-back.mjs","scripts/dispatch-worker.sh","execute-changeset/SKILL.md","execute-changeset/references/process-details.md","execute-changeset/references/subagent-dispatch.md","dispatch-waves/SKILL.md","references/parallel-dispatch-transport.md","test-framework/evals/tier-1/validate-delegated-execution-authority.sh"],"checkpoint":"wi502-delegated-execution"},
    {"id":"task-5-containment-hosts","blocked_by":["task-4-delegated-execution"],"touches":["docs/plans/2026-07-20-wi502-durable-authority/progress.md","scripts/svc-contained-exec.mjs","scripts/validate-host-authority-capabilities.mjs","provision/hosts/antigravity.json","provision/hosts/claude.json","provision/hosts/codex.json","provision/hosts/cursor.json","provision/hosts/gemini.json","provision/hosts/kimi.json","provision/hosts/mimo-code.json","provision/hosts/opencode.json","references/host-capabilities.md","references/knowledge/domains/codex-hooks/details/events.md","test-framework/evals/tier-1/validate-shell-containment-contract.sh"],"checkpoint":"wi502-host-containment"},
    {"id":"task-6-docs-install-regression","blocked_by":["task-5-containment-hosts"],"touches":["AGENTS.md","DOCTRINE.md","FRAMEWORK-STATE.md","WORKTREES.md","docs/plans/2026-07-20-wi502-durable-authority/progress.md","scripts/check-install-drift.sh","test-framework/evals/tier-1/validate-session-authority-isolation.sh","test-framework/evals/tier-1/validate-session-worktree-binding.sh","test-framework/evals/tier-1/validate-parallel-wi-dispatch.sh"],"checkpoint":"wi502-docs-install"},
    {"id":"task-7-holistic-gates","blocked_by":["task-6-docs-install-regression"],"touches":[".svc/lane-tasks-WI-502.json","docs/plans/2026-07-20-wi502-durable-authority/progress.md"],"checkpoint":"wi502-holistic-gates"}
  ]
}
```

### Task details

| Task | Deterministic work | AC coverage | Validation |
|---|---|---|---|
| 1 | Create hermetic, green-capable validators whose assertions naturally fail against the current implementation and pass once their target module/behavior exists. Each intended red path emits its named stable `WI502-RED` marker; capture output in the external temporary evidence directory and use progress.md only for mechanical snapshot records. Do not commit or run the auto-discovered full suite until implementation makes all four green. | proof precondition | Each focused validator fails with its exact contract marker, not syntax/setup; Bash syntax passes. |
| 2 | Implement pure canonical scope; complete apply-patch/direct/structured target parsing; exact Git repo/worktree identity; integrate both mutation guards; validate sanctioned executable and operands. | OS-01..10, SB-01 obvious forms | Operation-scope validator green; current WI-501 read-only corpus green; `node --check` all modules. |
| 3 | Implement principal/repo digest, shared v2 store, schema validation, renew/resume, one-time handover, recovery, explicit v1 migration/backup/rollback; integrate bootstrap/resolver. | AU-01..07 | Lease race suite green; old generation denied; v1 bytes restore exactly; existing WI-486/499 binding suites green. |
| 4 | Implement nested graph, partition fence, capability lifecycle, inner worktree dispatch, child guard, completion receipt, sequential merge, failure/adoption behavior; update contracts. | DG-01..10 | Delegated execution suite green including overlap serialization, tamper, handover freeze, and merge mapping. |
| 5 | Implement containment launcher/probe, declare all host capabilities, gate mutating children, update Codex knowledge; controller guard remains available where sandbox is absent. | SB-01..04, DG-02/05 | Actual outside-root write denial on each supported adapter; unsupported fixtures deny before child launch; all manifests validate. |
| 6 | Synchronize doctrine/worktree/state/install behavior; document that check-install-drift accepts any provisioned manifest (including mimo-code) and rejects an unknown host; ensure installed source contains new dependencies; preserve WI-level dispatch; run focused cross-host regression. | all documentation/rollout outcomes | Install drift all hosts, focused validators, linter, pipeline integrity. |
| 7 | Run full Tier-1, review-exec, impact triad, audit, clean-diff/file-universe checks; no implementation correction bypasses plan review. | all | Full suite; post-commit focused rerun; receipt chain ready for land. |

## Lane Compliance

The framework lane list is not itself the mandatory delivery chain; the manifest policy says mandatory chain enforcement is L1+L2+L3. Every framework-lane skill is still dispositioned here, with the durable decision in `.svc/pipeline-decisions.jsonl` (WI-502 entry at 2026-07-20T11:51:00Z).

| Framework-lane skill | Status | Evidence / decision |
|---|---|---|
| test-framework | planned downstream | task-7 full Tier-1 plus four focused validators |
| evolve-framework | skipped | Live-reproduced correction, not an evolution/gap-scan intake; pipeline decision cited above |
| blend-external | skipped | No external pattern import; official sources ground design only |
| blend-private | skipped | No private skill/source blend |
| improve-framework | skipped | Owner supplied the framework proposal and diagnose-bug established the correction contract directly, which the framework lane notes permit |
| recall-stack-knowledge | skipped | Current repository WIs/code and live host payload are the authoritative stack evidence; no stale external stack question |
| plan-blast-radius | skipped | Skill is IaC-only; entry-point universe + reversibility map used instead |
| track-topology-diff | skipped | No deploy/runtime topology artifact changes; authority state diagrams are in the BASELINED spec |
| refresh-competitors | skipped | Internal Enabler with landscape explicitly inapplicable |

Mandatory normal-chain stages are artifact-backed: route-workflow (graph), diagnose-bug (brief), write-spec (feature spec), design-tech (BASELINED spec), explore-solutions (decision), plan-changeset (this manifest), and review-plan (Fable review log). execute-changeset, review-exec, audit-implementation, land-changeset, and verify-promotion remain pending in that order.

## AC-to-Task Mapping

| AC family | Tasks |
|---|---|
| OS-01..10 | 1, 2, 6 |
| SB-01..04 | 1, 2, 5, 6 |
| AU-01..07 | 1, 3, 6 |
| DG-01..10 | 1, 4, 5, 6 |

Every normative AC is owned; none is deferred. Host-specific child mutation may be mechanically `unsupported`, which is an AC-compliant fail-closed outcome rather than a missing implementation.

## AC-to-Test Mapping

| AC family | Type | Exact proof |
|---|---|---|
| OS-01..10 | Unit/integration fixture | validate-operation-scope-authority.sh |
| SB-01..04 | Behavioral host fixture | validate-shell-containment-contract.sh; actual escape write denied for supported adapters |
| AU-01..07 | Integration/race fixture | validate-controller-lease-handover.sh |
| DG-01..10 | Integration/Git fixture | validate-delegated-execution-authority.sh |
| Browser/mobile | N/A | Internal headless framework; no visual runtime exists. |

## Prerequisite Alignment Matrix

| Task/files | UX flow | UI/assets | Technical design | Style contract | Persona/market |
|---|---|---|---|---|---|
| 1–2 scope/guards | J-FW-05 S13/S16 | N/A — headless | WI-502 canonical scope/Bash sections | Existing portable Bash + Node ESM conventions in AGENTS.md | S1 Framework Orchestrator in J-FW-05; market landscape inapplicable Enabler |
| 3 lease/handover | J-FW-05 S14 | N/A — headless | WI-502 lease state machine/migration | Existing atomic state-io and WI-486 lock conventions | S1 Framework Orchestrator; no customer persona |
| 4 delegation/merge | J-FW-05 S15 | N/A — headless | WI-502 capability/partition/receipt design | Existing scripts/schemas/reference conventions | S1 parent + stable child principals; no market differentiation |
| 5 containment/hosts | J-FW-05 S16 | N/A — headless | WI-502 shell boundary/compatibility rollout | Host manifest conventions and AGENTS multi-host rule | Host capability consumers, not customer personas |
| 6–7 docs/gates | S13..S16 | N/A — no visual parity ledger | Complete BASELINED design and solution-confidence proof gates | DOCTRINE/WORKTREES/FRAMEWORK-STATE conventions | Persona coverage explicitly not required in task graph |

## External State

| Environment | What state | Coupling | Lifecycle wiring |
|---|---|---|---|
| 1 Host filesystem outside repo | v2 lease/handover/delegation runtime state under secure user state root; installed enforcement reads durable source | coupled | svc-authority migration/rollback/status plus setup/install drift and schema receipts |
| 2 Host config files | Hook definitions and host capability declarations | coupled | setup per host + check-install-drift + capability validator |
| 3 Other worktrees | controller and child inner worktrees; default-checkout residue | coupled | authority CLI, dispatch-execution-task, revoke/cleanup, exact residue digest fixture |
| 5 Persistent jobs | none | untouched | — |
| 6 Running services/processes | child CLI processes and controller liveness evidence | coupled | lease expiry/liveness, revoke, retained logs, parent-only merge |
| 7 External SaaS | none | untouched | — |
| 8 Database/migrations | no application database; local authority schema migration only | coupled | explicit v1 backup/digest/migrate/rollback receipt |
| 9 Caches | Git identity and revision/generation caches | coupled | documented invalidation owners and lifecycle tests |
| 12 Downstream framework artifacts | execute/dispatch/host/docs contracts | coupled | file universe, focused validators, manifest linter/pipeline integrity |
| 13 CI/CD wires | none | untouched | — |
| 14 Auth/secrets | one-time handover/delegation tokens, hashes only in store | coupled | single use, expiry, token consumption, no secret in receipts/logs |
| 15 Runtime files | locks, tokens, receipts, retained child logs/worktrees | coupled | secure state root, terminal state, cleanup/retention command |

Untouched taxonomy entries: 4 package registries, 10 DNS/SSL/domains, 11 search/index services. No unlisted external environment is knowingly mutated.

## Validation Plan

Task-level commands are in the execution sequence. Final branch gates:

- four new focused Tier-1 validators;
- existing session authority, worktree binding, Codex integrity/read-only, default-checkout isolation, install migration/drift, and parallel WI dispatch validators;
- node syntax for every new/modified `.mjs` file and Bash syntax for shell files;
- JSON parse and host capability schema validation for all manifests/schemas;
- manifest linter, pipeline integrity, and full Tier-1 suite;
- post-commit focused rerun from the committed tree;
- external review of the finished diff through review-exec, not a second plan review.

## Execution Command Sequence

```bash
set -Eeuo pipefail
REPO=/workspace/seriousvibecoding/.worktrees/framework-WI-502-durable-authority
BASE=0f3bc54d5404b361259469081cf55822b01aae6c
DECLARED=docs/specs/test-evidence/WI-502/declared-file-set.txt
TASK_PATHS=docs/specs/test-evidence/WI-502/task-paths.json

RECOVERY_IF_FAIL() {
  git status --short
  git log --oneline --decorate -8
  echo "Stopped at the last named local snapshot. Keep the worktree and refs/svc/checkpoints/WI-502; diagnose, correct the current task, and rerun its focused gate."
}
trap RECOVERY_IF_FAIL ERR

cd "$REPO"
command -v bash >/dev/null
command -v git >/dev/null
command -v jq >/dev/null
command -v node >/dev/null
test "$(git branch --show-current)" = "framework-WI-502-durable-authority"
git merge-base --is-ancestor "$BASE" HEAD
if test "$(git rev-parse HEAD)" != "$BASE"; then
  echo "WI-502 implementation commit already exists; use the post-review entry point, not the execute block." >&2
  exit 0
fi
node scripts/task-graph.mjs validate .svc/lane-tasks-WI-502.json
LC_ALL=C sort -c "$DECLARED"
EVIDENCE_DIR="$(mktemp -d)"
mkdir -p "$EVIDENCE_DIR/red"

stage_declared_existing() {
  while IFS= read -r file; do
    if test "$file" = ".svc/pipeline-decisions.jsonl"; then
      continue
    fi
    if test -e "$file"; then
      git add -- "$file"
    fi
  done < "$DECLARED"
  stage_owned_pipeline_decision
}

stage_owned_pipeline_decision() {
  file=.svc/pipeline-decisions.jsonl
  marker='"wi":"WI-502"'
  test "$(grep -Fc "$marker" "$file")" -eq 1
  temp="$EVIDENCE_DIR/pipeline-decisions.WI-502.jsonl"
  git show "$BASE:$file" > "$temp"
  grep -F "$marker" "$file" >> "$temp"
  mode="$(git ls-files -s -- "$file" | awk 'NR == 1 { print $1 }')"
  blob="$(git hash-object -w -- "$temp")"
  git update-index --add --cacheinfo "$mode,$blob,$file"
}

PREV_SNAPSHOT="$BASE"
if git show-ref --verify --quiet refs/svc/checkpoints/WI-502/reviewed-plan; then
  PREV_SNAPSHOT="$(git rev-parse refs/svc/checkpoints/WI-502/reviewed-plan)"
else
  stage_declared_existing
  PLAN_SNAPSHOT="$(git stash create "WI-502 reviewed-plan")"
  test -n "$PLAN_SNAPSHOT"
  git update-ref refs/svc/checkpoints/WI-502/reviewed-plan "$PLAN_SNAPSHOT"
  PREV_SNAPSHOT="$PLAN_SNAPSHOT"
fi

resume_task() {
  task_id="$1"
  ref="refs/svc/checkpoints/WI-502/$task_id"
  if git show-ref --verify --quiet "$ref"; then
    PREV_SNAPSHOT="$(git rev-parse "$ref")"
    return 0
  fi
  return 1
}

checkpoint_task() {
  task_id="$1"
  printf '%s | %s\n' "$(date -u +%FT%TZ)" "$task_id" >> docs/plans/2026-07-20-wi502-durable-authority/progress.md
  stage_declared_existing
  snapshot="$(git stash create "WI-502 $task_id")"
  test -n "$snapshot"
  git diff --name-only "$PREV_SNAPSHOT" "$snapshot" | while IFS= read -r file; do
    test -z "$file" || jq -e --arg task "$task_id" --arg file "$file" '.[$task] | index($file) != null' "$TASK_PATHS" >/dev/null
  done
  git update-ref "refs/svc/checkpoints/WI-502/$task_id" "$snapshot"
  PREV_SNAPSHOT="$snapshot"
}

expect_red() {
  marker="$1"
  log="$2"
  shift 2
  if "$@" >"$log" 2>&1; then
    echo "Expected red validation unexpectedly passed: $*" >&2
    return 1
  fi
  grep -Fq "$marker" "$log" || {
    echo "Red validation lacked contract marker '$marker': $*" >&2
    return 1
  }
  return 0
}

if ! resume_task task-1-red-contracts; then
  # Author green-capable fixtures, capture intended red output outside the repository, and keep the snapshot unpushed.
  bash -n test-framework/evals/tier-1/validate-operation-scope-authority.sh
  bash -n test-framework/evals/tier-1/validate-controller-lease-handover.sh
  bash -n test-framework/evals/tier-1/validate-delegated-execution-authority.sh
  bash -n test-framework/evals/tier-1/validate-shell-containment-contract.sh
  expect_red "WI502-RED operation-scope" "$EVIDENCE_DIR/red/operation-scope.log" bash test-framework/evals/tier-1/validate-operation-scope-authority.sh
  expect_red "WI502-RED controller-lease" "$EVIDENCE_DIR/red/controller-lease.log" bash test-framework/evals/tier-1/validate-controller-lease-handover.sh
  expect_red "WI502-RED delegated-execution" "$EVIDENCE_DIR/red/delegated-execution.log" bash test-framework/evals/tier-1/validate-delegated-execution-authority.sh
  expect_red "WI502-RED shell-containment" "$EVIDENCE_DIR/red/shell-containment.log" bash test-framework/evals/tier-1/validate-shell-containment-contract.sh
  checkpoint_task task-1-red-contracts
fi

if ! resume_task task-2-operation-scope; then
  bash test-framework/evals/tier-1/validate-operation-scope-authority.sh
  bash test-framework/evals/tier-1/validate-enforcement-escape-and-readonly.sh
  node --check hooks/lib/operation-scope.mjs
  node --check hooks/codex/lib/codex-hook-context.mjs
  node --check hooks/codex/svc-codex-skill-load-enforcer.mjs
  node --check hooks/svc-worktree-isolation-guard.mjs
  checkpoint_task task-2-operation-scope
fi

if ! resume_task task-3-controller-lease; then
  bash test-framework/evals/tier-1/validate-controller-lease-handover.sh
  bash test-framework/evals/tier-1/validate-session-authority-isolation.sh
  bash test-framework/evals/tier-1/validate-session-worktree-binding.sh
  node --check hooks/lib/authority-store.mjs
  node --check hooks/lib/resolve-wi.mjs
  node --check scripts/svc-authority.mjs
  checkpoint_task task-3-controller-lease
fi

if ! resume_task task-4-delegated-execution; then
  bash test-framework/evals/tier-1/validate-delegated-execution-authority.sh
  bash test-framework/evals/tier-1/validate-parallel-wi-dispatch.sh
  node --check hooks/lib/delegation-authority.mjs
  node --check scripts/plan-execution-wave.mjs
  node --check scripts/dispatch-execution-task.mjs
  node --check scripts/validate-execution-merge-back.mjs
  bash -n scripts/dispatch-worker.sh
  checkpoint_task task-4-delegated-execution
fi

if ! resume_task task-5-containment-hosts; then
  bash test-framework/evals/tier-1/validate-shell-containment-contract.sh
  node scripts/validate-host-authority-capabilities.mjs --root .
  node --check scripts/svc-contained-exec.mjs
  checkpoint_task task-5-containment-hosts
fi

if ! resume_task task-6-docs-install-regression; then
  node scripts/lint-skills-manifest.mjs
  bash test-framework/scripts/validate-pipeline-integrity.sh .
  bash scripts/check-install-drift.sh --host codex --quiet
  bash scripts/check-install-drift.sh --host claude --quiet
  bash scripts/check-install-drift.sh --host kimi --quiet
  bash scripts/check-install-drift.sh --host gemini --quiet
  bash scripts/check-install-drift.sh --host opencode --quiet
  bash scripts/check-install-drift.sh --host antigravity --quiet
  bash scripts/check-install-drift.sh --host cursor --quiet
  bash scripts/check-install-drift.sh --host mimo-code --quiet
  checkpoint_task task-6-docs-install-regression
fi

if ! resume_task task-7-holistic-gates; then
  bash test-framework/evals/run-all-evals.sh
  node scripts/task-graph.mjs validate .svc/lane-tasks-WI-502.json
  stage_declared_existing
  git diff --cached --check
  {
    git diff --name-only HEAD
    git ls-files --others --exclude-standard
  } | LC_ALL=C sort -u > "$EVIDENCE_DIR/actual-files.txt"
  comm -23 "$EVIDENCE_DIR/actual-files.txt" "$DECLARED" | tee "$EVIDENCE_DIR/outside-declared.txt"
  test ! -s "$EVIDENCE_DIR/outside-declared.txt"
  checkpoint_task task-7-holistic-gates
fi

if test "$(git rev-parse HEAD)" = "$BASE"; then
  git commit -m "feat(WI-502): add canonical scope and durable authority" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <contact-cd29c5ac34@example.invalid>"
fi
IMPL_SHA="$(git rev-parse HEAD)"

# execute-changeset stops here after writing plan-manifest, review-plan, and exec-record bodies for IMPL_SHA.
for type in plan-manifest review-plan exec-record; do
  test -s ".svc/receipt-bodies/WI-502/$type.json"
  node scripts/emit-receipt.mjs --type "$type" --wi WI-502 --sha "$IMPL_SHA" < ".svc/receipt-bodies/WI-502/$type.json"
done
```

The implementer applies source edits with native file tools from this exact worktree. The command sequence is validation/checkpoint orchestration, not a shell-generated source rewrite. On resume, treat `refs/svc/checkpoints/WI-502/*` as authoritative, use progress.md as its human-readable mirror, rerun the focused validation for each recorded checkpoint, and continue at the first task lacking either ref or passing proof. The branch HEAD stays at the immutable base until the single final implementation commit, so repeated preflight remains valid. Local snapshot refs are recovery-only and are not pushed. `.svc/pipeline-decisions.jsonl` is a concurrently appended audit ledger: the index is built from `BASE` plus exactly the single WI-502 entry, while unrelated working-tree appends remain byte-preserved and unstaged.

After `review-exec` and `audit-implementation` finish against `IMPL_SHA`, each skill writes its own schema-valid body. Run this distinct post-review entry point; do not rerun the execute block:

```bash
set -Eeuo pipefail
REPO=/workspace/seriousvibecoding/.worktrees/framework-WI-502-durable-authority
cd "$REPO"
IMPL_SHA="$(git rev-parse HEAD)"
git log -1 --format=%s | grep -q "WI-502"

# review-exec and audit-implementation are the named producers for these two bodies.
for type in review-exec audit-implementation; do
  test -s ".svc/receipt-bodies/WI-502/$type.json"
  node scripts/emit-receipt.mjs --type "$type" --wi WI-502 --sha "$IMPL_SHA" < ".svc/receipt-bodies/WI-502/$type.json"
done
node scripts/check-chain-receipts.mjs --sha "$IMPL_SHA"
```

## Checkpoint Plan

| Order | Checkpoint | Rollback anchor |
|---:|---|---|
| 1 | wi502-red-contracts | reset working state to the reviewed-plan snapshot; no branch commit exists |
| 2 | wi502-operation-scope | restore the task-1 snapshot; v1 authority remains intact |
| 3 | wi502-controller-lease | run exact v1 rollback, verify bytes, then restore the task-2 snapshot |
| 4 | wi502-delegated-execution | revoke capabilities, retain child worktrees/logs, then restore the task-3 snapshot |
| 5 | wi502-host-containment | mark delegated mutation unsupported, verify controller guard, then restore the task-4 snapshot |
| 6 | wi502-docs-install | rerun prior setup/install drift, then restore the task-5 snapshot |
| 7 | wi502-holistic-gates | repair before the single final commit; never rewrite published history |

For a local pre-commit rollback, set `ANCHOR_TASK` to the preceding row's task id (or `reviewed-plan` for task 1) and `ROLLED_BACK_TASK` to the task being removed, then run the exact allowlisted restore below. Planned CREATE files absent from the anchor are removed explicitly; no repository-wide clean is allowed.

```bash
set -Eeuo pipefail
TASK_PATHS=docs/specs/test-evidence/WI-502/task-paths.json
ANCHOR_TASK=task-2-operation-scope
ROLLED_BACK_TASK=task-3-controller-lease
ANCHOR="refs/svc/checkpoints/WI-502/$ANCHOR_TASK"
git show-ref --verify --quiet "$ANCHOR"
git restore --source="$ANCHOR" --staged --worktree -- .
jq -r --arg task "$ROLLED_BACK_TASK" '.[$task][]' "$TASK_PATHS" | while IFS= read -r file; do
  if ! git cat-file -e "$ANCHOR:$file" 2>/dev/null; then
    git rm -f --ignore-unmatch -- "$file"
    test ! -e "$file" || rm -f -- "$file"
  fi
done
git diff --cached --check
```

After rollback, run the focused validation for `ANCHOR_TASK` from the task table. Task 3 additionally runs its v1 byte-for-byte restore fixture before the working-tree rollback; child-capability rollback first revokes live capabilities and retains their worktrees/logs as specified in the failure contract.

## Simulation Report

| Task | Check against disk/planned layer | Result | Action |
|---|---|---|---|
| 1 | Four validator paths do not exist; tier-1 auto-discovers new `.sh` files | PASS CREATE | Create fixtures before implementation. |
| 2 | All five MODIFY targets exist; new operation-scope module does not | PASS | Reuse exact Git helpers from worktree guard, then make guard consume shared module. |
| 3 | wi-claim, resolve-wi, and bootstrap exist; v2 schemas/store/CLI do not | PASS | Preserve v1 adapter and explicit migration boundary. |
| 4 | Existing execute/dispatch contracts and worker exist; new execution/delegation modules do not | PASS | Keep WI-level planner/validator behavior separate. |
| 5 | Eight host manifests and both knowledge files exist; containment/host validators do not | PASS | Probe capability before marking any host supported. |
| 6 | DOCTRINE, WORKTREES, FRAMEWORK-STATE, install drift, and existing validators exist | PASS | Synchronize only after executable contracts stabilize. |
| 7 | Root has no package manager; canonical Tier-1 and manifest/pipeline validators exist | PASS | No dependency install step required. |

### Scenario Coverage

| Journey | Scenario | Implementing tasks | Coverage |
|---|---|---|---|
| J-FW-05 | S7–S12 prior authority/bootstrap/compatibility | 2, 3, 6 | Regression-preserved |
| J-FW-05 | S13 operation scope | 1, 2 | complete |
| J-FW-05 | S14 handover/generation | 1, 3 | complete |
| J-FW-05 | S15 child scope/merge | 1, 4, 5 | complete |
| J-FW-05 | S16 shell guardrail/containment | 1, 2, 5, 6 | complete |

## Promotion Readiness Checklist

- [x] Architectural invariants and full cross-cutting entry-point universe recorded.
- [x] Every planned file assigned to one task or planning/review state.
- [x] Every OS/SB/AU/DG AC family maps to task and test ownership.
- [x] Every task has an exact validation command and checkpoint.
- [x] New files are in the planned layer; every MODIFY path exists on disk.
- [x] External state taxonomy walked with lifecycle wiring.
- [x] Execution is deliberately single-controller until delegation is proven.
- [x] No browser/UI parity ledger is required for this headless Enabler.
- [x] Simulation has no unresolved FAIL or WARN.
- [x] Three canonical Fable rounds completed and every finding dispositioned in review-log.yaml.
- [ ] Final diff contains only this manifest's file universe.

## Review Convergence

All three rounds used the owner-requested `fable-high` profile. Scores progressed 6 → 7 → 8, with no Critical findings in any round and no High findings in round 3. The bounded final-round dispositions are integrated here: external runtime evidence, mechanically idempotent task resume, explicit created-file rollback, post-commit redirect, stable red-contract markers, and documented stdin receipt emission. The three-round protocol is exhausted; `review-log.yaml` is the terminal disposition record and no fourth adversarial plan round is permitted.
