# svc Infrastructure — Detail

Source: scripts/, hooks/, provision/, test-framework/evals/
Extracted: 2026-09-14 (WI-FW-ADVISOR-KNOWLEDGE-02 restamp)

## Installation (setup script)
Content-addressed, transactional installer (`./setup [--host <host>]` or `./setup --all-hosts`). Symlinks skills + infra into `~/.<host>/skills/` (or equivalent per host).
Reads `provision/hosts/<host>.json` for capability-based install.
Nine provisioned hosts supported: claude, kimi, codex, gemini, opencode, mimo-code, antigravity, cursor, and grok. Multi-host install protection enforces zero drift (`bash scripts/check-install-drift.sh --all-hosts`) and pre-commit multi-host checks (`hooks/svc-pre-commit-multi-host-check.sh`).

## Provisioning (provision/hosts/)
- `claude.json`: Full capabilities (skills, hooks across 28 events, plugins, MCP, commands, agents).
- `kimi.json`: Kimi CLI capabilities across 13 lifecycle events, hooks (TOML `[[hooks]]`), plugins, MCP, commands, agents.
- `codex.json`: Codex CLI capabilities with serialized PreToolUse dispatcher through the `svc-enforce` launcher (WI-529).
- `gemini.json`: Gemini CLI capabilities (11 events, strict pure stdout JSON `{decision:"deny"}`, millisecond timeouts).
- `opencode.json`: OpenCode CLI capabilities (6 events via TypeScript plugin API, in-process blocking).
- `cursor.json`: Cursor Agent capabilities (6 events: beforeSubmitPrompt, preToolUse, beforeShellExecution, afterFileEdit, sessionStart, stop; `~/.cursor/hooks.json`, exit-code-2 blocking, exact `cursor-grok-4.6-high` High independent review).
- `grok.json`: xAI Grok Build CLI capabilities (8 events, TOML `[[hooks.<Event>]]`, background tasks).
- `mimo-code.json`: MiMo Code capabilities via unified portable hook dispatcher.
- `antigravity.json`: Google Antigravity managed skills target and review station.

## Hooks & Runtime Enforcement Engine
- `hooks/lib/pretool-decision-engine.mjs`: Authoritative AST/argv decision engine. Classifies read-only commands (`git status`, `systemctl status`, `journalctl`) instantly without WI/lease locks; injects `--no-optional-locks`; enforces durable mutation authority v2 leases (`renewControllerIfCurrent`) before allowing file mutations.
- `scripts/svc-contained-exec.mjs`: Kernel-level Landlock filesystem sandbox isolating mutating child agent tasks across Claude, Codex, Gemini, Kimi, Cursor, and Grok.
- `hooks/svc-workflow-guard.mjs`: PreToolUse guard blocking edits to lockfiles, linter configs, or out-of-scope files with exit 2.
- `hooks/svc-workflow-guard.mjs --bash-guard`: PreToolUse guard blocking `--no-verify` or `--no-gpg-sign` bypasses and enforcing orchestrator commit trailers.
- `svc-task-completion-guard.sh`: Stop hook reading `.svc/lane-tasks-*.json` to prevent premature stops when actionable tasks remain.
- `svc-stop-quality.js`: Stop hook running batch formatting and typechecking on all session-modified files before exit.
- `svc-eval-gate-pre / post`: Hard blocks task completion without the 8-pillar evaluation matrix.

## Scripts
- `lint-skills-manifest.mjs`: Validates 5 source-of-truth files agree (skills-manifest.json, README.md, EXTERNAL_ADDONS.md, REPO_MODES.md, route-workflow/SKILL.md).
- `pipeline-log.mjs`: Safe append helper for `.svc/pipeline-decisions.jsonl`.
- `task-graph.mjs`: Manages `.svc/lane-tasks-<WI>.json`, derives graph-level status, and records cross-host skill-load receipts.
- `worktree.sh`: Git worktree management under `.worktrees/<branch>` (create, enter, status, promote, cleanup).
- `run-external-review.mjs` / `review-topology-v2.mjs`: Multi-model review orchestration with Cursor x-high transport (`cursor-grok-4.6-high`).
- `emit-receipt.mjs` / `svc-reconcile.mjs`: Emits and validates cryptographic chain receipts on `refs/notes/svc-receipts`.

## Test Framework Eval Infrastructure (329 shell + 41 .mjs validators)

### Tier 1: Static Validation (no LLM, <10s)
329 focused shell validators + 41 .mjs validators under `test-framework/evals/tier-1/`:
1. **validate-skill-structure.sh** — Every SKILL.md has required frontmatter (name, description, inputs, outputs, chain), name matches directory, Pipeline Continuation section.
2. **validate-contracts.sh** — Input paths use valid patterns, outputs don't conflict, status transitions are valid lifecycle values.
3. **validate-chain-references.sh** — Every chain prev/next references a real skill in includedSkills.
4. **validate-self-verify-sections.sh** — Every skill with self_verify: true has a Self-Verify table with PASS/FAIL column.
5. **validate-worktree-safety.sh** — `.gitignore` has `.worktrees/`, `scripts/worktree.sh` exists.
6. **validate-wi546-cursor-live-acceptance.sh** — Live acceptance for Cursor CLI x-high review station and hooks.
7. **validate-frontmatter-ast.mjs** / **validate-markdown-ast.mjs** — AST-based structural YAML and Markdown validation.

### Tier 1.5: Skill Comprehension + Triggering (~5K tokens each)
- `test-skill-comprehension.sh`: Asks host factual questions about skill rules.
- `test-skill-triggering.sh`: Sends naive prompts, verifies correct skill triggers.

### Tier 2: Integration Scenarios (~50K tokens each)
Scenarios across greenfield, brownfield, bugfix, drift, and journeys runtime testing.

### Tier 3: LLM-as-Judge
Judge scoring for completeness (0-10), consistency (0-10), actionability (0-10).

## Framework Governance Files
- `DOCTRINE.md`: Complete methodology documentation.
- `skills-manifest.json`: 105 skills, 59 routing-core entries, 7 lanes with skill lists, 26-step bootstrap sequence.
- `REPO_MODES.md`: bootstrap/convert/operate modes for different repo states.
- `EXTERNAL_ADDONS.md`: Non-core skill pack listing.
- `FRAMEWORK-STATE.md`: Living state — blend history, analysis history, known gaps, locked decisions.

## L4 Pointers
- Setup script: ./setup
- Lint script: scripts/lint-skills-manifest.mjs
- Worktree script: scripts/worktree.sh
- Eval runner: test-framework/evals/run-all-evals.sh
- Hook source: hooks/svc-workflow-guard.mjs
