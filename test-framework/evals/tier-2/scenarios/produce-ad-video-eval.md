# Tier 2 Scenario: produce-ad-video routing

## Skill Under Test

`produce-ad-video`

## Setup

A repository has a locked picture cut and a complained mix. This scenario tests routing comprehension only — do not call I2V or ffmpeg.

## Prompt

```
Route this request: remux the Lightning EN/BG masters, keep the picture, the audio pumps and there is a whistle, write ~/delivery with a receipt.
Return exactly three short lines.
Line one must say "Selected: produce-ad-video (not ad-video-script)".
Line two must say it will not run a second loudnorm on a finished mix.
Line three must say Windows Downloads is a pull, not a VM write.
```

## Expected Outputs

- Selects `produce-ad-video`.
- Adjacent negative: rejects `ad-video-script` (script writer), `wsl2-audio` (speakers), and `generate-visuals` (stills).
- States house-lock: mix once, no second loudnorm.
- States delivery is `~/delivery/<slug>/` and the Windows copy is a pull.

## Assertions

### Process Checks
```json
[
  {"type":"output_regex","regex":"Selected: produce-ad-video \\(not ad-video-script\\)","label":"routes to produce-ad-video and excludes script writer"},
  {"type":"output_regex","regex":"loudnorm","label":"names the second-loudnorm ban"},
  {"type":"output_regex","regex":"pull","label":"Windows copy is a pull, not a VM write to C:\\\\"}
]
```
