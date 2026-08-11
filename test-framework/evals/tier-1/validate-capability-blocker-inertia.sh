#!/usr/bin/env bash
# Tier-1: validate WI-314 capability blocker and deprecated-foundation gates.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

PASS=0
FAIL=0
ERRORS=""

pass() { PASS=$((PASS + 1)); echo "  ✓ $1"; }
fail() { FAIL=$((FAIL + 1)); ERRORS+="    ✗ $1\n"; echo "  ✗ $1"; }

check_contains() {
  local file="$1"
  local needle="$2"
  local label="$3"
  if grep -q -F -- "$needle" "$file"; then
    pass "$label"
  else
    fail "$label"
  fi
}

node --check "$REPO_ROOT/scripts/diagnose-capability-blocker.mjs" >/dev/null && pass "diagnose-capability-blocker parses" || fail "diagnose-capability-blocker parses"
node --check "$REPO_ROOT/scripts/validate-capability-blocker-ledger.mjs" >/dev/null && pass "capability blocker ledger validator parses" || fail "capability blocker ledger validator parses"
node --check "$REPO_ROOT/scripts/scan-deprecated-foundations.mjs" >/dev/null && pass "scan-deprecated-foundations parses" || fail "scan-deprecated-foundations parses"
node --check "$REPO_ROOT/scripts/validate-deprecated-foundations-registry.mjs" >/dev/null && pass "deprecated foundations registry validator parses" || fail "deprecated foundations registry validator parses"
node --check "$REPO_ROOT/scripts/validate-deprecated-foundation-findings.mjs" >/dev/null && pass "deprecated foundation findings validator parses" || fail "deprecated foundation findings validator parses"
node --check "$REPO_ROOT/hooks/svc-inertia-check.mjs" >/dev/null && pass "svc-inertia-check parses" || fail "svc-inertia-check parses"

if node "$REPO_ROOT/scripts/validate-deprecated-foundations-registry.mjs" --root "$REPO_ROOT" >/dev/null 2>&1; then
  pass "deprecated foundations registry freshness passes"
else
  fail "deprecated foundations registry freshness passes"
fi

STALE_REGISTRY="$TMP/stale-deprecated-foundations.json"
node - "$REPO_ROOT/references/deprecated-foundations.json" "$STALE_REGISTRY" <<'NODE'
const fs = require("fs");
const src = process.argv[2];
const dest = process.argv[3];
const registry = JSON.parse(fs.readFileSync(src, "utf8"));
registry.freshness.reviewed_at = "2025-01-01";
registry.freshness.max_age_days = 30;
fs.writeFileSync(dest, `${JSON.stringify(registry, null, 2)}\n`);
NODE
if node "$REPO_ROOT/scripts/validate-deprecated-foundations-registry.mjs" --root "$REPO_ROOT" --registry "$STALE_REGISTRY" --now 2026-05-12T00:00:00Z >/tmp/svc-wi327-stale.out 2>&1; then
  fail "deprecated foundations registry stale metadata blocks"
else
  grep -q "stale" /tmp/svc-wi327-stale.out && pass "deprecated foundations registry stale metadata blocks" || fail "deprecated foundations registry stale metadata blocks"
fi

mkdir -p "$TMP/app" "$TMP/clean"
cat > "$TMP/app/legacy.ts" <<'TS'
export const url = "https://maps.googleapis.com/maps/api/place/details/json?place_id=abc";
TS
cat > "$TMP/clean/new.ts" <<'TS'
export const url = "https://places.googleapis.com/v1/places/abc";
TS

if node "$REPO_ROOT/scripts/scan-deprecated-foundations.mjs" --root "$TMP" --registry "$REPO_ROOT/references/deprecated-foundations.json" --path "$TMP/app" --fail-on-findings >/tmp/svc-wi314-scan.out 2>&1; then
  fail "deprecated foundation scan blocks legacy Places endpoint"
else
  grep -q "google-places-legacy-web-service" /tmp/svc-wi314-scan.out && pass "deprecated foundation scan reports foundation id" || fail "deprecated foundation scan reports foundation id"
fi

if node "$REPO_ROOT/scripts/scan-deprecated-foundations.mjs" --root "$TMP" --registry "$REPO_ROOT/references/deprecated-foundations.json" --path "$TMP/clean" --fail-on-findings >/dev/null 2>&1; then
  pass "deprecated foundation scan allows clean successor endpoint"
