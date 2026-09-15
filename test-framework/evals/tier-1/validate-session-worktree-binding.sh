#!/usr/bin/env bash
set -euo pipefail

echo "=== Tier 1: Session, worktree, and WI binding ==="

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
export HOME="$TMP/home"; mkdir -m 700 "$HOME"
export XDG_RUNTIME_DIR="$TMP/missing-xdg"
unset SVC_RUNTIME_DIR SVC_CODEX_RUNTIME_DIR
PASS=0

ok() { PASS=$((PASS + 1)); echo "  ✓ $1"; }
fail() { echo "  ✗ $1" >&2; exit 1; }

node --check "$ROOT/hooks/lib/wi-claim.mjs"
node --check "$ROOT/hooks/lib/resolve-wi.mjs"
node --check "$ROOT/hooks/lib/active-intent.mjs"
bash -n "$ROOT/hooks/svc-task-completion-guard.sh"
bash -n "$ROOT/scripts/worktree.sh"
! grep -q 'CLAIM_FILE="\.svc/' "$ROOT/hooks/svc-task-completion-guard.sh" || fail "legacy relative claim path remains"
grep -q 'Mutating worktree binding requires --session ID' "$ROOT/scripts/worktree.sh" || fail "mutating worktree can silently omit binding"
ok "binding and guard sources parse"

node -e 'const s=require(process.argv[1]);const r=s.required||[];for(const k of ["session_id","role","wi","repo_root","worktree_root","branch","claim_path","generation"])if(!r.includes(k))process.exit(1);if(s.additionalProperties!==false)process.exit(1)' "$ROOT/schemas/session-worktree-binding.schema.json" || fail "binding schema contract"
ok "binding schema is strict and complete"

REPO="$TMP/repo"
mkdir -p "$REPO"
git -C "$REPO" init -q
git -C "$REPO" config user.name fixture
git -C "$REPO" config user.email fixture@example.test
mkdir -p "$REPO/.svc/claims" "$REPO/.svc/bindings"
printf 'fixture\n' > "$REPO/README.md"
git -C "$REPO" add README.md
git -C "$REPO" commit -qm init
git -C "$REPO" branch -m framework-WI-484-fixture

# Worktree creation must reject a missing mutating-session identity before it
# creates either a branch or worktree. Read-only creation may proceed without
# a session and must not create a mutation claim.
WT_REPO="$TMP/worktree-repo"
mkdir -p "$WT_REPO/scripts" "$WT_REPO/hooks/lib"
git -C "$WT_REPO" init -q
git -C "$WT_REPO" config user.name fixture
git -C "$WT_REPO" config user.email fixture@example.test
cp "$ROOT/scripts/worktree.sh" "$WT_REPO/scripts/worktree.sh"
cp "$ROOT/hooks/lib/wi-claim.mjs" "$WT_REPO/hooks/lib/wi-claim.mjs"
cp "$ROOT/hooks/lib/authoritative-binding.mjs" "$WT_REPO/hooks/lib/authoritative-binding.mjs"
cp "$ROOT/hooks/lib/svc-runtime-root.mjs" "$WT_REPO/hooks/lib/svc-runtime-root.mjs"
printf '.worktrees/\n' > "$WT_REPO/.gitignore"
printf 'fixture\n' > "$WT_REPO/README.md"
git -C "$WT_REPO" add .gitignore README.md scripts/worktree.sh hooks/lib/wi-claim.mjs hooks/lib/authoritative-binding.mjs hooks/lib/svc-runtime-root.mjs
git -C "$WT_REPO" commit -qm init
if (
  cd "$WT_REPO"
  env -u SVC_SESSION_ID -u CODEX_THREAD_ID -u CODEX_SESSION_ID \
    -u CLAUDE_SESSION_ID -u KIMI_SESSION_ID -u GEMINI_SESSION_ID \
    bash scripts/worktree.sh create framework-WI-991-no-session
) >"$TMP/no-session.out" 2>"$TMP/no-session.err"; then
  fail "mutating create without a session succeeded"
fi
[[ ! -e "$WT_REPO/.worktrees/framework-WI-991-no-session" ]] || fail "rejected mutating create materialized a worktree"
! git -C "$WT_REPO" show-ref --verify --quiet refs/heads/framework-WI-991-no-session || fail "rejected mutating create materialized a branch"
grep -q 'Mutating worktree binding requires --session ID' "$TMP/no-session.out" || fail "missing-session create lacked diagnostic"
(
  cd "$WT_REPO"
  env -u SVC_SESSION_ID -u CODEX_THREAD_ID -u CODEX_SESSION_ID \
    -u CLAUDE_SESSION_ID -u KIMI_SESSION_ID -u GEMINI_SESSION_ID \
    bash scripts/worktree.sh create review-read-only --role reviewer
) >"$TMP/reviewer-create.out" 2>"$TMP/reviewer-create.err"
[[ -d "$WT_REPO/.worktrees/review-read-only" ]] || fail "read-only create without session failed"
! find "$WT_REPO/.worktrees/review-read-only/.svc/claims" -type f -name '*.json' | grep -q . || fail "read-only create wrote a mutation claim"
ok "worktree creation rejects unbound mutation before side effects"

