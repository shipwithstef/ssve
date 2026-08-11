---
name: refresh-competitors
version: "1.0"
description: >
  Refresh the competitive knowledge base by diffing tracked competitors against
  their live public state. Triggers on scheduled weekly routine or manual
  invocation. NOT for adding new competitors — use analyze-competitors for that.
  Use when the user says "refresh competitors", "update competitive landscape",
  "what changed this week", "competitor watch", "run competitor diff", or when
  the scheduled weekly routine fires.
phases:
  - id: P1-TrackedSetEnumeration
    trigger: always
    reads: ["references/knowledge/competitors/index.md"]
    writes: []
    evidence_kind: command_output
    required_for_completion: true
  - id: P2-BaselineLoad
    trigger: always
    reads: ["references/knowledge/competitors/<slug>/.last_known_state.json"]
    writes: []
    evidence_kind: command_output
    required_for_completion: true
  - id: P3-LiveStateDiscovery
    trigger: always
    reads: ["web search results", "competitor homepage", "pricing pages", "news pages"]
    writes: []
    evidence_kind: command_output
    required_for_completion: true
  - id: P4-DiffAndChangelog
    trigger: always
    reads: ["baseline state", "live state"]
    writes: ["references/knowledge/competitors/<slug>/changelog.jsonl"]
    evidence_kind: file
    required_for_completion: true
  - id: P5-StateRefresh
    trigger: always
    reads: ["live state"]
    writes: ["references/knowledge/competitors/<slug>/.last_known_state.json", "references/knowledge/competitors/<slug>/.last_refresh"]
    evidence_kind: file
    required_for_completion: true
  - id: P6-WeeklyDigest
    trigger: always
    reads: ["competitor changelog entries", "refresh summary"]
    writes: ["docs/specs/refresh-competitors/<date>-digest.md"]
    evidence_kind: file
    required_for_completion: true
inputs:
  required:
    - { path: "references/knowledge/competitors/index.md", artifact: competitor-index }
  optional:
    - { path: "references/knowledge/competitors/<slug>/.last_known_state.json", artifact: last-known-state }
outputs:
  produces:
    - { path: "references/knowledge/competitors/<slug>/changelog.jsonl", artifact: competitor-changelog }
    - { path: "references/knowledge/competitors/<slug>/.last_known_state.json", artifact: updated-state }
    - { path: "references/knowledge/competitors/<slug>/.last_refresh", artifact: refresh-timestamp }
    - { path: "docs/specs/refresh-competitors/<date>-digest.md", artifact: weekly-digest }
chain:
  lanes:
    framework: { position: 9, prev: analyze-competitors, next: null }
  progressive: false
  self_verify: true
  human_checkpoint: false
---

# Refresh Competitors

**Announce at start:** "I'm using refresh-competitors to diff tracked competitors against their live state and update the knowledge base."

## When To Use

Use this skill when:
- The scheduled weekly routine fires (`~/.claude/routines/<project>-competitor-watch`)
- User says "refresh competitors", "update competitive landscape", "what changed this week"
- `validate-competitor-analysis-freshness.sh` flags data >60 days old
- A competitor is known to have made a recent announcement and the user wants immediate refresh

Do NOT use this skill when:
- Adding a new competitor to the tracked set → use `analyze-competitors`
- Running a comprehensive deep-dive on a competitor → use `analyze-competitors`
- The knowledge base is empty (no `.last_known_state.json` files) → run `analyze-competitors` first

## Process

### 1. Enumerate tracked competitors

Read `references/knowledge/competitors/index.md` for the list of tracked slugs.

If index.md is missing or empty → HALT with advice to run `analyze-competitors` first.

### 2. Per-competitor refresh loop

For each slug in the tracked set:

#### 2.1 Read baseline

Read `references/knowledge/competitors/<slug>/.last_known_state.json`.

If missing → log warning, skip this slug, continue to next. Do NOT attempt to create it — that's `analyze-competitors`' job.

#### 2.2 Live state discovery

Run 3 WebSearch queries per competitor:
1. `"<slug>" homepage` — capture title, tagline, key messaging
2. `"<slug>" pricing` — capture pricing tiers, plan names, key limits
3. `"<slug>" news OR press OR "Series" OR acquisition 2026` — capture recent headlines

**Rate limit handling:** If WebSearch returns rate-limit error, wait 2s and retry once. If still limited, log warning, skip remaining slugs, and exit with partial success.

#### 2.3 Diff

Compare live state against `.last_known_state.json` fields:
- `homepage_title`
- `pricing_tiers` (name + price string)
- `featured_integrations`
- `recent_press_headlines`
- `leadership_page_names`

