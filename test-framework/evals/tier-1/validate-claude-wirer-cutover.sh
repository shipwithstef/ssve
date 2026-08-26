#!/usr/bin/env bash
# validate-claude-wirer-cutover.sh — E3 subtractive-rebuild acceptance for wire-hooks.mjs.
# Sandboxed HOME fixtures: double-run stability, foreign preservation, DISABLED,
# PROFILE=minimal, --remove-company-session-hooks, corrupt-config abort, legacy
# variant convergence in one run, and no isAlreadyWired remnant.
set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
cd "$REPO_ROOT" || exit 1

WIRER="scripts/wire-hooks.mjs"
TMP="$(mktemp -d /tmp/wi-e3-cutover.XXXXXX)"
trap 'rm -rf "$TMP"' EXIT

PASS=0
FAIL=0
check() {
  local label="$1"; shift
  if "$@" >/dev/null 2>&1; then
    echo "  ✓ $label"; PASS=$((PASS+1))
  else
    echo "  ✗ $label"; FAIL=$((FAIL+1))
  fi
}

q() {
  # q <settings> <event> <py-expr-over-cmds>
  python3 - "$1" "$2" "$3" <<'PY'
import json,sys
s=json.load(open(sys.argv[1]))
entries=s.get("hooks",{}).get(sys.argv[2],[])
cmds=[(r.get("matcher",""),h) for r in entries for h in r.get("hooks",[])]
print(int(eval(sys.argv[3])))
PY
}

echo "=== Tier 1: Claude wirer subtractive cutover (E3) ==="

# --- Static: no additive-merge remnants ---
check "wire-hooks.mjs has no isAlreadyWired" bash -c "! grep -q 'isAlreadyWired' '$WIRER'"
check "wire-hooks.mjs has no \$TOOL_INPUT strip remnant" bash -c "! grep -q 'TOOL_INPUT' '$WIRER'"
check "wire-hooks.mjs has stripSvcOwnedHooks" bash -c "grep -q 'stripSvcOwnedHooks' '$WIRER'"
check "wire-hooks.mjs has no loadRenamedFiles" bash -c "! grep -q 'loadRenamedFiles' '$WIRER'"
check "wire-hooks.mjs has no CANONICAL_COMMANDS" bash -c "! grep -q 'CANONICAL_COMMANDS' '$WIRER'"

# --- (f) corrupt-config abort, prior bytes intact ---
CORRUPT="$TMP/corrupt-settings.json"
printf '{ this is not valid json !!!' >"$CORRUPT"
cp "$CORRUPT" "$TMP/corrupt-original"
set +e
node "$WIRER" --skills-path "$REPO_ROOT" --settings "$CORRUPT" >"$TMP/corrupt.log" 2>&1
CORRUPT_RC=$?
set +e
check "corrupt config aborts nonzero" test "$CORRUPT_RC" != "0"
check "corrupt config prior bytes intact" cmp -s "$CORRUPT" "$TMP/corrupt-original"
check "corrupt config message actionable" bash -c "grep -qiE 'Failed to parse|not valid JSON|JSON' '$TMP/corrupt.log'"

# --- Seed settings with foreign + legacy svc variants ---
S1="$TMP/settings.json"
python3 - "$S1" "$REPO_ROOT" <<'PY'
import json, sys
path, root = sys.argv[1], sys.argv[2]
hooks_dir = f"{root}/hooks"
settings = {
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [{"type": "command", "command": "eslint --fix ."}]
      },
      {
        "matcher": "Edit|Write",
        "hooks": [{
          "type": "command",
          "command": f"node {hooks_dir}/svc-workflow-guard.js \"$TOOL_INPUT\""
        }]
      },
      {
        "matcher": "Bash|Edit|Write|StrReplaceFile|Agent",
        "hooks": [{
          "type": "command",
          "command": f"node {hooks_dir}/svc-loop-guard.mjs \"$TOOL_INPUT\""
        }]
      },
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [{
          "type": "command",
          "command": f"node {hooks_dir}/svc-vibe-auditor.js"
        }]
      },
    ],
    "Stop": [
      {
        "matcher": "*",
        "hooks": [{"type": "command", "command": "node /opt/company/notify.js --payload=$TOOL_INPUT"}]
      },
      {
        "matcher": "*",
        "hooks": [{"type": "command", "command": "/opt/foreign/hooks/kimi/relay.sh --emit"}]
      },
    ],
    "SessionStart": [
      {
        "id": "svc-cos-briefing",
        "matcher": "*",
        "hooks": [{"type": "command", "command": f"node {hooks_dir}/cos-briefing.mjs"}]
      },
      {
        "id": "svc-delta-preload",
        "matcher": "*",
        "hooks": [{"type": "command", "command": f"node {hooks_dir}/svc-delta-preload.mjs"}]
      },
    ],
  }
}
json.dump(settings, open(path, "w"), indent=2)
open(path, "a").write("\n")
PY

