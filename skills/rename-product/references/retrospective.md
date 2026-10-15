# Retrospective template

Copy this to `docs/plans/<date>-<newname>-migration/evidence/retrospective.md` and fill every row. A blank outcome is a missing receipt, not a short phase.

## Time and outcome

| Phase | Lane 10 home | Started | Finished | Outcome |
|---|---|---|---|---|
| R | Phase 5b identity | | | |
| P0 | Phase 5a | | | |
| P1 | Phases 8–19 | | | |
| P2 | Runbook 1–2 | | | |
| P3 | Runbook 3 | | | |
| P4 | Runbook 4 | | | |
| H | Runbook 5 | | | |
| P5 | Phase 20+ | | | |
| P6 | Phase 5c, after production | | | |
| P7 | Phases 8–19, after the committed name | | | |
| P8 | After the session | | | |

Outcome is one of: done, deferred (reason), failed (reason). `deferred` on P5 means the frozen resources stayed in place because `retire-cloud-resources` has not run. It is not a successful retirement.

## Review

Reuse the `review-cross-model` findings and receipts for the releases in this programme. That skill selects the reviewer from the code author and the owner policy. Do not pick a reviewer here, and do not add numeric ratings.

| Artifact | Path |
|---|---|
| Findings | |
| Receipt | |

Write the observations those artifacts already support. Quote the finding or the receipt field. A same-family summary written for this table does not replace those artifacts.

## Missing receipts

List every phase whose evidence file or required field is absent. If nothing is missing, write the single line `None`.
