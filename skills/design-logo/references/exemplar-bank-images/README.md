# Exemplar Bank — Image Assets

Real PNG/SVG logo files for the entries in `../exemplar-bank-2026.md`. The bank's text descriptions are scaffolding; **the actual visual benchmark target is the file in `originals/`**.

## How to use

- **Phase 1 (design-logo):** before generating concepts, browse `originals/` and pick ≥3 entries whose principle (per the bank text) maps to the brief. View the actual files, not just the descriptions.
- **Phase 5 (design-logo) — 2-up benchmark:** compose `<concept>-vs-<exemplar>.png` for each top-3 concept against its claimed exemplar from `originals/`. If the exemplar visibly outclasses the concept on the same principle, score caps at 60/70.
- **Refresh:** re-run `bash download.sh` to update / fill gaps. Idempotent — skips files already present. To force refresh a single brand, `rm originals/<id>_<name>.*` then re-run.

## File format & quality notes

Source preference order (in `download.sh`):
1. `https://<domain>/apple-touch-icon.png` — usually 180–512 px PNG with transparency, the highest-quality favicon-tier asset most brands publish. **Best source.**
2. `https://<domain>/favicon.svg` — vector, scales perfectly, but few brands publish.
3. `https://www.google.com/s2/favicons?domain=<d>&sz=256` — fallback, always works, 256 px PNG (sometimes lower res depending on what Google has cached).

## Known limitations of the current set

| ID | Brand | File size | Note |
|---|---|---|---|
| G1 | Jaguar | 529 B | Very small ICO from Google fallback. Re-fetch from a brand-asset page if the cautionary case becomes load-bearing in a future run. |
| I15 | Mistral | 311 B | Same — apple-touch-icon endpoint returned a placeholder. Replace from `mistral.ai/news` press kit if needed. |

These are still usable as silhouette references at favicon scale, but for full-mark analysis prefer fetching the brand's official press-kit asset.

## Adding new entries

1. Add a row to `download.sh`'s `ENTRIES` block: `id|domain|brand_name|category`.
2. Add the matching `### <id> — <Brand> (<year>)` section to `../exemplar-bank-2026.md` with type / why exceptional / transferable principle / do not copy.
3. Run `bash download.sh`.
4. Verify the new file appears in `originals/`.

## Re-fetch all (force refresh)

```bash
rm -rf originals/
bash download.sh
```
