# Todo API — Serious Vibe Coding Pipeline Example

Minimal example that exercises every phase of the svc pipeline on the
smallest possible surface: a todo API with an overdue-checker cron.

## What This Demonstrates

- **Feature** (human consumer): Todo management — CRUD operations
- **Enabler** (system consumer): Overdue checker — cron marks past-due todos
- All 9 pipeline phases represented with minimal artifacts
- Structural validation via shell script

## Validate

```bash
./scripts/validate-pipeline.sh
```

Exits 0 if all checks pass, 1 if any fail.

## Structure

See `docs/plans/manifest.md` for the full file inventory and apply order.
