# Area: Remote Managed MCP Servers

Google hosts and manages remote MCP servers for high-value enterprise services, eliminating the need for local Node.js proxies.

## Mechanism
- **Direct HTTP Connection:** These servers do not run locally via `stdio`. They run on Google infrastructure (e.g., Cloud Run) and the agent connects to them securely over HTTP (Server-Sent Events).
- **Supported Managed Services:** 
  - **Databases:** AlloyDB, BigQuery, Bigtable, Cloud SQL (MySQL/PostgreSQL/SQL Server), Spanner, Firestore.
  - **Compute:** Compute Engine (GCE), Kubernetes Engine (GKE), Cloud Run.
  - **Security & Data:** Security Operations (Chronicle), Google Maps (Grounding Lite), Google Developer Knowledge API.
- **Enterprise Hosting:** Organizations can host their own private tools as Remote MCPs using Google's "MCP Toolbox for Databases" and deploy them to Cloud Run or GKE in under 10 minutes.

## Analysis
- **Zero-Footprint Extensibility:** By shifting the MCP server to Google's managed endpoints, the local environment doesn't need to install extensive SDKs. The agent communicates directly with the cloud service's reasoning layer.
- **Data Governance:** Remote servers allow enterprise IT to enforce VPC Service Controls, IAM, and audit logging on the MCP server itself, tightly governing what an AI agent can do.

## L4 Pointers
- `github.com/google/mcp`
- `googleapis.github.io/genai-toolbox`