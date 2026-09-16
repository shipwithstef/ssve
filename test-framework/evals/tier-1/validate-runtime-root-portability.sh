#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
chmod 700 "$TMP"
TMP="$(cd "$TMP" && pwd -P)"

if [[ "${SVC_WI506_RED_ONLY:-0}" == 1 || "${1:-}" == "--red-only" ]]; then
  HOME="$TMP/home"; export HOME
  mkdir -m 700 "$HOME"
  mkdir -m 500 "$TMP/unwritable-parent"
  export XDG_RUNTIME_DIR="$TMP/unwritable-parent/missing-xdg"
  unset SVC_RUNTIME_DIR SVC_CODEX_RUNTIME_DIR
  set +e
  node --input-type=module - "$ROOT/hooks/lib/svc-runtime-root.mjs" "$HOME" "$XDG_RUNTIME_DIR" <<'JS' >/dev/null 2>&1
import { pathToFileURL } from "node:url";
const module = await import(pathToFileURL(process.argv[2]));
const result = module.resolveRuntimeDirectory({
  env: { HOME: process.argv[3], XDG_RUNTIME_DIR: process.argv[4] },
  leaf: "svc-wi506-red",
});
if (result.source !== "home-cache-fallback" || result.fallback_reason !== "xdg-enoent") process.exit(2);
JS
  RED_RC=$?
  set -e
  if [[ "$RED_RC" -ne 0 ]]; then
    echo "WI506-RED-RUNTIME-ROOT: missing XDG fallback unavailable" >&2
    exit 1
  fi
  exit 0
fi

node --input-type=module - "$ROOT" "$TMP" <<'JS'
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync, spawn } from "node:child_process";

const root = process.argv[2];
const tmp = process.argv[3];
const runtime = await import(pathToFileURL(path.join(root, "hooks/lib/svc-runtime-root.mjs")));
const ensure = await import(pathToFileURL(path.join(root, "scripts/svc-ensure-worktree.mjs")));
const codex = await import(pathToFileURL(path.join(root, "hooks/codex/lib/codex-hook-context.mjs")));
const claim = await import(pathToFileURL(path.join(root, "hooks/lib/wi-claim.mjs")));
const uid = typeof process.getuid === "function" ? process.getuid() : "user";

function dir(name, mode = 0o700) {
  const target = path.join(tmp, name);
  fs.mkdirSync(target, { recursive: true, mode });
  fs.chmodSync(target, mode);
  return target;
}
function mode(target) { return fs.lstatSync(target).mode & 0o777; }
function home(name) { return dir(name, 0o700); }
function expectThrow(fn, pattern) {
  assert.throws(fn, pattern);
}

// Unset XDG: generic consumers share ~/.cache/svc-runtime but retain private,
// separate leaves. Codex preserves its historical fallback byte-for-byte.
const h1 = home("home-unset");
const generic = runtime.resolveRuntimeDirectory({ env: { HOME: h1 }, leaf: `svc-ensure-worktree-${uid}` });
assert.equal(generic.source, "home-cache-fallback");
assert.equal(generic.fallback_reason, "xdg-unset");
assert.equal(generic.path, path.join(h1, ".cache", "svc-runtime", `svc-ensure-worktree-${uid}`));
assert.equal(mode(generic.path), 0o700);
const codexFallback = codex.runtimeRoot({ HOME: h1 });
assert.equal(codexFallback, path.join(h1, ".cache", "svc-codex-runtime"));
assert.equal(mode(codexFallback), 0o700);

// Set-but-missing XDG is availability failure, including when its parent is not
// writable. The resolver never creates the advertised XDG parent.
const h2 = home("home-missing");
const blockedParent = dir("blocked-parent", 0o500);
const missingXdg = path.join(blockedParent, "missing-xdg");
const missing = runtime.resolveRuntimeDirectory({ env: { HOME: h2, XDG_RUNTIME_DIR: missingXdg }, leaf: "svc-missing" });
assert.equal(missing.source, "home-cache-fallback");
assert.equal(missing.fallback_reason, "xdg-enoent");
assert.equal(fs.existsSync(missingXdg), false);

// A valid XDG parent retains the established leaf names and never touches HOME.
const xdg = dir("xdg", 0o700);
const h3 = home("home-valid-xdg");
const lock = ensure.lockPathFor(path.join(tmp, "repo"), "WI-506", { HOME: h3, XDG_RUNTIME_DIR: xdg });
assert.match(lock, /^refs\/svc\/authority-locks\/[0-9a-f]{64}$/);
assert.equal(fs.existsSync(path.join(xdg, `svc-ensure-worktree-${uid}`)), false);
assert.equal(codex.runtimeRoot({ HOME: h3, XDG_RUNTIME_DIR: xdg }), path.join(xdg, "svc-codex"));
assert.equal(fs.existsSync(path.join(h3, ".cache")), false);

