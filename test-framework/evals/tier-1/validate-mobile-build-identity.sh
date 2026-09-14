#!/usr/bin/env bash
set -euo pipefail

echo "=== Tier 1: Mobile build identity, artifact, and release lifecycle ==="

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
ENGINE="$ROOT/scripts/mobile-build-identity.mjs"
SCHEMA="$ROOT/schemas/mobile-build-contract.schema.json"
REFERENCE="$ROOT/references/mobile-worktree-builds.md"
TMP="$(mktemp -d)"
OUTSIDE="${TMP}-outside"
trap 'rm -rf "$TMP" "$OUTSIDE"' EXIT
PASS=0

ok() { PASS=$((PASS + 1)); echo "  ✓ $1"; }
fail() { echo "  ✗ $1" >&2; exit 1; }
expect_exit() {
  local expected="$1" label="$2"; shift 2
  local capture="$TMP/negative-${BASHPID}-${RANDOM}"
  set +e
  "$@" >"$capture.stdout" 2>"$capture.stderr"
  local actual=$?
  set -e
  [[ "$actual" -eq "$expected" ]] || fail "$label exited $actual, expected $expected ($(cat "$capture.stderr"))"
}
mutate_json() {
  local source="$1" target="$2" expression="$3"
  node --input-type=module - "$source" "$target" "$expression" <<'NODE'
import fs from "node:fs";
const [source, target, expression] = process.argv.slice(2);
const row = JSON.parse(fs.readFileSync(source));
Function("row", expression)(row);
fs.writeFileSync(target, JSON.stringify(row));
NODE
}
mutate_pair() {
  local receipt_source="$1" metadata_source="$2" receipt_target="$3" metadata_target="$4" expression="$5"
  node --input-type=module - "$receipt_source" "$metadata_source" "$receipt_target" "$metadata_target" "$expression" <<'NODE'
import fs from "node:fs";
const [receiptSource, metadataSource, receiptTarget, metadataTarget, expression] = process.argv.slice(2);
for (const [source, target] of [[receiptSource, receiptTarget], [metadataSource, metadataTarget]]) {
  const row = JSON.parse(fs.readFileSync(source));
  Function("row", expression)(row);
  fs.writeFileSync(target, JSON.stringify(row));
}
NODE
}

node --check "$ENGINE"
python3 -c 'import json,sys; json.load(open(sys.argv[1], encoding="utf-8"))' "$SCHEMA"
grep -q '"maximum": 2100000000' "$SCHEMA" || fail "schema omits Android code ceiling"
grep -q 'reserved -> built -> committed' "$REFERENCE" || fail "reference omits release state machine"
ok "engine, schema, validator, and lifecycle doctrine parse"

cat >"$TMP/fake-adapter.mjs" <<'NODE'
#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
const command = process.argv[2];
const allowed = new Set(["prepare-dev", "build-dev", "inspect", "allocate-release", "build-release"]);
if (!allowed.has(command)) process.exit(2);
fs.appendFileSync(process.env.FAKE_ADAPTER_LOG, `${JSON.stringify({command, argv: process.argv.slice(2)})}\n`);
const allocation = JSON.parse(fs.readFileSync(process.env.FAKE_ALLOCATION));
const platform = allocation.platform ?? process.env.FAKE_PLATFORM ?? "android";
const filename = allocation.mode === "release" ? allocation.artifact_filename : allocation.artifacts[platform];
if (command === "prepare-dev") {
  fs.mkdirSync(".fake-adapter", {recursive: true});
  fs.writeFileSync(".fake-adapter/prepared.json", JSON.stringify({
    source_sha: allocation.source_sha, branch_hash: allocation.branch_hash, platform
  }));
} else if (command === "allocate-release") {
  fs.mkdirSync(".fake-adapter", {recursive: true});
  fs.appendFileSync(".fake-adapter/release-inputs.jsonl", `${JSON.stringify({
    code: allocation.code, source_sha: allocation.source_sha, platform,
    remote_floor: allocation.remote_floor, ledger_floor: allocation.ledger_floor
  })}\n`);
} else if (command === "build-dev" || command === "build-release") {
  fs.writeFileSync(filename, `adapter artifact:${allocation.mode}:${allocation.code}:${allocation.source_sha}:${platform}\n`);
} else if (command === "inspect") {
  const bytes = fs.readFileSync(filename);
  const row = {
    schema_version: 1, mode: allocation.mode, project: allocation.project, platform,
    application_id: allocation.application_id, version_code: allocation.code,
    build_number: allocation.code, version_name: allocation.version_name,
    display_name: allocation.display_name, source_sha: allocation.source_sha,
    timestamp: allocation.timestamp, artifact_path: filename,
    artifact_filename: filename,
    artifact_sha256: crypto.createHash("sha256").update(bytes).digest("hex")
  };
  if (platform === "ios" && allocation.bundle_id) row.bundle_id = allocation.bundle_id;
  if (allocation.mode === "dev") {
    row.branch_slug = allocation.branch_slug;
    row.branch_hash = allocation.branch_hash;
  } else {
    row.status = process.env.FAKE_STATUS ?? "built";
    row.remote_floor = allocation.remote_floor;
    row.ledger_floor = allocation.ledger_floor;
  }
  process.stdout.write(`${JSON.stringify(row)}\n`);
}
NODE

