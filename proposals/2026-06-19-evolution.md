# Framework Evolution — 2026-06-19 — Claude Design + Design-MCP Integration

## Method
Vast research pass (3 parallel specialists: authoritative Claude-Design capabilities via docs; the 2026 AI-design landscape; a full audit of svc's design surface) + **live probing of the MCP servers in this environment** (Figma, Canva, Stitch, Playwright all authenticated + callable as `angelovsan@gmail.com`). Full evidence base: `docs/analysis/claude-design-integration-2026-06-19.md`. Cross-checked `FRAMEWORK-STATE.md` (no prior Claude-Design/Figma-MCP/DTCG work — only a token→component-state mention at FRAMEWORK-STATE.md:160) and `proposals/` (prior design-pipeline work: `proposals/done/2026-04-20-evolution-design-benchmark-gate.md` landed `benchmark-landing`; `proposals/done/2026-04-18-session-audit-gemini-masterclass.md` flagged a still-open "A2UI / register local components into Claude Design catalog" gap).

**Host-capability verification (per `rules/` host-staleness pitfall, confidence 10):** every finding below touches MCP/host surfaces and is marked `host-capability-drift`. The required `research` verification is DONE — the analysis doc records live-env tool probes + 2026 vendor docs. Each finding still needs `write-spec → plan-changeset → execute-changeset` (all touch >2 files / >50 lines — no reactive edits on framework skills).

**Cross-cutting constraint to encode in every finding:** DTCG **tokens round-trip reliably**, but **component structural parity (Figma variants/props ↔ coded component APIs) has NO reliable automation in 2026** — treat **code as the source of truth**, sync one-way to design, human-review structure. (Evidence: analysis doc §4 "honest limitation".)

## Findings (by priority)

### P0 — Fix now (blocks quality)
None. The current design pipeline (`design-ux` → `design-ui` → `design-logo` → `landing-page` → `track-visuals` → `benchmark-landing`) functions; these are additive integrations, not active breakage.

### P1 — Fix soon (degrades quality / highest leverage)

**F1 — DTCG token spine is hand-maintained; no Style-Dictionary transform or Figma-Variables round-trip.** `Inefficiency`/`Fragility` + `host-capability-drift`.
Evidence: `docs/specs/ui/tokens.json` (W3C DTCG) + `docs/specs/design-system.md` exist but are authored by hand inside `design-ui/SKILL.md` (The Design System section, design-ui/SKILL.md:339-510); no transform pipeline emits CSS/Tailwind/Figma Variables from one source, and `define-code-style/SKILL.md` (the style-contract owner) does not consume/emit DTCG. The DTCG spec went **first-stable Oct 2025** and is now the only format every AI design tool reads (analysis §0/§5). **This is the substrate** — every other finding rides on it.
Direction: make `define-code-style`/`design-ui` emit + consume W3C DTCG tokens; add a Style Dictionary v4 transform (`tokens.json` → CSS vars + Tailwind config + Figma Variables) so brand is defined once. Sequence FIRST.

**F2 — Figma MCP is shallow: only asset-variant generation, not `get_design_context` design→code in the core loop.** `Gap` + `host-capability-drift`.
Evidence: Figma MCP appears in the `generate-visuals` provider matrix only for "branded variants of existing UI" + diagrams (generate-visuals/SKILL.md:54); the high-fidelity `get_design_context` + `get_code_connect_map` path is NOT wired into `design-ui` → `execute-changeset`, so a WI carrying a Figma URL can't pull structured layout+tokens+component-mapping. Anthropic↔Figma is first-class bidirectional since Feb 2026; the MCP is **authenticated in this env**.
Direction: when a WI references a Figma frame, `design-ui`/`execute-changeset` calls `get_design_context` + Code Connect map → code mapped to the project's real components (closes the "wrong component" gap).

**F3 — No automated accessibility (WCAG) or perceptual-visual gate; `web-design-guidelines` is advisory-only.** `Gap` + `host-capability-drift`.
Evidence: `track-visuals` captures multi-viewport×theme screenshots and `benchmark-landing` scores 10 design dimensions, but neither injects axe-core or runs a WCAG 2.2 AA scan; `_shared/live-evidence.md` is an eyeball checklist. Playwright MCP (`browser_evaluate` for axe injection, `browser_take_screenshot`) is **live in this env** and axe AI hits ~94% parity with specialized tooling (analysis §2/§5).
Direction: add a Playwright+axe **WCAG 2.2 AA** scan + perceptual (meaning-not-pixel) diff as a promotion gate inside `track-visuals`/`benchmark-landing`.

### P2 — Improve when possible (clear win, additive)

**F4 — Canva MCP is referenced-but-UNWIRED; no on-brand marketing/social-asset path.** `Gap` + `host-capability-drift`.
Evidence: Canva is alluded to via "Claude Design / Live Canvas" prose in `design-ui/SKILL.md` but named in **no** SKILL.md and absent from the `generate-visuals` provider matrix (generate-visuals/SKILL.md:48-63). Canva MCP (`generate-design`, `export-design`, brand templates) is **live + authenticated here**. Easiest high-value win.
Direction: add a "branded marketing/social asset" provider-matrix row routing to Canva MCP (brand-kit + export PNG/PDF/PPTX/MP4); wire under `landing-page`, `ad-creative`, `social-content`.

**F5 — `design-ux` produces text-only specs; no Stitch `DESIGN.md` / flow-scaffold ingest.** `Opportunity` + `host-capability-drift`.
Evidence: `design-ux/SKILL.md:1-40` outputs screen inventory/state-machines as text, no visual flow generation; Stitch MCP (`generate_screen_from_text`, `upload_design_md`) is live and its `DESIGN.md` natural-language design-contract format matches svc's file-as-contract philosophy (analysis §2/§5).
Direction: optional Stitch flow-scaffold + `DESIGN.md` ingest in `design-ux` to seed UX flows cheaply upstream of `design-ui`.

**F6 — The `design-ui` "External Canvas Handoff" is a manual prose hand-roll, not wired to the real Claude Design `/design-sync`.** `Drift` + `host-capability-drift`.
Evidence: `design-ui/SKILL.md` Step B (External Canvas Handoff, ~design-ui/SKILL.md:257-307) is opt-in, has Gemini synthesize `docs/specs/ui/constraint-matrix.md`, then the **user hand-rolls to claude.ai, returns code, a second Gemini audits** — no tool wiring; `references/knowledge/domains/external-canvases/CAPABILITIES.md` describes Claude Design generically. Claude Design shipped `/design-sync` (git round-trip) in June 2026, and is **web-only (no canvas MCP)** — so the correct mechanism is git-mediated `/design-sync`, not the vague "Vibe Contract".
Direction: replace the manual handoff with the real `/design-sync` round-trip (svc emits design-system + code via DTCG spine [F1]; Claude Design refines; pull back), and name the actual surface instead of "Live Canvas" prose. Depends on F1.

### P3 — Track (not actionable until substrate/limits resolved)

**F7 — Code→Design back-sync sidecar (`generate_figma_design`) to keep Figma reflecting shipped UI.** `Opportunity` + `host-capability-drift`.
Evidence: "Code to Canvas" (`generate_figma_design`) became real Feb 2026; svc has no skill that pushes shipped UI back to design (closest is `track-topology-diff`). BLOCKED by the cross-cutting **component-structural-parity limit** — only safe as a one-way *sync* (code = source of truth), never reverse-authoring. Track until F1/F2 land and the parity boundary is encoded.

**F8 — Claude Design as in-pipeline preview/refinement surface for landing/marketing.** `Opportunity` + `host-capability-drift`.
Evidence: Claude Design (Apr 2026) produces deployable HTML artifacts; **`/design-sync` is a built-in Claude Code slash skill** (CONFIRMED 2026-06-19, `references/claude-design-sync.md`) — bidirectional sync via `claude auth`, so in-pipeline use is the `/design-sync` loop (F6). The literal contract is now confirmed (was UNCERTAIN) and F6's wiring landed 2026-06-19; remaining F8 work (the landing/marketing preview loop) depends only on the DTCG spine (F1).

## Comparison delta
The 2026 AI-design ecosystem (analysis §4 matrix) automates every pipeline stage svc covers — brand/logo (Recraft/Canva), tokens (DTCG+Style Dictionary), UX flows (Stitch), UI (Figma MCP/v0/Claude Design), landing (Claude Design/Canva), QA (axe/Applitools/Playwright) — and crucially **round-trips on the DTCG token standard**. svc has the *pipeline shape* and a provider-matrix router (`generate-visuals`) others lack, but is **behind on**: (a) a token single-source-of-truth, (b) deep Figma design→code, (c) automated a11y. It is **ahead on**: gated benchmarking (`benchmark-landing`), live-evidence terminal gates, logo-by-construction (`design-logo`). Net: adopt the substrate (F1) + the two bookends (F2 design-in, F3 QA-out) to reach parity; the rest is additive breadth.

## Stale proposal audit
- `proposals/done/2026-04-20-evolution-design-benchmark-gate.md` — **implemented** (`benchmark-landing` exists, 10-dim gate). No action.
- `proposals/done/2026-04-18-session-audit-gemini-masterclass.md` — flagged "no A2UI / register local components into Claude Design catalog." **Still open**, now subsumed by F6/F7 (code↔design sync). Supersede that line with this cluster.
- No pending proposal conflicts; no obsolete proposals to retire in this area.

## Next
Per evolve-framework scope, this is a **survey** — no per-leaf fix briefs here. Implement substrate-first: **F1 (DTCG token spine) → F2 (Figma design→code) + F3 (a11y/visual gate) → F4/F5/F6 → F7/F8**. Each finding becomes a `write-spec → plan-changeset → execute-changeset` WI (all touch >2 files); F8 needs a `research` confirm of the literal `/design-sync` contract first. Route the first WI (F1) through `improve-framework`.

## Triage
deferred_until: 2026-08-25
reason: design-integration cluster (F1-F8) queued in FRAMEWORK-STATE Known Gaps; F6 (/design-sync wiring) landed 2026-06-19; each remaining finding becomes a write-spec/improve-framework WI when prioritized — substrate-first (F1 DTCG token spine gates F2-F8).
blocked_reason: substrate-first sequencing — F1 (DTCG token spine) gates F2-F8; each finding is a multi-file write-spec/improve-framework WI awaiting build prioritization.
