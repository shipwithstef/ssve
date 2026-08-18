# Chain Receipt Contract (Mandatory Plan-Exec-Review Chain)

Every chain skill must emit a SHA-keyed JSON receipt that proves the skill
ran for a given commit. Receipts are the substrate of L2 (git hooks) and
L3 (`svc-reconcile`) enforcement.

## Authoritative Storage

- **Git notes ref:** `refs/notes/svc-receipts` — the durable source of truth.
- **Working-tree mirror:** `.svc/receipts/<short-sha>/<receipt-type>--<WI>[--<phase>].json` —
  gitignored speed cache, regenerable from notes. Compatibility aliases at
  `<receipt-type>.json` are best-effort and must not be treated as canonical.
- **Pre-commit staging:** `.svc/receipts/staging/<tree-hash>/<receipt-type>.json`
  — used when SHA is not yet known. Post-commit hook promotes to mirror +
  writes git note.
- **Review evidence store (WI-547):** `$(git rev-parse --git-common-dir)/svc-review-evidence/`
  — content-addressed copies of external-review artifact bytes plus a
  historical-path → object-id relocation map. Lets `review-plan` /
  `review-exec` evidence verify from canonical main after the execution
  worktree is gone. Relocation never rewrites launcher receipts or notes.
  Verification never launches a reviewer.

## Receipt Types and Producers

| Receipt type | Producer skill | Schema |
|---|---|---|
| `quick-fix` | `quick-fix` (via `scripts/quick-fix-eligibility.mjs`) | `schemas/receipts/quick-fix.schema.json` |
| `plan-manifest` | `plan-changeset` (P-final) | `schemas/receipts/plan-manifest.schema.json` |
| `review-plan` | `review-plan` (P5 final) | `schemas/receipts/review-plan.schema.json` |
| `exec-record` | `execute-changeset` (P-final) | `schemas/receipts/exec-record.schema.json` |
| `review-exec` | `review-exec` (P5 final) | `schemas/receipts/review-exec.schema.json` |
| `audit-implementation` | `audit-implementation` (final pass) | `schemas/receipts/audit-implementation.schema.json` |
| `verify-promotion` | `verify-promotion` (P3 extended) | `schemas/receipts/verify-promotion.schema.json` |
| `retroactive-attestation` | WI-472 reviewed historical reconciliation only | `schemas/receipts/retroactive-attestation.schema.json` |

`retroactive-attestation` is not a reconstructed phase chain. It records the
target commit/tree, immutable evidence hashes, and the real cross-family row
approval that accounted for a historical gap. The checker reports its type as
`retroactive-attestation`, never `complete`. It cannot assert that
plan/review/exec/audit phases ran, and it is invalid without a tree match,
zero-waiver verdict, and hash-bound canonical review artifacts.

## Pipeline Baton — `plan-manifest.ac_digests` (WI-381)

The `plan-manifest` receipt carries the **pipeline baton**: `ac_digests` (a
per-AC navigation index) and `mocked_deps`. Distilled by `plan-changeset` from
the reviewed manifest after `review-plan` PASS, it lets the 5 downstream chain
skills (`execute-changeset`, `review-exec`, `audit-implementation`,
`land-changeset`, `verify-promotion`) read a one-page briefing FIRST instead of
re-reading the full spec + manifest at every stage start.

**Authority contract (load-bearing):** `ac_digests` is a NAVIGATION index, NOT
the authoritative AC source — the live spec at `ac_digests.spec_path` always is.
The baton routes attention; it never replaces a gate's evidence source
(`audit-implementation` keeps diffing against the actual spec).

**Staleness binding:** `ac_digests.spec_ac_table_sha256` is a sha256 over the
spec's normalized AC signatures (`scripts/lib/normalize-ac-table.mjs`), bound to
BOTH the manifest (the baton lives inside the tree-bound receipt) AND the spec AC
table. `check-chain-receipts.mjs` RECOMPUTES it against the spec **as it is in
that commit's tree** and fails on mismatch — so a mid-pipeline AC revision
invalidates the baton and forces a re-distill (it cannot silently carry stale
digests). The binding is insensitive to checkbox/progress flips and `*(...)*`
verification annotations, sensitive to real AC text revisions. v3+ plan-manifests
carry the baton; legacy (v1/v2) are grandfathered. Locked by
`test-framework/evals/tier-1/validate-baton-ac-binding.sh`.

## Emit Pattern (Same for All Skills)

```bash
BASE_SHA="$(git rev-parse HEAD)"
SHORT_SHA="${BASE_SHA:0:7}"
MIRROR_DIR=".svc/receipts/$SHORT_SHA"
mkdir -p "$MIRROR_DIR"

# Build receipt object matching the schema for this type
cat > "$MIRROR_DIR/<receipt-type>.json" <<EOF
{
  "receipt_type": "<receipt-type>",
  "schema_version": 1,
  ...other fields per schema...,
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

# Update consolidated git note (merge into envelope by identity slot)
ENV="$(git notes --ref=svc-receipts show "$BASE_SHA" 2>/dev/null || echo '{}')"
NEW_ENV="$(echo "$ENV" | jq --argjson r "$(cat "$MIRROR_DIR/<receipt-type>.json")" \
  '. + {"slot::<receipt-type>::'"$WI"'::'"$BASE_SHA"'": $r}')"
echo "$NEW_ENV" | git notes --ref=svc-receipts add -f -F - "$BASE_SHA"
```

