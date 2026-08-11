# Claude Design + Design-MCP Integration — Vast Analysis (2026-06-19)

Research basis: 3 parallel specialists (authoritative Claude-Design capabilities via docs; the 2026 AI-design landscape; a full audit of svc's design surface) + **live probing of the MCP servers in this environment**. Feeds `evolve-framework`.

## 0. The headline (why "full design integration" is newly feasible)

Three things converged in 2025→2026 that did not exist before:
1. **MCP became the universal design-tool bus.** Figma (Dev Mode MCP), Canva (`mcp.canva.com`), Google Stitch, v0 (Platform API) all expose typed, agent-callable surfaces. **Figma + Canva + Stitch + Playwright MCPs are authenticated and callable in THIS environment** (verified) — opportunities below can be prototyped today with zero new infra.
2. **Bidirectional Anthropic↔Figma landed Feb 2026** — `get_design_context` (design→code) + `generate_figma_design` / "Code to Canvas" (code→design).
3. **The DTCG design-token spec hit first stable version (Oct 2025)** — Figma, Tokens Studio, Style Dictionary v4, Canva, v0, Claude all read it. This is the **round-trip currency** that lets one brand definition flow through every tool without per-tool re-exports.

## 1. What "Claude Design" actually is (2026 — CONFIRMED)

- **Claude Design** = Anthropic Labs native design canvas, launched **Apr 17 2026** (Opus 4.7). Live HTML/CSS WYSIWYG: describe UI → live render → inline edits + adjustment knobs. Produces prototypes, slides, one-pagers, wireframes, marketing collateral. Exports PDF / PPTX / Canva / standalone HTML / shareable URL. ([anthropic.com/news/claude-design-anthropic-labs](https://www.anthropic.com/news/claude-design-anthropic-labs))
- **`/design-sync` (June 2026)** — bidirectional Design↔Code: pull design systems from git repos/files; push implemented code back to Claude Design for refinement. ([explainx.ai June-2026 update](https://explainx.ai/blog/claude-design-june-2026-update-design-sync-2026))
- **Design systems as Claude Skills / `DESIGN.md`** — a design system packaged so every session pre-loads tokens + conventions + component specs.
- ✅ **Surface (CONFIRMED 2026-06-19 — corrects an earlier wrong assumption):** **`/design-sync` is a built-in Claude Code slash skill** (NOT web-only, NOT MCP) — bidirectional Claude Design ↔ Claude Code sync via `claude auth`: pull imports the project's design system as DTCG tokens into the repo; push sends built UI back to the canvas (editable). `/design create|edit` authors projects from the terminal; `/update` if absent. Full literal contract + svc wiring: **`references/claude-design-sync.md`**.
- ⚠️ **Raster limit:** Claude does not generate PNG/JPG natively — raster stays with Codex CLI / Veo / image MCPs; Claude owns SVG, HTML/CSS, React.

## 2. The design-MCP ecosystem (LIVE in this env)

| Tool | Verified tools (sample) | What it gives svc |
|---|---|---|
| **Figma MCP** (`mcp__claude_ai_Figma__*`) | `get_design_context`, `get_screenshot`, `get_variable_defs`, `get_code_connect_map`, `add_code_connect_map`, `generate_diagram`, `use_figma`, `create_new_file` | Highest-fidelity **design→code** (structured layout+tokens+Code Connect) AND **code→design** (`generate_figma_design`); token round-trip via Variables |
| **Canva MCP** (`mcp__claude_ai_Canva__*`) | `generate-design`, `export-design`, `create-design-from-brand-template`, `get-brand-template-dataset`, `list-brand-kits` | On-brand marketing/social assets + export PNG/PDF/PPTX/MP4 with Brand Kit — slots under landing-page / ad-creative / social-content |
| **Stitch MCP** (`mcp__stitch-builtin__*`) | `generate_screen_from_text`, `create_design_system`, `generate_variants`, `apply_design_system`, `upload_design_md` | Prompt→multi-screen flows + `DESIGN.md` ingest — cheap UX/UI scaffolding upstream |
| **Playwright MCP** (`mcp__plugin_playwright__*`) | `browser_take_screenshot`, `browser_snapshot`, `browser_navigate`, `browser_evaluate` | Perceptual visual-diff baselines + **axe-core injection for WCAG 2.2 AA** scans (a11y-aware gate) |

DTCG-token tooling (code-side, not MCP): **Style Dictionary v4** (DTCG first-class) transforms one token set → CSS / Tailwind / Figma Variables.

## 3. svc's current design surface (audit)

**Pipeline (greenfield):** `design-ux` → `design-ui` → `design-logo` → `landing-page` → `track-visuals` (baseline) → `execute-changeset` → `track-visuals` (diff) → `benchmark-landing` → `review-gate`. Sidecars: `generate-visuals` (provider-matrix router), `explore-ux`, `define-code-style`, `web-design-guidelines`.

**What's wired today (in `generate-visuals` provider matrix):** Figma MCP (branded variants of existing UI + diagrams), Stitch MCP (editable UI mockups), Veo 3 (motion), Codex CLI (primary photoreal), Gemini Nano-Banana/Imagen 4 (fallback), Storyset, lucide-react.

**What's NOT wired / manual:**
- **Claude Design = manual prose handoff** (`design-ui` Step B "External Canvas Handoff"): opt-in, Gemini synthesizes `constraint-matrix.md`, user hand-rolls to claude.ai, returns code, second Gemini audits. No tool wiring; the `/design-sync` git path isn't used.
- **Canva MCP = referenced but UNWIRED** — not named in any SKILL.md.
- **Figma MCP = shallow** — only asset-variant generation; NOT used for `get_design_context` design→code, token sync, or Code Connect in the core `design-ui`→`execute-changeset` loop.
- **DTCG tokens** — `docs/specs/ui/tokens.json` exists (W3C DTCG) + `design-system.md`, but no Style Dictionary transform pipeline and no Figma-Variables round-trip; tokens are hand-maintained.
- **a11y/WCAG** — `web-design-guidelines` exists but no Playwright+axe automated gate in `track-visuals`/`benchmark-landing`.

## 4. Integration opportunity map (design stage × Claude-Design capability × svc skill)

| Stage | svc skill(s) | Integration to add | Tool | Live now? |
|---|---|---|---|---|
| Tokens / design system | `define-code-style`, `design-ui` | **DTCG token spine** — emit/consume W3C tokens; Style Dictionary → CSS/Tailwind/Figma Vars; `/design-sync` git round-trip with Claude Design | Style Dictionary + Figma Variables | partial |
| Brand / logo | `design-logo` | Canva brand-kit assembly + export; keep SVG-by-construction core | Canva MCP | yes |
| UX flows | `design-ux` | `generate_screen_from_text` + `DESIGN.md` ingest for flow scaffolds | Stitch MCP | yes |
| UI screens | `design-ui` | `get_design_context` design→code mapped to real components (Code Connect); Figma-native variants beside the HTML Shotgun | Figma MCP | yes |
| Landing / marketing | `landing-page`, `generate-visuals` | Canva on-brand assets + export; Claude Design HTML preview via `/design-sync` | Canva MCP + Claude Design | yes / web |
| Code→design sync | `track-topology-diff` / new drift sidecar | `generate_figma_design` push shipped UI back to Figma (code = source of truth) | Figma MCP | yes |
| Visual + a11y QA | `track-visuals`, `benchmark-landing` | Playwright perceptual baselines + axe-core WCAG 2.2 AA gate | Playwright MCP | yes |

## 5. Ranked, sequenced roadmap (the "fully integrate everything" plan)

**Substrate first, then bookends, then breadth:**

1. **DTCG token spine (HIGHEST — substrate).** `define-code-style`/`design-ui` emit + consume W3C DTCG tokens; Style Dictionary v4 transforms once → CSS/Tailwind/Figma Variables; this is what every other integration rides on. *Why now: spec stable Oct 2025.*
2. **Figma `get_design_context` → `design-ui`→`execute-changeset`.** When a WI carries a Figma URL, pull structured context + Code Connect map → code mapped to real components. *Live + authenticated here.*
3. **Playwright + axe a11y/perceptual gate in `track-visuals`/`benchmark-landing`.** WCAG 2.2 AA + meaning-based (not pixel) diffs as a promotion gate. *Live here.*
4. **Canva MCP into `generate-visuals`/`landing-page`/`ad-creative`/`social-content`.** Brand-kit on-brand assets + multi-format export. *Live, currently unwired — easy win.*
5. **Stitch `DESIGN.md` ingest in `design-ux`.** Prompt→flow scaffolds; design-system-as-markdown matches svc's file-as-contract philosophy. *Live.*
6. **Code→Canvas back-sync sidecar.** `generate_figma_design` reflects shipped UI into Figma post-`execute-changeset`; dodges the unsolved component-parity problem by treating code as source of truth.
7. **Claude Design `/design-sync` round-trip for landing/marketing preview.** svc pushes design-system + code; Claude Design refines; pull back. Web-surface, git-mediated.
8. **Wire the manual `design-ui` External-Canvas handoff to the real `/design-sync` mechanism** + name the actual tools (replace the vague "Vibe Contract → user hand-rolls" prose).

**Honest limit to encode:** tokens round-trip reliably; **component structural parity (Figma variants ↔ coded component APIs) has NO reliable automation in 2026** — treat code as source of truth, sync one-way to design, human-review structure.

## 6. Sources
Three agent transcripts (2026-06-19). Key: Anthropic Claude Design announce + June-2026 `/design-sync`; Figma "Claude Code to Figma" (Feb 2026) + Dev Mode MCP; Canva MCP docs; Google Stitch 2.0 + DESIGN.md; DTCG spec first-stable (Oct 2025); Style Dictionary v4; Applitools/Chromatic/Percy + axe AI.
