# PR125 CI — 2026-10-04
- Fixed the recovery observation write with atomic JSON and included both missing HO1 source documents.
- Fixed uppercase/mixed-case script extraction for CodeQL alerts 23–26; added regression coverage, no suppressions or dismissals.
- Replaced the expired page-UX deferral with unfinished backlog ownership in WI-FW-PAGE-UX-REGISTRATION-01.
- Local: 131 orchestrator tests pass; all five initial full-sweep failures pass on recheck after fixes/cleanup and reduced test contention.
- [Hosted repair run](https://github.com/shipwithstef/ssve/actions/runs/37182226491): 402/402 free validators; all six PR checks green; zero open PR CodeQL alerts.
- Preserved unpublished local commits on feature/ho1-local-before-pr125-ci; fixes start at published head 39b4117.
- PR #125 remains unmerged; [current checks](https://github.com/shipwithstef/ssve/pull/125/checks).
