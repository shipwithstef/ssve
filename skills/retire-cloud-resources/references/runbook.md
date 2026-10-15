# Retirement runbook

Checklists and the report shape for `retire-cloud-resources`. Examples are generic. Substitute this project's ids. Never paste a subscription id, tenant, secret, or private hostname into the committed report.

## Allow-list and protected list

Each allow-list entry needs:

| Field | Rule |
|---|---|
| `id` | Exact provider resource id. A name or a name prefix is not enough. |
| `kind` | Group, app, deployment, DNS record, Pages project, Access app, storage account, secret, or other. |
| `ownerProof` | Where this project was shown to own it: inventory export, tag, or IaC address. |

The protected list is the shared and neighbouring resources that must survive. Hash each protected value before the run and again after it. Store the hashes in a mode-0600 file outside the git worktree. The committed report gets equality and the names of changes, never the values.

Unknown ids are kept. Record them as `keep_unknown`. Do not add them to the allow-list during the run.

When the cutover plan froze a pre-delete inventory, re-read it before apply. Drift aborts. That check is not a codebase sweep. `plan-changeset` Migration / sweep owns source renames.

An allow-list that intersects the protected list aborts. An empty allow-list aborts.

One permitted difference is an explicit child removal, named in the plan before the run. Example: a shared model account stays; only the deployment `oldname-mini` that belonged to this project is removed. Any other hash change aborts.

Strip volatile fields before hashing: etag, lastModified, provisioningState, systemData.

## Soak window

Health probes of the new stack run on a fixed interval for the whole window. A slot counts only when every probe in the matrix passed.

Include every slot whose interval has fully elapsed, including the final slot. The failing condition is `slot < window_end - interval`, which never inspects the last slot. The holding condition is `slot + interval <= last`.

Zero-traffic or healthy metrics are required for every old app, each hour of the window. One quiet app says nothing about another. An hour counts only when the set of passing metric subjects includes every old app.

A missing row is a failure. Do not fill gaps by interpolation.

If the metric name you hoped for does not exist, record the metrics the provider actually exposes and require a passing sample of those, every hour, for every old app. Absence of one metric name is not a reason to skip the hour.

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

A failure is not "no references". Null is not an empty list. An empty list is a real empty result and must be handled on purpose: for example an empty deployment list means the named deployment is absent. Before deleting a parent group, only a successful empty child list means the group is empty. A null or failed listing aborts.

Scan values in memory. Do not print secret values. A hit on a surviving resource aborts before that target is deleted. Repeat the scan immediately before each delete, because a new reference can appear during the run.

## Gone

A target is gone only when the read returns an explicit not-found signal such as `ResourceNotFound` or `could not be found`. Any other non-zero result means the lookup is ambiguous. Stop. Do not retry into a success.

After a parent is deleted, wait for managed or child groups that the provider creates beside it. If one is still present when the wait ends, record an error and exit non-zero. Do not downgrade it to a warning.

## Dry run and adversarial cases

1. Dry-run the same binary against live inventory. Apply stays off. Confirm the plan lists only allow-list ids, and that protected hashes were computed.
2. Run `python3 skills/retire-cloud-resources/references/deletion-gate.py` and require exit 0. That process uses doctored in-memory inputs:
   - a probe gap in the final slot
   - a metric hour where one old app is missing
   - a reference read that returns non-zero
   - an ambiguous lookup (auth or throttle text, or a null list) that must not count as gone
3. Each case must fail closed. A case that returns success is a broken gate. Fix the gate before scheduling.

## Approval, backup, schedule

Irreversible work needs a recorded human approval before any timer is installed. The record includes who approved, when, and the sha256 of the canonical allow-list.

Export configuration and templates (provider export or the IaC that created the targets) to the mode-0600 backup before the first delete.

Run from a timer with a lock and an append-only log. After the scheduled time, read the log and the report. A missing report is a failed run.

## Post-delete

1. Prove each allow-list id is gone with an explicit not-found signal.
2. Recompute protected hashes. They match, except the one pre-declared child removal.
3. Smoke the new stack with the same probe matrix. A smoke failure is an error. Still run the protected comparison, then exit non-zero.
4. Commit the report. It contains ids, kinds, gate results, and hash equality. It does not contain secret values.
5. Disable the probe timer only after the report is written.

## Deferred deletions

Some targets stay on purpose. Track them in `deferred-deletions.md` with the reason and the review date. They are not leftovers to ignore.

| Example | Why it waits |
|---|---|
| Old staging auth | Keep about 30 days so a rollback path and private preview checks still exist. |
| Redirect-only host | Keep until every known dependent has moved. That is a separate explicit decision, not a calendar default. |
| Shared parent account | Never in the allow-list. Only a proven child deployment is eligible. |

## Report shape

`docs/plans/<cutover>/retirement-report.json`:

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

`mode` is `dry-run` or `apply`. `ok` is true only when `errors` is empty. A dry run that passes still has `deleted` empty.

## Provider notes

Azure-shaped estate: delete exact ids in a resource group such as `rg-oldname-prod` (apps, plans, storage, then the empty group). A consumer email app's old function apps go on the allow-list. A neighbouring team's model account does not. Delete only this project's deployment inside that account. Read the deployment list explicitly: null aborts, empty means the deployment is already absent.

Cloudflare-shaped estate: a Pages project that still answers redirects is not an automatic delete. An Access app in front of old staging is a deferred target. DNS records in a shared zone are protected unless the allow-list names that exact record and nothing else still resolves through it.
