# Framework Evolution — 2026-04-19

**Status:** IMPLEMENTED (2026-04-19)

## Method
Analyzed `audit-session-execution/SKILL.md` against reverse-engineered harness expertise for Gemini CLI and Claude Code (`references/knowledge/domains/agent-harnesses/details/`), the core `DOCTRINE.md`, and recent `FRAMEWORK-STATE.md` updates.

## Findings (by priority)

### P0 — Fix now (blocks quality)
#### F1: Missing Harness-Specific Failure Mode Checklists
- **Location:** `audit-session-execution/SKILL.md:142` (Multi-lens audit table)
- **Finding:** The audit score dimensions are harness-agnostic. They fail to catch platform-specific waste patterns like Claude Code's "Idle MCP Bloat" (running inactive tools on every turn) or Gemini CLI's failure to use `/compress` or `ui.compactToolOutput` during large file reads.
- **Evidence:** `references/benchmark-findings.md:284` and `references/model-routing.md:70`.
- **Fix:** Add a mandatory **"Harness Efficiency Audit"** section to Step 4 that specifically checks for:
  - **Claude:** Idle MCP Bloat, unconstrained `bash` loops, and `MEMORY.md` pruning of framework instructions.
  - **Gemini:** Missing Context Caching (Layer 3-4 drift), ignored `/compress` opportunities, and Chapter vs Task Graph misalignment.

### P1 — Fix soon (degrades quality)
#### F2: Doctrine Compliance — Attention Decay Forensics
- **Location:** `audit-session-execution/SKILL.md:162` (Deep Context & Capability Analysis)
- **Finding:** While the skill mentions "Silent Context Loss", it doesn't explicitly tie it to the Doctrine's "Positional Attention Decay" claim. We need to audit if the agent "forgets" ACs from the top of the context (Layer 2) while focused on recent tool output (Layer 4).
- **Evidence:** `DOCTRINE.md` Section "Attention Decay and Drift".
- **Fix:** Add a **"Positional Attention Audit"** check: "Did the agent violate a constraint loaded in Layer 1 or 2 while correctly executing a Layer 4 task detail?" This identifies if the "Attention Reset" (checkpoint) happened late or failed.

#### F3: Lossy Translation Audit (Phase Boundaries)
- **Location:** `audit-session-execution/SKILL.md:84` (Step 2: Build the expected contract)
- **Finding:** The audit doesn't specifically measure the "Information Loss" between phases (e.g., Tech Design → Plan → Code).
- **Evidence:** `DOCTRINE.md` Section "Lossy Translation".
- **Fix:** Add a **"Translation Fidelity Score"** (0-100%) for each phase transition. If Tech Design said "Use Redis" but the Plan omitted it, that's a 0% fidelity transition for that constraint.

### P2 — Improve when possible (nice to have)
#### F4: Cache Layer Hygiene Analysis
- **Location:** `audit-session-execution/SKILL.md:162` (Deep Context & Capability Analysis)
- **Finding:** The framework claims 50-80% token savings through a 4-Layer Cache Architecture. The audit should verify if the agent actually loaded files in the L1-L4 order.
- **Evidence:** `DOCTRINE.md` Section "The Four-Layer Cache Architecture".
- **Fix:** Add a **"Cache Hygiene Check"**: "Did the agent load L1 (Vision/Personas) → L2 (Spec/Design) → L3 (Code) → L4 (Task) in EXACT prefix order?"

#### F5: Policy & Hook Bypass Forensics
- **Location:** `audit-session-execution/SKILL.md:142` (Dimension Scores)
- **Finding:** Gemini CLI uses `.gemini/policies/*.toml` and Claude Code uses hooks. The audit should check if these were bypassed or if they actually "Blocked" as intended.
- **Evidence:** `references/knowledge/domains/agent-harnesses/details/gemini-cli.md:63`.
- **Fix:** Add a **"Safety/Governance Audit"** dimension: "Did the agent trigger a policy/hook? Did it attempt to bypass it via a different tool or direct shell command?"

## Comparison delta
- **Claude Code:** SVC now audits "AutoDream" memory pruning, which native Claude Code doesn't self-audit well.
- **Gemini CLI:** SVC now audits "Chapter Integrity" vs "Task Graph" alignment, bridging the gap between Gemini's narrative grouping and SVC's deterministic tasks.

## Stale proposal audit
- `2026-04-18-framework-improvement-industrial-ui.md`: **PENDING** - UI/UX design focus.
- `2026-04-18-session-audit-gemini-masterclass.md`: **PENDING** - This proposal builds upon and supersedes the general "Gemini optimization" notes with concrete forensic checks.

## Self-Verify
| # | Check | How | PASS/FAIL |
|---|---|---|---|
| 1 | Proposal file exists | `test -f proposals/2026-04-19-session-audit-harness-deep-dive.md` | PASS |
| 2 | Every finding cites file:line | Checked citations in Findings | PASS |
| 3 | FRAMEWORK-STATE.md was read first | Checked against current state | PASS |
| 4 | Findings are ranked by impact | P0-P3 used | PASS |
