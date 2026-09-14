# Visualize decisions and finished results as HTML — don't bury them in a terminal wall

For a **significant decision** (a non-obvious choice with trade-offs) or a
**finished result** of a substantive task, produce a self-contained HTML artifact
that makes the logic legible: the result, the **flow** of steps, and — for each
decision — the **choice**, the **why**, the **consequence**, and the
**alternatives considered**. The human opens that instead of scrolling execution
noise.

## Mechanism

```bash
node scripts/render-run-summary.mjs --report <report.json> --out docs/status/<run>.html
# report.json: { title, result, status, flow[], decisions[{choice, why, consequence, alternatives}], issues[{issue, handled}] }
# OR build from the decision ledger:
node scripts/render-run-summary.mjs --run-id <WI-or-run-id> --out docs/status/<run>.html
```

For pipeline state (the whole plan), `scripts/render-status.mjs` is the companion
project-level dashboard.

## Default vs opt-in (don't burden regular users)

**Always-on default — every user, zero setup:** the 3-section **text** report (below). It needs nothing — and it is NOT the Team/Enterprise "publish artifact" feature.

**HTML is OPT-IN.** Emit the HTML run-summary ONLY when opted in — the user asked for HTML, OR a `.svc/visualize-html.on` marker exists in the repo. The HTML is just a plain local `.html` file the human opens in a browser (no special plan or feature required); making it opt-in keeps regular flows clean and text-only.

## When it applies (when opted-in)

- **Closeout of a substantive task** — emit a run-summary HTML and name the file path.
- **A significant decision point with trade-offs** — render choice / why / consequence / alternatives.
- **NOT** for trivial one-liners, quick lookups, or short conversational answers — those stay inline.

## Companion behavior (always, even without the HTML)

Every completed substantive task ends with the **structured 3-section report**:
1. **What I did** — high-level, plain language.
2. **How / analysis** — the approach, briefly.
3. **Issues & how I handled them.**

The HTML is the richer, openable form of the same three sections.

## Why

Execution noise — tool calls, retries, internal reasoning — tires the human and
buries the signal. The decision logic and the result belong in a structured,
expandable **visual** (reasoning and consequences made legible), while the noisy
execution is kept **inside subagents** (hidden by design, full quality, no loss).
This rule pairs with the subagent-first execution model: subagents absorb the
mess; the main thread returns a clean report + an HTML you can open.
