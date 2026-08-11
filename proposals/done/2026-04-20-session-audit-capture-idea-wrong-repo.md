# Session Audit — Capture Idea Repo Misalignment

## Scope
Audit the `capture-idea` session triggered on 2026-04-20 where the agent ingested two audio transcriptions and generated new work items and an `INDEX.md` in the `seriousvibecoding` root repository rather than the target application repository (`example-marketplace`).

## Evidence Inventory
- prompt / session source: User prompt with `@[/capture-idea]`
- WI file: `WI-089.md`, `WI-090.md` (originally `WI-072.md`, `WI-073.md`)
- lane task graph: None active for context
- transcript status: auto-discovered (current session)
- runtime proof artifacts: Files incorrectly generated in `/workspace/seriousvibecoding/docs/specs/work-items`.

## Expected Contract
The `capture-idea` skill states:
- "Check docs/specs/vision.md" and "Read docs/specs/work-items/INDEX.md to find the current highest WI number."
- Target repository must be inferred from context or explicitly checked, depositing work items only in the active product's specific `app-workspaces/<project>` folder.

## Actual Execution
1. Agent detected the user prompt to trigger `capture-idea` with two audio transcripts.
2. Agent observed the local directory tree and current workspace focus. Due to recent interactions existing heavily in `/workspace/seriousvibecoding`, the agent assumed `seriousvibecoding` was the target application repo.
3. The agent looked for `docs/specs/work-items/INDEX.md` inside `seriousvibecoding`, failing to find it because it is not an application repo with an active feature index.
4. The agent assumed `INDEX.md` was missing completely and generated one from scratch inside `seriousvibecoding`, creating `WI-072.md` and `WI-073.md` entirely in the framework repo's directory space instead of `example-marketplace`.
5. User noticed the `INDEX` generation seemed weird and clarified the target repo was `example-marketplace`.
6. Fast-follow fix: The agent removed the false files from `seriousvibecoding`, transferred the ideas as `WI-089.md` and `WI-090.md` to `example-marketplace`, and appended them successfully to `example-marketplace/.../INDEX.md`.

## Expected vs Actual Matrix
| Area | Expected | Actual | Status | Evidence |
|---|---|---|---|---|
| Routing correctness | WI routed to target project repository (`example-marketplace`) | WI routed to framework repository (`seriousvibecoding`) | FAIL | File creation logs in `seriousvibecoding` |
| Contract compliance | Read existing `INDEX.md` to find incrementing number | Generated new `INDEX.md` missing historical WIs | FAIL | `WI-072.md` vs `WI-089.md` discrepancy |
| Skill-loading discipline | Checked vision/persona for context context | Skipped because it misaligned the repo completely | WARN | No context extraction made |

## Dimension Scores
| Dimension | Score | Evidence | Notes |
|---|---|---|---|
| Prompt fidelity | PASS | Extracted features accurately from audio transcripts | Product thinking was correct, file-targeting was wrong. |
| Context efficiency | FAIL | Wasted context on creating an unnecessary generic INDEX because the correct repo wasn't located. | |

## Token / Context Notes
ESTIMATED. Wasted ~500 tokens repeatedly viewing the `seriousvibecoding` file tree instead of asking the user to clarify the target active workspace or directly listing `example-marketplace`.

## Findings
### F1
- Domain: agent-specific
- Severity: high
- Description: The agent defaulted stringently to `seriousvibecoding` without explicitly verifying the target product repo, violating the basic premise of multi-repo `app-workspaces` navigation.
- Evidence: Creating `INDEX.md` in `seriousvibecoding` when `example-marketplace` was the actual intended space.
- Fix: The `capture-idea` skill (and general baseline instructions) needs a mechanical guard: "If `docs/specs/vision.md` and an established `INDEX.md` do not exist in the assumed working directory, the agent MUST explicitly ask the user which repository to target before creating new canonical infrastructure like `INDEX.md`."

## Framework Gaps For evolve-framework
- `capture-idea/SKILL.md` requires a safety checkpoint: When invoked in an `app-workspaces` monorepo or generic wrapper environment, the framework needs to verify the `$CWD`/target repository has the prerequisite documentation folders. If it's building them from scratch, it should trigger an explicit confirmation to ensure it's not dumping files in the orchestrator/framework root.

## Non-Framework Corrections
- Removed stray WIs and `INDEX` from `seriousvibecoding`.
- Re-indexed correctly in `example-marketplace`.
- Added missing `WI-088` to `example-marketplace/.../INDEX.md` while performing the transfer cleanup.

## Confidence
High. The mistake arose purely from agent execution failure due to insufficient workspace target verification prior to `write_to_file`.
