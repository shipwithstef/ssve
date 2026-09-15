# Simulation — WI-FW-TWO-BOX-01 (analysis only; no tests executed)

Parent materialized prior draft files; this revision is design correction after RD01–RD12. Implementation files are still unedited. Zero tests run. Not PASS evidence for AC16–AC18. RD12: pre-existing full-baseline failures remain baseline and are not manufactured green.

## Denominator

| Census | Count |
|---|---|
| ACs | 18 |
| Binding decisions | 10 |
| RD findings corrected in design | 12 |
| Auto-research consumers | 16 |
| Hosts | 9 |
| Implementation tasks | 7 |
| Tests run | 0 |
| Live canaries | 0 |
| Paid reviews this conversion | 0 |

## Disk

MODIFY targets exist on base. CREATE runners/tests/snapshot do not exist on base. This conversion still does not create implementation files.

Installed Codex help (parent-reviewed 2026-09-15) supports --sandbox read-only, not --read-only. Draft four-flag isolation is withdrawn.

## Planned walk

T1 AC01 docs; T2 isolation/roles/scouts; T3 v5+v2 package including review-inputs and freeze-bootstrap; T4 AC09; T5 predicate+resume; T6 learning; T7 tests/evals/install docs. T4 blocked_by T5. T7 blocked_by T1–T6. CREATE files listed in Files Planned. No runtime walk.

## External state

Touched: 1 install after promotion; 3 git-common-dir store; 12 schemas/skills/registries; 15 runtime objects/tmp. Untouched: 2 (must not write ~/.codex or dispatch-policy), 4,5,6,7,8,8,10,11,13,14. Environment 2 decoupled-justified: owner policy remains outside repo; fail-closed isolation detects missing capability.
