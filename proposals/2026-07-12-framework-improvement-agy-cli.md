# Framework Improvement: Migrate Gemini CLI to AGY CLI and default to Gemini 3.5 Flash High

**Status:** ACCEPTED
**Filed:** 2026-07-12
**WI:** WI-475
accepted_wi: WI-475

## Evidence
- **Source:** User directive / route-workflow analysis.
- **Finding:** Gemini CLI tool has been deprecated and replaced by AGY CLI in the developer environment. All invocations and references of the `gemini` command must migrate to the `agy` command, and default to the `gemini-3.5-flash-high` model fallback.
- **Severity:** medium

## Diagnosis
- **Root cause:** The developer host CLI has changed from `gemini` to `agy`, causing any scripts attempting to run `gemini` to fail or drift from the target environment capability.
- **Category:** missing capability / drift
- **Already in FRAMEWORK-STATE.md?** no

## Implementation
- **Route:** normal pipeline
- **Files changed:**
  - `rules/research-must-use-gemini-cli.md` (renamed to `rules/research-must-use-agy-cli.md`)
  - `skills-manifest.json`
  - `route-workflow/references/routing-rules.md`
  - `scripts/resolve-adversarial-reviewer.sh`
  - `scripts/prompt-floor-judge.sh`
  - `scripts/blind-floor-judge.sh`
  - `scripts/host-probes/gemini.sh` (renamed to `scripts/host-probes/agy.sh`)
  - `research/SKILL.md`
  - `research/references/prescope-template.md`
  - `research/scripts/dispatch-gemini.mjs` (renamed to `research/scripts/dispatch-agy.mjs` or similar)
- **Commits:** Pending

## Replay Verification
- **Replay target:** `node scripts/lint-skills-manifest.mjs` and `bash test-framework/evals/run-all-evals.sh`
- **Result:** Pending
- **Evidence:** Pending

## FRAMEWORK-STATE.md Mutations
- **Analysis History:** Add entry detailing AGY CLI migration.
- **Known Gaps:** None.
- **Decisions:** Document that AGY CLI replaces Gemini CLI as the default subordinate extraction harness.
- **Capabilities:** Update `references/knowledge/svc/CAPABILITIES.md` to reflect AGY CLI if applicable.
