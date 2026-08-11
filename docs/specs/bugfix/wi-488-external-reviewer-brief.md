# WI-488 external reviewer invocation diagnosis

**Status:** diagnosis complete
**Source authority:** `docs/specs/work-items/WI-488.md`, the accepted owner contract, and `proposals/2026-07-15-framework-improvement-reviewer-effort-policy.md`

## Bug-domain classification

**Domain:** Code/contract. The framework-owned resolver and review consumers do not enforce one exact reviewer tuple or one current CLI invocation contract. No test-fixture or upstream-platform behavior is needed to reproduce the structural mismatch.

## Reproduction

**Trigger:** Resolve and launch an independent external review through any current review-plan or review-cross-model path.
**Expected:** One canonical launcher consumes the resolved tuple and stdin package, validates a shared findings schema, writes a receipt, and either runs the exact primary tuple or returns one classified actionable hard failure.
**Actual:** Resolution and execution are split across consumer-local scripts/examples; tuple/model/effort/isolation/schema/stream/cache/fallback behavior is not jointly enforced, and the documented Codex `-p ... --output-format` form does not match installed Codex CLI 0.144.4.

**Causal category:** Action/contract bug. The review action itself lacks a valid, deterministic end-to-end invocation path; this is not a propagation or rendering failure.

## Expected behavior anchor

The fourteen ACs in `docs/specs/work-items/WI-488.md` are the authoritative expected behavior. There is no product journey because this is headless framework infrastructure; controlled CLI fixtures are the behavioral surface.

## Targeted reading list

1. `scripts/resolve-adversarial-reviewer.sh` — tuple resolution and fallback classification.
2. `scripts/review-plan-codex.sh` — current Codex review execution.
3. `review-cross-model/SKILL.md` — documented direct invocation.
4. All repository hits for direct `claude -p`, `codex exec`, `codex -p`, model pins, output-format, and reviewer resolver calls — consumer/pattern inventory.

## Root cause

**Immediate cause:** `scripts/resolve-adversarial-reviewer.sh` resolves only a host label and runs separate capability probes. The consumer then constructs its own command, model pin, prompt transport, output parsing, and fallback behavior. There is no executable boundary at which the requested tuple can be compared with the effective tuple.

**Enabling condition:** review findings and chain receipts are separate contracts. `scripts/review-plan-codex.sh`, `scripts/blind-floor-judge.sh`, and `scripts/prompt-floor-judge.sh` parse consumer-specific output, while `review-cross-model/SKILL.md` documents direct commands. None shares a schema, failure taxonomy, receipt builder, or content-addressed key.

**Systemic cause:** the framework treated reviewer selection as routing metadata rather than a paid external action. Consequently, availability probing, authentication preservation, provider fallback, budget ceilings, cache reuse, and evidence were allowed to drift independently across consumers.

The smallest causal chain is:

```text
host-only resolver
  -> consumer-local command construction
  -> requested/effective tuple cannot be bound
  -> provider failures cannot be classified consistently
  -> fallback/cache/receipt policy cannot be enforced
```

## Targeted code classification

| Surface | Classification | Evidence |
|---|---|---|
| `scripts/resolve-adversarial-reviewer.sh` | drift | Returns `primary`, `fallback`, and `selected`, but no exact model, effort, fallback class, or override state; it probes before the paid invocation. |
| `scripts/review-plan-codex.sh` | drift | Pins `gpt-5.5` high locally, passes the package through argv, merges streams, and omits strict config, ephemeral/user-rule isolation, schema, receipt, and cache. |
| `scripts/blind-floor-judge.sh` | drift | Calls the resolver and then directly invokes Codex/agy with consumer-local model/output parsing. |
| `scripts/prompt-floor-judge.sh` | drift | Duplicates the blind-floor direct invocation and parsing path. |
| `review-cross-model/SKILL.md` | broken example | Uses `codex -p ... --output-format text`; installed Codex CLI 0.144.4 defines `-p` as profile and has no such output-format flag. |
| `review-plan/SKILL.md` and `references/plan-review-protocol.md` | drift | Describe a Codex/Sonnet/Kimi cascade instead of the accepted exact orchestrator-to-reviewer tuples and classified fallback boundary. |
| `review-exec/SKILL.md` | gap | Expects pair selection plus a separate cross-model dispatch, but has no shared launcher receipt to prove effective tuple or fallback provenance. |

## Pillar Revisit Audit

| # | Pillar | Affected? | Evidence / follow-up |
|---|---|---|---|
| 1 | Product fit | no | The independent-review capability remains required; WI-488 changes execution integrity, not whether the capability should exist. |
| 2 | Journey | no | This is headless framework infrastructure with no user journey step; fixture-driven CLI behavior is the applicable surface. |
| 3 | Acceptance criteria | yes | `docs/specs/work-items/WI-488.md` contains the accepted contract; write-spec will baseline it and add fixture-verifiable AC mappings in WI-488. |
| 4 | UX | no | No user-visible interaction, copy, accessibility, or state transition changes. |
| 5 | UI | no | No visual surface, component, token, breakpoint, motion, or screenshot baseline exists. |
| 6 | Tech architecture | yes | One launcher must own CLI isolation, schema validation, stream handling, classification, receipt emission, and cache reuse; design-tech is mandatory in WI-488. |
| 7 | Cost model | yes | The primary call becomes the availability probe, cache reuse prevents duplicate paid calls, and timeout/budget/effort ceilings are explicit in WI-488. |
| 8 | Operations & ownership | yes | Missing capabilities and provider failures become one actionable classified hard failure with durable evidence; owner overrides require receipts. |

