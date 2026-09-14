# Pre-Scope: get-shit-done-deep

**Source:** https://github.com/gsd-build/get-shit-done (targeted deep dive)
**Invoked by:** standalone
**Date:** 2026-05-11

## Volume Estimate

- Total files (substantive, excluding tests/dist): targeted subset
- Approx total lines: deep extraction
- Top-level areas/sections: sdk/src, hooks, get-shit-done/references

## File Checklist (manifest)

Every substantive file that MUST be read in the single pass:

- [ ] https://github.com/gsd-build/get-shit-done/sdk/src/query/mvp.ts
- [ ] https://github.com/gsd-build/get-shit-done/workflows/plan-phase.md
- [ ] https://github.com/gsd-build/get-shit-done/bin/lib/graphify.cjs
- [ ] https://github.com/gsd-build/get-shit-done/hooks/gsd-statusline.js
- [ ] https://github.com/gsd-build/get-shit-done/hooks/gsd-context-monitor.js
- [ ] https://github.com/gsd-build/get-shit-done/sdk/src/model-catalog.ts
- [ ] https://github.com/gsd-build/get-shit-done/workflows/discuss-phase/modes/power.md
- [ ] https://github.com/gsd-build/get-shit-done/agents/gsd-planner.md
- [ ] https://github.com/gsd-build/get-shit-done/workflows/extract-learnings.md
- [ ] https://github.com/gsd-build/get-shit-done/bin/lib/worktree-safety.cjs
- [ ] https://github.com/gsd-build/get-shit-done/commands/gsd/forensics.md
- [ ] https://github.com/gsd-build/get-shit-done/bin/lib/drift.cjs
- [ ] https://github.com/gsd-build/get-shit-done/bin/lib/intel.cjs
- [ ] https://github.com/gsd-build/get-shit-done/bin/lib/planning-workspace.cjs
- [ ] https://github.com/gsd-build/get-shit-done/bin/lib/security.cjs
- [ ] https://github.com/gsd-build/get-shit-done/commands/gsd/audit-fix.md
- [ ] https://github.com/gsd-build/get-shit-done/commands/gsd/secure-phase.md
- [ ] https://github.com/gsd-build/get-shit-done/commands/gsd/thread.md
- [ ] https://github.com/gsd-build/get-shit-done/bin/lib/schema-detect.cjs
- [ ] https://github.com/gsd-build/get-shit-done/bin/lib/context-utilization.cjs
- [ ] https://github.com/gsd-build/get-shit-done/bin/lib/core.cjs
- [ ] https://github.com/gsd-build/get-shit-done/bin/lib/profile-pipeline.cjs
- [ ] https://github.com/gsd-build/get-shit-done/bin/lib/roadmap.cjs
- [ ] https://github.com/gsd-build/get-shit-done/sdk/src/prompt-sanitizer.ts
- [ ] https://github.com/gsd-build/get-shit-done/sdk/src/context-truncation.ts
- [ ] https://github.com/gsd-build/get-shit-done/sdk/src/planning-journal.ts
- [ ] https://github.com/gsd-build/get-shit-done/sdk/src/event-stream.ts
- [ ] https://github.com/gsd-build/get-shit-done/sdk/src/phase-runner.ts
- [ ] https://github.com/gsd-build/get-shit-done/bin/lib/workstream.cjs
- [ ] https://github.com/gsd-build/get-shit-done/bin/lib/uat.cjs
- [ ] https://github.com/gsd-build/get-shit-done/bin/lib/secrets.cjs
- [ ] https://github.com/gsd-build/get-shit-done/bin/lib/verify.cjs
- [ ] https://github.com/gsd-build/get-shit-done/bin/lib/init.cjs
- [ ] https://github.com/gsd-build/get-shit-done/hooks/gsd-validate-commit.sh
- [ ] https://github.com/gsd-build/get-shit-done/sdk/src/query/decisions.ts
- [ ] https://github.com/gsd-build/get-shit-done/bin/lib/phase.cjs
- [ ] https://github.com/gsd-build/get-shit-done/bin/lib/gap-checker.cjs
- [ ] https://github.com/gsd-build/get-shit-done/sdk/src/query/query-cli-adapter.ts
- [ ] https://github.com/gsd-build/get-shit-done/scripts/prompt-injection-scan.sh
- [ ] https://github.com/gsd-build/get-shit-done/scripts/base64-scan.sh
- [ ] https://github.com/gsd-build/get-shit-done/scripts/lint-no-source-grep.cjs
- [ ] https://github.com/gsd-build/get-shit-done/sdk/src/context-engine.ts
- [ ] https://github.com/gsd-build/get-shit-done/agents/gsd-nyquist-auditor.md
- [ ] https://github.com/gsd-build/get-shit-done/get-shit-done/references/ios-scaffold.md
- [ ] https://github.com/gsd-build/get-shit-done/get-shit-done/references/thinking-models-research.md
- [ ] https://github.com/gsd-build/get-shit-done/get-shit-done/references/thinking-models-planning.md
- [ ] https://github.com/gsd-build/get-shit-done/get-shit-done/references/checkpoints.md

## Extraction Plan

- Pass strategy: single-pass across all checklist files
- Target detail files: `references/knowledge/gsd/details/unique-mechanics.md`, `references/knowledge/gsd/details/10-deep-drills.md`, `references/knowledge/gsd/details/10-common-drills.md`, `references/knowledge/gsd/details/security-philosophy.md`, `references/knowledge/gsd/details/meta-reasoning.md`
- Domain classification: gsd (justification: Deep internals for the get-shit-done framework)

## Sub-Agent Selection

- Primary: gemini-cli (default — REQUIRED unless gemini-cli has actually failed)
- Fallback: Claude (in-session) if gemini errors, runs out of credits, or stalls mid-pass
- Selected for this run: gemini-cli — primary

## Expected Output Artifacts

- `references/knowledge/gsd/CAPABILITIES.md` (Layer 2 - appended)
- `references/knowledge/gsd/details/<area>.md` (Layer 3, deep dive additions)
- `docs/specs/research-log.md` entry appended
