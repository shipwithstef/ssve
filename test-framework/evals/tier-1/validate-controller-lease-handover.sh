#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
MODULE="$ROOT/hooks/lib/authority-store.mjs"
if [[ ! -f "$MODULE" ]]; then
  echo "WI502-RED controller-lease: durable authority store missing"
  exit 1
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

node --input-type=module - "$ROOT" "$TMP" <<'NODE'
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const [root, tmp] = process.argv.slice(2);
process.env.NODE_ENV = "test";
const auth = await import(pathToFileURL(path.join(root, "hooks/lib/authority-store.mjs")));
const stateRoot = path.join(tmp, "authority");
const worktree = path.join(tmp, "worktree");
fs.mkdirSync(worktree);
execFileSync("git", ["-C", worktree, "init", "-q"]);
execFileSync("git", ["-C", worktree, "config", "user.name", "fixture"]);
execFileSync("git", ["-C", worktree, "config", "user.email", "fixture@example.test"]);
fs.writeFileSync(path.join(worktree, "README.md"), "fixture\n");
execFileSync("git", ["-C", worktree, "add", "README.md"]);
execFileSync("git", ["-C", worktree, "commit", "-qm", "fixture"]);
const repoId = auth.repositoryId(worktree);
const a = auth.principalId({ host: "codex", session_id: "session-a" });
const b = auth.principalId({ host: "codex", session_id: "session-b" });
assert.notEqual(a, b);
assert.throws(() => auth.principalId({ host: "codex", session_id: "" }), /stable.*session/i);

const created = auth.bootstrapController({ stateRoot, repoId, wi: "WI-502", worktreeRoot: worktree, principal: a, ttlMs: 60_000 });
assert.equal(created.schema_version, 2);
assert.equal(created.generation, 1);
assert.equal(created.backend_revision, 1);
const resumed = auth.resumeController({ stateRoot, repoId, wi: "WI-502", worktreeRoot: worktree, principal: a });
assert.equal(resumed.generation, 1);
assert.ok(resumed.backend_revision > created.backend_revision);
assert.throws(() => auth.resumeController({ stateRoot, repoId, wi: "WI-502", worktreeRoot: worktree, principal: b }), /principal/i);

const prepared = auth.prepareHandover({ stateRoot, repoId, wi: "WI-502", principal: a, intendedPrincipal: b, ttlMs: 60_000 });
assert.ok(prepared.token);
assert.ok(!JSON.stringify(prepared.record).includes(prepared.token));
const accepted = auth.acceptHandover({ stateRoot, repoId, wi: "WI-502", principal: b, token: prepared.token });
assert.equal(accepted.lease.controller_principal, b);
assert.equal(accepted.lease.generation, 2);
assert.equal(accepted.receipt.old_controller_principal, a);
assert.throws(() => auth.acceptHandover({ stateRoot, repoId, wi: "WI-502", principal: b, token: prepared.token }), /consumed|missing|invalid/i);
assert.throws(() => auth.resumeController({ stateRoot, repoId, wi: "WI-502", worktreeRoot: worktree, principal: a }), /principal/i);

fs.mkdirSync(path.join(worktree, ".svc"), { recursive: true });
fs.writeFileSync(path.join(worktree, ".svc", "lane-tasks-WI-502.json"), JSON.stringify({
  schema_version: 1, wi: "WI-502", lane: "framework", status: "in_progress",
  tasks: [{ id: 1, status: "in_progress", skill: "review-exec", subject: "fixture", blocked_by: [] }],
}, null, 2));
const resolver = await import(pathToFileURL(path.join(root, "hooks/lib/resolve-wi.mjs")));
assert.equal(resolver.resolveAuthorityHost({}, { CLAUDE_SESSION_ID: "claude-session" }), "claude");
const handed = resolver.resolveWI({ cwd: worktree, session_id: "session-b", host: "codex" }, {
  ...process.env, PWD: worktree, SVC_AUTHORITY_STATE_ROOT: stateRoot, SVC_REQUIRE_SESSION_BINDING: "1",
});
assert.equal(handed.authority, true, handed.reason);
assert.equal(handed.tuple.authority_generation, 2);
assert.equal(handed.tuple.principal_id, b);
const oldOwner = resolver.resolveWI({ cwd: worktree, session_id: "session-a", host: "codex" }, {
  ...process.env, PWD: worktree, SVC_AUTHORITY_STATE_ROOT: stateRoot, SVC_REQUIRE_SESSION_BINDING: "1",
});
assert.equal(oldOwner.authority, false);

assert.throws(() => auth.recoverController({ stateRoot, repoId, wi: "WI-502", principal: a, reason: "guess", evidence: { owner_live: true } }), /live|expiry/i);
assert.throws(() => auth.recoverController({ stateRoot, repoId, wi: "WI-502", principal: a, reason: "fabricated", evidence: { same_host_dead: true, process_identity: "dead" } }), /live|expiry/i);
const current = auth.readController({ stateRoot, repoId, wi: "WI-502" });
const expired = { ...current, owner_process: { hostname: (await import("node:os")).hostname(), pid: 99999999, start_token: "dead" }, renewed_at: "2020-01-01T00:00:00.000Z", expires_at: "2020-01-01T00:00:01.000Z" };
auth.writeControllerForTest({ stateRoot, lease: expired, expectedRevision: current.backend_revision });
const recovered = auth.recoverController({ stateRoot, repoId, wi: "WI-502", principal: a, reason: "expired", evidence: { expired: true } });
assert.equal(recovered.lease.generation, 3);
assert.equal(recovered.lease.controller_principal, a);

const v1 = path.join(tmp, "claim.json");
fs.writeFileSync(v1, JSON.stringify({ wi: "WI-502", session_id: "session-aaaaaaaa", generation: 9 }) + "\n", { mode: 0o600 });
const before = fs.readFileSync(v1);
const previousNodeEnv = process.env.NODE_ENV;
process.env.NODE_ENV = "production";
const migration = auth.migrateV1Claim({ stateRoot: path.join(tmp, "migration"), claimPath: v1, repoId, worktreeRoot: worktree, host: "codex" });
if (previousNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousNodeEnv;
assert.equal(migration.lease.generation, 9);
assert.ok(fs.existsSync(migration.backup_path));
fs.writeFileSync(v1, "changed\n");
auth.rollbackV1Migration({ migrationReceiptPath: migration.receipt_path });
assert.deepEqual(fs.readFileSync(v1), before);
assert.equal(auth.readController({ stateRoot: path.join(tmp, "migration"), repoId, wi: "WI-502" }), null);

const staleState = path.join(tmp, "stale-lock");
const staleKey = (await import("node:crypto")).createHash("sha256").update(`${repoId}\0WI-LOCK`).digest("hex");
fs.mkdirSync(path.join(staleState, "locks"), { recursive: true });
fs.writeFileSync(path.join(staleState, "locks", `${staleKey}.lock`), `99999999\n${(await import("node:os")).hostname()}\ndead\n2020-01-01T00:00:00.000Z\n`, { mode: 0o600 });
const reclaimed = auth.bootstrapController({ stateRoot: staleState, repoId, wi: "WI-LOCK", worktreeRoot: worktree, principal: a });
assert.equal(reclaimed.state, "active");

console.log("TIER-1 PASS: controller lease resume handover recovery and migration");
NODE
