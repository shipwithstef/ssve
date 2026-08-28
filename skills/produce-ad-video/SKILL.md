---
name: produce-ad-video
version: "1.0"
description: >
  Render and finish an ad/launch/promo video from a beat sheet or an existing
  picture cut: image-to-video shots, VO + one ducked music bed, ffmpeg assemble,
  listen/spectrogram QA, and VM delivery. Use when producing or remuxing a
  video ad, fixing pumping/whistle/too-hot/silent audio, stitching I2V clips,
  burning captions, or writing masters to ~/delivery. Complements
  ad-video-script (that skill writes the beat sheet; this one makes the file).
  Use even if they say "fix the video", "Grok I2V", "remux audio", or
  "delivery the masters".
inputs:
  required:
    - { path: "docs/specs/ad-scripts/", artifact: beat-sheet-or-cut, note: "beat sheet from ad-video-script, or an existing picture.mp4 + stems when fixing a cut" }
  optional:
    - { path: "docs/specs/vision.md", artifact: product-source }
    - { path: "docs/specs/marketing-context.md", artifact: marketing-context }
outputs:
  produces:
    - { path: "docs/specs/ad-scripts/<product>/<scenario>.render.json", artifact: render-provenance, note: "per-beat tool/model/seed" }
    - { path: "docs/specs/ad-scripts/<product>/DELIVERY-RECEIPT.md", artifact: delivery-receipt, note: "repo copy of ~/delivery/<slug>/DELIVERY-RECEIPT.md; binaries stay on the VM, Windows is a pull" }
phases:
  - { id: P1-WatchExisting, required_for_completion: true, evidence: "stills + spectrogram/ebur128 files from this run exist on disk for the complained window; do not skip on a 'fix audio' WI" }
  - { id: P2-LockPictureVsAudio, required_for_completion: true, evidence: "stated whether picture is kept (-c:v copy) or which shots re-I2V and why" }
  - { id: P3-RenderOrRemux, required_for_completion: true, evidence: "shots assembled or remuxed; I2V prompts avoid particle/breath metaphors; audio mix from stems once" }
  - { id: P4-InstrumentQA, required_for_completion: true, evidence: "ebur128 + spectrogram + stills of problem windows; no second loudnorm; PCM→AAC once" }
  - { id: P5-DeliverReceipt, required_for_completion: true, evidence: "~/delivery/<slug>/ has masters + receipt with SHA and paid_media=PENDING_FOUNDER_WATCH; pull command named, not executed as a C:\\ write" }
  - { id: P6-SelfVerifyContinuation, required_for_completion: true, evidence: "self-verify table filled; ad-video-script not rewritten" }
chain:
  lanes: {}
  progressive: false
  self_verify: true
  human_checkpoint: true
  terminal: true
---

> **Cognitive routing:** ⚙️ [EXEC] for ffmpeg/I2V; 👁️ [SENSE] for stills and spectrograms. This skill **renders**. `ad-video-script` writes the beat sheet. `generate-visuals` routes stills.

# Produce Ad Video

**Announce at start:** "I'm using produce-ad-video to render/finish the cut, not rewrite the script."

Turn a beat sheet (or a locked picture + stems) into masters a founder can watch. No model makes a coherent 30–60s take; you chain short I2V shots, one VO, one bed, one encode.

`live-evidence: video-watch` — Playwright of a web page does not prove a `.mp4`. The gate is stills + spectrogram + ebur128 + founder sound-on/sound-off. See `references/delivery-and-watch.md`.

## Before anything

1. Read the beat sheet or the WI. Do not invent product features.
2. If a cut already exists, **watch it** (1 s stills across the timeline, 0.25 s on the complained window). For audio complaints, capture spectrogram + ebur128 **before remixing, remuxing, or overwriting any artifact**. Read-only ffmpeg analysis and still extraction are allowed. `references/audio-house-lock.md`.
3. Decide: keep picture (`-c:v copy`) vs re-I2V named shots. A UI/compositor win is not permission to regenerate every plate. An absurd I2V gag (particle puff, extra limbs) **is** permission to re-I2V **that** shot.

