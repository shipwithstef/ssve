# Domain: Google Cloud (GCP) MCP Ecosystem

## Area: Official Remote Managed Servers
- Google maintains fully managed remote MCP servers running on their infrastructure, connectable via HTTP/SSE.
- Covered services: BigQuery, Cloud SQL, Spanner, AlloyDB, Bigtable, Firestore, GCE, GKE, Cloud Run, and Chronicle (SecOps).

## Area: The gcloud-mcp Monorepo
- The `googleapis/gcloud-mcp` repository is actually a monorepo containing multiple specialized local servers.
- **`gcloud-mcp`:** Core CLI proxy. Uses a strict `denylist.ts` to block interactive/destructive commands while translating natural language to CLI execution.
- **`storage-mcp`:** GCS management. Explicitly bifurcates tools into "Safe" (read/write-new) and "Destructive" (overwrite/delete) requiring an opt-in flag. Includes BigQuery Storage Insights.
- **`observability-mcp`:** SRE diagnostics. Exposes Cloud Logging, Monitoring, Tracing, and Error Reporting (group stats) for autonomous troubleshooting.
- **`backupdr-mcp`:** Backup & Disaster Recovery. Allows agents to discover protectable VMs/SQL, associate backup plans, and trigger restorations.

## Area: MCP Toolbox for Databases (`mcp-toolbox`)
- A Go-based dual-purpose framework (`googleapis/mcp-toolbox`, formerly `genai-toolbox`).
- Serves as both a ready-to-use prebuilt generic server for database exploration (Cloud SQL, Spanner, AlloyDB) and a Custom Tools Framework for writing secure, parameterized NL2SQL tools for production deployment on Cloud Run.

## Area: Agent Development Kit (ADK)
- Google's official Python orchestration framework for building production agents.
- Uses `MCPToolset` with `StreamableHTTPConnectionParams` to dynamically bind remote HTTP/SSE MCP servers to a root `LlmAgent`.
- Automatically handles Google OAuth token refreshing natively inside the MCP HTTP headers.

## Area: Deployment & Enterprise Discovery
- **Cloud Run Hosting:** Google's recommended architecture for remote MCP hosting, fully supporting HTTP Server-Sent Events (SSE).
- **Cloud API Registry (Beta):** Enterprise teams can discover organization-wide MCP servers using `gcloud beta api-registry mcp servers list --all`.