---
status: BASELINED
type: Integration
mode: contract-change
wi: WI-489
landscape_state: inapplicable
landscape_inapplicable_reason: internal framework-to-model-provider review transport with no customer-facing competitive flow
created: 2026-07-16
supersedes:
  - WI-488 EXTREV-29
  - WI-488 EXTREV-33
---

# Feature: Truthful reviewer protocol and runtime routing

**Status:** BASELINED
**Type:** Integration
**Consumers:** `review-plan`, `review-cross-model`, `review-exec`, review gates, floor judges, framework maintainers
**Priority:** critical
**Source:** WI-489 owner decision, promoted WI-488 contract, real WI-486 launcher failures, official Claude Code/Fable behavior

## Delta contract

**Invariant behavior preserved:** WI-488 remains authoritative for the single canonical stdin launcher, shared findings schema, Claude-orchestrated Codex 5.6 sol/high route, read-only/safe isolation, explicit availability fallback classes, forbidden fallback classes, no paid smoke probe, consumer migration, content-addressed cache inputs, and Tier-1 fixture-only execution.

**Behavior superseded:**

- WI-488 EXTREV-29 no longer limits Claude to one agentic turn. The launcher allows at most four agentic protocol turns inside one bounded CLI/provider invocation.
- WI-488 EXTREV-33 no longer requires every successful Claude review to report the requested model as the effective model. An exact Fable request may complete on Opus 4.8 only through a corroborated Anthropic provider-safety route under the isolated invocation envelope.
- Codex-orchestrated reviewer policy becomes profile-based: `fable-high` before the owner cutover and `opus-high` at and after the cutover, with an explicit receipted `fable-high` selection available without a code edit.

**Explicit boundary:** WI-489 does not alter WI-486 session/bootstrap ownership or WI-487 installation/hook work. It does not claim Fable's post-July-19 pricing, entitlement, or availability. It does not change unrelated Claude/Codex worker, evaluation, extraction, or creative calls.

## Problem Statement

The promoted launcher ends a real Claude structured-output review when the model reaches the schema tool boundary because it equates one paid primary invocation with one agentic turn. The structured `error_max_turns` result is then mislabeled `unknown_provider`, so the operator receives neither findings nor the actionable cause.

The same launcher assumes that every effective-model change is launcher-controlled. Claude Code can instead re-run a safeguard-blocked Fable request on Opus 4.8 inside the same conversation. Without a distinct provider-route state, the launcher can either discard legitimate findings, misstate the effective tuple, make unsafe cache claims, or risk a redundant Opus attempt.

Finally, the owner requires a deterministic policy cutover to Opus 4.8/high at `2026-07-19T21:00:00Z` (`2026-07-20 00:00:00 EEST`, `Europe/Sofia`) and an easy, explicit, receipted path back to Fable 5/high.

## Goals

- Complete Claude schema negotiation within a fixed four-turn ceiling while proving one paid primary invocation.
- Name schema-turn exhaustion and keep it ineligible for any Opus fallback.
- Accept legitimate provider safety-routing without treating model observation alone as proof.
- Prevent a provider-routed Opus response from causing a second Opus invocation or satisfying a Fable-primary cache request.
- Resolve reviewer profiles deterministically at an absolute instant and make explicit selection/status observable without provider calls.
- Keep every preserved WI-488 safety, isolation, cache, and consumer invariant intact.

## Non-goals

- Predicting whether Fable becomes on-demand, paid, unavailable, or generally accessible after 2026-07-19.
- Changing Claude-orchestrated review away from Codex 5.6 sol/high.
- Raising Fable, Opus, or Codex above high effort.
- Reusing a provider-routed or launcher-fallback receipt as exact Fable-primary evidence.
- Creating a second launcher or consumer-local model command.
- Starting WI-486 implementation or any WI-487 work before WI-489 promotion verification.

## Headless system journey

```text
review consumer
  -> canonical package on stdin
  -> resolve reviewer profile at one absolute clock instant
       -> scheduled fable-high before cutover
       -> scheduled opus-high at/after cutover
       -> valid explicit fable-high selection overrides schedule and is receipted
  -> exact reusable-primary cache lookup
       -> hit: return validated exact-primary findings/receipt
       -> miss: start one primary CLI/provider invocation
            -> Claude schema protocol completes in <= 4 agentic turns
                 -> exact requested model success: exact-primary receipt
                 -> corroborated Fable -> Opus safeguard rerun:
                      provider_safety_route receipt; no second Opus; no Fable-primary reuse
                 -> structured max-turn exhaustion:
                      schema_turn_budget failure; no fallback
                 -> eligible Fable availability failure:
                      one separate owner-policy fallback only when the selected profile allows it
                 -> every other failure: classified hard failure
  -> consumer receives schema-valid findings and truthful receipt, or one actionable failure
```

## Consumer Stories

### US-1 — Bounded schema protocol

**As** a review consumer,
**I need** one paid Claude primary invocation to complete its structured-output protocol within a fixed turn, time, and dollar budget,
**So that** schema negotiation succeeds without an unbounded retry loop or a duplicate availability probe.

### Acceptance Criteria — US-1

