# Systems Analysis: WI-488 deterministic external reviewer

**Date:** 2026-07-15
**Branch:** `framework-WI-488-external-reviewer`
**Spec:** `docs/specs/features/wi-488-deterministic-external-reviewer.md`
**Mode:** full
**Final independently reviewed implementation hash:** `b948fe6321936d98ae990b953355815c9892520448895ef3b726532f48ee62f6`

## Scope and upstream context

The audit compared the staged WI-488 implementation and evidence against the accepted 69-AC spec and reviewed manifest. All intentional tracked paths are declared; the audit report itself is declared as `CREATE-EVIDENCE`. WI-486 and WI-487 implementation behavior is absent from the diff. There is no browser/UI, database, or data-migration surface.

The pre-change full Tier-1 baseline remains 240 pass / 3 known failures. The earlier frozen implementation baseline was 242 pass / 2 known WI-487 installation failures. Neither result is represented as final landing proof; task 12 refreshes the complete suite after this audit.

## Verification Contract

| AC | What the implementation must do | Evidence | Verified |
|---|---|---|---|
| EXTREV-01 | A Claude-orchestrated request resolves its primary reviewer to Codex 5.6 sol at high. | Policy/schema fixtures: tuple routing, override trust, mismatch and no-substitution | Confirmed |
| EXTREV-02 | Unavailable Codex 5.6 sol on the Claude path produces a hard-failure receipt. | Policy/schema fixtures: tuple routing, override trust, mismatch and no-substitution | Confirmed |
| EXTREV-03 | The Claude path never substitutes a reviewer when Codex 5.6 sol is unavailable. | Policy/schema fixtures: tuple routing, override trust, mismatch and no-substitution | Confirmed |
| EXTREV-04 | A Codex-orchestrated request resolves its primary reviewer to Fable 5 at high. | Policy/schema fixtures: tuple routing, override trust, mismatch and no-substitution | Confirmed |
| EXTREV-05 | The resolved tuple records orchestrator, reviewer host, reviewer family, exact model/version, and effort. | Policy/schema fixtures: tuple routing, override trust, mismatch and no-substitution | Confirmed |
| EXTREV-06 | The resolved tuple records primary availability outcome, fallback eligibility, fallback reason, and override state. | Policy/schema fixtures: tuple routing, override trust, mismatch and no-substitution | Confirmed |
| EXTREV-07 | Fable xhigh or max is rejected unless a valid owner override requests it. | Policy/schema fixtures: tuple routing, override trust, mismatch and no-substitution | Confirmed |
| EXTREV-08 | Codex effort above high is rejected unless a valid owner override requests it. | Policy/schema fixtures: tuple routing, override trust, mismatch and no-substitution | Confirmed |
| EXTREV-09 | An owner override is valid only when its source and requested tuple are receipted. | Policy/schema fixtures: tuple routing, override trust, mismatch and no-substitution | Confirmed |
| EXTREV-10 | A model alias that resolves to another family or version is classified unavailable. | Policy/schema fixtures: tuple routing, override trust, mismatch and no-substitution | Confirmed |
| EXTREV-11 | A declared tuple that differs from the exact invocation tuple fails before findings are accepted. | Policy/schema fixtures: tuple routing, override trust, mismatch and no-substitution | Confirmed |
| EXTREV-12 | The launcher accepts the complete review package through stdin. | Codex argv/env/stream/capability/timeout fixtures | Confirmed |
| EXTREV-13 | The launcher validates final findings against the shared findings schema. | Codex argv/env/stream/capability/timeout fixtures | Confirmed |
| EXTREV-14 | Codex runs through non-interactive `codex exec`. | Codex argv/env/stream/capability/timeout fixtures | Confirmed |
| EXTREV-15 | Codex runs with a read-only sandbox. | Codex argv/env/stream/capability/timeout fixtures | Confirmed |
| EXTREV-16 | Codex runs ephemerally without persisting a session. | Codex argv/env/stream/capability/timeout fixtures | Confirmed |
| EXTREV-17 | Codex ignores user configuration and user rules while preserving `CODEX_HOME` authentication. | Codex argv/env/stream/capability/timeout fixtures | Confirmed |
| EXTREV-18 | Codex rejects unknown or unsupported configuration through strict-config validation. | Codex argv/env/stream/capability/timeout fixtures | Confirmed |
| EXTREV-19 | Codex receives the shared output schema as an output constraint. | Codex argv/env/stream/capability/timeout fixtures | Confirmed |
| EXTREV-20 | Codex stdout events, stderr diagnostics, and final structured findings are stored as separate streams/artifacts. | Codex argv/env/stream/capability/timeout fixtures | Confirmed |
| EXTREV-21 | Codex color output is disabled. | Codex argv/env/stream/capability/timeout fixtures | Confirmed |
| EXTREV-22 | Launcher startup rejects a Codex CLI that lacks any required capability with one versioned upgrade diagnostic. | Codex argv/env/stream/capability/timeout fixtures | Confirmed |
| EXTREV-23 | Claude runs in print mode with the full requested model identifier and effort. | Claude isolation/model/fallback/negative-class/call-count fixtures | Confirmed |
| EXTREV-24 | Claude uses safe mode and does not use bare mode, preserving OAuth/keychain compatibility. | Claude isolation/model/fallback/negative-class/call-count fixtures | Confirmed |
| EXTREV-25 | Claude has no enabled tools. | Claude isolation/model/fallback/negative-class/call-count fixtures | Confirmed |
| EXTREV-26 | Claude loads no MCP configuration or servers. | Claude isolation/model/fallback/negative-class/call-count fixtures | Confirmed |
| EXTREV-27 | Claude runs with plan permission mode. | Claude isolation/model/fallback/negative-class/call-count fixtures | Confirmed |
| EXTREV-28 | Claude does not persist a session. | Claude isolation/model/fallback/negative-class/call-count fixtures | Confirmed |
| EXTREV-29 | Claude is limited to one turn. | Claude isolation/model/fallback/negative-class/call-count fixtures | Confirmed |
| EXTREV-30 | Claude final output is constrained by the shared findings schema. | Claude isolation/model/fallback/negative-class/call-count fixtures | Confirmed |
| EXTREV-31 | Claude execution is bounded by a configurable timeout. | Claude isolation/model/fallback/negative-class/call-count fixtures | Confirmed |
| EXTREV-32 | Claude execution is bounded by a configurable budget ceiling. | Claude isolation/model/fallback/negative-class/call-count fixtures | Confirmed |
| EXTREV-33 | Claude runtime metadata must confirm the requested effective model before findings pass. | Claude isolation/model/fallback/negative-class/call-count fixtures | Confirmed |
| EXTREV-34 | A Fable-5 model-unavailable result authorizes one separate Opus-xhigh invocation. | Claude isolation/model/fallback/negative-class/call-count fixtures | Confirmed |
| EXTREV-35 | A Fable-5 model-entitlement result authorizes one separate Opus-xhigh invocation. | Claude isolation/model/fallback/negative-class/call-count fixtures | Confirmed |
| EXTREV-36 | A Fable-5 provider-overload result authorizes one separate Opus-xhigh invocation. | Claude isolation/model/fallback/negative-class/call-count fixtures | Confirmed |
| EXTREV-37 | An authentication failure never authorizes Opus fallback. | Claude isolation/model/fallback/negative-class/call-count fixtures | Confirmed |
| EXTREV-38 | Shared subscription-quota exhaustion never authorizes Opus fallback. | Claude isolation/model/fallback/negative-class/call-count fixtures | Confirmed |
| EXTREV-39 | A network failure never authorizes Opus fallback. | Claude isolation/model/fallback/negative-class/call-count fixtures | Confirmed |
| EXTREV-40 | A timeout never authorizes Opus fallback. | Claude isolation/model/fallback/negative-class/call-count fixtures | Confirmed |
| EXTREV-41 | Schema-invalid or malformed findings never authorize Opus fallback. | Claude isolation/model/fallback/negative-class/call-count fixtures | Confirmed |
| EXTREV-42 | The launcher does not use a hidden same-invocation fallback-model option. | Claude isolation/model/fallback/negative-class/call-count fixtures | Confirmed |
| EXTREV-43 | Every invocation attempt emits a schema-valid receipt, including classified hard failures. | Receipt schema plus semantic cache/key/concurrency/crash/GC replay | Confirmed |
| EXTREV-44 | A receipt records package hash, schema identity, launcher version, CLI version, and timestamps. | Receipt schema plus semantic cache/key/concurrency/crash/GC replay | Confirmed |
| EXTREV-45 | A receipt records requested tuple, exact invocation tuple, and runtime effective tuple when exposed. | Receipt schema plus semantic cache/key/concurrency/crash/GC replay | Confirmed |
| EXTREV-46 | A receipt records exit classification, artifact paths, and usage/cost metadata when exposed. | Receipt schema plus semantic cache/key/concurrency/crash/GC replay | Confirmed |
| EXTREV-47 | A receipt records fallback and owner-override provenance without storing credentials. | Receipt schema plus semantic cache/key/concurrency/crash/GC replay | Confirmed |
| EXTREV-48 | Cache identity covers canonical package, requested tuple, findings schema, launcher version, and fixture-mode bit. | Receipt schema plus semantic cache/key/concurrency/crash/GC replay | Confirmed |
| EXTREV-49 | Only a schema-valid no-fallback receipt whose effective tuple equals the requested primary tuple is reusable. | Receipt schema plus semantic cache/key/concurrency/crash/GC replay | Confirmed |
| EXTREV-50 | A fallback receipt is never reusable for a later primary-model request. | Receipt schema plus semantic cache/key/concurrency/crash/GC replay | Confirmed |
| EXTREV-51 | A changed package forces a fresh primary invocation. | Receipt schema plus semantic cache/key/concurrency/crash/GC replay | Confirmed |
| EXTREV-52 | A changed tuple forces a fresh primary invocation. | Receipt schema plus semantic cache/key/concurrency/crash/GC replay | Confirmed |
| EXTREV-53 | A changed findings schema forces a fresh primary invocation. | Receipt schema plus semantic cache/key/concurrency/crash/GC replay | Confirmed |
| EXTREV-54 | A changed launcher version forces a fresh primary invocation. | Receipt schema plus semantic cache/key/concurrency/crash/GC replay | Confirmed |
| EXTREV-55 | The primary paid invocation itself is the model-availability probe. | Receipt schema plus semantic cache/key/concurrency/crash/GC replay | Confirmed |
| EXTREV-56 | No separate paid smoke invocation occurs before the primary call. | Receipt schema plus semantic cache/key/concurrency/crash/GC replay | Confirmed |
| EXTREV-57 | `review-plan` dispatches external review only through the canonical launcher. | Adapter replay, active-source inventory, fake-CLI guard, kill-switch/input fixtures | Confirmed |
| EXTREV-58 | `review-cross-model` dispatches external review only through the canonical launcher. | Adapter replay, active-source inventory, fake-CLI guard, kill-switch/input fixtures | Confirmed |
| EXTREV-59 | `review-exec` consumes the launcher findings and invocation receipt. | Adapter replay, active-source inventory, fake-CLI guard, kill-switch/input fixtures | Confirmed |
| EXTREV-60 | Blind and prompt floor judges dispatch their external verdict review only through the canonical launcher. | Adapter replay, active-source inventory, fake-CLI guard, kill-switch/input fixtures | Confirmed |
| EXTREV-61 | Active review contracts contain no obsolete `codex -p ... --output-format` examples. | Adapter replay, active-source inventory, fake-CLI guard, kill-switch/input fixtures | Confirmed |
| EXTREV-62 | Active source contains no consumer-local direct Claude/Codex independent-review invocation. | Adapter replay, active-source inventory, fake-CLI guard, kill-switch/input fixtures | Confirmed |
| EXTREV-63 | Tier-1 launcher tests use fake CLIs and make zero paid model calls. | Adapter replay, active-source inventory, fake-CLI guard, kill-switch/input fixtures | Confirmed |
| EXTREV-64 | Missing required CLI capability returns one actionable hard failure and attempts no degraded execution. | Adapter replay, active-source inventory, fake-CLI guard, kill-switch/input fixtures | Confirmed |
| EXTREV-65 | Historical review transcripts and immutable receipts are excluded from active-source inventory migration. | Adapter replay, active-source inventory, fake-CLI guard, kill-switch/input fixtures | Confirmed |
| EXTREV-66 | A Codex review timeout terminates the single attempt and emits a classified hard-failure receipt. | Codex argv/env/stream/capability/timeout fixtures | Confirmed |
| EXTREV-67 | A failed Opus fallback ends after exactly two total attempts and emits a hard-failure receipt. | Claude isolation/model/fallback/negative-class/call-count fixtures | Confirmed |
| EXTREV-68 | `SVC_EXTERNAL_REVIEW_DISABLED=1` prevents cache lookup and process spawn, ignores overrides, and emits a kill-switch receipt. | Adapter replay, active-source inventory, fake-CLI guard, kill-switch/input fixtures | Confirmed |
| EXTREV-69 | Empty review-package stdin fails before cache lookup or process spawn with an input-invalid receipt. | Adapter replay, active-source inventory, fake-CLI guard, kill-switch/input fixtures | Confirmed |

