### Step 2.5: Concern Scan (load matching concern checklists)

The framework ships 100+ structured concern checklists in `concerns/` (routing
primitives, not skills). Before architecting, run the concern scanner against the
files this design will create or touch, so the technical design addresses the
matched subject-matter checklists (auth-surface, data-model-mutation,
paid-external-api, pii-handling, etc.) up front instead of being caught at review.

```bash
node <SKILLS_PATH>/scripts/scan-concerns.mjs \
  --project <repo-root> \
  --paths <planned-or-touched-files> --json
```

For each matched concern, open its `source_file` checklist and fold its
requirements into the relevant Technical Design section (Architecture, Data Model,
External Dependencies, Cost Model, Operations). CRITICAL/HIGH matches whose
`required_skills` name a specialist (e.g. `review-security`, `manage-finops`) must
be reflected as an explicit design decision or routed as a follow-on task — not
left implicit. This is the same helper `audit-implementation` runs in its Phase
0.6 Concern Coverage Check, so design-time and audit-time use one source of truth.
