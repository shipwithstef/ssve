# External review timeouts

The launcher gives each external reviewer process **30 minutes (1800 seconds)** by default. A terminal provider error can still end the review earlier. The launcher records the effective deadline, its source, and the lock stale period in `receipt.json` under `protocol`. When the launcher itself stops a process at its deadline, `protocol.terminal_reason` is `launcher_deadline`.

Set a persistent deadline for one host in the repository owner's reviewer policy:

```json
{
  "transport_options": {
    "grok": { "timeout_seconds": 1800 }
  }
}
```

The example is the current 30-minute default; choose a different positive integer up to 7200 seconds when needed. This field is accepted in both dispatch v1 and reviewer v2 policies. It affects only the selected host. For a single invocation, `SVC_EXTERNAL_REVIEW_TIMEOUT_SECONDS` takes precedence over the owner policy. Other hosts keep their own settings or the default.

The default lock stale period is at least twice the effective reviewer deadline plus 60 seconds. An explicit `SVC_EXTERNAL_REVIEW_LOCK_STALE_SECONDS` must meet that minimum; an insufficient value fails before a provider starts. Increasing the timeout does not increase the Claude dollar ceiling, Grok turn ceiling, or the three-round review-cycle cap. A timeout failure is not an approved review, and the launcher does not automatically start another independent review.