| AC | Description | QA | E2E | Test |
|---|---|---|---|---|
| EXTREV-70 | Every Claude review invocation is limited to exactly four agentic turns. | — | 🔲 | argv fixture |
| EXTREV-71 | Multiple agentic turns within one Claude process count as one paid primary invocation. | — | 🔲 | call-count replay |
| EXTREV-72 | A two-turn schema tool handshake can return schema-valid findings from one primary invocation. | — | 🔲 | protocol replay |
| EXTREV-73 | A structured result with `subtype=error_max_turns` or `terminal_reason=max_turns` is classified `schema_turn_budget`. | — | 🔲 | result fixture |
| EXTREV-74 | `schema_turn_budget` records the reported turn count, configured ceiling, stop reason, terminal reason, and provider errors when present. | — | 🔲 | receipt fixture |
| EXTREV-75 | `schema_turn_budget` never authorizes a launcher-created Opus attempt. | — | 🔲 | call-count fixture |
| EXTREV-76 | Repeated schema-validation re-prompts stop at the four-turn ceiling and cannot loop. | — | 🔲 | exhaustion replay |
| EXTREV-77 | The 1,200-second per-attempt timeout and $50 whole-review dollar ceiling remain enforced across all protocol turns; fallback receives only a trustworthy reported remainder and fails closed when primary cost is unavailable. | — | 🔲 | timer/argv fixture |
| EXTREV-78 | The primary review invocation remains the availability probe; no separate paid smoke invocation occurs. | — | 🔲 | call-count fixture |

### US-2 — Provider-managed Fable safety routing

**As** a Codex-orchestrated review consumer,
**I need** a safeguard-routed Fable request to be distinguished from launcher fallback and unexplained model drift,
**So that** legitimate Opus findings can be used once without false tuple, effort, cache, or cost claims.

### Acceptance Criteria — US-2

| AC | Description | QA | E2E | Test |
|---|---|---|---|---|
| EXTREV-79 | A `fable-high` primary invokes the exact full Fable 5 model identifier at high effort. | — | 🔲 | argv fixture |
| EXTREV-80 | The Fable primary invocation does not configure Claude CLI availability fallback. | — | 🔲 | negative argv fixture |
| EXTREV-81 | The isolated Fable invocation forces Claude Code's supported refusal-model switching state on and removes the refusal-fallback disable environment control. | — | 🔲 | settings/env fixture |
| EXTREV-82 | The isolated invocation prevents inherited model settings from changing the exact requested Fable model. | — | 🔲 | env/settings fixture |
| EXTREV-83 | Effective Opus 4.8 model usage is accepted only when a controlled Fable invocation envelope proves automatic switching was enabled, CLI fallback was absent, inherited refusal/model remaps were scrubbed, and the same process reports exact Opus 4.8 usage. | — | 🔲 | route replay |
| EXTREV-84 | Effective Opus observation without corroborating provider-route evidence is `model_mismatch`. | — | 🔲 | negative replay |
| EXTREV-85 | An accepted safeguard rerun records route kind `provider_safety_route` and labels causation `provider_model_usage_envelope_inferred`, never provider-attested. | — | 🔲 | receipt fixture |
| EXTREV-86 | An accepted safeguard rerun records requested/invoked Fable 5/high and effective Opus 4.8 without rewriting the requested tuple. | — | 🔲 | receipt fixture |
| EXTREV-87 | An accepted safeguard rerun records effective effort as provider-managed unless exact runtime metadata proves an effort value. | — | 🔲 | receipt fixture |
| EXTREV-88 | An accepted safeguard rerun launches no second Opus process. | — | 🔲 | call-count fixture |
| EXTREV-89 | A provider-safety-route receipt is never reusable for a later `fable-high` primary request. | — | 🔲 | cache replay |
| EXTREV-90 | A later `fable-high` request cannot use provider-routed Opus findings as exact-primary evidence. | — | 🔲 | cache replay |
| EXTREV-91 | Any effective model outside requested Fable, allowed auxiliary models, and corroborated Opus 4.8 fails closed as `model_mismatch`. | — | 🔲 | model matrix fixture |
| EXTREV-92 | A safeguard block that does not produce schema-valid findings ends as an actionable non-availability failure and never triggers launcher fallback. | — | 🔲 | failure replay |

### US-3 — Scheduled and explicit reviewer profiles

**As** a framework maintainer,
**I need** Codex-orchestrated reviewer policy to change at an absolute instant and support an explicit owner selection,
**So that** Opus/high becomes the default on July 20 while Fable/high can be restored without patching source.

### Acceptance Criteria — US-3

| AC | Description | QA | E2E | Test |
|---|---|---|---|---|
| EXTREV-93 | Before `2026-07-19T21:00:00Z`, the scheduled Codex-orchestrated profile is `fable-high`. | — | 🔲 | clock fixture |
| EXTREV-94 | At and after `2026-07-19T21:00:00Z`, the scheduled Codex-orchestrated profile is `opus-high`. | — | 🔲 | clock fixture |
| EXTREV-95 | The receipt renders the cutover as both the absolute UTC instant and `2026-07-20 00:00:00 EEST` in `Europe/Sofia`. | — | 🔲 | receipt fixture |
| EXTREV-96 | `opus-high` invokes the exact Opus 4.8 identifier at high effort as the primary tuple. | — | 🔲 | argv fixture |
| EXTREV-97 | Scheduled `opus-high` is not labeled fallback and is never invoked at xhigh or max. | — | 🔲 | tuple fixture |
| EXTREV-98 | `fable-high` never invokes Fable at xhigh or max. | — | 🔲 | tuple fixture |
| EXTREV-99 | One read-only status operation reports active profile, source, policy version, effective window, and next cutover without cache lookup or provider spawn. | — | 🔲 | zero-spawn fixture |
| EXTREV-100 | One explicit owner-authorized selection operation can activate `fable-high` without editing tracked source. | — | 🔲 | selection fixture |
| EXTREV-101 | An explicit profile selection is accepted only from launcher-created or equivalently schema-valid local owner state whose parent directory and opened file pass non-symlink, current-user ownership, restrictive-mode, provenance, and content-hash checks. | — | 🔲 | authority fixture |
| EXTREV-102 | Every profile resolution receipts selected profile, selection source, policy version, effective window, and owner-selection hash when used. | — | 🔲 | schema fixture |
| EXTREV-103 | An invalid, expired, unsupported, unhashed, or foreign-authority profile selection fails before cache lookup or provider spawn. | — | 🔲 | zero-spawn fixture |
| EXTREV-104 | Removing or expiring the explicit selection returns resolution to the scheduled profile deterministically. | — | 🔲 | clock/selection replay |
| EXTREV-105 | Claude-orchestrated external review remains Codex 5.6 sol/high with no fallback, even while a valid Fable selection is active for Codex orchestration. | — | 🔲 | cross-orchestrator selection fixture |
| EXTREV-106 | Policy status and receipts make no assertion about Fable pricing, entitlement, or future availability. | — | 🔲 | content validator |

