# Replit Connectors & Integrations

## Mechanism
Replit provides three integration tiers: (1) Replit managed (built-in, no setup), (2) Connectors (OAuth-based, sign in once), (3) External integrations (API keys required). Since December 2025, MCP server support enables hundreds of additional tools via the Model Context Protocol.

## Analysis
- **Strength:** 30+ pre-built connectors cover the most common SaaS integrations
- **Strength:** AI provider integrations (OpenAI, Anthropic, etc.) require no API keys — billed to Replit credits
- **Strength:** MCP support means the connector ecosystem is now extensible to virtually any tool
- **Weakness:** Enterprise connectors (Salesforce, Snowflake) may require complex OAuth setup
- **Weakness:** Connector authentication can expire and needs reconnection

## L4 Pointers
- `docs.replit.com/replitai/integrations`
- `docs.replit.com/replitai/mcp/overview`
- `docs.replit.com/replitai/mcp/directory`
