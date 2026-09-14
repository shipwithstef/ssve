# Framework Improvement: OpenCode harness for dispatch-worker

**Status:** IMPLEMENTED (2026-04-20)

## Evidence
- **Source:** WI-088 Storyboard port on example-marketplace (session transcript 2026-04-20). `claude -p` with `ANTHROPIC_MODEL=mimo-v2-pro` hit *"Autocompact is thrashing: the context refilled to the limit within 3 turns of the previous compact, 3 times in a row"* on a 1141-line multi-file read. Trivial smoke tests worked (~2s). Conclusion: Claude Code CLI applies its own client-side compaction at ~150-200K regardless of the underlying model's context window.
- **Finding:** MiMo v2 Pro advertises 1M context but was unreachable through `claude -p` because the CLI compacts first. The transport, not the model, was the limit.
- **Severity:** high for multi-file execute-changeset tasks on MiMo; low for small tasks.

## Diagnosis
- **Root cause:** `claude -p` is Anthropic-tuned, not model-agnostic. Its window manager is baked in and doesn't adapt to `ANTHROPIC_MODEL` overrides pointing at models with larger context.
- **Category:** fragility + missing capability (the svc framework had no model-agnostic executor transport).
- **Already in FRAMEWORK-STATE.md?** No (new).

## Implementation
- **Route:** quick-fix (direct edits to `scripts/dispatch-worker.sh` + one reference file + FRAMEWORK-STATE entry).
- **Files changed:**
  - `scripts/dispatch-worker.sh` — added third harness branch `opencode` alongside `claude` and `openclaw`. Routes through `opencode run --model mimo/<model> --dangerously-skip-permissions --pure`. Extended the worker PROMPT contract with a mandatory `SVC_WORKER_SUMMARY` machine-parseable block at end-of-run (applies to all three harnesses). Unified the final dispatch to one line: `$EXEC_CMD "$PROMPT"`.
  - `references/opencode-mimo-config.json` (new) — reference copy of the MiMo provider block for `~/.config/opencode/opencode.json`. Real user config (with plain credentials) is per-user install, outside the repo.
  - `FRAMEWORK-STATE.md` — Analysis History entry dated 2026-04-20 documenting the gap closure and locked decisions.
- **Commits:** pending on next push.

## Replay Verification
- **Replay target:** invoke `SVC_HARNESS=opencode SVC_WORKER_SKILL=probe bash scripts/dispatch-worker.sh "<trivial prompt asking for the summary block>"` and confirm exit 0 + parseable summary block.
- **Result:** PASS. Verified 2026-04-20 with `SVC_HARNESS=opencode SVC_WORKER_SKILL=probe`. Worker emitted the summary block in the expected format, exit 0, round-trip ~3s. Model echoed: `mimo-v2-pro`.
- **Evidence:** see session transcript — `=== SVC_WORKER_SUMMARY === / status: success / ... / === END_SVC_WORKER_SUMMARY ===` returned cleanly.

## FRAMEWORK-STATE.md Mutations
- **Analysis History:** 2026-04-20 entry added above the 2026-04-19 External Canvas Handoff entry.
- **Known Gaps:** no net change — this closed a gap not previously tracked there.
- **Decisions:** three new locked decisions (harness defaults, config file location, preserved skill routing across harnesses).
- **Capabilities:** `references/opencode-mimo-config.json` added.

## Deferred follow-ups
- Per-harness observability (cost + latency per dispatch, emitted to the summary block).
- Automated e2e test: real multi-file port via `opencode` harness to confirm the 1M context is actually usable end-to-end on a task that killed `claude -p` (WI-088 storyboard port is the natural regression fixture).
- `--agent` flag investigation: OpenCode supports named agents — worth exploring whether per-skill agents give better tool-use behavior than the default.
