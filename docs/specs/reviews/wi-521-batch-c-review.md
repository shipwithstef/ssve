# WI-521 Batch C — adversarial review record

**Reviewer:** Opus, TWO invocations (the protocol ceiling, triggered by CRITICAL findings), 3 internal passes on round 1. Executor family anthropic, reviewer family anthropic — cross-family fence WARNs; recorded as §4g drain-queue debt.

**Round 1: BLOCK — 3 CRITICAL, 2 HIGH, 4 MEDIUM/LOW. Final: all CLOSED.**

Batch C was the highest-risk batch because it is entirely *wiring* — and making a thing load-bearing is the operation that converts dormant permissiveness into live failure.

## CRITICAL findings

**C-1 — the fence existed in the producer and was absent from the consumer.** `task-graph.mjs generate --activation` applied no essential fence: any activation entry with `result:"na"` marked its stage `completed` + `skip_reason`, *including essential stages*, and seeded the receipts file `na` — which then reached STORY ALIGNED. The fence was present in `stage-activation.mjs` (the producer) and absent from the file an agent hand-feeds (the consumer). **CLOSED** — fence added before any write; verified refused with exit 1 and **neither the graph nor the receipts file written**.

**C-2 — C1 traded a static fence for a data-driven one and lost the fence.** Dropping `stage-activation.mjs`'s private stage table for registry keys is how G4 dies, but the loader validated only that `stages` was a non-empty array. A registry with `"class":"Essential"` yielded an empty essential set, so the WI-519 essential fence **silently disappeared** and essential stages vanished from the output. Composited with `--conditions`, the real registry exited 2 while the bad-class registry exited **0** and emitted `{"stage":"plan", …, "result":"na"}`. The hardcoded table could not fail this way. **CLOSED** — class-enum validation plus a zero-essential fence; both verified exit 2.

**C-3 — the dogfood was a forced green.** `docs/specs/receipts/WI-521.receipts.json` marked `spec-sync` as `na` to reach STORY ALIGNED — but `spec-sync` is `class:"essential"` in the registry this WI created, and Batch C's own fence refuses to even *condition* an essential stage. The headline proof artifact had been made green by asserting a state the batch's own code declares impossible; the validator permitted it only because it accepts `na` on a required stage given any non-empty note. `review-exec` was also marked `done` while its own `grounded_on` admitted Batch C's review had not run. **CLOSED** — `spec-sync` is `done` with tracked evidence; `review-exec` was left honestly `pending` and pinned only after this review round landed. The reviewer diffed all nine stages against its round-1 snapshot and confirmed only two changed, one of them a downgrade, with nothing quietly upgraded.

## HIGH findings

**C-4 — AC-16 was inert.** `story_receipt_sha256` was assigned to a shell variable nothing read; `land-changeset` emits no receipt type at all, so there was no consumer-receipt body to fold it into. **CLOSED** — relocated to the `verify-promotion` receipt body that `svc-auto-drive.mjs` actually constructs and writes, derived from the merge commit's own tree rather than a commit-message guess, `null` on ambiguity or git error. Reviewer verdict: real, not relocated decoration.

**C-5 — the two new land gates had no Self-Verify row.** Body prose only, while the Self-Verify table mentioned neither — the same "invoked by nobody" class the batch exists to kill. **CLOSED** — rows 7 and 8 added naming both commands and their exit semantics.

## MEDIUM / LOW

- `generate` bypassed the session-contract assertion `init` enforces — a second ungated path to the same artifact. **CLOSED**, and `--lane` now required.
- `skip_reason` was semantically inverted, stating the condition that was *not* met as though it were the reason. **CLOSED** — the full `{stage, condition, evaluated_against, result}` record is serialized.
- `generate` overwrote an existing receipts file unconditionally. **CLOSED** — `--force` required.
- `DEFAULT_CONDITIONS` duplicated the registry's `activation_condition` keys with nothing binding them. **CLOSED** — asserted.

## Sibling sweep — the second invocation's real value

Asked to hunt for remaining instances of the same shape rather than stop at its own findings, the reviewer found two, both fixed:

- **The class-enum validation reached two of three registry consumers.** `task-graph.mjs generate` loads the registry itself and had no such check, so a bad-class registry silenced the C-1 fence entirely — exit 0, essential stages written `completed`/`na`. Producer/consumer asymmetry reproduced *by the fix for producer/consumer asymmetry*. **CLOSED.**
- **The session-contract gate was skipped by the invocation that still reached the repo.** A scratch graph path returned early from the assertion but still wrote `docs/specs/receipts/<WI>.receipts.json` into the repo. **CLOSED** — receipts now follow the graph path whenever it is outside `.svc/`.

## Verified by the orchestrator independently

Bad-class registry exit 2 (`stage-activation`) and non-zero (`generate`); zero-essential registry exit 2; real registry exit 0 with essentials active; forged `--activation` refused with no artifacts written; clean control succeeds; scratch path writes beside the scratch graph and leaves the repo untouched; `node --test` 18/18 throughout; STORY ALIGNED on the final receipts file.

## Residual, disclosed

`task-graph.mjs` uses `die()` = exit 1 uniformly, where the other two files use exit 2 for registry faults. The load-bearing property (non-zero) holds; the inconsistency is recorded rather than silently normalized.
