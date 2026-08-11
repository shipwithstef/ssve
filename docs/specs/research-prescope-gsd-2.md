# Pre-Scope: gsd-2

**Source:** https://github.com/gsd-build/gsd-2
**Invoked by:** standalone
**Date:** 2026-04-30

## Volume Estimate

- Total files (substantive, excluding images/licenses/generated): ~3,100
- Approx total tokens / lines: ~94K lines
- Top-level areas/sections:
  1. Project metadata & docs (README, VISION, CHANGELOG, CONTRIBUTING)
  2. Core CLI & headless mode (src/cli.ts, src/headless.ts, src/loader.ts)
  3. Worktree & git lifecycle (src/worktree-*.ts, src/cli-web-branch.ts)
  4. Extension system & resource loader (src/extension-*.ts, src/resource-loader.ts)
  5. GSD extension core — commands, auto-pipeline, UOK, bootstrap, skills
  6. Pi SDK packages — pi-ai, pi-agent-core, pi-coding-agent, pi-tui, daemon, mcp-server, rpc-client
  7. Native Rust engine — engine, ast, grep crates
  8. Web UI (Next.js app router) — API routes, pages
  9. Studio (Electron) — main process, renderer
  10. VS Code extension
  11. Tests & quality infrastructure
  12. Gitbook / Mintlify documentation

## File Checklist (manifest)

Every substantive file that MUST be read in the single pass:

### Project Metadata
- [ ] README.md
- [ ] VISION.md
- [ ] package.json
- [ ] CONTRIBUTING.md
- [ ] CHANGELOG.md (first 200 lines for release cadence)

### Core CLI
- [ ] src/cli.ts
- [ ] src/headless.ts
- [ ] src/loader.ts
- [ ] src/onboarding.ts
- [ ] src/rtk.ts
- [ ] src/web-mode.ts
- [ ] src/mcp-server.ts
- [ ] src/help-text.ts
- [ ] src/update-cmd.ts
- [ ] src/wizard.ts

### Worktree & Git
- [ ] src/worktree-cli.ts
- [ ] src/worktree-name-gen.ts
- [ ] src/worktree-status-banner.ts
- [ ] src/cli-web-branch.ts
- [ ] src/web/git-summary-service.ts
- [ ] src/resources/extensions/gsd/worktree-command.ts
- [ ] src/resources/extensions/gsd/worktree-manager.ts
- [ ] src/resources/extensions/gsd/auto-worktree.ts

### Extension System
- [ ] src/extension-discovery.ts
- [ ] src/extension-registry.ts
- [ ] src/extension-validator.ts
- [ ] src/extension-sort.ts
- [ ] src/resource-loader.ts
- [ ] src/tool-bootstrap.ts
- [ ] src/bundled-extension-paths.ts
- [ ] src/cli-policy.ts

### GSD Extension — Core
- [ ] src/resources/extensions/gsd/index.ts
- [ ] src/resources/extensions/gsd/commands/index.ts
- [ ] src/resources/extensions/gsd/commands/handlers/core.ts
- [ ] src/resources/extensions/gsd/commands/handlers/auto.ts
- [ ] src/resources/extensions/gsd/commands/handlers/workflow.ts
- [ ] src/resources/extensions/gsd/commands/handlers/escalate.ts
- [ ] src/resources/extensions/gsd/commands-do.ts
- [ ] src/resources/extensions/gsd/commands-backlog.ts
- [ ] src/resources/extensions/gsd/commands-prefs-wizard.ts

### GSD Extension — Auto Pipeline & UOK
- [ ] src/resources/extensions/gsd/auto-direct-dispatch.ts
- [ ] src/resources/extensions/gsd/auto-supervisor.ts
- [ ] src/resources/extensions/gsd/auto-unit-closeout.ts
- [ ] src/resources/extensions/gsd/auto-recovery.ts
- [ ] src/resources/extensions/gsd/auto-worktree.ts
- [ ] src/resources/extensions/gsd/dispatch-guard.ts
- [ ] src/resources/extensions/gsd/engine-resolver.ts
- [ ] src/resources/extensions/gsd/session-lock.ts
- [ ] src/resources/extensions/gsd/crash-recovery.ts
- [ ] src/resources/extensions/gsd/workflow-engine.ts
- [ ] src/resources/extensions/gsd/guided-flow-queue.ts
- [ ] src/resources/extensions/gsd/milestone-summary-classifier.ts

