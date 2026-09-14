#!/usr/bin/env bash
# WI-498: hermetic proof of Codex first-task activation + install-anchored,
# shadow-proof executable resolution. Covers:
#   IAR-01/02  loader resolves task-graph from its OWN install dir; a consumer-
#              planted shadow scripts/task-graph.mjs is NEVER executed.
#   IAR-03     enforcer authorizes the loader token only as install-absolute;
#              a relative token from a non-install repo is DENIED (F-011).
#   IAR-04     bootstrap(pending) -> loader(activate) -> in_progress+receipt ->
#              governed mutation ALLOW (the deadlock, driven against the REAL
#              enforcer). Numeric AND string task-id tokens.
#   IAR-05     activate-skill is atomic + fail-closed for non-first/non-active
#              tasks (graph byte-identical on reject) + idempotent no-write reload.
set -euo pipefail
export NODE_ENV=test

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TMP="$(mktemp -d)"
LINKED_FRAMEWORK_WT=""
LINKED_FRAMEWORK_BRANCH=""
cleanup() {
  if [ -n "$LINKED_FRAMEWORK_WT" ]; then git -C "$ROOT" worktree remove --force "$LINKED_FRAMEWORK_WT" >/dev/null 2>&1 || true; fi
  if [ -n "$LINKED_FRAMEWORK_BRANCH" ]; then git -C "$ROOT" branch -D "$LINKED_FRAMEWORK_BRANCH" >/dev/null 2>&1 || true; fi
  rm -rf "$TMP"
}
trap cleanup EXIT
chmod 700 "$TMP"

FAIL=0
ok()  { echo "  ok   - $1"; }
bad() { echo "  FAIL - $1"; FAIL=1; }
# G6-F005: ALLOW is the enforcer's EXPLICIT '{}' signal — never merely "no deny",
# which an enforcer CRASH (empty stdout) would also satisfy (false ALLOW).
expect_allow() { if [ "$(printf '%s' "$1" | tr -d '[:space:]')" = '{}' ]; then ok "$2"; else bad "$2 (expected explicit {} ALLOW, got: $(printf '%s' "$1" | head -c 80))"; fi; }
expect_deny()  { if printf '%s' "$1" | grep -q '"permissionDecision":"deny"'; then ok "$2"; else bad "$2 (expected DENY, got: $(printf '%s' "$1" | head -c 80))"; fi; }

# ---- fixture-owned INSTALLED tree (self-location must land HERE, never in the consumer) ----
INSTALL="$TMP/installed"
mkdir -p "$INSTALL"
cp -r "$ROOT/hooks" "$ROOT/scripts" "$INSTALL/"
LOADER="$INSTALL/scripts/codex-load-skill.mjs"
ENFORCER="$INSTALL/hooks/codex/svc-codex-skill-load-enforcer.mjs"
TASKGRAPH="$INSTALL/scripts/task-graph.mjs"

# ---- isolate ALL host state (runtime dirs MUST be mode 700 — the enforcer's
# runtime-root guard refuses a world/group-accessible runtime root) ----
export HOME="$TMP/home"; mkdir -m 700 -p "$HOME"
export XDG_RUNTIME_DIR="$TMP/xdg"; mkdir -m 700 -p "$XDG_RUNTIME_DIR"
export SVC_CODEX_RUNTIME_DIR="$TMP/runtime"; mkdir -m 700 -p "$SVC_CODEX_RUNTIME_DIR"
# canonical skills come from the real repo (read-only skill CONTENT); loader and
# enforcer must resolve the SAME canonical skill, so both read CODEX_SKILLS_DIR.
export CODEX_SKILLS_DIR="$ROOT/skills"
export CODEX_HOME="$TMP/home/.codex"; mkdir -p "$CODEX_HOME"
SID="codex-fixture-session-0001"; export CODEX_SESSION_ID="$SID"