CONTRACT="$TMP/contract.json"
cat >"$CONTRACT" <<'JSON'
{
  "schema_version": 1,
  "project": "fixture-app",
  "platforms": ["android", "ios"],
  "canonical_identity": {
    "application_id": "dev.svc.fixture",
    "bundle_id": "dev.svc.fixture",
    "display_name": "Fixture"
  },
  "development": {
    "id_suffix_template": ".wt_{branch_slug}_{branch_hash}",
    "label_template": "Fixture [{branch_slug}-{branch_hash}]",
    "artifact_template": "{project}-dev-{branch_slug}-{branch_hash}-{timestamp}-{code}-{source_short_sha}-{platform}.artifact",
    "state_file": "tmp/dev-state.json",
    "max_code": 2100000000,
    "signing_profile": "debug"
  },
  "release": {
    "ledger": "release/ledger.json",
    "monotonic_floor_source": "max",
    "artifact_template": "{project}-release-{timestamp}-{code}-{source_short_sha}-{platform}.artifact"
  },
  "commands": {
    "prepare_dev": ["node", "fake-adapter.mjs", "prepare-dev"],
    "build_dev": ["node", "fake-adapter.mjs", "build-dev"],
    "inspect_artifact": ["node", "fake-adapter.mjs", "inspect"],
    "allocate_release": ["node", "fake-adapter.mjs", "allocate-release"],
    "build_release": ["node", "fake-adapter.mjs", "build-release"]
  }
}
JSON

# The invoker is the adapter boundary used below. It reads the configured argv
# and executes it directly with shell:false; no command string is evaluated.
cat >"$TMP/invoke-adapter.mjs" <<'NODE'
import fs from "node:fs";
import { spawnSync } from "node:child_process";
const [contractPath, commandName, allocationPath, cwd, status = ""] = process.argv.slice(2);
const contract = JSON.parse(fs.readFileSync(contractPath));
const argv = contract.commands[commandName];
if (!Array.isArray(argv) || argv.length === 0) process.exit(2);
const result = spawnSync(argv[0], argv.slice(1), {
  cwd,
  env: {
    ...process.env,
    FAKE_ADAPTER_LOG: process.env.FAKE_ADAPTER_LOG,
    FAKE_ALLOCATION: allocationPath,
    FAKE_STATUS: status
  },
  encoding: "utf8",
  shell: false
});
process.stdout.write(result.stdout ?? "");
process.stderr.write(result.stderr ?? "");
process.exit(result.status ?? 1);
NODE
export FAKE_ADAPTER_LOG="$TMP/adapter.jsonl"
run_adapter() {
  local command_name="$1" allocation="$2" status="${3:-}"
  node "$TMP/invoke-adapter.mjs" "$CONTRACT" "$command_name" "$allocation" "$TMP" "$status"
}

