# Framework Improvement: canonical WI schema closes authoring drift across capture-idea / onboard-repo / diagnose-bug

**Status:** IMPLEMENTED (2026-04-21, commit pending)

## Evidence

- **Source:** Deferred P1 findings F-005 and F-006 from `proposals/done/2026-04-21-evolution.md`. User follow-up: "fix these drifts stuff."
- **Finding:** Three authoring skills emit different WI shapes today. Concretely:
  - `capture-idea/SKILL.md:120` heading is `# [Idea Title]` — no `WI-NNN` prefix; the parser had to fall back on filename. `:127` uses `**Captured:**` (one-off field; nobody else uses this name).
  - `onboard-repo/SKILL.md:140` is canonical `# WI-001: Short title` but missing `**Filed:**` (every drift-hunt-filed WI has it; the onboard-repo template doesn't).
  - `diagnose-bug/SKILL.md:597` registers follow-up WIs without specifying any template at all — it just says "create with title, lane, severity, root cause." The em-dash heading form (`# WI-NNN — title`) appears in the wild precisely because there was no canonical to anchor to.
  - `validate-feature/SKILL.md:813` writes briefs to `docs/specs/features/` and an INDEX line but never a WI file directly — out of scope.
- **Severity:** medium — the parser is now tolerant (yesterday's fix), so this isn't actively breaking output. But every new WI authored under the old templates perpetuates the divergence and forces every downstream consumer (`list-work-items`, `roadmap-evaluation`, `find-opportunity`, `sync-work-items`) to re-implement the tolerance themselves.

## Diagnosis

- **Root cause:** No single canonical schema document existed. Each authoring skill grew its own template independently. When new fields were needed (`Filed`, `Closed`, `Source`, `Repo Mode`), each skill made a local choice.
- **Category:** drift (cross-skill convergence failure) + missing capability (no schema reference doc).
- **Already in FRAMEWORK-STATE.md?** Logged as deferred in the 2026-04-21 list-work-items entry. New evidence (this loop) elevates it from deferred to addressed.

## Implementation

- **Route:** Direct skill edits + one new reference doc. (Not a quick-fix because the schema doc didn't exist; not a normal pipeline because no behavior change to test — the parser already works.)
- **Files changed:**
  - `references/work-item-schema.md` (new, 114 lines) — canonical schema:
    - Filename rules (`WI-NNN.md` + `WI-NNN-suffix.md`).
    - Heading: canonical `# WI-NNN: title` (colon form). Em-dash, hyphen, and prefix-less forms are documented as tolerated-legacy.
    - Required fields: `Type`, `Status`, `Severity`, `Filed`, `Source` — with allowed values for each.
    - Optional fields: `Lane`, `Closed`, `Repo Mode`, `GitHub Issue`, `Related`, `Blocks`, `Depends on`, `Follow-up`.
    - Status vocabulary buckets (open / open-held / closed) matching the parser.
    - Per-skill responsibility matrix.
  - `capture-idea/SKILL.md` template — heading now `# WI-###: [Idea Title]`; `**Captured:**` renamed to `**Filed:**` to match the schema; references the schema doc.
  - `onboard-repo/SKILL.md` template — added `**Filed:**` and `**Source:**` fields; references the schema doc.
  - `diagnose-bug/SKILL.md` Step 5.5.2 — register-follow-up instructions now require canonical heading + required metadata block + named source attribution to parent WI.
- **Commits:** to be appended after `git commit`.

## Replay Verification

- **Replay target:** `list-work-items` against example-marketplace backlog must still produce the same 21 open / 79 closed split (no regression from the schema-doc + skill-template changes, since neither modified existing WI files).
- **Result:** PASS.
- **Evidence:** Re-ran `node list-work-items/scripts/list_work_items.mjs` — output unchanged (21 open / 79 closed, 31-line stdout). Pointer references confirmed in all three patched SKILL.md files.

## FRAMEWORK-STATE.md Mutations

- **Analysis History:** added 2026-04-21 entry "WI authoring schema canonicalised — capture-idea, onboard-repo, diagnose-bug now point to references/work-item-schema.md."
- **Reference doc count:** 16 → 17 (added `work-item-schema.md`).
- **Decisions:** locked the canonical heading form (`# WI-NNN: title`) and the required-metadata field set going forward. Existing WIs with non-canonical shapes are NOT being rewritten — the parser is tolerant by design.
- **Capabilities:** no change to `references/knowledge/svc/CAPABILITIES.md` — schema doc clarifies an existing capability rather than adding a new one.

## Out of scope (deferred)

- **F-005 enforcement hook in `audit-coverage`** — could machine-check that every `WI-*.md` file conforms to the schema. Not done in this loop. The parser tolerance covers the practical case; enforcement is a separate value-add when authoring volume warrants it.
- **Existing WI rewrite** — the 92 example-marketplace WIs include legacy em-dash and prefix-less forms. Not rewriting them; the parser handles them correctly. A future cleanup pass could normalise them but it's mechanical churn with no behavior change.
- **`write-spec` template alignment** — `write-spec` writes spec files (in `docs/specs/features/`), not WI files. Out of scope for the WI schema. Spec files have their own template; if convergence is wanted there it needs a separate `references/spec-schema.md`.