new_consumer() {  # $1=dir  $2=task-id-in-graph (numeric)
  local d="$1"; local id="$2"
  rm -rf "$d"; mkdir -p "$d/.svc"
  git -C "$d" init -q
  git -C "$d" config user.email t@t
  git -C "$d" config user.name t
  cat > "$d/.svc/lane-tasks-WI-FIX-01.json" <<JSON
{"schema_version":1,"wi":"WI-FIX-01","lane":"framework","status":"pending","tasks":[{"id":$id,"status":"pending","skill":"route-workflow","subject":"rw","blocked_by":[]}]}
JSON
  # The loader-token test is an owned-graph proof, so give each disposable
  # consumer the same real claim/binding tuple the production resolver requires.
  node "$ROOT/hooks/lib/wi-claim.mjs" binding write --worktree-root "$d" --session-id "$SID" --wi WI-FIX-01 --role mutating >/dev/null
  echo "$d/.svc/lane-tasks-WI-FIX-01.json"
}

# WI-506 RED/GREEN probe: a predictable runtime-root rejection must happen
# before activate-skill mutates the task graph. The unsafe existing XDG root is
# intentionally mode 0755; it must fail closed, never fall back.
if [ "${SVC_WI506_RED_ONLY:-0}" = 1 ]; then
  GRED="$(new_consumer "$TMP/c-red-preflight" 1)"
  RED_BEFORE="$(sha256sum "$GRED" | cut -d' ' -f1)"
  RED_XDG="$TMP/unsafe-xdg"; mkdir -m 755 "$RED_XDG"
  unset SVC_CODEX_RUNTIME_DIR
  set +e
  XDG_RUNTIME_DIR="$RED_XDG" SVC_CODEX_TEST_MODE=1 SVC_CODEX_TEST_REPO="$TMP/c-red-preflight" \
    node "$LOADER" --graph "$GRED" --task 1 --skill route-workflow >/dev/null 2>&1
  RED_RC=$?
  set -e
  RED_AFTER="$(sha256sum "$GRED" | cut -d' ' -f1)"
  if [ "$RED_RC" -eq 0 ] || [ "$RED_BEFORE" != "$RED_AFTER" ]; then
    echo "WI506-RED-LOADER-PREFLIGHT: graph changed before runtime preflight" >&2
    exit 1
  fi
  exit 0
fi

echo "== WI-506 preflight byte-identity matrix =="
GP="$(new_consumer "$TMP/c-preflight" 1)"
UNSAFE_RUNTIME="$TMP/unsafe-runtime"; mkdir -m 755 "$UNSAFE_RUNTIME"
REPO_KEY="$(printf '%s' "$(realpath "$TMP/c-preflight")" | sha256sum | cut -c1-24)"
SESSION_KEY="$(printf '%s' "$SID" | sha256sum | cut -c1-32)"
PRIOR_RECEIPT_DIR="$UNSAFE_RUNTIME/$REPO_KEY/$SESSION_KEY"
mkdir -p "$PRIOR_RECEIPT_DIR"
printf '%s\n' '{"prior":"must-remain-byte-identical"}' > "$PRIOR_RECEIPT_DIR/skill-load.json"
GP_BEFORE="$(sha256sum "$GP" | cut -d' ' -f1)"; PR_BEFORE="$(sha256sum "$PRIOR_RECEIPT_DIR/skill-load.json" | cut -d' ' -f1)"
if SVC_CODEX_RUNTIME_DIR="$UNSAFE_RUNTIME" SVC_CODEX_TEST_MODE=1 SVC_CODEX_TEST_REPO="$TMP/c-preflight" node "$LOADER" --graph "$GP" --task 1 --skill route-workflow >/dev/null 2>&1; then bad "unsafe runtime preflight must reject"; else ok "unsafe runtime preflight rejects"; fi
[ "$GP_BEFORE" = "$(sha256sum "$GP" | cut -d' ' -f1)" ] && [ "$PR_BEFORE" = "$(sha256sum "$PRIOR_RECEIPT_DIR/skill-load.json" | cut -d' ' -f1)" ] && ok "invalid storage preserves graph+prior receipt bytes" || bad "invalid storage changed graph or prior receipt"

