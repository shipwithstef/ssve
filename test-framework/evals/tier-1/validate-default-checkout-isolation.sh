#!/usr/bin/env bash
set -euo pipefail

echo "=== Tier 1: Default-checkout isolation + residue-safe atomic bootstrap (WI-486) ==="

# WI-486 (task-3): the canonical bootstrap NO LONGER rejects a dirty/stale default
# checkout. Instead it is residue-safe (never touches unrelated tracked/untracked
# bytes), intent-anchored (marker written first), transactionally complete (graph +
# claim + binding under one lock), resumable, and selectively rolled back on any
# failpoint. This fixture proves SIB-09..18 against that behavior with temporary git
# repositories and local node only — zero network/model calls.

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
PASS=0

ok() { PASS=$((PASS + 1)); echo "  ✓ $1"; }
fail() { echo "  ✗ $1" >&2; exit 1; }

node --check "$ROOT/hooks/svc-worktree-isolation-guard.mjs"
node --check "$ROOT/scripts/svc-ensure-worktree.mjs"
node --check "$ROOT/hooks/lib/wi-claim.mjs"
bash -n "$ROOT/scripts/worktree.sh"
grep -q '^\.svc/bindings/$' "$ROOT/.gitignore" || fail "binding runtime is not ignored"
grep -q '^\.svc/bootstrap-intent/$' "$ROOT/.gitignore" || fail "bootstrap-intent runtime dir is not ignored"
ok "isolation sources parse and runtime binding + bootstrap-intent dirs are ignored"

REPO="$TMP/repo"
git -C "$TMP" init -q --bare origin.git
git -C "$TMP" clone -q "$TMP/origin.git" "$REPO"
git -C "$REPO" config user.name fixture
git -C "$REPO" config user.email fixture@example.test
git -C "$REPO" checkout -qb main
mkdir -p "$REPO/hooks/lib"
cp "$ROOT/hooks/lib/wi-claim.mjs" "$REPO/hooks/lib/wi-claim.mjs"
cp "$ROOT/hooks/lib/authoritative-binding.mjs" "$REPO/hooks/lib/authoritative-binding.mjs"
cp "$ROOT/hooks/lib/svc-runtime-root.mjs" "$REPO/hooks/lib/svc-runtime-root.mjs"
printf '.worktrees/\n.svc/claims/\n.svc/bindings/\n.svc/bootstrap-intent/\n' > "$REPO/.gitignore"
printf 'fixture\n' > "$REPO/README.md"
git -C "$REPO" add .
git -C "$REPO" commit -qm init
git -C "$REPO" push -qu origin main
git -C "$TMP/origin.git" symbolic-ref HEAD refs/heads/main

SESSION="019f6169-73d2-7831-b562-fc1565171ccc"
SESSION_B="019f616a-0000-7000-8000-00000000b002"
RUNTIME="$TMP/runtime"
mkdir -m 700 "$RUNTIME"

# --- Guard classification still governs reads/writes/override (unchanged) --------
node --input-type=module - "$ROOT" "$REPO" "$TMP" "$SESSION" "$RUNTIME" <<'NODE_CLASSIFY'
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
const [root, repo, temp, session, runtime] = process.argv.slice(2);
const guard = await import(pathToFileURL(path.join(root, "hooks/svc-worktree-isolation-guard.mjs")));
const call = (toolName, toolInput, cwd = repo) => ({ toolName, toolInput, cwd, sessionId: session, raw: { cwd, session_id: session } });
const env = { ...process.env, XDG_RUNTIME_DIR: runtime };
assert.equal(guard.classifyMutation(call("Bash", { command: "git status" }), env).allow, true);
assert.equal(guard.classifyMutation(call("Write", { file_path: "docs/new.md" }), env).allow, false);
assert.equal(guard.classifyMutation(call("Edit", { file_path: "README.md" }), env).allow, false);
assert.equal(guard.classifyMutation(call("Bash", { command: "git status && touch generated.txt" }), env).allow, false);
assert.equal(guard.classifyMutation(call("Bash", { command: "node scripts/svc-ensure-worktree.mjs --wi WI-482 --branch framework-WI-482-test --from origin/main --json" }), env).classification, "bootstrap-isolation");
NODE_CLASSIFY
ok "read/mutation/bootstrap classification unchanged"

# --- SIB-09/10/14/16: complete tuple, result fields, resume, residue safety ------
node --input-type=module - "$ROOT" "$REPO" "$SESSION" "$RUNTIME" <<'NODE_TX'
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
const [root, repo, session, runtime] = process.argv.slice(2);
const helper = await import(pathToFileURL(path.join(root, "scripts/svc-ensure-worktree.mjs")));
const claims = await import(pathToFileURL(path.join(root, "hooks/lib/wi-claim.mjs")));
const env = { ...process.env, SVC_SESSION_ID: session, XDG_RUNTIME_DIR: runtime };
const sha = (p) => execFileSync("sha256sum", [p], { encoding: "utf8" }).split(" ")[0];

// SIB-09/10 — one command yields the complete tuple and all result fields.
const branch = "framework-WI-482-test";
const first = helper.ensureWorktree({ cwd: repo, wi: "WI-482", branch, from: "origin/main" }, env);
assert.equal(first.created, true, "first bootstrap creates");
assert.equal(first.resumed, false);
assert.equal(first.absolute_worktree, path.join(repo, ".worktrees", branch));
assert.ok(first.absolute_graph.endsWith(`/.worktrees/${branch}/.svc/lane-tasks-WI-482.json`), "absolute_graph present");
assert.equal(first.owner_session, session);
assert.ok(Number.isInteger(first.claim_generation) && first.claim_generation >= 1, "claim_generation present");
assert.equal(fs.existsSync(first.absolute_graph), true, "initial graph created");
assert.equal(fs.existsSync(path.join(repo, ".svc", "bootstrap-intent", "WI-482.json")), false, "intent marker removed on success");
const binding = claims.readSessionBinding(first.absolute_worktree, session);
assert.equal(binding.wi, "WI-482");

// SIB-14 — exact same-session replay resumes unchanged.
const second = helper.ensureWorktree({ cwd: repo, wi: "WI-482", branch, from: "origin/main" }, env);
assert.equal(second.created, false, "resume does not recreate");
assert.equal(second.resumed, true, "resume flagged");
assert.equal(second.absolute_worktree, first.absolute_worktree);

// SIB-16 — unrelated dirty tracked + untracked default-checkout bytes are byte-identical across a DIFFERENT-WI bootstrap.
fs.appendFileSync(path.join(repo, "README.md"), "user residue line\n");
fs.writeFileSync(path.join(repo, "untracked-residue.txt"), "untracked user bytes\n");
const trackedBefore = sha(path.join(repo, "README.md"));
const untrackedBefore = sha(path.join(repo, "untracked-residue.txt"));
// A different session bootstraps a different WI independently (SIB-18): one
// mutating session owns exactly one worktree, so a distinct WI needs a distinct session.
const otherEnv = { ...env, SVC_SESSION_ID: "019f616a-0000-7000-8000-00000000c777" };
const other = helper.ensureWorktree({ cwd: repo, wi: "WI-777", branch: "framework-WI-777-other", from: "origin/main" }, otherEnv);
assert.equal(other.created, true, "different WI bootstraps independently (SIB-18)");
assert.equal(sha(path.join(repo, "README.md")), trackedBefore, "tracked residue unchanged (SIB-16)");
assert.equal(sha(path.join(repo, "untracked-residue.txt")), untrackedBefore, "untracked residue unchanged (SIB-16)");
// restore checkout for downstream steps
execFileSync("git", ["-C", repo, "checkout", "--", "README.md"]);
fs.rmSync(path.join(repo, "untracked-residue.txt"), { force: true });
NODE_TX
ok "complete tuple + result fields, same-session resume, residue-safe different-WI bootstrap"

