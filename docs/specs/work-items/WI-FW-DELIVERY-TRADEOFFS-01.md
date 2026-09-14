# WI-FW-DELIVERY-TRADEOFFS-01 — Whole-solution planning and bounded delivery overhead

Status: CHANGE-SET-APPROVED; implementation under validation. Type: Enabler. Mode: contract-change. Lane: framework. Owner: repository owner.

## Intent

Deliver the owner's target of roughly 30 minutes of strong planning, at most 120 minutes implementation including tests/review, and at most 10 minutes finalization for a feature on an established delivery path. Preserve product ambition, UX, performance and evidence quality. This change makes the process executable and measurable; it does not claim every platform-sized program fits 160 minutes or that 5x has already been achieved. The owner subsequently authorized implementation and normal delivery; open-source preparation is excluded.

## Evidence and decisions

The planning-purpose-redesign analysis and delivery-planning-proposal-cross-model review preserve the owner clarification, receipts and all 16 finding dispositions. A paper replay is in the changeset directory. Product/session inspection is evidence only; product code, provider state and active sessions are outside implementation scope.

## Acceptance Criteria

| ID | Requirement |
|---|---|
| AC-DP-01 | Whole-solution planning fixes user states, state ownership, shared API/HTTP and data semantics, concurrency, migrations, file envelope, proof kinds and existing delivery path before execution. Reversal affecting another behavior part or important proof is consequential; local reversible details stay in execution. |
| AC-DP-02 | An explicitly inline schema-version-4 plan accepts producer-bound future values without full branch-to-merge shell transcription. Dispatch, absent-mode and legacy receipt behavior retain their existing requirements; no premature external action is permitted. |
| AC-DP-03 | The existing manifest task/validation record is the single authored mapping. Generated AC/task/test views and receipt body stay bound to the authoritative spec; missing, contradictory or stale mappings fail. An index digest is navigation, not proof of implementation. |
| AC-DP-04 | Executor handoff contains applicable original AC/UX/technical clauses and targeted read permission while retaining exact write scope, controller/delegation authority and isolated child writes. Unknown imports may be read within the project scope; widening writes needs the existing authority path. |
| AC-DP-05 | Finalization reuses the named existing land/verify/adapter path. Receipts are captured by their actual producers. Full tier-1 evidence is reused only for exactly matching verified inputs and options; otherwise the required suite runs. No quality, native or performance evidence is downgraded. |
| AC-DP-06 | Fresh branch indexes remain untouched when their existing freshness check passes; stale semantic facts still require reinspection and genuine review. Unchanged findings do not cause another full review; changed consequential lenses follow the existing review policy and cap. |
| AC-DP-07 | 30/120/10 remains an observable target, never an authority or quality bypass. First feature-specific work starts cumulative timing, including discovery, reviews, retries and amendments. Real external waiting is separately visible within total time; unknown intervals stay unknown; no artificial reset across sessions or WIs. |
| AC-DP-08 | New plan bodies pass the actual schema, emitter, checker, execution and L2/L3 consumer paths; malformed bodies fail consistently. Old valid receipts and already-running sessions retain their pinned behavior. Migration is new-plan-only after source/install capability checks. |
| AC-DP-09 | Retrospective iOS/race/manual-choice counterexamples and a paired same-input pilot preserve the acceptance/evidence bar. A paper replay or smaller plan is not called a 5x speed result; subsequent same-scope delivery timing is required for that claim. |
| AC-DP-10 | Framework changes ship as one compatible release across all provisioned hosts through canonical main setup, drift checks and existing promotion recovery. Rollback restores the prior package without rewriting historical receipts or weakening gates. |
| AC-DP-11 | Release-blocking report/transport mistakes recover automatically at most once within the original timeout and any transport-enforced dollar ceiling. Transports without dollar enforcement must expose that limitation and cannot retry under an explicit dollar cap; raw attempts and substantive judgments stay intact. Verified zero-call cache replays do not consume an adversarial round. Auth, model/safety failures, real defects and missing required proof remain blocking. |

