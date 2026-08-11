# WI-489 reviewer runtime-routing diagnosis

**Status:** diagnosis complete; independently reviewed; ready for `write-spec`
**Source authority:** `docs/specs/work-items/WI-489.md`, the promoted WI-488 contract and proof, two real WI-486 invocation receipts, current official Anthropic behavior, and the owner's reviewer-profile decision
**Mode:** framework regression; normal full pipeline

## Spec and journey anchor

**Affected persona:** framework maintainer or Codex-orchestrated delivery session requesting an independent review.

**Goal:** submit one immutable review package to the canonical launcher and receive schema-valid findings plus a truthful receipt without an extra paid availability probe.

**Documented headless journey:** `docs/specs/features/wi-488-deterministic-external-reviewer.md` defines consumer → stdin package → policy/cache → primary provider → findings/receipt or classified failure. There is no browser or human-interaction journey.

**Relevant promoted acceptance criteria:**

- EXTREV-29 says Claude is limited to one turn.
- EXTREV-33 requires runtime metadata to confirm the effective model.
- EXTREV-41 says schema-invalid or malformed findings never authorize Opus fallback.
- EXTREV-42 forbids hidden same-invocation `--fallback-model` use.
- EXTREV-43 through EXTREV-50 require truthful receipts and conservative cache reuse.
- EXTREV-55 and EXTREV-56 require the primary paid invocation itself to be the availability probe, with no separate paid smoke call.

**Classification:** the promoted spec itself contains a gap. EXTREV-29 incorrectly equates one CLI protocol turn with one paid primary review invocation, and the route model has no state for Anthropic-managed Fable-to-Opus safeguard switching. The code implements that incomplete contract.

## Reproduction

**Trigger:** From the isolated WI-486 worktree, submit its completed plan package through promoted launcher 1.0.1 as a Codex-orchestrated Fable 5/high review with the shared JSON schema and no launcher fallback.

**Expected:** One paid primary review completes the bounded schema handshake, returns schema-valid findings, records the runtime model route, and either succeeds or produces a specific non-fallback schema-turn failure.

**Actual:** Two independent real attempts returned `subtype: error_max_turns`, `num_turns: 2`, `stop_reason: tool_use`, `terminal_reason: max_turns`, and `errors: ["Reached maximum number of turns (1)"]`. Each receipt classified the result `unknown_provider`, exposed no effective tuple or findings, and correctly made no Opus fallback. The event metadata showed Fable plus auxiliary Haiku usage and no Opus.

**Evidence:**

- `docs/specs/test-evidence/WI-489/wi486-schema-turn-reproduction.md` — preserved material fields and hashes
- `/workspace/seriousvibecoding/.worktrees/framework-WI-486-isolated-bootstrap/.svc/external-review-artifacts/WI-486/plan-primary/receipt.json`
- `/workspace/seriousvibecoding/.worktrees/framework-WI-486-isolated-bootstrap/.svc/external-review-artifacts/WI-486/plan-primary/attempt-1-events.jsonl`
- `/workspace/seriousvibecoding/.worktrees/framework-WI-486-isolated-bootstrap/.svc/external-review-artifacts/WI-486/plan-primary-retry/receipt.json`
- `/workspace/seriousvibecoding/.worktrees/framework-WI-486-isolated-bootstrap/.svc/external-review-artifacts/WI-486/plan-primary-retry/attempt-1-events.jsonl`

**Bug domain:** Code + platform-contract mismatch. The local launcher and its tests implement the documented one-turn assumption; current Claude structured output uses a schema tool round trip. Separately, Anthropic's provider-controlled model switching is platform behavior missing from the local state machine.

**Causal class:** Action bug. The external-review action fails to produce findings even though the primary provider generated a substantive response; the failure occurs before the structured result is returned to the consumer.

## Targeted reading list

The contract evidence limits code reading to these four surfaces:

1. `scripts/run-external-review.mjs` — Claude argv, provider-result parsing, failure classification, effective tuple, cache eligibility, and fallback decision.
2. `schemas/external-review-receipt.schema.json` — whether route kind, profile selection, policy version, and effective-effort provenance can be represented.
3. `references/model-registry.json` — current reviewer policy authority and whether a time/profile switch can be resolved without code edits.
4. `test-framework/evals/tier-1/validate-external-review-launcher.sh` — why fixture coverage accepted `--max-turns 1` and lacked provider-safety-route/time-boundary cases.

