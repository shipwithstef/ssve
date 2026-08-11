# Solution Confidence: WI-510 Phase-Receipt Skip Integrity

## 1. User Ask And Confidence Bar

The user asks the framework to remove the promoted WI-498 false red without weakening no-silent-skip enforcement. The design is good enough to plan only when it:

- explains why WI-498 passes unchanged;
- rejects missing, malformed, prose-only, and unauthorized current state;
- uses canonical compatibility rules rather than a WI-specific exception;
- has one coherent interpretation across overlapping validators;
- identifies exact proof gates and rollback.

Out of scope: rewriting WI-498, permanent artifact retention, a receipt schema migration, provider/API changes, customer database changes, or an allowlist waiver.

## 2. Current Picture

- **Product goal:** deterministic framework governance with proof over prose.
- **Personas:** N/A; system-only framework enabler.
- **Affected surfaces:** Tier-1 shell validators, a new dependency-free Node classification boundary, focused fixtures, Phase-D documentation, main-green allowlist, framework state/capabilities.
- **Current flow:** `validate-skip-conditions-registry.sh` checks completed registry skills for `skip_reason` or loaded receipt plus `output_artifact` / `validation_output`.
- **Observed failure:** WI-498 tasks 5 and 6 carry matching loaded receipts and complete `phases_executed[].evidence_artifacts`, but the validator reports them as missing skip/evidence.
- **Related behavior:** `validate-lane-tasks-integrity.sh` already accepts loaded receipts as execution; `validate-skill-receipt-shape.sh` owns Phase-D shape/required phases; `validate-delivery-graph.mjs` owns registered current skips.
- **Runtime measurement:** focused validator completes locally in seconds; no cold/warm product path, browser, native wrapper, or network exists.

## 3. Why The Current Design May Exist

Chesterton's Fence:

- The original skip registry predates Phase-D receipts and needed a cheap mechanical proxy.
- `output_artifact` / `validation_output` were available summary fields before per-phase evidence became canonical.
- The lane-tasks validator intentionally stayed broader to catch only ghost completion.
- Delivery graphs arrived additively, so older validators were not automatically rewritten.
- Historical compatibility is deliberate because retroactively rewriting graph evidence would corrupt audit meaning.

The old predicate was reasonable when created. It is now stale because the receipt schema evolved.

## 4. Constraint Profile

| Constraint | Effect |
|---|---|
| Append-only audit history | WI-498 bytes and notes cannot be rewritten |
| Fail-closed governance | Unknown current state returns invalid |
| Full mandatory chain | Plan, independent review, exec review, audit, Tier-1, land, promoted replay |
| No external dependency | Use Node standard library and shell only |
| Existing ephemeral phase logs | Validate safe references; do not invent permanent byte retention |
| Reversibility | Whole change must be revertible with no data migration |
| Scope | Fix task completion/skip classification, not all evidence authenticity |

## 5. Freshness And Cache Classes

| Class | Freshness | Cache/retention | Invalidation owner |
|---|---|---|---|
| Task graph JSON | Current working-tree state | Git-tracked | task-graph mutations |
| Skip registry | Current repository version | Git-tracked | framework maintainers |
| Skill phase declarations | Current repository version | Git-tracked | skill maintainers |
| Phase command-output files | Execution-local and potentially ephemeral | usually ignored | producing skill/session |
| Git commit/tree | Immutable by SHA | Git object store | none |
| Chain receipts/Git notes | Durable append-only evidence | Git notes | receipt workflow |
| Classifier result | Recomputed every run | no cache | validator invocation |

No new cache is proposed.

## 6. Cost Model

| Dimension | Current | Selected design | Impact |
|---|---|---|---|
| CPU | embedded Python per graph | one bounded Node classification per graph/task set | same order, local only |
| Disk reads | graph + registry | graph + registry + selected skill declarations as needed | bounded |
| Network/provider | none | none | unchanged |
| Persisted state | none | none | unchanged |
| Mobile/browser memory | N/A | N/A | N/A |
| Recurring cost | $0 | $0 | unchanged |

## 7. World Grounding

For this internal contract, repository primary authorities are the successful production precedents:

| Example | Source | Lesson |
|---|---|---|
| Explicit skip versus execution | `route-workflow/references/task-graph-protocol.md` | A skip has `skip_reason`; execution has a loaded skill receipt |
| Phase-D current/historical split | `references/phase-receipts.md` | Enforce current required phases while retaining documented history |
| Registry-backed delivery skips | `scripts/validate-delivery-graph.mjs` | Current skips require registered IDs, reason, and evidence |
| Phase shape enforcement | `validate-skill-receipt-shape.sh` | Allowed types/paths and required phase IDs are independent of skip policy |
| Shared compatibility classifier | `hooks/lib/task-state-compatibility.mjs` | One pure classifier can support current, lossless legacy, and quarantine outcomes |
| Ghost-completion guard | `validate-lane-tasks-integrity.sh` | A matching loaded receipt is execution evidence, not skip prose |
| Durable historical attestation | Git note on `85b5b965…` | Promoted history can be independently reviewed without retroactive phase claims or waivers |

## 8. Options Considered

1. Accept any `phases_executed`.
2. Patch each validator independently.
3. Shared pure classifier with thin consumers.
4. Compose whole-graph validators.
5. Broadly refactor existing validators into libraries.
6. Rewrite WI-498 history.
7. Retain the allowlist.

Full analysis: `docs/specs/explorations/wi-510-phase-receipt-skip-integrity/`.

## 9. Tradeoff Matrix

| Option | Quality | Cost | Latency | Memory | Size | Reversibility | Operational risk | Operator perception |
|---|---|---|---|---|---|---|---|---|
| Any phase array | Low | $0 | low | N/A | XS | high | fail-open | green but untrustworthy |
| Independent patches | Medium | $0 | low | N/A | M | medium | semantic drift | inconsistent diagnostics |
| Shared classifier | High | $0 | low | N/A | M | high | bounded | one explainable verdict |
| Whole-validator composition | Medium | $0 | medium | N/A | M | medium | unrelated failures leak | confusing attribution |
| Broad refactor | High | $0 | low | N/A | XL | medium | large blast radius | coherent but costly |
| History/allowlist | Low | $0 | low | N/A | XS | low governance reversibility | audit corruption/debt | false confidence |

## 10. Action-by-Action Approval Packet

| Proposed action | Why this action exists | How it would be achieved | Positive outcome | Negative / risk | Impact if skipped | Required proof before closeout |
|---|---|---|---|---|---|---|
| Add one pure completed-task classifier | Existing predicates disagree | Dependency-free Node module/CLI returns structured state and reasons | One semantic authority | New internal API could be mis-specified | Drift persists | Mutation-red unit/CLI fixtures |
| Recognize current executed receipts | WI-498 false red comes from missing legacy summary fields | Match skill/load receipt; validate non-empty phase rows, phase ID/timestamp shape, artifact type, and safe reference; leave required-phase completeness to the existing Phase-D validator | Valid execution passes without applying today's mutable phase declarations twice | Over-broad receipt acceptance could fail open | WI-498 stays red | unchanged WI-498 task replay plus malformed inversions |
| Enforce current authorized skips | Phase evidence must not authorize omitted work, and authorization must not replace execution evidence | Require a skill-bound registry-backed delivery skip with substantive canonical applicability metadata, non-empty delivery evidence, task `skip_reason`, and the same strict matching phase receipt | No silent, unregistered, empty-registry, or unevidenced completed skip | Registry/graph/receipt lookup bugs can false-deny | prose, registered-only, or authorization-only bypass remains | authorized positive plus missing-auth/missing-receipt/unregistered/inapplicable/prose-only reds |
| Delegate historical compatibility | Avoid a new WI-specific grandfather rule | Bind the existing cutoff to fixed pre-enforcement anchor `060e3278afb26117034c4ed529a0e03da3869c32`; require the graph-introduction commit to be its ancestor and exact completed task ID/skill/receipt identity in the anchor snapshot; reject path-age inheritance, editable or Git-timestamp backdating, untracked, malformed, or unsupported legacy shapes | History stays immutable without a forgeable timestamp bypass | Git-history resolution can false-deny shallow/incomplete clones and must fail closed | rewrite/allowlist pressure returns | anchored repository clone plus post-anchor insertion, identity/receipt mutation, exact-cutoff and backdated negative fixtures |
| Wire overlapping Tier-1 consumers | Two predicates caused the drift | Thin shell consumers invoke the same classifier | Coherent diagnostics | Shell/Node invocation regression | future divergence | focused scripts and aggregate harness |
| Remove WI-498 allowlist row | A fixed false red must not remain hidden | Preserve it through implementation promotion; delete in governance closeout only after promoted focused/full replay, then rerun full Tier-1 | Aggregate green becomes real on promoted main | Premature removal is structurally prevented | debt remains normalized | promoted replay, removal, and full Tier-1 without the row |
| Update doctrine/state/capability records | Future changes need the locked distinction | Amend Phase-D docs, FRAMEWORK-STATE, CAPABILITIES, completed proposal | Prevents rediscovery | Documentation drift | semantics regress later | review/audit path checks |
| Replay promoted main | Local branch proof is insufficient | Merge through governed path, then rerun original validator/reconcile on main | Promoted proof | merge-only differences may surface | only locally verified | final-SHA receipts, main replay, reconcile zero |

