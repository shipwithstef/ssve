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
| `authorization_envelope` | free-form string, e.g. `staging: auto · prod: auto · live-payment: ask · landing-edit: ask · secrets: ask` | Declares per-domain default authorization once per session (§4c), so the run doesn't hand-write the same envelope in prose every turn. **Operative clause:** the executor stops only OUTSIDE the declared envelope — a domain marked `auto` proceeds without asking again. **Declarative only** — hook enforcement is deferred (follow-up WI); existing hard blockers (destructive ops, paid spend, cross-lane scope) still apply regardless of the envelope. |

Under `execution_mode: "end_to_end"`, natural continuations do not require confirmation. Verification-discovered gaps in the same problem domain should be filed and started automatically. Pause only for hard blockers, destructive blast radius, paid-spend thresholds, cross-lane scope expansion, or explicit user interjection.
