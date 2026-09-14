# plan-contract.json — risk-triggered sections (WI-553)

Single source of truth for the flag table: `scripts/lib/risk-flags.mjs`.
Mechanical enforcement: `scripts/validate-plan-contract.mjs` (`validateRiskSections`)
and `scripts/verify-plan-mechanical.sh` (Check 11).

## The rule: grow only matched sections (AC-553-3)

`plan-contract.json` carries an optional `risk_flags` array — the subset of
the shared flag table this changeset matches. Each flag REQUIRES its
matching section below to be present and valid; the ABSENCE of a flag
REQUIRES its matching section to be absent. A section present without its
flag is a mechanical FAIL — this is the enforcement half of "grows only
matched sections." Unmatched work (`risk_flags: []` or omitted) adds nothing
to the contract.

```json
{
  "schema_version": 1,
  "risk_flags": ["runtime_concurrency"],
  "concurrency": { "...": "..." }
}
```

## `runtime_concurrency` → `concurrency` section

Required fields:

| Field | Requirement |
|---|---|
| `atomic_primitive` | One of `flock`, `o_excl`, `atomic_rename`, `compare_and_swap`, `advisory_lock`, `mkdir_exclusive` — a REAL atomic primitive, not prose |
| `owner_key` | What identifies the lock/claim holder (PID, session id, lease token) |
| `concurrent_invoke_behavior` | What happens when two invocations race. **Mechanically rejected (AC-553-4, WI-542 shape):** any prose matching a check-then-write / exists-then-create pattern (e.g. "check if the file exists, then create it") — that is exactly the unguarded race WI-542 shipped. Describe the atomic operation instead: "creates via O_EXCL; the loser's open() fails with EEXIST and retries/backs off." |
| `stale_lock_cleanup` | How a crashed/orphaned lock holder's claim is reclaimed |
| `concurrency_test` | The test or fixture that exercises concurrent invocation |

## `external_state_writer` or `idempotent_rewriter` → `external_writer` section

Required fields:

| Field | Requirement |
|---|---|
| `immutable_baseline` | Path to the ONE never-overwritten pre-change snapshot |
| `rolling_rollback` | Path to the rollback target actually restored on failure. **Mechanically rejected (AC-553-4, WI-542 shape):** `rolling_rollback === immutable_baseline` — one backup path cannot serve as both "the baseline we never touch again" and "the thing we roll back to after every subsequent write." WI-542 used a single `.bak` file for both roles, so the second write silently destroyed the ability to recover the ORIGINAL pre-change state. |
| `read_failure_policy` | What happens when the target file can't be read (missing, corrupt, unreadable) before the write |
| `file_mode_preservation` | Whether/how file mode (permissions, owner) survives the rewrite |

## `lossless_rmw` → `lossless_rmw` section

Required field: `entry_types` — an array with at least one entry, each:

| Field | Requirement |
|---|---|
| `type` | The entry-type name (must be unique within the array) |
| `fixture` | A repo-relative path that MUST exist on disk — a concrete fixture proving THIS entry type survives the rewrite untouched |

**Mechanically rejected (AC-553-4, WI-542 shape):** a claim to "preserve
user/unknown entries" with no fixture per documented entry type. WI-542
claimed generic entry preservation with no test proving it — an untested
claim is not preservation, it is a guess. Every entry type you claim to
preserve needs its own fixture; a single generic "it preserves things" test
does not cover entry-type-specific serialization quirks (e.g. an entry with
extra unknown keys, an entry with a null field, a legacy-shape entry).

## `idempotent_rewriter` → additional `idempotent_rewriter` section

Required field: `proof` — a description of (or pointer to) the evidence that
running the rewrite a second time (retry, resumed session, duplicate
dispatch) cannot overwrite or corrupt the `immutable_baseline` from
`external_writer`. Both sections are required together when this flag is set.

## Worked example — WI-542-shaped failure vs corrected shape (AC-553-7)

**Fails** (`scripts/validate-plan-contract.mjs` rejects):

```json
{
  "risk_flags": ["runtime_concurrency", "external_state_writer"],
  "concurrency": {
    "atomic_primitive": "check exists first",
    "owner_key": "pid",
    "concurrent_invoke_behavior": "check if the hook file exists, then create it if not",
    "stale_lock_cleanup": "manual",
    "concurrency_test": "none"
  },
  "external_writer": {
    "immutable_baseline": ".svc/backup.bak",
    "rolling_rollback": ".svc/backup.bak",
    "read_failure_policy": "skip",
    "file_mode_preservation": "unspecified"
  }
}
```

Rejected for: `atomic_primitive` not in the allowlist; `concurrent_invoke_behavior`
matches the check-then-write race pattern; `immutable_baseline === rolling_rollback`.

**Passes** (corrected shape):

```json
{
  "risk_flags": ["runtime_concurrency", "external_state_writer"],
  "concurrency": {
    "atomic_primitive": "o_excl",
    "owner_key": "session_id",
    "concurrent_invoke_behavior": "opens the lock file with O_CREAT|O_EXCL; the losing invocation gets EEXIST and retries with backoff",
    "stale_lock_cleanup": "lock file embeds the holder PID; a new invocation that finds a dead PID removes and re-acquires",
    "concurrency_test": "test-framework/evals/tier-1/validate-risk-triggered-contracts.sh"
  },
  "external_writer": {
    "immutable_baseline": ".svc/backups/settings.pre-<sha>.json",
    "rolling_rollback": ".svc/backups/settings.rollback.json",
    "read_failure_policy": "abort the write and report; never proceed on an unreadable target",
    "file_mode_preservation": "stat() the original mode before write; chmod the rewritten file back to it"
  }
}
```

## See also

- `scripts/lib/risk-flags.mjs` — flag table + `impliedRiskFlags`/`effectiveRiskFlags` helpers
- `skills/route-workflow/references/lane-model.md` — design-tech skip-denial gate (AC-553-2)
- `schemas/plan-contract.schema.json` — JSON Schema documentation of these fields
