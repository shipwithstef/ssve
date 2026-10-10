## Prerequisites

Before testing:

1. Journey docs exist: `docs/specs/journeys/*.feature.md`
2. Feature specs exist: `docs/specs/features/*.md`
3. AC tables use the standard format:
   `| AC | Description | QA | E2E | Test |`

If AC tables are missing or malformed, run `audit-ac` first.

When this QA pass produces or repairs an automated check in test source (a
smoke spec, a code-inspection harness, or an E2E follow-up authored inline),
tag the spec acceptance criterion it exercises with a `@AC-<ID>` comment in the
test, using the spec AC ID verbatim (`{SECTION-PREFIX}-{NN}`, e.g. `@AC-NAV-01`,
uppercase — the case is the contract). This is the same machine-readable
test-side anchor `write-e2e` emits; it lets
`node scripts/verify-test-ac-tags.mjs --root .` confirm the tag resolves to a
real spec AC and lets sync-spec-code's `[TEST]`-tier audit derive coverage
instead of hand-copying it. Manual-only QA (no test source touched) writes the
`QA` column as before and emits no tag.

For browser-visible features, responsive verification is baseline scope **staged desktop-first**:

- **Stage 1 — Desktop (`1280x800`)** is MANDATORY first pass. Run the full scenario set at desktop, capture evidence, file WIs for defects. Do not proceed to Stage 2 until Stage 1 defects are either fixed or filed as HIGH/CRITICAL WIs.
- **Stage 2 — Mobile (`375x812`)** runs after Stage 1 is clean. Repeating scenarios on mobile before desktop defects are fixed produces duplicate failure noise and no new signal.
- **Stage 3 — Tablet (`768x1024`)** only when UX/UI docs define tablet-specific behavior or a distinct layout.
- A single-pass claim that "both viewports are covered" without staging is a contract violation. Mark the untested viewport `⏭️ staging-blocked` with reason "desktop baseline not yet clean" and file a follow-up WI.
- Only skip viewport coverage entirely when the feature has no visual surface; record that explicitly in SUMMARY.md.
- Record `viewport_stage=desktop|mobile|tablet` in SUMMARY.md for every run.

---
