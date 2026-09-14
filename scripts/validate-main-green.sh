#!/usr/bin/env bash
# WI-395: main-green canary.
#
# Runs the full tier-1 suite against the current working tree and FAILS
# (non-zero) if any tier-1 script is red that is NOT recorded in the
# known-debt allowlist (.svc/main-green-allowlist.json). Intended to run
# post-merge or at session start — the gap that let WI-366's diet land 7 red
# tier-1 validators on main (squash-merge skips the local pre-push gate and
# there is no server-side CI).
#
# Design: a green baseline with an explicit, reasoned allowlist. NEW reds
# block; known pre-existing debt warns (with its tracking WI). Debt is tracked,
# not hidden — and the canary FAILS CLOSED: a crashed runner, unparseable
# output, or a failure count with no parsed names all resolve to red, never
# green. The verdict is bound to BOTH HEAD and the working-tree state so a
# post-canary edit cannot ride a stale green (codex G6: HIGH-1/2/3/4).
set -uo pipefail

parse_failing_scripts() {
  local log="$1"
  local -a parsed=()
  mapfile -t parsed < <(
    sed $'s/\033\\[[0-9;]*m//g' "$log" |
      sed -nE 's/^[[:space:]]*FAIL:[[:space:]]+([^[:space:]]+\.(sh|mjs))[[:space:]]+\(rc=[0-9]+\)[[:space:]]*$/\1/p' |
      sort -u
  )
  if [[ ${#parsed[@]} -eq 0 ]]; then
    return 1
  fi
  printf '%s\n' "${parsed[@]}"
}

if [[ "${1:-}" == "--parse-log" ]]; then
  if [[ $# -ne 2 || ! -f "$2" ]]; then
    echo "usage: validate-main-green.sh --parse-log <tier-1-log>" >&2
    exit 2
  fi
  parse_failing_scripts "$2"
  exit $?
fi

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
if [[ -z "$REPO_ROOT" ]]; then
  echo "main-green: FAIL — not inside a git repo (cannot resolve repo root)"
  exit 1
fi
cd "$REPO_ROOT"
ALLOWLIST="${MAIN_GREEN_ALLOWLIST:-.svc/main-green-allowlist.json}"
STATUS_FILE="${MAIN_GREEN_STATUS_FILE:-.svc/main-green-status.json}"
LOG="$(mktemp)"
trap 'rm -f "$LOG"' EXIT

HEAD_SHA="$(git rev-parse HEAD 2>/dev/null || true)"
if [[ -z "$HEAD_SHA" ]]; then
  echo "main-green: FAIL — cannot resolve HEAD"
  exit 1
fi
# Working-tree fingerprint: sha256 of uncommitted tracked changes. Empty diff
# (clean tree) has a stable hash; any later edit to tracked files changes it,
# so the closeout gate can detect a verdict that no longer matches the tree.
DIRTY_SHA="$(git diff HEAD 2>/dev/null | sha256sum | cut -d' ' -f1)"

write_status() { # $1=status  $2=failing-json-array-body
  mkdir -p .svc
  printf '{"status":"%s","head_sha":"%s","dirty_sha":"%s","ts":"%s","failing":[%s]}\n' \
    "$1" "$HEAD_SHA" "$DIRTY_SHA" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${2:-}" > "$STATUS_FILE"
}
json_list() { printf '%s' "$*" | tr ' ' '\n' | grep -v '^$' | sed 's/.*/"&"/' | paste -sd, -; }
red() { echo "main-green: FAIL — $1"; write_status "red" "${2:-}"; exit 1; }

# Run tier-1 only (EVALS=0 keeps heavier tiers out), capture the runner rc.
EVALS=0 bash test-framework/evals/run-all-evals.sh --tier1 >"$LOG" 2>&1
runner_rc=$?

# Fail closed on unparseable output: require EXACTLY one tier-1 result line.
result_count="$(grep -c 'Tier 1 Result:' "$LOG" || true)"
if [[ "$result_count" -ne 1 ]]; then
  red "tier-1 runner produced ${result_count} result lines (rc=${runner_rc}) — unparseable, failing closed"
fi
result_line="$(grep 'Tier 1 Result:' "$LOG")"
failed="$(printf '%s' "$result_line" | sed -n 's/.*passed, \([0-9][0-9]*\) failed.*/\1/p')"
if [[ -z "$failed" ]]; then
  red "could not parse failed-count from '${result_line}' — failing closed"
fi
timed_out="$(printf '%s' "$result_line" | sed -n 's/.*(\([0-9][0-9]*\) timed out).*/\1/p')"
if [[ -z "$timed_out" ]]; then
  red "could not parse timeout-count from '${result_line}' — failing closed"
fi
echo "$result_line"

if [[ "$timed_out" -ne 0 ]]; then
  red "tier-1 reports ${timed_out} timed out validator(s) — failing closed" '"tier1-timeout"'
fi

if [[ "$failed" -eq 0 ]]; then
  if [[ "$runner_rc" -ne 0 ]]; then
    red "tier-1 reports 0 failed but runner exited ${runner_rc} — inconsistent, failing closed"
  fi
  echo "main-green: PASS — tier-1 fully green"
  write_status "green" ""
  exit 0
fi

# failed > 0: identify only the runner's explicit per-script failure records.
# Do not carry the last "Running <name>..." label into the aggregate
# "Tier 1 Result: ... N failed" line; that falsely attributes every non-zero
# suite summary to the final validator in the ordered list (WI-508 closeout).
mapfile -t failing < <(
  parse_failing_scripts "$LOG" || true
)
if [[ ${#failing[@]} -eq 0 ]]; then
  # failure count > 0 but no script names parsed (timeout / pre-print crash). Fail closed.
  red "tier-1 reports ${failed} failed but no failing script names parsed (timeout/crash?) — failing closed" '"unparsed-tier1-failure"'
fi

# Load + schema-validate the allowlist. A malformed allowlist fails closed
# (codex G6: HIGH-3 — an unstructured allowlist must not silently widen).
allow=""
if [[ -f "$ALLOWLIST" ]]; then
  allow="$(node -e '
    const a = require(process.argv[1]);
    if (!a || !Array.isArray(a.known_red)) { console.error("known_red must be an array"); process.exit(3); }
    for (const e of a.known_red) {
      if (!e || typeof e.script !== "string" || !/^WI-[A-Z0-9]+(-[A-Z0-9]+)*$/.test(e.wi || "") || typeof e.reason !== "string" || !e.reason.trim()) {
        console.error("each known_red entry needs script, wi (WI-NNN), reason"); process.exit(3);
      }
    }
    console.log(a.known_red.map(e => e.script).join("\n"));
  ' "$REPO_ROOT/$ALLOWLIST" 2>/tmp/mg-allow-err)"
  if [[ $? -ne 0 ]]; then
    red "allowlist $ALLOWLIST is malformed ($(cat /tmp/mg-allow-err 2>/dev/null)) — failing closed"
  fi
fi

new_red=()
for f in "${failing[@]}"; do
  printf '%s\n' "$allow" | grep -qxF "$f" || new_red+=("$f")
done

if [[ ${#new_red[@]} -eq 0 ]]; then
  echo "main-green: WARN — ${#failing[@]} red, ALL in known-debt allowlist (tracked, not new):"
  printf '  - %s\n' "${failing[@]}"
  write_status "green-known-debt" "$(json_list "${failing[@]}")"
  exit 0
fi

echo "main-green: FAIL — ${#new_red[@]} NEW red not in $ALLOWLIST:"
printf '  - %s\n' "${new_red[@]}"
echo "Fix the regression, or (only if it is genuine pre-existing debt with a tracking WI) add it to $ALLOWLIST with script + wi (WI-NNN) + reason."
write_status "red" "$(json_list "${new_red[@]}")"
exit 1
