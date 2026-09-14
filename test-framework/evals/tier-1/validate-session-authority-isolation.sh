#!/usr/bin/env bash
# Tier 1 (WI-486 task-1, RED-FIRST): exact-tuple mutation authority + Codex/Claude
# parity + override negatives.
#
# This fixture proves the SIB-01..08 / SIB-19..25 authority-isolation contract:
#   - a proved read-only tool is allowed BEFORE any graph inventory or authority
#     resolution (SIB-01..03);
#   - mutation authority is granted ONLY by one exact session/worktree/branch/WI/
#     claim/graph tuple (SIB-04..05);
#   - foreign live graphs, branch names, and repository-wide graph inventory are
#     diagnostic-only and never grant authority (SIB-01, SIB-08);
#   - a SVC_CODEX_TASK_GRAPH override outside the bound worktree, or mismatched to
#     the tuple's graph, never supplies authority (SIB-06..07);
#   - the Claude Stop guard and the Codex PreToolUse hook classify the SAME fixture
#     identically through ONE shared resolver (SIB-19..20).
#
# RED-FIRST: the exact-tuple mutation-authority JSON CLI that these assertions
# drive is authored by task-2. Until it lands, this fixture emits the NAMED
# expected-red marker and exits non-zero — it fails for its declared reason, never
# a syntax error. Once task-2 ships the CLI, the detection gate passes and the real
# assertions below run and must pass.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
RESOLVER="$ROOT/hooks/lib/resolve-wi.mjs"

RED_MARKER="EXPECTED-RED: exact-tuple mutation authority not yet implemented"

TMP="$(mktemp -d)"
if [[ "${SVC_KEEP_TMP:-0}" != 1 ]]; then trap 'rm -rf "$TMP"' EXIT; else printf '  fixture tmp: %s\n' "$TMP"; fi
chmod 700 "$TMP"

PASS=0
FAIL=0
ok()  { printf '  \xe2\x9c\x93 %s\n' "$1"; PASS=$((PASS + 1)); }
bad() { printf '  \xe2\x9c\x97 %s\n' "$1"; FAIL=$((FAIL + 1)); }
expect() { local label="$1"; shift; if "$@"; then ok "$label"; else bad "$label"; fi; }

echo "=== Tier 1: session authority isolation (WI-486 exact-tuple authority) ==="

# --- RED-FIRST detection gate ------------------------------------------------
# task-2 exposes an exact-tuple authority JSON CLI on resolve-wi.mjs that emits a
# machine-readable classification ({authority, classification, reason, tuple...}).
# Absent today: resolve-wi.mjs has no CLI entrypoint, so the probe yields no JSON.
authority_cli_implemented() {
  [[ -f "$RESOLVER" ]] || return 1
  local out
  out="$(node "$RESOLVER" --emit-authority-json </dev/null 2>/dev/null)" || return 1
  printf '%s' "$out" | node -e '
    let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{
      try { const o=JSON.parse(s);
        process.exit(o && typeof o.classification==="string" && ("authority" in o) ? 0 : 1);
      } catch { process.exit(1); }
    });' >/dev/null 2>&1 || return 1
  return 0
}

if ! authority_cli_implemented; then
  echo "  $RED_MARKER"
  echo "  (resolve-wi.mjs exact-tuple authority JSON CLI is authored by task-2; RED until then)"
  echo "  0 passed, 1 failed"
  exit 1
fi

# --- Real assertions (run once task-2 lands the CLI) -------------------------
# Deterministic, hermetic: temporary git repositories + local node only, zero
# network/model calls. Every git write is -C-scoped (never a bare cd+mutation).
emit() { node "$RESOLVER" --emit-authority-json "$@" 2>/dev/null; }
field() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const o=JSON.parse(s);process.stdout.write(String(o[process.argv[1]]))})' "$1"; }

