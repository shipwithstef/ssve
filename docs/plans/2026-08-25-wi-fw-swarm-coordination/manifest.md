# WI-FW-SWARM-COORDINATION-01 — Central Swarm Coordination Kernel

**Date:** 2026-08-25
**Branch:** feature-WI-563-swarm-coordination (branch label WI-563; canonical work-item id WI-FW-SWARM-COORDINATION-01)
**Lane:** framework
**Base SHA:** 494f0749250ccf8c3e52e7dbd7a55128a0800b78
**Source architecture plan:** approved consumer-side handoff at /home/dianast/app-workspaces/hourshub-worktrees/wt-lane-fw-swarm-coordination/docs/specs/plans/wi-framework-swarm-coordination-plan.md
**Scope decision:** logged in .svc/pipeline-decisions.jsonl (run WI-FW-SWARM-COORDINATION-01): this changeset delivers Waves 0-2 plus the deterministic conflict-ladder core of the approved architecture. Live host wiring (Wave 4) and shadow/canary rollout (Wave 5) are follow-up work items because they mutate per-host hook configuration and require multi-host runs, which are external state and cannot be exercised inside one central-framework changeset.

## Execution Mode

Inline. The orchestrator session implements every task directly in this worktree; there is no child dispatch, no parallel wave, and no delegated inner worktree for this changeset. TEST_CONCURRENCY=2 applies only to the tier-1 runner batch.

## Protocol Precision (normative for T02-T04)

**Canonicalization.** The JCS implementation targets the RFC 8785 profile: UTF-8 output; object keys sorted by UTF-16 code unit order; strings escaped per RFC 8785 section 3.2.2.2; numbers serialized via the shortest round-tripping ECMAScript Number form (integers without fraction or exponent where lossless). Embedded vectors must include: nested key reordering producing identical bytes, non-ASCII string escaping, and integer/float distinction. Only values produced by JSON.parse of command/receipt documents are canonicalized — no undefined, no NaN.

**DSSE profile.** Envelope = `{payloadType, payload, signatures[]}`; payload bytes are the JCS serialization of the receipt/command JSON document; the signature covers exactly the DSSE PAE prelude: `DSSEv1` SP `LEN(type)` SP `type` SP `LEN(payload)` SP `payload` (LEN is the BYTE length of the following field as ASCII decimal with zero leading zeros, so non-ASCII payloads sign identically across implementations; fields are single-space separated with no trailing newline). Payload type literals: application/vnd.svc.swarm-receipt+json;version=1 for receipts and application/vnd.svc.swarm-command+json;version=1 for signed commands. keyid is a lookup hint into the trust registry, never an identity proof by itself.

**Idempotency semantics.** Idempotency keys are scoped per run_id. Classification happens on canonical COMMAND bytes before any journal lookup: the handler computes sha256(JCS(command)); a retry whose digest equals the command_digest bound to that key returns the original event plus its persisted acceptance receipt; any other digest under the same key fails closed. The replay-derived map binds idempotency_key -> (command_digest, event_digest); matching command digest with divergent event digest indicates journal corruption and fails replay rather than serving state. Key-order permutations of a retried command produce identical JCS bytes and therefore dedupe correctly.

**Trust bootstrap and keys.** init is rerun-safe and crash-safe: every artifact (root key, coordinator key, signed registry, journal) is created with O_EXCL semantics under a 0700-mode state-root keys/ directory with individual key files written 0600, so a partially completed init refuses with an explicit named-artifact repair instruction rather than overwriting anything, and a fully completed init is idempotent, returning the existing fingerprints. Keys generate via node:crypto; the root self-signs the trust registry entry for the coordinator key (purpose=coordinate, allowed kinds enumerated in the registry). Wall-clock time gates NEW commands only: expires_at/issued_at validity windows (checked with a +/-300 second skew allowance) decide live command authorization at handling time. Historical verification of an already-journaled event ignores expiry entirely — it checks the registry revocation SEQUENCE instead: a row carrying revoked_at_sequence invalidates only events whose sequence is greater or equal, so earlier sequences still verify with the same key material. Ordering authority is always the coordinator sequence, never wall time.