else
  fail "deprecated foundation scan allows clean successor endpoint"
fi

FIRST_HIT_ROOT="$TMP/first-hit"
mkdir -p "$FIRST_HIT_ROOT/src" "$FIRST_HIT_ROOT/other" "$FIRST_HIT_ROOT/.svc"
cat > "$FIRST_HIT_ROOT/src/legacy.ts" <<'TS'
export const url = "https://maps.googleapis.com/maps/api/place/details/json?place_id=abc";
TS
cat > "$FIRST_HIT_ROOT/other/legacy.ts" <<'TS'
export const url = "https://maps.googleapis.com/maps/api/place/textsearch/json?query=coffee";
TS
set +e
node "$REPO_ROOT/scripts/scan-deprecated-foundations.mjs" \
  --root "$FIRST_HIT_ROOT" \
  --registry "$REPO_ROOT/references/deprecated-foundations.json" \
  --path "$FIRST_HIT_ROOT/src" \
  --json \
  --first-hit-codebase-scan \
  --promote-findings "$FIRST_HIT_ROOT/.svc/deprecated-foundation-findings.jsonl" \
  --fail-on-findings > "$FIRST_HIT_ROOT/first-hit.json" 2>"$FIRST_HIT_ROOT/first-hit.err"
FIRST_EXIT=$?
set -e
if [ "$FIRST_EXIT" = "2" ]; then
  pass "first-hit deprecated foundation scan still blocks findings"
else
  fail "first-hit deprecated foundation scan still blocks findings"
fi

if node - "$FIRST_HIT_ROOT/first-hit.json" "$FIRST_HIT_ROOT/.svc/deprecated-foundation-findings.jsonl" <<'NODE'
const fs = require("fs");
const report = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const ledger = fs.readFileSync(process.argv[3], "utf8").trim().split(/\n/).map(JSON.parse);
if (!report.first_hit_scan?.triggered) throw new Error("first-hit scan did not trigger");
if (report.first_hit_scan.files_scanned < 2) throw new Error("whole-codebase scan did not scan enough files");
if (!report.first_hit_scan.findings.some((f) => f.file === "other/legacy.ts")) throw new Error("whole-codebase scan missed outside-path finding");
if (!ledger.some((row) => row.scan_scope === "whole-codebase" && row.file === "other/legacy.ts" && row.first_hit === true)) {
  throw new Error("ledger did not promote whole-codebase first-hit row");
}
NODE
then
  pass "first-hit scan promotes whole-codebase findings"
else
  fail "first-hit scan promotes whole-codebase findings"
fi

node "$REPO_ROOT/scripts/validate-deprecated-foundation-findings.mjs" \
  --root "$FIRST_HIT_ROOT" \
  --ledger "$FIRST_HIT_ROOT/.svc/deprecated-foundation-findings.jsonl" >/dev/null \
  && pass "deprecated foundation findings ledger validates" \
  || fail "deprecated foundation findings ledger validates"

set +e
node "$REPO_ROOT/scripts/scan-deprecated-foundations.mjs" \
  --root "$FIRST_HIT_ROOT" \
  --registry "$REPO_ROOT/references/deprecated-foundations.json" \
  --path "$FIRST_HIT_ROOT/src" \
  --json \
  --first-hit-codebase-scan \
  --promote-findings "$FIRST_HIT_ROOT/.svc/deprecated-foundation-findings.jsonl" \
  --fail-on-findings > "$FIRST_HIT_ROOT/repeat-hit.json" 2>"$FIRST_HIT_ROOT/repeat-hit.err"
REPEAT_EXIT=$?
set -e
if [ "$REPEAT_EXIT" = "2" ] && node - "$FIRST_HIT_ROOT/repeat-hit.json" <<'NODE'
const fs = require("fs");
const report = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
if (report.first_hit_scan?.triggered) throw new Error("repeat hit unexpectedly triggered whole-codebase scan");
NODE
then
  pass "prior promoted finding suppresses repeat first-hit scan"
else
  fail "prior promoted finding suppresses repeat first-hit scan"
fi

DIAG=$(node "$REPO_ROOT/scripts/diagnose-capability-blocker.mjs" --root "$REPO_ROOT" --text "blocked by missing capability: provider has no api")
echo "$DIAG" | grep -q '"route_to": "validate-feature"' && pass "capability blocker routes missing capability to validate-feature" || fail "capability blocker routes missing capability to validate-feature"

