#!/usr/bin/env bash
# skills/ingest-guide-batch/scripts/child-worker.sh
# Per-guide child worker. Called by parallel-orchestrator.mjs.
#
# ARGS:
#   $1 = source-id (kebab-case)
#   $2 = guide file path (absolute, in the parent repo/batch dir)
#   $3 = batch-id
#
# BEHAVIOR:
#   1. Create a worktree ingest-<source-id> branched off main.
#   2. Copy the guide file into the worktree at docs/specs/ingest-guide/<source-id>-raw.md.
#   3. Dispatch the ingest-guide skill via scripts/dispatch-worker.sh.
#   4. Exit with the dispatcher's exit code.
#
# The child is responsible for appending a line to its own worktree's
# .svc/pipeline-decisions.jsonl when ingest-guide completes.
#
# v1 SCOPE: wiring + dispatch; no orchestrator-side mocking or fake runs.
# If dispatch-worker.sh is not installed, exit 3 with a clear message.

set -euo pipefail

SOURCE_ID="${1:-}"
GUIDE_PATH="${2:-}"
BATCH_ID="${3:-}"

if [[ -z "$SOURCE_ID" || -z "$GUIDE_PATH" || -z "$BATCH_ID" ]]; then
  echo '{"verdict":"failed","reason":"child-worker: missing args (source-id, guide-path, batch-id)"}' >&2
  exit 2
fi

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT"

WORKTREE_BRANCH="ingest-${SOURCE_ID}"
WORKTREE_PATH=".worktrees/${WORKTREE_BRANCH}"

# Create the worktree. If it already exists, reuse it.
if [[ ! -d "$WORKTREE_PATH" ]]; then
  bash scripts/worktree.sh create "$WORKTREE_BRANCH" >&2 || {
    echo "{\"verdict\":\"failed\",\"reason\":\"worktree.sh create failed for ${WORKTREE_BRANCH}\"}" >&2
    exit 4
  }
fi

# Copy the guide into the worktree.
TARGET_DIR="${WORKTREE_PATH}/docs/specs/ingest-guide"
mkdir -p "$TARGET_DIR"
cp "$GUIDE_PATH" "${TARGET_DIR}/${SOURCE_ID}-raw.md"

# Dispatch the ingest-guide skill via the standard worker.
if [[ -x scripts/dispatch-worker.sh ]]; then
  SVC_WORKER_SKILL="ingest-guide" \
  SVC_SUBAGENT="1" \
  SVC_WORKTREE="$WORKTREE_PATH" \
  SVC_INGEST_SOURCE_ID="$SOURCE_ID" \
  SVC_INGEST_BATCH_ID="$BATCH_ID" \
  bash scripts/dispatch-worker.sh
  exit $?
else
  echo "{\"verdict\":\"failed\",\"reason\":\"scripts/dispatch-worker.sh not found or not executable — install the dispatch harness first\"}" >&2
  exit 3
fi
