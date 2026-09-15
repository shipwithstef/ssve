# Rolling rollback — WI-FW-TWO-BOX-01

This file is the WI-553 rolling_rollback path. It is distinct from immutable-baseline.md.

Rollback: revert the promoted implementation of this WI from canonical main using the existing reviewed revert path, then rerun ./setup --all-hosts. Do not rewrite historical git notes. After revert, packageCapabilities returns issuance_versions [4] and Open Box Two-Box is absent. New-plan v5 emission stops because the reverted emitter no longer offers it. Bootstrap snapshot bytes remain as ordinary files in history if the revert keeps them; they do not authorize new v4 issuance on a reverted tree unless the snapshot file and matching body still exist together.

No database rollback. Do not alter HOME/CODEX_HOME to roll back. Pre-existing baseline Tier-1 failures (RD12) are not fixed by rollback.