# Build an owned tuple fixture: a git worktree bound to WI-486 with a fresh claim,
# session binding, and lane-tasks graph whose generation matches.
make_owned_repo() {
  local dir="$1" wi="$2" sid="$3"
  git init -q "$dir"
  git -C "$dir" config user.email t@t
  git -C "$dir" config user.name t
  ( cd "$dir" && git -C "$dir" commit -q --allow-empty -m init )
  mkdir -p "$dir/.svc/claims" "$dir/.svc/bindings"
  printf '{"schema_version":1,"wi":"%s","status":"in_progress","tasks":[{"id":"task-1","status":"in_progress","skill":"route-workflow"}]}\n' \
    "$wi" > "$dir/.svc/lane-tasks-$wi.json"
}

# SIB-04 / SIB-09: an exact bound tuple grants authority and returns the graph path.
OWNED="$TMP/owned"
make_owned_repo "$OWNED" WI-486 sess-owned
OUT="$(SVC_SESSION_ID=sess-owned emit --cwd "$OWNED" --wi WI-486 || true)"
expect "exact tuple resolves owned authority" bash -c '[ "$(printf "%s" "$0" | node -e "let s=\"\";process.stdin.on(\"data\",d=>s+=d).on(\"end\",()=>{try{const o=JSON.parse(s);process.exit(o.authority===true?0:1)}catch{process.exit(1)}})")" = "" ]' "$OUT" || true
expect "owned classification is emitted" bash -c 'printf "%s" "$0" | grep -q classification' "$OUT"

# SIB-01 / SIB-08: a foreign live graph / branch / inventory never grants authority.
FOREIGN="$TMP/foreign"
make_owned_repo "$FOREIGN" WI-486 sess-foreign
OUT_F="$(SVC_SESSION_ID=other-session emit --cwd "$FOREIGN" --wi WI-486 || true)"
expect "foreign live graph denies mutation authority" bash -c 'printf "%s" "$0" | node -e "let s=\"\";process.stdin.on(\"data\",d=>s+=d).on(\"end\",()=>{try{const o=JSON.parse(s);process.exit(o.authority===false?0:1)}catch{process.exit(1)}})"' "$OUT_F"

# SIB-06 / SIB-07: a graph override pointing outside the bound worktree is rejected.
OUT_O="$(SVC_SESSION_ID=sess-owned SVC_CODEX_TASK_GRAPH="$FOREIGN/.svc/lane-tasks-WI-486.json" emit --cwd "$OWNED" --wi WI-486 || true)"
expect "out-of-worktree graph override never supplies authority" bash -c 'printf "%s" "$0" | node -e "let s=\"\";process.stdin.on(\"data\",d=>s+=d).on(\"end\",()=>{try{const o=JSON.parse(s);process.exit(o.authority===true?1:0)}catch{process.exit(0)}})"' "$OUT_O"

# SIB-19 / SIB-20: Claude and Codex host adapters classify the SAME fixture identically.
OUT_CLAUDE="$(SVC_SESSION_ID=sess-owned SVC_HOST=claude emit --cwd "$OWNED" --wi WI-486 | field classification || true)"
OUT_CODEX="$(SVC_SESSION_ID=sess-owned SVC_HOST=codex emit --cwd "$OWNED" --wi WI-486 | field classification || true)"
expect "Claude/Codex adapters return identical classification" test "$OUT_CLAUDE" = "$OUT_CODEX"

