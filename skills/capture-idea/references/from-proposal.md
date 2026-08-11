# Proposal → WI Parser Grammar

Canonical contract for `skills/capture-idea/scripts/parse-proposal.mjs` and any host-native parser reimplementation.

## Design goals

1. Deterministic — same markdown input produces identical leaf list on every run.
2. Incremental — can be implemented with a simple line-based state machine; no full AST required.
3. Resilient — unknown headings are skipped, not fatal.
4. Bidirectional — given a leaf ID, the emitted WI must trace back to exactly one proposal section or table row.

## Input assumptions

- UTF-8 markdown.
- ATX headings only (`# … ## …`). Setext headings are not supported.
- Proposal files live under `proposals/` or `proposals/done/`.
- One proposal file per invocation.

## Phase 1 — Build the heading-depth stack

Scan the file line by line.

```
STATE: root
FOR each line:
  IF line matches /^#{1,6}\s+(.+)$/
    heading_level = count of leading '#'
    heading_text  = capture group 1, stripped of trailing whitespace
    POP stack until stack.length < heading_level
    PUSH { level: heading_level, text: heading_text }
  ELSE
    APPEND line to current leaf buffer (if any)
```

The stack is never deeper than 6. A heading at level N closes any open heading at level ≥ N.

## Phase 2 — Detect phase boundaries

A **phase** is detected when the stack top matches either:

```regex
^### Phase \d+\b
^### Phase [A-Z]+\b
```

Examples that match:
- `### Phase 0 — Framework-of-framework`
- `### Phase 1`

Examples that do NOT match:
- `## Phased Plan` (level 2 — too shallow)
- `#### Phase 0A` (level 4 — too deep)
- `### P0.1` (missing the word "Phase")

When a phase is detected, all buffered leaf content from the previous phase is finalised. A new phase object is created:

```json
{
  "id": "Phase 0",
  "heading_text": "Phase 0 — Framework-of-framework",
  "acs": [],
  "leaves": []
}
```

## Phase 3 — Detect leaf boundaries

A **leaf** is detected by one of two patterns.

### Pattern A — Heading-based leaf (primary)

Stack top matches:

```regex
^##### P(\d+)\.(\d+)\b
```

The leaf ID is `P{N}.{M}` (e.g. `P0.1`).

The parser records:
- `id`: captured group (e.g. `P0.1`)
- `source_anchor`: `§ P0.1`
- `goal`: heading text after the ID (e.g. `Close proposal → WI seam`)
- `level`: 5

When a leaf heading is encountered, the parser finalises the previous leaf (if any) within the same phase, then starts a new leaf buffer.

### Pattern B — Table-based leaf (fallback for compact phases)

If a phase contains NO heading-based leaves (Pattern A count == 0), the parser scans for a GFM table whose first column header is `ID` (case-insensitive) and whose rows contain IDs matching:

```regex
^P(\d+)\.(\d+)$
```

Each matching table row becomes a leaf:
- `id`: value from first column
- `source_anchor`: `§ P1.1`
- `goal`: value from second column (typically `Finding` or `Fix`)
- Table rows do NOT have individual sub-sections; all content until the next phase heading or EOF is treated as shared phase content.

**Priority rule:** If a phase contains at least one Pattern A leaf, Pattern B is ignored for that phase. This prevents double-counting.

## Phase 4 — Extract blocks inside a leaf

Within a leaf buffer (heading-based) or phase buffer (table-based), the parser looks for known block headers. A block header is an ATX heading whose text (case-insensitive) matches one of:

```
Goals
Non-Goals
Acceptance Criteria
Scope boundary
File Impact
Rollback
```

The block runs from the header line until the next heading whose text matches a *different* known block name (case-insensitive). Unknown sub-headings such as `### US-01 — Foo` are **retained as block content**, not treated as boundaries. This is load-bearing for `## Acceptance Criteria` blocks that organize AC rows under user-story subheadings — truncating on any heading drops the ACs entirely (see WI-100).

Per-block boundary summary:
- Starts on ATX heading matching a block name OR bold label like `**Goal:**`.
- Ends when another block-name heading or bold label appears.
- Unknown headings between those boundaries are content, not terminators.

Block contents are captured verbatim (including markdown formatting) and mapped to WI fields:

| Proposal block | WI field |
|---|---|
| `Goals` | `Goals` list |
| `Non-Goals` | `Non-Goals` list |
| `Acceptance Criteria` | `Acceptance Criteria` block |
| `Scope boundary` or `File Impact` | `File Impact` block |
| `Rollback` | `Rollback` block (optional, passed through if present) |

## Phase 5 — Inheritance rules (AC-04.3)

After leaf blocks are extracted:

1. If the leaf has its own `Acceptance Criteria` block (non-empty after stripping whitespace), use it.
2. Else, walk UP the heading stack to the nearest enclosing **phase** and use that phase's `Acceptance Criteria` block.
3. If neither the leaf nor the phase has an AC block, emit the sentinel:

```markdown
## Acceptance Criteria

_TBD — defer to plan-changeset_
```

## Phase 6 — Monolithic fallback (AC-01.3)

If the entire proposal contains zero phase headings (`### Phase …`), the whole file is treated as a single leaf with:
- `id`: `monolithic`
- `source_anchor`: proposal filename
- Blocks extracted from the top-level (`## …`) headings using the same case-insensitive block-name list.

Exactly one WI is emitted.

## Phase 7 — WI numbering (AC-04.4)

Before emitting any WI file:

```bash
ls docs/specs/work-items/WI-*.md 2>/dev/null \
  | grep -oP 'WI-\K\d+' \
  | sort -n \
  | tail -1
```

Result = `HIGHEST`. First emitted WI = `HIGHEST + 1`. Subsequent WIs in the same invocation increment monotonically.

If `docs/specs/work-items/` is empty or does not exist, start at `001`.

## Phase 8 — Idempotency (AC-04.5)

Before parsing, check:

1. Does the proposal file live under `proposals/done/`?
2. OR does the original path (if under `proposals/`) contain a `**Promoted to:**` trailer?

If either is true, exit with message:

```
Proposal <basename> already promoted. Skipping.
```

and emit zero WIs.

**Self-exclusion:** If a leaf's `source_anchor` maps to an existing WI file whose `**Source:**` metadata contains that exact anchor, the leaf is skipped. This prevents P0.1 from re-emitting WI-073 when the proposal is re-parsed after WI-073 already exists.

## Output schema

`parse-proposal.mjs` emits a single JSON object to stdout:

```json
{
  "metadata": {
    "proposal_path": "proposals/done/2026-04-24-framework-cohesion-evolution.md",
    "title": "Framework Evolution — 2026-04-24 — Post-Lane-7 Cohesion Pass",
    "monolithic": false,
    "leaf_count": 14,
    "skipped_leaves": ["P0.1"]
  },
  "phases": [
    {
      "id": "Phase 0",
      "heading_text": "Phase 0 — Framework-of-framework",
      "acs": "...",
      "leaves": [
        {
          "id": "P0.1",
          "source_anchor": "§ P0.1",
          "goal": "Close proposal → WI seam",
          "goals": "...",
          "non_goals": "...",
          "acs": "...",
          "file_impact": "...",
          "rollback": "...",
          "lane_hint": "framework"
        }
      ]
    }
  ]
}
```

## Determinism contract

- Running the parser twice on the same file must produce byte-identical JSON output (keys in stable order, no timestamps inside JSON).
- The leaf list order is document order (top-to-bottom).
- Unknown headings never create leaves; they are treated as prose.
