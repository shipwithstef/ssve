# gstack Telemetry & Testing — Details

## Telemetry

### Supabase Backend

3 tables:
- `telemetry_events` — skill usage events (name, duration, success/fail, version, OS)
- `installations` — installation tracking (id, version, last_seen)
- `update_checks` — version check pings

3 edge functions:
- `telemetry-ingest` — batch validation, max 100 events/50KB, schema v1 enforcement
- `update-check` — returns GSTACK_CURRENT_VERSION, logs install ping
- `community-pulse` — weekly active count, top skills, crash clusters, version distribution

### RLS Security

Migration 002 tightened security:
- Dropped all SELECT policies (anon cannot read any table)
- Dropped unrestricted UPDATE policy
- Kept INSERT for backwards compat
- Migration 003: column-level GRANT restricts anon UPDATE to (last_seen, gstack_version, os)

`supabase/verify-rls.sh` — bash smoke test verifying SELECT/UPDATE denied, INSERT allowed.

### Telemetry Tiers

| Tier | What |
|---|---|
| off | Nothing logged or sent |
| anonymous | Local JSONL + batch POST without installation_id |
| community | Local JSONL + batch POST with installation_id |

### Local Analytics

`gstack-analytics` reads local JSONL. Bar chart output with avg duration per skill,
success rate calculation. No remote data needed.

`gstack-community-dashboard` calls Supabase community-pulse for aggregated stats.

### Learnings System

`gstack-learnings-log` — append-only JSONL storage per project.
`gstack-learnings-search` — confidence decay, dedup (latest winner per key+type),
cross-project support, type/query filtering.

### Timeline

`gstack-timeline-log` — local-only session timeline.
`gstack-timeline-read` — supports --since, --limit, --branch, skill counts.

## Testing

### Test Tiers

| Tier | What | Cost | Speed |
|---|---|---|---|
| 1 — Static | Parse $B commands, validate against command registry | Free | <5s |
| 2 — E2E | Spawn real `claude -p`, run each skill, scan for errors | ~$3.85 | ~20min |
| 3 — LLM judge | Sonnet scores docs on clarity/completeness/actionability | ~$0.15 | ~30s |

### E2E Infrastructure

Session runner (`test/helpers/session-runner.ts`):
1. Writes prompt to temp file
2. Spawns `sh -c 'cat prompt | claude -p --output-format stream-json --verbose'`
3. Streams NDJSON from stdout
4. Races against configurable timeout
5. Parses transcript into structured results

Eval persistence (`test/helpers/eval-store.ts`):
- Incremental: `savePartial()` writes `_partial-e2e.json` after each test (atomic)
- Final: timestamped eval file (e.g. `e2e-20260314-143022.json`)

### CI/CD

| Workflow | Trigger | What |
|---|---|---|
| actionlint.yml | push/PR | Workflow lint |
| ci-image.yml | schedule/push | Docker CI image on ghcr.io |
| evals.yml | PR gate | 13 e2e suites, eval results → PR comment |
| evals-periodic.yml | Monday 6am UTC | 9 e2e suites, 90-day artifact retention |
| skill-docs.yml | push/PR | Freshness check for generated SKILL.md |

13 PR gate suites: plan, design, qa-bugs, qa-workflow, review, workflow,
routing, codex, gemini, llm-judge, e2e-browse (on ubicloud-standard-8), etc.

### Eval Toolchain

| Script | What |
|---|---|
| eval-compare.ts | Diff two eval runs by tier/branch |
| eval-list.ts | Tabular history of all runs |
| eval-select.ts | Touchfile-based test selection |
| eval-summary.ts | Aggregate stats with flaky detection |
| eval-watch.ts | Live dashboard reading heartbeat + partial files |

### Test Coverage

- Browse: 40+ test files, 750+ security regression tests
- Design: 3 test files (feedback-roundtrip, gallery, serve)
- Infrastructure: host-config, gen-skill-docs, relink, hook-scripts, etc.
- E2E skills: 13+ test files covering individual skills
- Security: adversarial-security, content-security, sidebar-security, server-auth

## Analysis

The 3-tier testing approach is pragmatic: static validation catches 95% of issues
for free, E2E tests catch integration issues ($3.85/run), LLM-as-judge catches
quality issues ($0.15). The eval toolchain (compare, list, summary, watch) enables
data-driven quality tracking.

The telemetry architecture is well-designed for open source: opt-in only, local
analytics always available, RLS prevents even the anon key from reading data.
Column-level GRANTs on installations prevent update abuse.

## L4 Pointers

- Supabase: `supabase/` (config, functions, migrations, verify-rls.sh)
- Test helpers: `test/helpers/` (session-runner, eval-store, llm-judge)
- CI workflows: `.github/workflows/` (5 files)
- Eval scripts: `scripts/eval-*.ts` (5 files)
- Analytics: `bin/gstack-analytics`, `scripts/analytics.ts`
