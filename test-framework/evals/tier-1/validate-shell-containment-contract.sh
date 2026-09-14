#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
MODULE="$ROOT/scripts/validate-host-authority-capabilities.mjs"
if [[ ! -f "$MODULE" ]]; then
  echo "WI502-RED shell-containment: host containment capability validator missing"
  exit 1
fi

node --input-type=module - "$ROOT" <<'NODE'
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.argv[2];
const scope = await import(pathToFileURL(path.join(root, "hooks/lib/operation-scope.mjs")));
const authorityRoot = path.join(root, ".worktrees", "fixture-authority");
for (const command of [
  "git -C /another/repo status",
  "cd /another/repo && touch x",
  "pushd /another/repo; touch x",
  "touch /another/repo/x",
  "printf x > /another/repo/x",
]) {
  const result = scope.analyzeShellBoundary(command, { authorityRoot });
  assert.equal(result.ok, false, command);
}
assert.equal(scope.analyzeShellBoundary("node scripts/check.mjs", { authorityRoot }).completeContainment, false);

for (const name of ["antigravity", "claude", "codex", "cursor", "gemini", "kimi", "mimo-code", "opencode"]) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "provision/hosts", `${name}.json`), "utf8"));
  assert.ok(manifest.authority_capabilities, `${name} missing authority_capabilities`);
  assert.equal(typeof manifest.authority_capabilities.stable_session_identity, "boolean");
  assert.ok(["sandbox", "wrapper", "none"].includes(manifest.authority_capabilities.filesystem_containment));
  if (manifest.authority_capabilities.mutating_child_execution) {
    assert.notEqual(manifest.authority_capabilities.filesystem_containment, "none");
    assert.equal(manifest.authority_capabilities.stable_child_identity, true);
  }
}
const docs = ["DOCTRINE.md", "WORKTREES.md", "references/host-capabilities.md"]
  .map((file) => fs.readFileSync(path.join(root, file), "utf8")).join("\n");
assert.match(docs, /authority guardrail, not a complete shell security boundary/i);
console.log("TIER-1 PASS: shell rejection and host containment contract");
NODE

node "$MODULE" --root "$ROOT"

TMP="$(mktemp -d)"
mkdir -p "$TMP/allowed" "$TMP/outside"
if node "$ROOT/scripts/svc-contained-exec.mjs" probe >/dev/null 2>&1; then
  set +e
  node "$ROOT/scripts/svc-contained-exec.mjs" run --root "$TMP/allowed" -- \
    sh -c 'touch inside.txt; touch "$1/escaped.txt"' sh "$TMP/outside" >/dev/null 2>"$TMP/denial.log"
  RC=$?
  set -e
  test "$RC" -ne 0
  test -f "$TMP/allowed/inside.txt"
  test ! -e "$TMP/outside/escaped.txt"
  grep -Eqi 'not permitted|permission denied' "$TMP/denial.log"
  git -C "$TMP/allowed" init -q
  git -C "$TMP/allowed" config user.name fixture
  git -C "$TMP/allowed" config user.email fixture@example.test
  node "$ROOT/scripts/svc-contained-exec.mjs" run --root "$TMP/allowed" -- \
    sh -c 'printf "contained\n" > committed.txt && git -C "$PWD" add committed.txt && git -C "$PWD" commit -qm contained'
  test "$(git -C "$TMP/allowed" show HEAD:committed.txt)" = "contained"
  echo "TIER-1 PASS: Landlock wrapper denied an actual outside-root write"
else
  echo "TIER-1 SKIP: behavioral Landlock probe unavailable; delegated mutation remains fail-closed"
fi
