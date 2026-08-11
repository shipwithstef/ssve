# WI-489 Changeset: Truthful reviewer protocol and runtime routing

- **Spec:** `docs/specs/features/wi-489-reviewer-runtime-routing.md`
- **Diagnosis:** `docs/specs/bugfix/wi-489-reviewer-runtime-routing-brief.md`
- **Technical contract map:** `docs/specs/contract-maps/wi-489-reviewer-runtime-routing.md`
- **Branch:** `framework-WI-489-reviewer-routing-correction`
- **Worktree:** `.worktrees/framework-WI-489-reviewer-routing-correction`
- **Owner session:** `019f65ab-11b7-7db0-a6fe-a85fea90d525`
- **Lane:** framework
- **Delivery tier:** FULL
- **Archetype:** architectural change
- **Planning mode:** invariants and blast radius before task scheduling
- **Execution mode:** inline
- **Planning reasoning:** high
- **Execution reasoning:** medium
- **Base:** `origin/main` at `4d230174c0e1bda200c6bb820f18fbe88cc97aac`
- **Status:** EXECUTION-IN-PROGRESS (plan simulation complete)
- **Created:** 2026-07-16
- **Preserved preflight residue:** immutable stash commit `372699e5c001383e55f75a911d87149b5f0518f8` (currently `stash@{2}`), message `preserve-preflight-residue-before-WI-488-WI-486-WI-487-2026-07-15`; never drop, restore, overwrite, or include it. Preserve background stashes `5b471b6491b16d53eccbb3d9bd8a94cc8a40d6f0` and `a5acdf1e1e926660b15a5f167063f54bca7f027f` as well.

**Lifecycle authority:** after live WI-488 failures, the owner explicitly ordered immediate runtime repair and real provider canaries before another framework ceremony. This is therefore an owner-authorized retro-planning correction: existing executable edits are not represented as pre-execution work. The frozen-diff independent review, gate, audit, full-suite, land, and promoted verification remain blocking.

## Implementation Summary

Correct the promoted canonical launcher so one Claude process can finish a schema protocol within four agentic turns, structured turn exhaustion is named, and Anthropic's same-conversation Fable-to-Opus safeguard route is receipted without a second Opus call. Move reviewer policy into versioned registry data, schedule Opus 4.8/high from `2026-07-19T21:00:00Z`, and provide secure launcher-managed local selection/status/clear operations for explicitly restoring Fable 5/high. Pin the OpenAI route to exact `gpt-5.6-sol/high`, distinguish requested acceptance from server observation, embed the reviewed worktree's framework contract in the content-addressed package, and replace active Gemini/direct-AGY research calls with one sandboxed canonical AGY boundary.

### Invariants

| Invariant | Required outcome |
|---|---|
| Canonical transport | Every active independent-review consumer enters through `scripts/run-external-review.mjs` and sends the package on stdin |
| Claude-orchestrated route | Exact `gpt-5.6-sol/high`, read-only/ephemeral/config isolated, no fallback; no server-observation claim when Codex JSONL omits identity |
| Codex-orchestrated schedule | Fable 5/high before cutover; Opus 4.8/high at/after cutover unless a valid explicit Fable selection is active |
| Effort ceiling | Fable and primary Opus never exceed high; WI-488 Opus/xhigh remains only the separate eligible-availability fallback |
| Provider-route truth | Same-process Fable-to-Opus safety routing is distinct from launcher fallback, emits no second Opus, and is non-reusable for Fable-primary demand |
| Failure boundary | Schema-turn, provider-safety, schema, auth, quota, network, timeout, and mismatch failures never trigger launcher fallback |
| Isolation/auth | Claude remains safe/tool-free/MCP-free/plan/non-persistent/bounded and keeps OAuth/keychain compatibility; inherited refusal/model remaps are scrubbed without exposing secrets |
| Receipt/cache integrity | Receipt v2 semantically binds policy, protocol, route, tuples, effort provenance, fallback, and cache; only exact-primary no-fallback equality is reusable |
| Framework intelligence | Content-addressed packages embed exact target AGENTS/CLAUDE instructions plus applicable review skills/rules; ambient installed skills are not authority |
| Research inference | One canonical AGY wrapper accepts stdin, bridges through a private file because AGY lacks stdin prompt support, uses sandbox/plan/time bounds, and removes active Gemini/direct-spawn paths |
| Spend control | One process is one primary invocation; the primary is the probe; Tier 1 uses fake binaries and makes zero paid calls |
| Dependency boundary | WI-486 stays paused and WI-487 remains untouched until WI-489 is merged and promoted-verified |

### Affected entry-point universe

| Family | Count | Entries | Disposition |
|---|---:|---|---|
| Canonical executable boundary | 1 | `scripts/run-external-review.mjs` | Add policy/state/protocol/route/receipt/cache behavior |
| Policy compatibility view | 1 | `scripts/resolve-adversarial-reviewer.sh` | Delegate to launcher status; remove duplicated tuples |
| Tracked policy authority | 1 | `references/model-registry.json.externalReviewPolicy` | Add profiles, UTC schedule, fallback rules, and local-state contract |
| Receipt schema | 1 | `schemas/external-review-receipt.schema.json` | Evolve to v2; findings schema remains v1-compatible |
| Active review contracts with static policy prose | 5 | `review-plan`, `review-exec`, `review-cross-model`, `references/plan-review-protocol.md`, `CLAUDE.md` | Describe profile resolution and route truth without consumer-local policy |
| Active direct adapters | 3 | plan adapter plus blind/prompt floor judges | Bind the target repository context root explicitly |
| Research inference boundary | 3 consumers + 1 launcher | `dispatch-agy.mjs`, `synthesize-meaning.mjs`, `spine-research.mjs`, `research/SKILL.md` | Canonical safe AGY transport; no direct Gemini/AGY consumer spawn |
| Fixture/runtime validators | 2 | external-review and AGY launcher validators | Add protocol, route, attestation, package-context, safe-transport, and call-count matrices |
| Opt-in live proof | 1 | `scripts/run-live-model-canary.mjs` | Disabled-by-default real auth/model/output checks for sol, Fable, Opus, and AGY |
| Runtime local state | 2 roots | `.svc/external-review-policy/v1`, `.svc/external-review-cache` | Ignore selection state; version/cache semantics enforce lifecycle |