**Crash-atomic acceptance.** One flock critical section per append: replay-validate the candidate against replayed state; append+fsync the event batch; sign the acceptance receipt referencing the appended event digest; write that receipt to receipts/<command-canonical-digest>.json (0600, atomic rename) inside the same section; respond only after the receipt file is durable. Crash windows: pre-fsync = zero effect, retry recomputes cleanly; post-fsync pre-receipt = retry re-signs deterministically (Ed25519 signatures are deterministic over identical PAE bytes, so the regenerated receipt is byte-identical to what the interrupted attempt would have produced); post-receipt = retry reads and returns the persisted receipt verbatim. There is deliberately no response-delivery guarantee beyond at-least-once delivery plus durable effect receipts.

**Rollback scoping.** Concrete procedure, in order: (1) pre-land rollback = discard the feature branch (git checkout of main worktree; branch deletion via the normal worktree path); (2) post-land rollback = git revert <squash-SHA> on main followed by the standard promotion verification; (3) state disposal = remove any swarm state roots created under caller-provided directories (rm -rf of those explicit paths only — they contain exclusively post-change data); (4) compatibility proof = after revert, replay one pre-existing runtime-v2 journal via test-framework/evals/tier-1/validate-runtime-v2.mjs to demonstrate legacy readability; runtime-v2 journals written before the change stay readable because the schema change is additive-only (enum widening cannot invalidate previously valid documents). Swarm state roots created after the change live wholly under caller-provided state-root directories, are inert unless a coordinator is explicitly started against them (zero call sites outside tests), and may be discarded wholesale during rollback since they carry no pre-change data.

## CLI Surface Contract (normative for T06)

scripts/svc-swarm.mjs exposes exactly these verbs, covering every command-union member one-to-one:

| Verb | Command union member |
|---|---|
| init | (coordinator bootstrap: keys, registry, journal) |
| register | register_session |
| acquire | acquire_task |
| heartbeat | heartbeat_task |
| progress | report_progress |
| submit | submit_candidate |
| handoff-prepare | request_handoff |
| handoff-accept | accept_handoff |
| cancel | request_cancel |
| resolve | propose_resolution |
| ack | ack_state |
| status / replay / snapshot / sign-checkpoint / verify | read-side and checkpoint APIs |

The host-parity gate additionally asserts that every enum value of the command schema maps to exactly one verb above, so a future command cannot silently ship without a CLI surface.

## Lane Compliance Matrix

| Upstream skill | Status | Artifact / skip citation |
|---|---|---|
| route-workflow | completed | .svc/lane-tasks-WI-FW-SWARM-COORDINATION-01.json task 1 skill receipt; session contract refreshed; strategy decision in .svc/pipeline-decisions.jsonl |
| plan-changeset | completed-by-this-manifest | docs/plans/2026-08-25-wi-fw-swarm-coordination/manifest.md authored from the approved hourshub architecture plan per its Plan-complete gate step 3 |
| design-tech | skipped | Durable skip decision logged in .svc/pipeline-decisions.jsonl (run WI-FW-SWARM-COORDINATION-01): framework-lane kernel whose architecture was ratified by the approved source plan's single-writer event-sourced decision; re-opening tech design would duplicate that ratification. |
| write-spec / personas / journeys | skipped | Durable skip decisions logged in .svc/pipeline-decisions.jsonl (same run): framework lane with zero product/user-facing surface; persona gate not applicable to framework-lane graphs per scripts/task-graph.mjs PERSONA_GATED_LANES |
| review-plan | this gate | Tier-1 mechanical pass + external adversarial review + review-log.yaml |

## Outcome

A host-neutral, single-writer coordination kernel for multi-model swarms inside the central framework repository:

