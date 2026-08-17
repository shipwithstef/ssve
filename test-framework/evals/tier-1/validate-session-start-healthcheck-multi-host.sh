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

run_hook_isolated() {
  local host="$1"
  env -u GROK_SESSION_ID -u CLAUDE_SESSION_ID -u CODEX_SESSION_ID \
    -u CODEX_THREAD_ID -u KIMI_SESSION_ID -u GEMINI_SESSION_ID -u SVC_SESSION_ID \
    HOME="$TMP_HOME" SVC_HOST="$host" SVC_REPO_SEARCH_PATHS=/nonexistent \
    node "$HOOK" </dev/null 2>&1 || true
}

run_for_host() {
  local host="$1"
  local skills_path
  skills_path="$(host_field "$host" skills_path)"
  mkdir -p "$skills_path"
  ln -sf /nonexistent/svc-wi186-dangling "$skills_path/dangling-link"

  local out
  out=$(run_hook_isolated "$host")
  rm -f "$skills_path/dangling-link"

  if echo "$out" | grep -q "\[svc-session-start:$host\]" && echo "$out" | grep -q "dangling"; then
    pass "$host drift is surfaced from host skills path"
  else
    fail "$host drift was not surfaced; output: $out"
  fi
}

# WI-542: portable `~` command in Grok/Kimi TOML is present when the file exists.
run_tilde_present() {
  local host="$1"
  local host_dir="$2"
  local skills_path
  skills_path="$(host_field "$host" skills_path)"
  mkdir -p "$skills_path" "$TMP_HOME/.fakehost/skills/hooks"
  printf '%s\n' 'export {}' > "$TMP_HOME/.fakehost/skills/hooks/foo.mjs"
  mkdir -p "$TMP_HOME/$host_dir"
  cat > "$TMP_HOME/$host_dir/config.toml" <<'EOF'
[[hooks]]
event = "SessionStart"
command = "node ~/.fakehost/skills/hooks/foo.mjs"
timeout = 30
EOF
  local out
  out=$(run_hook_isolated "$host")
  rm -f "$TMP_HOME/$host_dir/config.toml" "$TMP_HOME/.fakehost/skills/hooks/foo.mjs"
  if [ -z "$out" ]; then
    pass "$host TOML tilde path present is silent"
  else
    fail "$host TOML tilde present-path was not silent; output: $out"
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

run_tilde_present grok ".grok"
run_tilde_present kimi ".kimi"

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
