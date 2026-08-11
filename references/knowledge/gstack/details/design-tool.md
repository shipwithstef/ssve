# gstack Design Tool — Details

## Mechanism

`$D` CLI binary for AI-powered UI mockup generation using OpenAI's GPT Image API
(Responses API with `image_generation` tool). 13 commands, Bun/TypeScript.

### Commands

| Command | Mechanism | Key Detail |
|---|---|---|
| `generate` | Responses API + image_generation → PNG | Session JSON created, optional vision quality check with retry |
| `variants` | 7 style variations + staggered parallel (1.5s gap) | Styles: bold, calm, warm, corporate, dark, playful. Exponential backoff on 429 |
| `iterate` | `previous_response_id` threading | Fallback: re-generate with brief + last 5 feedback items. Feedback sandboxed in `<user-feedback>` tags |
| `check` | GPT-4o vision quality gate | 3 checks: text readability, layout completeness, visual coherence. PASS/FAIL output |
| `compare` | Self-contained HTML comparison board | Base64-embedded images, star ratings, pick radio, per-variant feedback, "More like this" |
| `diff` | GPT-4o vision comparison | Returns differences with area/severity, summary, matchScore 0-100 |
| `evolve` | 2-step: vision analyze → image_generation | Analyze existing screenshot, then generate improved version |
| `verify` | Compare mockup vs live screenshot | Pass if matchScore >= 70 and no high-severity diffs |
| `prompt` | GPT-4o vision → JSON | Extracts implementationPrompt, colors, typography, layout, components |
| `extract` | GPT-4o vision → DESIGN.md | Writes structured design language (colors, typography, spacing, layout, mood) |
| `gallery` | Reads ~/.gstack/projects/$SLUG/designs/ | Self-contained HTML timeline, sorted newest-first, approved badge |
| `serve` | Bun HTTP server for comparison board | State machine: SERVING → DONE/REGENERATING. Auto-opens browser. Timeout kills |
| `setup` | Guided API key setup + smoke test | Saves to ~/.gstack/openai.json with 0o600 permissions |

### Source Files (17)

| File | Lines | Role |
|---|---|---|
| cli.ts | ~285 | CLI dispatcher |
| commands.ts | ~60 | Command registry with descriptions and flags |
| generate.ts | ~160 | Core generation via Responses API |
| variants.ts | ~249 | Parallel variant generation with style variations |
| iterate.ts | ~196 | Multi-turn iteration with response threading |
| check.ts | ~100 | Vision-based quality gate |
| compare.ts | ~628 | HTML comparison board generation |
| diff.ts | ~104 | Visual diff between mockups |
| evolve.ts | ~151 | Screenshot → improved mockup pipeline |
| design-to-code.ts | ~88 | Extract implementation instructions from mockup |
| memory.ts | ~202 | Extract/write design language to DESIGN.md |
| gallery.ts | ~251 | Design history timeline HTML |
| serve.ts | ~255 | HTTP server for comparison board feedback |
| session.ts | ~79 | Session file management (JSON in /tmp) |
| brief.ts | ~60 | Structured DesignBrief → prompt conversion |
| auth.ts | ~50 | API key resolution (file → env → guided setup) |
| prototype.ts | ~130 | Validation prototype (3 test briefs) |

### Design-Shotgun Pipeline

```
/design-shotgun
  → User describes what they want
  → $D variants --count 4-6 (parallel mockup generation)
  → $D compare (HTML comparison board)
  → $D serve (HTTP server, opens browser)
  → User picks favorites + leaves feedback
  → $D iterate (generates new round with feedback)
  → Repeat until user approves
  → $D extract (writes DESIGN.md)
  → Hand off to /design-html for production code
```

State machine: SERVING → DONE (user submits) or SERVING → REGENERATING (user
requests new variants). Feedback written to `feedback-pending.json`.

## Analysis

The design tool brings visual design generation into the AI coding workflow.
The comparison board approach (generate variants → user picks → iterate) is
more effective than single-shot generation because it gives the user visual
options rather than requiring verbal descriptions.

The session threading via `previous_response_id` enables true multi-turn
design iteration without re-sending full context. The fallback to re-generation
with accumulated feedback handles API limitations gracefully.

The vision-based quality gate (check) and mockup-vs-live verification (verify)
close the loop between design and implementation.

Key limitation: depends entirely on OpenAI's GPT Image API. No local generation.

## L4 Pointers

- Design source: `design/src/` (17 files)
- Design tests: `design/test/` (3 test files)
- Design doc: `docs/designs/DESIGN_TOOLS_V1.md` (623 lines, full architecture)
- Design shotgun doc: `docs/designs/DESIGN_SHOTGUN.md` (452 lines, state machine + edge cases)
