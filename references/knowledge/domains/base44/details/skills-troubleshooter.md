# Base44 Troubleshooter Skill

## Source
- **File:** `skills/base44-troubleshooter/SKILL.md` (60 lines)
- **Reference:** `skills/base44-troubleshooter/references/project-logs.md` (57 lines)

## Purpose

> "Troubleshoot production issues using backend function logs. Use when investigating app errors, debugging function calls, or diagnosing production problems in Base44 apps."

## Prerequisites

1. Verify authentication:
```bash
npx base44 whoami
```
2. Must be run from project directory (where `base44/.app.jsonc` exists):
```bash
cat base44/.app.jsonc
```

## Available Commands

| Command | Description |
|---------|-------------|
| `base44 logs` | Fetch function logs for this app |

## Troubleshooting Flow

### 1. Check Recent Errors
```bash
npx base44 logs --level error
```

### 2. Drill Into a Specific Function
```bash
npx base44 logs --function <function_name> --level error
```

### 3. Inspect a Time Range
```bash
npx base44 logs --function <function_name> --since <start_time> --until <end_time>
```

### 4. Analyze the Logs
- Look for stack traces and error messages
- Check timestamps to correlate with user-reported issues
- Use `--limit` to fetch more entries if default 50 isn't enough

## Log Command Options

| Option | Description |
|--------|-------------|
| `--function <names>` | Filter by function name(s), comma-separated. If omitted, fetches logs for all project functions |
| `--since <datetime>` | Show logs from this time (ISO format) |
| `--until <datetime>` | Show logs until this time (ISO format) |
| `--level <level>` | Filter by log level: `log`, `info`, `warn`, `error`, `debug` |
| `-n, --limit <n>` | Number of results (1-1000, default: 50) |
| `--order <order>` | Sort order: `asc` or `desc` (default: `desc`) |

## Important Notes

- Authentication required
- Project context required (must have `base44/.app.jsonc`)
- When multiple functions specified, logs are merged and sorted by timestamp
- If `--function` omitted, logs fetched for all functions defined in `base44/config.jsonc`
- `--limit` applies after merging logs from all specified functions
- `--since` and `--until` normalized to UTC if no timezone provided

## Cross-References
- `skills-cli-contract.md` — CLI commands reference
- `skills-sdk-contract.md` — SDK error handling patterns
