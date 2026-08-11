# Scheduled Routines

Framework-scheduled background activities that run without blocking gates or user sessions.

## Competitor Watch Routine

**File:** `~/.claude/routines/<project>-competitor-watch`

**Cadence:** Weekly (default: Mondays at 09:00 local time)

**What it does:**
1. Invokes `refresh-competitors` skill
2. Surfaces digest to user as `[competitive-digest] <date>: N changes this week`
3. Appends execution receipt to `.svc/pipeline-decisions.jsonl`

**Template:**
```json
{
  "name": "<project>-competitor-watch",
  "skill": "refresh-competitors",
  "cadence": "weekly",
  "day": "monday",
  "time": "09:00",
  "timezone": "local",
  "inputs": {
    "competitor_index": "references/knowledge/competitors/index.md"
  },
  "outputs": {
    "digest": "docs/specs/refresh-competitors/<date>-digest.md"
  },
  "on_failure": "log_warning",
  "on_skip": "log_info"
}
```

**Config override:** Set `SVC_COMPETITOR_WATCH_CADENCE=daily|weekly|biweekly` in env to change frequency.
