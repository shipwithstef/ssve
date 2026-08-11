---
status: VERIFIED
type: Enabler
mode: contract-change
wi: WI-488
landscape_state: inapplicable
landscape_inapplicable_reason: internal framework review transport with no customer-facing market flow
created: 2026-07-15
---

# Feature: Deterministic external reviewer invocation

**Status:** VERIFIED
**Type:** Enabler
**Consumers:** `review-plan`, `review-cross-model`, `review-exec`, floor judges, review-gate infrastructure
**Priority:** high
**Source:** accepted owner contract, `docs/specs/work-items/WI-488.md`

## Delta contract

**Invariant behavior preserved:** review skills keep their existing rubrics, acceptance thresholds, finding-resolution loops, and independent-family requirement. Unrelated model-powered evaluation, worker dispatch, extraction, and creative generation remain outside this contract.

**Behavior changed:** every framework-owned independent external review enters through one schema-validated launcher that owns exact tuple enforcement, CLI isolation, failure classification, fallback, content-addressed reuse, and invocation evidence.

**Explicit boundary:** this spec does not change concurrent/session ownership or legacy graph migration (WI-486), and it does not change all-host installation or hook diagnostics (WI-487).

## Problem Statement

Framework review consumers currently receive a host selection and then construct their own paid model invocation. The split permits model/version/effort drift, invalid CLI syntax, accidental over-provisioning, hidden fallback, unstructured findings, duplicate paid calls, and receipts that cannot prove the effective reviewer. A review can therefore appear independent without an enforceable end-to-end invocation contract.

## Goals

- Make one executable boundary authoritative for independent external review.
- Enforce the owner-approved primary and fallback tuples without silent substitution.
- Preserve authentication while isolating configuration, rules, tools, persistence, and mutation capabilities.
- Produce schema-valid findings and durable evidence for every success or classified failure.
- Prevent duplicate paid primary reviews only when the complete content-addressed identity matches.
- Make every Tier-1 proof fixture-controlled and free of paid model calls.

## Non-goals

- Changing review rubrics or review-gate severity thresholds.
- Replacing unrelated Claude, Codex, Gemini, Kimi, or worker invocations.
- Adding a new review gate.
- Solving WI-486 session/bootstrap behavior or WI-487 installation/hook behavior.
- Treating fallback output as equivalent evidence for a recovered primary model.

## System flow

```text
review consumer
  -> canonical package on stdin
  -> resolve requested primary tuple
  -> content-addressed valid-primary lookup
       -> reusable exact no-fallback receipt: return cached findings + receipt
       -> miss: invoke primary once (the availability probe)
            -> schema-valid success: persist findings + no-fallback receipt
            -> allowed Fable availability class: invoke Opus xhigh separately once
            -> every other failure: persist classified hard-failure receipt
  -> consumer receives schema-valid findings/receipt or one actionable failure
```

## Consumer Stories

### US-1 — Deterministic reviewer policy

**As** a framework review consumer,
**I need** one machine-readable requested tuple derived from the orchestrator and owner policy,
**So that** the invoked reviewer cannot silently drift in family, version, or effort.

### Acceptance Criteria — US-1

| AC | Description | QA | E2E | Test |
|---|---|---|---|---|
| EXTREV-01 | A Claude-orchestrated request resolves its primary reviewer to Codex 5.6 sol at high. | — | 🔲 | fixture |
| EXTREV-02 | Unavailable Codex 5.6 sol on the Claude path produces a hard-failure receipt. | — | 🔲 | fixture |
| EXTREV-03 | The Claude path never substitutes a reviewer when Codex 5.6 sol is unavailable. | — | 🔲 | fixture |
| EXTREV-04 | A Codex-orchestrated request resolves its primary reviewer to Fable 5 at high. | — | 🔲 | fixture |
| EXTREV-05 | The resolved tuple records orchestrator, reviewer host, reviewer family, exact model/version, and effort. | — | 🔲 | schema |
| EXTREV-06 | The resolved tuple records primary availability outcome, fallback eligibility, fallback reason, and override state. | — | 🔲 | schema |
| EXTREV-07 | Fable xhigh or max is rejected unless a valid owner override requests it. | — | 🔲 | fixture |
| EXTREV-08 | Codex effort above high is rejected unless a valid owner override requests it. | — | 🔲 | fixture |
| EXTREV-09 | An owner override is valid only when its source and requested tuple are receipted. | — | 🔲 | fixture |
| EXTREV-10 | A model alias that resolves to another family or version is classified unavailable. | — | 🔲 | fixture |
| EXTREV-11 | A declared tuple that differs from the exact invocation tuple fails before findings are accepted. | — | 🔲 | fixture |

### US-2 — Canonical isolated invocation

**As** a review orchestrator,
**I need** one launcher that accepts the package on stdin and runs the selected CLI under reproducible isolation,
**So that** review code cannot mutate the worktree or inherit drift-prone local behavior.

### Acceptance Criteria — US-2

| AC | Description | QA | E2E | Test |
|---|---|---|---|---|
| EXTREV-12 | The launcher accepts the complete review package through stdin. | — | 🔲 | fixture |
| EXTREV-13 | The launcher validates final findings against the shared findings schema. | — | 🔲 | schema |
| EXTREV-14 | Codex runs through non-interactive `codex exec`. | — | 🔲 | argv capture |
| EXTREV-15 | Codex runs with a read-only sandbox. | — | 🔲 | argv capture |
| EXTREV-16 | Codex runs ephemerally without persisting a session. | — | 🔲 | argv capture |
| EXTREV-17 | Codex ignores user configuration and user rules while preserving `CODEX_HOME` authentication. | — | 🔲 | env/argv capture |
| EXTREV-18 | Codex rejects unknown or unsupported configuration through strict-config validation. | — | 🔲 | argv capture |
| EXTREV-19 | Codex receives the shared output schema as an output constraint. | — | 🔲 | argv capture |
| EXTREV-20 | Codex stdout events, stderr diagnostics, and final structured findings are stored as separate streams/artifacts. | — | 🔲 | fixture |
| EXTREV-21 | Codex color output is disabled. | — | 🔲 | argv capture |
| EXTREV-22 | Launcher startup rejects a Codex CLI that lacks any required capability with one versioned upgrade diagnostic. | — | 🔲 | fixture |
| EXTREV-66 | A Codex review timeout terminates the single attempt and emits a classified hard-failure receipt. | — | 🔲 | timer fixture |

