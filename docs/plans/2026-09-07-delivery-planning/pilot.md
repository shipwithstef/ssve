# Paper falsification before contract implementation

Status: completed retrospective reasoning exercise, not a blind review, execution benchmark, native proof or 5x result. Inputs: the existing 14 iOS plan findings reproduced in the planning-purpose analysis and the accepted R2/R3 native-discovery contracts. The author and proposal reviewers already know the historical findings.

## Proposed iOS URL-state part

Whole solution: URL is authoritative; shared controller owns filter intent; manual off survives Back/Clear; automatic Scouted applies once only after a successful current-scope zero-owned response. Shared API/HTTP contracts and actual map-engine lifecycle remain fixed for their respective parts. URL part owns controller, its callers, relevant translations and its own tests; shared files are edited serially. Source tests do not depend on live deployment or future scouting fixtures. Release uses the established native path and keeps required physical-device observations visible.

Local details: helper names and implementation decomposition inside the assigned files. Changing state owner, default/manual semantics, accessibility behavior, URL method, generation lifetime or evidence kind is a consequential change.

## Historical counterexamples

| Bucket | Historical IDs (round-qualified) | What the proposed representation actually prevents | What still requires engineering observation |
|---|---|---|---|
| Plan-created dependencies/ownership | R1 F-001, F-002, F-003, F-004; R2 F-001, F-003; R3 F-001, F-002 | One task/validation source, behavior-owned tests, exact write bounds and explicit prerequisites remove duplicate mapping and impossible source/deploy or T2/T5 dependencies | Acyclic graph alone cannot prove the behavior is good |
| Commands and future identities | R2 F-005; R3 F-003 | Existing release producer/verifier path avoids invented IDs and repeated full command transcription | Correct provider target, authority and runtime output still require validation; R3 F-003 includes substantive release safety |
| Observation substitution | R2 F-002, F-004 | Explicit offline/browser/device/hosted observation kinds make the substitution visible | A real test/probe must exercise the required environment |
| Product/API design missed | R1 F-005; R2 F-006 | Whole-solution state-owner and HTTP contract requirements focus attention on these omissions | Code/route tracing or a decisive probe is still required; shorter format alone does not solve them |

All 14 IDs are accounted for once. This exercise supports removing representation-created contradictions, not claiming automatic detection of the remaining defects or any measured speedup.

## Small implementation pilot

Use the same frozen pre-fix URL-state input and the same explicit acceptance/evidence bar in two isolated local fixtures: current inline contract and proposed inline contract. The exercise must preserve URL/manual-choice/lifecycle obligations and all relevant tests; do not contact providers or touch the running iOS worktree. Record context, model/effort, source and framework digests, supplied facts, commands, outcomes and elapsed intervals in normal logs. The historical findings are excluded from any fresh reviewer prompt; prior author knowledge means the replay remains a retrospective calibration, not blind generalization.

Do not expand into a benchmark suite. Compare exact-input acceptance through mechanical checker, receipt emitter/chain consumers and executor context. A lost requirement, a browser/native substitution, a newly circular dependency, broader write authority, hidden dependency or required per-part re-review rejects the variant. A controlled subsequent real feature supplies the total-cycle timing result; without it the framework may claim compatibility and corrected behavior only, not 5x. Default Astra is a qualitative counterfactual, not a timed third arm in this task.

## Executed deterministic paired replay

`node --test test-framework/tests/delivery-plan-contract.test.mjs` passed the contract tests, including the paired original-requirement replay and actual schema/emitter/checker/mechanical entry points. Both fixture arms consume identical manual-choice and same-transaction AC bytes; v4 returns the original text instead of trusting short digest prose. Changed AC text, same-line context drift, malformed/cyclic mapping and partial consumer adoption fail. This is a deterministic preservation/compatibility experiment, not a model benchmark, native-device test or 5x speed measurement. Actual output is in .svc/delivery-focused-round2.log and the source fixture fixes inputs/assertions.
