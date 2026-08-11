# Session, Worktree, and WI Binding

This contract prevents one host session from creating mutation or completion pressure in another session's worktree.

## Authority order

1. Exact host `session_id` plus a worktree-local binding.
2. A matching, fresh, normalized WI claim.
3. Exact WI, absolute worktree, repository, and branch agreement.
4. Explicit current-user `continue WI-N` or `resume WI-N` when continuation is requested.

Branch inference, a single active graph, the last session contract, and active-intent cache entries are diagnostics only. They never create mutation authority.

Bindings live at `<worktree>/.svc/bindings/<session-hash>.json`. Claims live at `<worktree>/.svc/claims/WI-N.claim.json`. Every governed path is absolute and derived from the worktree, not ambient `PWD`.

## Roles

| Role | Binding rule | Mutation authority |
|---|---|---|
| `mutating` | exactly one WI and one worktree | yes, while binding and claim agree |
| `reviewer` | zero-WI diagnostic record optional | no |
| `research` | zero-WI diagnostic record optional | no |
| `audit` | zero-WI diagnostic record optional | no |

Agent or model labels such as `claude`, `codex`, and `kimi` are never session identities. Accepted legacy owner fields are `session_token`, `session`, `session_id`, and session-shaped `claimed_by`.

## Lifecycle

- **Create:** write the claim and binding with temp-file, fsync, rename, mode 0600.
- **Renew:** the same session/WI/worktree identity updates `updated_at` without changing `generation`.
- **Release:** only the owning session may release a live mutating binding and claim.
- **Transfer:** compare the expected generation, then require owner release or positive stale proof from TTL/PID. Plain continuation text never transfers ownership.
- **Cleanup:** remove only stale or explicitly released records; never delete a fresh foreign record.

Malformed or ambiguous ownership fails open for Stop with an advisory. It does not select a different graph. Governed mutation gates may fail closed independently.

## Completion pressure

The completion guard resolves binding and claim before graph status. Fresh foreign claims, missing attributable identity, worktree mismatch, non-execution roles, and ambiguous diagnostics all allow Stop with advisory output. Pressure counters are stored under the current-user runtime root and keyed by repository, session, worktree, and WI hashes. `SVC_COMPLETION_MAX` is clamped to 1 through 3.

## Security and recovery

- Reject symlinked binding/claim files and non-owned files.
- Reject relative repository, worktree, graph, and claim paths.
- Do not persist raw prompts in ownership records.
- Recover a stale owner with an expected-generation transfer, never by deleting or rewriting a live foreign claim.