// SVC_RUNTIME_DIR is the host-agnostic shared-parent override and wins over the
// legacy Codex direct leaf. The legacy variable remains exact when used alone.
const shared = dir("shared", 0o700);
const legacy = dir("legacy-codex", 0o700);
const explicit = runtime.resolveRuntimeDirectory({
  env: { HOME: h3, SVC_RUNTIME_DIR: shared, SVC_CODEX_RUNTIME_DIR: legacy },
  leaf: "svc-codex", legacyCodexDirect: true, legacyCodexHome: true,
});
assert.equal(explicit.path, path.join(shared, "svc-codex"));
assert.equal(explicit.source, "svc-runtime-dir");
assert.equal(codex.runtimeRoot({ HOME: h3, SVC_CODEX_RUNTIME_DIR: legacy }), legacy);

// Unsafe existing state is a security signal: no fallback, no repair, no
// consumer leaf. Missing explicit shared parents are configuration errors too.
const unsafe = dir("unsafe-xdg", 0o755);
const h4 = home("home-unsafe");
expectThrow(() => runtime.resolveRuntimeDirectory({ env: { HOME: h4, XDG_RUNTIME_DIR: unsafe }, leaf: "svc-deny" }), /unsafe mode/);
assert.equal(mode(unsafe), 0o755);
assert.equal(fs.existsSync(path.join(h4, ".cache")), false);
const unsafeLeafParent = dir("unsafe-leaf-parent", 0o700);
const unsafeLeaf = path.join(unsafeLeafParent, "svc-existing");
// mkdirSync mode is umask-masked (0077 -> 0700). chmod establishes the
// intended unsafe fixture so the deny assertion is not environment-flaky.
fs.mkdirSync(unsafeLeaf, { mode: 0o755 });
fs.chmodSync(unsafeLeaf, 0o755);
expectThrow(() => runtime.resolveRuntimeDirectory({ env: { HOME: h4, XDG_RUNTIME_DIR: unsafeLeafParent }, leaf: "svc-existing" }), /unsafe mode/);
assert.equal(mode(unsafeLeaf), 0o755);
const xdgTarget = dir("xdg-target", 0o700);
const xdgLink = path.join(tmp, "xdg-link");
fs.symlinkSync(xdgTarget, xdgLink);
expectThrow(() => runtime.resolveRuntimeDirectory({ env: { HOME: h4, XDG_RUNTIME_DIR: xdgLink }, leaf: "svc-deny" }), /not a real directory/);
const xdgFile = path.join(tmp, "xdg-file"); fs.writeFileSync(xdgFile, "x");
expectThrow(() => runtime.resolveRuntimeDirectory({ env: { HOME: h4, XDG_RUNTIME_DIR: xdgFile }, leaf: "svc-deny" }), /not a real directory/);
expectThrow(() => runtime.resolveRuntimeDirectory({ env: { HOME: h4, SVC_RUNTIME_DIR: path.join(tmp, "absent-explicit") }, leaf: "svc-deny" }), /pre-existing current-user directory with mode 0700/);
const unsafeExplicit = dir("unsafe-explicit", 0o755);
expectThrow(() => runtime.resolveRuntimeDirectory({ env: { HOME: h4, SVC_RUNTIME_DIR: unsafeExplicit }, leaf: "svc-deny" }), /unsafe mode/);
const explicitTarget = dir("explicit-target", 0o700);
const explicitLink = path.join(tmp, "explicit-link"); fs.symlinkSync(explicitTarget, explicitLink);
expectThrow(() => runtime.resolveRuntimeDirectory({ env: { HOME: h4, SVC_RUNTIME_DIR: explicitLink }, leaf: "svc-deny" }), /not a real directory/);
const unsafeLegacy = dir("unsafe-legacy", 0o755);
expectThrow(() => codex.runtimeRoot({ HOME: h4, SVC_CODEX_RUNTIME_DIR: unsafeLegacy }), /unsafe mode/);
expectThrow(() => runtime.resolveRuntimeDirectory({ env: { HOME: h4, XDG_RUNTIME_DIR: "relative" }, leaf: "svc-deny" }), /absolute path/);
expectThrow(() => runtime.resolveRuntimeDirectory({ env: { HOME: h4, SVC_RUNTIME_DIR: "relative" }, leaf: "svc-deny" }), /absolute path/);
const originalLstat = fs.lstatSync;
fs.lstatSync = (target, ...args) => {
  const stat = originalLstat(target, ...args);
  return path.resolve(String(target)) === path.resolve(xdgTarget) && typeof process.getuid === "function"
    ? new Proxy(stat, { get(value, key) { return key === "uid" ? process.getuid() + 1 : Reflect.get(value, key); } })
    : stat;
};
expectThrow(() => runtime.resolveRuntimeDirectory({ env: { HOME: h4, XDG_RUNTIME_DIR: xdgTarget }, leaf: "svc-foreign" }), /not owned by the current user/);
fs.lstatSync = originalLstat;

