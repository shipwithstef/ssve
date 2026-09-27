# Work Item Schema (canonical)

Single source of truth for the shape of files in `docs/specs/work-items/`. Every skill that authors a WI file MUST follow this. The `list-work-items` parser and `audit-coverage` read against it. Drift here breaks downstream skills (`roadmap-evaluation`, `find-opportunity`, `sync-work-items`) silently.

## Filename

| Form | When |
|---|---|
| `WI-NNN.md` | Standard work item, monotonic numeric ID |
| `WI-NNN-SUFFIX.md` | Canonical uppercase suffix accepted by the shared WI grammar (e.g. `WI-081-FOLLOWUP.md`) |
| `WI-NNN-lowercase-suffix.md` | Legacy filename that remains locally listable (e.g. `WI-140-competitive-awareness-deep-research.md`); not a canonical mutation or publish ID |
| `WI-GH-N.md` | Exact mirror of a selected GitHub Issue number N, created only by explicit pull |
| `WI-NAMED-SEGMENTS.md` | Canonical named framework ID accepted by the shared WI grammar, e.g. `WI-SPINE-003.md` |

Canonical IDs for new authoring, mutation, and publishing use uppercase `WI-` and uppercase suffix segments when present. New local captures allocate numeric IDs; pulling issue N uses `WI-GH-N` and does not consume a numeric local ID. The local list parser also discovers historical uppercase-prefix filenames with lowercase suffixes, such as `WI-140-competitive-awareness-deep-research.md`. Keep those files locally listable without silently renaming them or treating their filename as a canonical mutation/publish ID. Adopted mirrors remain local execution, worktree, receipt and verification records. No bulk import or automatic publication follows from the filename. `INDEX.md` and `DONE.md` are reserved derived/index files in the same directory and don't follow `WI-*` naming.

## Heading (line 1)

**Canonical:**

```markdown
# WI-NNN: Short title
# WI-GH-N: Imported issue title
```

**Tolerated forms** (legacy / manually filed — parser accepts but new authoring skills SHOULD NOT emit):

```markdown
# WI-NNN — Short title       ← em-dash form, used by ad-hoc drift hunts
# WI-NNN - Short title       ← hyphen form
# Short Title                ← no WI prefix; filename supplies the ID
```

Authoring skills MUST emit the canonical colon form. Any other form is treated as legacy and may be normalised by future cleanup passes.

## Required metadata fields

These appear immediately under the heading, one per line, in this order:

```markdown
**Type:** <type>
**Status:** <status>
**Severity:** <severity>
**Filed:** <YYYY-MM-DD>
**Source:** <source>
```

| Field | Allowed values | Notes |
|---|---|---|
| `Type` | `feature`, `bugfix`, `drift`, `chore`, `refactor`, `enabler`, `integration`, `regression` | Single value |
| `Status` | See Status Vocabulary below | Single value, may have a parenthetical comment |
| `Severity` | `critical`, `high`, `medium`, `low` | Lowercase. Authoring skills MUST emit `Severity`, not `Priority` (the parser still accepts `Priority` as an alias for legacy WIs but new authoring SHOULD NOT use it) |
| `Filed` | ISO date | When the WI was first written |
| `Source` | One of: skill name (`capture-idea`, `onboard-repo`, `validate-feature`, `diagnose-bug`, drift-hunt), or a short phrase (`Pre-launch journey audit §5`, `WI-085 post-deploy E2E verification`) | Free text but one line; identifies who/what filed this |

## Optional metadata fields

```markdown
**Lane:** <lane>             # bugfix | brownfield-feature | refactor | drift | framework | TBD
**Closed:** <YYYY-MM-DD>     # set when Status moves to a closed bucket
**Repo Mode:** <mode>        # convert | bootstrap (set by onboard-repo)
**GitHub Issue:** <url|—>    # explicit pull/publish only; optional on local WIs
**Related:** <WI-IDs / J-IDs>
**Blocks:** <WI-IDs>
**Depends on:** <WI-IDs>     # parsed by list-work-items as dependency edges
**Follow-up:** <WI-IDs>      # forward link to spawned children
**estimated_minutes:** <n>   # optional dispatch estimate, integer minutes
**needs_model:** <model>     # optional worker model override
**needs_transport:** <mode>  # optional local-inline | subagent | detached-kimi | headless-worker
```

Use `—` (em-dash) for "not applicable / not yet set." Don't omit the line, don't write "N/A".