rm -rf "$SVC_CODEX_RUNTIME_DIR"; mkdir -m 700 "$SVC_CODEX_RUNTIME_DIR"
VALID_RECEIPT_DIR="$SVC_CODEX_RUNTIME_DIR/$REPO_KEY/$SESSION_KEY"; mkdir -m 700 -p "$VALID_RECEIPT_DIR"
printf '%s\n' '{"prior":"authority-reject-must-not-touch"}' > "$VALID_RECEIPT_DIR/skill-load.json"; chmod 600 "$VALID_RECEIPT_DIR/skill-load.json"
GP_BEFORE="$(sha256sum "$GP" | cut -d' ' -f1)"; PR_BEFORE="$(sha256sum "$VALID_RECEIPT_DIR/skill-load.json" | cut -d' ' -f1)"
if NODE_ENV=production SVC_CODEX_TEST_MODE=1 SVC_CODEX_TEST_REPO="$TMP/c-preflight" node "$LOADER" --graph "$GP" --task 1 --skill route-workflow >/dev/null 2>&1; then bad "unresolved authority preflight must reject"; else ok "unresolved authority preflight rejects"; fi
[ "$GP_BEFORE" = "$(sha256sum "$GP" | cut -d' ' -f1)" ] && [ "$PR_BEFORE" = "$(sha256sum "$VALID_RECEIPT_DIR/skill-load.json" | cut -d' ' -f1)" ] && ok "authority rejection preserves graph+prior receipt bytes" || bad "authority rejection changed graph or prior receipt"

for BAD_ARGS in '--task 2 --skill route-workflow' '--task 1 --skill plan-changeset'; do
  GP_BEFORE="$(sha256sum "$GP" | cut -d' ' -f1)"; PR_BEFORE="$(sha256sum "$VALID_RECEIPT_DIR/skill-load.json" | cut -d' ' -f1)"
  if SVC_CODEX_TEST_MODE=1 SVC_CODEX_TEST_REPO="$TMP/c-preflight" node "$LOADER" --graph "$GP" $BAD_ARGS >/dev/null 2>&1; then bad "graph/task/skill mismatch must reject"; else ok "graph/task/skill mismatch rejects"; fi
  [ "$GP_BEFORE" = "$(sha256sum "$GP" | cut -d' ' -f1)" ] && [ "$PR_BEFORE" = "$(sha256sum "$VALID_RECEIPT_DIR/skill-load.json" | cut -d' ' -f1)" ] && ok "task/skill rejection preserves graph+prior receipt bytes" || bad "task/skill rejection changed graph or receipt"
done

GM="$(new_consumer "$TMP/c-preflight-malformed" 1)"; printf '{malformed' > "$GM"
GM_BEFORE="$(sha256sum "$GM" | cut -d' ' -f1)"; PR_BEFORE="$(sha256sum "$VALID_RECEIPT_DIR/skill-load.json" | cut -d' ' -f1)"
if SVC_CODEX_TEST_MODE=1 SVC_CODEX_TEST_REPO="$TMP/c-preflight-malformed" node "$LOADER" --graph "$GM" --task 1 --skill route-workflow >/dev/null 2>&1; then bad "malformed graph must reject"; else ok "malformed graph rejects"; fi
[ "$GM_BEFORE" = "$(sha256sum "$GM" | cut -d' ' -f1)" ] && [ "$PR_BEFORE" = "$(sha256sum "$VALID_RECEIPT_DIR/skill-load.json" | cut -d' ' -f1)" ] && ok "malformed graph preserves graph+prior receipt bytes" || bad "malformed graph changed bytes"

