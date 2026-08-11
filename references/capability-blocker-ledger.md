# Capability Blocker Ledger

Capability blocker diagnosis is a pre-implementation gate, not a replacement
for the lane task graph. `.svc/lane-tasks-<WI>.json` remains the execution
source of truth; `.svc/capability-blockers.jsonl` records blocker evidence and
recovery history so later sessions do not rediscover the same gap.

## Location

```text
.svc/capability-blockers.jsonl
```

One JSON object per line.

## Entry Schema

```json
{
  "schema": 1,
  "ts": "2026-05-12T04:00:00.000Z",
  "source": "route-workflow",
  "state": "detected",
  "blocker_id": "missing-product-capability",
  "route_to": "validate-feature",
  "owner_skill": "validate-feature",
  "matched_signals": ["missing capability"],
  "diagnosis": "Validate or rescope the feature dependency before writing implementation tasks.",
  "registry": "references/capability-blockers.json",
  "wi": "WI-123",
  "source_text": "blocked by missing capability: provider has no api",
  "evidence": ["docs/specs/features/example.md:42"]
}
```

Required fields: `schema`, `ts`, `source`, `state`, `blocker_id`, `route_to`,
`owner_skill`, `matched_signals`, and `diagnosis`.

Allowed `state` values:

| State | Meaning | Extra Required Fields |
|---|---|---|
| `detected` | Blocker detected and should be routed before implementation | none |
| `routed` | Matching owner skill/task was inserted into the lane graph | none |
| `recovered` | Blocker was resolved by a concrete recovery attempt | `recovery_attempts[]` with `action`, `result`, and `evidence[]` |
| `blocked-on-user` | Recovery cannot continue without user-owned input | `blocked_on` |
| `false-positive` | Diagnosis was reviewed and rejected | `false_positive_reason` |

## Commands

Detect and append a ledger entry:

```bash
node scripts/diagnose-capability-blocker.mjs \
  --text "<latest request or blocker>" \
  --ledger .svc/capability-blockers.jsonl \
  --state detected \
  --source route-workflow \
  --wi WI-123
```

Validate the ledger:

```bash
node scripts/validate-capability-blocker-ledger.mjs \
  --ledger .svc/capability-blockers.jsonl
```

## Routing Contract

When `route-workflow` or a preflight detects a capability blocker:

1. Append a ledger row with `state: "detected"` and the matched registry class.
2. Route by `route_to` into the lane task graph or log a false-positive row.
3. If routed, append a `state: "routed"` row with the same `blocker_id`.
4. When resolved, append `recovered`, `blocked-on-user`, or `false-positive`.
5. Validate the ledger before closing the WI or claiming the blocker is handled.