# --- SIB-12/13: selective rollback at a recorded failpoint leaves no artifact ----
node --input-type=module - "$ROOT" "$REPO" "$SESSION" "$RUNTIME" <<'NODE_FP'
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
const [root, repo, session, runtime] = process.argv.slice(2);
const helper = await import(pathToFileURL(path.join(root, "scripts/svc-ensure-worktree.mjs")));
const wt = path.join(repo, ".worktrees", "framework-WI-888-fp");
for (const point of ["after-worktree", "after-graph", "before-binding"]) {
  const env = { ...process.env, SVC_SESSION_ID: session, XDG_RUNTIME_DIR: runtime, SVC_ENSURE_FAILPOINT: point };
  assert.throws(() => helper.ensureWorktree({ cwd: repo, wi: "WI-888", branch: "framework-WI-888-fp", from: "origin/main" }, env), /injected failpoint/);
  assert.equal(fs.existsSync(wt), false, `${point}: worktree removed`);
  assert.equal(fs.existsSync(path.join(repo, ".svc", "bootstrap-intent", "WI-888.json")), false, `${point}: intent marker removed`);
  assert.equal(fs.existsSync(path.join(repo, ".svc", "claims", "WI-888.claim.json")), false, `${point}: no claim residue`);
  const branches = execFileSync("git", ["-C", repo, "branch", "--list", "framework-WI-888-fp"], { encoding: "utf8" }).trim();
  assert.equal(branches, "", `${point}: branch fully deleted`);
}
NODE_FP
ok "every recorded failpoint rolls back only the artifacts this attempt created"

# --- SIB-15: a foreign LIVE partial (intent marker) conflicts, never repaired/deleted;
#            a STALE partial with a dead owner is reclaimed under the subset backstop.
node --input-type=module - "$ROOT" "$REPO" "$SESSION" "$RUNTIME" <<'NODE_PARTIAL'
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
const [root, repo, session, runtime] = process.argv.slice(2);
const helper = await import(pathToFileURL(path.join(root, "scripts/svc-ensure-worktree.mjs")));
const claims = await import(pathToFileURL(path.join(root, "hooks/lib/wi-claim.mjs")));
const intentDir = path.join(repo, ".svc", "bootstrap-intent");
fs.mkdirSync(intentDir, { recursive: true, mode: 0o700 });

// Foreign LIVE marker (this test process is alive; token matches) => actionable conflict.
const liveMarker = path.join(intentDir, "WI-889.json");
fs.writeFileSync(liveMarker, JSON.stringify({
  schema_version: 1, session_id: "019f6169-0000-7000-8000-0000000abcde", owner_token: "deadbeef",
  pid: process.pid, process_start_token: claims.processStartToken(process.pid), hostname: os.hostname(),
  wi: "WI-889", branch: "framework-WI-889-partial", target_worktree: path.join(repo, ".worktrees", "framework-WI-889-partial"),
  base_sha: "0".repeat(40), created_paths: [], started_at: new Date().toISOString(), renewed_at: new Date().toISOString(),
}) + "\n", { mode: 0o600 });
const env = { ...process.env, SVC_SESSION_ID: session, XDG_RUNTIME_DIR: runtime };
assert.throws(() => helper.ensureWorktree({ cwd: repo, wi: "WI-889", branch: "framework-WI-889-partial", from: "origin/main" }, env), /conflict/i);
assert.equal(fs.existsSync(liveMarker), true, "live foreign partial marker is never deleted");

// STALE marker (dead pid, empty ledger) => reclaimed, then a fresh bootstrap succeeds.
const staleMarker = path.join(intentDir, "WI-890.json");
fs.writeFileSync(staleMarker, JSON.stringify({
  schema_version: 1, session_id: "019f6169-0000-7000-8000-0000000fffff", owner_token: "cafef00d",
  pid: 2147480000, process_start_token: `${os.hostname()}:2147480000:1`, hostname: os.hostname(),
  wi: "WI-890", branch: "framework-WI-890-stale", target_worktree: path.join(repo, ".worktrees", "framework-WI-890-stale"),
  base_sha: "0".repeat(40), created_paths: [], started_at: new Date(0).toISOString(), renewed_at: new Date(0).toISOString(),
}) + "\n", { mode: 0o600 });
const env890 = { ...env, SVC_SESSION_ID: "019f616a-0000-7000-8000-00000000d890" };
const reclaimed = helper.ensureWorktree({ cwd: repo, wi: "WI-890", branch: "framework-WI-890-stale", from: "origin/main" }, env890);
assert.equal(reclaimed.created, true, "stale partial reclaimed and bootstrap completes");
assert.equal(fs.existsSync(staleMarker), false, "stale marker removed after reclaim + success");
NODE_PARTIAL
ok "foreign live partial conflicts (kept); stale dead-owner partial reclaims under the subset backstop"

# --- SIB-11/12: same-WI concurrent bootstrap => exactly one complete winner -------
# The CLI resolves the repository from its cwd, so each racer runs INSIDE $REPO.
# BOTH racers use FRESH sessions bound to nothing else, so whichever wins the repo
# lock can complete — proving one complete winner and one clean loser under the lock.
RACE_A="019f616a-0000-7000-8000-000000009a01"
RACE_B="019f616a-0000-7000-8000-000000009b01"
race_one="$TMP/race-1.out"; race_two="$TMP/race-2.out"
( cd "$REPO" && SVC_SESSION_ID="$RACE_A" XDG_RUNTIME_DIR="$RUNTIME" node "$ROOT/scripts/svc-ensure-worktree.mjs" --wi WI-901 --branch framework-WI-901-race --from origin/main --json >"$race_one" 2>"$TMP/race-1.err" || true ) &
p1=$!
( cd "$REPO" && SVC_SESSION_ID="$RACE_B" XDG_RUNTIME_DIR="$RUNTIME" node "$ROOT/scripts/svc-ensure-worktree.mjs" --wi WI-901 --branch framework-WI-901-race --from origin/main --json >"$race_two" 2>"$TMP/race-2.err" || true ) &
p2=$!
wait "$p1" || true
wait "$p2" || true
WINNERS=$(cat "$race_one" "$race_two" 2>/dev/null | grep -c '"created":true' || true)
if [[ "$WINNERS" != "1" ]]; then
  echo "DEBUG a.out=[$(cat "$race_one")] a.err=[$(cat "$TMP/race-1.err")]" >&2
  echo "DEBUG b.out=[$(cat "$race_two")] b.err=[$(cat "$TMP/race-2.err")]" >&2
  fail "same-WI race produced $WINNERS complete winners (expected 1)"
fi
LINKED=$(git -C "$REPO" worktree list --porcelain | grep -c '^worktree .*framework-WI-901-race$' || true)
[[ "$LINKED" == "1" ]] || fail "same-WI race left $LINKED linked worktrees (expected 1)"
ok "same-WI concurrent bootstrap has exactly one complete winner and one clean loser"

# --- Downstream: linked worktree commit gate + wrapper delegation (unchanged) -----
(cd "$REPO/.worktrees/framework-WI-482-test" && SVC_SESSION_ID="$SESSION" XDG_RUNTIME_DIR="$RUNTIME" node "$ROOT/hooks/svc-worktree-isolation-guard.mjs" --check-default-commit >/dev/null)
ok "linked bound worktree commit gate accepts the owning session"

! rg -q '(./setup|scripts/worktree\.sh)' "$ROOT/scripts/svc-ensure-worktree.mjs" || fail "ensure helper delegates to setup/worktree wrapper"
grep -q 'svc-ensure-worktree.mjs' "$ROOT/scripts/worktree.sh" || fail "worktree create does not delegate"
grep -q 'Owner:' "$ROOT/scripts/worktree.sh" || fail "status omits owner"
grep -q 'WI:' "$ROOT/scripts/worktree.sh" || fail "status omits WI"
ok "worktree wrapper delegates lifecycle and reports binding identity"

for wirer in wire-hooks wire-codex-hooks wire-kimi-hooks wire-gemini-hooks; do
  grep -q 'svc-worktree-isolation-guard' "$ROOT/scripts/$wirer.mjs" || fail "$wirer lacks isolation guard"