1. Strict JSON Schemas for the command union, signed receipt payloads, DSSE envelopes, conflict packets/resolutions, and the trust registry.
2. RFC 8785 canonical JSON (JCS) serialization and DSSE/Ed25519 two-stage signing (submission receipt by the adapter session; acceptance/rejection receipt by the coordinator).
3. A command handler that validates schema, identity, capability, authority generation, expected sequence (CAS), and idempotency before any journal append; exact retries return the original event; byte-changed reuse of an idempotency key fails.
4. A deterministic conflict resolver implementing ladder Levels 0-3 with a protected-surface registry that never auto-merges.
5. A coordinator CLI exposing init/submit/status/replay/snapshot/sign-checkpoint/verify.
6. Four tier-1 gates proving protocol conformance, signature/tamper rejection, conflict-ladder determinism, and host-neutral parity.

Fail-closed rule carried over from the source plan: a model-authored PASS string, timestamp, or local state is never authority. The coordinator recomputes journal facts from replayed state and signs every accepted transition.

## Files Planned

| Task | Action | File(s) | Purpose |
|---|---|---|---|
| T01 | CREATE | schemas/swarm-command-v1.schema.json | Strict command union: register_session, acquire_task, heartbeat_task, report_progress, submit_candidate, request_handoff, accept_handoff, request_cancel, propose_resolution, ack_state |
| T01 | CREATE | schemas/swarm-receipt-payload-v1.schema.json | Signed receipt payload fields and per-kind requirements |
| T01 | CREATE | schemas/swarm-dsse-envelope-v1.schema.json | DSSE profile binding payload type, JCS bytes, signatures |
| T01 | CREATE | schemas/swarm-conflict-v1.schema.json | Conflict packet and typed resolution proposal |
| T01 | CREATE | schemas/swarm-trust-registry-v1.schema.json | Keys, purposes, validity windows, revocation sequence |
| T01 | CREATE | references/swarm-conflict-policy.json | Resolver registry and protected-surface policy |
| T08 | CREATE | docs/plans/2026-08-25-wi-fw-swarm-coordination/plan-contract.json | Materializes at T08 closeout byte-exact per the inline contract below (sole owner: T08); scripts/validate-plan-contract.mjs clean-exit on it is a required T08 gate |
| T08 | CREATE | scripts/extract-inline-plan-contract.mjs | Extracts the inline contract json block from this manifest and writes plan-contract.json; consumed by the Execution Command Sequence |
| T02 | CREATE | scripts/lib/swarm-canonical-json.mjs | RFC 8785 JCS serializer with embedded test vectors and lone-surrogate rejection |
| T10 | MODIFY | scripts/lib/json-schema-validator.mjs | Validator contract repair: implement documented allOf/anyOf/oneOf/not/if-then-else plus const support and object-semantics required/properties so strict per-kind schemas are actually enforced |
| T02 | CREATE | scripts/lib/swarm-canonical-json.mjs | RFC 8785 JCS serializer with embedded test vectors |
| T03 | CREATE | scripts/lib/swarm-signing.mjs | DSSE/Ed25519 sign/verify over JCS bytes; key generation; tamper rejection |
| T04 | CREATE | scripts/lib/swarm-command-handler.mjs | Schema/identity/capability/generation/sequence/idempotency validation; attempt state machine; journal appends through svc-runtime-v2 primitives |
| T05 | CREATE | scripts/lib/swarm-conflict-resolver.mjs | Claim compilation, ladder Levels 0-3, protected-surface refusal |
| T06 | CREATE | scripts/svc-swarm.mjs | Coordinator CLI: init, register, acquire, heartbeat, submit, handoff, cancel, resolve, status, replay, snapshot, sign-checkpoint, verify |
| T06 | CREATE | references/swarm-protocol.md | Normative protocol contract (commands, events, receipts, synchronization, key policy) |
| T07 | CREATE | test-framework/evals/tier-1/validate-swarm-protocol.sh | Command/receipt schema conformance, CAS + idempotency + replay behavior end-to-end via the CLI |
| T07 | CREATE | test-framework/evals/tier-1/validate-swarm-signatures.sh | JCS vectors, DSSE verify, tamper/expired-key/wrong-purpose/truncation rejection |
| T07 | CREATE | test-framework/evals/tier-1/validate-swarm-conflicts.sh | Ladder Level 0-3 outcomes and protected-surface refusal are deterministic |
| T07 | CREATE | test-framework/evals/tier-1/validate-swarm-host-parity.sh | Same golden scenario produces identical canonical transitions regardless of actor host label |
| T08 | MODIFY | .svc/lane-tasks-WI-FW-SWARM-COORDINATION-01.json | Task-graph status progression and phase receipts |
| T08 | MODIFY | docs/plans/2026-08-25-wi-fw-swarm-coordination/manifest.md | Plan artifact itself: revised in place through bounded review rounds; final digest bound at closeout |
| T08 | MODIFY | docs/plans/2026-08-25-wi-fw-swarm-coordination/review-log.yaml | Review log persistence: findings, responses, dispositions, terminal state |
| T08 | MODIFY | docs/plans/2026-08-25-wi-fw-swarm-coordination/exec-review-log.yaml | Execution-review responses and disposition record |
| T07 | MODIFY | test-framework/evals/tier-1/validate-kimi-host.sh | Environment-robustness repair: fail-closed probe isolates HOME/policy env so it tests no-owner-policy behavior on machines that have one |
| T07 | MODIFY | test-framework/evals/tier-1/validate-wi546-cursor-live-acceptance.sh | Environment-robustness repair: live note-consume probe iterates store entries; live EXEC check tolerates a present owner dispatch policy (no-Sonnet invariant preserved) |
| T07 | MODIFY | test-framework/evals/tier-1/validate-wi546-grok-live-acceptance.sh | Environment-robustness repair: live EXEC check tolerates a present owner dispatch policy (no-Sonnet/fast invariant preserved) |

