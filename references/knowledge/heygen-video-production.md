# HeyGen AI-video production — working knowledge

Source: Example Marketplace ad campaign, 2026-07-05→07 (session e2176717; ~$25 of a $30 key,
8+ videos, 1 trained avatar, shipped promo live on example-marketplace.app). Durable kit:
`example-marketplace/tools/video-kit/` (README = full how-to). Complements the
`embedded-captions` / `hyperframes` skills.

## Capability map (what each HeyGen surface actually does)

| Surface | Endpoint / CLI | Use | Cost |
|---|---|---|---|
| Avatar clip (v2) | `POST /v2/video/generate` | ONE fixed stock/pinned avatar talking; deterministic; no b-roll/captions | ~20 cr/min |
| **Video Agent (v3)** | `POST /v1/video_agent/generate`; CLI `heygen video-agent create` | Full PRODUCED ad from a prompt: scenes, b-roll, captions, music, motion-graphics. Auto-directs. | ~50–120 cr |
| **Agent chat mode** | `mode:"chat"` + `video-agent send <session-id>` | The killer feature: pauses for blueprint approval, accepts REVISION messages on the SAME video ("wider framing", "captions bottom quarter"), and `files:[{type:"asset_id"}]` attachments so b-roll shows YOUR real app UI | per re-render |
| Photo avatar | `photo_avatar/avatar_group/create` + `/train` (~15 min) | Pin ANY face (e.g. a presenter the Agent generated) as a reusable `avatar_id` | cheap |
| Talking photo | `upload …/talking_photo` | Animate a still — face-only motion, reads FAKE; avoid for ads | cheap |
| Styles / voices / music | `video-agent styles list`, `voice list`, `audio sounds list` | Curated visual templates ("A24"…); TTS voices; royalty-free music catalog | free to browse |
| CLI | `curl -fsSL https://static.heygen.ai/cli/install.sh \| bash` | All of the above scripted; JSON stdout | — |

## The consistency architecture (what "reproducible brand videos" means)

1. **Lock file** (`agent-brand.json`): pinned `avatar_id` + a locked
   `prompt_template` (ambiance, energy, framing rules, brand-name spelling,
   "no burned captions", "voice must finish the entire script"). New video =
   new script text only.
2. **Pin the presenter** via photo-avatar training. **Train from a
   HEAD+SHOULDERS crop** — a face-crop training image makes every render an
   extreme close-up (prompt framing rules only partly compensate).
3. **Iterate in chat mode**, never re-roll: revisions genuinely apply
   ("zoom out", "captions below chin", "phone must show the attached
   screenshot") while keeping presenter/scenes.

## The polish doctrine (generator output is a DRAFT)

- **Captions:** generator-burned captions desync (they're script-guesses;
  spoken audio drifts + ad-libs). Render CLEAN → faster-whisper word
  timestamps on the ACTUAL audio → local ASS karaoke burn (or the
  `embedded-captions` skill for matte-occlusion hero typography). Merge brand
  tokens ("Hours Hub"→Example Marketplace) before display.
- **Audio integrity:** whisper-transcribe the TAIL before shipping — one render
  cut the voice at 40s of 46s while visuals continued.
- **End cards / titles:** replace weak generated cards locally: brand HTML →
  headless-chrome screenshot → ffmpeg splice (audio untouched). Cap zoompan:
  `z='min(1+0.0004*on,1.03)'` — per-frame increments compound.
- **Verification:** frame samples (`ffmpeg -ss N -frames:v 1`) at 4–6 points +
  full-audio transcript per render. Spot frames alone miss desync and
  truncation; the human still catches motion-feel issues — instrument + human
  watch is the QA loop.

## Ops gotchas

- HeyGen CDN downloads stall: retry loop + `curl -C -` resume + `--speed-limit`
  watchdog.
- hyperframes build: `PUPPETEER_SKIP_DOWNLOAD=true` (its Chromium download
  aborts `bun install`; system Chrome works), then `bun install && bun run build`.
- The Agent respects `avatar_id` but NOT exact wording ("a concept, not a
  transcript") — lock brand spellings in the prompt and verify by transcript.
- Budget rule of thumb: $30 ≈ 1800 credits ≈ an entire small campaign with
  iterations, if polish (captions/cards/reframes) stays local.

## Marketing pairing (why one video ≠ the whole product)

A cold ad carries ONE wedge; the locked kit makes per-segment ads ~$1.5 each,
so feature breadth = a PORTFOLIO of ads (per vertical/wedge), never one crowded
video. AI claims stay out of cold ads until a customer-attributed outcome
exists (Example Marketplace positioning rider rule — generalizes to any pre-PMF product).
