# Framework Improvement — Codex execution integrity: prompt authority + real skill loading

**Status:** PLANNING
**ID:** FP-026
**Work item:** WI-485
**Host scope:** Codex only
**Source:** `proposals/2026-07-14-session-audit-codex-foreign-stop-and-ghost-skill.md`

## Single gap

The Codex host integration does not establish a session/turn-scoped authority boundary before it either continues work or accepts a skill-governed mutation. The same missing boundary creates two user-visible failures:

1. A Stop hook can manufacture a new continuation prompt for an unrelated WI owned by another session.
2. A Codex task can mutate artifacts without proving that the routed skill was loaded for this session, turn, and task.

This is one gap, not two unrelated features: **Codex control decisions currently trust shared repository recency/fallback state instead of exact current-turn authority.**

## Live evidence

On 2026-07-14, Codex session `019f6001-5463-7dc0-a1f5-73104831606a` was answering a read-only request to find today's proposal. The Stop hook demanded completion of WI-479. WI-479's claim named different Claude Fable session `d3f25c45-a283-4483-af64-ae62918255ff`, while the shared session contract ended in a foreign `bound_to: wi-backlog` entry.

The skill side is equally concrete: `scripts/wire-codex-hooks.mjs` installs `hooks/kimi/svc-kimi-skill-load-enforcer.sh`, whose first host check exits successfully when the detected host is not Kimi. It therefore supplies no Codex enforcement.

## Host capability constraints

Verified against the official Codex hooks reference on 2026-07-14:

- Stop `{decision:"block",reason}` creates a continuation prompt; it is not a passive refusal to terminate.
- Hook input supplies stable `session_id` and turn-scoped `turn_id`.
- `UserPromptSubmit` and `Stop` ignore matchers.
- Matching hook commands can run concurrently, so no correctness rule may depend on hook order.
- PreToolUse covers Bash, `apply_patch`/Edit/Write, and MCP tools, but is explicitly incomplete; hooks are a guardrail, not a full security boundary.
- Hook commands run from session CWD; use installed absolute paths or git-root resolution.
- Changed hook hashes require review/trust through `/hooks`.

## Proposed change

### F-001 — Codex prompt authority ledger [P0]

Add a Codex-only UserPromptSubmit hook which writes one atomic host-runtime record under `${XDG_RUNTIME_DIR:-${TMPDIR:-/tmp}}/svc-codex/<repo-hash>/<session-id>/`. This location works even for a read-only session in the protected default checkout and cannot dirty another worktree:

```json
{
  "schema_version": 1,
  "session_id": "...",
  "turn_id": "...",
  "prompt_hash": "sha256:...",
  "cwd": "/absolute/worktree",
  "explicit_wi": "WI-485 or empty",
  "continuation_intent": "continue|resume|end_to_end|none",
  "recorded_at": "ISO-8601"
}
```

The prompt itself is never persisted in this new record. Existing active-intent storage may remain the human-debug surface, but authority comes from this exact identity record.

### F-002 — Codex Stop scope firewall [P0]

Replace Codex's shared Stop command with one Codex-only composite wrapper. The wrapper checks authority first and invokes the shared completion guard internally only for an authorized target; it does not rely on ordering between separate Stop hooks. It may emit a continuation only when all applicable facts agree:

1. Hook `session_id` and `turn_id` equal the latest prompt-authority record.
2. The target WI was explicitly named by the latest prompt, or the same session/turn created a route-workflow binding after that prompt.
3. The WI claim is absent/stale or normalizes to the current session; a fresh foreign claim always allows Stop.
4. Worktree path and branch match the binding.
5. The existing completion cap has not been exceeded.

For Codex, these sources may provide evidence but never independently create authority: exactly one active graph, branch-name inference, last line of shared session-contract, `bound_to: wi-backlog`, or a recent receipt from another session.

If authority is missing, ambiguous, foreign, or stale, return an empty allow response. An optional `systemMessage` may explain the advisory, but no `decision:block` is allowed. Explicit takeover requires a separate safe ownership-transfer command; `continue WI-N` alone cannot steal a fresh foreign claim.

### F-003 — Codex skill-load mutation gate [P0]

Replace the Kimi wrapper in Codex wiring with a native Codex PreToolUse hook on `Bash|apply_patch|Edit|Write` and eligible mutating MCP tools. Add a Codex-only load command that prints the complete selected SKILL.md, verifies its hash and expected task skill, calls the existing task-graph `load-skill` operation, and atomically writes the exact runtime receipt. Existing `task-graph.mjs` behavior and non-Codex receipts remain unchanged. Before a mutation governed by an active task, require a receipt containing:

```json
{
  "schema_version": 1,
  "session_id": "...",
  "turn_id": "...",
  "task_graph": "/absolute/path/.svc/lane-tasks-WI-N.json",
  "task_id": "...",
  "skill": "plan-changeset",
  "skill_path": "/absolute/path/SKILL.md",
  "skill_sha256": "...",
  "loaded_at": "ISO-8601"
}
```

The new Codex load command is the canonical Codex path after the main agent requests the selected skill. The gate compares the required skill declared by the active task with the exact receipt. A receipt from another session, task, worktree, or skill hash is invalid. `turn_id` is recorded for audit; the same receipt remains valid in later turns of the same session while task/worktree/hash identity is unchanged, and must be refreshed on any of those scope changes.

Read-only commands remain allowed. Repositories without svc task state remain allowed. Malformed in-scope identity fails closed with a precise recovery command. Because PreToolUse is incomplete, post-action validators also reject governed artifacts lacking the same exact receipt.

### F-004 — Canonical Codex payload and artifact normalization [P1]

Add one shared Codex adapter for `session_id`, `turn_id`, `cwd`, tool name, command/patch payload, and target paths. Treat `apply_patch` as canonical and Edit/Write as aliases. Protect the actual plan surface `docs/plans/` as well as other skill outputs. Remove repository-global 90-minute receipt acceptance for Codex decisions.

### F-005 — Codex-only wiring and cross-host invariance [P0]

Only `scripts/wire-codex-hooks.mjs`, Codex-specific hook files/scripts, shared pure helpers explicitly called by Codex, tests, and documentation may change. Do not edit other host wirers/manifests or alter shared hook behavior for Claude, Kimi, Gemini, OpenCode, Antigravity, or Cursor. The Codex wirer must manage stable svc keys, prune obsolete managed entries, and fail installation unless the effective user plus repository config layers expose exactly one svc Stop entry: the composite firewall.

Capture non-Codex behavior before and after and assert it is byte-identical: registry output where a wirer supports `--list-all`, source plus dry-run output hashes otherwise, and installed-config hashes without copying secret values. Shared helpers are allowed only if current callers' outputs are fixture-identical.

### F-006 — Runtime replay and trust-state proof [P0]

Add fixtures for:

- this exact foreign WI-479 Stop incident;
- prompt A followed by unrelated prompt B;
- explicit same-session resume;
- explicit resume against a fresh foreign claim;
- missing, valid, foreign, stale-hash, and wrong-task skill receipts;
- canonical `apply_patch` payloads;
- two matching hooks executing without ordering assumptions.

Installation verification must report three separate states: configured in `~/.codex/hooks.json`, reviewed/trusted by Codex, and observed firing in a controlled Codex trace. A local fixture cannot be described as live runtime proof.

## Non-goals

- No behavior change for non-Codex hosts.
- No automatic takeover of foreign WIs.
- No claim that hooks intercept every mutation path.
- No storage of raw user prompts in the new authority record.
- No implementation of WI-481 through WI-484 inside WI-485.
- No merging of all session state into one global ledger.

## Acceptance criteria

| ID | Criterion |
|---|---|
| AC-485-1 | The recorded WI-479 incident allows Stop and emits no continuation prompt |
| AC-485-2 | Only same-session/turn explicit binding or same-turn routing can authorize Codex continuation |
| AC-485-3 | Fresh foreign claims cannot be resumed or stolen by Stop or plain `continue WI-N` |
| AC-485-4 | Governed Codex mutations fail before an exact skill-load receipt and pass after it |
| AC-485-5 | Foreign/stale/wrong-task/wrong-hash receipts fail |
| AC-485-6 | `apply_patch` and actual canonical artifact paths are covered |
| AC-485-7 | All non-Codex registries and fixture outputs remain unchanged |
| AC-485-8 | Setup distinguishes configured, trusted, and runtime-observed hook states |
| AC-485-9 | Documentation states PreToolUse coverage limits and preserves post-action validation |
| AC-485-10 | No raw prompt text or secret is persisted by the new authority/receipt files |

## Rollout and rollback

1. **Shadow:** evaluate fixtures and write advisory diagnostics; no new block.
2. **Scope enforce:** enable Stop firewall; foreign/ambiguous cases fail open.
3. **Skill enforce:** block only in-scope Codex mutations with a declared active skill task.
4. **Post-merge verify:** run Codex trace proving both one allowed and one denied case, then inspect `/hooks` trust.

Rollback removes the Codex-only hook entries with the Codex wirer, restores the prior installed registry from its backup, and leaves all non-Codex configuration untouched. Authority/receipt runtime files are regenerable; a SessionStart TTL sweep removes abandoned session directories because Codex exposes no SessionEnd hook.

## Success metric

Across 100 synthetic interleavings and the live incident fixture: zero foreign-WI continuation prompts, zero acceptance of cross-session skill receipts, all valid same-session flows preserved, and byte-identical non-Codex registry snapshots.