No implementation fix is selected until those reads confirm or refute the current hypothesis.

## Targeted code findings

| Surface | Contract result | Evidence |
|---|---|---|
| `scripts/run-external-review.mjs` Claude argv | drift | Both capability probe and real invocation hard-code `--max-turns 1`. |
| Provider failure classifier | gap | It reads structured `error.code` / `error.type` and stderr patterns, but not Claude result `subtype:error_max_turns`, `terminal_reason:max_turns`, or `errors[]`; the observed result becomes `unknown_provider`. |
| Effective-model validation | gap | Claude success accepts only requested model plus a fixed auxiliary-Haiku allowlist. A provider-routed Opus result is classified `model_mismatch`; no provider-route state exists. |
| Success receipt/cache publication | drift | Every successful primary sets `effective_tuple` to the requested tuple and publishes a reusable cache entry. It cannot truthfully preserve an accepted Fable-to-Opus provider route. |
| Receipt schema | gap | It has fallback and override objects but no policy profile/version/window, selection source, provider-route kind, or effective-effort provenance. |
| Model registry and launcher policy | gap | `externalReviewPolicy` and the launcher hold one static Fable-primary / Opus-xhigh fallback policy. There is no scheduled profile or explicit profile status/switch control. |
| Tier-1 fake Claude | drift | The fake returns final `structured_output` immediately, asserts `--max-turns 1`, and models any non-requested non-Haiku runtime model only as mismatch. It does not replay schema tool handshakes, `error_max_turns`, safety routing, or time-zone cutovers. |

## Fault isolation

The failed data path is:

`stdin package → Fable primary inference → schema tool_use → launcher-enforced turn ceiling → Claude error_max_turns result → incomplete classifier → unknown_provider receipt`.

The provider-safety path is:

`stdin package → exact requested Fable/high with CLI availability fallback disabled and refusal switching explicitly enabled → Anthropic safeguard provenance → same-conversation Opus 4.8 response → provider_safety_route`.

The current launcher avoids a duplicate Opus call only accidentally because `model_mismatch` is not fallback-eligible. WI-489 may accept the provider route only inside the isolated invocation envelope and with corroborating refusal-route evidence; observing Opus alone is insufficient. A legitimate route cannot satisfy a later Fable-primary cache request.

## Root cause

**Immediate cause:** the launcher bounds Claude to one agentic turn, so schema tool use cannot complete; the failure classifier does not understand Claude's structured max-turn result.

**Enabling condition:** WI-488 defined and tested “one paid primary invocation” as `--max-turns 1`. Its fake CLI skipped the real schema round trip, and the effective-model fixture represented only exact-primary success, known auxiliary Haiku, or unexplained mismatch.

**Systemic cause:** the launcher state machine treats all model routing as launcher-controlled. It has no representation for provider-managed same-conversation routing, no versioned reviewer profile policy, and no receipt fields that distinguish requested, invoked, provider-routed effective, and exact-versus-provider-managed effort.

**Prevention:** fixtures for paid external integrations must replay provider protocol transitions, not only final payloads. Receipts must model every authority that can change the effective tuple: owner profile policy, explicit owner selection, launcher fallback, and provider safety routing.

## Pillar Revisit Audit

