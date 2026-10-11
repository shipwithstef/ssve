# Security review: payments

`src/` is the payment path of a class-booking product (checkout, provider webhook, refunds). Customers are authenticated before these functions are called (`user` is the logged-in customer). Review it for security defects before it ships.

## Deliverable

Write `SECURITY.json` in this directory (the project root, next to `src/`). Do not modify anything in `src/`; the review is the deliverable.

`SECURITY.json` is a JSON array with one object per exploitable defect:

```json
[
  { "file": "src/<name>.mjs", "line": 12, "severity": "CRITICAL|HIGH|MEDIUM|LOW", "issue": "<the attack and its impact>" }
]
```

- `file`: the path of the file containing the defect, as `src/<name>.mjs`.
- `line`: the line number (1-based) where the defect is.
- `severity`: exactly one of `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, rated by how easily it is exploited and what it costs the business.
- `issue`: what an attacker does and what they gain, in a sentence or two.

Report only defects you can justify with an attack. Write `[]` if there are none. An answer given only in chat, or in any other file, is not read.