## Coverage Ledger

| Subsystem | Entrypoints/files | ACs | Risk | Status |
|---|---|---|---|---|
| Policy and process adapters | `run-external-review.mjs`, resolver | EXTREV-01–11 | high | done |
| Codex isolation adapter | launcher Codex argv/streams | EXTREV-12–22, 66 | high | done |
| Claude and fallback state machine | launcher Claude argv/classifier | EXTREV-23–42, 67 | high | done |
| Receipts, cache, locks and GC | launcher + both schemas | EXTREV-43–56 | high | done |
| Plan/cross-model/floor consumers | adapters and skill contracts | EXTREV-57–62 | medium | done |
| Fixture and control boundaries | Tier-1 validator | EXTREV-63–65, 68–69 | high | done |

## Hypotheses tested

1. Pre-invocation failures may fabricate provider tuples. Rejected by null-tuple receipts and zero-call fixtures.
2. A direct owner override may bypass mandatory Fable-first routing. Rejected by exact-primary override validation.
3. Forbidden or model-authored diagnostics may authorize Opus. Rejected by forbidden precedence, nested-error trust, exact anchored allowlist, and near-miss fixtures.
4. Cancellation or timeout may leak a detached paid process. Rejected by process-group termination, escalation cleanup, and PID/lock fixtures.
5. Lock reclaim, refresh, release, GC, or guard crash may race and wedge or duplicate work. Rejected by the owner-token mutation protocol, live contention, GC/republish, stale takeover, and SIGKILL recovery fixtures.
6. A schema-valid but semantically false receipt may be laundered through cache. Rejected by exact version/mode/status/disposition/entry/attempt/tuple/timestamp validation and tamper replay.
7. Consumer migration may lose plan rubric payloads or phase artifacts. Rejected after plan-specific semantic validation and declared cross-model artifact copying.
8. Active direct Claude/Codex review commands may remain. Rejected by active-source inventory; historical and unrelated worker/eval paths stay explicitly excluded.

