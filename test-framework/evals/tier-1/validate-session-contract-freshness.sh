#!/usr/bin/env bash
# Tier 1: Validate that the session contract is fresh (<4h old).
#
# A stale session contract means the agent has lost track of what the current
# session is for. This causes drift, ghost-completions, and incorrect backlog
# dispatch. Origin: audit-session-execution finding F2 (May 6 2026).
#
# Threshold history:
#   1h (original) — too tight for legitimate multi-hour focused sessions
#     where tier-1 evals themselves take 3-4 minutes, narrowing the effective
#     window further. Made the freshness check time-flaky (passed early in
#     the session, failed late). Trapped fixes inside their own validator.
#   4h (2026-05-13) — covers a typical long work session while still catching
#     truly stale ones (overnight, resumed-days-later).
#
# No LLM, <5s. Exit 0 if fresh or missing, 1 if stale.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
CONTRACT="$REPO_ROOT/.svc/session-contract.jsonl"
HOOK="$REPO_ROOT/hooks/svc-session-contract-freshness.mjs"

MAX_AGE_HOURS=4
MAX_AGE_SEC=$((MAX_AGE_HOURS * 3600))

echo "=== Tier 1: Session Contract Freshness ==="

if ! grep -Fq 'SVC_CONTRACT_MAX_AGE_HOURS || "4"' "$HOOK"; then
  echo "  FAIL - hook default does not match validator max age (${MAX_AGE_HOURS}h)"
  exit 1
fi

if [[ ! -f "$CONTRACT" ]]; then
  echo "  SKIP — .svc/session-contract.jsonl does not exist"
  exit 0
fi

LAST_LINE=$(tail -1 "$CONTRACT" 2>/dev/null || true)
if [[ -z "$LAST_LINE" ]]; then
  echo "  SKIP — session-contract.jsonl is empty"
  exit 0
fi

# Extract timestamp
TS=$(echo "$LAST_LINE" | grep -oE '"ts":"[^"]+"' | cut -d'"' -f4 || true)
if [[ -z "$TS" ]]; then
  echo "  FAIL — cannot parse timestamp from session contract"
  exit 1
fi

# Convert to epoch seconds (handle both +03:00 and Z formats)
TS_NORMALIZED=$(echo "$TS" | sed 's/+[0-9][0-9]:[0-9][0-9]//')
TS_EPOCH=$(date -d "$TS_NORMALIZED" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%S" "$TS_NORMALIZED" +%s 2>/dev/null || echo 0)

if [[ "$TS_EPOCH" -eq 0 ]]; then
  echo "  FAIL — cannot parse timestamp: $TS"
  exit 1
fi

NOW=$(date +%s)
AGE=$((NOW - TS_EPOCH))

if [[ $AGE -gt $MAX_AGE_SEC ]]; then
  AGE_HOURS=$((AGE / 3600))
  echo "  FAIL — session contract is ${AGE_HOURS}h old (max ${MAX_AGE_HOURS}h)"
  echo "    Last entry: $LAST_LINE"
  exit 1
fi
AGE_HOURS=$((AGE / 3600))
echo "  PASS — session contract is ${AGE_HOURS}h old (fresh)"

# --- WI-399 A3: hook scope-behavior fixtures (hermetic, <3s) -----------------
# The hook gates the TARGET FILE's repo, only when svc-governed (.svc dir),
# warn-only on fresh-worktree bootstrap. Negative fixture proves the gate
# still blocks its true target (stale contract, in-repo, main checkout).
FIX_FAIL=0
probe() {
  local name="$1"; local payload="$2"; local expected="$3"
  local actual
  actual=$(echo "$payload" | node "$HOOK" >/dev/null 2>&1; echo $?)
  if [[ "$actual" == "$expected" ]]; then
    echo "  PASS — $name (exit=$actual)"
  else
    echo "  FAIL — $name: expected exit=$expected got $actual"
    FIX_FAIL=1
  fi
}

T="$(mktemp -d)"
# non-repo target (plain dir, no .git anywhere up to /tmp... /tmp may have a
# stray .git — the svc-governance check covers that case too: no .svc dir)
probe "target outside svc-governed repo passes" \
  "{\"tool_name\":\"Write\",\"tool_input\":{\"file_path\":\"$T/scratch.txt\",\"content\":\"x\"},\"cwd\":\"$T\"}" 0

# svc-governed repo with STALE contract → block (the gate's true target)
git -C "$T" init -q
mkdir -p "$T/.svc"
printf '%s\n' '{"ts":"2026-01-01T00:00:00Z","wi":"old"}' > "$T/.svc/session-contract.jsonl"
probe "stale contract in svc repo still blocks (negative fixture)" \
  "{\"tool_name\":\"Write\",\"tool_input\":{\"file_path\":\"$T/file.txt\",\"content\":\"x\"},\"cwd\":\"$T\"}" 2

# git repo WITHOUT .svc dir → not svc-governed → pass
T2="$(mktemp -d)"
git -C "$T2" init -q
probe "non-svc git repo passes (not governed)" \
  "{\"tool_name\":\"Write\",\"tool_input\":{\"file_path\":\"$T2/file.txt\",\"content\":\"x\"},\"cwd\":\"$T2\"}" 0

# fresh-worktree bootstrap: tracked stale contract, untouched since checkout → warn-only
git -C "$T" add -A >/dev/null 2>&1
git -C "$T" -c user.email=t@t -c user.name=t commit -qm init >/dev/null 2>&1
git -C "$T" worktree add "$T-wt" -b wt-fixture >/dev/null 2>&1
if [[ -f "$T-wt/.svc/session-contract.jsonl" ]]; then
  probe "fresh-worktree bootstrap warns instead of blocking" \
    "{\"tool_name\":\"Write\",\"tool_input\":{\"file_path\":\"$T-wt/file.txt\",\"content\":\"x\"},\"cwd\":\"$T-wt\"}" 0
else
  echo "  SKIP — worktree fixture could not be created"
fi
git -C "$T" worktree remove --force "$T-wt" >/dev/null 2>&1 || true
rm -rf "$T" "$T-wt" 2>/dev/null || true

if [[ $FIX_FAIL -ne 0 ]]; then
  echo "  FAIL — A3 scope-behavior fixtures failed"
  exit 1
fi
exit 0
