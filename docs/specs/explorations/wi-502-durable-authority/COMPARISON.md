# Finalist Comparison: WI-502 durable authority

No implementation prototype was written because the owner explicitly requested planning before implementation. Existing controlled evidence supplies the decision probe:

| Probe | A1 file-CAS local model | A2 SQLite model | Result |
|---|---|---|---|
| WI-486 repository/WI lock race | Reuses a proven one-winner local primitive | Would also pass with a transaction | A1 adequate |
| Current false deny/permit payloads | Fixed by shared scope before either store | Fixed by shared scope before either store | Store choice not the defect |
| Install surface | Existing Node/filesystem/Git only | Adds database binding/tooling and migration | A1 lower risk |
| Exact rollback | Restore backed-up JSON bytes | Export/restore transaction/database | A1 simpler |

Implementation must still run red/green CAS/handover races. A failure there reopens A2 before promotion; it does not authorize an ad-hoc weakened file store.