No affected executable or active contract entry point is deferred.

## Files Planned

| File | Action | Task | Purpose |
|---|---|---|---|
| `test-framework/evals/tier-1/validate-external-review-launcher.sh` | MODIFY | task-1, task-5 | Write protocol-faithful failing fixtures first, then finalize parity/inventory assertions |
| `schemas/external-review-receipt.schema.json` | MODIFY | task-2 | Receipt v2 policy/protocol/route/effective-effort contract |
| `references/model-registry.json` | MODIFY | task-2 | Sole versioned profile, cutover, fallback, and state-policy authority |
| `.gitignore` | MODIFY | task-2 | Exclude launcher-managed local profile selection state |
| `scripts/run-external-review.mjs` | MODIFY | task-3a | Policy/status/selection, four-turn protocol, route attestation, receipt semantics, cache rules |
| `scripts/review-plan-codex.sh` | MODIFY | task-3a | Pass the reviewed target repository root to the canonical launcher explicitly |
| `scripts/blind-floor-judge.sh` | MODIFY | task-3a | Pass the reviewed target repository root to the canonical launcher explicitly |
| `scripts/prompt-floor-judge.sh` | MODIFY | task-3a | Pass the reviewed target repository root to the canonical launcher explicitly |
| `research/scripts/dispatch-agy.mjs` | MODIFY | task-3b | Sole sandboxed plan-mode research launcher with private-file stdin bridge and actionable receipts |
| `research/scripts/synthesize-meaning.mjs` | MODIFY | task-3b | Remove direct AGY spawn and consume canonical launcher through stdin |
| `scripts/spine-research.mjs` | MODIFY | task-3b | Remove Gemini CLI inference and consume canonical AGY launcher |
| `scripts/run-live-model-canary.mjs` | CREATE | task-5 | Explicitly paid, disabled-by-default live proof for four routes |
| `test-framework/evals/tier-1/validate-agy-launcher.sh` | CREATE | task-1, task-5 | Fixture-only AGY transport, isolation, cleanup, and migration proof |
| `research/SKILL.md` | MODIFY | task-4 | Remove stale Gemini research-primary language |
| `scripts/resolve-adversarial-reviewer.sh` | MODIFY | task-3a | Delegate compatibility output to canonical policy status |
| `review-plan/SKILL.md` | MODIFY | task-4 | Consume scheduled/explicit profiles and truthful receipt route |
| `review-exec/SKILL.md` | MODIFY | task-4 | Remove hardcoded Fable default and document provider-route semantics |
| `review-cross-model/SKILL.md` | MODIFY | task-4 | Keep canonical invocation while documenting resolved primary/fallback distinction |
| `references/plan-review-protocol.md` | MODIFY | task-4 | Shared policy/status/route/receipt protocol |
| `CLAUDE.md` | MODIFY | task-4 | Replace stale static Codex-orchestrated tuple summary |
| `docs/specs/features/wi-489-reviewer-runtime-routing.md` | MODIFY | task-5 | Mark all 66 ACs with implementation/verification evidence |
| `docs/specs/features/test-evidence/WI-489/PROVIDER_FIDELITY_EVIDENCE.md` | MODIFY | task-5 | Finalize one real canonical Fable/high proof |
| docs/specs/test-evidence/WI-489/pre-post-evidence.json | CREATE | task-5 | Machine-readable before/after protocol and route proof |
| docs/specs/test-evidence/WI-489/post-change-tier1-frozen.md | CREATE | task-5 | Honest frozen full-suite identity comparison |
| docs/specs/reviews/wi-489-plan-review.md | CREATE-EVIDENCE | task-5 | Independent high-reasoning plan review and convergence |
| docs/specs/reviews/wi-489-exec-cross-model.md | CREATE-EVIDENCE | task-5 | Frozen-diff review attempts and dispositions |
| docs/specs/reviews/wi-489-security-review.md | CREATE-EVIDENCE | task-5 | Selection/env/receipt/cache security review |
| docs/specs/reviews/wi-489-g5-review-gate.md | CREATE-EVIDENCE | task-5 | G5 decision on one frozen diff |
| docs/specs/audit/wi-489-reviewer-runtime-routing-analysis.md | CREATE-EVIDENCE | task-5 | Full AC-traced audit and convergence |
| docs/plans/2026-07-16-wi489-reviewer-runtime-routing/progress.md | CREATE-UPSTREAM then MODIFY | review-plan, task-1..5 | Commit the initial ledger with planning authority, then append red/green checkpoints and frozen-diff hash |
| `docs/plans/2026-07-16-wi489-reviewer-runtime-routing/manifest.md` | CREATE-UPSTREAM | review-plan | Canonical SIMULATED implementation authority consumed by mechanical review and execution |
| docs/plans/2026-07-16-wi489-reviewer-runtime-routing/review-log.yaml | CREATE-EVIDENCE | review-plan | Structured plan findings and convergence |
| docs/plans/2026-07-16-wi489-reviewer-runtime-routing/receipt.json | CREATE-EVIDENCE | review-plan | Chain plan-manifest schema v3 receipt body governed by `schemas/receipts/plan-manifest.schema.json`, distinct from external-review invocation receipt v2 |
| `docs/specs/work-items/WI-489.md` | MODIFY | task-5 | Advance lifecycle only after matching receipts |
| `docs/specs/work-items/INDEX.md` | MODIFY | task-5 | Keep WI state synchronized |
| `FRAMEWORK-STATE.md` | MODIFY | task-5 | Record corrected reviewer architecture and verified policy behavior |
| `.svc/lane-tasks-WI-489.json` | MODIFY | all | Cross-host task, phase, and mandatory-chain state |
| `.svc/pipeline-decisions.jsonl` | MODIFY | all | Append architecture, plan, review, execution, gate, land, and verification decisions |
| `.svc/session-contract.jsonl` | PRESERVE | all | Preserve exact WI/session/worktree binding; append only through sanctioned session tooling |
| WI-489 diagnosis, research, proposal, decisions, contract-map, and baseline evidence already created in this branch | CREATE-UPSTREAM | review-plan | Commit the accepted planning authority and preserved reproduction evidence before executable task-1 |