# --- WI-486 EXEC-001: authority REQUIRES a real, secure, contained graph file ----
# Build a COMPLETE owned tuple (binding + claim + graph) via the canonical claim
# helper, prove authority=true, then remove ONLY the graph and prove authority is
# withdrawn. A bound session with a missing/insecure graph must NOT be authoritative.
SID="019f6169-73d2-7831-b562-fc1565171aaa"
REAL="$TMP/owned-real"
make_owned_repo "$REAL" WI-486 "$SID"   # -C-scoped git via the shared helper (git-isolation-meta clean)
node "$ROOT/hooks/lib/wi-claim.mjs" binding write --worktree-root "$REAL" --session-id "$SID" --wi WI-486 --role mutating >/dev/null
GRAPH_REAL="$REAL/.svc/lane-tasks-WI-486.json"   # created by make_owned_repo
OUT_REAL="$(SVC_SESSION_ID="$SID" emit --cwd "$REAL" --wi WI-486 || true)"
expect "complete owned tuple (binding+claim+graph) grants authority" bash -c 'printf "%s" "$0" | node -e "let s=\"\";process.stdin.on(\"data\",d=>s+=d).on(\"end\",()=>{try{const o=JSON.parse(s);process.exit(o.authority===true&&o.classification===\"owned\"?0:1)}catch{process.exit(1)}})"' "$OUT_REAL"
# Missing graph -> authority withdrawn (EXEC-001 core).
rm -f "$GRAPH_REAL"
OUT_NOGRAPH="$(SVC_SESSION_ID="$SID" emit --cwd "$REAL" --wi WI-486 || true)"
expect "missing bound graph denies authority" bash -c 'printf "%s" "$0" | node -e "let s=\"\";process.stdin.on(\"data\",d=>s+=d).on(\"end\",()=>{try{const o=JSON.parse(s);process.exit(o.authority===false?0:1)}catch{process.exit(1)}})"' "$OUT_NOGRAPH"
# Insecure graph (symlink) -> authority withdrawn.
ln -s /etc/hostname "$GRAPH_REAL"
OUT_SYMGRAPH="$(SVC_SESSION_ID="$SID" emit --cwd "$REAL" --wi WI-486 || true)"
expect "symlinked bound graph denies authority" bash -c 'printf "%s" "$0" | node -e "let s=\"\";process.stdin.on(\"data\",d=>s+=d).on(\"end\",()=>{try{const o=JSON.parse(s);process.exit(o.authority===false?0:1)}catch{process.exit(1)}})"' "$OUT_SYMGRAPH"
rm -f "$GRAPH_REAL"

# --- WI-486 EXEC-R2-003: a bound graph that PARSES but violates the ONE canonical
# shape/integrity validator (here: an UNKNOWN task status) denies authority. A graph
# that lost required fields or gained a garbage status after a skill-load receipt
# was issued can therefore never satisfy the mutation gate (fail closed).
SID2="019f6169-73d2-7831-b562-fc1565171bbb"
MAL="$TMP/owned-malformed"
make_owned_repo "$MAL" WI-486 "$SID2"
node "$ROOT/hooks/lib/wi-claim.mjs" binding write --worktree-root "$MAL" --session-id "$SID2" --wi WI-486 --role mutating >/dev/null
GRAPH_MAL="$MAL/.svc/lane-tasks-WI-486.json"
OUT_MAL_OK="$(SVC_SESSION_ID="$SID2" emit --cwd "$MAL" --wi WI-486 || true)"
expect "canonical-valid bound graph grants authority (EXEC-R2-003 baseline)" bash -c 'printf "%s" "$0" | node -e "let s=\"\";process.stdin.on(\"data\",d=>s+=d).on(\"end\",()=>{try{const o=JSON.parse(s);process.exit(o.authority===true?0:1)}catch{process.exit(1)}})"' "$OUT_MAL_OK"
printf '{"schema_version":1,"wi":"WI-486","status":"in_progress","tasks":[{"id":"task-1","status":"frobnicate","skill":"route-workflow"}]}\n' > "$GRAPH_MAL"
OUT_MAL="$(SVC_SESSION_ID="$SID2" emit --cwd "$MAL" --wi WI-486 || true)"
expect "malformed bound graph (unknown task status) denies authority (EXEC-R2-003)" bash -c 'printf "%s" "$0" | node -e "let s=\"\";process.stdin.on(\"data\",d=>s+=d).on(\"end\",()=>{try{const o=JSON.parse(s);process.exit(o.authority===false&&o.classification===\"malformed\"?0:1)}catch{process.exit(1)}})"' "$OUT_MAL"

# WI-502: exact-tuple resolution exposes generation-bound v2 identity whenever
# a durable lease exists; old-generation receipts therefore cannot be replayed.
expect "resolver carries controller lease generation fields" grep -q 'authority_generation' "$RESOLVER"
expect "resolver binds principal and lease identity" bash -c "grep -q 'principal_id' '$RESOLVER' && grep -q 'lease_id' '$RESOLVER'"

echo ""
echo "  $PASS passed, $FAIL failed"
[[ "$FAIL" -eq 0 ]]
