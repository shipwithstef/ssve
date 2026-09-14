#!/usr/bin/env bash
# ==============================================================================
# SeriousVibeCoding Multi-Agent Adaptive Resource Governor (svc-agent-runner)
# ==============================================================================
set -euo pipefail

# 1. Virtual Memory Envelope (32GB virtual address ceiling prevents PageTable bloat)
ulimit -v 33554432 2>/dev/null || true

# 2. Generous Process / File Descriptors (prevents fork resource limits)
ulimit -n 65536 2>/dev/null || true
ulimit -u 65536 2>/dev/null || true

# 3. Node / V8 Heap Guards
export NODE_OPTIONS="--max-old-space-size=3072"
export UV_THREADPOOL_SIZE=8

# 4. Adaptive Test Parallelism based on active agent sessions
TOTAL_CPUS=$(nproc 2>/dev/null || echo 8)
ACTIVE_AGENTS=$(ps aux | grep -E 'opencode|grok|codex|cursor' | grep -v grep | wc -l 2>/dev/null || echo 1)
if [ "$ACTIVE_AGENTS" -ge 8 ]; then
  export TEST_CONCURRENCY=2
elif [ "$ACTIVE_AGENTS" -ge 4 ]; then
  export TEST_CONCURRENCY=3
else
  export TEST_CONCURRENCY=4
fi

# 5. Execute command
exec nice -n 5 "$@"