Journal topology per execution review EXEC-006: the swarm coordination journal is a STANDALONE append-only stream that reuses the runtime-v2 PATTERNS (advisory process-death-proof lock, digest chain, fsync, idempotency binding) but not the runtime-v2 event envelope, because v2 events require sha256 generation_bindings that a coordinator kernel does not possess. The runtime-v2 schema is left untouched by this changeset; legacy compatibility is preserved trivially.

## Task Graph

```json
{
  "schema_version": 1,
  "wi": "WI-FW-SWARM-COORDINATION-01",
  "lane": "framework",
  "note": "Implementation-graph ids live in their own namespace (11+) and never collide with lane-graph task ids in .svc/lane-tasks-WI-FW-SWARM-COORDINATION-01.json.",
  "tasks": [
    { "id": 11, "status": "pending", "subject": "T01 contract schemas + conflict policy", "blocked_by": [] },
    { "id": 12, "status": "pending", "subject": "T02 journal enum extension + JCS canonicalization", "blocked_by": [11] },
    { "id": 13, "status": "pending", "subject": "T03 DSSE/Ed25519 signing library", "blocked_by": [12] },
    { "id": 14, "status": "pending", "subject": "T04 command handler + attempt state machine", "blocked_by": [13] },
    { "id": 15, "status": "pending", "subject": "T05 conflict resolver ladder", "blocked_by": [14] },
    { "id": 16, "status": "pending", "subject": "T06 coordinator CLI + protocol reference", "blocked_by": [15] },
    { "id": 17, "status": "pending", "subject": "T07 tier-1 protocol/signature/conflict/host-parity gates", "blocked_by": [16] },
    { "id": 18, "status": "pending", "subject": "T08 closeout: contract materialization+validation, graph progression, full tier-1 green", "blocked_by": [17] }
  ]
}
```

## Validation Plan

Every task lands red-green: the owning tier-1 gate or a direct CLI invocation must fail on the missing/incorrect implementation first, then pass after implementation.

1. Schema validity: each new schema parses and validates at least one fixture document produced by the implementation itself.
2. Behavior gates: the four validate-swarm-* tier-1 scripts exercise the real CLI against temporary state roots; no network, no provider calls, hermetic.
3. Regression: the changed runtime journal schema must keep all pre-existing journals replayable — proven by running the existing runtime-v2 focused validators listed below.
4. Full sweep: bash test-framework/evals/run-all-evals.sh with TEST_CONCURRENCY=2 must finish green before review-exec.