### US-4 — Truthful receipts, cache, and operations

**As** a chain gate or operator,
**I need** every policy and provider authority that can alter the effective reviewer to be visible,
**So that** reuse, recovery, and cost decisions are based on the actual route.

### Acceptance Criteria — US-4

| AC | Description | QA | E2E | Test |
|---|---|---|---|---|
| EXTREV-107 | The receipt schema represents policy version, profile, selection source, effective window, route kind, and effective-effort provenance. | — | 🔲 | schema fixture |
| EXTREV-108 | The receipt distinguishes exact primary, scheduled primary, explicit-profile primary, provider safety route, launcher availability fallback, and hard failure. | — | 🔲 | route matrix fixture |
| EXTREV-109 | Receipt semantic validation rejects contradictory requested, invoked, effective, route, fallback, or profile fields. | — | 🔲 | forged receipt fixture |
| EXTREV-110 | Cache lookup revalidates receipt route and effective tuple before returning findings. | — | 🔲 | forged cache fixture |
| EXTREV-111 | Only no-fallback exact-primary evidence whose effective tuple equals the selected requested primary tuple is reusable. | — | 🔲 | cache replay |
| EXTREV-112 | Provider-safety and launcher-fallback receipts remain durable evidence but are non-reusable for primary demand. | — | 🔲 | cache replay |
| EXTREV-113 | `schema_turn_budget`, `model_mismatch`, profile-selection failure, and provider-safety failure each emit one actionable diagnostic naming recovery. | — | 🔲 | diagnostic fixture |
| EXTREV-114 | Diagnostics and receipts contain no credential, keychain, OAuth token, or secret setting value. | — | 🔲 | redaction fixture |
| EXTREV-115 | Registry policy, resolver compatibility output, launcher resolution, and receipt policy metadata agree for the same frozen clock and selection input. | — | 🔲 | parity fixture |

### US-5 — Protocol-faithful verification

**As** a framework maintainer,
**I need** deterministic fixtures and one normal paid primary review to prove the corrected boundary,
**So that** Tier 1 catches protocol regressions without spending quota and dependent WIs can trust the promoted launcher.

### Acceptance Criteria — US-5

| AC | Description | QA | E2E | Test |
|---|---|---|---|---|
| EXTREV-116 | Tier-1 fake Claude replays an intermediate schema tool boundary before final structured output. | — | 🔲 | protocol fixture |
| EXTREV-117 | Tier-1 fixtures make zero paid model calls. | — | 🔲 | fake-PATH/counter fixture |
| EXTREV-118 | Tier-1 fixtures cover two-turn success, repeated schema re-prompt exhaustion, and structured max-turn classification. | — | 🔲 | protocol matrix |
| EXTREV-119 | Tier-1 fixtures cover corroborated provider route, missing provenance, unexpected model, no-second-Opus, and cache non-reuse. | — | 🔲 | route matrix |
| EXTREV-120 | Tier-1 fixtures cover before/at/after cutover, explicit selection, invalid selection, expiry/removal, and policy parity. | — | 🔲 | clock/profile matrix |
| EXTREV-121 | Active independent-review consumers continue to enter only through the canonical launcher. | — | 🔲 | inventory validator |
| EXTREV-122 | One real canonical review explicitly selects `fable-high`, completes schema-valid findings inside the four-turn ceiling, and emits a truthful receipt without a separate paid smoke call. | — | 🔲 | bounded real review |
| EXTREV-123 | Promoted origin/main passes the targeted launcher replay and the framework's current full Tier-1 landing policy before WI-486 resumes. | — | 🔲 | promoted verification |

### US-6 — Exact model identity and canonical research transport

**As** a framework operator,
**I need** exact model identifiers, truthful attestation levels, frozen framework context, and one safe AGY research boundary,
**So that** a passing fixture cannot conceal a model mismatch, missing review doctrine, dangerous permission bypass, or retired Gemini CLI call.

### Acceptance Criteria — US-6

| AC | Description | QA | E2E | Test |
|---|---|---|---|---|
| EXTREV-124 | Every active OpenAI review surface requests exact `gpt-5.6-sol` at high; active `gpt-5.6-codex` pins are forbidden. | — | 🔲 | inventory + argv fixture |
| EXTREV-125 | Codex success without a server model field records `requested_accepted`, never `server_observed`; contradictory observed identity still hard-fails. | — | 🔲 | no-echo/mismatch fixtures |
| EXTREV-126 | Claude success records `server_observed` from `modelUsage` while allowing only the registered Haiku auxiliary model. | — | 🔲 | Fable/Opus modelUsage fixtures |
| EXTREV-127 | Every review package embeds and hashes the target worktree's AGENTS/CLAUDE contract plus applicable review skills and rules before cache/provider work. | — | 🔲 | package-context fixture |
| EXTREV-128 | Missing target instructions fail closed; ambient installed skills are never substituted for reviewed-worktree authority. | — | 🔲 | missing-context fixture |
| EXTREV-129 | `dispatch-agy.mjs` is the sole research inference launcher and accepts large packages through wrapper stdin. | — | 🔲 | fake AGY fixture |
| EXTREV-130 | Because AGY requires an argv prompt, the wrapper bridges stdin through a mode-0600 file inside a mode-0700 private directory, passes only a small file instruction, and deletes the directory after success, failure, or timeout. | — | 🔲 | transport/failure fixture |
| EXTREV-131 | AGY always uses exact model, sandbox, plan mode, CLI and parent timeouts, separated streams, and no dangerous permission bypass. | — | 🔲 | argv/timeout fixture |
| EXTREV-132 | `synthesize-meaning.mjs` and `spine-research.mjs` contain no direct AGY/Gemini spawn and no active `gemini` inference call. | — | 🔲 | source inventory |
| EXTREV-133 | Gemini host-install compatibility remains separate from inference routing and is not removed by the research migration. | — | 🔲 | install-surface inventory |
| EXTREV-134 | An opt-in paid canary covers `gpt-5.6-sol`, Fable, Opus, and AGY; it records Claude CLI version, exercises Fable's safety setting with inherited model controls scrubbed, is disabled by default, and never runs in Tier 1. | — | 🔲 | canary gate/static validation |
| EXTREV-135 | The canary's short bound is isolated from the exact 1200-second production review default. | — | 🔲 | constant/summary assertion |