done
grep -q -- '--check-default-commit' "$ROOT/hooks/git/pre-commit.d/10-default-checkout-isolation" || fail "universal pre-commit slot lacks isolation gate"
ok "supported hosts wire isolation first and universal pre-commit closes host gaps"

# --- WI-486 EXEC-005: per-(repo,WI) bootstrap lock — reclaim a DEAD holder, never
#     steal a LIVE one, and keep different WIs independently bootstrappable. -------
node --input-type=module - "$ROOT" "$REPO" "$RUNTIME" <<'NODE_LOCK'
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
const [root, repoArg, runtime] = process.argv.slice(2);
const repo = fs.realpathSync(repoArg);
const helper = await import(pathToFileURL(path.join(root, "scripts/svc-ensure-worktree.mjs")));
const claims = await import(pathToFileURL(path.join(root, "hooks/lib/wi-claim.mjs")));
const env = { ...process.env, XDG_RUNTIME_DIR: runtime };
const git = (args, input) => execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", input, stdio: [input === undefined ? "ignore" : "pipe", "pipe", "ignore"] }).trim();
const seedLock = (ref, holder) => {
  const oid = git(["hash-object", "-w", "--stdin"], `${JSON.stringify(holder)}\n`);
  git(["update-ref", ref, oid]);
  return oid;
};
const hasLock = (ref) => { try { git(["rev-parse", "--verify", ref]); return true; } catch { return false; } };

// A DEAD-holder lock must be reclaimed — a crashed bootstrap can never wedge the repo forever.
const deadWi = "WI-905";
const deadLock = helper.lockPathFor(repo, deadWi, env);
seedLock(deadLock, { schema_version: 1, hostname: os.hostname(), pid: 2147480000, process_start_token: `${os.hostname()}:2147480000:1`, lock_token: "dead-fixture", ts: new Date().toISOString() });
const reclaimed = helper.ensureWorktree({ cwd: repo, wi: deadWi, branch: "framework-WI-905-deadlock", from: "origin/main" }, { ...env, SVC_SESSION_ID: "019f616a-0000-7000-8000-00000000e905" });
assert.equal(reclaimed.created, true, "dead-holder lock reclaimed; bootstrap completes");
assert.equal(hasLock(deadLock), false, "reclaimed lock released after completion");

// A LIVE-holder lock (this very process) must NEVER be stolen.
const liveWi = "WI-906";
const liveLock = helper.lockPathFor(repo, liveWi, env);
const liveOid = seedLock(liveLock, { schema_version: 1, hostname: os.hostname(), pid: process.pid, process_start_token: claims.processStartToken(process.pid), lock_token: "live-fixture", ts: new Date().toISOString() });
assert.throws(() => helper.ensureWorktree({ cwd: repo, wi: liveWi, branch: "framework-WI-906-livelock", from: "origin/main" }, { ...env, SVC_SESSION_ID: "019f616a-0000-7000-8000-00000000e906" }), /already in progress/, "live-holder lock blocks");
assert.equal(hasLock(liveLock), true, "live holder lock is never stolen");
git(["update-ref", "-d", liveLock, liveOid]);

// Different WIs use different lock keys (independent locks).
assert.notEqual(helper.lockPathFor(repo, "WI-1", env), helper.lockPathFor(repo, "WI-2", env), "per-WI lock keys are distinct");
NODE_LOCK
ok "per-WI bootstrap lock reclaims a dead holder, never steals a live one, keeps WIs independent (EXEC-005)"

# --- WI-486 EXEC-002/003: crash-after-worktree forward-completes; a stale marker
#     never deletes an out-of-worktree path; removeCreatedPaths honors containment.
node --input-type=module - "$ROOT" "$REPO" "$RUNTIME" <<'NODE_CRASH'
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
const [root, repoArg, runtime] = process.argv.slice(2);
const repo = fs.realpathSync(repoArg);
const helper = await import(pathToFileURL(path.join(root, "scripts/svc-ensure-worktree.mjs")));
const claims = await import(pathToFileURL(path.join(root, "hooks/lib/wi-claim.mjs")));
const env = { ...process.env, XDG_RUNTIME_DIR: runtime };
const git = (args) => execFileSync("git", ["-C", repo, ...args], { encoding: "utf8" }).trim();
const base = git(["rev-parse", "origin/main"]);

// EXEC-002: hard crash AFTER worktree+graph, BEFORE binding/claim. The SAME
// session must forward-complete (recordIntent each missing artifact) and drop the
// marker only after the complete tuple is verified — never route to resumeExisting.
const wi = "WI-902", branch = "framework-WI-902-crash", sess = "019f616a-0000-7000-8000-00000000e902";
const wt = path.join(repo, ".worktrees", branch);
git(["worktree", "add", "-q", wt, "-b", branch, base]);
fs.mkdirSync(path.join(wt, ".svc", "claims"), { recursive: true });
fs.mkdirSync(path.join(wt, ".svc", "bindings"), { recursive: true });
const graphP = path.join(wt, ".svc", `lane-tasks-${wi}.json`);
fs.writeFileSync(graphP, JSON.stringify({ schema_version: 1, wi, lane: "framework", status: "in_progress", tasks: [{ id: "task-1", status: "pending", skill: "route-workflow", subject: "x", blocked_by: [] }] }, null, 2) + "\n");
const markerP = path.join(repo, ".svc", "bootstrap-intent", `${wi}.json`);
fs.mkdirSync(path.dirname(markerP), { recursive: true, mode: 0o700 });
fs.writeFileSync(markerP, JSON.stringify({ schema_version: 1, session_id: sess, owner_token: "aa", pid: process.pid, process_start_token: claims.processStartToken(process.pid), hostname: os.hostname(), wi, branch, target_worktree: wt, base_sha: base, created_paths: [wt, graphP], started_at: new Date().toISOString(), renewed_at: new Date().toISOString() }, null, 2) + "\n", { mode: 0o600 });
const done = helper.ensureWorktree({ cwd: repo, wi, branch, from: "origin/main" }, { ...env, SVC_SESSION_ID: sess });
assert.equal(done.resumed, true, "EXEC-002: crashed same-session bootstrap forward-completes");
assert.equal(fs.existsSync(markerP), false, "EXEC-002: marker removed only after the complete tuple");
const binding = claims.readSessionBinding(wt, sess);
assert.ok(binding && !binding.released_at && binding.wi === wi, "EXEC-002: binding forward-completed");
assert.ok(fs.existsSync(path.join(wt, ".svc", "claims", `${wi}.claim.json`)), "EXEC-002: claim forward-completed");
assert.ok(fs.existsSync(graphP), "EXEC-002: pre-existing graph preserved");

// EXEC-003: a STALE (dead-owner) marker whose ledger lists an OUT-OF-WORKTREE path
// is an ambiguous CONFLICT — the bootstrap refuses and deletes nothing.
const wi3 = "WI-903", branch3 = "framework-WI-903-evil";
const wt3 = path.join(repo, ".worktrees", branch3);
const sentinel = path.join(runtime, "external-sentinel.txt");
fs.writeFileSync(sentinel, "do-not-delete\n");
const marker3 = path.join(repo, ".svc", "bootstrap-intent", `${wi3}.json`);
fs.writeFileSync(marker3, JSON.stringify({ schema_version: 1, session_id: "019f616a-0000-7000-8000-00000000e903", owner_token: "bb", pid: 2147480000, process_start_token: `${os.hostname()}:2147480000:1`, hostname: os.hostname(), wi: wi3, branch: branch3, target_worktree: wt3, base_sha: base, created_paths: [sentinel], started_at: new Date(0).toISOString(), renewed_at: new Date(0).toISOString() }, null, 2) + "\n", { mode: 0o600 });
assert.throws(() => helper.ensureWorktree({ cwd: repo, wi: wi3, branch: branch3, from: "origin/main" }, { ...env, SVC_SESSION_ID: "019f616a-0000-7000-8000-00000000e999" }), /conflict/i, "EXEC-003: out-of-worktree ledger entry is an ambiguous conflict");
assert.equal(fs.existsSync(sentinel), true, "EXEC-003: external path is never deleted");