### US-3 — Claude primary and classified fallback boundary

**As** a Codex-orchestrated review,
**I need** Fable 5 high to run safely and Opus xhigh to run only after a qualifying Fable failure,
**So that** authentication remains usable and fallback cannot hide cost or provider failures.

### Acceptance Criteria — US-3

| AC | Description | QA | E2E | Test |
|---|---|---|---|---|
| EXTREV-23 | Claude runs in print mode with the full requested model identifier and effort. | — | 🔲 | argv capture |
| EXTREV-24 | Claude uses safe mode and does not use bare mode, preserving OAuth/keychain compatibility. | — | 🔲 | argv capture |
| EXTREV-25 | Claude has no enabled tools. | — | 🔲 | argv capture |
| EXTREV-26 | Claude loads no MCP configuration or servers. | — | 🔲 | argv capture |
| EXTREV-27 | Claude runs with plan permission mode. | — | 🔲 | argv capture |
| EXTREV-28 | Claude does not persist a session. | — | 🔲 | argv capture |
| EXTREV-29 | Claude is limited to one turn. | — | 🔲 | argv capture |
| EXTREV-30 | Claude final output is constrained by the shared findings schema. | — | 🔲 | argv capture |
| EXTREV-31 | Claude execution is bounded by a configurable timeout. | — | 🔲 | fixture |
| EXTREV-32 | Claude execution is bounded by a configurable budget ceiling. | — | 🔲 | argv capture |
| EXTREV-33 | Claude runtime metadata must confirm the requested effective model before findings pass. | — | 🔲 | fixture |
| EXTREV-34 | A Fable-5 model-unavailable result authorizes one separate Opus-xhigh invocation. | — | 🔲 | fixture |
| EXTREV-35 | A Fable-5 model-entitlement result authorizes one separate Opus-xhigh invocation. | — | 🔲 | fixture |
| EXTREV-36 | A Fable-5 provider-overload result authorizes one separate Opus-xhigh invocation. | — | 🔲 | fixture |
| EXTREV-37 | An authentication failure never authorizes Opus fallback. | — | 🔲 | fixture |
| EXTREV-38 | Shared subscription-quota exhaustion never authorizes Opus fallback. | — | 🔲 | fixture |
| EXTREV-39 | A network failure never authorizes Opus fallback. | — | 🔲 | fixture |
| EXTREV-40 | A timeout never authorizes Opus fallback. | — | 🔲 | fixture |
| EXTREV-41 | Schema-invalid or malformed findings never authorize Opus fallback. | — | 🔲 | fixture |
| EXTREV-42 | The launcher does not use a hidden same-invocation fallback-model option. | — | 🔲 | argv capture |
| EXTREV-67 | A failed Opus fallback ends after exactly two total attempts and emits a hard-failure receipt. | — | 🔲 | call-count fixture |

### US-4 — Durable receipt and duplicate suppression

**As** a chain gate or later replay,
**I need** content-bound invocation evidence and conservative reuse,
**So that** a cached or fallback result cannot impersonate the requested primary review.

### Acceptance Criteria — US-4

| AC | Description | QA | E2E | Test |
|---|---|---|---|---|
| EXTREV-43 | Every invocation attempt emits a schema-valid receipt, including classified hard failures. | — | 🔲 | schema |
| EXTREV-44 | A receipt records package hash, schema identity, launcher version, CLI version, and timestamps. | — | 🔲 | schema |
| EXTREV-45 | A receipt records requested tuple, exact invocation tuple, and runtime effective tuple when exposed. | — | 🔲 | schema |
| EXTREV-46 | A receipt records exit classification, artifact paths, and usage/cost metadata when exposed. | — | 🔲 | schema |
| EXTREV-47 | A receipt records fallback and owner-override provenance without storing credentials. | — | 🔲 | schema |
| EXTREV-48 | Cache identity covers canonical package, requested tuple, findings schema, launcher version, and fixture-mode bit. | — | 🔲 | replay |
| EXTREV-49 | Only a schema-valid no-fallback receipt whose effective tuple equals the requested primary tuple is reusable. | — | 🔲 | replay |
| EXTREV-50 | A fallback receipt is never reusable for a later primary-model request. | — | 🔲 | replay |
| EXTREV-51 | A changed package forces a fresh primary invocation. | — | 🔲 | replay |
| EXTREV-52 | A changed tuple forces a fresh primary invocation. | — | 🔲 | replay |
| EXTREV-53 | A changed findings schema forces a fresh primary invocation. | — | 🔲 | replay |
| EXTREV-54 | A changed launcher version forces a fresh primary invocation. | — | 🔲 | replay |
| EXTREV-55 | The primary paid invocation itself is the model-availability probe. | — | 🔲 | call-count fixture |
| EXTREV-56 | No separate paid smoke invocation occurs before the primary call. | — | 🔲 | call-count fixture |

### US-5 — Complete consumer migration and free deterministic verification

**As** a framework maintainer,
**I need** every active independent-review consumer to use the launcher and every regression test to use controlled fixtures,
**So that** the contract cannot drift or spend model quota during Tier 1.

### Acceptance Criteria — US-5