## 11. Outcome Coverage

| Category | Best credible outcome | Worst credible outcome | Mitigation |
|---|---|---|---|
| Product UX | N/A | N/A | no user surface |
| Web/mobile/native | N/A | N/A | no runtime surface |
| Data correctness | Valid execution and skips classified distinctly | malformed receipt accepted | mutation-red fail-closed matrix |
| Cost/credits | remains $0 | extra bounded local reads | no network/cache; measure focused runtime |
| Provider/API | N/A | N/A | none |
| Cache/freshness | recomputed from current files | stale cached verdict | no cache |
| Scalability | linear in active graph tasks | repeated parsing across many graphs | bounded graphs; profile if aggregate regresses |
| Complexity | one reusable classifier | helper becomes a second schema authority | delegate canonical cutoffs/registry and test parity |
| Reversibility | one revert | partial consumer rollback diverges | land as one reviewed changeset |
| Support/ops | precise task-local errors | noisier diagnostics | stable structured reasons and focused tests |

## 12. Decision Or Remaining Unknowns

**Decision:** Select the shared pure classifier with thin consumers.

**Confidence:** High.

**Design detail resolved:** the pure boundary is
`scripts/lib/completed-task-integrity.mjs`, exposed by
`scripts/validate-completed-task-integrity.mjs`. It validates the strict
task-local receipt shape and evidence references. The broader Phase-D
required-phase/current-declaration checks and delivery-graph validators retain
their independent whole-file contracts; duplicating those checks was rejected
after the unchanged WI-498 replay demonstrated that today's skill declaration
cannot be retroactively imposed by this skip-integrity classifier.
Skip intent is evaluated first. The authorized-skip branch requires both the
delivery authorization and the same strict matching current receipt, while only
the documented pre-enforcement base receipt remains legacy-compatible.

The implementation contract is baselined at
`docs/specs/tech/wi-510-phase-receipt-skip-integrity.md`. No unresolved
architecture choice remains before planning.

## 13. Base44/AI Suggestions Triage

| Suggestion | Classification | Reason |
|---|---|---|
| Accept any phase receipt | reject | fails closed-path mutations |
| Shared resolver | adopt | matches all local primary authorities |
| Patch validators independently | reject | preserves semantic drift |
| Rewrite WI-498 | reject | violates protected audit history |
| Add/expand allowlist | reject | hides rather than repairs the defect |
| Add durable artifact hashes to every phase | defer | useful evidence-authenticity follow-up, outside WI-510 |
| Customer database/Supabase changes | unrelated | framework-local validator only |

## 14. User-Facing Summary

- WI-498 is red because executed tasks are being mistaken for skipped tasks.
- The fix will distinguish executed work, authorized skips, supported history, and invalid state.
- A shared classifier is safer than accepting any receipt or patching two validators separately.
- Historical WI-498 files remain unchanged and no waiver is added.
- The change adds no database, provider, cache, or recurring cost.
- Closeout requires mutation-red fixtures, full Tier-1, final-SHA receipts, and promoted-main replay.