### Acceptance Criteria — US-7 (phase-to-review-kind guard)

> Real usage allowed a paid plan review AFTER implementation had begun. A `review_kind=plan` is the RIGHT operation only before execute-changeset; once code exists, `review_kind=exec` is required. The guard adds the smallest mechanical enforcement that would have blocked that exact mistake.

| AC ID | Criterion | Given/When/Then | Status | Verification |
|---|---|---|---|---|
| EXTREV-136 | A paid `review_kind=plan` accepts a `--phase-binding` that binds WI identity, the pre-execution base, and the plan-manifest hash; the sanctioned `review-plan-codex.sh` adapter always supplies it. | — | 🔲 | adapter happy-path fixture |
| EXTREV-137 | A plan review is allowed only while the bound pre-execution state still holds — no durable exec-record for the WI and no implementation-file divergence from the base (docs/proposals/.svc are exempt planning paths). | — | 🔲 | pre-execution allowed fixture |
| EXTREV-138 | A plan review is refused before any provider spawn once execute-changeset has begun — proven by a durable exec-record OR implementation-file divergence — classified `phase_violation` with a diagnostic to use `--review-kind exec`, making zero provider calls. | — | 🔲 | post-execution rejected fixture |
| EXTREV-139 | The decision trusts only durable receipt evidence and the implementation diff; a backward lane-graph/status edit that claims planning cannot bypass a present exec-record or a diverged tree. | — | 🔲 | forged-graph rejected fixture |
| EXTREV-140 | A frozen `review_kind=exec` review is never blocked by the guard and records the binding (WI, base) in its receipt `phase_guard`. | — | 🔲 | frozen exec allowed fixture |
| EXTREV-141 | A receipted repository-owner `retro-plan-review` override (SHA-pinned, fresh, WI-matched) is the sole exception that reopens a post-execution plan review, and is recorded in the receipt `phase_guard.override`. | — | 🔲 | owner-override receipted fixture |
| EXTREV-142 | `SVC_EXTERNAL_REVIEW_REQUIRE_PHASE_BINDING=1` fail-closes a plan review that supplies no binding; an unresolvable pre-execution base is likewise refused before spawn. No refusal enters an automatic fallback/review loop. | — | 🔲 | require-flag + base-unresolved + no-loop fixtures |

**Threat-model scope (per gpt-5.6-sol round-2 review).** US-7 enforces the guard for the **sanctioned adapter path** (`review-plan-codex.sh`), which now always derives exactly one authoritative WI, cross-checks it against the plan, and fails closed (exit 4, zero provider calls) on absence/ambiguity/mismatch. The canonical launcher additionally requires `plan_manifest_sha256`, scans exec-record notes across `base..HEAD`, and rejects future-dated overrides. The **DIRECT-caller adversarial** residuals the reviewer identified — the binding is self-asserted rather than semantically verified against the durable `plan-manifest` receipt (EXEC-005), and the note scan is bypassable after a history rewrite that makes the exec commit unreachable (EXEC-006) — are deliberately deferred to **[WI-490](../work-items/WI-490.md)** (mandatory launcher binding + semantic plan-content binding + reachability-independent note enumeration). Round-2 also confirmed relaxing the model-authored `reviewer.model`/`effort` to advisory does not weaken the cross-family anti-spoof guarantee (host+family still hard-fail; process-level `model_attestation` remains authoritative).

## System Dependencies

### This integration depends on

| Dependency | Type | Spec exists? | What it provides | Mock strategy |
|---|---|---|---|---|
| WI-488 canonical external reviewer | Enabler | `docs/specs/features/wi-488-deterministic-external-reviewer.md` | Launcher, schemas, isolation, fallback, cache, and consumers being corrected | Existing fake CLI harness and content-addressed cache fixture |
| Claude Code CLI 2.1.211+ capability surface | External integration | official docs + WI-489 research evidence | Agentic turn limit, structured output, Fable safeguard switching, runtime model/route metadata | Fake Claude emits protocol transitions, refusal-route evidence, usage, and errors |
| Codex CLI | External integration | WI-488 | Unchanged Claude-orchestrated Codex 5.6 sol/high review | Existing fake Codex argv/stdin/stream fixture |
| AGY CLI 1.1.2+ | External integration | live canary + `agy --help` | Sandboxed plan-mode research inference with file-readable package transport | Fake AGY reads the private package and records argv |
| Owner profile authority | Internal enabler | WI-489 contract | Scheduled and explicit profile selection | Frozen-clock and hashed selection fixtures |
| Receipt/cache validation | Internal enabler | WI-488 schemas/runtime | Durable tuple/route evidence and conservative reuse | Valid, contradictory, forged, and stale receipt/cache fixtures |