| AC | Description | QA | E2E | Test |
|---|---|---|---|---|
| EXTREV-57 | `review-plan` dispatches external review only through the canonical launcher. | — | 🔲 | inventory |
| EXTREV-58 | `review-cross-model` dispatches external review only through the canonical launcher. | — | 🔲 | inventory |
| EXTREV-59 | `review-exec` consumes the launcher findings and invocation receipt. | — | 🔲 | inventory |
| EXTREV-60 | Blind and prompt floor judges dispatch their external verdict review only through the canonical launcher. | — | 🔲 | inventory |
| EXTREV-61 | Active review contracts contain no obsolete `codex -p ... --output-format` examples. | — | 🔲 | inventory |
| EXTREV-62 | Active source contains no consumer-local direct Claude/Codex independent-review invocation. | — | 🔲 | inventory |
| EXTREV-63 | Tier-1 launcher tests use fake CLIs and make zero paid model calls. | — | 🔲 | fixture |
| EXTREV-64 | Missing required CLI capability returns one actionable hard failure and attempts no degraded execution. | — | 🔲 | fixture |
| EXTREV-65 | Historical review transcripts and immutable receipts are excluded from active-source inventory migration. | — | 🔲 | inventory |
| EXTREV-68 | `SVC_EXTERNAL_REVIEW_DISABLED=1` prevents cache lookup and process spawn, ignores overrides, and emits a kill-switch receipt. | — | 🔲 | call-count fixture |
| EXTREV-69 | Empty review-package stdin fails before cache lookup or process spawn with an input-invalid receipt. | — | 🔲 | fixture |

## System Dependencies

### This feature depends on

| Dependency | Type | Spec exists? | What it provides | Mock strategy |
|---|---|---|---|---|
| Codex CLI | External integration | accepted WI-488 contract | Codex 5.6 sol independent review | Fake executable captures stdin, argv, env, stdout, stderr, and final output |
| Claude Code CLI | External integration | accepted WI-488 contract | Fable 5 primary and Opus fallback review | Fake executable emits classified exit and `modelUsage` fixtures |
| JSON Schema validation | Internal enabler | existing framework pattern | Findings and receipt validation | Local malformed/valid JSON fixtures |
| Chain receipt infrastructure | Internal enabler | `references/chain-receipt-contract.md` | Downstream proof binding | Temporary git fixture and replay cache |
| Reviewer policy authority | Internal enabler | `scripts/resolve-adversarial-reviewer.sh` | Requested tuple and override policy | Deterministic environment fixtures |

### Other features depend on this

| Consumer | Type | What it needs from us |
|---|---|---|
| `review-plan` | Review gate | Schema-valid findings plus exact invocation receipt |
| `review-cross-model` | Review primitive | Canonical external dispatch and classified failures |
| `review-exec` | Mandatory chain gate | Independent-family proof and fallback provenance |
| Floor judges | Quality guard | Schema-valid certifications without direct CLI drift |
| WI-486 and WI-487 delivery | Dependent framework work | Reliable Fable-5-high independent reviews after WI-488 promotion |

## Input and output contracts

### Launcher input

- Canonical review package bytes on stdin.
- Orchestrator identity and review mode supplied as explicit non-secret arguments or environment contract.
- Optional owner override supplied as a validated, receiptable authority artifact whose exact bytes match the out-of-band `SVC_EXTERNAL_REVIEW_OWNER_OVERRIDE_SHA256` trust anchor and whose authority is `repository-owner`.
- Empty stdin is `input-invalid` and terminates before cache lookup or process spawn.

### Launcher outputs

| Output | Required behavior | ACs |
|---|---|---|
| Findings JSON | Conforms to the shared schema and preserves consumer-specific payload under a common envelope | EXTREV-13, EXTREV-30 |
| Invocation receipt JSON | Describes request, execution, classification, provenance, usage, and artifacts | EXTREV-43–EXTREV-47 |
| Event stream | Separate from diagnostics and final findings | EXTREV-20 |
| Diagnostic stream | Actionable, classified, and free of credentials | EXTREV-20, EXTREV-64 |

## Event Contracts

| Event | Producer | Consumer | Payload | AC |
|---|---|---|---|---|
| `external_review.completed` | launcher | review consumer | findings artifact + valid no-fallback or fallback receipt | EXTREV-43 |
| `external_review.failed` | launcher | review consumer/operator | classified failure + actionable diagnostic + receipt | EXTREV-43, EXTREV-64 |
| `external_review.cache_hit` | launcher | review consumer | reusable receipt identity + findings artifact | EXTREV-49 |

## Feature Toggles

| Toggle | Local default | What it controls | ACs affected |
|---|---|---|---|
| `SVC_EXTERNAL_REVIEW_DISABLED` | `0` | When `1`, hard-fail before cache lookup or provider invocation with a kill-switch receipt; it never selects a cheaper/degraded reviewer | EXTREV-68 |
| `SVC_EXTERNAL_REVIEW_FIXTURE` | unset | Accepted only with fake CLI roots created by the Tier-1 harness; fixture receipts cannot satisfy real requests | EXTREV-63 |
| `SVC_EXTERNAL_REVIEW_CACHE_TTL_DAYS` | `30` | Retention for unlocked cache entries and abandoned staging directories removed by explicit `--gc-cache`; positive integer only | EXTREV-48–54 |
| `SVC_EXTERNAL_REVIEW_TIMEOUT_SECONDS` | `1200` | Wall-time ceiling for each provider attempt; positive integer only; raised by WI-489 after a complete high-effort review package exceeded the original five-minute bound | EXTREV-31, EXTREV-66 |
| `SVC_EXTERNAL_REVIEW_MAX_BUDGET_USD` | `50` | Metered-cost ceiling for the complete launcher review; a fallback receives only the unspent remainder, so two attempts cannot double the review ceiling | EXTREV-32, EXTREV-67 |
| `SVC_EXTERNAL_REVIEW_LOCK_STALE_SECONDS` | `2460` | Foreign-host lock reclaim bound; must be at least `2 * timeout + 60`; owner heartbeat refreshes every 30 seconds | EXTREV-48–56 |
| `SVC_EXTERNAL_REVIEW_OWNER_OVERRIDE_SHA256` | unset | Out-of-band trust anchor that must equal the exact owner-override file hash before any over-policy tuple is accepted | EXTREV-07–09 |