Focused pre-existing validators guarding the touched surface:

```bash
bash test-framework/evals/tier-1/test-framework/evals/tier-1/validate-runtime-v2.mjs
node scripts/task-graph.mjs validate .svc/lane-tasks-WI-FW-SWARM-COORDINATION-01.json
node scripts/check-plan-deploy-dependency.mjs --lane-tasks .svc/lane-tasks-WI-FW-SWARM-COORDINATION-01.json
```

## Execution Command Sequence

```bash
set -euo pipefail
cd /home/dianast/app-workspaces/seriousvibecoding/.worktrees/feature-WI-563-swarm-coordination
# T01-T06: write schemas, libs, CLI, protocol reference; after each task run its gate or direct invocation until green
node --check scripts/lib/swarm-canonical-json.mjs
node --check scripts/lib/swarm-signing.mjs
node --check scripts/lib/swarm-command-handler.mjs
node --check scripts/lib/swarm-conflict-resolver.mjs
node --check scripts/svc-swarm.mjs
node --check scripts/extract-inline-plan-contract.mjs
# T07: tier-1 gates, individually then via the runner batch
TEST_CONCURRENCY=2 bash test-framework/evals/tier-1/validate-swarm-protocol.sh
TEST_CONCURRENCY=2 bash test-framework/evals/tier-1/validate-swarm-signatures.sh
TEST_CONCURRENCY=2 bash test-framework/evals/tier-1/validate-swarm-conflicts.sh
TEST_CONCURRENCY=2 bash test-framework/evals/tier-1/validate-swarm-host-parity.sh
# T08: materialize plan-contract.json from the inline block, validate it, regression + full corpus
node scripts/extract-inline-plan-contract.mjs
node scripts/validate-plan-contract.mjs docs/plans/2026-08-25-wi-fw-swarm-coordination/plan-contract.json .
bash test-framework/evals/tier-1/test-framework/evals/tier-1/validate-runtime-v2.mjs
TEST_CONCURRENCY=2 bash test-framework/evals/run-all-evals.sh
```

Checkpoint commits follow execute-changeset naming: checkpoint: task-N-<name>.

## Prerequisite Alignment Matrix

| Prerequisite | Artifact | Alignment evidence |
|---|---|---|
| Runtime-v2 journal primitives (append, replay, digest chain, fsync, idempotency) | scripts/svc-runtime-v2.mjs | Command handler reuses the same lock/append/replay patterns; coordination events flow through the extended v2 schema |
| Attempt substate vocabulary (LEASED/RUNNING/CANDIDATE_SUBMITTED/VERIFYING/ACCEPTED/CONFLICTED/BLOCKED) | Source architecture plan section State-machine synchronization | Encoded as the handler's attempt state machine; terminal states CONSUMED/CANCELLED/FAILED |
| DSSE + JCS + Ed25519 standards | Source plan External research (DSSE spec, RFC 8785, RFC 8032) | swarm-canonical-json implements RFC 8785 subset with vectors; swarm-signing uses node crypto ed25519 |
| Conflict resolution ladder Levels 0-5 | Source plan Resolution ladder | Levels 0-3 implemented deterministically here; Levels 4-5 refuse to auto-merge and emit BLOCKED/protected outcomes, matching out-of-scope boundary |
| Trust/revocation semantics | Source plan Key policy | Registry schema carries purpose, allowed kinds, validity window, revocation sequence; verifier enforces expiry and revocation |

## External State

