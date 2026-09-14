# Area: Agent & Dashboard Editor Integration (Resend MCP Server)

The `resend-mcp` server exposes internal, non-standard tools that allow AI agents to directly bridge into the Resend Dashboard's Visual Editor.

## Mechanism
- **TipTap JSON Sync:** Agents can use the `get-tiptap-json-content` tool to fetch the raw TipTap JSON structure and schema version of any Broadcast or Template directly from the Dashboard.
- **Agent Presence:** Tools like `connect-to-editor` trigger `createEditorConnection`. This generates a WebSocket/Presence room ID that places the Agent's avatar visually inside the web dashboard while it is generating or modifying the content.
- **Compose Workflows:** The `compose-broadcast` and `compose-template` tools accept modified TipTap JSON back from the LLM, updating the visual editor in real-time, and automatically terminating the presence connection via `disconnect-from-editor` when finished.

## Analysis
- **Beyond REST:** This is a breakthrough in Agent-UX interaction. Instead of just hitting a headless REST endpoint, the MCP server establishes a multi-player presence session, signaling to human marketers looking at the Resend Dashboard that an AI is currently drafting an email.
- **Structured Content:** By forcing the LLM to output valid TipTap JSON (assisted by passing the TipTap schema reference to the LLM) rather than arbitrary raw HTML, it ensures the resulting email remains 100% editable by humans in the drag-and-drop UI afterward.

## L4 Pointers
- `src/tools/editor.ts` (in `resend/resend-mcp`)
- `src/lib/resend-editor-client.ts`
