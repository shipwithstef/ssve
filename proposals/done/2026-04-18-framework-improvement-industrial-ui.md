# Framework Improvement: Industrial-Grade Masterclass UI

## Evidence
- **Source:** Absolute expertise session on Gemini CLI and Claude Design (2026-04-18).
- **Finding:** Three manual bottlenecks prevent 100% automated high-fidelity UI: (1) manual catalog registration for Claude Design, (2) post-hoc visual verification, and (3) unenforced W3C token compliance.
- **Severity:** high

## Diagnosis
- **Root cause:** The "Masterclass UI" patterns are currently codified as prose instructions (Step 1.5 in `design-ux`) rather than mechanical enforcement tools.
- **Category:** missing capability
- **Already in FRAMEWORK-STATE.md?** no (new)

## Implementation Plan
- **Route:** quick-fix (script + hook additions)

### 1. A2UI Catalog Generator
- **Action**: Create `scripts/generate-a2ui-catalog.mjs`.
- **Logic**: Use `react-docgen` or equivalent AST parser to extract component props from `src/components/ui/` and emit a valid A2UI Catalog JSON.

### 2. Automated Vibe Auditor (AfterTool Hook)
- **Action**: Create `hooks/svc-vibe-auditor.js`.
- **Logic**: Registered as an `AfterTool` hook in `settings.json`. If `tool_name === "write_file"` and path matches UI regex, trigger `track-visuals --mode diff` and report aesthetic score regression.

### 3. W3C Token Linter
- **Action**: Create `scripts/lint-w3c-tokens.mjs`.
- **Logic**: Scan diffs for hardcoded hex/px values. Cross-reference against `docs/specs/ui/tokens.json`. FAIL if a matching value is found in the token registry but was not used as a semantic variable.

## Replay Verification
- **Replay target**: Example Marketplace landing page implementation.
- **Goal**: Achieve 100% automated component registration, real-time drift blocking, and zero token violations.

## FRAMEWORK-STATE.md Mutations
- **Analysis History**: Added Industrial-Grade UI automation.
- **Decisions**: A2UI Cataloging and Token Linting are now mechanical invariants.
- **Capabilities**: Bumps skill count and adds "Mechanical UI Verification."
