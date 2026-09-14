# WI-566 Changeset Manifest: bounded review receipts

**Status:** CHANGE-SET-APPROVED; frozen execution verification in progress
**Spec:** `docs/specs/work-items/WI-566.md`
**Branch:** `proposals/2026-09-02-bounded-review-receipts`
**Base:** `981005eb9127237d5c5e3a259ee023965ee15dfd`
**Lane:** framework bugfix, full delivery tier
**Execution mode:** inline
**Archetype:** incremental extension of schema-v3 reviewer-evidence authority
**Risk:** governance hot path; additive receipt schema; no persisted-data migration

## Outcome and Invariants

Add one admissible terminal state for an independent three-round review whose
immutable final verdict remains raw `fail`, while retaining these invariants:

- raw failure never authorizes itself;
- Critical findings, unread dependencies, and failed certifications block;
- terminal rubric failures are admissible only through an exact mapped,
  justified, hash-evidenced rubric census;
- the promotion target is the final candidate commit/tree/digest;
- each round is bound separately to the subject revision actually reviewed;
- plan rounds may review successive manifest digests in one locked review cycle;
- execution rounds remain bound to the final Git-tree candidate;
- the HMAC-signed launcher issuance inventory, not a caller array, defines the
  complete unique chronological review cycle;
- every terminal finding and residual High disposition is reconciled exactly;
- existing raw `pass` and `pass-with-findings` evidence remains valid.

## Exact Scope Fence

The changeset may touch only these tracked surfaces:

| Surface | Exact files |
|---|---|
| Runtime | `scripts/lib/evidence-schema.mjs`; `scripts/lib/bounded-exit.mjs`; `scripts/lib/reviewer-evidence.mjs`; `scripts/lib/external-review-provenance.mjs`; `scripts/run-external-review.mjs`; `scripts/build-bounded-exit-receipt.mjs` |
| Schemas | `schemas/receipts/bounded-exit.schema.json`; `schemas/receipts/bounded-exit-evidence.schema.json`; `schemas/receipts/review-plan.schema.json`; `schemas/receipts/review-exec.schema.json` |
| Contracts | `skills/review-plan/SKILL.md`; `skills/review-exec/SKILL.md`; `skills/review-cross-model/SKILL.md` |
| Tests | `test-framework/evals/tier-1/fixtures/external-review-fixture.mjs`; `test-framework/evals/tier-1/validate-bounded-review-exit.mjs`; `test-framework/evals/tier-1/validate-reviewer-run-evidence.sh`; `test-framework/evals/tier-1/validate-retroactive-attestation.sh`; `test-framework/evals/tier-1/validate-contracts.sh`; `test-framework/evals/tier-1/validate-external-review-launcher.sh` |
| Governance | `.svc/lane-tasks-WI-566.json`; `.svc/pipeline-decisions.jsonl`; `docs/specs/work-items/WI-566.md`; `docs/specs/work-items/INDEX.md`; `docs/specs/bugfix/wi-566-bounded-review-receipt-parity.md`; `docs/specs/decisions/wi-566-bounded-review-receipt-parity.md`; `docs/specs/reviews/wi-566-retro-plan-override.json`; `docs/specs/audit/wi-566-analysis.md`; this manifest; this plan's review log and review artifacts |
| Framework knowledge | `proposals/2026-09-02-framework-improvement-bounded-review-receipt-parity.md`; `FRAMEWORK-STATE.md`; `references/knowledge/svc/CAPABILITIES.md`; `.svc/manifest-digest.json` |
| Persisted test result | `test-framework/results/2026-09-02-WI-566/summary.md` |

May not touch application runtime code, Supabase state, deployment definitions,
unrelated work items, or the immutable Example Marketplace reviewer receipts. Generated
review caches under `.svc/external-review-artifacts/` and host authority markers
are evidence, not tracked implementation scope.

Inline mode is deliberate: the controller retained the WI, diagnosis, proposal,
implementation, and test context after the blocked Cursor handoff. The explicit
task graph remains the execution authority.