### GSD Extension — Bootstrap & Tools
- [ ] src/resources/extensions/gsd/bootstrap/register-extension.ts
- [ ] src/resources/extensions/gsd/bootstrap/system-context.ts
- [ ] src/resources/extensions/gsd/bootstrap/register-hooks.ts
- [ ] src/resources/extensions/gsd/bootstrap/register-shortcuts.ts
- [ ] src/resources/extensions/gsd/bootstrap/exec-tools.ts
- [ ] src/resources/extensions/gsd/bootstrap/memory-tools.ts
- [ ] src/resources/extensions/gsd/bootstrap/query-tools.ts
- [ ] src/resources/extensions/gsd/bootstrap/journal-tools.ts
- [ ] src/resources/extensions/gsd/bootstrap/db-tools.ts
- [ ] src/resources/extensions/gsd/bootstrap/dynamic-tools.ts
- [ ] src/resources/extensions/gsd/bootstrap/tool-call-loop-guard.ts
- [ ] src/resources/extensions/gsd/bootstrap/write-gate.ts
- [ ] src/resources/extensions/gsd/bootstrap/provider-error-resume.ts

### GSD Extension — Skills, Agents, Memory
- [ ] src/resources/extensions/gsd/skill-telemetry.ts
- [ ] src/resources/extensions/gsd/memory-ingest.ts
- [ ] src/resources/extensions/gsd/memory-extractor.ts
- [ ] src/resources/extensions/gsd/compaction-snapshot.ts
- [ ] src/resources/extensions/gsd/rethink.ts
- [ ] src/resources/extensions/gsd/undo.ts
- [ ] src/resources/agents/worker.md
- [ ] src/resources/agents/planner.md
- [ ] src/resources/agents/reviewer.md
- [ ] src/resources/agents/researcher.md
- [ ] src/resources/agents/debugger.md

### Pi SDK Packages
- [ ] packages/pi-ai/src/index.ts
- [ ] packages/pi-ai/src/models.ts
- [ ] packages/pi-ai/src/cli.ts
- [ ] packages/pi-agent-core/src/index.ts
- [ ] packages/pi-coding-agent/src/index.ts
- [ ] packages/pi-tui/src/index.ts
- [ ] packages/daemon/src/index.ts
- [ ] packages/mcp-server/src/index.ts
- [ ] packages/rpc-client/src/index.ts
- [ ] packages/native/src/index.ts
- [ ] packages/native/src/native.ts

### Native Rust Engine
- [ ] native/Cargo.toml
- [ ] native/crates/engine/src/lib.rs
- [ ] native/crates/engine/src/grep.rs
- [ ] native/crates/engine/src/glob.rs
- [ ] native/crates/engine/src/ast.rs
- [ ] native/crates/engine/src/git.rs
- [ ] native/crates/engine/src/diff.rs
- [ ] native/crates/engine/src/fd.rs
- [ ] native/crates/engine/src/ps.rs
- [ ] native/crates/engine/src/ttsr.rs
- [ ] native/crates/engine/src/truncate.rs
- [ ] native/crates/ast/src/lib.rs
- [ ] native/crates/grep/src/lib.rs

### Web UI
- [ ] web/package.json
- [ ] web/app/page.tsx
- [ ] web/app/layout.tsx
- [ ] web/app/api/live-state/route.ts
- [ ] web/app/api/steer/route.ts
- [ ] web/app/api/hooks/route.ts
- [ ] web/app/api/projects/route.ts
- [ ] web/app/api/visualizer/route.ts
- [ ] web/app/api/forensics/route.ts
- [ ] web/app/api/auto-dashboard/route.ts
- [ ] web/proxy.ts

