## Verification Report

Compile:

- manifest reference
- sync-spec-code results
- AC coverage
- QA coverage
- E2E coverage
- responsive / viewport evidence coverage for browser-visible features
- multi-PR campaign sample seed, selected items, verification tier per item, and evidence paths when a campaign has three or more shipped items
- single_lane_summary with `verification_tier`, `sampled`, and evidence paths
  when the closeout has no PR list
- findings

## G7 Review

G7 checks:

- no unresolved critical/high drift
- AC coverage is complete or explicitly justified
- QA, E2E, and responsive evidence are current
- spec/journey state reflects what shipped

If G7 passes:

- feature status -> `VERIFIED` with confidence tier:
  - `VERIFIED-L1`: structural + visual + manual QA (human inspected pages in browser)
  - `VERIFIED-L2`: structural + visual (screenshots captured at desktop + mobile, visual diff reviewed)
  - `VERIFIED-L3`: structural assertions only (tests pass, build passes, no visual evidence)

  **For browser-visible features:** L3 is acceptable ONLY when visual verification is blocked by a documented, pre-existing issue (e.g., auth-gated pages untestable). The tier goes in the WI status: `**Status:** VERIFIED-L3 (no visual evidence — auth-gated pages untestable)`. This makes the confidence level transparent to non-technical stakeholders.

If G7 fails:

- route back based on failure type:
  - behavior bug -> `diagnose-bug` or execution/planning path
  - spec mismatch -> `write-spec`
  - journey mismatch -> `write-journeys`