// All correctness locks use one repository-shared Git compare-and-swap ref
// namespace. A dead same-host holder is transferred only when update-ref still
// sees the exact inspected object id; delayed contenders cannot replace a fresh
// holder. Runtime overrides therefore cannot split the authority namespace.
const lockRepo = dir("authority-lock-repo", 0o700);
execFileSync("git", ["-C", lockRepo, "init", "-q"]);
const lockSvc = path.join(lockRepo, ".svc"); fs.mkdirSync(lockSvc, { mode: 0o700 });
const lockIdentity = "claim:" + path.join(lockSvc, "claims", "WI-506.claim.json");
const lockRef = claim.authorityLockRef(lockIdentity);
const git = (args, input) => execFileSync("git", ["-C", lockRepo, ...args], { encoding: "utf8", input }).trim();
const lockRefExists = () => { try { execFileSync("git", ["-C", lockRepo, "show-ref", "--verify", "--quiet", lockRef], { stdio: "ignore" }); return true; } catch { return false; } };
// Empty start token simulates a host without /proc. ESRCH still proves this PID
// dead; a live/reused PID with no token remains fail-closed in processIdentity.
const deadHolder = `${JSON.stringify({ schema_version: 1, hostname: (await import("node:os")).default.hostname(), pid: 99999999, process_start_token: "", lock_token: "stale", ts: "2000-01-01T00:00:00.000Z" })}\n`;
const deadOid = git(["hash-object", "-w", "--stdin"], deadHolder);
git(["update-ref", lockRef, deadOid]);
const runtimeA = dir("authority-runtime-a", 0o700);
const runtimeB = dir("authority-runtime-b", 0o700);
process.env.SVC_RUNTIME_DIR = runtimeA;
assert.equal(claim.withExclusiveLock(lockIdentity, () => "reclaimed", lockSvc), "reclaimed");
process.env.SVC_RUNTIME_DIR = runtimeB;
assert.equal(claim.withExclusiveLock(lockIdentity, () => "same-namespace", lockSvc), "same-namespace");
delete process.env.SVC_RUNTIME_DIR;
assert.equal(lockRefExists(), false);
assert.equal(fs.readdirSync(runtimeA).length, 0);
assert.equal(fs.readdirSync(runtimeB).length, 0);

const tokenlessLiveHolder = `${JSON.stringify({ schema_version: 1, hostname: (await import("node:os")).default.hostname(), pid: process.pid, process_start_token: "", lock_token: "live-tokenless", ts: new Date().toISOString() })}\n`;
const tokenlessLiveOid = git(["hash-object", "-w", "--stdin"], tokenlessLiveHolder);
git(["update-ref", lockRef, tokenlessLiveOid]);
const looseBeforeBusy = Number(git(["count-objects", "-v"]).match(/^count: (\d+)$/m)?.[1]);
const tokenlessBusy = claim.withExclusiveLock(lockIdentity, () => "must-not-run", lockSvc);
assert.equal(tokenlessBusy.ok, false);
assert.equal(tokenlessBusy.lock_busy, true);
assert.equal(tokenlessBusy.lock_error, undefined);
assert.equal(tokenlessBusy.observed_oid, tokenlessLiveOid);
assert.match(tokenlessBusy.warning, new RegExp(`git update-ref --no-deref -d ${lockRef} ${tokenlessLiveOid}`));
assert.equal(git(["rev-parse", "--verify", lockRef]), tokenlessLiveOid);
assert.equal(Number(git(["count-objects", "-v"]).match(/^count: (\d+)$/m)?.[1]), looseBeforeBusy, "live contention must not write a candidate blob");
git(["update-ref", "-d", lockRef, tokenlessLiveOid]);

