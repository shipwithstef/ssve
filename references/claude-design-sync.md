# Claude Design ↔ Claude Code Bidirectional Sync (`/design-sync`)

Canonical contract for svc's Claude Design integration. Researched + confirmed 2026-06-19 (corrects the earlier "web-only, no canvas integration" assumption in `docs/analysis/claude-design-integration-2026-06-19.md`).

## What it is (CONFIRMED)

`/design-sync` is a **built-in Claude Code slash skill** (NOT an MCP tool, NOT a plugin, NOT web-only) that syncs design systems and screens **both directions** between **Claude Design** (the canvas) and **Claude Code** (the repo). Companion: `/design` creates/edits Claude Design projects from the terminal. Shipped June 2026.

- Sources: [support.claude.com — Get started with Claude Design](https://support.claude.com/en/articles/14604416-get-started-claude-design), [VentureBeat — Claude Design overhaul](https://venturebeat.com/technology/anthropic-ships-major-claude-design-overhaul-with-design-system-imports-code-round-trips-and-a-fix-for-its-token-burning-problem/), [explainx.ai — June 2026 update](https://explainx.ai/blog/claude-design-june-2026-update-design-sync-2026), [@ClaudeDevs](https://x.com/ClaudeDevs/status/2067391951725629941).

## The contract

| | |
|---|---|
| **Invocation** | `/design-sync` (same command both directions; context decides pull vs push). `/design create <name>` / `/design edit <name>` to author projects from the terminal. |
| **Pull (Design → Code)** | Auto-discovers Claude Design projects you own / have write access to (no URL paste). Imports the design system — colors, typography scale, spacing, component defs — as **W3C DTCG JSON tokens** into the repo. Subsequent Claude Code generation uses the real tokens, not generic Tailwind defaults. |
| **Push (Code → Design)** | The same `/design-sync` pushes built UI back to the Claude Design canvas, where it stays editable (cursor state, inline comments, direct text edits preserved). Closes the loop when code-first iteration hits layout limits. No screenshot exchange. |
| **Format** | W3C **DTCG** JSON (the same standard svc's `docs/specs/ui/tokens.json` uses — this is the F1 token-spine connection point). |
| **Auth / setup** | Existing `claude auth` (Anthropic login). **No MCP server, no plugin, no settings config.** Pro / Max / Team / Enterprise plans. If `/design-sync` or `/design` is absent, run `/update` (only new sessions get the skill). |
| **Surfaces** | Claude Code CLI, VS Code extension, Desktop, Web — all equal. |

## Honest limits (UNCERTAIN in the docs — encode defensively)

- **Component structural parity** (Figma/Design variants/props ↔ coded component APIs) is **not a documented guarantee**. Tokens round-trip reliably; component structure may not.
- Round-trip fidelity for **animations, responsive breakpoint logic, dynamic/CSS-in-JS state** is undocumented — assume it may NOT survive.
- No documented conflict resolution if design and code diverge.
- **svc policy (load-bearing):** **code is the source of truth.** Use `/design-sync` to pull tokens and to push UI for *visual polish on canvas*, never to reverse-author component structure into code. POC-test a real project before depending on round-trip fidelity for anything structural.

## How svc uses it (integration pattern)

1. **Token spine (F1):** the DTCG tokens `/design-sync` pulls land as `docs/specs/ui/tokens.json` — the single source of truth a Style Dictionary transform fans out to CSS / Tailwind / Figma Variables. `define-code-style` / `design-ui` own this.
2. **`design-ui` External-Canvas mode (F6):** when the external canvas is **Claude Design**, the handoff is `/design-sync`, NOT a manual hand-roll — pull the project's design system, generate code against the (token-grounded) constraint matrix, then push back for canvas refinement. The Gemini constraint-matrix synthesis + adversarial audit remain the guardrail against token drift.
3. **Preview/refine loop (F8):** for landing/marketing one-pagers, push the implemented page to Claude Design via `/design-sync` for visual polish, pull the refined tokens/layout back. Code stays source of truth.
4. **Pre-flight:** confirm `/design-sync` is available (`/update` if not) and the user is on a paid plan; otherwise fall back to the in-session Design Shotgun (the default path) — never block on the external tool.
