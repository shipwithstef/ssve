#!/usr/bin/env bash
# Tier 1: WI-549 — repository-shared chain-policy resolution.
#
# Every linked worktree must observe the SAME owner-selected chain-policy
# mode as the canonical checkout, with provenance, and missing/unreadable
# policy must never silently downgrade "refuse" to "warn" (AC-549-1..6).
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT"
PASS=0; FAIL=0
pass(){ echo "  ✓ $1"; PASS=$((PASS+1)); }
fail(){ echo "  ✗ $1"; FAIL=$((FAIL+1)); }
echo "=== Tier 1: shared chain-policy resolution (WI-549) ==="

RESOLVER="scripts/lib/chain-policy.mjs"

# ---- Structural checks --------------------------------------------------
node --check "$RESOLVER" 2>/dev/null && pass "chain-policy.mjs parses" || fail "chain-policy.mjs syntax error"
node --check scripts/svc-reconcile.mjs 2>/dev/null && pass "svc-reconcile.mjs parses" || fail "svc-reconcile.mjs syntax error"
node --check scripts/svc-ensure-worktree.mjs 2>/dev/null && pass "svc-ensure-worktree.mjs parses" || fail "svc-ensure-worktree.mjs syntax error"
bash -n scripts/worktree.sh && pass "worktree.sh bash syntax valid" || fail "worktree.sh syntax error"

grep -q 'resolveChainPolicy' scripts/svc-reconcile.mjs && pass "svc-reconcile.mjs uses the shared resolver" || fail "svc-reconcile.mjs does not import resolveChainPolicy"
grep -q '{ mode: "warn" }' scripts/svc-reconcile.mjs && fail "svc-reconcile.mjs still has a silent default-to-warn fallback" || pass "svc-reconcile.mjs has no default-to-warn fallback"

for hook in hooks/git/pre-commit.d/20-quick-fix-eligibility hooks/git/pre-push.d/10-receipts-complete hooks/git/pre-push.d/15-tier1-gate; do
  bash -n "$hook" && pass "$hook bash syntax valid" || fail "$hook syntax error"
  grep -q 'chain-policy\.mjs".*--mode' "$hook" && pass "$hook reads mode via the shared resolver" || fail "$hook does not call the shared resolver"
  grep -qE 'MODE="warn"$' "$hook" && fail "$hook still hardcodes a default MODE=warn" || pass "$hook has no hardcoded default-warn"
done

# AC-549-4: neither worktree bootstrap script ever names the raw per-worktree
# chain-policy.json path as a quoted string literal (comments referencing the
# concept are fine) — they only ever call the resolver script by name, so a
# per-worktree copy can never be treated (or created) as authority here.
if grep -qE '["'"'"']chain-policy\.json' scripts/svc-ensure-worktree.mjs; then
  fail "svc-ensure-worktree.mjs references the raw chain-policy.json path as a string literal"
else
  pass "svc-ensure-worktree.mjs never references a per-worktree chain-policy.json path literal"
fi
if grep -qE '["'"'"']chain-policy\.json' scripts/worktree.sh; then
  fail "worktree.sh references the raw chain-policy.json path as a string literal"
else
  pass "worktree.sh never references a per-worktree chain-policy.json path literal"
fi
grep -q 'resolveChainPolicy' scripts/svc-ensure-worktree.mjs && pass "svc-ensure-worktree.mjs surfaces resolved chain policy" || fail "svc-ensure-worktree.mjs does not surface chain policy"
grep -q 'chain-policy.mjs' scripts/worktree.sh && pass "worktree.sh surfaces resolved chain policy" || fail "worktree.sh does not surface chain policy"

# ---- Functional resolver matrix (AC-549-1..5) ---------------------------
node --input-type=module <<'NODE'
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveChainPolicy, seedSharedChainPolicy } from "./scripts/lib/chain-policy.mjs";

const root = process.cwd();
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "wi549-chain-policy-"));
const mainRepo = path.join(scratch, "main");
const homeDir = path.join(scratch, "home");
fs.mkdirSync(mainRepo, { recursive: true });
fs.mkdirSync(homeDir, { recursive: true });

