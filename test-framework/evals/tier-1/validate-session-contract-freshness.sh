#!/usr/bin/env bash
# Tier 1: fixed-clock fixtures for the real session freshness hook.
# Live session age remains an operational hook decision, never a software test
# failure caused solely by leaving a checkout overnight.
set -euo pipefail

# Keep standalone invocation isolated from active host/session state.
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/fixture-home.sh"
svc_require_fixture "$@"

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
HOOK="$REPO_ROOT/hooks/svc-session-contract-freshness.mjs"
echo "=== Tier 1: Session Contract Freshness Fixtures ==="
if ! grep -Fq 'SVC_CONTRACT_MAX_AGE_HOURS || "4"' "$HOOK"; then
  echo "FAIL: hook default must remain four hours"
  exit 1
fi
CLOCK="$(mktemp)"
printf '%s\n' 'Date.now = () => Date.parse("2026-09-06T12:00:00Z");' > "$CLOCK"
cleanup() {
  rm -f -- "$CLOCK"
  [[ -z "${T:-}" ]] || rm -rf -- "$T" "$T-wt"
  [[ -z "${T2:-}" ]] || rm -rf -- "$T2"
}
trap cleanup EXIT

# --- WI-399 A3: hook scope-behavior fixtures (hermetic, <3s) -----------------
# The hook gates the TARGET FILE's repo, only when svc-governed (.svc dir),
# warn-only on fresh-worktree bootstrap. Negative fixture proves the gate
# still blocks its true target (stale contract, in-repo, main checkout).
FIX_FAIL=0
probe() {
  local name="$1"; local payload="$2"; local expected="$3"
  local actual
  actual=$(echo "$payload" | node --require "$CLOCK" "$HOOK" >/dev/null 2>&1; echo $?)
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
probe "stale contract blocks Grok shell mutation" \
  "{\"tool_name\":\"run_terminal_command\",\"tool_input\":{\"command\":\"touch $T/grok.txt\"},\"cwd\":\"$T\",\"host\":\"grok\"}" 2

# Exercise the live hook against fixed fresh/boundary/resume and terminal rows.
for row in \
  '{"ts":"2026-09-06T11:00:00Z","wi":"WI-FIXTURE"}' \
  '{"ts":"2026-09-06T08:00:00Z","wi":"WI-FIXTURE"}' \
  '{"ts":"2026-09-06T12:00:00Z","wi":"WI-RESUMED"}' \
  '{"ts":"2026-01-01T00:00:00Z","bound_to":"user-request"}' \
  '{"ts":"2026-01-01T00:00:00Z","bound_to":"framework-evolution"}'; do
  printf '%s\n' "$row" > "$T/.svc/session-contract.jsonl"
  probe "fresh/boundary/resumed or terminal binding passes: $row" \
    "{\"tool_name\":\"Write\",\"tool_input\":{\"file_path\":\"$T/file.txt\",\"content\":\"x\"},\"cwd\":\"$T\"}" 0
done
for row in \
  '{"ts":"2026-09-06T07:59:59Z","wi":"WI-FIXTURE"}' \
  '{"ts":"2026-01-01T00:00:00Z","bound_to":"unknown"}'; do
  printf '%s\n' "$row" > "$T/.svc/session-contract.jsonl"
  probe "expired or ambiguous active binding blocks: $row" \
    "{\"tool_name\":\"Write\",\"tool_input\":{\"file_path\":\"$T/file.txt\",\"content\":\"x\"},\"cwd\":\"$T\"}" 2
done
printf '%s\n' '{"ts":"2026-01-01T00:00:00Z","wi":"old"}' > "$T/.svc/session-contract.jsonl"

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
  echo "  FAIL — worktree fixture could not be created"
  FIX_FAIL=1
fi
git -C "$T" worktree remove --force "$T-wt" >/dev/null 2>&1 || true
rm -rf "$T" "$T-wt" 2>/dev/null || true

if [[ $FIX_FAIL -ne 0 ]]; then
  [[ $FIX_FAIL -ne 0 ]] && echo "  FAIL — A3 scope-behavior fixtures failed"
  exit 1
fi
exit 0
