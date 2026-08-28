# Audio house lock

One mix, encoded once. Most “fui fui / pumping / crushed / too-hot music” bugs are a **second dynamics pass on a finished bed**.

## Mix graph

Build from stems, in this order:

1. **VO** — one language per master. High-pass speech (~80 Hz). Do not language-mix EN+BG in one file.
2. **Music bed** — one licensed or in-repo bed. Duck **once** under VO (house default **−22 dB** on a *hot* stem; if the stem is already quiet, measure LUFS and duck less so the bed is audible in gaps without competing with VO).
3. **Optional Foley** — only if the beat sheet names a diegetic hit (door, cup). Never sprinkle notification pings or sine beeps “for energy”.
4. **Encode** — PCM 48 kHz stereo → AAC (192k is enough) **once**. No AAC→AAC.

Do **not** run `loudnorm` (or any other compressor/limiter) on a file that is already a ducked mix. `loudnorm I=-16` is for **new** stem mixes only, and even then prefer static makeup to a true-peak ceiling (e.g. −1.5 dBTP) when LRA is large — dynamic loudnorm on VO+bed **pumps the bed in the holes**.

## Diagnose before re-mixing

| Symptom | Likely cause | Check |
|---|---|---|
| Pumping / “fui fui” in VO gaps | Second loudnorm / sidechain on a finished mix | Compare 50 ms RMS of delivery vs source WAV; LRA crushed |
| Whistle / peep | Narrow falling HF ridge in the bed, or a sine `ping` muxed in | Spectrogram 4–12 kHz; xcorr against `ping`/sine stems |
| Music “crazy hot” | Loudnorm raising the ducked bed | End-card / VO-gap RMS vs ducked stem |
| “No background at all” | Over-filtering the bed (brickwall lowpass) or −22 dB on an already-quiet stem | Bed-only ebur128; if I ≲ −40 LUFS the bed is gone |
| WSL “wrong file” | Windows still has the old Downloads folder | SHA of `~/delivery/<slug>/` vs the folder they opened |

## Beds you may not invent

- Stacked `sine=` chords as “cinematic music”
- Unlicensed scraped tracks
- Regenerating a Suno/Udio bed unless the project already owns that file and the license is recorded

If the in-repo instrumental **is** the peep (laser chirps), do not ship it. Say so. Use a licensed bed, or a documented in-repo bed after proving the chirp is gone on a spectrogram, or a non-tonal warmth layer (pink/band-limited, not a sine stack). Silence under VO is honest; a fake peep-bed is not.

## Commands (print-only loudness)

```bash
ffmpeg -i "$MIX" -af ebur128=peak=true -f null -
ffmpeg -i "$MIX" -lavfi "showspectrumpic=s=1920x512:legend=1" spec.png
```
