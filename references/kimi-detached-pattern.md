# Detached Kimi Runner — When to Use, When Not To

The detached Kimi runner (`scripts/run-kimi-detached.sh`) lets any svc skill
launch a long-running Kimi job that survives past the parent process's exit.
It returns a job descriptor in <2 seconds; the orchestrator polls
`scripts/kimi-job-status.sh <job_id>` later and judges the outcome.

## Why this exists

The Claude Code Bash tool is hard-capped at 10 minutes (foreground or
background). Kimi reasoning runs on long prompts (deep extraction, repo
walks, multi-source synthesis) frequently exceed that ceiling. Without a
detachment primitive, every skill that delegates to Kimi either re-implements
its own backgrounding (drift), or stays under the cap and ships shallow
results.

This runner gives skills a single, stable contract for offloading Kimi work
without paying parent-orchestrator tokens for the wait.

## Use the detached runner WHEN

- Expected duration ≥ 2 minutes
- Skill wants to fan out N parallel Kimi jobs and judge them as a batch
- Prompt is large enough that even a fast Kimi response burns parent tokens
  if streamed back inline
- Skill produces an artifact on disk (analysis report, extraction JSON,
  candidate spec) that the orchestrator only needs to read after the fact

## Do NOT use the detached runner WHEN

- Expected duration < 30 seconds — `kimi -p '<prompt>'` foreground is simpler
- Running inside a hook (PreToolUse/PostToolUse/Stop) — hooks already have
  per-event timeouts; detaching past the hook's lifetime breaks the
  decision-back-to-host contract
- Review skills that intentionally cap at 20 min and need their findings
  returned to the same turn — `scripts/review-plan-kimi.sh` stays foreground
  for this reason
- The skill needs Kimi's output in the SAME turn to make its next decision —
  detachment only pays off when the orchestrator can do other work (or
  return to the user) while Kimi runs

## Contract

### Launch

```bash
scripts/run-kimi-detached.sh \
  --skill <skill-id> \
  --prompt-file /tmp/my-prompt.txt \
  [--max-seconds N] \
  [--label <free-text>]
```

Returns one JSON line on stdout:

```json
{
  "job_id": "kimi-research-1714060800-a1b2",
  "log_path": "/tmp/svc-kimi-jobs/kimi-research-1714060800-a1b2.log",
  "pid_path": "/tmp/svc-kimi-jobs/kimi-research-1714060800-a1b2.pid",
  "max_seconds": 3600,
  "started_at": "2026-04-26T10:00:00Z"
}
```

### Poll

```bash
scripts/kimi-job-status.sh <job_id>
```

Returns one JSON line. While running:

```json
{"job_id":"...","state":"running","pid":12345,"elapsed_seconds":42,"log_tail_kb":3}
```

After completion:

```json
{"job_id":"...","state":"done","exit_code":0,"elapsed_seconds":612,"log_tail_kb":48}
```

States: `running`, `done`, `timeout`, `killed`, `unknown`.

### List

```bash
scripts/kimi-job-status.sh --list
```

Returns the full registry as a JSON array.

### Per-skill default caps

Defaults are read from the `KIMI_DETACHED_CAPS` block in
`references/model-routing.md`. Caller may override via `--max-seconds`, but
no caller can exceed `KIMI_DETACHED_HARD_CAP` (env, default 7200s).

| Skill bucket | Default cap |
|---|---|
| review        | 1200s |
| ingestion     | 3600s |
| research      | 3600s |
| exploration   | 1800s |
| default (any other) | 1800s |

If your skill ID isn't in the table, it falls back to `default`. Add a row
to `references/model-routing.md` if a different default is appropriate.

### Cleanup

`scripts/kimi-job-cleanup.sh` purges `/tmp/svc-kimi-jobs/*` entries older
than 24h. Cron-able. Logs/status files older than the threshold are deleted;
the registry is compacted to drop entries whose log_path no longer exists.

## Decision heuristic for skill authors

```
Is this Kimi run expected to exceed 2 minutes?
  ├── No  → use `kimi -p` or `kimi < prompt-file` foreground
  └── Yes
      ├── Are you inside a hook? → NO, do not detach (hook lifetime conflict)
      ├── Do you need the output in this same turn? → NO, do not detach
      └── Otherwise → use the detached runner
```

## Migration policy

This WI is purely additive — no existing skill is migrated by it. Each
opt-in lands as its own follow-up WI so the migration can be reviewed in
isolation. Initial follow-up candidates:

- `research` — long URL/repo extractions
- `ingest-guide` / `ingest-guide-batch` — long social-content extraction
- `explore-solutions` — alternative-paradigm comparisons

## Implementation notes

- The runner double-detaches via `setsid nohup ... & disown`, so the worker
  process is reparented to PID 1 and is not reaped when the launching shell
  exits.
- The worker writes a `.status` file when it finishes (any reason), giving
  the status reporter a deterministic completion signal even after the
  process has gone.
- `timeout --foreground "${MAX_SECONDS}s" kimi` enforces the cap; on cap
  hit, exit code 124 → state `timeout`.