// EXEC-003: removeCreatedPaths refuses to escape its containment root.
const contRoot = path.join(runtime, "contain-root");
fs.mkdirSync(contRoot, { recursive: true });
const inside = path.join(contRoot, "inside.txt"); fs.writeFileSync(inside, "x");
const outside = path.join(runtime, "outside.txt"); fs.writeFileSync(outside, "y");
const removed = claims.removeCreatedPaths([inside, outside], { containmentRoot: contRoot });
assert.equal(fs.existsSync(inside), false, "EXEC-003: contained path removed");
assert.equal(fs.existsSync(outside), true, "EXEC-003: out-of-root path skipped");
assert.ok(!removed.includes(path.resolve(outside)), "EXEC-003: out-of-root path never reported removed");
NODE_CRASH
ok "crash-after-worktree forward-completes; stale marker never deletes out-of-worktree paths (EXEC-002/003)"

# --- WI-486 EXEC-R2-001: two-phase stale reclaim VALIDATES everything before it
#     deletes anything, and refuses a worktree carrying tracked-modified/untracked
#     files this bootstrap did not create. EXEC-R2-004: forwardComplete re-resolves
#     the FULL tuple through the shared resolver and RETAINS the marker on mismatch.
node --input-type=module - "$ROOT" "$REPO" "$RUNTIME" <<'NODE_R2'
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
const [root, repoArg, runtime] = process.argv.slice(2);
const repo = fs.realpathSync(repoArg);
const helper = await import(pathToFileURL(path.join(root, "scripts/svc-ensure-worktree.mjs")));
const claims = await import(pathToFileURL(path.join(root, "hooks/lib/wi-claim.mjs")));
const env = { ...process.env, XDG_RUNTIME_DIR: runtime };
const git = (args) => execFileSync("git", ["-C", repo, ...args], { encoding: "utf8" }).trim();
const base = git(["rev-parse", "origin/main"]);

// --- EXEC-R2-001: build a REGISTERED worktree + stale (dead-owner) marker ---
const wi = "WI-921", branch = "framework-WI-921-reclaim";
const wt = path.join(repo, ".worktrees", branch);
git(["worktree", "add", "-q", wt, "-b", branch, base]);
fs.mkdirSync(path.join(wt, ".svc", "claims"), { recursive: true });
fs.mkdirSync(path.join(wt, ".svc", "bindings"), { recursive: true });
const graphP = path.join(wt, ".svc", `lane-tasks-${wi}.json`);
fs.writeFileSync(graphP, JSON.stringify({ schema_version: 1, wi, lane: "framework", status: "in_progress", tasks: [{ id: "task-1", status: "pending", skill: "route-workflow", subject: "x", blocked_by: [] }] }, null, 2) + "\n");
const markerP = path.join(repo, ".svc", "bootstrap-intent", `${wi}.json`);
fs.mkdirSync(path.dirname(markerP), { recursive: true, mode: 0o700 });
fs.writeFileSync(markerP, JSON.stringify({ schema_version: 1, session_id: "019f616a-0000-7000-8000-000000009921", owner_token: "aa", pid: 2147480000, process_start_token: `${os.hostname()}:2147480000:1`, hostname: os.hostname(), wi, branch, target_worktree: wt, base_sha: base, created_paths: [wt, graphP], started_at: new Date(0).toISOString(), renewed_at: new Date(0).toISOString() }, null, 2) + "\n", { mode: 0o600 });
const marker = JSON.parse(fs.readFileSync(markerP, "utf8"));

// (1) an UNTRACKED non-ledger file (real work) => refuse, delete NOTHING.
const evil = path.join(wt, "user-work.txt");
fs.writeFileSync(evil, "real work\n");
assert.throws(() => helper.reclaimStaleMarker(repo, wi, branch, wt, marker, markerP), /conflict/i, "untracked-dirty worktree refuses reclaim");
assert.equal(fs.existsSync(wt), true, "EXEC-R2-001: untracked-dirty worktree NOT deleted");
assert.equal(fs.existsSync(evil), true, "EXEC-R2-001: user file NOT deleted");
assert.equal(fs.existsSync(markerP), true, "EXEC-R2-001: marker retained on conflict");
fs.rmSync(evil, { force: true });

// (2) a TRACKED modification => refuse, delete NOTHING.
fs.appendFileSync(path.join(wt, "README.md"), "tracked edit\n");
assert.throws(() => helper.reclaimStaleMarker(repo, wi, branch, wt, marker, markerP), /conflict/i, "tracked-modified worktree refuses reclaim");
assert.equal(fs.existsSync(wt), true, "EXEC-R2-001: tracked-dirty worktree NOT deleted");
execFileSync("git", ["-C", wt, "checkout", "--", "README.md"]);

// (3) branch ADVANCED past base => refused in PHASE 1, BEFORE any deletion (the
//     exact ordering bug: the old code ran `worktree remove --force` first).
execFileSync("git", ["-C", wt, "commit", "-q", "--allow-empty", "-m", "advance"]);
assert.throws(() => helper.reclaimStaleMarker(repo, wi, branch, wt, marker, markerP), /advanced past the recorded base/i, "advanced branch refuses reclaim");
assert.equal(fs.existsSync(wt), true, "EXEC-R2-001: advanced-branch worktree NOT deleted (validate-before-delete)");
execFileSync("git", ["-C", wt, "reset", "-q", "--hard", base]);

// (3b) EXEC-R3-002: a NON-ledger file under a GITIGNORED path (invisible to a plain
//      `git status --porcelain`) must ALSO refuse reclaim — otherwise it would be
//      force-deleted with the worktree, breaking the "every non-ledger untracked
//      file blocks deletion" guarantee. `.svc/claims/` is gitignored in this repo.
const ignoredEvil = path.join(wt, ".svc", "claims", "user-ignored.txt");
fs.writeFileSync(ignoredEvil, "gitignored user state\n");
// Prove the file really is gitignored (so a plain status would NOT surface it).
assert.equal(execFileSync("git", ["-C", wt, "check-ignore", ".svc/claims/user-ignored.txt"], { encoding: "utf8" }).trim(), ".svc/claims/user-ignored.txt", "EXEC-R3-002: fixture file is gitignored");
assert.throws(() => helper.reclaimStaleMarker(repo, wi, branch, wt, marker, markerP), /conflict/i, "gitignored non-ledger file refuses reclaim");
assert.equal(fs.existsSync(wt), true, "EXEC-R3-002: worktree with a gitignored non-ledger file NOT deleted");
assert.equal(fs.existsSync(ignoredEvil), true, "EXEC-R3-002: gitignored user file NOT deleted");
assert.equal(fs.existsSync(markerP), true, "EXEC-R3-002: marker retained on gitignored-file conflict");
fs.rmSync(ignoredEvil, { force: true });

// (4) CLEAN (only bootstrap ledger artifacts) => reclaim SUCCEEDS, everything gone.
helper.reclaimStaleMarker(repo, wi, branch, wt, marker, markerP);
assert.equal(fs.existsSync(wt), false, "EXEC-R2-001: clean worktree reclaimed");
assert.equal(fs.existsSync(markerP), false, "EXEC-R2-001: marker removed after clean reclaim");
assert.equal(execFileSync("git", ["-C", repo, "branch", "--list", branch], { encoding: "utf8" }).trim(), "", "EXEC-R2-001: branch deleted after clean reclaim");

