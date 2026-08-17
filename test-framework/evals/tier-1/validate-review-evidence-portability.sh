#!/usr/bin/env bash
# WI-547: external-review bytes survive worktree deletion via digest store.
# validator_path: test-framework/evals/tier-1/validate-review-evidence-portability.sh
# failure_class: review evidence bound to execution worktree absolute paths
# promotion_signal: observed 2026-08-17 on WI-542 f27a143a from canonical main
# expected_runtime_budget: <5s, no network, no reviewer dispatch
# why_tier_2_or_targeted_is_insufficient: check-chain-receipts is a land/hot-path gate
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
chmod 700 "$TMP"

# Relocate / verify must never launch a reviewer.
if rg -n 'dispatch-agy|run-external-review' \
  "$ROOT/scripts/lib/review-evidence-store.mjs" \
  "$ROOT/scripts/relocate-review-evidence.mjs" >/tmp/wi547-dispatch.txt; then
  echo "FAIL: store/relocate launches a reviewer" >&2
  cat /tmp/wi547-dispatch.txt >&2
  exit 1
fi

node --input-type=module - "$ROOT" "$TMP" <<'NODE'
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const [root, tmp] = process.argv.slice(2);
const sha = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const storeRoot = path.join(tmp, "store");
const env = { ...process.env, SVC_REVIEW_EVIDENCE_STORE: storeRoot };
const storeUrl = pathToFileURL(path.join(root, "scripts/lib/review-evidence-store.mjs"));
const { relocateTree, getObject, lookupRelocation } = await import(storeUrl.href);

const historicalDir = path.join(tmp, "worktree", ".svc", "external-review-artifacts", "plan", "deadbeef");
fs.mkdirSync(historicalDir, { recursive: true, mode: 0o700 });
const receiptPath = path.join(historicalDir, "receipt.json");
const findingsPath = path.join(historicalDir, "findings.json");
const payload = Buffer.from('{"ok":true,"id":"plan-fixture"}\n');
const findings = Buffer.from('{"verdict":"pass"}\n');
fs.writeFileSync(receiptPath, payload, { mode: 0o600 });
fs.writeFileSync(findingsPath, findings, { mode: 0o600 });

const first = relocateTree(historicalDir, { start: tmp, env, kind: "plan" });
assert.equal(first.length, 2);
const second = relocateTree(historicalDir, { start: tmp, env, kind: "plan" });
assert.equal(second.every((row) => row.created === false), true, "relocate is not idempotent");

const mapped = lookupRelocation(receiptPath, { start: tmp, env });
assert.equal(mapped.sha256, sha(payload));
assert.equal(getObject(mapped.sha256, { start: tmp, env }).bytes.equals(payload), true);

fs.rmSync(path.join(tmp, "worktree"), { recursive: true, force: true });
const afterDelete = getObject(mapped.sha256, { start: tmp, env });
assert.equal(afterDelete.bytes.equals(payload), true, "object vanished after worktree delete");

const { resolveEvidenceBytes } = await import(storeUrl.href);
const loaded = resolveEvidenceBytes(
  { path: ".svc/external-review-artifacts/plan/deadbeef/receipt.json", sha256: sha(payload) },
  { start: tmp, env, extraPaths: [receiptPath] },
);
assert.equal(loaded.sha256, sha(payload));

assert.throws(() => {
  const tampered = path.join(storeRoot, "objects", mapped.sha256.slice(0, 2), mapped.sha256.slice(2));
  fs.chmodSync(tampered, 0o600);
  fs.writeFileSync(tampered, Buffer.from("nope"));
  getObject(mapped.sha256, { start: tmp, env });
}, /tampered/);

const linkDir = path.join(tmp, "link-src");
fs.mkdirSync(linkDir, { mode: 0o700 });
fs.writeFileSync(path.join(linkDir, "x"), "x", { mode: 0o600 });
const link = path.join(tmp, "link");
fs.symlinkSync(linkDir, link, "dir");
assert.throws(() => relocateTree(link, { start: tmp, env }), /symlink/);

const relocate = spawnSync(process.execPath, [
  path.join(root, "scripts/relocate-review-evidence.mjs"),
  "--from", historicalDir,
], { env, encoding: "utf8" });
assert.notEqual(relocate.status, 0, "relocating a deleted source dir should fail");
NODE

echo "PASS: review-evidence portability (digest store, legacy relocate, worktree delete, tamper, symlink)"
