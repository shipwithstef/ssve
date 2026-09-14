---
name: ad-video-script
version: "1.0"
description: >
  Performance ad-video script writer modeled on a Senior Direct-Response
  Creative Strategist. Reads the ACTUAL product first (landing page / spec),
  picks the right ICP + scenario + placement + awareness stage, then writes a
  modular script AND a render-ready BEAT SHEET (6 × ~10s beats with per-beat
  first-frame image-prompt, motion-prompt, persistent-character lock, and
  last-frame seeding) — because no video model renders a coherent 60s clip in
  one shot (Veo 8s; Runway/Kling/Pika ~10s). Emits one base script, or many
  variants when ≥2 placements or awareness stages qualify. Hands the beat
  sheet to `produce-ad-video` (WI-402) to render. Use when "ad video script",
  "video ad", "UGC script", "promo video script", "60 second ad", "make an ad
  for <product>", or any WI tagged ad-video / performance-creative. Do not use
  for remux/I2V/audio-fix of an existing cut — that is `produce-ad-video`.
inputs:
  required:
    - { path: "docs/specs/vision.md", artifact: product-source, note: "the REAL product — read the live landing-page URL via curl, or this spec / docs/specs/vision.md. Grounding is mandatory step 1." }
  optional:
    - { path: "docs/specs/personas/", artifact: personas, note: "ICP source (build-personas)" }
    - { path: "docs/specs/ad-scripts/<product>/swipe/", artifact: swipe-file, note: "winning-ad references + the metric that won — biggest quality lever" }
    - { path: "docs/specs/marketing-context.md", artifact: marketing-context }
outputs:
  produces:
    - { path: "docs/specs/ad-scripts/<product>/<scenario>-<placement>.md", artifact: ad-script, note: "human-readable script + beat sheet" }
    - { path: "docs/specs/ad-scripts/<product>/<scenario>-<placement>.beatsheet.json", artifact: beat-sheet, note: "machine-usable; produce-ad-video renders this" }
phases:
  - { id: P1-ProductGrounding, required_for_completion: true, evidence: "real product read in-session (URL fetched or spec read); product facts + ICP + offer + real proof extracted, no invented features" }
  - { id: P2-ScenarioAndPlacement, required_for_completion: true, evidence: "scenario (which audience) + placement + awareness stage selected; eval metric set per placement" }
  - { id: P3-AngleAndScript, required_for_completion: true, evidence: "angle chosen; modular script spine written (hook in first 3s, problem, demo/mechanism, proof, CTA)" }
  - { id: P4-BeatSheet, required_for_completion: true, evidence: "6×~10s beat sheet emitted with per-beat image-prompt + motion-prompt + character lock + seed_from_prev flags" }
  - { id: P5-VariantRule, required_for_completion: true, evidence: "one base emitted; additional variants emitted iff ≥2 (placement×stage) qualify" }
  - { id: P6-SelfVerifyContinuation, required_for_completion: true, evidence: "self-verify complete; producer handoff noted; no fabricated proof or features" }
chain:
  lanes: {}
  progressive: false
  self_verify: true
  human_checkpoint: false
---

> **Cognitive routing:** 🧠 [STRAT] for product grounding + angle + scenario (the creative judgment); ⚙️ [EXEC] for beat-sheet mechanics. This skill writes the *script*; rendering is `produce-ad-video`.

# Ad Video Script

Writes performance ad-video scripts the way a **Senior Direct-Response Creative Strategist** would — not a generic copywriter. The defining trait: it reads the *actual product* first and owns the data loop, so it never sells the wrong product to the wrong person.

**Announce at start:** "I'm using ad-video-script to write a grounded, render-ready ad for <product>."

## The role it models (the mental model)

