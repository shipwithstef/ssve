# WI Follow-up Registrations (created by WI-562 at plan approval)

Durable registration of deferred scope so no deferral is untracked. Each entry enters the backlog at WI-562 land time.

## WI-563 — Cross-host receipt-production parity (audit IP-R6) + read-side closure tail (IP-R7 remainder)

- **Problem:** Hook-capable hosts lacking Edit/Write PostToolUse events under-produce verification receipts; several §4.1 read-side cells remain PARTIAL/NO (denial-body revalidation, story receipts, runtime projections).
- **Scope:** Stop/SessionEnd-equivalent receipt adapters for cursor/grok (+ any other `receipts: skills-only` host); receipts section in `validate-cross-host-hook-conformance.sh`; consume the per-host capability flags shipped in WI-562's `references/host-hook-catalog.json`; drive remaining read-matrix debt cells to YES.
- **Seeded by WI-562:** catalog capability truth for all 7 hook-capable hosts; accepted-debt rows in `docs/specs/wi562-read-matrix-baseline.json`.
- **Exit criterion:** read-side matrix zero NO/PARTIAL cells across ALL kinds.

## WI-564 — Stage-registry completion & manifest integrity (audit IP-R8)

- **Problem:** `stage-segment.mjs` embeds a second skill-name vocabulary with no mechanical tie-back to `references/stage-registry.json`; manifest carries no version/hash; `reviewGates` block consumed by zero tooling; FP-024 G6 dual meaning unresolved.
- **Scope:** segments as derived registry view; single-source validator coverage extension; `schema_version` + content hash on `skills-manifest.json`; linter validates reviewGates; template-drift escalation to exit 2.
- **Why deferred from WI-562:** touches routing/manifest hot paths requiring isolated ceremony per `rules/plan-changeset-trigger.md`; colliding it into WI-562's handoff/receipt changeset would couple two unrelated risk classes.