## Pattern Scan

**Scope:** active source and contract surfaces outside historical `docs/`, `scratch/`, archived framework state, proposals, research evidence, and generated fixtures. Patterns covered resolver calls plus direct Codex/Claude review invocations and the obsolete Codex `-p`/`--output-format` form.

**Findings:**

- Direct paid review consumers: `scripts/review-plan-codex.sh`, `scripts/blind-floor-judge.sh`, and `scripts/prompt-floor-judge.sh`.
- Broken direct examples: `review-cross-model/SKILL.md` has two obsolete Codex command forms.
- Resolver-first consumers/contracts: `review-exec/SKILL.md`, `blind-control-plan/SKILL.md`, `craft-prompt/SKILL.md`, and `craft-prompt/references/authoring-rubric.md`.
- Routing authority to align: `review-plan/SKILL.md`, `references/plan-review-protocol.md`, host-facing docs that describe resolver output, and relevant Tier-1 validators.
- Unrelated Claude/Codex uses such as Tier-2/3 evaluation, worker dispatch, extraction, design generation, and optional eval-gate judging are not independent-review consumers and remain out of scope.

**Followups:** none. Every active review consumer is one migration concern within WI-488. Historical receipts and transcripts remain immutable evidence and are excluded from source-inventory enforcement.

## Register Discoveries

**Corrections found:** one cohesive correction: canonicalize deterministic external-review execution and migrate its active consumers.

**Decomposition:** none. WI-486 (session-isolated bootstrap) and WI-487 (durable all-host installation/hook diagnostics) are already registered dependent work items and are not causal siblings of WI-488. Their accepted scope must not be absorbed into this change.

## Smallest safe fix boundary

- Add one canonical launcher plus one shared findings schema and one invocation-receipt schema.
- Keep tuple resolution as framework-owned policy, but make the launcher the only execution and fallback authority.
- Migrate the three direct scripts and review skill/protocol examples to the launcher; add a source-inventory validator that blocks new direct review commands.
- Preserve unrelated model-powered evaluation, worker, extraction, and creative invocations.
- Use fixture-controlled fake CLIs and deterministic replay in Tier 1; never make a paid model call from Tier 1.
- Do not modify session ownership/bootstrap behavior (WI-486) or installation/hook distribution behavior (WI-487).

## Proof plan

1. Resolver-policy fixtures cover Claude/Codex orchestrators, exact tuples, rejected effort escalation, and receipted owner override.
2. Fake-Codex fixtures prove stdin transport, read-only/ephemeral/config-and-rule isolation, preserved auth environment, strict config, schema constraint, and separated streams.
3. Fake-Claude fixtures prove safe mode, OAuth/keychain compatibility, disabled tools/MCP, plan permission, non-persistence, one turn, schema constraint, timeout, and budget.
4. Failure fixtures prove only Fable model-unavailable, entitlement, and provider-overload classifications allow a separate Opus-xhigh invocation; auth, shared quota, network, timeout, schema, and missing-capability failures do not.
5. Cache replay fixtures prove package/tuple/schema/launcher-version invalidation and reject fallback receipts as primary hits.
6. Consumer inventory proves active review consumers use the launcher and obsolete Codex examples are absent.
7. Run task-graph, receipt, proposal/spec/Markdown, `git diff --check`, targeted Tier-1, and the full Tier-1 suite against the recorded pre-change baseline.

## Learning

An external reviewer is a paid integration, not a host-selection hint. Its tuple, transport, isolation, schema, failure taxonomy, fallback, cache, and evidence must cross one executable boundary or none of those properties is independently enforceable.

## Pillars Coverage Matrix

| # | Pillar | State | Artifact / note |
|---|---|---|---|
| 1 | Product fit | [UNCHANGED — VERIFIED] | `FRAMEWORK-STATE.md`; independent review remains required |
| 2 | Journey | [UPDATED] | Contract journey in `docs/specs/features/wi-488-deterministic-external-reviewer.md` |
| 3 | Acceptance criteria | [UPDATED] | EXTREV-01 through EXTREV-65 in the WI-488 feature spec |
| 4 | UX | [N/A — justified] | Headless launcher has no human interaction or accessibility surface |
| 5 | UI | [N/A — justified] | Headless launcher has no visual or screenshot surface |
| 6 | Tech architecture | [UPDATED] | Mandatory WI-488 `design-tech` stage |
| 7 | Cost model | [UPDATED] | Primary-call probe, effort/budget ceilings, and exact-primary cache policy |
| 8 | Operations & ownership | [UPDATED] | Classified actionable failures, durable receipts, and owner override provenance |
