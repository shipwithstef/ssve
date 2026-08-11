# WI-360 — Cross-Model Review Trail (quick-fix carve-out + binding)

**Landed:** PR #32, squash `1505ff65` (2026-06-07). **Manifest:** `docs/plans/2026-06-07-wi-360-quick-fix-carve-out/manifest.md`.

| Tier | Reviewer | Outcome |
|---|---|---|
| 1 | mechanical | first-pass exit 0 |
| 2 (plan) | gemini (codex output hook-corrupted 3rd time → routed per allowlist) | rubric 95; 1 LOW rejected line-cited; approve |
| G6 (exec) | codex ×2 + gemini tie-break | G6-001 high rename-smuggling — fixed globally (name-status rows incl. sources); copy-residual disputed → gemini **reject-upheld** (copies mutate nothing protected; destination = inert docs Add); G6-002 dynamic binding tests added (notes-injection, negative + positive control) |

## Live evidence
- TDD RED 6-fail → GREEN 15/15; suite 197/197; landing push hot-fired the WI-358 gate (envelope path)
- Grounding falsified the WI hypothesis: the Phase-0 false positive was a TREE-MISMATCH promotion (receipt files:1 vs 26-file commit on dfe22a00), not a broad markdown waiver → binding shipped
- Closeout push of this very WI = first envelope-free exempt-class commit (carve-out + tree binding proving themselves)