| # | Pillar | Affected? | Evidence / follow-up |
|---|---|---|---|
| 1 | Product fit | no | Independent external review remains required; `FRAMEWORK-STATE.md` and the owner correction preserve the capability. |
| 2 | Journey | yes | The headless journey must add schema-handshake, provider-safety-route, scheduled profile selection, and explicit status/switch branches in the WI-489 spec. |
| 3 | Acceptance criteria | yes | EXTREV-29 is wrong as written and no AC covers safety routing, route-specific cache eligibility, schema-turn classification, or cutover boundaries; WI-489 `write-spec` must replace/add them. |
| 4 | UX | yes | Operators need one actionable profile status/switch interface and diagnostics that distinguish schema-turn exhaustion from provider routing. This is CLI UX, not browser UI. |
| 5 | UI | no | No visual layout, component, token, viewport, motion, or screenshot surface exists. |
| 6 | Tech architecture | yes | The launcher, policy authority, receipt schema, semantic validation, cache rules, and fixtures change together; `design-tech` remains mandatory. |
| 7 | Cost model | yes | Opus/high becomes the normal Codex-orchestrated reviewer at the owner cutover; provider safety switching and schema turns must remain bounded to one primary paid invocation. Update the cost model without inventing post-July-19 pricing. |
| 8 | Operations & ownership | yes | Policy version/window/source, explicit switch provenance, provider route, new failure classification, and recovery guidance must be visible in receipts and status output. |

No pillar remains unknown. The affected journey, AC, CLI UX, architecture, cost, and operations changes are all cohesive parts of WI-489 rather than independent follow-up work.

## Pattern Scan

**Scope:** repository-wide active-source searches for `--max-turns 1`, `error_max_turns`, `modelUsage`, `effective_tuple`, `model_mismatch`, cache reusability, `claude-fable-5`, `claude-opus-4-8`, static external-review policy, and direct paid review commands. Historical docs/proposals and generated results were excluded from executable-sibling counts.

**Findings:**

- The only active `--max-turns 1` behavioral assertion is in `validate-external-review-launcher.sh`; the only runtime producer is `run-external-review.mjs`.
- Effective-model, receipt, and cache semantics are centralized in the launcher and its receipt schema, so there is no second runtime implementation to repair.
- Static external-review policy is duplicated in three active authorities: launcher constants, `references/model-registry.json`, and `scripts/resolve-adversarial-reviewer.sh`. All three must consume or expose the same versioned profile decision.
- The source inventory confirms active independent review consumers already enter through the canonical launcher. Other `claude -p` calls are worker/eval/extraction surfaces outside WI-489 and remain excluded.
- No active fixture recognizes `error_max_turns`, `terminal_reason:max_turns`, a schema tool handshake, provider safety routing, or cutover/time-zone boundaries.

**Followups:** none. The hits are one cohesive external-review runtime correction. WI-486 and WI-487 remain dependent work, not pattern-scan siblings.

## Register Discoveries

**Corrections found:** one cohesive correction with four inseparable boundaries: Claude protocol turns/classification, provider-route receipt/cache semantics, scheduled reviewer profiles, and protocol-faithful fixtures.

**Decomposition:** single correction — no new WI needed. Splitting these would temporarily permit false receipts, duplicate Opus behavior, or policy drift. WI-489 owns the atomic correction; WI-486 and WI-487 remain paused dependencies.

## Smallest safe fix surface

**Behavior to preserve:** one canonical stdin launcher; Claude→Codex 5.6 sol/high; safe/read-only isolation; no hidden CLI fallback; only model-unavailable, entitlement, and overload may launch the explicit availability fallback; all auth/quota/network/timeout/schema failures hard-fail; fixture-only Tier-1; exact-primary cache reuse only.

**Behavior to change:**

1. Replace the one-turn assumption with `--max-turns 4`, existing timeout/dollar ceilings, and explicit `schema_turn_budget` classification while separately enforcing one primary paid invocation. Four permits the observed two-turn schema handshake plus one bounded validation re-prompt without allowing an open loop.
2. Model Anthropic-managed Fable→Opus routing as `provider_safety_route`. Force the supported refusal-switch setting on for the isolated invocation, omit CLI availability fallback, scrub refusal-disable/model-remap environment controls, and require corroborating refusal-route evidence plus effective Opus 4.8 runtime usage. Suppress a second Opus invocation, record effort provenance as provider-managed unless exact proof exists, and make the result non-reusable for Fable primary. Opus observation without this envelope/evidence remains `model_mismatch`.
3. Add a versioned reviewer-profile authority with the owner cutover and a hashed, receipted explicit selection/status mechanism for switching back to `fable-high` without editing code.
4. Make launcher, resolver, registry, receipt schema, semantic validation, docs, and fixtures agree on the selected profile and route.