### Changeset Blueprint

Skipped because execution mode is `inline`: the same orchestrator that loaded the baselined spec and design will implement this manifest. File inventory, dependency order, AC coverage, validation, and rollback remain mandatory.

## Task Graph

```json
{"tasks":[
  {"id":"task-1","title":"Write protocol-faithful failing fixtures","blocked_by":[]},
  {"id":"task-2","title":"Evolve reviewer policy and receipt contracts","blocked_by":["task-1"]},
  {"id":"task-3a","title":"Implement canonical reviewer policy, protocol, route, receipt, and cache runtime","blocked_by":["task-2"]},
  {"id":"task-3b","title":"Migrate research inference to the canonical safe AGY boundary","blocked_by":["task-2"]},
  {"id":"task-4","title":"Synchronize active review contracts with canonical runtime policy","blocked_by":["task-3a","task-3b"]},
  {"id":"task-5","title":"Run real provider proof, freeze the diff, and close implementation evidence","blocked_by":["task-4"]}
]}
```

| Task | Files | AC coverage | Validation | Checkpoint |
|---|---|---|---|---|
| task-1 | targeted Tier-1 validators, planning artifacts/progress | EXTREV-70–135 test expectations | `bash -n`; fake PATH proves zero paid calls, exact failure branches, and AGY transport | `wi489-protocol-fixtures-red` |
| task-2 | receipt schema, registry policy, gitignore | EXTREV-93–115, 124–128 | JSON parse; registry, attestation, package-context, secure-state, and clock fixtures | `wi489-policy-contracts` |
| task-3a | canonical review runtime and resolver | EXTREV-70–115, 124–128 | Node/bash syntax; launcher fixture replay; policy/resolver parity | `wi489-review-runtime` |
| task-3b | AGY runtime and research consumers | EXTREV-129–133 | Node syntax; AGY fixture replay; active Gemini/direct-spawn inventory | `wi489-agy-runtime` |
| task-4 | active review/research contract surfaces | EXTREV-105, 106, 115, 121, 127–133 | active-source inventory, obsolete-policy grep, Markdown/frontmatter/skill validators | `wi489-consumer-contracts` |
| task-5 | fixture completion, live canaries, real Fable review, spec/state/evidence | EXTREV-116–135 plus final proof for all | targeted replay; provider fidelity; opt-in live proof; graph/receipt/Markdown/JSONL checks; diff check; full Tier 1 | `wi489-frozen-candidate` |

The two runtime tasks are independent after the shared contract task and converge before consumer synchronization. The fixture contract must exist before runtime code; schemas/policy must stabilize before either runtime; active documentation must consume both implemented surfaces; real provider proof and frozen evidence come last.

## AC-to-Task and AC-to-Test Mapping