### Studio (Electron)
- [ ] studio/package.json
- [ ] studio/src/main/index.ts
- [ ] studio/src/renderer/src/App.tsx
- [ ] studio/src/renderer/src/main.tsx
- [ ] studio/electron.vite.config.ts

### VS Code Extension
- [ ] vscode-extension/package.json
- [ ] vscode-extension/src/extension.ts

### Tests & Infrastructure
- [ ] tests/smoke/run.ts
- [ ] src/tests/ (structure and key test files)
- [ ] scripts/build-web-if-stale.cjs
- [ ] scripts/verify-workspace-coverage.cjs

### Orchestrator Skill
- [ ] gsd-orchestrator/SKILL.md
- [ ] gsd-orchestrator/workflows/build-from-spec.md
- [ ] gsd-orchestrator/workflows/monitor-and-poll.md

### Documentation
- [ ] gitbook/README.md
- [ ] gitbook/SUMMARY.md
- [ ] gitbook/core-concepts/auto-mode.md
- [ ] gitbook/core-concepts/step-mode.md
- [ ] gitbook/core-concepts/project-structure.md
- [ ] gitbook/features/skills.md
- [ ] gitbook/features/workflow-templates.md
- [ ] gitbook/features/web-interface.md
- [ ] gitbook/features/parallel.md
- [ ] gitbook/features/teams.md
- [ ] gitbook/reference/commands.md
- [ ] gitbook/reference/cli-flags.md
- [ ] mintlify-docs/ (top-level structure)

## Extraction Plan

- Pass strategy: single-pass across all checklist files (~90 files, ~30K lines of code/docs)
- Target detail files:
  - `references/knowledge/gsd-2/details/project-meta.md`
  - `references/knowledge/gsd-2/details/core-cli.md`
  - `references/knowledge/gsd-2/details/worktree-git.md`
  - `references/knowledge/gsd-2/details/extension-system.md`
  - `references/knowledge/gsd-2/details/gsd-extension-core.md`
  - `references/knowledge/gsd-2/details/auto-pipeline.md`
  - `references/knowledge/gsd-2/details/bootstrap-tools.md`
  - `references/knowledge/gsd-2/details/pi-sdk.md`
  - `references/knowledge/gsd-2/details/native-engine.md`
  - `references/knowledge/gsd-2/details/web-studio.md`
  - `references/knowledge/gsd-2/details/skills-agents.md`
  - `references/knowledge/gsd-2/details/docs-orchestrator.md`
- Domain classification: `gsd-2` (justification: this is GSD-2, a distinct standalone CLI coding agent built on Pi SDK, separate from the existing GSD-1 meta-prompting framework already indexed at `references/knowledge/gsd/`)

## Sub-Agent Selection

- Primary: gemini-cli (default — REQUIRED unless gemini-cli has actually failed)
- Fallback: Claude (in-session via Agent tool) if gemini errors, runs out of credits, or stalls mid-pass
- Selected for this run: fallback — gemini-cli binary is present but running it against `/tmp/gsd-2` triggers `[IDEClient] Directory mismatch` warnings and excessive skill-conflict stderr noise that would make structured multi-file output extraction unreliable. A test invocation (`gemini -p ... --include-directories /tmp/gsd-2`) produced correct JSON but buried it in ~100 lines of skill-conflict stderr. For a 90-file → 15-output-file extraction, this noise profile makes coverage verification impractical. Claude fallback via Agent tool is selected for reliable structured output.

## Expected Output Artifacts

- `references/knowledge/gsd-2/CAPABILITIES.md` (Layer 2)
- `references/knowledge/gsd-2/details/<area>.md` (Layer 3, one per area above)
- `references/knowledge/gsd-2/.version`
- `references/knowledge/INDEX.md` entry updated
- `docs/specs/research-log.md` entry appended