SHA="0123456789abcdef0123456789abcdef01234567"
SHA2="1123456789abcdef0123456789abcdef01234567"
SHA3="2123456789abcdef0123456789abcdef01234567"
SHA4="3123456789abcdef0123456789abcdef01234567"
NOW=1784023200

node "$ENGINE" derive --contract "$CONTRACT" --branch 'Feature/Login UI' --sha "$SHA" --now "$NOW" >"$TMP/derive-a.json"
node --input-type=module - "$TMP/derive-a.json" <<'NODE'
import assert from "node:assert/strict";
import fs from "node:fs";
const a = JSON.parse(fs.readFileSync(process.argv[2]));
assert.match(a.branch_slug, /^[a-z0-9_]{1,18}$/);
assert.match(a.branch_hash, /^[0-9a-f]{8}$/);
assert.match(a.application_id, /\.wt_[a-z0-9_]+_[0-9a-f]{8}$/);
NODE
# Run the 100-case vector against the engine's actual derive function in one
# bounded Node process. The temporary test module removes only the CLI tail and
# exports deriveIdentity; representative calls above still cover CLI parsing.
node --input-type=module - "$ENGINE" "$CONTRACT" "$TMP/engine-under-test.mjs" "$SHA" "$NOW" <<'NODE'
import assert from "node:assert/strict";
import fs from "node:fs";
import {pathToFileURL} from "node:url";
const [enginePath, contractPath, modulePath, sha, now] = process.argv.slice(2);
const source = fs.readFileSync(enginePath, "utf8");
const testable = source.replace(/\nmain\(\)\.catch\([\s\S]*$/, "\nexport { deriveIdentity };\n");
assert.notEqual(testable, source, "engine CLI tail extraction failed");
fs.writeFileSync(modulePath, testable);
const {deriveIdentity} = await import(pathToFileURL(modulePath));
const contract = JSON.parse(fs.readFileSync(contractPath));
const stableA = deriveIdentity(contract, "Feature/Login UI", sha, Number(now));
const stableB = deriveIdentity(contract, "Feature/Login UI", sha, Number(now));
const other = deriveIdentity(contract, "Feature/Other UI", sha, Number(now));
assert.deepEqual(stableA, stableB);
assert.notEqual(stableA.application_id, other.application_id);
assert.notEqual(stableA.bundle_id, other.bundle_id);
const rows = Array.from({length: 100}, (_, i) =>
  deriveIdentity(contract, `feature/collision-vector-${i + 1}`, sha, Number(now)));
assert.equal(rows.length, 100);
assert.equal(new Set(rows.map(row => row.application_id)).size, 100);
assert.equal(new Set(rows.map(row => row.branch_hash)).size, 100);
NODE
ok "branch identities are stable, co-installable, sanitized, and collision-resistant"

rm -f "$TMP/tmp/dev-state.json" "$TMP/tmp/dev-state.json.lock"
for i in $(seq 1 10); do
  node "$ENGINE" allocate-dev --contract "$CONTRACT" --branch feature/burst --sha "$SHA" --now "$NOW" >"$TMP/burst-$i.json" &
done
wait
node --input-type=module - "$TMP" <<'NODE'
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
const rows = Array.from({length: 10}, (_, i) => JSON.parse(fs.readFileSync(path.join(process.argv[2], `burst-${i + 1}.json`))));
const codes = rows.map(row => row.code);
assert.equal(new Set(codes).size, 10);
const ordered = [...codes].sort((a, b) => a - b);
for (let i = 1; i < ordered.length; i++) assert.ok(ordered[i] > ordered[i - 1]);
assert.equal(new Set(rows.flatMap(row => Object.values(row.artifacts))).size, 20);
NODE
ok "development burst and concurrent allocations are strictly unique"

# Contract/input violations are exit 2 and do not escape their state domains.
cp "$CONTRACT" "$TMP/traversal.json"
mutate_json "$TMP/traversal.json" "$TMP/traversal.json" 'row.development.state_file="tmp/../escape.json"'
cp "$CONTRACT" "$TMP/collision.json"
mutate_json "$TMP/collision.json" "$TMP/collision.json" 'row.development.state_file="tmp/shared.json"; row.release.ledger="tmp/shared.json"'
cp "$CONTRACT" "$TMP/overflow.json"
mutate_json "$TMP/overflow.json" "$TMP/overflow.json" 'row.development.state_file="tmp/overflow.json"; row.development.max_code=100'
pids=()
expect_exit 2 "malformed input SHA" node "$ENGINE" derive --contract "$CONTRACT" --branch x --sha nope --now "$NOW" & pids+=("$!")
expect_exit 2 "development state traversal" node "$ENGINE" allocate-dev --contract "$TMP/traversal.json" --branch x --sha "$SHA" --now "$NOW" & pids+=("$!")
expect_exit 2 "development/release state collision" node "$ENGINE" allocate-dev --contract "$TMP/collision.json" --branch x --sha "$SHA" --now "$NOW" & pids+=("$!")
expect_exit 2 "development code overflow" node "$ENGINE" allocate-dev --contract "$TMP/overflow.json" --branch x --sha "$SHA" --now "$NOW" & pids+=("$!")
for contract_case in signing floor_source project template; do
  cp "$CONTRACT" "$TMP/contract-$contract_case.json"
  case "$contract_case" in
    signing) expression='row.development.signing_profile="production"' ;;
    floor_source) expression='row.release.monotonic_floor_source="guess"' ;;
    project) expression='row.project="bad project!"' ;;
    template) expression='row.development.artifact_template="{project}.artifact"' ;;
  esac
  mutate_json "$TMP/contract-$contract_case.json" "$TMP/contract-$contract_case.json" "$expression"
  expect_exit 2 "invalid contract $contract_case" node "$ENGINE" derive --contract "$TMP/contract-$contract_case.json" --branch x --sha "$SHA" --now "$NOW" & pids+=("$!")