No toggle may weaken tuple, schema, fallback, receipt, or cache validation. Owner overrides alter an explicitly receipted tuple rather than bypassing validation.

## Industry Grounding

**Source:** inapplicable for an internal framework transport
**Landscape state:** inapplicable
**Gate verdict:** SKIP
**Branch taken:** inapplicable

### What the industry does

No customer-facing competitive flow exists. Current installed CLI capability and official provider contracts are the relevant grounding and are recorded in `docs/specs/research-log.md` and `references/knowledge/domains/agent-harnesses/`.

### What we're doing

Treating independent review as a bounded paid external action with explicit isolation, schema, fallback, and evidence contracts.

### Why we differ or align

We align with each CLI's supported non-interactive structured-output controls while adding framework-owned cross-provider policy, conservative cache reuse, and chain evidence.

### Reversibility

Two-way door. The migration is atomic but can be reverted by restoring the prior resolver and consumers together; provider-specific details remain behind the launcher boundary.

## Technical Design

### Architecture

`scripts/run-external-review.mjs` is the only paid independent-review executor. It contains four explicit internal boundaries: policy resolution, provider process adapters, structural/semantic validation, and locked cache/receipt publication. `scripts/resolve-adversarial-reviewer.sh` becomes a compatibility policy-view wrapper over the launcher; it never probes a paid model or executes a review. Existing review scripts remain consumer adapters that build a package, pipe it to the launcher, and translate the shared findings envelope when legacy output is required.

The design uses existing zero-dependency primitives: `node:child_process` with argv arrays, `node:crypto` hashing, `scripts/lib/json-schema-validator.mjs`, and atomic/locked `.svc` state helpers. No package manager or new runtime dependency is introduced.

```text
consumer adapter
   |
   v
stdin package --> policy --> cache-key lock --> exact reusable primary?
                                      | yes              | no
                                      v                  v
                              validated artifacts   capability gate
                                                         |
                                  +----------------------+
                                  |                      |
                                  v                      v
                           Codex adapter            Claude adapter
                           read-only/JSONL          safe/no-tools/JSON
                                  |                      |
                                  +----------+-----------+
                                             v
                                  semantic findings check
                                             |
                         +-------------------+--------------------+
                         | success           | eligible Fable     | other failure
                         v                   v                    v
                  atomic publish       separate Opus        failure receipt
                                      xhigh attempt         no fallback
```

#### Invocation state machine

```text
START
  -> DISABLED ------------------------------------> HARD_FAILURE_KILL_SWITCH
  -> POLICY_VALIDATED
  -> LOCKED
  -> CACHE_HIT -------------------------------> SUCCESS_CACHED
  -> CAPABILITY_VALIDATED
  -> PRIMARY_RUNNING
       -> PRIMARY_VALID ----------------------> SUCCESS_PRIMARY
       -> FABLE_MODEL_UNAVAILABLE --+
       -> FABLE_MODEL_ENTITLEMENT ---+--------> FALLBACK_RUNNING
       -> FABLE_PROVIDER_OVERLOAD ---+              -> FALLBACK_VALID -> SUCCESS_FALLBACK
                                                    -> FALLBACK_FAILED -> HARD_FAILURE
       -> AUTH | SHARED_QUOTA | NETWORK | TIMEOUT
          | SCHEMA | CAPABILITY | MODEL_MISMATCH
          | UNKNOWN --------------------------> HARD_FAILURE

Every terminal state atomically emits a receipt. Only SUCCESS_PRIMARY is reusable
for a later request for that primary tuple.
```

### Components

| Component | Type | Responsibility | New/Modify |
|---|---|---|---|
| `scripts/run-external-review.mjs` | CLI service | Resolve policy, validate capabilities/overrides, spawn exact provider command, classify failures, validate artifacts, lock/cache, emit summary | New |
| `schemas/external-review-findings.schema.json` | Contract | Shared normalized findings/certifications envelope | New |
| `schemas/external-review-receipt.schema.json` | Contract | Invocation attempts, tuples, hashes, usage, classification, provenance, and artifacts | New |
| `scripts/resolve-adversarial-reviewer.sh` | Compatibility adapter | Print launcher's requested policy tuple only; no host/model availability probe | Modify |
| `scripts/review-plan-codex.sh` | Consumer adapter | Build plan review package on stdin and consume shared findings/receipt | Modify |
| `scripts/blind-floor-judge.sh` | Consumer adapter | Translate shared certifications for blind-floor caller | Modify |
| `scripts/prompt-floor-judge.sh` | Consumer adapter | Translate shared certifications for prompt-floor caller | Modify |
| Review skill/protocol docs | Contract consumers | Require the launcher and receipt, remove direct commands/cascades | Modify |
| `test-framework/evals/tier-1/validate-external-review-launcher.sh` | Fixture harness | Generate fake CLIs and prove exact argv/stdin/env/streams/classification/cache/inventory | New |

Four new files are planned, below the design-tech scope-reduction trigger. One new runtime service is introduced.

### Data Model

No database or persistent product schema changes are required. Two JSON contracts and one local content-addressed artifact layout are introduced:

```text
.svc/external-review-cache/v1/<sha256>/
  findings.json
  receipt.json
  events.jsonl
  stderr.log
  final.json
```

