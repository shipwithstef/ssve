# Image-to-video prompt hygiene

I2V does what the prompt *shows*, not what you meant. A poetic extra becomes a visible gag.

## Write motion, not atmosphere metaphors

Say the camera move and the actor’s action. Skip words the model will literalize as FX.

| If you write | Models often render |
|---|---|
| “dust motes drift”, “she breathes” | Visible powder/breath puff from the mouth (magician spray) |
| “particles”, “sparkles”, “magic light” | Glitter FX on a product scene |
| “smoke”, “haze”, “volumetric god rays” | Fog plate that eats faces |
| “looks up and turns the phone” | Phone leaves the compositor’s lock |

Prefer: “Slow push-in. Mouth closed. Still air. Clock stays at 3:00.”

## Still is frame 1

Generate or lock the still **without** the FX you do not want. I2V will animate whatever is in the still *and* whatever the motion prompt adds.

## Host notes (Grok / xAI)

Zero-Data-Retention teams must pass `output.upload_url` (relay PUT). The native `image_to_video` tool 400s without it — use the project’s I2V script that already has the relay, or provide the upload URL. Default clip length is 6s (or 10s); stitch in ffmpeg, do not ask the model for a 36s take.

## After each clip, still-check the problem window

Extract 0.25 s frames across the shot, not one mid-clip thumbnail. Particle puffs are easy to miss at 1 fps.
