# WI-542 / WI-543 grok inspect receipts

Tracked copies of the live `grok inspect --json` probe. These replace the
untracked worktree-only `.svc/wi-543-inspect-*.json` files.

| File | When | session_start | Grok-home healthcheck | Claude healthcheck |
|---|---|---|---|---|
| [wi-542-grok-inspect-before.hooks.json](wi-542-grok-inspect-before.hooks.json) | before nested wire | 5 | 0 | 1 |
| [wi-542-grok-inspect-after.hooks.json](wi-542-grok-inspect-after.hooks.json) | after nested wire | 6 | 1 | 1 |

Full `grok inspect --json` blobs remain local-only at worktree `.svc/wi-543-inspect-*.json` (untracked). Tracked files keep `event`, `vendor`, `timeout`, `target`, and `source` for every loaded hook.

AC-543-6 inspect half: Grok-home healthcheck == 1 and Claude healthcheck <= 1.
Total count == 1 is not a pass bar.

## Honest backup note

`~/.grok/config.toml.wi543.bak` currently hashes to the same nested file as
`~/.grok/config.toml` (`1afbca9d...`). It is **not** the original flat
pre-migration backup (`5804dc0c...`). The wirer now uses
`.pre-migration.bak` (immutable, once) and `.svc-wire.rollback` (per attempt).
