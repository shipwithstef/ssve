# Ingest Report: <source-id>

**Date:** YYYY-MM-DD
**Source label:** <source-id>
**Content length:** N lines / ~N tokens
**Research sub-agent used:** gemini-cli | claude

## Pasted Content (summary)

<1-3 sentence summary of what the guide is about>

## Upstream Fetch

<If pasted content cited a public URL — record what was fetched, what was found in the upstream (e.g. SKILL.md filenames, README excerpt), and the model used. If the fetch failed, record the URL and the failure reason. If no URL was cited, mark `n/a`.>

- **Upstream URL:** ...
- **Fetch status:** ok | failed | n/a
- **Excerpt or failure reason:** ...

## Extracted Claims

List every distinct claim / technique / result extracted by research:

1. <claim 1>
2. <claim 2>
3. ...

## Catalog Cross-Check

For each capability-class claim, tag against the existing svc skill catalog:

| # | Claim | Tag | Matched skill(s) | Delta worth borrowing |
|---|-------|-----|------------------|------------------------|
| 1 | <claim 1> | catalog-overlap-strong \| catalog-overlap-partial \| catalog-novel | `<skill-name>` or — | <one-line delta or —> |
| 2 | ... | ... | ... | ... |

## Addon Dedup Check

If the source is a multi-skill pack / named ecosystem / external repo:

- **Source signature:** repo URL / author handle / ecosystem name
- **EXTERNAL_ADDONS.md hit:** yes (line N) | no
- **blend-registry.json hit:** yes (entry id) | no
- **Addon tag:** addon-known-blended | addon-known-not-blended | addon-novel | n/a (not a multi-skill source)

## Claim Classification

| # | Claim | Class | Evidence / Reference |
|---|-------|-------|---------------------|
| 1 | <claim 1> | already-known \| new \| contradicts-known | <path or rationale> |
| 2 | ... | ... | ... |

## Experiments (for `new` and `contradicts-known` only)

### Experiment E1 — <claim N>

- **What to do:** ...
- **Success criterion:** ...
- **Time box:** ...
- **Rollback:** ...

## Benefit Framing

### Product project benefit
For each surviving claim:
- <claim 1>: how this could help the current product project.
- ...

### svc framework benefit
For each surviving claim:
- <claim 1>: how this could improve svc itself.
- ...

## Project Fit

For each surviving claim, tag applicable shippable projects from `~/.svc/state-snapshot.json` / `capability-concierge`:

| # | Claim | applicable_projects | project_fit_strength | Rationale |
|---|-------|---------------------|----------------------|-----------|
| 1 | <claim 1> | ["example-marketplace", "..."] or [] | strong \| weak \| none | <one-line> |

If `capability-concierge` was unavailable, document the fallback (direct read of `~/.svc/state-snapshot.json` or skipped).

## Decision Matrix

| # | Catalog | Knowledge | Project-fit | Default routing | Override (and why) |
|---|---------|-----------|-------------|-----------------|--------------------|
| 1 | ... | ... | ... | ... | — |

## Validation Rubric

| # | Claim | Signal (1-5) | Novelty (1-5) | Actionability (1-5) | Source credibility (1-5) | Aggregate |
|---|-------|--------------|---------------|---------------------|--------------------------|-----------|
| 1 | ... | | | | | |

## Routing Decisions

| # | Claim | Decision | Destination / Next Step |
|---|-------|----------|-------------------------|
| 1 | ... | discard \| store \| blend-or-link \| promote | `references/knowledge/<domain>/...` OR `blend-external` recommendation OR `create-skill` brief OR — |

## Summary

- Claims extracted: N
- already-known: N, new: N, contradicts-known: N
- catalog: strong N, partial N, novel N
- addon: <single tag for the source>
- project-fit: strong N, weak N, none N
- upstream-fetch: ok | failed | n/a
- discard: N, store: N, blend-or-link: N, promote: N
- experiments pending: N

## Log Entry

See `.svc/pipeline-decisions.jsonl` — last entry with `source_id: <source-id>`.