**Likely implementation surfaces:** `scripts/run-external-review.mjs`, `schemas/external-review-receipt.schema.json`, `references/model-registry.json`, `scripts/resolve-adversarial-reviewer.sh`, `test-framework/evals/tier-1/validate-external-review-launcher.sh`, and the affected review/spec contracts. `design-tech` decides whether profile status/switch is a launcher subcommand or a narrow companion over the same policy module.

## Proof of fix

1. Fixture replay proves Claude receives the bounded schema turn limit and completes a simulated schema tool handshake after one primary call.
2. `error_max_turns` with `stop_reason:tool_use` becomes `schema_turn_budget`, emits an actionable receipt, and never launches Opus.
3. A provider-routed Fable request with Opus 4.8 runtime evidence succeeds as `provider_safety_route`, records the route and provider-managed effort provenance, makes one provider invocation, launches no second Opus, and cannot hit a later Fable-primary cache lookup.
4. An unexplained runtime model remains `model_mismatch` and fails closed.
5. Before/at/after `2026-07-19T21:00:00Z` (`2026-07-20 00:00:00 EEST`, `Europe/Sofia`) fixtures prove deterministic profile resolution; explicit status/switch fixtures prove a hashed owner selection can re-enable `fable-high` and is fully receipted.
6. Existing forbidden-fallback, isolation, stream, timeout, override, lock, cache, consumer-inventory, task-graph, receipt, Markdown, proposal/spec, JSONL, and full Tier-1 checks remain green or improve against the recorded baseline.
7. One bounded real review through the corrected canonical launcher explicitly selects `fable-high`, produces schema-valid findings and a truthful receipt, and proves the multi-turn schema path. The primary is the probe; no separate paid smoke call occurs.
8. Repeated schema-validation re-prompts deterministically exhaust at four turns as `schema_turn_budget`, with one invocation and no Opus launch.

## Affected artifacts

- Work item and INDEX: WI-489 status/AC/proof lifecycle.
- Feature spec and headless journey: new WI-489 delta over WI-488.
- Technical design and decision record: provider route, profile schedule, effort provenance, cache semantics.
- Schemas/runtime: launcher receipt and semantic validation.
- Model policy: registry and resolver compatibility output.
- Tests: protocol, failure, safety-route, cutover, switch, cache, and call-count fixtures.
- Review/landing evidence: plan review, frozen-diff review, security review, audit, land, and promoted verification receipts.
- No visual, browser, mobile, database, or deployment artifact applies.

## Learning

A fake provider that emits only the final happy-path payload is not a faithful fixture for a tool-mediated protocol. External-integration tests must model the provider's intermediate state transitions and every authority that can alter the effective model; otherwise the fixture can certify the exact assumption that fails in real use.

## Causal Chain Summary

```yaml
symptom: "Fable plan review consumes tokens but returns no findings"
proximate_cause: "Claude reaches schema tool use after the launcher-enforced one-turn ceiling"
root_cause: "WI-488 equated one paid primary invocation with one agentic CLI turn and its fixture skipped the schema handshake"
systemic_cause: "the state machine models only launcher-controlled model changes, not provider-managed routing or versioned owner policy"
prevention: "replay protocol transitions and receipt every authority that changes the effective tuple"
```

## Pillars Coverage Matrix

| # | Pillar | State | Artifact / note |
|---|---|---|---|
| 1 | Product fit | [UNCHANGED — VERIFIED] | `FRAMEWORK-STATE.md`; independent review remains required |
| 2 | Journey | [UPDATED] | WI-489 write-spec must update the headless system journey |
| 3 | Acceptance criteria | [UPDATED] | WI-489 replaces one-turn semantics and adds route/profile/cache proof |
| 4 | UX | [UPDATED] | Operator CLI status/switch and actionable diagnostics |
| 5 | UI | [N/A — justified] | Headless launcher has no visual surface |
| 6 | Tech architecture | [UPDATED] | Mandatory WI-489 `design-tech` task |
| 7 | Cost model | [UPDATED] | Scheduled Opus/high default plus one-primary invocation bound |
| 8 | Operations & ownership | [UPDATED] | Policy/route provenance, recovery, and status visibility |

**Next:** `write-spec` must baseline the complete WI-489 delta before technical design or implementation.
