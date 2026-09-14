# WI-400 Design — `ad-video-script` skill

Design brief for the new skill. Feeds `plan-changeset`. Includes the output contract and **worked 60-second scripts** that demonstrate the "one base, or many if it qualifies" directive.

---

## 1. The role the skill models — Senior DR Creative Strategist

The skill writes as the person a brand hires to make performance video that converts — **not** a copywriter who hands off. The defining trait is ownership of the data loop.

- **Mental model:** the ad is a *funnel inside 30–60 seconds*, diagnosed in sequence — thumb-stop → hold → CTR → CPA/ROAS. Failure is traced to the exact second it happened.
- **The hook (first 3s) is the highest-leverage variable.** Nobody watches the body of an ad they didn't stop for.
- **Native-to-platform feel beats production value** — an ad that looks like an ad gets scrolled and throttled.
- **Awareness-stage matching (Schwartz's 5 levels: Unaware → Problem → Solution → Product → Most-Aware)** — same product, different script per stage. "Most failures are targeting failures, not messaging failures."
- **Modular "Lego-block" scripting** — hooks / bodies / proof / CTAs are interchangeable parts so a hook A/B-tests against a held-constant body.
- **Junior vs expert:** a junior writes a structurally-correct but generic script; the expert reads a losing ad and names the exact second + module that failed, and transplants *why* a competitor angle works.

The skill encodes the **expert** version of this: diagnosis-first, awareness-aware, modular, swipe-grounded.

---

## 2. Inputs (the brief)

| Field | Required | Notes |
|---|---|---|
| `product` + mechanism | ✅ | what it is, why it works |
| `icp` / persona | ✅ | pains, jobs-to-be-done, objections (pull from `build-personas` if present) |
| `offer` | ✅ | price, guarantee, bonus |
| `angle` | optional | the wedge; skill generates ranked angles if omitted |
| `awareness_stage` | optional | defaults to Problem-Aware for cold; skill can fan out across stages |
| `placement` | ✅ | feed-ad / landing-explainer / pdp / launch (drives template + metric + length) |
| `duration_s` | optional | defaults 60; down-cuts to 30/15 as qualifying variants |
| `swipe[]` | optional | winning-ad references (transcripts + the metric that won) — the single biggest quality lever |
| `target_kpi` | optional | hook rate / hold rate / CTR for this test |

---

## 3. Placement-aware logic — the switch behind "many if it qualifies"

`placement` is first-class. It selects three things at once:

| Placement | Audience temp | Eval metric (gates v2 promotion) | Script frame | Native length |
|---|---|---|---|---|
| **feed-ad** (Meta/TikTok/Reels) | Cold | hook rate → hold → CTR → CPA/ROAS | hook-first, pattern-interrupt, UGC-native | 15–30s (60s qualifies on YT/longer placements) |
| **landing-explainer** (site hero) | Warm (already on site) | watch-through, page CVR | product mechanism, demo, proof | 30–90s |
| **pdp** (e-commerce product page) | Warm–hot | add-to-cart, CVR | feature→benefit, objection-handling, social proof | 20–60s |
| **launch** (announcement) | Mixed | views, signups, share rate | narrative, "what's new + why it matters" | 30–90s |

### The "one or many" rule (AC3/AC4)
```
variants = []
for each qualifying (placement × awareness_stage):           # qualifying = supported by brief + native length fits
    variants.append( render(placement, awareness_stage, duration_s) )
    if placement.native_length allows a shorter cut:
        variants.append( downcut(variant, [30, 15]) )         # additional qualifying duration variants
emit 1 base script when only one (placement, stage) qualifies; emit many otherwise.
```
A 60s base is always produced when the placement supports it; shorter cuts and alternate placements/stages are emitted **only when they qualify**, so the user gets one focused script or a full test matrix — never noise.

---

## 4. Output contract — the modular script spine (JSON) + human render

```json
{
  "product": "Reset — magnesium + L-theanine sleep drink",
  "placement": "feed-ad",
  "awareness_stage": "problem-aware",
  "duration_s": 60,
  "angle": "the 3am-wake-up that melatonin can't fix",
  "hook": [
    {"t": "0-3s", "line": "If you keep waking up at 3am and can't get back down — this is for you.", "type": "callout+problem-snap"}
  ],
  "body_modules": [
    {"t": "3-12s", "beat": "problem-agitate", "vo": "...", "visual": "..."},
    {"t": "12-38s", "beat": "mechanism+demo", "vo": "...", "visual": "..."},
    {"t": "38-50s", "beat": "proof", "vo": "...", "visual": "..."}
  ],
  "proof": ["30,000+ subscribers", "no melatonin hangover", "third-party tested"],
  "cta": {"t": "50-60s", "line": "Tap Shop Now — first week's free if it doesn't work.", "offer": "risk-reversal"},
  "b_roll_notes": "phone-shot, kitchen at night, real hands; route any generated B-roll via generate-visuals → Veo 3",
  "variant_of": null
}
```
Plus a human-readable timecoded render (see §6). The JSON spine is what makes scripts machine-diffable and variant-ready (hold body, swap hook).

---

## 5. Relationship to existing skills (no duplication)

| Existing | Overlap | Boundary |
|---|---|---|
| `social-content` (external addon) | short-form video scripting / hooks | `social-content` = organic, broad platforms; `ad-video-script` = **paid performance**, awareness-staged, eval-gated, placement matrix. Cross-link, don't merge. External addon = not editable in place → new skill is correct. |
| `ad-creative` (external addon) | ad copy at scale | `ad-creative` = headlines/primary-text/RSA (static & text); `ad-video-script` = **video scripts** (timecoded, modular, b-roll). Complementary. |
| `generate-visuals` (native, included) | asset routing incl. Veo 3 video | **Reuse as-is** for any generated B-roll/motion. `ad-video-script` produces the *script*; hands visual generation to `generate-visuals`. |
| `build-personas` / `validate-feature` (native) | ICP, offer, pains | **Reuse as input source.** |
| `copywriting` (external addon) | persuasion copy | page copy, not timecoded video. |

---

## 6. WORKED EXAMPLE — 60s script, one base + qualifying variants (goal artifact)

**Product fixture:** *Reset* — a magnesium + L-theanine night-time sleep drink (DTC). Pain: 3am wake-ups, melatonin grogginess. Offer: first week free if it doesn't work.

> ⚠️ **Illustrative fixture — fictional product, placeholder claims.** Every concrete proof figure below ("30,000+ subscribers", "third-party tested") is an invented placeholder to show script *shape*, not a real stat. In production the skill MUST source proof from the brief's `proof[]` input and MUST NOT fabricate numbers/claims — unsubstantiated proof is marked `<TBD: needs real figure from brief>` (no-fabrication rule + ad-platform substantiation/legal risk). This is enforced in `self_verify` §8.

### 6a. BASE — feed-ad · Problem-Aware · 60s
```
[0–3s]  HOOK (phone-shot, woman in dark kitchen, whispering)
        "If you wake up at 3am and just lie there staring at the ceiling — watch this."
[3–12s] PROBLEM-AGITATE
        "It's not that you can't fall asleep. You fall asleep fine. It's the 3am wake-up —
         and then you're doing math on how many hours you've got left. Melatonin just made me
         groggy the next morning, so I stopped."
[12–38s] MECHANISM + DEMO (stirs a sachet into water at the sink)
        "So my doctor friend told me it's usually low magnesium plus a racing brain. This is
         magnesium glycinate — the kind that actually absorbs — with L-theanine to quiet the
         mental chatter. No melatonin. You stir one in 30 minutes before bed."  (drinks, lights out)
[38–50s] PROOF
        "First night I slept through till my alarm. It's been three weeks. 30,000 people are on
         this now and it's third-party tested — I checked because I'm paranoid about supplements."
[50–60s] CTA (risk-reversal)
        "Tap Shop Now. They'll give you the first week free — if you still wake up at 3am, you
         pay nothing. That's the only reason I tried it."
```
hook type: callout + problem-snap · target_kpi: hook rate ≥30%, hold ≥30% · eval: CPA/ROAS

### 6b. VARIANT — feed-ad · **Most-Aware** (retargeting) · 30s downcut *(qualifies: same placement, warmer stage)*
```
[0–3s]  "Still thinking about the Reset sleep drink? Here's your sign."
[3–18s] "You already know the 3am thing — magnesium + L-theanine, no melatonin hangover.
         The only thing between you and sleeping through tonight is this." (stir + drink)
[18–30s] "First week's free. If you still wake up at 3am, you don't pay. Tap Shop Now."
```
*Same body DNA, hook swapped for the warm audience, CTA leads with the risk-reversal they've already seen.*

### 6c. VARIANT — **landing-explainer** · Solution-Aware · 60s *(qualifies: different placement → different metric + frame)*
```
[0–5s]  "Here's how Reset helps you sleep through the night — in about a minute."
[5–25s] MECHANISM (clean product demo, on-screen labels)
        "Two ingredients, both clinically studied: magnesium glycinate for the body, L-theanine
         for a racing mind. No melatonin — so no next-day grogginess, and nothing habit-forming."
[25–45s] HOW IT WORKS / DEMO  "One sachet, 8oz water, 30 minutes before bed. That's the whole ritual."
[45–60s] PROOF + CTA  "30,000+ nightly subscribers, third-party tested. Start with a free week —
         see how you sleep before you pay for a thing."
```
*Warm-traffic frame: leads with mechanism not pattern-interrupt; metric = watch-through + page CVR, not thumb-stop.*

> **Demonstrates the directive:** a single brief produced **one base 60s feed-ad script** plus **2 qualifying variants** (a warmer-stage 30s cut on the same placement, and a different-placement 60s explainer with a different success metric). A brief with only `placement: feed-ad` + one stage would have produced exactly one 60s script.

---

## 7. v2 hook (→ WI-401, documented not built)
The skill writes each shipped script's spine to an append-only `campaigns.jsonl` (episodic). WI-401's `ad-strategist` agent then closes the loop: ingest CTR/hook-rate/CPA → eval-gate (`hook_rate ≥ bar`) → promote winners to `winning-examples.jsonl` (procedural bank) → distill scored heuristics into a bounded playbook (semantic, ExpeL-style confidence ±1) → retrieve top-k winners into the next brief. This reuses svc's existing `learnings.jsonl + confidence` pattern, retargeted at campaign outcomes. **No feedback infra ships in WI-400.**

## 8. Draft `self_verify` (hardened in plan-changeset)
1. Every script has a hook in the first 3s tagged with a hook type.
2. `placement` selected a template + an eval metric (not a generic default).
3. Awareness stage stated and the frame matches it (cold→pattern-interrupt; warm→mechanism).
4. Body is modular (hook swappable against held-constant body).
5. Proof + CTA present; CTA names the offer/risk-reversal.
6. Multi-variant output emitted iff ≥2 (placement × stage) qualified; else single script.
7. Any generated B-roll routed to `generate-visuals`, not invented inline.
8. **No fabricated proof OR features.** Every concrete claim/stat in `proof[]` and every product feature named traces to a brief/product input; anything unsubstantiated is emitted as `<TBD: needs real figure from brief>`, never invented (no-fabrication rule + ad-platform substantiation). The Example Marketplace case below shows why: a generic tool invented QR/skip-line/AI-matchmaking features the product does not have.

---

## 9. Video-production reality (grounds the output format + the Producer split)

The script is not the deliverable — a *rendered, consistent 60s video* is. Sourced 2026 tooling research establishes hard constraints the skill MUST design around:

- **No model renders a coherent 60s clip in one shot.** Per-generation ceiling: Veo 3.1 **8s**, Runway 5/10s, Kling 5/10s, Pika 10s, MiniMax 6/10s; only Sora 2 reaches 16–20s. (Sources: ai.google.dev/gemini-api/docs/video, developers.openai.com.) → a 60s ad = **~6 beats × ~10s, chained**, not one generation. *(This is the wall the user hit: "apparently you can't make more than 10 sec.")*
- **Continuity is won at the keyframe + last-frame seeding**, not by editing: generate a consistent first-frame per beat (Nano Banana Pro / Veo "Ingredients" 3 refs / Runway References / Kling Elements), image-to-video it, then seed beat N+1 from beat N's final frame — or use Veo 3.1 native **scene-extension** (7s/hop → 148s, audio inherited).
- **Audio:** one continuous music+VO bed under the 60s (ElevenLabs VO sync API; music = Suno/Udio via unofficial wrapper — flagged supply-chain risk), ducked via ffmpeg `sidechaincompress`.

**→ Output-format consequence for WI-400:** the skill emits a **BEAT SHEET** (6 × ~10s), each beat carrying shot description, the persistent character/product, camera, a ready-to-generate **first-frame image-prompt** + **motion-prompt (i2v)**, and a `seed_from_prev` chaining flag. The flat 60s render is a *view*; the beat sheet is the machine-usable artifact the renderer consumes.

**→ Why it is TWO agents (answers the user's "maybe we need other agent"):**

| Agent | Job | Wields | Tier |
|---|---|---|---|
| **`ad-strategist`** (WI-401) | per-product + per-scenario script → beat sheet; awareness/placement; levels up from CTR/CPA | `ad-video-script` skill, `build-personas`, swipe retrieval | STRAT/PLAN |
| **`ad-video-producer`** (WI-402, NEW) | beat sheet → consistent clips → stitch → audio. Owns the 10s ceiling, continuity tricks, the render APIs | `generate-visuals` extended (Veo 3.1 + Nano Banana keyframes + ffmpeg + ElevenLabs) | EXEC |

Strategist owns *what to say*; Producer owns *how to render it consistently*. `generate-visuals` already routes to Veo 3 — the Producer extends it into a chained-beat pipeline, not from zero.

**Recommended render stack (default Path A — fewest seams):** beat sheet → **Nano Banana Pro** keyframe per beat (same 3 char/product refs) → **Veo 3.1** image-to-video + native scene-extension → **ElevenLabs** VO + music bed → **ffmpeg** ducked mux. Aggregator escape hatch (**fal.ai / Replicate**, one key) for Kling/Runway when a shot needs a different look. Suno/Udio gated behind a swappable music interface (unofficial APIs).

## 10. REAL worked example — Example Marketplace (the per-product grounding lesson)

**Why it matters:** the first attempt modeled Example Marketplace as a *consumer break-finder* (tech worker finds coffee/burger deals, skip-line, QR). The **live landing page (example-marketplace.app, rendered)** says the opposite — a **merchant-side SaaS for independent café/salon/restaurant owners**: *"Fill empty seats with your loyalty list,"* fire a **30-min Flash Offer** to your own followers, auto-stamp loyalty, **keep the customer data**, **0% commission vs Groupon's 50%.** Founder-led ("Diana," early-access beta, *"200+ owners across 14 cities"* — the only real traction stat). The first script sold the wrong product to the wrong person — a **targeting failure**, the exact thing the strategist role guards against — and invented non-existent features. The single biggest quality unlock is reading the *actual product* first.

**Scenario axis (answers "different scenario"):** Example Marketplace is multi-sided → ≥2 valid ad scenarios: **owner-acquisition** (the real buyer; CTA *"Start free trial, 30 days no card"*) and **consumer-acquisition** (the loyalty side). Strongest = owner-acquisition, below.

### 60s owner-acquisition script — 6 × 10s beats (built for chunk-and-chain)
Character lock (repeat verbatim across all beats): **"Maya, mid-30s independent café owner, warm, dark curly hair, mustard apron, in her sunlit cream-and-wood café."** Style lock: warm cream/beige (#FAF6EE) + orange accent (#E78A3B), Inter captions, cozy-but-techy.

| Beat | t | VO / caption | First-frame image → motion prompt |
|---|---|---|---|
| 1 Dead hour | 0–10 | "Tuesday, 3pm. The room's half empty — and that hour's never coming back." | IMG: Maya (lock) leaning on café counter, empty tables behind, warm 3pm window light, melancholic. MOTION: slow push-in, she sighs at empty seats |
| 2 The old trap | 10–20 | "You used to fill it by paying a discount platform half your margin — to rent a stranger who never comes back." | IMG: same Maya, close on phone showing a generic deal-dashboard "−50% fee", a stranger leaving the door. MOTION: she shakes her head. `seed_from_prev` |
| 3 The switch | 20–30 | "So she stopped. One tap — a 30-minute Flash Offer, only her regulars see it." | IMG: same Maya, clean Example Marketplace UI, orange "Drop a Flash Offer" button, 30:00 timer. MOTION: thumb taps, UI confirms. `seed_from_prev` |
| 4 It fills | 30–40 | "Push fires. No algorithm, no auction. The regulars come — and the seats fill." | IMG: same café, door opening, 3–4 happy regulars entering, Maya smiling. MOTION: people fill the tables. `seed_from_prev` |
| 5 Keep the list | 40–50 | "Every visit stamps itself. The list belongs to her — not the platform. Zero commission." | IMG: same café, phone showing a loyalty stamp + customer profile, "0% fee". MOTION: stamp lands, profile fills. `seed_from_prev` |
| 6 Win + CTA | 50–60 | "Example Marketplace. Fill empty seats with your loyalty list. Start free — 30 days, no card." | IMG: same café now full and lively, Maya beaming; cut to Example Marketplace logo on cream bg. MOTION: warm hold, logo + CTA fade in. `seed_from_prev` |

Audio: one warm hopeful indie-electronic bed (builds to beat 6) + one ElevenLabs VO, ducked. Hook in beat 1's first 3s. Optional real proof caption in beat 6: *"200+ owners, 14 cities"* (only real stat on the page — nothing else invented).

> Demonstrates the full chain: **read real product → correct ICP + scenario → 6×10s beat sheet → per-beat generation prompts with character/style lock + last-frame seeding** — exactly the artifact the Producer agent (WI-402) renders.
