## Post-Verification: Visual Baseline Promotion

If track-visuals diff report exists for this feature/WI and G7 passed:

1. Read the diff report — identify CHANGED entries marked intentional.
2. **Staleness check for competing branches:** For each affected screen, check
   if the golden baseline was updated after this WI's branch point:
   ```bash
   git log -1 --format=%ci -- docs/specs/visuals/baseline/<screen>.png
   ```
   If the baseline was updated more recently (another WI promoted while this one
   was in flight), flag those screens for **re-capture before promoting** —
   the current WI's screenshots may be based on a stale state.
3. If no staleness conflicts: invoke track-visuals in `update` mode for
   affected screens.
4. If staleness conflicts: re-capture ONLY the conflicting screens against
   current main, then promote.
5. After promotion: delete screenshot files (`.png/.jpg/.webp`) from
   `.svc/visuals/<WI>/`. Preserve review reports, manifests, and
   analysis logs — these are retained for platform improvement.

Skip this step if: no visual changes, or feature has no browser-visible surface.
