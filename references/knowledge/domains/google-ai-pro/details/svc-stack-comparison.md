# svc-stack comparison: what does Google AI Pro add?

## Builder's existing paid stack (2026-04-25)

| Resource | Cost | Primary role | Renews/expires |
|---|---|---|---|
| Claude Max (5-seat) | $500/mo | STRAT/PLAN/EXEC primary | monthly |
| GPT Business | $30/mo | Codex CLI (alt EXEC) | monthly |
| MiMo standard | $0 (subscription window) | EXEC delegate, 200M credits, free TTS, off-peak 0.8x | expires 2026-05-19 |
| Base44 | $50/mo | Hosted backend (Example Marketplace, Distrilicious) | renews 2026-05-11 — **NOT renewing if migrations done** |
| **Google AI Pro (this trial)** | €0 trial → €21.98/mo | Multi-surface bundle | trial expires ~2026-05-19/20 |

## Capability overlap matrix

| Capability | Already covered by | Pro adds |
|---|---|---|
| Chat with frontier LLM | Claude Max (Opus/Sonnet) + Codex (GPT-5.5) | Gemini 3.1 Pro — **a third frontier model** |
| Code agent (sync) | Claude Code, Codex | Antigravity, Code Assist |
| Code agent (async) | — | **Jules — UNIQUE** |
| Multi-file edits / EXEC | Claude Code, MiMo, Codex | Antigravity |
| Web search inside chat | Claude `web_search`, Codex web tools | AI Mode + Deep Search |
| **Multi-source research synthesis** | partial via Claude | **Deep Research 600/mo — UNIQUE at this scale** |
| **Document-grounded chat** | — | **NotebookLM — UNIQUE** |
| **Video generation** | — | **Veo + Flow — UNIQUE** |
| **Image generation** | — (Stitch separate) | **Nano Banana Pro — UNIQUE** |
| **Music generation** | — | **UNIQUE** |
| Productivity (Gmail/Docs/Sheets) | — | **UNIQUE — no other resource touches Workspace** |
| Cloud-deployed model API | — | **$10/mo Cloud credit — UNIQUE** |
| Multimodal (text+image) | Claude Sonnet/Opus, MiMo V2-Omni | Gemini 3 Pro |
| 5 TB cloud storage | — | **UNIQUE** |
| Smart-home premium | — | **UNIQUE** ($10/mo offset) |

## What's genuinely irreplaceable from elsewhere

These are the capabilities that, if cancelled, the builder cannot duplicate from existing paid tools:

1. **Deep Research at 600 reports/mo** — Claude can browse but doesn't have a 5–10-min autonomous research orchestrator
2. **NotebookLM** — no other tool does grounded multi-source chat with audio overviews
3. **Veo 3 / Flow video** — no video model elsewhere in the stack
4. **Nano Banana Pro images** (vs Stitch/Imagen elsewhere — depends if Stitch is being paid for)
5. **Gemini in Workspace** — Claude/Codex don't touch Gmail/Docs/Sheets natively
6. **Jules async agent** — no async background-task model in the current stack

## What's redundant with current stack

These would not be missed if Pro were cancelled:

1. **Gemini 3.1 Pro chat** — Claude Opus 4.7 + GPT-5.5 already cover frontier reasoning
2. **AI Studio** — only useful if developing Gemini-specific features
3. **Code Assist / Antigravity** — Claude Code is already the primary IDE
4. **Search AI Mode** — overlaps with Deep Research

## Scenario-based decisions

### Scenario A: builder ships Example Marketplace + cancels Base44 by 2026-05-11
**Recommend KEEP Pro.** The freed $50 from Base44 covers 2x Pro. Deep Research + NotebookLM accelerate the post-migration content / launch / docs phase. Veo + image gen unlocks marketing assets at zero marginal cost.

### Scenario B: builder doesn't ship Example Marketplace, Base44 renews
**Recommend CANCEL Pro before trial ends.** Stack is already over-resourced; Pro adds a sixth concurrent context to manage when ship-velocity is the constraint, not capability gaps.

### Scenario C: builder pivots to content/marketing-led growth
**Recommend KEEP Pro AND pilot heavy Veo/Flow/NotebookLM use.** Combined with MiMo's free TTS suite, the builder has a free-or-cheap audio+video+image content factory.

## Cost arithmetic

```
Stack cost (today, all paid):
  Claude Max     $500
  GPT Business   $ 30
  MiMo standard  $  0   (subscription window)
  Base44         $ 50
  Google AI Pro  $ 22   (€21.98 ≈ $24, post-trial)
                 ----
                 $626/mo

If Base44 cancels post-migration:
  ... above minus Base44 = $576/mo
  ... net change after adding Pro: -$28/mo (a SAVING of $28)

If both Pro and Base44 cancel:
  ... = $530/mo
  ... net loss of unique capabilities: Deep Research, NotebookLM, Veo, Nano Banana, GMail/Docs/Sheets AI, Jules, Cloud credit, 5TB storage
```

The cost-per-unique-capability of Pro ($22/mo for 7+ unique surfaces) is the lowest in the stack.

## Recommended action (concierge ship-lens framing)

**Inside the trial window** (next ~24 days):
1. Activate the **$10/mo Cloud credit** today — it's free leverage independent of any other decision
2. Run **one Deep Research report** on the actual example-marketplace-migration question — concrete, useful, validates the tool
3. Generate **2 Veo 3 marketing clips** for example-marketplace or distrilicious (uses 100 of 100 Flow credits — fine, this is the trial)
4. Pilot **Jules** on a low-stakes async task (e.g., "audit svc-e2e-test for cleanup")
5. Decide before trial expires whether ongoing $22/mo is worth the 7 unique capabilities

If 1–4 deliver tangible value → keep. If they sit unused → cancel.
