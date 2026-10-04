# PR125 CI — 2026-10-04
- Fixed the recovery observation write with atomic JSON and included both missing HO1 source documents.
- Fixed uppercase/mixed-case script extraction for CodeQL alerts 23–26; added regression coverage, no suppressions.
- Replaced the expired page-UX deferral with unfinished backlog ownership in WI-FW-PAGE-UX-REGISTRATION-01.
- Local: 131 orchestrator tests pass; initial full sweep 397/402 (timing failure, two timeouts, residue and expired triage); affected rechecks underway.
- Hosted checks and PR CodeQL alerts: pending verification of the repaired PR head.
- Preserved unpublished local commits on feature/ho1-local-before-pr125-ci; fixes start at published head 39b4117.
- PR #125 remains unmerged.