LEDGER_ROOT="$TMP/ledger-root"
mkdir -p "$LEDGER_ROOT/.svc"
node "$REPO_ROOT/scripts/diagnose-capability-blocker.mjs" \
  --root "$REPO_ROOT" \
  --text "blocked by missing capability: provider has no api" \
  --ledger "$LEDGER_ROOT/.svc/capability-blockers.jsonl" \
  --state detected \
  --source route-workflow \
  --wi WI-326 >/tmp/svc-wi326-ledger.out
node "$REPO_ROOT/scripts/validate-capability-blocker-ledger.mjs" \
  --root "$REPO_ROOT" \
  --ledger "$LEDGER_ROOT/.svc/capability-blockers.jsonl" >/dev/null \
  && pass "diagnose-capability-blocker appends valid detected ledger row" \
  || fail "diagnose-capability-blocker appends valid detected ledger row"

cat >> "$LEDGER_ROOT/.svc/capability-blockers.jsonl" <<'JSONL'
{"schema":1,"ts":"2026-05-12T00:00:00Z","source":"tier-1","state":"recovered","blocker_id":"missing-product-capability","route_to":"validate-feature","owner_skill":"validate-feature","matched_signals":["missing capability"],"diagnosis":"fixture","wi":"WI-326","recovery_attempts":[{"ts":"2026-05-12T00:01:00Z","action":"ran validate-feature","result":"capability added","evidence":["docs/specs/features/example.md"]}]}
{"schema":1,"ts":"2026-05-12T00:00:00Z","source":"tier-1","state":"blocked-on-user","blocker_id":"provider-auth-or-token","route_to":"provider-environment-skill","owner_skill":"base44-environment","matched_signals":["expired token"],"diagnosis":"fixture","wi":"WI-326","blocked_on":"user must refresh provider token"}
{"schema":1,"ts":"2026-05-12T00:00:00Z","source":"tier-1","state":"false-positive","blocker_id":"unknown-provider-api","route_to":"research","owner_skill":"research","matched_signals":["provider behavior"],"diagnosis":"fixture","wi":"WI-326","false_positive_reason":"request quoted old error text only"}
JSONL
node "$REPO_ROOT/scripts/validate-capability-blocker-ledger.mjs" \
  --root "$REPO_ROOT" \
  --ledger "$LEDGER_ROOT/.svc/capability-blockers.jsonl" >/dev/null \
  && pass "ledger accepts recovered, blocked-on-user, and false-positive states" \
  || fail "ledger accepts recovered, blocked-on-user, and false-positive states"

cat > "$LEDGER_ROOT/.svc/bad-capability-blockers.jsonl" <<'JSONL'
{"schema":1,"ts":"2026-05-12T00:00:00Z","source":"tier-1","state":"recovered","blocker_id":"missing-product-capability","route_to":"validate-feature","owner_skill":"validate-feature","matched_signals":["missing capability"],"diagnosis":"fixture","wi":"WI-326"}
JSONL
if node "$REPO_ROOT/scripts/validate-capability-blocker-ledger.mjs" \
  --root "$REPO_ROOT" \
  --ledger "$LEDGER_ROOT/.svc/bad-capability-blockers.jsonl" >/dev/null 2>&1; then
  fail "ledger rejects recovered state without recovery evidence"
else
  pass "ledger rejects recovered state without recovery evidence"
fi

HOOK_TMP="$TMP/hook"
mkdir -p "$HOOK_TMP/hooks/lib" "$HOOK_TMP/scripts/lib" "$HOOK_TMP/references"
cp "$REPO_ROOT/hooks/svc-inertia-check.mjs" "$HOOK_TMP/hooks/"
cp "$REPO_ROOT/hooks/lib/hook-payload.mjs" "$HOOK_TMP/hooks/lib/"
cp "$REPO_ROOT/hooks/lib/operation-scope.mjs" "$HOOK_TMP/hooks/lib/"
cp "$REPO_ROOT/hooks/lib/hook-decision.mjs" "$HOOK_TMP/hooks/lib/"
cp "$REPO_ROOT/scripts/lib/deprecated-foundations.mjs" "$HOOK_TMP/scripts/lib/"
cp "$REPO_ROOT/references/deprecated-foundations.json" "$HOOK_TMP/references/"