// Corrupt holder evidence carries no positive death proof. It fails closed with
// exact ref/OID recovery instructions; only an independently verified operator
// may delete it. A valid operation result shaped as {ok:false} remains an
// application result rather than being confused with lock contention.
const malformedOid = git(["hash-object", "-w", "--stdin"], "not-json\n");
git(["update-ref", lockRef, malformedOid]);
const malformedResult = claim.withExclusiveLock(lockIdentity, () => "must-not-run", lockSvc);
assert.equal(malformedResult.ok, false);
assert.equal(malformedResult.lock_error, true);
assert.equal(malformedResult.corrupt_holder, true);
assert.equal(malformedResult.observed_oid, malformedOid);
assert.equal(git(["rev-parse", "--verify", lockRef]), malformedOid);
assert.match(malformedResult.warning, new RegExp(`git update-ref --no-deref -d ${lockRef} ${malformedOid}`));
git(["update-ref", "--no-deref", "-d", lockRef, malformedOid]);
assert.equal(claim.withExclusiveLock(lockIdentity, () => "operator-recovered", lockSvc), "operator-recovered");
assert.deepEqual(claim.withExclusiveLock(lockIdentity, () => ({ ok: false, reason: "operation-result" }), lockSvc), { ok: false, reason: "operation-result" });
const stableHolderOids = [];
for (let index = 0; index < 2; index += 1) {
  claim.withExclusiveLock(lockIdentity, () => stableHolderOids.push(git(["rev-parse", "--verify", lockRef])), lockSvc);
}
assert.equal(stableHolderOids[0], stableHolderOids[1], "one process must reuse one content-addressed holder blob");

// A failed exact-OID release must not be hidden behind a successful mutation
// result. Force only the delete command to fail through a temporary Git shim,
// then verify the caller receives an actionable structured failure.
const realGit = execFileSync("sh", ["-c", "command -v git"], { encoding: "utf8" }).trim();
const failingGitDir = dir("failing-release-git", 0o700);
const failingGit = path.join(failingGitDir, "git");
fs.writeFileSync(failingGit, `#!/usr/bin/env bash\nif [[ " $* " == *" update-ref "* && " $* " == *" -d "* ]]; then exit 73; fi\nexec ${JSON.stringify(realGit)} "$@"\n`, { mode: 0o700 });
const originalPath = process.env.PATH;
process.env.PATH = `${failingGitDir}${path.delimiter}${originalPath}`;
const releaseFailure = claim.withExclusiveLock(lockIdentity, () => ({ ok: true, mutation_reported_success: true }), lockSvc);
process.env.PATH = originalPath;
assert.equal(releaseFailure.ok, false);
assert.equal(releaseFailure.lock_error, true);
assert.equal(releaseFailure.lock_release_error, true);
assert.equal(releaseFailure.ref, lockRef);
assert.equal(releaseFailure.observed_oid, git(["rev-parse", "--verify", lockRef]));
assert.deepEqual(releaseFailure.operation_result, { ok: true, mutation_reported_success: true });
assert.match(releaseFailure.warning, /failed to release authority lock/);
git(["update-ref", "--no-deref", "-d", lockRef, releaseFailure.observed_oid]);

const outsideGit = dir("not-a-git-repository", 0o700);
const lockFailure = claim.withExclusiveLock("no-repo", () => "must-not-run", outsideGit);
assert.equal(lockFailure.ok, false);
assert.equal(lockFailure.lock_error, true);
assert.equal(lockFailure.lock_busy, undefined);

