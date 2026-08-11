# Feature Graph (WI-390)

`.svc/feature-graph.json` is the canonical **relational** store wiring the product
artifacts: `story → ac → journey-scenario → test → task → persona`. The join key
that wires every artifact — the **AC ID** (`DISC-01`) — was free text re-typed
into 5+ places (spec AC table, journey `@DISC-01` tags, sync-spec-code notes,
plan AC/test mapping, audit checklist, the spec's Test column) with no
machine-readable relationship store. This is that store.

## The one rule: POINTERS, never prose
An AC node carries `{id, qa_status, e2e_status, test_ref, status, file_anchor}` —
`file_anchor` is a `<path>:<line>` **pointer** to the prose AC text in the spec.
The graph **never** copies the AC description. The spec stays the single
authoritative prose store; the graph is the queryable relational index. A node
that carries a `text`/`description`/`prose`/`body` copy is REJECTED by
`build-feature-graph.mjs validate` and the tier-1 validator (AC1).

## generate-don't-lint (the WI-364 pattern, for the product pipeline)
Coverage matrices are **rendered VIEWS** of the graph, not hand-maintained.
`render-coverage-matrix.mjs --check` exits 1 on graph↔matrix drift (AC3), `--write`
regenerates the marker block (`<!-- svc:generated:begin feature-coverage-matrix -->`).
This transplants WI-364's generate-don't-lint from the framework manifest mirrors
to the product pipeline (~0% artifact overlap, ~100% pattern reuse).

## Slice ownership (each skill reads/writes only its slice)
| Skill | Writes | Reads |
|---|---|---|
| write-spec | `ac` + `story` nodes (from the AC table) | — |
| write-journeys | `journey-scenario` nodes + `scenario-covers-ac` edges (from `@AC` tags) | ac nodes |
| write-e2e | `test` nodes + `test-covers-ac` edges (from `@AC` tags in test source — composes with WI-391) | ac nodes |
| plan-changeset | `task` nodes + `task-implements-ac` edges | ac nodes |
| audit-ac / verify-promotion | reads coverage views; keeps editing the `.md` in place | the whole graph |

`build-feature-graph.mjs build --spec <spec> --journeys <glob> --tests <glob>`
assembles the graph and FAILS on any orphan `@AC` tag (a `@DISC-99` with no AC
node — AC2) or a spec with no parseable AC table (fail-closed).

## Explicitly NOT claimed by the graph (stay full LLM reads — AC4)
The graph derives the **relational/coverage** class only. These stay LLM-judged
because they reason about meaning, not structure:
- `sync-spec-code` Step 4 (narrative-vs-code drift) and Step 4b (journey-gap trace)
- `write-journeys` Phase 1 authoring (turning a spec into scenarios)

The graph never becomes the authoritative prose store, so the drift gates keep
their evidence source.

## v1 fence
v1 is fenced to **svc-native / greenfield** specs (the `| AC | Description | QA |
E2E | Test |` contract). Brownfield population is a deferred follow-on that
teaches `onboard-repo` a graph pass. Sequence AFTER WI-364 (cited precedent).