- The ad is a **funnel inside 30–60 seconds**, diagnosed in sequence: thumb-stop → hold → CTR → CPA/ROAS. Failure is traced to the exact second it happened.
- **The first 3 seconds (the hook) is the highest-leverage variable.** Nobody watches the body of an ad they didn't stop for.
- **Native-to-platform feel beats production value.**
- **Match the message to the awareness stage** (Schwartz: Unaware → Problem → Solution → Product → Most-Aware). Same product, different script per stage. *What fails depends on the platform: **targeting-led on Search/LinkedIn** (identity/keyword filters carry it); **creative-led on Meta/TikTok** post-Andromeda (a weak hook can't be rescued by precise targeting — see Platform doctrine).*
- **Modular "Lego-block" scripting** — hook / body / proof / CTA are swappable so a hook A/B-tests against a held-constant body.

## Before Starting

Build a bounded context plan before writing (see `_shared/before-starting.md`): read the active session contract / WI, the **product source** (the live landing-page URL via `curl`, or `docs/specs/vision.md`), `docs/specs/personas/` for the ICP, and any swipe file — expanding dependencies via `.svc/spec-index.json`. Do not read every spec; equally, do not stop at the minimum — read whatever changes the script: the real product mechanic, the offer, the audience, and the brand voice. Grounding in the actual product (Step 1) is the load-bearing input.

## Step 1 — Ground in the REAL product (MANDATORY, do not skip)

Read the actual product in-session **before writing a word**: fetch the landing-page URL, or read the spec / `docs/specs/vision.md`. Extract: what it actually is, the core mechanic, the real ICP (who pays), the offer/CTA, brand tone, and **only real proof stats**.

> ⚠️ **The failure this prevents:** a generic tool wrote a merchant SaaS (Example Marketplace — café-owner tool) as a *consumer* break-finder, targeting the wrong person and inventing features (QR / skip-line / AI-matchmaking) the product never had. Grounding is the #1 quality lever. **Never invent product features or proof stats** — anything unconfirmed is `<TBD: needs real figure from brief>` (see Self-Verify #6).

## Step 2 — Scenario + placement + awareness stage

**Scenario** = which audience this ad targets. Multi-sided products have ≥2 (e.g. owner-acquisition vs consumer-acquisition). Pick the scenario that matches the product's primary buyer/CTA unless told otherwise.

> **Platform doctrine (creative-vs-targeting / format):** before locking placement + format, consult the ad-strategist **platform doctrine** (Andromeda-era priors, `agents/ad-strategist.md`): on Meta/TikTok creative carries the result (put audience identifiers in hooks, not filters); on a Meta feed placement surface a static-volume comparator rather than defaulting to one polished 60s clip. Pointer only — the doctrine lives in the agent, not here.

**Placement** is first-class — it switches the template, the swipe corpus, AND the success metric:

| Placement | Audience temp | Eval metric | Frame | Native length |
|---|---|---|---|---|
| **feed-ad** (Meta/TikTok/Reels) | Cold | hook rate → hold → CTR → CPA | hook-first, pattern-interrupt, UGC-native | 15–30s (60s on YT/longer) |
| **landing-explainer** (site hero) | Warm | watch-through, page CVR | mechanism, demo, proof | 30–90s |
| **pdp** (product page) | Warm–hot | add-to-cart, CVR | feature→benefit, objection-handling | 20–60s |
| **launch** (announcement) | Mixed | views, signups, shares | narrative, "what's new + why" | 30–90s |

## Step 3 — Angle + modular script spine

Pick the **angle** (the wedge into the pain — generate ranked angles from ICP × awareness × swipe if not given), then write the spine for the chosen placement:
`Hook (0–3s) → Problem/Agitate → Solution/Mechanism/Demo → Proof → CTA (offer/risk-reversal)`. Front-load the good stuff. Keep modules swappable.

## Step 4 — Emit the BEAT SHEET (the render-ready artifact)

Because no model renders a coherent 60s clip in one shot, split the script into **~10s beats** (≈6 for a 60s spot; proportionally fewer for 30s/15s cuts — each beat stays ≤~10s). Each beat carries:
- `beat`, `t` (e.g. "0-10s"), `vo` (voiceover/caption)
- `image_prompt` — the **first-frame** still to generate (repeat the **character lock** verbatim every beat)
- `motion_prompt` — the image-to-video motion
- `seed_from_prev` — `true` for beats 2–6 (seed this beat from the previous beat's **last frame** so cuts are continuous)
- a **character lock** line + a **style lock** line, defined once and repeated

```json
{
  "product": "<from step 1>",
  "scenario": "owner-acquisition",
  "placement": "feed-ad",
  "awareness_stage": "problem-aware",
  "duration_s": 60,
  "angle": "<the wedge>",
  "character_lock": "<persistent subject described identically every beat>",
  "style_lock": "<palette + type + vibe, from the real brand>",
  "beats": [
    {"beat":1,"t":"0-10s","vo":"<hook, lands in first 3s>","image_prompt":"<first frame incl character_lock>","motion_prompt":"<motion>","seed_from_prev":false},
    {"beat":2,"t":"10-20s","vo":"...","image_prompt":"...","motion_prompt":"...","seed_from_prev":true}
  ],
  "audio":{"vo":"one continuous track (ElevenLabs)","music":"one bed, ducked under VO"},
  "proof":["<only real stats; else TBD>"],
  "cta":{"line":"<names the offer/risk-reversal>"},
  "variant_of": null
}
```

## Step 5 — One base, or many if it qualifies

```
for each qualifying (placement × awareness_stage):     # qualifying = supported by the brief + native length fits
    emit a beat sheet
    if the placement allows a shorter cut: also emit a 30s / 15s downcut
emit ONE base when only one (placement, stage) qualifies; emit MANY otherwise.
```
Single placement + single stage → one focused script. Don't manufacture noise.

## Step 6 — Hand off to the producer

The beat sheet is consumed by the **`produce-ad-video`** skill (WI-402 / `ad-video-producer` agent). This skill stops at the beat sheet; it does not render.

## Relationship to existing skills (no duplication)

| Skill | Boundary |
|---|---|
| `social` (addon) | organic short-form; this = **paid performance**, awareness-staged, placement-matrixed, beat-sheeted |
| `ad-creative` (addon) | static/text ad copy (headlines/RSA); this = **video scripts** (timecoded, modular) |
| `generate-visuals` (native) | **reused** by the producer for asset/B-roll routing (already routes to Veo 3) |
| `build-personas` / `validate-feature` | **reused** as ICP/offer inputs |
| `ad-strategist` agent (WI-401) | the agent that *wields* this skill and levels up from CTR/CPA |

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | Product grounded in-session | ICP/offer/mechanic/real-proof extracted from the actual product (URL fetched or spec read), not assumed | |
| 2 | Scenario + placement + awareness chosen | each is named; the eval metric is set per the placement table | |
| 3 | Hook lands in first 3s | beat 1's vo delivers the hook within 0–3s and is tagged with a hook type | |
| 4 | Beat sheet valid | beats are ≤~10s and scale to the target duration (≈6 for 60s, ≈3 for 30s, 1–2 for 15s); each has `image_prompt` + `motion_prompt` + character lock; every beat after the first is `seed_from_prev:true` | |
| 5 | One-or-many rule honored | one base emitted; multiple variants iff ≥2 (placement × stage) qualified | |
| 6 | No fabricated proof OR features | every stat/feature traces to the product; unconfirmed → `<TBD: needs real figure>` | |
| 7 | Producer handoff noted | beat-sheet path emitted; no rendering attempted in this skill | |

## Pipeline Continuation

`ad-video-script` is a utility/sidecar skill (no fixed lane position — `chain.lanes: {}`). It is invoked on demand by the `ad-strategist` agent, by `route-workflow` for ad-video / performance-creative WIs, or standalone.

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`)
- Treat `Invoke: /skill-name` in the task description and `metadata.skill` as routing instructions, not explanatory prose
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume
- In Claude Code: mirror file state with `TaskList` / `TaskUpdate`; in Kimi use `/task` or `TaskList` / `TaskOutput` only as observation while the file remains authoritative; in Codex and other hosts without native task-mutation APIs: mirror only the active step in `update_plan`
- Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror; record phases P1–P6 via `record-phase`

**Next:** hand the beat-sheet path to **`produce-ad-video`**. `--progressive`: none (sidecar). `--skip`: skip when a current beat sheet for the same (product, scenario, placement) already exists and the product has not changed.

## Phase receipts

Record P1–P6 via `scripts/task-graph.mjs record-phase` against the active `.svc/lane-tasks-<WI>.json` when run inside a WI; standalone runs may skip the ledger.
