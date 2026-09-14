#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
CHECKER="$ROOT/scripts/check-chain-receipts.mjs"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

node --input-type=module - "$CHECKER" <<'NODE'
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const moduleUrl = pathToFileURL(process.argv[2]).href;
const {
  RangeConfigError,
  checkShasWithPool,
  interpretWorkerOutput,
  resolveRangeConcurrency,
  resolveRangeWorkerTimeout,
} = await import(moduleUrl);
const {
  missingFromReceiptResult,
  unavailableReceiptResult,
  validateReceiptChildResult,
  validateReceiptResultCoverage,
} = await import(
  new URL("lib/reconcile-core.mjs", moduleUrl)
);

assert.equal(resolveRangeConcurrency({}, 0), 1);
assert.equal(resolveRangeConcurrency({}, undefined), 1);
assert.equal(resolveRangeConcurrency({}, 32), 8);
assert.equal(resolveRangeConcurrency({ SVC_RECEIPT_RANGE_CONCURRENCY: "99" }, 4), 16);
assert.throws(
  () => resolveRangeConcurrency({ SVC_RECEIPT_RANGE_CONCURRENCY: "abc" }, 4),
  RangeConfigError,
);
assert.equal(resolveRangeWorkerTimeout({}), 5000);
assert.equal(resolveRangeWorkerTimeout({ SVC_RECEIPT_RANGE_WORKER_TIMEOUT_MS: "99" }), 1000);
assert.throws(
  () => resolveRangeWorkerTimeout({ SVC_RECEIPT_RANGE_WORKER_TIMEOUT_MS: "slow" }),
  RangeConfigError,
);

const shas = ["a".repeat(40), "b".repeat(40), "c".repeat(40), "d".repeat(40)];
let active = 0;
let maxActive = 0;
const delays = [40, 30, 20, 10];
const ordered = await checkShasWithPool(shas, 2, async (sha, index) => {
  active += 1;
  maxActive = Math.max(maxActive, active);
  await new Promise((resolve) => setTimeout(resolve, delays[index]));
  active -= 1;
  return { sha, ok: true, type: "complete" };
});
assert.deepEqual(ordered.map((row) => row.sha), shas);
assert.equal(maxActive, 2);

const failed = await checkShasWithPool(shas, 2, async (sha, index) => {
  if (index === 1) throw new Error("fixture failure");
  return { sha, ok: true, type: "complete" };
});
assert.equal(failed[1].sha, shas[1]);
assert.equal(failed[1].ok, false);
assert.equal(failed[1].type, "worker-error");
assert.match(failed[1].missing[0], /fixture failure/);
await assert.rejects(() => checkShasWithPool(shas, 0, async () => ({})), RangeConfigError);

const requested = "e".repeat(40);
const workerFailures = [
  interpretWorkerOutput(requested, null, "", 5000),
  interpretWorkerOutput(requested, null, "not-json", 5000),
  interpretWorkerOutput(requested, null, '{"results":[]}', 5000),
  interpretWorkerOutput(requested, null, `{"results":[{"sha":"${requested}"},{"sha":"${requested}"}]}`, 5000),
  interpretWorkerOutput(requested, null, `{"results":[{"sha":"${"f".repeat(40)}","ok":true}]}`, 5000),
  interpretWorkerOutput(requested, { killed: true, code: "ETIMEDOUT" }, "", 5000),
  interpretWorkerOutput(requested, { code: 2 }, `{"results":[{"sha":"${requested}","ok":true}]}`, 5000),
  interpretWorkerOutput(requested, { code: "ERR_CHILD_PROCESS_STDIO_MAXBUFFER" }, "", 5000),
  interpretWorkerOutput(requested, { code: 1 }, `{"ok":false,"results":[{"sha":"${requested}","ok":true}]}`, 5000),
  interpretWorkerOutput(requested, null, `{"ok":false,"results":[{"sha":"${requested}","ok":true}]}`, 5000),
];
for (const row of workerFailures) {
  assert.equal(row.sha, requested);
  assert.equal(row.ok, false);
  assert.equal(row.type, "worker-error");
  assert.equal(row.infrastructure, true);
}
const expectedFailure = interpretWorkerOutput(
  requested,
  { code: 1 },
  `{"ok":false,"results":[{"sha":"${requested}","ok":false,"type":"invalid","missing":["receipt"]}]}`,
  5000,
);
assert.equal(expectedFailure.type, "invalid");
assert.deepEqual(
  missingFromReceiptResult({ results: [workerFailures[0]] })[0],
  {
    sha: requested,
    missing: workerFailures[0].missing,
    infrastructure: true,
    classification: "receipt-validation-unavailable",
  },
);
const childTimeout = unavailableReceiptResult([requested], "timeout");
assert.deepEqual(childTimeout.infrastructure_failures, [requested]);
assert.equal(missingFromReceiptResult(childTimeout)[0].classification, "receipt-validation-unavailable");

