# Product Outcome Improvement Protocol v2

## Purpose

SVC exists to turn an owner's direction into the best evidence-supported product outcome it can
produce within explicit authority, quality, reliability, safety, time and cost constraints. Speed
is valuable only when the resulting product is at least as correct and better aligned with the
target outcome. Framework self-improvement is not the primary loop; it is one downstream consumer
of evidence generated while improving real products.

The canonical loop is:

```text
owner direction and constraints
  -> product/market/domain/competitor evidence
  -> evidence-ranked outcome options
  -> owner or delegated strategic decision
  -> product proof graph and applicable-layer obligations
  -> task capsules and conflict-aware execution
  -> behavioral evidence and holistic review
  -> release/canary/live verification
  -> observed product-outcome delta
  -> next best product decision
```

## Primary delivery SLO

For a bounded feature slice, SVC targets owner direction through production release and live
verification in at most **60 active engineering minutes**. The forecast is compiled before dispatch.
The slice must be the smallest complete product outcome that retains every applicable quality,
reliability, authority, safety, migration, operability and rollback obligation. If no such slice fits,
the controller re-slices or stops with evidence; it never weakens proof to manufacture a green clock.

The active clock includes outcome selection, product-proof compilation, implementation, behavioral
validation, one holistic review, final-SHA binding, production release, live verification, rollback
readiness and scheduling the outcome observation. Provider queues and measurement windows are
visible separate elapsed clocks, never hidden. A timeout is `NOT_COMPLETE`.

Before dispatch, the forecast inventories fourteen production surfaces exactly once: outcome/scope,
product code, data/migration, auth/privacy, external integrations, platform/device, validation,
holistic review, final SHA/landing, release/config, live verification, rollback, operability and
outcome observation. Each surface is `REQUIRED`, evidence-backed `NOT_APPLICABLE`, or unresolved.
An unresolved surface blocks dispatch. The forecast maps every required surface to task capsules and
rejects both unmapped runtime work and task claims for absent work. This discovers product-specific
requirements before implementation instead of treating them as late "extras."
Repository paths, resource claims and typed effects independently force matching data/migration,
auth/privacy, external-integration, platform/device and release/config obligations, so a caller
cannot mark a visibly activated surface `NOT_APPLICABLE`.

Admission also resolves every declared effect kind against the executable adapter registry. A
capability is not production-ready merely because its authority shape is valid: if the runtime has
no fixed adapter for that kind (currently the generic `device` surface is the important example),
the forecast fails and names the product-specific adapter and proof still required. This keeps
mobile/device work inside the estimate instead of silently postponing it until the live canary.

The acceleration contract is at least **24x** relative to the evidence-backed baseline, with an
absolute ceiling of 60 active minutes. Thus a feature normally taking 24 hours has a 60-minute
target; a shorter baseline may produce a stricter target. The forecast includes a named risk
reserve and reports core-build wall time separately from the incremental production-completion path.
External waits remain visible and may be explicitly unknown, but never consume or disappear into the
active clock.

A declared estimate is not production proof. Forecasts identify their mode (`SHADOW`, explicitly
authorized canary, or default), basis, sample count and confidence. Default-production admission
requires high-confidence measured p95 evidence from at least three comparable runs. Shadow and
first-canary forecasts remain labeled targets until the direction-to-live receipts prove them.

Delivery closure and outcome closure are distinct:

- delivery closes when the production feature is live-verified, rollback-ready and its observation
  job is digest-bound to an owner/runtime/metric consumer;
- the improvement cycle closes only after that window matures, the product delta is observed and the
  next decision consumes it.

This prevents a seven-day retention metric from being falsely claimed in minute 59 while still
preventing release receipts from becoming unconsumed paperwork.

## Deterministic decision techniques

Decision nodes apply techniques in a fixed, inspectable order:

1. reject options that violate hard quality, reliability, authority or safety constraints;
2. weight evidence by trust, freshness, relevance and environment fidelity;
3. compare expected product value and outcome probability;
4. buy more evidence only when its value of information exceeds time and cost;
5. use minimax regret when estimates overlap but delay itself is costly;
6. prefer reversible choices when value is otherwise equivalent;
7. require the complete slice and its proof graph to fit the active critical-path budget.

The framework does not ask implementation questions. It asks the owner only for a consequential
undelegated choice or a genuine evidence tie, using the configured language and explanation level.

## Direction is sufficient input

The owner is not required to know the implementation, architecture, complete feature shape or even
the best final outcome. A valid starting direction contains:

