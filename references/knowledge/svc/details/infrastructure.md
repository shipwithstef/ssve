# svc Infrastructure — Detail

Source: scripts/, hooks/, provision/, test-framework/evals/
Extracted: 2026-04-08

## Installation (setup script)
Symlinks skills + infra into ~/.claude/skills/ (or equivalent per host).
Reads provision/hosts/<host>.json for capability-based install.
Five hosts supported: claude, codex, gemini, kimi, and opencode. Host profiles now also carry a `task_graph` contract block for task UI, background-task availability, skill-load mode, and any native task-read tools.

## Provisioning (provision/hosts/)
- claude.json: Full capabilities (skills, hooks, plugins, MCP, commands, agents). Lists all infra files and dirs to symlink.
- codex.json: Current Codex CLI capabilities for skills, plugins, MCP, commands, and agents; hooks remain unavailable.
- gemini.json: Gemini CLI capabilities for skills, MCP, commands, and agents, plus host-specific rule/policy files.
- kimi.json: Kimi CLI capabilities for skills, hooks, plugins, MCP, commands, and agents, plus KIMI.md host guidance.
- opencode.json: OpenCode CLI capabilities for skills, hooks (via TypeScript plugins), plugins, MCP, commands, and agents.

## Hooks (hooks/)
- hooks.json: Schema-conformant hook definitions for PreToolUse events plus an optional Stop completion guard.
- svc-workflow-guard.js: Two modes:
  1. Default: warns when Write/Edit targets files outside current skill's output paths
  2. --phase-boundary: warns when planning/spec files modified during execution
  Both are soft warnings (exit 0 always), never blocks.
- svc-task-completion-guard.sh: Optional Claude Stop hook. Reads `.svc/lane-tasks.json`, blocks stop only when actionable tasks remain, and treats `blocked` tasks as non-fatal.

## Scripts
- lint-skills-manifest.mjs: Validates 5 source-of-truth files agree (skills-manifest.json, README.md, EXTERNAL_ADDONS.md, REPO_MODES.md, route-workflow/SKILL.md). Checks includedSkills, corePackForRouting, laneDefinitions, bootstrapStartSequence.
- pipeline-log.mjs: Safe append helper for `.svc/pipeline-decisions.jsonl`.
- task-graph.mjs: Initialize, validate, inspect, and update `.svc/lane-tasks.json`, derive graph-level status, and record cross-host skill-load receipts before task completion.
- worktree.sh: Git worktree management — guard (check for existing), create (new branch), promote (merge back), cleanup.

## Test Framework Eval Infrastructure (8 scripts)

### Tier 1: Static Validation (no LLM, <10s)
1. **validate-skill-structure.sh** — Every SKILL.md has required frontmatter (name, description, inputs, outputs, chain), name matches directory, Pipeline Continuation section, Audit Mode for designated skills.
2. **validate-contracts.sh** — Input paths use valid patterns, outputs don't conflict, status transitions are valid lifecycle values, framework-level paths exist.
3. **validate-chain-references.sh** — Every chain prev/next references a real skill in includedSkills. Lane skill lists match chain positions.
4. **validate-self-verify-sections.sh** — Every skill with self_verify: true has a Self-Verify table with PASS/FAIL column.
5. **validate-worktree-safety.sh** — .gitignore has .worktrees/, scripts/worktree.sh exists.
6. **validate-framework-self-management.sh** — Cross-host task-graph contract, optional completion guard wording, and svc-on-svc routing policy remain aligned.
7. **validate-frontmatter-ast.mjs** — AST-based YAML parser + schema validation. Required fields with correct types, inputs/outputs nested structure, chain.lanes shape, boolean flags, duplicate keys.
8. **validate-markdown-ast.mjs** — AST-based heading tree parser + structure validation. H1 presence, heading nesting, self-verify table columns/rows, audit mode sections, announce patterns, cross-reference existence, empty sections.

### Tier 1.5: Skill Comprehension + Triggering (~5K tokens each)
- test-skill-comprehension.sh: Asks Claude factual questions about skill rules
- test-skill-triggering.sh: Sends naive prompts, verifies correct skill triggers

### Tier 2: Integration Scenarios (~50K tokens each)
8 scenarios: write-spec-greenfield, plan-changeset-manifest, validate-feature-validate, write-vision-create, mine-builder-eval, find-opportunity-eval, stage-revenue-eval, framework-self-improve-eval

### Tier 3: LLM-as-Judge
3 judge prompts: completeness (0-10), consistency (0-10), actionability (0-10)

### Autopilot
Full loop: worktree per scenario → all pipeline skills → live server → comparison → self-improvement.
References: autopilot-protocol.md, pressure-testing.md

## Framework Governance Files
- DOCTRINE.md (1173 lines): Full methodology — problem statement, 6 phases, progressive narrowing, safety gates, gate taxonomy, autorun mode, completeness principle, hard stops
- skills-manifest.json: 48 skills, 31 routing-core entries, 7 lanes with skill lists, bootstrap sequence
- REPO_MODES.md: bootstrap/convert/operate modes for different repo states
- EXTERNAL_ADDONS.md: Non-core skill pack listing
- FRAMEWORK-STATE.md: Living state — blend history, analysis history, known gaps, locked decisions

## L4 Pointers
- Setup script: ./setup
- Lint script: scripts/lint-skills-manifest.mjs
- Worktree script: scripts/worktree.sh
- Eval runner: test-framework/evals/run-all-evals.sh
- Hook source: hooks/svc-workflow-guard.js