| AC | Task | Test type | Exact proof |
|---|---|---|---|
| EXTREV-70 | 1,3a,5 | E2E fixture | Claude argv capture equals `--max-turns 4` |
| EXTREV-71 | 1,3a | E2E fixture | one process ledger entry with outer `num_turns>1` |
| EXTREV-72 | 1,3a | E2E fixture | intermediate schema boundary then valid turn-two findings |
| EXTREV-73 | 1,3a | Unit/replay | structured subtype/terminal fields map to `schema_turn_budget` |
| EXTREV-74 | 2,3a | Schema/replay | receipt protocol fields equal reported fixture values |
| EXTREV-75 | 1,3a | E2E fixture | schema-turn failure call ledger contains no Opus spawn |
| EXTREV-76 | 1,3a | E2E fixture | structured max-turn terminal maps to `schema_turn_budget` in one process; provider-reported turn count remains an independent metric |
| EXTREV-77 | 1,3a | Argv/timer fixture | timeout and dollar bounds remain around whole process |
| EXTREV-78 | 1,3a | Call-count fixture | primary call is first paid-capable process; no smoke call |
| EXTREV-79 | 2,3a | Policy/argv fixture | `fable-high` resolves exact full id and high |
| EXTREV-80 | 1,3a | Negative argv fixture | no `--fallback-model` on Fable primary |
| EXTREV-81 | 1,3a | Settings/env fixture | switching true and disable-refusal variable absent in child |
| EXTREV-82 | 1,3a | Env/argv fixture | inherited model remaps scrubbed; exact argv model retained |
| EXTREV-83 | 1,3a | Route replay | controlled envelope plus same-process exact Opus usage accepted |
| EXTREV-84 | 1,3a | Negative route replay | missing envelope evidence returns `model_mismatch` |
| EXTREV-85 | 2,3a | Receipt fixture | route kind equals `provider_safety_route` and causation evidence is envelope-inferred |
| EXTREV-86 | 2,3a | Receipt fixture | requested/invoked Fable and effective Opus remain distinct |
| EXTREV-87 | 2,3a | Receipt fixture | effective effort null with provider-managed provenance |
| EXTREV-88 | 1,3a | Call-count fixture | routed success has one Claude process only |
| EXTREV-89 | 1,3a | Cache replay | provider-route receipt is rejected for Fable cache hit |
| EXTREV-90 | 1,3a | Cache replay | next Fable demand invokes a fresh primary process |
| EXTREV-91 | 1,3a | Model matrix | unexpected usage model hard-fails as mismatch |
| EXTREV-92 | 1,3a | Failure replay | safeguard block without findings is provider-safety failure, no fallback |
| EXTREV-93 | 1,2,3a | Clock fixture | instant before cutover resolves `fable-high` |
| EXTREV-94 | 1,2,3a | Clock fixture | exact/after cutover resolves `opus-high` |
| EXTREV-95 | 2,3a | Receipt fixture | UTC and Sofia-local cutover renderings agree |
| EXTREV-96 | 2,3a | Policy/argv fixture | `opus-high` invokes exact Opus 4.8/high |
| EXTREV-97 | 1,2,3a | Tuple fixture | scheduled Opus is primary/high, fallback false |
| EXTREV-98 | 1,2 | Registry validator | Fable profile above high is rejected |
| EXTREV-99 | 1,3a | Zero-spawn fixture | policy status outputs fields with no stdin/cache/provider use |
| EXTREV-100 | 1,3a | Selection fixture | one canonical command activates Fable without tracked edit |
| EXTREV-101 | 1,3a | Security fixture | symlink/uid/file-mode/directory-mode/schema/provenance/hash cases fail closed |
| EXTREV-102 | 2,3a | Schema fixture | receipt policy object includes every selection field |
| EXTREV-103 | 1,3a | Zero-spawn fixture | invalid/expired/foreign state stops before cache/provider |
| EXTREV-104 | 1,3a | Clock/state replay | clear/expiry returns to scheduled profile |
| EXTREV-105 | 1,2,4 | Policy/inventory | Claude route remains exact Codex 5.6 sol/high/no fallback |
| EXTREV-106 | 2,4 | Content validator | no pricing/entitlement forecast appears in policy/status prose |
| EXTREV-107 | 2,3a | JSON Schema | receipt v2 requires policy/protocol/route/provenance |
| EXTREV-108 | 1,2,3a | Route matrix | every route/source combination is distinguishable |
| EXTREV-109 | 1,3a | Forged receipt replay | contradictory tuple/route/fallback/profile is rejected |
| EXTREV-110 | 1,3a | Forged cache replay | lookup reruns semantic validator before hit |
| EXTREV-111 | 1,3a | Cache replay | exact-primary no-fallback equality is the only reusable state |
| EXTREV-112 | 1,3a | Artifact/cache replay | provider/fallback receipts persist but cache says non-reusable |
| EXTREV-113 | 1,3a | Diagnostic fixture | each new failure names one recovery path |
| EXTREV-114 | 1,3a | Redaction fixture | injected secret markers absent from receipt/stdout/stderr diagnostic |
| EXTREV-115 | 1,2,3a,4 | Parity fixture | registry, launcher status, shell resolver, receipt agree at frozen clock |
| EXTREV-116 | 1 | Protocol fixture | fake Claude emits an intermediate schema boundary |
| EXTREV-117 | 1,5 | Harness guard | scrubbed fake PATH and invocation ledger prove zero paid calls |
| EXTREV-118 | 1,3a | Protocol matrix | two-turn success plus both exhaustion paths pass |
| EXTREV-119 | 1,3a | Route matrix | route/provenance/model/call/cache branches pass |
| EXTREV-120 | 1,2,3a | Clock/state matrix | schedule and complete selection lifecycle pass |
| EXTREV-121 | 3a,4,5 | Inventory/syntax validator | all active adapters name the canonical launcher, pass target context explicitly, and parse |
| EXTREV-122 | 5 + review-exec | Manual bounded provider proof | one real canonical explicit Fable/high frozen-diff review and finalized evidence; same-process safety-routed Opus satisfies it only when requested/invoked remain Fable/high, findings validate, route truth is receipted, and no second Opus starts |
| EXTREV-123 | 5 | Promoted E2E | targeted and full Tier-1 rerun from promoted `origin/main` |
| EXTREV-124 | 1,2,3a,4 | Inventory/argv fixture | exact `gpt-5.6-sol/high` and zero active legacy pins |
| EXTREV-125 | 1,2,3a | Attestation fixture | no-echo success is requested-accepted; contradiction hard-fails |
| EXTREV-126 | 1,2,3a | ModelUsage fixture | primary plus allowed Haiku is server-observed; other models fail |
| EXTREV-127 | 1,2,3a | Package/adapter fixture | target instructions and applicable framework contracts are embedded with hashes; every adapter passes the target root explicitly |
| EXTREV-128 | 1,3a | Negative package fixture | missing target contract fails before provider work |
| EXTREV-129 | 1,3b | AGY launcher fixture | every research consumer enters canonical wrapper through stdin |
| EXTREV-130 | 1,3b | Large-package fixture | private file transport avoids argv limit and cleans up on success/failure |
| EXTREV-131 | 1,3b | AGY argv/failure fixture | sandbox/plan/model/timeouts/streams and actionable receipt |
| EXTREV-132 | 1,3b,4 | Source inventory | no direct AGY/Gemini spawn or dangerous bypass remains in consumers |
| EXTREV-133 | 4,5 | Install inventory | Gemini host adapter remains independent from inference routing |
| EXTREV-134 | 5 | Opt-in live canary | four routes validate auth/output and exposed model identity without fallback |
| EXTREV-135 | 1,5 | Constant/summary fixture | live bound remains separate from 1200-second review default |

