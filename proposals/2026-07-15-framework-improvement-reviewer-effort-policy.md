# Framework improvement: deterministic cross-model reviewer effort

**Status:** DRAFT
accepted_wi: WI-488
**Date:** 2026-07-15
**Source:** explicit owner correction after an over-provisioned Fable review invocation
**Candidate severity:** high
**Severity:** high
**Plan-changeset class:** contract-change

## Gap

The adversarial reviewer resolver selects a host family but does not provide one authoritative, consumer-enforced tuple of reviewer model, version, and effort. Individual scripts pin partial settings, aliases can drift, and an operator can accidentally run Fable at xhigh/max even though high is the intended quality/cost point. The external CLI calls also lack one reproducible invocation contract for isolation, structured output, time/cost ceilings, and evidence.

This proposal covers one gap only: **normal cross-model review lacks a deterministic, observable invocation policy that every dispatch path consumes**.

## Required policy

| Orchestrator | Preferred reviewer | Effort | Fallback |
|---|---|---|---|
| Claude | Codex 5.6 sol | high | Hard-fail with availability receipt; no silent reviewer/model/effort substitution |
| Codex | Fable 5 | high | Opus at xhigh, only when Fable 5 is unavailable |

Fable xhigh/max and Codex effort above high are not normal defaults. A higher setting is permitted only through an explicit owner override that is recorded in the review receipt.

## Evidence

- `scripts/resolve-adversarial-reviewer.sh` currently returns reviewer host availability but no model or effort.
- `scripts/review-plan-codex.sh` independently pins `gpt-5.5` and high, demonstrating consumer-local drift from the requested Codex 5.6 sol policy.
- `review-cross-model/SKILL.md` currently documents `codex -p ... --output-format text`. With the installed Codex CLI 0.144.4, `-p` means `--profile` and `--output-format` is not a Codex option, so the documented external review path is not executable.
- The current Codex launcher passes a large prompt as an argv value, merges stderr into stdout, persists the default session, inherits user configuration, and accepts unstructured prose. Those choices make shell quoting, output parsing, replay, and effective-model evidence weaker than the current CLI permits.
- The installed Claude Code 2.1.210 exposes safe-mode isolation, no-session-persistence, schema-validated JSON, explicit model/effort, turn/budget ceilings, and strict MCP/tool controls, but no shared launcher currently enforces them.
- Current official Anthropic support guidance says the separately metered Agent SDK credit change was paused; `claude -p` still draws from subscription usage limits for now. The framework's contrary billing knowledge is stale and must not drive reviewer routing.
- The first Fable intake invocation was accidentally started above high and had to be cancelled. The completed review used `--model fable --effort high`.
- `references/model-registry.json` describes stage routing but is not currently the mechanically consumed authority for this cross-family reviewer tuple.

## Relationship to existing skills

This extends `review-cross-model/SKILL.md` and the reviewer resolver; it does not add another review gate. `review-plan/SKILL.md` and `review-gate/SKILL.md` keep their review semantics and acceptance thresholds, but their external reviewer dispatch must consume the same resolved tuple and canonical launcher. The primary paid review invocation itself is the model-availability probe; a separate paid smoke invocation is forbidden. Fallback is permitted only after a classified model-unavailable, model-entitlement, or provider-overload result, not after authentication, subscription-quota exhaustion, network, timeout, schema, or reviewer-contract failure.

## External invocation contract

One canonical launcher must accept the resolved tuple and a review package on stdin, then emit a schema-validated review plus a machine-readable receipt. Direct Claude/Codex review invocations outside that launcher are migration inventory, not permanent alternate paths.

For Codex, the launcher must use non-interactive `codex exec`, stdin, `--ephemeral`, user-config/rules isolation, strict config validation, read-only sandboxing, explicit Codex 5.6 sol/high, JSONL events, an output schema, a separate final-message file, and no color. Stdout, stderr, events, and the final structured review remain separate. The receipt always proves the declared tuple matches the exact CLI arguments/config; it also records runtime-reported effective model/effort when the installed CLI exposes them. The pre-execution capability check must confirm these isolation flags preserve the configured `CODEX_HOME` authentication path.

For Claude, the launcher must use `claude -p` with the full requested model id and effort, `--safe-mode` rather than `--bare` so subscription OAuth/keychain auth remains usable, no tools or MCP servers, plan permission mode, no session persistence, one turn, schema-validated JSON, and a configurable timeout and budget ceiling. The launcher must verify the effective model in Claude's `modelUsage` metadata. Opus xhigh is a new, separate invocation only after an explicitly classified Fable-5 availability failure; `--fallback-model` must not hide the fallback boundary.

Both paths must hash the canonical review package, resolved tuple, schema version, and launcher version. A valid prior receipt for the same hash may be reused to avoid a duplicate paid review only when its effective tuple equals the requested primary tuple and it has no fallback provenance; changed inputs invalidate the cache. A fallback receipt never satisfies a later primary-model request, so recovered Fable availability receives a fresh Fable review. Receipts record CLI version, requested tuple, effective tuple when exposed, exact invocation tuple, package hash, timestamps, exit classification, cost/usage metadata when exposed, fallback/override provenance, and artifact paths without storing credentials.

## Proposed change boundary

Likely implementation surfaces after planning:

- `scripts/resolve-adversarial-reviewer.sh`
- one canonical launcher, for example `scripts/run-cross-model-review.sh`
- one shared output contract, for example `schemas/cross-model-review.schema.json`
- `scripts/review-plan-codex.sh`, `scripts/blind-floor-judge.sh`, `scripts/prompt-floor-judge.sh`, and every other Claude/Codex cross-review launcher or documented direct invocation
- `review-cross-model/SKILL.md`
- `review-plan/SKILL.md` and/or `review-gate/SKILL.md` only where they dispatch the reviewer
- `references/model-registry.json` or a dedicated existing routing authority
- reviewer-routing fixtures under `test-framework/evals/tier-1/`

## Acceptance criteria

- **AC-488-1:** Reviewer resolution emits a machine-readable tuple containing orchestrator, selected reviewer, effective model/version, effort, availability result, fallback reason, and whether an owner override was used.
- **AC-488-2:** Claude-orchestrated cross-family review resolves to Codex 5.6 sol at high and the launcher consumes that exact tuple.
- **AC-488-3:** Codex-orchestrated cross-family review resolves to Fable 5 at high when Fable 5 is available and the launcher consumes that exact tuple.
- **AC-488-4:** When and only when Fable 5 is unavailable, Codex-orchestrated review resolves to Opus at xhigh and records the failed Fable availability probe.
- **AC-488-4A:** When Codex 5.6 sol is unavailable for a Claude-orchestrated review, resolution hard-fails and records the failed availability/model probe; it does not substitute another model or raise effort.
- **AC-488-5:** Default resolution rejects Fable xhigh/max and Codex effort above high rather than silently accepting a more expensive configuration.
- **AC-488-6:** An explicit owner override can select a higher effort only when its source and requested tuple are recorded in the review receipt.
- **AC-488-7:** A declared tuple that differs from the actual CLI invocation fails validation.
- **AC-488-8:** Model aliases must resolve to the requested family/version; an alias resolving to a different version is unavailable, not silently accepted.
- **AC-488-9:** Every external review package is delivered through stdin to one canonical launcher; obsolete Codex `-p`/`--output-format` examples and consumer-local direct review invocations are eliminated.
- **AC-488-10:** Codex review runs are ephemeral, read-only, user-config/rules isolated without losing `CODEX_HOME` auth, strict-configured, schema-constrained, and stream-separated; the receipt proves requested tuple equals exact invocation tuple and records runtime-reported effective model/effort when exposed.
- **AC-488-11:** Claude review runs are safe-mode isolated without breaking subscription OAuth/keychain auth, tool/MCP disabled, plan-permission, non-persistent, one-turn, schema-constrained, and bounded by configurable timeout/budget; the receipt proves Fable 5/high or the authorized Opus/xhigh fallback.
- **AC-488-12:** Authentication, shared subscription-quota exhaustion, network, timeout, malformed/schema-invalid output, and reviewer-contract failures never trigger the Opus fallback. Only a classified Fable-5 model unavailable, model-entitlement, or provider-overload result can do so.
- **AC-488-13:** The primary review is the availability probe; no separate paid model smoke call is made. A content-addressed valid primary receipt may satisfy an identical request only when effective tuple equals requested primary tuple and no fallback occurred. Fallback receipts are never cache hits for later primary requests, and any package, tuple, schema, or launcher change forces a fresh review.
- **AC-488-14:** Launcher startup checks required CLI flags and minimum compatible versions, then hard-fails with one actionable diagnostic when the installed CLI cannot honor the contract.

## Negative tests

- Fable available at high.
- Fable command available but Fable 5 model unavailable.
- Fable unavailable and Opus xhigh available.
- Fable invoked at xhigh/max without owner override.
- Codex invoked above high or on an older model than 5.6 sol.
- Codex 5.6 sol unavailable on the Claude path, asserting hard failure plus receipt and no fallback invocation.
- Resolver declares high while consumer launches xhigh.
- Stale alias resolves to the wrong model version.
- Owner override absent, forged, or not included in the receipt.
- Obsolete `codex -p ... --output-format text` usage is rejected by the invocation inventory test.
- Duplicate identical package reuses a valid primary receipt; a fallback-provenance receipt or any content, tuple, schema, or launcher-version change misses the primary cache.
- Fable authentication failure, shared subscription-quota exhaustion, network failure, timeout, or schema-invalid output does not launch Opus.
- Fable 5 unavailable/overloaded launches a separate receipted Opus xhigh invocation exactly once.
- Requested/effective model mismatch, merged stdout/stderr, missing cost/usage metadata when exposed, or malformed structured output fails closed.
- Installed CLI missing a required isolation or schema flag fails with the required version/upgrade action; no degraded invocation is attempted.

## Route

**Lane:** framework
Severity: high — unbounded review effort creates recurring cost and reproducibility failures across every guarded review path.
**Plan class:** full mandatory chain because this is shared review-routing infrastructure, not a one-script quick fix.
**Sequence:** execute WI-488 first, then use its canonical high-effort reviewer launcher for WI-486 and WI-487. Within WI-488: diagnose-bug → write-spec → plan-changeset → adversarial review → execute-changeset → review-exec → audit-implementation → land-changeset → verify-promotion.

## Rollback and replay proof

Rollback restores the prior resolver, canonical launcher, schema, and all consumers together. Replay fixtures must compare resolved tuples to captured CLI arguments and receipts for both orchestrator directions, the deliberate Fable-unavailable Opus-xhigh fallback, content-addressed cache hit/miss behavior, stream separation, and the Codex-unavailable hard-fail path. No Tier-1 test may require a paid live review; CLI responses and availability classifications are fixture-controlled.