## Findings and convergence

| Finding | Initial severity | Evidence | Resolution | Re-review |
|---|---|---|---|---|
| A-01 plan rubric not representable in shared envelope | high | schema vs `review-plan` promotion/Tier-3 contract | Added rubric/dependency/consumer payload fields and mandatory plan score validation | contract PASS |
| A-02 cross-model declared artifacts were not produced/consumed | high | frontmatter, command example, phase receipt mismatch | Copies findings/receipt to declared paths and consumes/receipts them coherently | contract PASS |
| A-03 YAML-era plan paths contradicted JSON transport | medium | frontmatter/self-verify/phase paths | Migrated transport paths and checks to JSON; YAML remains presentation-only review log | contract PASS |
| A-04 blind-floor launcher exit code drift | medium | skill said 3, adapter emitted 4 | Contract now consistently uses exit 4 and reserves retired exit 3 | contract PASS |
| A-05 external cancellation could leak detached provider | high | no signal forwarding | SIGINT/SIGTERM forward, await close/escalation, receipt `cancelled`, release lock | security PASS |
| A-06 lock ownership and crash recovery were unsafe | high | mutation TOCTOU and orphanable guard | Serialized owner-token mutations; guard records host/PID/start/token/heartbeat and reclaims dead/stale owners; SIGKILL replay passes | security + G5 PASS |
| A-07 plain diagnostics and untrusted JSON were misclassified | high | eligible branch only inspected broad structured fields | Nested error envelopes only, forbidden precedence, exact anchored plain allowlist, near-miss negatives | security/testing PASS |
| A-08 cache accepted semantically invalid source receipts | high | version/mode/attempt laundering repro | Exact reusable-primary semantic checks plus tuple/schema/launcher replay and future-time rejection | testing PASS |