SESSION_A="019f6169-73d2-7831-b562-fc1565171ccc"
SESSION_B="019f616a-0000-7000-8000-000000000002"
SESSION_R="019f616a-0000-7000-8000-000000000003"
SESSION_C="019f616a-0000-7000-8000-000000000004"
SESSION_X="019f616a-0000-7000-8000-000000000005"
SESSION_D="019f616a-0000-7000-8000-000000000006"

node --input-type=module - "$ROOT" <<'NODE_OWNER'
import assert from "node:assert/strict";
const root = process.argv[2];
const m = await import(`file://${root}/hooks/lib/wi-claim.mjs`);
const sid = "019f6169-73d2-7831-b562-fc1565171ccc";
for (const key of ["session_token", "session", "session_id", "claimed_by"]) {
  const value = m.normalizeClaimOwner({ [key]: sid });
  assert.equal(value.attributable, true);
  assert.equal(value.session_id, sid);
}
for (const label of ["claude", "codex", "kimi", "agent-reviewer", ""]) {
  assert.equal(m.normalizeClaimOwner({ claimed_by: label }).attributable, false);
}
NODE_OWNER
ok "claim variants normalize without accepting agent labels"

# WI-486 (EXEC-004): claim freshness is process-identity-first, not TTL-first.
node --input-type=module - "$ROOT" <<'NODE_LIVENESS'
import assert from "node:assert/strict";
import os from "node:os";
const root = process.argv[2];
const m = await import(`file://${root}/hooks/lib/wi-claim.mjs`);
const ancient = "2020-01-01T00:00:00Z";
const host = os.hostname();
// (a) same-host LIVE identity + ANCIENT timestamp => NOT stale (live owner never TTL-preempted).
const liveTok = m.processStartToken(process.pid);
assert.equal(
  m.isClaimStale({ hostname: host, pid: process.pid, process_start_token: liveTok, started_at: ancient, renewed_at: ancient, ttl_hours: 24 }),
  false, "live same-host identity is never TTL-stale");
// (b) same-host DEAD identity (ESRCH) => stale (reclaimable).
assert.equal(
  m.isClaimStale({ hostname: host, pid: 2147480000, process_start_token: `${host}:2147480000:1`, started_at: ancient, renewed_at: ancient, ttl_hours: 24 }),
  true, "proven-dead same-host identity is stale");
// (c) WI-486 (EXEC-R2-005): same-host, hostname recorded but NO pid => governed by
// the claim's OWN renewal heartbeat under TTL (never "fresh forever"). Both halves:
//   - LIVE never preempted: a FRESH (recently-renewed) identity-less claim is NOT stale.
const nowC = new Date().toISOString();
assert.equal(
  m.isClaimStale({ hostname: host, started_at: nowC, renewed_at: nowC, ttl_hours: 24 }),
  false, "same-host identity-less claim renewed within TTL is LIVE (never preempted)");
//   - DEAD eventually reclaimable: an ANCIENT (past-TTL) identity-less claim IS stale,
//     so a crashed/abandoned same-host session can never permanently wedge the repo.
assert.equal(
  m.isClaimStale({ hostname: host, started_at: ancient, renewed_at: ancient, ttl_hours: 24 }),
  true, "same-host identity-less claim past TTL is reclaimable (no permanent wedge)");
// (d) CROSS-host ancient claim => TTL applies => stale.
assert.equal(
  m.isClaimStale({ hostname: `${host}-other-node`, started_at: ancient, renewed_at: ancient, ttl_hours: 24 }),
  true, "cross-host ancient claim is TTL-stale");
// (e) CROSS-host fresh claim => not stale.
const nowIso = new Date().toISOString();
assert.equal(
  m.isClaimStale({ hostname: `${host}-other-node`, started_at: nowIso, renewed_at: nowIso, ttl_hours: 24 }),
  false, "cross-host fresh claim is not stale");
// processIdentity: invalid pid and EPERM-class uncertainty fail closed to alive.
assert.equal(m.processIdentity(0, "x"), "alive", "invalid pid is uncertain->alive");
assert.equal(m.processIdentity(process.pid, liveTok), "alive", "own live pid+token is alive");
assert.equal(m.processIdentity(2147480000, `${host}:2147480000:1`), "dead", "ESRCH pid is dead");
NODE_LIVENESS
ok "claim freshness ignores TTL for live same-host identity; proven death or cross-host TTL reclaims"

node "$ROOT/hooks/lib/wi-claim.mjs" binding write --worktree-root "$REPO" --session-id "$SESSION_A" --wi WI-484 --role mutating > "$TMP/binding-a.json"
GEN1=$(node -e 'console.log(require(process.argv[1]).binding.generation)' "$TMP/binding-a.json")
node "$ROOT/hooks/lib/wi-claim.mjs" binding write --worktree-root "$REPO" --session-id "$SESSION_A" --wi WI-484 --role mutating > "$TMP/binding-a-renew.json"
GEN2=$(node -e 'console.log(require(process.argv[1]).binding.generation)' "$TMP/binding-a-renew.json")
[[ "$GEN1" == "$GEN2" ]] || fail "idempotent renewal changed generation"
ok "same identity renews without generation drift"