### Other work depends on this

| Consumer | Type | What it needs from us |
|---|---|---|
| WI-486 plan and execution review | Framework delivery | A real Fable/high primary review that completes its schema protocol and receipts any provider route truthfully |
| WI-487 plan and execution review | Framework delivery | The same corrected launcher after WI-486 compatibility promotion |
| Review gates and floor judges | Framework quality | Stable profile resolution, schema-valid findings, and non-laundered cache evidence |

No new dependency WI is required. WI-486 and WI-487 remain downstream work, not sub-scope.

## Input and output contracts

### Additional inputs over WI-488

- One frozen current-time instant per resolution, injectable only in fixtures.
- Built-in versioned reviewer-profile schedule.
- Optional launcher-managed owner profile-selection state with secure-file validation and receipted content hash.
- Claude structured result fields for turn accounting and runtime model usage.
- Controlled Fable envelope evidence plus same-process runtime model usage for provider-route attestation.

### Additional receipt outputs over WI-488

| Field group | Required meaning | ACs |
|---|---|---|
| Policy | version, selected profile, selection source, effective window, cutover instant | EXTREV-93–106 |
| Protocol | configured ceiling, reported turns, stop/terminal reasons, structured errors | EXTREV-70–78 |
| Route | exact primary, provider safety route, launcher fallback, or failure | EXTREV-83–92, EXTREV-107–115 |
| Effort provenance | exact runtime proof or `provider-managed` | EXTREV-87, EXTREV-107 |
| Selection authority | owner artifact source/hash/expiry when used | EXTREV-99–104 |

## Event Contracts

| Event | Producer | Consumer | Payload | AC |
|---|---|---|---|---|
| `external_review.profile_resolved` | policy resolver | launcher/status operation | policy version, profile, source, window, cutover, authority hash | EXTREV-93–106 |
| `external_review.protocol_exhausted` | Claude adapter | consumer/operator | `schema_turn_budget`, configured/reported turns, reasons, receipt | EXTREV-73–76 |
| `external_review.provider_safety_routed` | Claude adapter | consumer/cache validator | requested/invoked/effective tuple, route provenance, effort provenance, non-reusable receipt | EXTREV-83–90 |
| `external_review.completed` | launcher | review consumer | schema-valid findings plus truthful route/profile receipt | EXTREV-107–112 |
| `external_review.failed` | launcher | review consumer/operator | actionable class, recovery, receipt | EXTREV-113–114 |

## Operator interaction contract

This Integration has no browser UI. It has two read/write CLI control surfaces:

1. **Status:** read-only, makes no cache/provider call, and reports active profile, source, version, window, cutover, and explicit-selection state.
2. **Select:** validates an owner-authorized profile artifact and activates `fable-high` without editing tracked source or weakening tuple/schema rules.

Both surfaces return machine-readable output and one actionable failure. Exact command names and state layout belong to `design-tech`; the observable fields and zero-spawn rule are fixed here.

## Industry Grounding

**Source:** inapplicable for an internal framework-to-provider transport
**Landscape state:** inapplicable
**Gate verdict:** SKIP
**Branch taken:** inapplicable

### What the industry does

There is no customer-facing competitive flow. The relevant grounding is the installed CLI and official provider contract: Claude structured output may use agentic turns, and Claude Code may visibly re-run a safeguard-blocked Fable request on Opus 4.8 in the same conversation.

### What we're doing

Treating protocol turns, paid invocations, owner profile policy, launcher availability fallback, and provider safety routing as different authorities with different receipt/cache semantics.

### Why we differ or align

We align with supported Claude Code behavior while adding framework-owned fail-closed evidence, deterministic profile timing, and conservative cache rules.

### Reversibility

Two-way door. The explicit profile can return to the schedule, and the schedule can be versioned later. Receipt versions preserve historical interpretation.

## Technical Design

### Architecture and authority boundaries

`scripts/run-external-review.mjs` remains the only executable review boundary. It gains a policy resolver, secure local selection operations, protocol-aware Claude parsing, semantic receipt validation, and route-aware cache publication. `references/model-registry.json.externalReviewPolicy` is the sole tracked policy authority. `scripts/resolve-adversarial-reviewer.sh` becomes a compatibility adapter that delegates to launcher status output.

```text
model registry + frozen UTC clock + secure local selection
                         |
                         v
               [policy resolver]
                 | status/select/clear (zero provider calls)
                 v
package stdin -> [canonical launcher] -> exact primary process (one spawn)
                    |                         |
                    |                 <=4 Claude protocol turns
                    |                         |
                    +<- runtime result -------+
                    |  exact primary / provider safety route /
                    |  eligible availability failure / hard failure
                    v
          [findings normalization + receipt-v2 semantic validator]
                    |
                    +-> reusable cache only for exact primary
                    +-> durable non-reusable route/fallback evidence
```

### Components

| Component | Responsibility | Invariant |
|---|---|---|
| Registry policy parser | Validate policy version, profiles, schedule, model ids, effort, and eligible fallback classes | Invalid tracked policy fails before cache/provider activity |
| Profile resolver | Freeze one clock instant; apply a valid explicit selection over the scheduled profile | Before cutover Fable/high; at/after cutover Opus/high; Claude orchestration unchanged |
| Selection-state controller | `--policy-status`, `--select-profile`, and `--clear-profile-selection`; atomic local state writes | Status and mutations never read cache or spawn a provider |
| Claude adapter | Safe isolated argv/env, four-turn ceiling, structured-result parsing, route classification | One process is one primary invocation regardless of reported agentic turns |
| Route attestor | Combine controlled envelope and runtime `modelUsage` | No inference from findings prose; no second Opus after a same-process provider route |
| Findings normalizer | Validate content, then replace reviewer identity from trusted runtime route | Model-authored tuple cannot launder identity |
| Receipt v2 validator | Enforce policy, protocol, route, fallback, effective tuple, and cache consistency | Contradictory receipts fail closed |
| Cache | Key package + selected tuple + kind + schema + launcher version + fixture mode | Only exact-primary, no-fallback, exact-effective evidence is reusable |

