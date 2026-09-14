# Framework Evolution — 2026-06-20 — Visual Plan/Status/Flow Renderer (Claude Artifacts)

## Method
Research (2 parallel specialists): (1) authoritative Claude Artifacts 2026 capabilities — interactive HTML/React/SVG/Mermaid artifacts, **Claude Code Artifacts shipped 2026-06-18** (sessions → live shareable pages), CDN-allowed sandbox, `<details>` drill-down; realistic CLI-framework path = a **self-contained `.html` written to the repo**, data baked in at generation, regenerate per step ([claude.com/blog/artifacts-in-claude-code], [buildfastwithai.com/ai-tools/claude-artifacts]). (2) audit of how svc represents plan/status today — **all text**, no visual layer. A working **prototype was built** this run (see Finding F1).

## Findings (by priority)

### P1 — Fix soon (degrades comprehension)

**F1 — svc plan/status/flows are text-only; the user cannot track or comprehend the plan at a glance.** `Inefficiency` / `Opportunity`.
Evidence: the rich task-graph data in `.svc/lane-tasks-<WI>.json` (tasks[], status, `blocked_by`, `skill_receipt.phases_executed`, `delivery_graph.evidence_families` — `scripts/task-graph.mjs:1-164`) is surfaced ONLY as machine JSON via `summary`/`graph-status`/`next` (`scripts/task-graph.mjs:487-537`). Overall progress lives as prose in `FRAMEWORK-STATE.md` (Known Gaps, Analysis History), a 323-row markdown list in `docs/specs/work-items/INDEX.md`, and the append-only `.svc/pipeline-decisions.jsonl`. There is **no visual/HTML status output anywhere** in the framework. The user asked to "represent the plan as status + flows I can visually track and comprehend, and expand deeper."
**Prototype delivered this run:** `scripts/render-status.mjs` reads the existing state (INDEX statuses, FRAMEWORK-STATE Known Gaps = the roadmap, `.svc/lane-tasks-*.json` active graphs, `skills-manifest.json` `laneDefinitions` = the lane flow, `git log`) and emits a **self-contained, offline `docs/status/svc-status.html`**: top metrics, the roadmap as expandable cards, the greenfield lane as a visual flow, active task graphs with progress bars, recent analyses + commits — all `<details>` drill-down, zero external deps. No new data, no behavior change.

**F2 — The dashboard immediately surfaced 13 stale `lane-tasks` files** (merged WIs whose `.svc/lane-tasks-*.json` were never archived, all stuck at `status:"review"`). `Drift` (data hygiene).
Evidence: `render-status.mjs` reports 13 "active" (non-completed) graphs for WIs that are merged/VERIFIED (e.g. WI-380/382/385/387/388/390 — PRs landed). Ties to the existing `validate-stale-lane-tasks.sh` track (`rules/verify-state-before-context.md`). Track — the renderer makes this visible, which is a feature.

### P2 — Improve when possible
**F3 — Productionize the renderer.** Add a per-WI mode (`--wi`), the evidence-family grid + phase-trace timeline from `delivery_graph`, and a project-wide `--mode project-dashboard`; optionally publish via Claude Code Artifacts (June 2026) for a live shareable link. Currently a single self-contained snapshot.

### P3 — Track
**F4 — Live (vs snapshot) updates.** Artifact data is static-at-generation; live updates need either regenerate-per-step (pragmatic, recommended) or an MCP-connected data source (UNCERTAIN in the artifact sandbox). Stay snapshot-first.

## Comparison delta
Claude Artifacts (2026) + Claude Code Artifacts (2026-06-18) make rich, shareable, interactive status surfaces trivial — svc had the *data* (structured JSON state) but never the *view*. This closes that gap with one dependency-free script.

## Stale proposal audit
No prior visual-status proposal exists. No conflicts.

## Next
F1 is **prototyped and working now** (`node scripts/render-status.mjs` → `docs/status/svc-status.html`). Productionization (F3) — per-WI mode, evidence grid, route-workflow wiring (emit after lane-tasks init), Claude Code Artifacts publishing — is a `write-spec → plan-changeset → execute-changeset` WI (touches route-workflow + the script). F2 (stale lane-tasks) routes to the existing hygiene track.

## Triage
deferred_until: 2026-08-25
reason: F1 (visual status renderer) prototyped + landed (scripts/render-status.mjs -> docs/status/svc-status.html); F3 productionization (per-WI mode, route-workflow wiring) queued to FRAMEWORK-STATE Known Gaps -> write-spec when prioritized.
blocked_reason: F1 (visual renderer) already prototyped + landed; F3 productionization deferred until route-workflow status-wiring is prioritized.