node "$ROOT/hooks/lib/wi-claim.mjs" binding write --worktree-root "$REPO" --session-id "$SESSION_R" --role reviewer > "$TMP/binding-reviewer.json"
node -e 'const b=require(process.argv[1]).binding;process.exit(b.role==="reviewer"&&b.wi===""&&b.claim_path===""?0:1)' "$TMP/binding-reviewer.json" || fail "reviewer zero-binding"
ok "reviewer role has zero mutation binding"

cat > "$REPO/.svc/lane-tasks-WI-484.json" <<'JSON'
{
  "wi": "WI-484",
  "status": "in_progress",
  "tasks": [
    {
      "id": 1,
      "skill": "execute-changeset",
      "status": "pending",
      "subject": "fixture pending task",
      "metadata": { "skill": "execute-changeset" }
    }
  ]
}
JSON
printf '%s\n' '{"ts":"2026-07-14T16:00:00Z","wi":"WI-484","bound_to":"wi-backlog","request":"fixture"}' > "$REPO/.svc/session-contract.jsonl"

node --input-type=module - "$ROOT" "$REPO" "$SESSION_A" "$SESSION_B" <<'NODE_RESOLVE'
import assert from "node:assert/strict";
const [root, repo, a, b] = process.argv.slice(2);
const m = await import(`file://${root}/hooks/lib/resolve-wi.mjs`);
const owned = m.resolveWI({ cwd: repo, session_id: a }, { ...process.env, PWD: repo, SVC_REQUIRE_SESSION_BINDING: "1" });
assert.equal(owned.wi, "WI-484");
assert.equal(owned.authority, true);
assert.equal(owned.source, "session_worktree_binding");
const foreign = m.resolveWI({ cwd: repo, session_id: b }, { ...process.env, PWD: repo, SVC_REQUIRE_SESSION_BINDING: "1" });
assert.equal(foreign.wi, "");
assert.equal(foreign.authority, false);
assert.equal(foreign.diagnostics.branch_wi, "WI-484");
NODE_RESOLVE
ok "resolver separates authority from branch and graph diagnostics"

# WI-486 (SIB-04/10/19): the shared authority resolver's JSON CLI returns the
# COMPLETE owned tuple (repo/worktree/branch/WI/graph/session/claim/binding/
# generation), and the Claude Stop guard consumes ownership through THAT resolver
# rather than a second embedded implementation.
node --input-type=module - "$ROOT" "$REPO" "$SESSION_A" "$SESSION_B" <<'NODE_TUPLE'
import assert from "node:assert/strict";
const [root, repo, a, b] = process.argv.slice(2);
const m = await import(`file://${root}/hooks/lib/resolve-wi.mjs`);
const owned = m.authorityJson({ cwd: repo, session_id: a }, { ...process.env, PWD: repo, SVC_REQUIRE_SESSION_BINDING: "1" });
assert.equal(owned.authority, true);
assert.equal(owned.classification, "owned");
for (const k of ["repo_root", "worktree_root", "branch", "wi", "graph_path", "session_id", "claim_path", "binding_path", "claim_generation"]) {
  assert.ok(owned.tuple[k] !== undefined && owned.tuple[k] !== "", `owned tuple carries ${k}`);
}
assert.ok(owned.tuple.graph_path.endsWith("lane-tasks-WI-484.json"), "exact binding-derived graph path");
// A foreign session gets a non-owned classification and NO tuple (SIB-08 cross-session regression).
const foreign = m.authorityJson({ cwd: repo, session_id: b }, { ...process.env, PWD: repo, SVC_REQUIRE_SESSION_BINDING: "1" });
assert.equal(foreign.authority, false);
assert.equal(foreign.tuple, null);
NODE_TUPLE
ok "authorityJson returns the complete owned tuple; foreign session gets none"

grep -q 'resolve-wi.mjs' "$ROOT/hooks/svc-task-completion-guard.sh" || fail "Stop guard does not route ownership through the shared resolver"
grep -q 'authorityJson' "$ROOT/hooks/svc-task-completion-guard.sh" || fail "Stop guard does not consume the shared authority serialization"
ok "Claude Stop guard consumes the shared resolver (no second embedded resolver)"

node --input-type=module - "$ROOT" "$REPO" "$SESSION_A" "$SESSION_B" <<'NODE_INTENT'
import assert from "node:assert/strict";
const [root, repo, a, b] = process.argv.slice(2);
const m = await import(`file://${root}/hooks/lib/active-intent.mjs`);
const contractEnv = {
  ...process.env,
  CONTRACT_BOUND_TO: "wi-backlog",
  CONTRACT_WI: "WI-479",
  CONTRACT_TS: "2026-07-14T16:00:00.000Z",
};
const payload = (session_id, prompt) => JSON.stringify({ session_id, cwd: repo, prompt });
m.writeActiveIntentState({
  rawInput: payload(a, "there is more implementation? how much more what remains"),
  cwd: repo,
  env: contractEnv,
  now: new Date("2026-07-14T17:00:00.000Z"),
});
const replaced = m.evaluateSuppression({
  svcDir: `${repo}/.svc`, resolvedWi: "WI-479", rawInput: payload(a, ""), cwd: repo,
  env: contractEnv, now: new Date("2026-07-14T17:00:01.000Z"),
});
assert.equal(replaced.suppressed, true);
assert.equal(replaced.classification, "stale-contract-latest-prompt");