const git = (args, cwd = mainRepo) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
git(["init", "-q", "-b", "main"]);
git(["config", "user.email", "wi549@example.invalid"]);
git(["config", "user.name", "WI-549 fixture"]);
fs.writeFileSync(path.join(mainRepo, "fixture.txt"), "one\n");
git(["add", "fixture.txt"]);
git(["commit", "-qm", "fixture"]);

const linkedWt = path.join(scratch, "linked-worktree");
git(["worktree", "add", "-q", "-b", "linked", linkedWt]);

// Isolated env: no ambient SVC_CHAIN_POLICY, HOME redirected to a scratch
// dir so this test can never read or write the real operator's ~/.svc/.
const baseEnv = { ...process.env, HOME: homeDir };
delete baseEnv.SVC_CHAIN_POLICY;

const sharedPath = path.join(mainRepo, ".git", "svc-chain-policy.json");
const localPath = path.join(linkedWt, ".svc", "chain-policy.json");
const homePath = path.join(homeDir, ".svc", "chain-policy.json");

function writeJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n");
}
function sha256(p) {
  return crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
}
function rmIfExists(p) { try { fs.rmSync(p, { force: true }); } catch {} }

let rc = 0;
const ok = (cond, msg) => { if (!cond) { console.log(`  ✗ ${msg}`); rc = 1; } else { console.log(`  ✓ ${msg}`); } };

// (1) Missing everywhere -> fail-closed refuse (AC-549-1 tier 4).
rmIfExists(sharedPath); rmIfExists(localPath); rmIfExists(homePath);
{
  const r = resolveChainPolicy({ start: linkedWt, env: baseEnv });
  ok(r.mode === "refuse" && r.source === "fail-closed" && r.conflict === false, "missing local + missing shared + missing home -> fail-closed refuse");
}

// (2) Worktree WITHOUT a local file still sees the shared "refuse" mode of
// the canonical clone (AC-549-2).
writeJson(sharedPath, { mode: "refuse" });
{
  const r = resolveChainPolicy({ start: linkedWt, env: baseEnv });
  ok(r.mode === "refuse" && r.source === "shared" && !fs.existsSync(localPath), "worktree without local file observes shared refuse");
}

// (2b) Shared file genuinely drives the value (not hardcoded refuse): flip
// to "warn" and confirm the worktree follows it.
writeJson(sharedPath, { mode: "warn" });
{
  const r = resolveChainPolicy({ start: linkedWt, env: baseEnv });
  ok(r.mode === "warn" && r.source === "shared", "worktree without local file observes shared warn (value genuinely comes from the shared file)");
}
writeJson(sharedPath, { mode: "refuse" }); // restore for subsequent scenarios

// (3) Conflicting local file -> conflict, fails closed, names both paths + hashes.
writeJson(localPath, { mode: "warn" });
{
  const r = resolveChainPolicy({ start: linkedWt, env: baseEnv });
  ok(r.mode === "refuse" && r.conflict === true && r.source === "conflict", "conflicting worktree-local file fails closed (never a silent override)");
  ok(r.reason.includes(localPath) && r.reason.includes(sharedPath), "conflict reason names both paths");
  ok(r.reason.includes(r.provenance.local_hash) && r.reason.includes(r.provenance.shared_hash), "conflict reason names both hashes");
  ok(r.provenance.local_hash === sha256(localPath) && r.provenance.shared_hash === sha256(sharedPath), "provenance hashes match actual file contents");
}

// (3b) Byte-identical local mirror is NOT a conflict; shared still decides
// (non-authoritative mirror, AC-549-4).
fs.copyFileSync(sharedPath, localPath);
{
  const r = resolveChainPolicy({ start: linkedWt, env: baseEnv });
  ok(r.mode === "refuse" && r.conflict === false && r.source === "shared", "byte-identical local mirror is accepted as non-authoritative, shared still decides");
}
rmIfExists(localPath);

// (4) Env override wins outright, even over a conflicting/refuse shared file.
{
  const envOverride = { ...baseEnv, SVC_CHAIN_POLICY: "warn" };
  const r = resolveChainPolicy({ start: linkedWt, env: envOverride });
  ok(r.mode === "warn" && r.source === "env", "SVC_CHAIN_POLICY=warn overrides the shared refuse file");
}
{
  const envInvalid = { ...baseEnv, SVC_CHAIN_POLICY: "sometimes" };
  const r = resolveChainPolicy({ start: linkedWt, env: envInvalid });
  ok(r.mode === "refuse" && r.source === "env-invalid", "invalid SVC_CHAIN_POLICY value fails closed rather than being ignored");
}