## Task Graph and AC Coverage

| Task | Depends on | ACs | Validation |
|---|---|---|---|
| T1 — schema and shared validator | diagnosis | AC-1, AC-2, AC-6 | contract validation and raw-pass regression |
| T2 — dual-identity bounded authority | T1 | AC-2, AC-3, AC-4, AC-5 | promotion target, subject revision, cycle, census, evidence mutation matrix |
| T3 — signed cycle inventory | T2 | AC-2, AC-5 | duplicate, reorder, hidden-fourth, mismatched-cycle, and modern fourth-issuance negatives |
| T4 — plan/exec integration and builder | T1–T3 | AC-1, AC-6 | schema-v3 emitter replay for both receipt types and deterministic builder output |
| T5 — Example Marketplace-shaped replay | T4 | AC-4, AC-7 | three successive plan revisions, terminal two High/two Medium, rubric failures 2/6/7/10, zero Critical, no fourth call |
| T6 — review, audit, land, install, original replay | T1–T5 | AC-1–AC-7 | independent Grok review, full-suite comparison, installed immutable Example Marketplace replay |

## AC-to-Proof Mapping

| AC | Required proof |
|---|---|
| AC-1 | Plan and exec bodies pass `emit-receipt.mjs` as schema v3. |
| AC-2 | Exact WI/kind/promotion SHA/tree/digest, per-round subject digest, cycle, sequence, and log mutations reject. |
| AC-3 | Omitted, duplicate, unknown, severity-mismatched, and log-divergent census cases reject. |
| AC-4 | Critical, missing High evidence, unmapped/unevidenced rubric failures, unread dependencies, failed certifications, and disposition drift reject. |
| AC-5 | Duplicate replay, reordered receipts, altered receipt bytes, hidden fourth issuance, cross-cycle mixing, and abnormal checker termination reject. |
| AC-6 | Existing raw `pass` and `pass-with-findings` fixtures validate, including plan subject revisions distinct from the promotion tree. |
| AC-7 | Synthetic replay passes before landing; the three original immutable Example Marketplace receipts replay after clean installation. |

## Lane Compliance and Deliberate Skips

The canonical route is `improve-framework → route-workflow → diagnose-bug → plan-changeset →
review-plan → execute-changeset → review-gate(G5) → review-exec →
audit-implementation → land-changeset → verify-promotion`, with
`test-framework` as the explicit static candidate/base gate between execution
checkpoint and G5.

- `improve-framework` is completed by the accepted proposal, WI-566 diagnosis,
  decision record, and this routed full-tier graph.
- `test-framework` static mode is loaded and task 11 persists focused and full
  candidate/base results before G5. Its runner is invoked without the stale
  documented `--tier1` flag because the repository runner accepts no such flag.

- `write-spec` is skipped because WI-566 is a regression correction with a
  canonical bug diagnosis and testable ACs, not new product behavior.
- `design-tech` is skipped because the decision record supplies the bounded
  technical design and evaluates the unsafe alternatives.
- `explore-solutions` is skipped because the diagnosis and decision compare the
  viable authority models and choose the smallest fail-closed repair.
- Implementation preceded normalization because the framework defect blocked its
  own ordinary plan gate. The owner-authorized retroactive phase override and
  pipeline decision record this fact; they do not fabricate historical receipts.

## Prerequisite Alignment Matrix

| Prerequisite | Alignment |
|---|---|
| Product/persona | N/A — framework governance repair; no product behavior changes. |
| UX/UI/visuals | N/A — no rendered surface or interaction contract. |
| Technical design | The WI-566 decision record defines dual identity, signed cycle authority, cap enforcement, and unsafe alternatives. |
| Code style | Existing dependency-free Node ESM, JSON Schema, atomic-write, and Tier-1 fixture conventions are retained. |
| Operations | All-host installation, immutable Example Marketplace replay, receipt emission, and chain validation are mandatory promotion gates. |

