# Retirement runbook

Additional deletion guards for `retire-cloud-resources`. Soak duration and the read-only source rule stay in Phase 5 of `skills/design-ui/templates/infra-cutover-runbook.md`. This file does not redefine them.

Exact resource ids live in a mode-0600 artifact outside the git worktree. Committed allow-lists, approvals, `retirement-report.json`, and `docs/specs/migrations/<slug>/decommission-receipt.md` store aliases, sha256 digests, and gate outcomes.

## Allow-list and protected list

The restricted entry has an exact `id`, a `kind`, an `alias` that is not that id, and `ownerProof`. The committed entry keeps `alias`, `sha256` of the id, and `kind`.

The protected list is the shared and neighbouring resources that must survive. Hash each protected value before the run and again after it. Store the hashes beside the exact ids, outside git. The committed report gets equality and the names of changes, never the values.

Unknown ids are kept. Record them as `keep_unknown`. Do not add them to the allow-list during the run.

When the cutover plan froze a pre-delete inventory, re-read it before apply. Drift aborts. That check is not a codebase sweep. `plan-changeset` owns source renames.

An allow-list that intersects the protected list aborts. An empty allow-list aborts.

One permitted difference is an explicit child removal, named in the plan before the run. Any other hash change aborts.

Strip volatile fields before hashing: etag, lastModified, provisioningState, systemData.

## Soak guards

Use the Phase 5 soak record as the window. Then apply these guards. Validate the window, the interval, the probe matrix, the old-app list, the metric contract, and the drain list before reading evidence rows.

| Guard | Fail closed when |
|---|---|
| Window | Duration or probe interval is missing or not positive. |
| Probes | The matrix is missing or empty, or any elapsed slot lacks a pass for every probe. A slot counts when `slot + interval <= window_end`, including the final fully elapsed slot. Zero checked slots is a miss. |
| Metrics | The cutover plan names the approved metrics, a non-negative inactivity threshold for each, and any substitution from a source name to an approved name. Hours are anchored at `window_start`, step one hour, and a shorter remainder is its own interval. A sample counts when `start <= at < end`, the app matches, the metric is approved or a listed substitution, and the value is at or below that threshold. A bool is not a value. `ok: true` or "healthy" is not a sample. Every approved metric for every old app must appear in each interval. |
| Unknown coverage | A missing row, an unknown metric, or a gap does not pass. Do not interpolate. |
| Drain | Every serving dependency named in the cutover plan has `drained: true` and non-empty evidence. Healthy and still serving is not drained. An empty drain list fails. |

Probe logs store timestamp, probe id, host, status, and pass or fail. Do not store bodies, tokens, or full URLs that carry secrets. When the probe is checking a redirect, do not follow the redirect automatically.

`--ignore-window` is allowed on a dry run only. It must refuse to combine with apply.

## Reference scan

Search, and abort if any query errors (non-zero CLI, auth expiry, throttling, timeout):

- app settings
- container app environment
- function apps
- key-vault references
- DNS records
- CI secrets
- IaC files

A failure is not "no references". Null is not an empty list. An empty list is a real empty result and must be handled on purpose. Before deleting a parent group, only a successful empty child list means the group is empty. A null or failed listing aborts.

Scan values in memory. Do not print secret values. A hit on a surviving resource aborts before that target is deleted. Repeat the scan immediately before each delete.

## Gone

Parse a provider error code from a parenthesized code, a leading `Code:` label, or a bare code. A target is gone only when the code is `ResourceNotFound`, `NotFound`, or `404`, and the stderr names the exact requested id on token boundaries. Return code 0 is not gone.

Reject account, subscription, authentication, authorization, and dependency errors, including `SubscriptionNotFound`, even when the text contains "could not be found". Unstructured "could not be found" without a target not-found code is not gone. Do not retry an ambiguous lookup into a success.

After a parent is deleted, wait for managed or child groups that the provider creates beside it. If one is still present when the wait ends, record an error and exit non-zero.

## Dry run and adversarial cases

1. Dry-run the same binary against live inventory. Apply stays off. Confirm the plan lists only allow-list targets, and that protected hashes were computed.
2. Run `python3 skills/retire-cloud-resources/references/deletion-gate.py` and require exit 0. The in-memory cases must fail closed for: an anchored hour with samples that leave the final interval uncovered, a nonpositive window or interval, an empty probe matrix, subjects rejected before evidence is read, `SubscriptionNotFound` and a not-found code for a different id, an approval with no approver or a different digest, a changed allow-list at apply time, a failed or missing gate, a missing-slot report that still serializes, and a committed payload that contains a resource id.
3. A case that returns success is a broken gate. Fix the gate before scheduling.

## Approval, backup, schedule

Irreversible work needs a recorded human approval before any timer is installed. Require a non-empty approver, `humanApproved: true`, a non-empty `approvedAt`, and `allowListSha256` equal to the sha256 of the canonical current allow-list. Compare that digest before scheduling and again before apply. A different hash, a missing approver, or a list that changed after approval aborts.

The committed approval stores the digest, not ids. Export configuration and templates to the mode-0600 backup before the first delete. Scheduling without that export aborts.

Run from a timer with a lock and an append-only log. After the scheduled time, read the log and the report. A missing report is a failed run.

## Post-delete

1. Prove each allow-list id is gone with a target not-found code for that exact id.
2. Recompute protected hashes. They match, except the one pre-declared child removal.
3. Smoke the new stack with the same probe matrix. A smoke failure is an error. Still run the protected comparison, then exit non-zero.
4. Write the sanitized report and the decommission receipt. Do not commit exact ids.
5. Disable the probe timer only after the report is written.

`ok` is true only when `seal` has checked every gate required for the mode and `errors` is empty. A failed gate, or a gate the mode requires but the report omits, becomes an error. Dry-run requires inventory, protected, soak, drain, references, and adversarial. Apply also requires approval, backup, gone, and smoke. `self-test` is only the in-memory template. Timestamps in the report are ISO 8601. A serialization or write failure exits non-zero.

## Deferred deletions

Some targets stay on purpose. Track them in `deferred-deletions.md` with the reason and the review date from the cutover plan. They are not leftovers to ignore.

| Example | Why it waits |
|---|---|
| Old staging auth | The cutover plan names the review date. This skill does not invent one. |
| Redirect-only host | Keep until every known dependent has moved. That is a separate explicit decision. |
| Shared parent account | Never in the allow-list. Only a proven child deployment is eligible. |

## Report and receipt

`docs/plans/<cutover>/retirement-report.json` (sanitized):

```json
{
  "mode": "dry-run",
  "ok": false,
  "gates": {},
  "deleted": [],
  "keep_unknown": [],
  "errors": [],
  "protected": {"unchanged": true, "changedNames": []},
  "postDeleteSmoke": {"ok": true},
  "deferred": []
}
```

`mode` is `dry-run`, `apply`, or `self-test`. A dry run that passes still has `deleted` empty. Deleted entries in the committed file use alias and sha256.

`docs/specs/migrations/<slug>/decommission-receipt.md` links that report and records mode and ok. It is the Lane 10 closeout artifact. Full identifiers stay in the restricted artifact.

## Provider notes

Delete exact allow-list ids in dependency order, then the empty group. A neighbouring account stays protected. Delete only this project's deployment inside a shared account. Read the deployment list explicitly: null aborts, empty means the deployment is already absent.

A project that still answers redirects is not an automatic delete. DNS records in a shared zone are protected unless the allow-list names that exact record and nothing else still resolves through it.