**Diff rules:**
- Any field added, removed, or changed → log as diff
- Pricing change (any tier price differs) → significance = `high`
- Capability add/remove (integration, feature) → significance = `high`
- Executive change → significance = `medium`
- Press headline change → significance = `medium`
- Copy/layout change only (homepage_title differs but no structural change) → significance = `low`

#### 2.4 Append to changelog

If diffs detected, append to `references/knowledge/competitors/<slug>/changelog.jsonl`:

```jsonl
{"detected_at":"2026-05-04T15:30:00Z","category":"pricing","what_changed":"starter_plan_price","old_value":"$29","new_value":"$39","source_url":"https://acme.com/pricing","significance":"high","confidence":0.92}
```

One line per diff. File is append-only — never rewrite.

#### 2.5 Update state snapshot

Overwrite `references/knowledge/competitors/<slug>/.last_known_state.json` with the new live state.

#### 2.6 Write refresh timestamp

Write `references/knowledge/competitors/<slug>/.last_refresh` with current ISO-8601 timestamp.

### 3. Generate weekly digest

After all slugs processed, generate `docs/specs/refresh-competitors/<date>-digest.md`:

```markdown
# Competitive Landscape Digest — 2026-05-04

## Summary
- N competitors refreshed
- M significant changes detected (H high, M medium, L low)

## Changes by Competitor

### Acme Corp
- **HIGH** — Pricing: Starter plan raised from $29 to $39 ([source](https://acme.com/pricing))
- **MEDIUM** — Press: Announced Series B ([source](https://...))

### Beta Inc
- No changes detected

## Recommended Actions
- [ ] Review pricing impact on own positioning
- [ ] Update spec templates if Acme's new feature is relevant
```

### Self-Verify

| # | Check | How | PASS/FAIL |
|---|---|---|---|
| 1 | All tracked slugs enumerated | index.md slug count == processed count (± skipped) | |
| 2 | `.last_known_state.json` updated for every processed slug | fs.existsSync per slug | |
| 3 | `changelog.jsonl` valid JSONL | Each line parses as JSON | |
| 4 | Digest generated | `docs/specs/refresh-competitors/<date>-digest.md` exists | |
| 5 | No WebSearch rate limit burnout | <100 queries total (30 competitors × 3 = 90 max) | |

## Phase Receipt Contract

When running under `.svc/lane-tasks-<WI>.json`, emit receipts for each required
phase before marking the task completed:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-TrackedSetEnumeration --evidence command_output:.svc/refresh-competitors-tracked.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-BaselineLoad --evidence command_output:.svc/refresh-competitors-baseline.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-LiveStateDiscovery --evidence command_output:.svc/refresh-competitors-live.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-DiffAndChangelog --evidence file:references/knowledge/competitors/<slug>/changelog.jsonl
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-StateRefresh --evidence file:references/knowledge/competitors/<slug>/.last_known_state.json
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-WeeklyDigest --evidence file:docs/specs/refresh-competitors/<date>-digest.md
```

## Failure Modes To Prevent

1. **Full re-analysis creep** — skill must NEVER call `analyze-competitors` or trigger deep-dive. Diff only.
2. **Rate limit spiral** — without backoff, 90 queries in rapid succession hits limits. Implement 2s retry.
3. **False positive flood** — layout changes (homepage_title) flagged as high significance. Use significance rules.
4. **Missing baseline panic** — if `.last_known_state.json` missing, skip don't create. Creating it requires deep-dive.
5. **Changelog unbounded growth** — without archival, JSONL grows forever. Note: archival deferred to future WI.

## Pipeline Continuation

- source of truth: `.svc/lane-tasks-<WI>.json`
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume
- In Claude Code: mirror file state with `TaskList` / `TaskUpdate`; in Kimi use `/task` or `TaskList` / `TaskOutput` only as observation while the file remains authoritative; in Codex and other hosts without native task-mutation APIs: mirror only the active step in `update_plan`
- Mark this skill's task `completed` in `.svc/lane-tasks-<WI>.json`
- Weekly digest is informational — no downstream skill auto-invoked
- If `significance: high` diffs detected → user may choose to invoke `write-spec` or `validate-feature` to react

## Red Flags

- Skill tries to create `.last_known_state.json` from scratch → wrong skill, route to `analyze-competitors`
- Skill runs >100 WebSearch queries → rate limit risk, reduce batch or add delay
- Digest claims "no changes" for all 30 competitors → possible diff engine bug or stale `.last_known_state.json`