// Deterministic stale-reclaim race: two fresh processes start from the same
// dead object. Their critical-section events must remain start/end serialized.
const raceOid = git(["hash-object", "-w", "--stdin"], deadHolder);
git(["update-ref", lockRef, raceOid]);
const raceEvents = path.join(tmp, "authority-lock-race.jsonl");
const worker = path.join(tmp, "authority-lock-contender.mjs");
fs.writeFileSync(worker, `
import fs from "node:fs";
import { pathToFileURL } from "node:url";
const [modulePath, identity, anchor, events, label] = process.argv.slice(2);
const claim = await import(pathToFileURL(modulePath));
const result = claim.withExclusiveLock(identity, () => {
  fs.appendFileSync(events, JSON.stringify({ label, event: "start" }) + "\\n");
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 150);
  fs.appendFileSync(events, JSON.stringify({ label, event: "end" }) + "\\n");
  return label;
}, anchor);
if (result && result.ok === false) process.exit(3);
`);
const claimModule = path.join(root, "hooks/lib/wi-claim.mjs");
const contenders = ["A", "B"].map((label) => spawn(process.execPath, [worker, claimModule, lockIdentity, lockSvc, raceEvents, label], { stdio: "inherit" }));
const exits = await Promise.all(contenders.map((child) => new Promise((resolve) => child.on("exit", resolve))));
assert.deepEqual(exits, [0, 0]);
const events = fs.readFileSync(raceEvents, "utf8").trim().split(/\n/).map(JSON.parse);
assert.deepEqual(events.map((event) => event.event), ["start", "end", "start", "end"]);
assert.notEqual(events[0].label, events[2].label);
assert.equal(lockRefExists(), false);
const ensureSource = fs.readFileSync(path.join(root, "scripts/svc-ensure-worktree.mjs"), "utf8");
const migrationSource = fs.readFileSync(path.join(root, "scripts/svc-migrate-task-state.mjs"), "utf8");
assert.match(ensureSource, /withExclusiveLock\(bootstrapLockIdentity/);
assert.match(migrationSource, /withExclusiveLock\(`task-state-migration:/);
assert.doesNotMatch(ensureSource + migrationSource, /reclaimDead(?:Migration)?Lock|unlinkSync\(lock\)/);

// Resolution is deterministic under concurrent consumers and creates no state
// in os.tmpdir(). Every returned consumer leaf is private.
const hc = home("home-concurrent");
const leaves = Array.from({ length: 12 }, (_, index) => runtime.resolveRuntimeDirectory({ env: { HOME: hc }, leaf: `svc-concurrent-${index % 3}` }).path);
assert.equal(new Set(leaves).size, 3);
for (const leaf of new Set(leaves)) assert.equal(mode(leaf), 0o700);
assert.equal(leaves.every((leaf) => leaf.startsWith(`${hc}${path.sep}`)), true);

const timingHome = home("home-timing");
const started = Date.now();
for (let index = 0; index < 5; index += 1) {
  execFileSync(process.execPath, [path.join(root, "scripts/svc-runtime-root.mjs"), "--leaf", `svc-timing-${index}`], {
    env: { ...process.env, HOME: timingHome, XDG_RUNTIME_DIR: "", SVC_RUNTIME_DIR: "", SVC_CODEX_RUNTIME_DIR: "" },
    stdio: "ignore",
  });
}
assert.ok(Date.now() - started < 5000, "runtime resolver CLI exceeded five-second portability budget");
JS

CLI_HOME="$TMP/cli-home"; mkdir -m 700 "$CLI_HOME"
CLI_JSON="$(env -u XDG_RUNTIME_DIR -u SVC_RUNTIME_DIR -u SVC_CODEX_RUNTIME_DIR HOME="$CLI_HOME" node "$ROOT/scripts/svc-runtime-root.mjs" --leaf svc-cli --json)"
node -e 'const r=JSON.parse(process.argv[1]);if(r.source!=="home-cache-fallback"||r.fallback_reason!=="xdg-unset"||!r.path.endsWith("/.cache/svc-runtime/svc-cli"))process.exit(1)' "$CLI_JSON"

UNSAFE_XDG="$TMP/cli-unsafe"; mkdir -m 755 "$UNSAFE_XDG"
chmod 755 "$UNSAFE_XDG"
set +e
env -u SVC_RUNTIME_DIR -u SVC_CODEX_RUNTIME_DIR HOME="$CLI_HOME" XDG_RUNTIME_DIR="$UNSAFE_XDG" \
  node "$ROOT/scripts/svc-runtime-root.mjs" --leaf svc-cli-deny > "$TMP/cli-unsafe.out" 2> "$TMP/cli-unsafe.err"
UNSAFE_CLI_RC=$?
set -e
[[ "$UNSAFE_CLI_RC" -ne 0 && ! -s "$TMP/cli-unsafe.out" && -s "$TMP/cli-unsafe.err" ]]
grep -q "unsafe mode 755: $UNSAFE_XDG" "$TMP/cli-unsafe.err"
[[ ! -e "$UNSAFE_XDG/svc-cli-deny" ]]

node --input-type=module - "$ROOT" <<'JS'
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
const root = process.argv[2];
const scanRoots = ["hooks", "scripts", "bin"].map((item) => path.join(root, item));
const selector = /XDG_RUNTIME_DIR/;
const matches = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (/\.(?:mjs|js|sh|ts)$/.test(entry.name) && !file.endsWith("hooks/lib/svc-runtime-root.mjs") && !file.endsWith("scripts/svc-runtime-root.mjs")) {
      const source = fs.readFileSync(file, "utf8");
      if (selector.test(source)) matches.push({ file: path.relative(root, file), source });
    }
  }
}
scanRoots.forEach(walk);
assert.equal(matches.length, 1, `unexpected direct runtime selectors: ${matches.map((item) => item.file).join(", ")}`);
assert.equal(matches[0].file, "hooks/svc-worktree-isolation-guard.mjs");
assert.match(matches[0].source, /WI-506 observation-only temp roots/);
JS

echo "TIER-1 PASS: validate-runtime-root-portability"