| Surface | Coupling | Wiring |
|---|---|---|
| Host hook configurations (cursor/codex/grok wirers) | decoupled-justified | This changeset creates no host wiring; adapters arrive in the follow-up host-adapter work item. Drift catch: the four new tier-1 gates run hermetically on every lint and would fail if any wiring assumption leaked into kernel code paths. |
| Provider CLIs / network | decoupled-justified | All gates are hermetic: no network calls, no provider binaries invoked. The gates themselves assert no-network by construction (pure node invocations). |
| Git remotes / branches | coupled | Coordinator binds candidate digests to SHAs it reads via git rev-parse in the local worktree; verification gate exercises wrong-SHA rejection. Recovery: all state lives under a caller-provided state root directory; nothing outside the worktree or state root is read or written. |
| Existing runtime-v2 journals on disk | coupled | Enum extension is additive; replay compatibility is enforced by test-framework/evals/tier-1/validate-runtime-v2.mjs in the validation plan. Recovery: revert restores prior schema bytes; journals were never rewritten. |
| Hermeticity of the new gates | coupled | Each validate-swarm-* gate runs only node against the worktree's own scripts with a mktemp state root and asserts exit codes; no network sockets, no provider binaries, no environment-specific paths are referenced. Drift catch: run-all-evals.sh executes them on every lint; any non-hermetic dependency fails the gate in CI-less local runs the same way. |

Untouched environments (walked the taxonomy, found nothing): production databases, migrations, package registries, schedulers, external SaaS endpoints, DNS, secrets managers, CI systems, message queues, object storage, third-party APIs, operating-system services outside the invoking user account, other repositories, other worktrees.

## Simulation & Assumptions

| Claim | Scope |
|---|---|
| Sequence CAS + idempotency make duplicate and reordered commands safe | Scope: one coordinator process per state root, enforced by the flock-based journal lock inherited from the runtime-v2 pattern; single-writer per run per the source plan |
| Ed25519 via node:crypto satisfies the maintained-library requirement | Scope: node >= 20 on this host (verified during execution via node --version); no curve arithmetic implemented in-repo |
| Ladder Levels 0-3 cover the seeded conflicts in the gates | Scope: this changeset's test fixtures only; semantic adjudication (Level 4) and protected-surface serialization (Level 5) intentionally stop at refusal + BLOCKED emission |
| The kernel ships inert until a coordinator is explicitly started against a state root | Scope: this repository; default-off by construction since zero call sites invoke the CLI outside tests |

**Risk Flags:** runtime_concurrency — the kernel's journal append path is a concurrency control point. The mechanical contract artifact (plan-contract.json) is authored as part of T09 at execution closeout, where diff-parity math is meaningful; pre-execution, the concurrency contract below IS the normative binding:

- **Atomic primitive:** flock (advisory, kernel-released on process death) around the entire validate -> append -> fsync -> sign critical section, keyed by state-root journal path, inherited from scripts/svc-runtime-v2.mjs withJournalLock.
- **Owner key:** coordinator identity bound to the state root; a competing process blocks on the flock and re-reads replayed state after acquisition, so its view postdates every committed event.
- **Concurrent invocation behavior:** serialized by the flock; no second writer can interleave because appends happen only while holding it, and replay validation runs inside the same section.
- **Stale-lock cleanup:** nothing to clean — advisory flocks vanish with the owning process; startup additionally verifies the digest chain and last signed checkpoint, refusing a torn tail.
- **Test wiring:** validate-swarm-protocol.sh (T07) exercises concurrent CLI invocations against one state root and asserts exactly-once effects.

The contract artifact content is fixed NOW by this inline block (byte-stable; the closeout file must equal it modulo base_sha refresh):

