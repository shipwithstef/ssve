---
name: review-exec
version: "1.0"
handles_concerns:
  - exec-output-adversarial
  - chain-receipts-completeness
description: >
  Mandatory G5-enforcing gate. Self-review + adversarial review of the executed diff
  before land. Delegates to `review-cross-model` for the second-model
  invocation through `scripts/run-external-review.mjs`, with the requested
  owner-configured topology and tuple provenance exposed by
  `scripts/review-topology-v2.mjs`. Same-family Sol remains advisory; the
  configured different-family external station owns independent release authority. Emits SHA-keyed receipt at
  `.svc/receipts/<sha>/review-exec.json` and updates the consolidated git
  note on `refs/notes/svc-receipts`. Use after `execute-changeset`
  produces an exec-record receipt, before `land-changeset` opens the PR.
phases:
  - id: P1-SelfReview
    trigger: always
    reads: ["git diff main..HEAD", "exec-record receipt", "plan-manifest receipt", "feature spec ACs"]
    writes: [".svc/receipts/staging/<tree-hash>/review-exec-self.json"]
    evidence_kind: file
    required_for_completion: true
  - id: P2-ResolveAdversarialPair
    trigger: always
    reads: ["scripts/review-topology-v2.mjs output", "~/.svc/reviewer-policy-v2.json"]
    writes: [".svc/review-exec-pair.json"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P3-AdversarialReview
    trigger: always
    reads: ["pair.json", "diff", "plan", "ACs"]
    writes: ["docs/specs/reviews/<name>-exec-cross-model.md", ".svc/receipts/<sha>/review-exec.json"]
    evidence_kind: file
    required_for_completion: true
  - id: P4-IterationLoop
    trigger: when_findings
    reads: ["findings", "patched diff"]
    writes: [".svc/receipts/<sha>/review-exec.json"]
    evidence_kind: file
    required_for_completion: false
  - id: P5-VerdictAndReceiptFinalize
    trigger: always
    reads: ["iteration outcome"]
    writes: [".svc/receipts/<sha>/review-exec.json", "git notes refs/notes/svc-receipts"]
    evidence_kind: file
    required_for_completion: true
inputs:
  required:
    - { path: ".svc/receipts/<sha>/exec-record.json", artifact: exec-record }
    - { path: ".svc/receipts/<sha>/plan-manifest.json", artifact: plan-manifest }
    - { path: "docs/specs/features/<name>.md", artifact: feature-spec }
outputs:
  produces:
    - { path: ".svc/receipts/<sha>/review-exec.json", artifact: review-exec-receipt }
    - { path: "docs/specs/reviews/<name>-exec-cross-model.md", artifact: review-exec-markdown }
chain:
  lanes: {}
  progressive: false
  self_verify: true
  human_checkpoint: false
---

# review-exec — Mandatory Adversarial Review of Executed Diff

## Runtime v2 final-review station

For a product-outcome run, emit exactly one digest-bound `FINAL_REVIEW_PASSED` evidence object for
the frozen cumulative diff. It must be consumed by the final-SHA binder. Task `ACCEPTED`, a local
test pass, or a per-task opinion is not this station and cannot authorize release.

The repository owner selects the review topology in the external owner-only file
`~/.svc/reviewer-policy-v2.json` (or `SVC_REVIEWER_POLICY`). Model/subscription changes edit that
file, not framework source. Resolve the current host and phase with:

`node scripts/review-topology-v2.mjs plan --orchestrator <host> --phase exec [--mode <mode>]`

The topology must begin with inline self-review; subsequent subagent and external stations are
explicit. Same-family subagents are useful advisory lenses but do not silently become
different-family release authority. `fast-local` may pass its review panel while
`release_authorized=false`; production release requires a mode whose required independent
different-family station passed. Optional unavailable reviewers retain a classified capability
receipt. Aggregation emits one digest-bound `FINAL_REVIEW_PANEL`, so a panel does not create
multiple final-review events.

This skill makes the **review-of-execution** mandatory and pair-resolved.
It enforces the **G5** checkpoint (BASELINED → CHANGE-SET-APPROVED) via adversarial post-exec review:

`plan-changeset → review-plan → execute-changeset → review-exec → audit-implementation → land-changeset → verify-promotion`

**Announce at start:** "Running review-exec — mandatory adversarial review of executed diff before land."

## Before Starting

Read the upstream artifacts that review-exec must inspect:
- `.svc/receipts/<sha>/exec-record.json` — what was executed
- `.svc/receipts/<sha>/plan-manifest.json` — the plan being executed
- `docs/specs/features/<name>.md` — the spec + ACs
- `git diff main..HEAD` — the literal diff being reviewed

Do not read unrelated source files. Scope is bounded by plan-manifest's
`scope.included` set; reading outside that set is wasted context.

If any upstream artifact is missing: refuse to certify; print the missing
artifact and the skill that produces it.

## Task Graph

review-exec contributes one task to the lane-tasks graph:
- `review-exec` (after execute-changeset, before land-changeset)

The task is invoked OUT-OF-LANE-ORDER by route-workflow (see
`mandatoryChainOutOfLane.review-exec` in skills-manifest.json) because
review-exec depends on the L2/L3 chain enforcement rather than on a
fixed lane position.

Source of truth: `.svc/lane-tasks-<WI>.json` may include a
`review-exec` entry; if missing, route-workflow adds it automatically
when this skill is invoked. Codex's `update_plan` mirror must reflect
the same task graph state.


## What This Skill Is (and Isn't)

- **Is:** an enforcement wrapper that guarantees self-review + adversarial review of `execute-changeset`'s output, with the deterministic owner-configured panel from `review-topology-v2.mjs`. Emits SHA-keyed receipts so the chain can verify the review actually ran.
- **Isn't:** a re-implementation of `review-cross-model`. The second-model invocation primitive is `review-cross-model`. review-exec orchestrates it under contract.

## Why This Skill Exists

The chain prior to this plan made `review-cross-model` *optional* — invoked when the orchestrator decided to. Three failure modes followed:

1. The author of an exec is the one deciding whether their own output needs second-model review. Author-time judgment is unreliable for catching the author's own pattern reproductions (per the framework learning on author-pattern reproduction).
2. With no required receipt, downstream gates couldn't verify a review happened.
3. The reviewer was agent-picked, not pair-resolved, which let same-family review through.

review-exec closes all three: required to run, pair sourced from resolver, receipt mandatory.

## Process

Every newly emitted review receipt is schema v3. It preserves the independent reviewer command argv and output artifact paths in `reviewer_evidence`; callers cannot request a legacy schema. The emitter derives `deletion_bearing` from the candidate diff. For deletion-bearing executable diffs, run `node scripts/find-callers.mjs --identifier <deleted-identifier>` and attach parse/collect evidence. Submitter-only output is never independent review evidence.

### P1 — Self-Review (mandatory)

Orchestrator runs its own structured pass on the executed diff:
- Lists what was checked (e.g. "AC #2 verification", "error-handling on path X", "dependency citations match plan-manifest").
- Lists known gaps left in.
- Declares per-section confidence.

A "no findings" self-review on a substantive diff is treated as suspicious and gets flagged at P3.

Write self-review note to `.svc/receipts/staging/<tree-hash>/review-exec-self.json`.

Emit the pre-commit receipt without `--sha`; the emitter compares the index
tree to `HEAD` and binds a dirty candidate to
`.svc/receipts/staging/<tree-hash>/review-exec.json`. Supplying the base SHA
would review the wrong committed tree and is forbidden for an executed diff.

**Deterministic coverage + one gap pass (§4).** Run the AC/scope/authority and
receipt coverage checks, then one orchestrator gap pass over uncovered lenses.
Persist normalized finding IDs plus `self_review_digest`; do not repeat full
self-review until two subjective empty passes. After remediation, rerun only if
the relevant finding/lens digest changed. The external holistic review remains
mandatory and receives the coverage digest.

### P2 — Resolve Adversarial Pair

```bash
REVIEWER_CONFIG="${SVC_REVIEWER_POLICY:-$HOME/.svc/reviewer-policy-v2.json}"
REVIEW_ORCHESTRATOR="$(bash scripts/detect-host.sh)"
case "$REVIEW_ORCHESTRATOR" in claude|codex) ;; *)
  echo "review-exec: owner topology currently requires a claude or codex orchestrator" >&2
  exit 2
esac
node scripts/review-topology-v2.mjs plan \
  --config "$REVIEWER_CONFIG" \
  --orchestrator "$REVIEW_ORCHESTRATOR" \
  --phase exec \
  --mode production \
  > .svc/review-exec-pair.json
```

Host detection selects only the topology namespace; it does not select a reviewer profile. This
owner-only external file is the active topology authority. It configures self-review,
same-family Sol, AGY Gemini 3.7 Flash High, and optional Opus independently by host, phase, and
mode. Do not use the legacy `--select-profile` registry operation to substitute Sol for a Claude
tuple: that compatibility selector is not the owner panel. Pass every resolved external station
to `run-external-review.mjs` with `--reviewer-config`, `--reviewer-mode production`,
`--reviewer-phase exec`, and `--reviewer-station <id>`. Preserve capability and invocation
receipts. A same-family Sol station remains advisory; only a configured different-family external
station can satisfy independent release authority.

### P3 — Adversarial Review (via review-cross-model)

Invoke `review-cross-model` with the resolved pair. review-cross-model performs the diff package preparation + second-model dispatch + finding evaluation + convergence loop.

Pass through:
- `--orchestrator=<orchestrator>` to the canonical launcher
- `--review-kind=exec` (so review-cross-model focuses on the executed diff)
- `--fast` if diff < 50 lines AND does not touch auth / data model / payments

review-cross-model returns its markdown output at `docs/specs/reviews/<name>-exec-cross-model.md` (existing path) PLUS — per the modification to review-cross-model in this plan — a structured JSON receipt that review-exec wraps with the self-review note and the pair record.

**Wave mode (WI-382 — Claude host).** On a host with in-session Agent subagents, P3 does NOT run serially ahead of audit-implementation: review-exec, the G5 auditor, the audit specialists and the visual lens run as ONE read-only fan-out over a single frozen diff per `references/parallel-review-station.md`. The lenses return the `schemas/review-lens-finding.schema.json` shape; `scripts/review-station-merge.mjs` merges them mechanically (dedup-by-file:line, keep-highest-severity, no orchestrator re-adjudication); each lens keeps its own 3-round cap; a fix re-review re-freezes the diff and re-runs ONLY the originating lens (NEVER_GATE security/data-migration locations always keyed); receipts emit sequentially **post-barrier**. The cross-family pair, the P4 kickback ladder, and the P5 receipt below are unchanged — only the dispatch topology. **Non-Claude hosts keep the serial chain.** This is an in-class read-only fan-out (no S5 policy gate).

### P4 — Iteration Loop (rejection protocol)

When CRITICAL or HIGH findings remain after an adversarial pass, choose the
resolution path by finding cause / size:

| Finding cause / size | Resolution path |
|---|---|
| ≤ 20-line fix, no structural change | **Patch in place.** Edit exec output, re-run P3 on the patched diff. Round count increments. |
| > 20 lines OR structural change | **Re-execute.** Archive current exec-record, re-dispatch `execute-changeset` with reviewer findings as additional input. |
| Finding traces to a plan flaw | **Re-plan.** Archive plan-manifest, kick back to `plan-changeset`. Chain restarts at G5. |

**HARD 3-round cap (WI-491) — this is a cap on ADVERSARIAL ROUNDS per frozen
diff, not merely on patches.** An adversarial reviewer never runs out of High
findings on a complex diff, so "re-review until zero High" is unreachable.
Convergence is by DISPOSITION: run at most **3** adversarial rounds. After round
3 (never a 4th):
- **Unresolved Critical →** `terminal_state: ESCALATED_TO_USER`; the change
  BLOCKS and goes to the owner (Criticals never promote, never auto-accept).
- **Only High/Medium/Low remain →** disposition each remaining High
  (accept-with-justification as a logged execution-time risk, or
  reject-with-justification) and PROCEED. Highs need not disappear.

Before finalizing the verdict, WRITE the structured round record to the
review-log (`self_review_passes`, `rounds_run`, `unresolved_critical`, `remaining_high`, and — at
round 3 with residual Highs — a `bounded_exit` block enumerating them), then run
the mechanical gate and capture its output:

```bash
node scripts/check-review-round-cap.mjs --log docs/specs/reviews/<name>-exec-review-log.yaml
```

Exit 0 = bounded and every High dispositioned → finalize `pass`; when the
terminal immutable launcher verdict remains raw `fail`, finalize the local
receipt as `pass-with-acks` with the WI-566 adjudication described below. Exit 3 =
unresolved Critical correctly escalated → verdict is `escalated`, the change does
NOT promote. Exit 1 = a 4th round ran, an unresolved Critical lacks escalation,
or a High is undispositioned → fix the disposition, never start another round.

For a terminal raw `fail`, attach `reviewer_evidence.bounded_exit` matching
`schemas/receipts/bounded-exit.schema.json`. It must bind the exact ordered
launcher/findings digests, candidate SHA/tree/digest, derived cycle ID, review
log and deterministic cap result, plus exactly one census entry per terminal
finding. Every High requires hash-verified `.svc/` or `docs/` evidence. Never
Every terminal rubric failure requires an exact census entry mapped to
dispositioned terminal finding IDs, with justification and hash-verified
repository evidence. Unread dependencies and failed certifications still block.
Never rewrite reviewer bytes. A Critical, stale/mutated candidate, missing/duplicate
finding, wrong digest, or fourth receipt remains inadmissible.

### P5 — Verdict and Receipt Finalize

Build the SHA-keyed receipt at `.svc/receipts/<sha>/review-exec.json` per `schemas/receipts/review-exec.schema.json`:

```json
{
  "receipt_type": "review-exec",
  "schema_version": 1,
  "wi": "<WI-id>",
  "diff_hash": "<sha-of-diff>",
  "fast_mode": false,
  "self_review": {
    "orchestrator": "claude",
    "findings_count": 3,
    "notes": "..."
  },
  "adversarial_review": {
    "requested_primary_tuple": {"host":"codex","family":"openai","model":"gpt-5.6-sol","effort":"high"},
    "primary_used": true,
    "effective_tuple": {"host":"codex","family":"openai","model":"gpt-5.6-sol","effort":"high"},
    "fallback_used": false,
    "launcher_receipt": ".svc/external-review-artifacts/.../receipt.json",
    "findings": [...],
    "iteration_count": 1
  },
  "rejection_action": "none",
  "verdict": "pass",
  "timestamp": "..."
}
```

Update the consolidated git note for the commit's SHA so reconcile-gate can verify cross-family discipline:

```bash
# Read existing envelope
ENV="$(git notes --ref=svc-receipts show <sha> 2>/dev/null || echo '{}')"
# Merge in the new review-exec entry
NEW_ENV="$(echo "$ENV" | jq --argjson r "$(cat .svc/receipts/<sha>/review-exec.json)" '. + {"review-exec": $r}')"
echo "$NEW_ENV" | git notes --ref=svc-receipts add -f -F - <sha>
```

## Inputs

| Path | Artifact |
|---|---|
| `.svc/receipts/<sha>/exec-record.json` | Written by execute-changeset; required |
| `.svc/receipts/<sha>/plan-manifest.json` | Written by plan-changeset; required |
| `docs/specs/features/<name>.md` | Feature spec (the ACs) |
| Output of `scripts/review-topology-v2.mjs plan` | Owner-configured panel selection |

## Outputs

| Path | Artifact |
|---|---|
| `.svc/receipts/<sha>/review-exec.json` | SHA-keyed receipt (schema-validated) |
| `docs/specs/reviews/<name>-exec-cross-model.md` | Human-readable review (existing review-cross-model output) |
| `refs/notes/svc-receipts` git note for <sha> | Consolidated envelope updated |

## Pipeline Continuation

After review-exec emits its receipt with verdict=`pass`:

| Next phase | Trigger condition |
|---|---|
| audit-implementation | Always — runs in parallel with review-exec when invoked from route-workflow |
| land-changeset | After both review-exec verdict=pass AND audit-implementation verdict=pass |
| verify-promotion | After land-changeset merges the PR (invoked via land-changeset post-merge or svc-reconcile responsibility B) |

If review-exec verdict=`fail`, see the rejection table in P4 above.

## Verification Cost Class (§4b)

Every verification carries a cost class (`cheap`/`scoped`/`full`) so cadence
is a lookup, not a judgement — canonical table + measured costs:
`skills/execute-changeset/SKILL.md` § Verification Cost Class.

## Self-Verify

Before declaring the skill complete:

| # | Check | How | PASS/FAIL |
|---|---|---|---|
| 1 | Receipt exists | `.svc/receipts/<sha>/review-exec.json` is readable | PASS if file present |
| 2 | Schema valid | Validate against `schemas/receipts/review-exec.schema.json` | PASS if schema check returns 0 |
| 3 | Cross-family pair | `adversarial_review.primary_reviewer_host` differs from `self_review.orchestrator` cognitive family | PASS if pair is cross-family |
| 4 | Note attached | `git notes --ref=svc-receipts show <sha>` returns envelope with `review-exec` key | PASS if note resolves and contains key |
| 5 | Verdict consistent | If verdict=pass, no CRITICAL remains unresolved (Criticals escalate, never disposition) AND every HIGH is either fixed OR carries a documented disposition (accept-with-justification as a logged risk / reject-with-justification). HIGHs do NOT have to vanish to pass — the loop is HARD-capped at 3 rounds (`scripts/check-review-round-cap.mjs`); an adversarial reviewer never runs dry, so terminate by disposition, not by draining findings. | PASS if assertion holds |

## Failure Modes

| Failure | Behavior |
|---|---|
| Launcher reports missing CLI/capability | Refuse to certify with its single actionable receipt; chain halts |
| Unresolved CRITICAL at any round (including the 3rd) | A Critical is NEVER dispositioned and NEVER re-looped into a 4th round. Record `terminal_state: ESCALATED_TO_USER`; `check-review-round-cap.mjs` returns exit 3; verdict is `escalated`; the change BLOCKS and goes to the owner. Never `re-execute`/`re-plan` a Critical past the cap to keep looping. |
| HIGH findings persist at the 3rd round | Not a failure — disposition each remaining High (accept-with-justification as a logged risk, or reject-with-justification), record `bounded_exit`, and PROCEED. Never a 4th round. |
| Reviewer returns findings before the cap (rounds 1–2), ≤20-line fix | Patch in place and re-run ONE more adversarial round (still ≤3 total). >20-line/structural → re-execute; plan flaw → re-plan. |
| Receipt write fails | Skill exits non-zero; chain halts |
| Cross-family discipline violation (primary same as orchestrator) | Skill exits non-zero with diagnostic; investigate resolver |

## Composition

- **review-cross-model** — review-exec delegates to it for the actual second-model invocation. review-cross-model is modified in this plan to also emit JSON receipts alongside its markdown output.
- **review-plan** — same matrix-resolved pair, same self-review + adversarial pattern, but at G5 (pre-exec) instead of post-exec (G5-enforcing gate).
- **audit-implementation** — runs in parallel with review-exec post-exec; HIGH/CRITICAL findings from audit-implementation pass through the same adversarial pair for a second pair of eyes.
- **dispatch-waves** — parallel WI workers DO NOT run review-exec; that's parent-session-only. Workers stop at execute-changeset and emit exec-record receipts; parent serializes review-exec → audit-implementation → land.


## Lane-Tasks & Codex Coordination

source of truth: `.svc/lane-tasks-<WI>.json`

Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume.

For Codex coordination, mirror only the active step in `update_plan` after each
lane-tasks update — never mirror the full task graph (Codex's plan slot is
small; the full graph belongs in lane-tasks).