// --- EXEC-R2-004: same-session forward-complete with a MALFORMED pre-existing
//     graph => the shared resolver returns a non-owned tuple => marker RETAINED. ---
const wi4 = "WI-922", branch4 = "framework-WI-922-fwd", sess4 = "019f616a-0000-7000-8000-000000009922";
const wt4 = path.join(repo, ".worktrees", branch4);
git(["worktree", "add", "-q", wt4, "-b", branch4, base]);
fs.mkdirSync(path.join(wt4, ".svc", "claims"), { recursive: true });
fs.mkdirSync(path.join(wt4, ".svc", "bindings"), { recursive: true });
const graphP4 = path.join(wt4, ".svc", `lane-tasks-${wi4}.json`);
fs.writeFileSync(graphP4, JSON.stringify({ schema_version: 1, wi: wi4, lane: "framework", status: "in_progress", tasks: [{ id: "task-1", status: "frobnicate", skill: "route-workflow", subject: "x" }] }) + "\n");
const markerP4 = path.join(repo, ".svc", "bootstrap-intent", `${wi4}.json`);
fs.writeFileSync(markerP4, JSON.stringify({ schema_version: 1, session_id: sess4, owner_token: "aa", pid: process.pid, process_start_token: claims.processStartToken(process.pid), hostname: os.hostname(), wi: wi4, branch: branch4, target_worktree: wt4, base_sha: base, created_paths: [wt4, graphP4], started_at: new Date().toISOString(), renewed_at: new Date().toISOString() }, null, 2) + "\n", { mode: 0o600 });
assert.throws(() => helper.ensureWorktree({ cwd: repo, wi: wi4, branch: branch4, from: "origin/main" }, { ...env, SVC_SESSION_ID: sess4 }), /verification failed|marker retained/i, "forwardComplete refuses on tuple mismatch");
assert.equal(fs.existsSync(markerP4), true, "EXEC-R2-004: intent marker RETAINED on tuple mismatch");
NODE_R2
ok "two-phase reclaim refuses dirty/advanced worktrees and deletes nothing; forwardComplete retains marker on tuple mismatch (EXEC-R2-001/004)"

# --- WI-486 EXEC-R3-003: the same-session RESUME exit is verified through the SHARED
#     authority resolver (verifyCompleteTuple), exactly like create/forward-complete.
#     A clean resume still succeeds (no self-lock); a resume whose on-disk graph was
#     corrupted to an UNKNOWN status FAILS instead of reporting a complete tuple. -----
node --input-type=module - "$ROOT" "$REPO" "$RUNTIME" <<'NODE_R3'
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
const [root, repoArg, runtime] = process.argv.slice(2);
const repo = fs.realpathSync(repoArg);
const helper = await import(pathToFileURL(path.join(root, "scripts/svc-ensure-worktree.mjs")));
const wi = "WI-923", branch = "framework-WI-923-resume", sess = "019f616a-0000-7000-8000-000000009923";
const senv = { ...process.env, SVC_SESSION_ID: sess, XDG_RUNTIME_DIR: runtime };

// Fresh bootstrap, then a CLEAN same-session resume MUST still succeed (no self-lock).
const first = helper.ensureWorktree({ cwd: repo, wi, branch, from: "origin/main" }, senv);
assert.equal(first.created, true, "EXEC-R3-003: fresh bootstrap creates");
// The placeholder task id must be a NUMBER (task-graph.mjs write-time compatibility).
const placeholder = JSON.parse(fs.readFileSync(first.absolute_graph, "utf8"));
assert.equal(typeof placeholder.tasks[0].id, "number", "EXEC-R3-001: placeholder task id is numeric (task-graph-compatible)");
const clean = helper.ensureWorktree({ cwd: repo, wi, branch, from: "origin/main" }, senv);
assert.equal(clean.resumed === true && clean.created === false, true, "EXEC-R3-003: clean resume succeeds through verifyCompleteTuple");

// Corrupt the on-disk graph to an UNKNOWN task status. The shared resolver denies a
// malformed graph, so the resume MUST fail rather than report a complete tuple.
const good = fs.readFileSync(first.absolute_graph, "utf8");
const corrupt = JSON.parse(good);
corrupt.tasks[0].status = "frobnicate";
fs.writeFileSync(first.absolute_graph, JSON.stringify(corrupt, null, 2) + "\n");
assert.throws(() => helper.ensureWorktree({ cwd: repo, wi, branch, from: "origin/main" }, senv), /verification failed|malformed|ownership retained/i, "EXEC-R3-003: resume over a corrupted graph FAILS");
assert.equal(fs.existsSync(first.absolute_worktree), true, "EXEC-R3-003: worktree retained on failed resume (owner-safe)");

// Restore the graph -> resume succeeds again (the failure was the corruption, NOT a self-lock).
fs.writeFileSync(first.absolute_graph, good);
const after = helper.ensureWorktree({ cwd: repo, wi, branch, from: "origin/main" }, senv);
assert.equal(after.resumed, true, "EXEC-R3-003: resume succeeds again once the graph is well-formed");
NODE_R3
ok "resume is authority-verified: clean resume succeeds, corrupted-graph resume fails, placeholder id is numeric (EXEC-R3-003/001)"

# --- WI-505: a stale FOREIGN complete claim-v1 tuple is reclaimed through the
#     public bootstrap path. Fresh, mismatched, ambiguous, symlinked, and v2
#     authority still fail closed; the generation CAS has one winner; a durable
#     post-CAS crash state forward-completes without gen3; user bytes survive. ---
node --input-type=module - "$ROOT" "$REPO" "$TMP" "$RUNTIME" <<'NODE_WI505'
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const [root, repoArg, temp, runtime] = process.argv.slice(2);
const repo = fs.realpathSync(repoArg);
const helper = await import(pathToFileURL(path.join(root, "scripts/svc-ensure-worktree.mjs")));
const claims = await import(pathToFileURL(path.join(root, "hooks/lib/wi-claim.mjs")));
const resolver = await import(pathToFileURL(path.join(root, "hooks/lib/resolve-wi.mjs")));
const store = await import(pathToFileURL(path.join(root, "hooks/lib/authority-store.mjs")));
const sid = (n) => `019f8308-97bf-75e1-b71e-${Number(n).toString(16).padStart(12, "0")}`;
const json = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const writeJson = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  fs.chmodSync(file, 0o600);
};
const sha = (file) => execFileSync("sha256sum", [file], { encoding: "utf8" }).split(" ")[0];
const envFor = (session, extra = {}) => ({ ...process.env, SVC_SESSION_ID: session, XDG_RUNTIME_DIR: runtime, ...extra });
const ensure = (wi, branch, session, extra = {}) => helper.ensureWorktree(
  { cwd: repo, wi, branch, from: "origin/main" },
  envFor(session, extra),
);
const makeTuple = (number, session) => {
  const wi = `WI-${number}`;
  const branch = `framework-WI-${number}-tuple`;
  const first = ensure(wi, branch, session);
  const bindingPath = claims.bindingPath(first.absolute_worktree, session);
  const binding = json(bindingPath);
  return { wi, branch, first, worktree: first.absolute_worktree, claimPath: binding.claim_path, bindingPath };
};
const makeStale = (tuple) => {
  const claim = json(tuple.claimPath);
  delete claim.released_at;
  claim.hostname = os.hostname();
  claim.pid = 2147483647;
  claim.process_start_token = `${os.hostname()}:2147483647:dead`;
  claim.renewed_at = new Date().toISOString();
  writeJson(tuple.claimPath, claim);
  assert.equal(claims.claimFreshness(json(tuple.claimPath), tuple.claimPath).stale, true, `${tuple.wi}: positive dead-PID stale proof`);
};
const directoryDigest = (dir) => {
  if (!fs.existsSync(dir)) return "absent";
  const rows = [];
  const walk = (current) => {
    for (const name of fs.readdirSync(current).sort()) {
      const file = path.join(current, name);
      const stat = fs.lstatSync(file);
      if (stat.isDirectory()) walk(file);
      else rows.push(`${path.relative(dir, file)}:${sha(file)}`);
    }
  };
  walk(dir);
  return rows.join("\n");
};