m.writeActiveIntentState({
  rawInput: payload(a, "resume WI-479"), cwd: repo, env: contractEnv,
  now: new Date("2026-07-14T17:01:00.000Z"),
});
const resumed = m.evaluateSuppression({
  svcDir: `${repo}/.svc`, resolvedWi: "WI-479", rawInput: payload(a, ""), cwd: repo,
  env: contractEnv, now: new Date("2026-07-14T17:01:01.000Z"),
});
assert.equal(resumed.suppressed, false);
const foreign = m.evaluateSuppression({
  svcDir: `${repo}/.svc`, resolvedWi: "WI-479", rawInput: payload(b, ""), cwd: repo,
  env: contractEnv, now: new Date("2026-07-14T17:01:01.000Z"),
});
assert.equal(foreign.suppressed, false);
NODE_INTENT
ok "new prompt replaces stale WI-479 pressure; exact same-session resume restores it"
rm -f "$REPO/.svc/active-intent-state.json"

RUNTIME="$TMP/runtime"
mkdir -m 700 -p "$RUNTIME"
mkdir -p "$REPO/.svc/receipts/session-b"
printf '%s\n' '{"owner":"session-b","sentinel":true}' > "$REPO/.svc/receipts/session-b/sentinel.json"
RECEIPT_BEFORE=$(sha256sum "$REPO/.svc/receipts/session-b/sentinel.json" | awk '{print $1}')
run_guard() {
  local session="$1" out="$2" err="$3"
  shift 3
  (
    cd "$REPO"
    printf '{"session_id":"%s","cwd":"%s"}' "$session" "$REPO" |
      XDG_RUNTIME_DIR="$RUNTIME" SVC_COMPLETION_MAX=99 "$@" \
      bash "$ROOT/hooks/svc-task-completion-guard.sh" >"$out" 2>"$err"
  )
}

run_guard "$SESSION_A" "$TMP/owned-1.out" "$TMP/owned-1.err"
grep -q '"decision":"block"' "$TMP/owned-1.out" || fail "owned pending graph did not block"
COUNTERS_AFTER_OWNED=$(find "$RUNTIME" -type f -name pressure-count | wc -l)
ok "owned binding reads exact graph and creates pressure"

run_guard "$SESSION_A" "$TMP/request-mismatch.out" "$TMP/request-mismatch.err" env SVC_WORKER_WI=WI-999
! grep -q '"decision":"block"' "$TMP/request-mismatch.out" || fail "mismatched requested WI retained pressure"
grep -q 'differs from the authoritative session binding' "$TMP/request-mismatch.err" || fail "mismatched requested WI lacked advisory"
[[ "$(find "$RUNTIME" -type f -name pressure-count | wc -l)" == "$COUNTERS_AFTER_OWNED" ]] || fail "mismatched WI request changed pressure counters"
ok "mismatched requested WI cannot silently filter the bound graph"

CLAIM="$REPO/.svc/claims/WI-484.claim.json"
node -e 'const fs=require("fs");const p=process.argv[1];const j=JSON.parse(fs.readFileSync(p));j.session_id=process.argv[2];fs.writeFileSync(p,JSON.stringify(j,null,2)+"\n")' "$CLAIM" "$SESSION_B"
printf '{broken foreign graph' > "$REPO/.svc/lane-tasks-WI-484.json"
run_guard "$SESSION_A" "$TMP/foreign.out" "$TMP/foreign.err"
! grep -q '"decision":"block"' "$TMP/foreign.out" || fail "foreign claim created completion pressure"
grep -q 'advisory only' "$TMP/foreign.err" || fail "foreign claim lacked advisory"
grep -q 'no foreign graph was inspected' "$TMP/foreign.err" || fail "foreign graph parse boundary missing"
[[ "$(find "$RUNTIME" -type f -name pressure-count | wc -l)" == "$COUNTERS_AFTER_OWNED" ]] || fail "foreign session changed pressure counters"
[[ "$(sha256sum "$REPO/.svc/receipts/session-b/sentinel.json" | awk '{print $1}')" == "$RECEIPT_BEFORE" ]] || fail "foreign session changed receipt state"
ok "fresh foreign claim allows before corrupt graph parsing"