## External-State Taxonomy

| # | Environment | State and lifecycle |
|---|---|---|
| 1 | Host authority filesystem | HMAC-signed issuance markers under `~/.svc/external-review-authority-v1`; validation re-verifies marker HMAC, immutable receipt bytes (or content-addressed evidence-store fallback), cycle, sequence, WI, and kind. Append-only evidence is retained across rollback. |
| 2 | Host configuration | `./setup --all-hosts` installs the merged scripts, schemas, and skills; `scripts/check-install-drift.sh --all-hosts` verifies parity. |
| 3 | Example Marketplace sister checkout | Read-only original evidence is replayed in `/home/user/app-workspaces/example-marketplace-worktrees/wt-wi566-analytics-closeout`; only new adjudication/config/receipt closeout artifacts are added there. No application deploy occurs. |
| 4 | Repository `.svc/` | Tracked task graph and decision log are lifecycle authority; review caches remain ignored evidence. |
| 12 | Downstream framework contracts | The review skills and schema-v3 receipt contracts are installed and verified together with runtime code. |
| 15 | Local caches/evidence store | Content-addressed reviewer receipts may be read to resolve a historical marker whose original secure path no longer exists; cache deletion cannot broaden authority. |

Environments 5–11 and 13–14 are uncoupled. No application database, cloud
resource, deployment, secret, customer record, or analytics event is mutated by
this framework changeset.

## Original Example Marketplace Replay Fixture

Promotion target:

- WI: `WI-ANALYTICS-PAGEVIEW-RLS-01`
- candidate commit: `940794c79725dc7c7737f599616467a7a868fd17`
- branch: `docs/WI-ANALYTICS-PAGEVIEW-RLS-01-verify-promotion`
- replay worktree: `/home/user/app-workspaces/example-marketplace-worktrees/wt-wi566-analytics-closeout`

Immutable launcher receipts, in cycle order:

1. `/home/user/app-workspaces/seriousvibecoding-installed/.svc/external-review-artifacts/plan/cf89ecb1a42c80b185e197f865dd9f9ca7449a25340e336fd6376d1fc5f3eb28/20260831T090425Z-223621/receipt.json`
2. `/home/user/app-workspaces/seriousvibecoding-installed/.svc/external-review-artifacts/plan/7e3d1ec3eba4808718ad4880c00a7f242976837ddbae8cfd31235a1cc552beca/20260831T091615Z-251254/receipt.json`
3. `/home/user/app-workspaces/seriousvibecoding-installed/.svc/external-review-artifacts/plan/124a0c16e0410bcd303384279737fb815bb6a989e0acf3683f3e119028826dcb/20260831T092659Z-296639/receipt.json`

These are one legacy plan-review cycle: same WI, review kind,
`pre_execution_base=9eaf50991776c49d231350d2f9cec3f70348b1c5`, and override actual SHA
`75e358a4e5fb5567f401e692e3088a4e65fc128f9318b004f39ef2d3f522af74`.
Their reviewed subject digests differ by design. The terminal findings are two
High (`F-001`, `F-002`) and two Medium (`F-003`, `F-004`), with rubric failures
2/6/7/10 and zero Critical.

Post-install closeout artifacts, all created beneath the Example Marketplace analytics plan
directory named above:

- `bounded-exit-review-log.yaml`
- `bounded-exit-config.json`
- `bounded-exit-disposition-evidence.json`
- `bounded-exit-review-plan.json`

The new adjudication log records the immutable review cycle and its accepted
residual Highs without rewriting the original review log or reviewer output.

The exact structured disposition evidence is:

```json
{
  "schema_version": 1,
  "wi": "WI-ANALYTICS-PAGEVIEW-RLS-01",
  "candidate_digest": "516be10844ca068e9ba7f70d822c05074d31c56e88722d2c3e9425a31391bf20",
  "finding_ids": ["F-001", "F-002", "F-003", "F-004"],
  "rubric_ids": [2, 6, 7, 10],
  "verification_method": "verify-promotion",
  "result": "pass",
  "result_artifact": {
    "path": "docs/logs/verify-promotion/WI-ANALYTICS-PAGEVIEW-RLS-01-2026-09-01.md",
    "sha256": "87c27d5ff3ccee6055f6240a84dc005cc08df265439cea74ac096eafe78adb66"
  }
}
```

The exact builder config is:

```json
{
  "schema_version": 1,
  "review_kind": "plan",
  "wi": "WI-ANALYTICS-PAGEVIEW-RLS-01",
  "candidate_sha": "940794c79725dc7c7737f599616467a7a868fd17",
  "launcher_receipts": [
    "/home/user/app-workspaces/seriousvibecoding-installed/.svc/external-review-artifacts/plan/cf89ecb1a42c80b185e197f865dd9f9ca7449a25340e336fd6376d1fc5f3eb28/20260831T090425Z-223621/receipt.json",
    "/home/user/app-workspaces/seriousvibecoding-installed/.svc/external-review-artifacts/plan/7e3d1ec3eba4808718ad4880c00a7f242976837ddbae8cfd31235a1cc552beca/20260831T091615Z-251254/receipt.json",
    "/home/user/app-workspaces/seriousvibecoding-installed/.svc/external-review-artifacts/plan/124a0c16e0410bcd303384279737fb815bb6a989e0acf3683f3e119028826dcb/20260831T092659Z-296639/receipt.json"
  ],
  "review_log": "docs/plans/2026-08-31-analytics-pageview-rls/bounded-exit-review-log.yaml",
  "dispositions": {
    "F-001": { "disposition": "accept-with-justification", "justification": "The promoted execution order and authenticated journey passed despite the reviewed plan-order risk.", "evidence": ["docs/plans/2026-08-31-analytics-pageview-rls/bounded-exit-disposition-evidence.json"] },
    "F-002": { "disposition": "accept-with-justification", "justification": "The promoted runtime probe and receipt chain prove the execution dependency completed.", "evidence": ["docs/plans/2026-08-31-analytics-pageview-rls/bounded-exit-disposition-evidence.json"] },
    "F-003": { "disposition": "accept-with-justification", "justification": "Promotion verification confirms the operational analytics writers remained intact." },
    "F-004": { "disposition": "accept-with-justification", "justification": "The completed execution and promotion report supersede the plan-command ambiguity without altering reviewer bytes." }
  },
  "rubric_dispositions": {
    "2": { "finding_ids": ["F-004"], "disposition": "accept-with-justification", "justification": "The change-content and recovery ambiguity is represented by F-004 and closed by promotion evidence.", "evidence": ["docs/plans/2026-08-31-analytics-pageview-rls/bounded-exit-disposition-evidence.json"] },
    "6": { "finding_ids": ["F-004"], "disposition": "accept-with-justification", "justification": "The rollback ambiguity is represented by F-004 and bounded by the promoted commit and verification report.", "evidence": ["docs/plans/2026-08-31-analytics-pageview-rls/bounded-exit-disposition-evidence.json"] },
    "7": { "finding_ids": ["F-001"], "disposition": "accept-with-justification", "justification": "The dependency-order failure is exactly F-001 and the completed execution supplies closure evidence.", "evidence": ["docs/plans/2026-08-31-analytics-pageview-rls/bounded-exit-disposition-evidence.json"] },
    "10": { "finding_ids": ["F-002", "F-004"], "disposition": "accept-with-justification", "justification": "The execute-risk failures are exactly F-002/F-004 and the promoted runtime proof closes both.", "evidence": ["docs/plans/2026-08-31-analytics-pageview-rls/bounded-exit-disposition-evidence.json"] }
  }
}
```

The exact separate adjudication log is:

