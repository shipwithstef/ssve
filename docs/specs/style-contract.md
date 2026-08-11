# Code Style Contract

**Generated:** 2026-04-10
**Source:** codebase analysis
**Tech Stack:** Markdown-first skill/spec repo with Node.js CLI helpers (`.mjs` and targeted `.js`), Bash hooks/eval runners, and JSON host/config files

## Scope

This contract reflects the conventions already present in the repo sections
that matter for implementation work:

- `scripts/*.mjs`
- `hooks/*.js` and `hooks/*.sh`
- `test-framework/evals/**/*.sh` and `test-framework/evals/**/*.mjs`
- `provision/hosts/*.json` and `hooks/hooks.json`
- `<skill>/SKILL.md` and `docs/specs/**/*.md`

Representative files reviewed:

- [scripts/pipeline-log.mjs](/workspace/seriousvibecoding/scripts/pipeline-log.mjs)
- [scripts/task-graph.mjs](/workspace/seriousvibecoding/scripts/task-graph.mjs)
- [scripts/lint-skills-manifest.mjs](/workspace/seriousvibecoding/scripts/lint-skills-manifest.mjs)
- [hooks/svc-workflow-guard.js](/workspace/seriousvibecoding/hooks/svc-workflow-guard.js)
- [hooks/svc-task-completion-guard.sh](/workspace/seriousvibecoding/hooks/svc-task-completion-guard.sh)
- [test-framework/evals/tier-1/validate-framework-self-management.sh](/workspace/seriousvibecoding/test-framework/evals/tier-1/validate-framework-self-management.sh)
- [test-framework/evals/tier-1/validate-markdown-ast.mjs](/workspace/seriousvibecoding/test-framework/evals/tier-1/validate-markdown-ast.mjs)
- [write-spec/SKILL.md](/workspace/seriousvibecoding/write-spec/SKILL.md)
- [hooks/hooks.json](/workspace/seriousvibecoding/hooks/hooks.json)
- [provision/hosts/codex.json](/workspace/seriousvibecoding/provision/hosts/codex.json)

## Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Script files | kebab-case | `pipeline-log.mjs` |
| Hook files | `svc-` prefix + kebab-case | `svc-task-completion-guard.sh` |
| Skill directories | kebab-case directory containing `SKILL.md` | `write-spec/SKILL.md` |
| Functions | lowerCamelCase | `parseArgs`, `loadSkillOutputPaths`, `require_contains` |
| Constants | UPPER_SNAKE_CASE | `VALID_TYPES`, `REPO_ROOT`, `PLANNING_PATTERNS` |
| JSON keys | snake_case for persisted machine fields, lowerCamelCase only when external schema already uses it | `run_id`, `decided_by`, `builder_profile_path` |
| Markdown specs/docs | kebab-case file stems for feature/topic artifacts | `feature-discussion-phase.md`, `J01-discussion-proceed.feature.md` |
| Test files | `validate-*`, `run-*`, or scenario-specific kebab-case under `test-framework/evals/` | `validate-framework-self-management.sh` |
| Types/Interfaces | not currently a repo-level TS pattern; when schema names appear in docs they use PascalCase nouns only in prose labels, not code identifiers | `Feature`, `Enabler` |

## File Structure Patterns

- Node helpers live in `scripts/` and are small CLI programs, usually one file
  per focused contract.
- Workflow hooks live in `hooks/`; shell hooks block or guard, `.js` hooks warn
  or inspect tool input.
- Skill contracts live in `<skill>/SKILL.md` with YAML frontmatter first, then a
  single H1 title and structured sections.
- Spec artifacts live under `docs/specs/` by artifact family:
  `features/`, `journeys/`, `decisions/`, `explorations/`, and future
  topic-scoped directories such as `discussions/`.
- Host/runtime configuration is stored as formatted JSON under
  `provision/hosts/` and `hooks/`.
- Tests are repo-native validation scripts under `test-framework/evals/`; they
  are grouped by tier and mostly use shell entrypoints with small Node helpers.

## Import Style

- `.mjs` files use ESM imports with built-in modules referenced via the
  `node:` prefix.
- `.js` hook scripts use CommonJS `require(...)` when they need broad,
  standalone Node compatibility.
- Imports are grouped simply: Node built-ins first, then local relative imports
  if needed. This repo does not use alias imports.
- String literals in code use double quotes consistently in the sampled Node
  files.
- Statements in Node source end with semicolons.
- CLI scripts resolve paths explicitly with `path.resolve`, `path.join`, or
  `fileURLToPath(import.meta.url)` rather than relying on implicit cwd magic.

## Test Patterns

- Framework: shell-first repo validation, centered on `test-framework/evals/`
  plus targeted Node validators.
- Structure: each shell test starts with `#!/usr/bin/env bash` and
  `set -euo pipefail`, computes `REPO_ROOT`, and uses small assertion helpers or
  PASS/FAIL counters.
- Assertion style:
  - shell tests prefer `grep`, explicit helper functions, and exit-code checks
  - Node validators prefer explicit `ok()` / `bad()` style accounting or
    immediate `die(...)` / `process.exit(1)` on invalid input
- Mock strategy: local fixtures, temporary directories, and static file reads;
  tier-1 checks avoid network and LLM dependence.
- Output style: tests print terse PASS/FAIL summaries rather than verbose logs.

## Error Handling

- Bash scripts fail fast with `set -euo pipefail`.
- Node CLI helpers reject malformed input early, print a short error message to
  stderr, and exit non-zero.
- Validation scripts accumulate multiple findings only when that makes the final
  report more useful than failing on the first issue.
- Hooks are explicit about fail-open versus fail-closed behavior and gate that
  choice behind environment flags or documented policy.
- Repo contracts favor deterministic messages over stack traces for expected
  invalid-input cases.

## Documentation And Contract Patterns

- Skill docs start with frontmatter and document inputs, outputs, chaining, and
  self-verification explicitly.
- Markdown artifacts use short section headings, compact tables, and repo-local
  file paths instead of external tooling references.
- When a contract is machine-consumed, human-readable markdown remains the
  primary artifact and any helper script is intentionally thin.
- Decision history belongs in append-only logs or dedicated decision docs, not
  in ad hoc comments inside scripts.

## Discussion-Phase Implementation Targets

For `feature-discussion-phase`, the new code should follow these repo-native
patterns:

- The new skill should live at `discuss-phase/SKILL.md`.
- The helper should live at `scripts/discussion-artifact.mjs` as a focused ESM
  CLI helper, matching the style of `pipeline-log.mjs` and `task-graph.mjs`.
- Static validation should be added as
  `test-framework/evals/tier-1/validate-discussion-phase-contracts.sh`.
- Discussion artifacts should use kebab-case topic slugs under
  `docs/specs/discussions/`.
- Any persisted machine fields introduced by the helper should use snake_case,
  matching existing JSONL/event conventions.
- Downstream skill edits should preserve the current `SKILL.md` structure rather
  than inventing a new format for one skill.

## Component Patterns

No UI component system is in scope for this repo contract. The primary reusable
units here are skill docs, CLI helpers, hook scripts, and validation scripts.
