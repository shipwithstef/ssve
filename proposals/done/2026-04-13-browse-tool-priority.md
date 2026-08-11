---
Status: IMPLEMENTED (2026-04-13, commit cf3efc5)
---

# Framework Improvement: Browse Tool as Primary Browser Infrastructure

## Evidence
- **Source:** Live WI-032 dark mode validation on Example Marketplace — Playwright MCP burned ~15 tool calls to authenticate, navigate, and screenshot an E2E account that lacked the user's real data
- **Finding:** test-journeys and track-visuals listed Playwright MCP as #1 preferred tool, browse daemon as #2. browse-integration.md existed but showed Playwright tool names instead of actual browse CLI commands, and had no standalone setup instructions.
- **Severity:** medium (token waste + inability to validate with real user data)

## Diagnosis
- **Root cause:** browse-integration.md was written before the browse tool was battle-tested. Skills were updated to mention browse but not to prefer it.
- **Category:** inefficiency
- **Already in FRAMEWORK-STATE.md?** No (new finding)

## Implementation
- **Route:** direct SKILL.md edits (3 files)
- **Files changed:**
  - `references/browse-integration.md` — full rewrite: standalone setup (3 install options), actual CLI command reference, tool priority order
  - `test-journeys/SKILL.md` — browse as #1, Playwright as #2 fallback, browse CLI examples
  - `track-visuals/SKILL.md` — Playwright capture block replaced with browse CLI equivalents, `browse responsive` one-liner
- **Commits:** cf3efc5

## Replay Verification
- **Replay target:** browse daemon was used successfully for Example Marketplace Dashboard QA in the triggering session — login (3 commands), toggle verification, screenshot, all via `browse` CLI
- **Result:** PASS
- **Evidence:** Session demonstrated goto + fill + click + screenshot + js eval in ~8 commands vs ~15 Playwright MCP tool calls

## FRAMEWORK-STATE.md Mutations
- **Analysis History:** browse tool priority swap — browse-integration.md, test-journeys, track-visuals updated
- **Known Gaps:** N/A (new finding, fixed immediately)
- **Decisions:** browse tool is primary for agentic QA; Playwright MCP is fallback; write-e2e stays Playwright (generates .spec.ts code)
- **Capabilities:** browse-based QA is now a documented capability with setup instructions