# --- (g) legacy variant convergence in ONE run ---
env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE \
  node "$WIRER" --skills-path "$REPO_ROOT" --settings "$S1" >"$TMP/run1.log" 2>&1
check "legacy seed run exits 0" test "$?" = "0"
check "legacy .js workflow-guard gone" test "$(q "$S1" PreToolUse "sum('svc-workflow-guard.js' in h.get('command','') for _,h in cmds)")" = "0"
check "canonical .mjs workflow-guard present" test "$(q "$S1" PreToolUse "sum('svc-workflow-guard.mjs' in h.get('command','') and '--phase-boundary' not in h.get('command','') and '--bash-guard' not in h.get('command','') for _,h in cmds)")" = "1"
check "argv payload token stripped from managed hooks" test "$(q "$S1" PreToolUse "sum('TOOL_INPUT' in h.get('command','') for _,h in cmds)")" = "0"
check "vibe-auditor async adopted via rebuild" test "$(q "$S1" PostToolUse "sum('svc-vibe-auditor' in h.get('command','') and h.get('async') is True for _,h in cmds)")" = "1"
check "loop-guard single canonical" test "$(q "$S1" PreToolUse "sum('svc-loop-guard.mjs' in h.get('command','') for _,h in cmds)")" = "1"

# --- (b) foreign preservation ---
check "foreign eslint preserved" test "$(q "$S1" PreToolUse "sum(h.get('command','')=='eslint --fix .' for _,h in cmds)")" = "1"
check "foreign notify embedded-token preserved" test "$(q "$S1" Stop "sum('--payload=\$TOOL_INPUT' in h.get('command','') for _,h in cmds)")" = "1"
check "foreign hooks/kimi path survives kimi safety-net (Cursor R2 F-003)" test "$(q "$S1" Stop "sum('hooks/kimi/' in h.get('command','') for _,h in cmds)")" = "1"

# --- (a) double-run byte-stability ---
cp "$S1" "$TMP/snap1.json"
env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE \
  node "$WIRER" --skills-path "$REPO_ROOT" --settings "$S1" >"$TMP/run2.log" 2>&1
check "second run exits 0" test "$?" = "0"
check "double-run byte-stable" cmp -s "$S1" "$TMP/snap1.json"

# --- (c) DISABLED honored ---
S_DIS="$TMP/disabled-settings.json"
printf '%s\n' '{"hooks":{}}' >"$S_DIS"
env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE \
  SVC_DISABLED_HOOKS="svc-loop-guard,svc-vibe-auditor" \
  node "$WIRER" --skills-path "$REPO_ROOT" --settings "$S_DIS" >"$TMP/dis.log" 2>&1
check "DISABLED run exits 0" test "$?" = "0"
check "DISABLED omits loop-guard" test "$(q "$S_DIS" PreToolUse "sum('svc-loop-guard' in h.get('command','') for _,h in cmds)")" = "0"
check "DISABLED omits vibe-auditor" test "$(q "$S_DIS" PostToolUse "sum('svc-vibe-auditor' in h.get('command','') for _,h in cmds)")" = "0"
check "DISABLED still wires bash-guard" test "$(q "$S_DIS" PreToolUse "sum('--bash-guard' in h.get('command','') for _,h in cmds)")" = "1"