```yaml
rounds_run: 3
unresolved_critical: 0
remaining_high: 2
self_review_passes: 1
round_1:
  status: complete
round_2:
  status: complete
round_3:
  status: complete
bounded_exit:
  disposition: accept-with-justification
  residual_highs:
    - F-001
    - F-002
source_review_log: docs/plans/2026-08-31-analytics-pageview-rls/review-log.yaml
source_terminal_receipt_sha256: 5666135ebaba60dfd93875c115cef2dc04267d1edec004d79272547a9eb26cc5
```

## Verification-Only Task Sequence

Because implementation is frozen before this retroactive manifest, T1–T5 are
verification-only: do not broaden source scope while executing them.

The frozen runtime/schema/contract/test snapshot is the sorted Git-blob manifest
digest `51be0bd7cc347c8d08a8a9521d9590756ece30ac8fa7a42c9e3e166926041726`.
Task 5 must reproduce that digest before checkpoint; a focused failure may alter
only a named in-fence file and must update this digest plus invalidate plan review.

1. Validate the dual-identity schema, builder, raw-pass compatibility, signed
   cycle inventory, cap enforcement, and mutation matrix.
2. Run the full candidate suite and the exact-base suite with the same command;
   classify only candidate-only regressions as blockers.
3. Complete governed Grok plan review in at most three successful launcher rounds.
4. Checkpoint the exact reviewed implementation and run G5, governed execution
   review, and full implementation audit.
5. Land only through the canonical receipt wrapper; install from clean merged
   main and verify all-host drift.
6. Materialize the isolated Example Marketplace replay worktree, build the bounded receipt
   from the three immutable receipts, emit the plan receipt, and validate its
   receipt chain.

## Execution Command Sequence

Focused candidate validation:

```bash
set -euo pipefail
node test-framework/evals/tier-1/validate-bounded-review-exit.mjs
bash test-framework/evals/tier-1/validate-reviewer-run-evidence.sh
bash test-framework/evals/tier-1/validate-retroactive-attestation.sh
bash test-framework/evals/tier-1/validate-contracts.sh
bash test-framework/evals/tier-1/validate-external-review-launcher.sh
FROZEN_FILES=(
  scripts/lib/evidence-schema.mjs
  scripts/lib/bounded-exit.mjs
  scripts/lib/reviewer-evidence.mjs
  scripts/lib/external-review-provenance.mjs
  scripts/run-external-review.mjs
  scripts/build-bounded-exit-receipt.mjs
  schemas/receipts/bounded-exit.schema.json
  schemas/receipts/bounded-exit-evidence.schema.json
  schemas/receipts/review-plan.schema.json
  schemas/receipts/review-exec.schema.json
  skills/review-plan/SKILL.md
  skills/review-exec/SKILL.md
  skills/review-cross-model/SKILL.md
  test-framework/evals/tier-1/fixtures/external-review-fixture.mjs
  test-framework/evals/tier-1/validate-bounded-review-exit.mjs
  test-framework/evals/tier-1/validate-reviewer-run-evidence.sh
  test-framework/evals/tier-1/validate-retroactive-attestation.sh
  test-framework/evals/tier-1/validate-contracts.sh
  test-framework/evals/tier-1/validate-external-review-launcher.sh
)
FROZEN_DIGEST="$({ for file in "${FROZEN_FILES[@]}"; do printf '%s  %s\n' "$(git hash-object "$file")" "$file"; done; } | sha256sum | awk '{print $1}')"
test "$FROZEN_DIGEST" = 9116f9443ad1115320bfb6c497046dd304a87d9a5fc3a56f16aff1817ab534e1

RESULTS="$PWD/test-framework/results/2026-09-02-WI-566"
mkdir -p "$RESULTS"
if bash test-framework/evals/run-all-evals.sh >"$RESULTS/tier1-candidate.log" 2>&1; then CANDIDATE_RC=0; else CANDIDATE_RC=$?; fi
sed -nE 's/^[[:space:]]*FAIL: ([^ ]+\.(sh|mjs)).*/\1/p' "$RESULTS/tier1-candidate.log" | sort -u >"$RESULTS/tier1-candidate-failures.txt"
BASE_PARENT="$(mktemp -d)"
BASE_WT="$BASE_PARENT/base"
git worktree add --detach "$BASE_WT" 981005eb9127237d5c5e3a259ee023965ee15dfd
if (cd "$BASE_WT" && bash test-framework/evals/run-all-evals.sh) >"$RESULTS/tier1-base.log" 2>&1; then BASE_RC=0; else BASE_RC=$?; fi
sed -nE 's/^[[:space:]]*FAIL: ([^ ]+\.(sh|mjs)).*/\1/p' "$RESULTS/tier1-base.log" | sort -u >"$RESULTS/tier1-base-failures.txt"
comm -23 "$RESULTS/tier1-candidate-failures.txt" "$RESULTS/tier1-base-failures.txt" >"$RESULTS/tier1-candidate-only-failures.txt"
git worktree remove "$BASE_WT"
rmdir "$BASE_PARENT"
test ! -s "$RESULTS/tier1-candidate-only-failures.txt"
printf 'candidate_rc=%s\nbase_rc=%s\ncandidate_only_failures=0\n' "$CANDIDATE_RC" "$BASE_RC" >"$RESULTS/summary.md"
git diff --check
```