No AC is N/A. EXTREV-122 is the canonical paid review proof; EXTREV-134 is a separately owner-authorized hello-world canary. Both are opt-in and every branch around them has deterministic fake-provider coverage.

## Prerequisite Alignment Matrix

| Prerequisite | Status | Trace |
|---|---|---|
| UX transitions | N/A | Headless operator/status journey and route state machine are in the baselined spec |
| UI tokens/assets | N/A | No browser-visible or visual file is planned |
| Technical design | satisfied | baselined spec plus WI-489 system contract map and G4 log |
| Style contract | satisfied | zero-dependency ESM launcher, portable Bash compatibility adapter, draft-07 schemas, and existing Tier-1 Bash fixture conventions |
| Persona/competitive differentiation | N/A | Internal framework transport with no user/admin persona or competitive surface; industry-grounding validator passes the explicit inapplicable branch |
| Provider fidelity | required | `docs/specs/features/test-evidence/WI-489/PROVIDER_FIDELITY_EVIDENCE.md` must be finalized before landing |
| Provider capability | satisfied for planning | installed Claude Code 2.1.211 accepts the four-turn safe/schema parser surface; implementation still performs fail-closed capability validation |
| Deprecated foundation | satisfied | registry fresh and launcher scan reports no deprecated foundation |
| route-workflow | satisfied | `.svc/lane-tasks-WI-489.json` task 1 phase receipts plus `.svc/route-workflow-WI-489.log` |
| improve-framework | satisfied | graph task 2 plus `proposals/2026-07-16-framework-improvement-reviewer-runtime-routing.md` |
| research | satisfied | graph task 16 plus `docs/specs/research-log.md` and refreshed agent-harness knowledge artifacts |
| diagnose-bug | satisfied | graph task 3 plus `docs/specs/bugfix/wi-489-reviewer-runtime-routing-brief.md` and the WI-486 reproduction |
| write-spec | satisfied | graph task 4 plus `docs/specs/features/wi-489-reviewer-runtime-routing.md` |
| design-tech | satisfied | graph task 5 plus BASELINED technical design, contract map, decisions, and G4 log |

## Validation Plan

### Task-level commands

```bash
bash -n test-framework/evals/tier-1/validate-external-review-launcher.sh
node -e 'JSON.parse(require("fs").readFileSync("schemas/external-review-receipt.schema.json","utf8")); JSON.parse(require("fs").readFileSync("references/model-registry.json","utf8"))'
node --check scripts/run-external-review.mjs
node --check research/scripts/dispatch-agy.mjs
node --check research/scripts/synthesize-meaning.mjs
node --check scripts/spine-research.mjs
node --check scripts/run-live-model-canary.mjs
bash -n scripts/resolve-adversarial-reviewer.sh
bash -n scripts/review-plan-codex.sh scripts/blind-floor-judge.sh scripts/prompt-floor-judge.sh
bash test-framework/evals/tier-1/validate-external-review-launcher.sh
bash test-framework/evals/tier-1/validate-agy-launcher.sh
bash test-framework/evals/tier-1/validate-review-plan-readonly.sh
node scripts/validate-system-contract-map.mjs --map docs/specs/contract-maps/wi-489-reviewer-runtime-routing.md
node scripts/task-graph.mjs validate .svc/lane-tasks-WI-489.json
node scripts/validate-task-graph-lane.mjs .svc/lane-tasks-WI-489.json

checkpoint_task() {
  task="$1"
  object="$(git stash create "WI-489 ${task} checkpoint")"
  if test -z "$object"; then object="$(git rev-parse HEAD)"; fi
  git update-ref "refs/svc/checkpoints/WI-489/${task}" "$object"
  git rev-parse "refs/svc/checkpoints/WI-489/${task}"
}
node scripts/lint-skills-manifest.mjs
bash test-framework/evals/tier-1/validate-skill-structure.sh
bash test-framework/evals/tier-1/validate-contracts.sh
bash test-framework/evals/tier-1/validate-chain-references.sh
node test-framework/evals/tier-1/validate-markdown-ast.mjs
node test-framework/evals/tier-1/validate-frontmatter-ast.mjs
node scripts/validate-work-item-metadata.mjs docs/specs/work-items/WI-489.md
bash test-framework/evals/tier-1/validate-industry-grounding-section.sh
bash test-framework/evals/tier-1/validate-spec-compensating-control.sh
bash scripts/verify-plan-mechanical.sh docs/plans/2026-07-16-wi489-reviewer-runtime-routing/manifest.md
git diff --check
```

Proposal lifecycle and JSONL validators run because the branch includes proposal and append-only state artifacts. Chain receipts validate at the staged tree and again on committed `HEAD`. The provider-fidelity evidence validator, if concern tooling exposes a named command, runs after the one real review; otherwise the plan's exact required-field table and independent review disposition are mechanically checked by the targeted fixture/inventory gate.

### Full branch and promoted policy

```bash
bash test-framework/evals/run-all-evals.sh
```

The clean-main pre-change baseline at the same base is 242 passed and 2 failed: proposal-triage debt and session-contract freshness. The dirty WI-489 planning snapshot also had 242/2, but its second failure was no-svc-residue instead of freshness because the new graph was untracked. Neither set is called passing; exact identities are pinned in `docs/specs/test-evidence/WI-489/pre-change-tier1-baseline.md`.

The decision rule is mechanical:

- before the planning-authority commit, `proposal-triage-debt` and `no-svc-residue` are the only acknowledged dirty-tree identities;
- after that commit, `no-svc-residue` is forbidden;
- the frozen implementation candidate and final committed HEAD must have zero failures after proposal/state lifecycle updates;
- any other identity at any point is a regression and blocks review/landing.

Promoted `origin/main` must again report zero focused-suite and full Tier-1 failures before WI-486 resumes.

## Execution Command Sequence

```bash
test "$(git rev-parse --abbrev-ref HEAD)" = "framework-WI-489-reviewer-routing-correction"
git merge-base --is-ancestor 4d230174c0e1bda200c6bb820f18fbe88cc97aac HEAD
node scripts/task-graph.mjs validate .svc/lane-tasks-WI-489.json
node scripts/validate-task-graph-lane.mjs .svc/lane-tasks-WI-489.json

checkpoint_task() {
  task="$1"
  object="$(git stash create "WI-489 ${task} checkpoint")"
  if test -z "$object"; then object="$(git rev-parse HEAD)"; fi
  git update-ref "refs/svc/checkpoints/WI-489/${task}" "$object"
  git rev-parse "refs/svc/checkpoints/WI-489/${task}"
}

# task-1: write fixture expectations before runtime implementation
bash -n test-framework/evals/tier-1/validate-external-review-launcher.sh
# Expected RED is recorded in progress.md; fixture PATH must contain only fake provider binaries.
checkpoint_task task-1

# task-2: policy and receipt contracts
node -e 'JSON.parse(require("fs").readFileSync("schemas/external-review-receipt.schema.json","utf8")); JSON.parse(require("fs").readFileSync("references/model-registry.json","utf8"))'
checkpoint_task task-2

# task-3a: canonical reviewer runtime
node --check scripts/run-external-review.mjs
bash -n scripts/resolve-adversarial-reviewer.sh
bash -n scripts/review-plan-codex.sh scripts/blind-floor-judge.sh scripts/prompt-floor-judge.sh
bash test-framework/evals/tier-1/validate-external-review-launcher.sh
checkpoint_task task-3a

# task-3b: canonical AGY research runtime
node --check research/scripts/dispatch-agy.mjs
node --check research/scripts/synthesize-meaning.mjs
node --check scripts/spine-research.mjs
bash test-framework/evals/tier-1/validate-agy-launcher.sh
checkpoint_task task-3b

# task-4: consumer contracts
bash test-framework/evals/tier-1/validate-review-plan-readonly.sh
node test-framework/evals/tier-1/validate-markdown-ast.mjs
node test-framework/evals/tier-1/validate-frontmatter-ast.mjs
checkpoint_task task-4

# task-5: freeze candidate and prepare the normal independent review
SVC_ALLOW_PAID_MODEL_CANARY=1 node scripts/run-live-model-canary.mjs --timeout-seconds 120
node scripts/run-external-review.mjs --select-profile fable-high --reason "WI-489 bounded provider-fidelity verification"
node scripts/run-external-review.mjs --policy-status --orchestrator codex
bash test-framework/evals/tier-1/validate-external-review-launcher.sh
node scripts/task-graph.mjs validate .svc/lane-tasks-WI-489.json
node scripts/validate-task-graph-lane.mjs .svc/lane-tasks-WI-489.json
git diff --check
bash test-framework/evals/run-all-evals.sh

# review-exec: one paid provider-fidelity review of the frozen implementation diff
ARTIFACTS=.svc/external-review-artifacts/WI-489/provider-fidelity
node scripts/run-external-review.mjs --orchestrator codex --review-kind exec --artifacts-dir "$ARTIFACTS" < .svc/review-cross-model-package.md
node -e 'const r=require("./"+process.argv[1]),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),effortOk=r.effective_effort.provenance==="provider-managed"?r.effective_effort.value===null:r.effective_effort.provenance==="runtime"&&r.effective_effort.value!==null;if(r.requested_tuple.model!=="claude-fable-5"||r.requested_tuple.effort!=="high"||r.invocation_tuple.model!=="claude-fable-5"||r.invocation_tuple.effort!=="high"||r.fallback.used||!["explicit_profile_primary","provider_safety_route"].includes(r.route.kind)||r.protocol.process_invocations!==1)process.exit(1);if(r.route.kind==="provider_safety_route"&&(r.effective_tuple.model!=="claude-opus-4-8"||r.route.evidence!=="provider_model_usage_envelope_inferred"||!effortOk))process.exit(1);if(r.route.kind==="explicit_profile_primary"&&!same(r.requested_tuple,r.effective_tuple))process.exit(1)' "$ARTIFACTS/receipt.json"
node scripts/run-external-review.mjs --clear-profile-selection --reason "WI-489 provider-fidelity verification complete"
node scripts/run-external-review.mjs --policy-status --orchestrator codex | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const s=JSON.parse(d);if(s.selection!==null||s.profile_source!=="schedule")process.exit(1);process.stdout.write(JSON.stringify(s)+"\n")})'
```

`RECOVERY_IF_FAIL`: keep the isolated worktree and all artifacts. Reset no user state. Correct only the current task, rerun its focused tests, then replay every downstream task. A policy/schema/public CLI change invalidates tasks 3–5. A provider capability or auth failure is a genuine external blocker only after the launcher emits its actionable receipt; do not substitute a model, effort, invocation path, or local-only proof. After any successful or failed bounded provider-fidelity attempt, record its receipt/status and unconditionally clear the verification-only Fable selection before promoted verification. A provider-safety-routed completion satisfies EXTREV-122 only under the exact post-condition asserted above; it never authorizes a retry merely to obtain an exact-Fable effective model.

