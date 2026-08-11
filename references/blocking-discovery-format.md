# Blocking Discovery Halt Protocol

`BLOCKING_DISCOVERY` is a verification-time signal. A verifying skill emits it
when the current WI cannot be honestly marked `VERIFIED` because the run found
an upstream or current behavior defect, missing capability, unsafe path, or
wrong-lane condition that changes the required workflow.

It is not an ordinary failed assertion, flaky test, incomplete AC row, or local
test harness problem. Use the normal skill report for those. Use
`BLOCKING_DISCOVERY` only when continuing the parent verification would create a
false green.

## Emitters

The following skills may emit this signal:

| Skill | Emit when |
|---|---|
| `write-e2e` | A real runtime failure proves the app path is broken or unimplemented and the test cannot pass without a workaround. |
| `test-journeys` | Journey execution finds a behavioral blocker that prevents honest AC validation. |
| `verify-promotion` | Post-merge/runtime verification finds a production or promoted-state blocker. |
| `audit-implementation` | An audit finding blocks the parent WI from being correctly verified; informational findings stay in the audit report. |
| `review-security` | A security finding makes the shipped or proposed path unsafe to verify. |

## Artifact

Write a machine-readable artifact at:

```text
.svc/blocking-discovery-<parent-WI>.json
```

Required shape:

```json
{
  "schema": 1,
  "signal": "BLOCKING_DISCOVERY",
  "parent_wi": "WI-053",
  "source_skill": "write-e2e",
  "discovered_during": "self-verify",
  "blocker_summary": "Real backend returns 401 during employee creation.",
  "evidence_artifacts": [
    {
      "type": "command_output",
      "path": ".svc/write-e2e-test-run.log",
      "summary": "atomicEmployeeCreate returned 401"
    }
  ],
  "routing": {
    "recommended_skill": "diagnose-bug",
    "reason": "Runtime defect blocks verification of the parent WI.",
    "no_prelocked_fix": true
  },
  "parent_state": "BLOCKED_ON_DISCOVERY",
  "follow_up_wi": "WI-054"
}
```

If the follow-up WI has not been filed yet, use
`"follow_up_status": "needs-wi"` instead of `follow_up_wi`.

## Procedure

1. Emit `.svc/blocking-discovery-<parent-WI>.json`.
2. Validate it with `node scripts/validate-blocking-discovery.mjs --artifact <path>`.
3. Emit `skill_outcome` with mutation action `block_on_discovery`.
4. Mark the parent WI state as `BLOCKED_ON_DISCOVERY` once the follow-up WI is
   known, e.g. `BLOCKED_ON_DISCOVERY: WI-054`.
5. Route the follow-up WI into the recommended skill. Runtime symptom blockers
   enter `diagnose-bug` in symptom-only form and must not pre-lock a fix.
6. Do not mark the parent `VERIFIED` until the follow-up WI is resolved and the
   parent verification reruns without workaround evidence.

## Skill Outcome Example

```json
{
  "skill_outcome": {
    "skill": "write-e2e",
    "status": "blocked",
    "signals_added": ["BLOCKING_DISCOVERY"],
    "artifacts_produced": [".svc/blocking-discovery-WI-053.json"],
    "validator_proof": "node scripts/validate-blocking-discovery.mjs --artifact .svc/blocking-discovery-WI-053.json",
    "graph_mutations_requested": [
      {
        "action": "block_on_discovery",
        "target": "diagnose-bug",
        "signal": "BLOCKING_DISCOVERY",
        "artifact": ".svc/blocking-discovery-WI-053.json",
        "follow_up_wi": "WI-054",
        "reason": "Runtime defect blocks honest parent verification.",
        "validator_proof": "blocking-discovery validator PASS"
      }
    ],
    "closeout_impact": "blocked"
  }
}
```
