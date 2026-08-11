# Framework Improvement: wire-*-hooks --dry-run semantics mismatch

## Evidence

- **Source:** `improve-framework` loop iteration on 2026-05-08 needed structural-correctness verification of the G-4 `skill-artifact-authenticity` hook in `wire-kimi-hooks.mjs` and `wire-codex-hooks.mjs`.
- **Finding:** `--dry-run` on Kimi and Codex wirers prints additions ONLY for hooks missing from the local install. On a host with the hooks already wired (or with no local install at all), `--dry-run` outputs `All svc hooks already present in [host] config. No changes needed.` — zero declarative content. A grep for the hook name returns 0 even though the wirer source clearly declares the hook entry.
- **Severity:** medium

## Diagnosis

- **Root cause:** Three wirers (`wire-hooks.mjs` for Claude, `wire-kimi-hooks.mjs`, `wire-codex-hooks.mjs`) implement `--dry-run` differently:
  - Claude wirer: prints the full would-be config regardless of installed state
  - Kimi wirer (`scripts/wire-kimi-hooks.mjs:362-365`): prints ONLY missing additions
  - Codex wirer: same pattern as Kimi
- **Category:** drift (cross-host inconsistency for what should be a uniform contract)
- **Already in FRAMEWORK-STATE.md?** no (new finding from `improve-framework` 2026-05-08 housekeeping pass)

## Why this matters

Framework-improvement loop iterations and tier-1 validators commonly use `wire-*-hooks --dry-run | grep <hook-name>` to assert "the wirer knows about hook X." On Kimi/Codex this assertion silently fails when the hook is already installed — producing false-negative replay verifications that misrepresent the framework's state.

The proposal `2026-05-04-framework-improvement-g4-hook-wiring.md` itself documented `--dry-run | grep -c "skill-artifact-authenticity" → 1` as its replay assertion. On 2026-05-08 re-verification this grep returns 0 (because the hook is now installed locally), which would have falsely flagged the original implementation as "no longer present" if anyone re-ran the documented check.

## Implementation

- **Route:** `quick-fix` (≤ 2 files, ≤ 50 lines per wirer — but touches 2 wirers, borderline; the change is purely additive flag handling so quick-fix is appropriate)
- **Files to change:**
  - `scripts/wire-kimi-hooks.mjs` — add `--list-all` flag that prints every declared hook entry regardless of installed state
  - `scripts/wire-codex-hooks.mjs` — same flag
  - `scripts/wire-hooks.mjs` — same flag for symmetry (Claude wirer already prints all; flag would alias to existing behavior)
  - Optional: tier-1 validator that asserts every host wirer supports `--list-all` and emits a stable structural representation
- **Acceptance:** `node scripts/wire-kimi-hooks.mjs --skills-path ~/.kimi/skills --list-all` prints every hook entry the wirer would install, formatted so a grep on hook filename returns ≥1.

## Replay Verification

- **Replay target:** after the fix, running `node scripts/wire-kimi-hooks.mjs --skills-path ~/.kimi/skills --list-all | grep -c "skill-artifact-authenticity"` returns ≥1, regardless of whether `~/.kimi/hooks.toml` is present or already wired.
- **Result:** PENDING (not yet implemented — this is the proposal)

## FRAMEWORK-STATE.md Mutations (when implemented)

- **Analysis History:** add 2026-05-XX entry for this fix
- **Known Gaps:** none changed (new finding, addressed in same loop)
- **Decisions:** Locked decision: `--list-all` is the canonical structural-replay flag for any future wirer added to the framework

## Why filed but not implemented in the same 2026-05-08 loop

The 2026-05-08 `improve-framework` iteration was scoped to housekeeping retirement of the G-4 proposal. Adding a new flag to three wirers is a separate small piece of work — single gap, single fix — that deserves its own loop iteration so the replay verification can be exercised cleanly. Filing the proposal here so it isn't forgotten.

**Status:** IMPLEMENTED (2026-05-08, see commit on this branch)