### Policy and local state model

The registry policy is version 3 and contains two Codex-orchestrated profiles: `fable-high` and `opus-high`. The schedule has half-open windows split at `2026-07-19T21:00:00Z`; the receipt also renders `2026-07-20 00:00:00 EEST` and `Europe/Sofia`. `fable-high` keeps the WI-488 separate Opus/xhigh availability fallback for only `model_unavailable`, `model_entitlement`, and `provider_overload`. `opus-high` is an Opus 4.8/high primary with no fallback. This is owner policy, not a pricing or entitlement forecast.

Explicit selection applies only to Codex-orchestrated schedule resolution and lives at ignored `.svc/external-review-policy/v1/selection.json`; it is inert for Claude orchestration's fixed OpenAI profile. Writes use a same-directory temporary file, mode `0600`, fsync-compatible close, and atomic rename. Reads validate the parent directory, open with `O_NOFOLLOW`, then validate the opened descriptor so check/read replacement cannot cross a symlink. They reject non-regular files/directories, owner uid mismatch, unsafe group/world-write bits, unknown keys, wrong authority, unsupported profile, invalid timestamps, and expiry. Receipts store the exact content SHA-256 but never secrets. `--clear-profile-selection` removes only this known file; absent state is idempotent.

### Claude invocation and environment contract

Claude argv remains safe-mode, empty tools/MCP, strict MCP, plan permission, non-persistent, one command, schema-constrained, budget/timeout bounded, and stdin-fed. It changes to `--max-turns 4` and adds `--settings {"switchModelsOnFlag":true}` for Fable. The child environment deletes `CLAUDE_CODE_DISABLE_REFUSAL_FALLBACK` and inherited model-selection/remap variables identified by the supported CLI contract; it never removes OAuth/keychain inputs. No `--fallback-model` is passed.

The adapter parses outer structured fields even on nonzero results. `subtype=error_max_turns` or `terminal_reason=max_turns` becomes `schema_turn_budget`; `subtype=error_max_budget_usd` or `terminal_reason=budget_exhausted` becomes `budget_exhausted`. Both record configured/reported turns, stop/terminal reason, and sanitized provider errors. These classes, schema failure, authentication, quota, network, timeout, and provider-safety failure never enter the launcher availability fallback branch.

### Provider safety route state machine

```text
Fable envelope + process result
  exact Fable usage + valid findings
    + scheduled policy source                    -> scheduled_primary
    + explicit selection source                  -> explicit_profile_primary
  exact Opus 4.8 usage + valid findings
    + switching enabled/no CLI fallback/env clean -> provider_safety_route
    + any envelope proof missing                  -> model_mismatch
  safeguard refusal + no valid findings           -> provider_safety_failure
  eligible availability classification            -> one separate Opus/xhigh fallback
  max-turn/schema/auth/quota/network/timeout       -> named hard failure
  any unexpected effective model                  -> model_mismatch
```

Allowed Haiku usage is auxiliary and never becomes the effective reviewer. For a provider route, requested and invoked tuples remain Fable/high; effective model is Opus 4.8 and effective effort is `null` with provenance `provider-managed` unless exact runtime metadata is later available. The findings reviewer block is launcher-normalized for compatibility; the receipt is authoritative for requested versus effective effort.

### Receipt v2 and cache semantics

Receipt v2 adds:

- `policy`: version, profile, source (`schedule` or `explicit-selection`), effective window, cutover UTC/local rendering, and selection hash/expiry;
- `protocol`: process invocation count, configured turn ceiling, reported turns, stop reason, terminal reason, and sanitized errors;
- `route`: `exact_primary`, `scheduled_primary`, `explicit_profile_primary`, `provider_safety_route`, `launcher_availability_fallback`, `cache_hit`, or `hard_failure`, plus an evidence class; safety-route causation is explicitly `provider_model_usage_envelope_inferred`, not provider-attested;
- effective-effort value and provenance (`runtime`, `requested`, `provider-managed`, or `none`).

Semantic validation is stricter than JSON Schema: route, tuple, fallback, attempts, policy source, and cache disposition must agree. A cache hit emits a new receipt for the current resolution and references the source receipt. Provider-routed and launcher-fallback findings remain durable artifacts but are never published as reusable primary cache entries. The cutover naturally changes the selected tuple and therefore the cache key.

### Fixture state machine and external dependencies

Tier 1 substitutes fake `claude` and `codex` binaries through fixture-only paths. Fake Claude emits: intermediate tool boundary then success; four-turn exhaustion; structured max-turn error; exact Fable success; corroborated same-process Opus route; missing-envelope Opus observation; unexpected model; each availability/failure class; and exact call counts. A frozen-clock fixture is permitted only with `SVC_EXTERNAL_REVIEW_FIXTURE=1`. Production clock injection, fixture binary injection, or foreign selection state hard-fails.

One canonical, paid Fable/high review after implementation is normal independent-review work, not a smoke probe. Its receipt and provider-fidelity evidence must prove one process, schema-valid findings, route truth, and no launcher fallback.

### Cost, operations, and recovery

The maximum provider work per Fable primary is one Claude process with four bounded agentic turns; a second process exists only for the three WI-488 availability classes. A provider safety route never creates a second Opus process. Opus/high after the cutover is one primary process with no fallback. The provider-attempt wall-clock default is 1,200 seconds. The default metered-cost ceiling is $50 for the complete launcher review: the primary receives the ceiling and any separate availability fallback receives only the trustworthy reported unspent remainder. If primary cost is absent or malformed, fallback fails closed because the launcher cannot prove that remainder. Timeout and local dollar-budget exhaustion remain named hard failures and never authorize fallback.

