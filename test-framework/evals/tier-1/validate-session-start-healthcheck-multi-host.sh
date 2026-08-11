#!/usr/bin/env bash
# Tier 1: SessionStart healthcheck resolves every provisioned host's skills path.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$REPO_ROOT"
HOOK="$REPO_ROOT/hooks/svc-session-start-healthcheck.mjs"
RESOLVER="$REPO_ROOT/scripts/resolve-host-paths.mjs"
FIXTURE_MANIFEST="$REPO_ROOT/provision/hosts/fixture-wi186.json"
TMP_HOME=""
trap 'rm -rf "$TMP_HOME" "$FIXTURE_MANIFEST" 2>/dev/null || true' EXIT

PASS=0
FAIL=0

pass() {
  echo "  ✓ $1"
  PASS=$((PASS + 1))
}

fail() {
  echo "  FAIL: $1"
  FAIL=$((FAIL + 1))
}

host_field() {
  local host="$1"
  local field="$2"
  HOME="$TMP_HOME" node - "$host" "$field" <<'NODE'
const { readFileSync } = require("node:fs");
const path = require("node:path");
const host = process.argv[2];
const field = process.argv[3];
const repo = process.cwd();
const manifest = JSON.parse(readFileSync(path.join(repo, "provision", "hosts", `${host}.json`), "utf8"));
let value = manifest[field] || "";
if (value.startsWith("~/")) value = `${process.env.HOME}${value.slice(1)}`;
process.stdout.write(value);
NODE
}

run_for_host() {
  local host="$1"
  local skills_path
  skills_path="$(host_field "$host" skills_path)"
  mkdir -p "$skills_path"
  ln -sf /nonexistent/svc-wi186-dangling "$skills_path/dangling-link"

  local out
  out=$(HOME="$TMP_HOME" SVC_HOST="$host" SVC_REPO_SEARCH_PATHS=/nonexistent node "$HOOK" </dev/null 2>&1 || true)
  rm -f "$skills_path/dangling-link"

  if echo "$out" | grep -q "\[svc-session-start:$host\]" && echo "$out" | grep -q "dangling"; then
    pass "$host drift is surfaced from host skills path"
  else
    fail "$host drift was not surfaced; output: $out"
  fi
}

echo "=== Tier 1: SessionStart Healthcheck Multi-Host ==="

TMP_HOME="$(mktemp -d)"

if node --check "$HOOK" >/dev/null && node --check "$RESOLVER" >/dev/null; then
  pass "healthcheck and host path resolver parse"
else
  fail "healthcheck or host path resolver syntax invalid"
fi

mapfile -t HOSTS < <(node -e '
const fs = require("fs");
const path = require("path");
for (const file of fs.readdirSync("provision/hosts").filter((f) => f.endsWith(".json")).sort()) {
  const manifest = JSON.parse(fs.readFileSync(path.join("provision/hosts", file), "utf8"));
  console.log(manifest.host);
}
')

for host in "${HOSTS[@]}"; do
  run_for_host "$host"
done

cat > "$FIXTURE_MANIFEST" <<'JSON'
{
  "host": "fixture-wi186",
  "name": "WI-186 Fixture Host",
  "skills_path": "~/.fixture-wi186/skills",
  "builder_profile_path": "~/.svc/builder-profile.md",
  "capabilities": {
    "skills": true,
    "hooks": false,
    "plugins": false,
    "mcp": false,
    "commands": false,
    "agents": false
  },
  "infra_files": ["DOCTRINE.md"],
  "infra_dirs": ["scripts"],
  "skip": [],
  "post_install_commands": [],
  "verify_commands": [
    "test -f {skills_path}/DOCTRINE.md"
  ]
}
JSON

if HOME="$TMP_HOME" node "$RESOLVER" fixture-wi186 >/tmp/svc-wi186-resolver.out 2>&1; then
  if grep -q '"host": "fixture-wi186"' /tmp/svc-wi186-resolver.out; then
    pass "fixture host resolves from manifest without healthcheck code changes"
  else
    fail "fixture host resolver output missing host"
  fi
else
  fail "fixture host resolver failed"
fi

run_for_host fixture-wi186

rm -f /tmp/svc-wi186-resolver.out

echo ""
echo "session-start healthcheck multi-host: $PASS passed, $FAIL failed"
if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
