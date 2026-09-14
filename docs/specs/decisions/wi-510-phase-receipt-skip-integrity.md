# Design Decisions: WI-510 Phase-Receipt Skip Integrity

**Session mode:** auto (`design_auto`)

## D-1: Requirements scope

**Phase:** write-spec
**Context:** Fix the WI-498 false red without weakening no-silent-skip enforcement.

| Rank | Option | Why | Trade-offs |
|---|---|---|---|
| 1 | Distinguish executed, authorized-skip, supported-history, and invalid states | Matches actual task semantics and enables fail-closed fixtures | Requires a precise shared predicate |
| 2 | Accept any loaded receipt | Small change | Misses malformed or empty phase evidence |
| 3 | Accept any `phases_executed` array | Directly fixes WI-498 | Fabricated arrays become a bypass |
| 4 | Patch WI-498 with summary fields | Avoids validator work | Rewrites history and leaves the semantic bug |
| 5 | Retain the allowlist forever | No implementation | Permanent false-red debt and no invariant repair |

**Chosen:** Option 1. It is the only option that simultaneously passes unchanged WI-498 execution and rejects unauthorized skips.

## D-2: Evidence-reference contract

**Phase:** write-spec
**Context:** Command-output artifacts are intentionally ephemeral in many promoted graphs, so permanent byte existence cannot be retroactively required by this WI.

| Rank | Option | Why | Trade-offs |
|---|---|---|---|
| 1 | Validate canonical type and a contained repository-relative reference, or a normalized OS-temp reference for current `file`/`command_output` producers; preserve separate durable receipt/attestation gates | Enforces non-empty/non-escaping references without invalidating canonical review receipts | Does not prove retained artifact bytes |
| 2 | Require every referenced file on disk forever | Strong content presence | Breaks many promoted graphs whose ignored logs are intentionally absent |
| 3 | Require every path in Git | Durable | Command-output logs are intentionally not tracked |
| 4 | Ignore artifact paths entirely | Minimal | Empty and escaping references pass |
| 5 | Rewrite every graph to durable hashes | Strongest future model | Out of scope and violates history protection |

**Chosen:** Option 1. Content authenticity remains owned by final receipts/attestations; skip integrity validates safe evidence references and state authorization.

## D-3: Story granularity

| Rank | Option | Why | Trade-offs |
|---|---|---|---|
| 1 | Four stories: executed, skipped, historical, coherence | Each failure class maps directly to mutation-red fixtures | Slightly longer spec |
| 2 | One aggregate validator story | Compact | Hides state distinctions |
| 3 | Story per validator file | Mirrors implementation | Couples requirements to file layout |
| 4 | Story per WI-498 task | Precise replay | Overfits one historical graph |
| 5 | No stories; retain WI checklist only | No duplicate artifact | Weak plan/review traceability |

**Chosen:** Option 1. The authorized-skip branch also requires the same strict
current phase receipt; authorization without receipt evidence fails closed.

## D-4: Acceptance strategy

| Rank | Option | Why | Trade-offs |
|---|---|---|---|
| 1 | Positive state matrix plus mutation-red inversions and original replay | Proves both false-positive removal and fail-closed boundaries | More fixtures |
| 2 | Only replay WI-498 | Proves symptom | Does not prove security boundary |
| 3 | Only unit fixtures | Hermetic | Misses real graph compatibility |
| 4 | Snapshot expected output | Easy | Brittle and shallow |
| 5 | Manual inspection | Fast | Not repeatable |

**Chosen:** Option 1.

## D-5: Scope mode

| Rank | Option | Why | Trade-offs |
|---|---|---|---|
| 1 | Hold | WI-510 is narrow and implementation-ready | Defers broader evidence-retention modernization |
| 2 | Selective expand into durable artifact hashes | Stronger evidence | Reopens receipt schema and migration |
| 3 | Expand into all task-graph validators | Maximum coherence | Excessive blast radius |
| 4 | Reduce to one conditional | Fast | Preserves duplicated semantics |
| 5 | Scrap validator enforcement | Eliminates false red | Violates framework doctrine |

**Chosen:** Hold.

## D-6: Classifier boundary

**Phase:** design-tech
**Context:** The two current shell predicates disagree, but whole-graph
validators also report independent conditions that must not leak into a
task-local completion verdict.

| Rank | Option | Why | Trade-offs |
|---|---|---|---|
| 1 | Pure task-local Node library plus CLI | One reusable verdict, hermetic fixtures, structured diagnostics | Adds a small internal API |
| 2 | Import the whole delivery-graph validator | Reuses existing policy | Unrelated graph failures contaminate the scoped verdict |
| 3 | Shell function shared by source | Minimal language change | Hard to test structured JSON and reason codes |
| 4 | Independent Python snippets | Small diffs | Retains semantic drift |
| 5 | Replace all validators with one framework | Maximum consolidation | Excessive blast radius |

**Chosen:** Option 1.

## D-7: Phase-declaration interpretation

**Phase:** design-tech
**Context:** A current execution receipt must prove all required phases without
accepting any arbitrary array.

| Rank | Option | Why | Trade-offs |
|---|---|---|---|
| 1 | Narrow canonical `phases:` frontmatter parser that fails ambiguous input | No dependency; verifies declared required phases | Must be fixture-tested against canonical layouts |
| 2 | Trust receipt rows without declarations | Smallest implementation | Fabricated or incomplete arrays pass |
| 3 | Spawn the existing shell validator | Reuses current file | Shape-only advisories do not meet WI-510 fail-closed semantics |
| 4 | Add a YAML dependency | General parser | No root package/dependency model; needless portability cost |
| 5 | Hardcode skill phase IDs | Simple lookup | Immediate drift and proprietary source coupling |

**Chosen:** Option 1.

## D-8: Skip/execution precedence

**Phase:** design-tech
**Context:** A genuinely skipped task may still carry a receipt, so evaluation
order controls whether receipt evidence can become a bypass.

| Rank | Option | Why | Trade-offs |
|---|---|---|---|
| 1 | Any skip intent selects authorization checks before receipt checks | Prevents receipt laundering of skipped work | Mixed malformed state fails instead of guessing |
| 2 | Receipt first | Makes executed path easy | Can misclassify a skipped task as executed |
| 3 | Delivery entry only determines intent | Structured | Prose-only skip becomes ambiguous |
| 4 | `skip_reason` only determines intent | Backward familiar | Ignores current delivery authority |
| 5 | Allow both states simultaneously | Flexible | Non-deterministic governance |

**Chosen:** Option 1.
