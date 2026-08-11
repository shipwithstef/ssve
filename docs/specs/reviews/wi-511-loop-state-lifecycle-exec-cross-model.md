# WI-511 Execution Cross-Model Review

## Scope

Claude Opus 4.8/high independently reviewed the literal staged WI-511 diff
against the governing work item, reviewed plan, and Codex self-review. The
review focused on deletion safety, state-name alignment, symlink and race
handling, zero-wait locking, failure isolation, test falsifiability, latency,
and scope containment.

## Round 1

Verdict: `pass-with-findings` (rubric 8).

- `EXEC-001` Medium — accepted and fixed. A hard five-millisecond wall-clock
  assertion was load-sensitive. Tier-1 now proves the deterministic property:
  109 non-candidate entries cause zero metadata or lock operations. Timing is
  retained as advisory output.
- `EXEC-002` Low — accepted and fixed. The new shell validator now has mode
  `100755`.
- `EXEC-003` Low — rejected with evidence. Mechanical enumeration reports 274
  Tier-1 `.sh`/`.mjs` validators, matching `FRAMEWORK-STATE.md`.
- `EXEC-004` Info — rejected with source evidence. `stateFileFor` maps an empty
  sanitized session identifier to the unsuffixed legacy filename, which the
  lifecycle regex accepts; it cannot produce `loop-guard-state-.json`.
- `EXEC-005` Info — accepted as a documented bound. The benchmark characterizes
  the steady-state no-candidate scan; stale-candidate deletion is cadence-bound,
  behaviorally covered, and not represented as part of the advisory median.

## Round 2

Verdict: `pass` (rubric 9), with zero findings.

The reviewer verified the accepted fixes against the complete updated staged
diff and found no remaining Critical, High, Medium, Low, or informational
defect.

## Round 3

Verdict: `pass` (rubric 9), with two informational observations.

- `INFO-R3-001` — accepted with justification. A continuously active session
  refreshes its current state file, so later batches require a new session or
  an inactivity window. This is the documented best-effort cadence boundary,
  not a safety or enforcement defect.
- `INFO-R3-002` — accepted with justification. A crashed writer's lock sidecar
  can defer cleanup for that candidate. Stale-lock reclamation belongs to the
  shared `state-io` lifecycle; preserving the candidate remains fail-safe.

No Critical, High, Medium, or Low finding remains at the hard cap.

## Evidence

- Round 1 findings:
  `.svc/external-review-artifacts/wi511-exec-round1/findings.json`
- Round 1 launcher receipt:
  `.svc/external-review-artifacts/wi511-exec-round1/receipt.json`
- Round 2 findings:
  `.svc/external-review-artifacts/wi511-exec-round2/findings.json`
- Round 2 launcher receipt:
  `.svc/external-review-artifacts/wi511-exec-round2/receipt.json`
- Round 3 findings:
  `.svc/external-review-artifacts/wi511-exec-round3/findings.json`
- Round 3 launcher receipt:
  `.svc/external-review-artifacts/wi511-exec-round3/receipt.json`
- Pair record: `.svc/review-exec-pair.json`

## Verdict

PASS. Three adversarial rounds ran, no unresolved Critical or High finding
remains, and every residual observation is explicitly dispositioned.

## G7 Promotion-Closeout Review

A fresh Anthropic Opus 4.8/high review examined the promotion-discovered
watcher-fixture correction and governance closeout:

- Receipt:
  `.svc/external-review-artifacts/wi511-g7-closeout/receipt.json`
- Findings:
  `.svc/external-review-artifacts/wi511-g7-closeout/findings.json`
- Verdict: `pass-with-findings`; zero Critical or High findings.
- F1 Medium: resolved with source inspection. The dedicated range-worker
  validator creates a synthetic repository with exactly 16 commits and checks
  bounded, ordered range execution, timeout, spawn, cardinality, and policy
  failures; it does not depend on a growing framework-history anchor.
- F2/F3 Low: resolved by anchoring the GitHub-hang fixture at current `HEAD`
  instead of `origin/main`. This removes the new remote-ref lookup and leaves
  the reconcile range empty for the fixture checkout, so branch length cannot
  consume the shared 100 ms child budget.
- F4 Info: accepted; bookkeeping was internally consistent and task 14 remains
  active until the receipt-closed 274/274 replay completes.