echo "== A. activate-skill semantics (task-graph, direct) =="
G="$(new_consumer "$TMP/cA" 1)"
node "$TASKGRAPH" activate-skill "$G" 1 route-workflow --via test >/dev/null
[ "$(node -e 'console.log(require(process.argv[1]).tasks[0].status)' "$G")" = "in_progress" ] && ok "fresh activate -> in_progress (numeric id)" || bad "fresh activate numeric"
[ "$(node -e 'console.log(!!require(process.argv[1]).tasks[0].skill_receipt)' "$G")" = "true" ] && ok "receipt written" || bad "receipt written"
BEFORE="$(sha256sum "$G" | cut -d' ' -f1)"
node "$TASKGRAPH" activate-skill "$G" "1" route-workflow --via test2 >/dev/null   # string id + reload
AFTER="$(sha256sum "$G" | cut -d' ' -f1)"
[ "$BEFORE" = "$AFTER" ] && ok "idempotent reload is byte-stable no-write (string id)" || bad "reload byte-stable"

# G6-F001: graph task-ids are numeric by contract (task-graph validateTask). A
# non-numeric-id graph is INVALID and activate-skill must reject it CLEANLY (clear
# error, not a silent hang and not a fail-open) — the enforcer's recoverableId
# string-normalization is for numeric-strings ("1"->1), never non-numeric support.
GNN="$(new_consumer "$TMP/cAnn" 1)"
node -e 'const fs=require("fs");const g=JSON.parse(fs.readFileSync(process.argv[1]));g.tasks[0].id="task-1";fs.writeFileSync(process.argv[1],JSON.stringify(g))' "$GNN"
BNN="$(sha256sum "$GNN" | cut -d' ' -f1)"
if node "$TASKGRAPH" activate-skill "$GNN" task-1 route-workflow >/dev/null 2>&1; then bad "non-numeric-id graph must be rejected"; else ok "non-numeric-id graph rejected cleanly (numeric-only contract)"; fi
[ "$(sha256sum "$GNN" | cut -d' ' -f1)" = "$BNN" ] && ok "rejected non-numeric graph left byte-identical" || bad "non-numeric reject byte-identity"

G2="$(new_consumer "$TMP/cA2" 1)"
# add a second, blocked task so activating it must fail closed
node -e 'const fs=require("fs");const g=JSON.parse(fs.readFileSync(process.argv[1]));g.tasks.push({id:2,status:"pending",skill:"plan-changeset",subject:"pc",blocked_by:[1]});fs.writeFileSync(process.argv[1],JSON.stringify(g))' "$G2"
B2="$(sha256sum "$G2" | cut -d' ' -f1)"
if node "$TASKGRAPH" activate-skill "$G2" 2 plan-changeset >/dev/null 2>&1; then bad "non-first task must fail closed"; else ok "non-first task fails closed (exit!=0)"; fi
[ "$(sha256sum "$G2" | cut -d' ' -f1)" = "$B2" ] && ok "rejected activate left graph byte-identical" || bad "reject byte-identity"

echo "== B. install-anchoring + hostile shadow (IAR-01/02) =="
G3="$(new_consumer "$TMP/cB" 1)"
# plant a HOSTILE scripts/task-graph.mjs in the CONSUMER repo
mkdir -p "$TMP/cB/scripts"
cat > "$TMP/cB/scripts/task-graph.mjs" <<'JS'
import fs from "node:fs"; fs.writeFileSync(process.env.SHADOW_MARKER, "PWNED"); process.exit(0);
JS
export SHADOW_MARKER="$TMP/shadow-ran"
SVC_CODEX_TEST_MODE=1 SVC_CODEX_TEST_REPO="$TMP/cB" node "$LOADER" --graph "$G3" --task 1 --skill route-workflow >/dev/null 2>&1 || true
[ -f "$SHADOW_MARKER" ] && bad "SHADOW task-graph EXECUTED (ACE!)" || ok "consumer-planted shadow task-graph NOT executed"
[ "$(node -e 'console.log(require(process.argv[1]).tasks[0].status)' "$G3")" = "in_progress" ] && ok "install copy ran -> task activated" || bad "install copy did not activate"
unset SHADOW_MARKER