Operators use policy status before a dependent review, select Fable with a reason when owner policy requires it, and clear the selection to resume the schedule. Diagnostics name the exact recovery: increase neither effort nor turns for schema exhaustion; honor the owner-approved $50 whole-review ceiling after `budget_exhausted`; update CLI capability when settings are unsupported; clear/replace invalid selection state; retry provider-safety failure only after provider/CLI state changes; and never suggest Opus fallback for auth/quota/network/timeout/schema failures.

### Acceptance-criteria feasibility

| AC | Feasible design proof |
|---|---|
| EXTREV-70 | Claude argv constant pins four turns. |
| EXTREV-71 | Spawn counter is separate from outer `num_turns`. |
| EXTREV-72 | Fake protocol completes on turn two in one process. |
| EXTREV-73 | Structured fields precede generic provider text classification. |
| EXTREV-74 | Receipt protocol object captures all named fields. |
| EXTREV-75 | Fallback eligibility set excludes `schema_turn_budget`. |
| EXTREV-76 | CLI ceiling plus replay proves bounded exhaustion. |
| EXTREV-77 | Fixtures prove the $50 whole-review ceiling, the fallback's cost-adjusted remainder, and no fallback when primary cost is unreported; structured dollar exhaustion is `budget_exhausted`. |
| EXTREV-78 | No preflight paid model call exists. |
| EXTREV-79 | Registry profile pins full Fable id/high. |
| EXTREV-80 | Claude argv contains no fallback-model option. |
| EXTREV-81 | Settings force switching; child env scrubs disable control. |
| EXTREV-82 | Safe mode plus model-env scrub and exact argv pin identity. |
| EXTREV-83 | Controlled envelope plus same-process exact Opus usage attests route. |
| EXTREV-84 | Missing envelope evidence maps to mismatch. |
| EXTREV-85 | Receipt route enum records provider safety route. |
| EXTREV-86 | Separate requested/invoked/effective fields preserve truth. |
| EXTREV-87 | Effective effort nullable with provider-managed provenance. |
| EXTREV-88 | Routed success terminates before fallback branch. |
| EXTREV-89 | Cache validator permits exact-primary only. |
| EXTREV-90 | Routed findings never become reusable primary cache entries. |
| EXTREV-91 | Exact model allowlist rejects all other usage. |
| EXTREV-92 | Missing valid findings maps to provider-safety failure. |
| EXTREV-93 | Frozen-clock test covers the pre-cutover window. |
| EXTREV-94 | Half-open schedule selects Opus at the exact instant. |
| EXTREV-95 | Registry and receipt carry UTC/local cutover strings. |
| EXTREV-96 | Opus profile pins full id/high. |
| EXTREV-97 | Route/source distinguishes scheduled primary from fallback. |
| EXTREV-98 | Profile validator rejects Fable effort above high. |
| EXTREV-99 | Status exits before stdin/cache/binary resolution. |
| EXTREV-100 | Selection command atomically activates Fable. |
| EXTREV-101 | Secure local-state checks bind current owner and exact bytes. |
| EXTREV-102 | Policy object receipts every resolution field. |
| EXTREV-103 | Selection validation precedes cache/provider code. |
| EXTREV-104 | Clear/expiry returns to deterministic schedule. |
| EXTREV-105 | Claude profile remains Codex 5.6 sol/high. |
| EXTREV-106 | Policy text includes no pricing/availability assertion. |
| EXTREV-107 | Receipt v2 schema requires policy/protocol/route/provenance. |
| EXTREV-108 | Route enum and policy source distinguish all branches. |
| EXTREV-109 | Semantic validator rejects cross-field contradictions. |
| EXTREV-110 | Cache hit revalidates schema and semantics. |
| EXTREV-111 | Reuse predicate requires exact tuple and no fallback. |
| EXTREV-112 | Non-reusable artifacts persist outside reusable entry. |
| EXTREV-113 | Diagnostic table maps each new class to recovery. |
| EXTREV-114 | Sanitization and secret fixtures cover receipts/logs. |
| EXTREV-115 | Resolver delegates to launcher policy status. |
| EXTREV-116 | Fake Claude has an explicit intermediate protocol state. |
| EXTREV-117 | Fixture binary containment and call ledger prove zero paid calls. |
| EXTREV-118 | Three protocol replays cover success and both exhaustion forms. |
| EXTREV-119 | Route matrix asserts evidence, models, calls, and reuse. |
| EXTREV-120 | Clock/state matrix covers schedule and selection lifecycle. |
| EXTREV-121 | Existing source inventory validator remains authoritative. |
| EXTREV-122 | Normal real Fable review produces canonical receipt evidence. |
| EXTREV-123 | Targeted and full Tier-1 run again from promoted main. |
| EXTREV-124–128 | Exact model id, attestation level, and worktree-context fixtures close false-proof and context-loss paths. |
| EXTREV-129–133 | Canonical AGY transport and source inventory remove active Gemini/direct-spawn paths without removing host compatibility. |
| EXTREV-134–135 | Paid-canary opt-in gate and timeout separation are mechanically asserted. |

### Risks and trade-offs

| Risk | Mitigation | Residual |
|---|---|---|
| Claude changes model-switch controls/output | Capability check and fail-closed route classification | A CLI upgrade can temporarily block Fable route acceptance |
| Same-process Opus usage could have a future non-safety cause | Exact Fable envelope, no CLI fallback, scrubbed controls, and narrow exact-model acceptance | Public output still does not expose private trigger category |
| Local selection is forgotten in another checkout | Status is zero-cost and every receipt names source/hash | Selection is intentionally local, not fleet-wide |
| Four turns increase worst-case spend | Existing dollar/time bounds and one-process count | A valid review may cost more than the broken one-turn attempt |
| Findings v1 effort cannot express provider-managed | Receipt v2 is authoritative and findings are normalized | Findings-only consumers must not claim effective effort provenance |