## Alternate One-Call Emitter Pattern (Recommended)

Skills may invoke the one-call receipt emitter script passing the explicit SHA:

```bash
BASE_SHA="$(git rev-parse HEAD)"
cat <<'JSON' | node scripts/emit-receipt.mjs --type <receipt-type> --wi $WI --sha "$BASE_SHA"
{
  "wi": "$WI",
  ...receipt body matching schema...
}
JSON
```

If the skill runs before a commit exists, it writes to
`.svc/receipts/staging/<tree-hash>/` and the post-commit hook promotes.

## Self-Verify Obligation

Every chain skill's Self-Verify section must include:

> "Receipt at `.svc/receipts/<sha>/<type>.json` exists, passes its schema,
> and is reflected in the consolidated git note on
> `refs/notes/svc-receipts` for the commit's SHA."

## Validation

`scripts/check-chain-receipts.mjs --sha <sha> --wi <WI>` reads the git note as
authoritative, regenerates the mirror cache if missing, and validates
each receipt against its schema. Finalization consumers (`stop`,
`verify-promotion`, `final-report`) refuse a mirror-only envelope — gitignored
mirrors are not authority and must never be merged back into notes.
Missing or invalid receipts are reported
as `unaccounted` and surface at:
- `hooks/git/pre-push.d/10-receipts-complete` (L2 enforcement)
- `scripts/svc-reconcile.mjs` responsibility A (L3 enforcement)

### Identity model (WI-550)

Canonical note entries are keyed by:

`slot::<receipt_type>::<wi>::<target_sha>[::<phase>]`

Legacy envelopes keyed as `{ "<receipt-type>": { ...receipt... } }` remain
readable. Projection rules:

1. If the legacy body has `wi`, project to `{type, wi}`.
2. If it has no `wi`, projection is allowed only when exactly one WI owner is
   claimed for that SHA.
3. If owner projection is ambiguous, fail closed and require an explicit owner
   map (no guessing, no destructive rewrite of historical bytes).

### Bounded reconcile and reviewed historical recovery (WI-472)

L3 uses one bounded `--range` receipt check when a checkpoint exists; only the
first-run last-five bootstrap remains per-SHA. Every synchronous child call is
made through `scripts/lib/reconcile-core.mjs` with a timeout no greater than 20
seconds. A timeout is degraded evidence and never success.

For a range containing more than one SHA, `check-chain-receipts` preserves the
same direct-SHA validator as the semantic authority and schedules self-invoked
`--sha` children through a bounded pool. Concurrency defaults to the smaller of
eight and available host parallelism, has a hard range of 1..16, and results
remain in Git-log input order. Each child has a bounded timeout and a 4 MiB
output ceiling. Spawn, signal, timeout, buffer, malformed-output, cardinality,
or SHA-binding failures produce an exact-SHA `worker-error`, populate the
aggregate `infrastructure_failures` list, name the infrastructure failure on
stderr, and fail the aggregate closed. The replay-safe remedy is rerunning the
whole reconcile command, never editing the checkpoint. Direct
`--sha`, PR mode, receipt requirements, and checkpoint advancement semantics do
not change.

Merged-but-unverified promotion work is detached behind one per-SHA lock. The
child atomically moves a drive outcome from `running` to `terminal` with an exit
classification. The PR-watcher cutoff advances only when GitHub was available
and every candidate is either already verified or has a terminal successful
outcome. Missing, running, failed, timed-out, and unavailable states preserve
the prior cutoff. GitHub account switching records the original identity before
mutation and reconciles a stranded recovery record at the next startup.

A historical receipt gap is not permission to waive commits in bulk. The
sanctioned recovery path freezes an immutable SHA range and ledger hash,
produces an exact per-SHA envelope bundle, requires a different-family
independent review with one verdict for every row, then applies the reviewed
hash only after creating a write-once notes-ref backup. Any rejection or hash,
coverage, reviewer-independence, or zero-waiver failure blocks mutation.

## Bypass Path

The only bypass is `EMERGENCY_OVERRIDE` (see this plan's Emergency
Override Protocol). Logged via `scripts/log-waiver.mjs`. Capped at 4 per
90 days. Auto-creates a retroactive-plan WI.

## Why This Contract Exists

This contract is part of the mandatory PLAN+EXEC+REVIEW chain. Each
phase's receipt is the mechanical proof the phase ran with the required
inputs and produced the required output. Without receipts, "did this
phase run" reduces to agent-claim, which fails consistently under
load (per the framework learning on author-pattern reproduction).

See:
- This plan: `<plan-file-path>` (mandatory chain rollout)
- `rules/plan-changeset-trigger.md` (when the chain fires)
- `references/plan-review-protocol.md` (review protocol)
