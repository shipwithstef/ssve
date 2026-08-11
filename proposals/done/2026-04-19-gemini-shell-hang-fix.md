# Framework Improvement: Gemini CLI Shell Hang Prevention

## Evidence
- **Source:** User report "there is something wrong with gemini and these scripts they always hang and say to tab to focus"
- **Finding:** Gemini CLI's pseudo-terminal (PTY) with `enableInteractiveShell: true` (default) causes commands that expect input to hang and wait for a "Tab" focus event.
- **Severity:** high (blocks automation and breaks flow)

## Diagnosis
- **Root cause:** Agentic scripts often use standard shell commands that may fallback to interactive prompts or TUI modes if not explicitly told otherwise. In a PTY environment like Gemini CLI, this triggers a "chat vs shell" focus toggle that the agent cannot autonomously navigate without user intervention.
- **Category:** fragility
- **Already in FRAMEWORK-STATE.md?** no (new finding)

## Implementation
- **Route:** quick-fix
- **Files changed:**
  - `GEMINI.md`: Added "Shell Interaction Guard" section.
  - `references/anti-patterns.md`: Added AP-26 "Implicit Shell Interaction".

## Replay Verification
- **Replay target:** `npx playwright test` without env vars (which previously triggered an interactive prompt/hang).
- **Result:** PENDING
- **Evidence:** TBD

## FRAMEWORK-STATE.md Mutations
- **Analysis History:** Added entry for Gemini CLI shell hang forensics.
- **Known Gaps:** N/A
- **Decisions:** Locked non-interactive shell defaults for Gemini CLI.
- **Capabilities:** N/A
