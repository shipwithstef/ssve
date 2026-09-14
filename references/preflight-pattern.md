# Preflight Pattern for svc Skills (WI-096)

Every skill that reads or writes files should pre-flight its inputs and outputs **before doing any work**. On missing inputs or blocked outputs it must abort with an explicit list, not produce partial state that leaves output trapped in chat.

## Rationale

Per /insights friction analysis, ≥6 sessions stalled mid-execution because (a) the Write tool was sandbox-blocked, (b) a prerequisite file (vision.md, builder-profile.md, etc.) was absent. The skill produced output, presented it inline, and the session ended with a partial result nobody could consume. Pre-flight shifts the failure from "30 minutes in, half-done" to "30 seconds in, loud and recoverable."

## How to apply — skill-side contract

1. Add a **`## Preflight`** section near the top of `SKILL.md` (before Process).
2. List required **inputs** (relative paths, globs, or "declared in lane-tasks") and expected **outputs**.
3. Call `node scripts/preflight.mjs '<json>'` as the first action. The helper fails fast with a JSON diagnostic if anything is missing.
4. On FAIL, surface the diagnostic verbatim and stop. Do NOT continue with partial inputs.

### Minimal skill snippet

```markdown
## Preflight

**Inputs (required):**
- `docs/specs/vision.md`
- `docs/specs/personas/*.md`

**Outputs (will write):**
- `docs/specs/features/<feature-id>/spec.md`

**Check:**
```bash
node scripts/preflight.mjs '{
  "skill": "write-spec",
  "inputs":  ["docs/specs/vision.md"],
  "outputs": ["docs/specs/features/<resolved-id>/spec.md"]
}'
```
Abort the skill if preflight exits non-zero. Do not attempt to work around missing prerequisites — fail loudly and let the orchestrator route to the upstream skill.
```

## Helper contract

`scripts/preflight.mjs` accepts a JSON payload (positional or via `--config <path>`) with fields:

| Field | Type | Meaning |
|---|---|---|
| `skill` | string | Skill name (for diagnostics) |
| `inputs` | string[] | Paths that must exist + be readable |
| `outputs` | string[] | Paths whose parent dirs must be writable (created if absent) |

Exit codes: `0` pass · `1` missing/blocked · `2` bad config.

## Rollout

The rollout has two coverage levels:

1. Direct skill coverage: a skill carries its own `## Preflight` section and may declare `.svc/preflight-<skill>.json`.
2. Family coverage: `references/preflight-registry.json` covers every first-party skill in a preflight family with shared input/output policy until direct skill contracts are added.

`test-framework/evals/tier-1/validate-preflight-coverage.sh` is blocking: every included skill must have direct or family-level coverage, and family registry entries must be complete and non-overlapping.

Hook behavior is fail-open for missing contracts and unknown hosts. When a first-party hook runs `node scripts/preflight.mjs --hook --fail-closed` and a skill has declared `.svc/preflight-<skill>.json`, missing inputs or blocked outputs fail closed before the skill proceeds.
