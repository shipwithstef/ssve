# WI-FW-HOOKS-SAFETY-01 — Exec Cross-Model Review (frozen diff)

**Status:** CONVERGED — 3 adversarial rounds (WI-491 hard cap), bounded exit, zero Critical findings
**Frozen diff base:** 494f074 (origin/main merge-base)
**Review kind:** `exec` (plan-kind phase-refused by design; compensating review per launcher phase doctrine)
**Reviewer station:** `codex-sol-high` — codex / openai / gpt-5.6-sol / effort high (owner policy `governed-triple`, config sha a10e59a4…, authority: repository-owner)

## Rounds

| Round | Candidate digest | Receipt | Verdict | Findings |
|---|---|---|---|---|
| 1 | eaff01dcde8231f27689d91b20516cf52cfc0d2378bb71728e51526695f1e429 | `.svc/external-review-artifacts/cross-model/receipt.json` | fail (rubric 3) | 9 (7H/2M): EXTREV-EXEC-001…009 |
| 2 | 7a3c30f9431a50fc1cd37af98c9cf200d6cb16bcba1e52d1241dd2ae266b08da | `.svc/external-review-artifacts/cross-model-r2/receipt.json` | fail (rubric 3) | 7 (5H/2M): EXTREV-EXEC-009…015 |
| 3 | 7ed772452103aa1e671944657d1d01796d1c90b7f7e8edf0202c6cd28d8f5787 | `.svc/external-review-artifacts/cross-model-r3/receipt.json` | fail (rubric 3) | 8 (6H/2M): EXTREV-R3-001…008 |

All three receipts bind `candidate_digest = sha256("git-tree:<tree>\n")` of the
reviewed frozen tree; artifacts retained under `.svc/external-review-artifacts/`.

## Remediation commits

- `227cf17` — round-1 findings 001–008 (digest proof required, claim-by-rename
  consumption, ancestry no-follow, turn+repo tuple gate, expiry-refusing
  renewal, children-before-renewal ordering, host identity wiring, suffix
  preservation, single classification entry).
- `a36a3a2` — hermetic eval harness (ambient break-glass leak), structured
  lane receipts.
- `e3d3b42` — round-2 findings 009–015 (post-tool renewal threshold, hard
  controller proof at allow time, WI-sentence negation-safe intent, graph WI
  equality, callSucceeded hardening, genuinely concurrent race fixture).
- `34ee21f` — round-3 fixes (child fail-closed on unparseable output,
  SVC_DISABLED_HOOKS honored by engine children, fan-out no-follow,
  namespaced-WI intent scope, digest_scope field, wirer prune revert).

## Bounded-exit dispositions (round 3 residuals)

| Finding | Severity | Disposition |
|---|---|---|
| EXTREV-R3-002 prune removes retained TaskUpdate/Agent gates | HIGH | **FIXED** (`34ee21f`) — wirer prune reverted; dedup-v2 preservation contract restored; variant-dedup suite green. |
| EXTREV-R3-003 namespaced WI not anchoring intent scope | HIGH | **FIXED** (`34ee21f`) — canonical `WI_ID_BODY` anchors sentence scope; negated-namespaced fixtures green. |
| EXTREV-R3-004 receipt fan-out dir no-follow | HIGH | **FIXED** (`34ee21f`) — fan-out dir lstat-validated no-follow/same-UID when present; write path re-validates after mkdir. |
| EXTREV-R3-005 unparseable child decision = allow-through | HIGH | **FIXED** (`34ee21f`) — non-empty unparseable child stdout now fails closed. |
| EXTREV-R3-008 SVC_DISABLED_HOOKS not honored by children | MEDIUM | **FIXED** (`34ee21f`) — engine child loop consults the disabled set per consolidated contract. |
| EXTREV-R3-007 receipt field named original_digest holds execution-input digest | MEDIUM | **ACCEPTED** — explicit `digest_scope: "execution_input"` field added (`34ee21f`); renaming the column would break r1/r2 receipt schema compatibility for no security delta. |
| EXTREV-R3-001 absent v2 controller state treated as compatible | HIGH | **ACCEPTED with justification (execution-time risk, owner-directed continuation).** Null read occurs only when no v2 lease was ever armed — exactly the documented fresh-adoption flow that runs on the v1 claim/binding written under lock by `adoptExistingWorktree` after the full fresh-intent/exact-tuple/no-conflict gate. Corruption is NOT silent: unreadable state throws and denies. Foreign-principal, stale-generation, expired, corrupt-state paths are fail-closed and fixture-covered. Demanding an always-present v2 lease would break the adoption path its own suite proves correct. |
| EXTREV-R3-006 evidence internally inconsistent | HIGH (process) | **PARTIALLY RESOLVED / ACCEPTED** — lane graph, review-log, and this document now reference all three round receipts mechanically. The residual inconsistency the reviewer saw is the plan-phase deferral itself: paid plan review was transport-blocked at execution time, recorded in the lane graph before execution, and compensated by this exec-kind review chain under the owner's explicit resume directive ("execute remaining manifest … human_checkpoint waived"). Authority for the deferral is repository-owner, not this reviewer chain. |

## Transport history (prior session)

The stations/tuples attempted on 2026-08-25 are preserved verbatim below.

| Station | Tuple | Result |
|---|---|---|
| fable (required, independent) | cursor / anthropic / claude-fable-5 / high | launcher classification=`capability` — no review transport for host cursor (`REVIEW_HOST_TRANSPORTS` = codex/agy/claude only) |
| sol-high | cursor / openai / gpt-5.6-sol / high | same transport gap |
| agy-gemini-3.7-high | agy / google / Gemini 3.7 Flash (High) | classification=`authentication` — Google OAuth expired at the time |
| claude direct | — | "Not logged in"; entitlements `claude_paid:false` |

Transport restored on 2026-08-26 (codex ChatGPT login active; agy probe OK);
the governed-triple primary station drove all three rounds above.