BINDING_A=$(find "$REPO/.svc/bindings" -type f -name '*.json' -exec grep -l "$SESSION_A" {} + | head -n 1)
cp "$BINDING_A" "$TMP/binding-a.saved"
node -e 'const fs=require("fs");const p=process.argv[1];const j=JSON.parse(fs.readFileSync(p));delete j.worktree_root;delete j.repo_root;fs.writeFileSync(p,JSON.stringify(j,null,2)+"\n")' "$BINDING_A"
node --input-type=module - "$ROOT" "$REPO" "$SESSION_A" <<'NODE_MALFORMED_RESOLVE'
import assert from "node:assert/strict";
const [root, repo, session] = process.argv.slice(2);
const m = await import(`file://${root}/hooks/lib/resolve-wi.mjs`);
const result = m.resolveWI({ cwd: repo, session_id: session }, { ...process.env, PWD: repo, SVC_REQUIRE_SESSION_BINDING: "1" });
assert.equal(result.authority, false);
assert.equal(result.wi, "");
NODE_MALFORMED_RESOLVE
run_guard "$SESSION_A" "$TMP/malformed-binding.out" "$TMP/malformed-binding.err"
! grep -q '"decision":"block"' "$TMP/malformed-binding.out" || fail "malformed binding fell into legacy graph pressure"
grep -q 'no foreign graph was inspected' "$TMP/malformed-binding.err" || fail "malformed binding lacked advisory boundary"
cp "$TMP/binding-a.saved" "$BINDING_A"

cp "$CLAIM" "$TMP/claim.saved"
rm "$CLAIM"
ln -s "$TMP/claim.saved" "$CLAIM"
run_guard "$SESSION_A" "$TMP/symlink-claim.out" "$TMP/symlink-claim.err"
! grep -q '"decision":"block"' "$TMP/symlink-claim.out" || fail "symlink claim fell into legacy graph pressure"
grep -q 'no foreign graph was inspected' "$TMP/symlink-claim.err" || fail "symlink claim lacked advisory boundary"
rm "$CLAIM"
cp "$TMP/claim.saved" "$CLAIM"
ok "malformed bindings and symlink claims never select a legacy graph"

# WI-486 (EXEC-004): a same-host claim is stale ONLY when its process identity is
# proven dead (ESRCH). An ancient timestamp is not sufficient — TTL never expires a
# same-host claim. Prove death via a dead pid + matching-host start-token.
node -e 'const fs=require("fs");const os=require("os");const p=process.argv[1];const j=JSON.parse(fs.readFileSync(p));j.started_at="2020-01-01T00:00:00Z";j.renewed_at="2020-01-01T00:00:00Z";j.hostname=os.hostname();j.pid=2147480000;j.process_start_token=os.hostname()+":2147480000:1";fs.writeFileSync(p,JSON.stringify(j,null,2)+"\n")' "$CLAIM"
node --input-type=module - "$ROOT" "$REPO" "$SESSION_C" <<'NODE_STALE_DIRECT'
import assert from "node:assert/strict";
const [root, repo, session] = process.argv.slice(2);
const m = await import(`file://${root}/hooks/lib/wi-claim.mjs`);
const result = m.claimWI("WI-484", { worktree_root: repo, session_id: session, role: "mutating" });
assert.equal(result.ok, false);
assert.match(result.warning, /generation-bound claim transfer/);
NODE_STALE_DIRECT
node "$ROOT/hooks/lib/wi-claim.mjs" claim transfer --worktree-root "$REPO" --wi WI-484 --expected-generation "$GEN1" --session-id "$SESSION_B" --role mutating > "$TMP/transfer.json"
node -e 'const j=require(process.argv[1]);process.exit(j.ok&&j.claim.session_id===process.argv[2]&&j.claim.generation===2?0:1)' "$TMP/transfer.json" "$SESSION_B" || fail "stale CAS transfer"
if node "$ROOT/hooks/lib/wi-claim.mjs" claim transfer --worktree-root "$REPO" --wi WI-484 --expected-generation "$GEN1" --session-id "$SESSION_A" --role mutating >/dev/null 2>&1; then
  fail "stale expected generation transferred twice"
fi
ok "claim transfer is stale-only and compare-and-swap"