The cache key is SHA-256 over length-delimited bytes for: exact stdin package, canonical requested primary tuple JSON, findings-schema bytes/hash, launcher version, and fixture-mode bit. Per-key locking covers lookup, invocation, validation, and atomic staging-directory promotion. Each lock binds hostname, PID, launcher-process start token, random owner token, and heartbeat timestamp. Same-host PID reuse is detected by start-token mismatch; foreign-host locks cannot be reclaimed before `SVC_EXTERNAL_REVIEW_LOCK_STALE_SECONDS`, startup rejects a stale bound below `2 * timeout + 60`, and only the matching owner token may atomically heartbeat or remove a live lock. A crash may leave an unpromoted staging directory; it is never considered a cache hit. Explicit `--gc-cache` removes only unlocked entries/staging older than `SVC_EXTERNAL_REVIEW_CACHE_TTL_DAYS` (default 30), never follows symlinks, and skips held locks.

The findings schema requires `schema_version`, `review_kind`, reviewer tuple, verdict, summary, `findings[]`, and `certifications[]`. The receipt schema requires identity hashes/versions, requested and effective tuples, ordered `attempts[]`, classification, fallback/override provenance, usage availability, and artifact paths. The launcher adds semantic checks the repository's schema subset cannot express: 64-hex hashes, requested/invocation/effective tuple equality, allowed fallback classes, exact attempt count/order, override source integrity, and cache-reuse rules.

### Data Flow

1. A consumer writes only the canonical review package to launcher stdin and supplies explicit `--orchestrator`, `--review-kind`, and artifact/cache options.
2. The launcher derives the primary tuple from fixed policy. A requested effort/model override is rejected unless a schema-valid owner-override file names the exact requested tuple, `authority: repository-owner`, source, reason, and timestamp and its exact byte hash matches `SVC_EXTERNAL_REVIEW_OWNER_OVERRIDE_SHA256`; the expected/actual hash and provenance are receipted.
3. The launcher hashes the input identity, takes the per-key lock, and revalidates any candidate cached findings and receipt.
4. On a cache miss, a local capability gate checks CLI existence/version/help flags. It makes no model call. Missing capabilities produce one consolidated diagnostic and a failure receipt.
5. Codex is spawned with `codex exec`, stdin, read-only, ephemeral, ignore-user-config, ignore-rules, strict-config, exact model/high, output schema, JSONL, final-message path, no color, and the same launcher timer used for Claude. `CODEX_HOME` is inherited unchanged; no credential value is logged.
6. Claude is spawned with print mode, full model ID/high, safe mode, empty tools, strict empty MCP config, plan permission, no persistence, one turn, JSON schema/output, budget, and launcher timer. Bare mode and automatic fallback-model are absent.
7. Provider stdout, stderr, events, and final findings are captured separately. Only structured provider error codes and ordered diagnostic patterns can classify availability; final model-authored content is never inspected for availability.
8. Fable model-unavailable, model-entitlement, or provider-overload starts one new Opus-xhigh process. Every other class terminates without fallback.
9. The launcher validates findings, runtime effective-model metadata when exposed, and receipt semantics, atomically promotes artifacts, releases the lock, and prints a machine-readable artifact summary.

### External Dependencies

No new library dependency is added. Runtime dependencies remain the installed `codex` and `claude` CLIs plus their operator-owned authentication. Minimum compatibility is capability-based and anchored to the verified surfaces in Codex CLI 0.144.4 and Claude Code 2.1.210. A newer CLI passes only if all required flags and output contracts remain available.

### Provider invocation tuples

| Orchestrator | Attempt | Reviewer host/family | Requested model | Effort | Fallback eligibility |
|---|---|---|---|---|---|
| Claude | primary | Codex / OpenAI | Codex 5.6 sol, exact CLI ID held in policy | high | none; any failure hard-fails |
| Codex | primary | Claude / Anthropic | Fable 5, full CLI model ID held in policy | high | only model-unavailable, model-entitlement, provider-overload |
| Codex | fallback | Claude / Anthropic | current owner-approved Opus full model ID | xhigh | none; separate invocation only |

The launcher records the semantic name and exact CLI ID. Alias acceptance requires runtime metadata to prove the intended family/version; otherwise the attempt is model-unavailable or model-mismatch and cannot silently pass.

### Feature-toggle and mock architecture

`SVC_EXTERNAL_REVIEW_DISABLED=1` is the paid-action kill switch. It stops before cache lookup or process spawn, emits a classified receipt, and cannot be overridden by a consumer or owner-effort override. Normal developer and production-like use defaults it to `0`; CI/Tier 1 sets fixture mode and fake CLI paths; emergency operations set it to `1` to prevent all review continuation until deliberately restored.

`SVC_EXTERNAL_REVIEW_FIXTURE=1` is accepted only by the Tier-1 harness with fake CLI paths rooted under its temporary fixture. The launcher receipts `fixture_mode:true`, includes that bit in cache identity, and never reuses fixture receipts for a non-fixture request. Normal local use with zero credentials exercises `--validate-capabilities` and fixture replay only; a real review intentionally requires existing CLI authentication.

### Technology Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Runtime | One zero-dependency Node `.mjs` launcher | Safe argv/process/stream/timer/hash/JSON handling with existing repo primitives |
| Policy ownership | Launcher-owned fixed tuple table; shell resolver is a view | Prevents resolver/executor drift while preserving existing call surface during migration |
| Schema | Shared structural schemas plus semantic validation | Fits the existing JSON-schema subset and fails closed on cross-field invariants |
| Cache | Per-key lock and atomic staging promotion | Prevents concurrent duplicate spend and partial cache hits |
| Failure taxonomy | Structured codes first; conservative ordered diagnostics second | Allows only explicitly eligible fallback and treats ambiguity as hard failure |
| Authentication | Preserve auth environment; isolate behavior/configuration instead | `CODEX_HOME` and Claude OAuth/keychain remain usable without inheriting rules/tools/customizations |
| Consumer migration | Thin adapters plus active-source inventory validator | Keeps caller-specific output compatibility without alternate paid execution paths |

