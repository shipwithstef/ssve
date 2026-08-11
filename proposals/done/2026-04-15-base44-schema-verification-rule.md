# Framework Improvement: Base44 entity schema verification rule

**Status:** IMPLEMENTED (2026-04-15)

## Evidence

- **Source:** Example Marketplace WI-058 GPS toggle drift session (2026-04-15)
- **Finding:** `GPS-5` annotation was written as "PLANNED — requires dashboard check — cannot query via API". This is false. The `coding/write` round-trip API returns complete entity schemas including type, default, and description for every field. No dashboard is needed.
- **Severity:** medium — repeated false PLANNED annotations create noise and mis-route work

## Diagnosis

- **Root cause:** No rule documented that `coding/write` round-trip returns entity schemas. The base44-environment skill has the pattern buried in workflow examples, but the signal "you never need dashboard for schema checks" was absent. As a result, any skill invocation (sync-spec-code, write-e2e, etc.) that needed to verify a field's existence on a Base44 entity was defaulting to "requires manual check".
- **Category:** missing capability (undocumented API capability that prevents correct annotation of RESOLVED vs PLANNED)
- **Already in FRAMEWORK-STATE.md?** No — new finding

## Implementation

- **Route:** direct rule creation
- **Files created:**
  - `seriousvibecoding/rules/base44-schema.md` — framework source
  - `~/.claude/rules/base44-schema.md` — installed global rule
- **Key content:** the `coding/write` round-trip pattern for schema field lookup, "never write dashboard check required", safety note on real-content round-trip

## Replay Verification

- **Replay target:** run the documented pattern against Example Marketplace Location entity, check `gps_checkins_enabled` field
- **Result:** PASS
- **Evidence:**
  ```
  gps_checkins_enabled: { "type": "boolean", "default": true, "description": "Whether GPS-based customer check-ins are enabled for this location" }
  Field count: 41
  PASS: entity schema readable via API
  ```

## FRAMEWORK-STATE.md Mutations

- **Analysis History:** add entry for this finding
- **Known Gaps:** none — this is a new rule, not a gap fix
- **Capabilities:** no new skill capability — rule-level addition only
