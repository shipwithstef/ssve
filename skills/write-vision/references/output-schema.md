# Vision Sync Output Schema

Use this exact output frame for every run.

## 1) Proposed Changes

Provide section-level proposed edits in diff-like format.

Required fields per item:
- `Section`
- `Action` (`Add|Convert|Expand|Delete`)
- `What Was`
- `What Will Be`
- `Reason`
- `Meaning Loss` (required for `Delete`)

## 2) Evidence Table

Use this exact table:

| Claim | Evidence (path:line) | Evidence Type | Confidence | Conflict/Gap |
|---|---|---|---|---|
| ... | ... | shipped/documented/inferred | high/medium/low | ... |

Rules:
- Every major claim must map to at least one evidence row.
- Use `inferred` only when no direct shipped/documented evidence exists.
- If no conflict exists, set `Conflict/Gap` to `None`.

## 3) Open Questions

List only unresolved, decision-relevant questions.

For each question include:
- Why it matters to the vision
- Which source is missing or contradictory

## 4) Approval Gate

State exactly what is ready for application and what remains blocked.

Required fields:
- `Ready to apply`
- `Blocked until clarified`

Mode notes:
- In `mode=grounded`, proposals must stay evidence-backed.
- In `mode=scratch`, include assumptions and confidence, and avoid synthetic citations.
