#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

pass=0
fail=0

check() {
  local label="$1"
  shift
  if "$@" >"$TMP/out" 2>&1; then
    echo "  ✓ $label"
    pass=$((pass + 1))
  else
    echo "  ✗ $label"
    cat "$TMP/out"
    fail=$((fail + 1))
  fi
}

echo "=== Tier 1: Auto-Learning Capture ==="

check "hook syntax valid" node --check "$ROOT/hooks/svc-auto-capture-learnings.mjs"
check "detector syntax valid" node --check "$ROOT/scripts/lib/learning-candidate-detector.mjs"
check "dedup syntax valid" node --check "$ROOT/scripts/lib/learning-dedup.mjs"

FIX="$TMP/repo"
mkdir -p "$FIX"
git -C "$FIX" init -q
git -C "$FIX" config user.email test@example.com
git -C "$FIX" config user.name "Test User"
mkdir -p "$FIX/references" "$FIX/docs/learnings" "$FIX/.svc"
printf '{}\n' > "$FIX/references/framework-learnings.jsonl"
printf 'one\n' > "$FIX/file.txt"
git -C "$FIX" add .
git -C "$FIX" commit -qm "initial"
BASE="$(git -C "$FIX" rev-parse HEAD)"
git -C "$FIX" branch -M main
git -C "$FIX" checkout -qb feature-test
printf 'two\n' > "$FIX/file.txt"
git -C "$FIX" add file.txt
git -C "$FIX" commit -qm "feat: first attempt"
printf 'three\n' > "$FIX/file.txt"
git -C "$FIX" add file.txt
git -C "$FIX" commit -qm "fix(WI-343): address failed first attempt"

run_hook() {
  SVC_AUTO_LEARN_ROOT="$FIX" \
  SVC_AUTO_LEARN_BASE="$BASE" \
  SVC_AUTO_LEARN_TIMEOUT_MS=1000 \
  node "$ROOT/hooks/svc-auto-capture-learnings.mjs" --trigger stop
}