# A graph path may not use a worktree-local symlink to escape the owned
# repository. The canonical target bytes remain unchanged on rejection.
G3_OUTSIDE="$TMP/outside-graph.json"
cp "$G3" "$G3_OUTSIDE"
ln -s "$G3_OUTSIDE" "$TMP/cB/.svc/escaped-graph.json"
G3_OUTSIDE_BEFORE="$(sha256sum "$G3_OUTSIDE" | cut -d' ' -f1)"
if SVC_CODEX_TEST_MODE=1 SVC_CODEX_TEST_REPO="$TMP/cB" node "$LOADER" --graph "$TMP/cB/.svc/escaped-graph.json" --task 1 --skill route-workflow >/dev/null 2>&1; then bad "symlinked graph escape must be rejected"; else ok "symlinked graph escape rejected"; fi
[ "$G3_OUTSIDE_BEFORE" = "$(sha256sum "$G3_OUTSIDE" | cut -d' ' -f1)" ] && ok "symlinked graph rejection is byte-identical" || bad "symlinked graph rejection changed target"

# A directory, FIFO, device, or socket is never a task graph. Reject the
# non-regular path before readFileSync can block or consume host input, and do
# not publish any additional session receipt on this preflight failure.
NONREGULAR_GRAPH="$TMP/cB/.svc/nonregular-graph"
mkdir "$NONREGULAR_GRAPH"
RECEIPTS_BEFORE="$(find "$SVC_CODEX_RUNTIME_DIR" -name skill-load.json -type f 2>/dev/null | wc -l)"
if SVC_CODEX_TEST_MODE=1 SVC_CODEX_TEST_REPO="$TMP/cB" node "$LOADER" --graph "$NONREGULAR_GRAPH" --task 1 --skill route-workflow >/dev/null 2>&1; then bad "non-regular graph must be rejected"; else ok "non-regular graph rejected before read"; fi
[ -d "$NONREGULAR_GRAPH" ] && [ "$RECEIPTS_BEFORE" = "$(find "$SVC_CODEX_RUNTIME_DIR" -name skill-load.json -type f 2>/dev/null | wc -l)" ] && ok "non-regular graph rejection publishes no receipt" || bad "non-regular graph rejection mutated state"

# The enforcer refuses to run from an ephemeral prefix (WI-487 durable-source
# guard), so C/D run the DURABLE repo enforcer + loader ($ROOT, under $HOME real
# checkout). Only the enforcement SOURCE must be durable; the consumer repo/graph
# stay ephemeral. install-absolute here is $ROOT/scripts/codex-load-skill.mjs.
DUR_ENF="$ROOT/hooks/codex/svc-codex-skill-load-enforcer.mjs"
DUR_LOADER="$ROOT/scripts/codex-load-skill.mjs"
payload() { node -e 'console.log(JSON.stringify({tool_name:"Bash",tool_input:{command:process.argv[1]},cwd:process.argv[2],session_id:process.argv[3]}))' "$1" "$2" "$SID"; }

echo "== C. enforcer loader-token binding (IAR-03 / F-011) =="
G4="$(new_consumer "$TMP/cC" 1)"
REL="$(payload "node scripts/codex-load-skill.mjs --graph $G4 --task 1 --skill route-workflow" "$TMP/cC")"
ABS="$(payload "node $DUR_LOADER --graph $G4 --task 1 --skill route-workflow" "$TMP/cC")"
OUT_REL="$(cd "$TMP/cC" && printf '%s' "$REL" | SVC_CODEX_TEST_MODE=1 SVC_CODEX_TEST_REPO="$TMP/cC" SVC_CODEX_TASK_GRAPH="$G4" node "$DUR_ENF" 2>&1 || true)"
OUT_ABS="$(cd "$TMP/cC" && printf '%s' "$ABS" | SVC_CODEX_TEST_MODE=1 SVC_CODEX_TEST_REPO="$TMP/cC" SVC_CODEX_TASK_GRAPH="$G4" node "$DUR_ENF" 2>&1 || true)"
expect_deny  "$OUT_REL" "relative loader token from non-install repo DENIED (F-011)"
expect_allow "$OUT_ABS" "install-absolute loader token ALLOWED"

