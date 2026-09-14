# Area: Google Agent Development Kit (ADK) & MCP

Google's **Agent Development Kit (ADK)** is a Python-based orchestration framework designed to build, deploy, and manage multi-agent systems using the Model Context Protocol.

## Mechanism
- **`MCPToolset`:** The core primitive in ADK for integrating external MCP servers. Rather than hardcoding tools into the prompt, ADK dynamically loads tools from a remote MCP endpoint using `StreamableHTTPConnectionParams`.
- **Authentication Handling:** ADK seamlessly marries GCP authentication with MCP. It uses the standard `google.auth` library to fetch OAuth tokens and automatically injects them into the HTTP headers (`Authorization: Bearer` and `x-goog-user-project`) of the MCP connection, solving the persistent issue of expiring GCP tokens for long-running agents.
- **Multi-Agent Orchestration:** You instantiate an `LlmAgent` (the root agent) and pass it an array of toolsets. For example, combining `maps_toolset` and `bigquery_toolset` allows the agent to autonomously formulate a plan that queries BigQuery for demographics and plots the coordinates via the Maps MCP in a single conversational loop.

## Analysis
- **Standardizing the Agent Loop:** ADK treats MCP not just as an IDE extension protocol, but as the fundamental tool-calling protocol for *production* agents deployed on Google Cloud. 
- **Streamable HTTP:** The explicit use of `StreamableHTTPConnectionParams` with high timeouts (`sse_read_timeout=300.0`) proves that Google's architecture relies on long-lived, streaming Server-Sent Event (SSE) connections over HTTP to manage stateful tool operations, rather than traditional short-lived stateless REST calls.

## L4 Pointers
- `github.com/google/mcp/tree/main/examples/launchmybakery/adk_agent`
- `google.adk.agents.LlmAgent`
- `google.adk.tools.mcp_tool.mcp_toolset.MCPToolset`