// (5) Owner-home fallback tier: no shared file, home file present.
rmIfExists(sharedPath);
writeJson(homePath, { mode: "warn" });
{
  const r = resolveChainPolicy({ start: linkedWt, env: baseEnv });
  ok(r.mode === "warn" && r.source === "home", "owner-home policy used when shared file is absent");
}
rmIfExists(homePath);

// (5b) Provenance report exposes every tier's path/hash/existence.
writeJson(sharedPath, { mode: "refuse" });
{
  const r = resolveChainPolicy({ start: linkedWt, env: baseEnv });
  const p = r.provenance;
  ok(
    p.shared_path === sharedPath && p.local_path === localPath && p.home_path === homePath &&
    p.git_common_dir === path.join(mainRepo, ".git") &&
    p.shared_exists === true && p.local_exists === false && p.home_exists === false &&
    p.shared_hash === sha256(sharedPath),
    "provenance report exposes every tier path/hash/existence",
  );
}

// Migration: seedSharedChainPolicy is idempotent and reproduces the source mode.
rmIfExists(sharedPath);
const canonicalLocal = path.join(mainRepo, ".svc", "chain-policy.json");
writeJson(canonicalLocal, { mode: "refuse", note: "canonical" });
{
  const seeded = seedSharedChainPolicy({ start: mainRepo, fromPath: canonicalLocal });
  ok(seeded.seeded === true && seeded.mode === "refuse" && fs.existsSync(sharedPath), "migration seeds the shared file from the canonical source");
  const again = seedSharedChainPolicy({ start: mainRepo, fromPath: canonicalLocal });
  ok(again.seeded === false, "migration is idempotent (no-op once shared file exists)");
  const r = resolveChainPolicy({ start: linkedWt, env: baseEnv });
  ok(r.mode === "refuse" && r.source === "shared", "linked worktree observes the freshly seeded shared policy");
}

fs.rmSync(scratch, { recursive: true, force: true });
process.exit(rc);
NODE
if [ $? -eq 0 ]; then pass "resolver matrix (missing/shared/conflict/env/provenance/migration)"; else fail "resolver matrix"; fi

# ---- CLI smoke: --mode is bash-capturable, diagnostics land on stderr --
node --input-type=module <<'NODE'
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "wi549-chain-policy-cli-"));
const repo = path.join(scratch, "repo");
fs.mkdirSync(repo, { recursive: true });
const git = (args) => execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
git(["init", "-q", "-b", "main"]);
git(["config", "user.email", "wi549@example.invalid"]);
git(["config", "user.name", "WI-549 fixture"]);
fs.writeFileSync(path.join(repo, "f.txt"), "x\n");
git(["add", "f.txt"]);
git(["commit", "-qm", "x"]);

const env = { ...process.env, HOME: path.join(scratch, "home") };
delete env.SVC_CHAIN_POLICY;
fs.mkdirSync(env.HOME, { recursive: true });

let rc = 0;
const ok = (cond, msg) => { if (!cond) { console.log(`  ✗ ${msg}`); rc = 1; } else { console.log(`  ✓ ${msg}`); } };

// Missing everywhere: --mode prints bare "refuse" on stdout; diagnostic on stderr.
{
  const result = execFileSync(process.execPath, [path.resolve("scripts/lib/chain-policy.mjs"), "--repo", repo, "--mode"], { encoding: "utf8", env, cwd: scratch, stdio: ["ignore", "pipe", "pipe"] });
  ok(result.trim() === "refuse", "CLI --mode prints bare mode on stdout");
}
{
  const proc = execFileSync(process.execPath, [path.resolve("scripts/lib/chain-policy.mjs"), "--repo", repo], { encoding: "utf8", env, cwd: scratch });
  const parsed = JSON.parse(proc);
  ok(parsed.mode === "refuse" && parsed.source === "fail-closed", "CLI default JSON output resolves fail-closed refuse");
}
fs.rmSync(scratch, { recursive: true, force: true });
process.exit(rc);
NODE
if [ $? -eq 0 ]; then pass "CLI --mode / JSON smoke"; else fail "CLI smoke"; fi

echo ""
echo "shared-chain-policy: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