node "$ROOT/hooks/lib/wi-claim.mjs" binding write --worktree-root "$REPO" --session-id "$SESSION_B" --wi WI-484 --role mutating >/dev/null
node "$ROOT/hooks/lib/wi-claim.mjs" binding release --worktree-root "$REPO" --session-id "$SESSION_B" >/dev/null
BINDING_B=$(find "$REPO/.svc/bindings" -type f -name '*.json' -exec grep -l "$SESSION_B" {} + | head -n 1)
cp "$BINDING_B" "$TMP/binding-b.released"
node -e 'const fs=require("fs");const p=process.argv[1];const j=JSON.parse(fs.readFileSync(p));delete j.released_at;fs.writeFileSync(p,JSON.stringify(j,null,2)+"\n")' "$BINDING_B"
run_guard "$SESSION_B" "$TMP/released-claim.out" "$TMP/released-claim.err"
! grep -q '"decision":"block"' "$TMP/released-claim.out" || fail "released claim retained completion authority"
grep -q 'advisory only' "$TMP/released-claim.err" || fail "released claim lacked advisory"
cp "$TMP/binding-b.released" "$BINDING_B"
node --input-type=module - "$ROOT" "$CLAIM" <<'NODE_RELEASED'
import assert from "node:assert/strict";
const [root, claimPath] = process.argv.slice(2);
const m = await import(`file://${root}/hooks/lib/wi-claim.mjs`);
const claim = m.readClaimAbsolute(claimPath);
assert.equal(Boolean(claim.released_at), true);
assert.equal(m.claimFreshness(claim, claimPath).fresh, false);
NODE_RELEASED
node --input-type=module - "$ROOT" "$REPO" "$CLAIM" <<'NODE_RELEASED_CLEANUP'
import assert from "node:assert/strict";
import fs from "node:fs";
const [root, repo, claimPath] = process.argv.slice(2);
const m = await import(`file://${root}/hooks/lib/wi-claim.mjs`);
assert.equal(m.cleanStaleClaims({ worktree_root: repo }), 0);
assert.equal(fs.existsSync(claimPath), true);
NODE_RELEASED_CLEANUP
node "$ROOT/hooks/lib/wi-claim.mjs" claim transfer --worktree-root "$REPO" --wi WI-484 --expected-generation 2 --session-id "$SESSION_A" --role mutating >"$TMP/released-transfer.json"
node -e 'const j=require(process.argv[1]);process.exit(j.ok&&j.claim.generation===3&&!j.claim.released_at?0:1)' "$TMP/released-transfer.json" || fail "owner-release transfer"
ok "explicit owner release permits generation-bound transfer"

# Two simultaneous stale transfers with the same expected generation must
# produce exactly one winner.
node -e 'const fs=require("fs");const os=require("os");const p=process.argv[1];const j=JSON.parse(fs.readFileSync(p));j.started_at="2020-01-01T00:00:00Z";j.renewed_at=j.started_at;j.hostname=os.hostname();j.pid=2147480000;j.process_start_token=os.hostname()+":2147480000:1";fs.writeFileSync(p,JSON.stringify(j,null,2)+"\n")' "$CLAIM"
(node "$ROOT/hooks/lib/wi-claim.mjs" claim transfer --worktree-root "$REPO" --wi WI-484 --expected-generation 3 --session-id "$SESSION_B" --role mutating >"$TMP/cas-a.out" 2>"$TMP/cas-a.err" || true) &
cas_a=$!
(node "$ROOT/hooks/lib/wi-claim.mjs" claim transfer --worktree-root "$REPO" --wi WI-484 --expected-generation 3 --session-id "$SESSION_C" --role mutating >"$TMP/cas-c.out" 2>"$TMP/cas-c.err" || true) &
cas_c=$!
wait "$cas_a" "$cas_c"
cas_winners=$(awk '/"ok": true/{n++} END{print n+0}' "$TMP/cas-a.out" "$TMP/cas-c.out")
[[ "$cas_winners" == "1" ]] || fail "simultaneous CAS produced $cas_winners winners"
node -e 'const j=require(process.argv[1]);process.exit(j.generation===4?0:1)' "$CLAIM" || fail "simultaneous CAS generation"
ok "simultaneous compare-and-swap has exactly one winner"

# Restore A ownership and a valid graph for the cap test.
node -e 'const fs=require("fs");const p=process.argv[1];const j=JSON.parse(fs.readFileSync(p));j.session_id=process.argv[2];j.generation=5;j.started_at=new Date().toISOString();j.renewed_at=j.started_at;j.ttl_hours=24;delete j.released_at;fs.writeFileSync(p,JSON.stringify(j,null,2)+"\n")' "$CLAIM" "$SESSION_A"
node "$ROOT/hooks/lib/wi-claim.mjs" binding write --worktree-root "$REPO" --session-id "$SESSION_A" --wi WI-484 --role mutating >/dev/null
cat > "$REPO/.svc/lane-tasks-WI-484.json" <<'JSON'
{"wi":"WI-484","status":"completed","tasks":[{"id":1,"skill":"execute-changeset","status":"completed","subject":"fixture","metadata":{"skill":"execute-changeset"}}]}
JSON
rm -rf "$RUNTIME"
mkdir -m 700 -p "$RUNTIME"
run_guard "$SESSION_A" "$TMP/allow.out" "$TMP/allow.err"
! find "$RUNTIME" -type f -name pressure-count | grep -q . || fail "allow status consumed completion pressure"
ok "non-pressure status does not consume the pressure cap"

cat > "$REPO/.svc/lane-tasks-WI-484.json" <<'JSON'
{"wi":"WI-484","status":"in_progress","tasks":[{"id":1,"skill":"execute-changeset","status":"pending","subject":"fixture","metadata":{"skill":"execute-changeset"}}]}
JSON
rm -rf "$RUNTIME"
mkdir -m 700 -p "$RUNTIME"
for n in 1 2 3; do
  run_guard "$SESSION_A" "$TMP/cap-$n.out" "$TMP/cap-$n.err"
  grep -q '"decision":"block"' "$TMP/cap-$n.out" || fail "pressure $n should block"