- the desired direction or problem;
- known constraints and forbidden outcomes;
- owner authority or an explicit delegation scope;
- an interaction mode and preferred language.

SVC consumes existing product knowledge and, when relevant, market research, competitor evidence,
domain evidence, user journeys, strategic-decision tools and technical capability. It converts that
evidence into ranked outcome hypotheses rather than asking the owner to design the implementation.

## Owner interaction modes

### `AUTONOMOUS`

The owner delegates all product decisions inside a signed scope. SVC makes evidence-backed,
constraint-compatible decisions, including strategic choices covered by that delegation, and
returns the outcome plus the decision/evidence trail. Root-only external authority, legal/safety
limits and explicit forbidden effects remain non-delegable unless their own authority contract says
otherwise.

### `STRATEGIC_QUESTIONS`

SVC resolves implementation and reversible bounded decisions internally. It asks only when a
consequential decision needs owner authority, evidence cannot safely distinguish the options, or
owner constraints conflict. Every question uses the owner's configured language and explanation
level and contains exactly the useful decision package:

1. what information or decision is missing;
2. what it means in plain language;
3. the real options;
4. consequences and trade-offs;
5. SVC's recommendation and why.

Questions are grouped by decision dependency and asked at the latest safe moment. Rephrasing the
same unresolved question without new evidence is a forbidden loop.

## Applicable-layer completeness

Every existing layer keeps its unique benefit. The applicability compiler decides whether that
benefit is relevant to the current outcome. An applicable layer has typed inputs, typed outputs,
authority and proof. A non-applicable layer records the deterministic reason and produces nothing.

Running every layer for every task is not completeness; it is waste. Completeness means every
relevant concern, product obligation and quality boundary has exactly one owning mechanism and no
unique protection disappears.

## No orphan production

Every produced artifact declares:

- producer;
- named consumers;
- target product outcomes;
- source/relevant digest;
- required consumption condition;
- retention class.

The compiler rejects:

- a producer output with no consumer;
- a consumer that does not declare the matching input;
- an output consumed only by framework learning;
- research that does not reach an option, decision, rejection reason or product evidence;
- a task interface that no downstream task, owner, customer, operation, release or metric uses;
- evidence that is emitted but never resolved by acceptance, review, release or outcome observation.

Task acceptance may precede downstream execution when a consumer is scheduled and digest-bound, but
run closeout requires every required consumption acknowledgement. Failure evidence is consumed by
retry/stop classification, the operator and the regression corpus; it is not receipt waste.

## Outcome selection

Quality, reliability, authority and safety are hard constraints, never scoreable trade-offs. Among
the options that satisfy them, deterministic ranking uses this order:

```text
expected product value
-> evidence strength
-> risk reduction
-> reversibility
-> critical-path effect
-> cost
```

The selected option retains its evidence, rejected alternatives and rejection reasons so a future
observation can reopen the decision without repeating discovery.

## Progress and anti-loop invariant

An iteration is permitted only when it consumes the current state and proves at least one of:

- new relevant evidence;
- a relevant product/code/environment state change;
- a resolved obligation;
- an authorized strategic decision;
- measured uncertainty reduction.

The same input-state digest plus the same causal failure fingerprint is rejected. Framework notes,
more prose, another reviewer opinion or a new receipt for unchanged work do not count as progress.
No progress produces a terminal evidence package and the next permitted decision; it never silently
restarts the expanding prefix.

## Product completion and continuation

A production delivery is complete only when:

- all blocking product obligations are satisfied;
- all required outputs have acknowledged consumers;
- behavioral validation and holistic review pass;
- release and live verification reach the required trust level;
- rollback proof exists and the final SHA is bound throughout the receipt chain;
- the target outcome observation is scheduled with a named metric and next-decision consumer.

The improvement cycle is complete only when the target outcome metric is observed rather than
merely predicted and the next decision is recorded: continue, keep, expand, revise, rollback or stop.

The observation is consumed by product prioritization first. Only then may the same evidence feed
the downstream framework-learning corpus. A framework improvement with no demonstrated product
delivery or outcome consumer is outside this protocol.

## Executable contract

`schemas/product-improvement-protocol-v2.schema.json` defines the serialized contract.
`scripts/svc-product-improvement-protocol-v2.mjs` compiles producer/consumer closure and validates
progress transitions. The runtime must bind the resulting protocol digest into the product graph,
task capsules, event journal, evidence objects and final release receipt before default cutover.