## Pipeline

### 1. Stills then motion

Lock each shot’s first frame (from `generate-visuals` or the project stills dir). Animate with I2V (6 s default). Seed shot N+1 from shot N’s last frame when the beat sheet says `seed_from_prev`.

Motion prompts: camera + body action only. Read `references/i2v-prompt-hygiene.md` before the first I2V call. On Grok/xAI ZDR, I2V needs `output.upload_url` — use the project relay script if the native tool 400s.

After each clip, extract stills at the risky times (not one thumbnail).

### 2. Mix audio from stems

VO + one bed, duck once, encode AAC once. Never loudnorm a finished mix. Never stack `sine=` as music. Never mux pings unless the beat sheet asked. If the only in-repo “instrumental” **is** a chirp/peep, do not ship it — say you need a licensed bed.

### 3. Assemble

Same fps/size for every shot → `concat` copy → burn captions if the cut uses overlays → mux audio. Re-encode video only when picture actually changed.

### 4. Instrument QA (blocks delivery)

- ebur128: I, LRA, true peak
- Spectrogram of the full mix and of any complained window
- Stills of every P0 visual
- SHA of video bitstream if you claimed “picture unchanged”

### 5. Deliver

`~/delivery/<slug>/` + receipt. Do not claim a Windows copy from a VM. Name the pull command. Receipt must set `paid_media_status: PENDING_FOUNDER_WATCH`. Paid-media PASS is a later founder acknowledgment of sound-on **and** sound-off, not this skill’s terminal state.

## Rationalization table

| Thought | Reality |
|---|---|
| “Loudnorm will make it broadcast-safe” | On a ducked mix it pumps the bed. Encode PCM→AAC; static TP makeup if needed. |
| “I can’t hear WAV in this chat, skip listen” | Spectrogram + 50 ms RMS + ebur128 **are** the listen. Skipping them is how peeps ship. |
| “Dust motes add cinema” | They render as powder from the mouth. Don’t write it. |
| “I’ll add a sine pad / ping for energy” | That’s the whistle. No licensed bed → say so, don’t fake one. |
| “Receipt is on the VM, they have the files” | Downloads is a **pull**. New slug ≠ old folder. |
| “Picture was approved, ignore the magician puff” | Approved UI does not bless a new I2V gag. Re-I2V that shot. |

## Red flags

- ffmpeg graph contains `loudnorm` **and** the input is `mix-*.wav` / a finished bed → strip it
- I2V prompt contains dust/particles/breathes/sparkles on a naturalistic scene → rewrite prompt, re-render
- Delivery receipt says `C:\` was written from Linux → delete that claim
- “PASS” without founder watch → not paid-media PASS
- Only one thumbnail per shot → extract the complained window

## Boundaries

| Skill / agent | This skill does not |
|---|---|
| `ad-video-script` | Write the script or beat sheet |
| `generate-visuals` | Re-decide still providers — call it |
| `suno-architect` | Invent a Suno recipe unless asked for a **new** licensed-path bed |
| `wsl2-audio` | Fix WSL speakers/mic |

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|---|---|---|
| 1 | Existing cut watched | Stills and/or spectrogram of the complained window exist from **this** run | |
| 2 | Picture vs audio scoped | Receipt says copy-video or names re-I2V shots | |
| 3 | Mix is stems once | ffmpeg graph has no second loudnorm on a finished mix; AAC from PCM | |
| 4 | I2V prompts are literal | No particle/breath metaphors unless the still needs that FX | |
| 5 | Delivery is on the VM | `~/delivery/<slug>/` has exact names + SHA + pull line; no fake `C:\` write | |
| 6 | Paid-media not self-PASSED | Receipt has `paid_media_status: PENDING_FOUNDER_WATCH`; no PASS without a separate founder ack of sound-on and sound-off | |

## Pipeline Continuation

Sidecar. After delivery the terminal state is `WAITING_FOR_HUMAN` (`human_checkpoint`). Do not chain into `land-changeset` for binary masters unless the WI says so.

`--skip` when masters + receipt already match the WI SHA and the founder has not opened a new defect.