All eight findings are resolved. Contract, security, and testing specialists independently re-ran their originating lenses. Fresh G5 re-review closed G5-007 on the final implementation hash. No Critical, High, Medium, or Low finding remains open.

## Concern coverage

| Concern | Disposition |
|---|---|
| provider fidelity | satisfied by validated provider evidence and exact Fable-5/high no-fallback receipt |
| security cross-family review | satisfied by review-exec, G5, and the security specialist |
| auth/session hits | false positive; orchestration session metadata contains no credential/session mutation |
| pricing-tier hit | false positive from a `docs/plans` pathname |
| UI/persona/data migration | N/A for a headless framework enabler |

## Validation evidence

- Focused external-review suite: 97 passed, 0 failed; fake CLIs only; no paid calls.
- Legacy review-plan hardening: 22 passed.
- Skill structure: 1035 passed.
- Skill contracts: 602 passed.
- Chain references: 275 passed.
- Task graph/lane, manifest lint, plan mechanical, System Contract Map, provider fidelity, pre/post evidence, old/new probe, JSON parsing, Node/Bash syntax, and `git diff --check`: pass.
- Pre/post evidence validator: pass. The acceptance-critical delta is classified fixed-by-change; the full-suite identities remain separately recorded and are refreshed in task 12.

## Residue

No implementation TODO/FIXME/stub, dead direct-review path, package dependency, lockfile, database migration, browser artifact, or WI-486/WI-487 behavior was introduced. `.svc/concern-hits.jsonl` and audit logs are machine-local evidence. Provider artifacts/cache remain ignored and non-authoritative.

## Unverified surfaces

Tier 1 intentionally made no paid model invocation. Installed CLI capability probes and the real Fable-5/high review receipt cover the live capability/independence boundary; promoted `origin/main` behavior is not claimed here and remains mandatory after merge.

## Verdict

- [x] READY TO LAND — no unresolved Critical or High finding
- [ ] BLOCKED
- [ ] CONDITIONAL

The implementation is ready to enter final full-suite validation, receipt freeze, landing, and promoted-state verification.