### Test Matrix

| Component | Unit/fixture proof | Integration/replay proof | Paid/live proof |
|---|---|---|---|
| Policy/override | Tuple fixtures for both orchestrators and escalation rejection | Resolver compatibility output equals launcher policy | None in Tier 1 |
| Codex adapter | Fake CLI captures exact argv/stdin/env, timer termination, and split artifacts | Cache hit/miss and effective-tuple mismatch replay | First real Claude-orchestrated review after promotion if requested by later WI |
| Claude adapter | Fake CLI captures safe/no-tools/no-MCP/plan/no-persist/turn/schema/budget | Eligible/forbidden fallback matrix plus failed-Opus two-attempt stop | WI-486 Fable-5-high review |
| Schemas/semantics | Valid/malformed findings and receipts | Forged override, fallback laundering, changed identity inputs | None |
| Controls/consumers | Kill-switch and empty-stdin zero-spawn fixtures; source inventory | Plan/floor sample package replay | WI-486/WI-487 independent reviews |

### Cost Model

| Dimension | Unit cost | Expected volume | Monthly estimate | Scaling curve | Paid by |
|---|---|---|---|---|---|
| Compute | Local Node process plus one CLI child; negligible CPU | One launcher per guarded review | approximately $0 local compute | Linear in review attempts | Operator machine |
| Storage | Findings/receipt/events/log artifacts, normally under 1 MB/review | Tens of reviews/month | negligible local disk | Linear, content-addressed dedupe | Operator machine |
| Bandwidth | Provider request/response tokens | One primary request on cache miss | Provider/subscription dependent | Linear in uncached package tokens | Repository owner |
| External API/model usage | Primary high-effort review; rare authorized Opus xhigh second call | Cache miss only; max two calls only on eligible Fable failure | Not asserted because provider pricing/allowance varies; receipt records usage/cost when exposed | Linear in uncached tokens; fallback adds one bounded call | Repository owner/subscription |
| Background jobs | None | zero | $0 | constant zero | N/A |

**Scaling triggers:** review-package size and uncached review count are the cost drivers. A budget/timeout breach hard-fails; it does not raise effort or fall back. Repeated fallback rate above 10% over ten reviews is an operational signal to inspect Fable availability/entitlement rather than normalize Opus spend.

**First month/year 1:** no reliable currency projection is possible without provider price/allowance telemetry. The enforceable projection is one paid primary per unique identity and at most one additional Opus call for an eligible Fable failure; receipts expose actual usage/cost when available.

### Operations & Ownership

| Dimension | Answer |
|---|---|
| Owner | svc framework maintainer/repository owner |
| On-call | Best-effort maintainer response; no paging service |
| SLA / SLO | Fail closed before chain progression; no silent degraded review; best-effort provider availability |
| Error budget | Zero accepted silent tuple/fallback/schema/cache violations; provider downtime is surfaced, not hidden |
| Monitoring | Per-invocation receipt classification, attempt count, effective tuple, cache disposition, and usage metadata |
| Alerting | Immediate actionable CLI stderr/exit to the invoking chain; no external alert channel |
| Dashboard | None; receipt/cache inventory is the local evidence surface |
| Runbook | Diagnostic names installed CLI/version, missing capability or failure class, receipt path, and exact recovery action; stale per-key locks bind hostname, PID, process-start token, owner token, and a 30-second heartbeat timestamp; stale bound must exceed two provider timeouts plus 60 seconds; retry only after state changes; lock-safe `--gc-cache` defaults to 30-day retention |
| Failure modes | Kill switch engaged, empty input, missing CLI/flag, auth, entitlement/model unavailable, shared quota, overload, network, timeout, schema/malformed findings, tuple mismatch, fallback failure, cache/lock failure |
| Recovery procedure | Disable only during a spend incident; restore the toggle deliberately; upgrade/re-auth/restore entitlement/wait for overload or quota reset/fix schema; stale locks use same-host PID/start-token identity and foreign-host timestamp bounds; `--gc-cache` skips held locks and removes only expired entries/staging; rerun identical package, allowing only valid primary cache reuse |
| Backup / restore | No credentials or authoritative product data stored; committed review outputs remain normal git evidence, local cache is regenerable |
| Dependencies' failure impact | Review chain stops with classified evidence; implementation/landing cannot claim independent review until a valid receipt exists |

### Feasibility Matrix

