# Changeset Manifest: WI-475 AGY CLI Migration

- **Spec Path:** docs/specs/work-items/WI-475.md
- **Branch:** feature-agy-cli
- **Status:** DRAFTED
- **Base SHA:** main HEAD
- **Timestamp:** 2026-07-12T02:52:00Z
- **Execution Mode:** inline

## Implementation Summary

Migrate the framework's subordinate Gemini harness from `gemini-cli` (command `gemini`) to `agy-cli` (command `agy`). Make sure all invocations of Google/Gemini models default to `gemini-3.5-flash-high` when Gemini is needed, with a fallback to orchestrator level or other harness models if unavailable.

## Files Planned

| Path | Action | Role |
|------|--------|------|
| `rules/research-must-use-gemini-cli.md` | RENAME -> `rules/research-must-use-agy-cli.md` | Core rule file for research skill |
| `skills-manifest.json` | MODIFY | Update rule path registry and references |
| `route-workflow/references/routing-rules.md` | MODIFY | Update references to research rule and command name |
| `scripts/resolve-adversarial-reviewer.sh` | MODIFY | Replace gemini command fallback/probes references with agy |
| `scripts/prompt-floor-judge.sh` | MODIFY | Replace gemini with agy command and default model to gemini-3.5-flash-high |
| `scripts/blind-floor-judge.sh` | MODIFY | Replace gemini with agy command and default model to gemini-3.5-flash-high |
| `scripts/host-probes/gemini.sh` | RENAME -> `scripts/host-probes/agy.sh` | Probe command existence for `agy` instead of `gemini` |
| `research/SKILL.md` | MODIFY | Update references to agy-cli/agy and command calls |
| `research/references/prescope-template.md` | MODIFY | Update references |
| `research/scripts/dispatch-gemini.mjs` | RENAME -> `research/scripts/dispatch-agy.mjs` | Update script to invoke agy instead of gemini and default model to gemini-3.5-flash-high |
| `research/scripts/synthesize-meaning.mjs` | MODIFY | Update invocation to use agy command |
| `research/scripts/website-prescope.mjs` | MODIFY | Update default primary to agy-cli |
| `test-framework/evals/tier-1/validate-research-prescope-sub-agent.sh` | MODIFY | Adjust check match pattern from gemini-cli to agy-cli |
| `test-framework/evals/tier-1/validate-cross-host-hook-conformance.sh` | MODIFY | Adjust hook matching |
| `test-framework/evals/tier-1/validate-stop-hook-stdin-preservation.sh` | MODIFY | Adjust check pattern |
| `test-framework/evals/tier-1/validate-framework-self-management.sh` | MODIFY | Adjust host checks |

## Task Graph

1. **Rename and update rules**: Rename `rules/research-must-use-gemini-cli.md` to `rules/research-must-use-agy-cli.md`, rewrite content to refer to `agy-cli` and `agy` command.
2. **Rename scripts/probes**: Rename `scripts/host-probes/gemini.sh` -> `scripts/host-probes/agy.sh`, `research/scripts/dispatch-gemini.mjs` -> `research/scripts/dispatch-agy.mjs`.
3. **Update scripts invoking gemini**: Update `resolve-adversarial-reviewer.sh`, `prompt-floor-judge.sh`, `blind-floor-judge.sh`, `dispatch-agy.mjs`, `synthesize-meaning.mjs` to invoke `agy` instead of `gemini`, defaulting the model option to `gemini-3.5-flash-high`.
4. **Update skills and templates**: Update `research/SKILL.md`, `research/references/prescope-template.md`, `research/scripts/website-prescope.mjs`, `skills-manifest.json`, `route-workflow/references/routing-rules.md`.
5. **Update validation tests**: Update `validate-research-prescope-sub-agent.sh` and other tier-1 scripts to expect `agy-cli`/`agy` rather than `gemini-cli`/`gemini`.
6. **Verify and lint**: Run `lint-skills-manifest.mjs` and `run-all-evals.sh` to ensure no errors.

## AC-to-Task
- AC-1 (Rule Rename) -> Task 1, Task 4
- AC-2 (Codebase References & Commands Migration) -> Task 2, Task 3, Task 4
- AC-3 (Default Model Update) -> Task 3
- AC-4 (Validation & Evals) -> Task 5, Task 6

## AC-to-Test
- AC-1 -> Unit check (lint-skills-manifest.mjs)
- AC-2 -> Integration verification (run-all-evals.sh)
- AC-3 -> Integration verification (resolves correctly in reviewer fallback)
- AC-4 -> Static validation (tier-1 validators pass)

## Prerequisite Alignment Matrix
- UX/UI trace: N/A (no user interface changes)
- Tech architecture: Replaces Gemini CLI with AGY CLI.
- Style contract: No style deviations.
- Persona trace: N/A (framework only).

## External State
- Untouched environments: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15 (No external databases, SaaS backends, third-party state, or persistence models modified).

## Validation Plan
1. Run `node scripts/lint-skills-manifest.mjs` to check manifest syntax and rule registries.
2. Run `bash test-framework/evals/run-all-evals.sh` to run the full static checks and verify validator outputs.
3. Verify `scripts/resolve-adversarial-reviewer.sh` correctly resolves the reviewer.

## Checkpoint Plan
- Checkpoint 1 (Rule & Script Renames): Commit renames.
- Checkpoint 2 (Command swaps): Commit command swap implementation.
- Checkpoint 3 (Validation pass): Ensure all tests pass.
