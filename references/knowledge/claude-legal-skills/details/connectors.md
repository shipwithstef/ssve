# Claude Legal Skills - MCP Connectors

## 1. Mechanism

The `CONNECTORS.md` documentation specifies over 20 Model Context Protocol (MCP) integrations that serve as data sources and action routes for the legal skills.

- **Communication & Productivity**:
  - Slack and MS Teams (Chat context extraction)
  - Gmail and MS 365 Outlook (Email threads context)
  - Google Calendar and MS 365 Calendar (Meeting briefing context)
- **File Management**:
  - Box, Egnyte, Dropbox, Google Drive, OneDrive
- **Specialized Business/Legal Software**:
  - **CLM**: Ironclad, Agiloft
  - **CRM**: Salesforce, HubSpot
  - **E-signature**: DocuSign, Adobe Sign
  - **Legal specific platforms**: Thomson Reuters (Westlaw), Lexis+, and Free Law Project (CourtListener).

## 2. Analysis

The MCP connectors are what transforms the legal skills from static generators into active assistants. For example, the `vendor-check` skill can pull the MSA from Ironclad, the emails from Gmail, and the current usage status from Salesforce simultaneously. This dramatically accelerates discovery workflows that previously required manual cross-system checking.

## 3. L4 Pointers
- `vendor-check` CLM integrations
- Ironclad and Agiloft connection details
- Thomson Reuters / Lexis+ MCP server configurations