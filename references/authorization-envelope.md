# Authorization envelope

An authorization envelope is an optional typed list on the latest session
contract. Each rule binds one exact `action`, `environment`, and `purpose` to a
decision. It is not a substitute for controller, sandbox, destructive-operation,
payment, or deployment guards.

```json
{"authorization_envelope":{"rules":[{"id":"staging-smoke","action":"deploy","environment":"staging","purpose":"verify-WI-123","decision":"allow"}]}}
```

Known outward adapters run through `scripts/svc-authorized-action.mjs exec`.
When a typed envelope exists, missing or non-exact tuples deny before the child
process starts. When the field is absent or retains the legacy prose-string
shape, current behavior is preserved. `record-stop` appends declared/used/unused
telemetry without granting or revoking authority.