done
for pid in "${pids[@]}"; do wait "$pid"; done
[[ ! -e "$TMP/escape.json" ]] || fail "state traversal wrote outside runtime root"
ok "contract enums/templates plus input caps, traversal, and state collision fail with exit 2"

# Helper: turn an allocation into receipt+metadata. Successful evidence writes a
# real artifact with the exact engine-rendered basename and computes its bytes.
cat >"$TMP/make-evidence.mjs" <<'NODE'
import crypto from "node:crypto";
import fs from "node:fs";
const [allocationPath, receiptPath, metadataPath, status = "dev", withArtifact = "yes"] = process.argv.slice(2);
const a = JSON.parse(fs.readFileSync(allocationPath));
const release = a.mode === "release";
const platform = a.platform ?? "android";
const filename = release ? a.artifact_filename : a.artifacts[platform];
const row = {
  schema_version: 1, mode: a.mode, project: a.project, platform,
  application_id: a.application_id, version_code: a.code, build_number: a.code,
  version_name: a.version_name, display_name: a.display_name,
  source_sha: a.source_sha, timestamp: a.timestamp
};
if (platform === "ios" && a.bundle_id) row.bundle_id = a.bundle_id;
if (!release) {
  row.branch_slug = a.branch_slug;
  row.branch_hash = a.branch_hash;
} else {
  row.status = status;
  row.remote_floor = a.remote_floor;
  row.ledger_floor = a.ledger_floor;
}
if (withArtifact === "yes") {
  fs.writeFileSync(filename, `real artifact bytes:${a.mode}:${a.code}:${a.source_sha}:${platform}\n`);
  row.artifact_path = filename;
  row.artifact_filename = filename;
  row.artifact_sha256 = crypto.createHash("sha256").update(fs.readFileSync(filename)).digest("hex");
}
fs.writeFileSync(receiptPath, JSON.stringify(row));
fs.writeFileSync(metadataPath, JSON.stringify(row));
NODE