Clock behavior is explicit: production status and receipts use the real wall-clock instant and therefore legitimately change at `2026-07-19T21:00:00Z`; fixture-only `SVC_EXTERNAL_REVIEW_NOW` injection is accepted only when `SVC_EXTERNAL_REVIEW_FIXTURE=1`. The invocation instant is always receipted. Real Opus/high transport is not separately probed before cutover because that would add a paid call; deterministic fixtures prove its argv/receipt route, and the first normal post-cutover review is the live detection point. Any live failure follows the launcher's actionable hard-failure contract.

The reviewed planning authority and its plan/review receipts are committed once before execute-changeset starts. Executable tasks 1–5 then remain one aggregate uncommitted implementation tree until task-5 freezes the diff; the checkpoint refs above provide non-mutating restoration anchors without adding intermediate implementation commits or touching the protected stash list. Review findings reopen the implementation, require a new hash, and repeat review-exec, review-security, review-gate, audit, and full validation. The final implementation commit carries the remaining emitted chain receipts and the repository-author/active-orchestrator co-author trailer. No verification bypass, force operation, protected-stash mutation, or destructive reset is allowed.

## Checkpoint Plan

| Order | Checkpoint | Rollback anchor | Required proof |
|---:|---|---|---|
| 1 | `wi489-protocol-fixtures-red` | planning-authority HEAD plus `refs/svc/checkpoints/WI-489/task-1` tree object | fake-only harness syntax and expected failing protocol/route/profile assertions |
| 2 | `wi489-policy-contracts` | `refs/svc/checkpoints/WI-489/task-2` tree object | schemas and registry parse; schedule/state semantic matrix |
| 3 | `wi489-review-runtime` | `refs/svc/checkpoints/WI-489/task-3a` tree object | full targeted launcher replay and resolver parity |
| 4 | `wi489-agy-runtime` | `refs/svc/checkpoints/WI-489/task-3b` tree object | AGY transport/failure replay and consumer-spawn inventory |
| 5 | `wi489-consumer-contracts` | `refs/svc/checkpoints/WI-489/task-4` tree object | active-source inventory and documentation validators |
| 6 | `wi489-frozen-candidate` | final frozen tree hash | real Fable evidence, receipts/graph/diff/full-suite policy, frozen hash |

After each task 1–4, `git stash create "WI-489 task-N checkpoint"` creates a tree/commit object without changing the working tree or protected stash list; on a clean tree the helper records `HEAD` instead of failing. `git update-ref refs/svc/checkpoints/WI-489/task-N <object>` makes the anchor durable. The exact ref is recorded in `progress.md`. Rollback uses the named object as source-of-truth diff for an apply-patch restoration of only that task's planned tracked files; `progress.md` is already tracked by the planning-authority commit and is therefore included. It never uses destructive checkout/reset. These temporary refs are removed through framework hygiene only after promotion verification.

The implementation diff freezes after checkpoint 5. Review-exec, review-security, review-gate, and audit must evaluate the same hash; any accepted finding creates a new candidate and invalidates all old frozen-review receipts.

## External State

| # | Environment | What state | Coupling | Lifecycle wiring |
|---:|---|---|---|---|
| 3 | Out-of-tree version control | isolated branch/worktree, paused WI-486 worktree, later PR, three immutable preserved stash commits | coupled | session/claim binding; branch/base checks; land/verify chain; clean worktree/branch hygiene only after promotion; stashes never restored/dropped without new authority |
| ad-hoc Git checkpoint refs | `refs/svc/checkpoints/WI-489/task-1`, `task-2`, `task-3a`, `task-3b`, and `task-4` point at non-mutating `git stash create` objects or clean-tree `HEAD` | coupled | every ref/hash is recorded in progress; used only as apply-patch restoration evidence; deleted after promoted verification by hygiene closeout |
| 9 | Caches | `.svc/external-review-cache` exact-primary entries and locks | coupled | launcher version/schema/tuple key, receipt-v2 semantic hit validation, TTL/lock-safe GC, non-reusable route/fallback artifacts |
| 12 | Downstream framework artifacts | review skills, shared protocol, model registry, resolver view, host summary, WI docs/state | coupled | one planned inventory plus registry/resolver/launcher parity and Markdown/skill/graph validators |
| 14 | Authentication/secrets | existing Claude OAuth/keychain and `CODEX_HOME` auth are relied on, never mutated | decoupled-justified | isolation/env fixtures, secret redaction, capability/auth receipts, operator repairs login outside the repo then repeats the exact tuple |
| 15 | Runtime filesystem | secure local selection, temporary atomic-write files, provider events/stderr/findings/receipts | coupled | `.gitignore`; same-user regular-file/mode checks; canonical select/status/clear lifecycle; atomic rename; artifact paths in receipts; expiry/clear reverts to schedule |

Untouched environments (walked the taxonomy, found nothing): 1, 2, 4, 5, 6, 7, 8, 10, 11, 13.

Authentication is intentionally decoupled because the launcher consumes existing operator credentials but is not an auth installer. Drift is detected by free capability parsing and typed runtime authentication receipts; recovery never copies, logs, rotates, or deletes credentials. The explicit selection is local by design and safe because status is zero-cost, every invocation receipts its exact source/hash/expiry, and clear/expiry deterministically resumes the tracked schedule.

## Simulation Report