### Adversarial engineering review

| Challenge | Resolution | Confidence |
|---|---|---|
| Are private fallback headers available to the launcher? | No proven public surface; design does not depend on them. | high |
| Could a routed Opus response cause another Opus call? | Success route returns before launcher fallback and call-count fixtures enforce one spawn. | high |
| Can an expired/foreign selection spend quota? | Selection validation is before cache, binary lookup, or provider spawn. | high |
| Can cached Fable evidence survive the Opus cutover incorrectly? | Selected tuple is in key and exact-primary semantics are revalidated. | high |
| Is July 20 a pricing claim? | No; policy records an owner-selected schedule only. | high |
| Does four turns mean four paid invocations? | No; one CLI process/provider conversation is receipted as one invocation with reported protocol turns. | medium-high |

## Pillars Coverage Matrix

| # | Pillar | State | Artifact / note |
|---|---|---|---|
| 1 | Product fit | [UNCHANGED — VERIFIED] | `FRAMEWORK-STATE.md`; independent cross-family review remains mandatory |
| 2 | Journey | [UPDATED] | Headless system journey and Event Contracts in this spec |
| 3 | Acceptance criteria | [UPDATED] | EXTREV-70 through EXTREV-135; supersedes WI-488 EXTREV-29 and EXTREV-33 |
| 4 | UX | [UPDATED] | Operator status/selection interaction and actionable diagnostics; no human-facing product UI |
| 5 | UI | [N/A — justified] | Headless CLI integration has no visual component, layout, token, viewport, motion, or screenshot surface |
| 6 | Tech architecture | [UPDATED — BASELINED] | Policy, protocol, route, schema/cache, state, fixture, and operations design above; contract map validated |
| 7 | Cost model | [UPDATED] | One primary invocation, maximum four protocol turns, existing timeout/dollar bounds, no separate smoke call; no speculative Fable pricing claim |
| 8 | Operations & ownership | [UPDATED] | Versioned profile/status/selection, route diagnostics, receipt provenance, and recovery requirements in this spec |

## Scope Review

**Mode:** Hold. This is complete for the narrowest coherent correction and does not absorb dependent work.

- Zero silent failures: schema exhaustion, safety route, mismatch, invalid selection, and provider failure are named outcomes.
- Every error has a name: `schema_turn_budget`, `model_mismatch`, invalid profile selection, provider-safety failure, and preserved WI-488 classes are explicit.
- Shadow paths: exact primary, cache hit, provider safety route, scheduled/explicit profile, schema exhaustion, and hard failure are specified.
- Edge cases: exact cutover boundary, expired/removed selection, missing route evidence, unexpected model, repeated schema re-prompt, and second-Opus suppression are ACs.
- Observability: policy, turn, route, effort, selection, and recovery fields are first-class receipt outputs.
- Diagram: the complete resolution/protocol/route/cache flow appears above.
- Deferrals: none inside WI-489; WI-486 and WI-487 remain explicitly blocked dependencies.
- Six-month future: versioned profile policy and receipts allow a later Fable return without rewriting historical evidence.
- Scrap test: disabling provider switching entirely would simplify identity but contradict the accepted behavior and discard legitimate Opus results; it is rejected.

## Known Constraints

- Claude Code provider-route metadata may evolve. The launcher must validate supported capabilities and fail closed when corroborating evidence is unavailable; it must not infer from model-authored content.
- A provider safety route is usable evidence for the current review but deliberately not reusable as Fable-primary evidence.
- The schedule is an owner policy, not a provider availability or billing forecast.

## Implementation Notes

_To be added by `plan-changeset` and `execute-changeset` after technical design._

## Journey References

The Headless system journey and Event Contracts in this spec are the authoritative system/contract journey. A separate user journey is not applicable because there is no product UI, and the owner-mandated chain proceeds directly to `design-tech`.

## Revision Log

| Date | AC | Was | Now | Why | By skill |
|---|---|---|---|---|---|
| 2026-07-16 | EXTREV-29 | Claude limited to one turn | Superseded by EXTREV-70–78: four bounded agentic turns inside one paid primary invocation | Real WI-486 schema handshake terminated after the first-turn ceiling | write-spec |
| 2026-07-16 | EXTREV-33 | Requested model must equal effective model | Superseded by EXTREV-79–92: exact primary or corroborated provider safety route | Claude Code can rerun safeguard-blocked Fable requests on Opus in the same conversation | write-spec |
| 2026-07-16 | EXTREV-93–123 | (new) | Scheduled/explicit reviewer profiles, route receipts/cache rules, and protocol-faithful proof | Owner policy and promoted-runtime evidence require a truthful complete delta | write-spec |
| 2026-07-16 | EXTREV-83 | Required unspecified corroborating refusal-route provenance | Controlled Fable envelope plus same-process exact Opus usage attests provider safety routing | Private refusal headers are not proven in normal CLI output; installed controls are deterministic and testable | design-tech |
| 2026-07-16 | EXTREV-101 | Required out-of-band SHA-256 trust-anchor configuration | Requires secure launcher-managed local owner state and receipts its content hash | Preserves authority and fail-closed behavior while satisfying the owner's easy switch requirement | design-tech |
| 2026-07-16 | EXTREV-124–135 | (new) | Exact sol identity, truthful attestation, frozen worktree doctrine, safe AGY transport, and opt-in live canaries | Direct live canaries plus Fable adversarial review exposed gaps absent from the original manifest | owner correction + Fable review |