| AC | Persona pressure | Feasible? | Technical proof |
|---|---|---|---|
| EXTREV-01 | N/A - system-only | yes | Fixed Claude policy fixture |
| EXTREV-02 | N/A - system-only | yes | Codex-unavailable failure fixture |
| EXTREV-03 | N/A - system-only | yes | Attempt-count assertion |
| EXTREV-04 | N/A - system-only | yes | Fixed Codex policy fixture |
| EXTREV-05 | N/A - system-only | yes | Tuple schema |
| EXTREV-06 | N/A - system-only | yes | Policy/receipt schema |
| EXTREV-07 | N/A - system-only | yes | Override semantic validator |
| EXTREV-08 | N/A - system-only | yes | Override semantic validator |
| EXTREV-09 | N/A - system-only | yes | Override-file hash/source receipt |
| EXTREV-10 | N/A - system-only | yes | Runtime model metadata validator |
| EXTREV-11 | N/A - system-only | yes | Tuple equality validator |
| EXTREV-12 | N/A - system-only | yes | Fake CLI stdin capture |
| EXTREV-13 | N/A - system-only | yes | Shared schema validator |
| EXTREV-14 | N/A - system-only | yes | Codex argv fixture |
| EXTREV-15 | N/A - system-only | yes | Codex argv fixture |
| EXTREV-16 | N/A - system-only | yes | Codex argv fixture |
| EXTREV-17 | N/A - system-only | yes | Codex argv/env fixture |
| EXTREV-18 | N/A - system-only | yes | Codex argv/capability fixture |
| EXTREV-19 | N/A - system-only | yes | Codex argv fixture |
| EXTREV-20 | N/A - system-only | yes | Separate artifact assertions |
| EXTREV-21 | N/A - system-only | yes | Codex argv fixture |
| EXTREV-22 | N/A - system-only | yes | Missing-flag fixture |
| EXTREV-23 | N/A - system-only | yes | Claude argv fixture |
| EXTREV-24 | N/A - system-only | yes | Safe/bare-negative fixture |
| EXTREV-25 | N/A - system-only | yes | Empty-tools fixture |
| EXTREV-26 | N/A - system-only | yes | Strict empty-MCP fixture |
| EXTREV-27 | N/A - system-only | yes | Plan-permission fixture |
| EXTREV-28 | N/A - system-only | yes | No-persistence fixture |
| EXTREV-29 | N/A - system-only | yes | One-turn fixture |
| EXTREV-30 | N/A - system-only | yes | Claude schema fixture |
| EXTREV-31 | N/A - system-only | yes | Launcher timer fixture |
| EXTREV-32 | N/A - system-only | yes | Budget argv fixture |
| EXTREV-33 | N/A - system-only | yes | modelUsage mismatch fixture |
| EXTREV-34 | N/A - system-only | yes | Model-unavailable two-attempt fixture |
| EXTREV-35 | N/A - system-only | yes | Entitlement two-attempt fixture |
| EXTREV-36 | N/A - system-only | yes | Overload two-attempt fixture |
| EXTREV-37 | N/A - system-only | yes | Auth one-attempt fixture |
| EXTREV-38 | N/A - system-only | yes | Shared-quota one-attempt fixture |
| EXTREV-39 | N/A - system-only | yes | Network one-attempt fixture |
| EXTREV-40 | N/A - system-only | yes | Timeout one-attempt fixture |
| EXTREV-41 | N/A - system-only | yes | Malformed/schema one-attempt fixture |
| EXTREV-42 | N/A - system-only | yes | Fallback-model negative inventory |
| EXTREV-43 | N/A - system-only | yes | Success/failure receipt schema fixtures |
| EXTREV-44 | N/A - system-only | yes | Receipt schema fixture |
| EXTREV-45 | N/A - system-only | yes | Receipt schema plus tuple semantics |
| EXTREV-46 | N/A - system-only | yes | Receipt schema fixture |
| EXTREV-47 | N/A - system-only | yes | Redacted provenance fixture |
| EXTREV-48 | N/A - system-only | yes | Deterministic key fixture |
| EXTREV-49 | N/A - system-only | yes | Exact-primary replay fixture |
| EXTREV-50 | N/A - system-only | yes | Fallback-laundering negative fixture |
| EXTREV-51 | N/A - system-only | yes | Changed-package replay fixture |
| EXTREV-52 | N/A - system-only | yes | Changed-tuple replay fixture |
| EXTREV-53 | N/A - system-only | yes | Changed-schema replay fixture |
| EXTREV-54 | N/A - system-only | yes | Changed-launcher replay fixture |
| EXTREV-55 | N/A - system-only | yes | Primary call-count fixture |
| EXTREV-56 | N/A - system-only | yes | No-smoke call-count fixture |
| EXTREV-57 | N/A - system-only | yes | Active-source inventory |
| EXTREV-58 | N/A - system-only | yes | Active-source inventory |
| EXTREV-59 | N/A - system-only | yes | review-exec contract fixture |
| EXTREV-60 | N/A - system-only | yes | Floor adapter fixtures |
| EXTREV-61 | N/A - system-only | yes | Obsolete-command negative grep |
| EXTREV-62 | N/A - system-only | yes | Direct-review command allowlist validator |
| EXTREV-63 | N/A - system-only | yes | Fake PATH and invocation counter |
| EXTREV-64 | N/A - system-only | yes | Consolidated capability diagnostic fixture |
| EXTREV-65 | N/A - system-only | yes | Inventory excludes archive/history roots |
| EXTREV-66 | N/A - system-only | yes | Codex launcher-timer fixture |
| EXTREV-67 | N/A - system-only | yes | Failed-Opus two-attempt call-count fixture |
| EXTREV-68 | N/A - system-only | yes | Kill-switch zero-cache/zero-spawn fixture |
| EXTREV-69 | N/A - system-only | yes | Empty-stdin zero-cache/zero-spawn fixture |

All 69 ACs are feasible without unresolved design risk.

### Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Provider error wording changes | Eligible Fable outage may hard-fail instead of falling back | Prefer structured codes; fail closed; add a fixture before expanding classifier |
| Runtime model metadata is absent | Exact effective tuple cannot be proven | Record unavailable metadata and reject when the provider path requires proof; never infer from requested alias alone |
| Cache key race | Duplicate paid calls | Per-key lock before lookup and through publication |
| Partial artifact write | False cache hit or unverifiable review | Stage then atomically promote only after both schemas and semantic checks pass |
| Consumer output compatibility | Existing floor/plan parsers break | Keep thin adapters and replay sample legacy shapes |
| Diagnostics leak credentials | Security exposure | Store argv without secret env values; redact known token/key patterns; never serialize auth stores |
| Runaway or emergency spend | Continued paid calls during an incident | `SVC_EXTERNAL_REVIEW_DISABLED=1` hard-stops before cache or provider use and emits a receipt |

### Trade-offs