```json
{
  "schema_version": 1,
  "base_sha": "494f0749250ccf8c3e52e7dbd7a55128a0800b78",
  "manifest": "docs/plans/2026-08-25-wi-fw-swarm-coordination/manifest.md",
  "risk_flags": [
    "runtime_concurrency"
  ],
  "concurrency": {
    "atomic_primitive": "flock",
    "owner_key": "coordinator journal lock keyed by state-root journal path (withJournalLock pattern inherited from scripts/svc-runtime-v2.mjs)",
    "concurrent_invoke_behavior": "serialized by the advisory mkdir-mutex held across the whole validate-append-fsync-sign-receipt-write section; a competing process blocks, acquires after release, then re-reads replayed state so its view postdates every committed event; process-death reclaim via /proc start tokens",
    "stale_lock_cleanup": "advisory locks are kernel-released on process death; startup verifies digest chain and last signed checkpoint and refuses a torn tail",
    "concurrency_test": "test-framework/evals/tier-1/validate-swarm-protocol.sh"
  },
  "ownership": [
    {
      "task": "T01",
      "paths": [
        "schemas/swarm-command-v1.schema.json",
        "schemas/swarm-receipt-payload-v1.schema.json",
        "schemas/swarm-dsse-envelope-v1.schema.json",
        "schemas/swarm-conflict-v1.schema.json",
        "schemas/swarm-trust-registry-v1.schema.json",
        "references/swarm-conflict-policy.json"
      ]
    },
    {
      "task": "T02",
      "paths": [
        "scripts/lib/swarm-canonical-json.mjs"
      ]
    },
    {
      "task": "T03",
      "paths": [
        "scripts/lib/swarm-signing.mjs"
      ]
    },
    {
      "task": "T04",
      "paths": [
        "scripts/lib/swarm-command-handler.mjs"
      ]
    },
    {
      "task": "T05",
      "paths": [
        "scripts/lib/swarm-conflict-resolver.mjs"
      ]
    },
    {
      "task": "T06",
      "paths": [
        "scripts/svc-swarm.mjs",
        "references/swarm-protocol.md"
      ]
    },
    {
      "task": "T07",
      "paths": [
        "test-framework/evals/tier-1/validate-swarm-protocol.sh",
        "test-framework/evals/tier-1/validate-swarm-signatures.sh",
        "test-framework/evals/tier-1/validate-swarm-conflicts.sh",
        "test-framework/evals/tier-1/validate-swarm-host-parity.sh",
        "test-framework/evals/tier-1/validate-kimi-host.sh",
        "test-framework/evals/tier-1/validate-wi546-cursor-live-acceptance.sh",
        "test-framework/evals/tier-1/validate-wi546-grok-live-acceptance.sh"
      ]
    },
    {
      "task": "T08",
      "paths": [
        ".svc/lane-tasks-WI-FW-SWARM-COORDINATION-01.json",
        "docs/plans/2026-08-25-wi-fw-swarm-coordination/plan-contract.json",
        "scripts/extract-inline-plan-contract.mjs",
        "docs/plans/2026-08-25-wi-fw-swarm-coordination/manifest.md",
        "docs/plans/2026-08-25-wi-fw-swarm-coordination/review-log.yaml",
        "docs/plans/2026-08-25-wi-fw-swarm-coordination/exec-review-log.yaml"
      ]
    },
    {
      "task": "T10",
      "paths": [
        "scripts/lib/json-schema-validator.mjs"
      ]
    }
  ],
  "resource_review": {
    "disposition": "no-risky-resource-writers",
    "verification": "changed-executable-census",
    "denominator": 14,
    "evidence": "closeout census counts exactly fourteen executables: four lib modules (swarm-canonical-json, swarm-signing, swarm-command-handler, swarm-conflict-resolver), coordinator CLI (svc-swarm.mjs), manifest extractor (extract-inline-plan-contract.mjs), shared schema validator repair (json-schema-validator.mjs), plus seven tier-1 gates (four new validate-swarm-* and three environment-robustness repairs); none touch money/ledger/quota/inventory/identity/notification surfaces"
  },
  "resource_writers": [],
  "claims": [],
  "volatile_paths": [
    ".svc"
  ],
  "executables": [
    {
      "path": "scripts/svc-swarm.mjs",
      "consumers": [
        {
          "path": "test-framework/evals/tier-1/validate-swarm-protocol.sh"
        },
        {
          "path": "test-framework/evals/tier-1/validate-swarm-host-parity.sh"
        }
      ]
    },
    {
      "path": "scripts/lib/swarm-canonical-json.mjs",
      "consumers": [
        {
          "path": "scripts/lib/swarm-signing.mjs"
        },
        {
          "path": "test-framework/evals/tier-1/validate-swarm-signatures.sh"
        }
      ]
    },
    {
      "path": "scripts/lib/swarm-signing.mjs",
      "consumers": [
        {
          "path": "scripts/lib/swarm-command-handler.mjs"
        },
        {
          "path": "test-framework/evals/tier-1/validate-swarm-signatures.sh"
        }
      ]
    },
    {
      "path": "scripts/lib/swarm-command-handler.mjs",
      "consumers": [
        {
          "path": "scripts/svc-swarm.mjs"
        }
      ]
    },
    {
      "path": "scripts/lib/swarm-conflict-resolver.mjs",
      "consumers": [
        {
          "path": "scripts/svc-swarm.mjs"
        },
        {
          "path": "test-framework/evals/tier-1/validate-swarm-conflicts.sh"
        }
      ]
    },
    {
      "path": "scripts/lib/json-schema-validator.mjs",
      "consumers": [
        {
          "path": "scripts/lib/swarm-command-handler.mjs"
        }
      ]
    }
  ]
}
```