Expected: each focused command exits 0, the frozen digest matches exactly, both
full-suite exit codes are recorded, and the candidate-only failure set is empty.
Known failures shared with the exact base are environment/session-state evidence,
not WI-566 regressions; changed failure signatures are investigated before G5.

Installed Example Marketplace closeout:

```bash
REPLAY=/home/user/app-workspaces/example-marketplace-worktrees/wt-wi566-analytics-closeout
if test ! -d "$REPLAY"; then
  git -C /home/user/app-workspaces/example-marketplace-port worktree prune
  git -C /home/user/app-workspaces/example-marketplace-port worktree add --detach "$REPLAY" 940794c79725dc7c7737f599616467a7a868fd17
fi
test "$(git -C "$REPLAY" rev-parse HEAD)" = 940794c79725dc7c7737f599616467a7a868fd17 # expected exit 0
cd "$REPLAY"
test -f /home/user/app-workspaces/seriousvibecoding-installed/.svc/external-review-artifacts/plan/cf89ecb1a42c80b185e197f865dd9f9ca7449a25340e336fd6376d1fc5f3eb28/20260831T090425Z-223621/receipt.json # expected exit 0
test -f /home/user/app-workspaces/seriousvibecoding-installed/.svc/external-review-artifacts/plan/7e3d1ec3eba4808718ad4880c00a7f242976837ddbae8cfd31235a1cc552beca/20260831T091615Z-251254/receipt.json # expected exit 0
test -f /home/user/app-workspaces/seriousvibecoding-installed/.svc/external-review-artifacts/plan/124a0c16e0410bcd303384279737fb815bb6a989e0acf3683f3e119028826dcb/20260831T092659Z-296639/receipt.json # expected exit 0
test -f docs/plans/2026-08-31-analytics-pageview-rls/bounded-exit-config.json # expected exit 0; written via apply_patch from the exact JSON literal above
test -f docs/plans/2026-08-31-analytics-pageview-rls/bounded-exit-review-log.yaml # expected exit 0; written via apply_patch from the exact YAML literal above
test -f docs/plans/2026-08-31-analytics-pageview-rls/bounded-exit-disposition-evidence.json # expected exit 0; written via apply_patch from the exact JSON literal above
test -f docs/logs/verify-promotion/WI-ANALYTICS-PAGEVIEW-RLS-01-2026-09-01.md # expected exit 0; candidate-tree evidence
chmod 755 "$REPLAY" "$REPLAY/docs" "$REPLAY/docs/plans" "$REPLAY/docs/plans/2026-08-31-analytics-pageview-rls" "$REPLAY/docs/logs" "$REPLAY/docs/logs/verify-promotion"
chmod 600 docs/plans/2026-08-31-analytics-pageview-rls/bounded-exit-config.json docs/plans/2026-08-31-analytics-pageview-rls/bounded-exit-review-log.yaml docs/plans/2026-08-31-analytics-pageview-rls/bounded-exit-disposition-evidence.json docs/logs/verify-promotion/WI-ANALYTICS-PAGEVIEW-RLS-01-2026-09-01.md
node /home/user/app-workspaces/seriousvibecoding-installed/scripts/build-bounded-exit-receipt.mjs --config docs/plans/2026-08-31-analytics-pageview-rls/bounded-exit-config.json --out docs/plans/2026-08-31-analytics-pageview-rls/bounded-exit-review-plan.json
node /home/user/app-workspaces/seriousvibecoding-installed/scripts/emit-receipt.mjs --type review-plan --wi WI-ANALYTICS-PAGEVIEW-RLS-01 --sha 940794c79725dc7c7737f599616467a7a868fd17 --body docs/plans/2026-08-31-analytics-pageview-rls/bounded-exit-review-plan.json
node /home/user/app-workspaces/seriousvibecoding-installed/scripts/check-chain-receipts.mjs --sha 940794c79725dc7c7737f599616467a7a868fd17 --wi WI-ANALYTICS-PAGEVIEW-RLS-01 --consumer reconcile
```