For a pulled `WI-GH-N`, the trusted heading and metadata identify the selected issue and its source repository. Put imported title/body content after the trusted metadata separator in `## Imported Issue (untrusted)`, inside a safe fence with every imported body line quoted; never parse imported lines as Type, Status, Severity/Priority, Filed, Closed, or dependency metadata. Identical re-pull is a no-op; remote or local edits require explicit conflict resolution. The real local parser must retain trusted open status, priority, empty dependency edges and null close date even when the imported body contains bold metadata aliases.

## Status vocabulary

The `list-work-items` parser routes WIs by status into open/closed buckets:

| Bucket | Statuses (case-insensitive) | Meaning |
|---|---|---|
| Open — actionable | `backlog`, `identified`, `in-progress`, `BLOCKED`, `READY`, `DRAFT`, `PROMOTED`, `DEPLOYED-UNVERIFIED` | Surface in default backlog |
| Open — held | `DEFERRED`, `DUPLICATE`, `NO-SHIP` | Surface in default backlog (decision exists, but not closed). May add a parenthetical reason |
| Closed | `VERIFIED`, `DONE`, `CLOSED`, `BASELINED`, `SHIPPED`, `COMPLETED`, `IMPLEMENTED`, `RESOLVED`, `MERGED`, `RELEASED` | Routed to `DONE.md`; never in default backlog stdout |

`DEPLOYED-UNVERIFIED` means the work has reached a deployed or promoted
surface but verification evidence is still incomplete. It is intentionally not a
closed status; only `verify-promotion` or delivery-graph closeout
classification may move it to `VERIFIED`.

When transitioning to a closed status, also set `**Closed:**` to the date.

## Body sections

After the metadata block, separate with `---` then write the body. Sections in this order when applicable:

```markdown
## Problem
What is wrong or missing. One paragraph.

## Evidence
Concrete file paths, runtime behaviour, doc refs, test references.

## Affected Files
- `path/to/file` when known
- `unknown: <reason>` when scope is not yet knowable

## Affected Specs
- `docs/specs/...` when known
- `unknown: <reason>` when not applicable or not yet knowable

## Acceptance Criteria
- [ ] Bullet list of testable conditions

## Route Recommendation
Which lane/skill should pick this up next, and why.

## Notes
Anything for triage, not full implementation.
```

`capture-idea` and `validate-feature` may add domain-specific sections (`Hypothesized Value`, `Persona Fit`, `Product-Grounded Assessment`, `Ship Decision`); those are skill-specific extensions, not violations.

## Authoring-skill responsibilities

| Skill | Must emit | Notes |
|---|---|---|
| `capture-idea` | Canonical heading + all required metadata + `Goal`, `Context`, `Hypothesized Value`, `Broad Scope`, `Persona Fit`, `Similar Items` | Status is `backlog`. Severity is the user's first-pass guess (default `low`). |
| `onboard-repo` | Canonical heading + all required metadata + `Problem`, `Evidence`, `Route Recommendation`, `Notes` | Status is `identified`. |
| `validate-feature` (when DEFER fires) | Canonical heading + all required metadata + DEFER block (blocking signal, builder-profile constraint, milestone, revisit trigger) | Status is `DEFERRED`. |
| `diagnose-bug` (when registering follow-ups) | Canonical heading + all required metadata + `Problem`, `Evidence` | Status is `identified`. |
| Drift / audit hunts (ad-hoc, no SKILL.md template) | Canonical heading + all required metadata + a `Problem` section minimum | Use `Source: <hunt name or session reference>`. Em-dash heading is tolerated for one-off filings but discouraged. |

High and critical WIs filed on or after 2026-05-12 MUST include non-empty
`Affected Files` / `Affected Specs` metadata or an explicit `unknown: <reason>`
line. This supports deterministic parallel dispatch and avoids sending workers
to discover their write scope from scratch.

## Why this matters

Before this schema existed, every authoring skill emitted a different shape: `capture-idea` used `**Captured:**` and a prefix-less heading; `onboard-repo` had no `**Filed:**`; ad-hoc drift hunts invented em-dash headings and `**Closed:**`/`**Filed:**`. The `list-work-items` parser was written against the first shape it saw and produced wrong output for ~75% of the backlog (see `proposals/done/2026-04-21-evolution.md`). Single schema means single parser, single audit, single dashboard.