| Trade-off | Chose | Over | Rationale |
|---|---|---|---|
| Availability vs cost correctness | Fail closed on ambiguity | Opportunistic fallback | Owner explicitly limits Opus to three classes |
| Dependency richness vs durability | Built-in Node + existing helpers | Ajv/orchestration library | Keeps setup/install surface unchanged |
| Cache portability vs isolation | Repo/worktree-local `.svc` cache | Shared global cache | Avoids cross-repo evidence contamination and credential/context leakage |
| Migration atomicity vs patch size | Migrate all active review consumers together | Partial rollout | Any alternate direct paid path defeats the invariant |

### Adversarial Engineering Review

- `[Layer 1] [Confidence: 10/10]` Use existing Node schema/state primitives; no new package is justified.
- `[Layer 1] [Confidence: 10/10]` Shell remains an adapter, not the process/JSON/cache authority.
- `[Layer 3] [Confidence: 9/10]` The paid primary call is also the availability probe; a local capability check is free and does not weaken this rule.
- `[Layer 3] [Confidence: 9/10]` A fallback receipt is deliberately non-reusable for primary demand, trading cost for reviewer-family/version truth after recovery.
- `[Layer 1] [Confidence: 9/10]` Atomic per-key locking is required because write-only locking still permits duplicate paid misses.

The design is reversible by reverting the launcher, schemas, consumer adapters, and contract docs together. It introduces no database migration, remote state, or new package dependency.

## Pillars Coverage Matrix

| # | Pillar | State | Artifact / note |
|---|---|---|---|
| 1 | Product fit | [UNCHANGED — VERIFIED] | `FRAMEWORK-STATE.md`; independent review remains a mandatory quality mechanism |
| 2 | Journey | [UPDATED] | System flow and event contracts in this spec define the headless contract journey |
| 3 | Acceptance criteria | [UPDATED] | EXTREV-01 through EXTREV-69 in this spec |
| 4 | UX | [N/A — justified] | Internal CLI transport has no user interaction, accessibility, or display states |
| 5 | UI | [N/A — justified] | Internal CLI transport has no visual component or screenshot surface |
| 6 | Tech architecture | [UPDATED] | Complete launcher architecture and contract map in this spec and `docs/specs/contract-maps/wi-488-external-review-invocation.md` |
| 7 | Cost model | [UPDATED] | Bounded paid-call model and scaling triggers in Technical Design |
| 8 | Operations & ownership | [UPDATED] | Failure taxonomy, observability, recovery, and ownership in Technical Design |

## Scope Review

**Mode:** Hold. The accepted contract is complete for the narrowest coherent boundary: all active independent-review consumers and no unrelated model invocations.

- Zero silent failures: every invocation ends in validated findings/receipt or a classified actionable failure.
- Every error has a name: fallback-eligible and forbidden classes are enumerated.
- Shadow paths: primary success, cache hit, three allowed availability failures, and six forbidden fallback classes are explicit.
- Edge cases: alias drift, tuple mismatch, missing capabilities, malformed output, fallback replay, and override forgery are covered.
- Observability: receipts and separated artifacts are first-class outputs.
- Diagram: the complete dispatch/cache/fallback flow is shown above.
- Deferrals: none inside WI-488; WI-486 and WI-487 are explicit dependent WIs, not deferred sub-scope.
- Six-month future: consumer-local commands are prohibited so provider changes remain behind one boundary.
- Scrap test: removing independent reviews or replacing them with self-review would violate the mandatory-chain quality objective.

## Implementation Notes

- `VERIFIED` — the canonical zero-dependency Node launcher is promoted at commit `71e01336d733ab324c8dd8fbc0a7e5c2a6662a21`.
- `VERIFIED` — shared findings and invocation-receipt schemas are promoted and fixture validated.
- `VERIFIED` — the resolver is a policy-view compatibility wrapper over the canonical launcher.
- `VERIFIED` — plan, cross-model, review-exec, blind-floor, and prompt-floor consumers use the launcher.
- `VERIFIED` — 97 fixture-controlled launcher assertions and 22 readonly review assertions pass without paid model calls.

## Promotion Verification

G7 passed on 2026-07-15. All 69 acceptance criteria are mapped to passing fixture, schema, replay, inventory, or call-count evidence in `docs/specs/audit/wi-488-deterministic-external-reviewer-analysis.md`. Promoted `origin/main` passed both installed CLI capability probes and the complete Tier-1 suite: 244 scripts passed, 0 failed, 0 timed out. The detailed promoted-state report is `docs/specs/verification/wi-488-deterministic-external-reviewer.md`.

## Journey References

The system-flow diagram and event contracts in this spec are the contract journey. A separate user journey is not applicable because this Enabler has no human-facing flow.

## Revision Log

| Date | AC | Was | Now | Why | By skill |
|---|---|---|---|---|---|
| 2026-07-15 | EXTREV-01–65 | Accepted WI/proposal contract | Baseline AC set | Convert the accepted owner contract into atomic fixture-verifiable requirements | write-spec |
| 2026-07-15 | EXTREV-48 | Four-part cache identity | Include fixture-mode bit | Prevent fixture evidence from sharing a real-review cache identity | design-tech G4 |
| 2026-07-15 | EXTREV-66 | (new) | Codex timeout hard-fails after one attempt | Bound the cache-lock and chain stall surface on both providers | design-tech G4 |
| 2026-07-15 | EXTREV-67 | (new) | Failed Opus fallback stops after exactly two attempts | Prove fallback cannot cascade | design-tech G4 |
| 2026-07-15 | EXTREV-68 | (new) | Kill switch prevents cache/provider use and ignores override | Make the paid-action emergency control regression-testable | design-tech G4 |
| 2026-07-15 | EXTREV-69 | (new) | Empty stdin fails before cache/provider use | Name and prove the launcher input boundary | design-tech G4 |
