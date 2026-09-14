#!/bin/bash
# DEPRECATED on the Claude host for READ-ONLY analysis fan-outs (WI-373):
# use the native Workflow tool per references/workflow-fanout-protocol.md
# (pipeline/parallel + StructuredOutput + budget). Retained for non-Claude
# hosts until parity; mutating multi-WI work stays on dispatch-waves.
# scripts/haiku-extract.sh <log-file>
# Tier-B salvage extractor for the svc worker summary contract.
# Runs locked-down Claude Haiku 4.5 with ZERO tools, no hooks, no exploration,
# no CLAUDE.md auto-discovery, no MCP, no auto-memory, no keychain.
# The agent definition below is baked-in so the script is self-contained.
#
# Returns either the real block (if salvageable) or a fail-shaped block
# signaling the worker violated the contract. Orchestrator can always parse.
#
# Expected invocation pattern:
#   scripts/extract-summary.sh <log>       # Tier A, free, deterministic
#   scripts/haiku-extract.sh   <log>       # Tier B, ~$0.001, fallback (Claude only)
#   scripts/resolve-model.sh PASS --json   # Use dynamic router to pick host-appropriate PASS model
#
# NOTE: On kimi-native profile, use Kimi with thinking OFF instead of this script.
#       Kimi handles PASS-tier extraction natively without the Claude CLI dependency.
#
# Required on PATH:
#   claude (Claude Code CLI)
# Required env (for plain Anthropic API, NOT MiMo):
#   ANTHROPIC_API_KEY  (user's normal Claude subscription key)
set -eu

LOG="${1:-}"
if [ -z "$LOG" ] || [ ! -r "$LOG" ]; then
  echo "usage: haiku-extract.sh <log-file>" >&2
  exit 2
fi

# --bare mode strips OAuth + keychain. ANTHROPIC_API_KEY env var is required.
# Fail loud and early rather than letting claude emit a cryptic "Not logged in".
if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  echo "haiku-extract.sh requires ANTHROPIC_API_KEY env var (--bare mode does not read OAuth or keychain)." >&2
  echo "Export your Anthropic API key in the shell calling this script, then retry." >&2
  exit 3
fi

# Inline agent definition. Uses only the CLI primitives --bare, --tools "",
# --agents, --agent. No external file dependency so this script travels with
# the repo and works on any host where claude is installed.
AGENT_JSON='{"summary-extractor":{"description":"Strict pass-through extractor for svc worker summary blocks.","prompt":"You are a strict pass-through extractor.\n\nYour ONLY job: locate the block between \"=== SVC_WORKER_SUMMARY ===\" and \"=== END_SVC_WORKER_SUMMARY ===\" in the user message and emit it verbatim with no additions.\n\nRULES:\n1. Do not explain. Do not reason out loud. Do not narrate.\n2. Do not use any tools. You have none.\n3. Do not explore. Do not read files. Do not search.\n4. Do not summarize anything other than what is inside the markers.\n5. If the input contains a valid block, emit it exactly as-is between the markers.\n6. If the input lacks the block OR the block is malformed, emit exactly this fail-shaped block instead (one newline after it, nothing else):\n\n=== SVC_WORKER_SUMMARY ===\nstatus: fail\nfiles_changed:\ncommits: none\nnotable_decisions:\n  - extractor: input log did not contain a valid summary block\nblockers:\n  - worker did not honor the SVC_WORKER_SUMMARY contract\nnext_action: orchestrator should re-dispatch the worker with a stricter prompt or manually inspect the log\n=== END_SVC_WORKER_SUMMARY ===\n\nReturn ONLY the block. No preamble. No postscript.","tools":[]}}'

# Stream the log into Claude Haiku with maximum lockdown.
# --bare              skip hooks, MCP, CLAUDE.md, auto-memory, keychain, background prefetches
# --tools ""          zero tools (cannot Read, Bash, WebFetch, Grep, etc.)
# --agents <json>     define the summary-extractor agent inline
# --agent             pin the session to that agent's system prompt
# --model             Haiku 4.5 (cheapest capable Anthropic model)
claude -p \
  --bare \
  --tools "" \
  --agents "$AGENT_JSON" \
  --agent summary-extractor \
  --model claude-haiku-4-5-20251001 \
  < "$LOG"