No other AC-553 flag applies: no hooks/wirer/config-parser paths change, and no money/ledger/quota/identity surface is written by any planned file.

## Acceptance Criteria

Each AC names its owning task and the gate that proves it, so coverage is mechanically traceable (gate output captured per task in the execution record).

| AC | Owning task | Proving gate / evidence |
|---|---|---|
| 1. Strict schemas accept well-formed fixtures and reject mutated ones | T01 | validate-swarm-protocol.sh schema section |
| 2. Handler rejects stale generation, wrong expected_sequence, changed-byte idempotency reuse, unknown capability, expired/revoked keys | T04 + T03 | validate-swarm-protocol.sh CAS/idempotency section; validate-swarm-signatures.sh key-policy section |
| 3. Exact retry returns the original event without duplicate append | T04 | validate-swarm-protocol.sh idempotency section |
| 4. JCS byte-stability under key reordering; DSSE verify fails on any byte flip | T02 + T03 | validate-swarm-signatures.sh vectors section |
| 5. Submission receipt binds adapter session; acceptance receipt references submission digest with sequence_before/after + signer | T03 + T04 | validate-swarm-signatures.sh two-stage section |
| 6. Replay detects torn records, byte changes, digest breaks, sequence gaps | T04 | validate-swarm-protocol.sh replay-corruption section |
| 7. Ladder: disjoint integrates, clean overlap merges after union validators, resolvers deterministic, undeclared overlap + protected surfaces refuse | T05 | validate-swarm-conflicts.sh |
| 8. Golden scenario identical across host labels | T07 | validate-swarm-host-parity.sh |
| 9. Legacy journals stay replayable after enum extension | T02 | test-framework/evals/tier-1/validate-runtime-v2.mjs (pre-existing) |
| 10. Full tier-1 corpus green at TEST_CONCURRENCY=2 | T08 | run-all-evals.sh output in execution record |
| 11. Every command-union enum value maps to exactly one CLI verb | T06 | validate-swarm-host-parity.sh verb-coverage assertion |

1. Every command and receipt kind has a strict schema whose validator accepts well-formed fixtures and rejects mutated ones (missing field, extra field, wrong type).
2. The command handler rejects: stale authority generation, unexpected expected_sequence, reused idempotency key with different bytes, unknown principal capability, expired or revoked session keys.
3. Exact retry of an accepted command returns the original event without a duplicate append.
4. JCS serialization is byte-stable across key order permutations (proven by vectors); DSSE signatures verify over exactly those bytes and fail on any byte flip.
5. Submission receipts bind the adapter session; acceptance receipts reference the submission digest and carry sequence_before/sequence_after plus signer identity.
6. Replay detects torn final records, mid-stream byte changes, digest-chain breaks, and sequence gaps, refusing to serve state.
7. Conflict ladder: disjoint claims integrate; clean-overlap merges only after union validators pass; registered resolvers apply deterministically; undeclared overlap and protected surfaces refuse with explicit reason codes and never merge silently.
8. The same golden scenario executed under two different host labels yields identical canonical transitions and verdicts (host parity).
9. Legacy journals remain readable and replayable after the enum extension (regression validator stays green).
10. Full tier-1 corpus passes with TEST_CONCURRENCY=2.

| T11 | CREATE | docs/specs/work-items/WI-485-residual-map.json | New minimal residual map (see WI-368 row) |