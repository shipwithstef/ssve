# Framework improvement: launcher-routed Codex dispatcher

**Status:** ACCEPTED
**Accepted WI:** WI-529
**Severity:** critical

## Gap

Codex setup materializes the durable enforcement launcher, then the wirer replaces the launcher-routed skill-load entry with a direct composite dispatcher command. Setup reports success, while `check-install-drift.sh --host codex` correctly reports missing governed markers.

This proposal covers one gap only: the effective composite Codex PreToolUse dispatcher must itself execute through the durable launcher, and setup must reject any governed case-wirer whose installed command lacks its declared markers.

## Acceptance criteria

- The dispatcher is a registered launcher target and the installed Codex command contains `svc-enforce` plus `svc-codex-pretool-dispatcher`.
- The dispatcher continues to execute the exact skill-load gate and all existing children once, preserving serialized behavior.
- Setup, migration, drift detection, and self-heal verify all governed markers on one effective command; unrelated config text cannot launder a direct route.
- The Codex fixture proves exactly one launcher-backed dispatcher and exactly one serialized skill-load child.
- Re-running setup is idempotent and `check-install-drift.sh --host codex` exits zero.
- Broken routing aborts setup before a false `Done` claim.

## Route

Framework install hot path: full mandatory chain under WI-529.