node "$ENGINE" allocate-dev --contract "$CONTRACT" --branch 'Feature/Verify' --sha "$SHA" --now "$NOW" >"$TMP/dev.json"
run_adapter prepare_dev "$TMP/dev.json" >/dev/null
run_adapter build_dev "$TMP/dev.json" >/dev/null
run_adapter inspect_artifact "$TMP/dev.json" >"$TMP/dev-metadata.json"
cp "$TMP/dev-metadata.json" "$TMP/dev-receipt.json"
node "$ENGINE" verify --contract "$CONTRACT" --receipt "$TMP/dev-receipt.json" --artifact-metadata "$TMP/dev-metadata.json" >"$TMP/dev-verified.json"
node -e 'const r=require(process.argv[1]); if(!r.verified||!r.artifact_sha256) process.exit(1)' "$TMP/dev-verified.json"
[[ -f "$TMP/.fake-adapter/prepared.json" ]] || fail "prepare_dev did not record adapter state"
ok "adapter-prepared development build verifies inspected regular bytes and SHA-256"

# Artifact file and equality failures are runtime/state failures (exit 1).
DEV_ARTIFACT="$(node -e 'process.stdout.write(require(process.argv[1]).artifact_path)' "$TMP/dev-receipt.json")"
mv "$TMP/$DEV_ARTIFACT" "$TMP/saved-artifact"
expect_exit 1 "nonexistent artifact" node "$ENGINE" verify --contract "$CONTRACT" --receipt "$TMP/dev-receipt.json" --artifact-metadata "$TMP/dev-metadata.json"
ln -s "$TMP/saved-artifact" "$TMP/$DEV_ARTIFACT"
expect_exit 1 "symlink artifact" node "$ENGINE" verify --contract "$CONTRACT" --receipt "$TMP/dev-receipt.json" --artifact-metadata "$TMP/dev-metadata.json"
rm "$TMP/$DEV_ARTIFACT"
mv "$TMP/saved-artifact" "$TMP/$DEV_ARTIFACT"
mutate_pair "$TMP/dev-receipt.json" "$TMP/dev-metadata.json" "$TMP/bad-receipt.json" "$TMP/bad-metadata.json" 'row.artifact_sha256="0".repeat(64)'
expect_exit 1 "wrong artifact digest" node "$ENGINE" verify --contract "$CONTRACT" --receipt "$TMP/bad-receipt.json" --artifact-metadata "$TMP/bad-metadata.json"

cp "$TMP/$DEV_ARTIFACT" "$TMP/wrong.artifact"

pids=(); negative_index=0
for entry in \
  'exact filename|row.artifact_path="wrong.artifact"; row.artifact_filename="wrong.artifact"' \
  'project|row.project="wrong-project"' \
  'platform|row.platform="windows"' \
  'timestamp|row.timestamp="20261399T999999Z"' \
  'version|row.version_name="9.9.9"' \
  'development code|row.version_code=0; row.build_number=0' \
  'source SHA|row.source_sha="ABCDEF0"' \
  'branch hash|row.branch_hash="zzzzzzzz"' \
  'branch slug|row.branch_slug="BAD-SLUG"'; do
  label="${entry%%|*}"; expression="${entry#*|}"
  negative_index=$((negative_index + 1))
  receipt="$TMP/bad-$negative_index-receipt.json"; metadata="$TMP/bad-$negative_index-metadata.json"
  mutate_pair "$TMP/dev-receipt.json" "$TMP/dev-metadata.json" "$receipt" "$metadata" "$expression"
  expect_exit 1 "$label mismatch" node "$ENGINE" verify --contract "$CONTRACT" --receipt "$receipt" --artifact-metadata "$metadata" & pids+=("$!")
done
for pid in "${pids[@]}"; do wait "$pid"; done