done
run_guard "$SESSION_A" "$TMP/cap-4.out" "$TMP/cap-4.err"
! grep -q '"decision":"block"' "$TMP/cap-4.out" || fail "pressure cap did not release"
grep -q 'cap 3 reached' "$TMP/cap-4.err" || fail "cap was not clamped to three"
find "$RUNTIME/svc-completion-guard-$(id -u)" -type f -name pressure-count | grep -q . || fail "absolute runtime counter missing"
ok "completion pressure clamps at three in scoped runtime state"

rm -rf "$RUNTIME"
mkdir -m 700 -p "$RUNTIME"
run_guard "$SESSION_A" "$TMP/malformed-seed.out" "$TMP/malformed-seed.err"
MALFORMED_COUNTER=$(find "$RUNTIME" -type f -name pressure-count -print -quit)
[[ -n "$MALFORMED_COUNTER" ]] || fail "malformed counter fixture was not created"
printf '%s\n' "x[\$(touch $TMP/arithmetic-injection-ran)0]" > "$MALFORMED_COUNTER"
run_guard "$SESSION_A" "$TMP/malformed-counter.out" "$TMP/malformed-counter.err"
[[ ! -e "$TMP/arithmetic-injection-ran" ]] || fail "malformed pressure counter executed shell code"
grep -q 'runtime pressure counter is malformed' "$TMP/malformed-counter.err" || fail "malformed pressure counter lacked advisory"
for OCTALISH in 08 0777; do
  printf '%s\n' "$OCTALISH" > "$MALFORMED_COUNTER"
  run_guard "$SESSION_A" "$TMP/malformed-$OCTALISH.out" "$TMP/malformed-$OCTALISH.err"
  ! grep -q '"decision":"block"' "$TMP/malformed-$OCTALISH.out" || fail "octal-looking counter $OCTALISH entered pressure arithmetic"
  grep -q 'runtime pressure counter is malformed' "$TMP/malformed-$OCTALISH.err" || fail "octal-looking counter $OCTALISH lacked malformed advisory"
done
ok "malformed completion counter cannot enter Bash arithmetic evaluation"

SAFE_RUNTIME="$RUNTIME"
RUNTIME="$TMP/symlink-leaf-runtime"
mkdir -m 700 -p "$RUNTIME" "$TMP/attacker-counter-root"
ln -s "$TMP/attacker-counter-root" "$RUNTIME/svc-completion-guard-$(id -u)"
run_guard "$SESSION_A" "$TMP/insecure-counter.out" "$TMP/insecure-counter.err"
! grep -q '"decision":"block"' "$TMP/insecure-counter.out" || fail "insecure runtime counter root created pressure"
grep -q 'runtime counter root is insecure' "$TMP/insecure-counter.err" || fail "insecure runtime counter lacked advisory"
grep -q 'runtime leaf is not a real directory' "$TMP/insecure-counter.err" || fail "symlinked consumer leaf did not reach the leaf-level rejection"
! find "$TMP/attacker-counter-root" -type f | grep -q . || fail "insecure runtime counter wrote through attacker path"

RUNTIME="$TMP/insecure-parent-runtime"
mkdir -m 755 -p "$RUNTIME"
run_guard "$SESSION_A" "$TMP/insecure-parent.out" "$TMP/insecure-parent.err"
! grep -q '"decision":"block"' "$TMP/insecure-parent.out" || fail "unsafe runtime parent created pressure"
grep -q "unsafe mode 755: $RUNTIME" "$TMP/insecure-parent.err" || fail "unsafe-parent advisory discarded the resolver cause"
! grep -Eq 'resolve_runtime_leaf .*2>&1' "$ROOT/hooks/svc-task-completion-guard.sh" || fail "runtime resolver stdout and stderr are merged"
grep -q 'installed resolver is missing at.*rerun ./setup' "$ROOT/hooks/svc-task-completion-guard.sh" || fail "missing installed resolver lacks recovery"
RUNTIME="$SAFE_RUNTIME"
ok "foreign or symlinked runtime counter roots disable pressure"

# Concurrent renewals must leave valid JSON.
for n in $(seq 1 100); do
  node "$ROOT/hooks/lib/wi-claim.mjs" binding write --worktree-root "$REPO" --session-id "$SESSION_A" --wi WI-484 --role mutating >"$TMP/concurrent-$n.out" 2>"$TMP/concurrent-$n.err" &
done
wait
find "$REPO/.svc/bindings" "$REPO/.svc/claims" -type f -name '*.json' -print0 |
  xargs -0 -n1 node -e 'JSON.parse(require("fs").readFileSync(process.argv[1]))' || fail "concurrent state write corruption"
ok "simultaneous renewals preserve atomic JSON"

# The same mutating session cannot bind a sibling worktree.
git -C "$REPO" branch sibling
git -C "$REPO" worktree add -q "$TMP/sibling" sibling
mkdir -p "$TMP/sibling/.svc/claims" "$TMP/sibling/.svc/bindings"
if node "$ROOT/hooks/lib/wi-claim.mjs" binding write --worktree-root "$TMP/sibling" --session-id "$SESSION_A" --wi WI-999 --role mutating >/dev/null 2>&1; then
  fail "same session bound two worktrees"
