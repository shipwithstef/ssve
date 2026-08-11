# External UI Canvases (Claude Design / v0 / Lovable)

**Layer:** 2 (CAPABILITIES)
**Last Updated:** 2026-06-19
**Scope:** Capabilities and features of standalone web-based UI generation tools.

## Core Offerings
- **Claude Design / Artifacts:** Native slide deck creation, interactive presentations, prototyping.
- **v0 (Vercel):** High-fidelity UI/UX component generation, React/Next.js scroll-linked animations.
- **Lovable:** Interactive web app generation, data-driven and 3D timeline visuals (P5.js/Three.js).

## Advanced Features
- **Prototyping:** Rapid generation of functional UI components from wireframe or high-fidelity prompts.
- **Slide Decks:** Claude Design natively supports creating "presentation-native" slide decks (with HTML or PPTX export).
- **Prompt Templates:** Can leverage structural templates (like the "Vibe Contract" with `<signature_hook>`) to tightly control aesthetic outputs and eliminate "AI slop".
- **Animation Timeline-based Motion Design:** Support for sophisticated motion design using libraries like Framer Motion, GSAP, or CSS transitions to create sequenced, timeline-based animations (e.g. scroll-linked timelines, click-to-advance milestones).

## Context Ingestion & Design Systems (Claude Design)
- **Design System Setup:** Explicit flow to set company name, brand voice ("Any other notes"), fonts, logos, and assets.
- **Codebase Linking:** Attach GitHub repositories (`Connect GitHub`) or local directories (`Link code folder`) so the generator natively understands existing components (e.g., `shadcn/ui`) and design tokens. For large codebases, attaching a frontend-focused subfolder is recommended.
- **Visual Context:** Supports uploading `.fig` files (parsed locally in-browser) or `Grab web element` to replicate existing brand styles and wireframes.
- **Cross-Project Reference:** Can reference other Claude Design projects or explicitly attach configured `Skills and design systems` to inherit established behavior.

## Export & Handoff Options
- **Presentations & Documents:** `Export as PDF`, `Export as PPTX` (native text/shapes or flat screenshots), `Send to Canva`.
- **Code & Development:** `Handoff to Claude Code` (direct terminal integration), `Export as standalone HTML`, `Download project as .zip`.

## Bidirectional Sync — `/design-sync` (June 2026, CONFIRMED)
`/design-sync` is a **built-in Claude Code slash skill** (not an MCP tool, not a plugin, not web-only) for two-way Claude Design ↔ Claude Code sync. **Pull:** imports the project's design system as **W3C DTCG tokens** into the repo (auto-discovers your projects via `claude auth` — no URL paste). **Push:** the same `/design-sync` sends built UI back to the canvas, where it stays editable. `/design create|edit <name>` authors projects from the terminal; run `/update` if the skill is absent; Pro/Max/Team/Enterprise. **Full contract + svc integration pattern: `references/claude-design-sync.md`.** Limit: tokens round-trip reliably; component structural parity does NOT (undocumented) — **code is the source of truth**.

## Details
- `details/advanced-features.md` - In-depth breakdown of prototype, slide deck, and timeline-based motion capabilities.