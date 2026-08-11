# Framework Improvement: list-work-items parser respects status, splits done items into separate file

**Status:** IMPLEMENTED (2026-04-21, commit pending)

## Evidence

- **Source:** User report in example-marketplace session: "list-work-items is fully broken, doesn't differentiate between done and open items." Followed by ask: "I respect proper status to be returned also done items best to move in another file to not always return some huge responses."
- **Finding:** `list-work-items/scripts/list_work_items.mjs` rendered ~70/92 example-marketplace WI files as "No subject / Priority: Low / Status: Ready" — including items with explicit `**Status:** VERIFIED` (WI-081, WI-087). Default output was 537KB.
- **Severity:** high — corrupts roadmap decisions; downstream skills (`roadmap-evaluation`, `find-opportunity`) read this output.

Diagnosis already produced in `proposals/done/2026-04-21-evolution.md` (P0 findings F-001 through F-004). Per Step 1.5, evidence/diagnosis steps were skipped and implementation went straight from the existing proposal.

## Diagnosis

- **Root cause:** Parser was written against the first WI authoring format (`onboard-repo` style) and never updated as new authoring skills (capture-idea, drift-hunt, validate-feature) emitted variant headers and metadata fields. Three concrete bugs:
  1. Status was synthesized from dependency presence (`'Ready'` or `'Blocked by …'`), never read from the literal `**Status:**` field.
  2. Subject regex required `# WI-NNN: title` colon form; em-dash form (`# WI-081 — title`) and prefix-less form (`# Voice-Driven Deal & Event Generation`) silently failed.
  3. Priority regex matched `**Priority:**` only; newer WIs use `**Severity:**`.
- **Category:** drift (parser drifted from the schema actually emitted by authoring skills) + inefficiency (537KB stdout dump defeats the "list" use case).
- **Already in FRAMEWORK-STATE.md?** No. The earlier 2026-04-21 install-drift entry mentions list-work-items only in the context of the install pipeline, not the parser.

## Implementation

- **Route:** Direct script + SKILL.md edit (P0 was a single-script patch, no pipeline overhead warranted).
- **Files changed:**
  - `list-work-items/scripts/list_work_items.mjs` — full rewrite (125 → 173 lines). New behaviour:
    - Status field parsed from `**Status:**` literal. Buckets: `verified|done|closed|baselined|shipped|completed|implemented|resolved|merged|released` → done; everything else → open.
    - Done items written to `docs/specs/work-items/DONE.md` (regenerated each run); not dumped to stdout unless `--all`.
    - Open items printed as compact table: `ID | Status | Priority | Subject`. Column widths auto-fit ID/priority; status capped at 28 chars (full status preserved in DONE.md and `--detail`); subject truncated at 80 chars.
    - Subject regex tolerates `# WI-NNN: title`, `# WI-NNN — title`, `# WI-NNN - title`, and prefix-less `# Title` (uses filename as ID).
    - Priority regex accepts `**Priority:**` or `**Severity:**`.
    - New flags: `--all` (include done inline), `--detail WI-NNN` (full body of one item), `--json` (machine-readable dump).
  - `list-work-items/SKILL.md` — rewritten to document new flags, output contract, status buckets, and accepted heading variants.
- **Commits:** to be appended after `git commit`.

## Replay Verification

- **Replay target:** Re-run `node list-work-items/scripts/list_work_items.mjs` against `~/app-workspaces/example-marketplace/docs/specs/work-items/` (92 files, the original failing scenario). Must (a) classify VERIFIED items as done, (b) keep stdout under ~50 lines, (c) parse subjects for em-dash and prefix-less headers.
- **Result:** PASS.
- **Evidence:** Replay output:
  - 21 open items, 79 closed (vs 92 all-"Ready / No subject / Low" before).
  - VERIFIED items (WI-001, WI-081, WI-087, etc.) correctly bucketed to `docs/specs/work-items/DONE.md`.
  - Subject parsed for all four sampled formats (WI-001 colon, WI-081 em-dash, WI-091 prefix-less, WI-016a sub-IDs).
  - stdout: 31 lines, ~3KB (vs 537KB before).
  - `--detail WI-087` returns parsed metadata header + full file body.

## FRAMEWORK-STATE.md Mutations

- **Analysis History:** added 2026-04-21 entry "list-work-items parser drift — status/subject/severity fields ignored, 92-item dump unreadable" with this proposal's findings and resolution.
- **Known Gaps:** none new. Optional follow-up logged inline (canonicalise WI authoring schema across authoring skills) but not pulled into Known Gaps yet — needs a separate evidence pass on each authoring skill before deciding whether to enforce via audit-coverage or relax via parser tolerance.
- **Decisions:** none new — parser tolerance over authoring-side schema enforcement is a pragmatic choice for now, not a locked one.
- **Capabilities:** no change to `references/knowledge/svc/CAPABILITIES.md` — list-work-items remains a local-first backlog reader; the contract is unchanged, only the implementation is now correct.

## Follow-ups deferred (filed in evolution proposal P1)

- F-005 (no `**Dependencies:**` field in modern WIs → topological sort is a no-op): parser now tolerates `Depends on` and `Blocked by` aliases but the upstream authoring skills don't emit any of them. Schema doc + audit-coverage hook still owed.
- F-006 (no canonical WI schema across authoring skills): the four authoring skills sampled (`onboard-repo`, `capture-idea`, drift-hunt, `validate-feature`) all emit different shapes. Worth a dedicated `references/work-item-schema.md` pass — out of scope for this loop.