mkdir -p "$OUTSIDE" "$TMP/absolute"
cp "$TMP/$DEV_ARTIFACT" "$OUTSIDE/$DEV_ARTIFACT"
cp "$TMP/$DEV_ARTIFACT" "$TMP/absolute/$DEV_ARTIFACT"
pids=(); path_index=0
for entry in \
  'equal unknown adapter-output field|row.unexpected_adapter_field="same-value"' \
  'numeric-string development code|row.version_code=String(row.version_code); row.build_number=String(row.build_number)' \
  "artifact path traversal|row.artifact_path=\"../$(basename "$OUTSIDE")/$DEV_ARTIFACT\"" \
  "absolute artifact path|row.artifact_path=\"$TMP/absolute/$DEV_ARTIFACT\""; do
  label="${entry%%|*}"; expression="${entry#*|}"; path_index=$((path_index + 1))
  receipt="$TMP/path-$path_index-receipt.json"; metadata="$TMP/path-$path_index-metadata.json"
  mutate_pair "$TMP/dev-receipt.json" "$TMP/dev-metadata.json" "$receipt" "$metadata" "$expression"
  expect_exit 1 "$label" node "$ENGINE" verify --contract "$CONTRACT" --receipt "$receipt" --artifact-metadata "$metadata" & pids+=("$!")
done
for pid in "${pids[@]}"; do wait "$pid"; done
ok "adapter fields, confined paths, filename, identity, time, version, numeric types, and hashes fail closed"

# Release allocation is keyed by source SHA + platform while active or
# committed. The rendered filename is stable with the original allocation.
release_allocate() {
  node "$ENGINE" allocate-release --contract "$CONTRACT" --remote-floor "$1" --ledger-floor "$2" \
    --sha "$3" --platform "$4" --now "$5"
}
release_allocate 40 44 "$SHA" android "$NOW" >"$TMP/release-a.json"
release_allocate 40 44 "$SHA" android "$((NOW + 30))" >"$TMP/release-a-repeat.json"
node --input-type=module - "$TMP/release-a.json" "$TMP/release-a-repeat.json" <<'NODE'
import assert from "node:assert/strict";
import fs from "node:fs";
const [a, b] = process.argv.slice(2).map(p => JSON.parse(fs.readFileSync(p)));
assert.equal(a.code, 45);
assert.equal(b.code, a.code);
assert.equal(b.artifact_filename, a.artifact_filename);
assert.equal(b.idempotent, true);
assert.equal(a.artifact_filename, `fixture-app-release-${a.timestamp}-${a.code}-${a.source_sha.slice(0,8)}-android.artifact`);
NODE
expect_exit 1 "reserved resume below new floor" release_allocate 999 999 "$SHA" android "$((NOW + 40))"
release_allocate 40 44 "$SHA" ios "$NOW" >"$TMP/release-a-ios.json"
node -e 'const a=require(process.argv[1]),b=require(process.argv[2]); if(a.code===b.code||b.platform!=="ios") process.exit(1)' "$TMP/release-a.json" "$TMP/release-a-ios.json"
ok "release allocation is idempotent by source and platform with exact rendered filename"

# A failed build transitions without inventing artifact evidence, then retrying
# the same source/platform consumes a new higher code.
(cd "$TMP" && node make-evidence.mjs release-a.json failed-receipt.json failed-metadata.json failed no)
node "$ENGINE" verify --contract "$CONTRACT" --receipt "$TMP/failed-receipt.json" --artifact-metadata "$TMP/failed-metadata.json" >"$TMP/failed-result.json"
node -e 'const r=require(process.argv[1]); if(r.status!=="failed"||r.artifact_path!==undefined||r.artifact_sha256!==undefined) process.exit(1)' "$TMP/failed-result.json"
release_allocate 40 44 "$SHA" android "$((NOW + 60))" >"$TMP/release-after-fail.json"
node -e 'const a=require(process.argv[1]),b=require(process.argv[2]); if(!(b.code>a.code)||b.idempotent) process.exit(1)' "$TMP/release-a.json" "$TMP/release-after-fail.json"
ok "failed release records no invented artifact and retry allocates higher"