const second = "f".repeat(40);
const completeRows = [
  { sha: requested, ok: true, type: "complete", missing: [] },
  { sha: second, ok: true, type: "complete", missing: [] },
];
assert.equal(
  validateReceiptResultCoverage({ ok: true, results: completeRows }, [requested, second]).ok,
  true,
);
for (const malformed of [
  { ok: true, results: completeRows.slice(0, 1) },
  { ok: true, results: [completeRows[0], completeRows[0]] },
  { ok: true, results: [...completeRows].reverse() },
  { ok: false, results: completeRows },
]) {
  const rejected = validateReceiptResultCoverage(malformed, [requested, second]);
  assert.equal(rejected.ok, false);
  assert.deepEqual(rejected.infrastructure_failures, [requested, second]);
  assert.equal(rejected.results.every((row) => row.infrastructure === true), true);
}
const semanticDebt = {
  ok: false,
  results: [
    { sha: requested, ok: false, type: "invalid", missing: ["receipt"] },
    completeRows[1],
  ],
};
assert.equal(
  validateReceiptChildResult(
    { classification: "success", status: 0 },
    { ok: true, results: completeRows },
    [requested, second],
  ).ok,
  true,
);
assert.equal(
  validateReceiptChildResult(
    { classification: "error", status: 1 },
    semanticDebt,
    [requested, second],
  ),
  semanticDebt,
);
for (const [processResult, decoded] of [
  [{ classification: "timeout", status: null }, { ok: true, results: completeRows }],
  [{ classification: "spawn-error", status: null }, { ok: true, results: completeRows }],
  [{ classification: "error", status: 2 }, { ok: true, results: completeRows }],
  [{ classification: "success", status: 0 }, semanticDebt],
  [{ classification: "error", status: 1 }, { ok: true, results: completeRows }],
]) {
  const rejected = validateReceiptChildResult(processResult, decoded, [requested, second]);
  assert.equal(rejected.ok, false);
  assert.deepEqual(rejected.infrastructure_failures, [requested, second]);
}
NODE

REPO="$TMP/repo"
mkdir -p "$REPO"
export GIT_CONFIG_GLOBAL=/dev/null
export GIT_CONFIG_SYSTEM=/dev/null
git -C "$REPO" init -q
git -C "$REPO" config user.name "SVC Fixture"
git -C "$REPO" config user.email "svc-fixture@example.invalid"
echo root > "$REPO/state.txt"
git -C "$REPO" add state.txt
git -C "$REPO" commit -qm root
BASE="$(git -C "$REPO" rev-parse HEAD)"

for n in {1..16}; do
  echo "$n" >> "$REPO/state.txt"
  git -C "$REPO" add state.txt
  git -C "$REPO" commit -qm "fixture $n"
  SHA="$(git -C "$REPO" rev-parse HEAD)"
  ENVELOPE="$(node - "$n" <<'NODE'
const n = process.argv[2];
const timestamp = "2026-01-01T00:00:00.000Z";
const wi = "WI-FIXTURE";
const receipt = (receipt_type, extra = {}) => ({ receipt_type, schema_version: 1, wi, timestamp, ...extra });
process.stdout.write(JSON.stringify({
  "plan-manifest": receipt("plan-manifest", {
    mode: "inline", scope: [], dependencies: [], decision_trace: [],
    task_graph: {}, validation_plan: [], risk_rollback: {}, execution_command_sequence: [],
  }),
  "review-plan": receipt("review-plan", {
    self_review: {}, adversarial_review: {}, verdict: "pass",
  }),
  "exec-record": receipt("exec-record", {
    diff_hash: `legacy-${n}`, files_touched: ["state.txt"], dispatch_model: "fixture",
  }),
  "review-exec": receipt("review-exec", {
    diff_hash: `legacy-${n}`, self_review: {}, adversarial_review: {}, verdict: "pass",
  }),
  "audit-implementation": receipt("audit-implementation", {
    verdict: "pass", findings: [],
  }),
}));
NODE
)"
  git -C "$REPO" notes --ref=svc-receipts add -m "$ENVELOPE" "$SHA"