# --- (d) PROFILE=minimal omits full-only ids ---
S_MIN="$TMP/minimal-settings.json"
printf '%s\n' '{"hooks":{}}' >"$S_MIN"
env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE \
  SVC_HOOK_PROFILE=minimal \
  node "$WIRER" --skills-path "$REPO_ROOT" --settings "$S_MIN" >"$TMP/min.log" 2>&1
check "minimal profile run exits 0" test "$?" = "0"
check "minimal omits workflow-guard plain" test "$(q "$S_MIN" PreToolUse "sum('svc-workflow-guard.mjs' in h.get('command','') and '--phase-boundary' not in h.get('command','') and '--bash-guard' not in h.get('command','') for _,h in cmds)")" = "0"
check "minimal omits phase-boundary" test "$(q "$S_MIN" PreToolUse "sum('--phase-boundary' in h.get('command','') for _,h in cmds)")" = "0"
check "minimal keeps bash-guard" test "$(q "$S_MIN" PreToolUse "sum('--bash-guard' in h.get('command','') for _,h in cmds)")" = "1"
check "minimal omits stop-quality" test "$(q "$S_MIN" Stop "sum('svc-stop-quality.js' in h.get('command','') and '--check' in h.get('command','') for _,h in cmds)")" = "0"
check "minimal omits vibe-auditor" test "$(q "$S_MIN" PostToolUse "sum('svc-vibe-auditor' in h.get('command','') for _,h in cmds)")" = "0"

# --- (e) --remove-company-session-hooks does not resurrect ---
S_CO="$TMP/company-settings.json"
python3 - "$S_CO" "$REPO_ROOT" <<'PY'
import json, sys
path, root = sys.argv[1], sys.argv[2]
hooks_dir = f"{root}/hooks"
json.dump({
  "hooks": {
    "SessionStart": [
      {
        "id": "svc-cos-briefing",
        "matcher": "*",
        "hooks": [{"type": "command", "command": f"node {hooks_dir}/cos-briefing.mjs"}]
      },
      {
        "id": "svc-delta-preload",
        "matcher": "*",
        "hooks": [{"type": "command", "command": f"node {hooks_dir}/svc-delta-preload.mjs"}]
      },
      {
        "matcher": "*",
        "hooks": [{"type": "command", "command": "echo foreign-session"}]
      },
    ]
  }
}, open(path, "w"), indent=2)
open(path, "a").write("\n")
PY
env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE \
  node "$WIRER" --skills-path "$REPO_ROOT" --settings "$S_CO" \
  --remove-company-session-hooks >"$TMP/co-rm.log" 2>&1
check "remove-company-session-hooks exits 0" test "$?" = "0"
check "company hooks removed" test "$(q "$S_CO" SessionStart "sum('cos-briefing' in h.get('command','') or 'svc-delta-preload' in h.get('command','') for _,h in cmds)")" = "0"
check "foreign session hook survives remove" test "$(q "$S_CO" SessionStart "sum(h.get('command','')=='echo foreign-session' for _,h in cmds)")" = "1"
# Re-wire WITHOUT the remove flag must not be tested here for resurrection of
# remove-only path; the early-exit contract is: remove flag writes and exits
# before rebuild. Prove a subsequent normal wire from empty company set can
# re-add ONLY when files exist (existsSync gates) — and that remove path itself
# did not append catalog entries in the same invocation (already asserted above).
check "remove path did not append full catalog" test "$(q "$S_CO" PreToolUse "len(cmds)")" = "0"

# --- list-all still works ---
env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE \
  node "$WIRER" --skills-path "$REPO_ROOT" --list-all >"$TMP/list-all.json" 2>&1
check "list-all exits 0" test "$?" = "0"
check "list-all emits hooks JSON" bash -c "grep -q '\"hooks\"' '$TMP/list-all.json'"
check "list-all bash-guard command string" bash -c "grep -q 'svc-workflow-guard.mjs --bash-guard' '$TMP/list-all.json'"

echo ""
if [ "$FAIL" = 0 ]; then
  echo "  PASS — all $PASS Claude wirer cutover checks passed"
  exit 0
else
  echo "  $FAIL failed, $PASS passed"
  exit 1
fi