# Bind one successful allocation through built -> committed, then prove active
# and committed calls are idempotent and committed evidence is immutable.
release_allocate 40 44 "$SHA2" android "$((NOW + 120))" >"$TMP/release-b.json"
run_adapter allocate_release "$TMP/release-b.json" >/dev/null
run_adapter build_release "$TMP/release-b.json" >/dev/null
run_adapter inspect_artifact "$TMP/release-b.json" built >"$TMP/built-metadata.json"
cp "$TMP/built-metadata.json" "$TMP/built-receipt.json"
node "$ENGINE" verify --contract "$CONTRACT" --receipt "$TMP/built-receipt.json" --artifact-metadata "$TMP/built-metadata.json" >/dev/null
node --input-type=module - "$TMP/adapter.jsonl" "$TMP/.fake-adapter/release-inputs.jsonl" <<'NODE'
import assert from "node:assert/strict";
import fs from "node:fs";
const calls = fs.readFileSync(process.argv[2], "utf8").trim().split("\n").map(JSON.parse);
assert.deepEqual(new Set(calls.map(row => row.command)), new Set(["prepare-dev", "build-dev", "inspect", "allocate-release", "build-release"]));
const inputs = fs.readFileSync(process.argv[3], "utf8").trim().split("\n").map(JSON.parse);
assert.equal(inputs.at(-1).source_sha, "1123456789abcdef0123456789abcdef01234567");
NODE
ok "all configured adapter argv commands perform real lifecycle work without a shell"
release_allocate 40 44 "$SHA2" android "$((NOW + 180))" >"$TMP/release-b-built-repeat.json"
node -e 'const a=require(process.argv[1]),b=require(process.argv[2]); if(a.code!==b.code||b.status!=="built"||!b.idempotent) process.exit(1)' "$TMP/release-b.json" "$TMP/release-b-built-repeat.json"
expect_exit 1 "built resume below new floor" release_allocate 999 999 "$SHA2" android "$((NOW + 190))"
mutate_json "$TMP/built-receipt.json" "$TMP/committed-receipt.json" 'row.status="committed"'
mutate_json "$TMP/built-metadata.json" "$TMP/committed-metadata.json" 'row.status="committed"'
node "$ENGINE" verify --contract "$CONTRACT" --receipt "$TMP/committed-receipt.json" --artifact-metadata "$TMP/committed-metadata.json" >/dev/null
LEDGER_HASH="$(sha256sum "$TMP/release/ledger.json" | awk '{print $1}')"
node "$ENGINE" verify --contract "$CONTRACT" --receipt "$TMP/committed-receipt.json" --artifact-metadata "$TMP/committed-metadata.json" >/dev/null
[[ "$LEDGER_HASH" == "$(sha256sum "$TMP/release/ledger.json" | awk '{print $1}')" ]] || fail "committed re-verification mutated ledger"
release_allocate 40 44 "$SHA2" android "$((NOW + 240))" >"$TMP/release-b-committed-repeat.json"
node -e 'const a=require(process.argv[1]),b=require(process.argv[2]); if(a.code!==b.code||b.status!=="committed"||!b.idempotent) process.exit(1)' "$TMP/release-b.json" "$TMP/release-b-committed-repeat.json"
expect_exit 1 "committed replay below newly supplied floor" release_allocate 999 999 "$SHA2" android "$((NOW + 250))"

# Change the real bytes and supply their new valid digest: artifact inspection
# passes, but the committed ledger must reject the changed evidence.
COMMITTED_ARTIFACT="$(node -e 'process.stdout.write(require(process.argv[1]).artifact_path)' "$TMP/committed-receipt.json")"
cp "$TMP/$COMMITTED_ARTIFACT" "$TMP/committed-original"
printf 'mutated committed bytes\n' >"$TMP/$COMMITTED_ARTIFACT"
NEW_DIGEST="$(sha256sum "$TMP/$COMMITTED_ARTIFACT" | awk '{print $1}')"
mutate_json "$TMP/committed-receipt.json" "$TMP/mutated-committed-receipt.json" "row.artifact_sha256=\"$NEW_DIGEST\""
mutate_json "$TMP/committed-metadata.json" "$TMP/mutated-committed-metadata.json" "row.artifact_sha256=\"$NEW_DIGEST\""
expect_exit 1 "committed evidence mutation" node "$ENGINE" verify --contract "$CONTRACT" --receipt "$TMP/mutated-committed-receipt.json" --artifact-metadata "$TMP/mutated-committed-metadata.json"
mv "$TMP/committed-original" "$TMP/$COMMITTED_ARTIFACT"
ok "built and committed evidence is idempotent and immutable"