// Stale complete tuple A/gen1 -> B/gen2 through the PUBLIC ensure path. Dirty
// tracked, untracked, and ignored files plus graph/Git identity remain intact.
const staleA = sid(0x930a), staleB = sid(0x930b);
const staleTuple = makeTuple(930, staleA);
makeStale(staleTuple);
fs.appendFileSync(path.join(staleTuple.worktree, "README.md"), "tracked WI-505 user bytes\n");
fs.writeFileSync(path.join(staleTuple.worktree, "user-untracked.txt"), "untracked WI-505 user bytes\n");
const ignoredUser = path.join(staleTuple.worktree, ".svc", "claims", "user-ignored.keep");
fs.writeFileSync(ignoredUser, "ignored WI-505 user bytes\n");
assert.equal(execFileSync("git", ["-C", staleTuple.worktree, "check-ignore", ignoredUser], { encoding: "utf8" }).trim(), ignoredUser);
const preserve = {
  tracked: sha(path.join(staleTuple.worktree, "README.md")),
  untracked: sha(path.join(staleTuple.worktree, "user-untracked.txt")),
  ignored: sha(ignoredUser),
  graph: sha(staleTuple.first.absolute_graph),
  head: execFileSync("git", ["-C", staleTuple.worktree, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  branch: execFileSync("git", ["-C", staleTuple.worktree, "branch", "--show-current"], { encoding: "utf8" }).trim(),
  registration: execFileSync("git", ["-C", repo, "worktree", "list", "--porcelain"], { encoding: "utf8" }),
};
const reclaimed = ensure(staleTuple.wi, staleTuple.branch, staleB, { SVC_AUTHORITY_STATE_ROOT: path.join(temp, "wi505-v2-absent") });
assert.equal(reclaimed.created, false, "WI-505 stale reclaim never creates/recreates the worktree");
assert.equal(reclaimed.resumed, true, "WI-505 stale reclaim resumes in place");
assert.equal(reclaimed.owner_session, staleB);
assert.equal(reclaimed.claim_generation, 2);
const reclaimedClaim = json(staleTuple.claimPath);
assert.equal(reclaimedClaim.generation, 2);
assert.equal(reclaimedClaim.transfer_from_generation, 1);
assert.equal(reclaimedClaim.transfer_from_session, staleA);
assert.equal(reclaimedClaim.session_id, staleB);
assert.ok(json(staleTuple.bindingPath).released_at, "source binding A is durably retired");
const oldOwnerResolution = resolver.authorityJson(
  { cwd: staleTuple.worktree, session_id: staleA },
  { ...process.env, PWD: staleTuple.worktree, SVC_REQUIRE_SESSION_BINDING: "1" },
);
assert.equal(oldOwnerResolution.authority, false, "retired source session never resolves owned authority");
assert.equal(oldOwnerResolution.tuple, null, "retired source session receives no authority tuple");
assert.equal(fs.existsSync(path.join(temp, "wi505-v2-absent")), false, "standard v1 ensure creates no v2 state");
assert.equal(sha(path.join(staleTuple.worktree, "README.md")), preserve.tracked);
assert.equal(sha(path.join(staleTuple.worktree, "user-untracked.txt")), preserve.untracked);
assert.equal(sha(ignoredUser), preserve.ignored);
assert.equal(sha(staleTuple.first.absolute_graph), preserve.graph);
assert.equal(execFileSync("git", ["-C", staleTuple.worktree, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(), preserve.head);
assert.equal(execFileSync("git", ["-C", staleTuple.worktree, "branch", "--show-current"], { encoding: "utf8" }).trim(), preserve.branch);
assert.equal(execFileSync("git", ["-C", repo, "worktree", "list", "--porcelain"], { encoding: "utf8" }), preserve.registration);
const repeated = ensure(staleTuple.wi, staleTuple.branch, staleB);
assert.equal(repeated.resumed, true);
assert.equal(repeated.claim_generation, 2, "winner resume is idempotent: no gen3");
assert.equal(json(staleTuple.claimPath).generation, 2);

// Fresh A/gen1 -> B denial includes actionable owner evidence and mutates nothing.
const freshA = sid(0x931a), freshB = sid(0x931b);
const freshTuple = makeTuple(931, freshA);
const freshClaimBytes = fs.readFileSync(freshTuple.claimPath, "utf8");
const freshBindingBytes = fs.readFileSync(freshTuple.bindingPath, "utf8");
let freshError = null;
try { ensure(freshTuple.wi, freshTuple.branch, freshB); } catch (error) { freshError = error; }
assert.ok(freshError, "fresh complete tuple blocks");
assert.ok(freshError.message.includes(freshA), "fresh denial includes exact owner evidence");
assert.ok(freshError.message.includes("generation 1"), "fresh denial includes exact generation evidence");
assert.ok(freshError.message.includes(freshTuple.worktree), "fresh denial includes exact worktree evidence");
assert.equal(fs.readFileSync(freshTuple.claimPath, "utf8"), freshClaimBytes);
assert.equal(fs.readFileSync(freshTuple.bindingPath, "utf8"), freshBindingBytes);

// Every exact binding coordinate plus generation/claim-path mismatch denies
// before mutation. Reuse one tuple and restore its original bytes after each
// negative case so each assertion begins from the same complete stale state.
const mismatchA = sid(0x932a), mismatchB = sid(0x932b);
const mismatchTuple = makeTuple(932, mismatchA);
makeStale(mismatchTuple);
const originalMismatchBinding = json(mismatchTuple.bindingPath);
for (const mismatch of ["generation", "claim_path", "wi", "repo_root", "worktree_root", "branch"]) {
  const binding = structuredClone(originalMismatchBinding);
  if (mismatch === "generation") binding.generation += 7;
  if (mismatch === "claim_path") binding.claim_path = path.join(mismatchTuple.worktree, ".svc", "claims", "WI-999.claim.json");
  if (mismatch === "wi") binding.wi = "WI-999";
  if (mismatch === "repo_root") binding.repo_root = path.join(temp, "wrong-repository");
  if (mismatch === "worktree_root") binding.worktree_root = path.join(temp, "wrong-worktree");
  if (mismatch === "branch") binding.branch = "framework-WI-999-wrong";
  writeJson(mismatchTuple.bindingPath, binding);
  const beforeClaim = fs.readFileSync(mismatchTuple.claimPath, "utf8");
  const beforeBinding = fs.readFileSync(mismatchTuple.bindingPath, "utf8");
  assert.throws(() => ensure(mismatchTuple.wi, mismatchTuple.branch, mismatchB), /mismatch|deny|conflict|ambiguous|authority/i, `${mismatch} mismatch denies`);
  assert.equal(fs.readFileSync(mismatchTuple.claimPath, "utf8"), beforeClaim, `${mismatch}: claim unchanged`);
  assert.equal(fs.readFileSync(mismatchTuple.bindingPath, "utf8"), beforeBinding, `${mismatch}: binding unchanged`);
  writeJson(mismatchTuple.bindingPath, originalMismatchBinding);
}

// A second exact-coordinate mutating binding at the claim's current generation
// but for a different session makes the tuple ambiguous and cannot be ignored.
const ambiguousA = sid(0x933a), ambiguousB = sid(0x933b), ambiguousC = sid(0x933c);
const ownerAmbiguousTuple = makeTuple(933, ambiguousA);
makeStale(ownerAmbiguousTuple);
const foreignCurrentBindingPath = claims.bindingPath(ownerAmbiguousTuple.worktree, ambiguousB);
writeJson(foreignCurrentBindingPath, {
  ...json(ownerAmbiguousTuple.bindingPath),
  session_id: ambiguousB,
});
const ownerAmbiguousClaimBytes = fs.readFileSync(ownerAmbiguousTuple.claimPath, "utf8");
const ownerAmbiguousBindingBytes = fs.readFileSync(ownerAmbiguousTuple.bindingPath, "utf8");
const foreignCurrentBindingBytes = fs.readFileSync(foreignCurrentBindingPath, "utf8");
assert.throws(
  () => ensure(ownerAmbiguousTuple.wi, ownerAmbiguousTuple.branch, ambiguousC),
  /foreign owner|ambiguous|deny|authority|conflict/i,
  "same-generation foreign owner binding denies reclaim",
);
assert.equal(fs.readFileSync(ownerAmbiguousTuple.claimPath, "utf8"), ownerAmbiguousClaimBytes);
assert.equal(fs.readFileSync(ownerAmbiguousTuple.bindingPath, "utf8"), ownerAmbiguousBindingBytes);
assert.equal(fs.readFileSync(foreignCurrentBindingPath, "utf8"), foreignCurrentBindingBytes);

// Simulate reading otherwise-valid authority files as another operating-system
// user. The exact inspector must deny before any state mutation.
const realGetuid = process.getuid;
try {
  if (typeof realGetuid === "function") {
    process.getuid = () => realGetuid() + 1;
    const foreignOwned = claims.inspectV1AuthorityTuple({
      wi: mismatchTuple.wi,
      branch: mismatchTuple.branch,
      worktree_root: mismatchTuple.worktree,
      claim_path: mismatchTuple.claimPath,
      session_id: mismatchB,
      env: process.env,
    });
    assert.equal(foreignOwned.state, "deny", "foreign-owned authority state fails closed");
    assert.match(foreignOwned.reason, /foreign-owned|missing|insecure/i);
  }
} finally {
  process.getuid = realGetuid;
}

// Malformed, conflicting-owner, ambiguous filename/duplicate, and symlinked
// authority evidence deny.
for (const shape of ["malformed", "conflicting-owner", "ambiguous", "symlink"]) {
  const number = shape === "malformed" ? 934 : shape === "conflicting-owner" ? 935 : shape === "ambiguous" ? 936 : 937;
  const a = sid(number * 16 + 10), b = sid(number * 16 + 11);
  const tuple = makeTuple(number, a);
  makeStale(tuple);
  const original = fs.readFileSync(tuple.bindingPath);
  if (shape === "malformed") fs.writeFileSync(tuple.bindingPath, "{broken\n");
  if (shape === "conflicting-owner") {
    const claim = json(tuple.claimPath);
    claim.session_token = sid(number * 16 + 12);
    writeJson(tuple.claimPath, claim);
  }
  if (shape === "ambiguous") fs.writeFileSync(path.join(path.dirname(tuple.bindingPath), "duplicate.json"), original, { mode: 0o600 });
  if (shape === "symlink") {
    const outside = path.join(temp, `wi505-${shape}-binding.json`);
    fs.writeFileSync(outside, original, { mode: 0o600 });
    fs.unlinkSync(tuple.bindingPath);
    fs.symlinkSync(outside, tuple.bindingPath);
  }
  const beforeClaim = fs.readFileSync(tuple.claimPath, "utf8");
  assert.throws(() => ensure(tuple.wi, tuple.branch, b), /malformed|insecure|ambiguous|deny|conflict|authority/i, `${shape} binding denies`);
  assert.equal(fs.readFileSync(tuple.claimPath, "utf8"), beforeClaim, `${shape}: claim unchanged`);
}

// A post-CAS claim whose transfer generation is not the immediate predecessor
// is malformed and cannot be forward-completed.
const badTransferA = sid(0x938a), badTransferB = sid(0x938b);
const badTransferTuple = makeTuple(938, badTransferA);
const badTransferClaim = json(badTransferTuple.claimPath);
badTransferClaim.session_id = badTransferB;
badTransferClaim.generation = 3;
badTransferClaim.transfer_from_generation = 1;
badTransferClaim.transfer_from_session = badTransferA;
writeJson(badTransferTuple.claimPath, badTransferClaim);
assert.throws(
  () => ensure(badTransferTuple.wi, badTransferTuple.branch, badTransferB),
  /mismatch|source generation|authority|conflict/i,
  "non-adjacent transfer provenance denies",
);
assert.equal(json(badTransferTuple.claimPath).generation, 3);

// Both child attempts pre-read gen1 before the parent releases their barrier;
// O_EXCL claim locking then yields one gen2 winner and one changed-state loser.
const raceA = sid(0x939a), raceB = sid(0x939b), raceC = sid(0x939c);
const raceTuple = makeTuple(939, raceA);
makeStale(raceTuple);
fs.appendFileSync(path.join(raceTuple.worktree, "README.md"), "race tracked bytes\n");
fs.writeFileSync(path.join(raceTuple.worktree, "race-untracked.keep"), "race untracked bytes\n");
const raceIgnored = path.join(raceTuple.worktree, ".svc", "claims", "race-ignored.keep");
fs.writeFileSync(raceIgnored, "race ignored bytes\n");
const raceUserBytes = {
  tracked: sha(path.join(raceTuple.worktree, "README.md")),
  untracked: sha(path.join(raceTuple.worktree, "race-untracked.keep")),
  ignored: sha(raceIgnored),
};
const raceDir = path.join(temp, "wi505-race");
fs.mkdirSync(raceDir, { recursive: true });
const childSource = String.raw`
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
const [root, wi, branch, worktree, claimPath, session, runtime, ready, release, output] = process.argv.slice(1);
process.env.XDG_RUNTIME_DIR = runtime;
const claims = await import(pathToFileURL(path.join(root, "hooks/lib/wi-claim.mjs")));
const observed = claims.inspectV1AuthorityTuple({ wi, branch, worktree_root: worktree, claim_path: claimPath, session_id: session, env: process.env });
assert.equal(observed.generation, 1);
assert.equal(observed.state, "reclaimable");
fs.writeFileSync(ready, "ready\n");
while (!fs.existsSync(release)) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
const result = claims.transferClaim(wi, 1, { worktree_root: worktree, claim_path: claimPath, session_id: session, role: "mutating", branch, repo_root: ${JSON.stringify(repo)}, host: "codex", complete_tuple: true, source_binding_path: observed.source_binding_path, env: process.env });
fs.writeFileSync(output, JSON.stringify(result));
`;
const launch = (session, label) => {
  const ready = path.join(raceDir, `${label}.ready`), output = path.join(raceDir, `${label}.json`);
  const child = spawn(process.execPath, ["--input-type=module", "-e", childSource, root, raceTuple.wi, raceTuple.branch, raceTuple.worktree, raceTuple.claimPath, session, runtime, ready, path.join(raceDir, "release"), output], { stdio: ["ignore", "pipe", "pipe"] });
  return { child, ready, output, stderr: "" };
};
const bAttempt = launch(raceB, "b"), cAttempt = launch(raceC, "c");
const raceAttempts = [bAttempt, cAttempt];
for (const attempt of raceAttempts) attempt.child.stderr.on("data", (chunk) => { attempt.stderr += chunk; });
const readyDeadline = Date.now() + 10_000;
while (!fs.existsSync(bAttempt.ready) || !fs.existsSync(cAttempt.ready)) {
  const earlyExit = raceAttempts.find((attempt) => attempt.child.exitCode !== null && !fs.existsSync(attempt.ready));
  if (earlyExit || Date.now() >= readyDeadline) {
    for (const attempt of raceAttempts) if (attempt.child.exitCode === null) attempt.child.kill("SIGTERM");
    throw new Error(earlyExit ? `race child exited before ready: ${earlyExit.stderr}` : "race children timed out before ready");
  }
  await new Promise((resolve) => setTimeout(resolve, 5));
}
fs.writeFileSync(path.join(raceDir, "release"), "go\n");
await Promise.all(raceAttempts.map((attempt) => new Promise((resolve, reject) => {
  const settle = (code) => code === 0 ? resolve() : reject(new Error(attempt.stderr));
  if (attempt.child.exitCode !== null) settle(attempt.child.exitCode);
  else attempt.child.once("exit", settle);
})));
const raceResults = [json(bAttempt.output), json(cAttempt.output)];
assert.equal(raceResults.filter((value) => value.ok).length, 1, "exactly one CAS winner");
assert.equal(raceResults.filter((value) => !value.ok && /generation changed|state changed/i.test(value.warning || "")).length, 1, "loser reports changed generation/state");
assert.equal(json(raceTuple.claimPath).generation, 2);
assert.equal(json(raceTuple.claimPath).transfer_from_generation, 1);
assert.equal(sha(path.join(raceTuple.worktree, "README.md")), raceUserBytes.tracked);
assert.equal(sha(path.join(raceTuple.worktree, "race-untracked.keep")), raceUserBytes.untracked);
assert.equal(sha(raceIgnored), raceUserBytes.ignored);

// Durable crash after CAS but before source retirement: current owner B/gen2,
// old A/gen1 still unreleased, no B binding. Public retry retires A and binds B
// without another generation increment.
const crashA = sid(0x940a), crashB = sid(0x940b);
const crashTuple = makeTuple(940, crashA);
makeStale(crashTuple);
assert.throws(
  () => ensure(crashTuple.wi, crashTuple.branch, crashB, { SVC_ENSURE_FAILPOINT: "after-claim-transfer-cas" }),
  /injected failpoint: after-claim-transfer-cas/,
  "failpoint stops after the first and only durable winner claim write",
);
const crashClaim = json(crashTuple.claimPath);
assert.equal(crashClaim.session_id, crashB);
assert.equal(crashClaim.generation, 2);
assert.equal(crashClaim.transfer_from_generation, 1, "first durable winner write carries current source generation");
assert.equal(crashClaim.transfer_from_session, crashA, "first durable winner write carries current source session");
assert.equal(json(crashTuple.bindingPath).released_at, undefined, "failpoint precedes source retirement");
assert.equal(fs.existsSync(claims.bindingPath(crashTuple.worktree, crashB)), false);
const recovered = ensure(crashTuple.wi, crashTuple.branch, crashB);
assert.equal(recovered.created, false);
assert.equal(recovered.resumed, true);
assert.equal(recovered.claim_generation, 2, "post-CAS recovery does not write gen3");
assert.ok(json(crashTuple.bindingPath).released_at, "post-CAS recovery retires source A");
assert.equal(json(claims.bindingPath(crashTuple.worktree, crashB)).generation, 2);
const concurrentLoser = claims.finalizeTransferredClaim(crashTuple.wi, 2, {
  worktree_root: crashTuple.worktree,
  claim_path: crashTuple.claimPath,
  session_id: crashB,
  branch: crashTuple.branch,
  repo_root: repo,
  env: process.env,
});
assert.equal(concurrentLoser.ok, true, "same-winner finalizer loser treats current_complete as idempotent success");
assert.equal(concurrentLoser.already_finalized, true);
assert.equal(json(crashTuple.claimPath).generation, 2, "idempotent finalizer never writes gen3");

// Existing direct stale transfer remains compatible without v2.
const directA = sid(0x941a), directB = sid(0x941b);
const directTuple = makeTuple(941, directA);
makeStale(directTuple);
const direct = claims.transferClaim(directTuple.wi, 1, { worktree_root: directTuple.worktree, claim_path: directTuple.claimPath, session_id: directB, role: "mutating", branch: directTuple.branch, repo_root: repo, host: "codex", env: process.env });
assert.equal(direct.ok, true, "direct stale transfer without v2 remains compatible");
assert.equal(direct.claim.generation, 2);

// Canonical active v2 lease beside stale-looking v1 residue blocks both public
// complete-tuple reclaim and direct transfer, with every authority byte unchanged.
const v2A = sid(0x942a), v2B = sid(0x942b);
const v2Tuple = makeTuple(942, v2A);
makeStale(v2Tuple);
const v2Root = path.join(temp, "wi505-v2-active");
const repoId = store.repositoryId(v2Tuple.worktree);
store.bootstrapController({ stateRoot: v2Root, repoId, wi: v2Tuple.wi, worktreeRoot: v2Tuple.worktree, principal: store.principalId({ host: "codex", session_id: v2A }) });
const v2Before = directoryDigest(v2Root);
const v1ClaimBefore = fs.readFileSync(v2Tuple.claimPath, "utf8");
const v1BindingBefore = fs.readFileSync(v2Tuple.bindingPath, "utf8");
assert.throws(() => ensure(v2Tuple.wi, v2Tuple.branch, v2B, { SVC_AUTHORITY_STATE_ROOT: v2Root }), /v2|controller|authority|conflict/i, "active v2 blocks public v1 reclaim");
const directDenied = claims.transferClaim(v2Tuple.wi, 1, { worktree_root: v2Tuple.worktree, claim_path: v2Tuple.claimPath, session_id: v2B, role: "mutating", branch: v2Tuple.branch, repo_root: repo, host: "codex", env: { ...process.env, SVC_AUTHORITY_STATE_ROOT: v2Root } });
assert.equal(directDenied.ok, false, "active v2 blocks direct v1 transfer");
assert.match(directDenied.warning, /v2|controller/i);
assert.equal(fs.readFileSync(v2Tuple.claimPath, "utf8"), v1ClaimBefore);
assert.equal(fs.readFileSync(v2Tuple.bindingPath, "utf8"), v1BindingBefore);
assert.equal(directoryDigest(v2Root), v2Before);

// A present-but-malformed canonical v2 lease is uncertain authority, never
// equivalent to v2 absence. Both public and direct v1 acquisition deny without
// changing the malformed v2 evidence or either v1 authority file.
const v2LeaseDir = path.join(v2Root, "leases");
const v2LeaseFile = path.join(v2LeaseDir, fs.readdirSync(v2LeaseDir).find((name) => name.endsWith(".json")));
fs.writeFileSync(v2LeaseFile, "{malformed-v2\n", { mode: 0o600 });
const malformedV2Before = directoryDigest(v2Root);
assert.throws(
  () => ensure(v2Tuple.wi, v2Tuple.branch, v2B, { SVC_AUTHORITY_STATE_ROOT: v2Root }),
  /v2|controller|malformed|corrupt|authority|conflict/i,
  "present malformed v2 lease blocks public v1 reclaim",
);
const malformedV2Direct = claims.transferClaim(v2Tuple.wi, 1, {
  worktree_root: v2Tuple.worktree,
  claim_path: v2Tuple.claimPath,
  session_id: v2B,
  role: "mutating",
  branch: v2Tuple.branch,
  repo_root: repo,
  host: "codex",
  env: { ...process.env, SVC_AUTHORITY_STATE_ROOT: v2Root },
});
assert.equal(malformedV2Direct.ok, false, "present malformed v2 lease blocks direct v1 transfer");
assert.match(malformedV2Direct.warning, /v2|controller|malformed|corrupt|authority/i);
assert.equal(fs.readFileSync(v2Tuple.claimPath, "utf8"), v1ClaimBefore);
assert.equal(fs.readFileSync(v2Tuple.bindingPath, "utf8"), v1BindingBefore);
assert.equal(directoryDigest(v2Root), malformedV2Before);

// A symlinked v2 state root is uncertain authority state, never evidence that
// v2 is absent. Standard v1 reclaim therefore denies without changing v1 bytes.
const v2SymlinkRoot = path.join(temp, "wi505-v2-symlink");
fs.symlinkSync(path.join(temp, "wi505-v2-missing-target"), v2SymlinkRoot);
assert.throws(
  () => ensure(v2Tuple.wi, v2Tuple.branch, v2B, { SVC_AUTHORITY_STATE_ROOT: v2SymlinkRoot }),
  /v2|symlink|authority|conflict/i,
  "symlinked v2 authority root fails closed",
);
assert.equal(fs.readFileSync(v2Tuple.claimPath, "utf8"), v1ClaimBefore);
assert.equal(fs.readFileSync(v2Tuple.bindingPath, "utf8"), v1BindingBefore);
NODE_WI505
ok "WI-505 stale complete-tuple reclaim is generation-bound, race-safe, v2-safe, idempotent, and data-preserving"

echo "default-checkout isolation: $PASS passed, 0 failed"