echo "== C2. canonical repo-local loader from a linked framework worktree =="
PRIMARY_ROOT="$(dirname "$(git -C "$ROOT" rev-parse --path-format=absolute --git-common-dir)")"
PRIMARY_ENF="$ROOT/hooks/codex/svc-codex-skill-load-enforcer.mjs"
LINKED_FRAMEWORK_WT="$TMP/framework-linked-worktree"
LINKED_FRAMEWORK_BRANCH="test-wi531-linked-$(basename "$TMP")"
git -C "$ROOT" worktree add -b "$LINKED_FRAMEWORK_BRANCH" "$LINKED_FRAMEWORK_WT" HEAD >/dev/null
mkdir -p "$LINKED_FRAMEWORK_WT/.svc"
GFW="$LINKED_FRAMEWORK_WT/.svc/lane-tasks-WI-9531.json"
printf '%s\n' '{"schema_version":1,"wi":"WI-9531","lane":"framework","status":"pending","tasks":[{"id":1,"status":"pending","skill":"route-workflow","subject":"rw","blocked_by":[]}]}' > "$GFW"
node "$ROOT/hooks/lib/wi-claim.mjs" binding write --worktree-root "$LINKED_FRAMEWORK_WT" --session-id "$SID" --wi WI-9531 --role mutating >/dev/null
FW_REL="$(payload "node scripts/codex-load-skill.mjs --graph $GFW --task 1 --skill route-workflow" "$LINKED_FRAMEWORK_WT")"
OUT_FW_REL="$(cd "$LINKED_FRAMEWORK_WT" && printf '%s' "$FW_REL" | SVC_CODEX_TEST_MODE=1 SVC_CODEX_TEST_REPO="$LINKED_FRAMEWORK_WT" SVC_CODEX_TASK_GRAPH="$GFW" node "$PRIMARY_ENF" 2>&1 || true)"
expect_allow "$OUT_FW_REL" "repo-local loader from same-git framework worktree ALLOWED"

echo "== D. deadlock end-to-end: activate -> both receipts -> governed mutation ALLOW (IAR-04/05) =="
G5="$(new_consumer "$TMP/cD" 1)"
SVC_CODEX_TEST_MODE=1 SVC_CODEX_TEST_REPO="$TMP/cD" node "$DUR_LOADER" --graph "$G5" --task 1 --skill route-workflow >/dev/null 2>&1
# IAR-05: BOTH receipts — the graph skill_receipt AND the session skill-load receipt.
[ "$(node -e 'const t=require(process.argv[1]).tasks[0];console.log(t.status==="in_progress"&&!!t.skill_receipt)' "$G5")" = "true" ] && ok "graph skill_receipt written + in_progress" || bad "graph receipt/status"
# G6-R3-F005: verify the EXACT session skill-load receipt CONTENT (skill + task), not mere existence.
SESSION_RECEIPT="$(grep -rl '"skill": *"route-workflow"' "$SVC_CODEX_RUNTIME_DIR" 2>/dev/null | head -1)"
if [ -n "$SESSION_RECEIPT" ] && node -e 'const r=require(process.argv[1]);process.exit(r.skill==="route-workflow"&&r.task_graph&&r.skill_sha256?0:1)' "$SESSION_RECEIPT" 2>/dev/null; then ok "session skill-load receipt written with skill+graph+sha256"; else bad "session receipt missing/incomplete"; fi
MUT="$(payload "echo hi > f.txt" "$TMP/cD")"
OUT_MUT="$(cd "$TMP/cD" && printf '%s' "$MUT" | SVC_CODEX_TEST_MODE=1 SVC_CODEX_TEST_REPO="$TMP/cD" SVC_CODEX_TASK_GRAPH="$G5" node "$DUR_ENF" 2>&1 || true)"
expect_allow "$OUT_MUT" "governed mutation ALLOWED after activation (deadlock broken)"

