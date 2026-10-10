## External Canvas Handoff (OPT-IN escape hatch — NOT the default path)

**The default design path is the in-session Design Shotgun above.** This section is an exceptional route that only activates on explicit user trigger. Do NOT route here because "it might produce nicer output" — the in-session path IS the standard and produces production-grade results.

**Activate this mode ONLY when at least one of these explicit triggers is present:**

- User says: "use Claude Design" / "hand off to external canvas" / "use v0 / Lovable" / "external design tool" / similar direct naming
- A task graph explicitly names `design-ui-external-handoff` as the skill (not plain `design-ui`)
- A WI spec has a top-level frontmatter field `design_route: external-canvas` set by the user

**Do NOT activate based on:**

- Codebase complexity or size (the in-session path handles this — that's what Design Shotgun is for)
- "Quality would be higher" judgments by the orchestrator (subjective, not a trigger)
- Implicit inference that the user wants it because the task looks important

**Cost caveat:** external handoff has real cost — user-in-the-loop round-trips, dependency on external tools the project doesn't control, drift risk if the canvas output diverges from the local component library. These costs are often worse than the token savings. Default to in-session.

### Step A — Synthesize constraints via Gemini subagent

The primary orchestrator MUST NOT re-read the entire codebase to produce constraints. Spawn a zero-history Gemini subagent to produce `docs/specs/ui/constraint-matrix.md`:

```bash
gemini generalist "Read the codebase and produce docs/specs/ui/constraint-matrix.md. \
Include: exact hex values from design tokens, component names + their props, \
supported-theme variables, Tailwind breakpoints, typography scale, and any brand \
personality signals from existing UI. Cite file:line for every claim. No prose, \
table format only."
```

The output file is the reviewed constraint source for the external canvas. Verify returned code against the actual product and supported states before accepting it.

### Step B — Compose the Vibe Contract prompt

Load `references/vibe-contract-template.md`. Fill in: product context, aesthetic direction, signature hooks. Inline the `constraint-matrix.md` contents. Apply its materiality questions to the named user job and current design system. Treat style bans as prompts for justification, not automatic rejection of a pattern that demonstrably serves this product.

**Submit the prompt + return the code — by canvas:**
- **Claude Design** (the preferred external canvas): use the built-in **`/design-sync`** Claude Code skill — NOT a manual hand-roll. Per `references/claude-design-sync.md`: `/design-sync` pulls the project's design system into the repo as **DTCG tokens** (these ground the constraint matrix), Claude Code generates against the Vibe Contract + tokens, then the same `/design-sync` pushes the built UI back to the canvas for visual refinement. Pre-flight: confirm `/design-sync` is available (`/update` if not) and the user is on a paid plan; otherwise fall back to the in-session Design Shotgun (the default path) — never block on the external tool. **Code stays the source of truth** — sync tokens + visual polish, never reverse-author component structure (component parity is not a 2026 guarantee).
- **v0 / Lovable / other canvas**: submit the composed prompt to the canvas, return with the generated code.

### Step C — Adversarial audit via second Gemini subagent

Before integrating returned code, run a zero-history Gemini subagent as adversarial verifier:

```bash
gemini generalist "Audit the returned code at <path> against docs/specs/ui/constraint-matrix.md. \
Check: (1) every hex value matches the matrix, (2) no new npm dependencies introduced, \
(3) component names match matrix, (4) supported themes and contrast are implemented, (5) typography follows approved product tokens. \
Output: strict PASS or FAIL: <reason>. No prose."
```

On FAIL: iterate with the external canvas using the audit output as the correction prompt. On PASS: integrate.

### Cost comparison (informational — do NOT use as a routing trigger)

In-session variant exploration uses only enough directions to resolve the real design choice and produces integration-ready output. External handoff may reduce local generation cost but adds a user round-trip, integration work, and tool dependency.

Token cost alone does NOT justify switching routes. The in-session path is production-grade; external handoff is for cases where the user explicitly wants external-tool-authored output despite the friction.

---
