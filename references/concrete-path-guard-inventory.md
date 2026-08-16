# Concrete-path guard inventory

Path-specific safety must follow the target, not the tool spelling. The shared
`hooks/lib/bash-mutation-targets.mjs` classifier extends the following pre-tool
guards to concrete Bash writers while leaving read-only commands target-free.

| Guard | Direct file tools | Bash writers | Decision |
|---|---:|---:|---|
| Workflow config and phase guard | yes | yes | deny, ask, or warn using the same path rules |
| Skill artifact authenticity | yes | yes | deny counterfeit canonical artifacts |
| Session contract freshness | yes | yes | deny stale or missing governed context |
| Codex operation authority | yes | yes | remains the fail-closed authority boundary for ambiguous or dynamic shell |

Covered concrete writers include redirects and heredocs, `tee`, `sed -i`,
`touch`/`truncate`/remove operations, copy/move destinations, and literal Python
`open(..., write-mode)` or `Path(...).write_*` calls. Dynamic shell expressions
are intentionally not guessed; the Codex dispatcher and contained executor own
that fail-closed boundary.