Every command above has expected exit 0. The two JSON/YAML inputs are written
from the exact literals in this plan before invoking the builder; reruns replace
only those derived closeout artifacts and preserve immutable reviewer evidence.

Recovery after a focused failure: retain the exact failing fixture, correct only
the invalidated file inside the scope fence, rerun the focused set, then rerun
the candidate/base comparison. Never weaken a negative assertion or issue a
fourth review in a modern cycle.

## Simulation Report

| Check | Result |
|---|---|
| Existing schema-v3 raw-pass path remains accepted | PASS |
| Plan rounds can bind successive subject revisions while sharing one locked cycle | PASS |
| Execution rounds remain promotion-tree bound | PASS |
| Caller-selected subsets cannot hide a fourth signed issuance | PASS |
| Modern fourth issuance is refused before marker write | PASS |
| Historical marker receipt resolves from immutable path or content-addressed store | PASS |
| Wrong reviewed-subject digest, cross-cycle mixing, altered marker, and missing High evidence reject | PASS |
| Original Example Marketplace three-receipt inventory is discoverable at the three exact 64-hex paths in chronological order | PASS |
| Terminal rubric failures 2/6/7/10 have an exact mapped/evidenced census; unread dependencies/certification failures still reject | PASS |

## Checkpoints and Promotion Readiness

- [x] Diagnosis and smallest-safe-fix decision recorded.
- [x] Exact scope fence, delivery graph, and retroactive lane decision recorded.
- [x] Frozen implementation and focused fail-closed tests complete.
- [x] Read-only testing/security/correctness specialist audit completed.
- [x] Audit High findings corrected before external review.
- [x] Governed plan review converged at round 3 with zero Critical and four individually dispositioned Highs; no fourth call.
- [x] Final full-suite candidate/base comparison records no candidate-code blocker;
  both initially suspect validators pass in a clean exact-candidate worktree.
- [ ] G5, execution review, and implementation audit pass on one exact tree.
- [ ] PR #35 merges through the receipt wrapper and clean main installs to all hosts.
- [ ] Original Example Marketplace immutable cycle produces a valid closeout receipt and chain.

## Rollback

Revert the landed WI-566 commit through a normal follow-up change and reinstall
all hosts from clean main. Existing raw-pass validation remains the fallback.
Do not delete or rewrite host HMAC issuance markers, immutable launcher receipts,
content-addressed evidence, or already emitted chain receipts; they are audit
history, not runtime state. Remove or supersede only the newly emitted Example Marketplace
bounded closeout receipt through the receipt protocol if its assertion is later
proven false. Never leave an installed emitter capable of writing bounded-exit
receipts after removing its validator/schema.