# Transition, floor, and release-confusion negatives.
release_allocate 40 44 "$SHA3" android "$((NOW + 300))" >"$TMP/release-c.json"
(cd "$TMP" && node make-evidence.mjs release-c.json skip-receipt.json skip-metadata.json committed yes)
expect_exit 1 "reserved to committed transition skip" node "$ENGINE" verify --contract "$CONTRACT" --receipt "$TMP/skip-receipt.json" --artifact-metadata "$TMP/skip-metadata.json"

mutate_json "$TMP/committed-receipt.json" "$TMP/downgrade-receipt.json" 'row.status="built"'
mutate_json "$TMP/committed-metadata.json" "$TMP/downgrade-metadata.json" 'row.status="built"'
expect_exit 1 "committed to built downgrade" node "$ENGINE" verify --contract "$CONTRACT" --receipt "$TMP/downgrade-receipt.json" --artifact-metadata "$TMP/downgrade-metadata.json"

release_allocate 40 44 "$SHA4" android "$((NOW + 360))" >"$TMP/release-d.json"
(cd "$TMP" && node make-evidence.mjs release-d.json floor-receipt.json floor-metadata.json failed no)
mutate_json "$TMP/floor-receipt.json" "$TMP/floor-bad-receipt.json" 'row.remote_floor+=1'
mutate_json "$TMP/floor-metadata.json" "$TMP/floor-bad-metadata.json" 'row.remote_floor+=1'
expect_exit 1 "release floor mismatch" node "$ENGINE" verify --contract "$CONTRACT" --receipt "$TMP/floor-bad-receipt.json" --artifact-metadata "$TMP/floor-bad-metadata.json"
mutate_pair "$TMP/floor-receipt.json" "$TMP/floor-metadata.json" "$TMP/floor-bad-receipt.json" "$TMP/floor-bad-metadata.json" 'row.remote_floor=String(row.remote_floor)'
expect_exit 1 "numeric-string release floor" node "$ENGINE" verify --contract "$CONTRACT" --receipt "$TMP/floor-bad-receipt.json" --artifact-metadata "$TMP/floor-bad-metadata.json"

mutate_json "$TMP/dev-receipt.json" "$TMP/dev-as-release-receipt.json" 'row.mode="release"; row.status="built"; row.remote_floor=0; row.ledger_floor=0'
mutate_json "$TMP/dev-metadata.json" "$TMP/dev-as-release-metadata.json" 'row.mode="release"; row.status="built"; row.remote_floor=0; row.ledger_floor=0'
expect_exit 1 "development evidence as release proof" node "$ENGINE" verify --contract "$CONTRACT" --receipt "$TMP/dev-as-release-receipt.json" --artifact-metadata "$TMP/dev-as-release-metadata.json"
ok "release floor mismatch, dev-as-release, transition skips, and downgrades are rejected"

if {
  git -C "$ROOT" diff --name-only
  git -C "$ROOT" diff --cached --name-only
  git -C "$ROOT" ls-files --others --exclude-standard
} | grep -E '(\.gradle(\.kts)?$|\.xcodeproj/|\.xcworkspace/|(^|/)Podfile)' | grep -q .; then
  fail "framework changeset contains consumer Gradle or Xcode mutations"
fi
! grep -Eiq '^[[:space:]]*(gradle|xcodebuild|adb|simctl)([[:space:]]|$)' "$0" || fail "validator invokes a mobile SDK command"
ok "fake adapter uses no mobile SDK and the framework diff contains no consumer project"

echo "mobile build identity lifecycle: $PASS passed, 0 failed"
