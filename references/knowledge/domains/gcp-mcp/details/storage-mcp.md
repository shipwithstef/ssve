# Area: Storage MCP Integration (`@google-cloud/storage-mcp`)

This package provides native GCS bucket and object management, including advanced BigQuery integrations.

## Mechanism
- **Safe vs Destructive Mode:** By default, initialization (`npx @google-cloud/storage-mcp init`) only enables **Safe Tools**. These tools can read data or create *new* objects, but will fail if an object already exists. Destructive tools (overwrite, delete, move, mutate labels) require explicit opt-in via `--enable-destructive-tools`.
- **Storage Insights Integration:** Includes unique tools to execute BigQuery SQL queries directly against Storage Insights datasets (`execute_insights_query`, `get_metadata_table_schema`). This allows an agent to perform complex analytical aggregations on an entire storage inventory without downloading the objects.
- **IAM Validation:** Agents can view IAM policies (`view_iam_policy`) and test specific permissions (`check_iam_permissions`) without needing broader IAM administrative roles.

## Analysis
- **Safety First:** The physical bifurcation of tools based on destructive potential is a mature pattern for AI agents. It prevents an agent from accidentally overwriting production data while trying to upload a file with a generic name (e.g., `config.json`).
- **Data Analytics:** The ability to query GCS metadata via BigQuery (Storage Insights) turns the MCP server from a simple file manager into a massive data-mining tool, highly suitable for data science agents.

## L4 Pointers
- `github.com/googleapis/gcloud-mcp/tree/main/packages/storage-mcp`