## Technical Design

Use the existing manifest, spec, task graph, plan-manifest receipts, CLI launcher, reviewer policy, git-note storage and host installer. Add a shared pure plan-body validator/projector and a thin preparation command; retain the existing tier-1 evidence machinery; the proposed new cache was removed after review found no established first-delivery reuse edge. Extend existing timing logs and receipt mining, not a new scheduler, receipt family or dashboard. Exact interfaces, writer lifecycle, compatibility, proof scenarios and consumer inventory are fixed in the manifest. No additional npm dependency, database, service or application UI is introduced.

## Alternatives and rationale

1. Skill prose alone: rejected because emitter/checker/prompts independently impose the old constraints.
2. Remove reviews/receipts: rejected; history includes real concurrency and UX defects and valuable candidate identity.
3. New planning/runtime engine: rejected; the existing graph, note store, risk contracts and release path are adequate.
4. Coordinated inline contract change, retained dispatch packet, reused release evidence and measured cycle: selected.

## Quality and operations

Performance is assessed by elapsed critical path and the relevant product observation, not validator counts. New plan support is installed from canonical main after release; active sessions finish on their existing contract unless their owner explicitly migrates them. The timing target is advisory to prioritization, never permission to skip evidence or stop authorized recoverable work.

## Consumer stories and journey

The planning orchestrator closes consequential product decisions, then emits a bounded implementation task without rewriting its code. The executor receives the original relevant requirements and rejects stale handoff instead of guessing. The reviewer judges missing behavior and proof, preserving dispatch completeness. The builder can inspect cumulative planning/build/finalization time, including gaps, without losing quality to a clock cutoff.

Journey: accepted feature intent → whole-solution decisions → mechanically validated, independently reviewed plan → original-clause handoff → implementation and appropriate tests → existing reviewed merge → canonical installation and observed verification. A changed requirement invalidates its handoff; a failed producer keeps dependent work pending; a failed install keeps verification open. Counterexample/AC mappings and executable paired replay live in manifest.md and pilot.md.

## System Dependencies

Consumes canonical AC text, existing task graph, Git source identity, state-io and owner reviewer policy. Produces plan bodies for emit-receipt/check-chain, original context for execute-changeset, and additive mechanical timing events for mine-receipts. No new service or unbuilt product dependency. Keep historical note and running-session contracts.

## Industry Grounding

Landscape inapplicable: this is an internal framework contract repair grounded in recorded iOS and multicontext failures, not a new market feature. External competitor research would not decide the local schema/consumer correctness. Preserve progressive narrowing and independent review; repair observed waste in our actual pipeline.

## Pillars Coverage Matrix

| # | Pillar | State | Artifact / note |
|---|---|---|---|
| 1 | Product fit | [UPDATED] | Owner explicitly prioritizes feature delivery with preserved UX/performance |
| 2 | Journey | [UPDATED] | Consumer stories and journey above |
| 3 | Acceptance criteria | [UPDATED] | AC-DP-01 through AC-DP-11 |
| 4 | UX | [UPDATED] | CLI rejects stale context; reports unknown time honestly; no redundant input |
| 5 | UI | [N/A — justified] | No graphical product surface or design tokens |
| 6 | Tech architecture | [UPDATED] | Existing consumers plus shared pure contract validator |
| 7 | Cost model | [UPDATED] | One bounded report-repair call when necessary; no new service; local focused validator budget under 5 seconds |
| 8 | Operations & ownership | [UPDATED] | Owner's existing release path and canonical all-host install, failure blocks completion |

Scope decision: Hold product ambition; reduce unproved cache machinery. Five considered paths: prose-only, remove review, new execution engine, coordinated contract repair, new evidence cache. Choose coordinated repair; evidence-cache addition is rejected after no real reuse opportunity was established. Existing proposal reviews supply scope counterarguments; no new paid scope gate is needed.