check "correction-after-failure captures to gitignored log" run_hook
check "audit log contains correction candidate" grep -q '"signal":"correction-after-failure"' "$FIX/.svc/auto-learnings.jsonl"
check "dedup skips duplicate candidate" bash -c 'before=$(wc -l < "$0/.svc/auto-learnings.jsonl"); SVC_AUTO_LEARN_ROOT="$0" SVC_AUTO_LEARN_BASE="$1" SVC_AUTO_LEARN_TIMEOUT_MS=1000 node "$2/hooks/svc-auto-capture-learnings.mjs" --trigger stop; after=$(wc -l < "$0/.svc/auto-learnings.jsonl"); [[ "$before" = "$after" ]]' "$FIX" "$BASE" "$ROOT"
check "default mode leaves tracked learning files clean" bash -c 'git -C "$0" diff --quiet -- references/framework-learnings.jsonl docs/learnings/learnings.jsonl' "$FIX"
check "summary mode emits 3 lines" bash -c 'SVC_AUTO_LEARN_SUMMARY=1 SVC_AUTO_LEARN_ROOT="$0" SVC_AUTO_LEARN_BASE="$1" SVC_AUTO_LEARN_TIMEOUT_MS=1000 node "$2/hooks/svc-auto-capture-learnings.mjs" --trigger stop | wc -l | grep -qx 3' "$FIX" "$BASE" "$ROOT"
check "wire-hooks declares auto-learning hook" node "$ROOT/scripts/wire-hooks.mjs" --skills-path "$ROOT" --list-all
check "canonical hooks.json mentions auto-learning hook" grep -q 'svc-auto-capture-learnings' "$ROOT/hooks/hooks.json"
# Schema-shape assertion: every emitted JSONL line must have all required schema
# keys and zero unknown keys. Catches drift like the `trigger` field landing
# without a schema update (Codex PR #125 HIGH finding).
check "emitted JSONL conforms to schema shape" bash -c '
  set -euo pipefail
  node -e "
    const fs = require(\"fs\");
    const schema = JSON.parse(fs.readFileSync(\"$1/references/schemas/auto-learning-candidate.schema.json\", \"utf8\"));
    const required = new Set(schema.required || []);
    const allowed = new Set(Object.keys(schema.properties || {}));
    const lines = fs.readFileSync(\"$0/.svc/auto-learnings.jsonl\", \"utf8\").split(/\r?\n/).filter(Boolean);
    if (lines.length === 0) throw new Error(\"no emitted records to validate\");
    for (const line of lines) {
      const obj = JSON.parse(line);
      const keys = new Set(Object.keys(obj));
      for (const r of required) if (!keys.has(r)) throw new Error(\"missing required key \" + r);
      if (schema.additionalProperties === false) {
        for (const k of keys) if (!allowed.has(k)) throw new Error(\"unknown key \" + k + \" not in schema.properties\");
      }
    }
  "
' "$FIX" "$ROOT"

# Regression: preload must surface a detector-produced (confidence 6 or 7)
# auto candidate. PR #127 review HIGH: tracked-learning threshold of 8 was
# starving every auto entry the detectors actually emit.
PRELOAD_FIX="$TMP/preload-fixture"
mkdir -p "$PRELOAD_FIX/references" "$PRELOAD_FIX/.svc" "$PRELOAD_FIX/hooks"
# Sentinel-only tracked file so the preload output is dominated by the auto
# candidate we are asserting on (avoids brittle string matching against
# real framework-learnings entries).
printf '{"date":"2026-04-01","skill":"test","type":"sentinel","key":"preload-sentinel-noop","insight":"Sentinel tracked entry for the preload fixture.","confidence":7}\n' > "$PRELOAD_FIX/references/framework-learnings.jsonl"
# Confidence-6 auto candidate — the floor a detector emits.
printf '{"schema_version":1,"captured_at":"2026-05-12T19:00:00Z","signal":"hook-side-effect","key":"preload-conf6-regression","insight":"PR #127 review HIGH regression — confidence-6 auto candidate must preload despite tracked threshold being 8.","confidence":6,"source":"preload fixture","session_id":"preload@test","candidate_target":"framework-learnings","files":[]}\n' > "$PRELOAD_FIX/.svc/auto-learnings.jsonl"
# Copy (not symlink) the hook into the fixture. The hook resolves REPO_ROOT
# as `../` from the hook file via fileURLToPath, and Node resolves a symlink
# to its target before computing __dirname — so a symlink would read the
# real repo's references/ and .svc/, defeating the isolation we want.
cp "$ROOT/hooks/svc-learning-preload.mjs" "$PRELOAD_FIX/hooks/svc-learning-preload.mjs"
check "preload surfaces a confidence-6 auto candidate" bash -c '
  node "$0/hooks/svc-learning-preload.mjs" | grep -q "preload-conf6-regression"
' "$PRELOAD_FIX"

check "preload tags auto candidates with [auto-captured (unpromoted)]" bash -c '
  node "$0/hooks/svc-learning-preload.mjs" | grep -q "auto-captured (unpromoted)"
' "$PRELOAD_FIX"

check "preload still respects tracked-only confidence floor" bash -c '
  # Insert a confidence-5 tracked entry; assert it does NOT appear.
  printf "{\"date\":\"2026-04-01\",\"skill\":\"test\",\"type\":\"sentinel\",\"key\":\"low-conf-tracked\",\"insight\":\"Low-confidence tracked entry must not preload.\",\"confidence\":5}\n" >> "$0/references/framework-learnings.jsonl"
  ! node "$0/hooks/svc-learning-preload.mjs" | grep -q "low-conf-tracked"
' "$PRELOAD_FIX"

# Regression: the standalone CLI must emit candidates that conform to the
# schema (PR #128 review HIGH — CLI was emitting trigger:"manual-cli" before
# the enum allowed it). Reuses the schema-shape probe on CLI output, both
# dry-run-stdout AND audit-log-write paths.
CLI_FIX="$TMP/cli-fixture"
mkdir -p "$CLI_FIX"
git -C "$CLI_FIX" init -q
git -C "$CLI_FIX" config user.email test@example.com
git -C "$CLI_FIX" config user.name "Test User"
mkdir -p "$CLI_FIX/references" "$CLI_FIX/.svc"
printf '{}\n' > "$CLI_FIX/references/framework-learnings.jsonl"
printf 'one\n' > "$CLI_FIX/file.txt"
git -C "$CLI_FIX" add . && git -C "$CLI_FIX" commit -qm "initial"
CLI_BASE=$(git -C "$CLI_FIX" rev-parse HEAD)
git -C "$CLI_FIX" branch -M main
git -C "$CLI_FIX" checkout -qb feature
printf 'two\n' > "$CLI_FIX/file.txt"
git -C "$CLI_FIX" add file.txt && git -C "$CLI_FIX" commit -qm "feat: x"
printf 'three\n' > "$CLI_FIX/file.txt"
git -C "$CLI_FIX" add file.txt && git -C "$CLI_FIX" commit -qm "fix(WI-X): address y"

check "CLI dry-run output conforms to schema" bash -c '
  cd "$0" && node "$1/scripts/capture-session-learnings.mjs" --root "$0" --scope "$2" --dry-run > "$0/dryrun.jsonl" 2>/dev/null
  [ -s "$0/dryrun.jsonl" ] || { echo "no candidates emitted"; exit 1; }
  node -e "
    const fs = require(\"fs\");
    const schema = JSON.parse(fs.readFileSync(\"$1/references/schemas/auto-learning-candidate.schema.json\", \"utf8\"));
    const required = new Set(schema.required || []);
    const allowed = new Set(Object.keys(schema.properties || {}));
    const triggerEnum = new Set(schema.properties.trigger.enum);
    const lines = fs.readFileSync(\"$0/dryrun.jsonl\", \"utf8\").split(/\r?\n/).filter(Boolean);
    if (lines.length === 0) throw new Error(\"empty dry-run output\");
    for (const line of lines) {
      const obj = JSON.parse(line);
      const keys = new Set(Object.keys(obj));
      for (const r of required) if (!keys.has(r)) throw new Error(\"missing required key \" + r);
      if (schema.additionalProperties === false) {
        for (const k of keys) if (!allowed.has(k)) throw new Error(\"unknown key \" + k);
      }
      if (obj.trigger !== undefined && !triggerEnum.has(obj.trigger)) {
        throw new Error(\"trigger value \\\"\" + obj.trigger + \"\\\" not in enum [\" + [...triggerEnum].join(\", \") + \"]\");
      }
    }
  "
' "$CLI_FIX" "$ROOT" "$CLI_BASE"

check "CLI audit-log writes produce trigger=manual-cli (in enum)" bash -c '
  cd "$0" && node "$1/scripts/capture-session-learnings.mjs" --root "$0" --scope "$2" >/dev/null 2>&1
  [ -s "$0/.svc/auto-learnings.jsonl" ] || { echo "no audit-log entries written"; exit 1; }
  grep -q "\"trigger\":\"manual-cli\"" "$0/.svc/auto-learnings.jsonl"
' "$CLI_FIX" "$ROOT" "$CLI_BASE"

check "schema enum includes manual-cli" bash -c '
  node -e "
    const s = JSON.parse(require(\"fs\").readFileSync(\"$0/references/schemas/auto-learning-candidate.schema.json\", \"utf8\"));
    if (!s.properties.trigger.enum.includes(\"manual-cli\")) throw new Error(\"manual-cli missing from trigger enum\");
  "
' "$ROOT"

echo ""
echo "auto-learning capture: $pass passed, $fail failed"
[[ "$fail" -eq 0 ]]