fi
ok "one mutating session cannot bind two worktrees"

# Race a new session across two sibling worktrees. The repository-scoped
# runtime lock must serialize scan+write so exactly one worktree wins.
git -C "$REPO" branch sibling-two
git -C "$REPO" worktree add -q "$TMP/sibling-two" sibling-two
mkdir -p "$TMP/sibling-two/.svc/claims" "$TMP/sibling-two/.svc/bindings"
(node "$ROOT/hooks/lib/wi-claim.mjs" binding write --worktree-root "$TMP/sibling" --session-id "$SESSION_X" --wi WI-999 --role mutating >"$TMP/race-one.out" 2>"$TMP/race-one.err" || true) &
race_one=$!
(node "$ROOT/hooks/lib/wi-claim.mjs" binding write --worktree-root "$TMP/sibling-two" --session-id "$SESSION_X" --wi WI-998 --role mutating >"$TMP/race-two.out" 2>"$TMP/race-two.err" || true) &
race_two=$!
wait "$race_one" "$race_two"
race_winners=$(awk '/"ok": true/{n++} END{print n+0}' "$TMP/race-one.out" "$TMP/race-two.out")
[[ "$race_winners" == "1" ]] || fail "cross-worktree race produced $race_winners winners"
ok "simultaneous cross-worktree binding has exactly one winner"

git -C "$REPO" branch detached-fixture
git -C "$REPO" worktree add -q "$TMP/detached" detached-fixture
mkdir -p "$TMP/detached/.svc/claims" "$TMP/detached/.svc/bindings"
git -C "$TMP/detached" checkout -q --detach
if node "$ROOT/hooks/lib/wi-claim.mjs" binding write --worktree-root "$TMP/detached" --session-id "$SESSION_D" --role reviewer >/dev/null 2>&1; then
  fail "detached HEAD accepted as a binding authority"
fi
ok "detached HEAD cannot create a binding"

# WI-502 keeps v1 as an explicit compatibility bridge only. Exercise the public
# bootstrap entry point so an undefined variable or wiring regression cannot be
# hidden by source-only grep assertions.
MIG_REPO="$TMP/migration-repo"
mkdir -p "$MIG_REPO"
git -C "$MIG_REPO" init -q
git -C "$MIG_REPO" config user.name fixture
git -C "$MIG_REPO" config user.email fixture@example.test
printf 'fixture\n' > "$MIG_REPO/README.md"
printf '.worktrees/\n' > "$MIG_REPO/.gitignore"
git -C "$MIG_REPO" add README.md .gitignore
git -C "$MIG_REPO" commit -qm init
git -C "$MIG_REPO" update-ref refs/remotes/origin/main HEAD
(
  cd "$MIG_REPO"
  SVC_SESSION_ID="$SESSION_R" SVC_HOST=codex SVC_AUTHORITY_STATE_ROOT="$TMP/v2-authority" \
    node "$ROOT/scripts/svc-ensure-worktree.mjs" --wi WI-777 --branch framework-WI-777-v2 --authority-v2 --json
) > "$TMP/v2-bootstrap.json"
node -e '
const fs = require("fs");
const value = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
if (value.authority_v2?.lease?.schema_version !== 2) process.exit(1);
if (!fs.existsSync(value.authority_v2.receipt_path)) process.exit(2);
if (!fs.existsSync(value.authority_v2.backup_path)) process.exit(3);
' "$TMP/v2-bootstrap.json" || fail "explicit v2 bootstrap did not produce a lease and rollback receipt"
V2_WORKTREE="$(node -p 'require(process.argv[1]).absolute_worktree' "$TMP/v2-bootstrap.json")"
V2_GRAPH="$(node -p 'require(process.argv[1]).absolute_graph' "$TMP/v2-bootstrap.json")"
V2_LOADER_RUNTIME="$TMP/v2-loader-runtime"
mkdir -m 700 "$V2_LOADER_RUNTIME"
(
  cd "$V2_WORKTREE"
  CODEX_THREAD_ID="$SESSION_R" CODEX_SKILLS_DIR="$ROOT/skills" \
    SVC_AUTHORITY_STATE_ROOT="$TMP/v2-authority" SVC_CODEX_RUNTIME_DIR="$V2_LOADER_RUNTIME" \
    node "$ROOT/scripts/codex-load-skill.mjs" --graph "$V2_GRAPH" --task 1 --skill route-workflow --turn production-v2
) >/dev/null || fail "production loader did not consume controller-lease graph_path"
node -e '
const graph = require(process.argv[1]);
const task = graph.tasks.find((item) => String(item.id) === "1");
if (task?.status !== "in_progress" || task?.skill_receipt?.skill !== "route-workflow") process.exit(1);
' "$V2_GRAPH" || fail "production controller-lease loader did not activate the exact authority graph"
ok "production loader consumes controller-lease-v2 graph_path"
ok "v1 authority migration is explicit, behavioral, and rollback-capable"

echo "session-worktree binding: $PASS passed, 0 failed"