| Task | Check | Result | Action |
|---|---|---|---|
| task-1 | targeted validator exists and contains fake Claude/Codex PATH harness | PASS (MODIFY) | Add intermediate protocol and state-machine cases before runtime edits |
| review-plan | WI-489 planning/reproduction artifacts exist | PASS (CREATE-UPSTREAM) | Commit after reviewed plan/receipt lineage; executable task-1 starts from that clean HEAD |
| task-2 | receipt schema, registry, and `.gitignore` exist | PASS (MODIFY) | Evolve in place; no package dependency |
| task-2 | local selection path is currently not ignored | PASS (expected current state) | Add exact `.svc/external-review-policy/` ignore rule |
| task-3a | launcher exports current policy/invoke/cache functions in one ESM file | PASS (MODIFY) | Preserve zero-dependency Node core pattern |
| task-3a | resolver exists as Bash compatibility view with duplicate constants | PASS (MODIFY) | Replace constants with launcher status delegation |
| task-3a | installed Claude Code accepts safe/schema/settings parser surface | PASS | Keep runtime capability check fail-closed and anchor it with live CLI version/settings evidence |
| task-3b | existing research consumers directly invoke AGY/Gemini | PASS (MODIFY) | Replace both paths with the private-file canonical AGY boundary |
| task-4 | all five static policy/route contract surfaces exist | PASS (MODIFY) | Update only canonical-policy prose and commands |
| task-3a | three active adapters already use the canonical launcher but lack explicit target-context binding | PASS (MODIFY) | Pass the reviewed target root explicitly; syntax and package-context fixtures prove the binding |
| task-5 | provider-fidelity evidence file exists in pending design state | PASS (MODIFY) | Fill exact receipt/findings paths after normal real review |
| task-5 | work-item/index/framework state files exist | PASS (MODIFY) | Advance only with matching receipts |
| all | no UI, ORM, package, service, route, or database dependency | PASS | Corresponding prerequisite/migration work is N/A |
| rollback | planning HEAD plus per-task Git object refs mechanically preserve tracked task states | PASS | Apply-patch restoration uses exact object diffs; final merge rollback remains a normal revert |

### Scenario Coverage

| Journey | Scenario | Steps | Tasks | Coverage |
|---|---|---:|---|---|
| Headless spec journey | two-turn schema success | 5 | task-1, task-3a, task-5 | 5/5 |
| Headless spec journey | provider Fable-to-Opus safety route | 6 | task-1, task-3a, task-5 | 6/6 |
| Headless spec journey | eligible launcher availability fallback | 5 | task-1, task-2, task-3a | 5/5 |
| Headless spec journey | scheduled Opus cutover and explicit Fable selection | 6 | task-1, task-2, task-3a, task-5 | 6/6 |
| Headless spec journey | exact-primary cache hit and routed non-reuse | 5 | task-1, task-3a | 5/5 |
| Headless spec journey | large/failing research package through AGY | 5 | task-1, task-3b, task-5 | 5/5 |

Simulation: 17 PASS, 0 WARN, 0 FAIL. No unresolved product question, import, dependency, capability blocker, or scenario gap remains.

## Adversarial Plan Self-Check

| Check | Result | Evidence |
|---|---|---|
| Missing tasks/ACs | PASS | EXTREV-70 through EXTREV-135 each has one explicit mapping row |
| Dependency correctness | PASS | tests → schemas/policy → runtime → consumers → proof/freeze |
| Scope reduction | PASS | no banned deferral phrase and no affected entry point deferred |
| Validation strength | PASS | behavioral call/turn/route/cache/state replays, not source-only checks |
| First-task viability | PASS | clean base contains validator; spec/manifest name exact expected-red states |
| Pattern-family completeness | PASS | inventory checks both exact static policy terms and adjacent direct invocation/profile variants |
| Visual-rendering tier | N/A | no visual/browser AC or file |
| Production-derived mock parity | N/A | no browser-visible MODIFY |
| Provider fidelity | PASS in plan | named evidence artifact and required requested/used/route/fallback/source/saved-state/final fields are task-5 blockers |
| Persona trace | N/A | system-only internal integration |

## Promotion Readiness Checklist

- [ ] Every planned executable and active contract file is accounted for; discovered scope reopens the manifest before editing.
- [ ] EXTREV-70 through EXTREV-135 each has passing deterministic or bounded real proof.
- [ ] Two-turn protocol succeeds in one process; four-turn exhaustion and structured max-turn classification pass.
- [ ] Provider safety route requires controlled envelope evidence, launches no second Opus, and never satisfies Fable-primary cache demand.
- [ ] Before/at/after cutover and secure select/status/clear lifecycle pass with zero-spawn policy operations.
- [ ] Claude-orchestrated Codex 5.6 sol/high and every preserved WI-488 no-fallback class remain unchanged.
- [ ] Resolver, registry, launcher, receipt, and active contracts agree at the same frozen clock/profile.
- [ ] Tier-1 fixture containment proves zero paid calls.
- [ ] One real canonical Fable/high review completes without a separate smoke call and finalizes provider evidence.
- [ ] Task graph, plan/chain receipts, proposal/spec/work-item/Markdown/frontmatter/JSONL validators pass.
- [ ] `git diff --check` and full Tier 1 satisfy the honest landing policy with no new failures.
- [ ] Review-plan passes before implementation; review-exec, review-security, review-gate, and audit evaluate the same frozen implementation hash.
- [ ] PR is independently reviewed, merged, and promoted `origin/main` passes focused/full verification before WI-486 rebinds.
- [ ] No ORM schema is touched; JSON Schema evolution is fixture/replay validated and requires no database migration.

## Rollback

Before merge, use the last recorded `refs/svc/checkpoints/WI-489/task-N` object to reconstruct the exact prior task diff with apply-patch tooling, then rerun focused fixtures and freeze a new aggregate hash. After merge, use a normal revert PR that restores launcher, receipt schema, registry, resolver, active contracts, `.gitignore`, and tests together. Never reset, force push, bypass verification, or mutate preserved stashes. Local selection/cache state is non-authoritative: always clear the verification selection after its receipt is recorded and use lock-safe GC only when no launcher owns a lock. Authentication state remains untouched.