done

HEAD_SHA="$(git -C "$REPO" rev-parse HEAD)"
rm -rf "$REPO/.svc/receipts"
(
  cd "$REPO"
  SVC_RECEIPT_RANGE_CONCURRENCY=8 node "$CHECKER" --range "$BASE..$HEAD_SHA" > "$TMP/first.json"
)

BASE="$BASE" HEAD_SHA="$HEAD_SHA" node - "$TMP/first.json" "$REPO" <<'NODE'
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const result = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const repo = process.argv[3];
const expected = execFileSync("git", ["log", "--format=%H", `${process.env.BASE}..${process.env.HEAD_SHA}`], {
  cwd: repo, encoding: "utf8",
}).trim().split("\n");
assert.equal(result.ok, true);
assert.deepEqual(result.results.map((row) => row.sha), expected);
assert.equal(result.results.length, 16);
for (const row of result.results) {
  const dir = path.join(repo, ".svc", "receipts", row.sha.slice(0, 7));
  for (const file of fs.readdirSync(dir)) JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
}
const residue = execFileSync("find", [path.join(repo, ".svc", "receipts"), "-type", "f"], { encoding: "utf8" })
  .split("\n").filter((file) => /\.(tmp|partial)$/.test(file));
assert.deepEqual(residue, []);
NODE

receipt_tree_hash() {
  node - "$REPO/.svc/receipts" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const root = process.argv[2];
const files = [];
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else files.push(full);
  }
};
walk(root);
const hash = crypto.createHash("sha256");
for (const file of files.sort()) {
  hash.update(path.relative(root, file));
  hash.update(fs.readFileSync(file));
}
process.stdout.write(hash.digest("hex"));
NODE
}
BEFORE_HASH="$(receipt_tree_hash)"
(
  cd "$REPO"
  SVC_RECEIPT_RANGE_CONCURRENCY=8 node "$CHECKER" --range "$BASE..$HEAD_SHA" > "$TMP/second.json"
)
AFTER_HASH="$(receipt_tree_hash)"
test "$BEFORE_HASH" = "$AFTER_HASH"
diff -u "$TMP/first.json" "$TMP/second.json"

(
  cd "$REPO"
  SINGLE_BASE="$(git rev-parse "$HEAD_SHA^")"
  SVC_RECEIPT_RANGE_CONCURRENCY=abc node "$CHECKER" --sha "$HEAD_SHA" >/dev/null
  if SVC_RECEIPT_RANGE_CONCURRENCY=abc node "$CHECKER" --range "$SINGLE_BASE..$HEAD_SHA" >/dev/null 2>&1; then
    echo "FAIL: malformed single-SHA range policy passed" >&2
    exit 1
  fi
  if node "$CHECKER" --sha "$HEAD_SHA" --range "$SINGLE_BASE..$HEAD_SHA" >/dev/null 2>&1; then
    echo "FAIL: mixed --sha/--range invocation passed" >&2
    exit 1
  fi
)
if (cd "$REPO" && SVC_RECEIPT_RANGE_WORKER=1 node "$CHECKER" --range "$BASE..$HEAD_SHA" >/dev/null 2>&1); then
  echo "FAIL: recursive range worker invocation passed" >&2
  exit 1
fi

ln -s "$CHECKER" "$TMP/check-chain-receipts-link.mjs"
(
  cd "$REPO"
  node "$TMP/check-chain-receipts-link.mjs" --sha "$HEAD_SHA" > "$TMP/symlink.json"
)
node -e 'const j=require(process.argv[1]); if(!j.ok || j.results.length!==1) process.exit(1)' "$TMP/symlink.json"
node -e 'const j=require(process.argv[1]); if(Object.hasOwn(j,"infrastructure_failures")) process.exit(1)' "$TMP/symlink.json"

echo "PASS: bounded ordered receipt-range workers"
