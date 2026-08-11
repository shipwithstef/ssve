# Area: Observability MCP Integration (`@google-cloud/observability-mcp`)

This package acts as a diagnostic bridge for AI agents to query Google Cloud's logging, monitoring, tracing, and error reporting systems.

## Mechanism
- **Log Querying:** Agents can list buckets, views, and scopes, and execute complex filters using `list_log_entries`.
- **Metrics & Monitoring:** Exposes `list_metric_descriptors`, `list_time_series`, and `list_alert_policies` to fetch telemetry data.
- **Tracing & Errors:** Directly pulls trace spans (`get_trace`, `list_traces`) and aggregates application crashes via `list_group_stats` (Error Reporting API).

## Analysis
- **Autonomous SRE:** When paired with a capable reasoning model, this MCP transforms a coding agent into an autonomous Site Reliability Engineer (SRE). Instead of the user pasting stack traces into the chat, the agent can autonomously query `list_group_stats` for recent crashes, fetch the associated logs via `list_log_entries`, and cross-reference latency spikes using `list_traces`.
- **Quota Requirement:** Requires a specific `quota-project` configured via `gcloud auth application-default set-quota-project` because these APIs heavily utilize background data processing.

## L4 Pointers
- `github.com/googleapis/gcloud-mcp/tree/main/packages/observability-mcp`