echo "== E. failure-injection recovery (IAR-05) =="
G6f="$(new_consumer "$TMP/cE" 1)"
rm -rf "$SVC_CODEX_RUNTIME_DIR"; mkdir -m 700 "$SVC_CODEX_RUNTIME_DIR"
set +e
SVC_CODEX_TEST_FAIL_AFTER_ACTIVATION=1 SVC_CODEX_TEST_MODE=1 SVC_CODEX_TEST_REPO="$TMP/cE" \
  node "$LOADER" --graph "$G6f" --task 1 --skill route-workflow >/dev/null 2>&1
CRASH_RC=$?
set -e
[ "$CRASH_RC" -ne 0 ] && ok "injected graph-first crash exits nonzero" || bad "injected graph-first crash unexpectedly succeeded"
[ "$(node -e 'const t=require(process.argv[1]).tasks[0];console.log(t.status==="in_progress"&&!!t.skill_receipt)' "$G6f")" = "true" ] && ok "injected crash occurs after atomic graph activation" || bad "injected crash did not activate graph"
if find "$SVC_CODEX_RUNTIME_DIR" -name skill-load.json -print -quit | grep -q .; then bad "injected crash wrote session receipt"; else ok "injected crash preserved missing session receipt"; fi
CRASH_RECEIPT_DIR="$(find "$SVC_CODEX_RUNTIME_DIR" -mindepth 2 -type d -print -quit)"
printf '{truncated' > "$CRASH_RECEIPT_DIR/skill-load.json"; chmod 600 "$CRASH_RECEIPT_DIR/skill-load.json"
SVC_CODEX_TEST_MODE=1 SVC_CODEX_TEST_REPO="$TMP/cE" node "$LOADER" --graph "$G6f" --task 1 --skill route-workflow >/dev/null 2>&1 && ok "exact-loader retry forward-completes partial state" || bad "exact-loader retry failed"
RECOVERED_RECEIPT="$(find "$SVC_CODEX_RUNTIME_DIR" -name skill-load.json -print -quit)"
if [ -n "$RECOVERED_RECEIPT" ]; then ok "retry published the session receipt"; else bad "retry did not publish session receipt"; fi
G6_BEFORE="$(sha256sum "$G6f" | cut -d' ' -f1)"
R6_BEFORE="$(sha256sum "$RECOVERED_RECEIPT" | cut -d' ' -f1)"
SVC_CODEX_TEST_MODE=1 SVC_CODEX_TEST_REPO="$TMP/cE" node "$LOADER" --graph "$G6f" --task 1 --skill route-workflow >/dev/null 2>&1
[ "$G6_BEFORE" = "$(sha256sum "$G6f" | cut -d' ' -f1)" ] && [ "$R6_BEFORE" = "$(sha256sum "$RECOVERED_RECEIPT" | cut -d' ' -f1)" ] && ok "completed exact retry is graph+receipt byte-stable" || bad "completed exact retry rewrote durable state"
node -e 'const fs=require("fs"),p=process.argv[1],j=JSON.parse(fs.readFileSync(p));const reversed=Object.fromEntries(Object.entries(j).reverse());fs.writeFileSync(p,JSON.stringify(reversed)+"\n",{mode:0o600})' "$RECOVERED_RECEIPT"
R6_REORDERED="$(sha256sum "$RECOVERED_RECEIPT" | cut -d' ' -f1)"
SVC_CODEX_TEST_MODE=1 SVC_CODEX_TEST_REPO="$TMP/cE" node "$LOADER" --graph "$G6f" --task 1 --skill route-workflow >/dev/null 2>&1
[ "$R6_REORDERED" = "$(sha256sum "$RECOVERED_RECEIPT" | cut -d' ' -f1)" ] && ok "key-order-independent equivalent receipt is not rewritten" || bad "equivalent reordered receipt was rewritten"
grep -q 'SVC_CODEX_TEST_MODE === "1" && process.env.SVC_CODEX_TEST_FAIL_AFTER_ACTIVATION' "$LOADER" && ok "production loader cannot trigger the test failpoint" || bad "test failpoint is not gated"

if [ "$FAIL" -eq 0 ]; then echo "TIER-1 PASS: validate-codex-first-task-activation"; else echo "TIER-1 FAIL: validate-codex-first-task-activation"; exit 1; fi