PAYLOAD='{"tool_name":"Write","tool_input":{"file_path":"src/legacy.ts","content":"fetch(\"https://maps.googleapis.com/maps/api/place/details/json\")"}}'
set +e
echo "$PAYLOAD" | (cd "$HOOK_TMP" && node hooks/svc-inertia-check.mjs) >/tmp/svc-wi314-hook.out 2>&1
EXIT=$?
set -e
[ "$EXIT" = "2" ] && pass "svc-inertia-check blocks deprecated foundation writes" || fail "svc-inertia-check blocks deprecated foundation writes"
grep -q "google-places-legacy-web-service" /tmp/svc-wi314-hook.out && pass "svc-inertia-check names blocked foundation" || fail "svc-inertia-check names blocked foundation"

if echo "$PAYLOAD" | (cd "$HOOK_TMP" && SVC_INERTIA_ACK=google-places-legacy-web-service node hooks/svc-inertia-check.mjs) >/dev/null 2>&1; then
  pass "svc-inertia-check allows explicit foundation acknowledgement"
else
  fail "svc-inertia-check allows explicit foundation acknowledgement"
fi

check_contains "$REPO_ROOT/skills/route-workflow/SKILL.md" "diagnose-capability-blocker.mjs" "route-workflow invokes capability blocker diagnosis"
check_contains "$REPO_ROOT/skills/route-workflow/SKILL.md" ".svc/capability-blockers.jsonl" "route-workflow writes capability blocker ledger"
check_contains "$REPO_ROOT/skills/route-workflow/SKILL.md" "validate-capability-blocker-ledger.mjs" "route-workflow validates capability blocker ledger"
check_contains "$REPO_ROOT/skills/capability-registry/SKILL.md" 'Do not create a separate `capability-preflight` skill' "capability preflight decision extends capability skills"
check_contains "$REPO_ROOT/skills/capability-concierge/SKILL.md" ".svc/capability-blockers.jsonl" "capability-concierge reads blocker ledger"
check_contains "$REPO_ROOT/skills/design-tech/SKILL.md" "scan-deprecated-foundations.mjs" "design-tech invokes deprecated foundation scanner"
check_contains "$REPO_ROOT/skills/plan-changeset/SKILL.md" "scan-deprecated-foundations.mjs" "plan-changeset invokes deprecated foundation scanner"
check_contains "$REPO_ROOT/skills/design-tech/SKILL.md" "--first-hit-codebase-scan" "design-tech schedules first-hit whole-codebase scan"
check_contains "$REPO_ROOT/skills/plan-changeset/SKILL.md" ".svc/deprecated-foundation-findings.jsonl" "plan-changeset promotes deprecated foundation findings"
check_contains "$REPO_ROOT/references/deprecated-foundations-lifecycle.md" ".svc/deprecated-foundation-findings.jsonl" "deprecated foundation lifecycle defines promotion surface"
check_contains "$REPO_ROOT/skills/base44-environment/SKILL.md" "Expired or Broken JWT Recovery" "base44-environment documents expired token recovery"

if node - "$REPO_ROOT" <<'NODE'
const fs = require("fs");
const path = require("path");
const root = process.argv[2];
const mapPath = path.join(root, "docs/specs/work-items/WI-314-residual-map.json");
const map = JSON.parse(fs.readFileSync(mapPath, "utf8"));
if (map.wi !== "WI-314") throw new Error("wrong wi");
if (!Array.isArray(map.findings) || map.findings.length < 10) throw new Error("too few findings");
for (const id of ["WI-326", "WI-327"]) {
  if (!fs.existsSync(path.join(root, `docs/specs/work-items/${id}.md`))) {
    throw new Error(`missing child ${id}`);
  }
}
const triage = JSON.parse(fs.readFileSync(path.join(root, "proposals/triage.json"), "utf8"));
for (const name of [
  "2026-04-25-capability-blocker-auto-diagnosis.md",
  "2026-04-25-inertia-detection-deprecated-api-check.md"
]) {
  const entry = triage.entries[name];
  if (!entry || entry.residual_map !== "docs/specs/work-items/WI-314-residual-map.json") {
    throw new Error(`triage missing residual map for ${name}`);
  }
}
NODE
then
  pass "WI-314 residual map and child WI pointers are wired"
else
  fail "WI-314 residual map and child WI pointers are wired"
fi

echo ""
echo "validate-capability-blocker-inertia: $PASS passed, $FAIL failed"
if [ "$FAIL" -gt 0 ]; then
  printf "$ERRORS"
  exit 1
fi
