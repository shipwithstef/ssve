# Session Contract

`.svc/session-contract.jsonl` records the active session binding. The newest JSONL row is authoritative.

Required fields:

| Field | Meaning |
|---|---|
| `ts` | ISO-8601 timestamp |
| `bound_to` | `user-request`, `wi-backlog`, `framework-evolution`, or `framework` |
| `request` | Short summary of the user intent |
| `wi` | WI id or `null` |
| `skill` | Active routing skill or `null` |
| `guard_override_count` | Count of guard-directed context switches |

Optional policy field:

| Field | Values | Meaning |
|---|---|---|
| `execution_mode` | `normal` or `end_to_end` | `end_to_end` means the user has pre-authorized natural continuation until the scoped work is completed, blocked, or explicitly redirected. |
| `authorization_envelope` | `{rules:[{id,action,environment,purpose,decision}]}`; legacy strings remain compatible | Exact typed rules are enforced for known outward adapters by `scripts/svc-authorized-action.mjs`; outside or incomplete tuples deny before process launch. An absent or legacy string field preserves current behavior. Existing controller, destructive, paid-spend, and scope blockers still apply. |

At Stop, run `node scripts/svc-authorized-action.mjs record-stop --root <repo>` to append declared/used/unused envelope telemetry. This is observation only and never widens authority.

Under `execution_mode: "end_to_end"`, natural continuations do not require confirmation. Verification-discovered gaps in the same problem domain should be filed and started automatically. Pause only for hard blockers, destructive blast radius, paid-spend thresholds, cross-lane scope expansion, or explicit user interjection.
